import express from 'express';
import { db, isUniqueViolation } from '../db.js';
import { currentManagerLogin, requireAuth } from '../lib/auth.js';
import { money, utcDate } from '../lib/format.js';
import { bodyOf, isBlank, longParam } from '../lib/http.js';
import { hashPassword } from '../lib/password.js';
import { USER_COLUMNS, toUserRow } from '../lib/rows.js';
import { walletNotifier } from '../realtime/wallet.js';

export const router = express.Router();
router.use(requireAuth);
router.param('id', longParam);

/** All end users for the Users List page and treeview leaves. */
router.get('/', async (req, res) => {
  const rows = await db.query(`SELECT ${USER_COLUMNS} FROM Users ORDER BY Uid`);
  res.json(rows.map((r) => toUserRow(r)));
});

/** Create an end user directly under a partner. Created active. */
router.post('/', async (req, res) => {
  const body = bodyOf(req);
  const parentId = body.long('parentId');
  const name = body.str('name');
  const loginId = body.str('loginId');
  const password = body.str('password');
  const email = body.str('email');
  const bankName = body.str('bankName');
  const bankAccount = body.str('bankAccount');
  const bankMaster = body.str('bankMaster');

  if (isBlank(name) || isBlank(loginId) || isBlank(password))
    return res.status(400).json({ message: 'Name, ID and password are required.' });

  const [parent] = await db.query('SELECT Uid FROM Partners WHERE Uid = :id', { id: parentId });
  if (!parent) return res.status(400).json({ message: 'Parent agent not found.' });

  const taken = `The ID "${loginId}" is already taken.`;
  const exists = await db.query('SELECT 1 AS taken FROM Users WHERE LoginId = :loginId LIMIT 1', { loginId });
  if (exists.length) return res.status(409).json({ message: taken });

  const now = new Date();
  let inserted;
  try {
    inserted = await db.query(
      `INSERT INTO Users (Name, LoginId, Password, PartnerId, Email, BankName, BankAccount, BankMaster,
                          Balance, Point, DepositAmount, DepositCount, WithdrawAmount, WithdrawCount,
                          Status, CreatedAt, UpdatedAt)
       VALUES (:name, :loginId, :password, :partnerId, :email, :bankName, :bankAccount, :bankMaster,
               0, 0, 0, 0, 0, 0, 'Active', :now, :now)`,
      {
        name, loginId, password: await hashPassword(password), partnerId: parent.Uid,
        email, bankName, bankAccount, bankMaster, now,
      });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: taken });
    throw err;
  }

  res.json(toUserRow({
    Uid: inserted.insertId, Name: name, LoginId: loginId, PartnerId: parent.Uid,
    Balance: 0, Point: 0, DepositAmount: 0, DepositCount: 0, WithdrawAmount: 0, WithdrawCount: 0,
    Status: 'Active', BankName: bankName, Email: email, BankAccount: bankAccount, BankMaster: bankMaster,
  }, utcDate(now)));
});

/** Approve a pending sign-up: flip the user's status to Active. */
router.post('/:id/approve', async (req, res) => {
  await db.query("UPDATE Users SET Status = 'Active', UpdatedAt = :now WHERE Uid = :id",
    { now: new Date(), id: req.params.id });
  const [user] = await db.query(`SELECT ${USER_COLUMNS} FROM Users WHERE Uid = :id`, { id: req.params.id });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json(toUserRow(user));
});

/**
 * Pay (add) or collect (subtract) a user's balance or point. Returns the
 * updated user row.
 */
router.post('/:id/adjust', async (req, res) => {
  const body = bodyOf(req);
  const field = (body.str('field') ?? '').trim().toLowerCase();
  const mode = (body.str('mode') ?? '').trim().toLowerCase();
  const amount = body.num('amount');

  if (field !== 'balance' && field !== 'point')
    return res.status(400).json({ message: "Field must be 'balance' or 'point'." });
  if (mode !== 'pay' && mode !== 'collect')
    return res.status(400).json({ message: "Mode must be 'pay' or 'collect'." });
  if (amount <= 0)
    return res.status(400).json({ message: 'Amount must be greater than zero.' });

  const result = await db.transaction(async ({ query }) => {
    const [user] = await query(`SELECT ${USER_COLUMNS} FROM Users WHERE Uid = :id FOR UPDATE`, { id: req.params.id });
    if (!user) return { status: 404, body: { message: 'User not found.' } };

    const column = field === 'balance' ? 'Balance' : 'Point';
    const current = Number(user[column]);
    if (mode === 'collect' && amount > current)
      return { status: 400, body: { message: `Cannot collect more than the user's ${field} (${current.toFixed(2)}).` } };

    const before = current;
    const after = money(mode === 'pay' ? current + amount : current - amount);
    user[column] = after;
    const now = new Date();

    await query(`UPDATE Users SET ${column} = :after, UpdatedAt = :now WHERE Uid = :id`,
      { after, now, id: req.params.id });

    // Record the movement: the balance side in Transactions, the point side in
    // PointHistory. Applied immediately by the admin, so status is "finished".
    const manager = await currentManagerLogin(req, query);
    const type = mode === 'pay' ? 'payment' : 'collect';
    const unit = field === 'balance' ? '$' : 'P';
    const verb = mode === 'pay' ? 'pays' : 'collects';
    const prep = mode === 'pay' ? 'to' : 'from';
    const memo = `${manager ?? 'admin'} ${verb} ${amount}${unit} ${prep} ${user.LoginId}`;
    const params = { type, amount, before, after, userId: user.LoginId, memo, now };

    if (field === 'balance') {
      await query(
        `INSERT INTO Transactions (type, status, userid, managerid, amount, beforeamount, afteramount, memo, target_type, created_at, updated_at)
         VALUES (:type, 'finished', :userId, :manager, :amount, :before, :after, :memo, 'user', :now, :now)`,
        { ...params, manager });
    } else {
      await query(
        `INSERT INTO PointHistory (type, amount, beforeamount, afteramount, userid, memo, target_type, created_at)
         VALUES (:type, :amount, :before, :after, :userId, :memo, 'user', :now)`,
        params);
    }
    return { status: 200, body: toUserRow(user), user };
  });

  if (result.user) walletNotifier.walletChanged(result.user.LoginId, Number(result.user.Balance), Number(result.user.Point));
  res.status(result.status).json(result.body);
});
