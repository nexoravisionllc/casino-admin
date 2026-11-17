import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LevelBadge, UserBadge, levelLetter } from './LevelBadge.jsx';
import { ChevronRightIcon, CloseIcon, CollapseIcon, ExpandIcon, LayersIcon, SearchIcon } from './Icons.jsx';

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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Hierarchy browser for agents and members.
 *
 * - search filters the tree (ancestors of matches stay visible), "/" focuses it
 * - one-click expand / collapse all; big trees start with only the top level open
 * - descendant counts on every branch
 * - optional pinned "All" row (allLabel) that clears the selection
 * - keyboard: ↑ ↓ move, → expand / enter, ← collapse / parent, Enter select
 * - the selected node is always revealed, scrolled into view, and its path shown
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
  const searchRef = useRef(null);
  const q = query.trim().toLowerCase();

  // Index: parent links, node lookup, descendant counts, branch ids, roles present.
  const index = useMemo(() => {
    const parent = new Map();
    const byId = new Map();
    const counts = new Map();
    const branches = [];
    const roles = new Set();
    let agents = 0;
    let users = 0;
    const walk = (list, parentId, depth) => {
      let a = 0;
      let u = 0;
      for (const n of list) {
        parent.set(n.id, parentId);
        byId.set(n.id, n);
        if (n.kind === 'agent') { a++; agents++; roles.add(n.data.role); } else { u++; users++; }
        if (n.children.length) {
          branches.push({ id: n.id, depth });
          const c = walk(n.children, n.id, depth + 1);
          counts.set(n.id, c);
          a += c.agents;
          u += c.users;
        }
      }
      return { agents: a, users: u };
    };
    walk(nodes, null, 0);
    return { parent, byId, counts, branches, roles: [...roles].sort((x, y) => x - y), agents, users, total: agents + users };
  }, [nodes]);

  // Large trees start with only the first level open.
  useEffect(() => {
    if (initialized.current || !index.total) return;
    initialized.current = true;
    if (index.total > 120) setCollapsed(new Set(index.branches.filter((b) => b.depth >= 1).map((b) => b.id)));
  }, [index]);

  // "/" focuses the search box (unless typing somewhere already).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Search: nodes that match or have a matching descendant.
  const search = useMemo(() => {
    if (!q) return null;
    const keep = new Set();
    let matches = 0;
    const walk = (list) => {
      let any = false;
      for (const n of list) {
        const self = n.data.name.toLowerCase().includes(q) || n.data.loginId.toLowerCase().includes(q);
        if (self) matches++;
        const child = walk(n.children);
        if (self || child) { keep.add(n.id); any = true; }
      }
      return any;
    };
    walk(nodes);
    return { keep, matches };
  }, [nodes, q]);
  const visible = search?.keep ?? null;

  const isOpen = useCallback((id) => (visible ? true : !collapsed.has(id)), [visible, collapsed]);
  const allOpen = collapsed.size === 0;

  // Visible rows in order, for keyboard navigation.
  const flat = useMemo(() => {
    const out = allLabel && !q ? [{ id: ALL, hasChildren: false }] : [];
    const walk = (list) => {
      for (const n of list) {
        if (visible && !visible.has(n.id)) continue;
        out.push({ id: n.id, hasChildren: n.children.length > 0 });
        if (n.children.length && isOpen(n.id)) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }, [nodes, visible, isOpen, allLabel, q]);

  // Reveal + scroll to the selection whenever it changes.
  useEffect(() => {
    if (!selectedId) return undefined;
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

  // Path from the root to the selection, for the footer breadcrumb.
  const path = useMemo(() => {
    const out = [];
    let id = selectedId;
    while (id != null) {
      const n = index.byId.get(id);
      if (!n) break;
      out.unshift(n);
      id = index.parent.get(id);
    }
    return out;
  }, [selectedId, index]);

  const toggle = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setCollapsed(allOpen ? new Set(index.branches.map((b) => b.id)) : new Set());

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

  const current = selectedId ?? (allLabel ? ALL : null);
  const tabbable = focusId ?? current ?? flat[0]?.id;

  const rowProps = (id, className = '') => ({
    ref: (el) => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id); },
    role: 'treeitem',
    tabIndex: tabbable === id ? 0 : -1,
    'aria-selected': current === id,
    className: `tree__row ${current === id ? 'is-selected' : ''} ${className}`,
    onClick: () => { setFocusId(id); select(id); },
    onFocus: () => setFocusId(id),
  });

  const renderList = (list, depth) => list
    .filter((n) => !visible || visible.has(n.id))
    .map((n) => {
      const hasChildren = n.children.length > 0;
      const open = hasChildren && isOpen(n.id);
      const c = index.counts.get(n.id);
      const countTitle = c && [c.agents && plural(c.agents, 'agent'), c.users && plural(c.users, 'member')].filter(Boolean).join(' · ');
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
                <ChevronRightIcon width={13} height={13} strokeWidth={2.5} />
              </button>
            ) : <span className="tree__leaf" />}
            {n.kind === 'agent' ? <LevelBadge role={n.data.role} size="tree" /> : <UserBadge size="tree" />}
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

  const summary = q
    ? (search.matches ? `${plural(search.matches, 'match')} for “${query.trim()}”` : `No match for “${query.trim()}”`)
    : [index.agents && plural(index.agents, 'agent'), index.users && plural(index.users, 'member')].filter(Boolean).join(' · ') || '—';

  return (
    <section className="card tree-card">
      <div className="tree-card__head">
        <div className="tree-card__heading">
          <span className="tree-card__title">{title}</span>
          <span className="tree-card__sub">{summary}</span>
        </div>
        <button
          type="button" className="icon-btn icon-btn--sm" onClick={toggleAll} disabled={!!visible || !index.branches.length}
          title={allOpen ? 'Collapse all' : 'Expand all'} aria-label={allOpen ? 'Collapse all' : 'Expand all'}
        >
          {allOpen ? <CollapseIcon width={15} height={15} /> : <ExpandIcon width={15} height={15} />}
        </button>
      </div>

      <div className="tree-card__search">
        <SearchIcon width={15} height={15} />
        <input
          ref={searchRef} value={query} placeholder="Find name or ID" autoComplete="off" aria-label={`Search ${title}`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
            if (e.key === 'ArrowDown' && flat.length) { e.preventDefault(); focusRow(flat[0].id); }
          }}
        />
        {query
          ? <button type="button" className="tree-card__clear" onClick={() => setQuery('')} aria-label="Clear search"><CloseIcon width={13} height={13} /></button>
          : <kbd className="tree-card__kbd" title="Press / to search">/</kbd>}
      </div>

      {allLabel && !q && (
        <div className="tree-card__pinned" role="tree" aria-label={`${title}: all`} onKeyDown={onKeyDown}>
          <div {...rowProps(ALL, 'tree__row--all')} aria-level={1}>
            <span className="tree__all-ico"><LayersIcon width={14} height={14} /></span>
            <span className="tree__text"><span className="tree__name">{allLabel}</span></span>
            <span className="tree__count">{index.total}</span>
          </div>
        </div>
      )}

      <div className="tree-card__body" ref={bodyRef}>
        {loading && !nodes.length ? (
          <div className="tree-card__skel">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 28, marginLeft: [0, 16, 32, 16, 0][i] }} />)}
          </div>
        ) : (
          <ul className="tree" role="tree" aria-label={title} onKeyDown={onKeyDown}>
            {renderList(nodes, 0)}
            {visible && !visible.size && (
              <li className="tree__empty" role="none">
                <SearchIcon width={18} height={18} />
                <span>No one matches “{query.trim()}”.</span>
                <button type="button" className="linklike" onClick={() => setQuery('')}>Clear search</button>
              </li>
            )}
            {!visible && !nodes.length && <li className="tree__empty" role="none">{emptyText}</li>}
          </ul>
        )}
      </div>

      {path.length > 1 ? (
        <div className="tree-card__path" title={path.map((n) => n.data.name).join(' › ')}>
          {path.map((n, i) => (
            <span key={n.id} className="tree-card__crumb">
              {i > 0 && <ChevronRightIcon width={11} height={11} className="tree-card__sep" />}
              <button type="button" onClick={() => select(n.id)} className={i === path.length - 1 ? 'is-current' : ''}>{n.data.name}</button>
            </span>
          ))}
        </div>
      ) : index.roles.length > 0 && (
        <div className="tree-card__legend" aria-label="Legend">
          {index.roles.map((r) => (
            <span key={r} className="tree-card__key">
              <LevelBadge role={r} size="xs" />{r === 1 ? 'Admin' : `Level ${levelLetter(r)}`}
            </span>
          ))}
          {index.users > 0 && <span className="tree-card__key"><UserBadge size="xs" />Member</span>}
        </div>
      )}
    </section>
  );
}
