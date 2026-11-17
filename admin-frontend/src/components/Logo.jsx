// BC-Solution wordmark: the BC logo mark followed by "Solution".
export default function Logo({ light = false }) {
  return (
    <span className={`logo ${light ? 'logo--light' : ''}`}>
      <img className="logo__mark" src="/logo-small.png" alt="BC" />
      <span className="logo__text">Solution</span>
    </span>
  );
}
