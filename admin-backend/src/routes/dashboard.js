import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { fortuneGateState } from '../gameapi/fortunegate/state.js';

export const router = express.Router();
router.use(requireAuth);

/** Header pill values plus the dashboard cards and chart series. */
router.get('/', async (req, res) => {
  const [totals] = await db.query(`
    SELECT
      (SELECT SUM(Balance) FROM Users)    AS userBalance,
      (SELECT SUM(Point)   FROM Users)    AS userPoints,
      (SELECT SUM(Balance) FROM Partners) AS partnerBalance,
      (SELECT SUM(Point)   FROM Partners) AS partnerPoints,
      (SELECT COUNT(*)     FROM Users)    AS totalUsers,
      (SELECT COUNT(*)     FROM Users WHERE Status <> 'Active') AS waitedUsers`);

  // Deposit / withdraw request queues and live connections are not tracked
  // in this schema yet, so they are reported as zero for now.
  const header = {
    // Live FortuneGate agent balance + win ratio, refreshed by the poller.
    fortuneGate: fortuneGateState.agentBalance,
    fortuneRtp: fortuneGateState.winRatio,
    userBalance: Number(totals.userBalance ?? 0),
    userPoints: Number(totals.userPoints ?? 0),
    // Partner pills show the combined balance/points across ALL agents.
    partnerBalance: Number(totals.partnerBalance ?? 0),
    partnerPoints: Number(totals.partnerPoints ?? 0),
    waitedUsers: Number(totals.waitedUsers),
    connectedUsers: Number(totals.totalUsers),
    deposit: 0,
    withdraw: 0,
  };

  const cards = [
    { title: 'Agent > User', value: 50000, changePercent: 0 },
    { title: 'User > Agent', value: 0, changePercent: 0 },
    { title: 'User > Game Provider', value: 50000, changePercent: 0 },
    { title: 'Game Provider > User', value: 5000, changePercent: 0 },
  ];

  const weeklyData = [2300, 2100, 2000, 3800, 6100, 3200, 1500];
  const monthlyData = [1200, 2600, 3100, 4200, 6000, 5200, 3800, 2700, 3300, 4800, 5600, 6100];

  res.json({ header, cards, weeklyData, monthlyData });
});
