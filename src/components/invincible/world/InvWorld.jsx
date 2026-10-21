import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useInView, useMediaQuery } from '../../../lib/hooks';
import { useVoiced } from '../../../lib/useVoiced';
import { sayVoiced } from '../../../lib/voiced';
import { readPad } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { newFoes, spawnFoes, startInvasion, stepFoes } from './foes';
import { jumpPress, newHero, stepHero } from './flight';
import { impactGroups } from '../../../lib/impact';
import { pressGroups } from '../../../lib/press';
import { getawayAt, stepGetaway } from './getaway';
import { CALLS } from './lines';
import { RADIO, RADIO_CALLS, feedMission, missionOf, newRadio, nextRadioCall, nextStory, placeOf as missionPlace, startMission as beginMission, stepOf } from './missions';
import { intoSpace, outOfSpace, stepSpace } from './orbit';
import { CARDS, stepQuests } from './quests';
import { SPAWN, groundAt, isSafeStart, near as boxesNear } from './map';
import { VOICE } from './voicelines';
import InvHud from './InvHud';
import MissionCard from './MissionCard';
import { titleMode } from '../../../runtime/hud';
import './world.css';
import LoadingVeil from '../../worlds/LoadingVeil';
import { useStage, useStageFrame } from '../../avengers/shared/runtime';
import city from './module';
import Cards from './Cards';
import { applyOuts, hits, onBrawlEvent, onFoeEvent, onHeroEvent, onQuestEvent, sfx } from './events';
import { newBrawl, stepBrawl } from './brawl';
import { drawMap, fitHud } from './hudCanvas';
import { writeHud } from './hudFrame';
import { bindKeys, pointerHandlers } from './input';
import { AT, RUINSKEY, TIME, TIMES, keptQuests, keptRuins, keptStory, keptTime, placeHero } from './keep';
import { forceOf, hitTower, keyOf, serialise as keepRuins } from './demolish';
import { ROOM, nearest, over, placeOf, seenAs } from './online';

// The Graysons' city, the world: fly about it as Invincible. The rules are
// in ./flight.js and ./map.js, the drawing in ./scene.js; this is the
// input (keys, mouse, touch, a pad), the clock, and the HUD over it: speed
// and Mach, height, a compass with the places on it, a map. Without 3D,
// the places as cards.

