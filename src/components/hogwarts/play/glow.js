// The light a spell is made of, on the node renderer: cards (soft round
// glows, additive, every one a pool’s instance, so a whole trail is one
// draw), a bolt (a white-hot capsule in a sheath of its colour), a shield
// (a shimmering dome, its lines and a ripple where a bolt struck it), a
// flame (cards rising off a seat, and a light) and a figure of cards (the
// Patronus: a silhouette that runs). Everything over 1 in colour, so the
// house bloom haloes it; nothing in the fog, so a glow far off is still a glow.
//
//   createCards({ count, parent }) → { spawn(card), update(dt, camera), clear(), dispose() }
//   createBolt(colour) → { group, set(alpha), dispose() }
//   createDome({ radius, colour }) → { mesh, set({ alpha, ripple, at }), dispose() }
//   createLights(scene, n) → { take(), give(light), dispose() }: a fixed set,
//     so a light coming and going never changes how many the scene has (on
//     the node renderer that would rebuild every lit material)
//   createFigure(points, { parent, colour, size }) → { group, update(dt, camera, { gait, alpha }), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, dot, float, normalView, positionLocal, positionViewDirection, pow, smoothstep, uniform, uv, vec3 } from 'three/tsl';

// a soft round card’s colour: hot in the middle, nothing at the edge
function cardMaterial(gain = 2.4) {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const d = uv().sub(0.5).length().mul(2);
  const f = pow(smoothstep(1, 0, d), 1.8);
  m.colorNode = vec3(f.mul(gain));
  m.opacityNode = f;
  m.fog = false;
  return m;
}

export function createCards({ count = 256, parent = null } = {}) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), cardMaterial(), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 5;
  parent?.add(mesh);
  // each card: where, how fast, how long it has and had, how big, its colour
  const live = [];
  const free = [];
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  return {
    mesh,
    // { p: [x, y, z], v, life, size, grow (a second), colour: THREE.Color, drag, rise }
    spawn(c) {
      if (live.length >= count) live.shift();
      const card = free.pop() ?? {};
      card.p = [c.p[0], c.p[1], c.p[2]];
      card.v = c.v ? [c.v[0], c.v[1], c.v[2]] : [0, 0, 0];
      card.life = card.max = c.life ?? 0.5;
      card.size = c.size ?? 0.1;
      card.grow = c.grow ?? 0;
      card.colour = c.colour;
      card.drag = c.drag ?? 1.5;
      card.rise = c.rise ?? 0;
      live.push(card);
    },
    update(dt, camera) {
      let n = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const c = live[i];
        c.life -= dt;
        if (c.life <= 0) {
          free.push(c);
          live.splice(i, 1);
          continue;
        }
        const k = Math.exp(-c.drag * dt);
        c.v[0] *= k;
        c.v[1] = c.v[1] * k + c.rise * dt;
        c.v[2] *= k;
        c.p[0] += c.v[0] * dt;
        c.p[1] += c.v[1] * dt;
        c.p[2] += c.v[2] * dt;
      }
      const eye = camera.position;
      for (const c of live) {
        const age = 1 - c.life / c.max;
        // (a card by the eye is drawn smaller: at the wand’s tip, half a
        // metre off, a glow the size of one ten metres away fills the view)
        const near = Math.min(1, Math.max(0.2, Math.hypot(c.p[0] - eye.x, c.p[1] - eye.y, c.p[2] - eye.z) / 4));
        const size = c.size * (1 + c.grow * age) * near;
        // (in, then out: a card fades over the last two thirds of its life)
        const fade = Math.min(1, age * 8) * Math.min(1, (1 - age) * 1.5);
        m.compose(p.set(c.p[0], c.p[1], c.p[2]), camera.quaternion, s.set(size, size, size));
        mesh.setMatrixAt(n, m);
        mesh.instanceColor.setXYZ(n, c.colour.r * fade, c.colour.g * fade, c.colour.b * fade);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
    clear() {
      free.push(...live);
      live.length = 0;
      mesh.count = 0;
    },
    get alive() {
      return live.length;
    },
    dispose() {
      parent?.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose?.();
    },
  };
}

// a bolt: a white core and a sheath of its colour round it, along +z
export function createBolt(colour) {
  const group = new THREE.Group();
  const c = new THREE.Color(colour);
  const core = new MeshBasicNodeMaterial({ color: new THREE.Color(1, 1, 1).lerp(c, 0.25).multiplyScalar(4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  core.fog = false;
  const sheath = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const alpha = uniform(1);
  // (brighter at the rim, where the sheath is seen edge on)
  const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), 1.5);
  sheath.colorNode = vec3(c.r, c.g, c.b).mul(rim.mul(3).add(0.6)).mul(alpha);
  sheath.opacityNode = rim.mul(0.9).add(0.25).mul(alpha);
  sheath.fog = false;
  core.opacity = 1;
  const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.3, 4, 8).rotateX(Math.PI / 2), core);
  const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 4, 10).rotateX(Math.PI / 2), sheath);
  group.add(outer, inner);
  group.renderOrder = 6;
  return {
    group,
    set(a) {
      alpha.value = a;
      core.opacity = a;
    },
    dispose() {
      inner.geometry.dispose();
      outer.geometry.dispose();
      core.dispose();
      sheath.dispose();
    },
  };
}

