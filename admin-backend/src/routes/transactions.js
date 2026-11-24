import express from 'express';
import { db } from '../db.js';
import { currentManagerLogin, requireAuth } from '../lib/auth.js';
import { dbDate, money, num } from '../lib/format.js';
import { bodyOf, longParam } from '../lib/http.js';
import { explorerTxUrl } from '../lib/explorer.js';
import { log } from '../lib/log.js';
import { sendWithdrawalDecision } from '../lib/mail.js';
import { notifyPlayer } from '../lib/playerNotify.js';
import { TRANSACTION_COLUMNS, toTransactionRow } from '../lib/rows.js';
import { walletNotifier } from '../realtime/wallet.js';

export const router = express.Router();
router.use(requireAuth);
router.param('id', longParam);

const isDepositOrWithdraw = (tx) => tx.type === 'deposit' || tx.type === 'withdraw';

/** True when the withdraw request was made for a crypto payout. */
async function isCryptoWithdraw(query, tx) {
  if (tx.type !== 'withdraw') return false;
  const [row] = await query(
    "SELECT 1 FROM CryptoPayments WHERE transaction_uid = :uid AND direction = 'withdraw' LIMIT 1", { uid: tx.uid });
  return Boolean(row);
}

const MAX_REASON = 500;
const MAX_REFERENCE = 128;
// Printable text only (no control characters / newlines) for the payout reference.
const PRINTABLE = /^[^\p{C}]+$/u;

/**
 * Optional "how it was paid" reference an admin enters on accept, e.g. the
 * on-chain transaction hash or a bank transfer id. Returns { value } or { error }.
 */
function payoutReference(req) {
  const ref = (bodyOf(req).str('reference') ?? '').trim();
  if (!ref) return { value: null };
  if (ref.length > MAX_REFERENCE || !PRINTABLE.test(ref)) return { error: `The payment reference must be at most ${MAX_REFERENCE} characters on one line.` };
  return { value: ref };
}

/** The crypto payout row (coin / network / address) of a withdraw request, or null. */
async function cryptoPaymentOf(query, uid) {
  const [row] = await query(
    `SELECT uid, order_id, status, payer_currency, network, address, txid FROM CryptoPayments
     WHERE transaction_uid = :uid AND direction = 'withdraw' LIMIT 1`, { uid });
  return row ?? null;
}

/** Where the withdrawal is paid, for the member's email. */
const payoutTarget = (crypto, user) => (crypto
  ? { kind: 'crypto', coin: crypto.payer_currency, network: crypto.network, address: crypto.address }
  : user.BankName || user.BankAccount
    ? { kind: 'bank', bankName: user.BankName, bankAccount: user.BankAccount, bankMaster: user.BankMaster }
    : null);

/**
 * After a withdraw request was accepted or rejected: push the new status to
 * the member's open pages and email them. Never throws; returns a note for the
 * admin about the email.
 */
async function notifyWithdrawalDecision(tx, { accepted, reason, reference }) {
  try {
    walletNotifier.transactionChanged(tx.userid, { uid: tx.uid, type: tx.type, status: accepted ? 'finished' : 'rejected', rejectReason: reason ?? null });
    const isCryptoPayout = Boolean(await cryptoPaymentOf(db.query, tx.uid));
    notifyPlayer(tx.userid, accepted ? 'withdraw-accepted' : 'withdraw-rejected',
      { uid: tx.uid, amount: tx.amount, reason: reason ?? null, toWallet: isCryptoPayout });
    const [user] = await db.query(
      'SELECT Name, LoginId, Email, BankName, BankAccount, BankMaster FROM Users WHERE LoginId = :loginId LIMIT 1', { loginId: tx.userid });
    if (!user) return 'No email sent: the member no longer exists.';
    const crypto = await cryptoPaymentOf(db.query, tx.uid);
    const [row] = await db.query('SELECT created_at, updated_at FROM Transactions WHERE uid = :uid', { uid: tx.uid });
    const mail = await sendWithdrawalDecision({
      user,
      tx: { uid: tx.uid, amount: tx.amount, requestedAt: row?.created_at ?? null, processedAt: row?.updated_at ?? new Date() },
      accepted, reason, payoutRef: reference,
      payoutUrl: crypto && reference ? explorerTxUrl(crypto.network, reference) : null,
      target: payoutTarget(crypto, user),
    });
    return mail.sent ? `Email sent to ${user.Email}.` : `No email sent: ${mail.reason}.`;
  } catch (err) {
    log.warn(`Could not notify ${tx.userid} about withdrawal ${tx.uid}.`, err);
    return 'No email sent: an unexpected error occurred.';
  }
}

