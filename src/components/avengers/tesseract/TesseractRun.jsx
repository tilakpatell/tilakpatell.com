import { useCallback, useEffect, useRef, useState } from 'react';
import HQGame, { StartNote, TouchHelp } from '../hq/HQGame';
import Results from '../hq/Results';
import { register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { earnStone, hasEarned } from '../hq/stones';
import { newSeed } from '../hq/rng';
import { useAchievements } from '../../Achievements';
import { useGame3D } from '../hq/useGame3D';
import { local, prefersReducedMotion } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { useSays } from '../hq/useSays';
import { CASE, LEGS, PADS, STEP, caseHeight, groundAt, inHangar, newGame, setInput, startLeg, stepGame, windAt } from './rules';
import { createHum } from './hum';
import { BRIEF, SAYS, SPOKEN } from './lines';
import './tesseract.css';
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
const LEG_KEY = 'tp-hq-tesseract-leg';
const BEST_KEY = 'tp-hq-tesseract-best';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fine = typeof window !== 'undefined' ? window.matchMedia?.('(hover: hover) and (pointer: fine)') : null;
const coarse = typeof window !== 'undefined' ? window.matchMedia?.('(pointer: coarse)') : null;
const calm = typeof window !== 'undefined' && prefersReducedMotion();

// what F.R.I.D.A.Y. says (./lines.js) in her own voice, where it's been made
// (lib/voiced.js): the lines that are the same every time
const VOICED = new Set(SPOKEN);
const INTO = { ground: 'the ground', tree: 'the trees', gantry: 'the gantry', hangar: 'the hangar', case: 'the case' };
function crashLine(c) {
  if (!c) return '';
  const v = `${c.speed.toFixed(1)} m/s`;
  if (c.what === 'fuel') return 'Out of fuel, short of the pad.';
  if (c.what === 'case') return c.into === 'ground' ? `The case hit the ground at ${v} and the glass gave. Under ${CASE.soft.toFixed(0)} m/s is soft.` : `The case swung into ${INTO[c.into] ?? 'something'} at ${v}.`;
  if (c.into === 'case') return 'You came down on the case.';
  if (c.into === 'gantry') return 'The tail clipped the gantry’s girder.';
  if (c.into === 'hangar') return 'Into the hangar’s roof.';
  return `The Quinjet hit ${INTO[c.into] ?? 'something'} at ${v}.`;
}
const TIP = {
  ground: 'Ease off the descent before the wheels touch.',
  tree: 'Climb before you go: the case hangs nine metres below you.',
  gantry: 'Fly level under it; leaning lifts the tail.',
  hangar: 'Come in low under the roof, then down.',
  case: 'Keep the jet clear above the case when you set it down.',
};

function loadProgress() {
  const reached = clamp(Math.floor(Number(local.get(LEG_KEY, 0)) || 0), 0, LEGS.length - 1);
  const raw = local.get(BEST_KEY, []);
  const best = LEGS.map((_, i) => Math.max(0, Math.round(Number(Array.isArray(raw) ? raw[i] : 0) || 0)));
  return { reached, best };
}

export default function TesseractRun({ fallback, onPortal }) {
  const three = useGame3D('tesseract');
  const stage = useStage(gameModule, { enabled: three.on, id: 'tesseract', forced: three.mode === 'on', own3D: true });
  const { unlock } = useAchievements();
  const [progress, setProgress] = useState(loadProgress);
  const [leg, setLeg] = useState(() => loadProgress().reached);
  const game = useRef(newGame({ seed: 1, leg }));
  const hud = useRef(null);
  const acc = useRef(0);
  const input = useRef({ keys: new Set(), touchThrust: false, touchTilt: 0, drag: null });
  const fxState = useRef({ lastUi: 0, said: null, gustT: 0, settle: 0 });
  const hum = useRef(null);
  const portal = useRef({ timer: 0, auto: true });
  const [ui, setUi] = useState({ phase: 'ready', fuel: 1, t: 0, wind: 0, gust: 0, message: '', result: null, crash: null, won: false, stone: false });
  const [paused, setPaused] = useState(false);
  const playing = ui.phase === 'fly';
  useSays('friday', ui.message, VOICED);
  const onPortalRef = useRef(onPortal);
  onPortalRef.current = onPortal;

  const sync = useCallback((extra = {}) => {
    const g = game.current;
    const L = LEGS[g.leg];
    setUi((u) => ({ ...u, phase: g.phase, fuel: g.fuel / L.fuel, t: g.t, ...extra }));
  }, []);

  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);

  const start = useCallback(
    (i = leg, seed = newSeed()) => {
      audioContext(); // in the click, so the engines can be heard
      const n = clamp(i, 0, LEGS.length - 1);
      setLeg(n);
      game.current = newGame({ seed, leg: n });
      const ev = startLeg(game.current, n);
      acc.current = 0;
      input.current.keys.clear();
      input.current.touchThrust = false;
      input.current.touchTilt = 0;
      input.current.drag = null;
      fxState.current = { lastUi: 0, said: 0, gustT: 0, settle: 0 };
      clearTimeout(portal.current.timer);
      if (!hum.current) hum.current = createHum();
      setPaused(false);
      stage.view.current?.fx(ev, game.current);
      play('beeps');
      sync({ message: BRIEF[n](fine?.matches), result: null, crash: null, won: false });
      focus();
    },
    [focus, leg, stage.view, sync],
  );

  // the rules' events: sound, haptics, the HUD and the overlays
  const handle = useCallback(
    (events) => {
      const g = game.current;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        switch (e.type) {
          case 'controls':
            if (e.idle) {
              play('warn');
              important = { message: SAYS.controls };
            } else important = { message: '' };
            break;
          case 'taut':
            play(e.speed > 4 ? 'clang' : 'knock');
            buzz(e.speed > 4 ? 40 : 15);
            break;
          case 'touch':
            play('thunk');
            buzz(20);
            break;
          case 'bump':
            play('knock');
            buzz(30);
            break;
          case 'gear':
            play('creak');
            break;
          case 'gust-warn':
            f.gustT = 2.4;
            if (e.strength > 3.5) play('warn');
            break;
          case 'fuel-low':
            play('alarm');
            important = { message: SAYS.fuel };
            break;
          case 'settling':
            important = { message: SAYS.settling };
            break;
          case 'crash':
            play(e.what === 'case' ? 'shatter' : 'boom');
            if (e.what === 'jet') play('crumble');
            buzz(160);
            hum.current?.set(0, false);
            important = { crash: g.crash, message: '' };
            break;
          case 'delivered': {
            play('ding');
            buzz(60);
            const i = e.leg;
            let isBest = false;
            setProgress((p) => {
              const best = [...p.best];
              isBest = e.score > (best[i] ?? 0);
              best[i] = Math.max(best[i] ?? 0, e.score);
              const reached = Math.max(p.reached, Math.min(LEGS.length - 1, i + 1));
              local.set(BEST_KEY, best);
              local.set(LEG_KEY, reached);
              return { reached, best };
            });
            important = { result: { ...e, isBest: isBest || e.score > (progress.best[i] ?? 0) }, message: '' };
            break;
          }
          case 'won': {
            play('stone');
            play('victory');
            buzz(200);
            unlock('quinjet');
            const first = earnStone('space');
            important = { ...important, won: true, stone: first || hasEarned('space') };
            // the stone opens the portal: through it, Thanos
            if (first && portal.current.auto) portal.current.timer = setTimeout(() => onPortalRef.current?.(), calm ? 900 : 3600);
            break;
          }
          default:
        }
      }
      if (important) {
        if (important.message) f.said = g.t;
        sync(important);
      } else if (g.t - f.lastUi > 0.1) {
        f.lastUi = g.t;
        // a line stays up a few seconds
        sync(f.said != null && g.t - f.said > 6 ? ((f.said = null), { message: '' }) : {});
      }
    },
    [progress.best, sync, unlock],
  );

  // the controls, combined: keys, the touch buttons, a held pointer
  const applyInput = useCallback(() => {
    const g = game.current;
    const inp = input.current;
    const k = inp.keys;
    const thrust = k.has('thrust') || inp.touchThrust || !!inp.drag ? 1 : 0;
    let tilt = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + inp.touchTilt;
    if (inp.drag && stage.view.current) {
      // the jet leans toward the pointer
      const at = stage.view.current.jetScreen(g);
      tilt += clamp((inp.drag.x - at.x) / Math.max(60, inp.drag.w * 0.14), -1, 1);
    }
    setInput(g, { thrust, tilt: clamp(tilt, -1, 1) });
  }, [stage.view]);

  // ── the loop ──
  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      const g = game.current;
      const dt = Math.min(0.05, dtMs / 1000);
      const live = g.phase === 'fly' && !paused;
      if (live) {
        applyInput();
        acc.current += dt * view.timeScale(dt);
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...stepGame(g, STEP));
          if (g.phase !== 'fly') break;
        }
        if (events.length) {
          view.fx(events, g);
          handle(events);
        } else handle([]);
      }
      fxState.current.gustT = Math.max(0, fxState.current.gustT - dt);
      hum.current?.set(g.phase === 'fly' ? g.jet.spool : g.phase === 'delivered' ? 0.45 : 0, !paused && (g.phase === 'fly' || g.phase === 'delivered'));
      view.render(g, paused ? 0 : dt);
      drawHud(hud.current, g, view, fxState.current, live);
    },
    [applyInput, handle, paused, stage.view],
  );
  useStageFrame(stage, tick, stage.status === 'on' && stage.visible);

  // nothing stays held when the window loses focus; pause when scrolled away
  useEffect(() => {
    const stop = () => {
      const inp = input.current;
      inp.keys.clear();
      inp.touchThrust = false;
      inp.touchTilt = 0;
      inp.drag = null;
      setInput(game.current, { thrust: 0, tilt: 0 });
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, []);
  useEffect(() => {
    if (!stage.visible && playing) setPaused(true);
    if (!stage.visible) hum.current?.set(0, false);
  }, [stage.visible, playing]);
  useEffect(
    () => () => {
      hum.current?.stop();
      hum.current = null;
      clearTimeout(portal.current.timer);
    },
    [],
  );
  // thunder with the storm's lightning
  useEffect(() => {
    if (stage.status === 'on') stage.view.current?.onStorm(() => play('thunder'));
  }, [stage.status, stage.view]);

  // browser checks: jump to a state (the pilot flies there; development only)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const flyTo = async (g, until, max = 90) => {
      const { pilot } = await import('./pilot');
      const all = [];
      for (let t = 0; t < max && g.phase === 'fly' && !until(g); t += STEP) {
        setInput(g, pilot(g));
        all.push(...stepGame(g, STEP));
      }
      return all;
    };
    return register('tesseract', {
      get state() {
        return game.current;
      },
      get view() {
        return stage.view.current;
      },
      start,
      // hold or let go of a control: 'thrust', 'left', 'right'
      press: (k, on = true) => (on ? input.current.keys.add(k) : input.current.keys.delete(k)),
      async setState(name) {
        const legs = { action: 1, trees: 1, crosswind: 2, gantry: 3, ridge: 4, storm: 5, crash: 1, delivered: 0, won: 5 };
        const n = legs[name] ?? (name.startsWith('leg') ? Number(name.slice(3)) - 1 : 0);
        portal.current.auto = false;
        start(n, 3); // a seed the pilot is known to fly
        const g = game.current;
        let ev = [];
        if (name === 'action' || name === 'trees') ev = await flyTo(g, (q) => q.case.x > 132);
        if (name === 'crosswind') ev = await flyTo(g, (q) => q.case.x > 285);
        if (name === 'gantry') ev = await flyTo(g, (q) => q.jet.x > 398);
        if (name === 'ridge') ev = await flyTo(g, (q) => q.case.x > 530);
        if (name === 'storm') ev = await flyTo(g, (q) => q.jet.x > 712);
        if (name === 'crash') {
          ev = await flyTo(g, (q) => q.case.x > 108);
          for (let i = 0; i < 600 && g.phase === 'fly'; i++) {
            setInput(g, { thrust: 0, tilt: 0.6 });
            ev.push(...stepGame(g, STEP));
          }
        }
        if (name === 'delivered' || name === 'won') ev = await flyTo(g, () => false, 150);
        stage.view.current?.fx(ev, g);
        handle(ev);
        stage.view.current?.snap();
        sync({ message: name === 'menu' ? '' : ui.message });
        return { state: name, phase: g.phase, leg: g.leg + 1, x: Math.round(g.jet.x) };
      },
    });
  }, [handle, start, stage.view, sync, ui.message]);

  // ── input ──
  const KEYS = { arrowup: 'thrust', w: 'thrust', ' ': 'thrust', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    const g = game.current;
    if (!playing) {
      if ((k === 'enter' || (k === ' ' && e.target === e.currentTarget)) && !e.repeat) {
        e.preventDefault();
        if (ui.phase === 'delivered') start(g.won ? g.leg : g.leg + 1);
        else start(ui.phase === 'crashed' ? g.leg : leg);
      } else if ((k === 'arrowup' || k === 'w' || k === 'r') && ui.phase === 'crashed' && !e.repeat) {
        e.preventDefault();
        start(g.leg);
      }
      return;
    }
    if (k === 'escape' || k === 'p') {
      e.preventDefault();
      setPaused((p) => !p);
      input.current.keys.clear();
      return;
    }
    if (k === 'r' && !e.repeat) {
      e.preventDefault();
      start(g.leg);
      return;
    }
    if (paused) return;
    if (KEYS[k]) {
      e.preventDefault();
      input.current.keys.add(KEYS[k]);
    }
  };
  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    if (KEYS[k]) input.current.keys.delete(KEYS[k]);
  };
  // a pointer held on the view: thrust, leaning toward it
  const onPointerDown = (e) => {
    if (paused || !playing || e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    capturePointer(e);
    const r = e.currentTarget.getBoundingClientRect();
    input.current.drag = { id: e.pointerId, x: e.clientX - r.left, w: r.width };
  };
  const onPointerMove = (e) => {
    const d = input.current.drag;
    if (!d || d.id !== e.pointerId) return;
    d.x = e.clientX - e.currentTarget.getBoundingClientRect().left;
  };
  const endDrag = (e) => {
    if (input.current.drag?.id === e.pointerId) input.current.drag = null;
  };
  // the touch buttons: held, not tapped
  const hold = (on, off) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      capturePointer(e);
      on();
    },
    onPointerUp: off,
    onPointerCancel: off,
    onLostPointerCapture: off,
    onContextMenu: (e) => e.preventDefault(),
  });

  const L = LEGS[game.current.leg] ?? LEGS[leg];
  const res = ui.result;
  const crash = ui.crash;
  const total = progress.best.reduce((a, b) => a + b, 0);
  // the bar's Pause, and a hidden tab: as Esc does
  const pause = (p) => {
    input.current.keys.clear();
    setPaused(p);
  };
  return (
    <HQGame
      game="tesseract"
      playing={playing}
      paused={paused}
      onPause={pause}
      stage={stage}
      three={three}
      fallback={fallback}
      className="tr-game"
      accent="#6cc8ff"
      label="Tesseract Run. Fly the Quinjet with the Tesseract's case on a cable beneath it and set the case down gently on the pad. Up arrow, W or Space thrusts; left and right arrows, or A and D, lean the jet. With a mouse, hold the button to thrust and the jet leans toward the pointer. On a touch screen, hold THRUST and the lean buttons, or hold a finger on the view. P pauses, R restarts the leg."
      screenProps={{
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onLostPointerCapture: endDrag,
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        onKeyUp,
        style: { touchAction: playing ? 'none' : 'auto' },
      }}
    >
      <canvas ref={hud} className="tr-hud-canvas" aria-hidden="true" />
      {playing && (
        <div className="tr-hud" aria-hidden="true">
          <div className="tr-leg">
            <span className="tr-leg-n">
              Leg {game.current.leg + 1}
              <small> / {LEGS.length}</small>
            </span>
            <span className="tr-leg-title">{L.title}</span>
            <span className="tr-pips">
              {LEGS.map((_, i) => (
                <i key={i} data-done={i < progress.reached || progress.best[i] > 0 || undefined} data-now={i === game.current.leg || undefined} />
              ))}
            </span>
          </div>
          <div className="tr-gauges">
            <span className="tr-fuel" data-low={ui.fuel < 0.2 || undefined}>
              <span className="tr-fuel-label">Fuel</span>
              <span className="tr-fuel-bar">
                <span style={{ width: `${Math.max(0, ui.fuel) * 100}%` }} />
              </span>
              <span className="tr-fuel-n">{Math.round(Math.max(0, ui.fuel) * 100)}%</span>
            </span>
            <span className="tr-time" data-over={ui.t > L.par || undefined}>
              {clock(ui.t)} <small>/ par {clock(L.par)}</small>
            </span>
          </div>
          <p className="tr-message">{ui.message}</p>
        </div>
      )}
      {playing && (
        <div className="tr-touch" aria-hidden="true">
          <div className="tr-touch-lean">
            <button type="button" tabIndex={-1} className="tr-touch-btn" aria-label="Lean back" {...hold(() => (input.current.touchTilt = -1), () => (input.current.touchTilt = 0))}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5 8 12l7 7" />
              </svg>
            </button>
            <button type="button" tabIndex={-1} className="tr-touch-btn" aria-label="Lean on" {...hold(() => (input.current.touchTilt = 1), () => (input.current.touchTilt = 0))}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
          <button type="button" tabIndex={-1} className="tr-touch-btn tr-touch-thrust" aria-label="Thrust" {...hold(() => (input.current.touchThrust = true), () => (input.current.touchThrust = false))}>
            Thrust
          </button>
        </div>
      )}
      {playing && paused && (
        <div className="hq-overlay tr-overlay">
          <p className="hq-overlay-title">Paused</p>
          <p className="hq-overlay-text">
            Leg {game.current.leg + 1}, {L.title.toLowerCase()}. {Math.round(ui.fuel * 100)}% fuel left.
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => (setPaused(false), focus())}>
            Resume
          </button>
        </div>
      )}
      {ui.phase === 'ready' && (
        <div className="hq-overlay tr-overlay tr-menu">
          <p className="hq-overlay-kicker">The hangar · the airfield at golden hour</p>
          <p className="hq-overlay-title">Tesseract Run</p>
          <p className="hq-overlay-text">Fly the Quinjet with the Tesseract’s case slung on a cable beneath it, and set the case down gently on the pad. Six legs from the airfield to the hangar, through gusts, under a gantry and into a storm.</p>
          <StartNote />
          <div className="tr-legs" role="group" aria-label="Legs">
            {LEGS.map((l, i) => (
              <button key={l.id} type="button" className="tr-leg-pick" aria-pressed={i === leg} aria-label={`Leg ${i + 1}: ${l.title}${i > progress.reached ? ', locked' : ''}`} disabled={i > progress.reached} onClick={() => setLeg(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          <p className="tr-leg-name">
            <strong>{LEGS[leg].title}</strong>
            {progress.best[leg] ? <span> · best {fmt(progress.best[leg])}</span> : null}
          </p>
          <ul className="hq-keys">
            <li>
              <kbd>↑</kbd> thrust
            </li>
            <li>
              <kbd>←</kbd>
              <kbd>→</kbd> lean
            </li>
            <li>mouse: hold, lean toward it</li>
          </ul>
          <TouchHelp game="tesseract" />
          <button type="button" className="btn btn-primary mt-3" onClick={() => start(leg)}>
            Fly leg {leg + 1}
          </button>
          {total > 0 && <p className="hq-overlay-best">Best across the legs {fmt(total)}</p>}
        </div>
      )}
      {ui.phase === 'crashed' && crash && (
        <Results
          className="tr-overlay"
          kicker={`Leg ${game.current.leg + 1} · ${L.title}`}
          title={crash.what === 'fuel' ? 'Out of fuel.' : crash.what === 'case' ? 'The case broke.' : 'Crashed.'}
          line={`${crashLine(crash)} ${TIP[crash.what === 'case' && crash.into === 'ground' ? 'ground' : crash.into] ?? ''}`.trim()}
          onAgain={() => start(game.current.leg)}
          more={{ label: 'Legs', onClick: () => ((game.current = newGame({ seed: 1, leg: game.current.leg })), sync({ result: null, crash: null })) }}
        />
      )}
      {ui.phase === 'delivered' && res && (
        <Results
          className="tr-overlay"
          won
          kicker={`Leg ${res.leg + 1} · ${LEGS[res.leg].title}`}
          title={ui.won ? 'The Tesseract is home.' : 'Delivered.'}
          score={res.score}
          best={progress.best[res.leg] ?? res.score}
          newBest={res.isBest}
          stone={ui.won && ui.stone ? 'space' : null}
          stoneText="The Space Stone is yours. It opens a portal."
          onAgain={() => start(res.leg)}
          onward={ui.won ? { label: 'Open the portal', onClick: () => onPortal?.() } : { label: `Fly leg ${res.leg + 2}`, onClick: () => start(res.leg + 1) }}
        >
          <p className="hq-overlay-text">Set down at {res.touch.toFixed(1)} m/s.</p>
          <dl className="tr-score">
            <div>
              <dt>Fuel</dt>
              <dd>{fmt(res.parts.fuel)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{fmt(res.parts.time)}</dd>
            </div>
            <div>
              <dt>Soft</dt>
              <dd>{fmt(res.parts.soft)}</dd>
            </div>
            <div>
              <dt>Aim</dt>
              <dd>{fmt(res.parts.aim)}</dd>
            </div>
          </dl>
        </Results>
      )}
      <p className="sr-only" role="status">
        {playing ? `Leg ${game.current.leg + 1}. ${Math.round(ui.fuel * 100)} percent fuel. ${ui.message}` : ui.phase === 'crashed' ? crashLine(crash) : ui.phase === 'delivered' && res ? `Delivered. ${fmt(res.score)} points.` : ''}
      </p>
    </HQGame>
  );
}

// ── the HUD, drawn every frame over the 3D view ──
function drawHud(cv, g, view, f, live) {
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
  if (!live) return;
  const font = (size, weight = 700) => `${weight} ${size}px "Archivo Variable", Archivo, sans-serif`;
  const L = LEGS[g.leg];
  const pad = PADS[L.to];
  const C = g.case;
  const small = w < 560;

  // ── the pad: a marker over it, or an arrow at the edge pointing to it ──
  const top = view.padScreen(L.to, 7.5);
  const base = view.padScreen(L.to, 0.2);
  const dist = Math.abs(pad.x - C.x);
  ctx.textAlign = 'center';
  const blue = 'rgba(120,210,255,';
  if (top.front && top.x > 24 && top.x < w - 24 && top.y > 30) {
    const bob = calm ? 0 : Math.sin(performance.now() / 260) * 3;
    ctx.fillStyle = `${blue}0.95)`;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(top.x - 9, top.y - 10 + bob);
    ctx.lineTo(top.x + 9, top.y - 10 + bob);
    ctx.lineTo(top.x, top.y + bob);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.font = font(11, 800);
    ctx.lineWidth = 3;
    const label = dist > 8 ? `PAD · ${Math.round(dist)} m` : 'PAD';
    ctx.strokeText(label, top.x, top.y - 16 + bob);
    ctx.fillText(label, top.x, top.y - 16 + bob);
    // the pad's extent on the ground
    if (base.front && dist < 40) {
      const e0 = view.padScreen(L.to, 0.1);
      ctx.strokeStyle = `${blue}0.5)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(e0.x, e0.y);
      ctx.lineTo(top.x, top.y + 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    // off screen: an arrow at the edge
    const right = top.x >= w - 24 || !top.front;
    const y = clamp(top.y, 60, h - (coarse?.matches ? 170 : 80));
    const x = right ? w - 18 : 18;
    ctx.fillStyle = `${blue}0.95)`;
    ctx.beginPath();
    ctx.moveTo(x + (right ? 8 : -8), y);
    ctx.lineTo(x - (right ? 6 : -6), y - 9);
    ctx.lineTo(x - (right ? 6 : -6), y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.font = font(11, 800);
    ctx.textAlign = right ? 'right' : 'left';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    const label = `PAD ${Math.round(dist)} m`;
    ctx.strokeText(label, x - (right ? 12 : -12), y + 22);
    ctx.fillText(label, x - (right ? 12 : -12), y + 22);
    ctx.textAlign = 'center';
  }

  // ── the case: its height over the ground, and how fast it's coming down ──
  const cs = view.caseScreen(g);
  const height = caseHeight(g);
  const down = -C.vy;
  if (cs.front && !C.grounded && height < 16) {
    const gs = view.groundScreen(C.x);
    const by = cs.y + Math.abs(gs.y - cs.y) * 0.08;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(cs.x, by + 14);
    ctx.lineTo(cs.x, gs.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cs.x - 6, gs.y);
    ctx.lineTo(cs.x + 6, gs.y);
    ctx.stroke();
  }
  // the soft-landing gauge, beside the case, when it's near the ground
  const nearPad = Math.abs(C.x - pad.x) < pad.half + 10;
  if (cs.front && !C.grounded && height < (nearPad ? 12 : 7) && (nearPad || down > 0.4)) {
    const gx = cs.x + (small ? 30 : 38);
    const gh = small ? 64 : 84;
    const gy = cs.y - gh / 2;
    const MAX = 5;
    const yOf = (v) => gy + gh - (clamp(v, 0, MAX) / MAX) * gh;
    ctx.fillStyle = 'rgba(6,10,16,0.55)';
    ctx.fillRect(gx - 4, gy - 4, 14, gh + 8);
    const zone = (a, b, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(gx, yOf(b), 6, yOf(a) - yOf(b));
    };
    zone(0, CASE.soft, 'rgba(95,220,140,0.95)');
    zone(CASE.soft, CASE.crash * 0.75, 'rgba(255,196,80,0.9)');
    zone(CASE.crash * 0.75, MAX, 'rgba(255,90,70,0.9)');
    const my = yOf(Math.max(0, down));
    const tone = down < CASE.soft ? '#7dffb0' : down < CASE.crash * 0.75 ? '#ffd36e' : '#ff7a66';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(gx - 5, my);
    ctx.lineTo(gx - 12, my - 5);
    ctx.lineTo(gx - 12, my + 5);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.font = font(small ? 11 : 12, 800);
    const label = `${down > 0.05 ? '↓' : '↑'}${Math.abs(down).toFixed(1)}`;
    ctx.strokeText(label, gx + 3, gy - 10);
    ctx.fillStyle = tone;
    ctx.fillText(label, gx + 3, gy - 10);
    ctx.font = font(10, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const hl = `${height.toFixed(1)} m`;
    ctx.strokeText(hl, gx + 3, gy + gh + 16);
    ctx.fillText(hl, gx + 3, gy + gh + 16);
  }
  // settling on the pad: a ring filling
  if (cs.front && C.settle > 0) {
    const k = clamp(C.settle / CASE.settle, 0, 1);
    ctx.strokeStyle = 'rgba(125,255,176,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cs.x, cs.y, small ? 22 : 30, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
  }

  // ── the wind: an arrow, its speed, and a gust coming ──
  const [wx] = windAt(g, g.jet.x, g.jet.y);
  const sheltered = inHangar(g.jet.x, g.jet.y);
  const wxX = small ? 14 : 18;
  const wxY = h - (small ? 132 : 30);
  ctx.textAlign = 'left';
  ctx.font = font(10, 800);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeText('WIND', wxX, wxY - 14);
  ctx.fillText('WIND', wxX, wxY - 14);
  const len = clamp(Math.abs(wx) * 4, 6, 46);
  const dir = Math.sign(wx) || 1;
  const ax = wxX + 26;
  ctx.strokeStyle = f.gustT > 0 ? 'rgba(255,214,110,0.95)' : 'rgba(170,220,255,0.95)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ax - (dir * len) / 2, wxY);
  ctx.lineTo(ax + (dir * len) / 2, wxY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax + (dir * len) / 2 + dir * 5, wxY);
  ctx.lineTo(ax + (dir * len) / 2 - dir * 3, wxY - 5);
  ctx.lineTo(ax + (dir * len) / 2 - dir * 3, wxY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.font = font(12, 800);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  const wl = sheltered ? 'sheltered' : `${Math.abs(wx).toFixed(1)} m/s`;
  ctx.strokeText(wl, wxX + 58, wxY + 4);
  ctx.fillText(wl, wxX + 58, wxY + 4);
  if (f.gustT > 0) {
    const on = calm || Math.floor(f.gustT * 5) % 2 === 0;
    if (on) {
      ctx.fillStyle = 'rgba(255,214,110,1)';
      ctx.strokeText('GUST', wxX + 58, wxY - 14);
      ctx.fillText('GUST', wxX + 58, wxY - 14);
    }
  }
  // speeds, under the wind
  ctx.font = font(11, 700);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const sp = `→ ${g.jet.vx.toFixed(1)}  ↕ ${g.jet.vy.toFixed(1)} m/s · ${Math.max(0, g.jet.y - (inHangar(g.jet.x, g.jet.y) ? 0 : groundAt(g.jet.x))).toFixed(0)} m`;
  ctx.strokeText(sp, wxX, wxY + 22);
  ctx.fillText(sp, wxX, wxY + 22);
  ctx.textAlign = 'center';
}
