import { useCallback, useEffect, useRef, useState } from 'react';
import HQFrame from '../../avengers/hq/HQFrame';
import { register, useStage } from '../../avengers/hq/useStage';
import { useAchievements } from '../../Achievements';
import { edges, readPad, typing } from '../../games/pad';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop } from '../../../lib/hooks';
import { audioContext } from '../../../lib/audio';
import { capturePointer } from '../../../lib/pointer';
import { CHAPTERS, DIFFICULTY, MARK, WAVES, bossTell, cycle, dodge, lockTarget, newGame, pilot, punch, setInput, startChapter, step } from './rules';
import './thinkmark.css';

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
const DONE = 'tp-invincible-done'; // chapters finished, as a count
const BEST = 'tp-invincible-best';
const LEVEL = 'tp-invincible-level';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const secs = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const calm = typeof window !== 'undefined' && prefersReducedMotion();

const SOUND = { dash: 'zip', jab: 'zip', hit: 'hit', block: 'clang', ko: 'pop', crash: 'crumble', smash: 'crumble', charge: 'flyby', quake: 'thunder', ring: 'coin', bolt: 'laser', zap: 'buzz', hurt: 'knock', spawn: 'pop', whiff: 'knock', dodge: 'zip', wave: 'drum', stagger: 'blast', slugged: 'boom', leave: 'flyby', down: 'boom' };

// What's asked of you, chapter by chapter, for the HUD.
function objective(g) {
  const id = CHAPTERS[g.chapter].id;
  if (id === 'lesson') return `Ring ${Math.min(g.ring + 1, g.rings.length)} of ${g.rings.length}`;
  if (id === 'flaxans') {
    if (g.portal?.closing) return 'The portal is closing';
    if (g.wave < 0) return 'Something is coming through';
    const left = g.enemies.filter((e) => e.state !== 'ko').length + g.spawn;
    return `Wave ${g.wave + 1} of ${WAVES.length} · ${left} left`;
  }
  return null;
}

