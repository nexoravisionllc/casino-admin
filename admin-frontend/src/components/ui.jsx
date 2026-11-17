import { AlertIcon, CloseIcon, InboxIcon, SearchIcon, ArrowUpIcon, ArrowDownIcon } from './Icons.jsx';
import { usd, pts } from '../lib/format.js';

export function PageHeader({ crumb, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumb && <div className="page-head__crumb">{crumb}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = 'card__body' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__head">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__sub">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {bodyClass ? <div className={bodyClass}>{children}</div> : children}
    </section>
  );
}

export function Badge({ tone, dot, children }) {
  return <span className={`badge ${tone ? `badge--${tone}` : ''} ${dot ? 'badge--dot' : ''}`}>{children}</span>;
}

const STATUS_TONES = {
  pending: 'orange', finished: 'green', rejected: 'red', restored: 'violet',
  active: 'green', normal: 'green', inactive: 'red', waiting: 'orange', blocked: 'red',
};
export function StatusBadge({ status }) {
  const s = String(status ?? '').toLowerCase() || 'normal';
  return <Badge tone={STATUS_TONES[s] ?? undefined} dot>{s}</Badge>;
}

const TYPE_TONES = {
  deposit: 'green', withdraw: 'orange', payment: 'blue', collect: 'violet',
  'point-convert': 'gold', 'coin-deposit': 'green', 'rolling payment': 'blue', 'rolling collect': 'violet',
};
export function TypeBadge({ type, label }) {
  return <Badge tone={TYPE_TONES[String(type ?? '').toLowerCase()]}>{label ?? type}</Badge>;
}

export function Alert({ children, tone, action }) {
  return (
    <div className={`alert ${tone === 'ok' ? 'alert--ok' : ''}`} role="alert">
      <AlertIcon width={16} height={16} />
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Empty({ title = 'No data', text, icon: Icon = InboxIcon }) {
  return (
    <div className="empty">
      <span className="empty__ico"><Icon width={22} height={22} /></span>
      <span className="empty__title">{title}</span>
      {text && <span className="empty__text">{text}</span>}
    </div>
  );
}

/** Table body row that spans all columns, for empty / loading states. */
export function TableEmpty({ cols, loading, title, text }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: 0 }}>
        {loading
          ? <div style={{ padding: 18, display: 'grid', gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 22 }} />)}</div>
          : <Empty title={title} text={text} />}
      </td>
    </tr>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className = '', autoFocus }) {
  return (
    <div className={`search ${className}`}>
      <SearchIcon width={16} height={16} />
      <input
        className="input" value={value} placeholder={placeholder} autoComplete="off" autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange(''); } }}
      />
      {value && (
        <button type="button" className="search__clear" onClick={() => onChange('')} aria-label="Clear search">
          <CloseIcon width={14} height={14} />
        </button>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  const btn = (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={typeof label === 'string' ? label : undefined}
      className={`switch ${checked ? 'is-on' : ''}`} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    />
  );
  if (!label) return btn;
  return (
    <span className="switch-label" onClick={() => !disabled && onChange(!checked)}>
      {btn}{label}
    </span>
  );
}

export function Field({ label, hint, hintTone, children, full }) {
  return (
    <label className={`field ${full ? 'field--full' : ''}`}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {hint && <span className={`field__hint ${hintTone ? `field__hint--${hintTone}` : ''}`}>{hint}</span>}
    </label>
  );
}

/** Balance + point stacked lines. */
export function Wallet({ balance, point }) {
  return (
    <div className="stack">
      <span className="coinline"><span className="coin coin--usd">$</span>{usd(balance).replace('$', '')}</span>
      <span className="coinline"><span className="coin coin--pt">P</span>{pts(point).replace(' P', '')}</span>
    </div>
  );
}

export function Delta({ value }) {
  if (value == null) return <span className="delta delta--up">New</span>;
  const v = Number(value);
  if (Math.abs(v) < 0.05) return <span className="delta delta--flat">0%</span>;
  const up = v > 0;
  return (
    <span className={`delta ${up ? 'delta--up' : 'delta--down'}`}>
      {up ? <ArrowUpIcon width={11} height={11} /> : <ArrowDownIcon width={11} height={11} />}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

export function Stat({ label, value, icon: Icon, tone, foot, small, hero, onClick, action }) {
  return (
    <div
      className={`stat ${hero ? 'stat--hero' : ''} ${onClick ? 'stat--link' : ''}`}
      onClick={onClick} role={onClick ? 'link' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {action}
        {Icon && <span className={`stat__ico ${tone ? `stat__ico--${tone}` : ''}`}><Icon width={18} height={18} /></span>}
      </div>
      <div className={`stat__value ${small ? 'stat__value--sm' : ''}`}>{value}</div>
      {foot && <div className="stat__foot">{foot}</div>}
    </div>
  );
}

export const Spinner = () => <span className="spin" aria-hidden="true" />;
