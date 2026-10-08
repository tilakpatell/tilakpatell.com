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
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { BED, COLLIDERS, DELL, GAPS, HILL, PATCHES, PLANTS, RUIN, SAM_START, SPOTS, START, STAIR, WALLS, WORLD, castFor, spot, validAt } from './layout';
import { CONVOS, QUESTS, SAYS, SEAL, SPEAKERS, weathertopProgress } from './story';
import { ATHELAS, BRAND, FIRE, MARK, MARK_LINES, READINGS, RIDE, SIDE, newBrand, newFire, newHunt, newMark, newRide, pick, pickable, readMark, revealed, scrape, stamp, stampable, stepBrand, stepFire, stepHunt, stepRide, thrust } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import './weathertop.css';
import '../../../../styles/lazy/middleearth.css';
import GuideCue from '../../../guide/GuideCue';
import LoadingVeil from '../../../worlds/LoadingVeil';
import { throttled } from '../../../worlds/loadingSteps';

// Weathertop, the third town on the road: walk up the hill of Amon Sûl at
// dusk as Frodo, and play the night there as the films tell it. The land
// is in ./layout.js, the story in ./story.js, the games in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the talk and the
// games, and on the side Gandalf's mark on the stone at the top, which the
// story never waits on. Without 3D, the scenes are listed as cards.

