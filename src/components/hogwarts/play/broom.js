// The broom under you (the design’s §4.6): rules/flight.js flies it, this
// draws it and sits you on it. First person, as the walk is (there is no
// figure of you yet: the cast lane’s), so the camera is the rider’s eye just
// behind the handle: the shaft runs away ahead of you down the middle of the
// view, the world banks with the broom and the field of view opens with the
// speed. A hop as you get on (the eye rising to the seat), the wind in your
// ears that rises with the pace, motes of the air streaming past, and down
// again where you land: you step off and the broom lies at your feet for the
// next time (E, or Accio from anywhere in 20 m).
//
// The walk’s yaw looks along (−sin, −cos), the camera’s way; the flight’s
// faces (sin, cos). A broom’s yaw is the walk’s plus a half turn.
//
//   BROOM_KEYS → the codes the broom binds beside the walk’s (Space, C)
//   inputOf(snapshot, touch) → rules/flight.js’s input (and `catch`, E)
//   createBroom({ rt, scene, camera, house, floorAt, level, solids, bounds, feel, reduced })
//     → { mount(at, walkYaw), show(rider, dt), step(dt, snapshot, touch),
//         riding, rider, landed, dispose() }
//   step() flies the broom by the keys and says what happened: null, or
//   { landed: [x, z], yaw } as you come down onto the floor (the walk takes
//   over there); show() draws a rider something else flies (the match).

import * as THREE from 'three';
import { BROOM, mount as mountRider, stepBroom } from '../rules/flight';
import { makeProp } from './props';

export const BROOM_KEYS = { rise: ['Space'], sink: ['KeyC'] };

const EYE = 0.78; // m over the seat: a first-year sitting up
const BACK = 0.12; // and this far behind it
const HOP = 0.35; // s the eye takes from standing to sitting
const FOV_GAIN = 14; // degrees the view opens flat out
const LOOK = 0.0032; // radians a pixel of drag
const LOOK_BACK = 1.6; // how quickly a free look comes home (1/s)
const STICK_FAST = 0.92; // the stick pushed past this is flat out

export function inputOf(snap, touch = { x: 0, y: 0 }) {
  const on = (name) => Boolean(snap?.action?.(name));
  const sx = touch?.x ?? 0;
  const sy = touch?.y ?? 0;
  return {
    fwd: Math.max(-1, Math.min(1, (on('forward') ? 1 : 0) - (on('back') ? 1 : 0) - sy)),
    side: Math.max(-1, Math.min(1, (on('right') ? 1 : 0) - (on('left') ? 1 : 0) + sx)),
    // (on touch, the Up and Down buttons and Catch, held: `touch.rise`, `.sink`, `.catch`)
    up: on('rise') || touch?.rise ? 1 : 0,
    down: on('sink') || touch?.sink ? 1 : 0,
    boost: on('run') || Math.hypot(sx, sy) > STICK_FAST,
    catch: on('act') || Boolean(touch?.catch),
  };
}

// the wind in your ears: a band of noise, its loudness and its pitch the pace
function createWind(rt) {
  let src = null;
  let filter = null;
  let gain = null;
  const start = () => {
    const ac = rt?.audio?.context?.();
    const out = rt?.audio?.bus?.();
    if (!ac || !out || ac.state === 'closed' || src) return;
    const n = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    let s = 9001;
    let last = 0;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      // (a little brown in it: wind, not hiss)
      last = last * 0.96 + ((s / 0x7fffffff) * 2 - 1) * 0.2;
      d[i] = last * 3;
    }
    src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.7;
    filter.frequency.value = 300;
    gain = ac.createGain();
    gain.gain.value = 0.0001;
    src.connect(filter).connect(gain).connect(out);
    src.start();
  };
  return {
    start,
    set(k) {
      if (!src) return;
      const t = rt.audio.context().currentTime;
      gain.gain.setTargetAtTime(0.0001 + 0.11 * k * k, t, 0.12);
      filter.frequency.setTargetAtTime(260 + 1300 * k, t, 0.15);
    },
    stop() {
      if (!src) return;
      try {
        src.stop();
      } catch {
        // (already stopped)
      }
      src.disconnect();
      src = null;
    },
  };
}

