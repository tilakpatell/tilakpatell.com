import { useCallback, useEffect, useRef, useState } from 'react';
import HQGame, { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { earnStone, hasEarned, recordTry } from '../hq/stones';
import { HALF_OF } from '../world/labels';
import { newSeed } from '../hq/rng';
import { useAchievements } from '../../Achievements';
import { useGame3D } from '../hq/useGame3D';
import { local, prefersReducedMotion } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { useSays } from '../hq/useSays';
import { BOW, EYE, ROUNDS, STONE_SCORE, draw, drawCap, letDown, newRange, nockTrick, pathAt, shakeOf, speedFor, startRound, stepRange, targetAt, toggleLob } from './rules';
import { TRICK_COLORS } from './models';
import { INTROS, SAYS, SPOKEN } from './lines';
import './trickshot.css';
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
const BEST = 'tp-hq-trickshot-best';
const STEP = 1 / 120;
const PITCH = -0.03;
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const TRICK_NAMES = { explosive: 'Explosive', emp: 'EMP', split: 'Split' };

// what Clint says at the start of each round and as it goes (./lines.js), in his own voice where it's been made (lib/voiced.js)
const VOICED = new Set(SPOKEN);

const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });

export default function TrickShot({ fallback }) {
  const three = useGame3D('trickshot');
  const stage = useStage(gameModule, { enabled: three.on, id: 'trickshot', forced: three.mode === 'on', own3D: true });
  const { unlock } = useAchievements();
  const game = useRef(newRange({ seed: 1 }));
  const hud = useRef(null);
  const aim = useRef({ yaw: 0, pitch: PITCH, dir: dirOf(0, PITCH), mode: 'mouse', touch: null, keys: new Set(), keyDraw: false });
  const acc = useRef(0);
  const fxState = useRef({ popups: [], lastUi: 0, warned: false, walled: false });
  const [best, setBest] = useState(() => Number(local.get(BEST, 0)) || 0);
  const [ui, setUi] = useState({ phase: 'ready', round: 1, time: ROUNDS[0].time, arrows: ROUNDS[0].arrows, score: 0, total: 0, streak: 0, tricks: [], nocked: null, lob: false, wind: 0, drawing: false, message: '', roundScores: [], result: null });
  const [paused, setPaused] = useState(false);
  const live = ui.phase === 'live';
  useSays('clint', ui.message, VOICED);

  const sync = useCallback((extra = {}) => {
    const g = game.current;
    const s = g.s;
    if (!s) return;
    setUi((u) => ({ ...u, phase: g.phase, round: g.round + 1, time: s.time, arrows: s.arrows, score: s.score, total: g.total + (g.phase === 'live' ? s.score : 0), streak: s.streak, tricks: [...s.tricks], nocked: s.nocked, lob: s.lob, wind: s.wind * s.windDir, drawing: s.drawing, roundScores: [...g.roundScores], ...extra }));
  }, []);

  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);

  const begin = useCallback(
    (round) => {
      audioContext(); // in the click, so the bow can be heard
      if (round === 0) {
        recordTry('hawkeye'); // (rounds 2 and 3 are the same try)
        game.current = newRange({ seed: newSeed() });
        fxState.current.walled = false;
      }
      const ev = startRound(game.current, round);
      acc.current = 0;
      fxState.current.popups = [];
      fxState.current.warned = false;
      setPaused(false);
      stage.view.current?.fx(ev, game.current);
      sync({ message: INTROS[round], result: null });
      play('beeps');
      focus();
    },
    [focus, stage.view, sync],
  );

  // browser checks: the game, its view, and ways to jump to a state
  useEffect(
    () =>
      register('trickshot', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        begin,
        aim(yaw, pitch) {
          const a = aim.current;
          a.yaw = yaw;
          a.pitch = pitch;
          a.dir = dirOf(yaw, pitch);
          a.mode = 'keys';
        },
        draw: (on) => draw(game.current, on),
        setState(name) {
          const n = { round1: 0, round2: 1, round3: 2 }[name];
          if (n != null) begin(n);
          if (name === 'drawn') {
            // round 1 at full draw on the 30 m board
            begin(0);
            const s = game.current.s;
            s.wind = 0.4;
            const p = targetAt(s.targets[1], s);
            const a = aim.current;
            a.yaw = Math.atan2(p.x, -p.z);
            a.pitch = Math.atan2(p.y - EYE + 0.6, -p.z);
            a.dir = dirOf(a.yaw, a.pitch);
            a.mode = 'keys';
            draw(game.current, true);
            s.draw = 1;
            stage.view.current?.snap();
          }
          if (name === 'action') {
            // a busy moment for screenshots: round 3, a drawn bow, arrows in the boards
            begin(2);
            const s = game.current.s;
            s.stuck.push({ target: 1, dx: 0.12, dy: -0.08, trick: null, dir: [0, -0.06, -1] }, { target: 2, dx: -0.2, dy: 0.1, trick: null, dir: [0.02, -0.05, -1] }, { target: 2, dx: 0.05, dy: 0.02, trick: null, dir: [0.01, -0.05, -1] });
            s.tricks = ['explosive', 'emp'];
            s.clays.push({ id: 900, x: -6, y: 6, z: -26, vx: 9, vy: 4, vz: 0, alive: true });
            s.claysLeft = 0;
            draw(game.current, true);
            s.draw = 1;
            stage.view.current?.snap();
          }
          sync();
          return { state: name };
        },
      }),
    [begin, stage.view, sync],
  );

  // the events of a step: sound, haptics, popups and the HUD
  const handle = useCallback(
    (events) => {
      const g = game.current;
      const s = g.s;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        switch (e.type) {
          case 'draw':
            play('creak');
            break;
          case 'loose':
            play('twang');
            buzz(15);
            break;
          case 'dud':
            play('knock');
            important = { message: SAYS.dud };
            break;
          case 'ring':
            play('thunk');
            if (e.ring >= 10) play('ding');
            break;
          case 'hit': {
            if (e.kind === 'clay') play('shatter');
            else if (e.kind === 'drone') play('blast');
            const label = e.kind === 'clay' ? 'Clay' : e.kind === 'drone' ? 'Drone' : null;
            const last = events.find((x) => x.type === 'ring');
            const text = label ? `${label} +${e.score}` : last?.x ? `X +${e.score}` : `+${e.score}`;
            f.popups.push({ x: e.x, y: e.y, z: e.z, text, t: 0, gold: !!last && last.ring >= 9 });
            if (e.streak >= 2 && e.streak % 3 !== 0) f.popups.push({ x: e.x, y: e.y + 0.6, z: e.z, text: `${e.streak} in a row`, t: -0.15, small: true });
            break;
          }
          case 'trick':
            play('coin');
            important = { message: `${s.streak} in a row: a${e.trick === 'explosive' || e.trick === 'emp' ? 'n' : ''} ${TRICK_NAMES[e.trick].toLowerCase()} arrow. Q (or right-click) puts it on the string.` };
            break;
          case 'nock':
            important = { message: e.trick ? `${TRICK_NAMES[e.trick]} arrow on the string.` : 'Plain arrow on the string.' };
            break;
          case 'lob':
            important = { message: e.on ? SAYS.lob : 'Full draw.' };
            break;
          case 'blast':
            play('boom');
            buzz(60);
            break;
          case 'emp':
            play('sizzle');
            important = { message: SAYS.emp };
            break;
          case 'clay':
            play('pop');
            break;
          case 'wall':
            play('thunk');
            if (!f.walled) {
              f.walled = true;
              important = { message: SAYS.wall };
            }
            break;
          case 'roundEnd': {
            const last = e.last;
            let stone = false;
            let newBest = false;
            if (last) {
              if (e.stone) {
                earnStone('soul-clint');
                unlock('hawkeye');
                stone = true;
                play('victory');
              } else play('applause');
              newBest = e.total > best;
              if (newBest) {
                setBest(e.total);
                local.set(BEST, e.total);
              }
            } else play('ding');
            important = { message: '', result: { round: e.n, score: e.score, total: e.total, last, stone, whole: stone && hasEarned('soul-natasha'), newBest } };
            break;
          }
          default:
        }
      }
      if (important) sync(important);
      else if (s && s.t - f.lastUi > 0.1) {
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
      const g = game.current;
      const dt = Math.min(0.05, dtMs / 1000);
      const a = aim.current;
      const playing = g.phase === 'live' && !paused;
      if (playing) {
        // held keys turn the aim, slower with Shift and while drawn
        if (a.keys.size) {
          const k = (a.keys.has('shift') ? 0.12 : 0.45) * dt * (g.s.drawing ? 0.55 : 1);
          const h = (a.keys.has('right') ? 1 : 0) - (a.keys.has('left') ? 1 : 0);
          const v = (a.keys.has('up') ? 1 : 0) - (a.keys.has('down') ? 1 : 0);
          if (h || v) {
            a.yaw = Math.max(-1.1, Math.min(1.1, a.yaw + h * k));
            a.pitch = Math.max(-0.3, Math.min(0.6, a.pitch + v * k));
            a.dir = dirOf(a.yaw, a.pitch);
            a.mode = 'keys';
          }
        }
        g.s.aim = a.dir;
        acc.current += dt * view.timeScale(dt);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepRange(g, STEP));
          if (g.phase !== 'live') break;
        }
        if (events.length) {
          view.fx(events, g);
          handle(events);
        }
      }
      view.render(g.s ? g : null, dt, { aim: a.dir, input: a.mode === 'mouse' ? 'mouse' : 'free' });
      drawHud(hud.current, g, view, a, fxState.current, dt, playing);
    },
    [handle, paused, stage.view],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // let the string down when the window loses focus or the game scrolls away
  useEffect(() => {
    const stop = () => {
      letDown(game.current);
      aim.current.keys.clear();
      aim.current.touch = null;
      aim.current.keyDraw = false;
    };
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => {
    if (!stage.visible && live) {
      letDown(game.current);
      setPaused(true);
    }
  }, [stage.visible, live]);

  // ── input ──
  const pointerAim = (e) => {
    const view = stage.view.current;
    if (!view) return;
    const r = e.currentTarget.getBoundingClientRect();
    const d = view.aimAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    const a = aim.current;
    a.dir = d;
    a.yaw = Math.atan2(d.x, -d.z);
    a.pitch = Math.asin(d.y);
    a.mode = 'mouse';
  };
  const onPointerMove = (e) => {
    const a = aim.current;
    if (e.pointerType === 'mouse') {
      if (live) pointerAim(e);
      return;
    }
    // a finger drags the aim (it would hide the target if the aim sat under it)
    if (!a.touch || a.touch.id !== e.pointerId || !live) return;
    const k = (stage.view.current?.radPerPx() ?? 0.002) * 0.85;
    a.yaw = Math.max(-1.1, Math.min(1.1, a.yaw + (e.clientX - a.touch.x) * k));
    a.pitch = Math.max(-0.3, Math.min(0.6, a.pitch - (e.clientY - a.touch.y) * k));
    a.touch.x = e.clientX;
    a.touch.y = e.clientY;
    a.dir = dirOf(a.yaw, a.pitch);
    a.mode = 'touch';
  };
  const onPointerDown = (e) => {
    if (!live || paused || e.target.closest('button')) return;
    capturePointer(e);
    const g = game.current;
    if (e.pointerType === 'mouse') {
      pointerAim(e);
      if (e.button === 2) {
        nockTrick(g);
        return;
      }
      if (e.button === 0) draw(g, true);
      return;
    }
    if (aim.current.touch) return; // one finger draws; the others press buttons
    aim.current.touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    aim.current.mode = 'touch';
    draw(g, true);
  };
  const onPointerUp = (e) => {
    const a = aim.current;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) draw(game.current, false);
      return;
    }
    if (a.touch?.id !== e.pointerId) return;
    a.touch = null;
    draw(game.current, false);
  };
  const onPointerCancel = (e) => {
    if (aim.current.touch?.id === e.pointerId) aim.current.touch = null;
    letDown(game.current);
  };
  const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', shift: 'shift' };
  const onKeyDown = (e) => {
    const g = game.current;
    const k = e.key.toLowerCase();
    if (!live) {
      if ((k === 'enter' || k === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        if (ui.phase === 'ready' || ui.phase === 'done') begin(0);
        else if (ui.phase === 'roundEnd') begin(g.round + 1);
      }
      return;
    }
    if (k === 'p' || (k === 'escape' && !g.s.drawing)) {
      e.preventDefault();
      letDown(g);
      setPaused((p) => !p);
      return;
    }
    if (paused) return;
    if (KEYS[k]) {
      e.preventDefault();
      aim.current.keys.add(KEYS[k]);
    } else if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) {
        aim.current.keyDraw = true;
        draw(g, true);
      }
    } else if (k === 'q' || k === 'e') {
      e.preventDefault();
      nockTrick(g);
    } else if (k === 'f' || k === 'l') {
      e.preventDefault();
      toggleLob(g);
    } else if (k === 'escape' || k === 'x') {
      e.preventDefault();
      letDown(g);
    }
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    if (KEYS[k]) aim.current.keys.delete(KEYS[k]);
    if (k === ' ' && aim.current.keyDraw) {
      aim.current.keyDraw = false;
      draw(game.current, false);
    }
  };
  const press = (fn) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      fn();
    },
    onContextMenu: (e) => e.preventDefault(),
  });

  const R = ROUNDS[ui.round - 1] ?? ROUNDS[0];
  const res = ui.result;
  const ended = ui.phase === 'done';
  // the bar's Pause, and a hidden tab: as Esc does
  const pause = (p) => {
    letDown(game.current);
    setPaused(p);
  };
  return (
    <HQGame
      game="trickshot"
      playing={live}
      paused={paused}
      onPause={pause}
      stage={stage}
      three={three}
      fallback={fallback}
      className="ts-game"
      label="Trick Shot. Move the mouse to aim, hold the button to draw and let go to loose. The sight's pins show where the arrow lands at 20 to 60 metres. Right-click or Q nocks a trick arrow, F switches to a half draw for lobbing, Escape lets the string down. With the keyboard: arrow keys aim, hold Space to draw. On a touch screen, press to draw, drag to aim, lift to loose."
      screenProps={{
        onPointerMove,
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        onKeyUp,
        style: { touchAction: live ? 'none' : 'auto', cursor: live && !paused ? 'none' : 'auto' },
      }}
    >
      <canvas ref={hud} className="ts-hud-canvas" aria-hidden="true" />
      {live && (
        <div className="ts-hud" aria-hidden="true">
          <div className="ts-round">
            <span className="ts-round-n">
              Round {ui.round}
              <small>/{ROUNDS.length}</small>
            </span>
            <span className="ts-round-title">{R.title}</span>
          </div>
          <div className="ts-clock" data-low={ui.time < 10 || undefined}>
            {Math.ceil(ui.time)}
            <small>s</small>
          </div>
          <div className="ts-score">
            <span className="ts-score-n">{ui.score}</span>
            <span className="ts-score-total">
              total {ui.total} · stone at {STONE_SCORE}
            </span>
            {ui.streak >= 2 && <span className="ts-streak">{ui.streak} in a row</span>}
          </div>
          <div className="ts-quiver">
            <div className="ts-arrows" aria-label={`${ui.arrows} arrows`}>
              {Array.from({ length: R.arrows }, (_, i) => (
                <span key={i} data-on={i < ui.arrows || undefined} />
              ))}
            </div>
            <div className="ts-tricks">
              {ui.nocked && (
                <span className="ts-trick" data-nocked style={{ '--c': hex(TRICK_COLORS[ui.nocked]) }}>
                  {TRICK_NAMES[ui.nocked]}
                </span>
              )}
              {ui.tricks.map((t, i) => (
                <span key={i} className="ts-trick" style={{ '--c': hex(TRICK_COLORS[t]) }}>
                  {TRICK_NAMES[t]}
                </span>
              ))}
              {(ui.tricks.length > 0 || ui.nocked) && <kbd className="ts-kbd">Q</kbd>}
            </div>
          </div>
          <div className="ts-wind">
            <span className="ts-wind-label">Wind</span>
            <span className="ts-wind-arrow" style={{ '--k': Math.min(1, Math.abs(ui.wind) / 1.6), transform: ui.wind < 0 ? 'scaleX(-1)' : undefined }} />
            <span className="ts-wind-n">{Math.abs(ui.wind).toFixed(1)}</span>
            <span className="ts-draw-mode" data-lob={ui.lob || undefined}>
              {ui.lob ? 'Half draw' : 'Full draw'} <kbd className="ts-kbd">F</kbd>
            </span>
          </div>
          <p className="ts-message">{ui.message}</p>
        </div>
      )}
      {live && !paused && (
        <div className="ts-touch" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="ts-touch-btn" aria-pressed={ui.lob} {...press(() => toggleLob(game.current))}>
            {ui.lob ? 'Half' : 'Full'}
          </button>
          <button type="button" className="ts-touch-btn" disabled={!ui.tricks.length && !ui.nocked} {...press(() => nockTrick(game.current))}>
            Trick
          </button>
          <button type="button" className="ts-touch-btn" disabled={!ui.drawing} {...press(() => letDown(game.current))}>
            Let down
          </button>
        </div>
      )}
      {(!live || paused) &&
        (ended && !paused ? (
          <Results
            className="ts-overlay"
            won={Boolean(res?.stone)}
            kicker="The range · bow work"
            title={res?.stone ? 'He never misses.' : 'Out of rounds.'}
            line={res?.stone ? `${res.total} points across three rounds. Hawkeye would take you on a mission.` : `${res?.total ?? 0} points. ${STONE_SCORE} takes Clint’s half of the Soul Stone. Leading the movers and the clays is where the points are.`}
            score={res?.total ?? 0}
            best={best}
            newBest={res?.newBest}
            stone={res?.stone ? 'soul' : null}
            half={res?.whole ? null : HALF_OF['soul-clint']}
            stoneText={res?.whole ? 'With Natasha’s half, the Soul Stone is whole.' : 'Clint’s half of the Soul Stone is yours. Natasha’s half is in Operations.'}
            onAgain={() => begin(0)}
          />
        ) : (
          <div className="hq-overlay ts-overlay">
            {paused ? (
              <>
                <p className="hq-overlay-title">Paused</p>
                <p className="hq-overlay-text">
                  Round {ui.round} of {ROUNDS.length}. {ui.arrows} arrows left, {Math.ceil(ui.time)} seconds.
                </p>
                <button type="button" className="btn btn-primary mt-4" onClick={() => (setPaused(false), focus())}>
                  Resume
                </button>
              </>
            ) : ui.phase === 'roundEnd' && res ? (
              <>
                <p className="hq-overlay-kicker">Round {res.round} done</p>
                <p className="hq-overlay-title">{res.score >= 120 ? 'Clint would nod at that.' : res.score >= 70 ? 'Not bad at all.' : 'Shake it off.'}</p>
                <p className="hq-overlay-score">
                  {res.score}
                  <small>this round · {res.total} in all</small>
                </p>
                <p className="hq-overlay-text">
                  Next: {ROUNDS[res.round].title}. {INTROS[res.round]}
                </p>
                <button type="button" className="btn btn-primary mt-5" onClick={() => begin(res.round)}>
                  Round {res.round + 1}
                </button>
              </>
            ) : (
              <>
                <p className="hq-overlay-kicker">The range · bow work</p>
                <p className="hq-overlay-title">Trick Shot</p>
                <p className="hq-overlay-text">Three rounds against the clock: boards from 18 to 60 metres, targets that slide and swing, clay pigeons, practice drones, and the wind. The bow’s sight shows where the arrow will land at each distance. Three hits in a row earn a trick arrow.</p>
                <StartNote />
                <ul className="hq-keys">
                  <li>
                    <kbd>Mouse</kbd> aim, hold to draw, let go
                  </li>
                  <li>
                    <kbd>Q</kbd> or right-click: trick arrow
                  </li>
                  <li>
                    <kbd>F</kbd> half draw
                  </li>
                  <li>
                    <kbd>Esc</kbd> let down
                  </li>
                  <li>
                    <kbd>←</kbd>
                    <kbd>→</kbd>
                    <kbd>Space</kbd> keyboard
                  </li>
                </ul>
                <TouchHelp game="trickshot" />
                <button type="button" className="btn btn-primary mt-5" onClick={() => begin(0)}>
                  Pick up the bow
                </button>
                {best > 0 && <p className="hq-overlay-best">Best {best}</p>}
              </>
            )}
          </div>
        ))}
      <p className="sr-only" role="status">
        {live ? `Round ${ui.round}. ${ui.arrows} arrows. Score ${ui.score}. ${ui.message}` : ''}
      </p>
    </HQGame>
  );
}

