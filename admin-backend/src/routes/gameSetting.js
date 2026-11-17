import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { num } from '../lib/format.js';
import { bodyOf, longParam } from '../lib/http.js';

export const router = express.Router();
router.use(requireAuth);
router.param('uid', longParam);

const toDto = (s) => ({ uid: num(s.uid), name: s.Name, showEnable: Boolean(s.Show_Enable) });

/** All game-visibility settings. */
router.get('/', async (req, res) => {
  const rows = await db.query('SELECT uid, Name, Show_Enable FROM GameSetting ORDER BY uid');
  res.json(rows.map(toDto));
});

/** Toggle a setting's Show_Enable flag. */
router.put('/:uid', async (req, res) => {
  const showEnable = bodyOf(req).bool('showEnable');
  const [row] = await db.query('SELECT uid, Name, Show_Enable FROM GameSetting WHERE uid = :uid', { uid: req.params.uid });
  if (!row) return res.status(404).json({ message: 'Setting not found.' });

  await db.query('UPDATE GameSetting SET Show_Enable = :showEnable WHERE uid = :uid', { showEnable, uid: req.params.uid });
  res.json(toDto({ ...row, Show_Enable: showEnable }));
});
