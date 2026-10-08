import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';
import { readPad, typing } from '../../../games/pad';
import { Bubble, Convo, QuestList, Stick, Travellers } from '../TownHud';
import { SideList } from '../SideList';
import { readSide, recordSide } from '../side';
import { useTravellers } from '../useTravellers';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { nearest } from '../story';
import { newTalk, talkNode, talkOn } from '../talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { newWatchers, stepWatchers } from '../watchers';
import { COLLIDERS, DECOY, GLADE, RUN_START, SEAT, SHORE_SPOT, SKIPPING, SPOTS, STAIR, START, STICKS, URUK_ROUNDS, WALLS, castFor, inLake, validAt } from './layout';
import { CONVOS, QUESTS, SAYS, SEAL, SIDE, SKIPPING_SAYS, SPEAKERS, amonHenProgress, stoneWord } from './story';
import { BOROMIR, RESCUE, SEAT_GAZE, SKIP, URUKS, gazeIn, gazeOn, newRescue, newSeat, newSkipping, newStone, newUnseen, newWood, pickStick, pressSkip, reach, samUp, stepRescue, stepSeat, stepSkipping, stepUnseen, stoneAt, strengthAt, tiltAt } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './amonhen.css';
import '../../../../styles/lazy/middleearth.css';
import GuideCue from '../../../guide/GuideCue';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Amon Hen, the seventh town on the road: the camp at Parth Galen,
// Boromir in the woods, the Seat of Seeing, the Uruk-hai, and Sam in the
// water. The places are in ./layout.js, the story in ./story.js, the
// games in ./rules.js, the drawing in ./scene.js; this is the walking, the
// HUD, the talk and the games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-amonhen-done';
const AT = 'tp-amonhen-at';
// ducks and drakes, on the side: { won, best } (best: the most skips)
const SIDE_KEY = 'tp-amonhen-side';
const sounds = () => import('./sounds');
const PROMPT = {
  seat: { name: 'The Seat of Seeing', act: 'Climb onto the Seat' },
  boats: { name: 'The boats', act: 'Push a boat out' },
  skipping: { name: 'Ducks and drakes', act: 'Skip stones' },
};
const walker = makeWalker({ radius: 400, colliders: COLLIDERS, walls: WALLS, blocked: inLake });
// Boromir, blundering round the glade after you
const BOROMIR_ROUND = [
  [GLADE.x + 3, GLADE.z + 2],
  [GLADE.x - 6, GLADE.z - 5],
  [GLADE.x - 14, GLADE.z - 6],
  [GLADE.x - 8, GLADE.z + 4],
];
const STAIR_FOOT = { x: STAIR.x0 + 1, z: STAIR.z };
// camera shots for the conversations: where from, and at what
const SHOTS = {
  boromir: { at: [GLADE.x + 5.5, 1.9, GLADE.z + 3.5], look: [GLADE.x - 1, 1.3, GLADE.z - 0.6] },
  sorry: { at: [STAIR.x0 + 6, 2.6, STAIR.z + 6], look: [GLADE.x - 6, 1, GLADE.z - 3] },
  seat: { seat: true },
  aragorn: { at: [SEAT.x + 6.5, 2.2, SEAT.z + 4.5], look: [SEAT.x + 2.6, 1.6, SEAT.z] },
  horn: { at: [SHORE_SPOT.x - 2, 2, SHORE_SPOT.z + 4], look: [10, 6, 0] },
};

