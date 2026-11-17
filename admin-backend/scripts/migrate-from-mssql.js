/**
 * One-time copy of the shared "Solution" database from SQL Server to MySQL.
 *
 *   npm run migrate:mssql                # copy tables that are empty in MySQL
 *   npm run migrate:mssql -- --force     # empty the MySQL tables first, then copy
 *
 * Source: MSSQL_CONNECTION_STRING (ADO.NET format, default the old backend's
 * Windows-auth string). Target: the DB_* / DATABASE_URL settings in .env.
 * Primary keys are preserved, so AUTO_INCREMENT continues after the highest id.
 * Only columns that exist on both sides are copied; extra source columns are
 * reported.
 *
 * Needs the dev dependency "mssql" (and "msnodesqlv8" for Windows auth).
 */
import { execFileSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { connectionOptions, db } from '../src/db.js';
import { TABLES, ensureSchema } from '../src/schema.js';

const SOURCE = process.env.MSSQL_CONNECTION_STRING ||
  'Server=localhost;Database=Solution;Trusted_Connection=True;TrustServerCertificate=True;';
const FORCE = process.argv.includes('--force');
const BATCH = 1000;

// ---- SQL Server connection (ADO.NET connection string) ----

function parseConnectionString(cs) {
  const parts = {};
  for (const segment of cs.split(';')) {
    const i = segment.indexOf('=');
    if (i <= 0) continue;
    let value = segment.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(value) || /^\{.*\}$/.test(value)) value = value.slice(1, -1);
    parts[segment.slice(0, i).trim().toLowerCase()] = value;
  }
  return parts;
}

const truthy = (v) => ['true', 'yes', 'sspi'].includes(String(v ?? '').toLowerCase());

function odbcDriver() {
  if (process.env.DB_ODBC_DRIVER) return process.env.DB_ODBC_DRIVER;
  if (process.platform !== 'win32') return 'ODBC Driver 18 for SQL Server';
  const preferred = ['ODBC Driver 18 for SQL Server', 'ODBC Driver 17 for SQL Server', 'SQL Server Native Client 11.0', 'SQL Server'];
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Drivers'], { encoding: 'utf8' });
    const installed = new Set(out.split(/\r?\n/).map((l) => l.split(/\s{2,}REG_SZ/)[0].trim()));
    return preferred.find((d) => installed.has(d)) ?? 'SQL Server';
  } catch {
    return 'SQL Server';
  }
}

async function connectSource() {
  const parts = parseConnectionString(SOURCE);
  if (!truthy(parts.trusted_connection ?? parts['integrated security'])) {
    const sql = (await import('mssql')).default;
    return new sql.ConnectionPool(SOURCE).connect();
  }
  // Windows authentication goes through ODBC.
  const native = (await import('mssql/msnodesqlv8.js')).default;
  const driver = odbcDriver();
  const odbc = [`Driver={${driver}}`, `Server=${parts.server ?? parts['data source'] ?? 'localhost'}`, 'Trusted_Connection=yes'];
  const database = parts.database ?? parts['initial catalog'];
  if (database) odbc.push(`Database=${database}`);
  if (driver !== 'SQL Server' && parts.trustservercertificate != null)
    odbc.push(`TrustServerCertificate=${truthy(parts.trustservercertificate) ? 'yes' : 'no'}`);
  return new native.ConnectionPool({ connectionString: odbc.join(';') + ';', options: { useUTC: true } }).connect();
}

// ---- copy ----

const sourceColumns = async (source, table) =>
  (await source.request().input('table', table).query(
    'SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table ORDER BY ORDINAL_POSITION'))
    .recordset.map((r) => r.name);

const targetColumns = async (table) =>
  (await db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table ORDER BY ORDINAL_POSITION`, { table })).map((r) => r.name);

// SQL Server values -> MySQL-insertable values.
const convert = (v) => {
  if (typeof v === 'boolean') return v ? 1 : 0;
  // DATETIME2 from legacy ODBC drivers arrives as text with 7 fractional digits.
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{7}$/.test(v)) return v.slice(0, -1);
  return v;
};

async function copyTable(source, target, table) {
  const src = await sourceColumns(source, table);
  if (src.length === 0) return console.log(`- ${table}: not in SQL Server, skipped.`);

  const dst = new Map((await targetColumns(table)).map((c) => [c.toLowerCase(), c]));
  const columns = src.filter((c) => dst.has(c.toLowerCase()));
  const extra = src.filter((c) => !dst.has(c.toLowerCase()));
  if (extra.length) console.warn(`  ! ${table}: source columns not in MySQL, NOT copied: ${extra.join(', ')}`);

  const [[{ n }]] = await target.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  if (Number(n) > 0) {
    if (!FORCE) return console.log(`- ${table}: MySQL already has ${n} rows, skipped (use --force to replace).`);
    await target.query(`DELETE FROM \`${table}\``);
  }

  const key = columns.find((c) => c.toLowerCase() === 'uid') ?? columns[0];
  const select = columns.map((c) => `[${c}]`).join(', ');
  const insert = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${dst.get(c.toLowerCase())}\``).join(', ')}) VALUES ?`;

  let copied = 0;
  await target.beginTransaction();
  try {
    for (let offset = 0; ; offset += BATCH) {
      const { recordset } = await source.request().query(
        `SELECT ${select} FROM [${table}] ORDER BY [${key}] OFFSET ${offset} ROWS FETCH NEXT ${BATCH} ROWS ONLY`);
      if (recordset.length === 0) break;
      await target.query(insert, [recordset.map((row) => columns.map((c) => convert(row[c])))]);
      copied += recordset.length;
    }
    await target.commit();
  } catch (err) {
    await target.rollback();
    throw err;
  }
  console.log(`- ${table}: ${copied} rows copied.`);
}

async function main() {
  console.log('Creating the MySQL schema...');
  await ensureSchema();
  // The seeded GameSetting rows would otherwise block copying the real ones.
  if (!FORCE) {
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM GameSetting');
    const [{ seeded }] = await db.query(
      "SELECT COUNT(*) AS seeded FROM GameSetting WHERE Name IN ('Slots', 'Live Casino', 'Sports') AND Show_Enable = 1");
    if (Number(n) === 3 && Number(seeded) === 3) await db.query('DELETE FROM GameSetting');
  }

  console.log('Connecting to SQL Server...');
  const source = await connectSource();
  const target = await mysql.createConnection(connectionOptions());
  await target.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO')");

  try {
    for (const table of Object.keys(TABLES)) await copyTable(source, target, table);
  } finally {
    await target.end();
    await source.close();
    await db.close();
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
