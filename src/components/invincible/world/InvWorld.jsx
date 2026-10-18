import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useInView, useMediaQuery } from '../../../lib/hooks';
import { useVoiced } from '../../../lib/useVoiced';
import { sayVoiced } from '../../../lib/voiced';
import { readPad, typing } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { PORTAL, newFoes, portalOpen, spawnFoes, spawnUpTo, standing, startInvasion, stepFoes } from './foes';
import { FLY, jumpPress, newHero, onWater, stepHero } from './flight';
import { createHits } from './hits';
import { impactGroups } from '../../../lib/impact';
import { pressGroups } from '../../../lib/press';
import { getawayAt, newGetaway, stepGetaway, stopGetaway } from './getaway';
import { CALLS, RINGS_DONE } from './lines';
import { RADIO, RADIO_CALLS, feedMission, keepStory, loadStory, markerOf, missionOf, newRadio, nextRadioCall, nextStory, placeOf as missionPlace, startMission as beginMission, stepOf } from './missions';
import { BODIES, SPACE, intoSpace, outOfSpace, stepSpace } from './orbit';
import { CARDS, RINGS, keepQuests, newQuests, stepQuests } from './quests';
import { CITY, COAST, BEACH, HILLS, PLACES, RIVER, SPAWN, SUBURB, WATER_Y, WORLD, groundAt, isSafeStart } from './map';
import { VOICE } from './voicelines';
import InvHud from './InvHud';
import MissionCard from './MissionCard';
import { toggleGuide } from '../../../lib/palette';
import { COMPASS, fitCanvas, layoutCompass, objectiveText, titleMode } from '../../../runtime/hud';
import './world.css';
import LoadingVeil from '../../worlds/LoadingVeil';
import { useStage, useStageFrame } from '../../avengers/shared/runtime';
import city from './module';

// The Graysons' city, the world: fly about it as Invincible. The rules are
// in ./flight.js and ./map.js, the drawing in ./scene.js; this is the
// input (keys, mouse, touch, a pad), the clock, and the HUD over it: speed
// and Mach, height, a compass with the places on it, a map. Without 3D,
// the places as cards.

const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
// a hit's sound at the hit law's gain and pitch (./hits.js); none within its gap
const hits = createHits();
const sfxHit = (name, key, force) => {
  const voice = hits.voice(key, force);
  if (voice) import('../../../lib/sfx').then((s) => s.play(name, voice)).catch(() => null);
};
const sound = (name, ...args) => import('./sounds').then((m) => m[name]?.(...args)).catch(() => null);
const AT = 'tp-inv-world-at';
const TIME = 'tp-inv-world-time';
const QUESTS = 'tp-inv-world-quests';
const STORY = 'tp-inv-world-story';
const HANGAR = missionPlace('hangar');
const ROOF = missionPlace('roof').p;
const CARD_MS = 2600; // the episode's title card (2.5 s, and the fade's end)
// the objective line's words for who's about (./foes.js)
function foesText(f, up) {
  const flax = f.foes.filter((e) => (e.kind ?? 'flaxan').startsWith('flaxan') && e.state !== 'ko' && e.state !== 'down').length;
  const maulers = up.filter((e) => e.kind === 'mauler').length;
  const parts = [];
  if (flax || f.foes.some((e) => (e.kind ?? 'flaxan').startsWith('flaxan'))) parts.push(`Flaxans over the river · ${flax} left`);
  if (maulers) parts.push(maulers > 1 ? `The Mauler twins · ${maulers} standing` : 'A Mauler · 1 standing');
  if (up.some((e) => e.kind === 'seismic')) parts.push('Doc Seismic over the school');
  return parts.join(' · ');
}