/** All transactions, newest first. */
router.get('/', async (req, res) => {
  const rows = await db.query(`SELECT ${TRANSACTION_COLUMNS} FROM Transactions ORDER BY uid DESC`);
  res.json(rows.map(toTransactionRow));
});

/** One request with its member and payout details, for the review dialog. */
router.get('/:id', async (req, res) => {
  const [row] = await db.query(`SELECT ${TRANSACTION_COLUMNS} FROM Transactions WHERE uid = :id`, { id: req.params.id });
  if (!row) return res.status(404).json({ success: false, message: 'Transaction not found.' });
  const [user] = await db.query(
    `SELECT Name, LoginId, Email, Status, Balance, Point, BankName, BankAccount, BankMaster,
            DepositAmount, DepositCount, WithdrawAmount, WithdrawCount, CreatedAt
     FROM Users WHERE LoginId = :loginId LIMIT 1`, { loginId: row.userid });
  const crypto = row.type === 'withdraw' ? await cryptoPaymentOf(db.query, row.uid) : null;
  res.json({
    transaction: toTransactionRow(row),
    member: user ? {
      name: user.Name, loginId: user.LoginId, email: user.Email ?? null, status: user.Status,
      balance: num(user.Balance), point: num(user.Point),
      bankName: user.BankName ?? null, bankAccount: user.BankAccount ?? null, bankMaster: user.BankMaster ?? null,
      depositAmount: num(user.DepositAmount), depositCount: num(user.DepositCount),
      withdrawAmount: num(user.WithdrawAmount), withdrawCount: num(user.WithdrawCount),
      createdAt: dbDate(user.CreatedAt),
    } : null,
    crypto: crypto ? {
      orderId: crypto.order_id, status: crypto.status, coin: crypto.payer_currency, network: crypto.network,
      address: crypto.address, txid: crypto.txid ?? null,
    } : null,
  });
});

/**
 * Runs a request action in a transaction with the transaction row (and the
 * user row, when needed) locked. `act` returns { message } on success or
 * { error } to reply { success: false } without changing anything.
 */
