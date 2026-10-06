import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../../../Achievements';
import { audioContext } from '../../../../lib/audio';
import { use3D } from '../../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../../lib/hooks';
import { readPad, typing } from '../../../games/pad';
import { Convo, QuestList, Stick, Travellers } from '../TownHud';
import { keyDown, keyUp, moveOf, ownButton } from '../keys';
import { readSide, recordSide } from '../side';
import { newTalk, talkNode, talkOn } from '../talk';
import { useTravellers } from '../useTravellers';
import { behindYaw, cameraMove, makeWalker, newWalker } from '../walker';
import { ARRIVE, DOORS, FLOWERS, GRAVE, HALL_COLLIDERS, HALL_EXIT, HALL_IN, HALL_WALLS, HILL_COLLIDERS, MUSTER, PEAKS, validAt, walkable } from './layout';
import { CONVOS, FOUND, QUESTS, SEAL, SIDE, SPEAKERS, edorasProgress } from './story';
import { BRAWL, bash, drink, newBrawl, newDrink, newWatch, spot, stepBrawl, stepDrink, stepWatch, windowOf } from './rules';
import '../../shire/shire.css';
import '../bree/bree.css';
import '../minastirith/minastirith.css';
import './edoras.css';
import '../../../../styles/lazy/middleearth.css';

// Edoras, found off the road: Gimli at the court of Rohan. Weapons at the
// door of Meduseld, Théoden freed while Wormtongue's men are kept off
// Gandalf, the white flowers on the barrows, the drinking game at the feast,
// the watch for the beacon, and the host riding out at dawn. The places are
// in ./layout.js, the story in ./story.js, the games in ./rules.js, the
// drawing in ./scene.js; this is the walking, the HUD, the talk and the
// games. Without 3D, the scenes are listed as cards.

const DONE = 'tp-edoras-done';
const AT = 'tp-edoras-at';
const SIDE_KEY = 'tp-edoras-side';
// metres a second, riding out at a gallop
const RIDE = 18;
const sounds = () => import('./sounds');
const walkers = {
  hill: makeWalker({ radius: 400, colliders: HILL_COLLIDERS, blocked: (x, z) => !walkable(x, z) }),
  hall: makeWalker({ radius: 60, colliders: HALL_COLLIDERS, walls: HALL_WALLS }),
};
// where you stand for each part of the story
const KING_AT = { x: -1.6, z: -12.4, face: Math.PI / 2 };
const BARROWS_AT = { x: GRAVE.x + 0.6, z: 1.6, face: Math.PI / 2 };
const OUT_AT = { x: DOORS.x + 2.6, z: 0, face: 0 };
const PROMPT = {
  door: { name: 'The doors of Meduseld', act: 'Go up' },
  in: { name: 'The doors of Meduseld', act: 'Go in' },
  out: { name: 'The doors', act: 'Go out' },
  flower: { name: 'Simbelmynë', act: 'Gather' },
  grave: { name: 'Théodred’s barrow', act: 'Lay the flowers' },
};

