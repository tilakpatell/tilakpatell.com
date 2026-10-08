import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';
import { readPad, typing } from '../../../games/pad';
import { Convo, QuestList, Stick, Travellers } from '../TownHud';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { newTalk, talkNode, talkOn } from '../talk';
import { useTravellers } from '../useTravellers';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { HALL_COLLIDERS, HALL_IN, HALL_WALLS, LEAF, LECTERN, LIB, MOTH_AT, PALANTIR, PIN, PIN_IN, SARUMAN_AT, STAIR_LEN, WINDOWS, WINDOW_SIGHTS, validAt } from './layout';
import { CONVOS, FOUND, QUESTS, SAYS, SEAL, SPEAKERS, orthancProgress } from './story';
import { DUEL, MOTH, block, blockable, lapOf, leap, newDuel, newGaze, newLeap, newMoth, newStair, push, stepDuel, stepGaze, stepLeap, stepMoth, stepStair } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './orthanc.css';
import '../../../../styles/lazy/middleearth.css';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Orthanc, found off the road: Gandalf's visit to Isengard. Saruman in his
// hall, the library of lore, the palantír, the duel of the wizards, the
// long stair, and the pinnacle, the moth and the Windlord. The places are
// in ./layout.js, the story in ./story.js, the games in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the talk and the
// games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-orthanc-done';
const AT = 'tp-orthanc-at';
const LEAF_KEY = 'tp-orthanc-leaf';
const COLOURS = 'tp-orthanc-colours';
const FLIGHT_T = 11;
const sounds = () => import('./sounds');
const walkers = {
  hall: makeWalker({ radius: 40, colliders: HALL_COLLIDERS, walls: HALL_WALLS }),
  top: makeWalker({ radius: PIN.r }),
};
const PROMPT = {
  saruman: { name: 'Saruman the White', act: 'Speak' },
  waiting: { name: 'Saruman', act: 'Speak' },
  lectern: { name: 'The book on the lectern', act: 'Read' },
  palantir: { name: 'The palantír', act: 'Look into it' },
  leaf: { name: 'Something behind the books', act: 'Look' },
  moth: { name: 'A moth, in the wind', act: 'Hold out your hand' },
};

