import express from 'express';
import { config } from '../config.js';
import { bodyOf, isBlank, problem } from '../lib/http.js';
import { walletNotifier } from '../realtime/wallet.js';

/**
 * Server-to-server hook so the user backend can push a wallet change through
 * the SignalR hub (which lives here) after a game callback changes a user's
 * balance. Secured with a shared secret, not a JWT.
 */
export const router = express.Router();

router.post('/notify', (req, res) => {
  if ((req.get('x-notify-secret') ?? '') !== config.notifySecret)
    return res.status(401).json(problem(401, 'Unauthorized'));

  const body = bodyOf(req);
  const loginId = body.str('loginId');
  if (isBlank(loginId)) return res.status(400).json(problem(400, 'Bad Request'));

  walletNotifier.walletChanged(loginId, body.num('balance'), body.num('point'));
  res.status(200).end();
});
