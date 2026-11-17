import { config } from '../../config.js';
import { log } from '../../lib/log.js';
import { fortuneGateClient } from './client.js';

/**
 * The most recent FortuneGate agent info, refreshed by a poller every few
 * seconds and read by the dashboard header.
 */
let latest = null;

export const fortuneGateState = {
  /** Agent balance shown as the "Fortune Gate" header value. */
  get agentBalance() {
    return Number(latest?.balance ?? 0);
  },
  /** Agent win ratio (RTP), shown as the "Fortune RTP" header value. */
  get winRatio() {
    return Number(latest?.win_ratio ?? 0);
  },
};

/** Poll POST /v4/agent/info until stopped. Returns a stop function. */
export function startFortuneGatePolling() {
  const intervalMs = Math.max(1, config.fortuneGate.agentInfoIntervalSeconds) * 1000;
  let timer = null;
  let stopped = false;

  const tick = async () => {
    try {
      const info = await fortuneGateClient.getAgentInfo();
      if (info) latest = info;
    } catch (err) {
      log.warn('FortuneGate agent/info poll failed.', err);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
