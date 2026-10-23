import { useEffect, useId, useRef } from 'react';
import { AD, CONTROLS, DEFAULTS, DIFFICULTIES, DRAG_UP } from './controls';
import { DIFFICULTY } from './difficulty';

// The flying settings (controls.js), from the button in the map's corner
// (or O): how quickly the ship turns, pitches and rolls, how quickly it
// rolls back upright, how far a drag goes for full stick, how much the guns
// help a shot home, how much the nose follows a lock, how tightly the camera follows, up and down turned
// over, what A and D do, what dragging up and down does, and how hard the
// fight is (difficulty.js).
// Every change is live (the scene reads them each frame) and kept between
// visits by the page. Not modal: the map stays flyable behind it; Escape,
// the close button or a click on the map puts it away.
const ORDER = ['turn', 'pitch', 'roll', 'level', 'drag', 'assist', 'track', 'camera'];
const DRAG_LABEL = { auto: 'Auto', pitch: 'Nose', speed: 'Throttle' };
const DRAG_HINT = { auto: 'Mouse tips the nose, touch works the throttle', pitch: 'Up and down tips the nose', speed: 'Up and down works the throttle' };
const AD_LABEL = { roll: 'Roll', turn: 'Turn' };
const AD_HINT = { roll: 'As in Battlefront: roll over, then pull the nose round', turn: 'Swing the nose left and right, like the arrows' };
const pct = (k, v) => ((k === 'assist' || k === 'track' || k === 'level') && v === 0 ? 'Off' : `${Math.round(v * 100)}%`);

export default function FlightSettings({ controls, onChange, open, onOpen }) {
  const id = useId();
  const panel = useRef(null);
  const button = useRef(null);
  const set = (patch) => onChange({ ...controls, ...patch });

  // O opens and closes it; Escape closes it (before the page's own Escape,
  // which would leave the selected place)
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpen(false);
        button.current?.focus({ preventScroll: true });
      } else if (e.key.toLowerCase() === 'o' && !typing && !document.querySelector('[aria-modal="true"]')) {
        e.preventDefault();
        onOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onOpen]);

  // a press anywhere else puts it away
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panel.current?.contains(e.target) || button.current?.contains(e.target)) return;
      onOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open, onOpen]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="universe-settings-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Flight settings"
        title="Flight settings (O)"
        aria-keyshortcuts="O"
        onClick={() => onOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="15" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {open && (
        <section ref={panel} id={id} className="universe-settings dialog overflow-y-auto" role="dialog" aria-label="Flight settings">
          <header className="universe-settings-head">
            <h2>Flight settings</h2>
            <button type="button" className="universe-settings-close" aria-label="Close" onClick={() => onOpen(false)}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <fieldset className="universe-setting">
            <legend className="universe-setting-name">Difficulty</legend>
            <span className="universe-seg universe-seg-4">
              {DIFFICULTIES.map((m) => (
                <button key={m} type="button" aria-pressed={controls.difficulty === m} onClick={() => set({ difficulty: m })}>
                  {DIFFICULTY[m].label}
                </button>
              ))}
            </span>
            <span className="universe-setting-hint">{DIFFICULTY[controls.difficulty]?.hint}</span>
          </fieldset>
          {ORDER.map((k) => {
            const r = CONTROLS[k];
            const v = controls[k];
            return (
              <label key={k} className="universe-setting">
                <span className="universe-setting-top">
                  <span className="universe-setting-name">{r.label}</span>
                  <output className="universe-setting-value">{pct(k, v)}</output>
                </span>
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={v}
                  style={{ '--fill': `${((v - r.min) / (r.max - r.min)) * 100}%` }}
                  onChange={(e) => set({ [k]: Number(e.target.value) })}
                  aria-describedby={`${id}-${k}`}
                />
                <span id={`${id}-${k}`} className="universe-setting-hint">
                  {r.hint}
                </span>
              </label>
            );
          })}
          <label className="universe-setting universe-setting-row">
            <span className="universe-setting-name">Invert up and down</span>
            <input type="checkbox" role="switch" checked={controls.invert} onChange={(e) => set({ invert: e.target.checked })} />
          </label>
          <fieldset className="universe-setting">
            <legend className="universe-setting-name">A and D</legend>
            <span className="universe-seg">
              {AD.map((m) => (
                <button key={m} type="button" aria-pressed={controls.ad === m} onClick={() => set({ ad: m })}>
                  {AD_LABEL[m]}
                </button>
              ))}
            </span>
            <span className="universe-setting-hint">{AD_HINT[controls.ad]}</span>
          </fieldset>
          <fieldset className="universe-setting">
            <legend className="universe-setting-name">Drag up and down</legend>
            <span className="universe-seg">
              {DRAG_UP.map((m) => (
                <button key={m} type="button" aria-pressed={controls.dragUp === m} onClick={() => set({ dragUp: m })}>
                  {DRAG_LABEL[m]}
                </button>
              ))}
            </span>
            <span className="universe-setting-hint">{DRAG_HINT[controls.dragUp]}</span>
          </fieldset>
          <button type="button" className="universe-settings-reset" onClick={() => onChange({ ...DEFAULTS })}>
            Reset all
          </button>
        </section>
      )}
    </>
  );
}
