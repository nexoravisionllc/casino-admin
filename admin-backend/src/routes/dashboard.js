import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { TRANSACTION_COLUMNS, toTransactionRow } from '../lib/rows.js';
import { fortuneGateState } from '../gameapi/fortunegate/state.js';

export const router = express.Router();
router.use(requireAuth);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');

/**
 * The browser's time-zone offset in minutes (JS getTimezoneOffset: UTC - local),
 * so "today" and the chart buckets follow the admin's local calendar.
 */
function tzOffsetOf(req) {
  const v = Number(req.query.tz);
  return Number.isFinite(v) ? Math.max(-840, Math.min(840, Math.round(v))) : 0;
}

/** Header pill values, cheap enough to poll every few seconds. */
async function headerStats() {
  const [t] = await db.query(`
    SELECT
      (SELECT SUM(Balance) FROM Users)    AS userBalance,
      (SELECT SUM(Point)   FROM Users)    AS userPoints,
      (SELECT SUM(Balance) FROM Partners) AS partnerBalance,
      (SELECT SUM(Point)   FROM Partners) AS partnerPoints,
      (SELECT COUNT(*)     FROM Users)    AS totalUsers,
      (SELECT COUNT(*)     FROM Users WHERE Status <> 'Active') AS waitedUsers,
      (SELECT COUNT(*)     FROM Partners) AS totalAgents,
      (SELECT COUNT(*)     FROM Transactions WHERE type = 'deposit'  AND status = 'pending') AS pendingDeposits,
      (SELECT COUNT(*)     FROM Transactions WHERE type = 'withdraw' AND status = 'pending') AS pendingWithdraws`);

  return {
    // Live FortuneGate agent balance + win ratio, refreshed by the poller.
    fortuneGate: fortuneGateState.agentBalance,
    fortuneRtp: fortuneGateState.winRatio,
    userBalance: Number(t.userBalance ?? 0),
    userPoints: Number(t.userPoints ?? 0),
    // Partner pills show the combined balance/points across ALL agents.
    partnerBalance: Number(t.partnerBalance ?? 0),
    partnerPoints: Number(t.partnerPoints ?? 0),
    waitedUsers: Number(t.waitedUsers ?? 0),
    totalUsers: Number(t.totalUsers ?? 0),
    totalAgents: Number(t.totalAgents ?? 0),
    // Kept for older clients: this has always been the total user count.
    connectedUsers: Number(t.totalUsers ?? 0),
    // Requests waiting for an admin decision.
    deposit: Number(t.pendingDeposits ?? 0),
    withdraw: Number(t.pendingWithdraws ?? 0),
  };
}

router.get('/header', async (req, res) => {
  res.json(await headerStats());
});

/**
 * Full dashboard: header values, today's money-flow cards (vs. yesterday),
 * last 7 days and last 12 months of bets/wins, and the newest pending requests.
 */
router.get('/', async (req, res) => {
  const tz = tzOffsetOf(req);

  // "Local" clock: a Date whose UTC fields read as the admin's local time.
  const local = new Date(Date.now() - tz * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const dayKey = (yy, mm, dd) => {
    const x = new Date(Date.UTC(yy, mm, dd));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  };

  // Earliest instant we need: the first day of the month 11 months ago (local),
  // converted back to UTC for the indexed comparison.
  const since = new Date(Date.UTC(y, m - 11, 1) + tz * 60000);

  const [games, money, pending, header] = await Promise.all([
    db.query(
      `SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL :tz MINUTE), '%Y-%m-%d') AS day, type, SUM(amount) AS total
       FROM GameHistory
       WHERE created_at >= :since AND type IN ('BET', 'WIN')
       GROUP BY day, type`,
      { tz, since }),
    db.query(
      `SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL :tz MINUTE), '%Y-%m-%d') AS day, type, SUM(amount) AS total
       FROM Transactions
       WHERE created_at >= :since AND status = 'finished' AND type IN ('payment', 'collect')
         AND (target_type IS NULL OR target_type = 'user')
       GROUP BY day, type`,
      { tz, since }),
    db.query(
      `SELECT ${TRANSACTION_COLUMNS} FROM Transactions
       WHERE status = 'pending' AND type IN ('deposit', 'withdraw')
       ORDER BY uid DESC LIMIT 6`),
    headerStats(),
  ]);

  // day -> { BET, WIN, payment, collect }
  const byDay = new Map();
  const add = (rows) => {
    for (const r of rows) {
      if (!byDay.has(r.day)) byDay.set(r.day, {});
      const bucket = byDay.get(r.day);
      bucket[r.type] = (bucket[r.type] ?? 0) + Number(r.total ?? 0);
    }
  };
  add(games);
  add(money);
  const on = (day, type) => byDay.get(day)?.[type] ?? 0;

  const today = dayKey(y, m, d);
  const yesterday = dayKey(y, m, d - 1);
  const change = (now, prev) => (prev === 0 ? (now === 0 ? 0 : null) : ((now - prev) / prev) * 100);
  const card = (key, title, type) => {
    const value = on(today, type);
    const previous = on(yesterday, type);
    return { key, title, value, previous, changePercent: change(value, previous) };
  };

  const cards = [
    card('agentToUser', 'Agent > User', 'payment'),
    card('userToAgent', 'User > Agent', 'collect'),
    card('userToProvider', 'User > Game Provider', 'BET'),
    card('providerToUser', 'Game Provider > User', 'WIN'),
  ];

  const weekly = [];
  for (let i = 6; i >= 0; i--) {
    const x = new Date(Date.UTC(y, m, d - i));
    const key = dayKey(y, m, d - i);
    weekly.push({
      date: key,
      label: `${WEEKDAYS[x.getUTCDay()]} ${x.getUTCDate()}`,
      bet: on(key, 'BET'),
      win: on(key, 'WIN'),
    });
  }

  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const x = new Date(Date.UTC(y, m - i, 1));
    const prefix = `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-`;
    let bet = 0;
    let win = 0;
    for (const [day, v] of byDay) {
      if (!day.startsWith(prefix)) continue;
      bet += v.BET ?? 0;
      win += v.WIN ?? 0;
    }
    monthly.push({ month: prefix.slice(0, 7), label: MONTHS[x.getUTCMonth()], bet, win });
  }

  res.json({ header, cards, weekly, monthly, pending: pending.map(toTransactionRow) });
});
