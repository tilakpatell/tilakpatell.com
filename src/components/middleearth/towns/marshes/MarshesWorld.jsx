import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';
import { readPad, typing } from '../../../games/pad';
import { Convo, QuestList, Stick, Travellers } from '../TownHud';
import { SideList } from '../SideList';
import { readSide, recordSide } from '../side';
import { useTravellers } from '../useTravellers';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { nearest } from '../story';
import { newTalk, talkNode, talkOn } from '../talk';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { newWatchers, stepWatchers } from '../watchers';
import { newLead, stepLead } from '../lorien/rules';
import { BED, EMYN_COLLIDERS, EMYN_START, EMYN_WALLS, GATE_COLLIDERS, GATE_WALLS, LIGHTS, LOOKOUT, MARSH_PATH, MARSH_START, POOL_BANK, SCOUT_ROUNDS, SLOPE_START, SPOTS, inMarsh, validAt } from './layout';
import { CONVOS, QUESTS, SAYS, SEAL, SIDE, SPEAKERS, WAY_SAYS, marshesProgress } from './story';
import { CREEP, ROPE, SCOUTS, WAY, hopWay, newCreep, newDescent, newFell, newLure, newWay, pounce, stepCreep, stepDescent, stepFell, stepLure, stepWay } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './marshes.css';
import '../../../../styles/lazy/middleearth.css';
import GuideCue from '../../../guide/GuideCue';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// The Emyn Muil, the Dead Marshes and the Black Gate: the eighth stretch
// of the road, Frodo and Sam alone with Gollum. The places are in
// ./layout.js, the story in ./story.js, the games in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the talk and the
// games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-marshes-done';
const AT = 'tp-marshes-at';
// Sméagol's safe way, on the side: { won, best } (best: fewest slips)
const SIDE_KEY = 'tp-marshes-side';
// where the firm ground runs out of the marshes, east, onto the ash
const MARSH_END = MARSH_PATH[MARSH_PATH.length - 1];
const sounds = () => import('./sounds');
const walkers = {
  emyn: makeWalker({ radius: 400, colliders: EMYN_COLLIDERS, walls: EMYN_WALLS }),
  marsh: makeWalker({ radius: 400, colliders: [], walls: [], blocked: inMarsh }),
  gate: makeWalker({ radius: 400, colliders: GATE_COLLIDERS, walls: GATE_WALLS }),
};
// camera shots for the conversations: where from, and at what, in the
// zone's own coordinates (y over the ground there)
const SHOTS = {
  down: { at: [2.6, 2.4, EMYN_START.z + 3.4], look: [-0.1, 0.5, EMYN_START.z - 2.6] },
  smeagol: { at: [BED.x + 1.2, 1.6, BED.z + 3.2], look: [BED.x - 2, 0.3, BED.z - 0.2] },
  faces: { faces: true },
  across: { at: [MARSH_START.x - 4, 2, MARSH_START.z + 4], look: [MARSH_START.x + 6, 0.6, MARSH_START.z - 1] },
  gate: { gate: true },
};
const PROMPT = {
  rope: { name: 'The cliff', act: 'Down the rope' },
  bed: { name: 'Sam, asleep', act: 'Lie down' },
  pool: { name: 'Sméagol’s safe way', act: 'Follow Sméagol' },
};

