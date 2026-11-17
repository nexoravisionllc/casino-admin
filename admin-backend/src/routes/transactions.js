import express from 'express';
import { db } from '../db.js';
import { currentManagerLogin, requireAuth } from '../lib/auth.js';
import { money } from '../lib/format.js';
import { longParam } from '../lib/http.js';
import { TRANSACTION_COLUMNS, toTransactionRow } from '../lib/rows.js';
import { walletNotifier } from '../realtime/wallet.js';

export const router = express.Router();
router.use(requireAuth);
router.param('id', longParam);

const isDepositOrWithdraw = (tx) => tx.type === 'deposit' || tx.type === 'withdraw';

/** All transactions, newest first. */
router.get('/', async (req, res) => {
  const rows = await db.query(`SELECT ${TRANSACTION_COLUMNS} FROM Transactions ORDER BY uid DESC`);
  res.json(rows.map(toTransactionRow));
});

/**
 * Runs a request action in a transaction with the transaction row (and the
 * user row, when needed) locked. `act` returns { message } on success or
 * { error } to reply { success: false } without changing anything.
 */
async function handle(req, res, act) {
  const outcome = await db.transaction(async ({ query }) => {
    const [tx] = await query(
      'SELECT uid, type, amount, beforeamount, status, userid, managerid FROM Transactions WHERE uid = :id FOR UPDATE',
      { id: req.params.id });
    if (!tx) return { error: 'Transaction not found.' };

    const loadUser = async () => (await query(
      `SELECT Uid, LoginId, Balance, Point, DepositAmount, DepositCount, WithdrawAmount, WithdrawCount
       FROM Users WHERE LoginId = :loginId FOR UPDATE`,
      { loginId: tx.userid }))[0];

    const result = await act({ query, tx: { ...tx, amount: Number(tx.amount), beforeamount: Number(tx.beforeamount) }, loadUser });
    if (result.error) return result;

    const sets = ['status = :status', 'managerid = :managerId', 'updated_at = :now'];
    const params = {
      status: result.status,
      managerId: (await currentManagerLogin(req, query)) ?? tx.managerid,
      now: new Date(),
      id: tx.uid,
    };
    // Only balance-changing actions rewrite the before/after amounts.
    if (result.after !== undefined) {
      sets.push('beforeamount = :before', 'afteramount = :after');
      Object.assign(params, { before: result.before, after: result.after });
    }
    await query(`UPDATE Transactions SET ${sets.join(', ')} WHERE uid = :id`, params);
    return result;
  });

  if (outcome.error) return res.json({ success: false, message: outcome.error });

  if (outcome.user) walletNotifier.walletChanged(outcome.user.LoginId, outcome.user.Balance, outcome.user.Point);
  else walletNotifier.adminsChanged();
  res.json({ success: true, message: outcome.message });
}

const saveUser = (query, user) => query(
  `UPDATE Users SET Balance = :balance, DepositAmount = :depositAmount, DepositCount = :depositCount,
                    WithdrawAmount = :withdrawAmount, WithdrawCount = :withdrawCount, UpdatedAt = :now
   WHERE Uid = :uid`,
  {
    balance: user.Balance, depositAmount: user.DepositAmount, depositCount: user.DepositCount,
    withdrawAmount: user.WithdrawAmount, withdrawCount: user.WithdrawCount, now: new Date(), uid: user.Uid,
  });

const numericUser = (u) => ({
  ...u,
  Balance: Number(u.Balance), Point: Number(u.Point),
  DepositAmount: Number(u.DepositAmount), DepositCount: Number(u.DepositCount),
  WithdrawAmount: Number(u.WithdrawAmount), WithdrawCount: Number(u.WithdrawCount),
});

/**
 * Accept a pending deposit or withdraw: a deposit credits the user's balance,
 * a withdraw debits it. Fills the record's null fields (afteramount /
 * updated_at). Returns 200 with a success flag.
 */
router.post('/:id/accept', (req, res) => handle(req, res, async ({ query, tx, loadUser }) => {
  if (!isDepositOrWithdraw(tx)) return { error: 'Only deposit or withdraw requests can be accepted here.' };
  if (tx.status !== 'pending') return { error: 'Only pending requests can be accepted.' };

  const found = await loadUser();
  if (!found) return { error: 'User not found.' };
  const user = numericUser(found);

  let before = tx.beforeamount, after;
  if (tx.type === 'deposit') {
    user.Balance = money(user.Balance + tx.amount);
    user.DepositAmount = money(user.DepositAmount + tx.amount);
    user.DepositCount += 1;
    after = money(tx.beforeamount + tx.amount);
  } else {
    if (user.Balance < tx.amount) return { error: 'User has insufficient balance for this withdrawal.' };
    // Re-anchor before/after to the balance at accept time.
    before = user.Balance;
    user.Balance = money(user.Balance - tx.amount);
    user.WithdrawAmount = money(user.WithdrawAmount + tx.amount);
    user.WithdrawCount += 1;
    after = user.Balance;
  }
  await saveUser(query, user);

  return {
    status: 'finished', before, after, user,
    message: tx.type === 'withdraw' ? 'Withdraw accepted.' : 'Deposit accepted.',
  };
}));

/** Reject a pending deposit (no balance change). */
router.post('/:id/reject', (req, res) => handle(req, res, async ({ tx }) => {
  if (tx.status !== 'pending') return { error: 'Only pending requests can be rejected.' };
  return { status: 'rejected', message: 'Request rejected.' };
}));

/**
 * Restore an accepted deposit or withdraw. Reverses the balance effect: a
 * deposit is collected back (debit), a withdraw is refunded (credit).
 */
router.post('/:id/restore', (req, res) => handle(req, res, async ({ query, tx, loadUser }) => {
  if (!isDepositOrWithdraw(tx)) return { error: 'Only deposit or withdraw requests can be restored here.' };
  if (tx.status !== 'finished') return { error: 'Only accepted requests can be restored.' };

  const found = await loadUser();
  if (!found) return { error: 'User not found.' };
  const user = numericUser(found);

  // Reverse the balance effect: before = current balance, after = reversed balance.
  const before = user.Balance;
  if (tx.type === 'deposit') {
    user.Balance = money(user.Balance - tx.amount);
    user.DepositAmount = money(user.DepositAmount - tx.amount);
    if (user.DepositCount > 0) user.DepositCount -= 1;
  } else {
    // Refund the amount back to the user.
    user.Balance = money(user.Balance + tx.amount);
    user.WithdrawAmount = money(user.WithdrawAmount - tx.amount);
    if (user.WithdrawCount > 0) user.WithdrawCount -= 1;
  }
  await saveUser(query, user);

  return {
    status: 'restored', before, after: user.Balance, user,
    message: tx.type === 'withdraw' ? 'Withdraw restored.' : 'Deposit restored.',
  };
}));
