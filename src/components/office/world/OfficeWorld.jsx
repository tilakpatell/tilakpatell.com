import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery, usePageVisible } from '../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../lib/voiced';
import { readPad, typing } from '../../games/pad';
import { Bubble, Convo, QuestList, Stick } from '../../middleearth/towns/TownHud';
import { keyDown, keyUp, moveOf } from '../../middleearth/towns/keys';
import { drawMap } from '../../middleearth/towns/map';
import { nearest } from '../../middleearth/towns/story';
import { newTalk, talkNode, talkOn } from '../../middleearth/towns/talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../../middleearth/towns/walker';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { ASKS, CAST, COLLIDERS, DOORS, HOOP, JIM, LINES, NAMES, OFFICE_ARRIVE, P, RACKS, ROOMS, SPOKEN, SPOTS, THINGS, WALLS, WAREHOUSE, WH_ARRIVE, WORLD, inLot, inWarehouse, rect, roomAt, seatOf, spot, validAt } from './layout';
import { SHOUTS } from './shouts';
import { CALL_COUNT, CHILI, CONVOS, FIRE, HOOPS, JELLO, QUESTS, SEAL, SPEAKERS, callOf, fireLeft, meterAt, newChili, newHoops, officeProgress, shoot, stepChili, stepHoops } from './story';
import '../../middleearth/shire/shire.css';
import '../../middleearth/towns/bree/bree.css';
import './world.css';
import '../../../styles/lazy/office.css';
import GuideCue from '../../guide/GuideCue';
import LoadingVeil from '../../worlds/LoadingVeil';
import { throttled } from '../../worlds/loadingSteps';

const PaperToss = lazy(() => import('../PaperToss'));
const FactCheck = lazy(() => import('../FactCheck'));

// Dunder Mifflin Scranton, the world: walk the office as Jim, from the lift
// to the annex, and get through a week in seven jobs: cover reception, the
// stapler in Jell-O, Kevin's chili, the Office Olympics, Dwight's fact
// check, Dwight's fire drill, and the Dundies in Michael's office. The
// floor is ./layout.js, the jobs ./story.js, the drawing ./scene.js and
// ./set.js; this is the walking, the HUD, the talk and the jobs' clocks.
// Without 3D, the jobs are cards.

const DONE = 'tp-office-done';
const AT = 'tp-office-at';
const clip = (id, o) => import('../../../lib/clips').then((c) => c.playClip(id, o)).catch(() => null);
const sfx = () => import('../../../lib/sfx');
const sounds = () => import('./sounds');
const walker = makeWalker({ radius: WORLD.radius, centre: WORLD.centre, colliders: COLLIDERS, walls: WALLS, body: JIM });
const ROOM_NAMES = { bullpen: 'The bullpen', michael: 'Michael’s office', conference: 'The conference room', hallway: 'The kitchen', men: 'The men’s room', women: 'The women’s room', closet: 'Ryan’s closet', stairs: 'The stairwell', annex: 'The annex', breakroom: 'The break room', darryl: 'Darryl’s office', supplies: 'The supply room', lobby: 'The lobby', warehouse: 'The warehouse', lot: 'Scranton Business Park' };
const BOUNDS = (() => {
  const all = Object.values(ROOMS).map(rect);
  const x0 = Math.min(...all.map((r) => r.x));
  const x1 = Math.max(...all.map((r) => r.x + r.w));
  const z0 = Math.min(...all.map((r) => r.z));
  const z1 = Math.max(...all.map((r) => r.z + r.d));
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
})();
const MAP_SCALE = 150 / (BOUNDS.x1 - BOUNDS.x0 + 2);
const WH_C = { x: WAREHOUSE.x + WAREHOUSE.w / 2, z: WAREHOUSE.z + WAREHOUSE.d / 2 };
const WH_SCALE = 150 / (WAREHOUSE.w + 2);

export default function OfficeWorld() {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return officeProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = officeProgress(done);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const [place, setPlace] = useState(null); // an overlay: 'toss' | 'factcheck'
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = officeProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section id="office-world" className="shire-world dm-world" aria-labelledby="dm-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} gl={gl} setGl={setGl} setPlace={setPlace} place={place} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} open={setPlace} />}
      {place && <Place id={place} onClose={() => setPlace(null)} complete={complete} />}
    </section>
  );
}

// others online in the office (middleearth/towns/useTravellers), as pale Jims from another branch
const ROOM = { bound: 160, motion: true };
// downstairs (the warehouse, and the lot out of its dock) is a floor of its
// own: the others are seen only on the floor you're on
const areaOf = (h) => (inWarehouse(h.x, h.z) || inLot(h.x, h.z) ? 'warehouse' : 'office');

