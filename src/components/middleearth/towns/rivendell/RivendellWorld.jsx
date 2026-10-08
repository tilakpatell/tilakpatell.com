import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../../lib/voiced';
import { readPad, typing } from '../../../games/pad';
import { stepGaze } from '../../shire/rules';
import { Bubble, Convo, QuestList, Stick, Travellers } from '../TownHud';
import { useTravellers } from '../useTravellers';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { drawMap } from '../map';
import { nearest } from '../story';
import { newTalk, talkNode, talkOn } from '../talk';
import { sayInTurn } from '../voice';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { BRIDGE, COLLIDERS, COMPANIONS, COURT, GATE, GORGE, HOUSE, HOUSE_DOOR, PATHS, SPOTS, WALLS, WORLD, blocked, castFor, riverX, spot, validAt } from './layout';
import { ARGUMENT, CONVOS, QUESTS, RIDDLE_SAYS, SAYS, SEAL, SPEAKERS, rivendellProgress } from './story';
import { RIDDLE, SHARDS, SIDE, answer, asked, closeHand, followAt, gathered, join, lead, newCouncil, newParty, newReach, newRiddles, newShards, placed, speak, stepCouncil, stepReach, stepRiddles, tapShard } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './rivendell.css';
import '../../../../styles/lazy/middleearth.css';
import GuideCue from '../../../guide/GuideCue';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Rivendell, the fourth town on the road: wake in the house of Elrond after
// the Ford, and play the films' days there, from the shards of Narsil to
// the Fellowship setting out. The valley is in ./layout.js, the story in
// ./story.js, the games in ./rules.js, the drawing in ./scene.js; this is
// the walking, the HUD, the talk and the games, and on the side riddles
// with Bilbo, which the story never waits on. Without 3D, the scenes are
// listed as cards.

const DONE = 'tp-rivendell-done';
const SIDE_DONE = 'tp-rivendell-side'; // kept apart, so the story's count stays the story's
const AT = 'tp-rivendell-at';
const sounds = () => import('./sounds');
const sfx = () => import('../../../../lib/sfx');
const PROMPT = {
  narsil: { name: 'The hall of Narsil', act: 'Look at the shards' },
  council: { name: 'The Council of Elrond', act: 'Take your seat' },
  bilbo: { name: 'Bilbo’s pavilion', act: 'Go in' },
  gate: { name: 'The south gate', act: 'Set out' },
  riddles: { name: 'Bilbo, by his fire', act: 'Riddles with Bilbo' },
};
const walker = makeWalker({ radius: WORLD.radius, colliders: COLLIDERS, walls: WALLS, blocked });
const MAP_SCALE = 150 / (WORLD.radius * 2 + 6);
const CONVO_TITLE = { awake: 'The house of Elrond', narsil: 'The hall of Narsil', council: 'The Council of Elrond', axe: 'The Council of Elrond', fellowship: 'The Council of Elrond', bilbo: 'Bilbo’s pavilion', sorry: 'Bilbo’s pavilion', gate: 'The south gate' };
// the shards' lengths, as drawn in the puzzle: the hilt first
const SHARD_W = [1.5, 1.1, 0.9, 1.2, 0.8, 1];

