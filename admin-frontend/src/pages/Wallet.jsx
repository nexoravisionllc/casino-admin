import { useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { PageHeader, Alert, Badge, Card, Empty, Stat } from '../components/ui.jsx';
import { RefreshIcon, WalletIcon, ShieldIcon, CheckIcon, LinkIcon } from '../components/Icons.jsx';
import { usd, dateTime, timeAgo } from '../lib/format.js';

const KIND_TONES = { payout: 'orange', sweep: 'green', gas: 'blue' };
const STATUS_TONES = { pending: 'orange', confirmed: 'green', reverted: 'red', dropped: 'red' };
const short = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '');

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // Clipboard blocked (e.g. plain http); the address is still selectable.
    }
  };
  return (
    <button className="btn btn--sm btn--ghost" onClick={copy} title="Copy address">
      {done ? <><CheckIcon width={13} height={13} /> Copied</> : 'Copy'}
    </button>
  );
}

function AddressCard({ title, hint, address, explorerUrl, tone }) {
  return (
    <Card title={title} subtitle={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code className="num" style={{ wordBreak: 'break-all', whiteSpace: 'normal', fontSize: 13.5, flex: '1 1 260px' }}>{address}</code>
        <div className="row-actions">
          <CopyButton text={address} />
          {explorerUrl && (
            <a className="btn btn--sm btn--ghost" href={explorerUrl} target="_blank" rel="noopener noreferrer">
              <LinkIcon width={13} height={13} /> Explorer
            </a>
          )}
        </div>
      </div>
      {tone && <div style={{ marginTop: 10 }}><Badge tone={tone.color}>{tone.text}</Badge></div>}
    </Card>
  );
}

function ChainCard({ c }) {
  if (c.error) return <Card title={c.name}><Alert>{c.error}</Alert></Card>;
  const hot = c.wallets.find((w) => w.role === 'hot');
  const treasury = c.wallets.find((w) => w.role === 'treasury');
  const symbols = hot.balances.map((b) => b.symbol);
  const find = (w, s) => w?.balances.find((b) => b.symbol === s);
  const hotNative = find(hot, c.native);
  const noGas = hotNative && Number(hotNative.amount) === 0;

  return (
    <Card
      title={c.name}
      subtitle={`Chain ${c.chainId} · ${c.confirmations} confirmations${c.nativeUsdPrice != null ? ` · 1 ${c.native} = ${usd(c.nativeUsdPrice)}` : ''}`}
      bodyClass="card__body--flush"
    >
      {noGas && (
        <div style={{ padding: '12px 18px 0' }}>
          {noGas && <Alert>The hot wallet has no {c.native} on {c.key}, so it cannot pay gas. Sweeps wait until you send it some {c.native}.</Alert>}
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="r">Hot wallet</th>
              {treasury && <th className="r">Treasury</th>}
            </tr>
          </thead>
          <tbody>
            {symbols.map((s) => {
              const h = find(hot, s);
              const t = find(treasury, s);
              const cell = (b) => (
                <td className="r">
                  <div className="stack" style={{ alignItems: 'flex-end' }}>
                    <span className="num" style={{ fontWeight: 600 }}>{b.amount} {s}</span>
                    <span className="num faint" style={{ fontSize: 12 }}>{b.usd != null ? usd(b.usd) : 'no price'}</span>
                  </div>
                </td>
              );
              return (
                <tr key={s}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{s}</span>{' '}
                    {h.native && <span className="faint" style={{ fontSize: 12 }}>gas coin</span>}
                  </td>
                  {cell(h)}
                  {treasury && cell(t)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Wallet() {
  const res = useResource('/crypto-wallet', { realtime: true });
  const d = res.data;
  const explorerFor = (role) => d?.chains?.find((c) => !c.error)?.wallets.find((w) => w.role === role)?.explorerUrl;
  const totalUsd = (role) => (d?.chains ?? []).reduce((sum, c) =>
    sum + (c.wallets?.find((w) => w.role === role)?.balances ?? []).reduce((s, b) => s + Number(b.usd ?? 0), 0), 0);

  return (
    <div className="page">
      <PageHeader
        crumb="Money" title="Crypto Wallet"
        subtitle="Live balances of the gateway's hot wallet and treasury. Read only: nothing is sent from this page."
        actions={<button className="btn btn--ghost" onClick={() => res.refresh()}><RefreshIcon width={15} height={15} /> Refresh</button>}
      />
      {res.error && <Alert>{res.error}</Alert>}

      {res.loading && !d ? (
        <div className="stats stats--3">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 110, borderRadius: 14 }} />)}</div>
      ) : d && !d.configured ? (
        <Card><Empty icon={WalletIcon} title="Crypto gateway not configured" text="Set ONCHAIN_MNEMONIC, ONCHAIN_HOT_WALLET_KEY and a BSC_RPC_URL or ETH_RPC_URL in user-backend/.env, then restart the user backend." /></Card>
      ) : d ? (
        <>
          {d.treasuryIsHot && (
            <Alert>ONCHAIN_SWEEP_TO is not set, so player deposits are swept into the hot wallet. Set it in user-backend/.env to a separate wallet you control (ideally a hardware wallet) to keep most funds out of the server's reach.</Alert>
          )}
          {!d.worker && <Alert>The on-chain worker is off in this user backend (ONCHAIN_WORKER=false). Deposits and sweeps only run in the instance where it is on.</Alert>}

          <div className={`stats ${d.treasuryIsHot ? 'stats--2' : 'stats--3'}`} style={{ marginBottom: 16 }}>
            <Stat label="Hot wallet (USD value)" value={usd(totalUsd('hot'))} icon={WalletIcon} tone="gold" foot="Pays sweep gas (withdrawals are paid by hand)" />
            {!d.treasuryIsHot && <Stat label="Treasury (USD value)" value={usd(totalUsd('treasury'))} icon={ShieldIcon} tone="green" foot="Receives swept deposits" />}
            <Stat label="Networks" value={(d.chains ?? []).map((c) => c.key).join(' · ') || '—'} small foot={`${(d.chains ?? []).filter((c) => c.error).length} unreachable`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16, marginBottom: 16 }}>
            <AddressCard
              title="Hot wallet"
              hint="To fund it, send USDT/USDC and some gas coin (BNB/ETH) here on the same network."
              address={d.hotAddress}
              explorerUrl={explorerFor('hot')}
              tone={{ color: 'orange', text: 'Key on the server: keep only a working float here' }}
            />
            <AddressCard
              title="Treasury (sweep target)"
              hint={d.treasuryIsHot ? 'Not set: same as the hot wallet.' : 'Deposits collect here. Send from it with your own wallet app at any time.'}
              address={d.treasuryAddress}
              explorerUrl={d.treasuryIsHot ? explorerFor('hot') : explorerFor('treasury')}
              tone={d.treasuryIsHot ? { color: 'red', text: 'Not separated from the hot wallet' } : { color: 'green', text: 'Key not on the server' }}
            />
          </div>

          <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
            {(d.chains ?? []).map((c) => <ChainCard key={c.key} c={c} />)}
          </div>

          <Card title="Recent gateway transactions" subtitle="The last 25 transactions the gateway signed: payouts, sweeps and gas top-ups" bodyClass="card__body--flush">
            {d.recentTxs?.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Kind</th><th>Network</th><th className="r">Amount</th><th>From</th><th>To</th><th>Status</th><th>Tx</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {d.recentTxs.map((t) => (
                      <tr key={t.uid}>
                        <td><Badge tone={KIND_TONES[t.kind]}>{t.kind}</Badge></td>
                        <td>{t.chain}</td>
                        <td className="r num">{t.amount ?? '?'} {t.asset}</td>
                        <td className="num muted" title={t.from}>{t.from === d.hotAddress ? 'Hot wallet' : short(t.from)}</td>
                        <td className="num muted" title={t.to}>{t.to === d.hotAddress ? 'Hot wallet' : t.to === d.treasuryAddress ? 'Treasury' : short(t.to)}</td>
                        <td><Badge tone={STATUS_TONES[t.status]} dot>{t.status}</Badge></td>
                        <td>{t.url ? <a className="txtag-link" href={t.url} target="_blank" rel="noopener noreferrer">{short(t.hash)} ↗</a> : <span className="num faint">{short(t.hash)}</span>}</td>
                        <td className="nowrap"><span className="stack"><span>{timeAgo(t.createdAt)}</span><span className="faint" style={{ fontSize: 12 }}>{dateTime(t.createdAt)}</span></span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="No transactions yet" text="Payouts, sweeps and gas top-ups appear here once the gateway sends them." />
            )}
          </Card>

          <Card title="How to move funds">
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 13.5 }}>
              <li><strong>Receive / fund:</strong> send coins to the hot wallet address above, on the matching network (BEP20 on BSC, ERC20 on Ethereum).</li>
              <li><strong>Pay a player:</strong> accept the request under Money › Withdrawals. The worker sends it from the hot wallet within one poll.</li>
              <li><strong>Send to any other wallet:</strong> send from the treasury with your own wallet app. Don't send from the hot wallet by hand while the user backend runs, because it would clash with the worker's transactions. If you must, stop the worker first.</li>
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}
