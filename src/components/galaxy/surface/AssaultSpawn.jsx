import { useEffect, useMemo, useRef, useState } from 'react';
import { GameIcon } from '../../../runtime/hud';
import { offersFor } from './missions/points';
import '../../../lib/bf2017/fonts.css';
import './assaultSpawn.css';

// A galactic assault's deploy card, as Star Wars Battlefront II (2017) draws
// its spawn screen (the Battlefront world's, from the game's UI data, and
// docs/superpowers/evidence/bf2017-screens/spawn.png): down the left on
// dark glass, who you may come on as (missions/points.js's offersFor: the
// four classes for nothing, then your side's enforcer and its heroes at
// their Battle Point price, in the muted ink until you've earned enough in
// this battle); beside them the posts of your side's you may come on at;
// under them your Battle Points and the keys. ↑↓ choose who, ←→ where,
// Enter goes (or a double click, or Deploy): onDeploy(offer, postId). The
// highlight starts on the class you're kept as (`kept`, a hero id), else on
// the first you can afford. `view` is the battle as the page last drew it,
// `now` the feed's latest, for the tickets and the points, which tick.

const fmt = (n) => n.toLocaleString('en-GB');
// the next in a list from where the highlight is, round the end
const around = (list, at, d) => list[(list.indexOf(at) + d + list.length) % list.length] ?? null;

export default function AssaultSpawn({ view, now, mission, kept = null, emblem = null, phaseLabel, colourOf, onDeploy, onRestart, onBack }) {
  const { sides } = mission;
  const me = view.you.side;
  const points = now.you.points ?? 0;
  const offers = useMemo(() => offersFor({ mission, side: me, points }), [mission, me, points]);
  const out = now.tickets[me] <= 0;
  const posts = view.posts.filter((p) => p.fixed === me || p.owner === me);
  const [pick, setPick] = useState(null);
  const [at, setAt] = useState(null);
  const ok = offers.filter((o) => o.affordable);
  const chosen = ok.find((o) => o.id === pick) ?? ok.find((o) => o.id === kept && o.kind === 'class') ?? ok[0] ?? null;
  const open = out ? [] : posts.filter((p) => p.can);
  const where = open.find((p) => p.id === at) ?? open[0] ?? null;
  const go = (o = chosen, p = where) => {
    if (o?.affordable && p) onDeploy(o, p.id);
  };
  // (the keys while it's up, wherever the focus is but in another dialog,
  // the mode menu or the Loadout panel over it; a button of the card's own,
  // Start over or Back, answers its Enter itself)
  const box = useRef(null);
  const keys = useRef(null);
  keys.current = (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
    if (t?.closest?.('[role="dialog"]') && !box.current?.contains(t)) return;
    if (e.key === 'Enter' && t?.closest?.('button') && !t.closest('[data-spawn-keys]')) return;
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const side = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) setPick(around(ok, chosen, step)?.id ?? null);
    else if (side) setAt(around(open, where, side)?.id ?? null);
    else if (e.key === 'Enter' && !e.repeat) go();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const on = (e) => keys.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  // (the focus follows the highlight, unless it's somewhere else on the page)
  const chosenId = chosen?.id ?? null;
  useEffect(() => {
    const el = box.current?.querySelector('.assault-spawn-cell[aria-pressed="true"]');
    const focus = document.activeElement;
    if (!el || (focus && focus !== document.body && !box.current.contains(focus))) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest' });
  }, [chosenId]);

  return (
    <div ref={box} className="assault-spawn" role="dialog" aria-label="Deploy" style={{ '--side': colourOf(me) }}>
      <div className="assault-spawn-head">
        <p className="assault-spawn-kicker">
          {emblem && <img src={emblem} alt="" width="20" height="20" />}
          {sides[me].name}
        </p>
        <h2 className="assault-spawn-title">{view.you.deaths ? 'Deploy again' : 'Deploy'}</h2>
        <p className="assault-spawn-text">
          {phaseLabel}. Reinforcements: <b style={{ color: colourOf('attack') }}>{now.tickets.attack}</b> {sides.attack.short}, <b style={{ color: colourOf('defend') }}>{now.tickets.defend}</b> {sides.defend.short}.
        </p>
        {out && <p className="assault-spawn-text">No reinforcements left: the battle goes on without you.</p>}
      </div>
      <div className="assault-spawn-cols" data-spawn-keys="">
        <ul className="assault-spawn-list" aria-label="Who to deploy as">
          {offers.map((o) => (
            <li key={o.id}>
              <button type="button" className="assault-spawn-cell" data-kind={o.kind} aria-pressed={o.id === chosenId} aria-disabled={!o.affordable || undefined} onClick={() => o.affordable && setPick(o.id)} onDoubleClick={() => go(o)}>
                {o.icon ? <img src={o.icon} alt="" width="40" height="40" /> : <GameIcon name={o.gameIcon} className="assault-spawn-icon" />}
                <span className="assault-spawn-name">{o.name}</span>
                <span className="assault-spawn-cost">{o.cost ? fmt(o.cost) : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="assault-posts assault-spawn-where" aria-label="Where to deploy">
          {posts.map((p) => (
            <li key={p.id}>
              <button type="button" className="assault-post" aria-pressed={p.id === where?.id} disabled={!p.can || out} onClick={() => setAt(p.id)} onDoubleClick={() => go(chosen, p)} style={{ '--side': colourOf(p.owner) }}>
                <i>{p.letter || '◆'}</i>
                <b>{p.name}</b>
                <span>{p.fixed ? 'Yours to hold' : !p.live ? 'Behind the line' : p.can ? 'Held' : 'Under attack'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="assault-spawn-foot">
        <p className="assault-spawn-points">
          Battle Points <b>{fmt(points)}</b>
        </p>
        <p className="assault-spawn-keys" data-spawn-keys="">
          <span className="assault-spawn-hint">
            <kbd className="hud-cap">↑↓</kbd> Choose
          </span>
          {open.length > 1 && (
            <span className="assault-spawn-hint">
              <kbd className="hud-cap">←→</kbd> Where
            </span>
          )}
          <button type="button" className="assault-spawn-go" disabled={!chosen || !where} onClick={() => go()}>
            <kbd className="hud-cap">Enter</kbd> Deploy
          </button>
        </p>
        <div className="assault-spawn-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRestart}>
            Start over
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            Back to the system
          </button>
        </div>
      </div>
    </div>
  );
}