export default function RivendellWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return rivendellProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = rivendellProgress(done);
  const [side, setSide] = useState(() => {
    const d = local.get(SIDE_DONE, []);
    return Array.isArray(d) && d.includes(SIDE.id);
  });
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  // the riddles, won: on the side, with their own seal but none on the map
  const winSide = useCallback(() => {
    setSide(true);
    local.set(SIDE_DONE, [SIDE.id]);
    unlock(SIDE.seal);
  }, [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = rivendellProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world riv-world" aria-labelledby="riv-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} side={side} winSide={winSide} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} side={side} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, done, complete, side, winSide, gl, setGl, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const trav = useTravellers('rivendell', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const map = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const waking = !done.includes('awake');
    const h = newWalker(validAt(local.get(AT, null), done));
    sim.current = {
      h,
      keys: new Set(),
      stick: { x: 0, y: 0 },
      yaw: behindYaw(h.face),
      pitch: 0.34,
      dragAt: -1e9,
      mode: waking ? 'inside' : 'walk',
      talking: waking ? 'awake' : null,
      talk: waking ? newTalk(CONVOS.awake) : null,
      samIn: false,
      wearing: false,
      gaze: 0,
      near: null,
      person: null,
      frame: 0,
      moved: false,
      t: 0,
      stepT: 0,
      air: null,
      wraith: null,
      padBefore: null,
      edgeAt: -9,
      shards: null,
      council: null,
      argued: 0,
      stood: false,
      axeSeen: false,
      reach: null,
      party: newParty(),
      busy: false,
      riddles: null,
    };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ mode: sim.current.mode, near: null, moved: false, talking: sim.current.talking });
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
  // Bilbo at his fire: a toast he speaks in, and once he's said it, the
  // riddle that's up, read out (./voicelines.js)
  const bilboSays = useCallback(
    (text, bad = false) => {
      say(text, bad);
      const g = sim.current.riddles;
      const q = g?.state === 'ask' ? asked(g) : null;
      sayInTurn([text, q?.q].filter(Boolean).map((t) => ({ who: 'bilbo', text: t })));
    },
    [say],
  );
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
      .then(({ createRivendellWorld }) => {
        if (dead || !canvas.current) return null;
        return createRivendellWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__RIVENDELL__ = { api: a, sim: sim.current, complete }; // for the QA scripts
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
      if (s.mode === 'walk') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      s.wraith?.();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;

  // the falls and the birds, while the valley's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.valley();
      s.air.inside(s.mode === 'inside' ? 1 : 0);
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);

  // ── the Ring ──
  const putRing = useCallback(
    (on) => {
      const s = sim.current;
      if (s.wearing === on) return;
      s.wearing = on;
      if (on) {
        sfx().then((x) => {
          if (s.wearing) s.wraith = x.wraith();
        });
        say('You slip it on, here of all places. The Elves turn, and Elrond’s face goes hard.', true);
      } else {
        s.wraith?.();
        s.wraith = null;
      }
    },
    [say],
  );

  const startTalk = useCallback((id, mode = null) => {
    const s = sim.current;
    if (mode) s.mode = mode;
    s.talking = id;
    s.talk = newTalk(CONVOS[id]);
    s.stepT = 0;
  }, []);

  const outside = useCallback((at = HOUSE_DOOR) => {
    const s = sim.current;
    s.mode = 'walk';
    s.talking = null;
    s.talk = null;
    s.h = newWalker(at);
    s.yaw = behindYaw(at.face);
    s.dragAt = s.t;
    s.air?.inside(0);
  }, []);

  const enter = useCallback(
    (id) => {
      const s = sim.current;
      const p = progRef.current;
      audioContext();
      if (id === 'narsil') startTalk('narsil', 'narsil');
      else if (id === 'council') {
        s.council = null;
        s.stood = false;
        s.argued = 0;
        startTalk('council', 'council');
      } else if (id === 'bilbo') startTalk('bilbo', 'bilbo');
      else if (id === 'riddles') {
        // on the side: riddles by Bilbo's fire
        s.mode = 'riddles';
        s.riddles = newRiddles(Math.floor(Math.random() * 1e6) + 1);
        sounds().then((x) => x.chime?.(1));
        bilboSays(RIDDLE_SAYS.start);
      } else if (id === 'gate') {
        if (p.finished) return onLeave?.();
        startTalk('gate', 'leaving');
      } else if (COMPANIONS.some((c) => c.id === id)) {
        const c = COMPANIONS.find((x) => x.id === id);
        if (join(s.party, id)) {
          api.current?.fx('joined');
          sounds().then((x) => x.chime(s.party.joined.length));
          say(c.joins, false, c.look);
          if (gathered(s.party, COMPANIONS)) later(() => say('All nine. The Fellowship is gathered. Lead them to the south gate.'), 2600);
        }
      }
      setList(false);
      return undefined;
    },
    [onLeave, startTalk, say, bilboSays, later],
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
      if (!s.talk.end) {
        if (s.talking === 'awake' && s.talk.at === 'sam') {
          s.samIn = true;
          sounds().then((x) => x.door());
        }
        return setHud((h) => ({ ...h, line: s.talk.at }));
      }
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'awake') {
        complete('awake');
        outside();
        say('Out on the terrace, the whole valley is gold, and the falls are loud. Explore; there’s someone in the hall of Narsil, to the north.');
      } else if (which === 'narsil') {
        s.shards = newShards(Math.floor(Math.random() * 1000) + 1);
        say('Tap a shard to pick it up, then tap where it goes. The hilt first, the blade’s point last.');
      } else if (which === 'council') {
        s.council = newCouncil();
        if (s.axeSeen) s.council.axed = true;
      } else if (which === 'axe') {
        say('The argument breaks out again, louder than before. Wait for the moment, then stand.', false);
      } else if (which === 'fellowship') {
        complete('council');
        s.council = null;
        s.stood = false;
        outside({ x: COURT.x, z: COURT.z + COURT.r + 2, face: -Math.PI / 2 });
        say('The Fellowship of the Ring. And by dusk, Bilbo wants to see you, in his pavilion.');
      } else if (which === 'bilbo') {
        s.reach = newReach(Math.floor(Math.random() * 1000) + 1);
        say('He reaches out. Keep the Ring in your open hand, and close it the moment his face changes. Not before.');
      } else if (which === 'sorry') {
        complete('bilbo');
        s.reach = null;
        outside({ x: -26, z: 24, face: 0 });
        say('Morning, clear and cold. The Fellowship are about the valley, saying their farewells. Gather them, and lead them to the south gate.');
      } else if (which === 'gate') {
        complete('fellowship');
        s.mode = 'end';
        sounds().then((x) => x.horn());
      }
      return undefined;
    },
    [complete, outside, say],
  );

  // the games' actions
  const doStand = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'council' || !s.council || s.talk) return;
    const r = speak(s.council);
    if (r === 'wait') say('Elrond lifts a hand towards you, without looking: wait. Hear them out.');
    else if (r === 'unheard') {
      sounds().then((x) => x.voices(0.6));
      say(SAYS.unheard.text, true, SAYS.unheard.who);
    } else if (r === 'heard') {
      s.stood = true;
      api.current?.fx('heard');
      sounds().then((x) => x.hush());
      say(SAYS.heard.text, false, SAYS.heard.who);
      later(() => sim.current?.mode === 'council' && startTalk('fellowship'), 4200);
    }
  }, [say, later, startTalk]);

  const doClose = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'bilbo' || !s.reach || s.talk) return;
    const r = closeHand(s.reach);
    if (r === 'early') {
      say(SAYS.early.text, true, SAYS.early.who);
      later(() => sim.current?.reach && (sim.current.reach = newReach(Math.floor(Math.random() * 1000) + 1)), 2200);
    } else if (r === 'won') {
      sounds().then((x) => x.gasp());
      later(() => sim.current?.mode === 'bilbo' && startTalk('sorry'), 900);
    }
  }, [say, later, startTalk]);

  const doShard = useCallback(
    (i) => {
      const s = sim.current;
      if (s.mode !== 'narsil' || !s.shards) return;
      const r = tapShard(s.shards, i);
      if (r) sounds().then((x) => x.clink(r === 'solved'));
      if (r === 'solved') {
        api.current?.fx('solved');
        complete('narsil');
        say(SAYS.narsil.text, false, SAYS.narsil.who);
        later(() => {
          const ss = sim.current;
          if (ss?.mode !== 'narsil') return;
          ss.shards = null;
          outside({ x: -3, z: -31.5, face: -Math.PI / 2 });
        }, 2600);
      }
      setHud((h) => ({ ...h, shards: s.shards ? { order: [...s.shards.order], held: s.shards.held, solved: s.shards.solved } : null }));
    },
    [complete, say, later, outside],
  );

  // ── on the side: riddles with Bilbo ──
  const leaveRiddles = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'riddles') return;
    if (s.riddles?.state === 'ask') stopVoiced(); // Bilbo, mid-riddle
    s.riddles = null;
    outside({ x: spot('bilbo').x + 0.8, z: spot('bilbo').z, face: 0 });
  }, [outside]);
  // (once, when a game's just ended)
  const riddleOver = useCallback(
    (g) => {
      if (g.told || g.state === 'ask') return;
      g.told = true;
      if (g.state === 'won') {
        winSide();
        api.current?.fx('joined');
        sounds().then((x) => x.chime?.(5));
        bilboSays(RIDDLE_SAYS.beaten);
        later(() => sim.current?.riddles === g && leaveRiddles(), 4200);
      } else if (g.state === 'lost') {
        bilboSays(RIDDLE_SAYS.mine, true);
        later(() => sim.current?.riddles === g && leaveRiddles(), 3400);
      }
    },
    [winSide, bilboSays, later, leaveRiddles],
  );
  const doRiddle = useCallback(
    (i) => {
      const s = sim.current;
      const g = s.riddles;
      if (s.mode !== 'riddles' || !g || g.state !== 'ask') return;
      const q = asked(g);
      const r = answer(g, i);
      if (!r) return;
      if (r === 'right') {
        sounds().then((x) => x.chime?.(Math.min(5, g.right)));
        bilboSays(RIDDLE_SAYS.right[(g.right - 1) % RIDDLE_SAYS.right.length]);
      } else {
        sounds().then((x) => x.clink?.(false));
        bilboSays(`“No, no! ${q.a[0]}.”`, true);
      }
      riddleOver(g);
      setHud((h) => ({ ...h, riddles: { at: g.at, right: g.right, wrong: g.wrong, state: g.state, candle: g.candle } }));
    },
    [bilboSays, riddleOver],
  );

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'council') return doStand();
    if (s.mode === 'bilbo') return doClose();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doStand, doClose, enter]);

  // the walking keys
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
      if (s.mode === 'riddles') {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          doRiddle(Number(k) - 1);
        } else if (k === 'Escape') leaveRiddles();
        return;
      }
      if (s.mode === 'narsil' && /^[1-6]$/.test(k)) {
        e.preventDefault();
        doShard(Number(k) - 1);
        return;
      }
      if (s.mode === 'walk') {
        if (moveOf(e)) {
          e.preventDefault();
          audioContext();
          return;
        }
        if ((k === 'e' || k === 'E' || k === 'Enter') && !onButton) {
          e.preventDefault();
          doAct();
        } else if (k === 'r' || k === 'R') putRing(!s.wearing);
        else if (k === 'm' || k === 'M') setList((v) => !v);
        return;
      }
      if ((s.mode === 'council' || s.mode === 'bilbo') && (k === ' ' || k === 'e' || k === 'E') && !onButton && !e.repeat) {
        e.preventDefault();
        doAct();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, putRing, talkOnward, doAct, doShard, doRiddle, leaveRiddles]);

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
        if (pressed('a')) doAct();
        if (pressed('x')) putRing(!s.wearing);
        if (pressed('y')) setList((v) => !v);
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = walker.step(s.h, { x: mv.x, z: mv.z, run }, dt);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
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
      if (s.h.edge && s.t - s.edgeAt > 6) {
        s.edgeAt = s.t;
        say('Cliffs all round, and the falls. The only way out is the south gate.');
      }
      // the Fellowship behind you
      lead(s.party, s.h.x, s.h.z);
    } else if (pad && pressed('a')) doAct();

    // the Council's argument
    if (s.mode === 'council' && s.council && !s.talk && !s.stood) {
      for (const e of stepCouncil(s.council, dt)) {
        if (e.type === 'axe') {
          s.axeSeen = true;
          a.fx('axe');
          sounds().then((x) => x.shatter());
          later(() => sim.current?.mode === 'council' && startTalk('axe'), 1700);
        } else if (e.type === 'height') say('Now. Stand up, and say it.', false);
        else if (e.type === 'drowned') {
          say('The voices and the Ring’s voice are all there is, and you can’t find your own. It begins again.', true);
          later(() => {
            const ss = sim.current;
            if (ss?.mode !== 'council') return;
            ss.council = newCouncil();
            ss.council.axed = true;
            ss.argued = 0;
          }, 2000);
        }
      }
      // the argument, line by line
      const due = Math.floor(Math.max(0, s.council.heat - 0.32) / 0.08);
      if (s.council.axed && !s.talk && due > s.argued && s.argued < ARGUMENT.length) {
        const { name, voice, line } = ARGUMENT[s.argued];
        s.argued += 1;
        say(`${name}: ${line}`, name === 'The Ring', voice, line);
        sounds().then((x) => x.voices(s.council?.heat ?? 0.5));
      }
    }
    // Bilbo's hand
    if (s.mode === 'bilbo' && s.reach && !s.talk) {
      for (const e of stepReach(s.reach, dt)) {
        if (e.type === 'lunge') {
          a.fx('lunge');
          sounds().then((x) => x.snarl());
        } else if (e.type === 'late') {
          say('His fingers close on it, and for a moment it isn’t Bilbo at all. You wrench it back. Try again: close your hand as he lunges.', true);
          later(() => sim.current?.reach && (sim.current.reach = newReach(Math.floor(Math.random() * 1000) + 1)), 2200);
        }
      }
    }

    // on the side: Bilbo's candle, burning down on each riddle
    if (s.mode === 'riddles' && s.riddles) {
      const g = s.riddles;
      for (const e of stepRiddles(g, dt)) {
        if (e.type === 'out') {
          sounds().then((x) => x.clink?.(false));
          bilboSays(RIDDLE_SAYS.out, true);
        }
      }
      riddleOver(g);
    }

    // the Ring: the Eye comes nearer while it's on
    s.gaze = stepGaze(s.gaze, s.wearing, dt);
    if (s.wearing && s.gaze >= 1) {
      putRing(false);
      say('The Eye. You pull the Ring off, shaking.', true);
    }

    // what's here, and who's here
    const gathering = p.next === 'fellowship';
    let spotHere = null;
    if (s.mode === 'walk') {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      const ok = sp && ((sp.id === 'narsil' && p.next === 'narsil') || (sp.id === 'council' && p.next === 'council') || (sp.id === 'bilbo' && p.next === 'bilbo') || (sp.id === 'gate' && ((gathering && gathered(s.party, COMPANIONS)) || p.finished)));
      spotHere = ok ? sp.id : null;
      // on the side: Bilbo's always glad of a game of riddles
      if (!spotHere && sp?.id === 'bilbo' && p.next !== 'awake' && p.next !== 'bilbo') spotHere = 'riddles';
      if (!spotHere && gathering) spotHere = nearest(COMPANIONS.filter((c) => !s.party.joined.includes(c.id)), s.h.x, s.h.z, 2.6)?.id ?? null;
    }
    s.near = spotHere;
    const cast = castFor(p.next);
    let person = null;
    if (s.mode === 'walk' && !COMPANIONS.some((c) => c.id === s.near)) person = nearest(cast, s.h.x, s.h.z, 2.8)?.id ?? null;
    if (person !== s.person) {
      s.person = person;
      if (person) {
        const c = cast.find((x) => x.id === person);
        const n = lines.current[person] ?? 0;
        lines.current[person] = n + 1;
        setBubble({ id: person, name: c.name, line: c.lines[n % c.lines.length] });
      } else setBubble(null);
    }

    // where to go next
    const markers = p.finished ? [spot('gate')] : gathering ? (gathered(s.party, COMPANIONS) ? [spot('gate')] : COMPANIONS.filter((c) => !s.party.joined.includes(c.id))) : p.next === 'narsil' ? [spot('narsil')] : p.next === 'council' ? [spot('council')] : p.next === 'bilbo' ? [spot('bilbo')] : [];

    // the Fellowship's places behind you
    const party = {};
    s.party.joined.forEach((id, i) => {
      const at = followAt(s.party, i);
      if (at) party[id] = { ...at, moving: s.h.speed > 0.4 };
    });
    // who's speaking, for the talk camera
    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const speaker = node?.who ?? null;

    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.mode !== 'walk', ring: s.wearing });
    try {
      a.render(
        {
          hobbit: s.h,
          travellers: tv ? tv.list() : null,
          sky: p.sky,
          mode: s.mode === 'end' ? 'leaving' : s.mode,
          talking: s.talking,
          speaker,
          speakerAt: speaker && s.mode === 'talk' ? a.headOf(speaker) : null,
          samIn: s.samIn,
          cast: cast.map((c) => c.id),
          gathering,
          party,
          council: s.council,
          shards: s.shards,
          stood: s.stood,
          reach: s.reach,
          riddles: s.riddles,
          stepT: s.stepT,
          wearing: s.wearing,
          gaze: s.gaze,
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 7.2 : 6.4,
          near: s.near,
          talk: s.person,
          markers,
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

    // the HUD, when what it shows changes
    const c = s.council;
    const r = s.reach;
    const sh = s.shards;
    const key = [s.mode, s.near, s.moved, s.talking, s.talk?.at, s.wearing, Math.round(s.gaze * 20), c ? Math.round(c.heat * 30) : '', c?.spoken, s.stood, r ? Math.round(r.hand * 20) : '', r?.state, sh ? sh.order.join() + sh.held : '', s.party.joined.length, s.riddles ? `${s.riddles.at}.${s.riddles.state}.${Math.ceil(s.riddles.candle * 32)}` : ''].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({
        mode: s.mode,
        near: s.near,
        moved: s.moved,
        talking: s.talking,
        line: s.talk?.at ?? null,
        wearing: s.wearing,
        gaze: s.gaze,
        council: c ? { heat: c.heat, spoken: c.spoken, axed: c.axed } : null,
        stood: s.stood,
        reach: r ? { hand: r.hand, state: r.state } : null,
        shards: sh ? { order: [...sh.order], held: sh.held, solved: sh.solved } : null,
        joined: s.party.joined.length,
        riddles: s.riddles ? { at: s.riddles.at, right: s.riddles.right, wrong: s.riddles.wrong, state: s.riddles.state, candle: s.riddles.candle } : null,
      });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0 && s.mode === 'walk') drawMap(map.current, { scale: MAP_SCALE, h: s.h, markers, night: p.sky === 'dusk', base: drawValley });
    if (s.frame % 120 === 0 && s.mode === 'walk') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
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
      s.pitch = Math.max(0.1, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
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
    const s = sim.current;
    const sp = q.id === 'fellowship' ? { x: -14, z: 4, face: 0 } : spot(q.id === 'narsil' ? 'narsil' : q.id === 'council' ? 'council' : 'bilbo');
    s.h = newWalker({ x: sp.x + (q.id === 'council' ? 0 : 1.5), z: sp.z + (q.id === 'council' ? 3 : 1.5), face: sp.face ?? Math.PI / 2 });
    s.yaw = behindYaw(s.h.face);
    setList(false);
  };
  const stay = () => outside({ x: GATE.x, z: GATE.z - 6, face: Math.PI / 2 });

  const here = hud.near ? (PROMPT[hud.near] ?? (() => {
    const c = COMPANIONS.find((x) => x.id === hud.near);
    return c ? { name: c.name, act: 'Come with me' } : null;
  })()) : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const gathering = prog.next === 'fellowship';
  return (
    <div ref={box} className="shire-stage riv-stage" data-touch={touch || undefined} data-mode={mode} data-wearing={hud.wearing || undefined} data-sky={prog.sky}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Rivendell in 3D: an elven valley in autumn, with waterfalls, the house of Elrond on its terraces, the Council court over the gorge, and a bridge across the river" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Waking in Rivendell" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="riv-title" className="shire-title">
              Rivendell
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {gathering && hud.joined >= COMPANIONS.length ? 'All nine are with you. Lead them to the south gate.' : gathering ? `${prog.objective} (${hud.joined ?? 0} of ${COMPANIONS.length})` : prog.objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map" width="150" height="150" aria-hidden="true" />
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{prog.done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <Travellers trav={trav} />
            <button type="button" className="shire-chip shire-ring-btn" data-on={hud.wearing || undefined} onClick={() => putRing(!sim.current.wearing)}>
              {hud.wearing ? 'Take it off' : 'The Ring'} {!touch && <kbd>R</kbd>}
            </button>
            {hud.wearing && (
              <div className="shire-meter" role="meter" aria-label="The Eye" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.gaze * 100) / 100}>
                <span className="shire-meter-label">The Eye</span>
                <span className="shire-meter-bar shire-meter-eye">
                  <span style={{ transform: `scaleX(${hud.gaze})` }} />
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {!walking && (
        <h1 id="riv-title" className="sr-only">
          Rivendell
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

      {gl === 'on' && walking && !hud.moved && !here && <p className="shire-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}<GuideCue touch={touch} /></p>}

      {node && <Convo title={CONVO_TITLE[hud.talking] ?? 'Rivendell'} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {/* the shards of Narsil */}
      {mode === 'narsil' && hud.shards && !node && (
        <div className="shire-panel riv-game" role="group" aria-label="The shards of Narsil">
          <p className="shire-panel-title">The blade that was broken</p>
          <div className="riv-blade" role="list">
            {hud.shards.order.map((piece, i) => (
              <button key={i} type="button" role="listitem" className="riv-shard" data-held={hud.shards.held === i || undefined} data-right={piece === i || undefined} style={{ flexGrow: SHARD_W[piece] }} onClick={() => doShard(i)} aria-label={`Place ${i + 1}: ${piece === 0 ? 'the hilt' : `blade piece ${piece}`}${hud.shards.held === i ? ', picked up' : ''}`}>
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">{shardPath(piece)}</svg>
                {!touch && <kbd>{i + 1}</kbd>}
              </button>
            ))}
          </div>
          <p className="shire-panel-help">
            {placed(sim.current.shards ?? { order: [] })} of {SHARDS} in place. {hud.shards.held != null ? 'Now tap where it goes.' : 'Tap a shard to pick it up.'}
          </p>
        </div>
      )}

      {/* the Council */}
      {mode === 'council' && hud.council && !node && (
        <div className="shire-panel riv-game" role="group" aria-label="The Council of Elrond">
          <p className="shire-panel-title">{hud.stood ? 'I will take it' : 'The Council of Elrond'}</p>
          <div className="shire-meter riv-meter-heat" role="meter" aria-label="The argument" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.council.heat * 100) / 100}>
            <span className="shire-meter-label">The argument</span>
            <span className="shire-meter-bar">
              <span style={{ transform: `scaleX(${hud.council.heat})` }} />
            </span>
          </div>
          {!hud.stood && (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm riv-big" onClick={doStand}>
                {hud.council.spoken ? 'Louder: “I will take it!”' : 'Stand: “I will take it”'} {!touch && <kbd>Space</kbd>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bilbo's hand */}
      {mode === 'bilbo' && hud.reach && !node && (
        <div className="shire-panel riv-game" role="group" aria-label="My old ring" data-lunge={hud.reach.state === 'lunge' || undefined}>
          <p className="shire-panel-title">{hud.reach.state === 'lunge' ? 'His face changes!' : 'My old ring'}</p>
          <div className="shire-meter riv-meter-hand" role="meter" aria-label="His hand" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.reach.hand * 100) / 100}>
            <span className="shire-meter-label">His hand</span>
            <span className="shire-meter-bar">
              <span style={{ transform: `scaleX(${hud.reach.hand})` }} />
            </span>
          </div>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm riv-big" onPointerDown={(e) => (e.preventDefault(), doClose())}>
              Close your hand {!touch && <kbd>Space</kbd>}
            </button>
          </div>
        </div>
      )}

      {/* on the side: riddles with Bilbo */}
      {mode === 'riddles' && hud.riddles && (
        <RiddlePanel game={sim.current.riddles} hud={hud.riddles} touch={touch} onAnswer={doRiddle} onLeave={leaveRiddles} />
      )}

      {mode === 'end' && (
        <div className="shire-panel riv-end" role="dialog" aria-label="The Fellowship sets out">
          <p className="shire-panel-title">The Fellowship sets out</p>
          <p className="shire-panel-say">Nine walkers go out of the south gate and down the valley, into the wild: four hobbits, two Men, an Elf, a Dwarf and a Wizard. South, then east, to the mountains and the long dark of Moria.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to Moria
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay in Rivendell
            </button>
          </div>
        </div>
      )}

      {walking && touch && <Stick onMove={onStick} />}

      {list && (
        <QuestList
          title="Things to do in Rivendell"
          quests={prog.quests}
          next={prog.next}
          side={[{ ...SIDE, done: side }]}
          onClose={() => setList(false)}
          onGo={travel}
          canGo={(q) => (q.id === SIDE.id ? prog.next !== 'awake' && prog.next !== 'bilbo' && sim.current.mode === 'walk' : q.open && !q.done && q.id !== 'awake' && sim.current.mode === 'walk')}
        />
      )}
    </div>
  );
}

// Bilbo's riddle, his candle, and the answers to pick from (1–4).
function RiddlePanel({ game, hud, touch, onAnswer, onLeave }) {
  const q = game ? asked(game) : null;
  const over = hud.state !== 'ask';
  return (
    <div className="shire-panel riv-game riv-riddles" role="group" aria-label="Riddles with Bilbo">
      <p className="shire-panel-title">
        Riddle {Math.min(RIDDLE.ask, hud.at + 1)} of {RIDDLE.ask}
      </p>
      <p className="shire-panel-say riv-riddle" aria-live="polite">
        {over ? (hud.state === 'won' ? '“Well played, my lad. Well played.”' : '“The game’s mine, I think!”') : q?.q}
      </p>
      <div className="shire-meter riv-meter-candle" role="meter" aria-label="Bilbo’s candle" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.candle * 100) / 100}>
        <span className="shire-meter-label">The candle</span>
        <span className="shire-meter-bar">
          <span style={{ transform: `scaleX(${over ? 0 : hud.candle})` }} />
        </span>
        <span className="shire-meter-time">
          {hud.right} right · {hud.wrong} of {RIDDLE.lose} against
        </span>
      </div>
      {!over && q && (
        <div className="town-choices riv-answers">
          {q.shown.map((a, i) => (
            <button key={a} type="button" className="btn btn-ghost btn-sm town-choice" onClick={() => onAnswer(i)}>
              {!touch && <kbd>{i + 1}</kbd>} {a}
            </button>
          ))}
        </div>
      )}
      <div className="shire-panel-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLeave}>
          {over ? 'Back out' : 'Enough riddles'} {!touch && <kbd>Esc</kbd>}
        </button>
      </div>
    </div>
  );
}

// a shard of the sword, drawn: the hilt with its guard, the blade's
// lengths with broken ends, the point last
function shardPath(piece) {
  if (piece === 0)
    return (
      <>
        <rect x="0" y="9" width="34" height="6" rx="2" fill="#5a4030" />
        <rect x="34" y="2" width="6" height="20" rx="1.5" fill="#c8a85a" />
        <circle cx="0" cy="12" r="4" fill="#c8a85a" />
        <path d="M40 8 L100 9 L96 15 L40 16 Z" fill="#c8ccd4" />
      </>
    );
  const last = piece === SHARDS - 1;
  const j = (n) => 8 + ((piece * 7 + n * 3) % 5) - 2;
  return last ? <path d={`M0 ${j(1)} L84 11 L100 12 L84 13 L0 ${24 - j(2)} Z`} fill="#c8ccd4" /> : <path d={`M0 ${j(1)} L100 ${j(3)} L97 ${24 - j(4)} L3 ${24 - j(2)} Z`} fill="#c8ccd4" />;
}

// The valley on the corner map: the river, the paths, the buildings.
function drawValley(g, at) {
  g.fillStyle = '#b8b07a';
  g.fillRect(0, 0, 150, 150);
  g.strokeStyle = '#6a8ab8';
  g.lineWidth = GORGE.rim * MAP_SCALE;
  g.beginPath();
  for (let z = -60; z <= 60; z += 4) {
    const [x, y] = at(riverX(z), z);
    if (z === -60) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.strokeStyle = '#e0d4b0';
  g.lineCap = 'round';
  g.lineWidth = 2;
  for (const p of PATHS) {
    g.beginPath();
    p.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.stroke();
  }
  g.fillStyle = '#8a6a4a';
  g.save();
  g.translate(...at(HOUSE.x, HOUSE.z));
  g.rotate(-HOUSE.turn);
  g.fillRect((-HOUSE.w / 2) * MAP_SCALE, (-HOUSE.d / 2) * MAP_SCALE, HOUSE.w * MAP_SCALE, HOUSE.d * MAP_SCALE);
  g.restore();
  g.beginPath();
  g.arc(...at(COURT.x, COURT.z), COURT.r * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8c8a0';
  const [bx, by] = at(BRIDGE.x - BRIDGE.len / 2, BRIDGE.z);
  g.fillRect(bx, by - 1.5, BRIDGE.len * MAP_SCALE, 3);
}

// Without 3D: the scenes, as cards.
function Cards({ prog, side, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="riv-title" className="title">
        Rivendell
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The house of Elrond, in an elven valley you can walk about in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s Rivendell as cards.' : gl === 'failed' ? 'The 3D Rivendell couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Rivendell isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s Rivendell as cards.'}
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