function World({ prog, done, complete, gl, setGl, setPlace, place }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const map = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const saved = local.get(AT, null);
    const h = newWalker(validAt(saved));
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.24, dragAt: -1e9, mode: 'walk', talking: null, talk: null, carry: null, chili: newChili(), chiliDone: done.includes('chili'), jelloSet: done.includes('jello'), dwight: 'desk', dwightT: 0, erinBreak: false, fire: false, fireT: 0, near: null, thing: null, person: null, moved: false, t: 0, frame: 0, padBefore: null, edgeAt: -9, room: null, wave: null, hum: null, siren: null };
  }
  const trav = useTravellers('scranton', gl === 'on', ROOM);
  const travRef = trav.ref;
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const placeRef = useRef(place);
  placeRef.current = place;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [list, setList] = useState(false);
  const lines = useRef({});
  const bubbleRef = useRef(null);
  const toastTurn = useRef(0);
  const say = useCallback((text, bad = false) => {
    toastTurn.current += 1;
    setToast({ text, bad, at: Date.now() });
  }, []);
  // who has the floor: a toast with someone speaking in it (and the clip
  // before it), which whoever's near waits out before saying their line
  const [floor, setFloor] = useState(0);
  const floorTurn = useRef(0);
  const hold = useCallback((until) => {
    const mine = ++floorTurn.current;
    setFloor(mine);
    const free = () => setFloor((n) => (n === mine ? 0 : n));
    Promise.race([until, new Promise((r) => setTimeout(r, 15000))]).then(free, free);
  }, []);
  // a toast that's someone speaking (./shouts.js), said in their voice where
  // it's been made (lib/voiced.js): once the clip that goes with it (`first`)
  // is over, and not if another toast has come up since
  const shout = useCallback(
    (line, bad = false, { first = null, shown = line.say } = {}) => {
      say(shown, bad);
      const mine = toastTurn.current;
      hold(
        Promise.resolve(first)
          .then((h) => h?.ended)
          .then(() => new Promise((r) => setTimeout(r, 0))) // (after this render's goodbyes: a conversation closing stops its line)
          .then(() => (mine === toastTurn.current ? sayVoiced(line.who, line.say) : null))
          .then((h) => h?.ended),
      );
    },
    [say, hold],
  );
  // leaving the office: nothing it said goes on being said
  useEffect(() => {
    const turn = toastTurn;
    return () => {
      turn.current += 1;
      stopVoiced();
    };
  }, []);
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
    const t = setTimeout(() => setToast(null), 5200);
    return () => clearTimeout(t);
  }, [toast]);
  // whoever's near says the line in their bubble: as the show said it, where
  // it did (SPOKEN), else in their own voice where it's been made
  // (lib/voiced.js). It stops when the bubble goes, waits while a toast has
  // the floor, and is said once a bubble.
  const heard = useRef(null);
  useEffect(() => {
    if (!bubble || floor || heard.current === bubble) return undefined;
    heard.current = bubble;
    if (SPOKEN[bubble.line]) {
      clip(SPOKEN[bubble.line], { voice: true }); // (a voice, on the floor: lib/speech.js)
      return undefined;
    }
    const said = sayVoiced(bubble.id, bubble.line);
    return () => said.stop(); // (just this line: not a toast's, said since)
  }, [bubble, floor]);

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
      .then(({ createOfficeWorld }) => {
        if (dead || !canvas.current) return null;
        return createOfficeWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__OFFICE__ = { api: a, sim: sim.current, complete };
        fit();
        // everything on the graphics chip before it's shown, behind the loading screen
        await a.prepare?.(throttled(setPrep), { alive: () => !dead });
        if (dead) return;
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
      if (s.mode === 'walk' && !s.fire) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      s.hum?.stop();
      s.siren?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const showing = usePageVisible();
  const live = gl === 'on' && inView && showing && !place;

  // at the paper toss or the fact check: out of the others' sight (said
  // every second, as the frame loop that'd say where you are is stopped)
  useEffect(() => {
    if (!place) return undefined;
    const say = () => travRef.current?.pose(sim.current.h, { inside: true, area: areaOf(sim.current.h) }, { force: true });
    say();
    const t = setInterval(say, 1000);
    return () => clearInterval(t);
  }, [place, travRef]);

  // the office's hum: fluorescent tubes, the air, a phone now and then
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop) return;
      s.hum = x.hum();
    });
    return () => {
      stop = true;
      s.hum?.stop();
      s.hum = null;
    };
  }, [live]);
  const [fireOn, setFireOn] = useState(false);
  useEffect(() => {
    if (!live || !fireOn) return undefined;
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
  }, [live, fireOn]);

  const toWalk = useCallback((at) => {
    const s = sim.current;
    s.mode = 'walk';
    s.talking = null;
    s.talk = null;
    if (at) {
      s.h = newWalker(at);
      s.yaw = behindYaw(s.h.face);
      s.snap = true;
    }
    s.dragAt = s.t;
  }, []);

  // ── the jobs ──
  const startFire = useCallback(() => {
    const s = sim.current;
    s.fire = true;
    s.fireT = 0;
    s.carry = null;
    setFireOn(true);
    api.current?.fx('fire');
    shout(SHOUTS.fire, true, { first: clip('fireDrill') }); // (Michael panics first)
  }, [shout]);
  const endFire = useCallback(
    (won) => {
      const s = sim.current;
      s.fire = false;
      setFireOn(false);
      if (won) {
        complete('fire');
        sfx().then((x) => x.applause());
        shout(SHOUTS.fireOut);
        later(() => toWalk({ ...P(703, 196), face: Math.PI / 2 }), 2600);
      } else {
        shout(SHOUTS.fireSlow, true);
        toWalk({ ...spot('seminar'), face: -Math.PI / 2 });
        later(() => startFire(), 1200);
      }
    },
    [complete, later, shout, startFire, toWalk],
  );

  const enter = useCallback(
    (id) => {
      const s = sim.current;
      const has = (q) => doneRef.current.includes(q);
      const open = (q) => progRef.current.quests.find((x) => x.id === q)?.open;
      audioContext();
      setList(false);
      if (id === 'phones') {
        s.mode = 'talk';
        s.talking = 'phones';
        s.talk = newTalk(CONVOS.phones);
        s.erinBreak = true;
        s.deskCam = deskCam('phones');
        sfx().then((x) => x.ring?.());
      } else if (id === 'toss') {
        setPlace('toss');
      } else if (id === 'factcheck') {
        setPlace('factcheck');
        clip('bearsBeets');
      } else if (id === 'fridge') {
        if (has('jello')) return say('Nothing in the fridge but somebody’s yoghurt, labelled “ANGELA. DO NOT.”');
        if (s.carry === 'jello') return say('You’ve got the Jell-O. Now wait for Dwight to leave his desk.');
        if (s.carry === 'chili') return say('Hands full. Chili first.');
        s.carry = 'jello';
        s.dwight = 'away';
        s.dwightT = 0;
        sfx().then((x) => x.knock?.());
        say(`The Jell-O’s set, with a space just the size of a stapler. And Dwight’s just gone to the men’s room. You have ${JELLO.away} seconds.`);
      } else if (id === 'chili') {
        if (s.carry) return say('Hands full.');
        s.carry = 'chili';
        s.chili = newChili();
        clip('undercookOnions');
        say('Kevin’s famous chili. He’s been up all night. Get it to the kitchen without spilling it: steady, no running, easy on the corners.');
      } else if (id === 'kitchen') {
        if (s.carry !== 'chili') return;
        s.carry = null;
        s.chiliDone = true;
        complete('chili');
        sfx().then((x) => x.ding?.());
        shout(SHOUTS.chili);
      } else if (id === 'factdesk') {
        if (s.carry !== 'jello') return;
        s.carry = null;
        s.jelloSet = true;
        api.current?.fx('jello');
        say('The stapler, in Jell-O. Set it down, straighten the nameplate, walk away casually.');
      } else if (id === 'seminar') {
        if (!open('fire') || has('fire')) return;
        toWalk({ ...spot('seminar'), face: -Math.PI / 2 });
        startFire();
      } else if (id === 'dundies') {
        if (!open('dundies')) return say('Michael’s on the phone. To himself, it sounds like. Come back later.');
        s.mode = 'talk';
        s.talking = 'dundies';
        s.talk = newTalk(CONVOS.dundies);
        s.deskCam = deskCam('dundies');
      } else if (id === 'exit') {
        if (s.fire) endFire(true);
      } else if (id === 'downstairs') {
        sfx().then((x) => x.knock?.());
        toWalk(WH_ARRIVE);
        say('Down two flights to the warehouse. It’s colder down here, and louder, and everyone’s looking at your shoes.');
      } else if (id === 'upstairs') {
        sfx().then((x) => x.knock?.());
        toWalk(OFFICE_ARRIVE);
      } else if (id === 'hoop') {
        s.mode = 'hoops';
        s.hoops = newHoops();
        s.h = newWalker({ x: HOOP.x + HOOP.line + 0.3, z: HOOP.z, face: Math.PI });
        s.deskCam = { at: [HOOP.x + HOOP.line + 3.4, 2.15, HOOP.z + 0.9], look: [HOOP.x + 0.4, 2.55, HOOP.z] };
        if (has('hoops')) say('Free throws again. Darryl’s keeping count anyway.');
        else shout(SHOUTS.hoops);
      }
      return undefined;
    },
    [complete, endFire, say, setPlace, shout, startFire, toWalk],
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
        if (s.talking === 'phones') {
          if (/^ok/.test(s.talk.at)) sfx().then((x) => x.ding?.());
          else if (/^c\d/.test(s.talk.at)) sfx().then((x) => x.ring?.());
          else if (/^miss/.test(s.talk.at)) sfx().then((x) => x.knock?.());
        }
        if (s.talking === 'dundies' && s.talk.at === 'twss') clip('twss');
        if (s.talking === 'dundies' && s.talk.at === 'award') {
          api.current?.fx('award');
          sfx().then((x) => x.applause());
        }
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      s.deskCam = null;
      s.mode = 'walk';
      if (which === 'phones') {
        s.erinBreak = false;
        complete('phones');
        say('Five calls, five people. Erin’s back, and Michael tells everyone that Jim “did a Pam”.');
      } else if (which === 'dundies') {
        complete('dundies');
        clip('thankYou');
        sfx().then((x) => x.applause());
        say('The “Best Week in the Office” Dundie is yours. It’s on your desk now, next to the paper balls.');
      }
      setHud((h) => ({ ...h, line: null }));
      return undefined;
    },
    [complete, say],
  );
  // a free throw
  const throwBall = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'hoops' || !s.hoops) return;
    audioContext();
    const kind = shoot(s.hoops);
    if (!kind) return;
    sfx().then((x) => x.knock?.());
  }, []);
  const leaveHoops = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'hoops') return;
    s.hoops = null;
    s.deskCam = null;
    toWalk({ x: HOOP.x + HOOP.line + 1.4, z: HOOP.z, face: 0 });
  }, [toWalk]);

  const leaveTalk = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'talk') return;
    if (s.talking === 'phones') {
      s.erinBreak = false;
      shout(SHOUTS.erinBack);
    }
    s.talking = null;
    s.talk = null;
    s.deskCam = null;
    s.mode = 'walk';
    setHud((h) => ({ ...h, line: null }));
  }, [shout]);

  const lookAt = useCallback(
    (id) => {
      const th = THINGS.find((x) => x.id === id);
      if (!th) return;
      audioContext();
      say(`${th.name}. ${th.line}`);
      if (id === 'mug') clip('likeToBeLiked');
      if (id === 'vending') sfx().then((x) => x.clang?.());
    },
    [say],
  );

  // keys held while the office is live
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
      const onButton = e.target instanceof HTMLButtonElement;
      if (s.mode === 'walk') {
        if (moveOf(e)) {
          e.preventDefault();
          audioContext();
          return;
        }
        if ((k === 'e' || k === 'E' || k === 'Enter') && !onButton && (s.near || s.thing)) {
          e.preventDefault();
          if (s.near) enter(s.near);
          else lookAt(s.thing);
        } else if (k === 'm' || k === 'M') setList((v) => !v);
        return;
      }
      if (s.mode === 'hoops') {
        if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !e.repeat && !onButton) {
          e.preventDefault();
          throwBall();
        } else if (k === 'Escape') leaveHoops();
        return;
      }
      if (s.talk) {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          talkOnward(Number(k) - 1);
        } else if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'E') && !onButton) {
          e.preventDefault();
          talkOnward();
        } else if (k === 'Escape') leaveTalk();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [live, enter, talkOnward, leaveTalk, lookAt, throwBall, leaveHoops]);


  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    const dt = Math.min(0.05, ms / 1000);
    s.t += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};
    const runners = [];
    const ambling = [];

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
        if (pressed('a') && (s.near || s.thing)) s.near ? enter(s.near) : lookAt(s.thing);
        if (pressed('y')) setList((v) => !v);
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = walker.step(s.h, { x: mv.x, z: mv.z, run }, dt);
      // the panicking in the fire, and whoever's up from their desk, are in the way too
      if (s.lastRunners?.length) {
        let { x, z } = s.h;
        for (const r of s.lastRunners) {
          const d = Math.hypot(x - r.x, z - r.z);
          if (d < 0.62 && d > 1e-4) {
            x = r.x + ((x - r.x) / d) * 0.62;
            z = r.z + ((z - r.z) / d) * 0.62;
          }
        }
        [x, z] = walker.push(x, z);
        s.h = { ...s.h, x, z };
      }
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // footsteps, by what's underfoot
      s.stepDist = (s.stepDist ?? 0) + s.h.speed * dt;
      const stride = s.h.running ? 0.95 : 0.72;
      if (s.h.speed > 0.4 && s.stepDist > stride) {
        s.stepDist = 0;
        const r = s.room;
        const floor = r === 'lot' ? 'asphalt' : r === 'warehouse' || r === 'stairs' ? 'concrete' : r === 'hallway' || r === 'men' || r === 'women' || r === 'lobby' ? 'tile' : 'carpet';
        sounds().then((x) => x.step?.(floor, s.h.running));
      }
      const room = a.suggestYaw;
      if (room != null && s.t - s.dragAt > 1.2) {
        let d = room - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 2.4);
        s.roomAt = s.t;
      }
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.2 && s.t - (s.roomAt ?? -9) > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.8);
      }
    }

    // the chili, sloshing
    if (s.carry === 'chili') {
      s.chili = stepChili(s.chili, s.h, dt);
      if (s.chili.spilt) {
        a.fx('spill', { x: s.h.x + Math.cos(s.h.face) * 0.6, z: s.h.z - Math.sin(s.h.face) * 0.6 });
        s.carry = null;
        clip('noGod');
        say('Over the brim, onto the carpet. Kevin’s chili. Kevin’s famous chili. There’s more back at the lift. (There isn’t, but go on.)', true);
      }
    }
    // Dwight's trip to the men's room
    if (s.dwight === 'away') {
      s.dwightT += dt;
      if (s.dwightT > JELLO.away) {
        s.dwight = 'back';
        s.dwightT = 0;
        if (!s.jelloSet) say('The men’s room door. Dwight’s on his way back. Too late for the stapler this time.', true);
      }
    } else if (s.dwight === 'back') {
      s.dwightT += dt;
      s.dwightK = Math.min(1, s.dwightT / JELLO.walk);
      const d = seatOf('dwight');
      // walked back to find Jim still standing at his desk, Jell-O in hand
      if (s.dwightK > 0.85 && s.carry === 'jello' && Math.hypot(s.h.x - d.chair.x, s.h.z - d.chair.z) < 1.6) {
        a.fx('caught');
        shout(SHOUTS.caught, true, { first: clip('identityTheft') });
        s.carry = null;
      }
      if (s.dwightK >= 1) {
        s.dwight = 'desk';
        if (s.carry === 'jello') {
          s.carry = null;
          say('Dwight’s back at his desk. The Jell-O goes back in the fridge for another day.', true);
        }
        if (s.jelloSet && !doneRef.current.includes('jello')) {
          complete('jello');
          const punish = clip('dwightPunish');
          hold(punish.then((h) => h?.ended));
          later(() => shout(SHOUTS.jello, false, { first: punish }), 800);
        }
      }
    }
    // free throws: the meter, the ball in flight, the count
    let ballAt = null;
    if (s.mode === 'hoops' && s.hoops) {
      const hh = s.hoops;
      const res = stepHoops(hh, dt);
      if (res === 'in') {
        sfx().then((x) => x.ding?.());
        a.fx('pop', { x: HOOP.x, y: HOOP.y, z: HOOP.z, colour: 'gold' });
      } else if (res === 'out') sfx().then((x) => x.knock?.());
      if (res && hh.over) {
        const won = hh.made >= HOOPS.need;
        if (won) {
          complete('hoops');
          sfx().then((x) => x.applause());
          shout(SHOUTS.hoopsWon, false, { shown: `${hh.made} of ${hh.shots}. ${SHOUTS.hoopsWon.say}` });
        } else shout(SHOUTS.hoopsLost, true, { shown: `${hh.made} of ${hh.shots}. ${SHOUTS.hoopsLost.say}` });
        later(() => {
          const ss = sim.current;
          if (ss.mode !== 'hoops') return;
          if (won) leaveHoops();
          else ss.hoops = newHoops();
        }, 2200);
      }
      // the ball: in flight on its arc, or in Jim's hands
      const start = { x: s.h.x - 0.35, y: 1.75, z: s.h.z };
      if (hh.ball) {
        const k = Math.min(1, hh.ball.t / HOOPS.flight);
        const miss = hh.ball.kind === 'short' ? -0.55 : hh.ball.kind === 'long' ? 0.5 : 0;
        const end = { x: HOOP.x + miss * -1, y: HOOP.y + (hh.ball.kind === 'short' ? -0.35 : 0.05), z: HOOP.z };
        const after = Math.max(0, k - 0.82) / 0.18; // through the net and down
        ballAt = {
          x: start.x + (end.x - start.x) * k,
          y: start.y + (end.y - start.y) * k + Math.sin(Math.PI * Math.min(1, k / 0.82)) * 1.7 - after * 1.2,
          z: start.z + (end.z - start.z) * k + (hh.ball.kind === 'long' ? k * 0.4 : 0),
          spin: true,
        };
      } else ballAt = start;
    }
    // the fire drill's clock
    if (s.fire) {
      s.fireT += dt;
      if (s.fireT >= FIRE.time) endFire(false);
    }

    // what's here: a job, or a thing to look at
    let spotHere = null;
    let thing = null;
    s.room = roomAt(s.h.x, s.h.z);
    if (s.mode === 'walk') {
      const has = (q) => doneRef.current.includes(q);
      const open = (q) => p.quests.find((x) => x.id === q)?.open;
      if (s.fire) {
        const ex = spot('exit');
        spotHere = Math.hypot(s.h.x - ex.x, s.h.z - ex.z) < ex.r ? 'exit' : null;
      } else {
        const candidates = SPOTS.filter((sp) => {
          if (sp.id === 'phones') return !has('phones');
          if (sp.id === 'toss') return true;
          if (sp.id === 'factcheck') return s.carry !== 'jello';
          if (sp.id === 'fridge') return !has('jello') && !s.carry;
          if (sp.id === 'chili') return !has('chili') && !s.carry && !s.chiliDone;
          if (sp.id === 'kitchen') return s.carry === 'chili';
          if (sp.id === 'seminar') return open('fire') && !has('fire');
          if (sp.id === 'dundies') return open('dundies') && !has('dundies');
          if (sp.id === 'downstairs' || sp.id === 'upstairs') return !s.carry;
          if (sp.id === 'hoop') return !s.carry;
          return false;
        });
        const sp = nearest(candidates, s.h.x, s.h.z);
        spotHere = sp?.id ?? null;
        // with the Jell-O, at Dwight's desk while he's away: set it down
        if (s.carry === 'jello' && s.dwight === 'away') {
          const d = spot('factcheck');
          if (Math.hypot(s.h.x - d.x, s.h.z - d.z) < d.r + 0.2) spotHere = 'factdesk';
        }
        if (!spotHere) thing = nearest(THINGS, s.h.x, s.h.z)?.id ?? null;
      }
    }
    s.near = spotHere;
    s.thing = thing;
    // who's near: their line, in a bubble over their head
    let person = null;
    if (s.mode === 'walk' && !s.fire) {
      // (whoever's up from their desk is wherever they've got to)
      const up = new Map((s.lastAmbling ?? []).map((a) => [a.id, a]));
      const here = CAST.filter((c) => !(c.id === 'erin' && s.erinBreak) && !(c.id === 'dwight' && s.dwight !== 'desk')).map((c) => (up.has(c.id) ? { ...c, x: up.get(c.id).x, z: up.get(c.id).z } : c));
      person = nearest(here, s.h.x, s.h.z, 1.9)?.id ?? null;
    }
    if (person !== s.person) {
      s.person = person;
      if (person) {
        const n = lines.current[person] ?? 0;
        lines.current[person] = n + 1;
        const ls = LINES[person];
        let line = ls[n % ls.length];
        if (person === 'kevin' && !doneRef.current.includes('chili') && s.carry !== 'chili') line = ASKS.kevin;
        if (person === 'erin' && !doneRef.current.includes('phones')) line = ASKS.erin;
        if (person === 'michael' && progRef.current.quests.find((q) => q.id === 'dundies')?.open && !doneRef.current.includes('dundies')) line = ASKS.michael;
        setBubble({ id: person, name: NAMES[person], line });
        s.wave = n === 0 ? person : null;
      } else {
        setBubble(null);
        s.wave = null;
      }
    }

    // markers on the map: where to go next
    const has = (q) => doneRef.current.includes(q);
    const markers = s.fire
      ? [spot('exit')]
      : s.carry === 'jello'
        ? [spot('factcheck')]
        : s.carry === 'chili'
          ? [spot('kitchen')]
          : [
              !has('phones') && spot('phones'),
              !has('jello') && spot('fridge'),
              !has('chili') && spot('chili'),
              !has('toss') && spot('toss'),
              !has('factcheck') && spot('factcheck'),
              !has('hoops') && (inWarehouse(s.h.x, s.h.z) ? spot('hoop') : spot('downstairs')),
              p.quests.find((q) => q.id === 'fire')?.open && !has('fire') && spot('seminar'),
              p.quests.find((q) => q.id === 'dundies')?.open && !has('dundies') && spot('dundies'),
            ].filter(Boolean);

    // others online: where you are to them (out of sight at the phones, in
    // Michael's office and at the free throws), and where they are
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.mode !== 'walk', area: areaOf(s.h) });

    try {
      a.render(
        {
          jim: s.h,
          travellers: tv ? tv.list() : null,
          mode: s.mode,
          carry: s.carry,
          slosh: s.chili.slosh,
          chiliDone: s.chiliDone || has('chili'),
          jelloSet: s.jelloSet || has('jello'),
          dwight: s.dwight,
          dwightK: s.dwightK,
          erinBreak: s.erinBreak,
          fire: s.fire,
          fireT: s.fireT,
          runners,
          talkTo: s.talking === 'dundies' ? 'michael' : s.talking === 'phones' ? null : s.person,
          wave: s.wave,
          deskCam: s.deskCam,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 3.8 : 3.4,
          snapCam: s.snap,
          ballAt,
          markers,
          ambling,
          debugCam: s.debugCam,
          warp: s.warp,
        },
        ms,
      );
      s.lastAmbling = ambling;
      s.warp = 0;
      s.snap = false;
      s.wave = null;
      s.lastRunners = runners;
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    const slosh = s.carry === 'chili' ? Math.round((s.chili.slosh / CHILI.brim) * 20) : -1;
    const hk = s.hoops ? [s.hoops.shots, s.hoops.made, !!s.hoops.ball, s.hoops.over].join(',') : '';
    const key = [hk, s.mode, s.near, s.thing, s.moved, s.talking, s.talk?.at, s.carry, slosh, s.dwight, s.dwight === 'away' ? Math.ceil(JELLO.away - s.dwightT) : 0, s.fire, s.fire ? fireLeft(s.fireT) : 0, s.room].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ mode: s.mode, near: s.near, thing: s.thing, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, carry: s.carry, slosh: Math.max(0, slosh) / 20, dwight: s.dwight, dwightLeft: Math.max(0, Math.ceil(JELLO.away - s.dwightT)), fire: s.fire, fireLeft: fireLeft(s.fireT), room: s.room, hoops: s.hoops ? { shots: s.hoops.shots, made: s.hoops.made, flying: !!s.hoops.ball, over: s.hoops.over } : null });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf(s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) {
      const wh = inWarehouse(s.h.x, s.h.z);
      const c = wh ? WH_C : { x: BOUNDS.cx, z: BOUNDS.cz };
      const here = markers.filter((m) => inWarehouse(m.x, m.z) === wh);
      drawMap(map.current, { scale: wh ? WH_SCALE : MAP_SCALE, h: { ...s.h, x: s.h.x - c.x, z: s.h.z - c.z }, markers: here.map((m) => ({ ...m, x: m.x - c.x, z: m.z - c.z })), night: s.fire, base: wh ? drawWarehouse : drawFloor(s.fire) });
    }
    if (s.frame % 120 === 0 && s.mode === 'walk' && !s.fire) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // drag to look round
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
      s.pitch = Math.max(0.02, Math.min(0.62, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };
  const onStick = (x, y) => (sim.current.stick = { x, y });

  // the list's "go there"
  const travel = (q) => {
    const at = { phones: spot('phones'), jello: spot('fridge'), chili: spot('chili'), toss: spot('toss'), factcheck: spot('factcheck'), fire: spot('seminar'), dundies: spot('dundies'), hoops: spot('hoop') }[q.id];
    if (!at) return;
    toWalk({ x: at.x, z: at.z + 0.6, face: Math.PI / 2 });
    setList(false);
  };

  const PROMPT = {
    phones: ['Reception', 'Cover the phones'],
    toss: ['Your desk', 'Office Olympics: paper toss'],
    factcheck: ['Dwight’s desk', 'Dwight’s fact check'],
    factdesk: ['Dwight’s desk', 'Set the stapler in Jell-O'],
    fridge: ['The kitchen fridge', 'Take the Jell-O'],
    chili: ['Kevin’s chili', 'Pick it up, carefully'],
    kitchen: ['The kitchen counter', 'Set the chili down'],
    seminar: ['The conference room', 'Dwight’s fire safety seminar'],
    exit: ['The stairwell', 'Get out!'],
    downstairs: ['The stairwell', 'Down to the warehouse'],
    upstairs: ['The stairs', 'Up to the office'],
    hoop: ['The free-throw line', 'Shoot some free throws'],
    dundies: ['Michael’s office', 'Go in'],
  };
  const here = hud.near ? PROMPT[hud.near] : null;
  const thingHere = !here && hud.thing ? THINGS.find((x) => x.id === hud.thing) : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const objective = hud.fire
    ? `Fire! Out by the stairwell, past the kitchen: ${hud.fireLeft}s.`
    : hud.carry === 'chili'
      ? 'Kevin’s chili, to the kitchen counter. Steady. No running.'
      : hud.carry === 'jello'
        ? hud.dwight === 'away'
          ? `Dwight’s in the men’s room. Set the stapler in Jell-O at his desk: ${hud.dwightLeft}s.`
          : 'Dwight’s back. Put the Jell-O away and try again later.'
        : prog.objective;
  return (
    <div ref={box} className="shire-stage dm-stage" data-touch={touch || undefined} data-mode={mode} data-fire={hud.fire || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="The Dunder Mifflin Scranton office in 3D: the bullpen's desks under fluorescent lights, reception, Michael's glass-fronted office and the conference room, with Jim Halpert walking among his coworkers" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Clocking in at Dunder Mifflin" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <p className="dm-kicker">Dunder Mifflin · Scranton</p>
            <h1 id="dm-title" className="shire-title">
              The Office
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">◆</span> {objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map dm-map" width="150" height="150" aria-hidden="true" />
            {hud.room && <p className="dm-room">{ROOM_NAMES[hud.room]}</p>}
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <Visitors trav={trav} />
            {hud.carry === 'chili' && (
              <div className="shire-meter dm-slosh" role="meter" aria-label="How close the chili is to spilling" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.slosh * 100)}>
                <span className="shire-meter-label">Chili</span>
                <span className="shire-meter-bar">
                  <span style={{ transform: `scaleX(${hud.slosh})` }} />
                </span>
              </div>
            )}
            {hud.fire && <p className="shire-chip dm-alarm">Fire drill · {hud.fireLeft}s</p>}
            {hud.carry === 'jello' && hud.dwight === 'away' && <p className="shire-chip dm-timer">Dwight back in {hud.dwightLeft}s</p>}
          </div>
        </div>
      )}
      {!walking && <h1 id="dm-title" className="sr-only">The Office</h1>}

      {toast && (
        <p className="shire-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}

      {bubble && walking && <Bubble ref={bubbleRef} name={bubble.name} line={bubble.line} />}

      {(here || thingHere) && walking && (
        <div className="shire-door">
          <p className="shire-door-name">{here ? here[0] : thingHere.name}</p>
          <button type="button" className="btn btn-primary" onClick={() => (here ? enter(hud.near) : lookAt(hud.thing))}>
            {!touch && <kbd className="key-first">E</kbd>} {here ? here[1] : 'Look'}
          </button>
        </div>
      )}

      {gl === 'on' && walking && !hud.moved && !here && !thingHere && <p className="shire-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}<GuideCue touch={touch} /></p>}

      {node && mode === 'talk' && (
        <Convo
          className="dm-convo"
          title={hud.talking === 'phones' ? `Reception · call ${Math.min(CALL_COUNT, callOf(hud.line) + 1)} of ${CALL_COUNT}` : 'Michael’s office'}
          name={node.who === 'narrator' || node.told ? '' : (SPEAKERS[node.who] ?? '')}
          node={node}
          touch={touch}
          onPick={(i) => talkOnward(i)}
          onNext={() => talkOnward()}
          onLeave={leaveTalk}
        />
      )}

      {mode === 'hoops' && hud.hoops && <Hoops hud={hud.hoops} touch={touch} sim={sim} onShoot={throwBall} onLeave={leaveHoops} />}

      {walking && touch && <Stick onMove={onStick} />}

      {list && <QuestList title="This week at Dunder Mifflin" quests={prog.quests.map((q) => ({ ...q, blurb: q.go }))} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && !hud.fire && !hud.carry} />}
    </div>
  );
}

