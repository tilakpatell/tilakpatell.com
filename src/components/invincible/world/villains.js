// The villains (./foes.js), drawn:
// - the portal over the river, a whirl of purple that opens when the
//   Flaxans come and closes when they're beaten;
// - the Flaxans themselves, small and armoured, built on the HQ kit as
//   Think, Mark! builds them (aiming their arms at Mark, tumbling when
//   knocked out), and the elites, bigger, with gold on them;
// - the Maulers and Doc Seismic, the cast's figures (../cast.js) on their
//   own motion-captured clips;
// - the bolts with a trail, the cars a Mauler throws (tumbling, a trail of
//   dust behind), and Doc Seismic's quake rings along the ground with a
//   skirt of dust;
// - the flashes when they come through, fire and are hit.

import * as THREE from 'three';
import { hot } from '../../avengers/hq/stage';
import { buildHumanoid, poseHumanoid } from '../../avengers/hq/kit/humanoid';
import { POSES, figure } from '../../../lib/three/rig';
import { CAST } from '../cast';
import { FIGHT, KINDS, PORTAL, portalOpen } from './foes';
import { carGeometry } from './life';
import { castMaterial } from './people';

const FLAX = 0xd04dff;
const QUAKE = 0xc9a46a; // (the dust of the school's quad)
// the rings' colours: the quake's dust, lit; Mark's own blue for his ground pound
const QUAKE_HOT = hot(QUAKE, 1.4);
const POUND = hot(0x3f8cff, 1.6);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);

function portalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float r = length(vUv) / max(0.001, uOpen);
        if (r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float s = a - uTime * 0.6 + 2.2 / (r + 0.3);
        float n = noise(vec2(cos(s), sin(s)) * 3.0 + r * 5.0 - uTime * 0.5) * 0.65 + noise(vec2(s * 2.0, r * 9.0 - uTime)) * 0.35;
        vec3 col = mix(vec3(0.03, 0.0, 0.06), mix(vec3(0.35, 0.05, 0.6), vec3(1.6, 0.6, 2.0), n * n), smoothstep(0.1, 0.95, r) * (0.3 + n * 0.7));
        float rim = smoothstep(0.75, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        col += vec3(1.8, 0.7, 2.4) * rim * (1.6 + n * 2.0);
        gl_FragColor = vec4(col, smoothstep(1.0, 0.93, r));
      }`,
  });
}

// templates: { mauler, seismic } as ../../../lib/three/rig's loadFigure gives
// them (null if one didn't load: the kit's figure stands in)
export function createVillains(scene, vfx, { calm = false, templates = {}, rim = 0.35 } = {}) {
  const group = new THREE.Group();
  group.name = 'villains';
  scene.add(group);

  // the portal, facing downtown
  const portal = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r, 72), portalMaterial());
  portal.position.set(...PORTAL.p);
  portal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(PORTAL.n));
  portal.renderOrder = 4;
  portal.visible = false;
  group.add(portal);
  let open = 0;

  // the Flaxans: small, armoured, purple, something glowing on their arms
  // (an elite bigger, its armour trimmed in gold)
  const mats = {
    flaxan: {
      armour: new THREE.MeshStandardMaterial({ color: 0x4b3a78, metalness: 0.65, roughness: 0.38 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x8b8fa8, roughness: 0.65 }),
      glow: new THREE.MeshBasicMaterial({ color: hot(FLAX, 2.6), toneMapped: false }),
    },
    flaxanElite: {
      armour: new THREE.MeshStandardMaterial({ color: 0x5a3f1e, metalness: 0.8, roughness: 0.3 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x8b8fa8, roughness: 0.65 }),
      glow: new THREE.MeshBasicMaterial({ color: hot(0xffb84d, 2.6), toneMapped: false }),
    },
  };
  const casts = [];
  const make = {
    flaxan: () => kitFoe(mats.flaxan, 0.74),
    flaxanElite: () => kitFoe(mats.flaxanElite, 0.92),
    mauler: () => castFoe('mauler'),
    seismic: () => castFoe('seismic'),
  };
  function kitFoe(m, scale) {
    const h = buildHumanoid({ style: 'chitauri', materials: m, scale });
    const holder = new THREE.Group();
    h.root.position.y = -0.95 * scale; // the hips at the holder
    holder.add(h.root);
    group.add(holder);
    return { h, holder, spin: 0 };
  }
  function castFoe(kind) {
    const t = templates[kind];
    if (!t) {
      // (no model: the kit's figure, the Mauler's blue-grey, Doc Seismic's brown)
      const v = kitFoe({ armour: new THREE.MeshStandardMaterial({ color: kind === 'mauler' ? 0x5d7488 : 0x6b4a2e, roughness: 0.6 }), skin: new THREE.MeshStandardMaterial({ color: 0x8aa0b0, roughness: 0.7 }), glow: new THREE.MeshBasicMaterial({ color: 0xffffff }) }, KINDS[kind].h / 1.8);
      v.kit = true;
      return v;
    }
    const f = figure(t, CAST[kind]);
    f.snap(POSES.stand);
    group.add(f.holder);
    casts.push(castMaterial(f.model, { rim }));
    return { f, holder: f.holder, spin: 0, was: null };
  }
  // one drawn for each of a kind standing (or falling): made as they're
  // needed, handed out in the foes' order each frame
  const pools = { flaxan: [], flaxanElite: [], mauler: [], seismic: [] };

  // their bolts
  const MAX = 64;
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: hot(FLAX, 3.2), toneMapped: false }), MAX);
  bolts.frustumCulled = false;
  bolts.count = 0;
  group.add(bolts);
  const m4 = new THREE.Matrix4();

  // the thrown cars: a saloon, tumbling
  const carMat = new THREE.MeshStandardMaterial({ color: 0x8a2a22, vertexColors: true, roughness: 0.38, metalness: 0.35 });
  const carGeo = carGeometry(0);
  const cars = [];
  const carOf = (i) => {
    while (cars.length <= i) {
      const m = new THREE.Mesh(carGeo, carMat);
      m.castShadow = true;
      group.add(m);
      cars.push(m);
    }
    return cars[i];
  };

  // the quake rings: a flat band along the ground, its dust thrown up as it goes
  const ringGeo = new THREE.RingGeometry(0.92, 1, 96, 1).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: hot(QUAKE, 1.4), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const rings = [];
  const ringOf = (i) => {
    while (rings.length <= i) {
      const m = new THREE.Mesh(ringGeo, ringMat.clone());
      m.renderOrder = 3;
      group.add(m);
      rings.push(m);
    }
    return rings[i];
  };
  let dust = 0;

  const chest = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const roll = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  // a figure from the cast, in the foe's state
  function act(v, e, dt, t) {
    const f = v.f;
    const moving = Math.hypot(e.v[0], e.v[2]) > 1;
    if (e.kind === 'mauler') {
      // (in his hands, or thrown from them: the hit clip, held)
      const clip = { swing: 'swing', throw: 'throw', stagger: 'hit', held: 'hit', thrown: 'hit', ko: 'down', down: 'down' }[e.state] ?? (moving ? 'charge' : 'idle');
      const once = clip !== 'idle' && clip !== 'charge';
      if (!f.act(clip, { once, fade: 0.15 })) f.pose(moving ? POSES.stride(t * 1.6, 1, 1) : e.state === 'swing' ? POSES.punch([0, 0.2, 1]) : POSES.stand, dt, 14);
    } else {
      const clip = { stagger: 'hit', ko: 'down', down: 'down' }[e.state] ?? (e.quakeT > 0 ? 'quake' : e.blastT > 0 ? 'blast' : 'hover');
      const once = clip !== 'hover';
      if (!f.act(clip, { once, fade: 0.2 }) && !f.act('idle')) f.pose(POSES.hover(t), dt, 9);
    }
    f.tick(dt);
  }

  // what a quake or a blast was, a moment ago (for Doc Seismic's clips)
  const lately = new Map();

  return {
    group,
    // what just happened, as flashes, sparks and dust
    fx(e) {
      if (e.type === 'spawn') vfx.ring(V(e.at), { color: FLAX, from: 0.5, to: 5, life: 0.4, normal: V(PORTAL.n) });
      else if (e.type === 'ko' || e.type === 'hit') {
        const flax = e.kind === 'flaxan' || e.kind === 'flaxanElite';
        const col = flax ? FLAX : 0xffd27a;
        vfx.sparks(V(e.at), { count: e.type === 'ko' ? 34 : 18, speed: 16, color: 0xffe6ff, to: col, dir: V(e.dir), spread: 0.7, life: 0.6 });
        if (e.type === 'ko') {
          vfx.debris(V(e.at), { count: 8, speed: 12, size: 0.14, dir: V(e.dir), spread: 0.6, color: flax ? 0x4b3a78 : 0x5d7488 });
          vfx.flash(V(e.at), { color: flax ? 0xe7a6ff : 0xffe2b0, intensity: 25, distance: 18, life: 0.15 });
        }
        vfx.ring(V(e.at), { color: 0xffffff, from: 0.3, to: e.type === 'ko' ? 4 : 2.5, life: 0.25, normal: V(e.dir) });
      } else if (e.type === 'down') vfx.smoke(V(e.at), { size: 1.6, count: 3, life: 1.6, color: e.kind === 'mauler' ? 0x8a8070 : 0x6a4a8a, to: 0x9a8aa8, rise: 1 });
      else if (e.type === 'hurt') vfx.sparks(V(e.at), { count: 22, speed: 9, color: 0xffffff, to: e.by === 'car' || e.by === 'mauler' ? 0xffb070 : FLAX, life: 0.4 });
      else if (e.type === 'won') vfx.ring(V(PORTAL.p), { color: FLAX, from: PORTAL.r, to: PORTAL.r * 3, life: 0.9, normal: V(PORTAL.n) });
      else if (e.type === 'carHit' || e.type === 'carDown') {
        vfx.debris(V(e.at), { count: 14, speed: 10, size: 0.22, color: 0x8a2a22, spread: 1 });
        vfx.smoke(V(e.at), { size: 2.2, count: 4, life: 1.4, color: 0x8a8070, to: 0xb0a898, rise: 1.2 });
      } else if (e.type === 'carAway') vfx.flash(V(e.at), { color: 0xffffff, intensity: 18, distance: 14, life: 0.12 });
      else if (e.type === 'swing' && e.hit) vfx.ring(V(e.at), { color: 0xffe2b0, from: 0.5, to: 3, life: 0.2, normal: UP });
      else if (e.type === 'quake' || e.type === 'blast') {
        lately.set(e.id, { ...(lately.get(e.id) ?? {}), [e.type]: 0.9 });
        if (e.type === 'quake') vfx.ring(V(e.at).add(new THREE.Vector3(0, 0.3, 0)), { color: QUAKE, from: 1, to: 14, life: 0.6, normal: UP });
        else vfx.sparks(V(e.at), { count: 30, speed: 24, color: 0xfff0c0, to: QUAKE, dir: V(e.dir), spread: 0.35, life: 0.5 });
      }
    },
    update(f, dt, t, hero) {
      // the portal opens with the invasion, and closes after it
      const want = portalOpen(f) ? 1 : 0;
      open += (want - open) * (1 - Math.exp(-(want ? 1.5 : 3) * dt));
      portal.visible = open > 0.01;
      portal.material.uniforms.uOpen.value = open;
      portal.material.uniforms.uTime.value = t;
      chest.set(hero.p[0], hero.p[1] + 1, hero.p[2]);

      const used = { flaxan: 0, flaxanElite: 0, mauler: 0, seismic: 0 };
      for (const e of f.foes) {
        const kind = e.kind ?? 'flaxan';
        // the Flaxans go once they're down; the Maulers and Doc Seismic lie there till it's over
        const show = e.state !== 'waiting' && (e.state !== 'down' || (f.on && !kind.startsWith('flaxan')));
        if (!show) continue;
        const pool = pools[kind];
        const i = used[kind]++;
        if (!pool[i]) pool[i] = make[kind]();
        const v = pool[i];
        v.holder.visible = true;
        if (v.f) {
          v.holder.position.set(e.p[0], e.p[1] + v.f.hipHeight, e.p[2]);
          v.holder.rotation.set(0, e.yaw ?? 0, 0);
          const l = lately.get(e.id);
          if (l) for (const k of Object.keys(l)) l[k] = Math.max(0, l[k] - dt);
          act(v, { ...e, kind, quakeT: l?.quake ?? 0, blastT: l?.blast ?? 0 }, dt, t);
        } else if (kind === 'flaxan' || kind === 'flaxanElite' || v.kit) {
          v.holder.position.set(e.p[0], e.p[1] + (v.kit ? KINDS[kind].h * 0.53 : 0), e.p[2]);
          if (e.state === 'ko' || e.state === 'thrown') {
            v.spin += dt * 9;
            v.holder.rotation.set(v.spin, v.spin * 0.6, 0);
            poseHumanoid(v.h, { t, mode: 'hover', flinch: 1 });
          } else {
            // facing him, arm up at him when he's in range
            pos.copy(chest).sub(v.holder.position);
            v.holder.rotation.set(0, Math.atan2(pos.x, pos.z), 0);
            poseHumanoid(v.h, { t: t + i, mode: v.kit && kind === 'mauler' ? 'idle' : 'hover', aim: pos.length() < FIGHT.range ? 1 : 0.3, lean: Math.min(1, Math.hypot(...e.v) / 20) * 0.6 });
          }
        }
      }
      for (const k of Object.keys(pools)) for (let i = used[k]; i < pools[k].length; i++) pools[k][i].holder.visible = false;

      bolts.count = Math.min(MAX, f.bolts.length);
      for (let i = 0; i < bolts.count; i++) {
        const b = f.bolts[i];
        bolts.setMatrixAt(i, m4.makeTranslation(...b.p));
        if (!calm) vfx.trail(V(b.p), { size: 0.75, life: 0.25, color: 0xe070ff, to: 0x300060, a: 0.7 });
      }
      bolts.instanceMatrix.needsUpdate = true;

      // the cars: over his head, then tumbling at Mark
      const list = f.cars ?? [];
      list.forEach((c, i) => {
        const m = carOf(i);
        m.visible = true;
        m.position.set(c.p[0], c.p[1] - 0.8, c.p[2]);
        if (c.held != null) m.rotation.set(0, t * 0.5, Math.PI); // (held up, wheels to the sky)
        else {
          axis.set(c.v[2], 0, -c.v[0]).normalize();
          m.quaternion.multiply(roll.setFromAxisAngle(axis, dt * 5));
          if (!calm) vfx.trail(V(c.p), { size: 1.4, life: 0.4, color: 0xb0a898, to: 0x605850, a: 0.5 });
        }
      });
      for (let i = list.length; i < cars.length; i++) cars[i].visible = false;

      // a thrown one's trail through the air
      if (!calm) for (const e of f.foes) if (e.state === 'thrown') vfx.trail(V([e.p[0], e.p[1] + 1, e.p[2]]), { size: 1.6, life: 0.4, color: 0xd8d0c0, to: 0x707070, a: 0.5 });

      // the quake rings, and the dust they throw up (and after them his ground pound's, in his blue)
      const qs = [...(f.rings ?? []), ...(f.pounds ?? []).map((q) => ({ ...q, pound: true }))];
      dust += dt;
      qs.forEach((q, i) => {
        const m = ringOf(i);
        m.visible = true;
        m.position.set(q.at[0], q.at[1] + 0.25, q.at[2]);
        m.scale.setScalar(Math.max(0.1, q.r));
        m.material.opacity = 0.85 * (1 - q.r / (q.pound ? q.to : KINDS.seismic.ringTo));
        m.material.color.set(q.pound ? POUND : QUAKE_HOT);
      });
      if (!calm && dust > 0.12 && qs.length) {
        dust = 0;
        for (const q of qs) {
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + t;
            vfx.smoke(V([q.at[0] + Math.cos(a) * q.r, q.at[1] + 0.5, q.at[2] + Math.sin(a) * q.r]), { size: 2.4, count: 1, life: 0.9, color: QUAKE, to: 0xb8a888, rise: 2 });
          }
        }
      }
      for (let i = qs.length; i < rings.length; i++) rings[i].visible = false;
    },
    dispose() {
      for (const c of casts) c.dispose();
      carGeo.dispose();
      ringGeo.dispose();
    },
  };
}
