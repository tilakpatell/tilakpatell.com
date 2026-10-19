import { useCallback, useEffect, useRef, useState } from 'react';
import HQFrame from '../hq/HQFrame';
import { register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { earnStone, hasEarned } from '../hq/stones';
import { stoneById } from '../world/labels';
import { newSeed } from '../hq/rng';
import { useAchievements } from '../../Achievements';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { useSays } from '../hq/useSays';
import { KINDS, LANE, RUN, STONE_AT, leap, moveLane, newRun, smash, startRun, stepRun } from './rules';
import { HIT, SPOKEN, STONE, TEACH } from './lines';
import './smash.css';
import '../../../styles/lazy/avengers.css';

const sfx = () => import('../../../lib/sfx');
const play = (name) => sfx().then((s) => s[name]?.());
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};
const BEST = 'tp-hq-smash-best';
const STEP = 1 / 120;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fine = typeof window !== 'undefined' ? window.matchMedia?.('(hover: hover) and (pointer: fine)') : null;

// what Banner tells you as each new thing comes down the avenue, the first time
// one gets you and at the Time Stone (./lines.js), in his own voice where it's
// been made (lib/voiced.js)
const VOICED = new Set(SPOKEN);
const SMASH_SOUND = { soldier: 'hit', barricade: 'crumble', car: 'blast', barrier: 'shatter' };

// Run a game forward quickly and safely (for the browser checks): in a rage
// nothing stops him, so he gets there.
function warp(g, to) {
  const H = g.hulk;
  while (g.phase === 'run' && g.d < to) {
    H.raging = 99;
    stepRun(g, STEP);
  }
  H.raging = 0;
  H.rage = 0;
  g.queue.length = 0;
}