const DONE = 'tp-weathertop-done';
const SIDE_DONE = 'tp-weathertop-side'; // kept apart, so the story's count stays the story's
const AT = 'tp-weathertop-at';
const sounds = () => import('./sounds');
const shireSounds = () => import('../../shire/sounds');
const sfx = () => import('../../../../lib/sfx');
const clip = (id) => import('../../../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const shriek = () => clip('nazgul').then((h) => !h && shireSounds().then((x) => x.shriek()));
const PROMPT = {
  summit: { name: 'The summit of Amon Sûl', act: 'Look out' },
  camp: { name: 'The hobbits’ fire, in the dell', act: 'Wake up' },
  wounded: { name: 'Strider, by Frodo', act: 'Give him the kingsfoil' },
  leave: { name: 'The road to Rivendell', act: 'On to Rivendell' },
  mark: { name: 'The broken plinth', act: 'Look at the stone' },
};
const walker = makeWalker({ radius: WORLD.radius, colliders: COLLIDERS, walls: WALLS });
const MAP_SCALE = 150 / (WORLD.radius * 2 + 6);
const CONVO_TITLE = { amonsul: 'On the summit', supper: 'In the dell', athelas: 'At the foot of the hill', arwen: 'At the foot of the hill', ford: 'The Ford of Bruinen' };

export default function WeathertopWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return weathertopProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = weathertopProgress(done);
  const [side, setSide] = useState(() => {
    const d = local.get(SIDE_DONE, []);
    return Array.isArray(d) && d.includes(SIDE.id);
  });
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const { unlock } = useAchievements();
  // the mark, read: on the side, with its own seal but none on the map
  const winSide = useCallback(() => {
    setSide(true);
    local.set(SIDE_DONE, [SIDE.id]);
    unlock(SIDE.seal);
  }, [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = weathertopProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world wt-world" aria-labelledby="wt-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} side={side} winSide={winSide} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} side={side} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, done, complete, side, winSide, gl, setGl, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  // other travellers online on Weathertop, as ghosts (../useTravellers)
  const trav = useTravellers('weathertop', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const map = useRef(null);
  const stone = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const p = weathertopProgress(done);
    const h = newWalker(p.as === 'sam' ? SAM_START : validAt(local.get(AT, null), done));
    sim.current = {
      h,
      keys: new Set(),
      stick: { x: 0, y: 0 },
      yaw: behindYaw(h.face),
      pitch: 0.34,
      dragAt: -1e9,
      mode: 'walk',
      talking: null,
      talk: null,
      wearing: false,
      gaze: 0,
      near: null,
      person: null,
      frame: 0,
      moved: false,
      t: 0,
      air: null,
      wraith: null,
      padBefore: null,
      edgeAt: -9,
      fire: null,
      stamping: 0,
      stampable: -1,
      hunt: p.next === 'athelas' ? newHunt() : null,
      found: [],
      plant: null,
      brand: null,
      aimTo: null,
      ride: null,
      gallop: null,
      stepT: 0,
      flood: 0,
      busy: false,
      mark: null,
      cursor: { u: 0.5, v: 0.5, at: -9 },
    };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const sideRef = useRef(side);
  sideRef.current = side;
  const [hud, setHud] = useState({ mode: 'walk', near: null, moved: false });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [list, setList] = useState(false);
  const lines = useRef({});
  const bubbleRef = useRef(null);
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
    const t = setTimeout(() => setToast(null), 4800);
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
      .then(({ createWeathertopWorld }) => {
        if (dead || !canvas.current) return null;
        return createWeathertopWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__WEATHERTOP__ = { api: a, sim: sim.current, complete }; // for the QA scripts
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
      if (s.mode === 'walk' && s.h) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      s.gallop?.stop();
      s.wraith?.();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;

  // the wind on the hill, while the town's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.air();
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
      s.gallop?.stop();
      s.gallop = null;
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
        if (progRef.current.riders) say('You slip it on. On the slopes below, five pale kings turn their faces up towards you.', true);
        else say('You slip it on. The world goes grey, and something far off turns towards you.', true);
      } else {
        s.wraith?.();
        s.wraith = null;
      }
    },
    [say],
  );

  // ── talk ──
  const startTalk = useCallback((id, mode = 'talk') => {
    const s = sim.current;
    s.mode = mode;
    s.talking = id;
    s.talk = newTalk(CONVOS[id]);
  }, []);

  // ── the games ──
  const startBrand = useCallback(() => {
    const s = sim.current;
    s.mode = 'brand';
    s.brand = newBrand(GAPS, GAPS[0]);
    s.aimTo = null;
    s.stepT = 0;
    s.busy = false;
    putRing(false);
    shriek();
    say('They’re here. Keep the fire towards them, and thrust when one comes close. Hold until Strider comes!', true);
  }, [putRing, say]);

  const startRide = useCallback(() => {
    const s = sim.current;
    s.mode = 'ride';
    s.ride = newRide();
    s.stepT = 0;
    s.busy = false;
    s.talking = null;
    s.talk = null;
    s.gallop?.stop();
    sounds().then((x) => {
      if (sim.current?.mode === 'ride' && !s.gallop) s.gallop = x.gallop();
    });
    say('Arwen, ride hard. Don’t look back! Steer round the fallen trees, and spur on.', false);
  }, [say]);

  const toSam = useCallback(() => {
    const s = sim.current;
    s.brand = null;
    s.h = newWalker(SAM_START);
    s.yaw = behindYaw(s.h.face) + 0.4;
    s.dragAt = s.t;
    startTalk('athelas');
  }, [startTalk]);

  const enter = useCallback(
    (id) => {
      const p = progRef.current;
      audioContext();
      if (id === 'leave') return onLeave?.();
      if (id === 'summit') {
        if (p.next === 'climb') startTalk('amonsul');
        else if (p.next === 'brand') startBrand();
      } else if (id === 'mark') {
        // on the side: up to the plinth, and the lichen on its east face
        const s = sim.current;
        s.mode = 'mark';
        s.mark = newMark();
        s.cursor = { u: 0.5, v: 0.5, at: -9 };
        s.h = newWalker({ x: spot('mark').x, z: spot('mark').z, face: Math.atan2(spot('mark').z, -spot('mark').x) });
        say('Lichen on the old stone, and under it… scratches? Scrape it away: drag across the stone, or steer with the arrows.');
      } else if (id === 'camp') startTalk('supper');
      else if (id === 'wounded') startTalk('arwen');
      setList(false);
      return undefined;
    },
    [onLeave, startTalk, startBrand, say],
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
      if (!s.talk.end) return setHud((h) => ({ ...h, line: s.talk.at }));
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      if (which === 'amonsul') {
        complete('climb');
        // down to the dell, to sleep; then the smell of bacon
        s.mode = 'sleep';
        s.h = newWalker({ x: BED.x + 1.2, z: BED.z + 0.6, face: BED.face });
        s.yaw = behindYaw(BED.face) + 2.2;
        s.dragAt = s.t;
        say('Strider goes off into the dusk. You lie down in the dell, under the hill, and sleep…');
        later(() => {
          const ss = sim.current;
          if (ss?.mode !== 'sleep') return;
          ss.mode = 'walk';
          say('…and wake in the dark, to the smell of bacon. Down by the fire, the others are cooking.', true);
        }, 3600);
      } else if (which === 'supper') {
        s.mode = 'walk';
        s.fire = newFire(PATCHES);
        s.stepT = 0;
        say('Stamp it out! Run onto each fire and stamp (E or Space) till they’re all out, before the time’s up.', true);
      } else if (which === 'athelas') {
        s.mode = 'walk';
        s.hunt = newHunt();
        s.found = [];
        say('Search round the hill’s foot with the lantern. Kingsfoil glows a little when the light’s near it.');
      } else if (which === 'arwen') startRide();
      else if (which === 'ford') {
        s.flood = 0.001;
        sounds().then((x) => x.flood());
        shriek();
      }
      return undefined;
    },
    [complete, say, later, startRide],
  );

  // a stamp, on the fire you're by
  const doStamp = useCallback(() => {
    const s = sim.current;
    const f = s.fire;
    if (!f || s.mode !== 'walk' || f.state !== 'on') return;
    const i = s.stampable;
    if (i < 0) return;
    const r = stamp(f, i);
    if (!r) return;
    s.stamping = 1;
    sounds().then((x) => x.stamp(r !== 'hit'));
    if (r === 'out') api.current?.fx('out');
    if (r === 'won') {
      api.current?.fx('out');
      complete('supper');
      s.fire = null;
      say(SAYS.tomatoes.text, false, SAYS.tomatoes.who);
      later(() => {
        shriek();
        say('A scream, out of the dark below. They’ve seen it. They’re coming up the hill! Get to the top, to the ruin!', true);
      }, 2600);
    }
  }, [complete, say, later]);

  // a pick, of the plant you're by
  const doPick = useCallback(() => {
    const s = sim.current;
    const h = s.hunt;
    if (!h || s.mode !== 'walk' || !s.plant) return;
    const plant = PLANTS.find((p) => p.id === s.plant);
    const r = pick(h, plant);
    if (!r) return;
    if (r === 'weed') {
      sounds().then((x) => x.rustle());
      say('Only a weed. Kingsfoil has a sharp, clean smell, and it shows pale in the lantern’s light.');
      return;
    }
    s.found = [...h.found];
    api.current?.fx('found');
    sounds().then((x) => x.found(h.found.length));
    if (r === 'found') say(`Kingsfoil! ${ATHELAS.need - h.found.length} more.`);
    else {
      complete('athelas');
      s.hunt = null;
      say('Three plants of kingsfoil. Back to Strider at the foot of the stair, quick!', false);
    }
  }, [complete, say]);

  const doThrust = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'brand' || !s.brand) return;
    const hit = thrust(s.brand);
    if (hit == null) return;
    sounds().then((x) => {
      x.whoosh(true);
      if (hit.length) x.recoil();
    });
    if (hit.length) api.current?.fx('thrust');
  }, []);

  // ── on the side: Gandalf's mark ──
  const leaveMark = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'mark') return;
    s.mode = 'walk';
    s.mark = null;
    s.yaw = behindYaw(s.h.face) + 0.9;
    s.dragAt = s.t;
  }, []);
  // scrape at (u, v) on the stone, as hard as `amount`
  const scrapeAt = useCallback((u, v, amount) => {
    const s = sim.current;
    const m = s.mark;
    if (s.mode !== 'mark' || !m || m.state !== 'scrub') return;
    const off = scrape(m, u, v, amount);
    if (off > 0.05 && s.t - (s.scrapeAt ?? -9) > 0.12) {
      s.scrapeAt = s.t;
      sounds().then((x) => x.scrape?.());
    }
    if (m.state === 'read') {
      sounds().then((x) => x.found?.(1));
      say('There: a rune, and strokes cut after it. Count them. What does it say?');
    }
  }, [say]);
  const doRead = useCallback(
    (i) => {
      const s = sim.current;
      const m = s.mark;
      if (s.mode !== 'mark' || !m) return;
      const r = readMark(m, i);
      if (r == null) return;
      if (!r) {
        say('That’s not it. Count the strokes again.', true);
        return;
      }
      winSide();
      api.current?.fx('mark');
      say('G, for Gandalf, and three strokes: he was here on the third of October, three days ahead of you. Something drove him on.');
      later(() => sim.current?.mode === 'mark' && leaveMark(), 3800);
    },
    [say, later, winSide, leaveMark],
  );

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'brand') return doThrust();
    if (s.mode !== 'walk') return undefined;
    if (s.fire) return doStamp();
    if (s.hunt && s.plant) return doPick();
    if (s.near) return enter(s.near);
    return undefined;
  }, [doThrust, doStamp, doPick, enter]);

  // the walking keys: held while the town's live, by their place on the
  // keyboard (../keys), and kept when the handlers below are re-made
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

  // keys
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
      if (s.mode === 'walk') {
        if (moveOf(e)) {
          e.preventDefault();
          audioContext();
          return;
        }
        if ((k === 'e' || k === 'E' || k === 'Enter' || (k === ' ' && (s.fire || s.hunt))) && !onButton) {
          e.preventDefault();
          if (!e.repeat) doAct();
        } else if (k === 'r' || k === 'R') putRing(!s.wearing);
        else if (k === 'm' || k === 'M') setList((v) => !v);
        return;
      }
      if (s.mode === 'mark') {
        if (k === 'Escape') leaveMark();
        else if (/^[1-3]$/.test(k) && s.mark?.state === 'read') doRead(Number(k) - 1);
        if (moveOf(e)) e.preventDefault();
        return;
      }
      if (s.mode === 'brand' && (k === ' ' || k === 'e' || k === 'E') && !onButton) {
        e.preventDefault();
        if (!e.repeat) doThrust();
        return;
      }
      if (s.mode === 'brand' && moveOf(e)) e.preventDefault();
      if (s.mode === 'ride' && (moveOf(e) || k === ' ')) e.preventDefault();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, putRing, talkOnward, doAct, doThrust, leaveMark, doRead]);

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
    s.stamping = Math.max(0, s.stamping - dt * 5);
    if (pad && s.talk && pressed('a')) talkOnward(0);

    if (s.mode === 'walk' || s.mode === 'sleep') {
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
      if (s.mode === 'sleep') {
        fwd = 0;
        side = 0;
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
        say('Past here the land falls away into dark and mist. Weathertop is the only high ground for miles.');
      }
    }

    // the fire in the dell
    s.stampable = -1;
    if (s.fire && s.mode === 'walk') {
      for (const e of stepFire(s.fire, dt)) {
        if (e.type === 'caught') say('It’s caught again! Don’t leave one burning beside an out one.', true);
        else if (e.type === 'seen') {
          shriek();
          a.fx('seen');
          say('Too slow. A scream on the wind: they’ve seen it. Try again, quicker.', true);
          later(() => {
            const ss = sim.current;
            if (ss?.fire?.state === 'seen') ss.fire = newFire(PATCHES);
          }, 1800);
        }
      }
      s.stampable = stampable(s.fire, PATCHES, s.h.x, s.h.z);
      s.air?.fire(Math.min(1, s.fire.heat.reduce((x, y) => x + y, 0) / 3));
    } else {
      const d = Math.hypot(s.h.x - DELL.x, s.h.z - DELL.z);
      s.air?.fire(p.sky === 'night' && p.next === 'supper' ? Math.max(0, 1 - d / 14) : 0);
    }

    // the kingsfoil
    s.plant = null;
    if (s.hunt && s.mode === 'walk') {
      for (const e of stepHunt(s.hunt, dt)) {
        if (e.type === 'cold') {
          say(SAYS.cold.text, true, SAYS.cold.who);
          s.hunt = newHunt();
          s.found = [];
        }
      }
      s.plant = pickable(s.hunt, PLANTS, s.h.x, s.h.z)?.id ?? null;
    }

    // the brand on the summit
    if (s.mode === 'brand' && s.brand) {
      const b = s.brand;
      let turn = (held('left') ? 1 : 0) - (held('right') ? 1 : 0);
      if (pad) turn -= pad.lx;
      if (pad && pressed('a')) doThrust();
      if (Math.abs(turn) > 0.1) s.aimTo = null;
      // (left turns the brand anticlockwise on the ground, as you see it from behind)
      const input = s.aimTo != null ? { to: s.aimTo } : { turn: -Math.max(-1, Math.min(1, turn)) };
      for (const e of stepBrand(b, dt, input)) {
        if (e.type === 'close') {
          a.fx('close');
          if (!s.busy) say('One’s right behind you! Turn the fire on it!', true);
        } else if (e.type === 'held') sounds().then((x) => x.whoosh(false));
        else if (e.type === 'stabbed' || e.type === 'ring') {
          s.busy = true;
          a.fx('stabbed');
          sounds().then((x) => x.stab());
          say(e.type === 'ring' ? 'The Ring slips on, and they are pale kings, and the tallest strikes. Try again: keep them back, and the Ring off.' : 'A blade out of the dark. Try again: keep the fire turning.', true);
          later(() => {
            const ss = sim.current;
            if (ss?.mode === 'brand') {
              ss.brand = newBrand(GAPS, GAPS[0]);
              ss.busy = false;
              ss.stepT = 0;
            }
          }, 2200);
        } else if (e.type === 'strider') {
          s.busy = true;
          s.stepT = 0;
          sounds().then((x) => x.swell(true));
          shriek();
          say('Strider leaps up the stair with fire in both hands, and the Nine fall back before him…');
          later(() => {
            say('…but one blade found Frodo in the dark. A Morgul blade. He’s cold, and getting colder.', true);
            complete('brand');
          }, 4200);
          later(() => sim.current?.mode === 'brand' && toSam(), 7600);
        }
      }
    }

    // the ride to the Ford
    if (s.mode === 'ride' && s.ride && !s.busy) {
      let steer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + (s.steer ?? 0) + s.stick.x;
      if (pad) steer += pad.lx;
      const spur = held('up') || k.has('run') || Boolean(s.spur) || Boolean(pad?.a || pad?.rb);
      for (const e of stepRide(s.ride, dt, { steer: Math.max(-1, Math.min(1, steer)), spur })) {
        if (e.type === 'hit') {
          a.fx('hit');
          sounds().then((x) => x.crash());
          say('Branches whip past. Asfaloth stumbles, and they gain on you!', true);
        } else if (e.type === 'close') {
          shriek();
          say('They’re right behind you! Spur on!', true);
        } else if (e.type === 'spur') sounds().then((x) => x.whoosh(false));
        else if (e.type === 'caught') {
          s.busy = true;
          say('A black hand closes on Frodo’s cloak. Try again: steer clear, and spur on the straights.', true);
          later(() => {
            const ss = sim.current;
            if (ss?.mode === 'ride') {
              ss.ride = newRide();
              ss.busy = false;
            }
          }, 2000);
        } else if (e.type === 'ford') {
          s.mode = 'ford';
          s.stepT = 0;
          s.gallop?.stop();
          s.gallop = null;
          say('Across the Ford of Bruinen! Arwen turns Asfaloth on the far bank.');
          later(() => sim.current?.mode === 'ford' && startTalk('ford', 'ford'), 3800);
        }
      }
      s.gallop?.speed(s.ride.v / RIDE.base);
    }
    if (s.mode === 'ford' && s.flood > 0 && s.flood < 1) {
      s.flood = Math.min(1, s.flood + dt / 7);
      if (s.flood >= 1) {
        complete('ford');
        s.mode = 'end';
        sounds().then((x) => x.swell(true));
      }
    }

    // the Ring: the Eye comes nearer while it's on
    s.gaze = stepGaze(s.gaze, s.wearing, dt);
    if (s.wearing && s.gaze >= 1) {
      putRing(false);
      say('The Eye. You pull the Ring off, shaking.', true);
    }

    // on the side: scraping at Gandalf's mark, the arrows (or a pad's
    // stick) steering the scraper across the stone
    if (s.mode === 'mark' && s.mark) {
      const du = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + (pad?.lx ?? 0);
      const dv = (held('down') ? 1 : 0) - (held('up') ? 1 : 0) + (pad?.ly ?? 0);
      if (Math.hypot(du, dv) > 0.1) {
        const c = s.cursor;
        c.u = Math.max(0, Math.min(1, c.u + du * dt * 0.5));
        c.v = Math.max(0, Math.min(1, c.v + dv * dt * 0.8));
        c.at = s.t;
        scrapeAt(c.u, c.v, dt * 2.6);
      }
      if (pressed('b')) leaveMark();
      drawStone(stone.current, s.mark, s.t - s.cursor.at < 2 ? s.cursor : null);
    }

    // what's here, and who's here
    let spotHere = null;
    if (s.mode === 'walk' && !s.fire) {
      const sp = nearest(SPOTS, s.h.x, s.h.z);
      const ok = sp && ((sp.id === 'summit' && (p.next === 'climb' || p.next === 'brand')) || (sp.id === 'camp' && p.next === 'supper') || (sp.id === 'wounded' && p.next === 'ford') || (sp.id === 'leave' && p.finished) || (sp.id === 'mark' && p.as === 'frodo' && p.next !== 'brand'));
      spotHere = ok ? sp.id : null;
    }
    s.near = spotHere;
    const cast = castFor(p.sky, p.next);
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

    // where to go next
    const next = p.next;
    const markers = p.finished ? [spot('leave')] : next === 'climb' || next === 'brand' ? [spot('summit')] : next === 'supper' && !s.fire ? [spot('camp')] : next === 'ford' ? [spot('wounded')] : [];

    // who's speaking, for the talk camera
    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const who = node?.who;
    const speaker = who === 'strider' ? (s.talking === 'amonsul' ? 'strider' : 'strider-foot') : who === 'sam' ? 'sam' : who === 'pippin' ? 'pippin' : who === 'merry' ? 'merry' : who === 'arwen' ? 'arwen' : who === 'frodo' && s.talking === 'supper' ? 'pippin' : null;

    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.mode === 'ride' || s.mode === 'ford' || s.mode === 'end', ring: s.wearing });
    try {
      a.render(
        {
          hobbit: s.h,
          as: p.as,
          travellers: tv ? tv.list() : null,
          sky: p.sky,
          mode: s.mode === 'end' ? 'ford' : s.mode,
          talking: s.talking,
          speaker,
          speakerAt: speaker ? a.headOf(speaker) : null,
          cast: cast.map((c) => c.id),
          fire: s.fire,
          fireOut: done.includes('supper'),
          stampable: s.stampable,
          stamping: s.stamping,
          hunting: Boolean(s.hunt),
          found: s.found,
          brand: s.brand,
          ride: s.ride,
          flood: s.mode === 'end' ? 1 : s.flood,
          markShown: s.mark ? Math.max(revealed(s.mark), sideRef.current ? 1 : 0) : sideRef.current ? 1 : 0,
          riders: p.riders,
          stepT: s.stepT,
          wearing: s.wearing,
          gaze: s.gaze,
          danger: s.mode === 'brand' && s.brand ? s.brand.pull : s.mode === 'ride' && s.ride ? Math.max(0, 1 - s.ride.gap / 14) : 0,
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
    const f = s.fire;
    const b = s.brand;
    const r = s.ride;
    const key = [s.mode, s.near, s.moved, s.talking, s.talk?.at, s.wearing, Math.round(s.gaze * 20), f ? f.heat.map((x) => Math.round(x * 8)).join() : '', f ? Math.ceil(f.left) : '', s.stampable, s.plant, s.hunt ? Math.round(s.hunt.cold * 40) : '', s.found.length, b ? Math.round(b.t * 2) : '', b ? Math.round(b.pull * 30) : '', b ? b.wraiths.map((w) => `${Math.round(w.a * 8)}.${Math.round(w.r * 2)}.${w.mode}`).join() : '', b ? Math.round(b.aim * 12) : '', b && b.cool > 0, r ? Math.round(r.s / 6) : '', r ? Math.round(r.gap) : '', r && r.spurCool > 0, s.mark?.state, s.mark ? Math.round(revealed(s.mark) * 40) : ''].join('|');
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
        fire: f ? { heat: [...f.heat], left: f.left, state: f.state } : null,
        stampable: s.stampable,
        plant: s.plant,
        hunt: s.hunt ? { cold: s.hunt.cold, found: s.hunt.found.length } : null,
        brand: b ? { t: b.t, pull: b.pull, aim: b.aim, ready: b.cool <= 0, state: b.state, wraiths: b.wraiths.map((w) => ({ a: w.a, r: w.r, mode: w.mode })) } : null,
        ride: r ? { s: r.s, gap: r.gap, ready: r.spurCool <= 0, state: r.state } : null,
        mark: s.mark ? { state: s.mark.state, shown: revealed(s.mark) } : null,
      });
    }
    if (s.person && bubbleRef.current) {
      const at = a.screenOf('cast', s.person);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0 && (s.mode === 'walk' || s.mode === 'sleep')) drawMap(map.current, { scale: MAP_SCALE, h: s.h, markers, night: p.sky === 'night', base: drawHill(p) });
    if (s.frame % 120 === 0 && s.mode === 'walk') local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // the world's own pointer: drag to look round; on the summit, the brand
  // follows it and a click thrusts
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (s.mode === 'brand') {
      const r = canvas.current?.getBoundingClientRect();
      if (r && (e.pointerType === 'mouse' || e.type !== 'pointermove' || drag.current)) {
        const a = api.current?.aimAt(e.clientX - r.left, e.clientY - r.top);
        if (a != null) s.aimTo = a;
      }
      if (e.type === 'pointerdown') {
        audioContext();
        drag.current = { id: e.pointerId };
        if (e.pointerType === 'mouse') doThrust();
      } else if (e.type !== 'pointermove') drag.current = null;
      return;
    }
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

  // the touch stick
  const onStick = (x, y) => (sim.current.stick = { x, y });
  // held buttons, for touch: steer and spur
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

  // the list's "go there": straight to where each scene starts
  const travel = (q) => {
    const s = sim.current;
    if (q.id === 'climb' || q.id === 'ford') s.h = newWalker(q.id === 'ford' ? SAM_START : START);
    else if (q.id === 'supper') s.h = newWalker({ x: BED.x + 1.2, z: BED.z + 0.6, face: BED.face });
    else if (q.id === 'brand') {
      const [x, z] = STAIR.at(-3);
      s.h = newWalker({ x, z, face: -2.5 });
    } else if (q.id === SIDE.id) {
      // on the side: by the plinth, looking at its east face
      const m = spot('mark');
      s.h = newWalker({ x: m.x + 0.6, z: m.z, face: Math.atan2(m.z, -m.x) });
    }
    s.yaw = behindYaw(s.h.face);
    setList(false);
  };
  // the stone, under the pointer: drag to scrape
  const scraping = useRef(null);
  const onStone = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    if (e.type === 'pointerdown') {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      audioContext();
      scraping.current = { u, v, id: e.pointerId };
      scrapeAt(u, v, 0.25);
      return;
    }
    const was = scraping.current;
    if (!was || was.id !== e.pointerId) return;
    if (e.type !== 'pointermove') {
      scraping.current = null;
      return;
    }
    // as hard as the stroke is long, a cell's width at a time
    const cells = Math.hypot((u - was.u) * MARK.cols, (v - was.v) * MARK.rows);
    for (let k = 1, n = Math.max(1, Math.ceil(cells)); k <= n; k++) scrapeAt(was.u + ((u - was.u) * k) / n, was.v + ((v - was.v) * k) / n, 0.3);
    scraping.current = { u, v, id: e.pointerId };
  };

  // after the ride: stay on Weathertop, at dawn
  const stay = () => {
    const s = sim.current;
    s.mode = 'walk';
    s.ride = null;
    s.flood = 0;
    s.h = newWalker(START);
    s.yaw = behindYaw(START.face);
  };
  // ride again, from the list, once it's done
  const rideAgain = () => {
    setList(false);
    startRide();
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const B = hud.brand;
  const R = hud.ride;
  const F = hud.fire;
  return (
    <div ref={box} className="shire-stage wt-stage" data-touch={touch || undefined} data-mode={mode} data-game={(walking && (F || hud.hunt)) || undefined} data-wearing={hud.wearing || undefined} data-sky={prog.sky}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Weathertop in 3D: the hill of Amon Sûl with the ruined watchtower on its summit, the old stair through the crags, and the dell where the hobbits camp" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Climbing Weathertop" />

      {(walking || mode === 'sleep') && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="wt-title" className="shire-title">
              Weathertop
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {F ? 'Put it out! Stamp out every fire before the time’s up.' : prog.objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map" width="150" height="150" aria-hidden="true" />
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{done.length}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
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
      {!walking && mode !== 'sleep' && (
        <h1 id="wt-title" className="sr-only">
          Weathertop
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

      {gl === 'on' && walking && !hud.moved && !here && !F && <p className="shire-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}<GuideCue touch={touch} /></p>}

      {node && <Convo title={CONVO_TITLE[hud.talking] ?? 'Weathertop'} name={SPEAKERS[node.who] ?? ''} node={node} touch={touch} onPick={(i) => talkOnward(i)} onNext={() => talkOnward()} />}

      {/* Put it out, you fools! */}
      {walking && F && (
        <div className="shire-panel wt-game" role="group" aria-label="Put the fire out">
          <p className="shire-panel-title">Put it out, you fools!</p>
          <div className="wt-flames" aria-label={`${F.heat.filter((h) => h > 0).length} fires still burning`}>
            {F.heat.map((h, i) => (
              <span key={PATCHES[i].id} className="wt-flame" data-out={h <= 0 || undefined} style={{ transform: `scale(${0.45 + h * 0.75})` }} />
            ))}
          </div>
          <div className="shire-meter" role="meter" aria-label="Before they see it" aria-valuemin={0} aria-valuemax={FIRE.time} aria-valuenow={Math.ceil(F.left)}>
            <span className="shire-meter-label">Before they see it</span>
            <span className="shire-meter-bar wt-meter-fire">
              <span style={{ transform: `scaleX(${F.left / FIRE.time})` }} />
            </span>
            <span className="shire-meter-time">{Math.ceil(F.left)}s</span>
          </div>
          {touch && (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm wt-big" disabled={hud.stampable < 0} onClick={doStamp}>
                Stamp!
              </button>
            </div>
          )}
          {!touch && <p className="shire-panel-help">Run onto a fire and stamp: E or Space. {hud.stampable >= 0 ? 'Stamp now!' : ''}</p>}
        </div>
      )}

      {/* Kingsfoil */}
      {walking && hud.hunt && (
        <div className="shire-panel wt-game" role="group" aria-label="Kingsfoil">
          <p className="shire-panel-title">Kingsfoil</p>
          <p className="shire-panel-stats">
            <span>
              Found <b>{hud.hunt.found}</b> of {ATHELAS.need}
            </span>
          </p>
          <div className="shire-meter" role="meter" aria-label="How cold Frodo is" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.hunt.cold * 100) / 100}>
            <span className="shire-meter-label">Frodo’s cold</span>
            <span className="shire-meter-bar wt-meter-cold">
              <span style={{ transform: `scaleX(${hud.hunt.cold})` }} />
            </span>
          </div>
          {hud.plant && (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={doPick}>
                {!touch && <kbd className="key-first">E</kbd>} Pick it
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fire against the dark */}
      {mode === 'brand' && B && (
        <div className="shire-panel wt-game" role="group" aria-label="Fire against the dark">
          <p className="shire-panel-title">{B.state === 'won' ? 'Strider!' : 'Fire against the dark'}</p>
          <div className="wt-game-row">
            <div className="wt-radar" role="img" aria-label={`${B.wraiths.filter((w) => w.mode !== 'wait').length} Nazgûl round you`}>
              {B.wraiths
                .filter((w) => w.mode !== 'wait')
                .map((w, i) => {
                  const rel = w.a - B.aim;
                  const d = Math.min(1, w.r / BRAND.start) * 46;
                  return <i key={i} data-near={w.r < BRAND.thrust + 0.6 || undefined} data-held={w.mode === 'held' || undefined} style={{ left: `${50 + Math.sin(rel) * d}%`, top: `${50 - Math.cos(rel) * d}%` }} />;
                })}
            </div>
            <div style={{ flex: 1, display: 'grid', gap: '0.45rem' }}>
              <div className="shire-meter" role="meter" aria-label="Until Strider comes" aria-valuemin={0} aria-valuemax={BRAND.hold} aria-valuenow={Math.round(B.t)}>
                <span className="shire-meter-label">Strider</span>
                <span className="shire-meter-bar wt-meter-hold">
                  <span style={{ transform: `scaleX(${Math.min(1, B.t / BRAND.hold)})` }} />
                </span>
              </div>
              <div className="shire-meter wt-meter-ring" data-pull={B.pull > 0.6 || undefined} role="meter" aria-label="The Ring’s pull" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(B.pull * 100) / 100}>
                <span className="shire-meter-label">The Ring</span>
                <span className="shire-meter-bar">
                  <span style={{ transform: `scaleX(${B.pull})` }} />
                </span>
              </div>
            </div>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm wt-big" disabled={!B.ready || B.state !== 'on'} onPointerDown={(e) => (e.preventDefault(), doThrust())}>
                Thrust!
              </button>
              <span className="shire-panel-help">Drag on the view to swing the fire round.</span>
            </div>
          ) : (
            <p className="shire-panel-help">Point with the mouse (or A and D) to swing the brand round; click or Space to thrust.</p>
          )}
        </div>
      )}

      {/* The Flight to the Ford */}
      {mode === 'ride' && R && (
        <div className="shire-panel wt-game" role="group" aria-label="The Flight to the Ford">
          <p className="shire-panel-title">The Flight to the Ford</p>
          <div className="shire-meter" role="meter" aria-label="To the Ford" aria-valuemin={0} aria-valuemax={RIDE.length} aria-valuenow={Math.round(R.s)}>
            <span className="shire-meter-label">The Ford</span>
            <span className="shire-meter-bar wt-meter-road">
              <span style={{ transform: `scaleX(${R.s / RIDE.length})` }} />
            </span>
          </div>
          <div className="shire-meter" role="meter" aria-label="How far behind the Nine are" aria-valuemin={0} aria-valuemax={RIDE.gap * 2} aria-valuenow={Math.round(R.gap)}>
            <span className="shire-meter-label">The Nine</span>
            <span className="shire-meter-bar wt-meter-gap">
              <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, R.gap / (RIDE.gap * 1.6)))})` }} />
            </span>
            <span className="shire-meter-time">{Math.max(0, Math.round(R.gap))}m</span>
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <div className="wt-steer">
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Steer left" {...hold('steer', -1)}>
                  ◀
                </button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label="Steer right" {...hold('steer', 1)}>
                  ▶
                </button>
              </div>
              <button type="button" className="btn btn-primary btn-sm wt-big" disabled={!R.ready} {...hold('spur', 1)}>
                Spur on!
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D (or the arrows) to steer; W, ↑ or Shift to spur on, when she’s ready.</p>
          )}
        </div>
      )}

      {mode === 'end' && (
        <div className="shire-panel wt-end" role="dialog" aria-label="The Ford of Bruinen">
          <p className="shire-panel-title">The Ford of Bruinen</p>
          <p className="shire-panel-say">The river rose in horses of white water and swept the Nine away. Frodo wakes in Rivendell, in the house of Elrond, with Gandalf at his bedside.</p>
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              On to Rivendell
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Stay on Weathertop
            </button>
          </div>
        </div>
      )}

      {/* On the side: Gandalf's mark */}
      {mode === 'mark' && hud.mark && (
        <div className="shire-panel wt-mark" role="group" aria-label="Gandalf’s mark">
          <p className="shire-panel-title">The broken plinth</p>
          <canvas ref={stone} className="wt-stone" width="300" height="180" aria-label="The stone’s face, under its lichen" onPointerDown={onStone} onPointerMove={onStone} onPointerUp={onStone} onPointerCancel={onStone} onLostPointerCapture={onStone} onContextMenu={(e) => e.preventDefault()} />
          {hud.mark.state === 'scrub' ? (
            <>
              <div className="shire-meter" role="meter" aria-label="The mark, scraped clean" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(Math.min(1, hud.mark.shown / MARK.need) * 100) / 100}>
                <span className="shire-meter-label">Scraped clean</span>
                <span className="shire-meter-bar">
                  <span style={{ transform: `scaleX(${Math.min(1, hud.mark.shown / MARK.need)})` }} />
                </span>
              </div>
              <p className="shire-panel-help">{touch ? 'Drag across the stone to scrape the lichen off.' : 'Drag across the stone, or steer with the arrows, to scrape the lichen off.'}</p>
            </>
          ) : (
            <div className="town-choices">
              {READINGS.map((r, i) => (
                <button key={r.text} type="button" className="btn btn-ghost btn-sm town-choice" disabled={hud.mark.state === 'done'} onClick={() => doRead(i)}>
                  {!touch && <kbd>{i + 1}</kbd>} {r.text}
                </button>
              ))}
            </div>
          )}
          <div className="shire-panel-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveMark}>
              Leave it {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}

      {walking && touch && <Stick onMove={onStick} />}

      {list && (
        <QuestList
          title="Things to do on Weathertop"
          quests={prog.quests}
          next={prog.next}
          side={[{ ...SIDE, done: side }]}
          onClose={() => setList(false)}
          onGo={(q) => (q.id === 'ford' && prog.finished ? rideAgain() : travel(q))}
          canGo={(q) => (q.id === SIDE.id ? done.includes('climb') && prog.as === 'frodo' && prog.next !== 'brand' && sim.current.mode === 'walk' && !sim.current.fire : (q.open && !q.done && q.id !== 'athelas' && sim.current.mode === 'walk' && !sim.current.fire) || (q.id === 'ford' && prog.finished))}
        />
      )}
    </div>
  );
}

// The hill on the corner map: the heath, the slopes, the crags' ring, the
// ruin, the dell, the road and the stair.
const drawHill = (prog) => (g, at) => {
  const night = prog.sky !== 'dusk' && prog.sky !== 'dawn';
  const ring = (r, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(...at(0, 0), r * MAP_SCALE, 0, Math.PI * 2);
    g.fill();
  };
  ring(HILL.foot, night ? '#283020' : '#8a9068');
  ring(HILL.crag[1], night ? '#323a2a' : '#9aa078');
  ring(HILL.crag[0], night ? '#4a4a44' : '#a8a89a');
  g.lineCap = 'round';
  g.strokeStyle = night ? '#6a5a40' : '#7a5a34';
  g.lineWidth = 2;
  g.beginPath();
  STAIR.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
  g.stroke();
  g.strokeStyle = night ? '#9a9a90' : '#4a4a40';
  g.lineWidth = 2.2;
  for (const [a0, a1] of RUIN.walls) {
    g.beginPath();
    g.arc(...at(0, 0), RUIN.r * MAP_SCALE, a0, a1);
    g.stroke();
  }
  g.fillStyle = night ? '#3a5a2a' : '#6a8a4a';
  g.beginPath();
  g.arc(...at(DELL.x, DELL.z), DELL.r * 0.7 * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
};

// The stone's face, for the side task: weathered grey, Gandalf's scratches
// cut into it, and the lichen over them as thick as it still is.
const speck = (i) => {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
function drawStone(c, m, cursor) {
  const g = c?.getContext('2d');
  if (!g || !m) return;
  const W = c.width;
  const H = c.height;
  const cw = W / MARK.cols;
  const ch = H / MARK.rows;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#99938a');
  grad.addColorStop(1, '#77726a');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = i % 3 ? 'rgba(50, 46, 40, 0.2)' : 'rgba(230, 224, 210, 0.16)';
    g.fillRect(speck(i) * W, speck(i + 500) * H, 1 + speck(i + 900) * 4, 1 + speck(i + 1300) * 2);
  }
  // the scratches: a dark groove with a pale cut edge
  g.lineCap = 'round';
  const cut = (dx, dy, colour, width) => {
    g.strokeStyle = colour;
    g.lineWidth = width;
    for (const [u0, v0, u1, v1] of MARK_LINES) {
      g.beginPath();
      g.moveTo(u0 * W + dx, v0 * H + dy);
      g.lineTo(u1 * W + dx, v1 * H + dy);
      g.stroke();
    }
  };
  cut(0, 0, 'rgba(28, 24, 20, 0.8)', 6);
  cut(-1, -1, 'rgba(236, 228, 206, 0.85)', 2);
  // the lichen
  for (let r = 0; r < MARK.rows; r++) {
    for (let col = 0; col < MARK.cols; col++) {
      const i = r * MARK.cols + col;
      const k = m.lichen[i];
      if (k <= 0.02) continue;
      const n = speck(i + 77);
      g.fillStyle = `rgba(${Math.round(92 + n * 34)}, ${Math.round(108 + n * 26)}, ${Math.round(66 + n * 12)}, ${Math.min(1, k * 1.12)})`;
      g.fillRect(col * cw - 0.5, r * ch - 0.5, cw + 1, ch + 1);
      if (k > 0.45 && n > 0.62) {
        g.fillStyle = `rgba(196, 200, 138, ${k * 0.7})`;
        g.fillRect(col * cw + 2, r * ch + 2, 3, 3);
      }
    }
  }
  // the scraper, while the keys steer it
  if (cursor) {
    g.strokeStyle = 'rgba(255, 236, 170, 0.85)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cursor.u * W, cursor.v * H, MARK.brush * cw, 0, Math.PI * 2);
    g.stroke();
  }
}

// Without 3D: the scenes, as cards.
function Cards({ prog, side, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="wt-title" className="title">
        Weathertop
      </h1>
      <p className="lead mt-4 max-w-[60ch]">A night on the hill of Amon Sûl, in a Weathertop you can walk about in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s Weathertop as cards.' : gl === 'failed' ? 'The 3D Weathertop couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Weathertop isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s Weathertop as cards.'}
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
