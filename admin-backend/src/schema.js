import mysql from 'mysql2/promise';
import { config } from './config.js';
import { connectionOptions, db } from './db.js';

/**
 * Creates the "Solution" database and its tables when missing. Every statement
 * is idempotent and non-destructive, so this runs on each startup.
 *
 * Column names and types mirror the original SQL Server schema (shared with
 * the user portal). utf8mb4_unicode_ci keeps comparisons case-insensitive like
 * SQL Server's default collation, e.g. for LoginId lookups.
 */

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

export const TABLES = {
  Partners: `
    CREATE TABLE IF NOT EXISTS Partners (
      Uid         BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
      Name        VARCHAR(64)   NOT NULL,
      LoginId     VARCHAR(64)   NOT NULL,
      Password    VARCHAR(256)  NOT NULL,
      PartnerId   BIGINT        NULL,
      Email       VARCHAR(128)  NULL,
      BankName    VARCHAR(64)   NULL,
      BankAccount VARCHAR(64)   NULL,
      BankMaster  VARCHAR(64)   NULL,
      ReferralId  VARCHAR(64)   NULL,
      Balance     DECIMAL(18,2) NOT NULL DEFAULT 0,
      Point       DECIMAL(18,2) NOT NULL DEFAULT 0,
      Role        INT           NOT NULL,
      CasinoRate  DECIMAL(6,3)  NOT NULL DEFAULT 0,
      SlotRate    DECIMAL(6,3)  NOT NULL DEFAULT 0,
      SportsRate  DECIMAL(6,3)  NOT NULL DEFAULT 0,
      Status      VARCHAR(32)   NOT NULL DEFAULT 'Active',
      CreatedAt   DATETIME(6)   NOT NULL,
      UpdatedAt   DATETIME(6)   NOT NULL,
      UNIQUE KEY UX_Partners_LoginId (LoginId),
      KEY IX_Partners_PartnerId (PartnerId)
    ) ${TABLE_OPTIONS}`,

  Users: `
    CREATE TABLE IF NOT EXISTS Users (
      Uid            BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
      Name           VARCHAR(64)   NOT NULL,
      LoginId        VARCHAR(64)   NOT NULL,
      Password       VARCHAR(256)  NOT NULL,
      PartnerId      BIGINT        NULL,
      Email          VARCHAR(128)  NULL,
      BankName       VARCHAR(64)   NULL,
      BankAccount    VARCHAR(64)   NULL,
      BankMaster     VARCHAR(64)   NULL,
      Balance        DECIMAL(18,2) NOT NULL DEFAULT 0,
      Point          DECIMAL(18,2) NOT NULL DEFAULT 0,
      DepositAmount  DECIMAL(18,2) NOT NULL DEFAULT 0,
      DepositCount   DECIMAL(18,2) NOT NULL DEFAULT 0,
      WithdrawAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
      WithdrawCount  DECIMAL(18,2) NOT NULL DEFAULT 0,
      Status         VARCHAR(32)   NOT NULL DEFAULT 'Active',
      CreatedAt      DATETIME(6)   NOT NULL,
      UpdatedAt      DATETIME(6)   NOT NULL,
      UNIQUE KEY UX_Users_LoginId (LoginId),
      KEY IX_Users_PartnerId (PartnerId)
    ) ${TABLE_OPTIONS}`,

  Transactions: `
    CREATE TABLE IF NOT EXISTS Transactions (
      uid          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type         VARCHAR(32)   NOT NULL,
      amount       DECIMAL(18,2) NOT NULL,
      beforeamount DECIMAL(18,2) NOT NULL,
      afteramount  DECIMAL(18,2) NULL,
      status       VARCHAR(32)   NOT NULL,
      userid       VARCHAR(64)   NOT NULL,
      managerid    VARCHAR(64)   NULL,
      memo         VARCHAR(512)  NULL,
      target_type  VARCHAR(16)   NULL,
      created_at   DATETIME(6)   NOT NULL,
      updated_at   DATETIME(6)   NULL,
      KEY IX_Transactions_userid (userid),
      KEY IX_Transactions_type (type)
    ) ${TABLE_OPTIONS}`,

  PointHistory: `
    CREATE TABLE IF NOT EXISTS PointHistory (
      uid          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type         VARCHAR(32)   NOT NULL,
      amount       DECIMAL(18,2) NOT NULL,
      beforeamount DECIMAL(18,2) NOT NULL,
      afteramount  DECIMAL(18,2) NOT NULL,
      userid       VARCHAR(64)   NOT NULL,
      memo         VARCHAR(512)  NULL,
      target_type  VARCHAR(16)   NULL,
      created_at   DATETIME(6)   NOT NULL,
      KEY IX_PointHistory_userid (userid)
    ) ${TABLE_OPTIONS}`,

  GameHistory: `
    CREATE TABLE IF NOT EXISTS GameHistory (
      uid           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
      trans_id      VARCHAR(128)  NOT NULL,
      round_id      VARCHAR(128)  NOT NULL,
      user_id       VARCHAR(64)   NOT NULL,
      game_code     VARCHAR(128)  NOT NULL,
      game_name     VARCHAR(256)  NULL,
      game_type     VARCHAR(64)   NULL,
      provider_name VARCHAR(128)  NULL,
      amount        DECIMAL(18,2) NOT NULL,
      type          VARCHAR(16)   NOT NULL,
      beforeamount  DECIMAL(18,2) NOT NULL,
      afteramount   DECIMAL(18,2) NOT NULL,
      company       VARCHAR(64)   NOT NULL,
      created_at    DATETIME(6)   NOT NULL,
      KEY IX_GameHistory_trans_id (trans_id),
      KEY IX_GameHistory_user_id (user_id)
    ) ${TABLE_OPTIONS}`,

  Providers: `
    CREATE TABLE IF NOT EXISTS Providers (
      uid         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
      provider_id INT          NOT NULL,
      name        VARCHAR(128) NOT NULL,
      company     VARCHAR(64)  NOT NULL,
      status      INT          NOT NULL,
      image_url   VARCHAR(512) NULL,
      created_at  DATETIME(6)  NOT NULL,
      UNIQUE KEY UX_Providers_company_provider (company, provider_id)
    ) ${TABLE_OPTIONS}`,

  Games: `
    CREATE TABLE IF NOT EXISTS Games (
      uid           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
      providerid    INT          NOT NULL,
      category      VARCHAR(64)  NULL,
      symbol        VARCHAR(128) NOT NULL,
      name          VARCHAR(256) NOT NULL,
      image_url     VARCHAR(512) NULL,
      launch_enable TINYINT(1)   NOT NULL,
      review        INT          NOT NULL DEFAULT 0,
      company       VARCHAR(64)  NOT NULL,
      created_at    DATETIME(6)  NOT NULL,
      UNIQUE KEY UX_Games_company_provider_symbol (company, providerid, symbol)
    ) ${TABLE_OPTIONS}`,

  GameSetting: `
    CREATE TABLE IF NOT EXISTS GameSetting (
      uid         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
      Name        VARCHAR(64) NOT NULL,
      Show_Enable TINYINT(1)  NOT NULL DEFAULT 1
    ) ${TABLE_OPTIONS}`,

  // Crypto deposits and payouts, written by the user backend (same DDL as
  // user-backend/src/schema.js). Read here to tell crypto withdrawals apart.
  CryptoPayments: `
    CREATE TABLE IF NOT EXISTS CryptoPayments (
      uid             BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id        VARCHAR(64)   NOT NULL,
      direction       VARCHAR(16)   NOT NULL,
      userid          VARCHAR(64)   NOT NULL,
      amount          DECIMAL(18,2) NOT NULL,
      currency        VARCHAR(16)   NOT NULL,
      provider        VARCHAR(32)   NOT NULL,
      provider_uuid   VARCHAR(64)   NULL,
      status          VARCHAR(32)   NOT NULL,
      payment_url     VARCHAR(512)  NULL,
      payer_amount    VARCHAR(64)   NULL,
      payer_currency  VARCHAR(16)   NULL,
      network         VARCHAR(32)   NULL,
      txid            TEXT          NULL,
      address         VARCHAR(128)  NULL,
      transaction_uid BIGINT        NULL,
      expires_at      DATETIME(6)   NULL,
      created_at      DATETIME(6)   NOT NULL,
      updated_at      DATETIME(6)   NOT NULL,
      UNIQUE KEY UX_CryptoPayments_order_id (order_id),
      KEY IX_CryptoPayments_userid (userid),
      KEY IX_CryptoPayments_transaction_uid (transaction_uid)
    ) ${TABLE_OPTIONS}`,
};

