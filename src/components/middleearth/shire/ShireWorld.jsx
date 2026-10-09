import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../lib/voiced';
import { useVoiced } from '../../../lib/useVoiced';
import { readPad, typing } from '../../games/pad';
import { keyDown, keyUp, moveOf, ownButton } from '../towns/keys';
import { Bubble, QuestList, Stick, Travellers } from '../towns/TownHud';
import { useTravellers } from '../towns/useTravellers';
import {
  CAST,
  COLOURS,
  FADE,
  FIELD,
  GANDALF_LINES,
  HOLLOW,
  HUNT,
  INSIDE_TEXT,
  LOBELIA,
  LOBELIA_LEN,
  LOBELIA_LINES,
  MAGGOT_GATE,
  POND,
  QUESTS,
  RIDER_RETRY,
  RINGS,
  ROADS,
  SAYS,
  SHOW,
  SIDE,
  SPOKEN,
  SPOONS,
  SPOON_SPOTS,
  SPOTS,
  START,
  STREAM,
  STRIDE,
  WORLD,
  behindYaw,
  cameraMove,
  hidden,
  inField,
  launch,
  lobeliaNow,
  nearCast,
  nearSpot,
  newHobbit,
  newHunt,
  newRider,
  newRings,
  newShow,
  newSpoons,
  nextRingStep,
  onRoad,
  progress,
  puff,
  riderTrigger,
  spoonLeft,
  stepGaze,
  stepHobbit,
  stepHunt,
  stepRider,
  stepRings,
  stepShow,
  stepSpoons,
  stepFade,
  stepStride,
} from './rules';
import { SWATCH } from './fx';
import './shire.css';
import '../../../styles/lazy/middleearth.css';
import GuideCue from '../../guide/GuideCue';
import LoadingVeil from '../../worlds/LoadingVeil';
import { throttled } from '../../worlds/loadingSteps';

// Hobbiton, the world: walk about the Shire as Frodo on the day of Bilbo's
// party, and do what hobbits do there. The rules are in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the speech and the
// five things to do, and one on the side (Bilbo's spoons) that the story
// never waits on. Without 3D, they're listed as cards.

const DONE = 'tp-shire-done';
const SIDE_DONE = 'tp-shire-side'; // kept apart, so the story's count stays the story's
const AT = 'tp-shire-at';
const ACH = { maggot: 'mushrooms', rings: 'smokerings', party: 'fireworks', ring: 'secretsafe', rider: 'getoffroad' };
const sounds = () => import('./sounds');
const clip = (id, o) => import('../../../lib/clips').then((c) => c.playClip(id, o)).catch(() => null);
const sfx = () => import('../../../lib/sfx');
const PROMPT = {
  rings: { name: 'The bench at Bag End', act: 'Sit with Gandalf' },
  party: { name: 'Gandalf’s cart', act: 'Light the fireworks' },
  ring: { name: 'Bag End', act: 'Go in' },
  leave: { name: 'The East Road', act: 'On to Bree' },
  spoons: { name: 'Lobelia Sackville-Baggins', act: 'Race her for Bilbo’s spoons' },
};

