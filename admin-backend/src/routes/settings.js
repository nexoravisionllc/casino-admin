import express from 'express';
import { db } from '../db.js';
import { currentManagerLogin, requireAuth } from '../lib/auth.js';
import { bodyOf } from '../lib/http.js';

/**
 * Site-wide options (table AppSettings, shared with the user backend).
 *   autoApproveSignups: new player sign-ups are created Active instead of
 *   Pending, so they can sign in without waiting for approval.
 * Anyone signed in can read them; only the top admin (role 1) can change them.
 */
export const router = express.Router();
router.use(requireAuth);

const DEFAULTS = { autoApproveSignups: false };

async function readSettings() {
  const rows = await db.query('SELECT name, value, updated_at, updated_by FROM AppSettings WHERE name IN (:names)',
    { names: Object.keys(DEFAULTS) });
  const byName = new Map(rows.map((r) => [r.name, r]));
  const auto = byName.get('autoApproveSignups');
  return {
    autoApproveSignups: auto ? auto.value === 'true' : DEFAULTS.autoApproveSignups,
    autoApproveSignupsUpdatedBy: auto?.updated_by ?? null,
  };
}

router.get('/', async (req, res) => {
  res.json(await readSettings());
});

/** Body: { autoApproveSignups: boolean }. */
router.put('/', async (req, res) => {
  if (String(req.user?.role) !== '1') return res.status(403).json({ message: 'Only the top admin can change these settings.' });
  const body = bodyOf(req);
  const value = body.bool('autoApproveSignups');
  await db.query(
    `INSERT INTO AppSettings (name, value, updated_at, updated_by) VALUES ('autoApproveSignups', :value, :now, :by)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)`,
    { value: String(value), now: new Date(), by: await currentManagerLogin(req) });
  res.json(await readSettings());
});