async function handle(req, res, act) {
  const outcome = await db.transaction(async ({ query }) => {
    const [tx] = await query(
      'SELECT uid, type, amount, beforeamount, status, userid, managerid, memo FROM Transactions WHERE uid = :id FOR UPDATE',
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
    if (result.memo !== undefined) {
      sets.push('memo = :memo');
      params.memo = result.memo;
    }
    if (result.rejectReason !== undefined) {
      sets.push('reject_reason = :rejectReason');
      params.rejectReason = result.rejectReason;
    }
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

  // Work that must follow the commit, such as emailing the member.
  const note = outcome.afterCommit ? await outcome.afterCommit() : null;
  res.json({ success: true, message: note ? `${outcome.message} ${note}` : outcome.message, status: outcome.status, email: note });
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
 * a withdraw debits it. Withdrawals are paid out manually by the admin (bank
 * transfer or crypto sent from their own wallet), so accepting one means "the
 * funds have been sent": it is finished at once, nothing is sent automatically.
 * Body (optional): { reference } — the payout tx hash / transfer id, kept on the
 * record and included in the member's email. Returns 200 with a success flag.
 */
router.post('/:id/accept', (req, res) => {
  const reference = payoutReference(req);
  if (reference.error) return res.json({ success: false, message: reference.error });
  return handle(req, res, async ({ query, tx, loadUser }) => {
    if (!isDepositOrWithdraw(tx)) return { error: 'Only deposit or withdraw requests can be accepted here.' };

    // A withdrawal left "processing" by the former automatic payout (e.g.
    // accepted by a backend still running old code): its balance was already
    // debited, so accepting only records the manual payout. Refused once the
    // old worker sent it on-chain, since that transfer settles by itself.
    if (tx.type === 'withdraw' && tx.status === 'processing') {
      const [payment] = await query(
        "SELECT uid, status FROM CryptoPayments WHERE transaction_uid = :uid AND direction = 'withdraw' FOR UPDATE", { uid: tx.uid });
      if (payment && !['requested', 'queued'].includes(payment.status))
        return { error: `This payout is already "${payment.status}" on-chain; it settles automatically.` };
      if (payment) {
        await query("UPDATE CryptoPayments SET status = 'paid', txid = :txid, updated_at = :now WHERE uid = :uid",
          { txid: reference.value, now: new Date(), uid: payment.uid });
      }
      const memo = [tx.memo, 'paid manually', reference.value && `tx ${reference.value}`].filter(Boolean).join(' · ').slice(0, 512);
      return {
        status: 'finished', memo, message: 'Withdraw accepted.',
        afterCommit: () => notifyWithdrawalDecision(tx, { accepted: true, reference: reference.value }),
      };
    }

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

    if (tx.type === 'deposit') {
      return {
        status: 'finished', before, after, user, message: 'Deposit accepted.',
        afterCommit: () => { notifyPlayer(tx.userid, 'deposit-accepted', { uid: tx.uid, amount: tx.amount }); return null; },
      };
    }

    // Crypto withdraw: record the manual payout so the on-chain worker never
    // picks it up, and keep the hash (when given) for explorer links.
    if (await isCryptoWithdraw(query, tx)) {
      await query(
        `UPDATE CryptoPayments SET status = 'paid', txid = :txid, updated_at = :now
         WHERE transaction_uid = :uid AND direction = 'withdraw'`,
        { txid: reference.value, now: new Date(), uid: tx.uid });
    }
    const memo = [tx.memo, 'paid manually', reference.value && `tx ${reference.value}`].filter(Boolean).join(' · ').slice(0, 512);
    return {
      status: 'finished', before, after, user, memo,
      message: 'Withdraw accepted.',
      afterCommit: () => notifyWithdrawalDecision(tx, { accepted: true, reference: reference.value }),
    };
  });
});

/**
 * Reject a pending deposit or withdraw (no balance change). Body: { reason }.
 * The reason is required for withdrawals; it is stored on the request, shown
 * to the member and emailed to them.
 */
router.post('/:id/reject', (req, res) => {
  const reason = (bodyOf(req).str('reason') ?? '').trim();
  if (reason.length > MAX_REASON) return res.json({ success: false, message: `The reason must be at most ${MAX_REASON} characters.` });
  return handle(req, res, async ({ query, tx }) => {
    if (tx.status !== 'pending') return { error: 'Only pending requests can be rejected.' };
    if (tx.type === 'withdraw' && !reason) return { error: 'Enter a reason for rejecting this withdrawal; it is sent to the member.' };
    await query(
      "UPDATE CryptoPayments SET status = 'rejected', updated_at = :now WHERE transaction_uid = :uid AND direction = 'withdraw'",
      { now: new Date(), uid: tx.uid });
    return {
      status: 'rejected', rejectReason: reason || null, message: 'Request rejected.',
      afterCommit: tx.type === 'withdraw'
        ? () => notifyWithdrawalDecision(tx, { accepted: false, reason })
        : () => { notifyPlayer(tx.userid, 'deposit-rejected', { uid: tx.uid, amount: tx.amount, reason: reason || null }); return null; },
    };
  });
});

/**
 * Restore an accepted deposit or withdraw. Reverses the balance effect: a
 * deposit is collected back (debit), a withdraw is refunded (credit).
 */
router.post('/:id/restore', (req, res) => handle(req, res, async ({ query, tx, loadUser }) => {
  if (!isDepositOrWithdraw(tx)) return { error: 'Only deposit or withdraw requests can be restored here.' };
  if (tx.status !== 'finished') return { error: 'Only accepted requests can be restored.' };
  // The coins have left the merchant wallet; a refund here would pay twice.
  if (await isCryptoWithdraw(query, tx)) return { error: 'Crypto withdrawals that were paid out cannot be restored.' };

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
    afterCommit: tx.type === 'deposit'
      ? () => { notifyPlayer(tx.userid, 'deposit-reversed', { uid: tx.uid, amount: tx.amount }); return null; }
      : undefined,
  };
}));
