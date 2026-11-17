import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import { useResource } from '../hooks/useResource.js';
import { PageHeader, Card, Alert, Switch, Empty } from '../components/ui.jsx';
import { GamepadIcon, BroadcastIcon } from '../components/Icons.jsx';

const DESCRIPTIONS = {
  slots: 'Slot games and the Slots menu on the player site.',
  'live casino': 'Live dealer tables on the player site.',
  sports: 'Sports betting section on the player site.',
};

// System > Settings: player-site game visibility (backed by /api/gamesetting).
export default function Settings() {
  const { token } = useAuth();
  const res = useResource('/gamesetting', { initial: [] });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const toggle = async (row, next) => {
    // Optimistic update, then persist; reload server truth on failure.
    res.setData((rs) => rs.map((r) => (r.uid === row.uid ? { ...r, showEnable: next } : r)));
    setError('');
    try {
      await apiRequest(`/gamesetting/${row.uid}`, { method: 'PUT', token, body: { showEnable: next } });
      setSaved(`${row.name} is now ${next ? 'visible' : 'hidden'} on the player site.`);
    } catch (e) {
      setError(e.message);
      res.refresh();
    }
  };

  const rows = res.data ?? [];

  return (
    <div className="page">
      <PageHeader crumb="System" title="Settings" subtitle="Control what players see on the user portal. Changes apply immediately." />
      {(error || res.error) && <Alert>{error || res.error}</Alert>}
      {saved && <Alert tone="ok" action={<button className="linklike" onClick={() => setSaved('')}>Dismiss</button>}>{saved}</Alert>}

      <Card title="Game visibility" subtitle="Turn whole game categories on or off for players." bodyClass="card__body--flush">
        <div style={{ marginTop: 12 }}>
          {rows.length ? rows.map((r) => (
            <div className="setting-row" key={r.uid}>
              <div className="setting-row__main">
                <span className="setting-row__ico">
                  {/^live/i.test(r.name) ? <BroadcastIcon width={19} height={19} /> : <GamepadIcon width={19} height={19} />}
                </span>
                <div>
                  <div className="setting-row__title">Show {r.name}</div>
                  <div className="setting-row__desc">{DESCRIPTIONS[r.name.toLowerCase()] ?? `${r.name} on the player site.`}</div>
                </div>
              </div>
              <Switch checked={!!r.showEnable} onChange={(next) => toggle(r, next)} />
            </div>
          )) : (
            <Empty title={res.loading ? 'Loading…' : 'No settings'} />
          )}
        </div>
      </Card>
    </div>
  );
}
