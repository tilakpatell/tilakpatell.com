import { useCallback, useEffect, useRef, useState } from 'react';
import HQGame, { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
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
import { LAWN, LIFT, WAVES, callLightning, liftInput, newLawn, recallHammer, setMove, skipLift, startAtBoss, startLawn, stepLawn, throwHammer } from './rules';
import { LINES, READY, SAYS, SPOKEN } from './lines';
import './lawn.css';
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
const BEST = 'tp-hq-lawn-best';
const LIFTED = 'tp-hq-lawn-lifted';
const BOSS = 'tp-hq-lawn-boss'; // true once Cull Obsidian’s wave has been reached
const STEP = 1 / 120;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const media = (q) => (typeof window !== 'undefined' ? window.matchMedia?.(q) : null);
// lawn.css's breakpoint, where the lightning meter moves up beside the wave
const narrow = media('(max-width: 760px)');
// a mouse and keyboard; lawn.css hides the touch buttons for these
const fine = media('(hover: hover) and (pointer: fine)');
// what Thor says as each wave comes in and as it goes (./lines.js), in his own voice where it's been made (lib/voiced.js)
const VOICED = new Set(SPOKEN);

// The most urgent thing to throw at, for keyboard play.
function urgent(g) {
  let best = null;
  let score = -Infinity;
  for (const e of g.enemies) {
    if (e.hp <= 0 || !e.onLawn) continue;
    let k = e.kind === 'chariot' ? -30 : e.z;
    if (e.charging > 0) k += 10;
    if (k > score) {
      score = k;
      best = e;
    }
  }
  if (!best) return null;
  if (best.kind === 'chariot') return { x: best.x + best.vx * 0.6, y: best.y, z: best.z, air: true };
  if (best.kind === 'brute' || best.kind === 'cull') {
    // past its side, for a recall through its back
    const s = best.x >= 0 ? 1 : -1;
    return { x: best.x + (best.r + 3) * s, z: best.z - 12 };
  }
  return { x: best.x, z: best.z - 4 };
}

export default function HoldTheLawn({ fallback }) {
  const three = useGame3D('lawn');
  const stage = useStage(gameModule, { enabled: three.on, id: 'lawn', forced: three.mode === 'on', own3D: true });
  const { unlock } = useAchievements();
  const game = useRef(newLawn({ seed: 1 }));
  const hud = useRef(null);
  const input = useRef({ nx: 0.1, ny: -0.1, aim: { x: 0, z: -20 }, keys: new Set(), keyAim: false, lift: null, touch: null });
  const acc = useRef(0);
  const fxState = useRef({ popups: [], hurt: 0, lastUi: 0, taught: new Set() });
  const [best, setBest] = useState(() => Number(local.get(BEST, 0)) || 0);
  const [lifted, setLifted] = useState(() => !!local.get(LIFTED, false));
  const [checkpoint, setCheckpoint] = useState(() => local.get(BOSS, false) === true);
  const [ui, setUi] = useState({ phase: 'ready', wave: 1, title: WAVES[0].title, hp: LAWN.hearts, score: 0, charge: 0, hammer: 'held', message: '', result: null, lift: 0, liftX: 0, holding: false });
  const [paused, setPaused] = useState(false);
  const playing = ui.phase === 'wave' || ui.phase === 'break';
  useSays('thor', ui.message, VOICED);

  const sync = useCallback((extra = {}) => {
    const g = game.current;
    setUi((u) => ({ ...u, phase: g.phase, wave: Math.min(WAVES.length, (g.phase === 'break' ? g.next : g.wave) + 1), title: WAVES[g.phase === 'break' ? g.next : g.wave]?.title ?? '', hp: g.thor.hp, score: g.score, charge: g.charge, hammer: g.hammer.state, lift: g.lift.progress, liftX: g.lift.x, holding: g.lift.holding, ...extra }));
  }, []);

  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);

  // a new game opened by `open`: startLawn (the lift) or startAtBoss (the checkpoint)
  const begin = useCallback(
    (open) => {
      audioContext(); // in the click, so the thunder can be heard
      recordTry('thor');
      game.current = newLawn({ seed: newSeed() });
      const ev = open(game.current);
      acc.current = 0;
      fxState.current.popups = [];
      setPaused(false);
      stage.view.current?.fx(ev, game.current);
      sync({ message: '', result: null });
      focus();
    },
    [focus, stage.view, sync],
  );
  const start = useCallback(() => begin(startLawn), [begin]);
  const startBoss = useCallback(() => begin(startAtBoss), [begin]);

  const skip = useCallback(() => {
    skipLift(game.current);
    sync({ message: LINES[0] });
    focus();
  }, [focus, sync]);

  // browser checks
  useEffect(
    () =>
      register('lawn', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        start,
        skip,
        checkpoint: startBoss,
        lift: (holding, push) => liftInput(game.current, holding, push),
        aim(x, z) {
          input.current.aim = { x, z };
          input.current.keyAim = false;
        },
        throw: () => throwHammer(game.current, input.current.aim),
        recall: () => recallHammer(game.current),
        lightning: () => callLightning(game.current, input.current.aim),
        setState(name) {
          if (name === 'lift') start();
          if (name === 'action' || name === 'boss') {
            if (['ready', 'won', 'lost'].includes(game.current.phase)) start();
            const g = game.current; // start() makes a new game
            skipLift(g);
            for (let i = 0; i < 200; i++) stepLawn(g, STEP);
            g.spawns = [];
            g.enemies = [];
            const add = (e) => g.enemies.push({ id: g.nextId++, t: 0, seed: g.enemies.length * 1.7, stagger: 0, onLawn: true, y: 0, fx: 0, fz: 1, goal: e.x, speed: 0.001, ...e });
            if (name === 'action') {
              g.wave = 2;
              add({ kind: 'soldier', hp: 1, r: 0.55, h: 1.9, x: -3, z: -12 });
              add({ kind: 'soldier', hp: 1, r: 0.55, h: 1.9, x: 2.5, z: -15 });
              add({ kind: 'soldier', hp: 1, r: 0.55, h: 1.9, x: 6, z: -22, shooter: true, stopZ: -40, shots: 0, cool: 9, charging: 0.5 });
              add({ kind: 'soldier', hp: 1, r: 0.55, h: 1.9, x: -7, z: -26 });
              add({ kind: 'brute', hp: 2, r: 0.9, h: 2.4, x: 0.5, z: -20 });
              add({ kind: 'chariot', hp: 2, r: 1.6, h: 0.8, x: -8, y: 5.6, z: -24, vx: 0.001, passes: 2, cool: 99 });
              g.charge = 100;
            } else {
              g.wave = WAVES.length - 1;
              add({ kind: 'cull', hp: 9, r: 1.5, h: 3.2, x: 0, z: -14, roar: 99 });
              add({ kind: 'soldier', hp: 1, r: 0.55, h: 1.9, x: -4, z: -18 });
              add({ kind: 'soldier', hp: 1, r: 0.55, h: 1.9, x: 4, z: -19 });
            }
            g.phase = 'wave';
            input.current.aim = { x: 0.5, z: -24 };
            stage.view.current?.snap();
          }
          sync();
          return { state: name };
        },
      }),
    [start, skip, startBoss, stage.view, sync],
  );

  // the events of a step: sound, haptics, popups and the HUD
  const handle = useCallback(
    (events) => {
      const g = game.current;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        switch (e.type) {
          case 'lifted':
            play('thunder');
            buzz(120);
            unlock('worthy');
            if (!lifted) {
              setLifted(true);
              local.set(LIFTED, true);
            }
            important = { message: e.skipped ? LINES[0] : SAYS.lifted };
            break;
          case 'drop':
            play('knock');
            important = { message: SAYS.drop };
            break;
          case 'wave':
            play('drum');
            important = { message: LINES[e.n - 1] ?? '' };
            if (e.boss && !checkpoint) {
              setCheckpoint(true);
              local.set(BOSS, true);
            }
            break;
          case 'checkpoint':
            play('thunder');
            break;
          case 'throw':
            play('zip');
            break;
          case 'recall':
            play('zip');
            break;
          case 'catch':
            play('clang');
            buzz(12);
            break;
          case 'kill':
            play('blast');
            buzz(10);
            f.popups.push({ x: e.x, y: e.y + 0.6, z: e.z, text: e.multi > 1 ? `+${e.score} ×${e.multi}` : `+${e.score}`, t: 0, big: e.kind !== 'soldier' || e.multi > 2 });
            break;
          case 'hit':
            if (e.back) play('clang');
            break;
          case 'block':
            play('clang');
            if (!f.taught.has('block')) {
              f.taught.add('block');
              important = { message: SAYS.block };
            }
            break;
          case 'fire':
            play('laser');
            break;
          case 'swat':
            play('clang');
            break;
          case 'hurt':
            play('hit');
            buzz(70);
            f.hurt = 1;
            if (e.by === 'bolt' && !f.taught.has('bolt')) {
              f.taught.add('bolt');
              important = { message: SAYS.bolt };
            }
            break;
          case 'breach':
            play('warn');
            if (!f.taught.has('breach')) {
              f.taught.add('breach');
              important = { message: SAYS.breach };
            }
            break;
          case 'lightning':
            play('thunder');
            buzz(90);
            break;
          case 'ready':
            play('sizzle');
            important = { message: READY(fine?.matches) };
            break;
          case 'roar':
            play('roar');
            break;
          case 'clear':
            important = { message: e.n < WAVES.length ? `Wave ${e.n} held.` : '' };
            break;
          case 'won': {
            play('victory');
            unlock('thor');
            const first = earnStone('reality');
            const isBest = e.score > best;
            if (isBest) {
              setBest(e.score);
              local.set(BEST, e.score);
            }
            important = { result: { won: true, score: e.score, bonus: e.bonus, newBest: isBest, stone: first || hasEarned('reality') } };
            break;
          }
          case 'lost': {
            play('alarm');
            const isBest = e.score > best;
            if (isBest) {
              setBest(e.score);
              local.set(BEST, e.score);
            }
            important = { result: { won: false, score: e.score, wave: e.wave, newBest: isBest } };
            break;
          }
          default:
        }
      }
      if (important) sync(important);
      else if (g.t - f.lastUi > 0.08) {
        f.lastUi = g.t;
        sync();
      }
    },
    [best, checkpoint, lifted, sync, unlock],
  );

  // ── the loop ──
  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      const g = game.current;
      const dt = Math.min(0.05, dtMs / 1000);
      const inp = input.current;
      const live = (g.phase === 'wave' || g.phase === 'break' || g.phase === 'lift') && !paused;
      if (live) {
        if (g.phase !== 'lift') {
          const k = inp.keys;
          setMove(g, (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + (inp.touchMove ?? 0));
          if (inp.keyAim) inp.aim = urgent(g) ?? inp.aim;
          else if (!inp.touch) inp.aim = view.aimAt(inp.nx, inp.ny, g);
        } else if (inp.keys.has('hold')) liftInput(g, true, (inp.keys.has('right') ? 1 : 0) - (inp.keys.has('left') ? 1 : 0));
        acc.current += dt * view.timeScale(dt);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepLawn(g, STEP));
          if (g.phase === 'won' || g.phase === 'lost') break;
        }
        if (events.length) {
          view.fx(events, g);
          handle(events);
        }
      }
      g.aimY = inp.aim?.air ? inp.aim.y : null;
      view.render(g, dt, { aim: inp.aim });
      drawHud(hud.current, g, view, fxState.current, dt, live && g.phase !== 'lift');
    },
    [handle, paused, stage.view],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // stop walking and let go of the hammer when the window loses focus
  useEffect(() => {
    const stop = () => {
      input.current.keys.clear();
      input.current.touchMove = 0;
      liftInput(game.current, false);
      setMove(game.current, 0);
    };
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => {
    if (!stage.visible && playing) setPaused(true);
  }, [stage.visible, playing]);

  // ── input ──
  const toNdc = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), r.width];
  };
  const onPointerMove = (e) => {
    const g = game.current;
    const inp = input.current;
    if (g.phase === 'lift' && inp.lift?.id === e.pointerId) {
      // pushing the needle: how far the pointer has moved since the press
      const [, , w] = toNdc(e);
      liftInput(g, true, (e.clientX - inp.lift.x) / (w * 0.16));
      return;
    }
    if (e.pointerType === 'mouse') {
      [inp.nx, inp.ny] = toNdc(e);
      inp.keyAim = false;
    }
  };
  const act = (aim) => {
    const g = game.current;
    if (g.hammer.state === 'held') throwHammer(g, aim);
    else recallHammer(g);
  };
  const onPointerDown = (e) => {
    if (paused || e.target.closest('button')) return;
    const g = game.current;
    const inp = input.current;
    if (g.phase === 'lift') {
      capturePointer(e);
      inp.lift = { id: e.pointerId, x: e.clientX };
      liftInput(g, true, 0);
      return;
    }
    if (!playing) return;
    capturePointer(e);
    [inp.nx, inp.ny] = toNdc(e);
    inp.keyAim = false;
    const aim = stage.view.current?.aimAt(inp.nx, inp.ny, g) ?? inp.aim;
    inp.aim = aim;
    if (e.pointerType === 'mouse' && e.button === 2) {
      callLightning(g, aim);
      return;
    }
    act(aim);
  };
  const onPointerUp = (e) => {
    const inp = input.current;
    if (inp.lift?.id === e.pointerId) {
      inp.lift = null;
      liftInput(game.current, false);
    }
  };
  const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  const onKeyDown = (e) => {
    const g = game.current;
    const k = e.key.toLowerCase();
    const inp = input.current;
    if (g.phase === 'lift') {
      if (KEYS[k]) {
        e.preventDefault();
        inp.keys.add(KEYS[k]);
      } else if (k === ' ' || k === 'enter') {
        e.preventDefault();
        inp.keys.add('hold');
      }
      return;
    }
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
      inp.keys.clear();
      return;
    }
    if (paused) return;
    if (KEYS[k]) {
      e.preventDefault();
      inp.keys.add(KEYS[k]);
    } else if (k === ' ' || k === 'j') {
      e.preventDefault();
      if (!e.repeat) {
        inp.keyAim = true;
        inp.aim = urgent(g) ?? inp.aim;
        act(inp.aim);
      }
    } else if (k === 'e' || k === 'q' || k === 'k') {
      e.preventDefault();
      callLightning(g, inp.aim);
    }
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    const inp = input.current;
    if (KEYS[k]) inp.keys.delete(KEYS[k]);
    if (k === ' ' || k === 'enter') {
      inp.keys.delete('hold');
      if (game.current.phase === 'lift') liftInput(game.current, false);
    }
  };
  const hold = (dir) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      capturePointer(e);
      input.current.touchMove = dir;
    },
    onPointerUp: () => (input.current.touchMove = 0),
    onPointerCancel: () => (input.current.touchMove = 0),
    onLostPointerCapture: () => (input.current.touchMove = 0),
    onContextMenu: (e) => e.preventDefault(),
  });

  const res = ui.result;
  const lifting = ui.phase === 'lift';
  const zone = Math.abs(ui.liftX) < LIFT.green ? 'green' : Math.abs(ui.liftX) < 0.7 ? 'amber' : 'red';
  // the bar's Pause, and a hidden tab: as Esc does
  const pause = (p) => {
    input.current.keys.clear();
    setPaused(p);
  };
  return (
    <HQGame
      game="lawn"
      playing={playing || lifting}
      paused={paused}
      onPause={pause}
      stage={stage}
      three={three}
      fallback={fallback}
      className="tl-game"
      label="Hold the Lawn. First lift Mjolnir: hold the button and move the mouse (or A and D) to keep the needle in the green. Then aim with the mouse and click to throw the hammer; click again to call it back. A and D walk along the terrace. Right-click or E brings down lightning when it's charged. With the keyboard alone, Space throws at the nearest Chitauri and calls the hammer back. On a touch screen, tap to throw and recall."
      screenProps={{
        onPointerMove,
        onPointerDown,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        onKeyUp,
        style: { touchAction: playing || lifting ? 'none' : 'auto', cursor: playing && !paused ? 'crosshair' : 'auto' },
      }}
    >
      <canvas ref={hud} className="tl-hud-canvas" aria-hidden="true" />
      {playing && (
        <div className="tl-hud" aria-hidden="true">
          <div className="tl-wave">
            <span className="tl-wave-n">
              Wave {ui.wave}
              <small>/{WAVES.length}</small>
            </span>
            <span className="tl-wave-title">{ui.title}</span>
          </div>
          <div className="tl-score">
            <span className="tl-score-n">{fmt(ui.score)}</span>
            <span className="tl-hearts" aria-label={`${ui.hp} of ${LAWN.hearts} hearts`}>
              {Array.from({ length: LAWN.hearts }, (_, i) => (
                <span key={i} data-on={i < ui.hp || undefined} />
              ))}
            </span>
          </div>
          <div className="tl-bottom">
            <div className="tl-charge" data-ready={ui.charge >= 100 || undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
              </svg>
              <span className="tl-charge-bar">
                <span style={{ width: `${ui.charge}%` }} />
              </span>
              <span className="tl-charge-label">{ui.charge >= 100 ? (fine?.matches ? 'Lightning · E' : 'Lightning ready') : 'Lightning'}</span>
            </div>
            <span className="tl-hammer" data-out={ui.hammer !== 'held' || undefined}>
              {ui.hammer === 'held' ? 'Mjolnir in hand' : ui.hammer === 'back' ? 'Coming back…' : 'Click to call it back'}
            </span>
          </div>
          <p className="tl-message">{ui.message}</p>
        </div>
      )}
      {lifting && (
        <div className="tl-lift" aria-hidden="true">
          <p className="tl-lift-text">{ui.holding ? 'Keep it in the green…' : 'Hold to lift. Move to keep the needle in the green.'}</p>
          <div className="tl-gauge" data-zone={zone}>
            <span className="tl-gauge-green" style={{ width: `${LIFT.green * 50}%` }} />
            <span className="tl-gauge-needle" style={{ left: `${50 + Math.max(-1, Math.min(1, ui.liftX)) * 50}%` }} />
          </div>
          <div className="tl-lift-progress">
            <span style={{ width: `${ui.lift * 100}%` }} />
          </div>
          <p className="tl-message tl-lift-msg">{ui.message}</p>
        </div>
      )}
      {lifting && lifted && (
        <button type="button" className="tl-skip" onClick={skip}>
          Skip the lift
        </button>
      )}
      {playing && !paused && (
        <div className="tl-touch" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="tl-touch-btn" aria-label="Walk left" {...hold(-1)}>
            ◀
          </button>
          <button type="button" className="tl-touch-btn" aria-label="Walk right" {...hold(1)}>
            ▶
          </button>
          <button
            type="button"
            className="tl-touch-btn tl-touch-bolt"
            aria-label="Bring down lightning"
            disabled={ui.charge < 100}
            onPointerDown={(e) => {
              e.stopPropagation();
              callLightning(game.current, input.current.aim);
            }}
          >
            ⚡
          </button>
        </div>
      )}
      {(!(playing || lifting) || paused) &&
        (res && !paused ? (
          <Results
            className="tl-overlay"
            won={res.won}
            kicker="The front lawn · a storm"
            title={res.won ? 'Cull Obsidian is down.' : 'The line broke.'}
            line={res.won ? `The lawn held, with ${res.bonus / 500} ${res.bonus === 500 ? 'heart' : 'hearts'} to spare.` : `On wave ${res.wave} of ${WAVES.length}. Keep the hammer in hand when they’re shooting, and get it behind the shields.`}
            score={res.score}
            best={best}
            newBest={res.newBest}
            stone={res.won && res.stone ? 'reality' : null}
            stoneText="The Reality Stone is yours, out of the Aether."
            onAgain={start}
            onward={!res.won && checkpoint ? { label: 'Restart at the boss', onClick: startBoss } : null}
            againLabel={!res.won && checkpoint ? 'From wave 1' : undefined}
          />
        ) : (
          <div className="hq-overlay tl-overlay">
            {paused ? (
              <>
                <p className="hq-overlay-title">Paused</p>
                <p className="hq-overlay-text">
                  Wave {ui.wave} of {WAVES.length}. {ui.hp} hearts left.
                </p>
                <button type="button" className="btn btn-primary mt-4" onClick={() => (setPaused(false), focus())}>
                  Resume
                </button>
              </>
            ) : (
              <>
                <p className="hq-overlay-kicker">The front lawn · a storm</p>
                <p className="hq-overlay-title">Hold the Lawn</p>
                <p className="hq-overlay-text">The Chitauri are coming across the lawn. Lift the hammer, then throw it through them and call it back through them, and bring down the lightning. Seven waves, then Cull Obsidian.</p>
                <StartNote />
                <ul className="hq-keys">
                  <li>
                    <kbd>Mouse</kbd> aim, click to throw, click to recall
                  </li>
                  <li>
                    <kbd>A</kbd>
                    <kbd>D</kbd> walk
                  </li>
                  <li>
                    <kbd>E</kbd> or right-click: lightning
                  </li>
                  <li>
                    <kbd>Space</kbd> throw at the nearest
                  </li>
                </ul>
                <TouchHelp game="lawn" />
                <button type="button" className="btn btn-primary mt-5" onClick={start}>
                  Lift the hammer
                </button>
                {best > 0 && <p className="hq-overlay-best">Best {fmt(best)}</p>}
              </>
            )}
          </div>
        ))}
      <p className="sr-only" role="status">
        {playing ? `Wave ${ui.wave}. ${ui.hp} hearts. ${ui.message}` : lifting ? `Lifting: ${Math.round(ui.lift * 100)} percent. ${ui.message}` : ''}
      </p>
    </HQGame>
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
  f.hurt = Math.max(0, f.hurt - dt * 1.8);
  if (f.hurt > 0 && !calm) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(255,40,30,0)');
    grad.addColorStop(1, `rgba(255,40,30,${0.5 * f.hurt})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (!live) return;
  const font = (size, weight = 600) => `${weight} ${size}px "Archivo Variable", Archivo, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 1.5;

  // threats: shooters about to fire, shields, the boss
  for (const e of g.enemies) {
    if (e.hp <= 0 || !e.onLawn) continue;
    const top = view.project(e.x, (e.y ?? 0) + e.h + 0.35, e.z);
    if (!top.front) continue;
    if (e.charging > 0) {
      const k = 1 - e.charging / 1.1;
      ctx.strokeStyle = `rgba(255,80,60,${0.6 + 0.4 * Math.sin(g.t * 30)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(top.x, top.y - 6, 9 - k * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
    }
    if (e.kind === 'brute' || e.kind === 'cull') {
      // a shield: only from behind
      ctx.fillStyle = 'rgba(255,214,122,0.9)';
      ctx.beginPath();
      const x = top.x;
      const y = top.y - 8;
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.quadraticCurveTo(x + 6, y + 6, x, y + 8);
      ctx.quadraticCurveTo(x - 6, y + 6, x - 6, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Cull Obsidian's strength across the top
  const boss = g.enemies.find((e) => e.kind === 'cull');
  if (boss) {
    const bw = Math.min(320, w * 0.55);
    const x0 = (w - bw) / 2;
    const y0 = narrow?.matches ? 122 : 52; // below the meter when it's up top
    ctx.font = font(10, 700);
    // outlined, like the points: it sits on the portal's glow
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText('CULL OBSIDIAN · HIT HIM FROM BEHIND', w / 2, y0 - 6);
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(255,170,120,0.95)';
    ctx.fillText('CULL OBSIDIAN · HIT HIM FROM BEHIND', w / 2, y0 - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x0 - 1, y0 - 1, bw + 2, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x0, y0, bw, 6);
    ctx.fillStyle = 'rgba(255,110,60,0.95)';
    ctx.fillRect(x0, y0, bw * Math.max(0, boss.hp / 9), 6);
  }
  // bolts on their way while the hammer is out
  if (g.hammer.state !== 'held') {
    for (const b of g.bolts) {
      if (b.vz <= 0 || b.z < -16) continue;
      const p = view.project(b.x, b.y, b.z);
      if (!p.front) continue;
      ctx.strokeStyle = `rgba(255,80,60,${0.7 + 0.3 * Math.sin(g.t * 25)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
    }
  }
  // points, floating up
  f.popups = f.popups.filter((p) => p.t < 1.1);
  for (const p of f.popups) {
    p.t += dt;
    const c = view.project(p.x, p.y, p.z);
    if (!c.front) continue;
    const k = p.t / 1.1;
    ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
    ctx.font = font(p.big ? 17 : 13, 800);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.fillStyle = p.big ? '#ffd27a' : '#e6f3ff';
    const y = c.y - (calm ? 0 : k * 30);
    ctx.strokeText(p.text, c.x, y);
    ctx.fillText(p.text, c.x, y);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
  }
}