// ── the HUD, drawn every frame over the 3D view ──
const calm = typeof window !== 'undefined' && prefersReducedMotion();
const PINS = [20, 30, 40, 50, 60];
function drawHud(cv, g, view, a, f, dt, live) {
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
  const s = g.s;
  if (!live || !s) return;
  const font = (size, weight = 600) => `${weight} ${size}px "Archivo Variable", Archivo, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 1.5;

  // an EMP's blue edge
  if (s.emp > 0 && !calm) {
    const k = Math.min(1, s.emp / 0.6) * 0.5;
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(74,184,255,0)');
    grad.addColorStop(1, `rgba(74,184,255,${k})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Hawkeye's glasses: a bracket and the distance on every target
  s.targets.forEach((t) => {
    const p = targetAt(t, s);
    const c = view.project(p.x, p.y, p.z);
    if (!c.front) return;
    const top = view.project(p.x, p.y + t.r * 1.06, p.z);
    const rad = Math.max(8, c.y - top.y);
    const hidden = !!t.behind;
    ctx.strokeStyle = hidden ? 'rgba(200,160,255,0.8)' : 'rgba(255,255,255,0.55)';
    if (hidden) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const m = rad + 6;
    const k = Math.min(10, m * 0.45);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      ctx.moveTo(c.x + sx * m, c.y + sy * m - sy * k);
      ctx.lineTo(c.x + sx * m, c.y + sy * m);
      ctx.lineTo(c.x + sx * m - sx * k, c.y + sy * m);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = font(10);
    ctx.fillStyle = hidden ? 'rgba(220,190,255,0.95)' : 'rgba(255,255,255,0.85)';
    ctx.fillText(`${Math.round(Math.hypot(p.x, p.y - EYE, p.z))} m${hidden ? ' · behind' : ''}`, c.x, c.y + m + 13);
  });
  for (const c of s.clays) {
    if (!c.alive) continue;
    const p = view.project(c.x, c.y, c.z);
    if (!p.front) continue;
    ctx.strokeStyle = 'rgba(255,150,90,0.85)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const d of s.drones) {
    if (!d.alive) continue;
    const p = view.project(d.x, d.y, d.z);
    if (!p.front) continue;
    ctx.strokeStyle = s.emp > 0 ? 'rgba(120,200,255,0.9)' : 'rgba(200,160,255,0.85)';
    ctx.strokeRect(p.x - 12, p.y - 9, 24, 18);
  }

  // the aim, with the shake of a draw held too long
  const shake = s.drawing ? shakeOf(s) : 0;
  const ax = a.dir.x + Math.sin(s.t * 23) * shake;
  const ay = a.dir.y + Math.cos(s.t * 19) * shake;
  const aimNow = { x: ax, y: ay, z: a.dir.z };
  const rp = view.project(ax * 80, EYE + ay * 80, a.dir.z * 80);

  // the sight's pins: where the arrow will be at 20, 30… metres, at this draw
  const cap = drawCap(s);
  const drawn = s.drawing ? s.draw : cap;
  if (drawn >= BOW.weak) {
    const speed = speedFor(drawn);
    const wind = s.wind * s.windDir;
    const alpha = s.drawing ? 0.95 : 0.4;
    const pts = [];
    for (const d of PINS) {
      const at = pathAt(aimNow, speed, -d, wind);
      if (!at || at.y < -0.5) continue;
      const p = view.project(at.x, at.y, at.z);
      if (p.front) pts.push({ d, p, ground: at.y < 0 });
    }
    if (pts.length) {
      ctx.strokeStyle = `rgba(160,255,170,${alpha * 0.35})`;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(rp.x, rp.y);
      for (const { p } of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.font = font(9.5, 700);
    ctx.textAlign = 'left';
    for (const { d, p, ground } of pts) {
      ctx.strokeStyle = ground ? `rgba(255,140,120,${alpha})` : `rgba(160,255,170,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y);
      ctx.lineTo(p.x + 7, p.y);
      ctx.stroke();
      ctx.fillStyle = ground ? `rgba(255,170,150,${alpha})` : `rgba(200,255,205,${alpha})`;
      ctx.fillText(String(d), p.x + 10, p.y + 3.5);
    }
    ctx.textAlign = 'center';
    ctx.lineWidth = 1.5;
  }

  // the reticle, and the draw filling a ring round it
  const full = s.drawing && s.draw >= cap - 1e-6;
  const shaking = s.drawing && s.full > BOW.shakeAfter;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(rp.x, rp.y, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, -1],
  ]) {
    ctx.moveTo(rp.x + dx * 7, rp.y + dy * 7);
    ctx.lineTo(rp.x + dx * 16, rp.y + dy * 16);
  }
  ctx.stroke();
  if (s.drawing) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = shaking ? `rgba(255,90,70,${0.6 + 0.4 * Math.sin(s.t * 20)})` : full ? 'rgba(255,214,90,0.95)' : s.draw < BOW.weak ? 'rgba(255,255,255,0.5)' : 'rgba(170,255,180,0.9)';
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.draw / cap));
    ctx.stroke();
    ctx.lineWidth = 1.5;
    if (shaking) {
      ctx.font = font(11, 700);
      ctx.fillStyle = 'rgba(255,140,120,0.95)';
      ctx.fillText('Arm’s shaking: loose, or Esc to let down', rp.x, rp.y + 44);
    }
  }
  if (s.nocked) {
    ctx.strokeStyle = hex(TRICK_COLORS[s.nocked]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, 30, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.lineWidth = 1.5;
  }

  // points, floating up from where they were scored
  f.popups = f.popups.filter((p) => p.t < 1.2);
  for (const p of f.popups) {
    p.t += dt;
    if (p.t < 0) continue;
    const c = view.project(p.x, p.y, p.z);
    if (!c.front) continue;
    const k = p.t / 1.2;
    ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
    ctx.font = font(p.small ? 11 : p.gold ? 19 : 15, 800);
    ctx.fillStyle = p.gold ? '#ffd04a' : p.small ? 'rgba(220,200,255,0.95)' : '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    const y = c.y - 18 - (calm ? 0 : k * 34);
    ctx.strokeText(p.text, c.x, y);
    ctx.fillText(p.text, c.x, y);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
  }
}
