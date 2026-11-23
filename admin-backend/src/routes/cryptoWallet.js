import express from 'express';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { log } from '../lib/log.js';

/**
 * Read-only view of the crypto gateway's own wallets (hot wallet and
 * treasury). The keys and RPCs live in the user backend, so this forwards to
 * its secret-protected internal endpoint. Top admin (Role 1) only.
 */
export const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  if (String(req.user?.role) !== '1') return res.status(403).json({ message: 'Only the top admin can view the wallet.' });
  try {
    const upstream = await fetch(`${config.userBackend.baseUrl}/api/payments/internal/crypto/wallet`, {
      headers: { 'X-Notify-Secret': config.notifySecret },
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      // 401 here means NOTIFY_SECRET differs between the two backends.
      log.warn(`Crypto wallet status was rejected by the user backend: HTTP ${upstream.status}.`);
      return res.status(502).json({ message: `The user backend refused the wallet request (HTTP ${upstream.status}). Check NOTIFY_SECRET in both .env files.` });
    }
    res.type('application/json').send(await upstream.text());
  } catch (err) {
    log.warn('Crypto wallet status request failed.', err);
    res.status(502).json({ message: 'The user backend could not be reached to read the wallet.' });
  }
});
