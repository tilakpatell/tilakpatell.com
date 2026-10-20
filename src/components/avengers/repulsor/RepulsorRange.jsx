import { useCallback, useEffect, useRef, useState } from 'react';
import HQGame, { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { startable } from '../hq/gameScreen';
import { register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { earnStone, hasEarned, recordTry } from '../hq/stones';
import { newSeed } from '../hq/rng';
import { useAchievements } from '../../Achievements';
import { useGame3D } from '../hq/useGame3D';
import { local, prefersReducedMotion } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { useSays } from '../hq/useSays';
import { EYE, LANES, RANGE, WAVES, aimAt, newRange, rayHit, startRange, stepRange, strafe, unibeam } from './rules';
import { LINES, SAYS, SPOKEN } from './lines';
import './repulsor.css';
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
const BEST = 'tp-hq-repulsor-best';
const STEP = 1 / 120;

// what F.R.I.D.A.Y. says (./lines.js) in her own voice, where it's been made
// (lib/voiced.js): the lines that are the same every time
const VOICED = new Set(SPOKEN);

const fmt = (n) => Math.round(n).toLocaleString('en-US');

// The most urgent thing to shoot, for keyboard play (F.R.I.D.A.Y. aims).
function urgent(s) {
  let best = null;
  let score = -Infinity;
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.z > -2) continue;
    let k = e.z; // nearer is more urgent
    if (e.kind === 'missile' || e.committed) k += 40;
    if (e.kind === 'sentry' && e.charging > 0) k += 30;
    if (e.kind === 'prime') k -= 10;
    if (k > score) {
      score = k;
      best = e;
    }
  }
  if (!best) return null;
  if (best.kind === 'prime') {
    const armed = best.parts.some((p) => !p.core && p.hp > 0);
    const part = best.parts.find((p) => p.hp > 0 && (armed ? !p.core : p.core));
    return part ? { x: best.x + part.dx, y: best.y + part.dy, z: best.z } : best;
  }
  if (best.kind === 'sentry') return { x: best.x, y: best.y + 0.42, z: best.z };
  return best;
}

