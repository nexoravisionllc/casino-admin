import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { dbDate, money, num } from '../lib/format.js';

export const router = express.Router();
router.use(requireAuth);

// Pulls the game trans_id out of a rolling-payment memo, e.g. "(trans_id 49, ...".
const TRANS_ID = /\(trans_id (\d+),/;

/**
 * All game-history rows, each with the total rolling paid to the user's
 * upline partners for that bet (rolling is linked by trans_id in the memo).
 */
router.get('/', async (req, res) => {
  const histories = await db.query(
    `SELECT uid, trans_id, round_id, user_id, game_code, game_name, provider_name, amount, type,
            beforeamount, afteramount, company, created_at
     FROM GameHistory ORDER BY uid DESC`);

  // Sum rolling payments per game trans_id (parsed from the memo).
  const rollingByTrans = new Map();
  const rollingRecords = await db.query(
    "SELECT amount, memo FROM Transactions WHERE type = 'rolling payment' AND memo IS NOT NULL");
  for (const r of rollingRecords) {
    const m = TRANS_ID.exec(r.memo);
    if (!m) continue;
    rollingByTrans.set(m[1], money((rollingByTrans.get(m[1]) ?? 0) + Number(r.amount)));
  }

  res.json(histories.map((g) => ({
    uid: num(g.uid),
    userId: g.user_id,
    providerName: g.provider_name ?? null,
    gameName: g.game_name ?? null,
    gameCode: g.game_code,
    type: g.type,
    amount: num(g.amount),
    rolling: g.type === 'BET' ? rollingByTrans.get(String(g.trans_id)) ?? 0 : 0,
    roundId: g.round_id,
    beforeAmount: num(g.beforeamount),
    afterAmount: num(g.afteramount),
    company: g.company,
    createdAt: dbDate(g.created_at),
  })));
});