const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const WHAT = { fall: 'Someone’s slipping off a roof', heli: 'A news helicopter’s lost its tail rotor' };
const TIMES = ['noon', 'dusk', 'night'];
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
const nearest = (p) => ROUND.reduce((a, q) => (over(p, q) < over(p, a) ? q : a));
function seenAs(h, speed) {
  const face = wrap(h.face);
  if (h.zone !== 'space') return [{ x: h.p[0], z: h.p[2], face, speed, y: upY(h.p[1] - Math.max(groundAt(h.p[0], h.p[2]), WATER_Y), WORLD.ceiling) }, 'city'];
  const b = nearest(h.p);
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

// What was kept from last time, read so that nothing kept can break the
// world (an old version's shape, a hand-edited value, a half-written one):
// a time of day that isn't one is noon, and quests that can't be read are
// none found.
function keptTime() {
  const t = local.get(TIME, 'noon');
  return TIMES.includes(t) ? t : 'noon';
}
function keptQuests() {
  try {
    return newQuests(local.get(QUESTS, {}));
  } catch {
    return newQuests();
  }
}
const keptStory = () => loadStory(local.get(STORY, null));

// Where he starts, once there's a world to check it against: where he was
// left standing, if that's still open ground (map.js's isSafeStart: not in
// a tower, under the land, over the water or above the sky); otherwise, as
// a first time, he comes down out of the sky onto the lawn.
function placeHero(s, world) {
  const ok = isSafeStart(world, s.kept);
  const at = ok ? s.kept : SPAWN;
  const face = ok && Number.isFinite(at.face) ? at.face : SPAWN.face;
  const drop = !ok && !prefersReducedMotion();
  const h = newHero({ x: at.x, y: at.y, z: at.z, face });
  s.h = drop ? { ...h, p: [at.x, 420, at.z], mode: 'air', v: [0, -60, 0], spd: 60, dir: [0, -1, 0] } : h;
  s.intro = drop;
  s.yaw = face;
}

// `thinkMark`: a ref the page shares with Think, Mark! (down the page); the
// world puts a function in it, and the game calls it with its result, which
// is the last episode's last step.
export default function InvWorld({ thinkMark = null }) {
  const three = use3D();
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section id="inv-world" className="iw-world" aria-labelledby="iw-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World gl={gl} setGl={setGl} thinkMark={thinkMark} /> : <Cards three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ gl, setGl, thinkMark }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  // other players online here, as holograms (middleearth/towns/useTravellers)
  const trav = useTravellers('invincible', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.2 });
  const mapRef = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  const wind = useRef(null);
  // The time of day: one clock. The HUD's button reads it, the scene is
  // given it (below), and the dev hook sets it, so they can't disagree.
  const [time, setTimeName] = useState(keptTime);
  // the title: FLY, MARK. until he's flying, then a chip (the HUD kit's titleMode, runtime/hud)
  const [chip, setChip] = useState(false);
  const [toast, setToast] = useState(null);
  const [near, setNear] = useState(null);
  const [bubble, setBubble] = useState(null);
  // what they say, in their own voice where it's been made (lib/voiced.js)
  useVoiced(VOICE[bubble?.who], bubble?.text);
  const [zone, setZoneUi] = useState('city');
  const [flash, setFlash] = useState(null);
  const [card, setCard] = useState(() => !prefersReducedMotion());
  const { unlock } = useAchievements();
  const [found, setFound] = useState(() => keptQuests().cards.length);
  // a mission's card over the city (./MissionCard.jsx), and the same for the key handler
  const [mcard, setMcard] = useState(null);
  // the radio's call, on the HUD's line until it's taken or dropped; the shutter, for a photo
  const [radio, setRadio] = useState(null);
  const [shutter, setShutter] = useState(null);
  const cardRef = useRef(null);
  cardRef.current = mcard;
  const cardT = useRef(null);
  const linesT = useRef([]);
  // (the dev hook's way in: the latest of the mission callbacks below)
  const missionApi = useRef({});
  const bubbleRef = useRef(null);
  const hud = useRef({});
  if (!sim.current) {
    // (he's put on the lawn for now: where he really starts waits on the
    // world, which the scene makes, and nothing moves before it's there)
    sim.current = { intro: false, kept: local.get(AT, null), quests: keptQuests(), foes: newFoes(), cars: null, mission: null, story: keptStory(), getaway: null, wave: null, swing: null, marker: null, gates: null, photo: null, hangarHp: 100, radio: newRadio(), call: null, punch: false, punchT: 0, invadeAt: 240, h: newHero(SPAWN), keys: new Set(), stick: { x: 0, y: 0 }, touchUp: false, touchDown: false, touchBoost: false, yaw: SPAWN.face, pitch: -0.05, dragAt: -1e9, t: 0, jump: false, press: jumpPress(), free: false, events: [], companion: [], eveHit: null, frame: 0, padBefore: null, moved: false, world: null };
  }

  // (`who`, for a line someone says: in their own voice where it's been made;
  // `aloud`, what of it they say, if not all of it)
  const say = useCallback((text, ms = 2400, who = null, aloud = text) => {
    setToast({ text, key: Math.random() });
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(null), ms);
    if (who) sayVoiced(VOICE[who], aloud);
  }, []);

  // The scene's time of day follows `time`. Its setTime waits on the sky's
  // pictures, so the calls go one at a time, each giving the scene the
  // latest time asked for: two quick presses can't finish the wrong way
  // round, and one made while the city is still loading isn't lost (the
  // loader asks again once there's a scene). Resolves once the scene has it.
  const timeRef = useRef(time);
  const timeJob = useRef(Promise.resolve());
  const shown = useRef(null); // (which scene has which time: a hot reload makes a new one)
  const syncTime = useCallback(() => {
    timeJob.current = timeJob.current
      .then(async () => {
        const a = api.current;
        const want = timeRef.current;
        if (!a || a.lost || (shown.current?.a === a && shown.current.time === want)) return;
        await a.setTime(want);
        shown.current = { a, time: want };
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
      });
    return timeJob.current;
  }, []);
  useEffect(() => {
    timeRef.current = time;
    local.set(TIME, time);
    syncTime();
  }, [time, syncTime]);

  // the world: made once and kept while the page's game or viewer is the
  // live 3D view (./module.js keeps it), drawn by the runtime when it's the
  // page's live view (avengers/hq/useStage). What the page sets up before
  // its first shader is linked: the feel's numbers for ?debug, where he
  // starts, the time of day, and the QA scripts' handle.
  const setUp = useRef(null);
  setUp.current = async (a) => {
    api.current = a;
    // ?debug: the feel's numbers, the hits' law and the jump's press on the one panel
    a.tune([...impactGroups(hits.rules), ...pressGroups(sim.current.press)]);
    // (once: a scene made again, by a hot reload, takes over where he is)
    if (!sim.current.world) placeHero(sim.current, a.world);
    sim.current.world = a.world;
    fitHud(hud.current, mapRef.current);
    await syncTime();
    if (import.meta.env.DEV) {
      // (the QA scripts' handle: the scene's api, but its setTime is the
      // HUD's, through the one clock, and resolves once the scene has it)
      const hook = Object.create(a);
      hook.setTime = (name) => {
        timeRef.current = TIMES.includes(name) ? name : 'noon';
        setTimeName(timeRef.current);
        return syncTime();
      };
      // (and the villains, for the QA shots: a kind, how many, where)
      hook.spawn = (kind, n = 1, at) => {
        sim.current.foes = spawnFoes(sim.current.foes, kind, n, at);
      };
      // (and the missions: start one, feed one an event, read the season's progress)
      hook.mission = (id) => missionApi.current.start?.(id);
      hook.feed = (ev) => missionApi.current.feed?.(ev);
      hook.story = () => sim.current.story;
      window.__INVWORLD__ = { api: hook, sim: sim.current };
    }
  };
  const options = useMemo(() => ({ calm: prefersReducedMotion() }), []);
  const stage = useStage(city, { enabled: true, id: 'inv-world', forced: true, options, props: { setup: setUp } });
  const prep = stage.progress; // (how far it's got sending itself to the graphics chip)
  // (the box: in view for the keys, and the page's live view by its share of the screen)
  const stageBox = useCallback(
    (el) => {
      box.current = el;
      stage.wrap.current = el;
    },
    [box, stage.wrap],
  );
  // its state for the page: loading until it's first on, and on from then
  // on while it's off the runtime, as the world made once always was; down
  // as it fails
  useEffect(() => {
    if (stage.status === 'on') setGl('on');
    else if (stage.status === 'failed' || stage.status === 'lost') setGl(stage.status);
  }, [stage.status, setGl]);
  useEffect(() => {
    if (stage.status !== 'on') return;
    api.current = stage.view.current;
    syncTime(); // (a time picked while it was kept off the runtime)
  }, [stage.status, stage.view, syncTime]);
  useEffect(() => {
    city.keep(true);
    const H = hud.current;
    // the HUD's own canvases, at the size they're shown and the screen's density
    const fit = () => fitHud(H, mapRef.current);
    // a new size, of the stage or of anything the compass has to keep clear of
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    for (const el of [box.current, H.compass, mapRef.current, H.tools, ...(H.brand?.children ?? [])]) if (el) ro?.observe(el);
    // a new screen density alone (the window moved to another monitor, the
    // page zoomed) isn't a new size the observer sees
    let dpr = null;
    const onDpr = () => {
      dpr?.removeEventListener?.('change', onDpr);
      fit();
      dpr = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
      dpr?.addEventListener?.('change', onDpr);
    };
    onDpr();
    const s = sim.current;
    return () => {
      ro?.disconnect();
      dpr?.removeEventListener?.('change', onDpr);
      // (where he's standing, for next time: only once he's been placed, and
      // only somewhere placeHero will take back, so a place it would turn
      // down never overwrites one it wouldn't)
      const keep = { x: s.h.p[0], y: s.h.p[1], z: s.h.p[2], face: s.h.face };
      if (s.world && s.h.zone !== 'space' && s.h.mode === 'ground' && Number.isFinite(keep.face) && isSafeStart(s.world, keep)) local.set(AT, keep);
      wind.current?.stop();
      wind.current = null;
      api.current = null;
      city.keep(false);
      if (import.meta.env.DEV && window.__INVWORLD__?.sim === s) delete window.__INVWORLD__;
    };
  }, [box]);

  const live = stage.status === 'on' && inView;
  const cycleTime = useCallback(() => setTimeName((t) => TIMES[(TIMES.indexOf(t) + 1) % TIMES.length]), []);
  const startSound = useCallback(() => {
    audioContext();
    if (!wind.current) import('./sounds').then((m) => (wind.current ??= m.windSound()));
  }, []);

  // the Flaxans come through over the river
  const invade = useCallback(
    (why) => {
      const s = sim.current;
      if (s.foes.on) return;
      s.foes = startInvasion(s.foes);
      s.invaded = true;
      sfx('alarm');
      if (why === 'cecil') say(CALLS.portal.text, 4600, CALLS.portal.who);
      else say('Something’s coming through over the river. Purple. Lots of it.', 4600);
    },
    [say],
  );

  // ── the missions (./missions.js): what happened goes in, what they want comes out ──
  const openCard = useCallback((c) => {
    clearTimeout(cardT.current);
    setMcard(c);
    // (the title card goes by itself; the others wait for a key or a button)
    if (c?.kind === 'start') cardT.current = setTimeout(() => setMcard((v) => (v?.kind === 'start' ? null : v)), CARD_MS);
  }, []);
  const closeCard = useCallback(() => openCard(null), [openCard]);
  // a few lines said, one after another
  const speak = useCallback(
    (lines) => {
      for (const t of linesT.current) clearTimeout(t);
      linesT.current = lines.map(([who, text], i) => setTimeout(() => say(text, 3600, who), i * 3800));
    },
    [say],
  );
  // what a mission left about, taken away: the foes it called, its car, its
  // wave, its student on the roof, Dad's rings
  const clear = useCallback(() => {
    const s = sim.current;
    if (s.missionFoes) s.foes = newFoes();
    s.missionFoes = false;
    s.getaway = null;
    s.wave = null;
    s.swing = null;
    s.guard = null;
    if (s.missionFaller && s.quests.rescue) s.quests = { ...s.quests, rescue: null };
    s.missionFaller = false;
    if (s.mission?.id === 'ep1' && s.quests.lesson.on) s.quests = { ...s.quests, lesson: { ...s.quests.lesson, on: false, next: 0, t: 0 } };
    for (const t of linesT.current) clearTimeout(t);
    linesT.current = [];
  }, []);
  // a student shaken to the roof's edge, to be caught (./quests.js's rescue,
  // the mission's own): by Doc Seismic's quake, or, with him down, the roof
  const shakeOff = useCallback(
    (step) => {
      const s = sim.current;
      if (!s.mission || !step?.shake || s.mission.count >= step.n || s.quests.rescue) return;
      s.quests = { ...s.quests, rescue: { kind: 'fall', p: [ROOF[0] - 30 + s.mission.count * 20, ROOF[1], ROOF[2] + 19.6], v: [0, 0, 0], out: [0, 0, 1], t: 0, phase: 'warn', carried: false, spin: 0, source: 'mission' } };
      s.missionFaller = true;
      sfx('warn');
      say('A student, on the roof’s edge. Get under them.', 3200);
    },
    [say],
  );
  // what a step (or its end) asks for
  const setup = useCallback(
    (outs) => {
      const s = sim.current;
      for (const o of outs) {
        if (o.type === 'step') {
          // a step with a car: the getaway pulls out; the step after one: it's stopped where it is
          if (o.car) s.getaway = newGetaway({ from: o.car.from ?? [s.h.p[0], 0, s.h.p[2]], speed: o.car.speed, seed: 3 + o.i, away: s.h.p });
          else if (s.getaway && !s.getaway.stopped) s.getaway = stopGetaway(s.getaway);
          if (o.spawn) {
            for (const [kind, n, at] of o.spawn) s.foes = spawnFoes(s.foes, kind, n, at?.car ? (getawayAt(s.getaway) ?? [s.h.p[0], 0, s.h.p[2]]) : at);
            s.missionFoes = true;
            s.invaded = true; // (the clock's own invasion stays out of it)
            sfx('alarm');
          }
          // (as many in all as the step wants beaten: any that never came, come now)
          if (o.upto) {
            const [kind, n, at] = o.upto;
            s.foes = spawnUpTo(s.foes, kind, n, at);
            s.missionFoes = true;
          }
          s.wave = o.wave ? { ...o.wave, at: o.spawn?.[0]?.[2] ?? PORTAL.p, spawned: o.spawn?.reduce((a, q) => a + q[1], 0) ?? 0, t: 0 } : null;
          s.hangarHp = 100;
          // something to hold: the Maulers go for it while he's not about (./foes.js pickTarget)
          const def = missionOf(s.mission?.id)?.steps[o.i];
          s.guard = def?.type === 'protect' && def.what === 'hangar' ? HANGAR.door : null;
          if (o.i > 0) {
            sfx('ding');
            say(o.text, 2600);
          }
        } else if (o.type === 'shake') shakeOff(missionOf(s.mission?.id)?.steps[s.mission.step]);
        else if (o.type === 'count') sfx('coin');
        else if (o.type === 'hp') sfx('warn');
        else if (o.type === 'done') {
          const id = s.mission.id;
          const m = missionOf(id);
          sfx('fanfare');
          if (o.achievement) unlock(o.achievement);
          const best = s.story.best[id] ?? null;
          s.story = keepStory(s.story, id, o.time);
          local.set(STORY, s.story);
          speak(m.done);
          if (s.getaway) s.getaway = stopGetaway(s.getaway);
          s.wave = null;
          s.guard = null;
          s.missionFoes = false;
          s.mission = null;
          openCard({ kind: 'done', id, time: o.time, best, next: m.side ? null : nextStory(s.story.done) });
        } else if (o.type === 'fail') {
          const id = s.mission.id;
          clear();
          s.mission = null;
          if (o.why === 'abandoned') {
            closeCard();
            say('Called off.');
          } else {
            sfx('crumble');
            openCard({ kind: 'fail', id, why: o.why });
          }
        }
      }
    },
    [say, speak, unlock, clear, openCard, closeCard, shakeOff],
  );
  const feed = useCallback(
    (ev) => {
      const s = sim.current;
      if (!s.mission) return;
      const r = feedMission(s.mission, ev);
      s.mission = r.progress;
      if (r.out.length) setup(r.out);
    },
    [setup],
  );
  const startMission = useCallback(
    (id) => {
      const s = sim.current;
      const m = missionOf(id);
      if (!m) return;
      if (s.mission) {
        clear();
        s.mission = null;
      }
      // (Dad's rings from the first: a lesson already under way starts again with the episode)
      if (id === 'ep1') s.quests = { ...s.quests, lesson: { ...s.quests.lesson, on: false, next: 0, t: 0 } };
      s.mission = beginMission(id, s.t);
      // (the last episode: Dad's points, for ./companions.js to lead him through)
      if (id === 'ep7') s.mission.spar = m.steps.filter((q) => q.type === 'escort').map((q) => q.to);
      s.missionFoes = false;
      sfx('stinger');
      speak(m.intro);
      setup([stepOf(s.mission)].filter(Boolean));
      openCard({ kind: 'start', id });
      // the camera's one swing round him, with the card (none under reduced motion)
      s.swing = prefersReducedMotion() ? null : { t0: s.t, yaw0: s.yaw };
    },
    [clear, speak, setup, openCard],
  );
  const abandon = useCallback(() => feed({ type: 'abandon' }), [feed]);
  // the radio's call taken (R, or the line itself)
  const take = useCallback(() => {
    const s = sim.current;
    if (!s.call || s.mission) return;
    const id = s.call.id;
    s.call = null;
    setRadio(null);
    // (Cecil's portal isn't a mission: the Flaxans come, and his recorded line with them)
    if (RADIO_CALLS[id]) invade('cecil');
    else startMission(id);
  }, [startMission, invade]);
  // a photo: E in its spot, facing the right way (./missions.js says); the
  // shutter, the HUD gone for the frame
  const snap = useCallback(() => {
    const s = sim.current;
    const step = s.mission ? missionOf(s.mission.id)?.steps[s.mission.step] : null;
    if (!step || step.type !== 'use' || step.id !== 'photo') return false;
    const before = s.mission;
    feed({ type: 'use', id: 'photo', face: s.h.face });
    if (s.mission === before) return false;
    sfx('shutter');
    setShutter(Math.random());
    return true;
  }, [feed]);
  missionApi.current = { start: startMission, feed };
  // Think, Mark!'s result (the page's ref): the last episode's last step
  useEffect(() => {
    if (!thinkMark) return undefined;
    thinkMark.current = (won) => feed({ type: 'use', id: 'thinkmark', won });
    return () => {
      thinkMark.current = null;
    };
  }, [thinkMark, feed]);
  useEffect(
    () => () => {
      clearTimeout(cardT.current);
      for (const t of linesT.current) clearTimeout(t);
    },
    [],
  );

  const act = useCallback(() => {
    const s = sim.current;
    // in a photo's spot: the picture
    if (snap()) return;
    // next to Dad: his episodes (the first; the last, from the porch at dusk
    // or night once the rest are done), or spar with him (Think, Mark!, down the page)
    if (s.talking?.id === 'omni') {
      const next = nextStory(s.story.done);
      if (!s.mission && next === 'ep1') {
        startMission('ep1');
        return;
      }
      if (!s.mission && next === 'ep7' && timeRef.current !== 'noon') {
        startMission('ep7');
        return;
      }
      feed({ type: 'talk', npc: 'omni' });
      sfx('drum');
      say(CALLS.spar.text, 2400, CALLS.spar.who);
      document.getElementById('inv-game')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    // out by the Moon: Allen
    if (s.talking?.id === 'allen') {
      feed({ type: 'talk', npc: 'allen' });
      sfx('ding');
      return;
    }
    // beside Eve: she stops to talk (./companions.js), and says her line
    if (s.talking?.role === 'eve') {
      s.talkEve = true;
      feed({ type: 'talk', npc: 'eve' });
      return;
    }
    const p = s.near;
    if (!p) return;
    // at the GDA: Cecil's board, the season on it
    if (p.id === 'gda') {
      sfx('ding');
      openCard({ kind: 'board' });
      return;
    }
    sfx('ding');
    say(`${p.name}: ${p.line}`, 3200);
  }, [say, feed, startMission, openCard, snap]);

  // Everything held, let go: the keys, the stick, the touch buttons and a
  // drag. A blur or a hidden tab (another app, a call) can swallow the
  // key-up or the lifted finger, and he'd fly on by himself.
  const drag = useRef(null);
  const release = useCallback(() => {
    const s = sim.current;
    s.keys.clear();
    s.stick = { x: 0, y: 0 };
    s.touchUp = s.touchDown = s.touchBoost = false;
    drag.current = null;
  }, []);

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
      // (H was the world's own list of keys: it's the site's guide now, which ? opens too)
      else if (e.code === 'KeyH') toggleGuide();
      else if (e.code === 'KeyR' && !e.repeat) {
        // a call to take first; else, hanging at the water, let go of it
        if (s.call && !s.mission) take();
        else if (onWater(s.h, s.world)) s.free = true;
      }
      else if (e.code === 'KeyQ' && !e.repeat) {
        // a mission called off: asked first, on its card
        if (cardRef.current?.kind === 'abandon') abandon();
        else if (s.mission && !cardRef.current) openCard({ kind: 'abandon', id: s.mission.id });
      } else if (e.key === 'Escape') {
        if (cardRef.current) closeCard();
      }
    };
    const up = (e) => {
      const k = CODES[e.code];
      if (k) s.keys.delete(k);
      if (!e.shiftKey) s.keys.delete('boost');
    };
    const hidden = () => document.hidden && release();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hidden);
      release();
    };
  }, [live, act, cycleTime, startSound, release, abandon, openCard, closeCard, take]);

  // The wind falls quiet while nobody's flying: the frame loop that keeps
  // it in step with him stops when the tab's hidden or the world's
  // scrolled away (Think, Mark! is under it), and would leave it rushing.
  useEffect(() => {
    const hush = () => wind.current?.hush(!live || document.hidden);
    hush();
    document.addEventListener('visibilitychange', hush);
    return () => document.removeEventListener('visibilitychange', hush);
  }, [live]);

  // looking round: drag on the canvas
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.clientX < (stage.host.current?.getBoundingClientRect().left ?? 0) + (stage.host.current?.clientWidth ?? 0) * 0.4) return; // the left of a phone's screen is the stick
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
  // ── every frame ── (the runtime's loop, through the world's draw)
  const tick = (ms) => {
    const a = api.current;
    const s = sim.current;
    if (!a || a.lost || !s.world) return;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    // (a hitstop: the scene's feel slows the game a moment on a punch that lands)
    const real = Math.min(0.05, ms / 1000) * fast;
    const dt = real * a.timeScale(real);
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
    // a mission's title card: the camera's one swing round him meanwhile
    if (s.swing) {
      const k = (s.t - s.swing.t0) / (CARD_MS / 1000);
      if (k >= 1) s.swing = null;
      else {
        s.yaw = s.swing.yaw0 + k * Math.PI * 2;
        s.dragAt = s.t;
      }
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
    // the jump through its press (./flight.js): a moment early or late still goes
    if (s.jump) s.press.press();
    let input = { fwd, side, up: upKey ? 1 : 0, down: downKey ? 1 : 0, boost, run: boost, jump: s.jump, look, press: s.press, free: s.free };
    if (s.intro) {
      // the drop: straight down, flat out, the camera above him, until the ground stops him
      input = { fwd: 0, side: 0, up: 0, down: 1, boost: true, run: false, jump: false, look };
      s.pitch = -0.32;
      s.dragAt = s.t;
      if (s.h.mode === 'ground') s.intro = false;
    }
    s.h = s.h.zone === 'space' ? stepSpace(s.h, input, dt) : stepHero(s.h, input, dt, s.world);
    s.jump = false;
    s.free = false;
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
    // the things to do: the rings, the cards, the rescues (and while he's out
    // in space the city goes on without him: ./quests.js knows he's away)
    s.quests = stepQuests(s.quests, h, dt, s.world);
    for (const e of s.quests.ev) {
      if (e.type === 'lesson-start') {
        sfx('ding');
        say('Dad’s rings: in order, to the Guardians’ hall. Go.');
        feed({ type: 'lesson-start' });
      } else if (e.type === 'ring') {
        sfx('coin');
        feed({ type: 'ring', i: e.n });
      } else if (e.type === 'lesson-done') {
        sfx('fanfare');
        unlock('dadsrings');
        say(`${e.best ? 'A best: ' : 'Round in '}${clock(e.time)}. “${RINGS_DONE.text}”`, 4200, RINGS_DONE.who, RINGS_DONE.text);
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
        feed({ type: 'caught', source: e.source });
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
      // (in the rules' own steps: stepFoes takes at most 0.05 s a step, so the
      // dev clock's speed-up runs it several times; the punch counts once. The
      // scene says where the traffic's cars are while a Mauler's about)
      let r = { foes: s.foes, ev: [], push: null, stun: 0 };
      for (let left = dt, first = true; left > 1e-6; left -= 0.05, first = false) {
        const q = stepFoes(r.foes, h, { punch: first && s.punch, look, eveHit: first ? s.eveHit : null }, Math.min(0.05, left), { cars: s.cars ?? [], hangar: s.guard ?? null });
        r = { foes: q.foes, ev: [...r.ev, ...q.ev], push: q.push ?? r.push, stun: Math.max(r.stun ?? 0, q.stun ?? 0) };
      }
      s.foes = r.foes;
      s.eveHit = null;
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
        } else if (e.type === 'ko') {
          sfxHit('blast', 'ko', hits.foeForce(e.kind));
          feed({ type: 'ko', kind: e.kind ?? 'flaxan', id: e.id });
        } else if (e.type === 'swing' && e.on === 'hangar' && s.mission && s.guard) {
          // a Mauler's swing at the hangar while he's away: the hangar takes it (the last-but-one episode)
          s.hangarHp = Math.max(0, s.hangarHp - 10);
          sfx('crumble');
          feed({ type: 'hurt', what: 'hangar', hp: s.hangarHp });
        } else if (e.type === 'quake' && s.mission) shakeOff(missionOf(s.mission.id)?.steps[s.mission.step]);
        else if (e.type === 'hit') sfxHit('thunk', 'foe', hits.foeForce(e.kind));
        else if (e.type === 'bolt' || e.type === 'blast') sfx('laser');
        else if (e.type === 'hurt') sfx('hit');
        else if (e.type === 'spawn') sfx('pop');
        else if (e.type === 'carAway') sfx('thunk');
        else if (e.type === 'carHit' || e.type === 'carDown') sfx('crumble');
        else if (e.type === 'quake') sfx('boom');
        else if (e.type === 'floored') {
          sfx('thunk');
          say('Off your feet. Up, before the next one.');
        } else if (e.type === 'clear' && !s.foes.foes.some((q) => (q.kind ?? 'flaxan').startsWith('flaxan'))) {
          // (the Flaxans' `won` says its own piece)
          sfx('victory');
          say('Down. Every one of them.', 3200);
        } else if (e.type === 'beaten') {
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
    // a mission's wave (more of them every so often) and its car on the grid (./getaway.js)
    if (s.wave && s.wave.spawned < s.wave.of) {
      s.wave.t += dt;
      if (s.wave.t >= s.wave.every) {
        s.wave.t = 0;
        const n = Math.min(s.wave.n, s.wave.of - s.wave.spawned);
        s.foes = spawnFoes(s.foes, s.wave.kind, n, s.wave.at);
        s.wave.spawned += n;
        sfx('alarm');
        say('More of them, up the river bank.', 2600);
      }
    }
    if (s.getaway && !s.getaway.stopped) for (let left = dt; left > 1e-6; left -= 0.05) s.getaway = stepGetaway(s.getaway, Math.min(0.05, left));
    for (const e of h.ev) {
      s.events.push(e);
      if (e.type === 'land' || e.type === 'slam') feed({ type: 'land', speed: e.speed, p: e.at, body: e.body ?? null });
      if (e.type === 'boom') {
        sfx('boom');
        unlock('soundbarrier');
        if (!s.boomSaid) {
          s.boomSaid = true;
          say('The sound barrier. Keep going.');
        }
      } else if (e.type === 'slam') {
        sfxHit(e.speed > 80 ? 'crumble' : 'thunk', 'slam', e.speed);
        if (e.speed > 80) sfx('boom');
      } else if (e.type === 'impact') sfxHit('crumble', 'impact', e.speed);
      else if (e.type === 'takeoff') sfx('zip');
      else if (e.type === 'splash') {
        // a slam's sound, lighter (water gives): spray, and a thud under it
        // when he hit it hard; one at a time, however often he skims it
        if (s.t - (s.splashAt ?? -1) >= 0.4) {
          s.splashAt = s.t;
          sound('splashSound', e.speed);
          if (e.speed > 80) sfxHit('thunk', 'splash', e.speed);
        }
      } else if (e.type === 'land') {
        sfxHit(e.speed > 300 ? 'crumble' : 'thunk', 'land', e.speed);
        // on the Moon, or Mars (./orbit.js names which; a soft landing in the city names none)
        if (e.body) {
          unlock(e.body === 'moon' ? 'moonwalk' : 'redplanet');
          say(e.body === 'moon' ? 'The Moon. Neil Armstrong, eat your heart out. (Space or W to go.)' : 'Mars. A long way from home. (Space to go.)', 4200);
        }
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
    // the radio (./missions.js nextRadioCall): a side call now and then, on the HUD's line for a while
    if (!s.call) {
      const eve = a.debug.npcs?.eve?.rules?.state === 'escort';
      const r = nextRadioCall(s.radio, dt, { mission: s.mission?.id ?? null, zone: inSpace ? 'space' : 'city', eve, fight: s.foes.on, done: s.story.done });
      s.radio = r.radio;
      if (r.call) {
        const m = missionOf(r.call);
        // (a call that's no mission says who's calling once: on the radio's line, not in its words too)
        const c = m ? { who: m.intro[0][0], text: m.intro[0][1] } : { who: RADIO_CALLS[r.call].who, text: RADIO_CALLS[r.call].text.replace(/^\w+: /, '') };
        s.call = { id: r.call, until: s.t + RADIO.offer };
        sfx('crackle');
        setRadio({ id: r.call, ...c });
      }
    } else if (s.t > s.call.until || s.mission) {
      s.call = null;
      setRadio(null);
    }
    // the mission under way: where he is, and where what its step cares about is; then the clock
    if (s.mission) {
      const dadP = a.debug.dad().p;
      feed({ type: 'at', p: h.p, mode: h.mode, speed, face: h.face, npcs: { omni: dadP, allen: a.debug.allen }, car: getawayAt(s.getaway) });
      for (let left = dt; left > 1e-6 && s.mission; left -= 0.05) feed({ type: 'tick', dt: Math.min(0.05, left) });
    }
    a.frame(s, dt);
    s.frame++;
    // what Eve and Dad said and did (./companions.js): her blow lands in the next fight step
    for (const e of s.companion ?? []) {
      if (e.type === 'line') say(e.text, 3200, e.who);
      else if (e.type === 'eveHit' && e.foe != null) s.eveHit = e.foe;
    }
    if (s.companion) s.companion.length = 0;

    // what's near: a place's door, on the ground or just over it (and in
    // space, his height is over whichever of the Earth, the Moon and Mars
    // he's nearest: on the Moon, it's the Moon's ground under him)
    const alt = inSpace ? over(h.p, nearest(h.p)) : h.p[1] - groundAt(h.p[0], h.p[2]);
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
      // where he is, for the gauge: the streets, the sky over them, or out of the air
      const zoneName = inSpace ? 'Space' : alt > 300 ? 'Sky' : 'City';
      if (H.zone && H.zone.textContent !== zoneName) H.zone.textContent = zoneName;
      if (H.bar) H.bar.style.transform = `scaleX(${Math.min(1, inSpace ? Math.log10(1 + speed) / Math.log10(6001) : speed / FLY.top)})`;
      if (H.lines) H.lines.style.opacity = String(clamp((speed - 70) / 160, 0, 0.85));
      const marks = [];
      const q = s.quests;
      // the villains (./foes.js): the portal while it's open, and the ones on the ground
      const up = standing(s.foes);
      if (portalOpen(s.foes)) marks.push({ x: PORTAL.p[0], z: PORTAL.p[2], color: '#d04dff', name: 'Portal' });
      for (const e of up) if (e.kind === 'mauler' || e.kind === 'seismic') marks.push({ x: e.p[0], z: e.p[2], color: '#d04dff', name: e.kind === 'mauler' ? 'Mauler' : 'Doc Seismic' });
      if (q.rescue && !q.rescue.carried) marks.push({ x: q.rescue.p[0], z: q.rescue.p[2], color: '#ff3b30', name: 'Help' });
      if (q.lesson.on) marks.push({ x: RINGS[q.lesson.next].p[0], z: RINGS[q.lesson.next].p[2], color: '#ffd23a', name: `Ring ${q.lesson.next + 1}` });
      // the mission's marker (./missions.js markerOf): a point, or whatever's there now
      const m = s.mission ? missionOf(s.mission.id) : null;
      const stepDef = m?.steps[s.mission.step] ?? null;
      let mdist = null;
      if (stepDef) {
        const kind = stepDef.kind ?? stepDef.beat?.kind;
        const wanted = (e) => (Array.isArray(kind) ? kind.includes(e.kind ?? 'flaxan') : (e.kind ?? 'flaxan') === kind);
        const foes = up
          .filter(wanted)
          .sort((e1, e2) => Math.hypot(e1.p[0] - h.p[0], e1.p[2] - h.p[2]) - Math.hypot(e2.p[0] - h.p[0], e2.p[2] - h.p[2]))
          .map((e) => e.p);
        const moon = a.debug.bodies.find((b) => b.id === 'moon');
        const mk = markerOf(s.mission, { npcs: { omni: a.debug.dad().p, allen: a.debug.allen }, car: getawayAt(s.getaway), foes, faller: q.rescue && !q.rescue.carried ? q.rescue.p : null, bodies: { moon: moon?.c } });
        s.marker = mk ? { p: mk, color: m.colour } : null;
        if (mk) {
          mdist = Math.hypot(mk[0] - h.p[0], mk[1] - h.p[1], mk[2] - h.p[2]);
          if (!inSpace) marks.push({ x: mk[0], z: mk[2], color: m.colour, name: 'Mission' });
        }
        // the race's gates, and a photo's frame, for the scene to draw
        s.gates = stepDef.type === 'race' && !stepDef.ring ? { list: stepDef.gates, next: s.mission.count, r: stepDef.r } : null;
        s.photo = stepDef.type === 'use' && stepDef.id === 'photo' ? { p: stepDef.at, face: stepDef.face, r: stepDef.r } : null;
      } else {
        s.marker = null;
        s.gates = null;
        s.photo = null;
      }
      s.marks = marks;
      if (H.compass && H.compassBox && !inSpace) drawCompass(H.compass, H.compassBox, s.yaw, h, s.world.places, marks);
      if (H.goal) {
        // (in space, the city's distances mean nothing: he's a world away)
        const d = q.rescue ? Math.round(Math.hypot(q.rescue.p[0] - h.p[0], q.rescue.p[1] - h.p[1], q.rescue.p[2] - h.p[2])) : 0;
        const fightText = s.foes.on ? `${foesText(s.foes, up)} · you ${Math.max(0, Math.round(s.foes.hp))}%` : '';
        const rescueText = q.rescue && (q.rescue.carried ? (inSpace ? 'Set them down: back in the city' : 'Set them down: land anywhere') : `${WHAT[q.rescue.kind]} · ${inSpace ? 'down in the city' : `${d} m`}`);
        // (a mission's step first: its words, how far, the count, the hangar, the clock)
        let missionText = '';
        if (stepDef) {
          const p = s.mission;
          const parts = [objectiveText(stepDef, inSpace ? null : mdist)];
          const of = stepDef.n ?? stepDef.gates?.length ?? null;
          if (of) parts.push(`${p.count} of ${of}`);
          if (stepDef.beat) parts.push(`${stepDef.beat.name} ${Object.values(p.kos ?? {}).filter((k) => k.kind === stepDef.beat.kind).length >= stepDef.beat.n ? 'down' : 'still up'}`);
          if (stepDef.type === 'protect') parts.push(`hangar ${Math.max(0, Math.round(p.hp ?? 100))}% · ${Math.max(0, Math.ceil(stepDef.time - p.stepT))} s`);
          else if (stepDef.time != null) parts.push(`${Math.max(0, Math.ceil(stepDef.time - p.stepT))} s`);
          if (s.foes.on && stepDef.type === 'defeat') parts.push(`you ${Math.max(0, Math.round(s.foes.hp))}%`);
          missionText = parts.join(' · ');
        }
        const text = missionText || fightText || rescueText || (q.lesson.on ? `Dad’s rings · ${q.lesson.next + 1} of ${RINGS.length} · ${clock(q.lesson.t)}` : '');
        if (H.goal.textContent !== text) H.goal.textContent = text;
        H.goal.dataset.on = text ? '1' : '';
        H.goal.dataset.mission = missionText ? '1' : '';
        if (missionText) H.goal.style.setProperty('--mc', m.colour);
        H.goal.dataset.red = q.rescue && !s.foes.on && !missionText ? '1' : '';
        H.goal.dataset.purple = s.foes.on && !missionText ? '1' : '';
      }
      // the title goes to a chip 2.5 s after he first moves, or at once when there's something to do (./hud.js)
      if (!s.movedAt && (s.moved || speed > 2)) s.movedAt = s.t;
      if (!s.chip && titleMode(s.t, s.movedAt ?? null, Boolean(H.goal?.dataset.on)) === 'chip') {
        s.chip = true;
        setChip(true);
      }
    }
    if (s.frame % 4 === 0 && mapRef.current && H.mapBox && !inSpace) drawMap(mapRef.current, H.mapBox, h, s.yaw, alt, s.world, s.marks);
    // who's talking to him: a bubble over the nearest, a new line every few seconds
    if (s.frame % 3 === 0) {
      const t = a.talkers(h)[0] ?? null;
      const said = s.said ?? (s.said = {});
      if (t?.id !== s.talking?.id) {
        s.talking = t;
        if (t) {
          said[t.id] = ((said[t.id] ?? -1) + 1) % t.lines.length;
          s.talkAt = s.t;
          setBubble({ name: t.name, who: t.role ?? t.id, text: t.lines[said[t.id]] });
        } else setBubble(null);
      } else if (t && s.t - s.talkAt > 5) {
        said[t.id] = (said[t.id] + 1) % t.lines.length;
        s.talkAt = s.t;
        setBubble({ name: t.name, who: t.role ?? t.id, text: t.lines[said[t.id]] });
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
      say(CALLS.mimic.text, 4200, CALLS.mimic.who);
    }
    // (the city's hum is the city's: not over the Moon)
    wind.current?.set({ speed, alt: inSpace ? Infinity : alt });
  };
  useStageFrame(stage, tick, live);

  // the thumbs, on a phone (the kit's Stick: one finger at a time, read from
  // where it went down), and the buttons held for as long as they're pressed
  const onStick = (x, y) => (sim.current.stick = { x, y });
  const hold = (key) => ({
    onPress: () => {
      startSound();
      if (key === 'touchUp') sim.current.jump = true;
      sim.current[key] = true;
    },
    onRelease: () => (sim.current[key] = false),
  });
  const punch = () => (startSound(), (sim.current.punch = true));

  return (
    <div className="iw-stage" ref={stageBox} data-zone={zone} data-shutter={shutter ? '1' : undefined}>
      <div ref={stage.host} className="iw-canvas" data-on={stage.status === 'on' || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={(e) => e.preventDefault()} aria-label="The city, from the air. Fly with W, A, S and D; Space to go up, C to go down, Shift to go flat out." />
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
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Over the city" />
      <MissionCard card={mcard} story={sim.current.story} onClose={closeCard} onAgain={() => startMission(mcard?.id)} onStart={startMission} onAbandon={abandon} />

      <InvHud hud={hud} mapRef={mapRef} time={time} cycleTime={cycleTime} chip={chip} trav={trav} found={found} cards={CARDS.length} near={near} act={act} toast={toast} radio={radio} take={take} touch={touch} onStick={onStick} startSound={startSound} hold={hold} punch={punch} />
      {shutter && <div className="iw-shutter" key={shutter} aria-hidden="true" onAnimationEnd={() => setShutter(null)} />}

    </div>
  );
}

// ── the HUD's canvases (the kit's fitCanvas: sharp on a 2× screen): the
// compass drawn in CSS pixels, so its type is the size it says on a phone
// too, and the map in 180ths of its width, its look at any size ──
function fitHud(H, map) {
  H.mapBox = fitCanvas(map, 180);
  const box = fitCanvas(H.compass);
  if (box) {
    // where the HUD's other things still sit over the strip (the title, the
    // goal): nothing of the compass is drawn there (by more than a sliver:
    // the title's box runs a little below its letters)
    const r = H.compass.getBoundingClientRect();
    box.block = [];
    for (const el of [H.tools, ...(H.brand?.children ?? [])]) {
      const b = el?.getBoundingClientRect();
      if (b?.width && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 6 && b.right > r.left && b.left < r.right) box.block.push([b.left - r.left - 6, b.right - r.left + 6]);
    }
  }
  H.compassBox = box;
}

// ── the compass: a strip of headings, the places marked on it ──
const DIRS = [
  [0, 'S'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'N'],
  [-Math.PI / 2, 'W'],
];
function drawCompass(c, box, yaw, h, places, marks = []) {
  const x = c.getContext('2d');
  const { w: W, h: H } = box;
  const u = H / 60; // (laid out for a strip 60 high: names, headings, ticks, dots, a second row of names)
  x.setTransform(box.s, 0, 0, box.s, 0, 0);
  x.clearRect(0, 0, W, H);
  const span = COMPASS.span; // what the strip shows
  const at = (a) => W / 2 + (wrap(yaw - a) / span) * W; // (yaw grows to the left)
  x.font = `700 ${20 * u}px system-ui, sans-serif`;
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,0.9)';
  const headings = [];
  for (const [a, n] of DIRS) {
    const px = at(a);
    if (px < 10 * u || px > W - 10 * u) continue;
    x.fillText(n, px, 19 * u);
    headings.push(px);
  }
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 24; k++) {
    const px = at((k / 24) * Math.PI * 2);
    if (px > 0 && px < W) x.fillRect(px - 0.5, 24 * u, 1, (k % 6 === 0 ? 8 : 5) * u);
  }
  // the places: a dot each
  const near = [];
  x.fillStyle = '#ffd23a';
  for (const p of places) {
    const a = Math.atan2(p.x - h.p[0], p.z - h.p[2]);
    const px = at(a);
    const d = Math.hypot(p.x - h.p[0], p.z - h.p[2]);
    if (px >= 8 * u && px <= W - 8 * u) {
      x.beginPath();
      x.arc(px, 36 * u, 4 * u, 0, Math.PI * 2);
      x.fill();
    }
    if (d < 1800) near.push({ id: p.id, label: p.name.replace(/^The /, ''), bearing: wrap(yaw - a), d });
  }
  // and the nearest's names, laid out by ./hud.js: clear of the headings
  // and of each other (a second row under the dots for the ones that would
  // touch), none under the buttons where they overlap the strip's end
  const end = box.block.filter(([, q]) => q >= W - 8).reduce((m, [p]) => Math.min(m, p), W);
  const laid = layoutCompass(near.sort((a, b) => a.d - b.d), W, { span, gap: COMPASS.gap, reserve: W - end, taken: headings });
  x.font = `600 ${14 * u}px system-ui, sans-serif`;
  for (const n of laid) {
    if (n.clipped) continue;
    const half = x.measureText(n.label).width / 2 + 3 * u;
    const lx = clamp(n.x, half, W - half);
    // (and not under anything else of the HUD's over the strip: the title, the goal)
    if (box.block.some(([p, q]) => lx + half > p && lx - half < q)) continue;
    x.fillText(n.label, lx, n.row === 0 ? 12 * u : 54 * u);
  }
  for (const m of marks) {
    const px = at(Math.atan2(m.x - h.p[0], m.z - h.p[2]));
    const cx = Math.max(10 * u, Math.min(W - 10 * u, px));
    x.fillStyle = m.color;
    x.beginPath();
    x.moveTo(cx, 26 * u);
    x.lineTo(cx + 7 * u, 40 * u);
    x.lineTo(cx - 7 * u, 40 * u);
    x.closePath();
    x.fill();
  }
  x.fillStyle = '#ffd23a';
  x.fillRect(W / 2 - u, 22 * u, 2 * u, 18 * u);
  for (const [p, q] of box.block) x.clearRect(p, 0, q - p, H);
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
function drawMap(c, box, h, yaw, alt, world, marks = []) {
  const x = c.getContext('2d');
  const W = box.w;
  x.setTransform(box.s, 0, 0, box.s, 0, 0);
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

