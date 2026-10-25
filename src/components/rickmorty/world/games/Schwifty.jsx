import { useCallback, useEffect, useRef, useState } from 'react';
import { RiCloseLine, RiPauseLine } from 'react-icons/ri';
import '@fontsource/luckiest-guy/400.css';
import { useFrameLoop, useMediaQuery, useReducedMotion } from '../../../../lib/hooks';
import { readPad } from '../../../games/pad';
import { SAY } from '../say';
import { LANES, inView, newRhythm, stepRhythm } from './rhythm';
import { drawn, keyFor, padEdges, padFor, padLanes } from './schwiftyPlay';
import './schwifty.css';

// Get Schwifty, played at the mic: the song's four lanes over the page, as
// the walkway cabinet's chutes are, under the heads' meter. The rules are
// ./rhythm.js, stepped at a fixed 1/60 s, one press a step (presses queue,
// each judged on its own); this draws the lanes in the DOM, no WebGL.
//
// <Schwifty onWin={() => …} onLeave={() => …} /> fills its parent (the
// world's overlay): onWin once a run, the moment the song's won; onLeave from
// every way out. It owns Esc: a pause while playing, the way out otherwise
// (./schwiftyPlay.js). Each frame moves the notes' own elements and the
// heads' meter; React draws again only when what it draws changes. A loss is
// played again from its own card.

const STEP = 1 / 60;
const MAX_STEPS = 6;
const SETTLE_MS = 600; // an end card ignores keys, a pad and taps this long
const FLASH_MS = 140;
const NAMES = ['first', 'second', 'third', 'fourth'];
const GRADE = { great: 'Great', good: 'Good', miss: 'Miss', whiff: 'Off the beat' };
const sfx = () => import('../../../../lib/sfx');
const play = (name) => sfx().then((s) => s[name]?.(), () => {});
const synth = (name, ...a) => import('../../../games/gameAudio').then((g) => g[name]?.(...a), () => {});
const clip = (id) => import('../../../../lib/clips').then((c) => c.playClip(id), () => {});
// a note's place down its lane: y 0 at the top, 1 on the line (36 px above the lane's foot)
const top = (y) => `calc((100% - 36px) * ${y.toFixed(4)} - 12px)`;

