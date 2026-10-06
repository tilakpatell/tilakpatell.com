// Blaster fire on the ground: your bolts (from your hand, along where the
// camera's looking, onto whatever's in the way first: a target, the
// ground, a wall) and theirs (at you, a little off), each a streak of light
// that flies and a flash where it lands.
//
// createBlaster({ parent, world }) → { fire(from, dir, targets, color, reach,
// muzzle) → what it'll hit ({ target, at } or null; `reach`: where something
// solid stops it first, if not its range; `muzzle`: where the bolt leaves
// from, if not `from`), enemy(from, to, spread), update(dt) →
// hits on you (damage), dispose() }

import * as THREE from 'three';
import { groundAt } from './walker';

const SPEED = 140; // m/s
const RANGE = 90;
const POOL = 32;

const scratch = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

// Whether the way from a to b passes within r of c across the ground, at a
// height within h of c's (a person: c their middle, r their girth, h half
// their height). Pure.
export function sweptHit(a, b, c, r, h = 1) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const len = dx * dx + dz * dz;
  const t = len > 0 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[2] - a[2]) * dz) / len)) : 0;
  const x = a[0] + dx * t - c[0];
  const z = a[2] + dz * t - c[2];
  const y = a[1] + (b[1] - a[1]) * t - c[1];
  return x * x + z * z < r * r && Math.abs(y) < h;
}

export function createBlaster({ parent, world }) {
  const group = new THREE.Group();
  group.name = 'bolts';
  parent.add(group);
  const geo = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6).rotateX(Math.PI / 2);
  const mats = new Map();
  const mat = (color) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    return mats.get(color);
  };
  const bolts = Array.from({ length: POOL }, () => {
    const m = new THREE.Mesh(geo, mat('#ff3b30'));
    m.visible = false;
    group.add(m);
    return { m, v: new THREE.Vector3(), life: 0, theirs: false, end: null };
  });
  // flashes where they land
  const flashGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const flashes = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0a0').multiplyScalar(3), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false;
    group.add(m);
    return { m, age: 9 };
  });
  let nb = 0;
  let nf = 0;
  const flash = (at) => {
    const f = flashes[nf++ % flashes.length];
    f.m.position.copy(at);
    f.age = 0;
    f.m.visible = true;
  };
  const shoot = (from, dir, color, theirs, end) => {
    const b = bolts[nb++ % POOL];
    b.m.material = mat(color);
    b.m.position.copy(from);
    b.v.copy(dir).normalize().multiplyScalar(SPEED);
    b.m.lookAt(from.clone().add(dir));
    b.m.visible = true;
    b.life = Math.min(RANGE, end ? from.distanceTo(end) : RANGE) / SPEED;
    b.theirs = theirs;
    b.end = end;
    return b;
  };

  // the first thing along a ray: a target (a sphere round its middle) or the ground
  const along = (from, dir, targets, reach = RANGE) => {
    const d = dir.clone().normalize();
    let best = null;
    let bestT = Math.min(RANGE, reach);
    const c = new THREE.Vector3();
    for (const t of targets) {
      const tall = (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1);
      c.copy(t.holder.position).add(new THREE.Vector3(0, tall * 0.55, 0));
      const rad = Math.max(0.45, tall * 0.35);
      const oc = c.clone().sub(from);
      const tc = oc.dot(d);
      if (tc < 0 || tc > bestT) continue;
      const miss = oc.lengthSq() - tc * tc;
      if (miss > rad * rad) continue;
      best = t;
      bestT = tc;
    }
    // the ground, in steps
    for (let s = 1; s < bestT; s += 1.5) {
      const p = from.clone().addScaledVector(d, s);
      if (p.y < groundAt(world, p.x, p.z, p.y)) {
        return { target: null, at: p };
      }
    }
    return best ? { target: best, at: from.clone().addScaledVector(d, bestT) } : { target: null, at: from.clone().addScaledVector(d, Math.min(RANGE, reach)) };
  };

  return {
    // yours: what it hits is decided now (along `dir` from `from`, your
    // eyes' line), and it flies there, from the gun's `muzzle` if it's given
    fire(from, dir, targets, color = '#ff3b30', reach = RANGE, muzzle = null) {
      const hit = along(from, dir, targets, reach);
      const start = muzzle ?? from;
      shoot(start, muzzle ? hit.at.clone().sub(start).normalize() : dir, color, false, hit.at);
      return hit;
    },
    // theirs, at `to` (a point on you), off by `spread`
    enemy(from, to, spread = 0.06, color = '#ff3b30', damage = 8) {
      const f = new THREE.Vector3(...from);
      const dir = to.clone().sub(f).normalize();
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread * 2;
      const b = shoot(f, dir.normalize(), color, true, null);
      b.damage = damage;
      b.target = to.clone();
    },
    // on with them; returns how hard you were hit this frame
    update(dt, you) {
      const last = scratch[0];
      const now = scratch[1];
      const body = scratch[2];
      let hurt = 0;
      for (const b of bolts) {
        if (!b.m.visible) continue;
        const p = b.m.position;
        last[0] = p.x;
        last[1] = p.y;
        last[2] = p.z;
        p.addScaledVector(b.v, dt);
        b.life -= dt;
        // theirs: through you on its way this frame (the whole of the way:
        // a bolt goes further in a frame than you are wide), it's a hit
        if (b.theirs && you) {
          body[0] = you.x;
          body[1] = you.y + 1;
          body[2] = you.z;
          now[0] = p.x;
          now[1] = p.y;
          now[2] = p.z;
          if (sweptHit(last, now, body, 0.55)) {
            hurt += b.damage ?? 8;
            b.life = 0;
          }
        }
        if (b.life <= 0) {
          b.m.visible = false;
          if (!b.theirs || hurt) flash(b.m.position);
        }
      }
      for (const f of flashes) {
        if (!f.m.visible) continue;
        f.age += dt;
        f.m.scale.setScalar(1 + f.age * 6);
        f.m.material.opacity = Math.max(0, 1 - f.age * 5);
        if (f.age > 0.2) f.m.visible = false;
      }
      return hurt;
    },
    dispose() {
      geo.dispose();
      flashGeo.dispose();
      for (const m of mats.values()) m.dispose();
      for (const f of flashes) f.m.material.dispose();
      group.removeFromParent();
    },
  };
}
