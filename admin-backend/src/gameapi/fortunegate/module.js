import { db } from '../../db.js';
import { log } from '../../lib/log.js';
import { fortuneGateClient } from './client.js';

/**
 * FortuneGate game company integration: syncs its providers and games into the
 * Providers / Games tables. Field mapping (response -> DB):
 *   provider_id -> provider_id, provider_name -> name, status -> status,
 *   company -> "FortuneGate", image_url -> null, created_at -> insert time.
 * Each game company module exposes { company, syncProviders, syncGames }.
 */

const COMPANY = 'FortuneGate';

// Live-casino providers (Evolution, Pragmatic Play Live). They have no game
// rows because the player site opens their lobby directly, so they are kept
// even when empty. Mirrors LIVE_PROVIDERS in user-frontend/src/data/liveProviders.js.
const LIVE_PROVIDER_IDS = [6, 8];

async function syncProviders() {
  const providers = await fortuneGateClient.getProviders();

  const rows = await db.query(
    'SELECT uid, provider_id, name, status FROM Providers WHERE company = :company',
    { company: COMPANY });
  const existing = new Map(rows.map((r) => [Number(r.provider_id), r]));

  const now = new Date();
  let inserted = 0, updated = 0;

  await db.transaction(async (tx) => {
    for (const p of providers) {
      const providerId = Number(p.provider_id);
      const name = String(p.provider_name ?? '');
      const status = Number(p.status ?? 0);
      const row = existing.get(providerId);

      if (row) {
        // Keep created_at; refresh the mutable fields.
        if (row.name !== name || Number(row.status) !== status) {
          await tx.query('UPDATE Providers SET name = :name, status = :status WHERE uid = :uid',
            { name, status, uid: row.uid });
          row.name = name;
          row.status = status;
        }
        updated++;
      } else {
        await tx.query(
          `INSERT INTO Providers (provider_id, name, company, status, image_url, created_at)
           VALUES (:providerId, :name, :company, :status, NULL, :now)`,
          { providerId, name, company: COMPANY, status, now });
        existing.set(providerId, { name, status });
        inserted++;
      }
    }
  });

  log.info(`FortuneGate providers synced: ${inserted} inserted, ${updated} updated.`);
}

async function syncGames() {
  // Loop the provider_id values stored in the Providers table for this company.
  const providerIds = (await db.query('SELECT provider_id FROM Providers WHERE company = :company', { company: COMPANY }))
    .map((r) => Number(r.provider_id));

  const now = new Date();
  let inserted = 0, updated = 0;

  for (const providerId of providerIds) {
    const games = await fortuneGateClient.getGames(providerId);

    const rows = await db.query(
      `SELECT uid, symbol, name, category, image_url, launch_enable
       FROM Games WHERE company = :company AND providerid = :providerId`,
      { company: COMPANY, providerId });
    const existing = new Map(rows.map((r) => [r.symbol, r]));

    await db.transaction(async (tx) => {
      for (const g of games) {
        const symbol = String(g.game_code ?? '');
        const name = String(g.game_name ?? '');
        const category = g.category == null ? null : String(g.category);
        const imageUrl = g.game_image ?? null;
        const launchEnable = Boolean(g.launch_enable);
        const row = existing.get(symbol);

        if (row) {
          if (row.name !== name || row.category !== category || row.image_url !== imageUrl || Boolean(row.launch_enable) !== launchEnable) {
            await tx.query(
              `UPDATE Games SET name = :name, category = :category, image_url = :imageUrl, launch_enable = :launchEnable
               WHERE uid = :uid`,
              { name, category, imageUrl, launchEnable, uid: row.uid });
            Object.assign(row, { name, category, image_url: imageUrl, launch_enable: launchEnable });
          }
          updated++;
        } else {
          await tx.query(
            `INSERT INTO Games (providerid, category, symbol, name, image_url, launch_enable, review, company, created_at)
             VALUES (:providerId, :category, :symbol, :name, :imageUrl, :launchEnable, 0, :company, :now)`,
            {
              providerId: Number(g.provider_id ?? providerId), category, symbol, name, imageUrl,
              launchEnable, company: COMPANY, now,
            });
          existing.set(symbol, { name, category, image_url: imageUrl, launch_enable: launchEnable });
          inserted++;
        }
      }
    });

    log.info(`FortuneGate games synced for provider ${providerId}: ${games.length} games.`);
  }

  log.info(`FortuneGate games sync complete: ${inserted} inserted, ${updated} updated.`);
  await pruneEmptyProviders();
}

/**
 * Remove providers that have no games (except the live-casino ones), so the
 * player site and admin panel only list providers that can actually be played.
 * Runs after every game sync because syncProviders re-adds them.
 */
async function pruneEmptyProviders() {
  const { affectedRows } = await db.query(
    `DELETE FROM Providers
     WHERE company = :company AND provider_id NOT IN (:keep)
       AND NOT EXISTS (SELECT 1 FROM Games g WHERE g.company = Providers.company AND g.providerid = Providers.provider_id)`,
    { company: COMPANY, keep: LIVE_PROVIDER_IDS });
  if (affectedRows) log.info(`FortuneGate: removed ${affectedRows} providers with no games.`);
}

export const fortuneGateModule = { company: COMPANY, syncProviders, syncGames };
