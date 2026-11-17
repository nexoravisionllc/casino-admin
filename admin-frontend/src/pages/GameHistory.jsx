import { useMemo, useState } from 'react';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { useResource } from '../hooks/useResource.js';
import { usePaged } from '../hooks/usePaged.js';
import TreeView from '../components/TreeView.jsx';
import { MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, Alert, SearchInput, TableEmpty, Switch } from '../components/ui.jsx';
import DateRange, { inRange, todayRange } from '../components/DateRange.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import { parseDate, dateTime, usd } from '../lib/format.js';
import { CloseIcon } from '../components/Icons.jsx';

const SUMMARY = [
  { key: 'bet', label: 'Total bet', color: 'var(--brand)' },
  { key: 'win', label: 'Total win', color: 'var(--accent)' },
  { key: 'rolling', label: 'Rolling', color: 'var(--info)' },
  { key: 'profit', label: 'Profit', color: 'var(--violet)' },
  { key: 'cancel', label: 'Cancelled', color: 'var(--danger)' },
];

// Members > Game History: rounds (bet + win + cancel events combined) with a
// Bet / Win / Rolling / Profit / Cancel summary over the current filter.
export default function GameHistory() {
  const h = useHierarchy();
  const hist = useResource('/game-history', { realtime: true, initial: [] });
  const [[from, to], setRange] = useState(todayRange);
  const [selectedId, setSelectedId] = useState(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [search, setSearch] = useState('');

  const scope = useMemo(() => h.scopeLogins(selectedId, { includeSub }), [h.scopeLogins, selectedId, includeSub]);
  const q = search.trim().toLowerCase();

  const rounds = useMemo(() => {
    const map = new Map();
    for (const r of hist.data ?? []) {
      if (scope && !scope.has(r.userId)) continue;
      if (!inRange(parseDate(r.createdAt), from, to)) continue;
      if (q && !r.userId.toLowerCase().includes(q) && !(r.gameName ?? '').toLowerCase().includes(q) && !(r.providerName ?? '').toLowerCase().includes(q) && !(r.roundId ?? '').toLowerCase().includes(q)) continue;
      const key = r.roundId ? `r:${r.userId}:${r.roundId}` : `u:${r.uid}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const out = [];
    for (const events of map.values()) {
      const sorted = [...events].sort((a, b) => a.uid - b.uid);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      let bet = 0, win = 0, cancel = 0, rolling = 0;
      for (const e of events) {
        if (e.type === 'BET') { bet += Number(e.amount); rolling += Number(e.rolling ?? 0); }
        else if (e.type === 'WIN') win += Number(e.amount);
        else if (e.type === 'CANCEL') cancel += Number(e.amount);
      }
      out.push({
        key: last.uid, userId: first.userId, providerName: first.providerName,
        gameName: first.gameName, gameCode: first.gameCode, bet, win, cancel, rolling,
        roundId: first.roundId, beforeAmount: first.beforeAmount, afterAmount: last.afterAmount,
        company: first.company, createdAt: last.createdAt,
      });
    }
    return out.sort((a, b) => b.key - a.key);
  }, [hist.data, scope, from, to, q]);

  const summary = useMemo(() => {
    const s = { bet: 0, win: 0, cancel: 0, rolling: 0 };
    for (const r of rounds) { s.bet += r.bet; s.win += r.win; s.cancel += r.cancel; s.rolling += r.rolling; }
    return { ...s, profit: s.bet - s.win - s.rolling };
  }, [rounds]);

  const paged = usePaged(rounds, `${selectedId}|${from}|${to}|${q}|${includeSub}`);
  const dash = <span className="faint">—</span>;

  return (
    <div className="page">
      <PageHeader crumb="Members" title="Game History" subtitle={`${rounds.length.toLocaleString('en-US')} rounds in the selected range`} />
      {(h.error || hist.error) && <Alert>{h.error || hist.error}</Alert>}

      <div className="split">
        <div className="split__aside">
          <TreeView title="Network" nodes={h.tree} selectedId={selectedId} onSelect={setSelectedId} allLabel="All members" loading={h.loading} />
        </div>

        <section className="card">
          <div className="toolbar">
            <DateRange from={from} to={to} onChange={(f, t) => setRange([f, t])} />
            <div className="toolbar__group toolbar__grow">
              <span className="toolbar__label">Search</span>
              <SearchInput value={search} onChange={setSearch} placeholder="User, game, provider or round" />
            </div>
            <div className="toolbar__group">
              <span className="toolbar__label">Scope</span>
              <Switch checked={includeSub} onChange={setIncludeSub} label="Include sub-agents" />
            </div>
            {selectedId && (
              <span className="scope">
                {h.labelOf(selectedId)}
                <button onClick={() => setSelectedId(null)} aria-label="Clear filter"><CloseIcon width={13} height={13} /></button>
              </span>
            )}
          </div>

          <div className="summary">
            {SUMMARY.map((s) => (
              <div className="summary__item" key={s.key}>
                <div className="summary__label"><i style={{ background: s.color }} />{s.label}</div>
                <div className={`summary__value ${s.key === 'profit' ? (summary.profit < 0 ? 'neg' : 'pos') : ''}`}>{usd(summary[s.key])}</div>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Member</th><th>Game</th><th className="r">Bet</th><th className="r">Win</th>
                  <th className="r">Cancel</th><th className="r">Rolling</th><th className="r">Before</th><th className="r">After</th>
                  <th>Round</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((r, i) => {
                  const u = h.userByLogin.get(r.userId);
                  return (
                    <tr key={r.key}>
                      <td className="table__idx">{paged.start + i + 1}</td>
                      <td><MemberCell name={u?.name ?? r.userId} loginId={r.userId} /></td>
                      <td>
                        <span className="member__txt">
                          <span className="member__name">{r.gameName || r.gameCode || '—'}</span>
                          <span className="member__id">{[r.providerName, r.company].filter(Boolean).join(' · ') || '—'}</span>
                        </span>
                      </td>
                      <td className="r amount">{usd(r.bet)}</td>
                      <td className={`r amount ${r.win > 0 ? 'pos' : 'faint'}`}>{usd(r.win)}</td>
                      <td className="r num">{r.cancel > 0 ? <span className="neg">{usd(r.cancel)}</span> : dash}</td>
                      <td className="r num">{r.rolling > 0 ? usd(r.rolling) : dash}</td>
                      <td className="r num muted">{usd(r.beforeAmount)}</td>
                      <td className="r num">{usd(r.afterAmount)}</td>
                      <td className="nowrap muted" style={{ fontSize: 12.5 }}>{r.roundId || dash}</td>
                      <td className="nowrap muted">{dateTime(r.createdAt)}</td>
                    </tr>
                  );
                })}
                {!paged.pageRows.length && (
                  <TableEmpty cols={11} loading={hist.loading} title="No game rounds"
                    text="Nothing matches this date range and selection. Try “7 days” or “All time”." />
                )}
              </tbody>
            </table>
          </div>
          <TableFoot paged={paged} noun="rounds" />
        </section>
      </div>
    </div>
  );
}
