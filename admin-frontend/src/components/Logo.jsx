// Nexora Vision Play wordmark (same mark as the user portal) with an ADMIN tag.
export default function Logo({ size, tag = true }) {
  return (
    <span className={`logo ${size ? `logo--${size}` : ''}`}>
      <img className="logo__mark" src="/assets/logo-mark.svg" alt="" />
      <span className="logo__text">Nexora Vision Play</span>
      {tag && <span className="logo__tag">ADMIN</span>}
    </span>
  );
}