export default function ThinkMark({ fallback }) {
  const three = use3D();
  const stage = useStage(load, { enabled: three.on, id: 'thinkmark', forced: three.mode === 'on' });
  const { unlock } = useAchievements();
  const [level, setLevel] = useState(() => (DIFFICULTY[local.get(LEVEL, 'hero')] ? local.get(LEVEL, 'hero') : 'hero'));
  const [done, setDone] = useState(() => Number(local.get(DONE, 0)) || 0);
  const [best, setBest] = useState(() => Number(local.get(BEST, 0)) || 0);
  const game = useRef(newGame({ seed: 1, difficulty: level }));
  // the title screen flies the lesson by itself
  const demo = useRef(null);
  const hud = useRef(null);
  const acc = useRef(0);
  const keys = useRef(new Set());
  const drag = useRef(null);
  const stick = useRef(null);
  const held = useRef({ up: false, down: false });
  const pad = useRef(null);
  const slow = useRef(0);
  const fxState = useRef({ popups: [], hurt: 0, said: 0, lastUi: 0 });
  const [ui, setUi] = useState({ phase: 'title', chapter: 0, hp: MARK.hp, boss: null, objective: '', line: null, combo: 0, score: 0, result: null, loading: false });
  const [paused, setPaused] = useState(false);
  const playing = ui.phase === 'play';

  const sync = useCallback((extra = {}) => {
    const g = game.current;
    setUi((u) => ({ ...u, phase: g.phase, chapter: g.chapter, hp: g.mark.hp, combo: g.mark.combo, score: g.score, objective: g.phase === 'play' ? objective(g) : '', boss: g.boss ? { name: g.boss.name, hp: g.boss.hp, max: g.boss.max, open: bossTell(g.boss)?.open } : null, ...extra }));
  }, []);

  const focus = useCallback(() => stage.wrap.current?.querySelector('.hq-screen')?.focus({ preventScroll: true }), [stage.wrap]);

  // the events of a step: sound, haptics, popups, lines and the HUD
  const handle = useCallback(
    (events) => {
      const g = game.current;
      const f = fxState.current;
      let important = null;
      for (const e of events) {
        if (SOUND[e.type]) play(SOUND[e.type]);
        switch (e.type) {
          case 'hit':
            buzz(e.boss ? 35 : 20);
            if (e.boss) play('blast');
            f.popups.push({ at: e.at, text: e.boss ? `${Math.round(e.dmg)}` : `+${100 * e.combo}`, sub: e.combo > 2 ? `×${e.combo}` : '', t: 0, big: e.boss });
            break;
          case 'perfect':
            play('ding');
            buzz(25);
            slow.current = calm ? 0 : 0.9;
            f.popups.push({ at: e.at, text: 'PERFECT', sub: '+250', t: 0, big: true, perfect: true });
            break;
          case 'hurt':
            buzz(80);
            f.hurt = 1;
            break;
          case 'windup':
            play('warn');
            break;
          case 'line':
            important = { line: { who: e.who, text: e.text, key: `${e.key}:${g.t}` } };
            f.said = g.t;
            break;
          case 'chapter':
            play('drum');
            break;
          case 'portal-close':
            play('hyperspace');
            break;
          case 'cleared':
          case 'won': {
            play(e.type === 'won' ? 'fanfare' : 'victory');
            const n = Math.max(done, g.chapter + 1);
            if (n > done) {
              setDone(n);
              local.set(DONE, n);
            }
            if (CHAPTERS[g.chapter].id === 'omni') unlock('thinkmark');
            if (e.type === 'won') {
              unlock('regent');
              if (g.score > best) {
                setBest(g.score);
                local.set(BEST, Math.round(g.score));
              }
            }
            important = { result: { ...g.result, newBest: e.type === 'won' && g.score > best } };
            break;
          }
          case 'lost':
            play('alarm');
            important = { result: { ...g.result } };
            break;
          default:
        }
      }
      if (important) sync(important);
      else if (g.t - f.lastUi > 0.08) {
        f.lastUi = g.t;
        // a line stays up a few seconds
        sync(f.said && g.t - f.said > 5 ? ((f.said = 0), { line: null }) : {});
      }
    },
    [best, done, sync, unlock],
  );

  // a chapter: its sky first, then the fight
  const begin = useCallback(
    async (i, { fresh = false, difficulty = level } = {}) => {
      audioContext(); // in the click, so the first punch can be heard
      const view = stage.view.current;
      if (fresh || game.current.phase === 'title' || game.current.phase === 'won') game.current = newGame({ seed: Date.now() % 100000, difficulty });
      const g = game.current;
      g.difficulty = difficulty;
      setUi((u) => ({ ...u, loading: true }));
      await view?.setChapter(i);
      const ev = startChapter(g, i);
      acc.current = 0;
      slow.current = 0;
      fxState.current = { popups: [], hurt: 0, said: 0, lastUi: 0 };
      setPaused(false);
      view?.fx(ev, g);
      handle(ev);
      sync({ result: null, loading: false });
      focus();
    },
    [focus, handle, level, stage.view, sync],
  );

  // browser checks
  useEffect(
    () =>
      register('thinkmark', {
        get state() {
          return game.current;
        },
        get view() {
          return stage.view.current;
        },
        begin,
        setState(name) {
          const g = game.current;
          if (name === 'boss') {
            g.boss.state = 'windup';
            g.boss.timer = 0.6;
          }
          if (name === 'hurt') g.mark.hp = 30;
          stage.view.current?.snap(g);
          sync();
          return { phase: g.phase, chapter: g.chapter };
        },
      }),
    [begin, stage.view, sync],
  );

  // ── steering: keys, the touch stick and a controller, through the camera ──
  const steer = useCallback((g, view, dt) => {
    const k = keys.current;
    let fx = 0;
    let fz = 0;
    let up = 0;
    let boost = k.has('shift');
    if (k.has('w')) fz += 1;
    if (k.has('s')) fz -= 1;
    if (k.has('d')) fx += 1;
    if (k.has('a')) fx -= 1;
    if (k.has(' ') || held.current.up) up += 1;
    if (k.has('c') || held.current.down) up -= 1;
    // turning the camera with the arrow keys
    const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
    const tilt = (k.has('arrowup') ? 1 : 0) - (k.has('arrowdown') ? 1 : 0);
    if (turn || tilt) view.look(-turn * dt * 2.2, -tilt * dt * 1.4);
    const s = stick.current;
    if (s?.on) {
      fx += s.x;
      fz += -s.y;
      if (Math.hypot(s.x, s.y) > 0.92) boost = true;
    }
    const p = readPad();
    if (p) {
      const e = edges(p, pad.current);
      fx += p.lx;
      fz += -p.ly;
      up += (p.rb ? 1 : 0) - (p.lb ? 1 : 0);
      if (p.rt) boost = true;
      if (Math.abs(p.rx) + Math.abs(p.ry) > 0) view.look(-p.rx * dt * 2.6, p.ry * dt * 1.6);
      if (e.x) punch(g);
      if (e.a || e.b) dodge(g);
      if (e.y) cycle(g);
      if (e.start) setPaused((v) => !v);
    }
    pad.current = p;
    const b = view.basis();
    const dir = [0, 0, 0];
    for (let i = 0; i < 3; i++) dir[i] = b.forward[i] * fz + b.right[i] * fx;
    dir[1] += up;
    setInput(g, dir, boost && (fz > 0.2 || Math.abs(fx) > 0.2 || up !== 0));
  }, []);

  // ── the loop ──
  const tick = useCallback(
    (dtMs) => {
      const view = stage.view.current;
      if (!view) return;
      let g = game.current;
      const real = Math.min(0.05, dtMs / 1000);
      // the title screen: the lesson, flown by the autopilot
      const title = g.phase === 'title';
      if (title) {
        if (!demo.current || demo.current.phase !== 'play') {
          demo.current = newGame({ seed: 7, difficulty: 'hero' });
          startChapter(demo.current, 0);
        }
        g = demo.current;
      }
      const live = g.phase === 'play' && !paused && !ui.loading;
      if (live) {
        if (title) pilot(g);
        else steer(g, view, real);
        // a perfect dodge slows everything for a moment
        slow.current = Math.max(0, slow.current - real);
        const k = slow.current > 0 ? 0.3 : 1;
        acc.current += real * view.timeScale(real) * k;
        const events = [];
        while (acc.current >= STEP) {
          acc.current -= STEP;
          events.push(...step(g, STEP));
          if (g.phase !== 'play') break;
        }
        if (events.length) {
          view.fx(events, g);
          if (!title) handle(events);
        }
      }
      view.render(g, paused ? 0 : real);
      if (!title) drawHud(hud.current, g, view, fxState.current, real, live);
      else hud.current?.getContext('2d')?.clearRect(0, 0, hud.current.width, hud.current.height);
    },
    [handle, paused, stage.view, steer, ui.loading],
  );
  useFrameLoop(tick, stage.status === 'on' && stage.visible);

  // nothing stays held when the window loses focus; pause when scrolled away
  useEffect(() => {
    const stop = () => {
      keys.current.clear();
      stick.current = null;
      drag.current = null;
      held.current = { up: false, down: false };
    };
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => {
    if (!stage.visible && playing) setPaused(true);
  }, [stage.visible, playing]);

  // ── input ──
  const onKeyDown = (e) => {
    if (typing(e.target)) return;
    const g = game.current;
    const k = e.key.toLowerCase();
    if (!playing) {
      if ((k === 'enter' || k === ' ') && e.target === e.currentTarget && !ui.loading) {
        e.preventDefault();
        begin(ui.phase === 'clear' ? ui.chapter + 1 : ui.phase === 'lost' ? ui.chapter : 0);
      }
      return;
    }
    if (k === 'escape' || k === 'p') {
      e.preventDefault();
      setPaused((p) => !p);
      return;
    }
    if (paused) return;
    if (['w', 'a', 's', 'd', 'c', ' ', 'shift', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
      e.preventDefault();
      keys.current.add(k);
    } else if (k === 'j' || k === 'f') {
      e.preventDefault();
      if (!e.repeat) punch(g);
    } else if (k === 'k' || k === 'e') {
      e.preventDefault();
      if (!e.repeat) dodge(g);
    } else if (k === 'tab' || k === 't' || k === 'q') {
      e.preventDefault();
      if (!e.repeat) cycle(g);
    }
  };
  const onKeyUp = (e) => keys.current.delete(e.key.toLowerCase());

  const onPointerDown = (e) => {
    if (paused || !playing || e.target.closest('button')) return;
    const g = game.current;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      if (e.button === 2) {
        dodge(g);
        return;
      }
      capturePointer(e);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      return;
    }
    // touch: the left of the screen steers, the right turns the camera (and a tap punches)
    capturePointer(e);
    if (e.clientX - r.left < r.width * 0.45 && !stick.current) stick.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0, on: true };
    else drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t: e.timeStamp };
  };
  const onPointerMove = (e) => {
    const view = stage.view.current;
    const s = stick.current;
    if (s && s.id === e.pointerId) {
      const R = 46;
      const dx = (e.clientX - s.x0) / R;
      const dy = (e.clientY - s.y0) / R;
      const l = Math.max(1, Math.hypot(dx, dy));
      s.x = dx / l;
      s.y = dy / l;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !view) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    view.look(dx * 0.006, dy * 0.005);
  };
  const onPointerUp = (e) => {
    if (stick.current?.id === e.pointerId) {
      stick.current = null;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    // a click (or a tap) that didn't turn the camera is a punch
    if (d.moved < 8 && playing && !paused) punch(game.current);
  };
  const touchButton = (which) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      capturePointer(e);
      if (which === 'dodge') dodge(game.current);
      else held.current[which] = true;
    },
    onPointerUp: () => (held.current[which] = false),
    onPointerCancel: () => (held.current[which] = false),
  });

  const pick = (lv) => {
    setLevel(lv);
    local.set(LEVEL, lv);
  };

  const res = ui.result;
  const ch = CHAPTERS[ui.chapter];
  const next = CHAPTERS[ui.chapter + 1];
  const open = Math.min(done, CHAPTERS.length - 1); // the furthest chapter you can start from
  return (
    <HQFrame
      stage={stage}
      three={three}
      fallback={fallback}
      className="tm-game"
      accent="#ffd23a"
      label="Think, Mark! You are Invincible, flying over the city. W, A, S and D fly, Space climbs, C dives, Shift boosts; the arrow keys or dragging the mouse turn the camera. J or a click punches whatever you're locked on to, K or a right-click dodges, Tab changes target. On a touch screen, the left of the screen steers, dragging on the right turns the camera and a tap punches, with buttons to dodge, climb and dive."
      screenProps={{
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: () => ((stick.current = null), (drag.current = null)),
        onContextMenu: (e) => e.preventDefault(),
        onKeyDown,
        onKeyUp,
        style: { touchAction: playing ? 'none' : 'auto' },
      }}
    >
      <canvas ref={hud} className="tm-hud-canvas" aria-hidden="true" />
      {playing && (
        <div className="tm-hud" aria-hidden="true">
          <div className="tm-me">
            <span className="tm-name">Invincible</span>
            <span className="tm-bar" data-low={ui.hp < 30 || undefined}>
              <span style={{ width: `${(ui.hp / MARK.hp) * 100}%` }} />
            </span>
            <span className="tm-score">{fmt(ui.score)}</span>
          </div>
          {ui.boss ? (
            <div className="tm-boss" data-open={ui.boss.open || undefined}>
              <span className="tm-boss-name">{ui.boss.name}</span>
              <span className="tm-boss-bar">
                <span style={{ width: `${(ui.boss.hp / ui.boss.max) * 100}%` }} />
              </span>
              <span className="tm-boss-tell">{ui.boss.open ? 'Open: hit him now' : 'Dodge his charge, then punish'}</span>
            </div>
          ) : (
            ui.objective && <div className="tm-objective">{ui.objective}</div>
          )}
          {ui.combo > 1 && <div className="tm-combo">{ui.combo} hit combo</div>}
          {ui.line && (
            <p className="tm-line" key={ui.line.key}>
              <b>{ui.line.who}</b> {ui.line.text}
            </p>
          )}
        </div>
      )}
      {playing && !paused && (
        <div className="tm-touch" aria-hidden="true">
          <button type="button" className="tm-touch-btn" {...touchButton('up')}>
            ▲
          </button>
          <button type="button" className="tm-touch-btn" {...touchButton('down')}>
            ▼
          </button>
          <button type="button" className="tm-touch-btn tm-touch-dodge" {...touchButton('dodge')}>
            Dodge
          </button>
        </div>
      )}
      {(!playing || paused) && (
        <div className="hq-overlay tm-overlay">
          {paused ? (
            <>
              <p className="hq-overlay-title">Paused</p>
              <p className="hq-overlay-text">{ch.title}. {Math.round(ui.hp)} strength left.</p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => (setPaused(false), focus())}>
                Keep fighting
              </button>
            </>
          ) : ui.loading ? (
            <p className="hq-overlay-kicker">{ch.kicker} · loading the sky</p>
          ) : ui.phase === 'clear' && res ? (
            <>
              <p className="hq-overlay-kicker">{ch.kicker} · done</p>
              <p className="hq-overlay-title">{ch.title}</p>
              <p className="hq-overlay-text">
                {secs(res.time)} · {fmt(res.score)} points{res.perfects ? ` · ${res.perfects} perfect ${res.perfects === 1 ? 'dodge' : 'dodges'}` : ''}
              </p>
              {next && (
                <>
                  <p className="hq-overlay-kicker mt-4">Next · {next.kicker}</p>
                  <p className="tm-next">{next.title}</p>
                  <p className="hq-overlay-text">{next.blurb}</p>
                </>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button type="button" className="btn btn-primary" onClick={() => begin(ui.chapter + 1)}>
                  On to {next.title}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => begin(ui.chapter)}>
                  Again
                </button>
              </div>
            </>
          ) : ui.phase === 'won' && res ? (
            <>
              <p className="hq-overlay-kicker">Chapter four · done</p>
              <p className="hq-overlay-title">The Grand Regent is down.</p>
              <p className="hq-overlay-text">Your father would be proud. Probably. It’s complicated.</p>
              <p className="hq-overlay-score">
                {fmt(res.total)}
                <small>{res.newBest ? 'a new best' : best ? `best ${fmt(best)}` : 'points'}</small>
              </p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => begin(0, { fresh: true })}>
                From the top
              </button>
            </>
          ) : ui.phase === 'lost' && res ? (
            <>
              <p className="hq-overlay-kicker">{ch.kicker}</p>
              <p className="hq-overlay-title">{ch.id === 'omni' ? 'Think, Mark!' : ch.id === 'thragg' ? 'Viltrum wins this round.' : 'Down, not out.'}</p>
              <p className="hq-overlay-text">{ch.id === 'lesson' ? 'Through the rings, in order.' : 'Watch the ring close round him: dodge as it closes, then hit him while he recovers. Punching him at any other time only gets you hit back.'}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button type="button" className="btn btn-primary" onClick={() => begin(ui.chapter)}>
                  Try {ch.title} again
                </button>
                {level !== 'guardian' && (
                  <button type="button" className="btn btn-ghost" onClick={() => (pick('guardian'), begin(ui.chapter, { difficulty: 'guardian' }))}>
                    Easier
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="hq-overlay-kicker">A flight brawler · four chapters</p>
              <p className="hq-overlay-title tm-title">Think, Mark!</p>
              <p className="hq-overlay-text">You’re Invincible: half-Viltrumite, eighteen, still learning to fly. Your father wants to see you try. Then the Flaxans come through, your father turns out to be something else, and the Grand Regent comes for the planet.</p>
              <div className="tm-levels" role="radiogroup" aria-label="Difficulty">
                {Object.entries(DIFFICULTY).map(([id, d]) => (
                  <button key={id} type="button" role="radio" aria-checked={level === id} className="tm-level" onClick={() => pick(id)}>
                    <b>{d.label}</b>
                    <small>{d.note}</small>
                  </button>
                ))}
              </div>
              <ul className="hq-keys">
                <li>
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd> fly
                </li>
                <li>
                  <kbd>Space</kbd>/<kbd>C</kbd> up, down
                </li>
                <li>
                  <kbd>Shift</kbd> boost
                </li>
                <li>
                  <kbd>J</kbd> or click: punch
                </li>
                <li>
                  <kbd>K</kbd> or right-click: dodge
                </li>
                <li>Drag or arrows: look</li>
              </ul>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button type="button" className="btn btn-primary" onClick={() => begin(0, { fresh: true })}>
                  Fly
                </button>
                {open > 0 &&
                  CHAPTERS.slice(1, open + 1).map((c, i) => (
                    <button key={c.id} type="button" className="btn btn-ghost" onClick={() => begin(i + 1, { fresh: true })}>
                      {c.title}
                    </button>
                  ))}
              </div>
              {best > 0 && <p className="hq-overlay-best">Best {fmt(best)}</p>}
            </>
          )}
        </div>
      )}
      <p className="sr-only" role="status">
        {playing ? `${ch.title}. Strength ${Math.round(ui.hp)}. ${ui.boss ? `${ui.boss.name} ${Math.round((ui.boss.hp / ui.boss.max) * 100)} percent.` : ui.objective} ${ui.line ? `${ui.line.who}: ${ui.line.text}` : ''}` : ''}
      </p>
    </HQFrame>
  );
}

