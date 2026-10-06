import { useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { settle } from '../../../lib/settle';
import { readPad, typing } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { FIGHT, PORTAL, newFight, startInvasion, stepFight } from './fight';
import { FLY, newHero, stepHero } from './flight';
import { BODIES, SPACE, altitudeOf, intoSpace, outOfSpace, stepSpace } from './orbit';
import { CARDS, RINGS, keepQuests, newQuests, stepQuests } from './quests';
import { CITY, COAST, BEACH, HILLS, PLACES, RIVER, SPAWN, SUBURB, WATER_Y, WORLD, groundAt, waterAt } from './map';
import './world.css';

// The Graysons' city, the world: fly about it as Invincible. The rules are
// in ./flight.js and ./map.js, the drawing in ./scene.js; this is the
// input (keys, mouse, touch, a pad), the clock, and the HUD over it: speed
// and Mach, height, a compass with the places on it, a map. Without 3D,
// the places as cards.

const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
const AT = 'tp-inv-world-at';
const TIME = 'tp-inv-world-time';
const QUESTS = 'tp-inv-world-quests';
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const WHAT = { fall: 'Someone’s slipping off a roof', heli: 'A news helicopter’s lost its tail rotor' };
const TIMES = ['noon', 'dusk', 'night'];
const TIME_NAME = { noon: 'Noon', dusk: 'Dusk', night: 'Night' };
const MACH = 343;
// the keys, by where they are on the keyboard
const CODES = { KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', KeyZ: 'down', ShiftLeft: 'boost', ShiftRight: 'boost', ArrowLeft: 'lookL', ArrowRight: 'lookR', ArrowUp: 'lookU', ArrowDown: 'lookD' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Where he is to the other players online (middleearth/towns/travellers),
// and where they are, back again. The room carries x and z to ±3200 m (the
// city's edge), how fast to 45 m/s (flat out, past that) and how high to
// 80 m; he flies to 9 km, and on out to the Moon and Mars. So in the city
// it's x and z, and his height over the land or the water as a log (to a
// couple of centimetres on the ground, metres up where the air runs out);
// in space, round whichever of the Earth, the Moon and Mars he's nearest
// (an area each: each is its own ground), the way to him from its middle as
// two angles (×1000: π fits in 3200; to a few centimetres on the Moon) and
// his height over it, as a log again. ./scene.js draws them where this puts them.
const ROOM = { bound: WORLD.half, motion: true };
const ROUND = [{ id: 'earth', c: [0, 0, 0], r: SPACE.RE }, ...BODIES];
const DEEP = SPACE.bound * 2; // (as far over any of them as he gets)
const upY = (y, top) => (80 * Math.log1p(Math.max(0, y) / 20)) / Math.log1p(top / 20);
const downY = (v, top) => 20 * Math.expm1((v * Math.log1p(top / 20)) / 80);
const over = (p, b) => Math.hypot(p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]) - b.r;
function seenAs(h, speed) {
  const face = wrap(h.face);
  if (h.zone !== 'space') return [{ x: h.p[0], z: h.p[2], face, speed, y: upY(h.p[1] - Math.max(groundAt(h.p[0], h.p[2]), WATER_Y), WORLD.ceiling) }, 'city'];
  const b = ROUND.reduce((a, q) => (over(h.p, q) < over(h.p, a) ? q : a));
  const d = h.p.map((v, i) => v - b.c[i]);
  const r = Math.hypot(...d) || 1;
  return [{ x: Math.atan2(d[0], d[2]) * 1000, z: Math.asin(clamp(d[1] / r, -1, 1)) * 1000, face, speed, y: upY(r - b.r, DEEP) }, `space-${b.id}`];
}
function placeOf(p) {
  const b = ROUND.find((q) => p.area === `space-${q.id}`);
  if (!b) return { ...p, y: downY(p.y ?? 0, WORLD.ceiling) };
  // (in space: where they are, which way's up there, and how high over it they are)
  const lon = p.x / 1000;
  const lat = p.z / 1000;
  const up = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  const high = downY(p.y ?? 0, DEEP);
  return { ...p, x: b.c[0] + up[0] * (b.r + high), y: b.c[1] + up[1] * (b.r + high), z: b.c[2] + up[2] * (b.r + high), up, over: high };
}

export default function InvWorld() {
  const three = use3D();
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section id="inv-world" className="iw-world" aria-labelledby="iw-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World gl={gl} setGl={setGl} /> : <Cards three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ gl, setGl }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  // other players online here, as holograms (middleearth/towns/useTravellers)
  const trav = useTravellers('invincible', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.2 });
  const canvas = useRef(null);
  const mapRef = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  const wind = useRef(null);
  const [time, setTimeName] = useState(() => (TIMES.includes(local.get(TIME, 'noon')) ? local.get(TIME, 'noon') : 'noon'));
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState(null);
  const [near, setNear] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [zone, setZoneUi] = useState('city');
  const [flash, setFlash] = useState(null);
  const [card, setCard] = useState(() => !prefersReducedMotion());
  const { unlock } = useAchievements();
  const [found, setFound] = useState(() => newQuests(local.get(QUESTS, {})).cards.length);
  const bubbleRef = useRef(null);
  const hud = useRef({});
  if (!sim.current) {
    const kept = local.get(AT, null);
    const ok = kept && [kept.x, kept.y, kept.z].every(Number.isFinite) && Math.abs(kept.x) < WORLD.half && Math.abs(kept.z) < WORLD.half && !waterAt(kept.x, kept.z);
    const at = ok ? kept : SPAWN;
    // a first time here, he comes down out of the sky onto the lawn
    const drop = !ok && !prefersReducedMotion();
    const h = drop ? { ...newHero(at), p: [at.x, 420, at.z], mode: 'air', v: [0, -60, 0], spd: 60, dir: [0, -1, 0] } : newHero(at);
    sim.current = { intro: drop, quests: newQuests(local.get(QUESTS, {})), fight: newFight(), punch: false, punchT: 0, invadeAt: 240, h, keys: new Set(), stick: { x: 0, y: 0 }, touchUp: false, touchDown: false, touchBoost: false, yaw: at.face ?? SPAWN.face, pitch: -0.05, dragAt: -1e9, t: 0, jump: false, events: [], frame: 0, padBefore: null, moved: false, world: null };
  }

  const say = useCallback((text, ms = 2400) => {
    setToast({ text, key: Math.random() });
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(null), ms);
  }, []);

  // the world: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createInvWorld }) => (dead || !canvas.current ? null : createInvWorld(canvas.current, { onLost: () => !dead && setGl('lost'), calm: prefersReducedMotion() })))
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        sim.current.world = a.world;
        fit();
        await a.setTime(time);
        await settle(a.engine.precompile(), 4000);
        if (dead || a.lost) return;
        if (import.meta.env.DEV) window.__INVWORLD__ = { api: a, sim: sim.current };
        setGl('on');
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    const s = sim.current;
    return () => {
      dead = true;
      ro?.disconnect();
      if (s.h.zone !== 'space' && s.h.mode === 'ground' && !waterAt(s.h.p[0], s.h.p[2])) local.set(AT, { x: s.h.p[0], y: s.h.p[1], z: s.h.p[2], face: s.h.face });
      wind.current?.stop();
      wind.current = null;
      api.current?.dispose();
      api.current = null;
    };
    // (made once; the time of day is set below when it changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGl]);

  useEffect(() => {
    local.set(TIME, time);
    api.current?.setTime(time);
  }, [time]);

  const live = gl === 'on' && inView;
  const cycleTime = useCallback(() => setTimeName((t) => TIMES[(TIMES.indexOf(t) + 1) % TIMES.length]), []);
  const startSound = useCallback(() => {
    audioContext();
    if (!wind.current) import('./sounds').then((m) => (wind.current ??= m.windSound()));
  }, []);

  // the Flaxans come through over the river
  const invade = useCallback(
    (why) => {
      const s = sim.current;
      if (s.fight.on) return;
      s.fight = startInvasion(s.fight);
      s.invaded = true;
      sfx('alarm');
      say(why === 'cecil' ? 'Cecil: “Portal over the river. Flaxans again. Go.”' : 'Something’s coming through over the river. Purple. Lots of it.', 4600);
    },
    [say],
  );

  const act = useCallback(() => {
    // next to Dad over downtown: spar with him (Think, Mark!, down the page)
    if (sim.current.talking?.id === 'omni') {
      sfx('drum');
      say('“Think, Mark!” Down the page, over the city.');
      document.getElementById('inv-game')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const p = sim.current.near;
    if (!p) return;
    if (p.id === 'gda' && !sim.current.fight.on) {
      invade('cecil');
      return;
    }
    sfx('ding');
    say(`${p.name}: ${p.line}`, 3200);
  }, [say, invade]);

  // the keys
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = CODES[e.code];
      if (k) {
        e.preventDefault();
        startSound();
        if (k === 'up' && !e.repeat) s.jump = true;
        s.keys.add(k);
        s.moved = true;
        return;
      }
      if ((e.code === 'KeyJ' || e.code === 'KeyF') && !e.repeat) {
        startSound();
        s.punch = true;
      } else if (e.code === 'KeyE' || e.key === 'Enter') {
        if (!(e.target instanceof HTMLButtonElement)) act();
      } else if (e.code === 'KeyT') cycleTime();
      else if (e.code === 'KeyH' || e.key === '?') setHelp((v) => !v);
      else if (e.key === 'Escape') setHelp(false);
    };
    const up = (e) => {
      const k = CODES[e.code];
      if (k) s.keys.delete(k);
      if (!e.shiftKey) s.keys.delete('boost');
    };
    const blur = () => s.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      s.keys.clear();
    };
  }, [live, act, cycleTime, startSound]);

  // looking round: drag on the canvas
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.clientX < (canvas.current?.getBoundingClientRect().left ?? 0) + (canvas.current?.clientWidth ?? 0) * 0.4) return; // the left of a phone's screen is the stick
    startSound();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const s = sim.current;
    const k = e.pointerType === 'touch' ? 0.007 : 0.0045;
    s.yaw -= (e.clientX - d.x) * k;
    s.pitch = clamp(s.pitch - (e.clientY - d.y) * k, -1.35, 1.25);
    s.dragAt = s.t;
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    // a click (not a drag) with the mouse: a punch
    if (e.pointerType === 'mouse' && e.button === 0 && performance.now() - d.at < 260 && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) sim.current.punch = true;
    drag.current = null;
  };

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    const s = sim.current;
    if (!a || a.lost || !s.world) return;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};

    // the camera: arrows, a pad's right stick
    const lookX = (k.has('lookR') ? 1 : 0) - (k.has('lookL') ? 1 : 0) + (pad?.rx ?? 0);
    const lookY = (k.has('lookU') ? 1 : 0) - (k.has('lookD') ? 1 : 0) - (pad?.ry ?? 0);
    if (lookX || lookY) {
      s.yaw -= lookX * 2.2 * dt;
      s.pitch = clamp(s.pitch + lookY * 1.6 * dt, -1.35, 1.25);
      s.dragAt = s.t;
    }
    let fwd = (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0) - s.stick.y - (pad?.ly ?? 0);
    let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x + (pad?.lx ?? 0);
    fwd = clamp(fwd, -1, 1);
    side = clamp(side, -1, 1);
    const upKey = k.has('up') || s.touchUp || Boolean(pad?.a || pad?.rb);
    const downKey = k.has('down') || s.touchDown || Boolean(pad?.b || pad?.lb);
    const boost = k.has('boost') || s.touchBoost || Boolean(pad?.rt || (pad?.rtv ?? 0) > 0.4);
    if (pressed('a')) s.jump = true;
    if (pressed('x')) s.punch = true;
    if (pressed('y')) act();
    if (pressed('start')) cycleTime();
    const look = [Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)];
    let input = { fwd, side, up: upKey ? 1 : 0, down: downKey ? 1 : 0, boost, run: boost, jump: s.jump, look };
    if (s.intro) {
      // the drop: straight down, flat out, the camera above him, until the ground stops him
      input = { fwd: 0, side: 0, up: 0, down: 1, boost: true, run: false, jump: false, look };
      s.pitch = -0.32;
      s.dragAt = s.t;
      if (s.h.mode === 'ground') s.intro = false;
    }
    s.h = s.h.zone === 'space' ? stepSpace(s.h, input, dt) : stepHero(s.h, input, dt, s.world);
    s.jump = false;
    // up through the top of the sky, or back down into it: the other world takes over
    if (s.h.ev.some((e) => e.type === 'exit')) {
      for (const e of s.h.ev) s.events.push(e);
      s.h = intoSpace(s.h);
      a.setZone('space');
      setZoneUi('space');
      setFlash({ kind: 'out', key: s.t });
      sfx('hyperspace');
      unlock('karman');
      say('Out of the air. That’s the whole world under your feet. (The Moon’s that way. So’s Mars, a long way further.)', 5200);
    } else if (s.h.ev.some((e) => e.type === 'reenter')) {
      s.h = outOfSpace(s.h);
      a.setZone('city');
      setZoneUi('city');
      setFlash({ kind: 'in', key: s.t });
      sfx('thunder');
      say('Re-entry. Hold on: home’s right under you.');
    }
    const h = s.h;
    const inSpace = h.zone === 'space';
    const speed = Math.hypot(h.v[0], h.v[1], h.v[2]);
    // the camera swings round behind him when he's going somewhere fast (and you're not looking about)
    if (h.mode === 'air' && speed > 18 && s.t - s.dragAt > 1.2) {
      const vy = Math.atan2(h.v[0], h.v[2]);
      const vp = Math.atan2(h.v[1], Math.hypot(h.v[0], h.v[2]));
      const r = 1.2 + Math.min(1, speed / 120) * 2;
      s.yaw += wrap(vy - s.yaw) * (1 - Math.exp(-r * dt));
      s.pitch += (clamp(vp * 0.85 - 0.08, -1.2, 1.1) - s.pitch) * (1 - Math.exp(-r * 0.8 * dt));
    }
    // the things to do: the rings, the cards, the rescues (in the city)
    if (!inSpace) s.quests = stepQuests(s.quests, h, dt, s.world);
    else s.quests = { ...s.quests, ev: [] };
    for (const e of s.quests.ev) {
      if (e.type === 'lesson-start') {
        sfx('ding');
        say('Dad’s rings: in order, to the Guardians’ hall. Go.');
      } else if (e.type === 'ring') sfx('coin');
      else if (e.type === 'lesson-done') {
        sfx('fanfare');
        unlock('dadsrings');
        say(`${e.best ? 'A best: ' : 'Round in '}${clock(e.time)}. “Not bad. For a start.”`, 4200);
      } else if (e.type === 'lesson-lost') say('Dad’s given up waiting. Back to the first ring, over the street outside the house.');
      else if (e.type === 'card') {
        sfx('oneUp');
        setFound(s.quests.cards.length);
        say(`Title card: episode ${e.ep}, “${e.title}”. ${s.quests.cards.length} of ${CARDS.length}.`, 3400);
        if (e.all) unlock('titlecards');
      } else if (e.type === 'emergency') {
        sfx('alarm');
        say(`${WHAT[e.kind]}! Follow the red beacon.`, 4200);
      } else if (e.type === 'slip') sfx('warn');
      else if (e.type === 'caught') {
        sfx('ding');
        say(e.kind === 'heli' ? 'Got it. Now set it down somewhere.' : 'Got them. Now put them down gently.');
      } else if (e.type === 'saved') {
        sfx('victory');
        unlock('rescue');
        say(`Safe. That’s ${e.count} ${e.count === 1 ? 'rescue' : 'rescues'}.`);
      } else if (e.type === 'missed') {
        sfx('crumble');
        say(e.kind === 'heli' ? 'Too late: the crew jumped clear, and the street has a new hole in it.' : 'Too late, but the GDA had a net out. Barely.', 4200);
      }
      if (['card', 'saved', 'lesson-done'].includes(e.type)) local.set(QUESTS, keepQuests(s.quests));
    }
    // the Flaxans: four minutes in if nobody's started them sooner
    s.punchT = Math.max(0, s.punchT - dt);
    if (!inSpace) {
      if (!s.invaded && s.t > s.invadeAt) invade('auto');
      const r = stepFight(s.fight, h, { punch: s.punch, look }, dt);
      s.fight = r.fight;
      if (r.push) {
        const l = Math.hypot(...r.push) || 1;
        s.h = { ...s.h, mode: 'air', crouch: 0, v: r.push, spd: l, dir: r.push.map((c) => c / l) };
      }
      if (r.stun) s.h = { ...s.h, stun: Math.max(s.h.stun ?? 0, r.stun) };
      for (const e of r.ev) {
        s.events.push(e);
        if (e.type === 'punch') {
          s.punchT = 0.25;
          sfx('zip');
        } else if (e.type === 'ko') sfx('blast');
        else if (e.type === 'bolt') sfx('laser');
        else if (e.type === 'hurt') sfx('hit');
        else if (e.type === 'spawn') sfx('pop');
        else if (e.type === 'beaten') {
          sfx('boom');
          say('That one hurt. Get back up.');
        } else if (e.type === 'won') {
          sfx('fanfare');
          unlock('flaxans');
          say('The portal’s closed. Every last Flaxan, back where they came from.', 4200);
        }
      }
    }
    s.punch = false;
    for (const e of h.ev) {
      s.events.push(e);
      if (e.type === 'boom') {
        sfx('boom');
        unlock('soundbarrier');
        if (!s.boomSaid) {
          s.boomSaid = true;
          say('The sound barrier. Keep going.');
        }
      } else if (e.type === 'slam') {
        sfx(e.speed > 80 ? 'crumble' : 'thunk');
        if (e.speed > 80) sfx('boom');
      } else if (e.type === 'impact') sfx('crumble');
      else if (e.type === 'takeoff') sfx('zip');
      else if (e.type === 'splash') sfx('knock');
      else if (e.type === 'land') {
        // on the Moon, or Mars
        sfx(e.speed > 300 ? 'crumble' : 'thunk');
        unlock(e.body === 'moon' ? 'moonwalk' : 'redplanet');
        say(e.body === 'moon' ? 'The Moon. Neil Armstrong, eat your heart out. (Space or W to go.)' : 'Mars. A long way from home. (Space to go.)', 4200);
      }
    }
    // other players: where you are to them, and where they are (in the city,
    // or out round the same one of the Earth, the Moon and Mars)
    const tv = trav.ref.current;
    if (tv) {
      const [me, area] = seenAs(h, speed);
      tv.pose(me, { area });
    }
    s.travellers = tv ? tv.list().map(placeOf) : null;
    a.frame(s, dt);
    s.frame++;

    // what's near: a place's door, on the ground or just over it
    const alt = inSpace ? altitudeOf(h) : h.p[1] - groundAt(h.p[0], h.p[2]);
    let nearP = null;
    if (alt < 12 && !inSpace) for (const p of s.world.places) if (Math.hypot(h.p[0] - p.door[0], h.p[2] - p.door[1]) < p.r + 6) nearP = p;
    if (nearP !== s.near) {
      s.near = nearP;
      setNear(nearP ? { id: nearP.id, name: nearP.name } : null);
    }
    // the HUD, straight into the DOM (no re-render a frame)
    const H = hud.current;
    if (s.frame % 2 === 0) {
      if (H.speed) H.speed.textContent = String(Math.round(speed * 3.6));
      const far = (b) => Math.round((Math.hypot(h.p[0] - b.c[0], h.p[1] - b.c[1], h.p[2] - b.c[2]) - b.r) / 1000);
      if (H.mach) H.mach.textContent = inSpace ? (h.mode === 'perch' ? `On ${h.perch.body === 'moon' ? 'the Moon' : 'Mars'}` : BODIES.map((b) => `${b.id === 'moon' ? 'Moon' : 'Mars'} ${far(b)} km`).join(' · ')) : speed > 60 ? `Mach ${(speed / MACH).toFixed(2)}` : h.mode === 'ground' ? (speed > 5 ? 'Running' : speed > 0.5 ? 'Walking' : 'Standing') : speed < 1 ? 'Hovering' : 'Flying';
      if (H.alt) H.alt.textContent = alt > 20000 ? `${Math.round(alt / 1000)} km` : `${Math.max(0, Math.round(alt))} m`;
      if (H.bar) H.bar.style.transform = `scaleX(${Math.min(1, inSpace ? Math.log10(1 + speed) / Math.log10(6001) : speed / FLY.top)})`;
      if (H.lines) H.lines.style.opacity = String(clamp((speed - 70) / 160, 0, 0.85));
      const marks = [];
      const q = s.quests;
      if (s.fight.on) marks.push({ x: PORTAL.p[0], z: PORTAL.p[2], color: '#d04dff', name: 'Portal' });
      if (q.rescue && !q.rescue.carried) marks.push({ x: q.rescue.p[0], z: q.rescue.p[2], color: '#ff3b30', name: 'Help' });
      if (q.lesson.on) marks.push({ x: RINGS[q.lesson.next].p[0], z: RINGS[q.lesson.next].p[2], color: '#ffd23a', name: `Ring ${q.lesson.next + 1}` });
      s.marks = marks;
      if (H.compass) drawCompass(H.compass, s.yaw, h, s.world.places, marks);
      if (H.goal) {
        const d = q.rescue ? Math.round(Math.hypot(q.rescue.p[0] - h.p[0], q.rescue.p[1] - h.p[1], q.rescue.p[2] - h.p[2])) : 0;
        const left = s.fight.on ? FIGHT.count - s.fight.foes.filter((e) => e.state === 'ko' || e.state === 'down').length : 0;
        const fightText = s.fight.on ? `Flaxans over the river · ${left} left · you ${Math.max(0, Math.round(s.fight.hp))}%` : '';
        const text = fightText || (q.rescue ? (q.rescue.carried ? 'Set them down: land anywhere' : `${WHAT[q.rescue.kind]} · ${d} m`) : q.lesson.on ? `Dad’s rings · ${q.lesson.next + 1} of ${RINGS.length} · ${clock(q.lesson.t)}` : '');
        if (H.goal.textContent !== text) H.goal.textContent = text;
        H.goal.dataset.on = text ? '1' : '';
        H.goal.dataset.red = q.rescue && !s.fight.on ? '1' : '';
        H.goal.dataset.purple = s.fight.on ? '1' : '';
      }
    }
    if (s.frame % 4 === 0 && mapRef.current) drawMap(mapRef.current, h, s.yaw, alt, s.world, s.marks);
    // who's talking to him: a bubble over the nearest, a new line every few seconds
    if (s.frame % 3 === 0) {
      const t = a.talkers(h)[0] ?? null;
      const said = s.said ?? (s.said = {});
      if (t?.id !== s.talking?.id) {
        s.talking = t;
        if (t) {
          said[t.id] = ((said[t.id] ?? -1) + 1) % t.lines.length;
          s.talkAt = s.t;
          setBubble({ name: t.name, text: t.lines[said[t.id]] });
        } else setBubble(null);
      } else if (t && s.t - s.talkAt > 5) {
        said[t.id] = (said[t.id] + 1) % t.lines.length;
        s.talkAt = s.t;
        setBubble({ name: t.name, text: t.lines[said[t.id]] });
      }
      s.talking = t ?? null;
    }
    if (s.talking && bubbleRef.current) {
      const q = a.project(s.talking.head);
      bubbleRef.current.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px)`;
      bubbleRef.current.style.opacity = q.front ? '1' : '0';
    }
    // flying alongside the airliner: what your father would say
    if (!s.mimicSaid && s.frame % 10 === 0 && a.jetDistance(h) < 90) {
      s.mimicSaid = true;
      sfx('flyby');
      unlock('mimic');
      say('Dad, in your ear: “Look what they need to mimic a fraction of our power.”', 4200);
    }
    wind.current?.set({ speed, alt });
  }, live);

  // the stick, on a phone
  const stickRef = useRef(null);
  const stickDrag = useRef(null);
  const stickDown = (e) => {
    startSound();
    stickDrag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const stickMove = (e) => {
    const d = stickDrag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = clamp((e.clientX - d.x) / 44, -1, 1);
    const dy = clamp((e.clientY - d.y) / 44, -1, 1);
    sim.current.stick = { x: dx, y: dy };
    if (stickRef.current) stickRef.current.style.transform = `translate(${dx * 26}px, ${dy * 26}px)`;
  };
  const stickUp = () => {
    stickDrag.current = null;
    sim.current.stick = { x: 0, y: 0 };
    if (stickRef.current) stickRef.current.style.transform = '';
  };
  const hold = (key) => ({
    onPointerDown: (e) => {
      startSound();
      if (key === 'touchUp') sim.current.jump = true;
      sim.current[key] = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: () => (sim.current[key] = false),
    onPointerCancel: () => (sim.current[key] = false),
  });

  return (
    <div className="iw-stage" ref={box} data-zone={zone}>
      <canvas ref={canvas} className="iw-canvas" data-on={gl === 'on' || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={(e) => e.preventDefault()} aria-label="The city, from the air. Fly with W, A, S and D; Space to go up, C to go down, Shift to go flat out." />
      <div className="iw-lines" ref={(el) => (hud.current.lines = el)} aria-hidden="true" />
      {flash && <div className="iw-flash" data-kind={flash.kind} key={flash.key} aria-hidden="true" onAnimationEnd={() => setFlash(null)} />}
      {card && gl === 'on' && (
        <div className="iw-card" aria-hidden="true" onAnimationEnd={() => setCard(false)}>
          <span>INVINCIBLE</span>
        </div>
      )}
      {bubble && (
        <div className="iw-bubble" ref={bubbleRef} aria-live="polite">
          <div>
            <b>{bubble.name}</b>
            {bubble.text}
          </div>
        </div>
      )}
      {gl === 'loading' && <p className="iw-loading">Over the city…</p>}

      <div className="iw-hud iw-hud-top">
        <div className="iw-brand">
          <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
          <h2 id="iw-title" className="iw-title">
            Fly, Mark.
          </h2>
          <p className="iw-goal" ref={(el) => (hud.current.goal = el)} aria-live="polite" />
        </div>
        <div className="iw-tools">
          <button type="button" className="iw-btn" onClick={cycleTime} aria-label={`Time of day: ${TIME_NAME[time]}. Change it.`}>
            {TIME_NAME[time]}
          </button>
          <button type="button" className="iw-btn" onClick={() => setHelp((v) => !v)} aria-expanded={help}>
            Controls
          </button>
          <Players trav={trav} />
          <a className="iw-btn" href="#inv-game">
            Think, Mark!
          </a>
        </div>
      </div>
      <canvas className="iw-compass" ref={(el) => (hud.current.compass = el)} width="560" height="44" aria-hidden="true" />

      {help && (
        <div className="iw-help" role="dialog" aria-label="Controls">
          <dl>
            <dt>W A S D</dt>
            <dd>Fly the way you’re looking (walk, on the ground)</dd>
            <dt>Space · C</dt>
            <dd>Up (take off) · down (land)</dd>
            <dt>Shift</dt>
            <dd>Flat out. Past Mach 0.35 the air breaks</dd>
            <dt>Drag · arrows</dt>
            <dd>Look round</dd>
            <dt>J · F · click</dt>
            <dd>Punch (a little way off, he lunges)</dd>
            <dt>E</dt>
            <dd>At a place: go in (Cecil, at the GDA, has a job)</dd>
            <dt>T</dt>
            <dd>Noon, dusk, night</dd>
            <dt>Up, up</dt>
            <dd>Past 9 km you’re out of the air: the Moon and Mars are out there</dd>
          </dl>
          <p>A pad works: left stick flies, right stick looks, A up, B down, RT flat out, X punches, Y goes in.</p>
          <p>
            Things to do: Dad’s rings start over the street outside the house; {found} of {CARDS.length} title cards found; rescues come in on their own.
          </p>
        </div>
      )}

      <div className="iw-hud iw-hud-bottom">
        <div className="iw-gauge" aria-hidden="true">
          <p className="iw-speed">
            <span ref={(el) => (hud.current.speed = el)}>0</span>
            <small>km/h</small>
          </p>
          <div className="iw-bar">
            <i ref={(el) => (hud.current.bar = el)} />
          </div>
          <p className="iw-mach" ref={(el) => (hud.current.mach = el)}>
            Standing
          </p>
          <p className="iw-alt">
            <span>Height</span> <b ref={(el) => (hud.current.alt = el)}>0 m</b>
          </p>
        </div>
        <div className="iw-mid">
          {near && (
            <button type="button" className="iw-prompt" onClick={act}>
              <kbd>E</kbd> {near.name}
            </button>
          )}
          {toast && (
            <p className="iw-toast" key={toast.key} role="status">
              {toast.text}
            </p>
          )}
        </div>
      </div>
      <canvas className="iw-map" ref={mapRef} width="180" height="180" aria-hidden="true" />

      {touch && (
        <div className="iw-touch">
          <div className="iw-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
            <span ref={stickRef} />
          </div>
          <div className="iw-buttons">
            <button type="button" {...hold('touchUp')}>
              Up
            </button>
            <button type="button" {...hold('touchDown')}>
              Down
            </button>
            <button type="button" className="iw-boost" {...hold('touchBoost')}>
              Boost
            </button>
            <button type="button" className="iw-punch" onPointerDown={() => (startSound(), (sim.current.punch = true))}>
              Punch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Other players online here: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as the universe's map has it).
function Players({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="iw-btn" onClick={trav.join} title="Go online, and see everyone else flying the city as a pale Mark with their name over him">
        See other players
      </button>
    );
  return (
    <span className="iw-btn iw-players" data-on title="Everyone else online here shows as a pale Mark: nothing passes between you but where each of you is">
      <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
    </span>
  );
}

// ── the compass: a strip of headings, the places marked on it ──
const DIRS = [
  [0, 'S'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'N'],
  [-Math.PI / 2, 'W'],
];
function drawCompass(c, yaw, h, places, marks = []) {
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  x.clearRect(0, 0, W, H);
  const span = Math.PI * 0.9; // what the strip shows
  const at = (a) => W / 2 + (wrap(yaw - a) / span) * W; // (yaw grows to the left)
  x.font = '700 20px system-ui, sans-serif';
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [a, n] of DIRS) {
    const px = at(a);
    if (px > 10 && px < W - 10) x.fillText(n, px, 19);
  }
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 24; k++) {
    const px = at((k / 24) * Math.PI * 2);
    if (px > 0 && px < W) x.fillRect(px - 0.5, 24, 1, k % 6 === 0 ? 8 : 5);
  }
  for (const p of places) {
    const a = Math.atan2(p.x - h.p[0], p.z - h.p[2]);
    const px = at(a);
    if (px < 8 || px > W - 8) continue;
    const d = Math.hypot(p.x - h.p[0], p.z - h.p[2]);
    x.fillStyle = '#ffd23a';
    x.beginPath();
    x.arc(px, 36, 4, 0, Math.PI * 2);
    x.fill();
    if (d < 1800) {
      x.font = '600 14px system-ui, sans-serif';
      x.fillText(p.name.replace(/^The /, ''), px, 12);
    }
  }
  for (const m of marks) {
    const px = at(Math.atan2(m.x - h.p[0], m.z - h.p[2]));
    const cx = Math.max(10, Math.min(W - 10, px));
    x.fillStyle = m.color;
    x.beginPath();
    x.moveTo(cx, 26);
    x.lineTo(cx + 7, 40);
    x.lineTo(cx - 7, 40);
    x.closePath();
    x.fill();
  }
  x.fillStyle = '#ffd23a';
  x.fillRect(W / 2 - 1, 22, 2, 18);
}

// ── the map: north up, round him, further out the higher he is ──
let base = null;
function mapBase() {
  if (base) return base;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const k = S / (WORLD.half * 2);
  const P = (v) => (v + WORLD.half) * k;
  x.fillStyle = '#3b4a2e';
  x.fillRect(0, 0, S, S);
  // the hills
  x.fillStyle = '#4a5236';
  x.fillRect(0, 0, S, P(HILLS));
  // the city's blocks, the suburbs, the water
  x.fillStyle = '#5b5d61';
  x.fillRect(P(CITY.x0), P(CITY.z0), (CITY.x1 - CITY.x0) * k, (CITY.z1 - CITY.z0) * k);
  x.fillStyle = '#4f6b3a';
  x.fillRect(P(SUBURB.x0), P(HILLS + 80), (SUBURB.x1 - SUBURB.x0) * k, (COAST - BEACH - HILLS - 120) * k);
  x.fillStyle = '#c9b98d';
  x.fillRect(0, P(COAST - BEACH), S, BEACH * k);
  x.fillStyle = '#21506a';
  x.fillRect(0, P(COAST - 20), S, S);
  x.fillRect(P(RIVER.x0), 0, (RIVER.x1 - RIVER.x0) * k, P(COAST));
  base = { c, k, P };
  return base;
}
function drawMap(c, h, yaw, alt, world, marks = []) {
  const x = c.getContext('2d');
  const W = c.width;
  const b = mapBase();
  if (!b.towers) {
    // the towers and houses, once
    const bx = b.c.getContext('2d');
    bx.fillStyle = '#8b8d92';
    for (const t of world.buildings) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    bx.fillStyle = '#a99a84';
    for (const t of world.houses) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    b.towers = true;
  }
  const span = clamp(500 + alt * 1.6, 500, WORLD.half * 2); // metres across
  const px = span * b.k;
  x.save();
  x.clearRect(0, 0, W, W);
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.clip();
  x.drawImage(b.c, b.P(h.p[0]) - px / 2, b.P(h.p[2]) - px / 2, px, px, 0, 0, W, W);
  // the places
  for (const p of world.places) {
    const mx = W / 2 + ((p.x - h.p[0]) / span) * W;
    const my = W / 2 + ((p.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = '#ffd23a';
    x.strokeStyle = '#0e1a33';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 5, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  for (const m of marks) {
    const mx = W / 2 + ((m.x - h.p[0]) / span) * W;
    const my = W / 2 + ((m.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = m.color;
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 6, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  // him, pointing where he's looking
  x.translate(W / 2, W / 2);
  x.rotate(-yaw + Math.PI);
  x.fillStyle = '#5fc8ff';
  x.strokeStyle = '#08121f';
  x.beginPath();
  x.moveTo(0, -9);
  x.lineTo(6, 7);
  x.lineTo(0, 3);
  x.lineTo(-6, 7);
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
  x.strokeStyle = 'rgba(255,210,58,0.6)';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.stroke();
}

// ── without 3D: the places, as cards ──
function Cards({ three, gl, retry }) {
  return (
    <div className="iw-cards shell">
      <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
      <h2 id="iw-title" className="iw-title">
        Fly, Mark.
      </h2>
      <p className="iw-cards-lead">{gl === 'lost' ? 'The graphics chip let go of the city.' : three.can ? 'The city is 3D, and 3D is off.' : 'The city is 3D, and this browser has no 3D.'} Here’s what’s down there.</p>
      <ul className="iw-cards-list">
        {PLACES.map((p) => (
          <li key={p.id}>
            <b>{p.name}</b>
            <span>{p.line}</span>
          </li>
        ))}
      </ul>
      {(gl === 'lost' || (three.can && !three.on)) && (
        <button type="button" className="btn btn-primary mt-6" onClick={gl === 'lost' ? retry : () => three.set('on')}>
          {gl === 'lost' ? 'Try again' : 'Turn 3D on'}
        </button>
      )}
    </div>
  );
}

