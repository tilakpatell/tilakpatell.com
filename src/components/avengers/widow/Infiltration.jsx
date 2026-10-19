import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HQGame, { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { earnStone, hasEarned, recordTry } from '../hq/stones';
import { useAchievements } from '../../Achievements';
import { useGame3D } from '../hq/useGame3D';
import { local, prefersReducedMotion } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { BITE, DIRS, LEVEL_COUNT, act, biteTargets, cloneState, guardAt, laserOn, newLevel, parseLevel, pathTo, solveLevel } from './rules';
import { readCleared, recordWin } from './save';
import { CAUGHT, levelEnd } from './ends';
import { KEY_DIRS } from './flatInput';
import Dossier from './Dossier';
import InfiltrationFlat from './Flat';
import './widow.css';
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
const HOLO = 'tp-hq-widow-holo';
const TURN_MS = 230;



export default function Infiltration({ fallback }) {
  const three = useGame3D('widow');
  const stage = useStage(gameModule, { enabled: three.on, id: 'widow', forced: three.mode === 'on', own3D: true });
  const { unlock } = useAchievements();
  const [cleared, setCleared] = useState(readCleared);
  // (the 2D view writes the same save, so the 3D menu reads it again on the way back)
  useEffect(() => {
    if (three.on) setCleared(readCleared());
  }, [three.on]);
  const [index, setIndex] = useState(() => Math.min(readCleared(), LEVEL_COUNT - 1));
  const game = useRef(newLevel(index));
  const hud = useRef(null);
  const [ui, setUi] = useState({ phase: 'menu', result: null, caught: null, fresh: -1 });
  const [, setTick] = useState(0);
  const [aiming, setAiming] = useState(false);
  const [paused, setPaused] = useState(false);
  const [flatLive, setFlatLive] = useState(false); // the 2D view's level in play
  const [holo, setHolo] = useState(() => local.get(HOLO, false) === true);
  const hover = useRef(null); // the tile under the mouse
  const busyUntil = useRef(0);
  const queued = useRef(null);
  const timers = useRef([]);
  const fx = useRef({ alert: null, said: '' });
  const calm = useMemo(() => prefersReducedMotion(), []);
  const playing = ui.phase === 'play' || ui.phase === 'caught';

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => stage.view.current?.setHolo?.(holo), [holo, stage.status, stage.view]);

  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);
  const refresh = () => setTick((n) => n + 1);

  const enter = useCallback(
    (i) => {
      audioContext(); // in the click, so the first sound can be heard
      recordTry('widow');
      timers.current.forEach(clearTimeout);
      game.current = newLevel(i);
      setIndex(i);
      setAiming(false);
      setPaused(false);
      queued.current = null;
      busyUntil.current = 0;
      fx.current = { alert: null, said: '' };
      setUi({ phase: 'play', result: null, caught: null, fresh: -1 });
      focus();
    },
    [focus],
  );

  // the rules' events: sound, haptics, the overlays, progress, the stone
  const handle = useCallback(
    (events) => {
      const g = game.current;
      for (const e of events) {
        switch (e.type) {
          case 'takedown':
            play('hit');
            buzz(40);
            break;
          case 'bite':
            play('zip');
            play('sizzle');
            buzz(30);
            break;
          case 'hack':
            play('beeps');
            break;
          case 'file':
            play('ding');
            buzz(20);
            break;
          case 'locked':
            play('buzz');
            break;
          case 'bump':
            if (e.why === 'charges' || e.why === 'bite') play('knock');
            break;
          case 'caught': {
            play('alarm');
            buzz(120);
            fx.current.alert = { ...e, t: performance.now() };
            setUi((u) => ({ ...u, phase: 'caught', caught: e }));
            // a beat to see what happened, then back to the start
            timers.current.push(
              setTimeout(
                () => {
                  // (caught: the level starts again, and that's a try)
                  recordTry('widow');
                  game.current = newLevel(g.index);
                  fx.current.alert = null;
                  busyUntil.current = 0;
                  queued.current = null;
                  setUi((u) => ({ ...u, phase: 'play', caught: null }));
                },
                calm ? 900 : 1250,
              ),
            );
            break;
          }
          case 'won': {
            play('decode');
            const { cleared: c, fresh } = recordWin(e.index);
            setCleared(c);
            setUi((u) => ({ ...u, phase: 'cleared', fresh, result: { turns: e.turns, takedowns: g.takedowns, bites: g.bites, stone: false } }));
            break;
          }
          case 'reward': {
            unlock('widow');
            earnStone('soul-natasha');
            play('stone');
            timers.current.push(setTimeout(() => play('victory'), 600));
            setUi((u) => ({ ...u, result: { ...u.result, stone: true, both: hasEarned('soul') } }));
            break;
          }
          default:
        }
      }
    },
    [calm, unlock],
  );

  // one action, unless a turn is still playing out (then it waits its turn)
  const doAction = useCallback(
    (a) => {
      const g = game.current;
      if (g.phase !== 'play' || paused) return;
      const now = performance.now();
      if (now < busyUntil.current) {
        queued.current = a;
        return;
      }
      const ev = act(g, a);
      if (!ev.length) return;
      stage.view.current?.fx(ev, g);
      handle(ev);
      if (ev[0].type !== 'bump') busyUntil.current = now + TURN_MS;
      setAiming(false);
      refresh();
    },
    [handle, paused, stage.view],
  );

  const bite = useCallback(
    (dir) => {
      const targets = biteTargets(game.current);
      if (dir) return doAction({ type: 'bite', dir });
      if (targets.length === 1) return doAction({ type: 'bite', dir: targets[0].dir });
      if (targets.length > 1) return setAiming(true);
      play('knock');
      return undefined;
    },
    [doAction],
  );

  // browser checks
  useEffect(
    () =>
      register('widow', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        get ui() {
          return ui;
        },
        start: enter,
        act: doAction,
        setState(name) {
          if (name === 'menu') {
            setUi({ phase: 'menu', result: null, caught: null, fresh: -1 });
            return { state: name };
          }
          const m = /^level(\d)$/.exec(name);
          if (m) {
            enter(Number(m[1]) - 1);
            return { state: name };
          }
          if (name === 'action') {
            // the last level, a few moves in: guards, a camera, a laser, the file
            enter(LEVEL_COUNT - 1);
            const sol = solveLevel(LEVEL_COUNT - 1);
            for (const a of sol.actions.slice(0, 3)) act(game.current, a);
          } else if (name === 'caught') {
            enter(0);
            const g = game.current;
            // walk straight up into the corridor as the guard comes by
            for (const a of [{ type: 'move', dir: 'N' }, { type: 'move', dir: 'N' }]) {
              const ev = act(g, a);
              stage.view.current?.fx(ev, g);
              handle(ev);
              if (g.phase !== 'play') break;
            }
          } else if (name === 'won') {
            enter(LEVEL_COUNT - 1);
            const g = game.current;
            const sol = solveLevel(LEVEL_COUNT - 1);
            for (const a of sol.actions) {
              const ev = act(g, a);
              if (g.phase !== 'play') {
                stage.view.current?.fx(ev, g);
                handle(ev);
                break;
              }
            }
          }
          refresh();
          return { state: name, phase: game.current.phase, turns: game.current.turns };
        },
      }),
    [enter, doAction, handle, stage.view, ui],
  );

  // what the pointer would do: the route to it, the step a click takes, and
  // whether that step gets her seen
  const preview = () => {
    const g = game.current;
    if (g.phase !== 'play' || ui.phase !== 'play' || !hover.current) return null;
    const { x, y } = hover.current;
    const bt = biteTargets(g).find((b) => b.guard.x === x && b.guard.y === y);
    if (bt) return { bite: bt };
    const path = pathTo(g, x, y);
    if (!path?.length) return null;
    const [sx, sy] = path[0];
    const dir = Object.keys(DIRS).find((d) => DIRS[d][0] === sx - g.px && DIRS[d][1] === sy - g.py);
    const trial = cloneState(g);
    const ev = act(trial, { type: 'move', dir });
    const target = guardAt(g, sx, sy) || g.def.grid[sy][sx] === 'T';
    return { path, dir, step: { x: target ? g.px : sx, y: target ? g.py : sy, dir, danger: trial.phase === 'caught', bump: ev[0]?.type === 'bump' } };
  };

  // ── the loop ──
  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      const g = game.current;
      // (a takedown's hitstop: the scene's feel slows her and the guards a moment)
      const real = Math.min(0.05, dtMs / 1000);
      const dt = real * view.timeScale(real);
      if (queued.current && performance.now() >= busyUntil.current) {
        const a = queued.current;
        queued.current = null;
        doAction(a);
      }
      const p = preview();
      const bites = ui.phase === 'play' ? biteTargets(g).map((b) => ({ guard: b.guard.id, dir: b.dir })) : [];
      const r = view.render(g, dt, { path: p?.path, step: p?.step, bites, hoverBite: p?.bite?.guard.id, busy: performance.now() < busyUntil.current });
      if (r?.then) r.catch(() => {});
      drawHud(hud.current, g, view, fx.current, calm);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doAction, stage.view, ui.phase, calm],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // nothing stays held or aimed when the window loses focus
  useEffect(() => {
    const stop = () => {
      hover.current = null;
      queued.current = null;
      setAiming(false);
    };
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);

  // ── input ──
  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (!playing) {
      if ((k === 'enter' || k === ' ') && e.target === e.currentTarget && ui.phase === 'menu') {
        e.preventDefault();
        enter(index);
      }
      return;
    }
    if (paused || ui.phase !== 'play') return;
    if (KEY_DIRS[k]) {
      e.preventDefault();
      if (e.repeat) return;
      if (aiming) bite(KEY_DIRS[k]);
      else doAction({ type: 'move', dir: KEY_DIRS[k] });
    } else if (k === ' ' || k === '.' || k === 'enter') {
      e.preventDefault();
      if (!e.repeat) doAction({ type: 'wait' });
    } else if (k === 'e' || k === 'b') {
      e.preventDefault();
      if (!e.repeat) bite();
    } else if (k === 'escape') {
      if (aiming) {
        e.preventDefault();
        setAiming(false);
      } else {
        e.preventDefault();
        setUi((u) => ({ ...u, phase: 'menu' }));
      }
    } else if (k === 'r') {
      e.preventDefault();
      enter(index);
    } else if (k === 'h') {
      e.preventDefault();
      toggleHolo();
    }
  };
  const tileFrom = (e) => {
    const view = stage.view.current;
    if (!view) return null;
    const r = e.currentTarget.getBoundingClientRect();
    return view.tileAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' || ui.phase !== 'play') return;
    hover.current = tileFrom(e);
  };
  const onPointerLeave = () => (hover.current = null);
  const onPointerUp = (e) => {
    if (ui.phase !== 'play' || paused || e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = tileFrom(e);
    if (!t) return;
    const g = game.current;
    if (t.x === g.px && t.y === g.py) return doAction({ type: 'wait' });
    const bt = biteTargets(g).find((b) => b.guard.x === t.x && b.guard.y === t.y);
    if (bt && (aiming || Math.abs(t.x - g.px) + Math.abs(t.y - g.py) > 1 || bt.guard.dir === Object.keys(DIRS).find((d) => DIRS[d][0] === g.px - t.x && DIRS[d][1] === g.py - t.y))) return doAction({ type: 'bite', dir: bt.dir });
    const path = pathTo(g, t.x, t.y);
    if (!path?.length) return undefined;
    const [sx, sy] = path[0];
    const dir = Object.keys(DIRS).find((d) => DIRS[d][0] === sx - g.px && DIRS[d][1] === sy - g.py);
    if (e.pointerType !== 'mouse') hover.current = null;
    return doAction({ type: 'move', dir });
  };
  const toggleHolo = () =>
    setHolo((h) => {
      local.set(HOLO, !h);
      return !h;
    });

  const g = game.current;
  const def = parseLevel(index);
  const charges = g.charges;
  const objective = g.file ? 'Get to the lift' : 'Get the file';
  const total = LEVEL_COUNT;
  const nextUnlocked = Math.min(total - 1, cleared);
  // the bar's Pause, and a hidden tab: as Esc does
  const pause = (p) => setPaused(p);
  return (
    <HQGame
      game="widow"
      playing={playing || flatLive}
      paused={paused}
      onPause={pause}
      flat={<InfiltrationFlat paused={paused} onLive={setFlatLive} />}
      stage={stage}
      three={three}
      fallback={fallback}
      className="iw-game"
      accent="#7fd8ff"
      label="Infiltration. Plan Natasha’s route through a HYDRA facility, a turn at a time. Arrow keys or W A S D move her one tile; Space waits; E or B uses the Widow’s Bite on a guard in line up to two tiles away; R restarts the level; H switches the hologram view. Step into a guard from behind or the side to take him down, and into a terminal to hack it. With a mouse, click a tile to step towards it, or a guard to bite him. On a touch screen, tap, or use the pad."
      screenProps={{ onKeyDown, onPointerMove, onPointerUp, onPointerLeave, onContextMenu: (e) => e.preventDefault(), style: { touchAction: playing ? 'manipulation' : 'auto' }, 'data-holo': holo || undefined, 'data-alarm': (ui.phase === 'caught' && !calm) || undefined }}
    >
      <canvas ref={hud} className="iw-hud-canvas" aria-hidden="true" />
      <div className="iw-vignette" aria-hidden="true" />
      {playing && (
        <div className="iw-hud" aria-hidden="true">
          <div className="iw-level">
            <span className="iw-level-n">
              {String(index + 1).padStart(2, '0')}
              <small>/{String(total).padStart(2, '0')}</small>
            </span>
            <span className="iw-level-name">{def.name}</span>
            <span className="iw-objective" data-file={g.file || undefined}>
              <i aria-hidden="true" />
              {objective}
            </span>
          </div>
          <div className="iw-stats">
            <span className="iw-turns">
              {g.turns}
              <small>{g.turns === 1 ? 'turn' : 'turns'}</small>
            </span>
            {def.charges > 0 && (
              <span className="iw-charges" title="Widow’s Bite charges">
                {Array.from({ length: def.charges }, (_, i) => (
                  <i key={i} data-on={i < charges || undefined} />
                ))}
                <small>Bite</small>
              </span>
            )}
          </div>
          <p className="iw-tip">{aiming ? 'Widow’s Bite: pick a direction (Esc to cancel).' : def.tip}</p>
        </div>
      )}
      {playing && (
        <div className="iw-tools" onPointerUp={(e) => e.stopPropagation()}>
          <button type="button" className="iw-tool" onClick={() => enter(index)} aria-label="Restart the level" title="Restart (R)">
            ↺
          </button>
          <button type="button" className="iw-tool" aria-pressed={holo} onClick={toggleHolo} aria-label="Hologram view" title="Hologram view (H)">
            ◫
          </button>
          <button type="button" className="iw-tool" onClick={() => setUi((u) => ({ ...u, phase: 'menu' }))} aria-label="Levels and the file" title="Levels (Esc)">
            ☰
          </button>
        </div>
      )}
      {playing && (
        <div className="iw-pad" onPointerUp={(e) => e.stopPropagation()}>
          <button type="button" className="iw-pad-btn iw-up" aria-label="Move north" onClick={() => (aiming ? bite('N') : doAction({ type: 'move', dir: 'N' }))}>
            ▲
          </button>
          <button type="button" className="iw-pad-btn iw-left" aria-label="Move west" onClick={() => (aiming ? bite('W') : doAction({ type: 'move', dir: 'W' }))}>
            ◀
          </button>
          <button type="button" className="iw-pad-btn iw-wait" aria-label="Wait a turn" onClick={() => doAction({ type: 'wait' })}>
            Wait
          </button>
          <button type="button" className="iw-pad-btn iw-right" aria-label="Move east" onClick={() => (aiming ? bite('E') : doAction({ type: 'move', dir: 'E' }))}>
            ▶
          </button>
          <button type="button" className="iw-pad-btn iw-down" aria-label="Move south" onClick={() => (aiming ? bite('S') : doAction({ type: 'move', dir: 'S' }))}>
            ▼
          </button>
          {def.charges > 0 && (
            <button type="button" className="iw-pad-btn iw-bite" aria-pressed={aiming} disabled={!charges} onClick={() => (aiming ? setAiming(false) : bite())}>
              Bite
            </button>
          )}
        </div>
      )}
      {ui.phase === 'caught' && (
        <div className="iw-alert" role="alert">
          <p className="iw-alert-title">Spotted</p>
          <p className="iw-alert-text">{CAUGHT[ui.caught?.by] ?? ''} Back to the start.</p>
        </div>
      )}
      {playing && paused && (
        <div className="hq-overlay iw-overlay">
          <p className="hq-overlay-title">Paused</p>
          <p className="hq-overlay-text">
            Level {index + 1}, {def.name}.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => {
              setPaused(false);
              focus();
            }}
          >
            Resume
          </button>
        </div>
      )}
      {ui.phase === 'cleared' && (
        <Results
          className="iw-overlay"
          {...levelEnd(ui.result, index)}
          onAgain={() => enter(index)}
          onward={index + 1 < total ? { label: 'Next level', onClick: () => enter(index + 1) } : null}
          more={{ label: 'All levels', onClick: () => setUi((u) => ({ ...u, phase: 'menu' })) }}
        >
          <Dossier cleared={cleared} fresh={ui.fresh} onPick={enter} />
        </Results>
      )}
      {ui.phase === 'menu' && (
        <div className="hq-overlay iw-overlay">
          <p className="hq-overlay-kicker">Operations · the holotable · a HYDRA facility</p>
          <p className="hq-overlay-title">Infiltration</p>
          <p className="hq-overlay-text">Plan Natasha’s way in a move at a time: every move she makes, the guards make one too. Stay out of their torches and the cameras’ sweeps, take them down from behind, and get her file out.</p>
          <StartNote />
          <ul className="hq-keys">
            <li>
              <kbd>←</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd> move
            </li>
            <li>
              <kbd>Space</kbd> wait
            </li>
            <li>
              <kbd>E</kbd> Widow’s Bite
            </li>
            <li>or click a tile</li>
          </ul>
          <TouchHelp game="widow" />
          <button type="button" className="btn btn-primary mt-4" onClick={() => enter(nextUnlocked)}>
            {cleared === 0 ? 'Go in' : cleared >= total ? 'Play again' : `Level ${nextUnlocked + 1}`}
          </button>
          <Dossier cleared={cleared} fresh={-1} onPick={(i) => enter(i)} />
        </div>
      )}
      <p className="sr-only" role="status">
        {ui.phase === 'play' ? `Level ${index + 1}, ${def.name}. ${objective}. ${g.turns} turns.${def.charges ? ` ${charges} bites left.` : ''}` : ui.phase === 'caught' ? `Spotted. ${CAUGHT[ui.caught?.by] ?? ''}` : ui.phase === 'cleared' ? `Level ${index + 1} cleared in ${ui.result?.turns} turns.` : ''}
      </p>
    </HQGame>
  );
}

