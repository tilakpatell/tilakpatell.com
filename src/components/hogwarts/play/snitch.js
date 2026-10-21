// Quidditch on the screen (the design’s §4.6): rules/quidditch.js plays the
// match, this draws it round you and flies you in it on the broom
// (play/broom.js draws you). The Snitch, a glint of gold you can find
// across the pitch, its wings a blur and a hum in your ears as you close
// on it; the twelve on their loops in their houses’ colours; the Quaffle
// and the two Bludgers; the stands and the crowd (play/stands.js), on
// their feet for a goal; the commentator, a line for what just happened,
// said in a bubble over his box. Practice is the Snitch alone, wherever
// you are. A match is the pitch’s, where the grounds put it (`pitch`: {
// at: [x, y, z], yaw, seats?, built }), or until they do on a stand-in
// pitch at `stage` ({ at, yaw }), or failing that in front of you.
//
//   createQuidditch({ rt, scene, camera, house, houseName, broom, cards, feel, tier, tell, pitch })
//     → { start({ n, practice, at, yaw }), step(dt, snapshot, touch) → playing,
//         stop(), bubble(el), playing, state(), dispose() }
//
// What it tells the page (`tell(type, data)`): 'said' { who, text } (the
// commentator: the page shows it in the kit’s Bubble, which bubble(el)
// lets this move over his box), 'match' { us, them, home, away, practice,
// t, near } four times a second while it’s on, 'toast' { text }; and for
// the term’s lane, at the end of a match, rules/quidditch.js’s result {
// type: 'match', n, house, against, us, them, caught, won, draw, seconds }
// and, for a Snitch caught in a match, { type: 'points', house, delta,
// why: 'snitch' }.

import * as THREE from "three";
import {
  PITCH,
  lineFor,
  newMatch,
  playersAt,
  quaffleAt,
  result,
  stepMatch,
} from "../rules/quidditch";
import { inputOf } from "./broom";
import { makeProp } from "./props";
import { COLOURS, createStands } from "./stands";

export const SNITCH_POINTS_TO_HOUSE = 10; // what catching it in a match is worth to the Cup
const READOUT = 0.25; // s between the scores to the HUD
const SAY_GAP = 5; // s at least between two of the commentator’s lines
const NAMES = {
  gryffindor: "Gryffindor",
  hufflepuff: "Hufflepuff",
  ravenclaw: "Ravenclaw",
  slytherin: "Slytherin",
};
const COMMENTATOR = "Lee Jordan";

// the Snitch’s hum: a buzz of wings, louder and higher the nearer you are
function createHum(rt) {
  let osc = null;
  let lfo = null;
  let gain = null;
  return {
    start() {
      const ac = rt?.audio?.context?.();
      const out = rt?.audio?.bus?.();
      if (!ac || !out || ac.state === "closed" || osc) return;
      osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 180;
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 900;
      f.Q.value = 2;
      gain = ac.createGain();
      gain.gain.value = 0.0001;
      // the wingbeat: the loudness shaken at 38 a second
      lfo = ac.createOscillator();
      lfo.frequency.value = 38;
      const depth = ac.createGain();
      depth.gain.value = 0.5;
      const beat = ac.createGain();
      beat.gain.value = 0.5;
      lfo.connect(depth).connect(beat.gain);
      osc.connect(f).connect(beat).connect(gain).connect(out);
      osc.start();
      lfo.start();
    },
    set(k) {
      if (!osc) return;
      const t = rt.audio.context().currentTime;
      gain.gain.setTargetAtTime(0.0001 + 0.05 * k * k, t, 0.08);
      osc.frequency.setTargetAtTime(170 + 70 * k, t, 0.1);
    },
    stop() {
      for (const o of [osc, lfo]) {
        try {
          o?.stop();
        } catch {
          // (already stopped)
        }
        o?.disconnect();
      }
      osc = lfo = null;
    },
  };
}

