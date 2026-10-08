import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { readPad, typing } from '../../../games/pad';
import { Convo, QuestList, Stick, Travellers } from '../TownHud';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { newTalk, talkNode, talkOn } from '../talk';
import { useTravellers } from '../useTravellers';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { ARAGORN, BEREGOND, COURT_COLLIDERS, COURT_IN, CROWN_COLLIDERS, DENETHOR, GATES, HALL_COLLIDERS, HALL_DOOR, HALL_EXIT, HALL_IN, HALL_WALLS, OVERLOOK, PILE, ROAD_LEN, SLOTS, TOMATOES, onCourt, validAt } from './layout';
import { CONVOS, FOUND, QUESTS, SEAL, SPEAKERS, minasProgress } from './story';
import { RIDE, SIEGE, flightOf, lightBeacon, loose, newRide, newSiege, newSneak, rangeOf, stepRide, stepSiege, stepSneak } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './minastirith.css';
import '../../../../styles/lazy/middleearth.css';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Minas Tirith, found off the road: Pippin in the city of the kings. The
// ride up through the seven gates on Shadowfax, the Court of the Fountain
// and Beregond, the Steward in the hall of the kings, the beacon, the siege
// by night, and the morning the White Tree flowered. The places are in
// ./layout.js, the story in ./story.js, the games in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the talk and the
// games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-minastirith-done';
const AT = 'tp-minastirith-at';
const TOMATO = 'tp-minastirith-tomato';
const CHAIN_T = 15;
const GATE_NAMES = ['the Great Gate', 'the second gate', 'the third gate', 'the fourth gate', 'the fifth gate', 'the sixth gate', 'the seventh gate'];
const sounds = () => import('./sounds');
const walkers = {
  court: makeWalker({ radius: 400, colliders: COURT_COLLIDERS, blocked: (x, z) => !onCourt(x, z) }),
  crown: makeWalker({ radius: 400, colliders: CROWN_COLLIDERS, blocked: (x, z) => !onCourt(x, z) }),
  hall: makeWalker({ radius: 60, colliders: HALL_COLLIDERS, walls: HALL_WALLS }),
};
const PROMPT = {
  beregond: { name: 'Beregond of the Guard', act: 'Speak' },
  door: { name: 'The hall of the kings', act: 'Go in' },
  out: { name: 'The doors to the court', act: 'Go out' },
  denethor: { name: 'Denethor, Steward of Gondor', act: 'Speak' },
  tomato: { name: 'The Steward’s supper', act: 'Look' },
  view: { name: 'The point of the prow', act: 'Look out' },
  aragorn: { name: 'The King', act: 'Go to him' },
};
const ZONE_AIR = { ride: 'ride', court: 'court', hall: 'hall', beacon: 'beacon', walls: 'walls' };

