import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';
import { readPad, typing } from '../../../games/pad';
import { Convo, QuestList, Stick, Travellers } from '../TownHud';
import { useTravellers } from '../useTravellers';
import { SideList } from '../SideList';
import { readSide, recordSide } from '../side';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { newTalk, talkNode, talkOn } from '../talk';
import { sayInTurn } from '../voice';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { CROSS, CROSS_COLLIDERS, CROSS_START, CROSS_WALLS, FOOT, covered, validAt } from './layout';
import { CONVOS, QUESTS, REMEMBER_SAYS, SAYS, SEAL, SIDE, SPEAKERS, doomProgress } from './story';
import { CARRY, FLIGHT, HANG, MARCH, RECALL, SHIRE, carryStep, newCarry, newFlight, newHang, newMarch, newRecall, newSearch, recall, stepCarry, stepFlight, stepHang, stepMarch, stepRecall, stepSearch, telling } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './doom.css';
import '../../../../styles/lazy/middleearth.css';
import GuideCue from '../../../guide/GuideCue';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Mordor and Mount Doom, the end of the road: the orc column, across
// Gorgoroth under the Eye, Sam carrying Frodo up the mountain, the Crack of
// Doom, and the eagles. The places are in ./layout.js, the story in
// ./story.js, the games in ./rules.js, the drawing in ./scene.js; this is
// the walking, the HUD, the talk and the games. Without 3D, the scenes are
// listed as cards.

const DONE = 'tp-doom-done';
const AT = 'tp-doom-at';
// do you remember the Shire, on the side: { won, best } (best: fewest slips)
const SIDE_KEY = 'tp-doom-side';
const sounds = () => import('./sounds');
const walker = makeWalker({ radius: 300, centre: [(CROSS.west + CROSS.east) / 2, (CROSS.north + CROSS.south) / 2], colliders: CROSS_COLLIDERS, walls: CROSS_WALLS });
const PROMPT = {
  column: { name: 'The road into Gorgoroth', act: 'Go down' },
  carry: { name: 'The foot of the mountain', act: 'Carry him' },
  crack: { name: 'The door in the mountain', act: 'Go in' },
  eagles: { name: 'The mountain is falling', act: 'Out to the rock' },
};

// how many things of the Shire Frodo has said back so far, all together
const remembered = (r) => (r.state === 'remembered' ? RECALL.length : r.round > RECALL.first ? r.round - 1 : 0);

