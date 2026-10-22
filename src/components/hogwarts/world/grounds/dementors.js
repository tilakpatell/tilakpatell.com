// The dementors at the shore (the design’s §4.8), drawn: rules/dementors.js
// says when they come and where they drift; this stands three figures
// there over the water, frosts the ground round you as the cold comes on,
// breathes on the sound bus, and hands the world the cold (for the house
// look’s shade, drained toward grey, and the walk’s pull). The figures are
// the made dementor (./dementorFigure.js, the stand-in only until its model
// is in); the Patronus lesson’s boggart takes its shape from here too.
//
//   makeDementor({ house, rt }) → a figure: { group, set({ t, fade, reach }), dispose() }
//   playNotes(rt) → the world’s three rising notes in D on the sound bus (the Patronus’s)
//   createDementors({ rt, scene, house, floorAt, shoreAt, reduced }) → {
//     step(dt, { week, day, hour, player: { x, z }, inside }) → events (rules/dementors.js’s),
//     patronus() (a Patronus was cast: it reaches them next step), cold, phase, state(), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { NOTES, newDementors, step as stepDementors } from '../../rules/dementors';
import { createDementorFigure } from './dementorFigure';

export const makeDementor = ({ house = null, rt = null } = {}) => createDementorFigure({ house, rt });

// the Patronus’s three notes, D, F sharp and A, rising and held: soft sines with a little shimmer
export function playNotes(rt) {
  const ac = rt?.audio?.context?.();
  const out = ac ? rt.audio.bus?.() : null;
  if (!ac || !out || ac.state === 'closed') return;
  const t0 = ac.currentTime + 0.05;
  NOTES.forEach(([hz, at], i) => {
    const last = i === NOTES.length - 1;
    const o = ac.createOscillator();
    const shimmer = ac.createOscillator();
    const depth = ac.createGain();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = hz;
    shimmer.frequency.value = 5.5;
    depth.gain.value = hz * 0.004;
    shimmer.connect(depth).connect(o.frequency);
    const t = t0 + at;
    const hold = last ? 1.8 : 0.5;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.06);
    g.gain.setValueAtTime(0.09, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0005, t + hold + 0.9);
    o.connect(g).connect(out);
    o.start(t);
    shimmer.start(t);
    o.stop(t + hold + 1);
    shimmer.stop(t + hold + 1);
  });
}

const FROST = { count: 160, near: 2.5, far: 16 };

// the frost: little white stars of ice laid on the ground round you, showing as the cold comes on
function createFrost(scene) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 0.05 : 0.17;
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const material = new MeshBasicNodeMaterial({ color: new THREE.Color(0.86, 0.93, 1), transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, material, FROST.count);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  // (where each lies about you, the same every time: a ring, thicker near)
  const spots = Array.from({ length: FROST.count }, (_, i) => {
    const a = i * 2.39996;
    const d = FROST.near + (FROST.far - FROST.near) * Math.sqrt(((i * 7919) % 1000) / 1000);
    return { a, d, s: 0.6 + ((i * 3571) % 100) / 100, turn: (i * 1.7) % (Math.PI * 2) };
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  return {
    set(cold, at, floorAt) {
      mesh.visible = cold > 0.02;
      material.opacity = Math.min(0.85, cold * 1.1);
      if (!mesh.visible) return;
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        // (the frost creeps in from the edge as the cold deepens)
        const show = cold > s.d / FROST.far - 0.15 ? 1 : 0;
        const x = at.x + Math.cos(s.a) * s.d;
        const z = at.z + Math.sin(s.a) * s.d;
        p.set(x, floorAt(x, z) + 0.03, z);
        q.setFromAxisAngle(up, s.turn);
        sc.setScalar(s.s * show * (0.5 + cold));
        mesh.setMatrixAt(i, m.compose(p, q, sc));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      material.dispose();
    },
  };
}

// the breath: a long rattling draw of air, low, now and then while they’re near
function createBreath(rt) {
  let next = 0;
  let buf = null;
  const noise = (ac) => {
    if (buf && buf.sampleRate === ac.sampleRate) return buf;
    buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x7fffffff) * 2 - 1;
    }
    return buf;
  };
  return {
    step(dt, cold) {
      next -= dt;
      if (cold < 0.12 || next > 0) return;
      next = 3.2 + Math.random() * 1.6;
      const ac = rt?.audio?.context?.();
      const out = ac ? rt.audio.bus?.() : null;
      if (!ac || !out || ac.state === 'closed') return;
      const t = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noise(ac);
      const band = ac.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 3.5;
      band.frequency.setValueAtTime(260, t);
      band.frequency.linearRampToValueAtTime(520, t + 1.6);
      // (the rattle: the breath’s loudness shaken a few times a second)
      const rattle = ac.createOscillator();
      rattle.frequency.value = 23;
      const depth = ac.createGain();
      depth.gain.value = 0.35;
      const g = ac.createGain();
      const peak = 0.05 + 0.12 * Math.min(1, cold);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.9);
      g.gain.linearRampToValueAtTime(0, t + 2.1);
      rattle.connect(depth).connect(g.gain);
      src.connect(band).connect(g).connect(out);
      src.start(t);
      src.stop(t + 2.2);
      rattle.start(t);
      rattle.stop(t + 2.2);
    },
  };
}

export function createDementors({ rt, scene, house, floorAt, shoreAt, reduced = false }) {
  let state = newDementors();
  let cast = false;
  let t = 0;
  const figures = [];
  const frost = createFrost(scene);
  const breath = createBreath(rt);
  const ensure = (n) => {
    while (figures.length < n) {
      const f = makeDementor({ house, rt });
      f.group.visible = false;
      scene.add(f.group);
      figures.push(f);
    }
  };

  return {
    patronus() {
      cast = true;
    },
    step(dt, { week, day, hour, player, inside = null }) {
      t += dt;
      // (indoors there’s no shore: they wait, and the cold lifts)
      const r = stepDementors(state, { dt, week, day, hour, player: inside ? null : player, shoreAt, patronus: cast });
      cast = false;
      state = r.state;
      ensure(state.list.length);
      figures.forEach((f, i) => {
        const d = state.list[i];
        if (!d) {
          f.group.visible = false;
          return;
        }
        const y = Math.max(floorAt(d.x, d.z), 0) + d.y + (reduced ? 0 : Math.sin(t * 0.9 + i) * 0.15);
        f.group.position.set(d.x, y, d.z);
        f.group.rotation.y = d.yaw;
        const near = player ? Math.hypot(player.x - d.x, player.z - d.z) : 99;
        f.set({ t, fade: d.fade, reach: Math.max(0, Math.min(1, (12 - near) / 8)) });
      });
      if (player) frost.set(state.cold, player, floorAt);
      breath.step(dt, state.cold);
      return r.events;
    },
    get cold() {
      return state.cold;
    },
    get phase() {
      return state.phase;
    },
    state: () => ({ phase: state.phase, cold: Math.round(state.cold * 100) / 100, list: state.list.map((d) => [Math.round(d.x), Math.round(d.z)]) }),
    dispose() {
      for (const f of figures) {
        scene.remove(f.group);
        f.dispose();
      }
      frost.dispose();
    },
  };
}
