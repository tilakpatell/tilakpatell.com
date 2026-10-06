import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { readPad, typing } from '../../../games/pad';
import { Convo, QuestList, Stick, Travellers } from '../TownHud';
import { useTravellers } from '../useTravellers';
import { SideList } from '../SideList';
import { readSide, recordSide } from '../side';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { newTalk, talkNode, talkOn } from '../talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { newWatchers, stepWatchers } from '../watchers';
import { LAIR_IN, LAIR_OUT, ORC_ROUNDS, SHELOB_ROUNDS, SHELOB_START, TOWER_COLLIDERS, TOWER_DOOR, TOWER_IN, TOWER_WALLS, lairBlocked, validAt } from './layout';
import { CONVOS, CRUMB_SAYS, QUESTS, SEAL, SIDE, SPEAKERS, cirithProgress } from './story';
import { CRUMBS, DUEL, MORGUL, ORCS, PHIAL, SHELOB, STAIRS, brush, crumbling, crumbsLeft, dodge, moveHand, newClimb, newCrumbs, newDuel, newMorgul, newPhial, onLedge, recoils, stab, stepClimb, stepCrumbs, stepDuel, stepMorgul, stepPhial } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './cirithungol.css';
import '../../../../styles/lazy/middleearth.css';

// Cirith Ungol, the ninth stretch of the road: Minas Morgul, the stairs,
// Shelob's lair, Sam's fight, and the Tower. The places are in
// ./layout.js, the story in ./story.js, the games in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the talk and the
// games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-cirithungol-done';
const AT = 'tp-cirithungol-at';
// crumbs on Sam's cloak, on the side: { won, best } (best: fewest seconds)
const SIDE_KEY = 'tp-cirithungol-side';
const sounds = () => import('./sounds');
const walkers = {
  lair: makeWalker({ radius: 400, colliders: [], walls: [], blocked: lairBlocked }),
  tower: makeWalker({ radius: 400, colliders: TOWER_COLLIDERS, walls: TOWER_WALLS }),
};
const PROMPT = {
  morgul: { name: 'Minas Morgul', act: 'Watch the road' },
  stairs: { name: 'The stairs', act: 'Climb' },
};