export default function RepulsorRange({ fallback }) {
  const three = useGame3D('repulsor');
  const stage = useStage(gameModule, { enabled: three.on, id: 'repulsor', forced: three.mode === 'on', own3D: true });
  const { unlock } = useAchievements();
  const game = useRef(newRange({ seed: 1 }));
  const hud = useRef(null);
  const aim = useRef({ nx: 0, ny: -0.05, pointer: false, movedAt: -1e9, keyFire: false });
  const acc = useRef(0);
  const fxState = useRef({ hitMark: 0, hurt: 0, beamReady: false, lastUi: 0 });
  const [best, setBest] = useState(() => Number(local.get(BEST, 0)) || 0);
  const [ui, setUi] = useState({ phase: 'ready', wave: 1, title: WAVES[0].title, armor: RANGE.armor, energy: RANGE.energy, charge: 0, score: 0, combo: 0, message: '', danger: [], paused: false, newBest: false, stone: false, bonus: 0 });
  const [paused, setPaused] = useState(false);
  const playing = ui.phase === 'wave' || ui.phase === 'break';
  useSays('friday', ui.message, VOICED);

  const sync = useCallback((extra = {}) => {
    const s = game.current;
    const danger = new Set();
    for (const b of s.bolts) {
      const t = -b.z / Math.max(1, b.vz);
      const lx = b.x + b.vx * t;
      LANES.forEach((x, i) => Math.abs(lx - x) < RANGE.boltHit + 0.3 && danger.add(i));
    }
    for (const e of s.enemies) if (e.kind === 'prime' && e.volley) e.volley.lanes.forEach((i) => danger.add(i));
    setUi((u) => ({ ...u, phase: s.phase, wave: s.wave + 1, title: WAVES[s.wave].title, armor: s.armor, energy: s.energy, charge: s.charge, score: s.score, combo: s.combo, lane: s.lane, danger: [...danger], ...extra }));
  }, []);

  const start = useCallback(() => {
    // (wave 1 waits for the stage: a run that began on a dark screen lost armour unseen)
    if (!startable(stage.status)) return;
    audioContext(); // in the click, so the run can be heard
    recordTry('stark');
    const s = game.current;
    s.seed = newSeed();
    const ev = startRange(s);
    acc.current = 0;
    setPaused(false);
    sync({ message: LINES[0], newBest: false, stone: false, bonus: 0 });
    stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true });
    if (ev.length) play('beeps');
  }, [sync, stage.status, stage.wrap]);

  // browser checks: the game, its view, and ways to jump to a state
  useEffect(
    () =>
      register('repulsor', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        start,
        setState(name) {
          const s = game.current;
          if (name === 'action') {
            // a busy moment, close in, for screenshots
            if (s.phase === 'ready') startRange(s);
            s.spawns = [];
            s.enemies = [
              { id: 9001, kind: 'drone', x: -4, y: 4.2, z: -16, vx: 0, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 1, hold: true },
              { id: 9002, kind: 'drone', x: 5, y: 5.5, z: -24, vx: 2, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 2, hold: true },
              { id: 9003, kind: 'drone', x: 1, y: 3.6, z: -11, vx: -1, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 3, hold: true },
              { id: 9004, kind: 'sentry', x: -7, y: 6, z: -22, vx: 0, vy: 0, vz: 0, hp: 4, r: RANGE.r.sentry, t: 0, seed: 1, hold: -22, cx: -7, cool: 99, charging: 0.5 },
              { id: 9005, kind: 'sentry', x: 9, y: 6.4, z: -30, vx: 0, vy: 0, vz: 0, hp: 4, r: RANGE.r.sentry, t: 0, seed: 4, hold: -30, cx: 9, cool: 99, charging: 0 },
              { id: 9006, kind: 'missile', x: 3, y: 7, z: -38, vx: -1, vy: -1, vz: 8, speed: 8, hp: 1, r: RANGE.r.missile, t: 0, seed: 0 },
            ];
            s.bolts = [{ x: -2, y: 4.5, z: -9, vx: 0.4, vy: -0.2, vz: 6 }];
          }
          if (name === 'boss') {
            if (s.phase === 'ready') startRange(s);
            s.wave = WAVES.length - 2;
            s.enemies = [];
            s.spawns = [];
            s.bolts = [];
            s.phase = 'break';
            s.breakT = 0.01;
          }
          sync();
          return { state: name };
        },
      }),
    [start, sync, stage.view],
  );

  // the events of a step, as sound, haptics and the HUD
  const handle = useCallback(
    (events) => {
      const s = game.current;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        switch (e.type) {
          case 'shot':
            play('repulse');
            break;
          case 'hit':
            f.hitMark = 0.16;
            break;
          case 'deflect':
            play('clang');
            f.hitMark = 0.1;
            break;
          case 'kill':
            play(e.kind === 'prime' ? 'boom' : e.kind === 'disc' ? 'pop' : 'blast');
            buzz(12);
            f.hitMark = 0.22;
            if (e.combo >= 3) important = { message: e.combo >= 6 ? `×${(1 + 0.5 * Math.min(6, e.combo - 1)).toFixed(1)} — F.R.I.D.A.Y. is impressed.` : undefined };
            break;
          case 'plate':
            play('clang');
            important = { message: e.left ? `Plate down. ${e.left} to go.` : SAYS.core };
            break;
          case 'damage':
            play('hit');
            buzz(80);
            f.hurt = 1;
            important = { message: e.armor <= 1 ? SAYS.critical : `Hit. Armour at ${e.armor} of ${RANGE.armor}.` };
            if (e.armor === 1) play('alarm');
            break;
          case 'dry':
            important = { message: SAYS.dry };
            break;
          case 'charge':
            play('warn');
            break;
          case 'volley':
            play('warn');
            important = { message: SAYS.volley };
            break;
          case 'spawn':
            if (e.kind === 'missile') play('torpedo');
            break;
          case 'unibeam':
            play('unibeam');
            buzz(120);
            break;
          case 'boss':
            play('alarm');
            break;
          case 'wave':
            play('beeps');
            important = { message: LINES[e.n - 1] ?? '' };
            break;
          case 'clear':
            important = { message: e.n < WAVES.length ? `Wave ${e.n} clear. Reactor recharging.` : '' };
            break;
          case 'won': {
            play('victory');
            unlock('ironman');
            const first = earnStone('power');
            const isBest = e.score > best;
            if (isBest) {
              setBest(e.score);
              local.set(BEST, e.score);
            }
            important = { message: SAYS.won, newBest: isBest, stone: first || hasEarned('power'), bonus: e.bonus };
            break;
          }
          case 'lost': {
            const isBest = e.score > best;
            if (isBest) {
              setBest(e.score);
              local.set(BEST, e.score);
            }
            important = { message: `Armour failed on wave ${e.wave}.`, newBest: isBest };
            break;
          }
          default:
        }
      }
      if (important) sync(important);
      else if (s.t - f.lastUi > 0.08) {
        f.lastUi = s.t;
        sync();
      }
    },
    [best, sync, unlock],
  );

  // ── the loop: rules at a fixed step, the view every frame, the HUD on top ──
  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      const s = game.current;
      const dt = Math.min(0.05, dtMs / 1000);
      const a = aim.current;
      const live = (s.phase === 'wave' || s.phase === 'break') && !paused;
      if (live) {
        // keyboard play aims at the most urgent target; the pointer aims where it points
        const keyAim = a.keyFire && performance.now() - a.movedAt > 1200;
        const target = keyAim ? urgent(s) : null;
        s.input.aim = target ? aimAt({ x: s.x, y: EYE, z: 0 }, target) : view.aimDir(a.nx, a.ny);
        acc.current += dt * view.timeScale(dt);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepRange(s, STEP));
          if (s.phase !== 'wave' && s.phase !== 'break') break;
        }
        if (events.length) {
          view.fx(events, s);
          handle(events);
        }
      }
      view.render(s, dt, { aim: s.input.aim });
      drawHud(hud.current, s, view, a, fxState.current, dt, live);
    },
    [handle, paused, stage.view],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // stop firing when the window loses focus or the game scrolls away
  useEffect(() => {
    const stop = () => {
      game.current.input.firing = false;
      aim.current.keyFire = false;
    };
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => {
    if (!stage.visible && playing) {
      game.current.input.firing = false;
      setPaused(true);
    }
  }, [stage.visible, playing]);

  // ── input ──
  const setAim = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    aim.current.nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    aim.current.ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    aim.current.movedAt = performance.now();
  };
  const onPointerMove = (e) => setAim(e);
  const onPointerDown = (e) => {
    if (!playing || paused || e.target.closest('button')) return;
    setAim(e);
    capturePointer(e);
    if (e.pointerType === 'mouse' && e.button === 2) {
      unibeam(game.current);
      return;
    }
    if (e.button === 0 || e.pointerType !== 'mouse') game.current.input.firing = true;
  };
  const onPointerUp = () => {
    game.current.input.firing = false;
  };
  const onKeyDown = (e) => {
    const s = game.current;
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
      s.input.firing = false;
      return;
    }
    if (paused) return;
    if (k === 'a' || k === 'arrowleft') {
      e.preventDefault();
      if (!e.repeat) strafe(s, -1);
    } else if (k === 'd' || k === 'arrowright') {
      e.preventDefault();
      if (!e.repeat) strafe(s, 1);
    } else if (k === ' ' || k === 'j') {
      e.preventDefault();
      aim.current.keyFire = true;
      s.input.firing = true;
    } else if (k === 'e' || k === 'q' || k === 'k') {
      e.preventDefault();
      unibeam(s);
    }
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'j') {
      aim.current.keyFire = false;
      game.current.input.firing = false;
    }
  };
  const press = (fn) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      capturePointer(e);
      fn();
    },
    onContextMenu: (e) => e.preventDefault(),
  });

  const ended = ui.phase === 'won' || ui.phase === 'lost';
  const fallbackToy = fallback;
  // the bar's Pause, and a hidden tab: as Esc does
  const pause = (p) => {
    game.current.input.firing = false;
    setPaused(p);
  };
  return (
    <HQGame
      game="repulsor"
      playing={playing}
      paused={paused}
      onPause={pause}
      stage={stage}
      three={three}
      fallback={fallbackToy}
      label="Repulsor Range. Move the mouse to aim, hold the button to fire repulsors, right-click or E for the unibeam, A and D to strafe between lanes. With the keyboard alone, hold Space and F.R.I.D.A.Y. aims for you. On a touch screen, touch to aim and fire."
      className="ir-game"
      screenProps={{
        onPointerMove,
        onPointerDown,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onLostPointerCapture: onPointerUp,
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        onKeyUp,
        style: { touchAction: playing ? 'none' : 'auto', cursor: playing ? 'none' : 'auto' },
      }}
    >
      <canvas ref={hud} className="ir-hud-canvas" aria-hidden="true" />
      <div className="ir-visor" aria-hidden="true" />
      {playing && (
        <div className="ir-hud" aria-hidden="true">
          <div className="ir-wave">
            <span className="ir-wave-n">
              Wave {ui.wave}
              <small>/{WAVES.length}</small>
            </span>
            <span className="ir-wave-title">{ui.title}</span>
          </div>
          <div className="ir-score">
            <span className="ir-score-n">{fmt(ui.score)}</span>
            {ui.combo > 1 && <span className="ir-combo">×{(1 + 0.5 * Math.min(6, ui.combo - 1)).toFixed(1)}</span>}
          </div>
          <div className="ir-status">
            <svg className="ir-reactor" viewBox="-30 -30 60 60" data-ready={ui.charge >= 100 || undefined}>
              <circle r="26" className="ir-reactor-track" />
              <circle r="26" className="ir-reactor-fill" pathLength="100" strokeDasharray={`${ui.charge} 100`} transform="rotate(-90)" />
              <circle r="15" className="ir-reactor-core" />
              <path d="M0 -9 L8 5 L-8 5 Z" className="ir-reactor-tri" />
            </svg>
            <div className="ir-bars">
              <div className="ir-armor" aria-label={`Armour ${ui.armor}`}>
                {Array.from({ length: RANGE.armor }, (_, i) => (
                  <span key={i} data-on={i < ui.armor || undefined} />
                ))}
              </div>
              <div className="ir-energy">
                <span style={{ width: `${(ui.energy / RANGE.energy) * 100}%` }} data-low={ui.energy < RANGE.shotCost * 2 || undefined} />
              </div>
              <span className="ir-label">{ui.charge >= 100 ? 'Unibeam ready · E' : `Unibeam ${Math.round(ui.charge)}%`}</span>
            </div>
          </div>
          <div className="ir-lanes">
            {LANES.map((_, i) => (
              <span key={i} data-on={ui.lane === i || undefined} data-danger={ui.danger.includes(i) || undefined} />
            ))}
          </div>
          <p className="ir-friday">{ui.message}</p>
        </div>
      )}
      {playing && !paused && (
        <div className="ir-touch" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="ir-touch-btn" aria-label="Strafe left" {...press(() => strafe(game.current, -1))}>
            ◀
          </button>
          <button type="button" className="ir-touch-btn" aria-label="Strafe right" {...press(() => strafe(game.current, 1))}>
            ▶
          </button>
          <button type="button" className="ir-touch-btn ir-touch-beam" aria-label="Fire the unibeam" disabled={ui.charge < 100} {...press(() => unibeam(game.current))}>
            Beam
          </button>
        </div>
      )}
      {(!playing || paused) &&
        (ended && !paused ? (
          <Results
            className="ir-overlay"
            won={ui.phase === 'won'}
            kicker="Stark Industries · test field"
            title={ui.phase === 'won' ? 'Ultron Prime is down.' : 'Armour failed.'}
            line={ui.message}
            score={ui.score}
            best={best}
            newBest={ui.newBest}
            stone={ui.phase === 'won' && ui.stone ? 'power' : null}
            stoneText="The Power Stone is yours. It’s waiting in Thanos’s gauntlet."
            onAgain={start}
          />
        ) : (
          <div className="hq-overlay ir-overlay">
            {paused ? (
              <>
                <p className="hq-overlay-title">Paused</p>
                <p className="hq-overlay-text">
                  Wave {ui.wave} of {WAVES.length}. Score {fmt(ui.score)}.
                </p>
                <button type="button" className="btn btn-primary mt-4" onClick={() => setPaused(false)}>
                  Resume
                </button>
              </>
            ) : (
              <>
                <p className="hq-overlay-kicker">Stark Industries · test field</p>
                <p className="hq-overlay-title">Repulsor Range</p>
                <p className="hq-overlay-text">Hold the field against nine waves of Ultron’s drones and sentries, then Ultron Prime itself. Repulsors draw on the arc reactor; kills charge the unibeam. When a sentry glows red, or the ground lights up under you, strafe.</p>
                <StartNote />
                <ul className="hq-keys">
                  <li>
                    <kbd>Mouse</kbd> aim, hold to fire
                  </li>
                  <li>
                    <kbd>A</kbd>
                    <kbd>D</kbd> strafe
                  </li>
                  <li>
                    <kbd>E</kbd> or right-click: unibeam
                  </li>
                  <li>
                    <kbd>Space</kbd> fire, F.R.I.D.A.Y. aims
                  </li>
                </ul>
                <TouchHelp game="repulsor" />
                <button type="button" className="btn btn-primary mt-5" disabled={!startable(stage.status)} onClick={start}>
                  Suit up
                </button>
                {best > 0 && <p className="hq-overlay-best">Best {fmt(best)}</p>}
              </>
            )}
          </div>
        ))}
      <p className="sr-only" role="status">
        {playing ? `Wave ${ui.wave}. Armour ${ui.armor}. ${ui.message}` : ''}
      </p>
    </HQGame>
  );
}