export default function EdorasWorld({ onLeave }) {
  const three = use3D();
  const [done, setDone] = useState(() => {
    const d = local.get(DONE, []);
    return edorasProgress(Array.isArray(d) ? d : []).done;
  });
  const prog = edorasProgress(done);
  const [gl, setGl] = useState('loading');
  const { unlock } = useAchievements();
  // finding the hill at all is worth something
  useEffect(() => unlock(FOUND), [unlock]);
  const complete = useCallback(
    (id) => {
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = edorasProgress([...d, id]).done;
        local.set(DONE, next);
        return next;
      });
      if (SEAL[id]) unlock(SEAL[id]);
    },
    [unlock],
  );
  // the drinking game, on the side: the most tankards before you go under
  const [side, setSide] = useState(() => readSide(local.get(SIDE_KEY, null)));
  const recordGo = useCallback(
    (drinks) => {
      const won = drinks >= SIDE.drinks;
      setSide((was) => {
        const { won: w, best } = recordSide(was, { won, score: drinks });
        local.set(SIDE_KEY, { won: w, best });
        return { won: w, best };
      });
      if (won) unlock(SIDE.seal);
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
    <section className="shire-world minas-world edoras-world" aria-labelledby="edoras-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World key={round} prog={prog} complete={complete} side={side} recordGo={recordGo} gl={gl} setGl={setGl} onLeave={onLeave} again={again} /> : <Cards prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

const seed = () => Math.floor(Math.random() * 100000) + 1;
const near = (h, o, r) => Math.hypot(h.x - o.x, h.z - o.z) < r;

function World({ prog, complete, side, recordGo, gl, setGl, onLeave, again }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const meter = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const zone = prog.zone;
    const saved = local.get(AT, null);
    // walking about (on the hill, or back in the hall when the story's done)
    const walk = zone === 'hill';
    const inHall = walk && prog.finished && saved?.zone === 'hall';
    const at = inHall ? validAt(saved, 'hall') : prog.next === 'flowers' ? BARROWS_AT : validAt(saved, 'hill');
    const h = newWalker(zone === 'hall' ? (prog.next === 'king' ? KING_AT : HALL_IN) : at);
    sim.current = { zone: inHall ? 'hall' : zone, h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.3, dragAt: -1e9, mode: walk ? 'walk' : 'talk', talking: null, talk: null, near: null, nearI: -1, frame: 0, moved: false, t: 0, air: null, hooves: null, padBefore: null, brawl: null, drink: null, watch: null, litAt: -1, hinted: false, muster: 0, musterV: 0, picked: [], carrying: 0, busy: false, steer: 0, fwd: 0, startAt: zone, firstMan: true };
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
  // other travellers online on the hill, as pale Gimlis from other worlds
  const trav = useTravellers('edoras', gl === 'on', { bound: 400 });

  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createEdorasWorld }) => {
        if (dead || !canvas.current) return null;
        return createEdorasWorld(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__EDORAS__ = { api: a, sim: sim.current, complete };
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
      if (s.mode === 'walk' && (s.zone === 'hill' || s.zone === 'hall')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
      s.air?.stop();
      s.hooves?.stop();
      api.current?.dispose();
      api.current = null;
    };
  }, [setGl, complete]);

  const live = gl === 'on' && inView;
  const placeAir = useCallback(() => {
    const s = sim.current;
    const p = progRef.current;
    const where = s.mode === 'muster' ? 'muster' : s.zone === 'muster' || s.mode === 'end' ? 'dawn' : s.zone === 'terrace' ? 'night' : s.zone === 'hall' ? (s.mode === 'drink' || s.talking === 'feast' || s.talking === 'down' ? 'feast' : 'hall') : p.time === 'evening' ? 'night' : 'hill';
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
      if (s.mode === 'muster') s.hooves = x.gallop();
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
  const toHill = useCallback(
    (at = ARRIVE) => {
      const s = sim.current;
      s.zone = 'hill';
      s.mode = 'walk';
      s.h = newWalker(at);
      s.yaw = behindYaw(at.face);
      s.pitch = 0.3;
      s.busy = false;
      placeAir();
    },
    [placeAir],
  );
  const toHall = useCallback(
    (at = HALL_IN) => {
      const s = sim.current;
      s.zone = 'hall';
      s.mode = 'walk';
      s.h = newWalker(at);
      s.yaw = behindYaw(at.face);
      s.pitch = 0.3;
      placeAir();
      sounds().then((x) => x.door());
      api.current?.fx('door');
    },
    [placeAir],
  );
  const startBrawl = useCallback(() => {
    const s = sim.current;
    s.mode = 'brawl';
    s.brawl = newBrawl(seed());
    s.h = newWalker(KING_AT);
    s.yaw = behindYaw(KING_AT.face);
    s.pitch = 0.5;
    s.busy = false;
    s.firstMan = true;
    placeAir();
  }, [placeAir]);
  const startDrink = useCallback(() => {
    const s = sim.current;
    s.mode = 'drink';
    s.drink = newDrink(seed());
    s.busy = false;
    placeAir();
  }, [placeAir]);
  const startWatch = useCallback(() => {
    const s = sim.current;
    s.mode = 'watch';
    s.watch = newWatch(seed(), PEAKS);
    s.litAt = -1;
    s.hinted = false;
    s.busy = false;
    placeAir();
  }, [placeAir]);
  const startMuster = useCallback(() => {
    const s = sim.current;
    s.mode = 'muster';
    s.muster = 0;
    s.musterV = 0;
    s.busy = false;
    placeAir();
    sounds().then((x) => {
      if (sim.current?.mode === 'muster' && !sim.current.hooves && sim.current.air) sim.current.hooves = x.gallop();
    });
  }, [placeAir]);
  // what to do next, coming into a place the story has moved on to
  const begin = useCallback(
    (zone) => {
      const p = progRef.current;
      if (zone === 'hall') startTalk(p.next === 'feast' ? 'feast' : 'king');
      else if (zone === 'terrace') startTalk('watch');
      else if (zone === 'muster') {
        startTalk('muster');
        sounds().then((x) => x.horn());
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
      if (id === 'door') startTalk('door');
      else if (id === 'in') toHall();
      else if (id === 'out') {
        sounds().then((x) => x.door());
        toHill(OUT_AT);
      } else if (id === 'flower') {
        const i = s.nearI;
        if (i < 0 || s.picked.includes(i)) return;
        s.picked = [...s.picked, i];
        s.carrying += 1;
        sounds().then((x) => x.pick());
        const n = s.picked.length;
        say(n === FLOWERS.length ? 'That’s all seven. Lay them at the foot of Théodred’s barrow, nearest the gate.' : `Simbelmynë: ${n} of ${FLOWERS.length}.`);
      } else if (id === 'grave') {
        if (s.carrying < FLOWERS.length) {
          say(`You have ${s.carrying} of ${FLOWERS.length}. Gather the rest from the barrows along the road: they glimmer.`, true);
          return;
        }
        sounds().then((x) => x.lay());
        startTalk('laid');
      }
      s.near = null;
    },
    [say, startTalk, toHall, toHill],
  );

  const talkOnward = useCallback(
    (choice = null) => {
      const s = sim.current;
      if (!s.talk || !s.talking) return;
      const convo = CONVOS[s.talking];
      const node = talkNode(convo, s.talk);
      if (node?.choices && choice == null) return;
      s.talk = talkOn(convo, s.talk, choice);
      // the weapons piled up at the door, and the king's answer
      if (s.talking === 'door' && (s.talk.at === 'others' || s.talk.at === 'growl')) sounds().then((x) => x.clank());
      if (s.talking === 'lit' && s.talk.at === 'answer') sounds().then((x) => x.horn());
      if (!s.talk.end) return setHud((h) => ({ ...h, line: s.talk.at }));
      const which = s.talking;
      s.talking = null;
      s.talk = null;
      setHud((h) => ({ ...h, line: null }));
      s.mode = 'walk';
      if (which === 'door') {
        complete('weapons');
        toHall(KING_AT);
        startTalk('king');
      } else if (which === 'king') startBrawl();
      else if (which === 'freed') {
        complete('king');
        toHill(BARROWS_AT);
        startTalk('barrows');
      } else if (which === 'barrows') say('Gather the white flowers from seven of the barrows: they glimmer.');
      else if (which === 'laid') {
        complete('flowers');
        s.carrying = 0;
        s.zone = 'hall';
        s.h = newWalker(HALL_IN);
        say('Evening, and a feast in Meduseld.');
        startTalk('feast');
      } else if (which === 'feast') startDrink();
      else if (which === 'down') {
        complete('feast');
        s.drink = null;
        s.zone = 'terrace';
        startTalk('watch');
      } else if (which === 'watch') startWatch();
      else if (which === 'lit') {
        complete('beacon');
        s.watch = null;
        s.zone = 'muster';
        startTalk('muster');
        sounds().then((x) => x.horn());
      } else if (which === 'muster') startMuster();
      return undefined;
    },
    [complete, say, startBrawl, startDrink, startMuster, startTalk, startWatch, toHall, toHill],
  );

  // the brawl: knock down whoever is in front of you
  const doBash = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'brawl' || !s.brawl || s.busy) return;
    const r = bash(s.brawl, { x: s.h.x, z: s.h.z, face: s.h.face });
    if (r < 0) return;
    api.current?.fx('bash');
    sounds().then((x) => {
      x.bash();
      if (r > 0) x.grunt();
    });
    if (r > 1) say(`${r} at once!`);
  }, [say]);
  // the feast: drink when it's at your lips
  const doDrink = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'drink' || !s.drink || s.busy) return;
    const d = s.drink;
    const r = drink(d);
    if (r === 'drank') {
      sounds().then((x) => {
        x.gulp();
        if (d.drinks % 4 === 0) setTimeout(() => x.burp(), 650);
      });
      if (d.drinks === SIDE.drinks) say('A dozen! Legolas raises an eyebrow, very slightly.');
    } else if (r === 'spilled') {
      sounds().then((x) => x.spill());
      say('Down your beard!', true);
    } else if (r === 'down') {
      s.busy = true;
      sounds().then((x) => {
        x.gulp();
        setTimeout(() => x.thudFloor(), 700);
      });
      later(() => api.current?.fx('fall'), 700);
      recordGo(d.drinks);
      later(() => {
        const x = sim.current;
        if (!x || x.mode !== 'drink') return;
        x.busy = false;
        startTalk('down');
      }, 1900);
    }
  }, [later, recordGo, say, startTalk]);
  // the watch: say when you see it
  const doSpot = useCallback(() => {
    const s = sim.current;
    if (s.mode !== 'watch' || !s.watch || s.busy) return;
    const r = spot(s.watch);
    if (r === 'spotted') {
      s.busy = true;
      sounds().then((x) => x.fire());
      say('A fire on the mountains!');
      later(() => {
        const x = sim.current;
        if (!x || x.mode !== 'watch') return;
        x.busy = false;
        startTalk('lit');
      }, 1400);
    } else if (r === 'nothing') say('Nothing yet: only the stars, and the dark of the mountains.', true);
    else if (r === 'wrong') say('A fire? No: a star, low over the peaks. Look again.', true);
  }, [later, say, startTalk]);

  const doAct = useCallback(() => {
    const s = sim.current;
    if (s.mode === 'brawl') return doBash();
    if (s.mode === 'drink') return doDrink();
    if (s.mode === 'watch') return doSpot();
    if (s.mode === 'walk' && s.near) return enter(s.near);
    return undefined;
  }, [doBash, doDrink, doSpot, enter]);

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
      const act = k === ' ' || k === 'e' || k === 'E' || k === 'Enter';
      if (s.talk) {
        if (/^[1-4]$/.test(k)) {
          e.preventDefault();
          talkOnward(Number(k) - 1);
        } else if (act && !onButton) {
          e.preventDefault();
          talkOnward();
        }
        return;
      }
      if (moveOf(e) && s.mode !== 'end') {
        e.preventDefault();
        audioContext();
      }
      if ((s.mode === 'brawl' || s.mode === 'drink' || s.mode === 'watch') && !e.repeat && act && !onButton) {
        e.preventDefault();
        doAct();
        return;
      }
      if (act && !onButton && !e.repeat) {
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

    // walking: the hill, the hall (and the brawl in it)
    if ((s.mode === 'walk' || s.mode === 'brawl') && (s.zone === 'hill' || s.zone === 'hall') && !s.busy) {
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

    // Théoden King
    if (s.mode === 'brawl' && s.brawl && !s.busy) {
      for (const e of stepBrawl(s.brawl, dt)) {
        if (e.type === 'come' && s.firstMan) {
          s.firstMan = false;
          say('One of Wormtongue’s men, out of the shadows! Knock him down (E).', true);
        } else if (e.type === 'reach') {
          a.fx('reach');
          sounds().then((x) => x.flash());
          say('He laid hands on Gandalf, and the spell falters! Keep them off!', true);
        } else if (e.type === 'done') {
          s.busy = true;
          sounds().then((x) => x.flash());
          later(() => {
            const x = sim.current;
            if (!x || x.mode !== 'brawl') return;
            x.brawl = null;
            x.busy = false;
            a.fx('thunder');
            sounds().then((y) => y.thunder());
            startTalk('freed');
          }, 900);
        }
      }
    }

    // the drinking game
    if (s.mode === 'drink' && s.drink && !s.busy) {
      if (pad && pressed('a')) doDrink();
      stepDrink(s.drink, dt);
    }

    // the watch
    if (s.mode === 'watch' && s.watch && !s.busy) {
      const turn = (held('left') ? 1 : 0) - (held('right') ? 1 : 0) - s.stick.x - (s.steer ?? 0) - (pad ? pad.lx : 0);
      if (pad && pressed('a')) doSpot();
      for (const e of stepWatch(s.watch, dt, turn)) if (e.type === 'lit') s.litAt = s.t;
      if (s.litAt > 0 && !s.hinted && s.t - s.litAt > 7) {
        s.hinted = true;
        say('Is that a glow, away along the mountains? Look along them (A and D).');
      }
    }

    // riding out
    if (s.mode === 'muster' && !s.busy) {
      const spur = held('up') || held('run') || s.fwd > 0 || Boolean(pad?.a) || s.stick.y < -0.5 || (pad ? pad.ly < -0.5 : false);
      s.musterV += ((spur ? 1 : 0) - s.musterV) * Math.min(1, dt * 1.4);
      const was = s.muster;
      s.muster = Math.min(MUSTER.len, s.muster + s.musterV * RIDE * dt);
      s.hooves?.set(s.musterV);
      if (was < MUSTER.len / 2 && s.muster >= MUSTER.len / 2) sounds().then((x) => x.horn());
      if (s.muster >= MUSTER.len) {
        s.hooves?.stop();
        s.hooves = null;
        complete('muster');
        sounds().then((x) => x.cheer());
        s.mode = 'end';
        placeAir();
      }
    }

    // what's here
    s.near = null;
    s.nearI = -1;
    if (s.mode === 'walk' && s.zone === 'hill') {
      const h = s.h;
      if (p.next === 'weapons' && near(h, DOORS, DOORS.r + 1)) s.near = 'door';
      else if (p.next === 'flowers') {
        const f = FLOWERS.find((x) => !s.picked.includes(x.i) && near(h, x, x.r + 0.4));
        if (f) {
          s.near = 'flower';
          s.nearI = f.i;
        } else if (near(h, GRAVE, GRAVE.r)) s.near = 'grave';
      } else if (p.finished && near(h, DOORS, DOORS.r)) s.near = 'in';
    } else if (s.mode === 'walk' && s.zone === 'hall') {
      if (near(s.h, HALL_EXIT, HALL_EXIT.r)) s.near = 'out';
    }

    const node = s.talk ? talkNode(CONVOS[s.talking], s.talk) : null;
    const tv = trav.ref.current;
    tv?.pose(s.h, { inside: !(s.zone === 'hill' && s.mode === 'walk') });
    const b = s.brawl;
    const d = s.drink;
    const w = s.watch;
    const axe = !(p.next === 'king' || (s.talking === 'door' && ['growl', 'staff', 'stick'].includes(s.talk?.at)));
    try {
      a.render(
        {
          zone: s.zone,
          mode: s.mode,
          next: p.next,
          finished: p.finished,
          time: s.mode === 'end' ? 'dawn' : p.time,
          gimli: s.h,
          axe,
          freed: s.talking === 'freed',
          picked: s.picked,
          carrying: s.carrying,
          travellers: tv ? tv.list() : null,
          talking: s.talking,
          speaker: node?.who ?? null,
          line: s.talk?.at ?? null,
          brawl: b ? { work: b.work, men: b.men } : null,
          drink: d ? { k: d.k, head: d.head, state: d.state } : null,
          watch: w ? { look: w.look, lit: w.lit } : null,
          muster: s.muster,
          musterV: s.musterV,
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
    // the meters, straight to the page every frame
    const m = meter.current;
    if (m) {
      if (b) m.style.setProperty('--work', b.work.toFixed(3));
      if (d) {
        m.style.setProperty('--k', ((d.k + 1) / 2).toFixed(3));
        m.style.setProperty('--lips', (windowOf(d.head) / 2).toFixed(3));
        m.style.setProperty('--head', d.head.toFixed(3));
      }
      if (s.mode === 'muster') m.style.setProperty('--ride', (s.muster / MUSTER.len).toFixed(3));
    }

    const key = [s.zone, s.mode, s.near, s.nearI, s.moved, s.talking, s.talk?.at, s.picked.length, s.carrying, b ? b.felled : '', b ? b.reached : '', d ? d.drinks : '', d ? d.spills : '', d?.state, w ? w.lit != null : '', s.busy, p.done.length].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ zone: s.zone, mode: s.mode, near: s.near, moved: s.moved, talking: s.talking, line: s.talk?.at ?? null, picked: s.picked.length, carrying: s.carrying, brawl: b ? { felled: b.felled, reached: b.reached } : null, drink: d ? { drinks: d.drinks, spills: d.spills, legolas: d.legolas, state: d.state } : null });
    }
    if (++s.frame % 120 === 0 && s.mode === 'walk' && (s.zone === 'hill' || s.zone === 'hall')) local.set(AT, { zone: s.zone, x: s.h.x, z: s.h.z, face: s.h.face });
  }, live);

  // look round by dragging; the stick on touch
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (s.mode === 'walk' || s.mode === 'brawl') drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
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
  // after the end: walk Edoras in the morning, the story kept
  const stay = () => {
    sim.current.muster = 0;
    toHill(OUT_AT);
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const mode = hud.mode;
  const walking = mode === 'walk';
  const convo = hud.talking ? CONVOS[hud.talking] : null;
  const node = convo && hud.line ? convo.nodes[hud.line] : convo ? convo.nodes[convo.start] : null;
  const zone = hud.zone ?? sim.current.zone;
  const title = zone === 'hall' ? 'Meduseld, the Golden Hall' : zone === 'terrace' ? 'The terrace of Meduseld' : zone === 'muster' ? 'The plain below Edoras' : prog.next === 'flowers' ? 'The barrows of the kings' : 'Edoras';
  const Br = hud.brawl;
  const Dr = hud.drink;
  return (
    <div ref={box} className="shire-stage minas-stage edoras-stage" data-touch={touch || undefined} data-mode={mode} data-zone={zone} data-time={prog.time} data-game={['brawl', 'drink', 'watch', 'muster'].includes(mode) || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label="Edoras in 3D: the hill in the plain of Rohan, its stockade and thatched halls, Meduseld the Golden Hall and the hall inside, the barrows of the kings, and the White Mountains" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="shire-loading">To Edoras…</p>}

      {walking && (
        <div className="shire-hud shire-hud-top">
          <div className="shire-brand">
            <h1 id="edoras-title" className="shire-title">
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
            {prog.next === 'flowers' && (
              <p className="shire-chip edoras-flowers" aria-live="polite">
                <span aria-hidden="true">❀</span> <b>{hud.picked ?? 0}</b> of {FLOWERS.length}
              </p>
            )}
            {zone === 'hill' && <Travellers trav={trav} />}
          </div>
        </div>
      )}
      {!walking && (
        <h1 id="edoras-title" className="sr-only">
          Edoras
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

      {mode === 'brawl' && Br && (
        <div ref={meter} className="shire-panel minas-game edoras-game" role="group" aria-label="Théoden King">
          <p className="shire-panel-title">Keep Wormtongue’s men off Gandalf</p>
          <div className="edoras-bar" aria-hidden="true">
            <span className="edoras-bar-fill edoras-work" />
          </div>
          <p className="shire-panel-stats">
            <span>
              Knocked down <b>{Br.felled}</b>
            </span>
            <span>
              Got through <b>{Br.reached}</b>
            </span>
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm minas-big" onPointerDown={(e) => (e.preventDefault(), doBash())}>
                Swing
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Walk to them (WASD) and knock them down: E or Space, facing them. Within {BRAWL.hit.toFixed(1)} m.</p>
          )}
        </div>
      )}
      {mode === 'drink' && Dr && (
        <div ref={meter} className="shire-panel minas-game edoras-game" role="group" aria-label="The drinking game" data-down={Dr.state === 'down' || undefined}>
          <p className="shire-panel-title">{Dr.state === 'down' ? 'The floor comes up to meet you…' : 'Drink when the tankard’s at your lips'}</p>
          <div className="edoras-swing" aria-hidden="true">
            <span className="edoras-swing-lips" />
            <span className="edoras-swing-mug" />
          </div>
          <div className="edoras-bar edoras-bar-thin" aria-hidden="true">
            <span className="edoras-bar-fill edoras-head" />
          </div>
          <p className="shire-panel-stats">
            <span>
              Gimli <b>{Dr.drinks}</b>
            </span>
            <span>
              Legolas <b>{Dr.legolas}</b>
            </span>
            {Dr.spills > 0 && (
              <span>
                Spilt <b>{Dr.spills}</b>
              </span>
            )}
            {side.best != null && (
              <span>
                Best <b>{side.best}</b>
              </span>
            )}
          </p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm minas-big" onPointerDown={(e) => (e.preventDefault(), doDrink())}>
                Drink
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Space or E when the tankard reaches the gold. The more you drink, the faster it swings.</p>
          )}
        </div>
      )}
      {mode === 'watch' && (
        <div className="shire-panel minas-game edoras-game" role="group" aria-label="The watch">
          <p className="shire-panel-title">Watch the White Mountains</p>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-ghost btn-sm minas-big" aria-label="Look left" {...hold('steer', -1)}>
                ◀
              </button>
              <button type="button" className="btn btn-primary btn-sm minas-big" onPointerDown={(e) => (e.preventDefault(), doSpot())}>
                A fire!
              </button>
              <button type="button" className="btn btn-ghost btn-sm minas-big" aria-label="Look right" {...hold('steer', 1)}>
                ▶
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">A and D to look along the mountains; E when you see a fire on a peak.</p>
          )}
        </div>
      )}
      {mode === 'muster' && (
        <div ref={meter} className="shire-panel minas-game edoras-game" role="group" aria-label="Riding out">
          <p className="shire-panel-title">Ride for Gondor!</p>
          <div className="edoras-bar" aria-hidden="true">
            <span className="edoras-bar-fill edoras-ride" />
          </div>
          {touch ? (
            <div className="shire-panel-row">
              <button type="button" className="btn btn-primary btn-sm minas-big" {...hold('fwd', 1)}>
                Ride
              </button>
            </div>
          ) : (
            <p className="shire-panel-help">Hold W to ride out with the host.</p>
          )}
        </div>
      )}
      {mode === 'end' && (
        <div className="shire-panel minas-end" role="dialog" aria-label="Rohan will answer">
          <p className="shire-panel-title">Rohan will answer</p>
          <p className="shire-panel-say">Six thousand spears ride east for Gondor, and the banners of the white horse go before them. Behind, Edoras stands on its hill in the morning, and the flowers are white on the barrows.</p>
          {side.best != null && <p className="shire-panel-say edoras-best">Best at the feast: {side.best} tankards before going under.</p>}
          <div className="shire-panel-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLeave?.()}>
              Back to the map
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stay}>
              Walk Edoras
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={again}>
              From the beginning
            </button>
          </div>
        </div>
      )}
      {walking && touch && <Stick onStick={onStick} />}
      {list && <QuestList title="Things to do in Edoras" quests={prog.quests} next={prog.next} onClose={() => setList(false)} />}
    </div>
  );
}

// Without 3D: the scenes, as cards.
function Cards({ prog, three, gl, retry }) {
  return (
    <div className="shell shire-cards-wrap">
      <h1 id="edoras-title" className="title">
        Edoras
      </h1>
      <p className="lead mt-4 max-w-[60ch]">You found the way in. The hill of Edoras in the plain of Rohan, Meduseld the Golden Hall, the barrows of the kings and the White Mountains, to play through in 3D as Gimli. {prog.objective}</p>
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