// the corner: Leave, in every phase, and on a touch screen while the song
// plays Pause beside it (a keyboard has Esc and P, a controller Start)
export function Corner({ phase, touch, onPause, onLeave }) {
  return (
    <div className="schwifty-corner">
      {touch && phase === 'play' && (
        <button type="button" className="btn btn-ghost btn-sm schwifty-pause" onClick={onPause}>
          <RiPauseLine aria-hidden="true" /> Pause
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-sm schwifty-leave" onClick={onLeave}>
        <RiCloseLine aria-hidden="true" /> Leave
      </button>
    </div>
  );
}

export default function Schwifty({ onWin, onLeave }) {
  const line = SAY.mic?.text;
  const touch = useMediaQuery('(pointer: coarse)');
  const calm = useReducedMotion();
  const run = useRef(null);
  run.current ??= newRhythm();
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
  const noteEls = useRef(new Map()); // a note's id → its element
  const laneEls = useRef([]);
  const fill = useRef(null);
  const meter = useRef(null);
  const grade = useRef(null);
  const shown = useRef(drawn(run.current));
  const padWas = useRef(null); // (null till the first frame: a button already down then is no press)
  const won = useRef(onWin);
  won.current = onWin;

  const leave = useCallback(() => onLeave?.(), [onLeave]);
  const pause = useCallback(() => phaseRef.current === 'play' && setPhase('paused'), []);
  const start = useCallback(() => {
    if (phaseRef.current === 'intro') clip('showMe');
    setPhase('play');
  }, []);
  const again = useCallback(() => {
    run.current = newRhythm();
    presses.current = [];
    acc.current = 0;
    told.current = false;
    shown.current = drawn(run.current);
    if (grade.current) grade.current.textContent = '';
    setView(run.current);
    setPhase('play');
    clip('showMe');
  }, []);

  // where each note is down its lane and how the heads feel, straight to their elements; the rest only when it changes
  const draw = useCallback((g) => {
    for (const n of inView(g)) {
      const el = noteEls.current.get(n.id);
      if (el) el.style.top = top(n.y);
    }
    if (fill.current) fill.current.style.width = `${(g.heads * 100).toFixed(1)}%`;
    if (meter.current) {
      meter.current.setAttribute('aria-valuenow', String(Math.round(g.heads * 100)));
      if (g.heads < 0.25) meter.current.dataset.low = '';
      else delete meter.current.dataset.low;
    }
    const now = drawn(g);
    if (now !== shown.current) {
      shown.current = now;
      setView(g);
    }
  }, []);

  // a lane lit for a moment by a hit (not under reduced motion), and the grade said
  const flash = useCallback(
    (lane, what) => {
      if (grade.current) grade.current.textContent = GRADE[what] ?? '';
      const el = laneEls.current[lane];
      if (!el || calm) return;
      el.dataset.flash = what;
      setTimeout(() => el.dataset.flash === what && delete el.dataset.flash, FLASH_MS);
    },
    [calm],
  );

  // steps with these presses, and what they did: the notes and the kick, the win told once, the end
  const advance = useCallback(
    (steps) => {
      let g = run.current;
      for (const input of steps) {
        g = stepRhythm(g, input, STEP);
        for (const e of g.events) {
          if (e.type === 'beat') synth('kick');
          else if (e.type === 'hit') {
            synth('schwiftyNote', e.lane);
            flash(e.lane, e.grade);
          } else if (e.type === 'whiff') {
            play('knock');
            flash(e.lane, 'whiff');
          } else if (e.type === 'miss') {
            play('clang');
            flash(e.lane, 'miss');
          } else if (e.type === 'won') {
            clip('likeWhatYouGot');
            if (!told.current) {
              told.current = true;
              won.current?.();
            }
          } else if (e.type === 'lost') clip('disqualified');
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
    },
    [draw, flash],
  );
  // an end card, settled
  useEffect(() => {
    if (settled) return undefined;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settled]);

  // the keys: Esc and P pause, Esc leaves from a card, the lanes hit
  useEffect(() => {
    const down = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const act = keyFor(phaseRef.current, e.key, !settledRef.current, e.repeat);
      if (act == null) return;
      e.preventDefault();
      if (act === 'pause') setPhase('paused');
      else if (act === 'play') setPhase('play');
      else if (act === 'leave') leave();
      else if (act.hit != null) presses.current.push(act.hit);
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
      const pressed = padEdges(pad, padWas.current);
      padWas.current = pad ?? {};
      const p = phaseRef.current;
      const act = padFor(p, pressed, !settledRef.current);
      if (act === 'start') start();
      else if (act === 'again') again();
      else if (act === 'leave') leave();
      else if (act === 'pause') setPhase('paused');
      else if (act === 'play') setPhase('play');
      if (p !== 'play' || act === 'pause') return;
      presses.current.push(...padLanes(pressed));
      acc.current += Math.min(0.1, ms / 1000);
      const steps = [];
      while (acc.current >= STEP && steps.length < MAX_STEPS) {
        // (one press a step: each judged on its own)
        const lane = presses.current.shift();
        steps.push(lane == null ? {} : { hit: lane });
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
    window.__SCHWIFTY__ = {
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
      delete window.__SCHWIFTY__;
    };
  }, [advance]);

  const hit = (lane) => phaseRef.current === 'play' && presses.current.push(lane);
  const coming = inView(view);
  return (
    <div className="schwifty" role="group" aria-label="Get Schwifty" data-owns-escape="" data-phase={phase} data-calm={calm || undefined}>
      <Corner phase={phase} touch={touch} onPause={pause} onLeave={leave} />
      <div className="schwifty-stage">
        <div className="schwifty-hud">
          <span className="schwifty-heads-name">The heads</span>
          <span ref={meter} className="schwifty-heads" role="meter" aria-label="The heads’ meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.heads * 100)}>
            <span ref={fill} className="schwifty-heads-fill" style={{ width: `${(view.heads * 100).toFixed(1)}%` }} />
          </span>
          <span ref={grade} className="schwifty-grade" aria-live="polite" />
        </div>
        <div className="schwifty-lanes">
          {Array.from({ length: LANES }, (_, lane) => (
            <button
              key={lane}
              ref={(el) => {
                laneEls.current[lane] = el;
              }}
              type="button"
              tabIndex={-1}
              className="schwifty-lane"
              data-lane={lane}
              aria-label={`Hit the ${NAMES[lane]} lane`}
              onPointerDown={() => hit(lane)}
            >
              <span className="schwifty-line" aria-hidden="true" />
              {coming
                .filter((n) => n.lane === lane)
                .map((n) => (
                  <span
                    key={n.id}
                    className="schwifty-note"
                    style={{ top: top(n.y) }}
                    aria-hidden="true"
                    ref={(el) => {
                      noteEls.current.set(n.id, el);
                      return () => noteEls.current.delete(n.id);
                    }}
                  />
                ))}
            </button>
          ))}
        </div>
      </div>
      {phase === 'intro' && (
        <div className="schwifty-card">
          <div>
            <h2>Get Schwifty</h2>
            <p className="schwifty-shout">SHOW ME WHAT YOU GOT.</p>
            <p>Hit each note as it reaches the line, on the beat, and keep the heads’ meter up to the end of the song.</p>
            <p className="schwifty-keys">
              {touch ? (
                'Tap a lane as its note reaches the line.'
              ) : (
                <>
                  <kbd>←</kbd> <kbd>↓</kbd> <kbd>↑</kbd> <kbd>→</kbd> or <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd> hit a lane · <kbd>P</kbd> or <kbd>Esc</kbd> pauses
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
        <div className="schwifty-card">
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
        <div className="schwifty-card" data-settling={!settled || undefined}>
          <div>
            <h2 className="schwifty-shout">{phase === 'won' ? 'I LIKE WHAT YOU GOT. GOOD JOB.' : 'DISQUALIFIED.'}</h2>
            <p>{phase === 'won' ? line : 'The heads lost interest before the end of the song.'}</p>
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
