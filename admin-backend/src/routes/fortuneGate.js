import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { bodyOf } from '../lib/http.js';
import { fortuneGateClient } from '../gameapi/fortunegate/client.js';

export const router = express.Router();
router.use(requireAuth);

/** Change the FortuneGate agent win ratio (RTP) via /v4/agent/rtp. */
router.post('/rtp', async (req, res) => {
  const winRatio = bodyOf(req).num('winRatio');
  if (winRatio < 0 || winRatio > 100)
    return res.status(400).json({ message: 'Win ratio must be between 0 and 100.' });

  try {
    await fortuneGateClient.setRtp(winRatio);
    res.json({ message: 'RTP updated.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