export default function OrthancWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return orthancProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = orthancProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  // finding the tower at all is worth something
  useEffect(() => unlock(FOUND), [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = orthancProgress([...d, id]).done;
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
    <section className="shire-world orthanc-world" aria-labelledby="orthanc-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World key={round} prog={prog} complete={complete} gl={gl} setGl={setGl} onLeave={onLeave} again={again} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

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
    const at = zone === 'top' ? validAt(saved, 'top') : validAt(saved, 'hall');
    const h = newWalker(zone === 'stair' ? HALL_IN : at);
    sim.current = { zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: zone === 'top' ? 0.24 : 0.3, dragAt: -1e9, mode: zone === 'stair' ? 'climb' : 'walk', talking: null, talk: null, near: null, frame: 0, moved: false, t: 0, air: null, padBefore: null, gaze: null, duel: null, climb: zone === 'stair' ? newStair() : null, moth: null, leap: null, flight: null, busy: false, steer: 0, up: 0, hold: 0, colours: Boolean(local.get(COLOURS, false)), flashIn: 4 };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: sim.current.mode, near: null, moved: false });
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
  // other travellers online in the hall, as pale wizards from other worlds
  const trav = useTravellers('orthanc', gl === 'on');

  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createOrthancWorld }) => {
        if (dead || !canvas.current) return null;
        return createOrthancWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__ORTHANC__ = { api: a, sim: sim.current, complete };
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
      if (s.mode === 'walk' && (s.zone === 'hall' || s.zone === 'top')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
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
  }, []);
  const startGaze = useCallback(() => {
    const s = sim.current;
    s.mode = 'gaze';
    s.gaze = newGaze(Math.floor(Math.random() * 1000) + 1);
    s.busy = false;
    s.air?.place('hall');
  }, []);
  const startDuel = useCallback(() => {
    const s = sim.current;
    s.mode = 'duel';
    s.duel = newDuel(Math.floor(Math.random() * 1000) + 1);
    s.busy = false;
    api.current?.fx('reset');
  }, []);
  const startStair = useCallback(() => {
    const s = sim.current;
    s.zone = 'stair';
    s.mode = 'climb';
    s.climb = newStair();
    s.busy = false;
    s.air?.place('stair');
  }, []);
  const toTop = useCallback(() => {
    const s = sim.current;
    s.zone = 'top';
    s.mode = 'walk';
    s.climb = null;
    s.h = newWalker(PIN_IN);
    s.yaw = behindYaw(PIN_IN.face);
    s.pitch = 0.24;
    s.busy = false;
    s.air?.place('top');
  }, []);
  const startMoth = useCallback(() => {
    const s = sim.current;
    s.mode = 'moth';
    s.moth = newMoth(Math.floor(Math.random() * 1000) + 1);
    s.busy = false;
    sounds().then((x) => x.flutter());
  }, []);
  const startLeap = useCallback(() => {
    const s = sim.current;
    s.mode = 'leap';
    s.leap = newLeap();
    s.busy = false;
    api.current?.fx('reset');
  }, []);

  const enter = useCallback(
    (id) => {
      audioContext();
      const s = sim.current;
      setList(false);
      if (id === 'saruman') {
        sounds().then((x) => x.boom());
        api.current?.fx('boom');
        startTalk('greet');
      } else if (id === 'waiting') say(SAYS.waiting.text, false, SAYS.waiting.who);
      else if (id === 'lectern') {
        sounds().then((x) => x.pages());
        startTalk('lore');
      } else if (id === 'palantir') startTalk('stone');
      else if (id === 'leaf') startTalk('leaf');
      else if (id === 'moth') startMoth();
      s.near = null;
    },
    [say, startMoth, startTalk],
  );

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      // Saruman of Many Colours: once asked, his robe shows it
      if (s.talking === 'greet' && s.talk.at === 'colours') {
        s.colours = true;
        local.set(COLOURS, true);
      }
      if (!s.talk.end) return setHud((h) => ({ ...h, line: s.talk.at }));
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      s.mode = 'walk';
      if (which === 'greet') {
        complete('hall');
        say('The library is through the arch, east of the hall.');
      } else if (which === 'lore') {
        complete('library');
        say('Back to the hall. Saruman is waiting by the stone.');
      } else if (which === 'stone') startGaze();
      else if (which === 'seen') startDuel();
      else if (which === 'staff') {
        complete('duel');
        startStair();
        say('Up the long stair. Hold W (or the button) to climb.', false);
      } else if (WINDOW_SIGHTS.includes(which)) s.mode = 'climb';
      else if (which === 'prison') {
        complete('stair');
        toTop();
      } else if (which === 'moth') startLeap();
      else if (which === 'leaf') {
        local.set(LEAF_KEY, true);
        api.current?.fx('ring');
        sounds().then((x) => x.puff());
        say('Longbottom Leaf, in Orthanc. Some things are worth knowing.');
      }
      return undefined;
    },
    [complete, say, startDuel, startGaze, startLeap, startStair, toTop],
  );

  // the duel's two moves
  const doBlock = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'duel' || !s.duel || s.busy) return;
    const r = block(s.duel);
    if (r === 'blocked') {
      api.current?.fx('block');
      sounds().then((x) => x.parry());
    } else if (r === 'early') {
      api.current?.fx('fumble');
      sounds().then((x) => x.knock());
      say('At nothing, and your staff is down. Wait for his to fall.', true);
    }
  }, [say]);
  const doPush = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'duel' || !s.duel || s.busy) return;
    const r = push(s.duel);
    if (r === 'pushed') {
      api.current?.fx('push');
      sounds().then((x) => x.shove());
      say('You drive him back across the floor!');
    } else if (r === 'won') {
      s.busy = true;
      api.current?.fx('push');
      sounds().then((x) => x.shove());
      later(() => {
        if (sim.current?.mode !== 'duel') return;
        sim.current.duel = null;
        api.current?.fx('taken');
        sounds().then((x) => x.taken());
        startTalk('staff');
      }, 1100);
    } else if (r === 'miss') {
      sounds().then((x) => x.knock());
      say('He isn’t open yet: turn his blow first.', true);
    }
  }, [later, say, startTalk]);
  const doLeap = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'leap' || !s.leap || s.busy) return;
    const r = leap(s.leap);
    if (r === 'caught') {
      s.busy = true;
      api.current?.fx('jump');
      sounds().then((x) => x.cry());
      later(() => {
        const x = sim.current;
        if (!x || x.mode !== 'leap') return;
        x.mode = 'flight';
        x.flight = 0;
        x.leap = null;
        x.busy = false;
      }, 700);
    } else if (r === 'wait') say('Not yet: wait till he is right beneath you.', true);
  }, [later, say]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'duel') return doPush();
    if (s.mode === 'leap') return doLeap();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doLeap, doPush, enter]);

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
      if (s.mode === 'duel' && !e.repeat) {
        if (k === ' ' || k === 'e' || k === 'E' || k === 'Enter') {
          e.preventDefault();
          doPush();
        } else if (['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight', 's', 'S', 'ArrowDown'].includes(k)) {
          e.preventDefault();
          doBlock();
        }
        return;
      }
      if (s.mode === 'leap' && !e.repeat && (k === ' ' || k === 'e' || k === 'E' || k === 'Enter')) {
        e.preventDefault();
        doLeap();
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
  }, [box, live, talkOnward, doAct, doBlock, doPush, doLeap]);

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

    // walking: the hall and the library, the pinnacle
    const walkZone = s.zone === 'hall' ? 'hall' : s.zone === 'top' ? 'top' : null;
    if (s.mode === 'walk' && walkZone && !s.busy) {
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
      s.h = walkers[walkZone].step(s.h, { x: mv.x, z: mv.z, run }, dt);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
    }

    // the palantír
    if (s.mode === 'gaze' && s.gaze && !s.busy) {
      const look = held('space') || held('up') || s.hold > 0 || Boolean(pad?.a);
      for (const e of stepGaze(s.gaze, dt, look)) {
        if (e.type === 'stir') say('Something stirs, far down in the stone…', true);
        else if (e.type === 'turn') {
          sounds().then((x) => x.turn());
          say('The Eye turns to search the stone. Look away!', true);
        } else if (e.type === 'still') say('It has turned away. Look again.');
        else if (e.type === 'stage') {
          sounds().then((x) => x.wake());
          say('The vision moves: under Isengard, pits and fire, and an army being made.');
        } else if (e.type === 'found') {
          s.busy = true;
          a.fx('found');
          sounds().then((x) => x.found());
          say('The Eye is on you. You tear yourself free of the stone, shaking… Again, and look away when it turns.', true);
          later(() => sim.current?.mode === 'gaze' && startGaze(), 2600);
        } else if (e.type === 'seen') {
          complete('palantir');
          s.gaze = null;
          startTalk('seen');
        }
      }
      if (look && s.gaze && !s.gazeSound) {
        s.gazeSound = true;
        sounds().then((x) => x.wake());
      } else if (!look) s.gazeSound = false;
    }

    // the duel of the wizards
    if (s.mode === 'duel' && s.duel && !s.busy) {
      if (pad && pressed('a')) doPush();
      if (pad && pressed('x')) doBlock();
      for (const e of stepDuel(s.duel, dt)) {
        if (e.type === 'tell') sounds().then((x) => x.gather());
        else if (e.type === 'cast') {
          a.fx('cast');
          sounds().then((x) => x.blast());
        } else if (e.type === 'hit') {
          a.fx('hit');
          sounds().then((x) => x.thud());
          say('His blow throws you back across the floor.', true);
        } else if (e.type === 'down') {
          s.busy = true;
          a.fx('down');
          say('You’re down on the black floor… You rise, and lift your staff again.', true);
          later(() => sim.current?.mode === 'duel' && startDuel(), 2400);
        }
      }
    }

    // the long stair
    if (s.mode === 'climb' && s.climb && !s.busy) {
      const up = held('up') || held('space') || s.up > 0 || s.stick.y < -0.4 || Boolean(pad?.a) || (pad ? pad.ly < -0.4 : false);
      const down = held('down') || s.stick.y > 0.4 || (pad ? pad.ly > 0.4 : false);
      s.climbing = up && !down;
      for (const e of stepStair(s.climb, dt, up ? 1 : down ? -1 : 0, STAIR_LEN, WINDOWS)) {
        if (e.type === 'window') startTalk(WINDOW_SIGHTS[e.i]);
        else if (e.type === 'top') startTalk('prison');
      }
    } else s.climbing = false;

    // the moth
    if (s.mode === 'moth' && s.moth && !s.busy) {
      const steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x + (s.steer ?? 0) + (pad ? pad.lx : 0);
      for (const e of stepMoth(s.moth, dt, steer)) {
        if (e.type === 'rising') {
          sounds().then((x) => x.gust());
          say('The wind is rising…');
        } else if (e.type === 'gust') sounds().then((x) => x.flutter());
        else if (e.type === 'landed') {
          s.moth = null;
          startTalk('moth');
        } else if (e.type === 'gone') {
          s.busy = true;
          say('It flutters off into the dark. Wait: it will come back. Keep your hand under it.', true);
          later(() => sim.current?.mode === 'moth' && startMoth(), 2400);
        }
      }
    }

    // the Windlord
    if (s.mode === 'leap' && s.leap && !s.busy) {
      if (pad && pressed('a')) doLeap();
      for (const e of stepLeap(s.leap, dt)) {
        if (e.type === 'coming') sounds().then((x) => x.cry());
        else if (e.type === 'past') say('He’s gone by, and wheels away. He will come round again.');
      }
    }
    if (s.leap) s.leap.k = lapOf(s.leap);

    // away
    if (s.mode === 'flight') {
      s.flight += dt;
      if (s.flight >= FLIGHT_T) {
        complete('pinnacle');
        s.mode = 'end';
      }
    }

    // the storm: lightning over Isengard, now and then
    if (s.zone === 'top' || s.zone === 'stair') {
      s.flashIn -= dt;
      if (s.flashIn <= 0) {
        s.flashIn = 7 + Math.random() * 9;
        a.fx('flash');
        sounds().then((x) => x.thunder());
      }
    }

    // coming back to the duel (the stair and the pinnacle start where they are)
    if (s.mode === 'walk' && s.zone === 'hall' && p.next === 'duel' && !s.duel) startTalk('seen');

    // what's here
    s.near = null;
    if (s.mode === 'walk' && s.zone === 'hall') {
      const d = (o) => Math.hypot(s.h.x - o.x, s.h.z - o.z);
      if (d(LEAF) < LEAF.r) s.near = 'leaf';
      else if (p.next === 'hall' && d(SARUMAN_AT) < SARUMAN_AT.r) s.near = 'saruman';
      else if (p.next === 'library' && d(LECTERN) < LECTERN.r) s.near = 'lectern';
      else if (p.next === 'library' && d(SARUMAN_AT) < SARUMAN_AT.r) s.near = 'waiting';
      else if (p.next === 'palantir' && d(PALANTIR) < PALANTIR.r) s.near = 'palantir';
    } else if (s.mode === 'walk' && s.zone === 'top' && p.next === 'pinnacle' && Math.hypot(s.h.x - MOTH_AT.x, s.h.z - MOTH_AT.z) < MOTH_AT.r) s.near = 'moth';

    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: !(s.zone === 'hall' && s.mode === 'walk') });
    const g = s.gaze;
    const du = s.duel;
    const c = s.climb;
    const m = s.moth;
    const l = s.leap;
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          next: p.next,
          done: p.done,
          staff: p.staff && s.talking !== 'staff',
          colours: s.colours,
          uncovered: p.done.includes('palantir') || s.talking === 'stone' || s.talking === 'seen' || s.mode === 'gaze' || s.mode === 'duel',
          wizard: s.h,
          travellers: tv ? tv.list() : null,
          talking: s.talking,
          speaker: node?.who ?? null,
          line: s.talk?.at ?? null,
          gaze: g ? { seen: g.seen, notice: g.notice, phase: g.phase, stage: g.stage, looking: g.looking } : null,
          duel: du ? { phase: du.phase, phaseT: du.phaseT, will: du.will, pushes: du.pushes } : null,
          climb: c ? { s: c.s } : null,
          climbing: Boolean(s.climbing),
          moth: m ? { x: m.x, hand: m.hand, settle: m.settle } : null,
          leap: l ? { k: l.k ?? 0, under: l.under } : null,
          flight: s.flight,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: s.zone === 'top' ? 6.4 : touch ? 7 : 6.2,
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

    const key = [s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, g ? Math.round(g.seen * 30) : '', g ? Math.round(g.notice * 30) : '', g?.phase, g?.looking, du?.phase, du?.will, du?.pushes, du ? blockable(du) : '', c ? Math.round(c.s) : '', m ? Math.round(m.x * 40) : '', m ? Math.round(m.hand * 40) : '', m ? Math.round(m.settle * 20) : '', m?.warned, l?.under, l?.warned, p.done.length, s.h.x > LIB.x0].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, inLibrary: s.zone === 'hall' && s.h.x > LIB.x0, gaze: g ? { seen: g.seen, notice: g.notice, phase: g.phase, looking: g.looking } : null, duel: du ? { phase: du.phase, will: du.will, pushes: du.pushes, blockable: blockable(du) } : null, climb: c ? { s: c.s } : null, moth: m ? { x: m.x, hand: m.hand, settle: m.settle, rising: m.warned } : null, leap: l ? { under: l.under, coming: l.warned } : null });
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && (s.zone === 'hall' || s.zone === 'top')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
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
  // after the end: walk the hall again, the story kept
  const stay = () => {
    const s = sim.current;
    s.zone = 'hall';
    s.mode = 'walk';
    s.h = newWalker(HALL_IN);
    s.yaw = behindYaw(HALL_IN.face);
    s.pitch = 0.3;
    s.flight = null;
    s.air?.place('hall');
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const title = hud.zone === 'top' ? 'The pinnacle of Orthanc' : hud.zone === 'stair' ? 'The long stair' : hud.inLibrary ? 'The library of lore' : 'The hall of Orthanc';
  const G = hud.gaze;
  const D = hud.duel;
  const Cl = hud.climb;
  const Mo = hud.moth;
  const L = hud.leap;
  return (
    <div ref={box} className="shire-stage orthanc-stage" data-touch={touch || undefined} data-mode={mode} data-zone={hud.zone ?? sim.current.zone} data-game={['gaze', 'duel', 'climb', 'moth', 'leap'].includes(mode) || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Orthanc in 3D: Saruman's black hall and its palantír, the library, the long stair, and the pinnacle over Isengard" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="To Isengard" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="orthanc-title" className="shire-title">
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
            {hud.zone === 'hall' && <Travellers trav={trav} />}
          </div>
        </div>
      )}
      {!walking && (
        <h1 id="orthanc-title" className="sr-only">
          Orthanc
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

      {mode === 'gaze' && G && (
        <div className="shire-panel orthanc-game" role="group" aria-label="The palantír" data-turn={(G.phase === 'turn' && G.looking) || undefined} data-stir={G.phase === 'stir' || undefined}>
          <p className="shire-panel-title">{G.phase === 'turn' ? (G.looking ? 'The Eye turns! Look away!' : 'The Eye is searching… wait') : G.phase === 'stir' ? 'Something stirs in the stone…' : G.looking ? 'Looking into the stone' : 'Look into the stone'}</p>
          <div className="shire-meter" role="meter" aria-label="The vision" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(G.seen * 100)}>
            <span className="shire-meter-label">Seen</span>
            <span className="shire-meter-bar orthanc-meter-seen">
              <span style={{ transform: `scaleX(${G.seen})` }} />
            </span>
          </div>
          <div className="shire-meter" role="meter" aria-label="The Eye’s notice" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(G.notice * 100)}>
            <span className="shire-meter-label">The Eye</span>
            <span className="shire-meter-bar shire-meter-eye">
              <span style={{ transform: `scaleX(${G.notice})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm orthanc-big" {...hold('hold', 1)}>
                Hold to look
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold Space (or W) to look; let go when the Eye turns. Stare too long, and it finds you.</p>
          )}
        </div>
      )}
      {mode === 'duel' && D && (
        <div className="shire-panel orthanc-game" role="group" aria-label="The duel of the wizards" data-tell={D.blockable || undefined} data-open={D.phase === 'open' || undefined}>
          <p className="shire-panel-title">{D.phase === 'open' ? 'He’s off balance! Push!' : D.blockable ? 'His staff falls! Block!' : D.phase === 'tell' ? 'He raises his staff…' : 'Saruman circles you…'}</p>
          <p className="shire-panel-stats">
            <span>
              Pushed back <b>{D.pushes}</b> of {DUEL.pushes}
            </span>
            <span>
              Will <b>{'♥'.repeat(Math.max(0, D.will))}</b>
            </span>
          </p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm orthanc-big" data-next={D.blockable || undefined} onPointerDown={(e) => (e.preventDefault(), doBlock())}>
              Block {!touch && <kbd>A</kbd>}
            </button>
            <button type="button" className="btn btn-primary btn-sm orthanc-big" data-next={D.phase === 'open' || undefined} onPointerDown={(e) => (e.preventDefault(), doPush())}>
              Push {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'climb' && Cl && (
        <div className="shire-panel orthanc-game" role="group" aria-label="The long stair">
          <p className="shire-panel-title">Up the long stair, Saruman behind you</p>
          <div className="shire-meter" role="meter" aria-label="How far up" aria-valuemin={0} aria-valuemax={Math.round(STAIR_LEN)} aria-valuenow={Math.round(Cl.s)}>
            <span className="shire-meter-label">Up</span>
            <span className="shire-meter-bar orthanc-meter-up">
              <span style={{ transform: `scaleX(${Cl.s / STAIR_LEN})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm orthanc-big" {...hold('up', 1)}>
                Climb
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold W to climb (S goes back down).</p>
          )}
        </div>
      )}
      {mode === 'moth' && Mo && (
        <div className="shire-panel orthanc-game" role="group" aria-label="The moth" data-rising={Mo.rising || undefined}>
          <p className="shire-panel-title">{Mo.rising ? 'The wind is rising…' : Mo.settle > 0.45 ? 'It’s settling… hold steady' : 'Keep your hand under the moth'}</p>
          <div className="orthanc-line" aria-hidden="true">
            <span className="orthanc-line-hand" style={{ left: `${((Mo.hand + 1) / 2) * 100}%` }} />
            <span className="orthanc-line-moth" style={{ left: `${((Mo.x + 1) / 2) * 100}%` }} />
          </div>
          <div className="shire-meter" role="meter" aria-label="Settling" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Mo.settle * 100)}>
            <span className="shire-meter-label">Settling</span>
            <span className="shire-meter-bar orthanc-meter-settle">
              <span style={{ transform: `scaleX(${Mo.settle})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm orthanc-big" aria-label="Hand left" {...hold('steer', -1)}>
                ◀ Left
              </button>
              <button type="button" className="btn btn-ghost btn-sm orthanc-big" aria-label="Hand right" {...hold('steer', 1)}>
                Right ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to keep your hand under it till it settles. Too far off too long, and it flies ({MOTH.away} s).</p>
          )}
        </div>
      )}
      {mode === 'leap' && L && (
        <div className="shire-panel orthanc-game" role="group" aria-label="Gwaihir" data-under={L.under || undefined}>
          <p className="shire-panel-title">{L.under ? 'Now! Jump!' : L.coming ? 'He’s coming round…' : 'Wait for him to come round…'}</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm orthanc-big" data-next={L.under || undefined} onPointerDown={(e) => (e.preventDefault(), doLeap())}>
              Jump {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel orthanc-end" role="dialog" aria-label="Gwaihir the Windlord">
          <p className="shire-panel-title">Gwaihir the Windlord</p>
          <p className="shire-panel-say">He bears you away north, over the ring of Isengard and its fires, towards the mountains and the house of Elrond. Behind you, on the top of his tower, Saruman of Many Colours, alone.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              Back to the map
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Walk the hall
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={again}>
              From the beginning
            </button>
          </div>
        </div>
      )}
      {walking && touch && (hud.zone === 'hall' || hud.zone === 'top') && <Stick onMove={onStick} />}
      {list && <QuestList title="Things to do in Orthanc" quests={prog.quests} next={prog.next} onClose={() => setList(false)} />}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="orthanc-title" className="title">
        Orthanc
      </h1>
      <p className="lead mt-4 max-w-[60ch]">You found the way in. Saruman’s black hall and its palantír, the library of lore, the long stair and the pinnacle over Isengard, to walk through in 3D as Gandalf. {prog.objective}</p>
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
