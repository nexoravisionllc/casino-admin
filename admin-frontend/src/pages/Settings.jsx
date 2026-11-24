import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import { useResource } from '../hooks/useResource.js';
import { PageHeader, Card, Alert, Switch, Empty } from '../components/ui.jsx';
import { GamepadIcon, BroadcastIcon, UserPlusIcon } from '../components/Icons.jsx';

const DESCRIPTIONS = {
  slots: 'Slot games and the Slots menu on the player site.',
  'live casino': 'Live dealer tables on the player site.',
  sports: 'Sports betting section on the player site.',
};

// System > Settings: sign-up approval (/api/settings) and player-site game
// visibility (/api/gamesetting).
export default function Settings() {
  const { token, readOnly, partner } = useAuth();
  const isTopAdmin = Number(partner?.role) === 1;
  const res = useResource('/gamesetting', { initial: [] });
  const site = useResource('/settings', { initial: null });
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

  const setAutoApprove = async (next) => {
    site.setData((d) => ({ ...d, autoApproveSignups: next }));
    setError('');
    try {
      site.setData(await apiRequest('/settings', { method: 'PUT', token, body: { autoApproveSignups: next } }));
      setSaved(next
        ? 'Auto-approval is on: new sign-ups can sign in right away.'
        : 'Auto-approval is off: new sign-ups wait in Waited Members for approval.');
    } catch (e) {
      setError(e.message);
      site.refresh();
    }
  };

  const rows = res.data ?? [];
  const autoApprove = Boolean(site.data?.autoApproveSignups);

  return (
    <div className="page">
      <PageHeader crumb="System" title="Settings" subtitle="Control what players see on the user portal. Changes apply immediately." />
      {(error || res.error || site.error) && <Alert>{error || res.error || site.error}</Alert>}
      {saved && <Alert tone="ok" action={<button className="linklike" onClick={() => setSaved('')}>Dismiss</button>}>{saved}</Alert>}

      <Card title="Sign-ups" subtitle="How new player accounts are approved." bodyClass="card__body--flush">
        <div style={{ marginTop: 12 }}>
          <div className="setting-row">
            <div className="setting-row__main">
              <span className="setting-row__ico"><UserPlusIcon width={19} height={19} /></span>
              <div>
                <div className="setting-row__title">Auto-approve new sign-ups</div>
                <div className="setting-row__desc">
                  {autoApprove
                    ? 'On: every new player account is approved automatically and can sign in right away.'
                    : 'Off: new player accounts wait in Waited Members until you approve them.'}
                  {' '}Accounts that are already waiting are not affected.
                  {!isTopAdmin && ' Only the top admin can change this.'}
                </div>
              </div>
            </div>
            <Switch checked={autoApprove} onChange={setAutoApprove} disabled={readOnly || !isTopAdmin || site.data == null} />
          </div>
        </div>
      </Card>

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
              <Switch checked={!!r.showEnable} onChange={(next) => toggle(r, next)} disabled={readOnly} />
            </div>
          )) : (
            <Empty title={res.loading ? 'Loading…' : 'No settings'} />
          )}
        </div>
      </Card>
    </div>
  );
}
