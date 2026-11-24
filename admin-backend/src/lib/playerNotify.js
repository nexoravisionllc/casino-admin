import { config } from '../config.js';
import { log } from './log.js';

/**
 * Ask the user backend to notify a player (stored for the bell on the player
 * site and sent as a browser push). Events and their wording live there, in
 * user-backend/src/services/notify.js. Never throws.
 */
export async function notifyPlayer(loginId, event, details = {}) {
  try {
    const res = await fetch(`${config.userBackend.baseUrl}/api/notifications/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Notify-Secret': config.notifySecret },
      body: JSON.stringify({ loginId, event, details }),
      signal: AbortSignal.timeout(5000),
    });
    // 401: NOTIFY_SECRET differs between the two backends.
    if (!res.ok) log.warn(`Player notification "${event}" for ${loginId} was rejected: HTTP ${res.status}.`);
  } catch (err) {
    log.warn(`Player notification "${event}" for ${loginId} failed.`, err);
  }
}
