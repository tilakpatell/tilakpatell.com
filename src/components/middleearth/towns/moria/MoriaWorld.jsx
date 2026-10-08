import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';
import { readPad, typing } from '../../../games/pad';
import { Bubble, Convo, QuestList, Stick, Travellers } from '../TownHud';
import { useTravellers } from '../useTravellers';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { nearest } from '../story';
import { newTalk, talkNode, talkOn } from '../talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { newWatchers, stepWatchers } from '../watchers';
import { followAt, lead, newParty } from '../rivendell/rules';
import { CHAMBER, CHAMBER_DOOR_WALL, COMPANY, DASH_START, DOOR_WALL, FLIGHT, FORK, GATE, GATE_COLLIDERS, GATE_WALLS, HALL, HALL_COLLIDERS, HALL_START, HALL_WALLS, SHAFT, SPOTS, TOMB, TROLL_FRODO, TROLL_ROUNDS, TROLL_ZONE, WELL, castFor, inLake, validAt, wayAt } from './layout';
import { CONVOS, QUESTS, SAYS, SEAL, SPEAKERS, moriaProgress } from './story';
import { FLY, PLANK, SIDE, TROLL, WATCHER, grab, newDash, newFlight, newPlank, newTumble, stepDash, stepFlight, stepPlank, stepTumble } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './moria.css';
import '../../../../styles/lazy/middleearth.css';
import GuideCue from '../../../guide/GuideCue';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Moria, the fifth town on the road: the Doors of Durin by moonlight, the
// long dark, Balin's tomb, the cave troll, and the Bridge of Khazad-dûm.
// The places are in ./layout.js, the story in ./story.js, the games in
// ./rules.js, the drawing in ./scene.js; this is the walking, the HUD, the
// talk and the games, and on the side the plank over the old shaft, which
// the story never waits on. Without 3D, the scenes are listed as cards.

const DONE = 'tp-moria-done';
const SIDE_DONE = 'tp-moria-side'; // kept apart, so the story's count stays the story's
const AT = 'tp-moria-at';
const sounds = () => import('./sounds');
const PROMPT = {
  doors: { name: 'The Doors of Durin', act: 'Look at the Doors' },
  tomb: { name: 'The Chamber of Mazarbul', act: 'Go in' },
  east: { name: 'The east door', act: 'Run!' },
  plank: { name: 'An old shaft, and a plank', act: 'Fetch Gandalf’s pipe' },
};
const walkers = {
  gate: makeWalker({ radius: 400, colliders: GATE_COLLIDERS, walls: GATE_WALLS, blocked: inLake }),
  halls: makeWalker({ radius: 400, colliders: HALL_COLLIDERS, walls: HALL_WALLS }),
};
// the troll, kept out of the columns and the tomb, and in the chamber
const trollPush = (x, z) => {
  const [px, pz] = walkers.halls.push(x, z, 0.6, CHAMBER_DOOR_WALL);
  return [Math.max(TROLL_ZONE.x0 + 1, Math.min(TROLL_ZONE.x1 - 1, px)), Math.max(TROLL_ZONE.z0 + 1, Math.min(TROLL_ZONE.z1 - 1, pz))];
};
const DOOR_AT = { x: 0, z: GATE.cliff + 0.6 };
// the Fellowship's trail, laid out behind you as if they'd walked in after you
function trailBehind(h) {
  const p = newParty();
  for (let d = 16; d >= 0; d -= 0.3) lead(p, h.x - Math.cos(h.face) * d, h.z + Math.sin(h.face) * d);
  return p;
}
// camera shots for the conversations, in the place's own coordinates
const SHOTS = {
  doors: { at: [1.2, 2.6, GATE.cliff + 9], look: [0, 3.2, GATE.cliff] },
  fork: { at: [FORK.x - 9, 2.6, 4], look: [FORK.x, 1.6, 0] },
  light: { at: [-HALL.w / 2 + 3, 2.6, 9], look: [8, 10, -5] },
  tomb: { at: [CHAMBER.x + 3.4, 2.6, CHAMBER.z + 5.8], look: [TOMB.x, 1, TOMB.z] },
  fool: { at: [WELL.x - 3.2, 2.4, WELL.z + 3.2], look: [WELL.x, 0.6, WELL.z] },
  troll: { at: [CHAMBER.x + 0.5, 3.2, -HALL.d / 2 + 3], look: [CHAMBER.x, 1.4, CHAMBER.z] },
  mithril: { at: [TROLL_FRODO.x - 2.6, 1.8, TROLL_FRODO.z + 2.2], look: [TROLL_FRODO.x, 0.6, TROLL_FRODO.z] },
};
// where the others fight while the troll hunts you
const FIGHT = [
  [CHAMBER.x - 5.5, CHAMBER.z + 4.8],
  [CHAMBER.x + 2.2, CHAMBER.z + 5.6],
  [CHAMBER.x - 3, CHAMBER.z - 5.6],
  [TOMB.x - 2.2, TOMB.z + 0.4],
  [CHAMBER.x + 5, CHAMBER.z + 5],
  [CHAMBER.x - 6.6, CHAMBER.z - 1],
  [CHAMBER.x - 2.5, CHAMBER.z + 2.6],
  [CHAMBER.x + 3, CHAMBER.z - 5.8],
];

