import { useCallback, useEffect, useRef, useState } from 'react';
import { use3D } from '../../../lib/gpu';
import { audioContext } from '../../../lib/audio';
import { local, useInView, useMediaQuery } from '../../../lib/hooks';
import { device } from '../../../lib/device';
import { readPad, typing } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import { AREAS } from './areas';
import { createSim } from './sim';
import { createSounds } from './sounds';
import { useVoiced } from '../../../lib/useVoiced';
import { flags, register, unregister } from '../../../lib/ai/inspect';
import './game.css';

// Cybertron, the world: Iacon at war, and Team Prime's base and Jasper on
// Earth, joined by bridges, walked and driven as Optimus Prime. This keeps
// the controls (keys and the mouse, a gamepad, a phone's thumbs), the HUD
// over the world, the crossing of a bridge, and what's been done (kept
// between visits); sim.js is what happens and scene.js draws it.
//
// Without 3D it isn't drawn at all, and the page shows what it showed
// before (`fallback`).

const KEPT = 'tp-cybertron-world'; // { done: [mission ids], area }

// The visit's seed: made once a visit and kept for it (the universe map's
// key, so one visit is one seed everywhere), unless ?seed= pins it
function visitSeed() {
  try {
    const kept = Number(sessionStorage.getItem('tp-visit-seed'));
    if (Number.isFinite(kept) && kept !== 0) return kept;
    const seed = Date.now() | 0;
    sessionStorage.setItem('tp-visit-seed', String(seed));
    return seed;
  } catch {
    // (private windows and blocked site data throw: a seed for this mount alone)
    return Date.now() | 0;
  }
}
const LOOK = 0.0024; // radians a pixel of mouse

const KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'jump',
  KeyF: 'fire',
  KeyQ: 'transform',
  KeyE: 'use',
  KeyM: 'missions',
};

export default function GameWorld({ fallback = null, side = 'autobot' }) {
  const three = use3D();
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return world ? <World gl={gl} setGl={setGl} side={side} /> : fallback;
}

// where each side's campaign is played, and who you are there
const SIDES = {
  autobot: { area: 'iacon', name: 'Optimus', title: 'Roll out, Optimus', lede: 'Walk Iacon at war as Optimus Prime, transform and drive, hold the line against the Decepticons, and bridge to Team Prime’s base on Earth.' },
  decepticon: { area: 'kaon', name: 'Megatron', title: 'Decepticons, attack', lede: 'Rule Kaon as Megatron: fight in the pits, fuel the war machine, run the Autobots down in your tank and break Zeta Prime at your fortress’s gate.' },
};
const sideOf = (areaId) => (AREAS[areaId]?.side === 'decepticon' ? 'decepticon' : 'autobot');