const ROOF = missionPlace('roof').p;
const CARD_MS = 2600; // the episode's title card (2.5 s, and the fade's end)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
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
    sim.current = { intro: false, kept: local.get(AT, null), quests: keptQuests(), foes: newFoes(), cars: null, mission: null, story: keptStory(), getaway: null, wave: null, swing: null, marker: null, gates: null, photo: null, hangarHp: 100, radio: newRadio(), call: null, punch: false, punchT: 0, invadeAt: 240, h: newHero(SPAWN), keys: new Set(), stick: { x: 0, y: 0 }, touchUp: false, touchDown: false, touchBoost: false, yaw: SPAWN.face, pitch: -0.05, dragAt: -1e9, t: 0, jump: false, press: jumpPress(), free: false, events: [], companion: [], eveHit: null, frame: 0, padBefore: null, moved: false, world: null, ruins: keptRuins(), brawl: newBrawl(), pound: false, dive: false, touchPunch: false, mouseDown: false };
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
    // the city as it was left: every mark drawn, scaffolding where the crews are (./demolish.js)
    for (const [k, d] of sim.current.ruins.damage) a.setDamage(k, d, sim.current.ruins.mending.has(k));
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
      // (and the city's damage: the n buildings nearest [x, z], hit for d)
      hook.ruin = ([x, z], n = 3, d = 0.8) => {
        const bs = [...sim.current.world.buildings].sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z)).slice(0, n);
        for (const b of bs) hitRuin(`b:${b.id}`, d, [b.x, b.h / 2, b.z], [0, 1, 0]);
      };
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
      if (s.ruins.damage.size || local.get(RUINSKEY, null)) local.set(RUINSKEY, keepRuins(s.ruins));
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
  const setup = useCallback((outs) => applyOuts(outs, { s: sim.current, say, speak, unlock, clear, openCard, closeCard, shakeOff }), [say, speak, unlock, clear, openCard, closeCard, shakeOff]);
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

  // the city that breaks (./demolish.js): a face hit hard enough is marked,
  // drawn so, and the chunks come off it; the first tower to lose its top is said
  const hitRuin = (key, force, at, n = null) => {
    const s = sim.current;
    const a = api.current;
    if (!key || !force || !a) return;
    const r = hitTower(s.ruins, key, force);
    if (!r.delta) return;
    s.ruins = r.ruins;
    a.setDamage(key, r.d);
    s.events.push({ type: 'rubble', at, n, delta: r.delta, stage: r.stage });
    sfx(r.stage === 3 ? 'crumble' : 'thunk');
    if (r.stage === 3 && !s.ruinSaid) {
      s.ruinSaid = true;
      say('That one’s top is gone. Cecil’s crews will be a day on it.', 3600);
    }
  };
  // the box a point is in, by its collider, for a car come down against a face
  const ruinAt = (p) => {
    const s = sim.current;
    for (const b of boxesNear(s.world, p[0], p[2], 3)) if (p[0] > b.x0 - 1.5 && p[0] < b.x1 + 1.5 && p[2] > b.z0 - 1.5 && p[2] < b.z1 + 1.5 && p[1] < b.y1 && p[1] > (b.y0 ?? 0) - 1) return keyOf(b);
    return null;
  };

  // the keys (./input.js)
  useEffect(() => {
    if (!live) return undefined;
    return bindKeys(sim.current, { act, cycleTime, startSound, release, abandon, openCard, closeCard, take, cardRef });
  }, [live, act, cycleTime, startSound, release, abandon, openCard, closeCard, take]);
  // scrolled away (Think, Mark! is under it), and would leave it rushing.
  useEffect(() => {
    const hush = () => wind.current?.hush(!live || document.hidden);
    hush();
    document.addEventListener('visibilitychange', hush);
    return () => document.removeEventListener('visibilitychange', hush);
  }, [live]);

  // looking round: drag on the canvas (./input.js)
  const { onPointerDown, onPointerMove, onPointerUp } = pointerHandlers({ sim, drag, host: stage.host, startSound });

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
    if (pressed('a')) s.jump = s.dive = true;
    if (pressed('x')) s.punch = true;
    if (pressed('y')) act();
    if (pressed('start')) cycleTime();
    const look = [Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)];
    // the jump through its press (./flight.js): a moment early or late still goes
    if (s.jump) s.press.press();
    let input = { fwd, side, up: upKey ? 1 : 0, down: downKey ? 1 : 0, boost, run: boost && !s.brawl.blocking, jump: s.jump, look, press: s.press, free: s.free };
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
    for (const e of s.quests.ev) onQuestEvent(e, { s, say, feed, unlock, setFound });
    // the Flaxans: four minutes in if nobody's started them sooner
    s.punchT = Math.max(0, s.punchT - dt);
    if (!inSpace) {
      if (!s.invaded && s.t > s.invadeAt) invade('auto');
      // (in the rules' own steps: stepFoes takes at most 0.05 s a step, so the
      // dev clock's speed-up runs it several times; the punch counts once. The
      // scene says where the traffic's cars are while a Mauler's about)
      let r = { foes: s.foes, ev: [], push: null, stun: 0 };
      for (let left = dt, first = true; left > 1e-6; left -= 0.05, first = false) {
        const q = stepFoes(r.foes, h, { punch: first && s.punch, look, eveHit: first ? s.eveHit : null, block: s.brawl.blocking }, Math.min(0.05, left), { cars: s.cars ?? [], hangar: s.guard ?? null });
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
        onFoeEvent(e, { s, say, feed, unlock, shakeOff });
      }
    }
    s.punch = false;
    // the brawl (./brawl.js), after the villains' step: a hold, a hurl, a slam, a dive, a block, a pound
    if (!inSpace) {
      const landed = h.ev.find((e) => e.type === 'land' || e.type === 'slam' || e.type === 'impact') ?? null;
      const punchHeld = k.has('punch') || s.touchPunch || s.mouseDown || Boolean(pad?.x);
      const heldBefore = Boolean(s.brawl.held);
      const rb = stepBrawl(s.brawl, s.foes, s.h, { punchHeld, look, dive: s.dive && h.mode === 'air', block: boost && h.mode === 'ground', pound: s.pound, landed }, dt, { cars: s.cars ?? [] });
      s.brawl = rb.b;
      s.foes = rb.foes;
      if (rb.push) {
        const l = Math.hypot(...rb.push) || 1;
        s.h = { ...s.h, mode: 'air', crouch: 0, v: rb.push, spd: l, dir: rb.push.map((c) => c / l) };
      }
      if (rb.cap != null) {
        const l = Math.hypot(...s.h.v);
        if (l > rb.cap) s.h = { ...s.h, v: s.h.v.map((c) => (c * rb.cap) / l), spd: rb.cap };
      }
      for (const e of rb.ev) {
        s.events.push(e);
        onBrawlEvent(e, { s, say });
      }
      // the walls: Mark into one flat out, or with something in hand; a thrown car come down against one
      for (const e of h.ev) if (e.type === 'impact') hitRuin(keyOf(e), forceOf(e, { held: heldBefore }), e.at, e.n);
      for (const e of s.events) if ((e.type === 'carDown' || e.type === 'carHit') && e.at) hitRuin(ruinAt(e.at), forceOf(e), e.at);
    }
    s.pound = false;
    s.dive = false;
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
      onHeroEvent(e, { s, say, feed, unlock });
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
      else if (e.type === 'dadAt') feed({ type: 'dadAt', i: e.i }); // (episode 7: Dad at a point and moving on)
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
      writeHud(H, { s, h, a, speed, alt, inSpace });
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
      if (key === 'touchUp') sim.current.jump = sim.current.dive = true;
      if (key === 'touchPunch') sim.current.punch = true;
      sim.current[key] = true;
    },
    onRelease: () => (sim.current[key] = false),
  });

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

      <InvHud hud={hud} mapRef={mapRef} time={time} cycleTime={cycleTime} chip={chip} trav={trav} found={found} cards={CARDS.length} near={near} act={act} toast={toast} radio={radio} take={take} touch={touch} onStick={onStick} startSound={startSound} hold={hold} />
      {shutter && <div className="iw-shutter" key={shutter} aria-hidden="true" onAnimationEnd={() => setShutter(null)} />}

    </div>
  );
}
