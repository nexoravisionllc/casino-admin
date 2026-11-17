import { createContext, useContext, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';

// Same-origin hub (the admin app is served by the admin backend during dev via
// the Vite proxy; the hub itself lives on :5100).
//const HUB_URL = 'https://adminbackend.fufvkgylntiyepgk.net/hubs/wallet';
const HUB_URL = 'http://localhost:5100/hubs/wallet';

const RealtimeContext = createContext({ tick: 0 });

// Connects to the wallet hub and bumps `tick` whenever anything changes, so
// data views can re-fetch in real time.
export function RealtimeProvider({ children }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    conn.on('usersChanged', () => setTick((t) => t + 1));
    conn.on('walletUpdated', () => setTick((t) => t + 1));

    let active = true;
    const subscribe = () => conn.invoke('SubscribeAdmin').catch(() => {});
    // Keep the start promise so cleanup waits for negotiation to finish before
    // stopping — avoids the harmless "stopped during negotiation" error that
    // React StrictMode triggers by mounting/unmounting twice in dev.
    const started = conn.start().then(() => { if (active) subscribe(); }).catch(() => {});
    conn.onreconnected(subscribe);

    return () => {
      active = false;
      started.finally(() => conn.stop().catch(() => {}));
    };
  }, []);

  return <RealtimeContext.Provider value={{ tick }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
