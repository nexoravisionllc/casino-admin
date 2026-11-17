import express from 'express';
import { db } from '../db.js';
import { createToken } from '../lib/auth.js';
import { num } from '../lib/format.js';
import { bodyOf, isBlank } from '../lib/http.js';
import { verifyPassword } from '../lib/password.js';

export const router = express.Router();

/** Authenticate an admin or agent with login id and password. */
router.post('/login', async (req, res) => {
  const body = bodyOf(req);
  const loginId = body.str('loginId');
  const password = body.str('password');
  if (isBlank(loginId) || isBlank(password))
    return res.status(400).json({ message: 'ID and password are required.' });

  const [partner] = await db.query(
    `SELECT Uid, Name, LoginId, Password, Role, Balance, Point, CasinoRate, SlotRate, SportsRate, Status
     FROM Partners WHERE LoginId = :loginId LIMIT 1`,
    { loginId });
  if (!partner || !(await verifyPassword(password, partner.Password)))
    return res.status(401).json({ message: 'Invalid ID or password.' });

  if (String(partner.Status ?? '').toLowerCase() !== 'active')
    return res.status(401).json({ message: 'This account is not active.' });

  const profile = {
    uid: num(partner.Uid),
    name: partner.Name,
    loginId: partner.LoginId,
    role: num(partner.Role),
    balance: num(partner.Balance),
    point: num(partner.Point),
    casinoRate: num(partner.CasinoRate),
    slotRate: num(partner.SlotRate),
    sportsRate: num(partner.SportsRate),
  };
  res.json({ token: createToken(profile), partner: profile });
});