export default function MoriaWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return moriaProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = moriaProgress(done);
  const [side, setSide] = useState(() => {
    const d = local.get(SIDE_DONE, []);
    return Array.isArray(d) && d.includes(SIDE.id);
  });
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  // the pipe, fetched: on the side, with its own seal but none on the map
  const winSide = useCallback(() => {
    setSide(true);
    local.set(SIDE_DONE, [SIDE.id]);
    unlock(SIDE.seal);
  }, [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = moriaProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world moria-world" aria-labelledby="moria-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} side={side} winSide={winSide} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} side={side} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, done, complete, side, winSide, gl, setGl, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const trav = useTravellers('moria', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const at = validAt(local.get(AT, null), done);
    const h = newWalker(at);
    sim.current = { zone: at.zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.36, dragAt: -1e9, mode: 'walk', talking: null, talk: null, near: null, person: null, frame: 0, moved: false, t: 0, stepT: 0, air: null, padBefore: null, ithildin: false, doorsOpen: done.includes('doors'), dash: null, held: 0, forkTold: false, revealing: false, tumble: null, troll: null, trollT: 0, flight: null, fallen: 0, whip: 0, party: trailBehind(h), busy: false, steer: 0, jump: false, deadEnd: -1, plank: null, plankWalk: 0, plankLean: 0 };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
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
    const t = setTimeout(() => setToast(null), 5000);
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
      .then(({ createMoriaWorld }) => {
        if (dead || !canvas.current) return null;
        return createMoriaWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__MORIA__ = { api: a, sim: sim.current, complete };
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
      if (s.mode === 'walk') local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;
  // the air of the place: the lake and the wind outside, the deep's hum inside
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.air();
      s.air.inside(s.zone === 'gate' ? 0 : 1);
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
    if (id === 'doors') s.ithildin = true;
  }, []);

  const toHalls = useCallback(() => {
    const s = sim.current;
    s.zone = 'halls';
    s.h = newWalker(HALL_START);
    s.yaw = behindYaw(HALL_START.face);
    s.party = trailBehind(s.h);
    s.gandalf = null;
    s.air?.inside(1);
  }, []);

  const startDash = useCallback(() => {
    const s = sim.current;
    s.mode = 'dash';
    s.h = newWalker(DASH_START);
    s.dash = newDash(Math.floor(Math.random() * 1000) + 1);
    s.held = 0;
    sounds().then((x) => x.rise());
    say('The water stirs. Something long and pale comes up out of the lake. Run for the Doors!', true);
  }, [say]);

  const startTroll = useCallback(() => {
    const s = sim.current;
    s.mode = 'troll';
    s.h = newWalker(TROLL_FRODO);
    s.yaw = behindYaw(TROLL_FRODO.face);
    s.troll = newWatchers(TROLL_ROUNDS);
    s.trollT = 0;
    s.busy = false;
    api.current?.fx('troll');
    sounds().then((x) => x.roar());
    say('The doors burst in, and the troll ducks through after the goblins. Keep out of its sight: behind the columns, behind the tomb.', true);
  }, [say]);

  const startFlight = useCallback(() => {
    const s = sim.current;
    s.zone = 'flight';
    s.mode = 'flight';
    s.flight = newFlight();
    s.busy = false;
    s.fallen = 0;
    s.air?.inside(1);
    sounds().then((x) => x.drums());
    say('Down the stair! Steer clear of the falling stone, and leap where it’s broken (Space).', true);
  }, [say]);

  const enter = useCallback(
    (id) => {
      audioContext();
      const s = sim.current;
      if (id === 'doors') startTalk('doors');
      else if (id === 'tomb') {
        s.h = newWalker({ x: TOMB.x - 1.2, z: TOMB.z + 3.2, face: Math.PI / 2 });
        startTalk('tomb');
      } else if (id === 'east') startFlight();
      else if (id === 'plank') {
        // on the side: out along the plank over the old shaft
        s.mode = 'plank';
        s.plank = newPlank(Math.floor(Math.random() * 1e6) + 1);
        s.h = newWalker({ x: SHAFT.x - PLANK.half - 0.15, z: SHAFT.z, face: 0 });
        sounds().then((x) => x.creak?.());
        say('Gandalf’s pipe, out on the plank over the middle. Walk out (W or ↑) and back, and lean against the sway (A and D).');
      }
      setList(false);
    },
    [startTalk, startFlight, say],
  );
  // off the plank, back on the floor of the hall at its west end
  const leavePlank = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'plank') return;
    s.mode = 'walk';
    s.plank = null;
    s.plankWalk = 0;
    s.plankLean = 0;
    s.h = newWalker({ x: SHAFT.x - SHAFT.plank / 2 - 0.6, z: SHAFT.z, face: Math.PI });
    s.yaw = behindYaw(s.h.face);
    s.dragAt = s.t;
  }, []);

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      if (!s.talk.end) {
        const at = s.talk.at;
        if (s.talking === 'bridge' && at === 'falls') {
          s.fallen = 0.001;
          api.current?.fx('break');
          sounds().then((x) => x.crack());
        }
        if (s.talking === 'bridge' && at === 'fly') s.whip = 1;
        return setHud((h) => ({ ...h, line: at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'doors') {
        s.doorsOpen = true;
        sounds().then((x) => x.grind());
        s.mode = 'walk';
        later(() => sim.current?.mode === 'walk' && startDash(), 1600);
      } else if (which === 'fork') {
        s.mode = 'walk';
        s.forkTold = true;
      } else if (which === 'light') {
        s.mode = 'walk';
        s.revealing = false;
        complete('dark');
        // (said a moment after, once the conversation closing has stopped its own line)
        say(SAYS.balin.text);
        later(() => sayVoiced(SAYS.balin.who, SAYS.balin.text), 150);
      } else if (which === 'tomb') {
        s.mode = 'tumble';
        s.tumble = newTumble();
        say('Catch it! Grab each piece as it falls (Space or E).', true);
      } else if (which === 'fool') {
        complete('tomb');
        later(() => sim.current && startTalk('troll'), 600);
      } else if (which === 'troll') startTroll();
      else if (which === 'mithril') {
        complete('troll');
        s.troll = null;
        s.mode = 'walk';
        s.h = newWalker({ x: CHAMBER.x, z: -HALL.d / 2 + 2, face: -0.3 });
        s.party = newParty();
        for (let z = CHAMBER.z; z <= -HALL.d / 2 + 2; z += 0.3) lead(s.party, CHAMBER.x, z);
        say('Out of the chamber, and east across the great hall to its far door. Run!', true);
      } else if (which === 'bridge') {
        complete('bridge');
        s.mode = 'end';
      }
      return undefined;
    },
    [complete, later, say, startDash, startTalk, startTroll],
  );

  const doGrab = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'tumble' || !s.tumble) return;
    const r = grab(s.tumble);
    if (r === 'caught') {
      api.current?.fx('caught');
      sounds().then((x) => x.catchIt());
      say(s.tumble.caught.length === 1 ? 'You catch the skull. Pippin breathes out.' : 'You catch the body. Pippin grins at you.');
    } else if (r === 'slipped') say('The chain whips through your fingers, and the bucket goes, bang, clang, crash, all the way down.', true);
    else if (r === 'early') say('Not yet…');
  }, [say]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'tumble') return doGrab();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doGrab, enter]);

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
      if (s.mode === 'plank') {
        if (k === 'Escape') leavePlank();
        else if ((k === ' ' || k === 'Enter') && s.plank?.state === 'fell' && !onButton) {
          e.preventDefault();
          enter('plank');
        }
        return;
      }
      if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
        if (s.mode === 'flight') {
          e.preventDefault();
          s.jump = true;
        } else if (s.mode === 'tumble' || (s.mode === 'walk' && s.near)) {
          e.preventDefault();
          doAct();
        }
      } else if ((k === 'm' || k === 'M') && s.mode === 'walk') setList((v) => !v);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, talkOnward, doAct, leavePlank, enter]);

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

    // walking: the shore, the halls, the chamber, the dash
    const walking = s.mode === 'walk' || s.mode === 'dash' || s.mode === 'troll';
    if (walking) {
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
      s.held = Math.max(0, s.held - dt);
      if (s.held > 0) {
        fwd = 0;
        side = 0;
      }
      const run = s.mode !== 'walk' || k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      const w = walkers[s.zone === 'gate' ? 'gate' : 'halls'];
      const closed = s.zone === 'gate' && !s.doorsOpen ? DOOR_WALL : s.mode === 'troll' ? CHAMBER_DOOR_WALL : [];
      s.h = w.step(s.h, { x: mv.x, z: mv.z, run }, dt, { closed });
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
      if (s.zone === 'halls' && s.mode === 'walk') lead(s.party, s.h.x, s.h.z);
    }

    // the Watcher
    if (s.mode === 'dash' && s.dash) {
      for (const e of stepDash(s.dash, dt, s.h, DOOR_AT)) {
        if (e.type === 'warn') sounds().then((x) => x.splash());
        else if (e.type === 'slam') {
          a.fx('slam', e.strike);
          sounds().then((x) => x.slam());
        } else if (e.type === 'grabbed') {
          a.fx('grabbed');
          s.held = WATCHER.hold;
          // dragged a step back towards the water
          s.h = { ...s.h, z: Math.min(GATE.shore - 0.5, s.h.z + 1.4) };
          if (s.dash.grabs <= 1) say(SAYS.ankle.text, true, SAYS.ankle.who);
          else say(s.dash.grabs === 2 ? 'Torn off your feet, and dropped. Run!' : 'It lifts you, and Aragorn’s sword cuts you free.', true);
        } else if (e.type === 'taken') {
          say('Up into the air, out over the water… and Boromir and Aragorn hack you free, and haul you back to the shore. Again: dodge its strikes.', true);
          later(() => sim.current?.mode === 'dash' && startDash(), 1800);
        } else if (e.type === 'in') {
          s.dash = null;
          complete('doors');
          sounds().then((x) => x.collapse());
          say(SAYS.dark.text, true, SAYS.dark.who);
          later(() => {
            const ss = sim.current;
            if (!ss) return;
            ss.mode = 'walk';
            toHalls();
          }, 2400);
          s.mode = 'cut';
        }
      }
    }

    // the long dark: the fork, and the right way
    if (s.zone === 'halls' && s.mode === 'walk' && p.next === 'dark') {
      if (!s.forkTold && s.h.x > FORK.x - 7) startTalk('fork');
      const wi = wayAt(s.h.x, s.h.z);
      if (wi >= 0 && wi !== FORK.right && s.h.x > FORK.x + 1.6 && s.deadEnd !== wi) {
        s.deadEnd = wi;
        say(wi === 0 ? 'A fall of rock, and the air dead and stale. Not this way.' : 'The passage ends in rubble. Back to the fork.');
      }
      if (wi === FORK.right && s.h.x > FORK.x + 2) {
        s.revealing = true;
        startTalk('light');
      }
    }

    // the dwarf at the well
    if (s.mode === 'tumble' && s.tumble) {
      if (pad && pressed('a')) doGrab();
      for (const e of stepTumble(s.tumble, dt)) {
        if (e.type === 'drop') sounds().then((x) => x.clatter(0.4));
        else if (e.type === 'down') sounds().then((x) => x.clatter(e.id === 'bucket' ? 1.4 : 0.8));
        else if (e.type === 'done') {
          a.fx('drums');
          sounds().then((x) => x.drums());
          later(() => {
            const ss = sim.current;
            if (ss?.mode !== 'tumble') return;
            ss.tumble = null;
            startTalk('fool');
          }, 1600);
          s.mode = 'cut';
        }
      }
    }

    // the cave troll
    if (s.mode === 'troll' && s.troll && !s.busy) {
      s.trollT += dt;
      const ev = stepWatchers(s.troll, s.h, dt, TROLL, { colliders: HALL_COLLIDERS, walls: [...HALL_WALLS, ...CHAMBER_DOOR_WALL], push: trollPush, active: true });
      for (const e of ev) {
        if (e.type === 'seen') {
          a.fx('troll');
          sounds().then((x) => x.roar());
          say('It’s seen you! Round a column, behind the tomb!', true);
        } else if (e.type === 'caught') {
          s.busy = true;
          a.fx('hit');
          sounds().then((x) => x.smash());
          say('The club comes down where you were, and you’re flung across the floor. Again: keep out of its sight.', true);
          later(() => {
            const ss = sim.current;
            if (ss?.mode === 'troll') startTroll();
          }, 1800);
        } else if (e.type === 'lost') say('It’s lost you. Keep still.');
      }
      if (s.trollT >= TROLL.hold && !s.busy) {
        s.busy = true;
        sounds().then((x) => x.smash());
        a.fx('hit');
        s.h = newWalker({ x: TROLL_FRODO.x, z: TROLL_FRODO.z, face: TROLL_FRODO.face });
        later(() => sim.current?.mode === 'troll' && startTalk('mithril'), 900);
      }
    }

    // the flight down the stair and over the bridge
    if (s.mode === 'flight' && s.flight && !s.busy) {
      let steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x + (s.steer ?? 0);
      if (pad) steer += pad.lx;
      const jump = s.jump || held('up') || Boolean(pad?.a);
      s.jump = false;
      for (const e of stepFlight(s.flight, dt, { steer, jump }, FLIGHT)) {
        if (e.type === 'jump') sounds().then((x) => x.leap());
        else if (e.type === 'hit') {
          a.fx('hit');
          sounds().then((x) => x.rocks());
          say('Stone crashes down from the roof, and you stagger. It’s gaining!', true);
        } else if (e.type === 'fell' || e.type === 'burnt') {
          s.busy = true;
          say(e.type === 'fell' ? 'Your foot finds nothing. Aragorn catches your collar and hauls you back. Leap where the stair is broken!' : 'The heat of it is on your back, and its shadow over you… Again: keep clear of the stone, and run.', true);
          later(() => {
            const ss = sim.current;
            if (ss?.mode === 'flight') startFlight();
          }, 2000);
        } else if (e.type === 'safe') {
          s.mode = 'bridge';
          s.stepT = 0;
          s.talking = 'bridge';
          s.talk = newTalk(CONVOS.bridge);
          sounds().then((x) => x.balrog());
        }
      }
    }
    if (s.fallen > 0) s.fallen = Math.min(1, s.fallen + dt * 0.35);

    // on the side: out along the plank over the old shaft
    if (s.mode === 'plank' && s.plank) {
      const pl = s.plank;
      const walkOn = held('up') || s.plankWalk > 0 || (pad?.ly ?? 0) < -0.4 || Boolean(pad?.a);
      const lean = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.plankLean + (pad?.lx ?? 0);
      for (const e of stepPlank(pl, dt, { walk: walkOn, lean })) {
        if (e.type === 'wobble') sounds().then((x) => x.creak?.());
        else if (e.type === 'pipe') {
          sounds().then((x) => x.catchIt());
          say('You have it. Now back, slowly, the same way.');
        } else if (e.type === 'won') {
          winSide();
          say(SAYS.thanks.text, false, SAYS.thanks.who);
          later(() => sim.current?.plank === pl && leavePlank(), 2600);
        } else if (e.type === 'fell') {
          sounds().then((x) => {
            x.clatter(1.2);
            setTimeout(() => x.drums(), 2600);
          });
          api.current?.fx('break');
          const fool = e.pipe ? SAYS.pipe : SAYS.dropped;
          say(fool.text, true, fool.who, fool.line);
        }
      }
      s.h.x = SHAFT.x - PLANK.half - 0.15 + pl.at;
      s.h.face = pl.back ? Math.PI : 0;
      s.h.speed = walkOn && pl.state === 'on' ? PLANK.walk : 0;
    }

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk') {
      const sp = nearest(SPOTS.filter((x) => x.zone === s.zone), s.h.x, s.h.z);
      const ok = sp && ((sp.id === 'doors' && p.next === 'doors') || (sp.id === 'tomb' && p.next === 'tomb') || (sp.id === 'east' && p.next === 'bridge') || (sp.id === 'plank' && (p.next === 'tomb' || p.finished)));
      spotHere = ok ? sp.id : null;
    }
    s.near = spotHere;
    const cast = castFor(s.zone, p.next);
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

    // the Fellowship: following you in the halls, fighting in the chamber,
    // running behind you on the stair, waiting at the far end of the bridge
    const company = {};
    if (s.zone === 'halls' && s.mode !== 'troll' && s.mode !== 'tumble' && !(s.mode === 'talk' && ['troll', 'mithril', 'fool'].includes(s.talking))) {
      // Gandalf a little ahead with his staff, lighting the way; the rest
      // strung out behind, far enough back to keep out of the view
      const g = s.gandalf ?? { x: s.h.x + 2.6, z: s.h.z + 0.8 };
      const tx = s.h.x + Math.cos(s.h.face) * 2.6 + Math.sin(s.h.face) * 0.8;
      const tz = s.h.z - Math.sin(s.h.face) * 2.6 + Math.cos(s.h.face) * 0.8;
      const k = Math.min(1, dt * 2.5);
      const [gx, gz] = walkers.halls.push(g.x + (tx - g.x) * k, g.z + (tz - g.z) * k, 0.5);
      const moved = Math.hypot(gx - g.x, gz - g.z) / Math.max(dt, 1e-3);
      s.gandalf = { x: gx, z: gz, face: moved > 0.3 ? Math.atan2(-(gz - g.z), gx - g.x) : (g.face ?? s.h.face) };
      company.gandalf = { zone: 'halls', ...s.gandalf, moving: moved > 0.4 };
      COMPANY.slice(1).forEach((id, i) => {
        const at = followAt(s.party, i + 2);
        if (at) company[id] = { zone: 'halls', ...at, moving: s.h.speed > 0.4 };
      });
    } else if (s.zone === 'halls') {
      COMPANY.forEach((id, i) => {
        const [x, z] = FIGHT[i];
        company[id] = { zone: 'halls', x, z, face: Math.atan2(-(CHAMBER.z - z), CHAMBER.x - x), fight: s.mode === 'troll' };
      });
    } else if (s.zone === 'flight') {
      COMPANY.forEach((id, i) => {
        if (s.mode === 'bridge') {
          if (id === 'gandalf') company[id] = { zone: 'flight', s: FLIGHT.bridge[0] + 22, lat: 0, face: Math.PI };
          else company[id] = { zone: 'flight', s: FLIGHT.end + 1 + (i % 3) * 1.2, lat: -1.6 + (i % 4) * 1.1, face: Math.PI };
        } else if (s.flight) {
          // ahead of you, all but Gandalf, who comes last
          const ahead = id === 'gandalf' ? -2.2 : 2 + i * 1.3;
          company[id] = { zone: 'flight', s: Math.max(0, s.flight.s + ahead), lat: ((i % 3) - 1) * 0.5, face: 0, moving: true };
        }
      });
    }

    const markers = p.finished ? [] : s.zone === 'gate' ? [SPOTS[0]] : p.next === 'tomb' ? [SPOTS[1]] : p.next === 'bridge' ? [SPOTS[2]] : [];
    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.zone !== 'gate', ring: false });
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode === 'cut' ? 'walk' : s.mode,
          hobbit: s.h,
          held: s.held > 0,
          travellers: tv ? tv.list() : null,
          cast: cast.map((c) => c.id),
          talk: s.person,
          speaker: node?.who ?? null,
          camShot: s.mode === 'talk' && SHOTS[s.talking] ? { id: s.talking, ...SHOTS[s.talking] } : null,
          company,
          ithildin: s.ithildin || done.includes('doors'),
          doorsOpen: s.doorsOpen,
          dash: s.dash,
          lit: p.lit || s.revealing,
          revealing: s.revealing,
          tumble: s.tumble,
          troll: s.troll?.list ?? null,
          flight: s.flight,
          plank: s.plank,
          pipeTaken: side,
          fallen: s.fallen,
          whip: s.whip,
          stepT: s.stepT,
          markers,
          camYaw: s.yaw,
          camPitch: s.mode === 'troll' ? 0.62 : s.pitch,
          camDist: s.mode === 'troll' ? 8 : touch ? 7 : 6.2,
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

    const f = s.flight;
    const tm = s.tumble;
    const key = [s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, s.dash?.grabs, tm ? tm.caught.length + tm.falling : '', s.mode === 'troll' ? Math.floor(s.trollT) : '', s.troll?.list?.[0]?.mode, f ? Math.round(f.s / 2) : '', f ? Math.round(f.behind) : '', f?.air > 0, p.done.length, s.plank ? `${s.plank.state}.${s.plank.back}.${Math.round(s.plank.lean * 24)}.${Math.round(s.plank.at * 8)}` : ''].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, grabs: s.dash?.grabs ?? 0, tumble: tm ? { caught: tm.caught.length, falling: tm.falling } : null, troll: s.mode === 'troll' ? { t: s.trollT, hunting: ['alert', 'chase'].includes(s.troll?.list?.[0]?.mode) } : null, flight: f ? { s: f.s, behind: f.behind, air: f.air > 0 } : null, plank: s.plank ? { state: s.plank.state, back: s.plank.back, lean: s.plank.lean, at: s.plank.at } : null });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk') local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // look round by dragging; the stick on touch
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk' || s.mode === 'troll' || s.mode === 'dash') drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
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
    if (q.id === 'doors') {
      s.zone = 'gate';
      s.h = newWalker({ x: -4, z: GATE.cliff + 5, face: Math.PI / 2 });
    } else {
      if (s.zone !== 'halls') toHalls();
      const at = q.id === 'dark' ? { x: FORK.x - 5, z: 0, face: 0 } : q.id === 'bridge' ? { x: 20, z: 0, face: 0 } : q.id === SIDE.id ? { x: SHAFT.x - SHAFT.plank / 2 - 1, z: SHAFT.z, face: 0 } : { x: CHAMBER.x, z: -HALL.d / 2 + 4, face: Math.PI / 2 };
      s.h = newWalker(at);
      s.party = trailBehind(s.h);
      s.gandalf = null;
    }
    s.yaw = behindYaw(s.h.face);
    setList(false);
  };
  const stay = () => {
    const s = sim.current;
    s.zone = 'halls';
    s.mode = 'walk';
    s.flight = null;
    s.fallen = 0;
    s.whip = 0;
    toHalls();
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const F = hud.flight;
  return (
    <div ref={box} className="shire-stage moria-stage" data-touch={touch || undefined} data-mode={mode} data-zone={hud.zone ?? sim.current.zone} data-game={['dash', 'tumble', 'troll', 'flight', 'plank'].includes(mode) || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Moria in 3D: the Doors of Durin under the moon, the great halls of Dwarrowdelf in the dark, Balin's tomb, and the Bridge of Khazad-dûm" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Into the dark of Moria" />

      {(walking || mode === 'dash' || mode === 'troll') && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="moria-title" className="shire-title">
              Moria
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {mode === 'dash' ? 'Run for the Doors! Dodge where the tentacles are about to fall.' : mode === 'troll' ? 'Keep out of the troll’s sight.' : prog.objective}
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
      {!walking && mode !== 'dash' && mode !== 'troll' && (
        <h1 id="moria-title" className="sr-only">
          Moria
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

      {node && <Convo title="Moria" name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {mode === 'dash' && (
        <div className="shire-panel moria-game" role="group" aria-label="The Watcher in the Water">
          <p className="shire-panel-title">The Watcher in the Water</p>
          <p className="shire-panel-stats">
            <span>
              Grabbed <b>{hud.grabs}</b> of {WATCHER.grabs}
            </span>
          </p>
        </div>
      )}
      {mode === 'tumble' && hud.tumble && (
        <div className="shire-panel moria-game" role="group" aria-label="Fool of a Took">
          <p className="shire-panel-title">Catch it!</p>
          <p className="shire-panel-say">{hud.tumble.falling ? `The ${hud.tumble.falling} is falling…` : 'The dwarf on the well’s edge sways…'}</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm moria-big" onPointerDown={(e) => (e.preventDefault(), doGrab())}>
              Grab {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'troll' && hud.troll && (
        <div className="shire-panel moria-game" role="group" aria-label="The cave troll" data-hunting={hud.troll.hunting || undefined}>
          <p className="shire-panel-title">{hud.troll.hunting ? 'It’s seen you!' : 'They have a cave troll'}</p>
          <div className="shire-meter" role="meter" aria-label="Holding out" aria-valuemin={0} aria-valuemax={TROLL.hold} aria-valuenow={Math.floor(hud.troll.t)}>
            <span className="shire-meter-label">Hold out</span>
            <span className="shire-meter-bar moria-meter-hold">
              <span style={{ transform: `scaleX(${Math.min(1, hud.troll.t / TROLL.hold)})` }} />
            </span>
          </div>
        </div>
      )}
      {mode === 'flight' && F && (
        <div className="shire-panel moria-game" role="group" aria-label="The Bridge of Khazad-dûm">
          <p className="shire-panel-title">To the bridge!</p>
          <div className="shire-meter" role="meter" aria-label="To the far side" aria-valuemin={0} aria-valuemax={FLIGHT.end} aria-valuenow={Math.round(F.s)}>
            <span className="shire-meter-label">The bridge</span>
            <span className="shire-meter-bar moria-meter-run">
              <span style={{ transform: `scaleX(${Math.min(1, F.s / FLIGHT.end)})` }} />
            </span>
          </div>
          <div className="shire-meter" role="meter" aria-label="The Balrog behind" aria-valuemin={0} aria-valuemax={FLY.behind} aria-valuenow={Math.round(F.behind)}>
            <span className="shire-meter-label">The Balrog</span>
            <span className="shire-meter-bar moria-meter-fire">
              <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, 1 - F.behind / (FLY.behind * 1.4)))})` }} />
            </span>
          </div>
          {F.s > FLIGHT.gap[0] - 8 && F.s < FLIGHT.gap[0] && <p className="shire-panel-help moria-warn">The stair is broken ahead: leap!</p>}
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Steer left" {...hold('steer', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Steer right" {...hold('steer', 1)}>
                ▶
              </button>
              <button type="button" className="btn btn-primary btn-sm moria-big" onPointerDown={(e) => (e.preventDefault(), (sim.current.jump = true))}>
                Leap!
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to steer clear of falling stone; Space to leap.</p>
          )}
        </div>
      )}
      {/* on the side: the plank over the old shaft */}
      {mode === 'plank' && hud.plank && (
        <div className="shire-panel moria-game moria-plank" role="group" aria-label="Mind the well" data-fell={hud.plank.state === 'fell' || undefined}>
          <p className="shire-panel-title">{hud.plank.state === 'fell' ? 'Fool of a Baggins!' : hud.plank.back ? 'Back, slowly' : 'Out to the pipe'}</p>
          <div className="moria-balance" role="meter" aria-label="Your balance" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={Math.round(hud.plank.lean * 100) / 100}>
            <span className="moria-balance-safe" style={{ left: `${50 - PLANK.wobble * 50}%`, right: `${50 - PLANK.wobble * 50}%` }} />
            <span className="moria-balance-needle" style={{ left: `${50 + Math.max(-1, Math.min(1, hud.plank.lean)) * 50}%` }} />
          </div>
          <div className="shire-meter" role="meter" aria-label="Along the plank" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round((hud.plank.back ? 1 + (PLANK.half - hud.plank.at) / PLANK.half : hud.plank.at / PLANK.half) * 50) / 100}>
            <span className="shire-meter-label">{hud.plank.back ? 'Back' : 'Out'}</span>
            <span className="shire-meter-bar">
              <span style={{ transform: `scaleX(${(hud.plank.back ? 1 + (PLANK.half - hud.plank.at) / PLANK.half : hud.plank.at / PLANK.half) / 2})` }} />
            </span>
          </div>
          {hud.plank.state === 'fell' ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => enter('plank')}>
                Try again {!touch && <kbd>Space</kbd>}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={leavePlank}>
                Leave it {!touch && <kbd>Esc</kbd>}
              </button>
            </div>
          ) : touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Lean left" {...hold('plankLean', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-primary btn-sm moria-big" {...hold('plankWalk', 1)}>
                Walk
              </button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Lean right" {...hold('plankLean', 1)}>
                ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">
              Hold W or ↑ to walk. When the needle swings one way, lean the other: A or ←, D or →. <kbd>Esc</kbd> to step off.
            </p>
          )}
        </div>
      )}

      {mode === 'end' && (
        <div className="shire-panel moria-end" role="dialog" aria-label="Out of Moria">
          <p className="shire-panel-title">Fly, you fools</p>
          <p className="shire-panel-say">Out of the east gate into the daylight, and Gandalf is gone. Aragorn gets them up and on: by nightfall, these hills will be swarming with orcs. To the woods of Lothlórien.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to Lothlórien
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay in Moria
            </button>
          </div>
        </div>
      )}
      {(walking || mode === 'dash' || mode === 'troll') && touch && <Stick onMove={onStick} />}
      {list && (
        <QuestList
          title="Things to do in Moria"
          quests={prog.quests}
          next={prog.next}
          side={[{ ...SIDE, done: side }]}
          onClose={() => setList(false)}
          onGo={travel}
          canGo={(q) => (q.id === SIDE.id ? (prog.next === 'tomb' || prog.finished) && sim.current.mode === 'walk' && sim.current.zone !== 'flight' : q.open && !q.done && sim.current.mode === 'walk' && (q.id === 'doors') === (sim.current.zone === 'gate'))}
        />
      )}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, side, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="moria-title" className="title">
        Moria
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The Mines of Moria, from the Doors of Durin to the Bridge of Khazad-dûm, to walk through in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s Moria as cards.' : gl === 'failed' ? 'The 3D Moria couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Moria isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s Moria as cards.'}
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
        <li data-side>
          <p className="shire-list-side">On the side</p>
          <p className="shire-list-name">{SIDE.name}</p>
          <p className="shire-list-sub">{SIDE.where}</p>
          <p className="mt-2 text-sm text-muted">{SIDE.blurb}</p>
          {side && <p className="mt-2 text-sm font-semibold">Done</p>}
        </li>
      </ul>
    </div>
  );
}
