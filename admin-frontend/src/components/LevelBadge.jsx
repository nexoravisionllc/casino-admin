// Each depth/role is shown as a letter inside a colored circle:
// role 1 -> A, 2 -> B, 3 -> C ... Each letter gets its own color so the level
// is recognizable at a glance.
const LEVEL_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#e8a33d', '#e0655f',
  '#ec4899', '#0ea5e9', '#f97316', '#6366f1', '#14b8a6',
];

export const levelLetter = (role) => String.fromCharCode(65 + ((Math.max(1, role) - 1) % 26));
export const levelColor = (role) => LEVEL_COLORS[(Math.max(1, role) - 1) % LEVEL_COLORS.length];

export function LevelBadge({ role }) {
  return (
    <span className="lvl-circle" style={{ background: levelColor(role) }}>
      {levelLetter(role)}
    </span>
  );
}