export default function MinasTirithWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return minasProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = minasProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  // finding the city at all is worth something
  useEffect(() => unlock(FOUND), [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = minasProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  // from the beginning: the story forgotten, and the world built afresh
  const [round, setRound] = useState(0);
  const again = useCallback(() => {
    local.set(DONE, []);
    local.set(AT, null);
    setDone([]);
    setRound((r) => r + 1);
  }, []);
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world minas-world" aria-labelledby="minas-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World key={round} prog={prog} complete={complete} gl={gl} setGl={setGl} onLeave={onLeave} again={again} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

const seed = () => Math.floor(Math.random() * 100000) + 1;
const freshRide = () => newRide(seed(), { slots: SLOTS, gates: GATES.map((g) => g.s), len: ROAD_LEN });

function World({ prog, complete, gl, setGl, onLeave, again }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const zone = prog.zone;
    const saved = local.get(AT, null);
    // back in the hall, if that's where you were
    const inHall = zone === 'court' && saved?.zone === 'hall';
    const at = inHall ? validAt(saved, 'hall') : validAt(saved, 'court');
    const h = newWalker(zone === 'court' ? at : COURT_IN);
    const mode = zone === 'ride' ? 'ride' : zone === 'court' ? 'walk' : 'talk';
    sim.current = { zone: inHall ? 'hall' : zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.3, dragAt: -1e9, mode, talking: null, talk: null, near: null, frame: 0, moved: false, t: 0, air: null, hooves: null, padBefore: null, ride: zone === 'ride' ? freshRide() : null, sneak: null, siege: null, chain: -1, busy: false, steer: 0, fwd: 0, back: 0, startAt: zone };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: sim.current.mode, near: null, moved: false, zone: sim.current.zone });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [list, setList] = useState(false);
  const say = useCallback((text, bad = false) => setToast({ text, bad, at: Date.now() }), []);
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
  // other travellers online in the court, as pale Pippins from other worlds
  const trav = useTravellers('minastirith', gl === 'on');

  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createMinasWorld }) => {
        if (dead || !canvas.current) return null;
        return createMinasWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__MINAS__ = { api: a, sim: sim.current, complete };
        // (a beacon already lit stays lit)
        if (progRef.current.done.includes('beacon')) a.fx('lit');
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
      if (s.mode === 'walk' && (s.zone === 'court' || s.zone === 'hall')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      s.hooves?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;
  const placeAir = useCallback(() => {
    const s = sim.current;
    const where = s.mode === 'chain' || s.talking === 'lit' ? 'chain' : s.zone === 'court' && progRef.current.day ? 'day' : ZONE_AIR[s.zone];
    s.air?.place(where);
  }, []);
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.air();
      placeAir();
      if (s.mode === 'ride') s.hooves = x.gallop();
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
      s.hooves?.stop();
      s.hooves = null;
    };
  }, [live, placeAir]);

  const startTalk = useCallback(
    (id) => {
      const s = sim.current;
      s.mode = 'talk';
      s.talking = id;
      s.talk = newTalk(CONVOS[id]);
      placeAir();
    },
    [placeAir],
  );
  const toCourt = useCallback(
    (at = COURT_IN) => {
      const s = sim.current;
      s.zone = 'court';
      s.mode = 'walk';
      s.h = newWalker(at);
      s.yaw = behindYaw(at.face);
      s.pitch = 0.3;
      s.busy = false;
      placeAir();
    },
    [placeAir],
  );
  const toHall = useCallback(() => {
    const s = sim.current;
    s.zone = 'hall';
    s.mode = 'walk';
    s.h = newWalker(HALL_IN);
    s.yaw = behindYaw(HALL_IN.face);
    s.pitch = 0.3;
    placeAir();
    sounds().then((x) => x.door());
    api.current?.fx('door');
  }, [placeAir]);
  const startSneak = useCallback(() => {
    const s = sim.current;
    s.zone = 'beacon';
    s.mode = 'sneak';
    s.sneak = newSneak(seed());
    s.busy = false;
    placeAir();
  }, [placeAir]);
  const startSiege = useCallback(() => {
    const s = sim.current;
    s.zone = 'walls';
    s.mode = 'siege';
    s.siege = newSiege(seed());
    s.busy = false;
    s.firstTower = true;
    placeAir();
  }, [placeAir]);
  // what to do next, coming into a place the story has moved on to
  const begin = useCallback(
    (zone) => {
      if (zone === 'beacon') {
        sim.current.zone = 'beacon';
        startTalk('dusk');
      } else if (zone === 'walls') {
        sim.current.zone = 'walls';
        startTalk('siege');
      }
    },
    [startTalk],
  );
  useEffect(() => {
    const s = sim.current;
    if (s.mode === 'talk' && !s.talking) begin(s.startAt);
  }, [begin]);

  const enter = useCallback(
    (id) => {
      audioContext();
      const s = sim.current;
      setList(false);
      if (id === 'beregond') startTalk('beregond');
      else if (id === 'door') toHall();
      else if (id === 'out') {
        sounds().then((x) => x.door());
        toCourt({ x: HALL_DOOR.x + 3.2, z: HALL_DOOR.z, face: 0 });
      } else if (id === 'denethor') startTalk('denethor');
      else if (id === 'tomato') startTalk('tomato');
      else if (id === 'view') startTalk('view');
      else if (id === 'aragorn') startTalk('crown');
      s.near = null;
    },
    [startTalk, toCourt, toHall],
  );

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      // the horns of Rohan, and the bells of the city
      if (s.talking === 'held' && s.talk.at === 'horns') sounds().then((x) => x.horns());
      if (s.talking === 'held' && s.talk.at === 'after') sounds().then((x) => x.bells());
      if (s.talking === 'crown' && s.talk.at === 'kneel') sounds().then((x) => x.cheer());
      if (!s.talk.end) return setHud((h) => ({ ...h, line: s.talk.at }));
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      s.mode = 'walk';
      if (which === 'arrive') say('Find Beregond of the Guard, by the White Tree.');
      else if (which === 'beregond') {
        complete('court');
        say('The hall of the kings is through the doors at the west of the court.');
      } else if (which === 'denethor') {
        complete('steward');
        say('A guard of the Citadel, in the black and silver. Evening is coming…');
        s.busy = true;
        later(() => {
          const x = sim.current;
          if (!x) return;
          x.busy = false;
          x.zone = 'beacon';
          startTalk('dusk');
        }, 2600);
      } else if (which === 'tomato') {
        local.set(TOMATO, true);
        sounds().then((x) => x.crunch());
      } else if (which === 'view') placeAir();
      else if (which === 'dusk') startSneak();
      else if (which === 'lit') {
        complete('beacon');
        s.zone = 'walls';
        startTalk('siege');
      } else if (which === 'siege') startSiege();
      else if (which === 'held') {
        complete('walls');
        toCourt();
        sounds().then((x) => x.bells());
        say('The King is waiting under the White Tree.');
      } else if (which === 'crown') {
        complete('crown');
        s.mode = 'end';
      }
      return undefined;
    },
    [complete, later, placeAir, say, startSiege, startSneak, startTalk, toCourt],
  );

  // the beacon: light it, from the top of the pile
  const doLight = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'sneak' || !s.sneak || s.busy) return;
    const r = lightBeacon(s.sneak);
    if (r === 'notyet') {
      say(s.sneak.s >= PILE.s ? 'Climb to the top first (hold W).' : 'Get to the pile first.', true);
      return;
    }
    s.busy = true;
    api.current?.fx('lit');
    sounds().then((x) => {
      x.ignite();
      setTimeout(() => x.roar(), 700);
    });
    say('It catches! The beacon of Minas Tirith is lit!');
    later(() => {
      const x = sim.current;
      if (!x || x.mode !== 'sneak') return;
      x.mode = 'chain';
      x.chain = 0;
      x.busy = false;
      api.current?.fx('chain');
      placeAir();
    }, 2600);
  }, [later, placeAir, say]);
  // the siege: loose the engines
  const doLoose = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'siege' || !s.siege || s.busy) return;
    const r = loose(s.siege);
    if (r === 'loosed') {
      api.current?.fx('loose');
      sounds().then((x) => x.loose());
    } else if (r === 'loading') say('They’re still winding the engine…', true);
  }, [say]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'sneak') return doLight();
    if (s.mode === 'siege') return doLoose();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doLight, doLoose, enter]);

  // keys
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target)) return;
      keyDown(s.keys, e);
    };
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
      if ((s.mode === 'sneak' || s.mode === 'siege') && !e.repeat && (k === ' ' || k === 'e' || k === 'E' || k === 'Enter')) {
        e.preventDefault();
        doAct();
        return;
      }
      if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
        if (s.mode === 'walk' && s.near) {
          e.preventDefault();
          doAct();
        }
      } else if ((k === 'm' || k === 'M') && s.mode === 'walk') setList((v) => !v);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, talkOnward, doAct]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    // (the QA scripts hold the world still, and step it a frame at a time)
    if (import.meta.env.DEV && s.paused) {
      if (!(s.steps > 0)) return;
      s.steps -= 1;
    }
    const p = progRef.current;
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};
    if (pad && s.talk && pressed('a')) talkOnward(0);

    // walking: the court (and the prow), the hall
    if (s.mode === 'walk' && (s.zone === 'court' || s.zone === 'hall') && !s.busy) {
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
      const w = s.zone === 'hall' ? walkers.hall : p.next === 'crown' ? walkers.crown : walkers.court;
      s.h = w.step(s.h, { x: mv.x, z: mv.z, run }, dt);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
    }

    // the seven gates
    if (s.mode === 'ride' && s.ride) {
      const steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x + (s.steer ?? 0) + (pad ? pad.lx : 0);
      const spur = held('up') || held('run') || s.fwd > 0 || Boolean(pad?.a) || s.stick.y < -0.5;
      for (const e of stepRide(s.ride, dt, { steer, spur })) {
        if (e.type === 'gate') {
          sounds().then((x) => x.gate());
          say(e.i === 0 ? 'Through the Great Gate, into the city!' : `Through ${GATE_NAMES[e.i]}${e.i === 6 ? ', into the Citadel' : ''}.`);
        } else if (e.type === 'knock') {
          a.fx('knock');
          sounds().then((x) => x.knock());
          say(e.kind === 'hens' ? 'Hens everywhere! Shadowfax shies.' : e.kind === 'folk' ? 'People scatter out of the way…' : 'A clatter, and he stumbles. Steer round them!', true);
        } else if (e.type === 'top') {
          s.hooves?.stop();
          s.hooves = null;
          complete('ride');
          const knocks = s.ride.knocks;
          s.ride = null;
          toCourt();
          startTalk('arrive');
          if (knocks === 0) say('Not so much as a hen disturbed, all the way up.');
        }
      }
      s.hooves?.set(s.ride ? s.ride.v / RIDE.gallop : 0);
    }

    // the beacon
    if (s.mode === 'sneak' && s.sneak && !s.busy) {
      const move = (held('up') || s.fwd > 0 || s.stick.y < -0.4 || (pad ? pad.ly < -0.4 : false) ? 1 : 0) - (held('down') || s.back > 0 || s.stick.y > 0.4 || (pad ? pad.ly > 0.4 : false) ? 1 : 0);
      if (pad && pressed('a')) doLight();
      const n = s.sneak;
      const wasClimb = n.climb;
      for (const e of stepSneak(n, dt, move)) {
        if (e.type === 'stir') {
          sounds().then((x) => x.stir());
          say('He stirs… keep still, or get behind a rock!', true);
        } else if (e.type === 'look') say('He’s looking up the ledge!', true);
        else if (e.type === 'caught') {
          sounds().then((x) => x.caught());
          say('“Who’s there?” You freeze, and he squints, and grumbles, and goes back to his supper. Back behind the rock.', true);
        } else if (e.type === 'pile') say('The pile! Climb it while he’s eating (hold W).');
        else if (e.type === 'top') say('On top of the pile. Light it! (E)');
      }
      if (n.climb > wasClimb && Math.floor(n.climb * 6) !== Math.floor(wasClimb * 6)) sounds().then((x) => x.climb());
    }

    // the beacons away to Rohan
    if (s.mode === 'chain') {
      s.chain += dt;
      if (s.chain >= CHAIN_T) {
        s.chain = -1;
        startTalk('lit');
      }
    }

    // the siege
    if (s.mode === 'siege' && s.siege && !s.busy) {
      if (pad && pressed('a')) doLoose();
      for (const e of stepSiege(s.siege, dt)) {
        if (e.type === 'tower' && s.firstTower) {
          s.firstTower = false;
          say('A siege-tower, rolling for the wall!', true);
        } else if (e.type === 'loaded') sounds().then((x) => x.creak());
        else if (e.type === 'land') {
          if (e.hit) {
            a.fx('fall');
            sounds().then((x) => x.crash());
          } else sounds().then((x) => x.thud());
        } else if (e.type === 'fall') say(`A tower down! ${s.siege.felled} of ${SIEGE.need}.`);
        else if (e.type === 'dread') {
          a.fx('dread');
          sounds().then((x) => x.screech());
          say('A fell beast stoops over the wall, screaming! The ropes shake…', true);
        } else if (e.type === 'breach') {
          s.busy = true;
          say('A tower reaches the wall, and orcs pour over… Hold on: again!', true);
          later(() => sim.current?.mode === 'siege' && startSiege(), 2800);
        } else if (e.type === 'won') {
          s.busy = true;
          sounds().then((x) => x.cheer());
          later(() => {
            const x = sim.current;
            if (!x || x.mode !== 'siege') return;
            x.siege = null;
            startTalk('held');
          }, 1600);
        }
      }
    }

    // what's here
    s.near = null;
    if (s.mode === 'walk' && s.zone === 'court') {
      const d = (o) => Math.hypot(s.h.x - o.x, s.h.z - o.z);
      if (p.next === 'court' && d(BEREGOND) < BEREGOND.r) s.near = 'beregond';
      else if (p.next === 'crown' && d(ARAGORN) < ARAGORN.r) s.near = 'aragorn';
      else if (d(HALL_DOOR) < HALL_DOOR.r) s.near = 'door';
      else if (d(OVERLOOK) < OVERLOOK.r) s.near = 'view';
    } else if (s.mode === 'walk' && s.zone === 'hall') {
      const d = (o) => Math.hypot(s.h.x - o.x, s.h.z - o.z);
      if (p.next === 'steward' && d(DENETHOR) < DENETHOR.r) s.near = 'denethor';
      else if (d(TOMATOES) < TOMATOES.r) s.near = 'tomato';
      else if (d(HALL_EXIT) < HALL_EXIT.r) s.near = 'out';
    }

    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: !(s.zone === 'court' && s.mode === 'walk') });
    const r = s.ride;
    const n = s.sneak;
    const g = s.siege;
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          next: p.next,
          done: p.done,
          day: p.day,
          livery: p.livery,
          pippin: s.h,
          travellers: tv ? tv.list() : null,
          talking: s.talking,
          speaker: node?.who ?? null,
          line: s.talk?.at ?? null,
          ride: r,
          sneak: n ? { s: n.s, climb: n.climb, phase: n.phase, moving: n.moving, covered: n.covered, state: n.state } : null,
          siege: g ? { aim: g.aim, loaded: g.loaded, dread: g.dread, towers: g.towers, shots: g.shots.map((sh) => ({ d: sh.d, k: flightOf(sh), i: sh.i })) } : null,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 7 : 6.2,
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
    // (and read the picture straight back, while it's still there)
    if (import.meta.env.DEV && s.wantSnap) {
      s.wantSnap = false;
      s.snap = canvas.current?.toDataURL('image/jpeg', 0.86) ?? null;
    }

    const key = [s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, r ? r.gate : '', r ? r.knocks : '', r ? Math.round(r.s / 6) : '', n ? Math.round(n.s * 2) : '', n ? Math.round(n.climb * 20) : '', n?.phase, n?.covered, n?.state, g ? Math.round(g.aim * 60) : '', g?.loaded, g?.felled, g ? g.towers.map((w) => `${w.state}${Math.round(w.d / 4)}`).join(',') : '', g ? g.dread > 0 : '', p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, ride: r ? { gate: r.gate, knocks: r.knocks, s: r.s } : null, sneak: n ? { s: n.s, climb: n.climb, phase: n.phase, covered: n.covered, state: n.state } : null, siege: g ? { aim: g.aim, loaded: g.loaded, felled: g.felled, dread: g.dread > 0, towers: g.towers.filter((w) => w.state === 'on').map((w) => ({ i: w.i, d: w.d })) } : null });
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && (s.zone === 'court' || s.zone === 'hall')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // look round by dragging; the stick on touch
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
      s.pitch = Math.max(0.05, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
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
  // after the end: walk the city in the morning, the story kept
  const stay = () => {
    toCourt();
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const zone = hud.zone ?? sim.current.zone;
  const title = zone === 'ride' ? 'The seven gates' : zone === 'hall' ? 'The hall of the kings' : zone === 'beacon' ? 'The beacon of Minas Tirith' : zone === 'walls' ? 'The first wall' : 'The Court of the Fountain';
  const Ri = hud.ride;
  const Sn = hud.sneak;
  const Si = hud.siege;
  const watch = Sn ? (Sn.phase === 'look' ? 'He’s looking up the ledge!' : Sn.phase === 'stir' ? 'He stirs…' : 'He’s busy with his supper') : '';
  return (
    <div ref={box} className="shire-stage minas-stage" data-touch={touch || undefined} data-mode={mode} data-zone={zone} data-day={prog.day || undefined} data-game={['ride', 'sneak', 'siege', 'chain'].includes(mode) || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Minas Tirith in 3D: the white city of seven levels, its Citadel and White Tree, the hall of the kings, the beacon on the mountain, and the siege by night" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="To Minas Tirith" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="minas-title" className="shire-title">
              {title}
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {prog.objective}
            </p>
          </div>
          <div className="shire-side">
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{prog.done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            {zone === 'court' && <Travellers trav={trav} />}
          </div>
        </div>
      )}
      {!walking && (
        <h1 id="minas-title" className="sr-only">
          Minas Tirith
        </h1>
      )}

      {toast && (
        <p className="shire-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}
      {here && walking && (
        <div className="shire-door">
          <p className="shire-door-name">{here.name}</p>
          <button type="button" className="btn btn-primary" onClick={() => enter(hud.near)}>
            {!touch && <kbd className="key-first">E</kbd>} {here.act}
          </button>
        </div>
      )}

      {node && <Convo title={title} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {mode === 'ride' && Ri && (
        <div className="shire-panel minas-game" role="group" aria-label="The seven gates">
          <p className="shire-panel-title">Up through the city on Shadowfax</p>
          <ol className="minas-gates" aria-label={`${Ri.gate} of 7 gates passed`}>
            {GATES.map((g) => (
              <li key={g.k} data-passed={Ri.gate > g.k || undefined} />
            ))}
          </ol>
          <p className="shire-panel-stats">
            <span>
              Gates <b>{Ri.gate}</b> of 7
            </span>
            <span>
              Knocks <b>{Ri.knocks}</b>
            </span>
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm minas-big" aria-label="Steer left" {...hold('steer', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-primary btn-sm minas-big" {...hold('fwd', 1)}>
                Gallop
              </button>
              <button type="button" className="btn btn-ghost btn-sm minas-big" aria-label="Steer right" {...hold('steer', 1)}>
                ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to steer round carts and crowds; hold W to gallop.</p>
          )}
        </div>
      )}
      {mode === 'sneak' && Sn && (
        <div className="shire-panel minas-game" role="group" aria-label="The beacon" data-look={Sn.phase === 'look' || undefined} data-stir={Sn.phase === 'stir' || undefined}>
          <p className="shire-panel-title">{Sn.state === 'ready' ? 'Light the beacon!' : Sn.covered ? `Behind a rock. ${watch}` : watch}</p>
          <div className="minas-ledge" aria-hidden="true">
            {[5.5, 11.5, 17].map((c) => (
              <span key={c} className="minas-ledge-rock" style={{ left: `${(c / 26) * 100}%` }} />
            ))}
            <span className="minas-ledge-pile" style={{ left: `${(PILE.s / 26) * 100}%` }} />
            <span className="minas-ledge-guard" data-look={Sn.phase === 'look' || undefined} />
            <span className="minas-ledge-you" style={{ left: `${(Math.min(Sn.s, PILE.s) / 26) * 100}%`, bottom: `${Sn.climb * 70}%` }} />
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm minas-big" {...hold('back', 1)}>
                Back
              </button>
              <button type="button" className="btn btn-primary btn-sm minas-big" {...hold('fwd', 1)}>
                {Sn.s >= PILE.s ? 'Climb' : 'Creep'}
              </button>
              <button type="button" className="btn btn-primary btn-sm minas-big" data-next={Sn.state === 'ready' || undefined} onPointerDown={(e) => (e.preventDefault(), doLight())}>
                Light
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold W to creep on (and climb the pile), S to go back. Keep still when he looks. E to light it.</p>
          )}
        </div>
      )}
      {mode === 'siege' && Si && (
        <div className="shire-panel minas-game" role="group" aria-label="The siege" data-dread={Si.dread || undefined}>
          <p className="shire-panel-title">{Si.dread ? 'A fell beast! The range shakes…' : Si.loaded ? 'Loose when the range is on a tower' : 'Winding the engine…'}</p>
          <div className="minas-range" aria-hidden="true">
            {Si.towers.map((w) => (
              <span key={w.i} className="minas-range-tower" style={{ left: `${((w.d - SIEGE.near) / (SIEGE.far - SIEGE.near)) * 100}%` }} />
            ))}
            <span className="minas-range-aim" data-loaded={Si.loaded || undefined} style={{ left: `${((rangeOf(Si.aim) - SIEGE.near) / (SIEGE.far - SIEGE.near)) * 100}%` }} />
            <span className="minas-range-wall">Wall</span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Towers down <b>{Si.felled}</b> of {SIEGE.need}
            </span>
          </p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm minas-big" data-next={Si.loaded || undefined} onPointerDown={(e) => (e.preventDefault(), doLoose())}>
              Loose {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'chain' && <p className="minas-chain">The beacons are lit, one after another, away to Rohan…</p>}
      {mode === 'end' && (
        <div className="shire-panel minas-end" role="dialog" aria-label="The Return of the King">
          <p className="shire-panel-title">The Return of the King</p>
          <p className="shire-panel-say">The White Tree is in flower in the Court of the Fountain, and there is a King in Gondor again. And somewhere in the city, a small guard of the Citadel is looking for breakfast.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              Back to the map
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Walk the city
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={again}>
              From the beginning
            </button>
          </div>
        </div>
      )}
      {walking && touch && <Stick onMove={onStick} />}
      {list && <QuestList title="Things to do in Minas Tirith" quests={prog.quests} next={prog.next} onClose={() => setList(false)} />}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="minas-title" className="title">
        Minas Tirith
      </h1>
      <p className="lead mt-4 max-w-[60ch]">You found the way in. The white city of seven levels, its Citadel and White Tree, the hall of the kings, the beacon on the mountain and the siege by night, to play through in 3D as Pippin. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here it is as cards.' : gl === 'failed' ? 'The 3D couldn’t start here, so here it is as cards.' : three.held ? 'The 3D isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here it is as cards.'}
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
