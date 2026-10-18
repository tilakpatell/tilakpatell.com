import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useInView, useMediaQuery } from '../../../lib/hooks';
import { useVoiced } from '../../../lib/useVoiced';
import { sayVoiced } from '../../../lib/voiced';
import { useAchievements } from '../../Achievements';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { brawlThings, newFoes, spawnFoes, startInvasion, stepFoes } from './foes';
import { dive, jumpPress, newHero, stepHero } from './flight';
import { newBrawl, stepBrawl } from './brawl';
import { impactGroups } from '../../../lib/impact';
import { pressGroups } from '../../../lib/press';
import { getawayAt, stepGetaway } from './getaway';
import { CALLS } from './lines';
import { RADIO, RADIO_CALLS, feedMission, loadStory, missionOf, newRadio, nextRadioCall, nextStory, startMission as beginMission, stepOf } from './missions';
import { intoSpace, outOfSpace, stepSpace } from './orbit';
import { CARDS, newQuests, stepQuests } from './quests';
import { PLACES, SPAWN, groundAt, isSafeStart } from './map';
import { VOICE } from './voicelines';
import InvHud from './InvHud';
import MissionCard from './MissionCard';
import './world.css';
import LoadingVeil from '../../worlds/LoadingVeil';
import { useStage, useStageFrame } from '../../avengers/shared/runtime';
import city from './module';
import { AT, CARD_MS, QUESTS, ROOF, STORY, TIME, brawlEvents, foeEvents, handleOut, heroEvents, hits, questEvents, sfx } from './events';
import { bindInput, pointerLook, readControls } from './input';
import { fitHud, hudFrame } from './hudDraw';
import { ROOM, nearest, over, placeOf, seenAs } from './online';

// The Graysons' city, the world: fly about it as Invincible. The rules are
// in ./flight.js and ./map.js, the drawing in ./scene.js; this is the
// input (keys, mouse, touch, a pad), the clock, and the HUD over it: speed
// and Mach, height, a compass with the places on it, a map. Without 3D,
// the places as cards.

