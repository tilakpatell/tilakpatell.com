import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery, usePageVisible } from '../../../lib/hooks';
import { readPad, typing } from '../../games/pad';
import { Bubble, Convo, QuestList, Stick } from '../../middleearth/towns/TownHud';
import { keyDown, keyUp, moveOf } from '../../middleearth/towns/keys';
import { drawMap } from '../../middleearth/towns/map';
import { nearest } from '../../middleearth/towns/story';
import { newTalk, talkNode, talkOn } from '../../middleearth/towns/talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../../middleearth/towns/walker';
import { newWatchers, stepWatchers } from '../../middleearth/towns/watchers';
import { HERD, calmHerd, newHerd, stepHerd, stillHerding } from './daycare';
import { BOOTH, CAST, COLLIDERS, COUNCIL_DOOR, CORE, ESCAPE_START, FACTORY_DOOR, HANGAR_WALLS, KIOSKS, PEN, PLANTERS, RICK, ROUNDS, SPOTS, WALLS, WORLD, castFor, crowdColliders, spot, validAt } from './layout';
import { CONVOS, COPS, QUESTS, SEAL, SPEAKERS, citadelProgress, moodOf } from './story';
import { SHOUTS } from './shouts';
import { HUNT, leaveHunt, newHunt, stepHunt } from './locos';
import { BLOCKS as TOWN_BLOCKS, CAST as TOWN_CAST, COLLIDERS as TOWN_COLLIDERS, COP, EXIT as TOWN_EXIT, MORTYTOWN, START as TOWN_START, WALKS as TOWN_WALKS, WALLS as TOWN_WALLS, validTownAt } from './mortytown';
import { LINE, dropLayer, newLine, stepLine } from './wafers';
import { voiceFor } from './voicelines';
import { sayVoiced } from '../../../lib/voiced';
import { EMOTES, createEmoteWheel, emotePacket, keepEmote, wheelAngle } from '../../../lib/emote';
import '../../middleearth/shire/shire.css';
import '../../middleearth/towns/bree/bree.css';
import Wardrobe from '../wardrobe/Wardrobe';
import { useLooks } from '../wardrobe/useLooks';
import './citadel.css';
import GuideCue from '../../guide/GuideCue';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import LoadingVeil from '../../worlds/LoadingVeil';
import { throttled } from '../../worlds/loadingSteps';

// The Citadel of Ricks, the world: walk in through the portal as Rick
// C-137 and play the five scenes there (Morty Day Care, Simple Rick's,
// the Council, Vote Morty, and getting to the cruiser). The concourse is
// in ./layout.js, the story in ./story.js, the drawing in ./scene.js;
// this is the walking, the HUD, the talk, the herd, the line and the Cop
// Ricks. Without 3D, the scenes are listed as cards.

const DONE = 'tp-citadel-done';
const AT = 'tp-citadel-at';
const sounds = () => import('./sounds');
const clip = (id) => import('../../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const PROMPT = {
  daycare: { name: 'Morty Day Care', act: 'Round them up' },
  factory: { name: 'Simple Rick’s', act: 'Go in' },
  council: { name: 'The Council of Ricks', act: 'Go in' },
  ballot: { name: 'Candidate Morty’s booth', act: 'Cast your ballot' },
  hangar: { name: 'Hangar 7', act: 'Get in the cruiser' },
  leave: { name: 'Hangar 7', act: 'Back to C-137' },
  portal: { name: 'The portal terminal', act: 'Portal home' },
  mortytown: { name: 'The lift to Mortytown', act: 'Go down' },
  up: { name: 'The lift', act: 'Back up to the concourse' },
};
const CONTEMPT = new Set(['grovel', 'alibi', 'lost']);
// a walker for each mood: the crowds that are out are in the way too
const walkers = Object.fromEntries(['day', 'election', 'red'].map((m) => [m, makeWalker({ radius: WORLD.radius, colliders: [...COLLIDERS, ...crowdColliders(m)], walls: WALLS, body: RICK })]));
const walkerFor = (mood) => walkers[mood] ?? walkers.day;
const pushCop = (x, z) => walkers.red.push(x, z, 0.45);
const MAP_SCALE = 150 / (WORLD.radius * 2 + 6);
const VOTERS = CAST.filter((c) => c.vote);
// Mortytown: its own walker (walled all round), its map, and where the lift
// leaves you on the concourse when you come back up (a step in from its
// doors, facing the core)
const townWalker = makeWalker({ radius: 500, colliders: TOWN_COLLIDERS, walls: TOWN_WALLS, body: RICK });
const TOWN_MAP = 150 / (MORTYTOWN.x1 - MORTYTOWN.x0 + 6);
const LIFT_AT = (() => {
  const sp = spot('mortytown');
  const r = Math.hypot(sp.x, sp.z);
  return { x: sp.x - (sp.x / r) * 1.6, z: sp.z - (sp.z / r) * 1.6, face: Math.atan2(sp.z, -sp.x) };
})();
const TOWN_PEOPLE = [...TOWN_CAST, ...TOWN_WALKS];
const LOCO_NAMES = { 'loco-a': 'The Loco with the face tattoo', 'loco-b': 'The Loco in the white T-shirt', 'loco-c': 'The Loco in the vest' };
// the Locos are out once their quest's open, and until it's done
const huntOpen = (p) => p.quests.some((q) => q.id === 'locos' && q.open && !q.done);
// Rick's emotes (lib/emote.js): hold B for the wheel, point and let go; tap it for the last again
const EMOTE_KEY = 'KeyB';
const isEmoteKey = (e) => e.code === EMOTE_KEY || (!e.code && (e.key === 'b' || e.key === 'B'));
const EMOTE_NAMES = { wave: 'Wave', cheer: 'Cheer', dance: 'Dance', taunt: 'Taunt', sit: 'Sit' };
const WHEEL_R = 112; // the wheel's reach on screen (px): the pointer this far out is a whole slice

// A line in its speaker's voice while it's up (lib/voiced.js), as useVoiced
// says it, except that its going stops only its own line: the bubbles and
// the toasts come and go on their own clocks, so neither cuts the other off
// (each waits its turn: lib/speech.js).
function useSaid(who, text) {
  useEffect(() => {
    if (!who || !text) return undefined;
    const said = sayVoiced(who, text);
    return () => said.stop();
  }, [who, text]);
}