// Protego: a dome of light round the caster, its lines faint, its rim
// bright, and a ripple running out from where a bolt struck it
export function createDome({ radius = 1.2, colour = '#cfe6ff' } = {}) {
  const c = new THREE.Color(colour);
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const alpha = uniform(0);
  const ripple = uniform(0); // the ripple’s radius on the dome, 0 to 2
  const at = uniform(new THREE.Vector3(0, 0, 1)); // where it was struck, a direction from the middle
  const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), 2.5);
  const u = uv();
  // (faint: from inside it the dome is all round you, and a bright grid would be a cage)
  const lines = pow(abs(u.x.mul(Math.PI * 36).sin()), 160).add(pow(abs(u.y.mul(Math.PI * 18).sin()), 160)).mul(0.07);
  // (the ripple: a ring at its radius round the struck point, in the dome’s own frame)
  const dist = positionLocal.normalize().sub(at).length();
  const ring = smoothstep(0.18, 0, abs(dist.sub(ripple))).mul(smoothstep(2, 0.6, ripple));
  const glow = rim.mul(1.2).add(lines).add(ring.mul(1.6)).add(0.035);
  m.colorNode = vec3(c.r, c.g, c.b).mul(glow).mul(alpha).mul(1.4);
  m.opacityNode = glow.mul(alpha).clamp(0, 1);
  m.fog = false;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 18), m);
  mesh.renderOrder = 7;
  mesh.visible = false;
  return {
    mesh,
    set({ alpha: a = 0, ripple: r = null, at: dirTo = null }) {
      alpha.value = a;
      mesh.visible = a > 0.001;
      if (r != null) ripple.value = r;
      if (dirTo) at.value.copy(dirTo).normalize();
    },
    dispose() {
      mesh.geometry.dispose();
      m.dispose();
    },
  };
}

export function createLights(scene, n = 4) {
  const all = [];
  const free = [];
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 8, 2);
    l.castShadow = false;
    scene.add(l);
    all.push(l);
    free.push(l);
  }
  return {
    take() {
      return free.pop() ?? null;
    },
    give(l) {
      if (!l) return;
      l.intensity = 0;
      if (!free.includes(l)) free.push(l);
    },
    dispose() {
      for (const l of all) scene.remove(l);
    },
  };
}

// A figure of cards: a silhouette’s points ({ x, y, leg }: metres, side
// on, facing +x; `leg` the hip a point swings about, or −1), stood up as
// a run along its group’s +z. Each point is a card with a little shimmer.
export function createFigure(shape, { parent = null, colour = '#e6f2ff', size = 0.07 } = {}) {
  const pts = shape.points;
  const n = pts.length;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), cardMaterial(2.8), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const c = new THREE.Color(colour);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const group = new THREE.Group();
  group.add(mesh);
  parent?.add(group);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  let t = 0;
  return {
    group,
    update(dt, camera, { gait = 0, alpha = 1 } = {}) {
      t += dt;
      // the cards face the camera: their turn in the group’s frame is the
      // camera’s with the group’s own taken off
      group.updateWorldMatrix(true, false);
      group.getWorldQuaternion(inv).invert();
      q.copy(inv).multiply(camera.quaternion);
      for (let i = 0; i < n; i++) {
        const pt = pts[i];
        let x = pt.x;
        let y = pt.y;
        if (pt.leg >= 0) {
          const hip = shape.hips[pt.leg];
          const a = Math.sin(gait + hip.phase) * hip.swing;
          const dx = x - hip.x;
          const dy = y - hip.y;
          x = hip.x + dx * Math.cos(a) - dy * Math.sin(a);
          y = hip.y + dx * Math.sin(a) + dy * Math.cos(a);
        }
        // side on along +z: the shape’s x is the run’s forward
        const shimmer = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7);
        const k = size * (0.7 + 0.5 * ((i * 7919) % 13) / 13);
        m.compose(p.set(pt.z ?? 0, y, x), q, s.set(k, k, k));
        mesh.setMatrixAt(i, m);
        const f = alpha * shimmer;
        mesh.instanceColor.setXYZ(i, c.r * f, c.g * f, c.b * f);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      parent?.remove(group);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose?.();
    },
  };
}
