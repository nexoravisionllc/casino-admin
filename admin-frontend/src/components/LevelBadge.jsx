// Each agent depth/role is a colored letter tile: role 1 -> A, 2 -> B, ...
// End users get a neutral "U" tile.
const LEVEL_COLORS = [
  '#1fa971', '#3b82f6', '#8b5cf6', '#e8a33d', '#e0655f',
  '#ec4899', '#0ea5e9', '#f97316', '#6366f1', '#14b8a6',
];

export const levelLetter = (role) => String.fromCharCode(65 + ((Math.max(1, role) - 1) % 26));
export const levelColor = (role) => LEVEL_COLORS[(Math.max(1, role) - 1) % LEVEL_COLORS.length];

export function LevelBadge({ role, size, title }) {
  return (
    <span
      className={`lvl ${size ? `lvl--${size}` : ''}`}
      style={{ background: `linear-gradient(135deg, ${levelColor(role)}, color-mix(in srgb, ${levelColor(role)} 70%, #000))` }}
      title={title ?? `Level ${levelLetter(role)}`}
    >
      {levelLetter(role)}
    </span>
  );
}

export function UserBadge({ size }) {
  return <span className={`lvl lvl--user ${size ? `lvl--${size}` : ''}`} title="Member">U</span>;
}

/** Avatar + name + @login, for agents (pass role) or users. */
export function MemberCell({ name, loginId, role, kind = role ? 'agent' : 'user' }) {
  return (
    <span className="member">
      {kind === 'agent' ? <LevelBadge role={role} /> : <UserBadge />}
      <span className="member__txt">
        <span className="member__name">{name ?? loginId}</span>
        {loginId && <span className="member__id">@{loginId}</span>}
      </span>
    </span>
  );
}

/** Root-to-parent chain of level tiles. */
export function LevelChain({ chain }) {
  if (!chain.length) return <span className="faint">—</span>;
  return (
    <span className="lvl-chain">
      {chain.map((p, i) => (
        <span key={p.uid} style={{ display: 'contents' }}>
          {i > 0 && <span className="lvl-chain__sep">›</span>}
          <LevelBadge role={p.role} size="sm" title={`${p.name} (@${p.loginId})`} />
        </span>
      ))}
    </span>
  );
}
