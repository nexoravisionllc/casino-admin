import { config } from '../../config.js';

/** HTTP client for the FortuneGate game API. */

const options = config.fortuneGate;

async function post(path, payload) {
  const res = await fetch(`${options.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(100_000),
  });
  if (!res.ok)
    throw new Error(`Response status code does not indicate success: ${res.status} (${res.statusText}).`);

  // Standard envelope: { code, message, data }; code 0 means success.
  const body = await res.json().catch(() => null);
  if (!body || body.code !== 0)
    throw new Error(`FortuneGate ${path} failed: code=${body?.code ?? ''}, message=${body?.message ?? ''}`);
  return body.data;
}

export const fortuneGateClient = {
  /** POST /v4/game/providers: [{ provider_id, provider_name, locale_name, status }] */
  async getProviders() {
    return (await post(options.providersPath, { lang: options.lang })) ?? [];
  },

  /** POST /v4/game/games: one provider's games (category 0 = all). */
  async getGames(providerId) {
    return (await post(options.gamesPath, { provider_id: providerId, category: 0, lang: options.lang })) ?? [];
  },

  /** POST /v4/agent/info: { name, currency, balance, win_ratio } */
  getAgentInfo() {
    return post(options.agentInfoPath, {});
  },

  /** POST /v4/agent/rtp: set the agent win ratio (RTP). */
  async setRtp(winRatio) {
    await post(options.agentRtpPath, { win_ratio: winRatio });
  },
};
