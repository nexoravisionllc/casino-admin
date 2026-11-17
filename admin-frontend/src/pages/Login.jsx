import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import { EyeIcon } from '../components/Icons.jsx';

export default function Login() {
  const { login } = useAuth();
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      {/* Purple branding panel with soft wave shapes. */}
      <div className="login__brand">
        <div className="login__logo"><Logo light /></div>
        <svg className="login__wave login__wave--1" viewBox="0 0 400 800" preserveAspectRatio="none">
          <path d="M0 120 C120 200 60 380 180 460 C300 540 220 720 360 800 L0 800 Z" />
        </svg>
        <svg className="login__wave login__wave--2" viewBox="0 0 400 800" preserveAspectRatio="none">
          <path d="M0 260 C140 320 80 500 220 560 C320 600 300 740 400 780 L0 800 Z" />
        </svg>
        <span className="login__copy">Copyright © 2026 <strong>BC-SOLUTION</strong></span>
      </div>

      {/* Form panel (Language Select removed). */}
      <div className="login__panel">
        <form className="login__form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">ID</span>
            <input
              className="field__input"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Enter your ID"
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <div className="field__pw">
              <input
                className="field__input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button type="button" className="field__eye" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password">
                <EyeIcon width={18} height={18} />
              </button>
            </div>
          </label>

          {error && <p className="login__error">{error}</p>}

          <button className="login__btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