// ── the HUD, drawn every frame over the 3D view ──
const calm = typeof window !== 'undefined' && prefersReducedMotion();
function drawHud(cv, s, view, a, f, dt, live) {
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
  f.hitMark = Math.max(0, f.hitMark - dt);
  f.hurt = Math.max(0, f.hurt - dt * 1.6);

  // taking a hit: the visor's edge flares red
  if (f.hurt > 0 && !calm) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(255,40,30,0)');
    g.addColorStop(1, `rgba(255,40,30,${0.55 * f.hurt})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (!live) return;
  const t = s.t;
  ctx.lineWidth = 1.5;
  ctx.font = '600 10px "Archivo Variable", Archivo, sans-serif';
  ctx.textAlign = 'center';

  // brackets on every target, red for the ones about to hurt
  for (const e of s.enemies) {
    const center = e.kind === 'prime' ? { x: e.x, y: e.y, z: e.z } : e;
    const p = view.project(center.x, center.y, center.z);
    const dist = Math.hypot(center.x - s.x, center.y - EYE, center.z);
    const threat = e.kind === 'missile' || e.committed || (e.kind === 'sentry' && e.charging > 0);
    const color = threat ? '255,72,58' : e.kind === 'prime' ? '255,196,92' : '150,236,255';
    if (!p.front || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
      // off screen: an arrow at the edge
      const ang = Math.atan2((p.front ? p.y : h - p.y) - h / 2, (p.front ? p.x : w - p.x) - w / 2);
      const ex = w / 2 + Math.cos(ang) * (w / 2 - 22);
      const ey = h / 2 + Math.sin(ang) * (h / 2 - 22);
      ctx.save();
      ctx.translate(Math.max(18, Math.min(w - 18, ex)), Math.max(18, Math.min(h - 18, ey)));
      ctx.rotate(ang);
      ctx.fillStyle = `rgba(${color},0.85)`;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }
    const size = Math.max(9, Math.min(e.kind === 'prime' ? 120 : 44, (e.kind === 'prime' ? 2600 : 700) / Math.max(4, dist)));
    ctx.strokeStyle = `rgba(${color},${threat ? 0.95 : 0.6})`;
    const c = size * 0.42;
    ctx.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      ctx.moveTo(p.x + sx * size, p.y + sy * size - sy * c);
      ctx.lineTo(p.x + sx * size, p.y + sy * size);
      ctx.lineTo(p.x + sx * size - sx * c, p.y + sy * size);
    }
    ctx.stroke();
    if (e.kind === 'sentry' && e.charging > 0) {
      const k = 1 - e.charging / 0.9;
      ctx.strokeStyle = `rgba(255,72,58,${0.5 + 0.5 * Math.sin(t * 30)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * (1.6 - k * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.kind === 'missile' && dist < 60) {
      ctx.fillStyle = 'rgba(255,72,58,0.9)';
      ctx.fillText(`${Math.round(dist)} m`, p.x, p.y + size + 12);
    }
  }

  // Ultron Prime's armour, across the top
  const prime = s.enemies.find((e) => e.kind === 'prime' && e.arrived);
  if (prime) {
    const bw = Math.min(360, w * 0.6);
    const x0 = (w - bw) / 2;
    const y0 = 46;
    ctx.fillStyle = 'rgba(255,196,92,0.95)';
    ctx.fillText('ULTRON PRIME', w / 2, y0 - 6);
    const plates = prime.parts.filter((p) => !p.core);
    const core = prime.parts.find((p) => p.core);
    const seg = (bw * 0.5 - 12) / plates.length;
    plates.forEach((p, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x0 + i * (seg + 4), y0, seg, 6);
      ctx.fillStyle = 'rgba(255,196,92,0.95)';
      ctx.fillRect(x0 + i * (seg + 4), y0, seg * Math.max(0, p.hp / 7), 6);
    });
    const cx = x0 + bw * 0.5 + 4;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx, y0, bw * 0.5 - 4, 6);
    ctx.fillStyle = plates.some((p) => p.hp > 0) ? 'rgba(255,72,58,0.45)' : 'rgba(255,72,58,0.95)';
    ctx.fillRect(cx, y0, (bw * 0.5 - 4) * Math.max(0, core.hp / 26), 6);
  }

  // the reticle, with the reactor's energy round it
  const keyAim = a.keyFire && performance.now() - a.movedAt > 1200;
  let rx = ((a.nx + 1) / 2) * w;
  let ry = ((1 - a.ny) / 2) * h;
  if (keyAim) {
    const d = s.input.aim;
    const p = view.project(s.x + d.x * 40, EYE + d.y * 40, d.z * 40);
    rx = p.x;
    ry = p.y;
  }
  const onTarget = !!rayHit(s, s.input.aim);
  const rr = 13 + (f.hitMark > 0 ? 4 : 0);
  ctx.strokeStyle = onTarget ? 'rgba(255,214,120,0.95)' : 'rgba(190,244,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(rx, ry, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.moveTo(rx + dx * (rr + 3), ry + dy * (rr + 3));
    ctx.lineTo(rx + dx * (rr + 9), ry + dy * (rr + 9));
  }
  ctx.stroke();
  ctx.strokeStyle = s.energy < RANGE.shotCost ? 'rgba(255,72,58,0.9)' : 'rgba(120,226,255,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(rx, ry, rr + 14, Math.PI * 0.6, Math.PI * 0.6 + Math.PI * 0.8 * (s.energy / RANGE.energy));
  ctx.stroke();
  if (s.charge >= 100) {
    ctx.strokeStyle = `rgba(190,244,255,${0.5 + 0.4 * Math.sin(t * 8)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, rr + 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (f.hitMark > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${f.hitMark * 5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      ctx.moveTo(rx + dx * 5, ry + dy * 5);
      ctx.lineTo(rx + dx * 11, ry + dy * 11);
    }
    ctx.stroke();
  }
}