export default function SmashRun({ fallback }) {
  const three = use3D();
  const stage = useStage(gameModule, { enabled: three.on, id: 'smash', forced: three.mode === 'on' });
  const { unlock } = useAchievements();
  const game = useRef(newRun({ seed: 1 }));
  const hud = useRef(null);
  const acc = useRef(0);
  const swipe = useRef(null);
  const fxState = useRef({ popups: [], hurt: 0, flash: 0, lastUi: 0, taught: new Set() });
  const [best, setBest] = useState(() => Number(local.get(BEST, 0)) || 0);
  const [ui, setUi] = useState({ phase: 'ready', d: 0, hp: RUN.hearts, score: 0, rage: 0, raging: 0, message: '', title: '', result: null, stone: false });
  const [paused, setPaused] = useState(false);
  const playing = ui.phase === 'run';
  useSays('banner', ui.message, VOICED);

  const sync = useCallback((extra = {}) => {
    const g = game.current;
    setUi((u) => ({ ...u, phase: g.phase, d: g.d, hp: g.hulk.hp, score: g.score, rage: g.hulk.rage, raging: g.hulk.raging, stone: g.stone, ...extra }));
  }, []);

  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);

  const start = useCallback(() => {
    audioContext(); // in the click, so the first smash can be heard
    game.current = newRun({ seed: newSeed() });
    const ev = startRun(game.current);
    acc.current = 0;
    fxState.current.popups = [];
    fxState.current.taught = new Set();
    setPaused(false);
    stage.view.current?.fx(ev, game.current);
    sync({ message: '', title: '', result: null });
    focus();
  }, [focus, stage.view, sync]);

  // the events of a step: sound, haptics, popups and the HUD
  const handle = useCallback(
    (events) => {
      const g = game.current;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        switch (e.type) {
          case 'leap':
            play('zip');
            break;
          case 'land':
            play('thunk');
            buzz(15);
            break;
          case 'whiff':
            play('knock');
            break;
          case 'smash': {
            play(SMASH_SOUND[e.kind] ?? 'hit');
            if (e.kind === 'car') play('crumble');
            buzz(e.kind === 'car' ? 40 : 18);
            const len = KINDS[e.kind]?.len ?? 1;
            f.popups.push({ at: e.at + len / 2, x: e.x, text: `+${e.score}`, sub: e.perfect ? 'PERFECT' : e.rage ? 'SMASH' : '', t: 0, big: e.kind === 'car' || e.perfect });
            break;
          }
          case 'hit':
            play('hit');
            buzz(90);
            f.hurt = 1;
            if (e.by === 'barrier' && !f.taught.has('wall-hit')) {
              f.taught.add('wall-hit');
              important = { message: HIT.barrier };
            } else if (e.by === 'crater' && !f.taught.has('crater-hit')) {
              f.taught.add('crater-hit');
              important = { message: HIT.crater };
            } else if (e.by === 'chariot' && !f.taught.has('chariot-hit')) {
              f.taught.add('chariot-hit');
              important = { message: HIT.chariot };
            }
            break;
          case 'rage':
            import('../../../lib/clips').then((c) => c.playClip('hulkSmash')).then((h) => h || play('roar'));
            buzz(120);
            f.flash = 1;
            important = { message: 'HULK SMASH. Nothing stops you now.' };
            break;
          case 'calm':
            important = { message: '' };
            break;
          case 'warn':
            play('warn');
            break;
          case 'burn':
            play('laser');
            play('blast');
            break;
          case 'section':
            if (e.fresh && TEACH[e.fresh]) {
              play('drum');
              important = { title: e.title, message: TEACH[e.fresh](fine?.matches) };
            } else important = { title: e.title };
            break;
          case 'heal':
            play('oneUp');
            break;
          case 'mark':
            if (e.d !== STONE_AT) play('ding');
            break;
          case 'stone': {
            play('stone');
            buzz(150);
            unlock('hulk');
            const first = earnStone('time');
            important = { message: first ? STONE.first : STONE.again };
            break;
          }
          case 'lost': {
            play('alarm');
            const isBest = e.d > best;
            if (isBest) {
              setBest(e.d);
              local.set(BEST, Math.round(e.d));
            }
            important = { result: { d: e.d, score: e.score, newBest: isBest, stone: e.stone && hasEarned('time'), smashes: g.smashes, perfects: g.perfects } };
            break;
          }
          default:
        }
      }
      if (important) {
        if (important.message) f.said = g.t;
        sync(important);
      } else if (g.t - f.lastUi > 0.08) {
        f.lastUi = g.t;
        // a line stays up a few seconds
        sync(f.said != null && g.t - f.said > 5 ? ((f.said = null), { message: '', title: '' }) : {});
      }
    },
    [best, sync, unlock],
  );

  // browser checks
  useEffect(
    () =>
      register('smash', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        start,
        left: () => moveLane(game.current, -1),
        right: () => moveLane(game.current, 1),
        leap: () => leap(game.current),
        smash: () => smash(game.current),
        setState(name) {
          start();
          const g = game.current;
          if (name === 'action') warp(g, 300);
          if (name === 'rage') {
            warp(g, 420);
            g.hulk.raging = RUN.rage;
            g.hulk.rage = 100;
            stage.view.current?.fx([{ type: 'rage' }], g);
          }
          if (name === 'chariot') {
            warp(g, 900);
            g.chariots.push({ id: g.nextId++, at: g.d + 75, lane: g.hulk.lane, state: 'waiting', t: 0 });
          }
          if (name === 'lost') {
            warp(g, 260);
            g.hulk.hp = 1;
            g.obstacles.push({ id: g.nextId++, kind: 'barrier', at: g.d + 3, lane: g.hulk.lane, x: g.hulk.lane * LANE, w: KINDS.barrier.w, len: KINDS.barrier.len, broken: false, passed: false });
          }
          stage.view.current?.snap();
          sync();
          return { state: name, d: Math.round(g.d) };
        },
      }),
    [start, stage.view, sync],
  );

  // ── the loop ──
  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      const g = game.current;
      const dt = Math.min(0.05, dtMs / 1000);
      const live = g.phase === 'run' && !paused;
      if (live) {
        acc.current += dt * view.timeScale(dt);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepRun(g, STEP));
          if (g.phase !== 'run') break;
        }
        if (events.length) {
          view.fx(events, g);
          handle(events);
        }
      }
      view.render(g, paused ? 0 : dt);
      drawHud(hud.current, g, view, fxState.current, dt, live);
    },
    [handle, paused, stage.view],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // nothing stays held when the window loses focus; pause when scrolled away
  useEffect(() => {
    const stop = () => (swipe.current = null);
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => {
    if (!stage.visible && playing) setPaused(true);
  }, [stage.visible, playing]);

  // ── input ──
  const onKeyDown = (e) => {
    const g = game.current;
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
      setPaused((p) => !p);
      return;
    }
    if (paused) return;
    if (k === 'arrowleft' || k === 'a') {
      e.preventDefault();
      if (!e.repeat) moveLane(g, -1);
    } else if (k === 'arrowright' || k === 'd') {
      e.preventDefault();
      if (!e.repeat) moveLane(g, 1);
    } else if (k === 'arrowup' || k === 'w') {
      e.preventDefault();
      if (!e.repeat) leap(g);
    } else if (k === ' ' || k === 'arrowdown' || k === 's' || k === 'j') {
      e.preventDefault();
      if (!e.repeat) smash(g);
    }
  };
  const onPointerDown = (e) => {
    if (paused || !playing || e.target.closest('button')) return;
    const g = game.current;
    if (e.pointerType === 'mouse') {
      if (e.button === 2) leap(g);
      else if (e.button === 0) smash(g);
      return;
    }
    // touch: a swipe changes lanes or leaps; a tap smashes
    capturePointer(e);
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, done: false };
  };
  const onPointerMove = (e) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId || s.done) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const g = game.current;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      moveLane(g, Math.sign(dx));
      s.done = true;
    } else if (dy < -28 && -dy > Math.abs(dx)) {
      leap(g);
      s.done = true;
    } else if (dy > 28 && dy > Math.abs(dx)) {
      smash(g);
      s.done = true;
    }
  };
  const onPointerUp = (e) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    swipe.current = null;
    // when the finger went down and up, not when we heard about it (a slow frame between them isn't a long press)
    if (!s.done && e.timeStamp - s.t < 350) smash(game.current);
  };

  const res = ui.result;
  const toStone = Math.min(1, ui.d / STONE_AT);
  return (
    <HQFrame
      stage={stage}
      three={three}
      fallback={fallback}
      className="sr-game"
      accent="#7dff6a"
      label="Smash Run. Hulk charges down a Midtown street. Left and right arrows, or A and D, change lanes; the up arrow or W leaps; Space smashes. With a mouse, click to smash and right-click to leap. On a touch screen, swipe sideways to change lanes, swipe up to leap and tap to smash."
      screenProps={{
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: () => (swipe.current = null),
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        style: { touchAction: playing ? 'none' : 'auto' },
      }}
    >
      <canvas ref={hud} className="sr-hud-canvas" aria-hidden="true" />
      {playing && (
        <div className="sr-hud" aria-hidden="true" data-rage={ui.raging > 0 || undefined}>
          <div className="sr-distance">
            <span className="sr-distance-n">
              {fmt(ui.d)}
              <small>m</small>
            </span>
            <span className="sr-track" data-done={ui.stone || undefined}>
              <span style={{ width: `${toStone * 100}%` }} />
              <i className="sr-stone" aria-hidden="true" />
            </span>
            {ui.title && <span className="sr-section">{ui.title}</span>}
          </div>
          <div className="sr-score">
            <span className="sr-score-n">{fmt(ui.score)}</span>
            <span className="sr-hearts">
              {Array.from({ length: RUN.hearts }, (_, i) => (
                <span key={i} data-on={i < ui.hp || undefined} />
              ))}
            </span>
          </div>
          <div className="sr-rage" data-full={ui.raging > 0 || undefined}>
            <span className="sr-rage-bar">
              <span style={{ width: `${ui.rage}%` }} />
            </span>
            <span className="sr-rage-label">{ui.raging > 0 ? `HULK SMASH ${ui.raging.toFixed(1)}` : 'Rage'}</span>
          </div>
          <p className="sr-message">{ui.message}</p>
        </div>
      )}
      {(!playing || paused) && (
        <div className="hq-overlay sr-overlay">
          {paused ? (
            <>
              <p className="hq-overlay-title">Paused</p>
              <p className="hq-overlay-text">
                {fmt(ui.d)} m down the avenue. {ui.hp} {ui.hp === 1 ? 'heart' : 'hearts'} left.
              </p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => (setPaused(false), focus())}>
                Resume
              </button>
            </>
          ) : (
            <>
              <p className="hq-overlay-kicker">Midtown · 2012 · the portal is open</p>
              <p className="hq-overlay-title">{res ? 'Banner’s back.' : 'Smash Run'}</p>
              <p className="hq-overlay-text">
                {res
                  ? res.d >= STONE_AT
                    ? `${fmt(res.d)} m through the Chitauri, past the Time Stone. ${res.smashes} smashed, ${res.perfects} of them perfect.`
                    : `${fmt(res.d)} m down the avenue, ${fmt(STONE_AT - res.d)} m short of the Time Stone. Smash a little late for a perfect, and save the leap for craters and fire.`
                  : 'The Chitauri are pouring out of the sky over Stark Tower. Charge down the avenue: smash what’s in your lane, leap what you can’t, and go round what even you can’t break. Every smash feeds the rage. The Time Stone is 2,000 m away.'}
              </p>
              {res && (
                <p className="hq-overlay-score">
                  {fmt(res.d)} m
                  <small>{res.newBest ? 'a new best' : best ? `best ${fmt(best)} m` : `${fmt(res.score)} points`}</small>
                </p>
              )}
              {res?.stone && (
                <p className="hq-stone" style={{ '--glow': stoneById('time').color }}>
                  <span className="stone-dot" aria-hidden="true" />
                  The Time Stone is yours.
                </p>
              )}
              {!res && (
                <ul className="hq-keys">
                  <li>
                    <kbd>←</kbd>
                    <kbd>→</kbd> lanes
                  </li>
                  <li>
                    <kbd>↑</kbd> leap
                  </li>
                  <li>
                    <kbd>Space</kbd> or click: smash
                  </li>
                  <li>Touch: swipe, tap</li>
                </ul>
              )}
              <button type="button" className="btn btn-primary mt-5" onClick={start}>
                {res ? 'Again' : 'Hulk out'}
              </button>
              {!res && best > 0 && <p className="hq-overlay-best">Best {fmt(best)} m</p>}
            </>
          )}
        </div>
      )}
      <p className="sr-only" role="status">
        {playing ? `${fmt(ui.d)} metres. ${ui.hp} hearts. ${ui.message}` : ''}
      </p>
    </HQFrame>
  );
}

