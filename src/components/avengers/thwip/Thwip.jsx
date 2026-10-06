import { useCallback, useEffect, useRef, useState } from 'react';
import HQFrame from '../hq/HQFrame';
import { register, useStage } from '../hq/useStage';
import { newSeed } from '../hq/rng';
import { useAchievements } from '../../Achievements';
import { edges, readPad, typing } from '../../games/pad';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { BELL, RUN, SCHOOL, distance, newRun, pilot, press, reel, release, startRun, steer, stepRun } from './rules';
import './thwip.css';

const load = () => import('./scene');
const sfx = () => import('../../../lib/sfx');
const play = (name) => sfx().then((s) => s[name]?.());
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};
const STEP = 1 / 120;
const BEST = 'tp-hq-thwip-best';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const calm = typeof window !== 'undefined' && prefersReducedMotion();

// what Peter says on the way, now and then
const QUIPS = ['Sorry! Sorry! Late for school!', 'Hey, Mr. Delmar! Can’t stop!', 'Okay, that was a cool one.', 'Karen, how late am I? Don’t answer that.', 'Ned is never going to let me hear the end of this.', 'Whoa. Okay. Big gap. Big gap.'];

export default function Thwip({ fallback }) {
  const three = use3D();
  const stage = useStage(load, { enabled: three.on, id: 'thwip', forced: three.mode === 'on' });
  const { unlock } = useAchievements();
  const game = useRef(newRun({ seed: 1 }));
  const demo = useRef(null);
  const hud = useRef(null);
  const acc = useRef(0);
  const keys = useRef(new Set());
  const pad = useRef(null);
  const fxState = useRef({ popups: [], hurt: 0, said: -9, lastUi: 0 });
  const [best, setBest] = useState(() => Number(local.get(BEST, 0)) || 0);
  const [ui, setUi] = useState({ phase: 'ready', d: 0, t: 0, hearts: RUN.hearts, score: 0, combo: 0, got: 0, quip: '', result: null });
  const [paused, setPaused] = useState(false);
  const playing = ui.phase === 'run';

  const sync = useCallback((extra = {}) => {
    const g = game.current;
    setUi((u) => ({ ...u, phase: g.phase, d: distance(g), t: g.t, hearts: g.hearts, score: g.score, combo: g.combo, got: g.got, ...extra }));
  }, []);
  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);

  const start = useCallback(() => {
    audioContext(); // in the click, so the first thwip can be heard
    game.current = newRun({ seed: newSeed() });
    startRun(game.current);
    acc.current = 0;
    fxState.current = { popups: [], hurt: 0, said: -9, lastUi: 0 };
    keys.current.clear();
    setPaused(false);
    stage.view.current?.snap(game.current);
    sync({ result: null, quip: 'Okay. Two kilometres. The bell goes in a hundred seconds. No problem.' });
    fxState.current.said = 0;
    focus();
  }, [focus, stage.view, sync]);

  const handle = useCallback(
    (events) => {
      const g = game.current;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        switch (e.type) {
          case 'thwip':
            play('zip');
            break;
          case 'miss':
            play('knock');
            break;
          case 'perfect':
            play('ding');
            buzz(15);
            f.popups.push({ at: e.at, text: e.combo > 1 ? `PERFECT ×${e.combo}` : 'PERFECT', t: 0 });
            break;
          case 'pack':
            play('coin');
            f.popups.push({ at: e.at, text: 'BACKPACK', t: 0, big: true });
            if (e.n === 1 || e.n % 4 === 0) important = { quip: e.n === 1 ? 'My backpack! I’ve been looking for that.' : `That’s ${e.n} backpacks. How do I keep losing these?` };
            break;
          case 'street':
            play('thunk');
            play('knock');
            buzz(90);
            f.hurt = 1;
            important = { quip: e.hearts > 0 ? 'Sorry! Sorry! Get up, get up.' : '' };
            break;
          case 'honk':
            play('alarm');
            buzz(60);
            f.hurt = 0.6;
            break;
          case 'wall':
            play('thunk');
            break;
          case 'bell':
            play('ring');
            important = { quip: 'That’s the bell. Okay. Still going.' };
            break;
          case 'won': {
            play('fanfare');
            unlock('spidey');
            const isBest = e.score > best;
            if (isBest) {
              setBest(e.score);
              local.set(BEST, e.score);
            }
            important = { result: { won: true, onTime: e.onTime, time: e.time, score: e.score, got: g.got, perfects: g.perfects, newBest: isBest } };
            break;
          }
          case 'lost':
            play('alarm');
            important = { result: { won: false, d: e.d, score: e.score, got: g.got } };
            break;
          default:
        }
      }
      // a quip, every so often, when he's flying well
      if (!important && g.combo >= 3 && g.t - f.said > 9) important = { quip: QUIPS[Math.floor(g.t) % QUIPS.length] };
      if (important) {
        if (important.quip) f.said = g.t;
        sync(important);
      } else if (g.t - f.lastUi > 0.1) {
        f.lastUi = g.t;
        sync(g.t - f.said > 4 ? { quip: '' } : {});
      }
    },
    [best, sync, unlock],
  );

  useEffect(
    () =>
      register('thwip', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        start,
        setState(name) {
          start();
          const g = game.current;
          if (name === 'swing') {
            for (let i = 0; i < 240; i++) {
              pilot(g);
              stepRun(g, STEP);
            }
          }
          stage.view.current?.snap(g);
          sync();
          return { phase: g.phase, d: Math.round(distance(g)) };
        },
      }),
    [start, stage.view, sync],
  );

  // keys and a controller, onto the rules
  const controls = useCallback((g) => {
    const k = keys.current;
    let s = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    let hold = k.has(' ') || k.has('mouse') || k.has('touch');
    let up = k.has('arrowup') || k.has('w');
    const p = readPad();
    if (p) {
      const e = edges(p, pad.current);
      if (Math.abs(p.lx) > 0.2) s = p.lx;
      if (p.a || p.rt) hold = true;
      if (p.up || p.rb || p.ly < -0.5) up = true;
      if (e.start) setPaused((v) => !v);
    }
    pad.current = p;
    steer(g, s);
    reel(g, up);
    if (hold) press(g);
    else release(g);
  }, []);

  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      let g = game.current;
      const real = Math.min(0.05, dtMs / 1000);
      const title = g.phase === 'ready';
      if (title) {
        if (!demo.current || demo.current.phase !== 'run') {
          demo.current = newRun({ seed: 2 });
          startRun(demo.current);
        }
        g = demo.current;
      }
      const live = g.phase === 'run' && !paused;
      if (live) {
        if (title) pilot(g);
        else controls(g);
        acc.current += real * view.timeScale(real);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepRun(g, STEP));
          if (g.phase !== 'run') break;
        }
        if (events.length) {
          view.fx(events, g);
          if (!title) handle(events);
        }
      }
      view.render(g, paused ? 0 : real);
      if (!title) drawHud(hud.current, g, view, fxState.current, real);
      else hud.current?.getContext('2d')?.clearRect(0, 0, hud.current.width, hud.current.height);
    },
    [controls, handle, paused, stage.view],
  );
  useFrameLoop(tick, stage.status === 'on' && stage.visible);

  useEffect(() => {
    const stop = () => keys.current.clear();
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => {
    if (!stage.visible && playing) setPaused(true);
  }, [stage.visible, playing]);

  const onKeyDown = (e) => {
    if (typing(e.target)) return;
    const k = e.key.toLowerCase();
    if (!playing) {
      if ((k === 'enter' || k === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        start();
      }
      return;
    }
    if (k === 'escape' || k === 'p') {
      e.preventDefault();
      setPaused((v) => !v);
      return;
    }
    if ([' ', 'a', 'd', 'w', 'arrowleft', 'arrowright', 'arrowup'].includes(k)) {
      e.preventDefault();
      keys.current.add(k);
    }
  };
  const onKeyUp = (e) => keys.current.delete(e.key.toLowerCase());
  // the mouse (or a finger) held down is the web; a finger also steers, by where it is
  const onPointerDown = (e) => {
    if (paused || !playing || e.target.closest('button')) return;
    capturePointer(e);
    keys.current.add(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    if (e.pointerType !== 'mouse') aimTouch(e);
  };
  const aimTouch = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    keys.current.delete('arrowleft');
    keys.current.delete('arrowright');
    if (x < 0.35) keys.current.add('arrowleft');
    else if (x > 0.65) keys.current.add('arrowright');
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' && keys.current.has('touch')) aimTouch(e);
  };
  const onPointerUp = (e) => {
    keys.current.delete(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    if (e.pointerType !== 'mouse') {
      keys.current.delete('arrowleft');
      keys.current.delete('arrowright');
    }
  };

  const res = ui.result;
  const left = Math.max(0, SCHOOL - ui.d);
  const clock = Math.max(0, BELL - ui.t);
  return (
    <HQFrame
      stage={stage}
      three={three}
      fallback={fallback}
      className="tw-game"
      accent="#ff3b4e"
      label="Thwip! Spider-Man swings down an avenue in Queens to school. Hold Space, the mouse button or a finger to shoot a web and swing; let go to fly. Let go on the upswing for a perfect release. A and D, or the arrow keys, steer across the avenue; W or the up arrow reels the web in to climb. On a touch screen, hold anywhere to swing, on the left or right of the screen to steer."
      screenProps={{
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        onKeyUp,
        style: { touchAction: playing ? 'none' : 'auto' },
      }}
    >
      <canvas ref={hud} className="tw-hud-canvas" aria-hidden="true" />
      {playing && (
        <div className="tw-hud" aria-hidden="true">
          <div className="tw-way">
            <span className="tw-left">
              {fmt(left)}
              <small>m to school</small>
            </span>
            <span className="tw-track">
              <span style={{ width: `${Math.min(100, (ui.d / SCHOOL) * 100)}%` }} />
            </span>
          </div>
          <div className="tw-side">
            <span className="tw-clock" data-late={clock <= 0 || undefined}>
              {clock > 0 ? `${Math.ceil(clock)}s to the bell` : 'Late'}
            </span>
            <span className="tw-hearts">
              {Array.from({ length: RUN.hearts }, (_, i) => (
                <span key={i} data-on={i < ui.hearts || undefined} />
              ))}
            </span>
            <span className="tw-score">{fmt(ui.score)}</span>
          </div>
          {ui.quip && <p className="tw-quip">{ui.quip}</p>}
        </div>
      )}
      {(!playing || paused) && (
        <div className="hq-overlay tw-overlay">
          {paused ? (
            <>
              <p className="hq-overlay-title">Paused</p>
              <p className="hq-overlay-text">{fmt(left)} m to go.</p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => (setPaused(false), focus())}>
                Keep swinging
              </button>
            </>
          ) : (
            <>
              <p className="hq-overlay-kicker">Queens · the morning after the press conference</p>
              <p className="hq-overlay-title tw-title">{res ? (res.won ? (res.onTime ? 'Made it. Barely.' : 'Late again, Mr. Parker.') : 'Taking the subway, then.') : 'Thwip!'}</p>
              <p className="hq-overlay-text">
                {res
                  ? res.won
                    ? `${Math.round(res.time)} seconds down the avenue, ${res.got} ${res.got === 1 ? 'backpack' : 'backpacks'} back, ${res.perfects} perfect releases.`
                    : `${fmt(res.d)} m down the avenue, and the traffic had the last word. Swing before you drop too low, and carry your speed over the cross streets.`
                  : 'Peter turned down the suit. Now he’s late for school, two kilometres away, and the quickest way is between the buildings. Hold to swing, let go to fly, on the upswing for a perfect release. His backpacks are webbed up along the way: he keeps losing them.'}
              </p>
              {res && (
                <p className="hq-overlay-score">
                  {fmt(res.score)}
                  <small>{res.newBest ? 'a new best' : best ? `best ${fmt(best)}` : 'points'}</small>
                </p>
              )}
              {!res && (
                <ul className="hq-keys">
                  <li>
                    Hold <kbd>Space</kbd> or the mouse: swing
                  </li>
                  <li>
                    <kbd>A</kbd>
                    <kbd>D</kbd> steer
                  </li>
                  <li>
                    <kbd>W</kbd> reel in
                  </li>
                  <li>Touch: hold to swing, left or right to steer</li>
                </ul>
              )}
              <button type="button" className="btn btn-primary mt-5" onClick={start}>
                {res ? 'Again' : 'Swing'}
              </button>
              {!res && best > 0 && <p className="hq-overlay-best">Best {fmt(best)}</p>}
            </>
          )}
        </div>
      )}
      <p className="sr-only" role="status">
        {playing ? `${fmt(left)} metres to school. ${ui.hearts} hearts. ${ui.quip}` : ''}
      </p>
    </HQFrame>
  );
}

// the HUD over the 3D view: popups, a red edge when hurt, speed lines
function drawHud(cv, g, view, f, dt) {
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = r.width;
  const h = r.height;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  f.hurt = Math.max(0, f.hurt - dt * 1.8);
  if (!calm && f.hurt > 0) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(255,40,30,0)');
    grad.addColorStop(1, `rgba(255,40,30,${0.45 * f.hurt})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  const speed = Math.hypot(...g.v);
  if (!calm && speed > 36) {
    const k = Math.min(1, (speed - 36) / 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.round(k * 22); i++) {
      const a = (i * 2.399 + Math.floor(g.t * 20) * 0.7) % (Math.PI * 2);
      const r0 = Math.max(w, h) * (0.32 + ((i * 0.37 + g.t * 3) % 1) * 0.3);
      const cx = w / 2 + Math.cos(a) * r0;
      const cy = h / 2 + Math.sin(a) * r0 * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 24);
      ctx.stroke();
    }
  }
  ctx.textAlign = 'center';
  f.popups = f.popups.filter((p) => p.t < 1);
  for (const p of f.popups) {
    p.t += dt;
    const c = view.project(p.at);
    if (!c.front) continue;
    const y = c.y - (calm ? 0 : p.t * 40) - 20;
    ctx.globalAlpha = Math.min(1, (1 - p.t) * 2.5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.font = `800 ${p.big ? 17 : 15}px "Archivo Variable", Archivo, sans-serif`;
    ctx.fillStyle = p.big ? '#9fd0ff' : '#ffffff';
    ctx.strokeText(p.text, c.x, y);
    ctx.fillText(p.text, c.x, y);
    ctx.globalAlpha = 1;
  }
}
