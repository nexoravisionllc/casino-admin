import express from 'express';
import { db, isUniqueViolation } from '../db.js';
import { currentPartnerId, requireAuth } from '../lib/auth.js';
import { utcDate } from '../lib/format.js';
import { bodyOf, isBlank, longParam } from '../lib/http.js';
import { hashPassword } from '../lib/password.js';
import { PARTNER_COLUMNS, toAgentRow } from '../lib/rows.js';

export const router = express.Router();
router.use(requireAuth);
router.param('id', longParam);

const getAgent = async (id) =>
  (await db.query(`SELECT ${PARTNER_COLUMNS} FROM Partners WHERE Uid = :id`, { id }))[0];

const loginTaken = async (loginId) =>
  (await db.query('SELECT 1 AS taken FROM Partners WHERE LoginId = :loginId LIMIT 1', { loginId })).length > 0;

// The top admin (Role 1) has no meaningful rate cap; its children may hold any
// rate up to 100%. Otherwise a child's rate is capped by its parent's rate.
const cap = (parent, column) => (!parent || Number(parent.Role) === 1 ? 100 : Number(parent[column]));

const trimOrNull = (v) => (isBlank(v) ? null : v.trim());

/** All partners (agents) for the treeview and list views. */
router.get('/', async (req, res) => {
  const rows = await db.query(`SELECT ${PARTNER_COLUMNS} FROM Partners ORDER BY Role, Uid`);
  res.json(rows.map((r) => toAgentRow(r)));
});

/** Check whether an agent login id is available. */
router.get('/check-id', async (req, res) => {
  const loginId = typeof req.query.loginId === 'string' ? req.query.loginId : '';
  if (isBlank(loginId)) return res.json({ available: false });
  res.json({ available: !(await loginTaken(loginId)) });
});

/** Create a sub agent under the given parent. */
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
  const referralId = body.str('referralId');
  const casinoRate = body.num('casinoRate');
  const slotRate = body.num('slotRate');
  const sportsRate = body.num('sportsRate');

  if (isBlank(loginId) || isBlank(password) || isBlank(name))
    return res.status(400).json({ message: 'Name, ID and password are required.' });

  const parent = await getAgent(parentId);
  if (!parent) return res.status(400).json({ message: 'Parent agent not found.' });

  const taken = `The ID "${loginId}" is already taken.`;
  if (await loginTaken(loginId)) return res.status(409).json({ message: taken });

  // Rates cannot exceed the parent's rate (or 100% under the admin root).
  const caps = { casino: cap(parent, 'CasinoRate'), slot: cap(parent, 'SlotRate'), sport: cap(parent, 'SportsRate') };
  if (casinoRate < 0 || slotRate < 0 || sportsRate < 0)
    return res.status(400).json({ message: 'Rates cannot be negative.' });
  if (casinoRate > caps.casino) return res.status(400).json({ message: `Casino rate cannot exceed ${caps.casino}%.` });
  if (slotRate > caps.slot) return res.status(400).json({ message: `Slot rate cannot exceed ${caps.slot}%.` });
  if (sportsRate > caps.sport) return res.status(400).json({ message: `Sport rate cannot exceed ${caps.sport}%.` });

  const now = new Date();
  const sub = {
    Name: name,
    LoginId: loginId,
    PartnerId: Number(parent.Uid),
    ReferralId: trimOrNull(referralId),
    Role: Number(parent.Role) + 1,
    CasinoRate: casinoRate,
    SlotRate: slotRate,
    SportsRate: sportsRate,
    Balance: 0,
    Point: 0,
    Status: 'Active',
  };

  let inserted;
  try {
    inserted = await db.query(
      `INSERT INTO Partners (Name, LoginId, Password, PartnerId, Email, BankName, BankAccount, BankMaster, ReferralId,
                             Balance, Point, Role, CasinoRate, SlotRate, SportsRate, Status, CreatedAt, UpdatedAt)
       VALUES (:name, :loginId, :password, :partnerId, :email, :bankName, :bankAccount, :bankMaster, :referralId,
               0, 0, :role, :casinoRate, :slotRate, :sportsRate, 'Active', :now, :now)`,
      {
        name, loginId, password: await hashPassword(password), partnerId: sub.PartnerId,
        email, bankName, bankAccount, bankMaster, referralId: sub.ReferralId,
        role: sub.Role, casinoRate, slotRate, sportsRate, now,
      });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: taken });
    throw err;
  }

  res.json(toAgentRow({ ...sub, Uid: inserted.insertId }, utcDate(now)));
});

