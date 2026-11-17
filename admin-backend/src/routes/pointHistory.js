import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { dbDate, num } from '../lib/format.js';

export const router = express.Router();
router.use(requireAuth);

/** Every point movement (payments, collects, conversions), newest first. */
router.get('/', async (req, res) => {
  const rows = await db.query(
    `SELECT uid, type, amount, beforeamount, afteramount, userid, memo, target_type, created_at
     FROM PointHistory ORDER BY uid DESC`);
  res.json(rows.map((r) => ({
    uid: num(r.uid),
    type: r.type,
    amount: num(r.amount),
    beforeAmount: num(r.beforeamount),
    afterAmount: num(r.afteramount),
    userId: r.userid,
    memo: r.memo ?? null,
    targetType: r.target_type ?? null,
    createdAt: dbDate(r.created_at),
  })));
});