// Deposit/withdraw totals added to a Users table created without them.
const USER_EXTRA_COLUMNS = ['DepositAmount', 'DepositCount', 'WithdrawAmount', 'WithdrawCount'];

const databaseName = () =>
  config.db.url ? decodeURIComponent(new URL(config.db.url).pathname.slice(1)) : config.db.database;

async function ensureDatabase() {
  const name = databaseName();
  if (!name) return;
  const conn = await mysql.createConnection(connectionOptions({ database: undefined, uri: undefined, ...serverOnly() }));
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name.replaceAll('`', '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await conn.end();
  }
}

// Connection settings without a default database (it may not exist yet).
function serverOnly() {
  if (!config.db.url) return {};
  const u = new URL(config.db.url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

export async function ensureSchema() {
  await ensureDatabase();

  for (const ddl of Object.values(TABLES)) await db.query(ddl);

  const present = new Set((await db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users'`)).map((c) => c.name.toLowerCase()));
  for (const column of USER_EXTRA_COLUMNS) {
    if (!present.has(column.toLowerCase()))
      await db.query(`ALTER TABLE Users ADD COLUMN ${column} DECIMAL(18,2) NOT NULL DEFAULT 0`);
  }

  // txid held one hash (VARCHAR(128)); a deposit made of several transfers lists
  // them all, comma-separated, so widen it on databases created before that.
  const [txid] = await db.query(
    `SELECT DATA_TYPE AS type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CryptoPayments' AND COLUMN_NAME = 'txid'`);
  if (txid && txid.type.toLowerCase() === 'varchar') await db.query('ALTER TABLE CryptoPayments MODIFY txid TEXT NULL');

  // Seed the game-visibility rows (default: all shown) if none exist.
  const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM GameSetting');
  if (Number(n) === 0) {
    await db.query("INSERT INTO GameSetting (Name, Show_Enable) VALUES ('Slots', 1), ('Live Casino', 1), ('Sports', 1)");
  }
}