export default function MarshesWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return marshesProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = marshesProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = marshesProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  // the safe way on the side: kept apart from the story's progress
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
    <section className="shire-world marshes-world" aria-labelledby="marshes-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} complete={complete} side={side} recordGo={recordGo} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, complete, side, recordGo, gl, setGl, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const trav = useTravellers('dead-marshes', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const zone = prog.finished ? 'gate' : prog.zone;
    const at = validAt(local.get(AT, null), zone);
    const h = newWalker(at);
    sim.current = { zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.34, dragAt: -1e9, mode: 'walk', talking: null, talk: null, near: null, frame: 0, moved: false, t: 0, stepT: 0, air: null, padBefore: null, descent: null, creep: null, lead: null, lure: null, fell: null, faced: false, scouts: null, hide: 0, cKey: false, busy: false, steer: 0, lower: 0, still: 0, way: null, said: null, safeN: 0 };
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
      .then(({ createMarshesWorld }) => {
        if (dead || !canvas.current) return null;
        return createMarshesWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__MARSHES__ = { api: a, sim: sim.current, complete };
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
  // the air: wind and thunder in the rocks, the marsh's drip and croak,
  // the ash-wind before the Gate
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
    s.h = newWalker(at);
    s.yaw = behindYaw(at.face);
    s.busy = false;
    s.air?.place(zone);
  }, []);

  const startRope = useCallback(() => {
    const s = sim.current;
    s.zone = 'emyn';
    s.mode = 'rope';
    s.descent = newDescent();
    s.busy = false;
    sounds().then((x) => x.thunder());
  }, []);

  const startCreep = useCallback(() => {
    const s = sim.current;
    s.mode = 'creep';
    s.creep = newCreep(Math.floor(Math.random() * 1000) + 1);
    s.busy = false;
    say('Lie still. Something is coming down the rock above you.', true);
  }, [say]);

  // across the marsh behind Gollum, from the start or from a way along
  const startMarsh = useCallback(
    (from = 0) => {
      const s = sim.current;
      const i = Math.max(0, Math.min(MARSH_PATH.length - 2, from));
      const [x, z] = MARSH_PATH[i];
      toZone('marsh', { x, z, face: 0 });
      s.lead = newLead(MARSH_PATH.slice(i + 1));
      s.lead.base = i + 1;
      s.lure = newLure();
      s.fell = newFell();
    },
    [toZone],
  );

  const startGate = useCallback(() => {
    const s = sim.current;
    toZone('gate', SLOPE_START);
    s.scouts = newWatchers(SCOUT_ROUNDS);
  }, [toZone]);

  // Sméagol's safe way across a pool, and what he says there, in his voice
  // (./voicelines.js)
  const waySay = useCallback((text) => {
    sim.current.said = text;
    sayVoiced('gollum', text);
  }, []);
  const startWay = useCallback(() => {
    const s = sim.current;
    s.mode = 'way';
    s.way = newWay(Math.floor(Math.random() * 1000) + 1);
    s.h = newWalker(POOL_BANK);
    waySay(WAY_SAYS.start);
    s.safeN = 0;
    sounds().then((x) => x.gollum(0.4));
  }, [waySay]);
  const leaveWay = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'way') return;
    s.mode = 'walk';
    s.way = null;
    s.h = newWalker({ x: POOL_BANK.x, z: POOL_BANK.z + 0.8, face: 0 });
    s.yaw = behindYaw(0);
    s.dragAt = s.t;
  }, []);
  // a hop: -1 to the left, 0 straight on, 1 to the right
  const hop = useCallback(
    (dir) => {
      const s = sim.current;
      if (s.mode !== 'way' || !s.way) return;
      const r = hopWay(s.way, dir);
      if (r === 'safe') {
        sounds().then((x) => x.squelch(1));
        s.safeN += 1;
        if (s.safeN % 2 === 0) waySay(WAY_SAYS.safe[(s.safeN / 2 - 1) % WAY_SAYS.safe.length]);
      } else if (r === 'sank') {
        sounds().then((x) => x.sink());
        api.current?.fx('sank');
        waySay(s.way.sankAt?.lit ? WAY_SAYS.lit : WAY_SAYS.sank);
      } else if (r === 'across') {
        sounds().then((x) => x.squelch(1));
        api.current?.fx('across');
        waySay(WAY_SAYS.won(s.way.slips));
        recordGo({ won: true, score: s.way.slips });
      }
    },
    [recordGo, waySay],
  );

  const enter = useCallback(
    (id) => {
      audioContext();
      const s = sim.current;
      if (id === 'rope') startRope();
      else if (id === 'bed') {
        s.h = newWalker({ x: BED.x - 0.9, z: BED.z, face: BED.face });
        startCreep();
      } else if (id === 'pool') startWay();
      setList(false);
    },
    [startRope, startCreep, startWay],
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
        if (s.talking === 'gate' && s.talk.at === 'open') {
          api.current?.fx('gate');
          sounds().then((x) => x.gate());
        }
        if (s.talking === 'down' && s.talk.at === 'sam') api.current?.fx('rope');
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'down') {
        complete('rope');
        s.descent = null;
        toZone('emyn', EMYN_START);
        say('Night falls. Sam is asleep already by the rock. Lie down by him.', false);
      } else if (which === 'smeagol') {
        complete('smeagol');
        s.creep = null;
        startMarsh(0);
        startTalk('across');
      } else if (which === 'across') s.mode = 'walk';
      else if (which === 'faces') {
        const back = s.lead ? Math.max(0, s.lead.base + s.lead.i - 3) : 0;
        startMarsh(back);
      } else if (which === 'gate') {
        complete('gate');
        s.scouts = null;
        s.mode = 'end';
      } else s.mode = 'walk';
      return undefined;
    },
    [complete, say, startMarsh, startTalk, toZone],
  );

  const doPounce = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'creep' || !s.creep || s.busy) return;
    const r = pounce(s.creep);
    if (r === 'caught') {
      api.current?.fx('pounce');
      sounds().then((x) => x.scuffle());
      later(() => sim.current?.mode === 'creep' && startTalk('smeagol'), 700);
      s.busy = true;
    } else if (r === 'early') {
      s.busy = true;
      say('Too soon! He’s away up the rock like a spider. Lie still, and wait for him to come right down.', true);
      later(() => sim.current?.mode === 'creep' && startCreep(), 2200);
    }
  }, [later, say, startCreep, startTalk]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'creep') return doPounce();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doPounce, enter]);

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
      if (s.mode === 'way') {
        const m = moveOf(e);
        if (!e.repeat && (m === 'left' || m === 'up' || m === 'right')) hop(m === 'left' ? -1 : m === 'right' ? 1 : 0);
        else if (k === 'Escape') leaveWay();
        else if ((k === 'r' || k === 'R') && s.way?.state === 'across') startWay();
        return;
      }
      if ((k === ' ' || k === 'e' || k === 'E' || k === 'Enter') && !onButton && !e.repeat) {
        if (s.mode === 'creep' || (s.mode === 'walk' && s.near)) {
          e.preventDefault();
          doAct();
        }
      } else if ((k === 'm' || k === 'M') && s.mode === 'walk') setList((v) => !v);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, talkOnward, doAct, hop, leaveWay, startWay]);

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
    // getting down, or under the cloak: C, Space held, the button
    const hiding = s.mode === 'walk' && (s.zone === 'marsh' || s.zone === 'gate') && (s.cKey || (held('space') && !s.near) || s.hide > 0 || Boolean(pad?.b));

    // walking
    let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
    let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
    if (pad) {
      fwd -= pad.ly;
      side += pad.lx;
    }
    const trying = Math.hypot(fwd, side) > 0.15;
    if (s.mode === 'walk' && !s.busy) {
      if (pad) {
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
        if (pressed('a')) doAct();
      }
      if (hiding) {
        fwd = 0;
        side = 0;
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
    s.h.hiding = hiding;

    // the rope
    if (s.mode === 'rope' && s.descent && !s.busy) {
      const lower = held('down') || held('space') || s.lower > 0 || s.stick.y > 0.4 || Boolean(pad?.a);
      const steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x + (s.steer ?? 0) + (pad ? pad.lx : 0);
      for (const e of stepDescent(s.descent, dt, { lower, steer })) {
        if (e.type === 'knock') {
          a.fx('knock');
          sounds().then((x) => x.knock());
          say(s.descent.knocks === 1 ? 'You swing into the rock, hard. Swing clear of the outcrops (A and D).' : 'Another! Your hands are slipping on the rope.', true);
        } else if (e.type === 'fell') {
          s.busy = true;
          say(SAYS.fell.text, true, SAYS.fell.who);
          later(() => sim.current?.mode === 'rope' && startRope(), 2200);
        } else if (e.type === 'down') {
          sounds().then((x) => x.thunder());
          s.h = newWalker({ x: -0.5, z: EMYN_START.z - 1.2, face: Math.PI / 2 });
          startTalk('down');
        }
      }
    }

    // Sméagol, creeping down
    if (s.mode === 'creep' && s.creep && !s.busy) {
      const moving = trying || held('run');
      s.still = moving ? 0 : s.still + dt;
      if (pad && pressed('a')) doPounce();
      for (const e of stepCreep(s.creep, dt, moving)) {
        if (e.type === 'look') sounds().then((x) => x.gollum(0.5));
        else if (e.type === 'spooked') {
          sounds().then((x) => x.gollum(1));
          say('He saw you move! He scuttles back up the rock. Lie still while he looks.', true);
        } else if (e.type === 'reach') {
          a.fx('reach');
          say('His hand reaches for the Ring at your neck… Now! (Space)', true);
        } else if (e.type === 'late') {
          s.busy = true;
          say('Too late! He’s on Sam, his hands at his throat. You drag him off, and he’s away up the rock… Again: grab him the moment he reaches.', true);
          later(() => sim.current?.mode === 'creep' && startCreep(), 2400);
        }
      }
    }

    // the marshes: Gollum leading, the lights, the Nazgûl overhead
    if (s.zone === 'marsh' && s.mode === 'walk' && s.lead && !s.busy) {
      const path = MARSH_PATH.slice(s.lead.base);
      for (const e of stepLead(s.lead, dt, s.h, path)) {
        if (e.type === 'wait') say(SAYS.hurry.text, false, SAYS.hurry.who);
        else if (e.type === 'there') {
          complete('marsh');
          s.lead = null;
          startGate();
          say('Out of the marshes, and onto the ash. Ahead, the Black Gate. Along the slope to the rocks overlooking it; under the cloak when the scouts look (hold C).', false);
        }
      }
      if (s.lead) {
        for (const e of stepLure(s.lure, dt, s.h, LIGHTS)) {
          if (e.type === 'near') sounds().then((x) => x.wisp());
          else if (e.type === 'drawn') {
            s.busy = true;
            a.fx('drawn');
            sounds().then((x) => x.splash());
            if (!s.faced) {
              s.faced = true;
              later(() => sim.current && startTalk('faces'), 700);
            } else {
              say(SAYS.lights.text, true, SAYS.lights.who);
              later(() => {
                const ss = sim.current;
                if (!ss?.lead) return;
                startMarsh(Math.max(0, ss.lead.base + ss.lead.i - 3));
              }, 1800);
            }
          }
        }
        for (const e of stepFell(s.fell, dt, hiding)) {
          if (e.type === 'shriek') {
            a.fx('shriek');
            sounds().then((x) => x.shriek());
            say('A shriek, high up. “Nazgûl!” Get down! (hold C or Space)', true);
          } else if (e.type === 'over') a.fx('over');
          else if (e.type === 'gone') say('It wheels away, west. Up, and on.');
          else if (e.type === 'spotted') {
            s.busy = true;
            say('Its rider’s head turns. It saw you! Gollum pulls you flat in the reeds, too late… It’s circling. Back, and across again.', true);
            later(() => sim.current?.lead && startMarsh(0), 2400);
          }
        }
      }
    }

    // before the Gate: the scouts, and the cloak
    if (s.zone === 'gate' && s.mode === 'walk' && s.scouts && !s.busy) {
      for (const e of stepWatchers(s.scouts, s.h, dt, SCOUTS, { colliders: GATE_COLLIDERS, walls: GATE_WALLS, ring: false, active: !hiding, push: (x, z) => walkers.gate.push(x, z, 0.5) })) {
        if (e.type === 'seen') {
          sounds().then((x) => x.horn());
          say('A scout has seen you! Under the cloak, quick, or behind a rock!', true);
        } else if (e.type === 'lost') say('He stops, and looks about, and sees only a rock.');
        else if (e.type === 'caught') {
          s.busy = true;
          a.fx('caught');
          say('A hand on your collar… and Sam is there, and you roll away down the slope together, and lie under the cloak till he goes. Again: along to the lookout.', true);
          later(() => sim.current?.scouts && startGate(), 2200);
        }
      }
      if (Math.hypot(s.h.x - LOOKOUT.x, s.h.z - LOOKOUT.z) < LOOKOUT.r) startTalk('gate');
    }
    // Sméagol's safe way
    if (s.mode === 'way' && s.way) {
      if (pad) {
        if (pressed('left')) hop(-1);
        else if (pressed('right')) hop(1);
        else if (pressed('up') || pressed('a')) hop(0);
      }
      for (const e of stepWay(s.way, dt)) {
        if (e.type === 'gollum') sounds().then((x) => x.squelch(0.5));
        else if (e.type === 'shown') waySay(WAY_SAYS.shown);
        else if (e.type === 'again') {
          waySay(WAY_SAYS.again);
          s.safeN = 0;
        }
      }
    }
    // back across the marshes after, and out of them east onto the ash
    if (s.mode === 'walk' && s.zone === 'marsh' && !s.lead && p.done.includes('marsh') && s.h.x > MARSH_END[0] - 1.5) {
      if (p.next === 'gate') startGate();
      else toZone('gate', SLOPE_START);
      say('Out of the marshes, and onto the ash. Ahead, the Black Gate.', false);
    }
    // coming back to the Gate part
    if (s.mode === 'walk' && p.next === 'gate' && s.zone === 'gate' && !s.scouts) startGate();
    if (s.mode === 'walk' && p.next === 'marsh' && !s.lead) startMarsh(0);

    // what's here
    let spotHere = null;
    if (s.mode === 'walk' && s.zone === 'emyn') {
      if (p.next === 'rope') spotHere = 'rope';
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      if (sp && sp.quest === p.next) spotHere = sp.id;
    }
    // on the side, Sméagol's safe way, once you've crossed with him
    if (s.mode === 'walk' && s.zone === 'marsh' && !s.lead && p.done.includes(SIDE.needs) && Math.hypot(s.h.x - POOL_BANK.x, s.h.z - POOL_BANK.z) < 2.4) spotHere = 'pool';
    s.near = spotHere;

    const markers = s.zone === 'gate' && s.scouts ? [LOOKOUT] : s.zone === 'emyn' && p.next === 'smeagol' ? SPOTS : [];
    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: false, ring: false });
    const d = s.descent;
    const c = s.creep;
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          next: p.next,
          hobbit: s.h,
          hiding,
          travellers: tv ? tv.list() : null,
          talking: s.talking,
          speaker: node?.who ?? (s.mode === 'way' ? 'gollum' : null),
          line: s.talk?.at ?? null,
          camShot: s.mode === 'talk' && SHOTS[s.talking] ? { id: s.talking, ...SHOTS[s.talking] } : null,
          descent: d,
          creep: c ? { d: c.d, phase: c.phase, state: c.state } : null,
          lead: s.lead ? { x: s.lead.x, z: s.lead.z, face: s.lead.face, moving: s.lead.moving } : null,
          lure: s.lure?.k ?? 0,
          fell: s.fell ? { phase: s.fell.phase, phaseT: s.fell.phaseT } : null,
          scouts: s.scouts?.list ?? null,
          gateOpen: s.talking === 'gate' && ['open', 'go', 'no'].includes(s.talk?.at),
          way: s.mode === 'way' ? s.way : null,
          markers,
          stepT: s.stepT,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: s.zone === 'gate' ? 8.5 : touch ? 7.2 : 6.4,
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

    const w = s.mode === 'way' ? s.way : null;
    const key = [w ? [w.phase, w.row, w.slips, w.state, s.said].join(',') : '', s.zone, s.mode, s.near, s.moved, s.talking, s.talk?.at, hiding, d ? Math.round(d.y) : '', d?.knocks, c ? Math.round(c.d * 2) : '', c?.phase, s.lure ? Math.round(s.lure.k * 20) : '', s.fell?.phase, s.lead?.waiting, s.scouts?.list.some((w) => w.mode === 'alert' || w.mode === 'chase'), p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, hiding, rope: d ? { y: d.y, knocks: d.knocks } : null, creep: c ? { d: c.d, phase: c.phase } : null, lure: s.lure?.k ?? 0, fell: s.fell?.phase ?? null, leading: Boolean(s.lead), hunted: Boolean(s.scouts?.list.some((x) => x.mode === 'alert' || x.mode === 'chase')), way: w ? { phase: w.phase, row: w.row, slips: w.slips, state: w.state, say: s.said } : null });
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && !s.lead) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
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
  const sideTask = { ...SIDE, open: prog.done.includes(SIDE.needs), done: side.won, best: side.best != null ? WAY_SAYS.best(side.best) : null };
  const goSide = () => {
    toZone('marsh', { x: POOL_BANK.x, z: POOL_BANK.z + 1.2, face: Math.PI / 2 });
    setList(false);
  };
  const travel = (q) => {
    if (q.id === 'smeagol') toZone('emyn', EMYN_START);
    else if (q.id === 'marsh') startMarsh(0);
    else if (q.id === 'gate') startGate();
    setList(false);
  };
  const stay = () => toZone('gate', { x: LOOKOUT.x - 3, z: LOOKOUT.z, face: 0 });

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const W = mode === 'way' ? hud.way : null;
  const objective = hud.zone === 'marsh' && !hud.leading && prog.done.includes('marsh') ? 'The marshes, crossed once already. Out of them east, onto the ash, to the Black Gate.' : hud.leading ? (hud.fell === 'warn' || hud.fell === 'over' ? 'Nazgûl! Get down, and stay down (hold C or Space).' : 'Follow Gollum on the firm ground. Don’t follow the lights.') : hud.zone === 'gate' && !prog.finished ? 'Along the slope to the lookout, east. Hold C under the cloak when the scouts look.' : prog.objective;
  const showHide = walking && (hud.zone === 'marsh' || hud.zone === 'gate') && touch;
  return (
    <div ref={box} className="shire-stage marshes-stage" data-touch={touch || undefined} data-mode={mode} data-zone={hud.zone ?? sim.current.zone} data-game={['rope', 'creep', 'way'].includes(mode) || hud.leading || undefined} data-hiding={hud.hiding || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="The Emyn Muil, the Dead Marshes and the Black Gate in 3D: razor rock in a storm, black pools with lights in them, and the Gate of Mordor" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Into the Emyn Muil" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="marshes-title" className="shire-title">
              {hud.zone === 'marsh' ? 'The Dead Marshes' : hud.zone === 'gate' ? 'The Black Gate' : 'The Emyn Muil'}
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
        <h1 id="marshes-title" className="sr-only">
          The Emyn Muil, the Dead Marshes and the Black Gate
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
      {gl === 'on' && walking && !hud.moved && !here && !hud.leading && <p className="shire-hint">{touch ? 'Drag the stick to walk. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}<GuideCue touch={touch} /></p>}

      {node && <Convo title={hud.zone === 'marsh' ? 'The Dead Marshes' : hud.zone === 'gate' ? 'The Black Gate' : 'The Emyn Muil'} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {walking && hud.leading && hud.lure > 0.05 && (
        <div className="shire-panel marshes-game" role="group" aria-label="The lights">
          <p className="shire-panel-title">The light is drawing you…</p>
          <div className="shire-meter" role="meter" aria-label="How far it has you" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.lure * 100)}>
            <span className="shire-meter-label">The light</span>
            <span className="shire-meter-bar marshes-meter-lure">
              <span style={{ transform: `scaleX(${Math.min(1, hud.lure)})` }} />
            </span>
          </div>
          <p className="shire-panel-help">Walk on. Don’t look at it.</p>
        </div>
      )}
      {mode === 'rope' && hud.rope && (
        <div className="shire-panel marshes-game" role="group" aria-label="Down the rope">
          <p className="shire-panel-title">Down the cliff</p>
          <div className="shire-meter" role="meter" aria-label="How far down" aria-valuemin={0} aria-valuemax={ROPE.len} aria-valuenow={Math.round(hud.rope.y)}>
            <span className="shire-meter-label">Down</span>
            <span className="shire-meter-bar marshes-meter-rope">
              <span style={{ transform: `scaleX(${Math.min(1, hud.rope.y / ROPE.len)})` }} />
            </span>
          </div>
          <p className="shire-panel-stats">
            <span>
              Knocks <b>{hud.rope.knocks}</b> of {ROPE.knocks}
            </span>
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Swing left" {...hold('steer', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-primary btn-sm marshes-big" {...hold('lower', 1)}>
                Let out rope
              </button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Swing right" {...hold('steer', 1)}>
                ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold S or Space to let the rope out; A and D to swing clear of the rock.</p>
          )}
        </div>
      )}
      {mode === 'creep' && hud.creep && (
        <div className="shire-panel marshes-game" role="group" aria-label="Sméagol" data-reach={hud.creep.phase === 'reach' || undefined} data-look={hud.creep.phase === 'look' || undefined}>
          <p className="shire-panel-title">{hud.creep.phase === 'reach' ? 'Now! Grab him!' : hud.creep.phase === 'look' ? 'He’s looking. Don’t move.' : 'Something creeps down the rock…'}</p>
          <div className="shire-meter" role="meter" aria-label="How close he is" aria-valuemin={0} aria-valuemax={CREEP.from} aria-valuenow={Math.round(CREEP.from - hud.creep.d)}>
            <span className="shire-meter-label">Close</span>
            <span className="shire-meter-bar marshes-meter-creep">
              <span style={{ transform: `scaleX(${Math.min(1, (CREEP.from - hud.creep.d) / (CREEP.from - CREEP.reach))})` }} />
            </span>
          </div>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm marshes-big" onPointerDown={(e) => (e.preventDefault(), doPounce())}>
              Grab him {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}
      {showHide && (
        <div className="marshes-hide">
          <button type="button" className="btn btn-primary btn-sm marshes-big" {...hold('hide', 1)}>
            {hud.zone === 'gate' ? 'Cloak' : 'Get down'}
          </button>
        </div>
      )}
      {W && (
        <div className="shire-panel marshes-game marshes-way" role="group" aria-label="Sméagol’s safe way" data-sunk={W.phase === 'sunk' || undefined} data-show={W.phase === 'show' || undefined}>
          <p className="shire-panel-title">{W.phase === 'show' ? 'Watch Sméagol’s feet…' : W.phase === 'sunk' ? 'In among the faces!' : W.state === 'across' ? 'Across!' : 'Sméagol’s safe way'}</p>
          {W.say && (
            <p className="shire-panel-say" aria-live="polite">
              <b>Gollum:</b> {W.say}
            </p>
          )}
          <p className="shire-panel-stats">
            <span>
              Row <b>{Math.max(0, W.row + 1)}</b> of {WAY.rows}
            </span>
            <span>
              Slips <b>{W.slips}</b>
            </span>
          </p>
          {W.phase === 'show' ? null : W.state === 'across' ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={startWay}>
                Again {!touch && <kbd>R</kbd>}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={leaveWay}>
                Back to the path
              </button>
            </div>
          ) : (
            <>
              <div className="shire-panel-row marshes-hops">
                {[
                  [-1, '↖', 'Hop left', 'A'],
                  [0, '↑', 'Hop straight on', 'W'],
                  [1, '↗', 'Hop right', 'D'],
                ].map(([dir, arrow, label, key]) => (
                  <button key={dir} type="button" className="btn btn-ghost btn-sm marshes-big" aria-label={label} disabled={W.phase !== 'play'} onPointerDown={(e) => (e.preventDefault(), hop(dir))} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), hop(dir))}>
                    {arrow} {!touch && <kbd>{key}</kbd>}
                  </button>
                ))}
              </div>
              <div className="shire-panel-row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={leaveWay}>
                  Back to the path {!touch && <kbd>Esc</kbd>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel marshes-end" role="dialog" aria-label="Another way">
          <p className="shire-panel-title">There is another way</p>
          <p className="shire-panel-say">Gollum leads you south, along the mountains of shadow, through Ithilien’s green woods, to the dead city of Minas Morgul and the stair that climbs above it. Sam doesn’t trust him. Neither, quite, do you.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to Cirith Ungol
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay here
            </button>
          </div>
        </div>
      )}
      {walking && touch && <Stick onMove={onStick} />}
      {list && (
        <QuestList title="Things to do" quests={prog.quests} next={prog.next} onClose={() => setList(false)} onGo={travel} canGo={(q) => q.open && !q.done && q.id !== 'rope' && sim.current.mode === 'walk'}>
          <SideList tasks={[sideTask]} onGo={goSide} canGo={(t) => t.open && sim.current.mode === 'walk' && !sim.current.lead} />
        </QuestList>
      )}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="marshes-title" className="title">
        The Dead Marshes
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The Emyn Muil, the Dead Marshes and the Black Gate, with Gollum, to walk through in 3D. {prog.objective}</p>
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
