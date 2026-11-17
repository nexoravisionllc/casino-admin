// Secondary panel shown when the Agents rail icon is active. The "Agent" label
// stays at the top; the arrow collapses (hides) the panel. The sample's five
// sub-pages are replaced by Agents Treeview and Agents List.
const views = [
  { key: 'treeview', label: 'Agents Treeview' },
  { key: 'list', label: 'Agents List' },
];

export default function AgentPanel({ activeView, onSelectView, onCollapse }) {
  return (
    <aside className="agent-panel">
      <div className="agent-panel__head">
        <span className="agent-panel__title">Agent</span>
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
