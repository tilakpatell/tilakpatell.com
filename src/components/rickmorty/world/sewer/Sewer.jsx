import { useCallback, useEffect, useRef, useState } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import '@fontsource/luckiest-guy/400.css';
import { useFrameLoop, useMediaQuery } from '../../../../lib/hooks';
import { readPad } from '../../../games/pad';
import { createCooldownPress, pressGroups } from '../../../../lib/press';
import { TUNING, newRun, progress, stepRun } from './rules';
import './sewer.css';

// Pickle Rick's sewer run, the game under the agency's floor: roll down the
// drain towards the agency, three lanes wide, hop the grates, hop onto the
// rats (or shoot them, once three screws have made the rat-suit's laser),
// and reach the end with a point left. The rules are ./rules.js, stepped at
// a fixed 1/60 s with the presses since the last step; ./scene.js draws.
//
// <Sewer onLeave={(won) => …} onWin={() => …} /> fills its parent (the
// world's overlay): onWin the moment a run's first won, so a win counts
// however the player leaves (or doesn't); onLeave(true) once a run's won and
// the player leaves, onLeave(false) otherwise. It owns Esc on every card: a
// pause while rolling, the way out otherwise.

const STEP = 1 / 60;
const MAX_STEPS = 6;
const KEYS = {
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  hop: [' ', 'ArrowUp', 'w', 'W', 'Spacebar'],
  fire: ['f', 'F', 'Enter'],
};
const sfx = () => import('../../../../lib/sfx');
const play = (name) => sfx().then((s) => s[name]?.(), () => {});

