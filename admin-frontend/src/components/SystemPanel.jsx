// Secondary panel shown when the System rail icon is active. Same shape as the
// Agent/Games panels: a "System" label on top, a collapse arrow, and sub-pages.
const views = [
  { key: 'setting', label: 'Setting' },
  { key: 'notices', label: 'Notices' },
  { key: 'events', label: 'Create Events' },
];

export default function SystemPanel({ activeView, onSelectView, onCollapse }) {
  return (
    <aside className="agent-panel">
      <div className="agent-panel__head">
        <span className="agent-panel__title">System</span>
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
