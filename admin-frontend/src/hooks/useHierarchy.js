import { useCallback, useMemo } from 'react';
import { useResource } from './useResource.js';

/**
 * Agents (Partners) + end users, with the lookups every scoped page needs:
 * ancestor chains, a ready-to-render tree, and "which login ids does this tree
 * selection cover" for filtering transactions / history.
 */
export function useHierarchy({ withUsers = true } = {}) {
  const agentsRes = useResource('/agents', { realtime: true, initial: [] });
  const usersRes = useResource(withUsers ? '/users' : null, { realtime: true, initial: [] });

  const agents = agentsRes.data ?? [];
  const users = usersRes.data ?? [];

  const agentById = useMemo(() => new Map(agents.map((a) => [a.uid, a])), [agents]);
  const userById = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);
  const userByLogin = useMemo(() => new Map(users.map((u) => [u.loginId, u])), [users]);
  const agentByLogin = useMemo(() => new Map(agents.map((a) => [a.loginId, a])), [agents]);

  /** Agents above a row (root first), following partnerId. */
  const ancestors = useCallback((row) => {
    const chain = [];
    const seen = new Set();
    let pid = row?.partnerId;
    while (pid != null && !seen.has(pid)) {
      seen.add(pid);
      const p = agentById.get(pid);
      if (!p) break;
      chain.unshift(p);
      pid = p.partnerId;
    }
    return chain;
  }, [agentById]);

  /** Tree nodes: { id, kind: 'agent'|'user', data, children }. */
  const tree = useMemo(() => {
    const agentsByParent = new Map();
    for (const a of agents) {
      const k = a.partnerId != null && agentById.has(a.partnerId) ? a.partnerId : 'root';
      if (!agentsByParent.has(k)) agentsByParent.set(k, []);
      agentsByParent.get(k).push(a);
    }
    const usersByParent = new Map();
    for (const u of users) {
      const k = u.partnerId != null && agentById.has(u.partnerId) ? u.partnerId : 'root';
      if (!usersByParent.has(k)) usersByParent.set(k, []);
      usersByParent.get(k).push(u);
    }
    const byName = (a, b) => a.name.localeCompare(b.name);
    const build = (k, depth) => (depth > 50 ? [] : [
      ...(agentsByParent.get(k) ?? []).sort(byName).map((a) => ({
        id: `agent:${a.uid}`, kind: 'agent', data: a, children: build(a.uid, depth + 1),
      })),
      ...(usersByParent.get(k) ?? []).sort(byName).map((u) => ({
        id: `user:${u.uid}`, kind: 'user', data: u, children: [],
      })),
    ]);
    return build('root', 0);
  }, [agents, users, agentById]);

  /** Is agent `agentUid` the row itself or one of its ancestors? */
  const isUnder = useCallback((row, agentUid, { direct = false } = {}) => {
    if (direct) return row.partnerId === agentUid;
    return ancestors(row).some((p) => p.uid === agentUid);
  }, [ancestors]);

  /**
   * Login ids covered by a tree selection id ("agent:3" / "user:7"), or null
   * for "everything". With `includeAgents`, the agent's own and sub-agents'
   * login ids are included too (for agent-side records like rolling).
   */
  const scopeLogins = useCallback((selectedId, { includeSub = true, includeAgents = false } = {}) => {
    if (!selectedId) return null;
    const [kind, raw] = selectedId.split(':');
    const uid = Number(raw);
    if (kind === 'user') {
      const u = userById.get(uid);
      return new Set(u ? [u.loginId] : []);
    }
    const out = new Set();
    const direct = !includeSub;
    for (const u of users) if (isUnder(u, uid, { direct })) out.add(u.loginId);
    if (includeAgents) {
      const self = agentById.get(uid);
      if (self) out.add(self.loginId);
      for (const a of agents) if (isUnder(a, uid, { direct })) out.add(a.loginId);
    }
    return out;
  }, [users, agents, userById, agentById, isUnder]);

  /** Human label for a selection id. */
  const labelOf = useCallback((selectedId) => {
    if (!selectedId) return null;
    const [kind, raw] = selectedId.split(':');
    const row = kind === 'user' ? userById.get(Number(raw)) : agentById.get(Number(raw));
    return row ? `${row.name} (@${row.loginId})` : null;
  }, [userById, agentById]);

  const refresh = useCallback(
    () => Promise.all([agentsRes.refresh(), usersRes.refresh()]),
    [agentsRes.refresh, usersRes.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    agents, users, tree,
    agentById, userById, userByLogin, agentByLogin,
    ancestors, isUnder, scopeLogins, labelOf, refresh,
    error: agentsRes.error || usersRes.error,
    loading: agentsRes.loading || usersRes.loading,
    setUsers: usersRes.setData,
  };
}
