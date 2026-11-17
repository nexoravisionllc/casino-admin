// Secondary panel shown when the Money rail icon is active. Titled "Money" with
// the Deposit, Withdraw, Transaction and Point Log sub-pages.
const views = [
  { key: 'deposit', label: 'Deposit' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'transaction', label: 'Transaction' },
  { key: 'point-log', label: 'Point Log' },
];

export default function MoneyPanel({ activeView, onSelectView, onCollapse }) {
  return (
    <aside className="agent-panel">
      <div className="agent-panel__head">
        <span className="agent-panel__title">Money</span>
        <button className="agent-panel__collapse" onClick={onCollapse} aria-label="Collapse">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <nav className="agent-panel__nav">
        {views.map(({ key, label }) => (
          <button
            key={key}
            className={`agent-panel__item ${activeView === key ? 'is-active' : ''}`}
            onClick={() => onSelectView(key)}
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