export default function ShireWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return Array.isArray(d) ? d.filter((x) => ACH[x]) : [];
  });
  const prog = progress(done);
  const [side, setSide] = useState(() => {
    const d = local.get(SIDE_DONE, []);
    return Array.isArray(d) && d.includes(SIDE.id);
  });
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const { unlock } = useAchievements();
  // the spoons, won: on the side, with its own seal but none on the map
  const winSide = useCallback(() => {
    setSide(true);
    local.set(SIDE_DONE, [SIDE.id]);
    unlock('spoons');
  }, [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = [...d, id];
        local.set(DONE, next);
        return next;
      });
      if (ACH[id]) unlock(ACH[id]);
    },
    [unlock],
  );
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="shire-world" aria-labelledby="shire-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World prog={prog} done={done} complete={complete} side={side} winSide={winSide} gl={gl} setGl={setGl} onLeave={onLeave} /> : <Cards prog={prog} side={side} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ prog, done, complete, side, winSide, gl, setGl, onLeave }) {
  // other travellers online in the Shire, as ghosts (../towns/useTravellers)
  const trav = useTravellers('shire', gl === 'on');
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const map = useRef(null);
  const api = useRef(null);
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const sim = useRef(null);
  if (!sim.current) {
    const kept = local.get(AT, null);
    const ok = kept && Number.isFinite(kept.x) && Math.hypot(kept.x, kept.z) < WORLD.radius;
    const h = newHobbit(ok ? kept : START);
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.36, dragAt: -1e9, mode: 'walk', hunt: newHunt(), rings: null, show: null, rider: null, ringStep: 'envelope', stepT: 0, spoons: null, wearing: false, gaze: 0, aim: { u: 0, v: 1.2 }, colour: 'gold', near: null, talk: null, frame: 0, moved: false, t: 0, hoof: null, air: null, wraith: null, padBefore: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const sideRef = useRef(side);
  sideRef.current = side;
  const [hud, setHud] = useState({ mode: 'walk', near: null, picked: 0, chased: false, moved: false });
  const hudKey = useRef('');
  const [toast, setToast] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [list, setList] = useState(false);
  const [fading, setFading] = useState(false); // caught or found: the screen goes dark while he's put back
  const lines = useRef({});
  const bubbleRef = useRef(null);
  // a toast; and `who`, whose words are in it, says them (lib/voiced.js)
  const say = useCallback((text, bad = false, who = null) => {
    setToast({ text, bad, at: Date.now() });
    if (who) sayVoiced(who, text);
  }, []);
  useEffect(() => stopVoiced, []);
  // timers for what comes a moment after an event; cleared if the world goes
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
    const t = setTimeout(() => setToast(null), 4200);
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
      .then(({ createShireWorld }) => {
        if (dead || !canvas.current) return null;
        return createShireWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__SHIRE__ = { api: a, sim: sim.current, complete }; // for the QA scripts
        fit();
        // everything on the graphics chip before Hobbiton's shown, behind the loading screen
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
      local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
      s.hoof?.stop();
      s.air?.stop();
      s.wraith?.();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;

  // the air: birds by day, crickets by night, while the world's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    let stop = false;
    sounds().then((x) => {
      if (stop || !s) return;
      s.air = x.ambience();
    });
    return () => {
      stop = true;
      s.air?.stop();
      s.air = null;
    };
  }, [live]);

  // ── the activities: in and out ──
  const enter = useCallback(
    (id) => {
      const s = sim.current;
      audioContext();
      if (id === 'leave') return onLeave?.();
      if (id === 'spoons') {
        s.spoons = newSpoons();
        sounds().then((x) => x.spoon());
        say(SAYS.spoons.text, false, SAYS.spoons.who);
        setList(false);
        return undefined;
      }
      if (id === 'rings') {
        s.mode = 'rings';
        s.rings = newRings(Math.floor(Math.random() * 1e6));
        s.aim = { u: 0, v: 1.2 };
        say('Gandalf blows a great ring. Send yours through it: aim, then puff. It takes a moment to get there, so lead it.');
      } else if (id === 'party') {
        s.mode = 'show';
        s.show = newShow();
        say('Night falls on the Party Field. Click the sky to send a rocket up. New colours and new parts of the sky get the biggest cheers.');
      } else if (id === 'ring') {
        if (!progRef.current.quests.find((q) => q.id === 'ring')?.open) return say('Bilbo’s busy getting ready for his party. Come back after.');
        if (doneRef.current.includes('ring')) return say('Bag End. Home, and quiet now Bilbo’s gone.');
        s.mode = 'inside';
        s.ringStep = 'envelope';
        s.stepT = 0;
        sounds().then((x) => x.door());
      }
      setList(false);
      return undefined;
    },
    [onLeave, say],
  );
  const leave = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'rings') s.h = newHobbit({ x: SPOTS[0].x, z: SPOTS[0].z + 0.6, face: -Math.PI / 2 });
    if (s.mode === 'show') s.h = newHobbit({ x: SPOTS[1].x, z: SPOTS[1].z + 0.5, face: Math.PI / 2 });
    if (s.mode === 'inside') s.h = newHobbit({ x: SPOTS[2].x, z: SPOTS[2].z + 1.2, face: -Math.PI / 2 });
    // out of Bag End or up off the bench, the camera stands off to one side
    // rather than in the Hill behind you
    s.yaw = behindYaw(s.h.face) + (s.mode === 'inside' || s.mode === 'rings' ? 1.25 : 0);
    s.dragAt = s.t;
    s.mode = 'walk';
    s.rings = null;
    s.show = null;
  }, []);

  const putRing = useCallback(
    (on) => {
      const s = sim.current;
      if (!progRef.current.hasRing || s.wearing === on) return;
      s.wearing = on;
      if (on) {
        sfx().then((x) => {
          if (s.wearing) s.wraith = x.wraith();
        });
        say('You slip it on. The world goes grey, and something far off turns towards you.', true);
      } else {
        s.wraith?.();
        s.wraith = null;
      }
    },
    [say],
  );

  // a click or a key that acts: puff, launch, or the next step inside
  const act = useCallback(
    (nx = null, ny = null) => {
      const s = sim.current;
      audioContext();
      if (s.mode === 'rings' && s.rings) {
        if (nx != null) {
          const a = api.current?.aim('rings', nx, ny);
          if (a) s.aim = { u: Math.max(-RINGS.u, Math.min(RINGS.u, a.u)), v: Math.max(RINGS.v0, Math.min(RINGS.v1, a.v)) };
        }
        if (puff(s.rings, s.aim.u, s.aim.v)) {
          api.current?.fx('puff');
          sounds().then((x) => x.puff());
        }
      } else if (s.mode === 'show' && s.show) {
        let u = (Math.random() - 0.5) * 1.6;
        let v = 0.45 + Math.random() * 0.5;
        if (nx != null) {
          const a = api.current?.aim('show', nx, ny);
          if (a) ({ u, v } = a);
        }
        if (launch(s.show, u, v, s.colour)) {
          api.current?.fx('launch', { u: Math.max(-1, Math.min(1, u)), v: Math.max(0.15, Math.min(1, v)), flight: SHOW.flight });
          sounds().then((x) => x.rocket());
        }
      } else if (s.mode === 'inside') {
        if (s.ringStep === 'safe') return;
        if (s.ringStep === 'letters' && s.stepT < 2.6) return;
        s.ringStep = nextRingStep(s.ringStep);
        s.stepT = 0;
        if (s.ringStep === 'letters') sounds().then((x) => x.sizzle());
        if (s.ringStep === 'safe') sfx().then((x) => x.ring?.());
      }
    },
    [],
  );

  // the walking keys: held while the world's live, by their place on the
  // keyboard (../towns/keys), and kept when the handlers below are re-made
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
  const near = hud.near;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const m = moveOf(e);
      if (s.mode === 'walk' || s.mode === 'rider') {
        if (m) {
          e.preventDefault();
          audioContext();
          return;
        }
        if ((k === 'e' || k === 'E' || k === 'Enter') && s.near && !ownButton(e, box.current)) {
          e.preventDefault();
          enter(s.near);
        } else if (k === 'r' || k === 'R') putRing(!s.wearing);
        else if (k === 'm' || k === 'M') setList((v) => !v);
        return;
      }
      if (k === 'Escape' && s.mode !== 'inside') {
        e.preventDefault();
        leave();
        return;
      }
      if (s.mode === 'rings' && m && m !== 'space' && m !== 'run') {
        e.preventDefault();
        return;
      }
      if (s.mode === 'show' && /^[1-5]$/.test(k)) {
        s.colour = COLOURS[Number(k) - 1];
        setHud((h) => ({ ...h, colour: s.colour }));
        return;
      }
      if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'E') && !ownButton(e, box.current)) {
        e.preventDefault();
        act();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [box, live, near, enter, leave, act, putRing]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    // (the QA scripts can run the clock faster, in development only)
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const held = (name) => k.has(name);
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};
    // put back where he starts again, under a fade rather than a cut (./rules.js)
    const putBack = (at) => {
      s.fade = FADE;
      s.putBack = () => {
        s.h = newHobbit(at);
        s.yaw = behindYaw(s.h.face);
        s.cut = true; // (the camera cuts to him, in the dark, rather than swing across)
      };
      setFading(true);
    };
    if (s.fade != null) {
      const [left, move] = stepFade(s.fade, dt);
      s.fade = left;
      if (move) {
        s.putBack?.();
        s.putBack = null;
        setFading(false);
      }
    }

    if ((s.mode === 'walk' || s.mode === 'rider') && s.fade == null) {
      let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
      let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (Math.abs(pad.rx) > 0) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
        if (pressed('a') && s.near) enter(s.near);
        if (pressed('x')) putRing(!s.wearing);
        if (pressed('y')) setList((v) => !v);
      }
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
      s.h = stepHobbit(s.h, { x: mv.x, z: mv.z, run }, dt);
      // his footsteps, a stride of ground apart, on the grass or the road
      const [stride, foot] = stepStride(s.stride ?? STRIDE.first, s.h, dt);
      s.stride = stride;
      if (foot) sounds().then((x) => x.step({ run: s.h.running, road: onRoad(s.h.x, s.h.z) }));
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // the camera drifts round behind him as he walks, unless you've just turned it
      if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4) {
        let d = behindYaw(s.h.face) - s.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.yaw += d * Math.min(1, dt * 1.6);
      }
    }

    // Maggot's dogs walk their rounds whatever you're doing
    const huntDone = doneRef.current.includes('maggot');
    const hEv = stepHunt(s.hunt, huntDone || s.mode !== 'walk' || s.fade != null ? { x: 0, z: -40, running: false } : { x: s.h.x, z: s.h.z, running: s.h.running }, dt);
    for (const e of hEv) {
      if (e.type === 'pick') {
        a.fx('pick', e);
        sounds().then((x) => x.pick());
        say(e.left ? `A mushroom! ${HUNT.mushrooms - e.left} of ${HUNT.mushrooms}.` : 'Ten mushrooms!');
      } else if (e.type === 'seen') {
        a.fx('seen', e);
        sounds().then((x) => x.bark());
        say(['Grip’s seen you! Run!', 'Fang! He’s coming!', 'Wolf’s on to you! Run for the gate!'][e.dog % 3], true);
      } else if (e.type === 'caught') {
        a.fx('caught');
        say('Caught! Farmer Maggot marches you back to his gate, and takes his mushrooms back.', true);
        s.hunt = newHunt([]);
        putBack(MAGGOT_GATE);
        break;
      } else if (e.type === 'lost') say('It’s lost you.');
      else if (e.type === 'all') {
        complete('maggot');
        say('Ten of Farmer Maggot’s best. Shortcut to mushrooms!');
      }
    }

    // the Ring: the Eye comes nearer while it's on
    s.gaze = stepGaze(s.gaze, s.wearing, dt);
    if (s.wearing && s.gaze >= 1) {
      putRing(false);
      say('The Eye. You pull the Ring off, shaking.', true);
    }

    // the Rider
    if (s.mode === 'walk' && s.fade == null && p.hasRing && !doneRef.current.includes('rider') && riderTrigger(s.h)) {
      s.mode = 'rider';
      s.rider = newRider();
      sounds().then((x) => {
        s.hoof?.stop();
        s.hoof = x.hooves();
      });
      say('Hoofbeats, on the road behind you. Get off the road! Under the old tree’s roots, quick.', true);
    }
    if (s.mode === 'rider' && s.rider) {
      const rEv = stepRider(s.rider, s.h, s.wearing, dt);
      s.hoof?.near(s.rider.phase === 'sniff' ? 1 : Math.min(1, s.rider.s / 22));
      for (const e of rEv) {
        if (e.type === 'coming') say('A Black Rider, coming up the road. Keep still.', true);
        else if (e.type === 'sniff') {
          sounds().then((x) => x.sniff());
          say('It’s stopped, right over you. It’s sniffing. Keep still, and don’t put it on.', true);
        } else if (e.type === 'found') {
          a.fx('found');
          // the Nazgûl's own scream, or a made one where it can't play
          clip('nazgul').then((h) => !h && sounds().then((x) => x.shriek()));
          s.hoof?.stop();
          s.hoof = null;
          putRing(false);
          say(e.why === 'ring' ? 'The Ring calls to it, and it screams. Try again, and leave the Ring be.' : e.why === 'moved' ? 'You moved, and it screams. Try again, and keep still.' : 'It sees you, and screams. Get off the road and under the roots, quick.', true);
          s.rider = null;
          s.mode = 'walk';
          putBack(RIDER_RETRY);
        } else if (e.type === 'leaving') a.fx('leaving');
        else if (e.type === 'gone') {
          s.hoof?.stop();
          s.hoof = null;
          s.rider = null;
          s.mode = 'walk';
          complete('rider');
          say('It’s gone. The road goes ever on, and the Ring goes with you.');
        }
      }
    }

    // smoke rings
    if (s.mode === 'rings' && s.rings) {
      if (held('left') || held('right') || held('up') || held('down') || pad) {
        const du = (held('right') ? -1 : 0) + (held('left') ? 1 : 0) - (pad?.lx ?? 0);
        const dv = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - (pad?.ly ?? 0);
        s.aim = { u: Math.max(-RINGS.u, Math.min(RINGS.u, s.aim.u + du * dt * 2)), v: Math.max(RINGS.v0, Math.min(RINGS.v1, s.aim.v + dv * dt * 1.6)) };
      }
      if (pressed('a')) act();
      if (pressed('b')) leave();
      for (const e of stepRings(s.rings, dt)) {
        if (e.type === 'through') {
          a.fx('through', s.aim);
          sounds().then((x) => x.chime(e.hits));
          if (e.hits === 2) say(SAYS.through.text, false, SAYS.through.who);
          else say(e.hits === 1 ? 'Through! Gandalf chuckles.' : 'Three!');
        } else if (e.type === 'won') {
          complete('rings');
          say('Three through his. Gandalf blows a little smoke ship that sails through yours.');
          later(() => sim.current?.mode === 'rings' && leave(), 2600);
        } else if (e.type === 'out') say('Out of pipe-weed. Gandalf fills your pipe again.', true);
      }
    }

    // the fireworks
    if (s.mode === 'show' && s.show) {
      if (pressed('a')) act();
      if (pressed('b')) leave();
      for (const e of stepShow(s.show, dt)) {
        if (e.type === 'burst') {
          a.fx('burst', e);
          sounds().then((x) => x.bang(0.8 + e.score * 2));
        } else if (e.type === 'dragon') {
          a.fx('dragon', { duration: SHOW.dragon - 0.7 });
          sfx().then((x) => x.roar());
          say('Merry and Pippin have got into the cart. It’s the big one: the dragon!');
          later(() => sounds().then((x) => x.bang(2.2)), (SHOW.dragon - 0.7) * 1000);
          later(() => sounds().then((x) => x.cheer()), (SHOW.dragon - 0.4) * 1000);
        } else if (e.type === 'done') {
          complete('party');
          say('What a party! Bilbo makes his speech, and then he vanishes. Something is waiting at Bag End.');
          later(() => sim.current?.mode === 'show' && leave(), 1200);
        } else if (e.type === 'over') say('The cheering dies away and everyone drifts off to the food tent. Try again, with more variety.', true);
      }
    }

    // on the side: Bilbo's spoons, while Lobelia's after them
    if (s.mode === 'walk' && s.spoons) {
      for (const e of stepSpoons(s.spoons, s.h, dt)) {
        const where = SPOON_SPOTS[e.i]?.where;
        if (e.type === 'found') {
          a.fx('spoon', e);
          sounds().then((x) => x.spoon());
          say(e.carried >= SPOONS.pocket ? `A spoon ${where}. Both pockets full: up to Bag End’s gate with them.` : `A silver spoon, ${where}!`);
        } else if (e.type === 'full') say('Your pockets are full. Take these up to Bag End’s gate first.', true);
        else if (e.type === 'pocketed') {
          a.fx('spoon', { ...e, hers: true });
          sounds().then((x) => x.pocketed());
          say(`Lobelia got there first: the spoon ${where} goes into her bag.`, true);
        } else if (e.type === 'home') {
          sounds().then((x) => x.chime(1));
          say(`${e.n === 1 ? 'A spoon' : 'Two spoons'} home in Bag End’s dresser: ${e.home} of ${SPOONS.need}.`);
        } else if (e.type === 'won') {
          sounds().then((x) => x.chime(3));
          winSide();
          s.spoons = null;
          say('Five of Bilbo’s spoons safe home. Lobelia sniffs, and says she never cared for them anyway.');
        } else if (e.type === 'lost') {
          s.spoons = null;
          say(SAYS.finders.text, true, SAYS.finders.who);
        }
      }
    }

    // Bag End
    if (s.mode === 'inside') {
      s.stepT += dt;
      if (pressed('a')) act();
      if (s.ringStep === 'safe' && s.stepT > 3.2) {
        complete('ring');
        leave();
        say('You have the Ring. R puts it on, if you must. Gandalf has ridden off; take it east, along the East Road.');
      }
    }

    // what's here, and who's here
    const spot = s.mode === 'walk' ? nearSpot(s.h.x, s.h.z) : null;
    s.near = spot && (spot.id !== 'leave' || p.finished) && (spot.id !== 'rings' || p.sky === 'day') && (spot.id !== 'spoons' || !s.spoons) ? spot.id : null;
    const sky = p.sky;
    const person = s.mode === 'walk' ? nearCast(s.h.x, s.h.z, sky === 'day' ? 'day' : 'night') : null;
    let talk = person?.id ?? null;
    if (!talk && s.mode === 'walk' && !s.spoons && Math.hypot(s.h.x - LOBELIA.x, s.h.z - LOBELIA.z) < 3.2) talk = 'lobelia';
    if (!talk && s.mode === 'walk') {
      // Gandalf on the bench by day, at the road's end at dawn
      const g = sky === 'day' ? { x: SPOTS[0].x + 0.6, z: SPOTS[0].z - 1 } : sky === 'dawn' ? { x: SPOTS[3].x - 1.5, z: SPOTS[3].z - 2 } : null;
      if (g && Math.hypot(s.h.x - g.x, s.h.z - g.z) < 3.4) talk = 'gandalf';
    }
    if (talk !== s.talk) {
      s.talk = talk;
      if (talk) {
        const c = CAST.find((x) => x.id === talk);
        const lob = talk === 'lobelia';
        const pool = c ? c.lines : lob ? LOBELIA_LINES[sideRef.current ? 'after' : 'before'] : GANDALF_LINES;
        const n = lines.current[talk] ?? 0;
        lines.current[talk] = n + 1;
        const line = pool[n % pool.length];
        setBubble({ id: talk, name: c ? c.name : lob ? 'Lobelia Sackville-Baggins' : 'Gandalf', line });
        // the films' own recording, or the speaker's made voice (./voicelines.js)
        if (SPOKEN[line]) clip(SPOKEN[line], { voice: true }); // (a voice, on the floor: lib/speech.js)
        else sayVoiced(talk, line);
      } else setBubble(null);
    }

    // the markers: what's open and not yet done
    // (and while you're after the spoons, where they are, and Bag End's gate
    // once you've some to bring home)
    const markers = s.mode === 'rider' ? [{ x: HOLLOW.x, z: HOLLOW.z }] : s.spoons ? [...(s.spoons.carried.length ? [SPOONS.home] : []), ...SPOON_SPOTS.filter((_, i) => spoonLeft(s.spoons, i))] : p.finished ? [{ x: SPOTS[3].x, z: SPOTS[3].z }] : p.quests.filter((q) => q.open && !q.done && (q.id !== 'rings' || sky === 'day')).map((q) => q.at);

    // other travellers online: where you are to them, and where they are
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: s.mode === 'inside', ring: s.wearing });
    const lobelia = { ...lobeliaNow(s.spoons), moving: Boolean(s.spoons) && s.mode === 'walk' && s.spoons.t > SPOONS.wait && s.spoons.s < LOBELIA_LEN };
    try {
      a.render(
        {
          hobbit: s.h,
          travellers: tv ? tv.list() : null,
          sky,
          mode: s.mode,
          wearing: s.wearing,
          gaze: s.gaze,
          hasRing: p.hasRing,
          hunt: s.hunt,
          rings: s.rings,
          aim: s.mode === 'rings' ? s.aim : null,
          show: s.show,
          ringStep: s.ringStep,
          rider: s.rider,
          spoons: s.spoons,
          lobelia,
          hidden: hidden(s.h),
          camYaw: s.yaw,
          camPitch: s.pitch,
          camDist: touch ? 7.2 : 6.4,
          near: s.near,
          talk: s.talk,
          markers,
          debugCam: s.debugCam,
          cut: s.cut,
        },
        ms * fast,
        fast,
      );
      s.cut = false;
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    // the HUD, when what it shows changes
    const chased = s.hunt.dogs.some((d) => d.mode === 'chase' || d.mode === 'alert');
    const key = [s.mode, s.near, s.hunt.picked.length, chased, s.moved, s.rings?.hits, s.rings?.puffs, s.rings?.state, s.show && Math.round(s.show.cheer * 40), s.show && Math.ceil(SHOW.time - s.show.t), s.show?.state, s.ringStep, s.ringStep === 'letters' && s.stepT > 2.6, s.rider?.phase, s.rider && Math.round(s.rider.pull * 20), s.wearing, Math.round(s.gaze * 20), s.colour, inField(s.h.x, s.h.z, 3), s.spoons && `${s.spoons.carried.length}.${s.spoons.home.length}.${s.spoons.hers.length}`].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({
        mode: s.mode,
        near: s.near,
        picked: s.hunt.picked.length,
        chased,
        moved: s.moved,
        inField: inField(s.h.x, s.h.z, 3),
        rings: s.rings && { hits: s.rings.hits, puffs: s.rings.puffs, state: s.rings.state },
        show: s.show && { cheer: s.show.cheer, left: Math.max(0, Math.ceil(SHOW.time - s.show.t)), state: s.show.state },
        step: s.ringStep,
        ready: s.ringStep !== 'letters' || s.stepT > 2.6,
        rider: s.rider && { phase: s.rider.phase, pull: s.rider.pull },
        wearing: s.wearing,
        gaze: s.gaze,
        colour: s.colour,
        spoons: s.spoons && { carried: s.spoons.carried.length, home: s.spoons.home.length, hers: s.spoons.hers.length },
      });
    }
    // the speech bubble follows whoever's talking
    if (s.talk && bubbleRef.current) {
      const at = a.screenOf('cast', s.talk);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) drawMap(map.current, s.h, markers, p, s.spoons ? lobelia : null);
    if (s.frame % 120 === 0) local.set(AT, { x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // the world's own pointer: drag to look round; in an activity, aim and act
  const drag = useRef(null);
  const ndc = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  };
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk' || s.mode === 'rider') {
        drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        return;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const [nx, ny] = ndc(e);
      act(nx, ny);
      return;
    }
    if (e.type === 'pointermove') {
      if (s.mode === 'rings' && e.pointerType === 'mouse') {
        const [nx, ny] = ndc(e);
        const aim = api.current?.aim('rings', nx, ny);
        if (aim) s.aim = { u: Math.max(-RINGS.u, Math.min(RINGS.u, aim.u)), v: Math.max(RINGS.v0, Math.min(RINGS.v1, aim.v)) };
      }
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

  // the touch stick: drag from where you put your thumb
  const onStick = (x, y) => (sim.current.stick = { x, y });

  const travel = (q) => {
    const s = sim.current;
    leave();
    const at = q.id === 'rider' ? { x: 38, z: -4, face: 0 } : q.at;
    s.h = newHobbit({ x: at.x, z: at.z + (q.id === 'maggot' ? -1.5 : 0.8), face: q.id === 'maggot' ? -Math.PI / 2 : Math.PI / 2 });
    s.yaw = behindYaw(s.h.face);
    setList(false);
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk' || mode === 'rider';
  const inside = mode === 'inside' ? INSIDE_TEXT[hud.step] : null;
  useVoiced(inside?.who, inside?.who && inside.say); // Gandalf's words, in his voice (./voicelines.js)
  const count = done.length;
  const objective =
    mode === 'rider'
      ? hud.rider?.phase === 'sniff'
        ? 'Keep still. Don’t put it on.'
        : 'Get off the road! Into the hollow under the old tree’s roots.'
      : hud.spoons
        ? `Bilbo’s spoons: ${hud.spoons.home} of ${SPOONS.need} home, ${hud.spoons.carried} in your pockets. Lobelia has ${hud.spoons.hers}; two, and she’s won.`
        : hud.inField && !done.includes('maggot')
        ? `Mushrooms: ${hud.picked} of ${HUNT.mushrooms}. Keep out of the dogs’ sight; run for the gate if they see you.`
        : prog.objective;
  return (
    <div ref={box} className="shire-stage" data-touch={touch || undefined} data-mode={mode} data-wearing={hud.wearing || undefined} data-sky={prog.sky}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Hobbiton in 3D: the Hill and Bag End, the Party Field, the pond and the mill, and Frodo on the lane" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Walking into Hobbiton" />
      <div className="shire-fade" data-on={fading || undefined} aria-hidden="true" />

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="shire-title" className="shire-title">
              Hobbiton
            </h1>
            <p className="shire-objective" aria-live="polite">
              <span aria-hidden="true">✦</span> {objective}
            </p>
          </div>
          <div className="shire-side">
            <canvas ref={map} className="shire-map" width="150" height="150" aria-hidden="true" />
            <button type="button" className="shire-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
              <b>{count}</b> of {QUESTS.length} done {!touch && <kbd>M</kbd>}
            </button>
            <Travellers trav={trav} />
            {prog.hasRing && (
              <button type="button" className="shire-chip shire-ring-btn" data-on={hud.wearing || undefined} data-tempt={(hud.rider?.phase === 'sniff' && hud.rider.pull > 0.3) || undefined} onClick={() => putRing(!sim.current.wearing)}>
                {hud.wearing ? 'Take it off' : 'The Ring'} {!touch && <kbd>R</kbd>}
              </button>
            )}
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
      {!walking && <h1 id="shire-title" className="sr-only">Hobbiton</h1>}

      {toast && (
        <p className="shire-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}

      {bubble && walking && (
        <Bubble ref={bubbleRef} name={bubble.name} line={bubble.line} />
      )}

      {here && walking && (
        <div className="shire-door">
          <p className="shire-door-name">{here.name}</p>
          <button type="button" className="btn btn-primary" onClick={() => enter(hud.near)}>
            {!touch && <kbd className="key-first">E</kbd>} {here.act}
          </button>
        </div>
      )}

      {gl === 'on' && walking && !hud.moved && !here && (
        <p className="shire-hint">{touch ? 'Drag the stick to walk, push it all the way to run. Swipe the view to look round.' : 'W A S D or the arrows to walk, Shift to run. Drag to look round. E to do things, M for the list.'}<GuideCue touch={touch} /></p>
      )}

      {mode === 'rider' && hud.rider?.phase === 'sniff' && (
        <div className="shire-meter shire-tempt" role="meter" aria-label="The Ring wants to be worn" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round((hud.rider.pull ?? 0) * 100) / 100}>
          <span className="shire-meter-label">It wants to be worn</span>
          <span className="shire-meter-bar">
            <span style={{ transform: `scaleX(${hud.rider.pull})` }} />
          </span>
        </div>
      )}

      {mode === 'rings' && hud.rings && (
        <div className="shire-panel shire-panel-rings">
          <p className="shire-panel-title">Smoke rings with Gandalf</p>
          <p className="shire-panel-stats">
            <span>
              Through <b>{hud.rings.hits}</b> of {RINGS.need}
            </span>
            <span>
              Puffs left <b>{hud.rings.puffs}</b>
            </span>
          </p>
          <p className="shire-panel-help">{touch ? 'Tap where to send a ring.' : 'Point to aim (or the arrows), click or Space to puff. Lead his ring: yours take a moment.'}</p>
          <div className="shire-panel-row">
            {hud.rings.state === 'out' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => enter('rings')}>
                Fill the pipe again
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
              Get up {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}

      {mode === 'show' && hud.show && (
        <div className="shire-panel shire-panel-show">
          <p className="shire-panel-title">Gandalf’s fireworks</p>
          <div className="shire-meter shire-cheer" role="meter" aria-label="The party’s cheer" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.round(hud.show.cheer * 100) / 100}>
            <span className="shire-meter-label">Cheer</span>
            <span className="shire-meter-bar">
              <span style={{ transform: `scaleX(${hud.show.cheer})` }} />
            </span>
            <span className="shire-meter-time">{hud.show.state === 'on' ? `${hud.show.left}s` : hud.show.state === 'dragon' ? 'Dragon!' : ''}</span>
          </div>
          <div className="shire-colours" role="radiogroup" aria-label="Rocket colour">
            {COLOURS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={hud.colour === c}
                aria-label={`${c}${touch ? '' : `, key ${i + 1}`}`}
                className="shire-colour"
                style={{ '--c': SWATCH[c] }}
                onClick={() => {
                  sim.current.colour = c;
                  setHud((h) => ({ ...h, colour: c }));
                }}
              >
                {!touch && <small>{i + 1}</small>}
              </button>
            ))}
          </div>
          <p className="shire-panel-help">{touch ? 'Tap the sky to send one up.' : 'Click the sky to send one up (Space for anywhere). 1–5 change colour.'}</p>
          <div className="shire-panel-row">
            {hud.show.state === 'over' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => enter('party')}>
                Again
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
              Back to the party {!touch && <kbd>Esc</kbd>}
            </button>
          </div>
        </div>
      )}

      {mode === 'inside' && (
        <div className="shire-panel shire-panel-inside">
          <p className="shire-panel-title">Bag End</p>
          <p className="shire-panel-say">{inside?.say}</p>
          {inside?.act && (
            <button type="button" className="btn btn-primary btn-sm" disabled={!hud.ready} onClick={() => act()}>
              {inside.act}
            </button>
          )}
        </div>
      )}

      {walking && touch && <Stick onMove={onStick} />}

      {list && (
        <QuestList
          title="Things to do in Hobbiton"
          quests={prog.quests}
          next={prog.next}
          side={[{ ...SIDE, done: side }]}
          onClose={() => setList(false)}
          onGo={travel}
          canGo={(q) => !hud.spoons && (q.id === SIDE.id || (q.open && (q.id !== 'rings' || prog.sky === 'day')))}
        />
      )}
    </div>
  );
}

// The map in the corner: the water, the lanes, Maggot's field, where to go, and you.
const MAP_SCALE = 150 / (WORLD.radius * 2 + 8);
function drawMap(c, h, markers, prog, lobelia = null) {
  const g = c?.getContext('2d');
  if (!g) return;
  const at = (x, z) => [75 + x * MAP_SCALE, 75 + z * MAP_SCALE];
  g.clearRect(0, 0, 150, 150);
  g.save();
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = prog.sky === 'night' ? '#2c3424' : '#e9dcb4';
  g.fillRect(0, 0, 150, 150);
  g.fillStyle = prog.sky === 'night' ? '#3a4a2e' : '#b9c98a';
  g.beginPath();
  g.arc(75, 75, WORLD.radius * MAP_SCALE, 0, Math.PI * 2);
  g.fill();
  // the field
  const [fx0, fz0] = at(FIELD.x0, FIELD.z0);
  const [fx1, fz1] = at(FIELD.x1, FIELD.z1);
  g.fillStyle = '#8a6a44';
  g.fillRect(fx0, fz0, fx1 - fx0, fz1 - fz0);
  // the water
  g.fillStyle = '#5a8ab0';
  const [px, pz] = at(POND.x, POND.z);
  g.beginPath();
  g.ellipse(px, pz, POND.rx * MAP_SCALE, POND.rz * MAP_SCALE, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#5a8ab0';
  g.lineWidth = STREAM.w * MAP_SCALE * 1.2;
  g.beginPath();
  STREAM.points.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
  g.stroke();
  // the lanes
  g.lineCap = 'round';
  g.strokeStyle = prog.sky === 'night' ? '#8a7a5a' : '#a07a4a';
  for (const r of ROADS) {
    g.lineWidth = Math.max(1.4, r.w * MAP_SCALE);
    g.beginPath();
    g.moveTo(...at(r.a[0], r.a[1]));
    g.lineTo(...at(r.b[0], r.b[1]));
    g.stroke();
  }
  // where to go
  const pulse = 4 + Math.sin(performance.now() / 250) * 1.2;
  for (const m of markers) {
    const [x, y] = at(m.x, m.z);
    g.fillStyle = '#f0c040';
    g.beginPath();
    g.arc(x, y, 3.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(240, 192, 64, 0.8)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x, y, pulse + 2, 0, Math.PI * 2);
    g.stroke();
  }
  // Lobelia, when she's out after the spoons
  if (lobelia) {
    const [x, y] = at(lobelia.x, lobelia.z);
    g.fillStyle = '#a03a8a';
    g.strokeStyle = '#fff4e8';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
  // you
  const [cx, cy] = at(h.x, h.z);
  g.save();
  g.translate(cx, cy);
  g.rotate(-h.face + Math.PI / 2);
  g.fillStyle = '#fff8e8';
  g.strokeStyle = '#2a1a0a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(60, 40, 20, 0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.stroke();
}

// Without 3D: what there is to do, as cards.
function Cards({ prog, side, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="shire-title" className="title">
        Hobbiton
      </h1>
      <p className="lead mt-4 max-w-[60ch]">The day of Bilbo’s party, in a Shire you can walk about in 3D. {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the Shire as cards.' : gl === 'failed' ? 'The 3D Shire couldn’t start here, so here it is as cards.' : three.held ? 'The 3D Shire isn’t loaded yet, so here it is as cards.' : '3D is switched off, so here’s the Shire as cards.'}
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
