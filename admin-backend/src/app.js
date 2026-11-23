import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { log } from './lib/log.js';
import { ValidationError, problem, validationProblem } from './lib/http.js';
import { WALLET_HUB_PATH, walletHub } from './realtime/wallet.js';
import { router as agents } from './routes/agents.js';
import { router as auth } from './routes/auth.js';
import { router as cryptoWallet } from './routes/cryptoWallet.js';
import { router as dashboard } from './routes/dashboard.js';
import { router as fortuneGate } from './routes/fortuneGate.js';
import { router as gameHistory } from './routes/gameHistory.js';
import { router as games } from './routes/games.js';
import { router as pointHistory } from './routes/pointHistory.js';
import { router as gameSetting } from './routes/gameSetting.js';
import { router as providers } from './routes/providers.js';
import { router as transactions } from './routes/transactions.js';
import { router as users } from './routes/users.js';
import { router as wallet } from './routes/wallet.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Serve uploaded provider images from wwwroot (e.g. /uploads/providers/xxx.png).
  app.use(express.static(config.wwwroot, { index: false }));

  // Credentials are required by the SignalR JS client.
  app.use(cors({ origin: config.corsOrigins, credentials: true }));

  // Real-time hub (negotiate + HTTP transports; WebSockets attach in server.js).
  app.use(walletHub.router(WALLET_HUB_PATH));

  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', auth);
  app.use('/api/agents', agents);
  app.use('/api/crypto-wallet', cryptoWallet);
  app.use('/api/dashboard', dashboard);
  app.use('/api/fortunegate', fortuneGate);
  app.use('/api/game-history', gameHistory);
  app.use('/api/games', games);
  app.use('/api/gamesetting', gameSetting);
  app.use('/api/point-history', pointHistory);
  app.use('/api/providers', providers);
  app.use('/api/transactions', transactions);
  app.use('/api/users', users);
  app.use('/api/wallet', wallet);

  app.use((req, res) => res.status(404).end());

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json(validationProblem(err.field, err.message));
    if (err.type === 'entity.parse.failed') return res.status(400).json(validationProblem('$', 'The request body is not valid JSON.'));
    if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') return res.status(413).end();
    if (err.name === 'MulterError') return res.status(400).json(problem(400, err.message));

    log.error(`${req.method} ${req.originalUrl} failed.`, err);
    if (!res.headersSent) res.status(500).end();
  });

  return app;
}
