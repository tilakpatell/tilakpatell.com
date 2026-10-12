import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { info, levelFor } from '../../lib/bf2017/ui/info';
import { loading } from '../../lib/bf2017/ui/screens';
import { Film } from '../../runtime/hud';
import { offerIcon } from './hud/icons.js';
import { offerRows } from './hud/widgets.js';
import { COIN, VARIANTS } from './waiting.js';
import './waiting.css';

// The waiting screen, in place of a flown landing (waiting.js has the
// rules and the game's numbers): the darkroom the player waits in while
// the level streams and the shaders build behind it. The choice on the
// left, as the game's spawn screen offers it: the level and the mode (the
// route's; the game's front end changes them), the day (the game's coin,
// or one of its two variants by name), the class, the reinforcements and
// the heroes at their Battle Point cost. On the right the bar fed by the
// stream and the shader builds, the machine's line, the recommendation
// the runtime's pace computes and a button to apply it, and Deploy, which
// takes only once the field is ready. A modal dialog over the whole view
// (the game's screens cover the site's bar too), put at the body's end.
//
// <WaitingScreen level mode progress={{ value, ready, line }} offers points name={(o) => text}
//   variant onVariant rolled machine recommendation canApply onApply applied onDeploy back />
export default function WaitingScreen({
  level = 'hoth',
  mode = 'galacticAssault',
  progress = { value: 0, ready: false, line: '' },
  offers = [],
  points = 0,
  name = (o) => o.id,
  variant = COIN,
  onVariant = null,
  rolled = null,
  machine = '',
  recommendation = '',
  canApply = false,
  applied = false,
  onApply = null,
  onPick = null,
  onDeploy = null,
  back = null,
}) {
  const [seed] = useState(() => Math.floor(Math.random() * 1e6));
  const l = loading(mode, level, { seed });
  const lv = levelFor(level) ?? info('level', level);
  const rows = offerRows(offers, points);
  const first = rows.find((r) => r.affordable) ?? null;
  const [picked, setPicked] = useState(first?.id ?? null);
  const chosen = rows.find((r) => r.id === picked && r.affordable) ?? first;
  const list = useRef(null);
  const ref = useRef(null);
  const tell = useRef(null);
  tell.current = () => first && onPick?.(first);
  const firstId = first?.id ?? null;
  useEffect(() => tell.current(), [firstId]);
  useEffect(() => {
    ref.current?.querySelector('button:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, []);
  const pick = (o) => {
    if (!o.affordable) return;
    setPicked(o.id);
    onPick?.(o);
  };
  const per = Math.round(Math.max(0, Math.min(1, progress.value ?? 0)) * 100);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const buttons = [...(list.current?.querySelectorAll('button') ?? [])];
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      buttons[(i + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    } else if (e.key === 'Enter' && progress.ready && chosen && e.target?.tagName !== 'A') {
      e.preventDefault();
      e.stopPropagation();
      onDeploy?.(chosen);
    }
  };
  const node = (
    <div ref={ref} className="bf-waiting" role="dialog" aria-modal="true" aria-label="Waiting to deploy" onKeyDown={onKeyDown} data-ready={progress.ready || undefined}>
      <div className="bf-waiting-backdrop" aria-hidden="true">
        {l.film ? <Film film={l.film} className="bf-waiting-film" /> : null}
      </div>
      <section className="bf-waiting-choice" aria-label="What to do">
        <p className="bf-waiting-kicker">{info('mode', mode)?.title ?? mode}</p>
        <h2 className="bf-waiting-level">{lv?.title ?? level}</h2>
        <p className="bf-waiting-change">
          <Link className="link" to="/battlefront">
            Change the level or the mode
          </Link>
        </p>
        <h3 className="bf-waiting-head">The day</h3>
        <ul className="bf-waiting-days" role="radiogroup" aria-label="The day">
          {[{ id: COIN, name: 'As the game would' }, ...VARIANTS].map((v) => (
            <li key={v.id}>
              <button type="button" role="radio" className="bf-waiting-day" aria-checked={variant === v.id} data-day={v.id} onClick={() => onVariant?.(v.id)}>
                <span>{v.name}</span>
                <span className="bf-waiting-day-odds">{v.id === COIN ? (rolled ? `the coin said ${VARIANTS.find((x) => x.id === rolled)?.name.toLowerCase() ?? rolled}` : 'the coin: 70 sunset, 30 clear') : `${v.weight} in 100`}</span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="bf-waiting-head">Deploy as</h3>
        <ul ref={list} className="bf-waiting-list">
          {rows.map((o) => (
            <li key={`${o.kind}:${o.id}`}>
              <button type="button" className="bf-waiting-cell" data-kind={o.kind} aria-pressed={chosen?.id === o.id} aria-disabled={!o.affordable || undefined} onFocus={() => pick(o)} onClick={() => pick(o)}>
                <img src={offerIcon(o)} alt="" width="40" height="40" />
                <span className="bf-waiting-name">{name(o)}</span>
                <span className="bf-num">{o.cost ? o.cost.toLocaleString('en-GB') : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="bf-waiting-points">
          Battle Points <span className="bf-num">{points.toLocaleString('en-GB')}</span>
        </p>
      </section>
      <section className="bf-waiting-card" aria-label="Loading">
        <p className="bf-waiting-hint">{l.hint ?? ''}</p>
        <div className="bf-waiting-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={per} aria-label="Loading">
          <i style={{ width: `${per}%` }} />
        </div>
        <p className="bf-waiting-line" role="status">
          {progress.line} · {per} per cent
        </p>
        <p className="bf-waiting-machine">{machine}</p>
        <p className="bf-waiting-recommend">
          <span>{recommendation}</span>
          {onApply && (
            <button type="button" className="hud-btn bf-waiting-apply" onClick={onApply} disabled={!canApply || applied} aria-disabled={!canApply || applied || undefined}>
              {applied ? 'Applied' : 'Apply'}
            </button>
          )}
        </p>
        <button type="button" className="bf-waiting-deploy" data-deploy="" disabled={!progress.ready || !chosen} onClick={() => progress.ready && chosen && onDeploy?.(chosen)}>
          {progress.ready ? 'Deploy' : 'Loading'}
        </button>
        {back && (
          <Link className="link bf-waiting-back" to={back.to}>
            {back.label}
          </Link>
        )}
      </section>
      <p className="bf-waiting-keys">
        <span>
          <kbd className="hud-cap">↑↓</kbd> Choose
        </span>
        <span>
          <kbd className="hud-cap">Enter</kbd> Deploy
        </span>
      </p>
    </div>
  );
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

// The game's wipe (waiting.js's WIPE): black over everything, in over
// 0.3 s after 0.05 s, out over 0.4 s; `phase` 'down' | 'up' | null
export function Wipe({ phase = null }) {
  if (!phase) return null;
  const node = <div className="bf-wipe" data-wipe={phase} aria-hidden="true" />;
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}