// ── the HUD drawn every frame over the 3D view: the lock, the boss's tell,
// the way to the next ring, popups, hurt and speed ──
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
  const edge = (rgb, a) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, `rgba(${rgb},0)`);
    grad.addColorStop(1, `rgba(${rgb},${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  };
  if (!calm && f.hurt > 0) edge('255,40,30', 0.5 * f.hurt);
  if (g.mark.hp < 30) edge('200,20,20', 0.18 + 0.06 * Math.sin(g.t * 5));
  if (!live) return;
  const font = (size, weight = 700) => `${weight} ${size}px "Archivo Variable", Archivo, sans-serif`;

  // speed lines, flat out
  const speed = Math.hypot(...g.mark.v);
  if (!calm && speed > 34 && g.mark.state === 'fly') {
    const k = Math.min(1, (speed - 34) / 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.round(k * 26); i++) {
      const a = (i * 2.399 + Math.floor(g.t * 20) * 0.7) % (Math.PI * 2);
      const r0 = Math.max(w, h) * (0.3 + ((i * 0.37 + g.t * 3) % 1) * 0.3);
      const len = 30 + k * 50;
      const cx = w / 2 + Math.cos(a) * r0;
      const cy = h / 2 + Math.sin(a) * r0 * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.6);
      ctx.stroke();
    }
  }

  // something to point at off the screen: an arrow at the edge
  const arrow = (c, color) => {
    let x = c.x - w / 2;
    let y = c.y - h / 2;
    if (!c.front) {
      x = -x;
      y = -y;
    }
    const s = Math.min((w / 2 - 28) / Math.max(1e-6, Math.abs(x)), (h / 2 - 28) / Math.max(1e-6, Math.abs(y)));
    const ax = w / 2 + x * s;
    const ay = h / 2 + y * s;
    const a = Math.atan2(y, x);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  const onScreen = (c) => c.front && c.x > 0 && c.x < w && c.y > 0 && c.y < h;

  // the next ring
  if (g.rings.length && g.ring < g.rings.length) {
    const c = view.project(g.rings[g.ring].p);
    if (!onScreen(c)) arrow(c, '#ffd23a');
    else {
      ctx.fillStyle = '#ffd23a';
      ctx.font = font(12, 800);
      ctx.textAlign = 'center';
      ctx.fillText(`${g.ring + 1}`, c.x, c.y + 4);
    }
  }

  // the lock, and the boss's tell: a ring closing on him as he winds up
  const t = lockTarget(g);
  if (t) {
    const c = view.project(t.p);
    if (!onScreen(c)) arrow(c, t === g.boss ? '#ff6a4a' : '#e070ff');
    else {
      const R = 16;
      ctx.strokeStyle = t === g.boss ? 'rgba(255,120,90,0.9)' : 'rgba(230,140,255,0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(c.x, c.y, R, a - 0.35, a + 0.35);
        ctx.stroke();
      }
      const tell = t === g.boss ? bossTell(g.boss) : null;
      if (tell?.windup > 0) {
        const k = tell.windup;
        const rr = R + (1 - k) * 90;
        ctx.strokeStyle = k > 0.8 ? `rgba(255,${Math.round(60 + 140 * Math.abs(Math.sin(g.t * 30)))},60,1)` : 'rgba(255,200,120,0.85)';
        ctx.lineWidth = k > 0.8 ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        if (k > 0.75) {
          ctx.fillStyle = '#ffffff';
          ctx.font = font(13, 900);
          ctx.textAlign = 'center';
          ctx.fillText('DODGE', c.x, c.y - rr - 8);
        }
      } else if (tell?.open) {
        ctx.fillStyle = '#ffe17a';
        ctx.font = font(12, 900);
        ctx.textAlign = 'center';
        ctx.fillText('OPEN', c.x, c.y - R - 8);
      }
    }
  }

  // popups over what was hit
  ctx.textAlign = 'center';
  f.popups = f.popups.filter((p) => p.t < 1);
  for (const p of f.popups) {
    p.t += dt;
    const c = view.project(p.at);
    if (!c.front) continue;
    const y = c.y - (calm ? 0 : p.t * 44);
    ctx.globalAlpha = Math.min(1, (1 - p.t) * 2.5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.font = font(p.big ? 21 : 15, 800);
    ctx.fillStyle = p.perfect ? '#8fe3ff' : p.big ? '#ffe17a' : '#ffffff';
    ctx.strokeText(p.text, c.x, y);
    ctx.fillText(p.text, c.x, y);
    if (p.sub) {
      ctx.font = font(11, 800);
      ctx.fillStyle = '#ffd23a';
      ctx.strokeText(p.sub, c.x, y + 16);
      ctx.fillText(p.sub, c.x, y + 16);
    }
    ctx.globalAlpha = 1;
  }
}