export default function AmonHenWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return amonHenProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = amonHenProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = amonHenProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  // ducks and drakes, on the side: kept apart from the story's progress
  const [side, setSide] = useState(() => readSide(local.get(SIDE_KEY, null)));
  const recordGo = useCallback(
    (go) => {
      setSide((was) => {
        const { won, best } = recordSide(was, go);
        local.set(SIDE_KEY, { won, best });
        return { won, best };
      });
      if (go.won) unlock(SIDE.seal);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world amonhen-world" aria-labelledby="amonhen-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} complete={complete} side={side} recordGo={recordGo} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, complete, side, recordGo, gl, setGl, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const trav = useTravellers('amon-hen', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const at = validAt(local.get(AT, null));
    const h = newWalker(at);
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.34, dragAt: -1e9, mode: 'walk', talking: null, talk: null, near: null, person: null, frame: 0, moved: false, t: 0, stepT: 0, air: null, padBefore: null, wood: newWood(STICKS.length), ring: false, unseen: null, boro: null, seat: null, uruks: null, drawn: [], decoyed: false, rescue: null, busy: false, hold: false, paddle: 0, skip: null, said: null, saidAt: -9, cheer: 0 };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
  const needle = useRef(null);
  const power = useRef(null);
  const [toast, setToast] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [list, setList] = useState(false);
  const lines = useRef({});
  const bubbleRef = useRef(null);
  // a toast; and `who`, whose words are in it, says them (lib/voiced.js), or
  // says `line`, where only that much of it is theirs
  const say = useCallback((text, bad = false, who = null, line = text) => {
    setToast({ text, bad, at: Date.now() });
    if (who) sayVoiced(who, line);
  }, []);
  useEffect(() => stopVoiced, []);
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
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createAmonHenWorld }) => {
        if (dead || !canvas.current) return null;
        return createAmonHenWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__AMONHEN__ = { api: a, sim: sim.current, complete };
        fit();
        // everything on the graphics chip before it's shown, behind the loading screen
        await a.prepare?.(throttled(setPrep), { alive: () => !dead });
        if (!dead) setGl('on');
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
      if (s.mode === 'walk' && !s.ring) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;
  // the air: the woods, the lake lapping, the falls far off
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.air();
      s.air.ring(s.ring ? 1 : 0);
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);

  const startTalk = useCallback((id) => {
    const s = sim.current;
    s.mode = 'talk';
    s.talking = id;
    s.talk = newTalk(CONVOS[id]);
    s.stepT = 0;
  }, []);

  const startUnseen = useCallback(() => {
    const s = sim.current;
    s.mode = 'walk';
    s.ring = true;
    s.air?.ring(1);
    s.h = newWalker({ x: GLADE.x - 1.5, z: GLADE.z - 0.5, face: Math.PI });
    s.unseen = newUnseen();
    s.boro = newWatchers([BOROMIR_ROUND]);
    s.boro.list[0].x = GLADE.x + 1.2;
    s.boro.list[0].z = GLADE.z;
    s.busy = false;
    sounds().then((x) => x.ringOn());
  }, []);

  const startSeat = useCallback(() => {
    const s = sim.current;
    s.mode = 'seat';
    s.seat = newSeat();
    s.hold = false;
    s.busy = false;
  }, []);

  const startRun = useCallback(() => {
    const s = sim.current;
    s.mode = 'walk';
    s.ring = false;
    s.air?.ring(0);
    s.h = newWalker(RUN_START);
    s.yaw = behindYaw(RUN_START.face);
    s.uruks = newWatchers(URUK_ROUNDS);
    s.drawn = [];
    s.decoyed = false;
    s.busy = false;
  }, []);

  const startRescue = useCallback(() => {
    const s = sim.current;
    s.mode = 'rescue';
    s.rescue = newRescue();
    s.paddle = 0;
    s.busy = false;
    sounds().then((x) => x.splash(1));
    say('Behind you, Sam comes crashing down to the water and wades in after you. He can’t swim! Paddle back (hold W, or the button), and reach for his hand when he comes up (Space).', true);
  }, [say]);

  // ducks and drakes, with Merry and Pippin on the shore (and what they say
  // there, in their voices: ./voicelines.js)
  const skipSay = useCallback((line) => {
    const s = sim.current;
    s.said = line;
    s.saidAt = s.t;
    sayVoiced(line.who, line.say);
  }, []);
  const startSkipping = useCallback(() => {
    const s = sim.current;
    s.mode = 'skipping';
    s.skip = newSkipping(Math.floor(Math.random() * 1000) + 1);
    s.h = newWalker(SKIPPING);
    s.cheer = 0;
    skipSay(SKIPPING_SAYS.start);
    later(() => sim.current?.mode === 'skipping' && sim.current.skip?.throws === 0 && skipSay(SKIPPING_SAYS.merry), 4200);
  }, [later, skipSay]);
  const leaveSkipping = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'skipping') return;
    s.mode = 'walk';
    s.skip = null;
    s.h = newWalker({ x: SKIPPING.x - 1.5, z: SKIPPING.z, face: Math.PI });
    s.yaw = behindYaw(Math.PI);
    s.dragAt = s.t;
  }, []);
  // catch the tilt, then the strength
  const doSkip = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'skipping' || !s.skip) return;
    const r = pressSkip(s.skip);
    if (r === 'tilt') sounds().then((x) => x.snap());
    else if (r === 'throw') {
      s.cheer = 0;
      sounds().then((x) => x.whip());
    }
  }, []);
  const otherStone = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'skipping' || !s.skip || !newStone(s.skip)) return;
    const line = s.skip.flat > 0.9 ? SKIPPING_SAYS.flat : s.skip.flat < 0.7 ? SKIPPING_SAYS.lumpy : null;
    if (line) skipSay(line);
  }, [skipSay]);

  const enter = useCallback(
    (id) => {
      audioContext();
      if (id === 'seat') {
        const s = sim.current;
        s.h = newWalker({ x: SEAT.x, z: SEAT.z, face: 0 });
        startTalk('seat');
      } else if (id === 'boats') startRescue();
      else if (id === 'skipping') startSkipping();
      setList(false);
    },
    [startTalk, startRescue, startSkipping],
  );

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      if (!s.talk.end) {
        if (s.talking === 'boromir' && s.talk.at === 'ring') sounds().then((x) => x.ringOn());
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'boromir') {
        startUnseen();
        say('Get to the old stair up the hill, west. Walk softly: he hears you if you run near him. And the Ring is pulling.', true);
      } else if (which === 'sorry') {
        complete('boromir');
        s.mode = 'walk';
        s.unseen = null;
        s.boro = null;
        say('Up the stair to the Seat of Seeing, with the Ring still on.', false);
      } else if (which === 'seat') startSeat();
      else if (which === 'aragorn') {
        complete('seat');
        startRun();
        say('Uruk-hai in the woods. Get down to the boats on the lake, east, unseen. Keep the trees between you and them.', true);
      } else if (which === 'horn') {
        s.mode = 'walk';
        s.uruks = null;
        s.drawn = [];
        say('The boats are drawn up on the shore. Push one out.', false);
      } else if (which === 'promise') {
        complete('promise');
        s.rescue = null;
        s.mode = 'end';
      } else s.mode = 'walk';
      return undefined;
    },
    [complete, say, startRun, startSeat, startUnseen],
  );

  const doReach = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'rescue' || !s.rescue) return;
    const r = reach(s.rescue);
    if (r === 'got') {
      sounds().then((x) => x.splash(0.6));
      api.current?.fx('got');
      later(() => sim.current?.mode === 'rescue' && startTalk('promise'), 900);
    } else if (r === 'far') say('He’s too far off. Paddle back to him!', true);
    else if (r === 'under') say('Your hand closes on water. He’s under! Wait for him to come up.', true);
  }, [later, say, startTalk]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'rescue') return doReach();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doReach, enter]);

  // keys
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => !typing(e.target) && keyDown(s.keys, e);
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
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const onButton = ownButton(e, box.current);
      if (s.talk) {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          talkOnward(Number(k) - 1);
        } else if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'E') && !onButton) {
          e.preventDefault();
          talkOnward();
        }
        return;
      }
      if (moveOf(e) && s.mode !== 'end') {
        e.preventDefault();
        audioContext();
      }
      if (s.mode === 'skipping') {
        if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
          e.preventDefault();
          doSkip();
        } else if (k === 'f' || k === 'F') otherStone();
        else if (k === 'Escape') leaveSkipping();
        return;
      }
      if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
        if (s.mode === 'rescue' || (s.mode === 'walk' && s.near)) {
          e.preventDefault();
          doAct();
        } else if (s.mode === 'seat') e.preventDefault();
      } else if ((k === 'm' || k === 'M') && s.mode === 'walk' && !s.ring && !s.uruks) setList((v) => !v);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, talkOnward, doAct, doSkip, otherStone, leaveSkipping]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    s.stepT += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};
    if (pad && s.talk && pressed('a')) talkOnward(0);

    // walking
    if (s.mode === 'walk' && !s.busy) {
      let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
      let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
        if (pressed('a')) doAct();
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = walker.step(s.h, { x: mv.x, z: mv.z, run }, dt);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
    }

    // firewood
    if (s.mode === 'walk' && p.next === 'camp') {
      STICKS.forEach(([x, z], i) => {
        if (s.wood.got.includes(i) || Math.hypot(s.h.x - x, s.h.z - z) > 1.5) return;
        const r = pickStick(s.wood, i);
        sounds().then((x2) => x2.snap());
        if (r === 'all') {
          complete('camp');
          say(SAYS.alone.text, false, SAYS.alone.who);
        } else say(`Firewood: ${s.wood.got.length} of ${STICKS.length}.`);
      });
    }
    // Boromir finds you in the glade
    if (s.mode === 'walk' && p.next === 'boromir' && !s.unseen && Math.hypot(s.h.x - GLADE.x, s.h.z - GLADE.z) < GLADE.r - 1) {
      s.h = newWalker({ x: GLADE.x - 1.5, z: GLADE.z - 0.5, face: 0 });
      startTalk('boromir');
    }
    // getting away from him, unseen
    if (s.mode === 'walk' && s.unseen && s.boro && !s.busy) {
      for (const e of stepUnseen(s.unseen, dt, s.h, STAIR_FOOT)) {
        if (e.type === 'away') {
          s.boro.list[0].mode = 'patrol';
          startTalk('sorry');
        } else if (e.type === 'found') {
          s.busy = true;
          a.fx('eye');
          sounds().then((x) => x.eye());
          say('The Eye! It’s too much: the Ring comes off in your hand, and Boromir is on you. You wrench free and run back… Again: get to the stair, softly.', true);
          later(() => sim.current?.unseen && startUnseen(), 2000);
        }
      }
      for (const e of stepWatchers(s.boro, s.h, dt, BOROMIR, { colliders: COLLIDERS, walls: WALLS, ring: false, active: s.mode === 'walk' && !s.busy, push: (x, z) => walker.push(x, z, 0.5) })) {
        if (e.type === 'seen') {
          sounds().then((x) => x.boromir());
          say(SAYS.heard.text, true, SAYS.heard.who);
        } else if (e.type === 'caught') {
          s.busy = true;
          a.fx('grab');
          say('His hand closes on your cloak. You tear free, and he falls among the leaves… Again: softly, to the stair.', true);
          later(() => sim.current?.unseen && startUnseen(), 1800);
        }
      }
    }

    // the Seat: the Ring off before the Eye has you
    if (s.mode === 'seat' && s.seat && !s.busy) {
      const hold = s.hold || held('space') || held('down') || Boolean(pad?.a);
      for (const e of stepSeat(s.seat, dt, hold)) {
        if (e.type === 'gaze') {
          a.fx('gaze');
          sounds().then((x) => x.eye());
        } else if (e.type === 'off') {
          s.ring = false;
          s.air?.ring(0);
          s.busy = true;
          sounds().then((x) => x.ringOff());
          later(() => sim.current?.mode === 'seat' && startTalk('aragorn'), 1200);
        } else if (e.type === 'seen') {
          s.busy = true;
          a.fx('eye');
          say(SAYS.seen.text, true, SAYS.seen.who, SAYS.seen.line);
          later(() => sim.current?.mode === 'seat' && startSeat(), 2400);
        }
      }
    }

    // the Uruk-hai (straight into it, if you come back to it)
    if (s.mode === 'walk' && p.next === 'run' && !s.uruks) startRun();
    if (s.mode === 'walk' && s.uruks && !s.busy) {
      for (const e of stepWatchers(s.uruks, s.h, dt, URUKS, { colliders: COLLIDERS, walls: WALLS, ring: false, active: true, push: (x, z) => walker.push(x, z, 0.6) })) {
        if (e.type === 'seen') {
          sounds().then((x) => x.roar());
          say('An Uruk has seen you! Run, and break its sight behind the trees.', true);
        } else if (e.type === 'caught') {
          s.busy = true;
          a.fx('grab');
          sounds().then((x) => x.clash());
          say(SAYS.run.text, true, SAYS.run.who);
          later(() => sim.current?.uruks && startRun(), 2000);
        }
      }
      // Merry and Pippin draw them off
      if (!s.decoyed && Math.hypot(s.h.x - DECOY.x, s.h.z - DECOY.z) < DECOY.r) {
        s.decoyed = true;
        const near = [...s.uruks.list].sort((x, y) => Math.hypot(x.x - DECOY.x, x.z - DECOY.z) - Math.hypot(y.x - DECOY.x, y.z - DECOY.z)).slice(0, 2);
        s.drawn = near.map((w) => ({ x: w.x, z: w.z, face: w.face, t: 0 }));
        s.uruks.list = s.uruks.list.filter((w) => !near.includes(w));
        sounds().then((x) => x.shout());
        say(SAYS.decoy.text, true, SAYS.decoy.who);
        later(() => sounds().then((x) => x.horn()), 3500);
      }
      if (s.h.x > SHORE_SPOT.x - 6) {
        complete('run');
        startTalk('horn');
      }
    }

    // Sam in the water
    if (s.mode === 'rescue' && s.rescue && s.rescue.state === 'on') {
      const paddle = s.paddle > 0 || held('up') || s.stick.y < -0.5 || Boolean(pad?.rb);
      if (pad && pressed('a')) doReach();
      for (const e of stepRescue(s.rescue, dt, paddle)) {
        if (e.type === 'up') sounds().then((x) => x.splash(0.5));
      }
    }

    // ducks and drakes
    const sk = s.mode === 'skipping' ? s.skip : null;
    if (sk) {
      if (pad && pressed('a')) doSkip();
      for (const e of stepSkipping(sk, dt)) {
        if (e.type === 'touch') {
          const k = Math.max(0, 1 - e.i / 10);
          sounds().then((x) => x.skip(k, !e.skip));
          a.fx('splash', { d: e.d, k, sinks: !e.skip });
        } else if (e.type === 'sank') {
          const n = e.skips;
          const line = e.why === 'steep' ? SKIPPING_SAYS.steep : e.why === 'weak' ? SKIPPING_SAYS.weak : n > SKIP.pippin ? (side.best > SKIP.pippin && n <= side.best ? SKIPPING_SAYS.again(n) : SKIPPING_SAYS.beat(n)) : n === SKIP.pippin ? SKIPPING_SAYS.same : n > 3 ? SKIPPING_SAYS.fair(n) : SKIPPING_SAYS.few(n);
          skipSay(line);
          s.cheer = n > SKIP.pippin ? 2 : n >= 4 ? 1 : 0;
          if (s.cheer) sounds().then((x) => x.cheer());
          recordGo({ won: n > SKIP.pippin, score: n });
        }
      }
    }

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk' && !s.busy) {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      spotHere = sp && sp.quest === p.next ? sp.id : null;
      if (spotHere === 'boats' && s.uruks) spotHere = null;
      // and on the side, ducks and drakes, while the woods are quiet
      if (!spotHere && !s.ring && !s.uruks && p.next !== 'run' && Math.hypot(s.h.x - SKIPPING.x, s.h.z - SKIPPING.z) < 2.4) spotHere = 'skipping';
    }
    s.near = spotHere;
    let cast = castFor(p.next);
    // skipping stones, Merry and Pippin are down at the water with you
    if (sk) cast = cast.filter((c) => c.look !== 'merry' && c.look !== 'pippin');
    let person = null;
    if (s.mode === 'walk') person = nearest(cast, s.h.x, s.h.z, 2.8)?.id ?? null;
    if (person !== s.person) {
      s.person = person;
      if (person) {
        const c = cast.find((x) => x.id === person);
        const n = lines.current[person] ?? 0;
        lines.current[person] = n + 1;
        setBubble({ id: person, name: c.name, line: c.lines[n % c.lines.length] });
      } else setBubble(null);
    }
    // the two drawn off, running away after Merry and Pippin
    for (const d of s.drawn) d.t += dt;

    const markers = p.finished || s.uruks ? [] : p.next === 'camp' ? STICKS.filter((_, i) => !s.wood.got.includes(i)).map(([x, z]) => ({ x, z })) : p.next === 'boromir' ? [s.unseen ? STAIR_FOOT : GLADE] : SPOTS.filter((x) => x.quest === p.next);
    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: false, ring: s.ring });
    const st = s.seat;
    const r = s.rescue;
    try {
      a.render(
        {
          mode: s.mode,
          next: p.next,
          hobbit: s.h,
          travellers: tv ? tv.list() : null,
          cast: cast.map((c) => c.id),
          talk: s.person,
          talking: s.talking,
          speaker: node?.who ?? (sk && s.said && s.t - s.saidAt < 2.5 ? s.said.who : null),
          line: s.talk?.at ?? null,
          camShot: s.mode === 'talk' && SHOTS[s.talking] ? { id: s.talking, ...SHOTS[s.talking] } : null,
          ring: s.ring,
          pull: s.unseen?.pull ?? 0,
          sticks: s.wood.got,
          boromir: s.boro?.list?.[0] ?? (s.talking === 'boromir' ? { x: GLADE.x + 1.2, z: GLADE.z, face: Math.PI, mode: 'talk' } : null),
          seat: st ? { on: gazeOn(st), in: gazeIn(st), pulling: st.pulling / SEAT_GAZE.off, heat: st.heat, state: st.state } : null,
          onSeat: s.mode === 'seat' || (s.mode === 'talk' && (s.talking === 'seat' || s.talking === 'aragorn')),
          aragorn: s.mode === 'talk' && s.talking === 'aragorn',
          uruks: s.uruks?.list ?? null,
          drawn: s.drawn,
          decoyed: s.decoyed,
          rescue: r ? { gap: r.gap, up: samUp(r), t: r.t, got: r.state === 'got' } : null,
          promise: s.mode === 'talk' && s.talking === 'promise',
          skipping: sk ? { phase: sk.phase, thrown: sk.fly?.t ?? 0, touches: sk.fly?.touches ?? null, out: sk.fly ? (stoneAt(sk.fly.touches, sk.fly.t)?.d ?? sk.fly.touches.at(-1).d) : 0, cheer: s.cheer } : null,
          stepT: s.stepT,
          markers,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: s.uruks ? 8.5 : touch ? 7.2 : 6.4,
          debugCam: s.debugCam,
        },
        ms * fast,
        fast,
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    const key = [sk ? [sk.phase, sk.throws, sk.best, sk.flat.toFixed(2), s.said?.say].join(',') : '', s.mode, s.near, s.moved, s.talking, s.talk?.at, s.ring, s.unseen ? Math.round(s.unseen.pull * 40) : '', st ? Math.round(st.pulling * 20) : '', st ? gazeOn(st) : '', st?.heat, s.uruks?.list.some((w) => w.mode === 'chase' || w.mode === 'alert'), s.decoyed, r ? Math.round(r.gap * 4) : '', r ? samUp(r) : '', s.wood.got.length, p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, ring: s.ring, pull: s.unseen?.pull ?? null, seat: st ? { on: gazeOn(st), pulling: st.pulling / SEAT_GAZE.off, heat: st.heat } : null, hunted: Boolean(s.uruks?.list.some((w) => w.mode === 'chase' || w.mode === 'alert')), running: Boolean(s.uruks), rescue: r ? { gap: r.gap, up: samUp(r) } : null, sticks: s.wood.got.length, skip: sk ? { phase: sk.phase, flat: sk.flat, throws: sk.throws, best: sk.best, last: sk.last, tilt: sk.tilt, strength: sk.strength, say: s.said } : null });
    }
    // the needle and the strength move every frame, so they're set here
    if (sk && needle.current) {
      const tilt = sk.phase === 'tilt' ? tiltAt(sk.clock) : sk.tilt;
      const strength = sk.phase === 'strength' ? strengthAt(sk.clock) : sk.phase === 'tilt' ? 0 : sk.strength;
      needle.current.style.left = `${(tilt / SKIP.steep) * 100}%`;
      if (power.current) power.current.style.transform = `scaleX(${strength})`;
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && !s.ring && !s.uruks) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // look round by dragging; the stick on touch
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk') drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      // skipping stones, a tap on the water is a press
      else if (s.mode === 'skipping') doSkip();
      return;
    }
    if (e.type === 'pointermove') {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      s.yaw -= (e.clientX - d.x) * 0.0065;
      s.pitch = Math.max(0.1, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };
  const onStick = (x, y) => (sim.current.stick = { x, y });
  const hold = (name, v) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      sim.current[name] = v;
      audioContext();
    },
    onPointerUp: () => (sim.current[name] = 0),
    onPointerCancel: () => (sim.current[name] = 0),
    onLostPointerCapture: () => (sim.current[name] = 0),
    onContextMenu: (e) => e.preventDefault(),
  });
  const travel = (q) => {
    const s = sim.current;
    const at = q.id === 'camp' ? START : q.id === 'boromir' ? { x: GLADE.x + 10, z: GLADE.z + 2, face: Math.PI } : q.id === 'seat' ? { x: STAIR.x0 + 3, z: STAIR.z, face: Math.PI } : q.id === 'promise' ? { x: SHORE_SPOT.x - 3, z: SHORE_SPOT.z, face: 0 } : null;
    if (!at) return;
    if (q.id === 'run') return;
    s.h = newWalker(at);
    s.yaw = behindYaw(at.face);
    setList(false);
  };
  const stay = () => {
    const s = sim.current;
    s.mode = 'walk';
    s.h = newWalker({ x: SHORE_SPOT.x - 4, z: SHORE_SPOT.z, face: Math.PI });
    s.yaw = behindYaw(Math.PI);
  };

  const sideTask = { ...SIDE, open: prog.next !== 'run', done: side.won, best: side.best != null ? `Your best: ${side.best} ${side.best === 1 ? 'skip' : 'skips'}. Pippin’s: ${SKIP.pippin}.` : null };
  const goSide = () => {
    const s = sim.current;
    s.h = newWalker({ x: SKIPPING.x - 3, z: SKIPPING.z, face: 0 });
    s.yaw = behindYaw(0);
    setList(false);
  };
  const here = hud.near ? PROMPT[hud.near] : null;
  const K = hud.mode === 'skipping' ? hud.skip : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const objective = hud.ring && hud.pull != null ? 'Get away from Boromir to the old stair, west. Walk softly.' : hud.ring ? 'Up the stair to the Seat of Seeing.' : hud.running ? 'Down through the woods to the boats on the lake, east. Stay unseen.' : prog.next === 'camp' ? `Firewood from the edge of the trees: ${hud.sticks ?? 0} of ${STICKS.length}.` : prog.objective;
  return (
    <div ref={box} className="shire-stage amonhen-stage" data-touch={touch || undefined} data-mode={mode} data-ring={hud.ring || undefined} data-game={['seat', 'rescue', 'skipping'].includes(mode) || hud.ring || hud.running || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Amon Hen in 3D: the lawn of Parth Galen by the lake, the woods and the old kings' statues, and the Seat of Seeing on the summit" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Down the river to Parth Galen" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="amonhen-title" className="shire-title">
              Amon Hen
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {objective}
            </p>
          </div>
          <div className="shire-side">
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{prog.done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <Travellers trav={trav} />
          </div>
        </div>
      )}
      {!walking && (
        <h1 id="amonhen-title" className="sr-only">
          Amon Hen
        </h1>
      )}

      {toast && (
        <p className="shire-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}
      {bubble && walking && <Bubble ref={bubbleRef} who={bubble.id} name={bubble.name} line={bubble.line} />}
      {here && walking && (
        <div className="shire-door">
          <p className="shire-door-name">{here.name}</p>
          <button type="button" className="btn btn-primary" onClick={() => enter(hud.near)}>
            {!touch && <kbd className="key-first">E</kbd>} {here.act}
          </button>
        </div>
      )}
      {gl === 'on' && walking && !hud.moved && !here && <p className="shire-hint">{touch ? 'Drag the stick to walk. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}<GuideCue touch={touch} /></p>}

      {node && <Convo title="Amon Hen" name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {walking && hud.ring && hud.pull != null && (
        <div className="shire-panel amonhen-game" role="group" aria-label="The Ring">
          <p className="shire-panel-title">The Ring is on</p>
          <div className="shire-meter" role="meter" aria-label="The Ring’s pull" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.pull * 100)}>
            <span className="shire-meter-label">The Eye</span>
            <span className="shire-meter-bar amonhen-meter-eye">
              <span style={{ transform: `scaleX(${Math.min(1, hud.pull)})` }} />
            </span>
          </div>
          <p className="shire-panel-help">Walk: running pulls the Ring harder, and he hears it.</p>
        </div>
      )}
      {walking && hud.running && (
        <div className="shire-panel amonhen-game" role="group" aria-label="The Uruk-hai" data-hunted={hud.hunted || undefined}>
          <p className="shire-panel-title">{hud.hunted ? 'An Uruk has seen you!' : 'The Uruk-hai are in the woods'}</p>
          <p className="shire-panel-help">Down to the lake, east. Keep the trees between you and them.</p>
        </div>
      )}
      {mode === 'seat' && hud.seat && (
        <div className="shire-panel amonhen-game" role="group" aria-label="The Seat of Seeing" data-gaze={hud.seat.on || undefined}>
          <p className="shire-panel-title">{hud.seat.on ? 'The Eye is on you!' : 'Get the Ring off!'}</p>
          <div className="shire-meter" role="meter" aria-label="The Ring coming off" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.seat.pulling * 100)}>
            <span className="shire-meter-label">Off</span>
            <span className="shire-meter-bar amonhen-meter-off">
              <span style={{ transform: `scaleX(${Math.min(1, hud.seat.pulling)})` }} />
            </span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Found you <b>{hud.seat.heat}</b> of {SEAT_GAZE.passes}
            </span>
          </p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm amonhen-big" {...hold('hold', true)}>
              Pull it off {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'rescue' && hud.rescue && (
        <div className="shire-panel amonhen-game" role="group" aria-label="Sam in the water" data-up={hud.rescue.up || undefined}>
          <p className="shire-panel-title">{hud.rescue.up ? 'He’s up! Grab him!' : 'Sam’s under…'}</p>
          <div className="shire-meter" role="meter" aria-label="How far off he is" aria-valuemin={0} aria-valuemax={RESCUE.gap} aria-valuenow={Math.round(hud.rescue.gap)}>
            <span className="shire-meter-label">To Sam</span>
            <span className="shire-meter-bar amonhen-meter-near">
              <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, 1 - (hud.rescue.gap - RESCUE.near) / (RESCUE.gap - RESCUE.near)))})` }} />
            </span>
          </div>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm amonhen-big" {...hold('paddle', 1)}>
              Paddle back {!touch && <kbd>W</kbd>}
            </button>
            <button type="button" className="btn btn-primary btn-sm amonhen-big" onPointerDown={(e) => (e.preventDefault(), doReach())}>
              Reach! {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {K && (
        <div className="shire-panel amonhen-game amonhen-skipping" role="group" aria-label="Ducks and drakes" data-cheer={K.last?.better && K.phase === 'done' ? true : undefined}>
          <p className="shire-panel-title">Ducks and drakes</p>
          {K.say && (
            <p className="shire-panel-say" aria-live="polite">
              <b>{SPEAKERS[K.say.who]}:</b> {K.say.say}
            </p>
          )}
          <div className="shire-meter amonhen-tilt-meter" role="img" aria-label={K.phase === 'tilt' ? 'The tilt, swinging from flat to steep' : `The tilt: ${Math.round(K.tilt)} degrees`}>
            <span className="shire-meter-label">Tilt</span>
            <span className="amonhen-tilt">
              <span className="amonhen-tilt-best" style={{ left: `${((SKIP.best - 4) / SKIP.steep) * 100}%`, width: `${(8 / SKIP.steep) * 100}%` }} />
              <span className="amonhen-tilt-steep" style={{ left: `${(SKIP.sink / SKIP.steep) * 100}%` }} />
              <i ref={needle} />
            </span>
          </div>
          <div className="shire-meter" role="img" aria-label="The strength">
            <span className="shire-meter-label">Strength</span>
            <span className="shire-meter-bar amonhen-meter-throw">
              <span ref={power} />
            </span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Stone: <b>{stoneWord(K.flat)}</b>
            </span>
            <span>
              Skips <b>{K.last && K.phase === 'done' ? K.last.skips : '–'}</b>
            </span>
            <span>
              Best <b>{Math.max(K.best, side.best ?? 0)}</b> · Pippin <b>{SKIP.pippin}</b>
            </span>
          </p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm amonhen-big" disabled={K.phase !== 'tilt' && K.phase !== 'strength'} onPointerDown={(e) => (e.preventDefault(), doSkip())} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), doSkip())}>
              {K.phase === 'strength' ? 'Throw!' : 'Set the tilt'} {!touch && <kbd>Space</kbd>}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={K.phase !== 'tilt' && K.phase !== 'strength'} onClick={otherStone}>
              Another stone {!touch && <kbd>F</kbd>}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveSkipping}>
              Stop {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
          <p className="shire-panel-help">{touch ? 'Tap once to catch the tilt low (in the green), then again to throw at the top of the strength.' : 'Space once to catch the tilt low (in the green), then again to throw at the top of the strength.'}</p>
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel amonhen-end" role="dialog" aria-label="Across the lake">
          <p className="shire-panel-title">The Fellowship is broken</p>
          <p className="shire-panel-say">Frodo and Sam cross Nen Hithoel alone, into the Emyn Muil, a maze of razor-sharp rock. Behind them, Aragorn, Legolas and Gimli set off after the Uruk-hai who took Merry and Pippin. Ahead: the Dead Marshes, and something following in the dark.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to the Dead Marshes
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay at Amon Hen
            </button>
          </div>
        </div>
      )}
      {walking && touch && <Stick onMove={onStick} />}
      {list && (
        <QuestList title="Things to do at Amon Hen" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && q.id !== 'run' && sim.current.mode === 'walk' && !sim.current.ring && !sim.current.uruks}>
          <SideList tasks={[sideTask]} onGo={goSide} canGo={(t) => t.open && sim.current.mode === 'walk' && !sim.current.ring && !sim.current.uruks} />
        </QuestList>
      )}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="amonhen-title" className="title">
        Amon Hen
      </h1>
      <p className="lead mt-4 max-w-[60ch]">Parth Galen and the hill of Amon Hen, where the Fellowship breaks, to walk through in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s Amon Hen as cards.' : gl === 'failed' ? 'The 3D Amon Hen couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Amon Hen isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s Amon Hen as cards.'}
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