// ── over the 3D view each frame: the stunned guards' count, the spotter's
// alarm, the lasers' coming turns, the lift while it's locked ──
function drawHud(cv, g, view, f, calm) {
  if (!cv || !view?.project) return;
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
  if (!g.def) return;
  const font = (size, weight = 700) => `${weight} ${size}px "Archivo Variable", Archivo, sans-serif`;
  const t = performance.now() / 1000;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // stunned guards: pips for the turns until they come round
  g.guards.forEach((gd, i) => {
    if (gd.down || gd.stun <= 0) return;
    const p = view.guardScreen(i, 2.05);
    if (!p?.front) return;
    const n = gd.stun;
    for (let k = 0; k < BITE.stun - 1; k++) {
      ctx.fillStyle = k < n ? '#8fe6ff' : 'rgba(143,230,255,0.22)';
      ctx.fillRect(p.x - 13 + k * 10, p.y - 3, 7, 5);
    }
    ctx.font = font(10, 800);
    ctx.fillStyle = '#bff0ff';
    ctx.fillText('STUNNED', p.x, p.y - 12);
  });
  // whoever saw her
  if (f.alert) {
    const a = f.alert;
    let p = null;
    if (a.by === 'guard') p = view.guardScreen(a.id, 2.3);
    else if (a.by === 'camera') {
      const c = g.def.cameras[a.id];
      p = view.project(c.x + DIRS[c.wall][0] * 0.5, c.y + DIRS[c.wall][1] * 0.5, 2.2);
    } else p = view.project(a.x, a.y, 1.6);
    if (p?.front) {
      const k = Math.min(1, (performance.now() - a.t) / 180);
      const s = calm ? 1 : 0.6 + 0.4 * k + (k >= 1 ? Math.sin(t * 14) * 0.05 : 0);
      ctx.save();
      ctx.translate(p.x, p.y - 8);
      ctx.scale(s, s);
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(16, 10);
      ctx.lineTo(-16, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = font(18, 900);
      ctx.fillText('!', 0, 1);
      ctx.restore();
    }
  }
  // lasers: the next five turns, lit where they fire
  for (const l of g.def.lasers) {
    const [x, y] = l.cells[0];
    const p = view.project(x, y, 1.25);
    if (!p.front) continue;
    for (let k = 0; k < 5; k++) {
      const on = laserOn(g.def, l.id, g.t + k);
      ctx.fillStyle = on ? (k === 0 ? '#ff4a3a' : 'rgba(255,74,58,0.8)') : 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(p.x - 16 + k * 8, p.y, k === 0 ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the lift, until she has the file
  if (!g.file && g.phase === 'play') {
    const [ex, ey] = g.def.exit;
    const p = view.project(ex, ey, 0.9);
    if (p.front) {
      ctx.font = font(9, 800);
      ctx.fillStyle = 'rgba(255,120,110,0.9)';
      ctx.fillText('LOCKED', p.x, p.y);
    }
  }
}