// ── the HUD, drawn every frame over the 3D view ──
const calm = typeof window !== 'undefined' && prefersReducedMotion();
function drawHud(cv, g, view, f, dt, live) {
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
  const H = g.hulk;
  // a hit: red at the edges; the rage: green at the edges, breathing
  f.hurt = Math.max(0, f.hurt - dt * 1.8);
  f.flash = Math.max(0, f.flash - dt * 1.5);
  const edge = (rgb, a) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, `rgba(${rgb},0)`);
    grad.addColorStop(1, `rgba(${rgb},${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  };
  if (!calm && f.hurt > 0) edge('255,40,30', 0.5 * f.hurt);
  if (!calm && H.raging > 0) edge('90,255,90', 0.18 + 0.08 * Math.sin(g.t * 8) + f.flash * 0.4);
  if (!live) return;

  // speed lines, more as he speeds up, many in a rage
  if (!calm) {
    const k = Math.max(0, (g.speed - 18) / 14) + (H.raging > 0 ? 0.6 : 0);
    const n = Math.round(k * 26);
    ctx.strokeStyle = H.raging > 0 ? 'rgba(190,255,180,0.35)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399 + Math.floor(g.t * 20) * 0.7) % (Math.PI * 2);
      const r0 = Math.max(w, h) * (0.32 + ((i * 0.37 + g.t * 3) % 1) * 0.3);
      const len = 30 + k * 40;
      const cx = w / 2 + Math.cos(a) * r0;
      const cy = h * 0.45 + Math.sin(a) * r0 * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.6);
      ctx.stroke();
    }
  }

  // points, floating up from what he smashed
  const font = (size, weight = 700) => `${weight} ${size}px "Archivo Variable", Archivo, sans-serif`;
  ctx.textAlign = 'center';
  f.popups = f.popups.filter((p) => p.t < 1);
  for (const p of f.popups) {
    p.t += dt;
    const c = view.projectAt(g, p.at, p.x, 2.2);
    if (!c.front) continue;
    const k = p.t;
    const y = c.y - (calm ? 0 : k * 40);
    ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.font = font(p.big ? 20 : 15, 800);
    ctx.fillStyle = p.big ? '#c8ff8a' : '#ffffff';
    ctx.strokeText(p.text, c.x, y);
    ctx.fillText(p.text, c.x, y);
    if (p.sub) {
      ctx.font = font(11, 800);
      ctx.fillStyle = p.sub === 'PERFECT' ? '#ffe08a' : '#8aff7a';
      ctx.strokeText(p.sub, c.x, y - (p.big ? 20 : 16));
      ctx.fillText(p.sub, c.x, y - (p.big ? 20 : 16));
    }
    ctx.globalAlpha = 1;
  }
}