// the crowd’s roar for a goal or the catch: a swell of shaped noise
function roar(rt, big = 1) {
  const ac = rt?.audio?.context?.();
  const out = rt?.audio?.bus?.();
  if (!ac || !out || ac.state === "closed") return;
  const t = ac.currentTime;
  const n = Math.floor(ac.sampleRate * 2.6);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  let s = 4242;
  let last = 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    last = last * 0.9 + ((s / 0x7fffffff) * 2 - 1) * 0.3;
    d[i] = last * (1 + 0.3 * Math.sin(i / 900));
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 700;
  f.Q.value = 0.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 * big, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 2.6);
}

export function createQuidditch({
  rt,
  scene,
  camera,
  house,
  houseName = "gryffindor",
  broom,
  cards = null,
  feel = null,
  tier = "high",
  tell = () => {},
  pitch = null,
  stage = null,
} = {}) {
  let m = null; // the rules’ match
  let frame = null; // { at: Vector3, yaw }: the pitch’s frame in the world
  let root = null; // the drawn match, in the pitch’s frame
  let view = null;
  let readout = 0;
  let said = -SAY_GAP;
  let k = 0; // lines said, for the commentator’s turn
  let bubbleEl = null;
  let ending = 0; // s the stands keep cheering after the catch
  const hum = createHum(rt);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // the pitch’s frame and the world’s
  const toWorld = (p, out = new THREE.Vector3()) =>
    out.set(p[0], p[1], p[2]).applyQuaternion(q).add(frame.at);
  const riderInWorld = (r) => {
    const w = toWorld(r.p);
    return { ...r, p: [w.x, w.y, w.z], yaw: r.yaw + frame.yaw };
  };

  function build() {
    root = new THREE.Group();
    root.name = "hogwarts-match";
    root.position.copy(frame.at);
    root.quaternion.copy(q);
    scene.add(root);
    const snitch = makeProp("snitch", { house, rt });
    snitch.scale.setScalar(1.6);
    root.add(snitch);
    view = { snitch, players: [], bludgers: [], quaffle: null, stands: null };
    if (m.practice) return;
    const us = COLOURS[houseName]?.[0] ?? "#7f0909";
    const them = COLOURS[m.against]?.[0] ?? "#1a472a";
    for (const pl of playersAt(m)) {
      const o = makeProp("rider", {
        house,
        rt,
        tint: pl.team === "us" ? us : them,
      });
      root.add(o);
      view.players.push(o);
    }
    view.quaffle = makeProp("quaffle", { house, rt });
    view.quaffle.scale.setScalar(1.6);
    root.add(view.quaffle);
    for (let i = 0; i < 2; i++) {
      const b = makeProp("bludger", { house, rt });
      b.scale.setScalar(1.8);
      root.add(b);
      view.bludgers.push(b);
    }
    view.stands = createStands({
      house,
      tier,
      pitch: pitch?.at ? pitch : null,
      standIn: !pitch?.built,
    });
    root.add(view.stands.group);
  }

  function clear() {
    if (!root) return;
    view?.stands?.dispose();
    root.traverse((o) => {
      if (o.isMesh && o.geometry && !o.geometry.userData?.shared)
        o.geometry.dispose();
    });
    scene.remove(root);
    root = null;
    view = null;
  }

  const say = (text) => {
    if (!text || m.t - said < SAY_GAP) return;
    said = m.t;
    tell("said", { who: COMMENTATOR, text });
  };

  function start({ n = 1, practice = false, at = null, yaw = null } = {}) {
    clear();
    ending = 0;
    // where: the pitch if the grounds have one and this is a match; else
    // round where you are, the long axis the way you face
    const here = broom.rider?.p ?? camera.position.toArray();
    const facing = broom.rider
      ? broom.rider.yaw
      : Math.atan2(-Math.sin(camera.rotation.y), -Math.cos(camera.rotation.y));
    const place = practice
      ? null
      : pitch?.at
        ? pitch
        : stage?.at
          ? stage
          : null;
    const fyaw = yaw ?? (place ? (place.yaw ?? 0) : facing - Math.PI / 2);
    q.setFromAxisAngle(up, fyaw);
    const centre =
      at ??
      (place
        ? place.at
        : [
            here[0] + Math.sin(facing) * (practice ? 30 : PITCH.hoopX - 12),
            Math.max(0, here[1] - 8),
            here[2] + Math.cos(facing) * (practice ? 30 : PITCH.hoopX - 12),
          ]);
    frame = { at: new THREE.Vector3(...centre), yaw: fyaw };
    // a match starts with you at your end; practice, where you are
    m = newMatch({
      n,
      house: houseName,
      practice,
      seed: Math.floor(Math.random() * 1e6),
    });
    if (broom.rider && practice) {
      const local = new THREE.Vector3(...broom.rider.p)
        .sub(frame.at)
        .applyQuaternion(q.clone().invert());
      m = {
        ...m,
        you: {
          ...broom.rider,
          p: [local.x, Math.max(2, local.y), local.z],
          yaw: broom.rider.yaw - fyaw,
          mode: "air",
          ev: [],
        },
      };
    }
    build();
    hum.start();
    said = -SAY_GAP;
    if (!practice) {
      say(lineFor({ type: "start" }, m, k++));
      roar(rt, 0.6);
    } else
      tell("toast", {
        text: "The Snitch is away. Find the glint, and E when it’s in reach.",
      });
    return m;
  }

  function stop() {
    // back to flying free, from wherever you are
    if (m) broom.rider = { ...riderInWorld(m.you), ev: [] };
    m = null;
    hum.stop();
    clear();
    tell("match", null);
  }

  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  function draw(dt) {
    const t = m.t;
    // the Snitch: its wings a blur, a glint that stays the size of a star however far
    view.snitch.position.set(...m.snitch.p);
    const wings = view.snitch.userData.parts?.wings;
    if (wings)
      wings.forEach(
        (wg, i) => (wg.rotation.x = Math.sin(t * 70 + i * Math.PI) * 1.1),
      );
    toWorld(m.snitch.p, w);
    const far = camera.position.distanceTo(w);
    if (cards) {
      cards.spawn({
        p: [w.x, w.y, w.z],
        v: [0, 0, 0],
        life: 0.06,
        size: 0.18 + far * 0.012,
        colour: new THREE.Color(1, 0.8, 0.35).multiplyScalar(
          1.6 + Math.sin(t * 9) * 0.5,
        ),
        grow: 0,
      });
      // (a fleck of gold behind it when it darts)
      if (m.snitch.mode === "dart")
        cards.spawn({
          p: [w.x, w.y, w.z],
          v: [0, 0, 0],
          life: 0.35,
          size: 0.08,
          colour: new THREE.Color(1, 0.75, 0.3).multiplyScalar(2.2),
          grow: -1,
          drag: 0,
        });
    }
    hum.set(Math.max(0, 1 - far / 12));
    if (m.practice) return;
    // the twelve, facing the way they go
    const ps = playersAt(m);
    for (const [i, pl] of ps.entries()) {
      const o = view.players[i];
      v.set(...pl.p);
      const dx = v.x - o.position.x;
      const dz = v.z - o.position.z;
      if (dx * dx + dz * dz > 1e-6) o.rotation.y = Math.atan2(dx, dz);
      o.position.copy(v);
      o.rotation.z = Math.sin(t * 0.9 + i) * 0.25;
    }
    const qf = quaffleAt(m);
    if (qf) view.quaffle.position.set(qf[0], qf[1] - 0.25, qf[2]);
    for (const [i, b] of m.bludgers.entries()) {
      view.bludgers[i].position.set(...b.p);
      view.bludgers[i].rotation.x += dt * 9;
    }
    view.stands.update(dt);
  }

  function step(dt, snap, touch) {
    if (!m) return false;
    if (ending > 0 && (ending -= dt) <= 0) {
      stop();
      return false;
    }
    const input = inputOf(snap, touch);
    m = stepMatch(m, input, dt);
    broom.show(riderInWorld(m.you), dt);
    draw(dt);
    for (const e of m.ev) {
      if (e.type === "goal") {
        view.stands?.cheer(e.side === "us" ? 1 : 0.55);
        roar(rt, e.side === "us" ? 1 : 0.6);
        say(lineFor(e, m, k++));
      } else if (e.type === "bludger") {
        feel?.trauma?.(0.7);
        feel?.hitstop?.(80);
        said = -SAY_GAP;
        say(lineFor(e, m, k++));
      } else if (e.type === "dart" || e.type === "near" || e.type === "knock")
        say(lineFor(e, m, k++));
      else if (e.type === "caught") finish(e);
    }
    if (!m) return false;
    readout -= dt;
    if (readout <= 0) {
      readout = READOUT;
      tell("match", {
        us: m.score.us,
        them: m.score.them,
        home: NAMES[houseName],
        away: NAMES[m.against] ?? null,
        practice: m.practice,
        t: Math.round(m.t),
        near: Math.round(camera.position.distanceTo(toWorld(m.snitch.p, w))),
      });
    }
    placeBubble();
    return true;
  }

  function finish(e) {
    const r = result(m);
    if (m.practice)
      tell("toast", { text: `Caught, in ${Math.round(m.t)} seconds.` });
    else {
      said = -SAY_GAP;
      say(lineFor(e, m, k++));
      view.stands?.cheer(e.by === "you" ? 1 : 0.4);
      roar(rt, e.by === "you" ? 1.3 : 0.5);
      const won = r.won
        ? `${NAMES[houseName]} win`
        : r.draw
          ? "A draw"
          : `${NAMES[m.against]} win`;
      tell("toast", {
        text: `${won}, ${Math.max(r.us, r.them)} to ${Math.min(r.us, r.them)}.`,
      });
      tell("result", r);
      if (e.by === "you")
        tell("points", {
          type: "points",
          house: houseName,
          delta: SNITCH_POINTS_TO_HOUSE,
          why: "snitch",
        });
    }
    // the stands keep cheering a moment; then back to flying free
    ending = 2.5;
    m = { ...m, over: true, ev: [] };
  }

  // the commentator’s bubble over his box (the kit’s Bubble: moved to the
  // point, shown by its opacity)
  function placeBubble() {
    if (!bubbleEl || !view?.stands) return;
    toWorld(view.stands.box.toArray(), w).project(camera);
    const box = rt?.host?.getBoundingClientRect?.();
    const on = w.z < 1 && Math.abs(w.x) < 1.1 && Math.abs(w.y) < 1.1 && box;
    bubbleEl.style.opacity = on ? "1" : "0";
    if (on)
      bubbleEl.style.transform = `translate(${Math.round(((w.x + 1) / 2) * box.width)}px, ${Math.round(((1 - w.y) / 2) * box.height)}px)`;
  }

  return {
    start,
    step,
    stop,
    bubble(el) {
      bubbleEl = el;
    },
    get playing() {
      return Boolean(m);
    },
    // the light on the crowd (0 night to 1 day)
    shade(k2) {
      view?.stands?.shade(k2);
    },
    state: () =>
      m
        ? {
            n: m.n,
            practice: m.practice,
            t: Math.round(m.t * 10) / 10,
            score: m.score,
            over: m.over,
            caught: m.caught,
            snitch: m.snitch.p.map((x) => Math.round(x)),
            you: m.you.p.map((x) => Math.round(x)),
            near:
              Math.round(
                Math.hypot(
                  m.you.p[0] - m.snitch.p[0],
                  m.you.p[1] - m.snitch.p[1],
                  m.you.p[2] - m.snitch.p[2],
                ) * 10,
              ) / 10,
          }
        : null,
    get match() {
      return m;
    },
    set match(next) {
      m = next;
    },
    dispose() {
      hum.stop();
      clear();
    },
  };
}