// the free throws' panel: the count, the meter (its needle moved straight
// from the sim each frame), Shoot and the way out
function Hoops({ hud, touch, sim, onShoot, onLeave }) {
  const needle = useRef(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const h = sim.current?.hoops;
      if (h && needle.current) needle.current.style.left = `${(meterAt(h) * 100).toFixed(1)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
  return (
    <div className="shire-panel dm-hoops">
      <p className="shire-panel-title">Office vs. warehouse</p>
      <p className="shire-panel-stats">
        <span>
          In <b>{hud.made}</b> of {HOOPS.need} needed
        </span>
        <span>
          Shots <b>{hud.shots}</b> of {HOOPS.shots}
        </span>
      </p>
      <div className="dm-meter" aria-hidden="true">
        <span className="dm-meter-sweet" style={{ left: `${(HOOPS.sweet - HOOPS.rim) * 100}%`, width: `${HOOPS.rim * 200}%` }} />
        <span className="dm-meter-swish" style={{ left: `${(HOOPS.sweet - HOOPS.swish) * 100}%`, width: `${HOOPS.swish * 200}%` }} />
        <span ref={needle} className="dm-meter-needle" />
      </div>
      <p className="shire-panel-help">{touch ? 'Tap Shoot with the needle in the green.' : 'Space (or Shoot) with the needle in the green.'}</p>
      <div className="shire-panel-row">
        <button type="button" className="btn btn-primary btn-sm" disabled={hud.flying || hud.over} onPointerDown={(e) => (e.preventDefault(), onShoot())} onClick={(e) => e.detail === 0 && onShoot()}>
          Shoot
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLeave}>
          Done {!touch && <kbd>Esc</kbd>}
        </button>
      </div>
    </div>
  );
}

// the warehouse on the corner map: its floor, the racks
function drawWarehouse(g, at) {
  const [x, z] = at(WAREHOUSE.x - WH_C.x, WAREHOUSE.z - WH_C.z);
  g.fillStyle = '#9b9890';
  g.fillRect(x, z, WAREHOUSE.w * WH_SCALE, WAREHOUSE.d * WH_SCALE);
  g.fillStyle = '#1f5fa8';
  for (const r of RACKS) {
    const [rx, rz] = at(r.x - r.w / 2 - WH_C.x, r.z - r.d / 2 - WH_C.z);
    g.fillRect(rx, rz, r.w * WH_SCALE, r.d * WH_SCALE);
  }
  g.strokeStyle = '#3d4350';
  g.lineWidth = 1.5;
  g.strokeRect(x, z, WAREHOUSE.w * WH_SCALE, WAREHOUSE.d * WH_SCALE);
}

// where the camera sits for a job at a desk
function deskCam(job) {
  if (job === 'phones') {
    const a = P(205, 248);
    const b = P(176, 196);
    return { at: [a.x, 1.75, a.z], look: [b.x, 1.05, b.z] };
  }
  const m = seatOf('michael');
  return { at: [m.x + 0.3, 1.7, m.z + 2.6], look: [m.chair.x, 1.2, m.chair.z] };
}

// the floor on the corner map: the rooms, the walls; red in the fire
const drawFloor = (fire) => (g, at) => {
  const room = (r, col) => {
    const m = rect(r);
    const [x, z] = at(m.x - BOUNDS.cx, m.z - BOUNDS.cz);
    g.fillStyle = col;
    g.fillRect(x, z, m.w * MAP_SCALE, m.d * MAP_SCALE);
  };
  for (const [id, r] of Object.entries(ROOMS)) room(r, fire ? '#4a2a2a' : id === 'hallway' || id === 'men' || id === 'women' || id === 'lobby' ? '#d9d4c6' : id === 'stairs' ? '#9c9a92' : '#b8c0cf');
  g.strokeStyle = fire ? '#ff7a6a' : '#3d4350';
  g.lineWidth = 1.2;
  g.beginPath();
  for (const [x0, z0, x1, z1] of WALLS) {
    g.moveTo(...at(x0 - BOUNDS.cx, z0 - BOUNDS.cz));
    g.lineTo(...at(x1 - BOUNDS.cx, z1 - BOUNDS.cz));
  }
  g.stroke();
  // the doorways, as gaps (drawn over in the floor's colour)
  g.strokeStyle = fire ? '#4a2a2a' : '#b8c0cf';
  g.lineWidth = 2;
  for (const d of DOORS) {
    const half = (d.w / 2) * 0.8;
    g.beginPath();
    if (d.along === 'x') {
      g.moveTo(...at(d.x - half - BOUNDS.cx, d.z - BOUNDS.cz));
      g.lineTo(...at(d.x + half - BOUNDS.cx, d.z - BOUNDS.cz));
    } else {
      g.moveTo(...at(d.x - BOUNDS.cx, d.z - half - BOUNDS.cz));
      g.lineTo(...at(d.x - BOUNDS.cx, d.z + half - BOUNDS.cz));
    }
    g.stroke();
  }
};

// The paper toss and the fact check, over the office.
function Place({ id, onClose, complete }) {
  const shell = useRef(null);
  useEffect(() => {
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    const from = document.activeElement;
    shell.current?.focus({ preventScroll: true });
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      html.style.overflow = was;
      window.removeEventListener('keydown', esc);
      if (from instanceof HTMLElement) from.focus({ preventScroll: true });
    };
  }, [onClose]);
  const title = id === 'toss' ? 'Office Olympics' : 'Dwight’s fact check';
  const where = id === 'toss' ? 'Your desk · paper toss' : 'Dwight’s desk';
  return createPortal(
    <div ref={shell} className="dm-place" role="dialog" aria-modal="true" aria-labelledby="dm-place-title" tabIndex={-1}>
      <header className="dm-place-head">
        <div>
          <p className="dm-place-where">{where}</p>
          <h2 id="dm-place-title" className="dm-place-title">
            {title}
          </h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Back to the office <kbd>Esc</kbd>
        </button>
      </header>
      <div className="dm-place-body shell py-6 md:py-10">
        <Suspense fallback={<p className="dm-place-wait">Getting it out of the drawer…</p>}>
          {id === 'toss' ? (
            <PaperToss
              onDone={(score) => {
                if (score > 0) complete('toss');
              }}
            />
          ) : (
            <FactCheck onDone={() => complete('factcheck')} />
          )}
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}

// Without 3D: the week's jobs, as cards (the two games still open).
function Cards({ prog, three, gl, retry, open }) {
  return (
    <div className="shell shire-cards-wrap dm-cards">
      <p className="eyebrow">Dunder Mifflin · Scranton</p>
      <h1 id="dm-title" className="title mt-3">
        The Office
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The Scranton branch, to walk about in 3D as Jim. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the office as cards.' : gl === 'failed' ? 'The 3D office couldn’t start here, so here it is as cards.' : three.held ? 'The 3D office isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s the office as cards.'}
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
      <ul className="dm-card-list mt-8">
        {prog.quests.map((q) => (
          <li key={q.id} className="dm-card" data-done={q.done || undefined}>
            <p className="dm-card-name">{q.name}</p>
            <p className="dm-card-go">{q.go}</p>
            {q.id === 'toss' && (
              <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => open('toss')}>
                Play the paper toss
              </button>
            )}
            {q.id === 'factcheck' && (
              <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => open('factcheck')}>
                Take the fact check
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Others online in the office: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as on the universe map).
function Visitors({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="shire-chip town-travellers" onClick={trav.join} title="Go online, and see everyone else in the office as a pale Jim from another branch">
        See other visitors
      </button>
    );
  return (
    <span className="shire-chip town-travellers" data-on title="Everyone else online in the office shows as a pale Jim from another branch: they can’t touch your jobs, nor you theirs">
      <b>{trav.count}</b> {trav.count === 1 ? 'visitor' : 'visitors'} here
    </span>
  );
}