// (`leaveLabel`: what the hangar's way out says; the page knows where it goes)
export default function CitadelWorld({ onLeave, leaveLabel = 'Back to C-137' }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return citadelProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = citadelProgress(done);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = citadelProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world citadel-world" aria-labelledby="citadel-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} gl={gl} setGl={setGl} onLeave={onLeave} leaveLabel={leaveLabel} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

// others online on the concourse (middleearth/towns/useTravellers), as Ricks from other dimensions
const ROOM = { bound: 160, motion: true };

function World({ prog, done, complete, gl, setGl, onLeave, leaveLabel }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const trav = useTravellers('citadel', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const map = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const saved = local.get(AT, null);
    // (left in Mortytown: back by the lift, and down it once the world's up)
    const down = saved?.where === 'mortytown' && moodOf(done) !== 'red';
    const h = newWalker(down ? LIFT_AT : validAt(saved, done));
    sim.current = { where: 'concourse', autoDown: down, townAt: down ? saved : null, hunt: newHunt(1), townSeen: false, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.32, dragAt: -1e9, mode: 'walk', room: null, beat: null, talking: null, talk: null, herd: calmHerd(), line: newLine(), laid: null, watchers: newWatchers(ROUNDS), chased: false, near: null, person: null, canvassed: new Set(), escapeT: null, frame: 0, moved: false, t: 0, air: null, siren: null, padBefore: null, edgeAt: -9, fresh: !saved && done.length === 0, seed: 2, emote: null, wheel: createEmoteWheel(), acted: false, cues: [], saying: null, lastFace: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [list, setList] = useState(false);
  // the emote wheel, as it's shown: open, and the slice pointed at
  const [wheel, setWheel] = useState({ open: false, hover: null });
  const wheelKey = useRef('');
  // the wardrobe: how Rick looks here (and Morty, wherever he turns up)
  const [looks, setLook] = useLooks();
  const looksRef = useRef(looks);
  looksRef.current = looks;
  const [wardrobe, setWardrobe] = useState(false);
  const wardrobeRef = useRef(wardrobe);
  wardrobeRef.current = wardrobe;
  const closeWardrobe = useCallback(() => setWardrobe(false), []);
  useEffect(() => {
    api.current?.setLooks?.(looks);
  }, [looks]);
  const lines = useRef({});
  const bubbleRef = useRef(null);
  const say = useCallback((text, bad = false) => setToast(typeof text === 'string' ? { text, bad, at: Date.now() } : { text: text.say, who: text.who, bad, at: Date.now() }), []); // a string, or a SHOUTS line (said in its Rick's voice)
  useSaid(toast?.who, toast?.text); // the Citadel's people, in Rick's voice where it's been made (lib/voiced.js)
  useSaid(bubble?.who, bubble?.line); // and whoever you're passing, in theirs (./voicelines.js)
  const timers = useRef(new Set());
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(() => {
    const all = timers.current;
    return () => {
      all.forEach(clearTimeout);
      all.clear();
    };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4600);
    return () => clearTimeout(t);
  }, [toast]);

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
      .then(({ createCitadelWorld }) => {
        if (dead || !canvas.current) return null;
        return createCitadelWorld(canvas.current, { onLost: () => !dead && setGl('lost'), looks: looksRef.current });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        a.tune?.(); // (behind ?debug: the shake's numbers)
        a.setLooks?.(looksRef.current); // (a look picked while it loaded)
        // (cue: something for the people to react to, as the world would say it: { type: 'seen', id } …)
        if (import.meta.env.DEV) window.__CITADEL__ = { api: a, sim: sim.current, complete, down: () => liftRef.current?.down(true), up: () => liftRef.current?.up(), cue: (c) => sim.current?.cues.push(c), emote: (id) => sim.current && (sim.current.emote = { id, at: sim.current.t }) }; // for the QA scripts
        fit();
        // everything on the graphics chip before it's shown, behind the loading screen
        await a.prepare?.(throttled(setPrep), { alive: () => !dead });
        if (dead) return;
        setGl('on');
        // left in Mortytown last time: back down the lift
        if (sim.current.autoDown) {
          sim.current.autoDown = false;
          liftRef.current?.down(true);
        }
        // a first visit: through the portal
        if (sim.current.fresh) {
          sim.current.fresh = false;
          a.fx('portal');
          sounds().then((x) => x.portal());
          clip('portalGun');
        }
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
      // out of a room (or the hangar) on to the concourse
      const at = s.mode === 'inside' ? (s.room === 'factory' ? FACTORY_DOOR : COUNCIL_DOOR) : s.mode === 'lift' ? LIFT_AT : s.h;
      local.set(AT, { x: at.x, z: at.z, face: at.face, where: s.mode === 'lift' ? 'concourse' : s.where });
      s.air?.stop();
      s.siren?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  // live: on, on screen, and not in a hidden tab (the hum and siren stop too)
  const showing = usePageVisible();
  const live = gl === 'on' && inView && showing;

  // the concourse's hum, while it's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.hum();
      s.air.inside(s.mode === 'inside' ? 1 : 0);
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);
  // and the siren on red alert
  const red = prog.mood === 'red';
  useEffect(() => {
    if (!live || !red) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop) return;
      s.siren = x.alarm();
    });
    return () => {
      stop = true;
      s.siren?.stop();
      s.siren = null;
    };
  }, [live, red]);

  // ── into and out of things ──
  const outside = useCallback((at) => {
    const s = sim.current;
    s.mode = 'walk';
    s.room = null;
    s.beat = null;
    s.talking = null;
    s.talk = null;
    s.h = newWalker(at);
    s.yaw = behindYaw(s.h.face);
    s.dragAt = s.t;
    s.air?.inside(0);
  }, []);

  const toRed = useCallback(() => {
    const s = sim.current;
    s.mode = 'walk';
    s.talking = null;
    s.talk = null;
    s.h = newWalker(ESCAPE_START);
    s.yaw = behindYaw(s.h.face);
    s.watchers = newWatchers(ROUNDS);
  }, []);

  // ── the lift down to Mortytown, and back up ──
  // (Mortytown is built the first time: the lift waits for it)
  const liftRef = useRef(null);
  const [townLoading, setTownLoading] = useState(false);
  const goDown = useCallback(
    async () => {
      const s = sim.current;
      const a = api.current;
      if (!a || s.where === 'mortytown' || s.mode === 'lift') return;
      if (progRef.current.mood === 'red') return say('The lift’s locked down on red alert.', true);
      if (s.herd.state === 'loose') return say('The Day Care’s Mortys are loose. Round them up first.', true);
      s.mode = 'lift';
      s.keys.clear();
      sounds().then((x) => x.doors());
      if (!a.townReady) setTownLoading(true);
      const ok = await a.enterTown();
      setTownLoading(false);
      const ss = sim.current;
      if (!ss || api.current !== a) return;
      if (!ok) {
        ss.mode = 'walk';
        return say('The lift’s stuck. Try it again in a bit.', true);
      }
      ss.where = 'mortytown';
      ss.mode = 'walk';
      // (back where you were down there, after a reload; else out of the lift)
      ss.h = newWalker(ss.townAt ? validTownAt(ss.townAt) : TOWN_START);
      ss.townAt = null;
      ss.yaw = behindYaw(ss.h.face);
      ss.dragAt = ss.t;
      if (ss.hunt.state === 'won') ss.hunt = newHunt(ss.seed++);
      a.fx('liftdown');
      if (!ss.townSeen) say(`Mortytown, under the city. No Ricks live down here: the Mortys run it.${huntOpen(progRef.current) ? ' Cop Morty’s outside Morty Mart, at the far end.' : ''}`);
      ss.townSeen = true;
      return undefined;
    },
    [say],
  );
  const goUp = useCallback(() => {
    const s = sim.current;
    const a = api.current;
    if (!a || s.where !== 'mortytown' || s.mode !== 'walk') return;
    const sent = leaveHunt(s.hunt);
    s.where = 'concourse';
    s.h = newWalker(LIFT_AT);
    s.yaw = behindYaw(s.h.face);
    s.dragAt = s.t;
    a.fx('liftup');
    sounds().then((x) => x.doors());
    if (sent.length) say(sent.length === 1 ? 'The Loco who was following you slinks back to his alley.' : 'The Locos who were following you slink back to their alleys.', true);
  }, [say]);
  liftRef.current = { down: goDown, up: goUp };

  const enter = useCallback(
    (id) => {
      const s = sim.current;
      const p = progRef.current;
      const has = (q) => doneRef.current.includes(q);
      audioContext();
      setList(false);
      s.acted = true; // (whatever he was striking, he's doing this now)
      if (id === 'mortytown') return goDown();
      if (id === 'up') return goUp();
      if (id === 'portal' || id === 'leave') {
        sounds().then((x) => x.portal());
        clip('portalGun');
        return onLeave?.();
      }
      if (id === 'daycare') {
        s.herd = newHerd(s.seed++);
        api.current?.fx('scatter');
        s.cues.push({ type: 'scatter' });
        sounds().then((x) => x.blip());
        say('The gate’s been left open, and six Mortys are loose. Walk at them and they run from you: herd them back through the gate.');
      } else if (id === 'factory') {
        s.mode = 'inside';
        s.room = 'factory';
        s.beat = has('wafers') ? 'floor' : 'line';
        s.line = newLine();
        s.air?.inside(1);
        sounds().then((x) => x.doors());
        if (!has('wafers')) say(SHOUTS.foreman);
      } else if (id === 'council') {
        s.mode = 'inside';
        s.room = 'council';
        s.beat = 'hearing';
        s.talking = 'council';
        s.talk = newTalk(CONVOS.council);
        s.air?.inside(1);
        sounds().then((x) => x.gavel());
      } else if (id === 'ballot') {
        if (s.canvassed.size < VOTERS.length) return say(`Hear out the voters first: ${s.canvassed.size} of ${VOTERS.length}. They’re about the concourse.`);
        s.mode = 'talk';
        s.talking = 'ballot';
        s.talk = newTalk(CONVOS.ballot);
        s.cues.push({ type: 'beat' }); // (“Vote Morty!”: the rally cheers him)
        // facing the booth, the camera over his shoulder
        s.h = { ...s.h, face: Math.atan2(-(BOOTH.z - s.h.z), BOOTH.x - s.h.x) };
        s.yaw = behindYaw(s.h.face);
      } else if (id === 'hangar') {
        if (p.mood !== 'red') return undefined;
        s.mode = 'escape';
        s.escapeT = 0;
        api.current?.fx('liftoff');
        sounds().then((x) => {
          x.doors();
          later(() => x.liftoff(), 1100);
        });
        clip('imIn');
        later(() => {
          const ss = sim.current;
          if (!ss || ss.mode !== 'escape') return;
          complete('citadelout');
          ss.escapeT = null;
          outside({ x: spot('hangar').x - 1.5, z: spot('hangar').z - 1.5, face: (Math.PI * 3) / 4 });
          say('The cruiser’s away, and the Citadel’s behind you. (Rick C-137 is still wanted. He’s fine with it.)');
        }, 4600);
      }
      return undefined;
    },
    [onLeave, say, later, complete, outside, goDown, goUp],
  );

  // a reply picked, or on to the next line
  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      s.acted = true;
      if (!s.talk.end) {
        // the count's in: the rally goes up
        if (s.talking === 'ballot' && s.talk.at === 'count') s.cues.push({ type: 'beat' });
        if (s.talking === 'council' && CONTEMPT.has(s.talk.at)) {
          api.current?.fx('contempt');
          sounds().then((x) => x.gavel());
        }
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      if (which === 'council') {
        complete('council');
        s.beat = 'dismissed';
        clip('riggity');
        later(() => {
          if (sim.current?.room === 'council') outside(COUNCIL_DOOR);
        }, 2600);
        say(SHOUTS.mutter);
      } else if (which === 'ballot') {
        complete('votemorty');
        api.current?.fx('vote');
        later(() => api.current?.fx('red'), 400);
        sounds().then((x) => x.chime());
        toRed();
        say(SHOUTS.win, true);
      }
      setHud((h) => ({ ...h, line: null }));
      return undefined;
    },
    [complete, later, outside, say, toRed],
  );

  const leaveRoom = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'inside' || s.room === 'council') return;
    sounds().then((x) => x.doors());
    outside(FACTORY_DOOR);
  }, [outside]);

  // walking out on the Council mid-hearing: back out through its doors,
  // the hearing still to come
  const leaveHearing = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'inside' || s.room !== 'council' || s.beat !== 'hearing') return;
    setHud((h) => ({ ...h, line: null }));
    sounds().then((x) => x.doors());
    outside(COUNCIL_DOOR);
    say('You walk out on the Council of Ricks. The guards let you go. They’ll hear you when you come back.');
  }, [outside, say]);

  // the line: drop the next layer
  const drop = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'inside' || s.room !== 'factory' || s.beat !== 'line') return;
    audioContext();
    const before = { w: s.line.w, cream: s.line.layer % 2 === 1 };
    // judged where the dispenser is now, not where the last frame left it
    const late = s.lineAt ? Math.min(0.1, Math.max(0, (performance.now() - s.lineAt) / 1000)) : 0;
    const events = dropLayer(s.line, late);
    let laid = null;
    for (const e of events) {
      if (e.type === 'layer') {
        laid = e;
        sounds().then((x) => x.clunk());
        api.current?.fx('layer', { x: e.x, y: 1.2 + e.layer * 0.12 });
      } else if (e.type === 'cut' && laid) {
        sounds().then((x) => x.cut());
        api.current?.fx('cut', { x: laid.x + e.side * (laid.w / 2 + e.w / 2), w: e.w, cream: laid.cream, side: e.side, y: 1.3 + laid.layer * 0.12 });
      } else if (e.type === 'spoilt') {
        sounds().then((x) => x.spoil());
        api.current?.fx('spoilt', { x: e.x, w: before.w, cream: before.cream });
        say('Missed. That wafer’s spoilt.', true);
      } else if (e.type === 'wafer' && !events.some((x) => x.type === 'good')) {
        say('Too thin. That one’s for the reject bin.', true);
      } else if (e.type === 'good') {
        api.current?.fx('good');
        s.cues.push({ type: 'good' }); // (the line's workers cheer it)
        sounds().then((x) => x.blip());
        const left = LINE.need - s.line.good;
        if (left > 0) say(`A good wafer. ${left} more.`);
      } else if (e.type === 'won') {
        sounds().then((x) => x.jingle());
        complete('wafers');
        say(SHOUTS.ad);
        later(() => {
          if (sim.current?.room === 'factory') sim.current.beat = 'floor';
        }, 2400);
      } else if (e.type === 'out') {
        say(SHOUTS.foremanBack, true);
        later(() => {
          const ss = sim.current;
          if (ss?.room === 'factory') ss.line = newLine();
        }, 1600);
      }
    }
  }, [complete, later, say]);

  // the walking keys: held while the world's live, by their place on the keyboard
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => !typing(e.target) && !wardrobeRef.current && keyDown(s.keys, e); // (not while the wardrobe's open over him)
    const up = (e) => keyUp(s.keys, e);
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
  }, [live]);

  // the emote key: hold B for the wheel and let go over what you want, or
  // tap it to strike the last again; 1 to 5 pick one while it's open, Esc
  // shuts it. Any other key he presses (but the walking keys) ends one.
  const pickEmote = useCallback((id) => {
    const s = sim.current;
    if (!id || s.mode !== 'walk') return;
    audioContext();
    s.emote = { id, at: s.t };
  }, []);
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || wardrobeRef.current) return;
      if (isEmoteKey(e)) {
        e.preventDefault();
        if (!e.repeat && s.mode === 'walk') s.wheel.down(s.t);
        return;
      }
      if (s.wheel.open) {
        if (/^[1-5]$/.test(e.key)) {
          e.preventDefault();
          pickEmote(s.wheel.choose(Number(e.key) - 1));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          s.wheel.cancel();
        }
        return;
      }
      // (the emote button's own Enter or Space strikes one, rather than ending it)
      if (!moveOf(e) && !e.target?.closest?.('.citadel-emote-chip, .citadel-wheel')) s.acted = true;
    };
    const up = (e) => {
      if (isEmoteKey(e)) pickEmote(s.wheel.up(s.t));
    };
    // pointing at a slice: from the middle of the view, where the wheel is
    const aim = (e) => {
      const r = s.wheel.open ? canvas.current?.getBoundingClientRect() : null;
      if (r) s.wheel.aim((e.clientX - (r.left + r.width / 2)) / WHEEL_R, (e.clientY - (r.top + r.height / 2)) / WHEEL_R);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointermove', aim);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('pointermove', aim);
      s.wheel.cancel();
    };
  }, [live, pickEmote]);
  // the HUD's emote button: a tap strikes the last again; held, the wheel opens and stays for a pick
  const emoteDown = (e) => {
    e.preventDefault();
    const s = sim.current;
    if (s.wheel.open) s.wheel.cancel();
    else if (s.mode === 'walk') s.wheel.down(s.t);
  };
  const emoteUp = () => {
    const s = sim.current;
    if (!s.wheel.open) pickEmote(s.wheel.up(s.t));
  };

  // keys
  const near = hud.near;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || wardrobeRef.current) return;
      const k = e.key;
      const onButton = e.target instanceof HTMLButtonElement;
      if (s.mode === 'walk') {
        if (moveOf(e)) {
          e.preventDefault();
          audioContext();
          return;
        }
        if ((k === 'e' || k === 'E' || k === 'Enter') && s.near && !onButton) {
          e.preventDefault();
          enter(s.near);
        } else if (k === 'm' || k === 'M') setList((v) => !v);
        else if (k === 'c' || k === 'C') {
          e.preventDefault();
          s.keys.clear();
          setWardrobe(true);
        }
        return;
      }
      if (s.talk) {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          talkOnward(Number(k) - 1);
        } else if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'E') && !onButton) {
          e.preventDefault();
          talkOnward();
        } else if (k === 'Escape' && s.mode === 'talk') {
          s.mode = 'walk';
          s.talking = null;
          s.talk = null;
        } else if (k === 'Escape') leaveHearing();
        return;
      }
      if (s.mode === 'inside') {
        if (s.beat === 'line' && k === ' ' && !e.repeat && !onButton) {
          e.preventDefault();
          drop();
        } else if (k === 'Escape') leaveRoom();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [live, near, enter, talkOnward, drop, leaveRoom, leaveHearing]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const raw = readPad();
    const before = s.padBefore ?? {};
    s.padBefore = raw ?? {};
    const pad = wardrobeRef.current ? null : raw; // (the wardrobe's open over him: the pad's for it)
    const pressed = (b) => pad?.[b] && !before[b];
    const red = p.mood === 'red';

    if (s.mode === 'walk') {
      let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
      let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
        if (pressed('a') && s.near) enter(s.near);
        if (pressed('y')) setList((v) => !v);
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = s.where === 'mortytown' ? townWalker.step(s.h, { x: mv.x, z: mv.z, run }, dt) : walkerFor(p.mood).step(s.h, { x: mv.x, z: mv.z, run }, dt, { closed: HANGAR_WALLS });
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // boxed in: the camera slides round to where there's room
      const room = a.suggestYaw;
      if (room != null && s.t - s.dragAt > 1.4) {
        let d = room - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 2.2);
        s.roomAt = s.t;
      }
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4 && s.t - (s.roomAt ?? -9) > 1.5) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
      // the rim: a word instead of a wall
      if (s.h.edge && s.t - s.edgeAt > 6) {
        s.edgeAt = s.t;
        say('The rest of the Citadel can wait. It has four hundred levels.');
      }
    }

    // Morty Day Care: the herd, loose or pottering in the pen
    const pushMorty = (x, z, r) => walkerFor(p.mood).push(x, z, r);
    // (not while Rick's in Mortytown: his spot there is in its own frame)
    for (const e of s.where === 'mortytown' ? [] : stepHerd(s.herd, s.h, dt, { push: pushMorty })) {
      if (e.type === 'penned') {
        const m = s.herd.mortys[e.id];
        a.fx('penned', { x: m.x, y: 1.6, z: m.z });
        s.cues.push({ type: 'penned', id: e.id });
        sounds().then((x) => x.blip());
        const n = s.herd.mortys.filter((mm) => mm.penned).length;
        if (n < HERD.count) say(`${n} of ${HERD.count} Mortys back in.`);
      } else if (e.type === 'won') {
        complete('daycare');
        sounds().then((x) => x.jingle());
        say(SHOUTS.daycareDone);
        s.cues.push({ type: 'herdwon' }, { type: 'won' });
      } else if (e.type === 'out' && stillHerding(s.h, s.mode === 'inside')) {
        say(SHOUTS.daycare, true);
        s.herd = newHerd(s.seed++);
        a.fx('scatter');
        s.cues.push({ type: 'herdout' }, { type: 'scatter' });
      } else if (e.type === 'out') {
        // left to it: the Day Care Rick calls them in and shuts the gate
        s.herd = calmHerd();
      }
    }

    // the line, swinging
    if (s.mode === 'inside' && s.room === 'factory' && s.beat === 'line') {
      stepLine(s.line, dt);
      s.lineAt = performance.now();
    }

    // the Cop Ricks, on red alert
    s.chased = false;
    if (red) {
      const ev = stepWatchers(s.watchers, s.h, dt, COPS, { colliders: COLLIDERS, walls: WALLS, ring: false, push: pushCop, active: s.mode === 'walk' });
      for (const e of ev) {
        if (e.type === 'seen') {
          a.fx('seen');
          say([SHOUTS.copSeen, SHOUTS.copFreeze, SHOUTS.copGot][e.id % 3], true);
          s.cues.push({ type: 'seen', id: e.id });
        } else if (e.type === 'caught') {
          a.fx('caught');
          say(SHOUTS.copGrab, true);
          s.cues.push({ type: 'caught', id: e.id });
          s.h = newWalker(ESCAPE_START);
          s.yaw = behindYaw(s.h.face);
          s.watchers = newWatchers(ROUNDS);
          break;
        } else if (e.type === 'lost') say(SHOUTS.copLost);
      }
      s.chased = s.watchers.list.some((w) => w.mode === 'alert' || w.mode === 'chase');
    }
    if (s.escapeT != null) s.escapeT += dt;

    // the Locos, down in Mortytown
    if (s.where === 'mortytown' && s.mode === 'walk' && huntOpen(p)) {
      const pushLoco = (x, z, r) => townWalker.push(x, z, r);
      for (const e of stepHunt(s.hunt, s.h, dt, { push: pushLoco })) {
        if (e.type === 'found') {
          const l = s.hunt.locos.find((x) => x.id === e.id);
          a.fx('found', { x: l.x, z: l.z });
          sounds().then((x) => x.blip());
          say(`${LOCO_NAMES[e.id]} gives himself up. Walk him to Cop Morty, outside Morty Mart. Don’t run.`);
        } else if (e.type === 'lost') say('Too quick for him: he’s slunk back to his alley. Walk, don’t run.', true);
        else if (e.type === 'delivered') {
          a.fx('delivered');
          sounds().then((x) => x.chime());
          const n = s.hunt.locos.filter((x) => x.state === 'delivered').length;
          if (n < HUNT.count) say(`Cop Morty cuffs him. ${n} of ${HUNT.count} Locos handed over.`);
        } else if (e.type === 'won') {
          a.fx('locos');
          sounds().then((x) => x.jingle());
          complete('locos');
          s.cues.push({ type: 'won' });
          say('All three Locos handed over. Cop Morty says Morty Mart’s safe. For tonight.');
        }
      }
    }

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk' && s.where === 'mortytown') spotHere = nearest([TOWN_EXIT], s.h.x, s.h.z) ? 'up' : null;
    else if (s.mode === 'walk') {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      const has = (q) => doneRef.current.includes(q);
      const ok =
        sp &&
        ((sp.id === 'daycare' && !has('daycare') && s.herd.state !== 'loose') ||
          sp.id === 'factory' ||
          (sp.id === 'council' && !has('council')) ||
          (sp.id === 'ballot' && p.mood === 'election') ||
          (sp.id === 'hangar' && ((red && !s.chased) || p.finished)) ||
          (sp.id === 'mortytown' && !red) ||
          sp.id === 'portal');
      spotHere = ok ? (sp.id === 'hangar' && p.finished ? 'leave' : sp.id) : null;
    }
    s.near = spotHere;
    let person = null;
    if (s.mode === 'walk' && s.where === 'mortytown') {
      // (Evil Rick walks the road: wherever he is now)
      const evil = a.townAt?.('evilrick');
      const c = nearest(evil ? [...TOWN_CAST, { id: 'evilrick', x: evil.x, z: evil.z }] : TOWN_CAST, s.h.x, s.h.z, 3);
      person = c ? `town:${c.id}` : null;
    } else if (s.mode === 'walk') {
      const c = nearest(castFor(p.mood), s.h.x, s.h.z, 3);
      person = c?.id ?? null;
    }
    if (person !== s.person) {
      s.person = person;
      if (person?.startsWith('town:')) {
        const c = TOWN_PEOPLE.find((x) => x.id === person.slice(5));
        const n = lines.current[person] ?? 0;
        lines.current[person] = n + 1;
        const line = c.lines[n % c.lines.length];
        setBubble({ id: person, name: c.name, line, who: voiceFor(c, line) });
        s.saying = { id: person, line }; // (its speaker talks with his hands while it's up)
      } else if (person) {
        const c = CAST.find((x) => x.id === person);
        let line;
        if (p.mood === 'election' && c.vote) {
          line = c.vote;
          if (!s.canvassed.has(c.id)) {
            s.canvassed.add(c.id);
            sounds().then((x) => x.blip());
          }
        } else {
          const n = lines.current[person] ?? 0;
          lines.current[person] = n + 1;
          line = c.lines[n % c.lines.length];
        }
        setBubble({ id: person, name: c.name, line, who: voiceFor(c, line) });
        s.saying = { id: person, line };
      } else {
        setBubble(null);
        s.saying = null;
      }
    }

    // Rick's emote: struck off the wheel (open when B's held), and over once
    // he moves (but for a wave, which he can walk on with) or does anything else
    if (s.mode !== 'walk' && s.wheel.open) s.wheel.cancel();
    const wh = s.wheel.tick(s.t);
    const wk = `${wh.open}|${wh.hover}`;
    if (wk !== wheelKey.current) {
      wheelKey.current = wk;
      setWheel({ open: wh.open, hover: wh.hover });
    }
    if (s.mode !== 'walk') s.acted = true;
    s.emote = keepEmote(s.emote, s.t, { moving: s.h.speed > 0.4, acted: s.acted });
    s.acted = false;
    // how he moves, for the others online (metres and radians a second)
    const turned = s.lastFace == null ? 0 : Math.atan2(Math.sin(s.h.face - s.lastFace), Math.cos(s.h.face - s.lastFace));
    s.lastFace = s.h.face;
    const fx = Math.cos(s.h.face);
    const fz = -Math.sin(s.h.face);
    const vx = s.h.vx ?? fx * s.h.speed;
    const vz = s.h.vz ?? fz * s.h.speed;
    const move = { speed: vx * fx + vz * fz, side: vx * -fz + vz * fx, turn: dt > 0 ? turned / dt : 0 };
    // the Council's line, or the ballot's: who says it
    const node = s.talk && s.talking ? talkNode(CONVOS[s.talking], s.talk) : null;
    const speech = node ? { who: node.who, at: s.talk.at ?? CONVOS[s.talking].start, line: node.say } : null;

    // the markers: where to go next
    const has = (q) => doneRef.current.includes(q);
    const locosOut = huntOpen(p) && !red;
    const following = s.hunt.locos.filter((l) => l.state === 'following').length;
    const handed = s.hunt.locos.filter((l) => l.state === 'delivered').length;
    const markers = s.where === 'mortytown'
      ? following
        ? [COP]
        : locosOut
          ? []
          : [TOWN_EXIT]
      : p.finished
      ? [spot('hangar'), spot('portal')]
      : red
        ? [spot('hangar')]
        : p.mood === 'election'
          ? s.canvassed.size < VOTERS.length
            ? VOTERS.filter((v) => !s.canvassed.has(v.id))
            : [spot('ballot')]
          : [...['daycare', 'factory', 'council'].filter((q) => !has(q)).map((q) => spot(q)), ...(locosOut ? [spot('mortytown')] : [])];

    // others online: where you are to them (out on the concourse), and where they are
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.mode === 'inside' || s.mode === 'escape' || s.mode === 'lift' || s.where === 'mortytown', emote: emotePacket(s.emote, s.t), move });

    try {
      a.render(
        {
          rick: s.h,
          where: s.where,
          locos: s.where === 'mortytown' && huntOpen(p) ? s.hunt.locos : null,
          travellers: tv ? tv.list() : null,
          mood: p.mood,
          mode: s.mode,
          room: s.room,
          beat: s.beat,
          mortys: s.herd.mortys,
          gateOpen: s.herd.state === 'loose',
          line: s.line,
          cops: red ? s.watchers.list : null,
          chased: s.chased,
          talking: s.talking,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 8 : 7,
          hangarOpen: s.mode === 'escape',
          escapeT: s.escapeT,
          debugCam: s.debugCam,
          // what the people show: who's talking to Rick, the line up, the
          // Council's or the ballot's speaker, Rick's emote, what's just happened
          person: s.person,
          saying: s.saying,
          speech,
          emote: s.emote ? { id: s.emote.id, at: s.emote.at, t: s.t - s.emote.at } : null,
          cues: s.cues,
        },
        ms * fast,
        fast,
      );
      s.cues = [];
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    // the HUD, when what it shows changes
    const penned = s.herd.mortys.filter((m) => m.penned).length;
    const key = [s.mode, s.room, s.near, s.moved, s.beat, s.talking, s.talk?.at, s.herd.state, penned, Math.ceil(HERD.time - s.herd.t), s.line.good, s.line.made, s.line.layer, s.chased, s.canvassed.size, s.where, following, handed].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ mode: s.mode, room: s.room, near: s.near, moved: s.moved, beat: s.beat, talking: s.talking, line: s.talk?.at ?? null, herd: { state: s.herd.state, penned, left: Math.max(0, Math.ceil(HERD.time - s.herd.t)) }, wafers: { good: s.line.good, made: s.line.made, layer: s.line.layer }, chased: s.chased, canvassed: s.canvassed.size, where: s.where, following, handed });
    }
    if (s.person && bubbleRef.current) {
      const at = s.person.startsWith('town:') ? a.screenOf('town', s.person.slice(5)) : a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) drawMap(map.current, s.where === 'mortytown' ? { scale: TOWN_MAP, h: s.h, markers, base: drawTown } : { scale: MAP_SCALE, h: s.h, markers, night: red, base: drawConcourse(p) });
    if (s.frame % 120 === 0 && s.mode === 'walk') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face, where: s.where });
  }, live);

  // the world's own pointer: drag to look round
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk') drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      return;
    }
    if (e.type === 'pointermove') {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      s.yaw -= (e.clientX - d.x) * 0.0065;
      s.pitch = Math.max(0.08, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };

  // the touch stick
  const onStick = (x, y) => (sim.current.stick = { x, y });

  // the list's "go there": straight to where each scene starts
  const travel = (q) => {
    const s = sim.current;
    const sp = spot({ daycare: 'daycare', wafers: 'factory', council: 'council', votemorty: 'ballot', citadelout: 'hangar', locos: 'mortytown' }[q.id]);
    // (from Mortytown: back up first; whoever was following goes home)
    if (s.where === 'mortytown') {
      leaveHunt(s.hunt);
      s.where = 'concourse';
    }
    // a step in from the spot, toward the core, facing out to it (its door)
    const r = Math.hypot(sp.x, sp.z);
    const at = q.id === 'citadelout' ? ESCAPE_START : { x: sp.x - (sp.x / r) * 1.5, z: sp.z - (sp.z / r) * 1.5, face: Math.atan2(-sp.z, sp.x) };
    s.h = newWalker(at);
    s.yaw = behindYaw(s.h.face);
    setList(false);
  };

  const here = hud.near === 'leave' ? { ...PROMPT.leave, act: leaveLabel } : hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const inside = mode === 'inside';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const herding = hud.herd?.state === 'loose';
  const inTown = hud.where === 'mortytown';
  const locosNow = huntOpen(prog);
  const townObjective = !locosNow ? (done.includes('locos') ? 'Mortytown’s quiet, for tonight. The lift up is at the west end.' : 'Mortytown. Cop Morty will have a job for you once the day care’s sorted. The lift up is at the west end.') : hud.following ? 'Walk them to Cop Morty, outside Morty Mart. At a walk: run, and they’ll slink off.' : 'Find the Locos. They hide where a Morty hides: down an alley, behind a bin.';
  const objective = inTown ? townObjective : red && hud.chased ? 'Run! Get out of his sight: round the core, behind a kiosk or a planter.' : herding ? 'Herd the Mortys back through the gate, into the pen: come at them from the far side.' : prog.objective;
  return (
    <div ref={box} className="shire-stage citadel-stage" data-touch={touch || undefined} data-mode={mode} data-mood={prog.mood} data-room={inside ? hud.room : undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="The Citadel of Ricks in 3D: a terrace over a city of pale green towers under a great dome, a column of green portal fluid at its middle, crowded with Ricks and Mortys, and Rick C-137 walking through it" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Opening a portal to the Citadel" />
      {townLoading && <p className="shire-loading">Taking the lift down to Mortytown…</p>}

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="citadel-title" className="shire-title">
              {inTown ? 'Mortytown' : 'The Citadel of Ricks'}
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">◆</span> {objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map" width="150" height="150" aria-hidden="true" />
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <button type="button" className="shire-chip" onClick={() => setWardrobe(true)} aria-haspopup="dialog">
              Wardrobe {!touch && <kbd>C</kbd>}
            </button>
            <button type="button" className="shire-chip citadel-emote-chip" onPointerDown={emoteDown} onPointerUp={emoteUp} onClick={(e) => e.detail === 0 && pickEmote(sim.current.wheel.choose(sim.current.wheel.last))} aria-haspopup="menu" aria-expanded={wheel.open} title={touch ? 'Tap to emote again; hold for the wheel' : 'Tap B to emote again; hold it for the wheel'}>
              Emote {!touch && <kbd>B</kbd>}
            </button>
            <OtherRicks trav={trav} />
            {herding && (
              <div className="shire-meter" role="meter" aria-label="Mortys back in the pen" aria-valuemin={0} aria-valuemax={HERD.count} aria-valuenow={hud.herd.penned}>
                <span className="shire-meter-label">Mortys</span>
                <span className="shire-meter-bar">
                  <span style={{ transform: `scaleX(${hud.herd.penned / HERD.count})` }} />
                </span>
                <span className="shire-meter-time">{hud.herd.left}s</span>
              </div>
            )}
            {prog.mood === 'election' && (
              <p className="shire-chip citadel-voters">
                Voters heard <b>{hud.canvassed ?? 0}</b> of {VOTERS.length}
              </p>
            )}
            {red && <p className="shire-chip citadel-wanted">{hud.chased ? 'Seen!' : 'Wanted: Rick C-137'}</p>}
            {inTown && locosNow && (
              <p className="shire-chip citadel-locos">
                Locos handed over <b>{hud.handed ?? 0}</b> of {HUNT.count}
                {hud.following ? ` · ${hud.following} following` : ''}
              </p>
            )}
          </div>
        </div>
      )}
      {!walking && <h1 id="citadel-title" className="sr-only">The Citadel of Ricks</h1>}

      {toast && (
        <p className="shire-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}

      {bubble && walking && <Bubble ref={bubbleRef} name={bubble.name} line={bubble.line} />}

      {walking && wheel.open && (
        <div className="citadel-wheel" role="menu" aria-label="Emotes">
          {EMOTES.map((id, i) => {
            const a = wheelAngle(i);
            return (
              <button key={id} type="button" role="menuitem" className="citadel-wheel-slice" data-hover={wheel.hover === id || undefined} style={{ transform: `translate(calc(${Math.round(Math.sin(a) * WHEEL_R)}px - 50%), calc(${Math.round(-Math.cos(a) * WHEEL_R)}px - 50%))` }} onPointerUp={(e) => e.stopPropagation()} onClick={() => pickEmote(sim.current.wheel.choose(id))}>
                {EMOTE_NAMES[id]} {!touch && <kbd>{i + 1}</kbd>}
              </button>
            );
          })}
        </div>
      )}

      {here && walking && (
        <div className="shire-door">
          <p className="shire-door-name">{here.name}</p>
          <button type="button" className="btn btn-primary" onClick={() => enter(hud.near)}>
            {!touch && <kbd className="key-first">E</kbd>} {here.act}
          </button>
        </div>
      )}

      {gl === 'on' && walking && !hud.moved && !here && <p className="shire-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list, B to emote.'}<GuideCue touch={touch} /></p>}

      {node && (mode === 'talk' || inside) && <Convo title={hud.talking === 'council' ? 'Before the Council of Ricks' : 'At Candidate Morty’s booth'} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} onLeave={hud.talking === 'council' && hud.beat === 'hearing' ? leaveHearing : null} />}

      {inside && hud.room === 'factory' && hud.beat === 'line' && (
        <div className="shire-panel citadel-line">
          <p className="shire-panel-title">Simple Rick’s line</p>
          <p className="shire-panel-stats">
            <span>
              Good wafers <b>{hud.wafers.good}</b> of {LINE.need}
            </span>
            <span>
              Wafers left <b>{Math.max(0, LINE.wafers - hud.wafers.made)}</b>
            </span>
          </p>
          <ol className="citadel-layers" aria-label="The layers of this wafer">
            {Array.from({ length: LINE.layers }, (_, i) => (
              <li key={i} data-laid={i < hud.wafers.layer || undefined} data-cream={i % 2 === 1 || undefined} />
            ))}
          </ol>
          <p className="shire-panel-help">{touch ? 'Tap Drop as the dispenser passes over the stack.' : 'Space (or Drop) as the dispenser passes over the stack.'}</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm citadel-drop" onPointerDown={(e) => (e.preventDefault(), drop())} onClick={(e) => e.detail === 0 && drop()} onContextMenu={(e) => e.preventDefault()}>
              Drop
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRoom}>
              Back to the concourse {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}
      {inside && hud.room === 'factory' && hud.beat === 'floor' && (
        <div className="shire-panel citadel-floor">
          <p className="shire-panel-title">Simple Rick’s</p>
          <p className="shire-panel-say">The line runs on without you. Somewhere under the floor, they say, Simple Rick is still dreaming of his daughter.</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRoom}>
              Back to the concourse {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}

      {walking && touch && <Stick onMove={onStick} />}

      <Wardrobe open={wardrobe} onClose={closeWardrobe} looks={looks} onLook={setLook} who="rick" />
      {list && <QuestList title="Things to do in the Citadel" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && (q.id !== 'citadelout' || red) && (q.id !== 'locos' || !red)} />}
    </div>
  );
}

// The concourse on the corner map: the floor, the core, the pen, the booth
// and the cover, the shopfronts' ring; red on red alert.
const drawConcourse = (prog) => (g, at) => {
  const red = prog.mood === 'red';
  g.fillStyle = red ? '#3a2228' : '#c9d3e2';
  g.beginPath();
  g.arc(...at(0, 0), WORLD.radius * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = red ? '#ff4a5a' : '#6ff3ff';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = red ? '#6a3a44' : '#8a9ab4';
  g.beginPath();
  g.arc(...at(CORE.x, CORE.z), CORE.r * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  // the pen
  g.strokeStyle = '#e8483c';
  g.lineWidth = 1.5;
  const [px, pz] = at(PEN.x - PEN.w / 2, PEN.z - PEN.d / 2);
  g.strokeRect(px, pz, PEN.w * MAP_SCALE, PEN.d * MAP_SCALE);
  // the cover
  g.fillStyle = red ? '#8a5a64' : '#6a7a94';
  for (const k of KIOSKS) {
    g.beginPath();
    g.arc(...at(k.x, k.z), 1.6 * MAP_SCALE, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = red ? '#5a7a5a' : '#4fae8a';
  for (const [x, z] of PLANTERS) {
    g.beginPath();
    g.arc(...at(x, z), 1.3 * MAP_SCALE, 0, Math.PI * 2);
    g.fill();
  }
  const [bx, bz] = at(BOOTH.x, BOOTH.z);
  g.fillStyle = prog.mood === 'day' ? '#7d8798' : '#c8262e';
  g.fillRect(bx - 2, bz - 2, 4, 4);
};

// Mortytown on the corner map: the street, its blocks dark either side
const drawTown = (g, at) => {
  const [x0, z0] = at(MORTYTOWN.x0, MORTYTOWN.z0);
  const [x1, z1] = at(MORTYTOWN.x1, MORTYTOWN.z1);
  g.fillStyle = '#4a5450';
  g.fillRect(x0, z0, x1 - x0, z1 - z0);
  g.fillStyle = '#8a8676';
  g.fillRect(x0, at(0, -10)[1], x1 - x0, at(0, 10)[1] - at(0, -10)[1]);
  g.fillStyle = '#3a4044';
  g.fillRect(x0, at(0, -6)[1], x1 - x0, at(0, 6)[1] - at(0, -6)[1]);
  for (const b of TOWN_BLOCKS) {
    const [bx, bz] = at(b.x - b.w / 2, b.z - b.d / 2);
    g.fillStyle = b.id === 'mortymart' ? '#8a3a3a' : b.id === 'creepymorty' ? '#6a3a7a' : '#2a3230';
    g.fillRect(bx, bz, b.w * TOWN_MAP, b.d * TOWN_MAP);
  }
  const [lx, lz] = at(TOWN_EXIT.x, TOWN_EXIT.z);
  g.fillStyle = '#6ff3ff';
  g.fillRect(lx - 3, lz - 3, 6, 6);
};

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="citadel-title" className="title">
        The Citadel of Ricks
      </h1>
      <p className="lead mt-4 max-w-[60ch]">A whole city of Ricks, and their Mortys, that you can walk about in 3D as Rick C-137. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the Citadel as cards.' : gl === 'failed' ? 'The 3D Citadel couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Citadel isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s the Citadel as cards.'}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : three.held ? 'Load the 3D' : 'Turn 3D on'}
          </button>
        </p>
      )}
      <ul className="shire-cards">
        {prog.quests.map((q) => (
          <li key={q.id} data-done={q.done || undefined}>
            <p className="shire-list-name">{q.name}</p>
            <p className="shire-list-sub">{q.where}</p>
            <p className="mt-2 text-sm text-muted">{q.blurb}</p>
            {q.done && <p className="mt-2 text-sm font-semibold">Done</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Others online on the concourse: how many, or a way to see them (going
// online is the site's own switch, with your callsign, as on the universe map).
function OtherRicks({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="shire-chip town-travellers" onClick={trav.join} title="Go online, and see everyone else on the concourse as a Rick from another dimension">
        See other Ricks
      </button>
    );
  return (
    <span className="shire-chip town-travellers" data-on title="Everyone else online on the concourse shows as a Rick from another dimension: they can’t touch your story, nor you theirs">
      <b>{trav.count}</b> {trav.count === 1 ? 'other Rick' : 'other Ricks'} here
    </span>
  );
}
