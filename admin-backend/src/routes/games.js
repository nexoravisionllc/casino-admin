import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { dbDate, num } from '../lib/format.js';
import { validationProblem } from '../lib/http.js';

export const router = express.Router();
router.use(requireAuth);

/** All games (optionally filtered by provider). */
router.get('/', async (req, res) => {
  const raw = req.query.providerId;
  let providerId = null;
  if (raw !== undefined && raw !== '') {
    if (typeof raw !== 'string' || !/^\s*[+-]?\d+\s*$/.test(raw) || Math.abs(Number(raw)) > 2147483647)
      return res.status(400).json(validationProblem('providerId', `The value '${raw}' is not valid.`));
    providerId = Number(raw);
  }

  // Look up the provider name by matching (provider_id, company) in Providers.
  const rows = await db.query(
    `SELECT g.uid, g.providerid, p.name AS provider_name, g.category, g.symbol, g.name, g.image_url,
            g.launch_enable, g.review, g.company, g.created_at
     FROM Games g
     LEFT JOIN Providers p ON p.provider_id = g.providerid AND p.company = g.company
     ${providerId === null ? '' : 'WHERE g.providerid = :providerId'}
     ORDER BY g.providerid, g.name`,
    { providerId });

  res.json(rows.map((g) => ({
    uid: num(g.uid),
    providerId: num(g.providerid),
    providerName: g.provider_name ?? null,
    category: g.category ?? null,
    symbol: g.symbol,
    name: g.name,
    imageUrl: g.image_url ?? null,
    launchEnable: Boolean(g.launch_enable),
    review: num(g.review),
    company: g.company,
    createdAt: dbDate(g.created_at),
  })));
});