export default function Sewer({ onLeave, onWin }) {
  const wrap = useRef(null);
  const api = useRef(null);
  const run = useRef(null);
  const view = useRef(null);
  const presses = useRef({});
  // the hop's buffer: pressed a moment before the wheels come down, it hops as they do
  const hopPress = useRef(null);
  hopPress.current ??= createCooldownPress();
  const acc = useRef(0);
  const [phase, setPhase] = useState('loading'); // loading | intro | play | paused | won | lost | failed
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [hud, setHud] = useState({ hp: TUNING.hp, screws: 0, laser: false, kills: 0, pct: 0 });
  const touch = useMediaQuery('(pointer: coarse)');
  const wonRef = useRef(false);
  const winRef = useRef(onWin);
  winRef.current = onWin;

  // ── the renderer ──
  useEffect(() => {
    let dead = false;
    let made = null;
    const el = wrap.current;
    const c = document.createElement('canvas');
    c.className = 'sewer-canvas';
    el.prepend(c);
    import('./scene')
      .then(({ createSewerScene }) => createSewerScene(c, { onLost: () => !dead && setPhase('failed') }))
      .then((r) => {
        made = r;
        if (dead) {
          r.dispose();
          return;
        }
        api.current = r;
        r.tune?.(pressGroups(hopPress.current)); // (behind ?debug: the shake's numbers and the hop's buffer)
        r.resize(el.clientWidth, el.clientHeight);
        run.current = newRun(1 + Math.floor(Math.random() * 1e6));
        view.current = run.current;
        r.render(view.current, 0);
        setPhase('intro');
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error(err);
        if (!dead) setPhase('failed');
      });
    return () => {
      dead = true;
      made?.dispose();
      api.current = null;
      c.remove();
    };
  }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => api.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── the keys and the pad: presses, taken by the next step ──
  const press = useCallback((name) => {
    presses.current[name] = true;
  }, []);
  useEffect(() => {
    const down = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const p = phaseRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (p === 'play') setPhase('paused');
        else if (p === 'paused') setPhase('play');
        else onLeave(wonRef.current);
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        if (p === 'play') setPhase('paused');
        else if (p === 'paused') setPhase('play');
        return;
      }
      for (const [name, keys] of Object.entries(KEYS)) {
        if (keys.includes(e.key)) {
          e.preventDefault();
          if (p === 'intro' && (name === 'hop' || name === 'fire')) setPhase('play');
          else if (p === 'play' && !e.repeat) press(name);
          else if ((p === 'won' || p === 'lost') && (name === 'hop' || name === 'fire')) onLeave(wonRef.current);
        }
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onLeave, press]);

  // ── the run, stepped ──
  const held = useRef({});
  const tick = useCallback(
    (ms) => {
      const a = api.current;
      if (!a) return;
      if (phase === 'play' && run.current) {
        // a controller's presses, on their edges
        const pad = readPad();
        if (pad) {
          const now = { left: pad.left, right: pad.right, hop: pad.a, fire: pad.b || pad.x };
          for (const k of Object.keys(now)) if (now[k] && !held.current[k]) press(k);
          held.current = now;
        }
        acc.current += Math.min(0.1, ms / 1000);
        let steps = 0;
        let events = [];
        while (acc.current >= STEP && steps < MAX_STEPS) {
          run.current = stepRun(run.current, presses.current, STEP, { press: hopPress.current });
          presses.current = {};
          events = events.concat(run.current.events);
          acc.current -= STEP;
          steps++;
        }
        if (steps) {
          const r = run.current;
          view.current = { ...r, events };
          for (const e of events) {
            if (e.type === 'bite' || e.type === 'splash') play('thud');
            else if (e.type === 'zap' || e.type === 'squash') play('zap');
            else if (e.type === 'screw' || e.type === 'laser') play('pickup');
          }
          const pct = Math.round(progress(r) * 100);
          if (r.hp !== hud.hp || r.screws !== hud.screws || r.laser !== hud.laser || r.kills !== hud.kills || pct !== hud.pct) setHud({ hp: r.hp, screws: r.screws, laser: r.laser, kills: r.kills, pct });
          if (r.phase === 'won') {
            if (!wonRef.current) winRef.current?.();
            wonRef.current = true;
            setPhase('won');
          } else if (r.phase === 'lost') setPhase('lost');
        }
      }
      a.render(view.current, ms);
    },
    [phase, hud, press],
  );
  useFrameLoop(tick, phase !== 'loading' && phase !== 'failed');

  const again = () => {
    run.current = newRun(1 + Math.floor(Math.random() * 1e6));
    view.current = run.current;
    presses.current = {};
    hopPress.current.reset();
    setHud({ hp: TUNING.hp, screws: 0, laser: false, kills: 0, pct: 0 });
    setPhase('play');
  };
  const leave = () => onLeave(wonRef.current);

  // (the checks drive it: rm-story-check.mjs)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__SEWER__ = {
      get state() {
        return run.current;
      },
      get phase() {
        return phaseRef.current;
      },
      set(r) {
        run.current = r;
        view.current = r;
      },
    };
    return () => {
      delete window.__SEWER__;
    };
  }, []);

  return (
    <div ref={wrap} className="sewer" data-owns-escape="">
      <button type="button" className="btn btn-ghost btn-sm sewer-leave" onClick={leave} aria-label="Leave the sewer">
        <RiCloseLine aria-hidden="true" /> Leave
      </button>
      {(phase === 'play' || phase === 'paused' || phase === 'won' || phase === 'lost') && (
        <>
          <div className="sewer-hud" aria-live="polite">
            <div>
              <div className="sewer-hearts" aria-label={`${hud.hp} of ${TUNING.hp}`}>
                {Array.from({ length: TUNING.hp }, (_, i) => (
                  <span key={i} data-off={i >= hud.hp || undefined}>
                    ♥
                  </span>
                ))}
              </div>
              <div>
                Screws {hud.screws}/{TUNING.screws} {hud.laser ? '· laser on: F fires' : ''}
              </div>
            </div>
            <div>
              Rats {hud.kills} · {hud.pct}% of the way
            </div>
          </div>
          <div className="sewer-bar" aria-hidden="true">
            <span style={{ width: `${hud.pct}%` }} />
          </div>
        </>
      )}
      {phase === 'play' && touch && (
        <div className="sewer-pad" aria-label="Controls">
          <button type="button" aria-label="Left" onPointerDown={() => press('left')}>
            ◀
          </button>
          <button type="button" aria-label="Hop" onPointerDown={() => press('hop')}>
            Hop
          </button>
          <button type="button" aria-label="Fire" onPointerDown={() => press('fire')} disabled={!hud.laser}>
            ✦
          </button>
          <button type="button" aria-label="Right" onPointerDown={() => press('right')}>
            ▶
          </button>
        </div>
      )}
      {phase === 'loading' && (
        <div className="sewer-card">
          <div>
            <p>Down the drain…</p>
          </div>
        </div>
      )}
      {phase === 'failed' && (
        <div className="sewer-card">
          <div>
            <h2>No sewer</h2>
            <p>The 3D stopped. Pickle Rick is fine; he always is.</p>
            <button type="button" className="btn btn-primary" onClick={leave}>
              Back up the hole
            </button>
          </div>
        </div>
      )}
      {phase === 'intro' && (
        <div className="sewer-card">
          <div>
            <h2>Pickle Riiick!</h2>
            <p>Roll down the drain to the agency. Hop the grates, hop onto the rats, and pick up three screws: that’s the rat-suit’s laser. Three bites and you’re a snack.</p>
            <p className="sewer-keys">
              {touch ? 'Left and right change lanes; Hop hops; the star fires once the laser’s on.' : (
                <>
                  <kbd>←</kbd> <kbd>→</kbd> lanes · <kbd>Space</kbd> hop · <kbd>F</kbd> fire
                </>
              )}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setPhase('play')}>
              Roll
            </button>
            <button type="button" className="btn btn-ghost" onClick={leave}>
              Back up the hole
            </button>
          </div>
        </div>
      )}
      {phase === 'paused' && (
        <div className="sewer-card">
          <div>
            <h2>Paused</h2>
            <button type="button" className="btn btn-primary" onClick={() => setPhase('play')}>
              Roll on
            </button>
            <button type="button" className="btn btn-ghost" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      )}
      {(phase === 'won' || phase === 'lost') && (
        <div className="sewer-card">
          <div>
            <h2>{phase === 'won' ? 'Made it' : 'Rat food'}</h2>
            <p>{phase === 'won' ? `Up through the agency’s drain with ${hud.kills} ${hud.kills === 1 ? 'rat' : 'rats'} behind you. Jaguar is waiting, and so is a therapist.` : `The rats got you ${hud.pct}% of the way there. Pickle Rick does not die, Morty. He is a pickle. Again.`}</p>
            <button type="button" className="btn btn-primary" onClick={again}>
              Again
            </button>
            <button type="button" className="btn btn-ghost" onClick={leave}>
              {phase === 'won' ? 'Up the drain' : 'Back up the hole'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
