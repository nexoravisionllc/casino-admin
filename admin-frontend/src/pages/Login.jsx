import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Logo from '../components/Logo.jsx';
import { Alert, Spinner } from '../components/ui.jsx';
import { EyeIcon, EyeOffIcon, NetworkIcon, WalletIcon, BoltIcon, MoonIcon, SunIcon } from '../components/Icons.jsx';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginId.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <button className="icon-btn login__theme" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
        {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
      </button>

      <div className="login__card">
        <div className="login__promo">
          <span className="login__rings" />
          <Logo size="lg" tag={false} />
          <div className="login__headline">
            <h2>Admin &amp; Agent<br />Control Center</h2>
            <p>Manage your agent network, members, money flow and games from one place.</p>
          </div>
          <ul className="login__features">
            <li><span><NetworkIcon width={16} height={16} /></span>Multi-level agent hierarchy &amp; commissions</li>
            <li><span><WalletIcon width={16} height={16} /></span>Deposits, withdrawals and balance control</li>
            <li><span><BoltIcon width={16} height={16} /></span>Real-time updates across every page</li>
          </ul>
          <span className="login__copy">© {new Date().getFullYear()} BC-SOLUTION. All rights reserved.</span>
        </div>

        <div className="login__body">
          <div className="login__mobile-logo"><Logo /></div>
          <div>
            <h1>Sign in</h1>
            <p>Use your admin or agent account to continue.</p>
          </div>

          <form className="login__form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Login ID</span>
              <input
                className="input input--lg" type="text" value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter your ID" autoComplete="username" autoFocus required
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <div className="field__pw">
                <input
                  className="input input--lg" type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" autoComplete="current-password" required
                />
                <button type="button" className="field__eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
                </button>
              </div>
            </label>

            {error && <Alert>{error}</Alert>}

            <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
              {loading && <Spinner />}{loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login__note">Accounts are created by your upline agent. Contact them if you can’t sign in.</p>
        </div>
      </div>
    </div>
  );
}
