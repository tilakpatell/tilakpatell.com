import { useCallback, useEffect, useRef, useState } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import '@fontsource/luckiest-guy/400.css';
import { useFrameLoop, useMediaQuery } from '../../../../lib/hooks';
import { readPad } from '../../../games/pad';
import { SAY } from '../say';
import { CABINETS, TUNING, newCabinet, stepCabinet } from './cabinet';
import { drawn, keyFor } from './cabinetPlay';
import './cabinet.css';

// A walkway cabinet at Blips and Chitz, played: Plumbus Smash on the
// cabinet's screen, over the page as Roy and the sewer are. The rules are
// ./cabinet.js, stepped at a fixed 1/60 s with the presses since the last
// step; this draws the three chutes in the DOM, no WebGL.
//
// <Cabinet game="cabinet2" onWin={() => …} onLeave={() => …} /> fills its
// parent (the world's overlay): onWin once a run, the moment the target's
// beaten; onLeave from every way out. It owns Esc: a pause while playing,
// the way out otherwise (./cabinetPlay.js). Each frame moves the plumbuses'
// own elements; React draws again only when what it draws changes.

const STEP = 1 / 60;
const MAX_STEPS = 6;
const SETTLE_MS = 600; // an end card ignores keys, a pad and taps this long
const SIDES = ['left', 'middle', 'right'];
const score = (n) => n.toLocaleString('en-GB');
const sfx = () => import('../../../../lib/sfx');
const play = (name) => sfx().then((s) => s[name]?.(), () => {});
const cheer = () => import('../../../games/gameAudio').then((g) => g.plumbus?.(), () => {});
const seed = () => 1 + Math.floor(Math.random() * 1e6);
const top = (y) => `calc(${(y * 100).toFixed(2)}% - 26px)`;

// the plumbus, as the factory draws one: the dinglebop's pink, a grumbo below
function Plumbus({ y, ref }) {
  return (
    <svg ref={ref} className="cabinet-plumbus" viewBox="0 0 40 52" style={{ top: top(y) }} aria-hidden="true">
      <path d="M12 6 C4 10 4 26 14 28 C10 34 12 40 16 46 H24 C28 40 30 34 26 28 C36 26 36 10 28 6 C24 2 16 2 12 6 Z" fill="#ff8fb4" stroke="#1b1424" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="20" cy="15" r="4" fill="#ffd0e0" stroke="#1b1424" strokeWidth="2" />
    </svg>
  );
}