export default function DoomWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return doomProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = doomProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = doomProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  // remembering the Shire, on the side: kept apart from the story's progress
  const [side, setSide] = useState(() => readSide(local.get(SIDE_KEY, null)));
  const recordGo = useCallback(
    (go) => {
      setSide((was) => {
        const { won, best } = recordSide(was, go, { low: true });
        local.set(SIDE_KEY, { won, best });
        return { won, best };
      });
      if (go.won) unlock(SIDE.seal);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world doom-world" aria-labelledby="doom-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} complete={complete} side={side} recordGo={recordGo} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, complete, side, recordGo, gl, setGl, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  // other travellers online crossing Gorgoroth, as ghosts (../useTravellers);
  // the crossing is some 760 m west of the mountain, the world's middle
  const trav = useTravellers('doom', gl === 'on', { bound: 800 });
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const zone = prog.zone;
    const at = validAt(local.get(AT, null));
    const h = newWalker(at);
    sim.current = { zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.34, dragAt: -1e9, mode: prog.finished ? 'end' : 'walk', talking: null, talk: null, near: null, frame: 0, moved: false, t: 0, stepT: 0, air: null, padBefore: null, march: null, search: null, carry: null, hang: null, flight: null, busy: false, push: 0, steer: 0, reach: 0, foot: 0, erupt: prog.done.includes('crack') ? 1 : 0, saw: false, recall: null, from: null, said: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [list, setList] = useState(false);
  // a toast; and `who`, whose words are in it, says them (lib/voiced.js)
  const say = useCallback((text, bad = false, who = null) => {
    setToast({ text, bad, at: Date.now() });
    if (who) sayVoiced(who, text);
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
      .then(({ createDoomWorld }) => {
        if (dead || !canvas.current) return null;
        return createDoomWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__DOOM__ = { api: a, sim: sim.current, complete };
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
      if (s.mode === 'walk' && s.search) local.set(AT, { zone: 'plain', x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.air();
      s.air.place(s.zone);
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
  const place = useCallback((zone) => {
    const s = sim.current;
    s.zone = zone;
    s.busy = false;
    s.air?.place(zone);
  }, []);

  const startMarch = useCallback(() => {
    const s = sim.current;
    place('plain');
    s.mode = 'march';
    s.march = newMarch();
    sounds().then((x) => x.drum(1));
  }, [place]);
  const startCross = useCallback(() => {
    const s = sim.current;
    place('plain');
    s.mode = 'walk';
    s.h = newWalker(CROSS_START);
    s.yaw = behindYaw(CROSS_START.face);
    s.search = newSearch(CROSS_START.x + 40);
    s.saw = false;
  }, [place]);
  const startCarry = useCallback(() => {
    const s = sim.current;
    place('slope');
    s.search = null;
    s.mode = 'carry';
    s.carry = newCarry();
  }, [place]);
  const startCrack = useCallback(() => {
    const s = sim.current;
    place('crack');
    s.carry = null;
    s.erupt = 0;
    startTalk('crack');
  }, [place, startTalk]);
  const startHang = useCallback(() => {
    const s = sim.current;
    place('crack');
    s.mode = 'hang';
    s.hang = newHang(Math.floor(Math.random() * 1000) + 1);
    s.saw = false;
  }, [place]);
  const startRefuge = useCallback(() => {
    const s = sim.current;
    place('slope');
    s.hang = null;
    s.erupt = 1;
    startTalk('refuge');
  }, [place, startTalk]);
  const startFlight = useCallback(() => {
    const s = sim.current;
    place('slope');
    s.mode = 'flight';
    s.flight = newFlight();
    s.erupt = 1;
    sounds().then((x) => x.eagle());
  }, [place]);

  // do you remember the Shire? Resting at the mountain's foot; what's said
  // there, in the speakers' voices, and then what Sam says back to it
  // (./voicelines.js)
  const rememberSay = useCallback((said) => {
    sim.current.said = said;
    sayInTurn([said, said.then].filter(Boolean).map((l) => ({ who: l.who, text: l.say })));
  }, []);
  const startRemember = useCallback(() => {
    const s = sim.current;
    audioContext();
    if (s.mode !== 'remember') s.from = { zone: s.zone, mode: s.mode };
    place('plain');
    s.mode = 'remember';
    s.recall = newRecall(Math.floor(Math.random() * 1000) + 1);
    rememberSay(REMEMBER_SAYS.start);
    setList(false);
  }, [place, rememberSay]);
  const leaveRemember = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'remember') return;
    const from = s.from ?? { zone: 'slope', mode: 'walk' };
    s.recall = null;
    s.from = null;
    place(from.zone);
    s.mode = from.mode === 'end' ? 'end' : 'walk';
  }, [place]);
  // Frodo says one back: i is the thing of the Shire (SHIRE)
  const sayBack = useCallback(
    (i) => {
      const s = sim.current;
      const r = s.recall;
      if (s.mode !== 'remember' || !r || !SHIRE[i]) return;
      const res = recall(r, SHIRE[i].id);
      if (!res) return;
      if (res === 'wrong') {
        sounds().then((x) => x.forget());
        rememberSay(REMEMBER_SAYS.wrong);
        return;
      }
      sounds().then((x) => x.memory(i));
      api.current?.fx('recall');
      if (res === 'right') rememberSay(REMEMBER_SAYS.right);
      else if (res === 'round') rememberSay(REMEMBER_SAYS.round(r.round - 1));
      else if (res === 'remembered') {
        rememberSay(REMEMBER_SAYS.won(r.slips));
        sounds().then((x) => x.done());
        recordGo({ won: true, score: r.slips });
      }
    },
    [recordGo, rememberSay],
  );

  const enter = useCallback(
    (id) => {
      audioContext();
      if (id === 'column') startTalk('column');
      else if (id === 'carry') startCarry();
      else if (id === 'crack') startCrack();
      else if (id === 'eagles') startRefuge();
      setList(false);
    },
    [startTalk, startCarry, startCrack, startRefuge],
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
        if (s.talking === 'crack' && s.talk.at === 'fall') sounds().then((x) => x.precious());
        if (s.talking === 'done' && s.talk.at === 'done') {
          api.current?.fx('erupt');
          sounds().then((x) => x.quake());
        }
        if (s.talking === 'refuge' && s.talk.at === 'eagles') sounds().then((x) => x.eagle());
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'column') startMarch();
      else if (which === 'halt') {
        complete('column');
        s.march = null;
        startCross();
        say('Out of the column. East, to the mountain, from rock to rock: keep in the shadow on the side away from the Tower when the light comes.', false);
      } else if (which === 'foot') startCarry();
      else if (which === 'door') {
        complete('carry');
        startCrack();
      } else if (which === 'crack') startHang();
      else if (which === 'done') {
        complete('crack');
        startRefuge();
      } else if (which === 'refuge') startFlight();
      else s.mode = 'walk';
      return undefined;
    },
    [complete, say, startCarry, startCrack, startCross, startFlight, startHang, startMarch, startRefuge],
  );

  const doStep = useCallback(
    (foot) => {
      const s = sim.current;
      if (s.mode !== 'carry' || !s.carry || s.busy) return;
      const r = carryStep(s.carry, foot);
      if (r === 'step') sounds().then((x) => x.step());
      else if (r === 'stumble') {
        api.current?.fx('stumble');
        sounds().then((x) => x.slide());
        say('The same foot twice: you stumble, and nearly drop him. Left, right, left…', true);
      } else if (r === 'slide') {
        api.current?.fx('stumble');
        sounds().then((x) => x.slide());
        say('You step while it shakes, and the cinders slide away under you. Stand still till it stops!', true);
      } else if (r === 'top') startTalk('door');
    },
    [say, startTalk],
  );

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [enter]);

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
      if (s.mode === 'remember') {
        if (/^[1-8]$/.test(k) && !e.repeat) {
          e.preventDefault();
          sayBack(Number(k) - 1);
        } else if (k === 'Escape') leaveRemember();
        else if ((k === 'r' || k === 'R') && s.recall?.state === 'remembered') startRemember();
        return;
      }
      if (s.mode === 'carry' && !e.repeat) {
        if (['a', 'A', 'ArrowLeft'].includes(k)) doStep('left');
        else if (['d', 'D', 'ArrowRight'].includes(k)) doStep('right');
        return;
      }
      if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
        if (s.mode === 'walk' && s.near) {
          e.preventDefault();
          doAct();
        } else if (s.mode === 'hang') e.preventDefault();
      } else if ((k === 'm' || k === 'M') && (s.mode === 'walk' || s.mode === 'end')) setList((v) => !v);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, talkOnward, doAct, doStep, sayBack, leaveRemember, startRemember]);

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
    let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
    let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
    if (pad) {
      fwd -= pad.ly;
      side += pad.lx;
    }

    // across the plain
    if (s.mode === 'walk' && s.search && !s.busy) {
      if (pad) {
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
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
      const hidden = covered(s.h.x, s.h.z);
      s.hidden = hidden;
      for (const e of stepSearch(s.search, dt, s.h, hidden)) {
        if (e.type === 'near' && !s.saw) {
          s.saw = true;
          say('The Eye’s light is sweeping this way. Into a rock’s shadow, on the side away from the Tower!', true);
        } else if (e.type === 'seen') sounds().then((x) => x.eye());
        else if (e.type === 'found') {
          s.busy = true;
          a.fx('found');
          say('The Eye is on you, and the Ring burns, and Frodo falls. Sam drags him back into the rocks… Again: keep to the shadows.', true);
          later(() => sim.current?.search && startCross(), 2400);
        }
      }
      if (Math.hypot(s.h.x - FOOT.x, s.h.z - FOOT.z) < FOOT.r) {
        complete('gorgoroth');
        s.search = null;
        startTalk('foot');
      }
    }

    // in the column
    if (s.mode === 'march' && s.march && !s.busy) {
      const push = Math.max(-1, Math.min(1, fwd + (s.push ?? 0)));
      for (const e of stepMarch(s.march, dt, push)) {
        if (e.type === 'beat') {
          sounds().then((x) => x.drum(e.pace));
          say(e.pace > 1 ? 'The drums quicken. Faster!' : 'The drums slow.');
        } else if (e.type === 'drift') say(e.ahead ? 'You’re pushing ahead of your place in the line!' : 'You’re falling behind!', true);
        else if (e.type === 'lash') {
          a.fx('lash');
          sounds().then((x) => x.whip());
          say(SAYS.lash.text, true, SAYS.lash.who);
        } else if (e.type === 'caught') {
          s.busy = true;
          sounds().then((x) => x.snarl());
          say('The slaver looks at you properly, and sees what you are… Sam shoves you both off the road and into a ditch till they’ve gone. Again: keep your place in the line.', true);
          later(() => sim.current?.mode === 'march' && startMarch(), 2600);
        } else if (e.type === 'halt') {
          sounds().then((x) => x.snarl());
          startTalk('halt');
        }
      }
    }

    // carrying Frodo
    if (s.mode === 'carry' && s.carry && !s.busy) {
      if (pad && pressed('x')) doStep('left');
      if (pad && pressed('b')) doStep('right');
      for (const e of stepCarry(s.carry, dt)) {
        if (e.type === 'tremor') {
          a.fx('tremor');
          sounds().then((x) => x.quake());
          say('The mountain shakes! Stand still!', true);
        } else if (e.type === 'still') say('It’s still again. On: left, right…');
      }
    }

    // Frodo over the fire
    if (s.mode === 'hang' && s.hang && !s.busy) {
      const hold = held('space') || held('up') || s.reach > 0 || Boolean(pad?.a);
      for (const e of stepHang(s.hang, dt, hold)) {
        if (e.type === 'reach') {
          if (s.saw) say('He reaches up to you!', true);
          else say(SAYS.reach.text, true, SAYS.reach.who);
        } else if (e.type === 'look') {
          s.saw = true;
          say('He’s looking down at the fire again, where the Ring went.');
        } else if (e.type === 'caught') {
          a.fx('caught');
          sounds().then((x) => x.grab());
          s.busy = true;
          later(() => {
            if (sim.current?.mode !== 'hang') return;
            sounds().then((x) => x.done());
            startTalk('done');
          }, 900);
        } else if (e.type === 'lost') {
          s.busy = true;
          say('His fingers slip… and you catch his wrist, just. Hold on. Again: reach when he reaches.', true);
          later(() => sim.current?.mode === 'hang' && startHang(), 2200);
        }
      }
    }

    // the eagles
    if (s.mode === 'flight' && s.flight && !s.busy) {
      const steer = side + (s.steer ?? 0);
      for (const e of stepFlight(s.flight, dt, steer)) {
        if (e.type === 'hit') {
          a.fx('hit');
          sounds().then((x) => x.fire(0.7));
          say('Fire bursts up under you, and Gwaihir lurches.', true);
        } else if (e.type === 'down') {
          s.busy = true;
          say('Singed, he drops to the rocks, and beats up again… Steer round the fountains of fire.', true);
          later(() => sim.current?.mode === 'flight' && startFlight(), 2200);
        } else if (e.type === 'clear') {
          complete('eagles');
          s.mode = 'end';
          sounds().then((x) => x.done());
        }
      }
    }

    // remembering the Shire: Sam telling, Frodo saying back
    if (s.mode === 'remember' && s.recall) {
      for (const e of stepRecall(s.recall, dt)) {
        if (e.type === 'tell') {
          const i = SHIRE.findIndex((x) => x.id === e.id);
          sounds().then((x) => x.memory(i, 0.8));
          rememberSay({ who: 'sam', say: SHIRE[i].say });
        } else if (e.type === 'ask') rememberSay(REMEMBER_SAYS.ask(s.recall.round));
      }
    }

    // what's here
    s.near = s.mode === 'walk' && !s.search && PROMPT[p.next] ? p.next : null;
    if (s.mode === 'walk' && p.next === 'gorgoroth' && !s.search) startCross();

    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const m = s.march;
    const se = s.search;
    const c = s.carry;
    const g = s.hang;
    const f = s.flight;
    // other travellers online: where you are to them (crossing the plain;
    // the column, the mountain and the fire are yours alone), and where they are
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: !(s.mode === 'walk' && s.search) });
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          next: p.next,
          done: p.done,
          hobbit: s.h,
          travellers: tv ? tv.list() : null,
          hidden: Boolean(s.hidden),
          talking: s.talking,
          speaker: node?.who ?? (s.mode === 'remember' ? (s.said?.who ?? null) : null),
          line: s.talk?.at ?? null,
          march: m ? { s: m.s, off: m.off, pace: m.pace, t: m.t } : null,
          search: se ? { x: se.x, z: se.z, seen: se.seen } : null,
          carry: c ? { s: c.s, tremorT: c.tremorT, stumbleT: c.stumbleT, last: c.last } : null,
          hang: g ? { grip: g.grip, arm: g.arm, phase: g.phase } : null,
          flight: f ? { s: f.s, lat: f.lat, stunT: f.stunT } : null,
          erupt: s.erupt,
          remember: s.mode === 'remember' && s.recall ? { k: (remembered(s.recall) + (s.recall.phase === 'ask' ? s.recall.said / s.recall.round : 0)) / RECALL.length } : null,
          stepT: s.stepT,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 7.2 : 6.4,
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

    const rc = s.mode === 'remember' ? s.recall : null;
    const key = [rc ? [rc.phase, rc.round, rc.said, rc.slips, rc.state, telling(rc), s.said?.say].join(',') : '', s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, m ? Math.round(m.off * 4) : '', m?.pace, m?.lashes, se ? Math.round(se.seen * 10) : '', s.hidden, c ? Math.round(c.s) : '', c ? c.tremorT > 0 : '', c?.last, g ? Math.round(g.grip * 20) : '', g ? Math.round(g.arm * 20) : '', g?.phase, f ? Math.round(f.s / 4) : '', f?.hits, p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, hidden: Boolean(s.hidden), march: m ? { off: m.off, pace: m.pace, lashes: m.lashes, t: m.t } : null, search: se ? { seen: se.seen } : null, carry: c ? { s: c.s, tremor: c.tremorT > 0, last: c.last } : null, hang: g ? { grip: g.grip, arm: g.arm, phase: g.phase } : null, flight: f ? { s: f.s, hits: f.hits } : null, recall: rc ? { phase: rc.phase, round: rc.round, said: rc.said, slips: rc.slips, state: rc.state, telling: telling(rc), say: s.said } : null });
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && s.search) local.set(AT, { zone: 'plain', x: s.h.x, z: s.h.z, face: s.h.face });
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
    if (q.id === 'column') startMarch();
    else if (q.id === 'gorgoroth') startCross();
    else if (q.id === 'carry') startCarry();
    else if (q.id === 'crack') startCrack();
    else if (q.id === 'eagles') startRefuge();
    setList(false);
  };

  const sideTask = { ...SIDE, open: prog.done.includes(SIDE.needs), done: side.won, best: side.best != null ? REMEMBER_SAYS.best(side.best) : null };
  const sideHere = sideTask.open && (hud.mode === 'walk' || hud.mode === 'end') && !hud.search;
  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const zone = hud.zone ?? sim.current.zone;
  const title = zone === 'crack' ? 'The Crack of Doom' : zone === 'slope' ? 'Mount Doom' : 'Gorgoroth';
  const Ma = hud.march;
  const Ca = hud.carry;
  const Ha = hud.hang;
  const Fl = hud.flight;
  const Re = mode === 'remember' ? hud.recall : null;
  const crossing = walking && Boolean(hud.search);
  return (
    <div ref={box} className="shire-stage doom-stage" data-touch={touch || undefined} data-mode={mode} data-zone={zone} data-game={['march', 'carry', 'hang', 'flight', 'remember'].includes(mode) || crossing || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Mordor in 3D: the plain of Gorgoroth under the Eye, Mount Doom, and the fire inside it" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Into Mordor" />

      {(walking || mode === 'end') && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="doom-title" className="shire-title">
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
            <Travellers trav={trav} />
          </div>
        </div>
      )}
      {!walking && mode !== 'end' && (
        <h1 id="doom-title" className="sr-only">
          Mount Doom
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
          {sideHere && prog.next === 'carry' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={startRemember}>
              On the side: {SIDE.name}
            </button>
          )}
        </div>
      )}
      {Re && (
        <div className="shire-panel doom-game doom-remember" role="group" aria-label={SIDE.name} data-wrong={Re.phase === 'wrong' || undefined}>
          <p className="shire-panel-title">{SIDE.name}</p>
          {Re.say && (
            <p className="shire-panel-say" aria-live="polite">
              <b>{SPEAKERS[Re.say.who]}:</b> {Re.say.say}
              {Re.say.then && ` ${Re.say.then.say}`}
            </p>
          )}
          <div className="doom-shire" role="group" aria-label="Things of the Shire">
            {SHIRE.map((m, i) => (
              <button key={m.id} type="button" className="btn btn-ghost btn-sm doom-memory" data-memory={m.id} data-lit={Re.telling === m.id || undefined} disabled={Re.phase !== 'ask'} onClick={() => sayBack(i)}>
                <i aria-hidden="true" />
                {!touch && <kbd>{i + 1}</kbd>} {m.name}
              </button>
            ))}
          </div>
          <p className="shire-panel-stats">
            <span>
              Remembered <b>{remembered(Re)}</b> of {RECALL.length}
            </span>
            {Re.phase === 'ask' && (
              <span>
                Said back <b>{Re.said}</b> of {Re.round}
              </span>
            )}
            <span>
              Slips <b>{Re.slips}</b>
            </span>
          </p>
          <div className="shire-panel-row">
            {Re.state === 'remembered' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startRemember}>
                Again {!touch && <kbd>R</kbd>}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRemember}>
              {Re.state === 'remembered' ? 'Back' : 'Stop'} {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}
      {gl === 'on' && crossing && !hud.moved && <p className="shire-hint">{touch ? 'Drag the stick to walk. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. M for the list.'}<GuideCue touch={touch} /></p>}

      {node && <Convo title={title} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {crossing && (hud.hidden || hud.search.seen > 0) && (
        <div className="shire-panel doom-game" role="status" data-seen={hud.search.seen > 0 || undefined}>
          <p className="shire-panel-title">{hud.search.seen > 0 ? 'The Eye! Into a rock’s shadow!' : 'In a rock’s shadow, hidden from the Eye'}</p>
        </div>
      )}
      {mode === 'march' && Ma && (
        <div className="shire-panel doom-game" role="group" aria-label="In the column" data-drift={Math.abs(Ma.off) > MARCH.slack || undefined}>
          <p className="shire-panel-title">{Math.abs(Ma.off) > MARCH.slack ? (Ma.off > 0 ? 'Too far ahead! Hang back!' : 'Falling behind! Hurry!') : Ma.pace > 1 ? 'The drums quicken' : Ma.pace < 1 ? 'The drums slow' : 'Keep your place in the line'}</p>
          <div className="shire-meter doom-place" role="meter" aria-label="Your place in the line" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round((Ma.off / (MARCH.slack * 2)) * 100)}>
            <span className="shire-meter-label">Behind</span>
            <span className="doom-line">
              <span className="doom-line-ok" style={{ left: `${50 - 25}%`, width: '50%' }} />
              <span className="doom-line-you" style={{ left: `${50 + Math.max(-1, Math.min(1, Ma.off / (MARCH.slack * 2))) * 50}%` }} />
            </span>
            <span className="shire-meter-label">Ahead</span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Lashes <b>{Ma.lashes}</b> of {MARCH.lashes}
            </span>
            <span>To the camp {Math.max(0, Math.ceil(MARCH.length - Ma.t))}s</span>
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm doom-big" {...hold('push', -1)}>
                Hang back
              </button>
              <button type="button" className="btn btn-primary btn-sm doom-big" {...hold('push', 1)}>
                Hurry
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold W to hurry, S to hang back. Keep with the drums.</p>
          )}
        </div>
      )}
      {mode === 'carry' && Ca && (
        <div className="shire-panel doom-game" role="group" aria-label="Carrying Frodo" data-tremor={Ca.tremor || undefined}>
          <p className="shire-panel-title">{Ca.tremor ? 'The mountain shakes! Stand still!' : 'I can carry you'}</p>
          <div className="shire-meter" role="meter" aria-label="How far up" aria-valuemin={0} aria-valuemax={CARRY.len} aria-valuenow={Math.round(Ca.s)}>
            <span className="shire-meter-label">Up</span>
            <span className="shire-meter-bar doom-meter-up">
              <span style={{ transform: `scaleX(${Ca.s / CARRY.len})` }} />
            </span>
          </div>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-sm doom-big" data-next={Ca.last !== 'left' || undefined} onPointerDown={(e) => (e.preventDefault(), doStep('left'))}>
              Left {!touch && <kbd>A</kbd>}
            </button>
            <button type="button" className="btn btn-sm doom-big" data-next={Ca.last !== 'right' || undefined} onPointerDown={(e) => (e.preventDefault(), doStep('right'))}>
              Right {!touch && <kbd>D</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'hang' && Ha && (
        <div className="shire-panel doom-game" role="group" aria-label="Reach" data-reach={Ha.phase === 'reach' || undefined}>
          <p className="shire-panel-title">{Ha.phase === 'reach' ? 'He’s reaching! Reach!' : 'Don’t you let go!'}</p>
          <div className="shire-meter" role="meter" aria-label="His grip" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Ha.grip * 100)}>
            <span className="shire-meter-label">His grip</span>
            <span className="shire-meter-bar doom-meter-grip">
              <span style={{ transform: `scaleX(${Ha.grip})` }} />
            </span>
          </div>
          <div className="shire-meter" role="meter" aria-label="Your reach" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Ha.arm * 100)}>
            <span className="shire-meter-label">Your hand</span>
            <span className="shire-meter-bar doom-meter-reach">
              <span style={{ transform: `scaleX(${Ha.arm})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm doom-big" {...hold('reach', 1)}>
                Reach
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold Space to reach down. Your hand has to be all the way there while his is up: he only reaches for a moment.</p>
          )}
          <p className="sr-only">He reaches for {HANG.reach} seconds at a time.</p>
        </div>
      )}
      {mode === 'flight' && Fl && (
        <div className="shire-panel doom-game" role="group" aria-label="The eagles">
          <p className="shire-panel-title">Out of the fire</p>
          <div className="shire-meter" role="meter" aria-label="How far out" aria-valuemin={0} aria-valuemax={FLIGHT.len} aria-valuenow={Math.round(Fl.s)}>
            <span className="shire-meter-label">Out</span>
            <span className="shire-meter-bar doom-meter-up">
              <span style={{ transform: `scaleX(${Math.min(1, Fl.s / FLIGHT.len)})` }} />
            </span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Burns <b>{Fl.hits}</b> of {FLIGHT.hits}
            </span>
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm doom-big" aria-label="Steer left" {...hold('steer', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-ghost btn-sm doom-big" aria-label="Steer right" {...hold('steer', 1)}>
                ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to steer round the fountains of fire.</p>
          )}
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel doom-end" role="dialog" aria-label="The end of all things">
          <p className="shire-panel-title">The end of all things</p>
          <p className="shire-panel-say">The eagles bring them out of the fire, and they wake in Minas Tirith, among friends. A year later, four hobbits ride home to the Shire. The road goes ever on.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            {onLeave && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave()}>
                The Ring, once more
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={startCross}>
              Back across Gorgoroth
            </button>
          </div>
          {sideHere && (
            <button type="button" className="btn btn-ghost btn-sm doom-side-go" onClick={startRemember}>
              On the side: {SIDE.name}
            </button>
          )}
        </div>
      )}
      {crossing && touch && <Stick onMove={onStick} />}
      {list && (
        <QuestList title="Things to do" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && (sim.current.mode === 'walk' || sim.current.mode === 'end')}>
          <SideList tasks={[sideTask]} onGo={startRemember} canGo={(t) => t.open && (sim.current.mode === 'walk' || sim.current.mode === 'end')} />
        </QuestList>
      )}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="doom-title" className="title">
        Mount Doom
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The orc column, Gorgoroth under the Eye, the mountain and the fire inside it, and the eagles, to walk through in 3D. {prog.objective}</p>
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
