import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside.js';
import { CheckIcon, ChevronDownIcon } from './Icons.jsx';

/**
 * Checkbox dropdown. `options`: [{ value, label, render? }], `selected`: Set.
 * The button summarises the choice ("All", "None", chips, or "3 selected").
 */
export default function MultiSelect({ options, selected, onChange, allLabel = 'All' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const on = options.filter((o) => selected.has(o.value));
  const toggle = (v) => {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  };

  let summary;
  if (on.length === options.length) summary = <span>{allLabel}</span>;
  else if (!on.length) summary = <span className="faint">None</span>;
  else if (on.length <= 2) summary = on.map((o) => <span key={o.value}>{o.render ?? o.label}</span>);
  else summary = <span>{on.length} selected</span>;

  return (
    <div className={`msel ${open ? 'is-open' : ''}`} ref={ref}>
      <button type="button" className="msel__btn" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="msel__value">{summary}</span>
        <ChevronDownIcon width={15} height={15} className="msel__chev" />
      </button>
      {open && (
        <div className="msel__menu" role="listbox" aria-multiselectable="true">
          {options.map((o) => {
            const isOn = selected.has(o.value);
            return (
              <button
                type="button" key={o.value} role="option" aria-selected={isOn}
                className={`msel__opt ${isOn ? 'is-on' : ''}`} onClick={() => toggle(o.value)}
              >
                <span className="msel__check">{isOn && <CheckIcon width={11} height={11} strokeWidth={3} />}</span>
                {o.render ?? o.label}
              </button>
            );
          })}
          <div className="msel__foot">
            <button type="button" onClick={() => onChange(new Set(options.map((o) => o.value)))}>Select all</button>
            <button type="button" onClick={() => onChange(new Set())}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