function World({ gl, setGl, side }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.2 });
  const canvas = useRef(null);
  const api = useRef(null);
  const { unlock } = useAchievements();
  const sounds = useRef(null);
  const kept = useRef(local.get(KEPT, null) ?? {});
  const sim = useRef(null);
  if (!sim.current) {
    // (where you were, or your side's capital the first time)
    const area = AREAS[kept.current.area] ? kept.current.area : SIDES[side]?.area ?? 'iacon';
    sim.current = createSim({ area, done: Array.isArray(kept.current.done) ? kept.current.done.filter((d) => typeof d === 'string') : [], seed: flags().seed ?? visitSeed() });
  }
  const ctl = useRef({ held: new Set(), edges: new Set(), view: { yaw: 0, pitch: -0.12, zoom: 1, firing: false }, lastLook: -1e9, mouseFire: false, stick: { x: 0, y: 0 }, look: null, pad: null });
  // (in development, #…?autoplay starts it playing, for screenshots)
  const [playing, setPlaying] = useState(() => import.meta.env.DEV && typeof location !== 'undefined' && location.hash.includes('autoplay'));
  const [hud, setHud] = useState(() => sim.current.hud());
  useVoiced(hud.talk?.id, hud.talk?.line); // in their own voice where it's been made (lib/voiced.js)
  const hudKey = useRef('');
  const playingSide = sideOf(sim.current.area.id);
  // (the crosshair's tick when a shot lands, the screen's red edge when hit:
  // straight on the elements, every frame they happen, not through React)
  const crossEl = useRef(null);
  const hurtEl = useRef(null);
  const flash = (el, cls) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // (restarts the animation)
    el.classList.add(cls);
  };
  const [toast, setToast] = useState(null);
  const [fade, setFade] = useState(null); // a bridge crossed: its colour while the next place loads
  const [list, setList] = useState(false);
  const crossing = useRef(false);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.long ? 5200 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // the world: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(r.width, r.height);
    };
    sounds.current = createSounds();
    const s = sim.current;
    ctl.current.view.yaw = s.player.yaw;
    import('./scene')
      .then(({ createGame }) => (dead || !canvas.current ? null : createGame(canvas.current, { tier: device().tier, onLost: () => !dead && setGl('lost') })))
      .then(async (a) => {
        if (!a) return;
        if (dead) return a.dispose();
        api.current = a;
        fit();
        await a.setArea(s.area);
        if (dead) return;
        await Promise.race([a.precompile(), new Promise((r) => setTimeout(r, 4000))]);
        if (!dead) setGl('on');
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro && canvas.current) ro.observe(canvas.current);
    // the Decepticons' minds, for the AI inspector (?ai=1) and the check
    // (scripts/cybertron-check.mjs): their trace, and what they cost a step
    // (no schedule here: every one thinks every step, so `schedule` is the
    // sim's own count of that)
    const ai = { schedule: { stats: s.stats }, trace: s.trace, stats: s.stats };
    if (import.meta.env.DEV) window.__CY__ = { sim: s, api, ctl, ai, spawn: s.spawn };
    const inspected = import.meta.env.DEV || flags().ai;
    if (inspected) register('cybertron', { trace: s.trace, schedule: ai.schedule, actors: s.actors, agents: () => s.enemies.filter((e) => !e.dead).map((e) => ({ id: e.id, kind: e.kind, at: { x: e.x, y: e.y, z: e.z }, mode: e.state })) });
    return () => {
      dead = true;
      if (inspected) unregister('cybertron');
      ro?.disconnect();
      api.current?.dispose();
      api.current = null;
      sounds.current?.dispose();
    };
  }, [setGl]);

  // keeping what's been done
  const save = useCallback(() => {
    const s = sim.current;
    local.set(KEPT, { done: s.missions.done, area: s.area.id });
  }, []);

  // ── input ──
  const stopPlaying = useCallback(() => {
    setPlaying(false);
    ctl.current.held.clear();
    ctl.current.mouseFire = false;
    if (document.pointerLockElement === canvas.current) document.exitPointerLock?.();
  }, []);

  const startPlaying = useCallback(() => {
    audioContext(); // in the click, so the world can be heard
    sounds.current?.wake();
    setPlaying(true);
    if (!touch) canvas.current?.requestPointerLock?.()?.catch?.(() => {});
    canvas.current?.focus({ preventScroll: true });
  }, [touch]);

  // (the page knows, so the guide's ? keeps clear of the touch buttons)
  useEffect(() => {
    if (!playing) return undefined;
    const root = document.documentElement;
    root.dataset.playing = 'cybertron';
    return () => {
      if (root.dataset.playing === 'cybertron') delete root.dataset.playing;
    };
  }, [playing]);

  useEffect(() => {
    if (!playing) return undefined;
    const c = ctl.current;
    const down = (e) => {
      if (typing(e.target)) return;
      if (e.code === 'Escape') return stopPlaying();
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      if (!c.held.has(k)) c.edges.add(k);
      c.held.add(k);
    };
    const up = (e) => {
      const k = KEYS[e.code];
      if (k) c.held.delete(k);
    };
    const blur = () => {
      c.held.clear();
      c.mouseFire = false;
    };
    const move = (e) => {
      if (document.pointerLockElement !== canvas.current) return;
      c.view.yaw -= e.movementX * LOOK;
      c.view.pitch = Math.max(-0.7, Math.min(0.55, c.view.pitch - e.movementY * LOOK));
      c.lastLook = performance.now();
    };
    const lockChange = () => {
      if (!document.pointerLockElement && !touch) setPlaying(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', lockChange);
    };
  }, [playing, stopPlaying, touch]);

  // the mouse on the world: buttons fire, the wheel zooms, a drag looks
  // round (where the pointer can't be locked)
  const onPointerDown = (e) => {
    if (!playing) return;
    if (e.pointerType === 'mouse' && e.button === 0) ctl.current.mouseFire = true;
    if (e.pointerType !== 'mouse' || document.pointerLockElement !== canvas.current) ctl.current.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e) => {
    const d = ctl.current.drag;
    if (!d || d.id !== e.pointerId) return;
    const v = ctl.current.view;
    v.yaw -= (e.clientX - d.x) * LOOK * 1.4;
    v.pitch = Math.max(-0.7, Math.min(0.55, v.pitch - (e.clientY - d.y) * LOOK * 1.4));
    d.x = e.clientX;
    d.y = e.clientY;
    ctl.current.lastLook = performance.now();
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) ctl.current.mouseFire = false;
    if (ctl.current.drag?.id === e.pointerId) ctl.current.drag = null;
  };
  const onWheel = (e) => {
    if (!playing) return;
    const v = ctl.current.view;
    v.zoom = Math.max(0.55, Math.min(1.8, v.zoom * (1 + Math.sign(e.deltaY) * 0.08)));
  };

  // ── a bridge crossed ──
  const cross = useCallback(
    async (to, at) => {
      if (crossing.current) return;
      crossing.current = true;
      const s = sim.current;
      sounds.current?.bridge();
      setFade(to === 'iacon' || to === 'kaon' || s.area.id === 'iacon' || s.area.id === 'kaon' ? 'space' : 'ground');
      await new Promise((r) => setTimeout(r, 650));
      s.enter(to, at);
      ctl.current.view.yaw = s.player.yaw;
      save();
      await api.current?.setArea(s.area);
      setToast({ title: s.area.name, text: { iacon: 'Iacon, in the last days of the war', kaon: 'Kaon, the Decepticons’ capital', base: 'Omega One, outside Jasper, Nevada' }[to] ?? 'The desert outside Jasper' });
      setFade(null);
      crossing.current = false;
    },
    [save],
  );

  // (in development: window.__CY__.go('base') crosses to a place)
  useEffect(() => {
    if (import.meta.env.DEV && window.__CY__) window.__CY__.go = (to, at = 'start') => cross(to, at);
  }, [cross]);

  // ── a frame ──
  const loop = useRef(null);
  useEffect(() => {
    const active = gl === 'on' && inView;
    if (!active) return undefined;
    let raf = 0;
    let last = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      const s = sim.current;
      const c = ctl.current;
      const a = api.current;
      if (!a) return;
      const held = playing ? c.held : new Set();
      const pad = playing ? readPad() : null;
      const p = s.player;
      // the pad's right stick looks round
      if (pad && (Math.abs(pad.rx) > 0.15 || Math.abs(pad.ry) > 0.15)) {
        c.view.yaw -= pad.rx * dt * 2.6;
        c.view.pitch = Math.max(-0.7, Math.min(0.55, c.view.pitch - pad.ry * dt * 1.8));
        c.lastLook = now;
      }
      // a phone's look pad
      if (c.look) {
        c.view.yaw -= c.look.dx * LOOK * 1.6;
        c.view.pitch = Math.max(-0.7, Math.min(0.55, c.view.pitch - c.look.dy * LOOK * 1.6));
        c.look.dx = 0;
        c.look.dy = 0;
        c.lastLook = now;
      }
      // the camera swings round behind the truck when you're not looking about
      if (p.mode === 'vehicle' && now - c.lastLook > 1400 && Math.abs(p.speed) > 4) {
        const behind = p.speed >= 0 ? p.yaw : p.yaw + Math.PI;
        c.view.yaw += Math.atan2(Math.sin(behind - c.view.yaw), Math.cos(behind - c.view.yaw)) * Math.min(1, dt * 2.2);
      }
      let mx = (held.has('right') ? -1 : 0) + (held.has('left') ? 1 : 0);
      let mz = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
      if (pad && (Math.abs(pad.lx) > 0.15 || Math.abs(pad.ly) > 0.15)) {
        mx = -pad.lx;
        mz = -pad.ly;
      }
      if (Math.hypot(c.stick.x, c.stick.y) > 0.1) {
        mx = -c.stick.x;
        mz = -c.stick.y;
      }
      // keys are relative to where the camera faces (+x is to the left)
      const fy = Math.sin(c.view.yaw);
      const fz = Math.cos(c.view.yaw);
      const moveX = fy * mz + fz * mx;
      const moveZ = fz * mz - fy * mx;
      const edge = (k) => c.edges.has(k);
      const firing = playing && (held.has('fire') || c.mouseFire || c.touchFire || !!pad?.rt);
      const input = {
        moveX,
        moveZ,
        run: held.has('run') || !!pad?.lb || c.touchRun,
        jump: edge('jump') || (pad?.a && !c.pad?.a) || c.touchJump,
        throttle: mz,
        steer: mx,
        boost: held.has('run') || !!pad?.lb || c.touchRun,
        fire: firing,
        transform: edge('transform') || (pad?.y && !c.pad?.y) || c.touchShift,
        use: false,
        aimYaw: c.view.yaw,
        aimPitch: c.view.pitch + 0.08,
        muzzle: api.current?.muzzle?.() ?? null,
      };
      c.touchJump = false;
      c.touchShift = false;
      if (edge('missions')) setList((v) => !v);
      const wantUse = edge('use') || (pad?.x && !c.pad?.x) || c.touchUse;
      c.touchUse = false;
      c.pad = pad;
      c.edges.clear();
      const events = s.step(input, dt);
      if (wantUse) events.push(...s.use());
      // what it sounds like
      const snd = sounds.current;
      for (const e of events) {
        if (e.type === 'fire') snd?.blaster(true);
        else if (e.type === 'enemyFire') e.heavy ? snd?.boom(false) : snd?.blaster(false);
        else if (e.type === 'enemyShift') snd?.transform();
        else if (e.type === 'ram') snd?.boom(false);
        else if (e.type === 'hit' || e.type === 'hitMe') {
          snd?.hit();
          if (e.type === 'hit') flash(crossEl.current, 'cyw-hitmark');
          else flash(hurtEl.current, 'cyw-hurt-on');
        }
        else if (e.type === 'kill') snd?.boom(e.boss);
        else if (e.type === 'transform') snd?.transform();
        else if (e.type === 'pickup') snd?.pickup();
        else if (e.type === 'jump') snd?.jump();
        else if (e.type === 'start') setToast({ title: e.title, text: 'Mission started' });
        else if (e.type === 'failed') setToast({ title: 'Out of time', text: 'The step starts over' });
        else if (e.type === 'complete') {
          snd?.done();
          if (e.id === 'wake-metroplex') snd?.boss(); // (Metroplex, waking on the skyline)
          if (e.achievement) unlock(e.achievement);
          setToast({ title: e.title, text: 'Mission complete', long: true });
          save();
        } else if (e.type === 'dead') setToast({ title: 'Down', text: 'Back on your feet in a moment' });
        else if (e.type === 'exit' && s.exit) cross(s.exit.to, s.exit.at);
      }
      if (s.exit && !crossing.current) cross(s.exit.to, s.exit.at);
      snd?.engine({ speed: p.mode === 'vehicle' ? Math.abs(p.speed) / 40 : Math.hypot(p.vx, p.vz) / 30, robot: p.mode === 'robot', boost: input.boost && p.mode === 'vehicle' && p.boost > 0, on: playing });
      a.events(events);
      const h = s.hud();
      const step = s.missions.active ? s.hud().mission : null;
      const m = s.missions.active ? s.area.missions.concat(...Object.values(AREAS).map((x) => x.missions)).find((x) => x.id === s.missions.active) : null;
      const st = m?.steps[s.missions.step];
      const drive = st?.type === 'drive' && (st.area ?? m.area ?? s.area.id) === s.area.id ? { gates: st.gates, next: s.missions.count } : null;
      a.render(s, { ...c.view, firing, throttle: input.throttle, hud: { target: h.target, drive } }, dt, now);
      // the HUD, redrawn only when something on it changes
      const key = JSON.stringify([h, step, Math.round(h.hp * 50), Math.round(h.boost * 20)]);
      if (key !== hudKey.current) {
        hudKey.current = key;
        setHud({ ...h, yaw: c.view.yaw, px: p.x, pz: p.z });
      }
      loop.current = { yaw: c.view.yaw };
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [gl, inView, playing, cross, save, unlock]);

  // the compass: which way the target is from where the camera looks
  const bearing = hud.target ? Math.atan2(hud.target.x - hud.px, hud.target.z - hud.pz) : null;
  const rel = bearing === null ? 0 : Math.atan2(Math.sin(bearing - (loop.current?.yaw ?? hud.yaw)), Math.cos(bearing - (loop.current?.yaw ?? hud.yaw)));
  const dist = hud.target ? Math.round(Math.hypot(hud.target.x - hud.px, hud.target.z - hud.pz)) : 0;
  const prompt = hud.near ? (hud.near.type === 'talk' ? `E  Talk to ${hud.near.label}` : hud.near.type === 'shift' ? `Q  Transform to talk to ${hud.near.label}` : `E  ${hud.near.label}`) : null;

  // a phone's thumbs: a stick on the left, looking on the right
  const stickRef = useRef(null);
  const onStick = (e) => {
    const r = stickRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    const l = Math.max(1, Math.hypot(x, y));
    ctl.current.stick = { x: x / l, y: y / l };
  };
  const lookRef = useRef(null);

  return (
    <section ref={box} className="cyw" data-playing={playing ? '' : undefined} aria-label={`Cybertron: walk and drive as ${SIDES[playingSide].name}`}>
      <canvas ref={canvas} className="cyw-canvas" tabIndex={-1} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />
      {gl !== 'on' && (
        <div className="cyw-loading" role="status">
          <span className="cyw-spinner" aria-hidden="true" />
          Bridging to Cybertron…
        </div>
      )}
      {gl === 'on' && !playing && (
        <div className="cyw-start">
          <p className="cyw-kicker">{hud.area}</p>
          <h2 className="cyw-title">{SIDES[playingSide].title}</h2>
          <p className="cyw-lede">{SIDES[playingSide].lede}</p>
          <div className="cyw-sides" role="group" aria-label="Who you play">
            {Object.entries(SIDES).map(([id, s]) => (
              <button key={id} type="button" className="cyw-side" data-side={id} aria-pressed={playingSide === id} onClick={() => playingSide !== id && cross(s.area, 'start')}>
                {s.name} <span>· {AREAS[s.area].name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={startPlaying}>
            {touch ? 'Play' : 'Click to play'}
          </button>
          {!touch && (
            <dl className="cyw-keys">
              <div><dt>W A S D</dt><dd>Walk / drive</dd></div>
              <div><dt>Mouse</dt><dd>Look and aim</dd></div>
              <div><dt>Click / F</dt><dd>Fire</dd></div>
              <div><dt>Q</dt><dd>Transform</dd></div>
              <div><dt>Shift</dt><dd>Run / boost</dd></div>
              <div><dt>Space</dt><dd>Jump</dd></div>
              <div><dt>E</dt><dd>Talk, use bridges</dd></div>
              <div><dt>M</dt><dd>Missions</dd></div>
              <div><dt>Esc</dt><dd>Let go</dd></div>
            </dl>
          )}
          <p className="cyw-progress">
            {hud.done} of {hud.total} missions done
          </p>
        </div>
      )}
      {gl === 'on' && (
        <div className="cyw-hud" aria-live="polite">
          <div className="cyw-mission">
            {hud.mission ? (
              <>
                <p className="cyw-mission-title">{hud.mission.title}</p>
                <p className="cyw-mission-text">
                  {hud.mission.text}
                  {hud.mission.count && <span className="cyw-count"> {hud.mission.count}</span>}
                  {hud.mission.timer !== null && <span className="cyw-timer"> {Math.ceil(hud.mission.timer)}s</span>}
                </p>
              </>
            ) : hud.offers.length ? (
              <p className="cyw-mission-text">
                {hud.offers[0].giver} has something for you: <strong>{hud.offers[0].title}</strong>
              </p>
            ) : (
              <p className="cyw-mission-text">{hud.area}</p>
            )}
          </div>
          {hud.target && (
            <div className="cyw-compass" style={{ '--rel': `${(-rel * 180) / Math.PI}deg` }}>
              <span className="cyw-arrow" aria-hidden="true" />
              <span className="cyw-compass-label">
                {hud.target.label} · {dist} m
              </span>
            </div>
          )}
          <div className="cyw-stats">
            <span className="cyw-energon" title="Energon">◆ {hud.energon}</span>
          </div>
          <div className="cyw-bars">
            <div className="cyw-bar" aria-label="Health">
              <span style={{ width: `${Math.round(hud.hp * 100)}%` }} />
            </div>
            {hud.mode === 'vehicle' && (
              <div className="cyw-bar cyw-boost" aria-label="Boost">
                <span style={{ width: `${Math.round(hud.boost * 100)}%` }} />
              </div>
            )}
          </div>
          {hud.boss && (
            <div className="cyw-boss">
              <p>
                {hud.boss.name}
                {hud.boss.form === 'tank' ? ' · tank' : ''}
              </p>
              <div className="cyw-bar">
                <span style={{ width: `${Math.round(hud.boss.hp * 100)}%` }} />
              </div>
            </div>
          )}
          {playing && hud.mode === 'robot' && <span ref={crossEl} className="cyw-cross" aria-hidden="true" />}
          <div ref={hurtEl} className="cyw-hurt" aria-hidden="true" />
          {playing && prompt && <p className="cyw-prompt">{prompt}</p>}
          {hud.talk && (
            <div className="cyw-talk">
              <p className="cyw-talk-name">{hud.talk.name}</p>
              <p>{hud.talk.line}</p>
            </div>
          )}
          {toast && (
            <div className="cyw-toast" key={toast.title}>
              <p className="cyw-toast-title">{toast.title}</p>
              <p>{toast.text}</p>
            </div>
          )}
          {list && <Missions sim={sim.current} onClose={() => setList(false)} />}
          {hud.down && <div className="cyw-down">Down</div>}
        </div>
      )}
      {fade && <div className={`cyw-fade cyw-fade-${fade}`} aria-hidden="true" />}
      {gl === 'on' && playing && touch && (
        <div className="cyw-touch">
          <div
            ref={stickRef}
            className="cyw-stick"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onStick(e);
            }}
            onPointerMove={(e) => e.buttons && onStick(e)}
            onPointerUp={() => (ctl.current.stick = { x: 0, y: 0 })}
          />
          <div
            ref={lookRef}
            className="cyw-lookpad"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              ctl.current.touchLook = { x: e.clientX, y: e.clientY };
              ctl.current.look = { dx: 0, dy: 0 };
            }}
            onPointerMove={(e) => {
              const t = ctl.current.touchLook;
              if (!t) return;
              ctl.current.look.dx += e.clientX - t.x;
              ctl.current.look.dy += e.clientY - t.y;
              t.x = e.clientX;
              t.y = e.clientY;
            }}
            onPointerUp={() => (ctl.current.touchLook = null)}
          />
          <div className="cyw-buttons">
            <button type="button" onPointerDown={() => (ctl.current.touchFire = true)} onPointerUp={() => (ctl.current.touchFire = false)}>
              Fire
            </button>
            <button type="button" onClick={() => (ctl.current.touchShift = true)}>
              Transform
            </button>
            <button type="button" onClick={() => (ctl.current.touchJump = true)}>
              Jump
            </button>
            <button type="button" onClick={() => (ctl.current.touchUse = true)}>
              Use
            </button>
            <button type="button" onPointerDown={() => (ctl.current.touchRun = true)} onPointerUp={() => (ctl.current.touchRun = false)}>
              Boost
            </button>
            <button type="button" onClick={stopPlaying}>
              Stop
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// M: every mission, where it's played and whether it's done
function Missions({ sim, onClose }) {
  const all = Object.values(AREAS).flatMap((a) => a.missions.map((m) => ({ ...m, place: AREAS[m.area ?? a.id].name })));
  return (
    <div className="cyw-list" role="dialog" aria-label="Missions">
      <p className="cyw-list-title">Missions</p>
      <ul>
        {all.map((m) => (
          <li key={m.id} data-state={sim.missions.done.includes(m.id) ? 'done' : sim.missions.active === m.id ? 'active' : 'open'}>
            <span>{m.title}</span>
            <span className="cyw-list-place">{m.place}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
        Close (M)
      </button>
    </div>
  );
}
