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
  // Demo/showcase mode (DEV_MODE=true). See the DEV_MODE note in .env.example.
  devMode: env.DEV_MODE === 'true',

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

  // Shared secret for the server-to-server wallet notify hook. Also sent to the
  // user backend to trigger crypto payouts for accepted crypto withdrawals.
  notifySecret: env.NOTIFY_SECRET ?? '',

  userBackend: {
    baseUrl: (env.USER_BACKEND_URL || 'http://localhost:5090').replace(/\/+$/, ''),
  },

  // Block-explorer lookup for on-chain transactions shown in the admin tables.
  // Chain ids mirror the user backend's <CHAIN>_CHAIN_ID so testnet/mainnet
  // links match; set these in admin-backend/.env to the same values.
  onchainExplorers: {
    BSC: int(env.BSC_CHAIN_ID, 56),
    ETH: int(env.ETH_CHAIN_ID, 1),
  },

  // Outgoing email (withdrawal accepted / rejected notices). Email is skipped,
  // with a log line, while SMTP_HOST is blank.
  mail: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 587),
    // true / ssl for port 465 (implicit TLS); false / tls / starttls uses
    // STARTTLS when offered. Defaults by port.
    secure: env.SMTP_SECURE
      ? ['true', 'ssl'].includes(env.SMTP_SECURE.toLowerCase())
      : int(env.SMTP_PORT, 587) === 465,
    user: env.SMTP_USER || '',
    password: env.SMTP_PASSWORD ?? env.SMTP_PASS ?? '',
    // MAIL_FROM ("Name <address>"), or SMTP_FROM plus an optional SMTP_FROM_NAME.
    from: env.MAIL_FROM
      || (env.SMTP_FROM && env.SMTP_FROM_NAME ? `"${env.SMTP_FROM_NAME.replaceAll('"', '')}" <${env.SMTP_FROM}>` : env.SMTP_FROM)
      || env.SMTP_USER || '',
    siteName: env.SITE_NAME || 'Live Casino',
    // Optional link to the player site, included in the emails.
    siteUrl: (env.SITE_URL || '').replace(/\/+$/, ''),
    // Optional support address: the emails' Reply-To and shown in their footer.
    supportEmail: env.SUPPORT_EMAIL || '',
  },

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
