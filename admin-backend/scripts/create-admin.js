/**
 * Creates the top-level admin account (Role 1) in an empty database, so you
 * can log in before any data has been migrated.
 *
 *   npm run create-admin -- <loginId> <password> [name]
 */
import { db, isUniqueViolation } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { ensureSchema } from '../src/schema.js';

const [loginId, password, name = loginId] = process.argv.slice(2);

async function main() {
  if (!loginId || !password) {
    console.error('Usage: npm run create-admin -- <loginId> <password> [name]');
    process.exit(1);
  }

  await ensureSchema();
  const now = new Date();
  try {
    const { insertId } = await db.query(
      `INSERT INTO Partners (Name, LoginId, Password, PartnerId, Balance, Point, Role,
                             CasinoRate, SlotRate, SportsRate, Status, CreatedAt, UpdatedAt)
       VALUES (:name, :loginId, :password, NULL, 0, 0, 1, 0, 0, 0, 'Active', :now, :now)`,
      { name, loginId, password: await hashPassword(password), now });
    console.log(`Admin "${loginId}" created (Uid ${insertId}).`);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    console.error(`The login id "${loginId}" already exists.`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err.code);
  process.exit(1);
});
