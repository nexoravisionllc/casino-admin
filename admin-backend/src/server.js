import fs from 'node:fs';
import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import { fortuneGateModule } from './gameapi/fortunegate/module.js';
import { startFortuneGatePolling } from './gameapi/fortunegate/state.js';
import { log } from './lib/log.js';
import { WALLET_HUB_PATH, walletHub } from './realtime/wallet.js';
import { PROVIDER_UPLOAD_DIR } from './routes/providers.js';
import { ensureSchema } from './schema.js';

// Each game company module syncs its providers and games at startup.
const gameCompanies = [fortuneGateModule];

// Providers rarely change, so this is a one-time population at startup;
// failures are logged and never stop the server.
async function startupSync() {
  try {
    await ensureSchema();
  } catch (err) {
    log.warn('Provider startup sync skipped.', err);
    return;
  }
  for (const company of gameCompanies) {
    // Providers first, then games (games loop the synced provider ids).
    try { await company.syncProviders(); } catch (err) { log.warn(`Provider sync failed for ${company.company}.`, err); }
    try { await company.syncGames(); } catch (err) { log.warn(`Game sync failed for ${company.company}.`, err); }
  }
}

fs.mkdirSync(PROVIDER_UPLOAD_DIR, { recursive: true });

const app = createApp();

// Like Kestrel, "localhost" listens on both the IPv4 and IPv6 loopback.
const hosts = config.host === 'localhost' ? ['127.0.0.1', '::1'] : [config.host];

const servers = hosts.map((host) => {
  const server = http.createServer(app);
  walletHub.attachWebSockets(server, WALLET_HUB_PATH);
  server.on('error', (err) => {
    // IPv6 may be disabled; the IPv4 loopback is enough then.
    if (host === '::1' && err.code === 'EADDRNOTAVAIL') return;
    log.error(`Cannot listen on ${host}:${config.port}.`, err);
    process.exit(1);
  });
  return server;
});

let listening = 0;
for (const [i, server] of servers.entries()) {
  server.listen(config.port, hosts[i], () => {
    if (++listening > 1) return;
    log.info(`Admin backend listening on http://${config.host}:${config.port}`);
    startupSync();
  });
}

// Live agent balance, refreshed every few seconds.
const stopPolling = startFortuneGatePolling();

const shutdown = () => {
  log.info('Shutting down.');
  stopPolling();
  for (const server of servers) {
    server.close();
    server.closeAllConnections?.();
  }
  db.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