/** Update an agent's referral code (blank clears it). */
router.put('/:id/referral', async (req, res) => {
  const referralId = trimOrNull(bodyOf(req).str('referralId'));

  const agent = await getAgent(req.params.id);
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  await db.query('UPDATE Partners SET ReferralId = :referralId, UpdatedAt = :now WHERE Uid = :id',
    { referralId, now: new Date(), id: req.params.id });
  res.json(toAgentRow({ ...agent, ReferralId: referralId }));
});

/** Update an agent's three rates within its allowed bounds. */
router.put('/:id/rates', async (req, res) => {
  const body = bodyOf(req);
  const rates = { CasinoRate: body.num('casinoRate'), SlotRate: body.num('slotRate'), SportsRate: body.num('sportsRate') };

  const agent = await getAgent(req.params.id);
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  const parent = agent.PartnerId == null ? null : await getAgent(agent.PartnerId);
  const children = await db.query('SELECT CasinoRate, SlotRate, SportsRate FROM Partners WHERE PartnerId = :id',
    { id: req.params.id });
  const highestChild = (column) => (children.length === 0 ? 0 : Math.max(...children.map((c) => Number(c[column]))));

  // Each rate must sit between the highest child rate and the master (parent) rate.
  for (const [label, column] of [['Casino', 'CasinoRate'], ['Slot', 'SlotRate'], ['Sport', 'SportsRate']]) {
    const value = rates[column];
    const max = cap(parent, column);
    const min = highestChild(column);
    if (value > max) return res.status(400).json({ message: `${label} rate cannot be higher than the master's rate (${max}%).` });
    if (value < min) return res.status(400).json({ message: `${label} rate cannot be lower than a sub-agent's rate (${min}%).` });
  }

  await db.query(
    `UPDATE Partners SET CasinoRate = :casinoRate, SlotRate = :slotRate, SportsRate = :sportsRate, UpdatedAt = :now
     WHERE Uid = :id`,
    { casinoRate: rates.CasinoRate, slotRate: rates.SlotRate, sportsRate: rates.SportsRate, now: new Date(), id: req.params.id });
  res.json(toAgentRow({ ...agent, ...rates }));
});

/** Change an agent's password. */
router.post('/:id/password', async (req, res) => {
  const password = bodyOf(req).str('password');
  if (isBlank(password)) return res.status(400).json({ message: 'Password is required.' });

  const agent = await getAgent(req.params.id);
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  await db.query('UPDATE Partners SET Password = :password, UpdatedAt = :now WHERE Uid = :id',
    { password: await hashPassword(password), now: new Date(), id: req.params.id });
  res.json({ message: 'Password changed.' });
});

/** Delete an agent (never the current account, never one with sub agents). */
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (id === currentPartnerId(req))
    return res.status(400).json({ message: 'You cannot delete your own account.' });

  const agent = await getAgent(id);
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  const children = await db.query('SELECT 1 AS child FROM Partners WHERE PartnerId = :id LIMIT 1', { id });
  if (children.length) return res.status(400).json({ message: 'Remove the sub agents first.' });

  await db.query('DELETE FROM Partners WHERE Uid = :id', { id });
  res.json({ message: 'Agent deleted.' });
});