const TIMES = ['noon', 'dusk', 'night'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
    sim.current = { intro: false, kept: local.get(AT, null), quests: keptQuests(), foes: newFoes(), brawl: newBrawl(), fist: false, poundPress: false, blocked: 0, cars: null, mission: null, story: keptStory(), getaway: null, wave: null, swing: null, marker: null, gates: null, photo: null, hangarHp: 100, radio: newRadio(), call: null, punch: false, punchT: 0, invadeAt: 240, h: newHero(SPAWN), keys: new Set(), stick: { x: 0, y: 0 }, touchUp: false, touchDown: false, touchBoost: false, yaw: SPAWN.face, pitch: -0.05, dragAt: -1e9, t: 0, jump: false, press: jumpPress(), free: false, events: [], companion: [], eveHit: null, frame: 0, padBefore: null, moved: false, world: null };
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
  // what a step (or its end) asks for (./events.js)
  const setup = useCallback((outs) => handleOut(outs, { s: sim.current, say, speak, unlock, clear, openCard, closeCard, shakeOff }), [say, speak, unlock, clear, openCard, closeCard, shakeOff]);
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
    s.fist = false;
    s.stick = { x: 0, y: 0 };
    s.touchUp = s.touchDown = s.touchBoost = false;
    drag.current = null;
  }, []);

  // the keys (./input.js)
  useEffect(() => {
    if (!live) return undefined;
    return bindInput(sim.current, { startSound, act, cycleTime, take, abandon, openCard, closeCard, card: () => cardRef.current, release });
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

  // looking round: drag on the canvas (./input.js)
  const { onPointerDown, onPointerMove, onPointerUp } = pointerLook({ sim, drag, host: stage.host, startSound });

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
    const { input, look } = readControls(s, dt, { act, cycleTime });
    // (Shift is his block on the ground facing a foe, not a run; carrying, he's slower: ./brawl.js)
    const shift = input.boost;
    if (s.brawl.guard) input.run = input.boost = false;
    input.carry = Boolean(s.brawl.carry);
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
    questEvents(s, { say, feed, unlock, setFound });
    // the Flaxans: four minutes in if nobody's started them sooner
    s.punchT = Math.max(0, s.punchT - dt);
    if (!inSpace) {
      if (!s.invaded && s.t > s.invadeAt) invade('auto');
      // (in the rules' own steps: stepFoes takes at most 0.05 s a step, so the
      // dev clock's speed-up runs it several times; the punch counts once. The
      // scene says where the traffic's cars are while a Mauler's about)
      // his brawl (./brawl.js): a tap, a hold, a throw, a slam, a dive, his block, a pound
      const things = brawlThings(s.foes);
      const down = h.ev.find((e) => e.type === 'slam' || e.type === 'land');
      const wall = h.ev.find((e) => e.type === 'impact' || e.type === 'bump');
      const br = stepBrawl(s.brawl, { fist: s.fist, punched: s.punch, up: input.jump, guard: shift, pound: s.poundPress }, { p: h.p, v: h.v, mode: h.mode, look, alt: h.p[1] - groundAt(h.p[0], h.p[2]), landed: down ? { speed: down.speed, at: down.at } : null, impact: wall ? { speed: wall.speed, at: wall.at, tower: wall.building ?? null } : null }, { things, blocked: s.blocked }, dt);
      s.brawl = br.b;
      const blow = br.out.find((o) => o.kind === 'punch' || o.kind === 'counter');
      const dived = br.out.find((o) => o.kind === 'dive');
      if (dived) s.h = dive(s.h, dived.at);
      // (a dive comes down on where its foe is now, not where it was)
      const prey = s.brawl.dive && s.h.dive ? things.find((q) => q.id === s.brawl.dive.target) : null;
      if (prey) s.h.dive.at = prey.at;
      brawlEvents(s, br.out);
      let r = { foes: s.foes, ev: [], push: null, stun: 0 };
      for (let left = dt, first = true; left > 1e-6; left -= 0.05, first = false) {
        const q = stepFoes(r.foes, h, { punch: first && Boolean(blow), power: blow?.power ?? 1, look, eveHit: first ? s.eveHit : null, brawl: first ? br.out : [], block: s.brawl.guard }, Math.min(0.05, left), { cars: s.cars ?? [], hangar: s.guard ?? null });
        r = { foes: q.foes, ev: [...r.ev, ...q.ev], push: q.push ?? r.push, stun: Math.max(r.stun ?? 0, q.stun ?? 0) };
      }
      s.foes = r.foes;
      s.eveHit = null;
      s.blocked = r.ev.filter((e) => e.type === 'blocked').length;
      if (r.push) {
        const l = Math.hypot(...r.push) || 1;
        s.h = { ...s.h, mode: 'air', crouch: 0, v: r.push, spd: l, dir: r.push.map((c) => c / l) };
      }
      if (r.stun) s.h = { ...s.h, stun: Math.max(s.h.stun ?? 0, r.stun) };
      foeEvents(s, r.ev, { say, feed, unlock, shakeOff });
    }
    s.punch = false;
    s.poundPress = false;
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
    heroEvents(s, h.ev, { say, feed, unlock });
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
    hudFrame(s, a, h, hud.current, mapRef.current, { speed, alt, inSpace, setChip });
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
  // (the punch button held is the punch key held: a grab, and let go, a throw)
  const punch = () => (startSound(), (sim.current.punch = true), (sim.current.fist = true));
  const punchUp = () => (sim.current.fist = false);

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

      <InvHud hud={hud} mapRef={mapRef} time={time} cycleTime={cycleTime} chip={chip} trav={trav} found={found} cards={CARDS.length} near={near} act={act} toast={toast} radio={radio} take={take} touch={touch} onStick={onStick} startSound={startSound} hold={hold} punch={punch} punchUp={punchUp} />
      {shutter && <div className="iw-shutter" key={shutter} aria-hidden="true" onAnimationEnd={() => setShutter(null)} />}

    </div>
  );
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

