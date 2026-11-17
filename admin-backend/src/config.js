import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load admin-backend/.env when present. Variables already set in the real
// environment take precedence over the file.
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // No .env file; rely on the environment and the defaults below.
}

const env = process.env;

const int = (v, fallback) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (v, fallback) =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

// Express "trust proxy": true/false, a hop count, or a subnet list.
const trustProxy = (v) => {
  if (v == null || v === '' || v === 'false') return false;
  if (v === 'true') return true;
  return /^\d+$/.test(v) ? Number(v) : v;
};

export const config = {
  root,
  host: env.HOST || 'localhost',
  port: int(env.PORT, 5100),
  trustProxy: trustProxy(env.TRUST_PROXY),
  // Base for uploaded image URLs; defaults to the request's scheme://host.
  publicBaseUrl: (env.PUBLIC_BASE_URL || '').replace(/\/+$/, '') || null,
  wwwroot: path.resolve(root, env.WWWROOT || 'wwwroot'),

  // Shared "Solution" MySQL database. DATABASE_URL (mysql://user:pass@host:port/db)
  // takes precedence over the individual DB_* settings.
  db: {
    url: env.DATABASE_URL || null,
    host: env.DB_HOST || 'localhost',
    port: int(env.DB_PORT, 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME || 'Solution',
    connectionLimit: int(env.DB_CONNECTION_LIMIT, 10),
  },

  jwt: {
    key: env.JWT_KEY || 'admin-dev-only-super-secret-key-change-me-please-1234567890',
    issuer: env.JWT_ISSUER || 'AdminBackend',
    audience: env.JWT_AUDIENCE || 'AdminFrontend',
    expiresHours: int(env.JWT_EXPIRES_HOURS, 12),
  },

  // Includes the admin front and the user front page (which connects to the
  // wallet hub hosted here).
  corsOrigins: list(env.CORS_ORIGINS, [
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5173', 'http://127.0.0.1:5173',
  ]),

  // Shared secret for the server-to-server wallet notify hook.
  notifySecret: env.NOTIFY_SECRET ?? '',

  fortuneGate: {
    baseUrl: env.FORTUNEGATE_BASE_URL || 'https://agentapi.fortunegate.net',
    token: env.FORTUNEGATE_TOKEN || '',
    lang: int(env.FORTUNEGATE_LANG, 1),
    providersPath: env.FORTUNEGATE_PROVIDERS_PATH || '/v4/game/providers',
    gamesPath: env.FORTUNEGATE_GAMES_PATH || '/v4/game/games',
    agentInfoPath: env.FORTUNEGATE_AGENT_INFO_PATH || '/v4/agent/info',
    agentRtpPath: env.FORTUNEGATE_AGENT_RTP_PATH || '/v4/agent/rtp',
    agentInfoIntervalSeconds: int(env.FORTUNEGATE_AGENT_INFO_INTERVAL_SECONDS, 5),
  },
};
