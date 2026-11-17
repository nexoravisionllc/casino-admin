import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LevelBadge, UserBadge, levelLetter } from './LevelBadge.jsx';
import { SearchInput } from './ui.jsx';
import { ChevronRightIcon, CollapseIcon, ExpandIcon, LayersIcon } from './Icons.jsx';

const ALL = '__all__';

/** Keep only agent nodes (for the Agents tree). */
export const agentsOnly = (nodes) =>
  nodes.filter((n) => n.kind === 'agent').map((n) => ({ ...n, children: agentsOnly(n.children) }));

function Highlight({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * Hierarchy browser for agents and members.
 *
 * - search filters the tree, keeping the ancestors of every match visible
 * - expand / collapse all; big trees start with only the top level open
 * - descendant counts on every branch
 * - optional "All" row (allLabel) that clears the selection
 * - keyboard: ↑ ↓ move, → expand / enter, ← collapse / parent, Enter select
 * - the selected node is always revealed and scrolled into view
 */
export default function TreeView({
  nodes, selectedId, onSelect, title = 'Members', allLabel, loading, emptyText = 'Nothing here yet.',
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);
  const initialized = useRef(false);
  const rowRefs = useRef(new Map());
  const bodyRef = useRef(null);
  const q = query.trim().toLowerCase();

  // Index: parent links, descendant counts, branch ids, roles present.
  const index = useMemo(() => {
    const parent = new Map();
    const counts = new Map();
    const branches = [];
    const roles = new Set();
    let total = 0;
    let hasUsers = false;
    const walk = (list, parentId, depth) => {
      let agents = 0;
      let users = 0;
      for (const n of list) {
        total++;
        parent.set(n.id, parentId);
        if (n.kind === 'agent') { agents++; roles.add(n.data.role); } else { users++; hasUsers = true; }
        if (n.children.length) {
          branches.push({ id: n.id, depth });
          const c = walk(n.children, n.id, depth + 1);
          counts.set(n.id, c);
          agents += c.agents;
          users += c.users;
        }
      }
      return { agents, users };
    };
    walk(nodes, null, 0);
    return { parent, counts, branches, roles: [...roles].sort((a, b) => a - b), hasUsers, total };
  }, [nodes]);

  // Large trees start with only the first level open.
  useEffect(() => {
    if (initialized.current || !index.total) return;
    initialized.current = true;
    if (index.total > 120) setCollapsed(new Set(index.branches.filter((b) => b.depth >= 1).map((b) => b.id)));
  }, [index]);

  // Search: nodes that match or have a matching descendant.
  const visible = useMemo(() => {
    if (!q) return null;
    const keep = new Set();
    const walk = (list) => {
      let any = false;
      for (const n of list) {
        const self = n.data.name.toLowerCase().includes(q) || n.data.loginId.toLowerCase().includes(q);
        const child = walk(n.children);
        if (self || child) { keep.add(n.id); any = true; }
      }
      return any;
    };
    walk(nodes);
    return keep;
  }, [nodes, q]);

  const isOpen = useCallback((id) => (visible ? true : !collapsed.has(id)), [visible, collapsed]);

  // Visible rows in order, for keyboard navigation.
  const flat = useMemo(() => {
    const out = allLabel && !q ? [{ id: ALL, hasChildren: false }] : [];
    const walk = (list) => {
      for (const n of list) {
        if (visible && !visible.has(n.id)) continue;
        out.push({ id: n.id, hasChildren: n.children.length > 0, node: n });
        if (n.children.length && isOpen(n.id)) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }, [nodes, visible, isOpen, allLabel, q]);

  // Reveal + scroll to the selection whenever it changes.
  useEffect(() => {
    if (!selectedId) return;
    setCollapsed((prev) => {
      let p = index.parent.get(selectedId);
      if (p == null || !prev.size) return prev;
      const next = new Set(prev);
      while (p != null) { next.delete(p); p = index.parent.get(p); }
      return next.size === prev.size ? prev : next;
    });
    const t = setTimeout(() => {
      const el = rowRefs.current.get(selectedId);
      const body = bodyRef.current;
      if (!el || !body) return;
      const er = el.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      if (er.top < br.top || er.bottom > br.bottom) el.scrollIntoView({ block: 'nearest' });
    }, 30);
    return () => clearTimeout(t);
  }, [selectedId, index]);

  const toggle = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(index.branches.map((b) => b.id)));

  const select = (id) => onSelect(id === ALL ? null : id);
  const focusRow = (id) => {
    setFocusId(id);
    rowRefs.current.get(id)?.focus();
  };

  const onKeyDown = (e) => {
    const cur = flat.findIndex((r) => r.id === (focusId ?? selectedId ?? ALL));
    const row = flat[cur];
    let handled = true;
    switch (e.key) {
      case 'ArrowDown': if (cur < flat.length - 1) focusRow(flat[cur + 1].id); break;
      case 'ArrowUp': if (cur > 0) focusRow(flat[cur - 1].id); break;
      case 'Home': if (flat.length) focusRow(flat[0].id); break;
      case 'End': if (flat.length) focusRow(flat[flat.length - 1].id); break;
      case 'ArrowRight':
        if (row?.hasChildren) {
          if (!isOpen(row.id)) toggle(row.id);
          else if (flat[cur + 1]) focusRow(flat[cur + 1].id);
        }
        break;
      case 'ArrowLeft':
        if (row?.hasChildren && isOpen(row.id) && !visible) toggle(row.id);
        else {
          const p = row && index.parent.get(row.id);
          if (p) focusRow(p);
        }
        break;
      case 'Enter':
      case ' ':
        if (row) select(row.id);
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  };

  const tabbable = focusId ?? selectedId ?? flat[0]?.id;

  const rowProps = (id, extra = {}) => ({
    ref: (el) => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id); },
    role: 'treeitem',
    tabIndex: tabbable === id ? 0 : -1,
    'aria-selected': (selectedId ?? ALL) === id,
    className: `tree__row ${(selectedId ?? (allLabel ? ALL : null)) === id ? 'is-selected' : ''} ${extra.className ?? ''}`,
    onClick: () => { setFocusId(id); select(id); },
    onFocus: () => setFocusId(id),
  });

  const renderList = (list, depth) => list
    .filter((n) => !visible || visible.has(n.id))
    .map((n) => {
      const hasChildren = n.children.length > 0;
      const open = hasChildren && isOpen(n.id);
      const c = index.counts.get(n.id);
      const countTitle = c && [c.agents && `${c.agents} agent${c.agents > 1 ? 's' : ''}`, c.users && `${c.users} member${c.users > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
      return (
        <li className="tree__node" role="none" key={n.id}>
          <div {...rowProps(n.id)} aria-level={depth + 1} aria-expanded={hasChildren ? open : undefined}
            title={`${n.data.name} (@${n.data.loginId})`}>
            {hasChildren ? (
              <button
                type="button" tabIndex={-1} className={`tree__toggle ${open ? 'is-open' : ''}`}
                aria-label={open ? 'Collapse' : 'Expand'}
                onClick={(e) => { e.stopPropagation(); if (!visible) toggle(n.id); }}
              >
                <ChevronRightIcon width={14} height={14} strokeWidth={2.5} />
              </button>
            ) : <span className="tree__leaf" />}
            {n.kind === 'agent' ? <LevelBadge role={n.data.role} /> : <UserBadge />}
            <span className="tree__text">
              <span className="tree__name"><Highlight text={n.data.name} q={q} /></span>
              <span className="tree__id">@<Highlight text={n.data.loginId} q={q} /></span>
            </span>
            {c && <span className="tree__count" title={countTitle}>{c.agents + c.users}</span>}
          </div>
          {open && <ul role="group" className="tree__group">{renderList(n.children, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <section className="card tree-card">
      <div className="tree-card__head">
        <span className="tree-card__title">
          {title}
          <span className="tree-card__count">{index.total}</span>
        </span>
        <span className="tree-card__tools">
          <button type="button" className="icon-btn icon-btn--plain icon-btn--sm" onClick={expandAll} title="Expand all" aria-label="Expand all" disabled={!!visible}>
            <ExpandIcon width={15} height={15} />
          </button>
          <button type="button" className="icon-btn icon-btn--plain icon-btn--sm" onClick={collapseAll} title="Collapse all" aria-label="Collapse all" disabled={!!visible}>
            <CollapseIcon width={15} height={15} />
          </button>
        </span>
      </div>
      <div className="tree-card__search">
        <SearchInput value={query} onChange={setQuery} placeholder="Find name or ID" />
      </div>
      <div className="tree-card__body" ref={bodyRef}>
        {loading && !nodes.length ? (
          <div style={{ display: 'grid', gap: 8, padding: 6 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 30, marginLeft: (i % 3) * 18 }} />)}
          </div>
        ) : (
          <ul className="tree" role="tree" aria-label={title} onKeyDown={onKeyDown}>
            {allLabel && !q && (
              <li className="tree__node tree__all" role="none">
                <div {...rowProps(ALL)} aria-level={1}>
                  <span className="tree__all-ico"><LayersIcon width={14} height={14} /></span>
                  <span className="tree__text"><span className="tree__name">{allLabel}</span></span>
                  <span className="tree__count">{index.total}</span>
                </div>
              </li>
            )}
            {renderList(nodes, 0)}
            {visible && !visible.size && <li className="tree__empty" role="none">No match for “{query}”.</li>}
            {!visible && !nodes.length && <li className="tree__empty" role="none">{emptyText}</li>}
          </ul>
        )}
      </div>
      {(index.roles.length > 0) && (
        <div className="tree-card__legend">
          {index.roles.map((r) => (
            <span key={r}><LevelBadge role={r} size="sm" /> {r === 1 ? 'Admin' : `Level ${levelLetter(r)}`}</span>
          ))}
          {index.hasUsers && <span><UserBadge size="sm" /> Member</span>}
        </div>
      )}
    </section>
  );
}