export default function Cabinet({ game = 'cabinet2', onWin, onLeave }) {
  const cab = CABINETS[game];
  const line = SAY[game]?.text;
  const touch = useMediaQuery('(pointer: coarse)');
  const run = useRef(null);
  run.current ??= newCabinet({ game, seed: seed() });
  const [view, setView] = useState(run.current);
  const [phase, setPhase] = useState('intro'); // intro | play | paused | won | lost
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const presses = useRef([]);
  const acc = useRef(0);
  const told = useRef(false);
  const [settled, setSettled] = useState(true);
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const dropEls = useRef(new Map()); // a plumbus's id → its element
  const shown = useRef(drawn(run.current));
  const padWas = useRef({});
  const won = useRef(onWin);
  won.current = onWin;

  const leave = useCallback(() => onLeave?.(), [onLeave]);
  const start = useCallback(() => setPhase('play'), []);
  const again = useCallback(() => {
    run.current = newCabinet({ game, seed: seed() });
    presses.current = [];
    acc.current = 0;
    told.current = false;
    shown.current = drawn(run.current);
    setView(run.current);
    setPhase('play');
  }, [game]);

  // where each plumbus is, straight to its element; the rest only when it changes
  const draw = useCallback((g) => {
    for (const d of g.drops) {
      const el = dropEls.current.get(d.id);
      if (el) el.style.top = top(d.y);
    }
    const now = drawn(g);
    if (now !== shown.current) {
      shown.current = now;
      setView(g);
    }
  }, []);

  // steps with these presses, and what they did: sounds, the win told once, the end
  const advance = useCallback((steps) => {
    let g = run.current;
    for (const input of steps) {
      g = stepCabinet(g, input, STEP);
      for (const e of g.events) {
        if (e.type === 'smash') play('coin');
        else if (e.type === 'whiff') play('knock');
        else if (e.type === 'miss') play('clang');
        else if (e.type === 'won') {
          cheer();
          if (!told.current) {
            told.current = true;
            won.current?.();
          }
        }
      }
    }
    run.current = g;
    draw(g);
    if (g.phase !== 'play') {
      settledRef.current = false;
      setSettled(false);
      setView(g);
      setPhase(g.phase);
    }
  }, [draw]);
  // an end card, settled
  useEffect(() => {
    if (settled) return undefined;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settled]);

  // the keys: Esc and P pause, Esc leaves from a card, the chutes smash
  useEffect(() => {
    const down = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const act = keyFor(phaseRef.current, e.key, !settledRef.current);
      if (act == null) return;
      e.preventDefault();
      if (act === 'pause') setPhase('paused');
      else if (act === 'play') setPhase('play');
      else if (act === 'leave') leave();
      else if (act.smash != null && !e.repeat) presses.current.push(act.smash);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [leave]);
  // hidden, it pauses
  useEffect(() => {
    const hide = () => document.hidden && phaseRef.current === 'play' && setPhase('paused');
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);

  // the frame: a controller's presses on their edges, then the fixed steps
  const tick = useCallback(
    (ms) => {
      const pad = readPad();
      const was = padWas.current;
      padWas.current = pad ?? {};
      const edge = (k) => pad?.[k] && !was[k];
      const p = phaseRef.current;
      if (p === 'intro') {
        if (edge('a')) start();
        else if (edge('b')) leave();
        return;
      }
      if (p === 'won' || p === 'lost') {
        if (!settledRef.current) return;
        if (edge('a')) again();
        else if (edge('b')) leave();
        return;
      }
      if (edge('start')) setPhase(p === 'play' ? 'paused' : 'play');
      if (p !== 'play') return;
      ['left', 'down', 'right'].forEach((k, lane) => edge(k) && presses.current.push(lane));
      acc.current += Math.min(0.1, ms / 1000);
      const steps = [];
      while (acc.current >= STEP && steps.length < MAX_STEPS) {
        // (one press a step: the rules smash one chute at a time)
        const lane = presses.current.shift();
        steps.push(lane == null ? {} : { smash: lane });
        acc.current -= STEP;
      }
      if (steps.length) advance(steps);
    },
    [advance, again, leave, start],
  );
  useFrameLoop(tick, true);

  // (the checks drive it: rm-story-check.mjs)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__CABINET__ = {
      get state() {
        return run.current;
      },
      get phase() {
        return phaseRef.current;
      },
      set(g) {
        run.current = g;
        shown.current = drawn(g);
        setView(g);
      },
      step: (input = {}) => advance([input]),
    };
    return () => {
      delete window.__CABINET__;
    };
  }, [advance]);

  const smash = (lane) => phaseRef.current === 'play' && presses.current.push(lane);
  const lives = Array.from({ length: TUNING.lives }, (_, i) => i < view.lives);
  return (
    <div className="cabinet" role="group" aria-label={cab.name} data-owns-escape="" data-phase={phase}>
      <button type="button" className="btn btn-ghost btn-sm cabinet-leave" onClick={leave}>
        <RiCloseLine aria-hidden="true" /> Leave
      </button>
      <div className="cabinet-screen" data-stuck={view.stuck > 0 || undefined}>
        <div className="cabinet-hud" aria-live="polite">
          <span>
            Score <b>{score(view.score)}</b>
          </span>
          <span>High score {score(view.target - 1)}</span>
          <span className="cabinet-lives" aria-label={`${view.lives} of ${TUNING.lives} lives`}>
            {lives.map((on, i) => (
              <span key={i} data-off={!on || undefined}>
                ♥
              </span>
            ))}
          </span>
        </div>
        <div className="cabinet-chutes">
          {SIDES.map((side, lane) => (
            <button key={side} type="button" tabIndex={-1} className="cabinet-chute" aria-label={`Smash the ${side} chute`} onPointerDown={() => smash(lane)}>
              <span className="cabinet-reach" style={{ top: `${TUNING.reach * 100}%` }} aria-hidden="true" />
              {view.drops
                .filter((d) => d.lane === lane)
                .map((d) => (
                  <Plumbus
                    key={d.id}
                    y={d.y}
                    ref={(el) => {
                      dropEls.current.set(d.id, el);
                      return () => dropEls.current.delete(d.id);
                    }}
                  />
                ))}
            </button>
          ))}
        </div>
        {view.stuck > 0 && <p className="cabinet-stuck">The stick’s stuck</p>}
      </div>
      {phase === 'intro' && (
        <div className="cabinet-card">
          <div>
            <h2>{cab.name}</h2>
            {line && <p className="cabinet-colour">{line}</p>}
            <p>Rick’s bet: beat {score(view.target - 1)}.</p>
            <p>Smash each plumbus at the foot of its chute. A swing at an empty chute sticks the stick, and three that get past are the game.</p>
            <p className="cabinet-keys">
              {touch ? (
                'Tap a chute to smash it.'
              ) : (
                <>
                  <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> smash a chute · <kbd>P</kbd> or <kbd>Esc</kbd> pauses
                </>
              )}
            </p>
            {/* (the first focus is Start, so Enter and Space start rather than leave) */}
            <button type="button" className="btn btn-primary" onClick={start} autoFocus>
              Start
            </button>
            <button type="button" className="btn btn-ghost" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      )}
      {phase === 'paused' && (
        <div className="cabinet-card">
          <div>
            <h2>Paused</h2>
            <button type="button" className="btn btn-primary" onClick={start} autoFocus>
              Play on
            </button>
            <button type="button" className="btn btn-ghost" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      )}
      {(phase === 'won' || phase === 'lost') && (
        <div className="cabinet-card" data-settling={!settled || undefined}>
          <div>
            <h2>{phase === 'won' ? 'High score' : cab.name}</h2>
            <p>{phase === 'won' ? `${score(view.score)}. Rick’s bet is good.` : `Game over at ${score(view.score)}.`}</p>
            {phase === 'won' ? (
              <>
                <button type="button" className="btn btn-primary" onClick={leave} autoFocus>
                  Leave
                </button>
                <button type="button" className="btn btn-ghost" onClick={again}>
                  Again
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={again} autoFocus>
                  Again
                </button>
                <button type="button" className="btn btn-ghost" onClick={leave}>
                  Leave
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