export default function CirithUngolWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return cirithProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = cirithProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = cirithProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  // the night on the stair, on the side: kept apart from the story's progress
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
    <section className="shire-world cirith-world" aria-labelledby="cirith-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} complete={complete} side={side} recordGo={recordGo} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, complete, side, recordGo, gl, setGl, onLeave }) {
  // other travellers online, as ghosts (../useTravellers): in the Tower's
  // courtyard, or in Shelob's tunnels, whichever you're walking
  const trav = useTravellers('cirith-ungol', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const zone = prog.zone;
    const at = validAt(local.get(AT, null), zone === 'tower' ? 'tower' : 'lair');
    const h = newWalker(zone === 'tower' ? at : LAIR_IN);
    sim.current = { zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.34, dragAt: -1e9, mode: 'walk', talking: null, talk: null, near: null, frame: 0, moved: false, t: 0, stepT: 0, air: null, padBefore: null, morgul: null, climb: null, shelob: null, phial: null, duel: null, orcs: null, busy: false, steer: 0, up: 0, hold: 0, cKey: false, crumbs: null, from: null, said: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
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
      .then(({ createCirithUngolWorld }) => {
        if (dead || !canvas.current) return null;
        return createCirithUngolWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__CIRITHUNGOL__ = { api: a, sim: sim.current, complete };
        fit();
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
      if (s.mode === 'walk' && (s.zone === 'lair' || s.zone === 'tower')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
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
  const toZone = useCallback((zone, at) => {
    const s = sim.current;
    s.zone = zone;
    s.mode = 'walk';
    if (at) {
      s.h = newWalker(at);
      s.yaw = behindYaw(at.face);
    }
    s.busy = false;
    s.air?.place(zone);
  }, []);

  const startMorgul = useCallback(() => {
    const s = sim.current;
    s.zone = 'vale';
    s.mode = 'morgul';
    s.morgul = newMorgul(Math.floor(Math.random() * 1000) + 1);
    s.busy = false;
    sounds().then((x) => x.beam());
  }, []);
  const startClimb = useCallback(() => {
    const s = sim.current;
    s.zone = 'stairs';
    s.mode = 'climb';
    s.climb = newClimb();
    s.busy = false;
  }, []);
  const startLair = useCallback(() => {
    const s = sim.current;
    toZone('lair', LAIR_IN);
    s.shelob = newWatchers(SHELOB_ROUNDS);
    s.shelob.list[0].x = SHELOB_START.x;
    s.shelob.list[0].z = SHELOB_START.z;
    s.phial = newPhial();
  }, [toZone]);
  const startDuel = useCallback(() => {
    const s = sim.current;
    s.zone = 'lair';
    s.mode = 'duel';
    s.duel = newDuel(Math.floor(Math.random() * 1000) + 1);
    s.busy = false;
  }, []);
  const startTower = useCallback(() => {
    const s = sim.current;
    toZone('tower', TOWER_IN);
    s.orcs = newWatchers(ORC_ROUNDS);
  }, [toZone]);

  // the night on the stair: Sam's cloak, and Gollum's crumbs on it
  const startCrumbs = useCallback(() => {
    const s = sim.current;
    audioContext();
    if (s.mode !== 'crumbs') s.from = { zone: s.zone, mode: s.mode, h: { ...s.h } };
    s.zone = 'stairs';
    s.mode = 'crumbs';
    s.crumbs = newCrumbs(Math.floor(Math.random() * 1000) + 1);
    s.said = CRUMB_SAYS.start;
    s.air?.place('stairs');
    setList(false);
  }, []);
  const leaveCrumbs = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'crumbs') return;
    const from = s.from ?? { zone: 'tower', mode: 'walk', h: TOWER_IN };
    s.crumbs = null;
    s.from = null;
    if (from.mode === 'end') {
      s.zone = from.zone;
      s.mode = 'end';
      s.air?.place(from.zone);
    } else if (from.zone === 'lair' || from.zone === 'tower') toZone(from.zone, from.h);
    else toZone('tower', TOWER_IN);
  }, [toZone]);
  const doBrush = useCallback(
    (u, v) => {
      const s = sim.current;
      const c = s.crumbs;
      if (s.mode !== 'crumbs' || !c) return;
      const got = brush(c, u, v);
      if (got == null) return;
      sounds().then((x) => x.whisk(got));
      api.current?.fx('brush', { u: c.hand.u, v: c.hand.v, got });
      if (!got && c.misses % 3 === 1) s.said = CRUMB_SAYS.rustle;
      if (c.state === 'clean') {
        const secs = Math.round(c.t + c.late);
        s.said = CRUMB_SAYS.won(secs);
        recordGo({ won: true, score: secs });
      }
    },
    [recordGo],
  );

  const enter = useCallback(
    (id) => {
      audioContext();
      if (id === 'morgul') startTalk('morgul');
      else if (id === 'stairs') startClimb();
      setList(false);
    },
    [startTalk, startClimb],
  );

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      if (!s.talk.end) return setHud((h) => ({ ...h, line: s.talk.at }));
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'morgul') startMorgul();
      else if (which === 'lembas') {
        complete('stairs');
        s.climb = null;
        startLair();
        startTalk('phial');
      } else if (which === 'phial') s.mode = 'walk';
      else if (which === 'sam') startDuel();
      else if (which === 'frodo') {
        complete('samwise');
        s.duel = null;
        startTower();
        say('Into the Tower. The orcs are fighting each other over Frodo’s mithril shirt. Across the courtyard to the stair, unseen.', true);
      } else if (which === 'top') {
        complete('tower');
        s.orcs = null;
        s.mode = 'end';
      } else s.mode = 'walk';
      return undefined;
    },
    [complete, say, startDuel, startLair, startMorgul, startTalk, startTower],
  );

  const doStab = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'duel' || !s.duel || s.busy) return;
    const r = stab(s.duel);
    if (r === 'wound') {
      api.current?.fx('stab');
      sounds().then((x) => x.stab());
      say('Sting goes in. She screams.');
    } else if (r === 'fled') {
      s.busy = true;
      api.current?.fx('stab');
      sounds().then((x) => x.scream());
      say('Sting deep in her, and the light in her eyes. She drags herself away into the dark.', false);
      later(() => sim.current?.mode === 'duel' && startTalk('frodo'), 1600);
    } else if (r === 'miss') say('You lunge at nothing, off balance. Wait for her to rear!', true);
  }, [later, say, startTalk]);
  const doDodge = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'duel' || !s.duel || s.busy) return;
    const r = dodge(s.duel);
    if (r === 'dodged') {
      api.current?.fx('dodge');
      sounds().then((x) => x.whoosh());
    } else if (r === 'early') say('Too soon: you stumble. Dodge as she strikes.', true);
  }, [say]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'duel') return doStab();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doStab, enter]);

  // keys
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target)) return;
      keyDown(s.keys, e);
      if (e.code === 'KeyC') s.cKey = true;
    };
    const up = (e) => {
      keyUp(s.keys, e);
      if (e.code === 'KeyC') s.cKey = false;
    };
    const blur = () => {
      s.keys.clear();
      s.cKey = false;
    };
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
      if (s.mode === 'crumbs') {
        if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
          e.preventDefault();
          doBrush();
        } else if (k === 'Escape') leaveCrumbs();
        else if ((k === 'r' || k === 'R') && s.crumbs && s.crumbs.state !== 'on') startCrumbs();
        return;
      }
      if (s.mode === 'duel' && !e.repeat) {
        if (k === ' ' || k === 'e' || k === 'E' || k === 'Enter') {
          e.preventDefault();
          doStab();
        } else if (['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight', 's', 'S', 'ArrowDown'].includes(k)) {
          e.preventDefault();
          doDodge();
        }
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
  }, [box, live, talkOnward, doAct, doStab, doDodge, doBrush, leaveCrumbs, startCrumbs]);

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
    const lifting = s.zone === 'lair' && s.mode === 'walk' && (s.cKey || held('space') || s.hold > 0 || Boolean(pad?.b));

    // walking: the lair, the Tower
    if (s.mode === 'walk' && (s.zone === 'lair' || s.zone === 'tower') && !s.busy) {
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
      s.h = walkers[s.zone].step(s.h, { x: mv.x, z: mv.z, run }, dt);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
    }

    // Minas Morgul: eyes off the city
    if (s.mode === 'morgul' && s.morgul && !s.busy) {
      const steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x + (s.steer ?? 0) + (pad ? pad.lx : 0);
      for (const e of stepMorgul(s.morgul, dt, steer)) {
        if (e.type === 'pause') {
          a.fx('pause');
          sounds().then((x) => x.wraith());
          say('The Witch-king stops on the bridge. His steed turns. He feels for the Ring. Look away!', true);
        } else if (e.type === 'stood') {
          s.busy = true;
          a.fx('stood');
          say('You’re on your feet and walking down to the road, towards the green light. Sam drags you down behind the rocks. “Mr. Frodo!” Again: keep your eyes off it.', true);
          later(() => sim.current?.mode === 'morgul' && startMorgul(), 2400);
        } else if (e.type === 'passed') {
          complete('morgul');
          s.morgul = null;
          s.zone = 'stairs';
          s.mode = 'walk';
          s.air?.place('stairs');
          say('The host has gone by, west, to war. Gollum: “This way, master. Up the stairs.”', false);
        }
      }
    }

    // the stairs
    if (s.mode === 'climb' && s.climb && !s.busy) {
      const up = held('up') || held('space') || s.up > 0 || s.stick.y < -0.4 || Boolean(pad?.a);
      s.climbing = up && !s.climb.spent;
      for (const e of stepClimb(s.climb, dt, up)) {
        if (e.type === 'spent') say('Your legs give. Rest, on a ledge if you can.', true);
        else if (e.type === 'slip') {
          a.fx('slip');
          sounds().then((x) => x.rocks());
          say('The step crumbles under you, and you slide back down to the ledge below. Don’t stop on the broken steps!', true);
        } else if (e.type === 'top') startTalk('lembas');
      }
    }

    // Shelob's lair: her hunt, and the phial
    if (s.zone === 'lair' && s.mode === 'walk' && s.shelob && !s.busy) {
      for (const e of stepPhial(s.phial, dt, lifting)) {
        if (e.type === 'lit') {
          a.fx('phial');
          sounds().then((x) => x.phial());
        } else if (e.type === 'dim') say('The phial’s light fails. It will come back, slowly.', true);
      }
      const w = s.shelob.list[0];
      const dist = Math.hypot(w.x - s.h.x, w.z - s.h.z);
      if (recoils(s.phial, dist) && (w.mode === 'chase' || w.mode === 'alert' || dist < 4)) {
        // she shrinks from it, back the way she came
        const dx = (w.x - s.h.x) / (dist || 1);
        const dz = (w.z - s.h.z) / (dist || 1);
        const nx = w.x + dx * 4 * dt;
        const nz = w.z + dz * 4 * dt;
        if (!lairBlocked(nx, nz)) {
          w.x = nx;
          w.z = nz;
        }
        if (w.mode !== 'back') {
          w.mode = 'back';
          w.t = 0;
          sounds().then((x) => x.hiss());
          say('She shrinks from the light, hissing!');
        }
      }
      for (const e of stepWatchers(s.shelob, s.h, dt, SHELOB, { colliders: [], walls: [], ring: false, active: true, push: (x, z) => (lairBlocked(x, z) ? [w.x, w.z] : [x, z]) })) {
        if (e.type === 'seen') {
          sounds().then((x) => x.hiss());
          say('She’s coming! Raise the phial (hold Space)!', true);
        } else if (e.type === 'caught') {
          s.busy = true;
          a.fx('caught');
          say('Her sting, in the dark… you wake, wrapped in silk, and tear free, and run back… Again: through the tunnels, the phial ready.', true);
          later(() => sim.current?.shelob && startLair(), 2400);
        }
      }
      if (Math.hypot(s.h.x - LAIR_OUT.x, s.h.z - LAIR_OUT.z) < LAIR_OUT.r) {
        complete('shelob');
        s.shelob = null;
        s.phial = null;
        startTalk('sam');
      }
    }

    // Samwise the Brave
    if (s.mode === 'duel' && s.duel && !s.busy) {
      if (pad && pressed('a')) doStab();
      if (pad && pressed('x')) doDodge();
      for (const e of stepDuel(s.duel, dt)) {
        if (e.type === 'tell') say('She draws back… Dodge! (A or D)');
        else if (e.type === 'strike') sounds().then((x) => x.hiss());
        else if (e.type === 'rear') say('She rears up over you. Stab! (Space)');
        else if (e.type === 'hit') {
          a.fx('hit');
          sounds().then((x) => x.thud());
          say('Her leg catches you, and you’re thrown against the rock.', true);
        } else if (e.type === 'down') {
          s.busy = true;
          say('You’re down, and she’s over you… You roll away, Sting still in your hand. Again! Dodge her strikes, stab when she rears.', true);
          later(() => sim.current?.mode === 'duel' && startDuel(), 2200);
        }
      }
    }

    // the Tower
    if (s.zone === 'tower' && s.mode === 'walk' && s.orcs && !s.busy) {
      for (const e of stepWatchers(s.orcs, s.h, dt, ORCS, { colliders: TOWER_COLLIDERS, walls: TOWER_WALLS, ring: false, active: true, push: (x, z) => walkers.tower.push(x, z, 0.5) })) {
        if (e.type === 'seen') {
          sounds().then((x) => x.shout());
          say('An orc has seen you! Round a pillar, quick!', true);
        } else if (e.type === 'caught') {
          s.busy = true;
          a.fx('caught');
          sounds().then((x) => x.clash());
          say('You cut it down, but the shouting brings more. Back out, and try again, softly.', true);
          later(() => sim.current?.orcs && startTower(), 2000);
        }
      }
      if (Math.hypot(s.h.x - TOWER_DOOR.x, s.h.z - TOWER_DOOR.z) < TOWER_DOOR.r) startTalk('top');
    }
    // coming back to a part
    if (s.mode === 'walk' && p.next === 'shelob' && s.zone === 'lair' && !s.shelob) startLair();
    if (s.mode === 'walk' && p.next === 'samwise' && !s.duel) startTalk('sam');
    if (s.mode === 'walk' && p.next === 'tower' && !s.orcs) startTower();

    // the night on the stair: your hand over the cloak, and Frodo waking
    if (s.mode === 'crumbs' && s.crumbs) {
      const c = s.crumbs;
      const hx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + (pad ? pad.lx : 0);
      const hy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0) + (pad ? pad.ly : 0);
      if (c.state === 'on') moveHand(c, hx, hy, dt);
      if (pad && pressed('a')) doBrush();
      for (const e of stepCrumbs(c, dt)) {
        if (e.type === 'stir') {
          a.fx('stir');
          sounds().then((x) => x.murmur());
          s.said = CRUMB_SAYS.stir[e.i % CRUMB_SAYS.stir.length];
        } else if (e.type === 'woke') {
          sounds().then((x) => x.murmur());
          s.said = CRUMB_SAYS.woke;
          recordGo({ won: false, score: null });
        }
      }
    }

    // what's here
    s.near = s.mode === 'walk' && p.next === 'morgul' ? 'morgul' : s.mode === 'walk' && p.next === 'stairs' ? 'stairs' : null;

    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const m = s.morgul;
    const c = s.climb;
    const ph = s.phial;
    const du = s.duel;
    // other travellers online: where you are to them (walking the courtyard
    // or the tunnels, each its own ground; the vale, the stairs and the fight
    // at the pass are yours alone), and where they are
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.mode !== 'walk' || (s.zone !== 'tower' && s.zone !== 'lair'), area: s.zone });
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          next: p.next,
          asSam: p.asSam,
          hobbit: s.h,
          travellers: tv ? tv.list() : null,
          talking: s.talking,
          speaker: node?.who ?? null,
          line: s.talk?.at ?? null,
          morgul: m ? { gaze: m.gaze, pull: m.pull, pausing: m.pausing, t: m.t } : null,
          climb: c ? { s: c.s, stamina: c.stamina, spent: c.spent } : null,
          climbing: s.mode === 'climb' && Boolean(s.climbing),
          shelob: s.shelob?.list?.[0] ?? null,
          phial: ph ? { on: ph.on, charge: ph.charge } : null,
          duel: du ? { phase: du.phase, phaseT: du.phaseT, wounds: du.wounds, hearts: du.hearts, dodged: du.dodged } : null,
          orcs: s.orcs?.list ?? null,
          crumbs: s.mode === 'crumbs' ? s.crumbs : null,
          stepT: s.stepT,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: s.zone === 'tower' ? 6.5 : touch ? 6.6 : 5.6,
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

    const cr = s.mode === 'crumbs' ? s.crumbs : null;
    const key = [cr ? [cr.state, cr.left, Math.round(crumbsLeft(cr)), cr.stirred, s.said].join(',') : '', s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, m ? Math.round(m.pull * 20) : '', m?.pausing, m ? Math.round(m.gaze * 10) : '', c ? Math.round(c.s) : '', c ? Math.round(c.stamina * 20) : '', c?.spent, ph ? Math.round(ph.charge * 20) : '', ph?.on, du?.phase, du?.wounds, du?.hearts, s.shelob?.list?.[0]?.mode, s.orcs?.list.some((w) => w.mode === 'alert' || w.mode === 'chase'), p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, morgul: m ? { pull: m.pull, pausing: m.pausing, gaze: m.gaze } : null, climb: c ? { s: c.s, stamina: c.stamina, spent: c.spent, ledge: onLedge(c.s), crumbling: crumbling(c.s) } : null, phial: ph ? { charge: ph.charge, on: ph.on } : null, hunted: ['alert', 'chase'].includes(s.shelob?.list?.[0]?.mode), duel: du ? { phase: du.phase, wounds: du.wounds, hearts: du.hearts } : null, spotted: Boolean(s.orcs?.list.some((w) => w.mode === 'alert' || w.mode === 'chase')), crumbs: cr ? { state: cr.state, left: cr.left, time: crumbsLeft(cr), stirred: cr.stirred, say: s.said } : null });
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && (s.zone === 'lair' || s.zone === 'tower')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // look round by dragging; the stick on touch
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk') drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      else if (s.mode === 'crumbs' && api.current?.cloakAt) {
        // a tap on the cloak brushes there
        const r = e.currentTarget.getBoundingClientRect();
        const at = api.current.cloakAt(e.clientX - r.left, e.clientY - r.top);
        if (at && Math.abs(at.u) < CRUMBS.w / 2 + 0.1 && Math.abs(at.v) < CRUMBS.d / 2 + 0.1) doBrush(at.u, at.v);
      }
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
  const stick = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture(e.pointerId);
      stick.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      audioContext();
    }
    if (!stick.current || stick.current.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture') {
      stick.current = null;
      s.stick = { x: 0, y: 0 };
      e.currentTarget.style.setProperty('--sx', '0px');
      e.currentTarget.style.setProperty('--sy', '0px');
      return;
    }
    const dx = Math.max(-1, Math.min(1, (e.clientX - stick.current.x) / 46));
    const dy = Math.max(-1, Math.min(1, (e.clientY - stick.current.y) / 46));
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };
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
  const stay = () => toZone('tower', TOWER_IN);
  const sideTask = { ...SIDE, open: prog.done.includes(SIDE.needs), done: side.won, best: side.best != null ? CRUMB_SAYS.best(side.best) : null };
  const sideOpen = sideTask.open;

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const title = hud.zone === 'tower' ? 'The Tower of Cirith Ungol' : hud.zone === 'lair' ? 'Shelob’s Lair' : hud.zone === 'stairs' ? 'The Stairs' : 'Minas Morgul';
  const M = hud.morgul;
  const Cl = hud.climb;
  const D = hud.duel;
  const Cr = mode === 'crumbs' ? hud.crumbs : null;
  return (
    <div ref={box} className="shire-stage cirith-stage" data-touch={touch || undefined} data-mode={mode} data-zone={hud.zone ?? sim.current.zone} data-game={['morgul', 'climb', 'duel', 'crumbs'].includes(mode) || (walking && hud.zone === 'lair') || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Cirith Ungol in 3D: Minas Morgul's green light, the endless stairs, Shelob's lair, and the Tower" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="shire-loading">To the Morgul vale…</p>}

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="cirith-title" className="shire-title">
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
      {!walking && (
        <h1 id="cirith-title" className="sr-only">
          Cirith Ungol
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
            {here.act} {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {node && <Convo title={title} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {mode === 'morgul' && M && (
        <div className="shire-panel cirith-game" role="group" aria-label="Minas Morgul" data-pause={M.pausing || undefined}>
          <p className="shire-panel-title">{M.pausing ? 'He’s feeling for you. Look away!' : Math.abs(M.gaze) < MORGUL.cone ? 'You’re looking at it…' : 'Don’t look at the city'}</p>
          <div className="shire-meter" role="meter" aria-label="The city’s pull" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(M.pull * 100)}>
            <span className="shire-meter-label">The pull</span>
            <span className="shire-meter-bar cirith-meter-pull">
              <span style={{ transform: `scaleX(${Math.min(1, M.pull)})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm cirith-big" aria-label="Look left" {...hold('steer', -1)}>
                ◀ Look away
              </button>
              <button type="button" className="btn btn-ghost btn-sm cirith-big" aria-label="Look right" {...hold('steer', 1)}>
                Look away ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to turn your eyes from the city.</p>
          )}
        </div>
      )}
      {mode === 'climb' && Cl && (
        <div className="shire-panel cirith-game" role="group" aria-label="The stairs" data-crumbling={Cl.crumbling || undefined}>
          <p className="shire-panel-title">{Cl.spent ? 'Rest…' : Cl.crumbling ? 'The steps are crumbling! Keep going!' : Cl.ledge ? 'A ledge: rest here' : 'Up the stairs'}</p>
          <div className="shire-meter" role="meter" aria-label="How far up" aria-valuemin={0} aria-valuemax={STAIRS.len} aria-valuenow={Math.round(Cl.s)}>
            <span className="shire-meter-label">Up</span>
            <span className="shire-meter-bar cirith-meter-up">
              <span style={{ transform: `scaleX(${Cl.s / STAIRS.len})` }} />
            </span>
          </div>
          <div className="shire-meter" role="meter" aria-label="Strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Cl.stamina * 100)}>
            <span className="shire-meter-label">Legs</span>
            <span className="shire-meter-bar cirith-meter-legs">
              <span style={{ transform: `scaleX(${Cl.stamina})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm cirith-big" {...hold('up', 1)}>
                Climb
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold W to climb; let go to rest.</p>
          )}
        </div>
      )}
      {walking && hud.zone === 'lair' && hud.phial && (
        <div className="shire-panel cirith-game" role="group" aria-label="The phial" data-hunted={hud.hunted || undefined}>
          <p className="shire-panel-title">{hud.hunted ? 'She’s coming!' : 'The phial of Galadriel'}</p>
          <div className="shire-meter" role="meter" aria-label="The phial’s light" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.phial.charge * 100)}>
            <span className="shire-meter-label">Light</span>
            <span className="shire-meter-bar cirith-meter-phial">
              <span style={{ transform: `scaleX(${hud.phial.charge})` }} />
            </span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm cirith-big" {...hold('hold', 1)}>
                Raise the phial
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold Space (or C) to raise it. It drives her back within {PHIAL.reach} m, but it fades.</p>
          )}
        </div>
      )}
      {mode === 'duel' && D && (
        <div className="shire-panel cirith-game" role="group" aria-label="Samwise the Brave" data-tell={D.phase === 'tell' || D.phase === 'strike' || undefined} data-rear={D.phase === 'rear' || undefined}>
          <p className="shire-panel-title">{D.phase === 'rear' ? 'She rears! Stab!' : D.phase === 'tell' || D.phase === 'strike' ? 'She strikes! Dodge!' : 'Let him go, you filth!'}</p>
          <p className="shire-panel-stats">
            <span>
              Wounds <b>{D.wounds}</b> of {DUEL.wounds}
            </span>
            <span>
              Sam <b>{'♥'.repeat(Math.max(0, D.hearts))}</b>
            </span>
          </p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm cirith-big" onPointerDown={(e) => (e.preventDefault(), doDodge())}>
              Dodge {!touch && <kbd>A</kbd>}
            </button>
            <button type="button" className="btn btn-primary btn-sm cirith-big" onPointerDown={(e) => (e.preventDefault(), doStab())}>
              Stab {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {walking && hud.zone === 'tower' && hud.spotted && (
        <div className="shire-panel cirith-game" role="status">
          <p className="shire-panel-title">An orc has seen you!</p>
        </div>
      )}
      {Cr && (
        <div className="shire-panel cirith-crumbs" role="group" aria-label="Crumbs on Sam’s cloak" data-stir={Cr.stirred > 0 || undefined}>
          <p className="shire-panel-title">{Cr.state === 'clean' ? 'Not a crumb' : Cr.state === 'woke' ? 'Too late' : 'Crumbs on Sam’s cloak'}</p>
          {Cr.say && (
            <p className="shire-panel-say" aria-live="polite">
              {Cr.say}
            </p>
          )}
          {Cr.state === 'on' && (
            <div className="shire-meter" role="meter" aria-label="Till Frodo wakes" aria-valuemin={0} aria-valuemax={CRUMBS.time} aria-valuenow={Math.round(Cr.time)}>
              <span className="shire-meter-label">Till he wakes</span>
              <span className="shire-meter-bar cirith-meter-dawn">
                <span style={{ transform: `scaleX(${Cr.time / CRUMBS.time})` }} />
              </span>
            </div>
          )}
          <p className="shire-panel-stats">
            <span>
              Crumbs left <b>{Cr.left}</b> of {CRUMBS.n}
            </span>
          </p>
          {Cr.state === 'on' ? (
            <>
              <p className="shire-panel-help">{touch ? 'Tap the crumbs on the cloak to brush them off. Tapping at nothing rustles, and he wakes the sooner.' : 'Click the crumbs, or move your hand with W A S D and brush with Space. Brushing at nothing rustles, and he wakes the sooner.'}</p>
              <div className="shire-panel-row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={leaveCrumbs}>
                  Stop {!touch && <kbd>Esc</kbd>}
                </button>
              </div>
            </>
          ) : (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={startCrumbs}>
                Again {!touch && <kbd>R</kbd>}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={leaveCrumbs}>
                Back
              </button>
            </div>
          )}
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel cirith-end" role="dialog" aria-label="Into Mordor">
          <p className="shire-panel-title">Into Mordor</p>
          <p className="shire-panel-say">In orc-gear, the two of them climb down from the pass into the plain of Gorgoroth. Ahead, under the Eye, the fire of Mount Doom.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to Mount Doom
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay here
            </button>
          </div>
          {sideOpen && (
            <button type="button" className="btn btn-ghost btn-sm cirith-side-go" onClick={startCrumbs}>
              On the side: {SIDE.name}
            </button>
          )}
        </div>
      )}
      {walking && touch && (hud.zone === 'lair' || hud.zone === 'tower') && <Stick onStick={onStick} />}
      {list && (
        <QuestList title="Things to do" quests={prog.quests} next={prog.next} onClose={() => setList(false)}>
          <SideList tasks={[sideTask]} onGo={startCrumbs} canGo={(t) => t.open && (sim.current.mode === 'walk' || sim.current.mode === 'end')} />
        </QuestList>
      )}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="cirith-title" className="title">
        Cirith Ungol
      </h1>
      <p className="lead mt-4 max-w-[60ch]">Minas Morgul, the endless stairs, Shelob’s lair and the Tower, to walk through in 3D. {prog.objective}</p>
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
