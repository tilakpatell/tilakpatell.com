import { useId } from 'react';

// The settings panel's parts (Settings.jsx and Video.jsx draw with these and
// nothing else: one drawing per concept, docs/health/RULES.md UI 3): a
// segmented control (a radiogroup of pills), a slider with its readout, and
// a row with a title and a one-sentence hint.

export function Segmented({ label, value, options, onChange, describedBy, disabled = false }) {
  return (
    <div className="settings-seg" role="radiogroup" aria-label={label} aria-describedby={describedBy} aria-disabled={disabled || undefined}>
      {options.map(([v, text, off = false, why = null]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className="settings-seg-btn" disabled={disabled || off} title={why ?? undefined} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min = 0, max = 1, step = 0.05, onChange, show = (v) => `${Math.round(v * 100)}%`, disabled }) {
  const id = useId();
  return (
    <div className="settings-slider">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{show(value)}</output>
    </div>
  );
}

export function Row({ title, hint, children, id, badge = null }) {
  return (
    <div className="settings-row">
      <div className="settings-row-head">
        <p className="settings-row-title">
          {title}
          {badge && <span className="chip settings-badge">{badge}</span>}
        </p>
        {hint && (
          <p className="settings-row-hint" id={id}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