export function createBroom({ rt, scene, camera, house, floorAt = () => 0, level = -Infinity, solids = [], bounds = null, feel = null, reduced = false, cards = null } = {}) {
  let rider = null;
  let driven = null; // a bot’s input, in place of the keys’ (drive())
  let hop = 0; // s into the hop up
  let fromEye = null; // where the eye was as you got on
  let lookYaw = 0;
  let lookPitch = 0;
  let lookRest = 0;
  const baseFov = camera.fov;
  const wind = createWind(rt);

  // the broom you sit on: the stand-in (or Lane B’s model, props.js), its
  // seat at the group’s origin, the handle forward
  const group = new THREE.Group();
  const broom = makeProp('broom', { house, rt });
  broom.position.z = 0.3;
  group.add(broom);
  group.visible = false;
  scene.add(group);
  const solidsOf = solids.map((s) => (s.at ? { x: s.at[0], z: s.at[1], r: s.r } : s));
  // the floor to the broom: the ground, or the water’s top (you skim a lake, you don’t land in it)
  const floor = (x, z) => Math.max(floorAt(x, z), level + 0.2);
  const wet = (x, z) => floorAt(x, z) < level - 0.25;

  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const eye = new THREE.Vector3();
  function show(r, dt) {
    group.visible = true;
    // the broom: its yaw, the nose down as you lean, rolled into the bank
    // (the broom’s right is −x as it faces +z: a bank right is a roll up of +x)
    e.set(r.lean * 0.6, r.yaw, r.bank * 0.7 + (r.roll ?? 0), 'YXZ');
    group.quaternion.setFromEuler(e);
    group.position.set(r.p[0], r.p[1], r.p[2]);
    // the eye, over the seat and a little behind, rolled with the broom
    eye.set(0, EYE, -BACK).applyQuaternion(group.quaternion).add(group.position);
    hop = Math.min(HOP, hop + dt);
    if (fromEye && hop < HOP) {
      const k = hop / HOP;
      eye.lerpVectors(fromEye, eye, k * k * (3 - 2 * k));
    }
    // a free look, easing home once let go
    lookRest += dt;
    if (lookRest > 0.4) {
      const k = Math.exp(-LOOK_BACK * dt);
      lookYaw *= k;
      lookPitch *= k;
    }
    camera.position.copy(eye);
    e.set(-0.1 - r.lean * 0.35 + lookPitch, r.yaw + Math.PI + lookYaw, reduced ? 0 : -r.bank * 0.45 + (r.roll ?? 0), 'YXZ');
    camera.quaternion.setFromEuler(e);
    // the view opens with the pace, the wind rises with it
    const k = Math.min(1, r.spd / BROOM.top);
    if (feel?.setBaseFov) feel.setBaseFov(baseFov + (reduced ? 0 : FOV_GAIN * k));
    else {
      camera.fov = baseFov + (reduced ? 0 : FOV_GAIN * k);
      camera.updateProjectionMatrix();
    }
    wind.set(k);
    // motes of the air ahead, still in the world, so they stream past
    if (cards && r.spd > 6 && !reduced) {
      const n = Math.random() < (r.spd / BROOM.top) * dt * 90 ? 2 : 0;
      for (let i = 0; i < n; i++) {
        const ahead = 8 + Math.random() * 14;
        const side = (Math.random() - 0.5) * 9;
        const up = (Math.random() - 0.5) * 5;
        const fx = Math.sin(r.yaw);
        const fz = Math.cos(r.yaw);
        cards.spawn({
          p: [r.p[0] + fx * ahead + fz * side, r.p[1] + 0.8 + up, r.p[2] + fz * ahead - fx * side],
          v: [0, 0, 0],
          life: 1.4,
          size: 0.035,
          colour: new THREE.Color(0.7, 0.75, 0.8).multiplyScalar(0.5),
          drag: 0,
        });
      }
    }
  }

  return {
    get riding() {
      return Boolean(rider);
    },
    get rider() {
      return rider;
    },
    set rider(r) {
      rider = r;
    },
    // up you get: from where you stand, facing the walk’s way
    mount([x, z], walkYaw) {
      rider = mountRider({ x, y: floor(x, z), z, yaw: walkYaw + Math.PI });
      rider = { ...rider, ev: [] };
      fromEye = camera.position.clone();
      hop = 0;
      lookYaw = lookPitch = 0;
      wind.start();
      show(rider, 0);
      return rider;
    },
    show,
    // a drag looks about without steering
    look(dx, dy) {
      lookYaw = Math.max(-1.3, Math.min(1.3, lookYaw - dx * LOOK));
      lookPitch = Math.max(-0.9, Math.min(0.7, lookPitch - dy * LOOK));
      lookRest = 0;
    },
    step(dt, snap, touch) {
      if (!rider) return null;
      const drag = snap?.pointer?.drag;
      if (drag && (drag.dx || drag.dy)) this.look(drag.dx, drag.dy);
      rider = stepBroom(rider, driven ?? inputOf(snap, touch), dt, {
        floorAt: floor,
        solids: solidsOf,
      });
      // inside the world’s edge
      if (bounds) {
        const p = rider.p;
        const x = Math.max(bounds.x0, Math.min(bounds.x1, p[0]));
        const z = Math.max(bounds.z0, Math.min(bounds.z1, p[2]));
        if (x !== p[0] || z !== p[2]) rider = { ...rider, p: [x, p[1], z], spd: rider.spd * 0.9 };
      }
      if (rider.mode === 'ground') {
        // down on the water: up again, you skim it
        if (wet(rider.p[0], rider.p[2]))
          rider = {
            ...rider,
            mode: 'air',
            p: [rider.p[0], floor(rider.p[0], rider.p[2]) + BROOM.clear, rider.p[2]],
          };
        else {
          const out = {
            landed: [rider.p[0], rider.p[2]],
            yaw: rider.yaw - Math.PI,
            ev: rider.ev,
          };
          this.off();
          return out;
        }
      }
      show(rider, dt);
      return { ev: rider.ev };
    },
    // off the broom: it is put away (the play lays one where you stand)
    // the check’s bot flies it: rules/flight.js’s input, or null for the keys again
    drive(input) {
      driven = input;
    },
    off() {
      rider = null;
      driven = null;
      group.visible = false;
      wind.stop();
      if (feel?.setBaseFov) feel.setBaseFov(baseFov);
      else {
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
      }
    },
    group,
    dispose() {
      wind.stop();
      scene.remove(group);
      group.traverse((o) => o.geometry?.dispose?.());
    },
  };
}
