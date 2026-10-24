// What a battle shoots to pieces, drawn (battleScene.js puts it in): a
// capital ship's part torn off its hull (its own meshes, galaxy/
// capitalParts.js) tumbling away on the blast's push; a capital broken in
// its sections drifting apart; and the shrapnel of everything that goes up,
// a fighter, a battery, a hull's plating, dark shards spinning out of the
// blast with a hot spark on each while it cools. The torn-off pieces are
// the ship's own meshes and materials, moved into a group of their own (no
// new shader: nothing compiles mid-fight); the shards are one instanced
// draw, in a standard material (`material`, its maker: the node twin hands
// in its node one).
//
// createDebris(parent, { count, material }) → { fling(meshes, { at, vel, spin, life })
//   → group, burst(at, { n, speed, size, hot }), update(dt), sparks(add),
//   pieces, clear(), dispose() }
// `at`, `vel`: the parent's space (the map's); a flung group turns about
// its own middle (`at`), so give it the part's middle. sparks(add) hands
// each hot shard to `add(pos, colour, size)` (the scene's engine glows).

import * as THREE from 'three';

// how a shard cools: hot white-orange to nothing over its first second and a half
const HOT = [3.2, 1.6, 0.6];
const COOL = 1.5;
// how long a torn-off piece is kept before it's let go (shrinking away over its last FADE)
const FADE = 3;

export function createDebris(parent, { count = 160, material = (o) => new THREE.MeshStandardMaterial(o) } = {}) {
  const flung = [];
  // the shards: thin plates, a unit long, scaled to each
  const geo = new THREE.BoxGeometry(1, 0.18, 0.62);
  const mat = material({ color: '#5d6168', roughness: 0.7, metalness: 0.55 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  parent.add(mesh);
  const shards = Array.from({ length: count }, () => ({ on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0), spin: 0, size: 1, age: 0, life: 0, hot: true }));
  let next = 0;
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const dq = new THREE.Quaternion();
  const randomUnit = (out) => {
    do out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    while (out.lengthSq() > 1 || out.lengthSq() < 1e-4);
    return out.normalize();
  };

  return {
    // a part's meshes, flung: out of wherever they are into a group of
    // their own at `at`, drifting on `vel`, turning `spin` radians a second
    fling(meshes, { at, vel, spin = 0.25, life = 40 }) {
      const g = new THREE.Group();
      g.position.set(at.x, at.y, at.z);
      parent.add(g);
      for (const o of meshes) {
        o.visible = true;
        g.attach(o);
      }
      flung.push({ g, vel: new THREE.Vector3(vel.x, vel.y, vel.z), axis: randomUnit(new THREE.Vector3()), spin, age: 0, life });
      return g;
    },
    // `n` shards out of a blast at `at`, at up to `speed` units a second, `size` long
    burst(at, { n = 8, speed = 6, size = 0.3, hot = true } = {}) {
      for (let i = 0; i < n; i++) {
        const o = shards[next];
        next = (next + 1) % count;
        o.on = true;
        o.pos.set(at.x, at.y, at.z);
        randomUnit(o.vel).multiplyScalar(speed * (0.35 + Math.random() * 0.65));
        o.q.setFromAxisAngle(randomUnit(o.axis), Math.random() * Math.PI * 2);
        randomUnit(o.axis);
        o.spin = (Math.random() - 0.5) * 12;
        o.size = size * (0.4 + Math.random() * 0.8);
        o.age = 0;
        o.life = 4 + Math.random() * 4;
        o.hot = hot;
      }
    },
    update(dt) {
      for (let i = flung.length - 1; i >= 0; i--) {
        const f = flung[i];
        f.age += dt;
        f.g.position.addScaledVector(f.vel, dt);
        f.g.rotateOnAxis(f.axis, f.spin * dt);
        if (f.age > f.life - FADE) f.g.scale.setScalar(Math.max(0.001, (f.life - f.age) / FADE));
        if (f.age >= f.life) {
          f.g.removeFromParent();
          flung.splice(i, 1);
        }
      }
      let n = 0;
      for (const o of shards) {
        if (!o.on) continue;
        o.age += dt;
        if (o.age >= o.life) {
          o.on = false;
          continue;
        }
        o.pos.addScaledVector(o.vel, dt);
        o.q.multiply(dq.setFromAxisAngle(o.axis, o.spin * dt));
        const k = o.size * Math.min(1, (o.life - o.age) / 1.2);
        mesh.setMatrixAt(n++, m.compose(o.pos, o.q, s.set(k, k, k)));
      }
      mesh.count = n;
      if (n) mesh.instanceMatrix.needsUpdate = true;
    },
    // each shard still hot: a spark on it, cooling
    sparks(add) {
      for (const o of shards) {
        if (!o.on || !o.hot || o.age >= COOL) continue;
        const k = 1 - o.age / COOL;
        add(o.pos, [HOT[0] * k, HOT[1] * k, HOT[2] * k], o.size * 0.9 * k);
      }
    },
    // how many torn-off pieces are in flight (and the groups, for the scene's fires to burn on)
    get pieces() {
      return flung.map((f) => f.g);
    },
    clear() {
      for (const f of flung) f.g.removeFromParent();
      flung.length = 0;
      for (const o of shards) o.on = false;
      mesh.count = 0;
    },
    dispose() {
      this.clear();
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}
