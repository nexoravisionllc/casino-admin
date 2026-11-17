// Secondary panel shown when the Members rail icon is active. Mirrors AgentPanel
// but titled "Users", with the Users List and Transaction History sub-pages.
const views = [
  { key: 'list', label: 'Users List' },
  { key: 'waited', label: 'Waited Users' },
  { key: 'transactions', label: 'Transaction History' },
  { key: 'gamehistory', label: 'Game History' },
];

export default function MembersPanel({ activeView, onSelectView, onCollapse }) {
  return (
    <aside className="agent-panel">
      <div className="agent-panel__head">
        <span className="agent-panel__title">Users</span>
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
