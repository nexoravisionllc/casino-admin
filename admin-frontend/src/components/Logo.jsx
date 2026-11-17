// BC-Solution wordmark: the BC logo mark, "Solution" and an ADMIN tag.
export default function Logo({ size, tag = true }) {
  return (
    <span className={`logo ${size ? `logo--${size}` : ''}`}>
      <img className="logo__mark" src="/logo-small.png" alt="BC" />
      <span className="logo__text">BC Solution</span>
      {tag && <span className="logo__tag">ADMIN</span>}
    </span>
  );
}
