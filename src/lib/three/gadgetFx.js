// What Rick's other two guns do to someone they kill. The freeze ray: they
// stop dead where they stand, frost takes them and ice grows up round them
// from the feet, and a second and a half later it all shatters, the shards
// thrown out across the ground, skittering, melting away. The shrink ray:
// a pink flash, and they shrink to a tenth of themselves in half a second,
// wobbling all the way down; a hop or two on the spot, a squeak, and a pop.
// World-agnostic, like portalFx.js: the universe map's foot combat and the
// galaxy's worlds both draw it.
// The skill tree's guns have theirs too. The Amban rifle: a flash through
// them, white-blue, and they're gone in motes of light rising. The particle
// beam: an ember glow through them, then dark, and they crumble to ash that
// falls. The repulsor gauntlet: thrown back off their feet, turning over in
// the air, down on their back a way off, and gone a moment later.
//
// createGadgetFx({ parent }) → { freeze(opts), shrink(opts), light(opts), thrown(opts), update(dt), count, dispose }
//   parent: the Object3D the effects go under; every figure must be a child
//     of it (positions are in its space, sizes in its units).
//   freeze({ root, tall, up, push, seed, on }) → handle
//     root: the figure's Object3D (its origin at the feet); tall: its
//     height; up: the ground's normal (unit, `parent`'s space); push: the
//     way the shot went (the shards fly mostly that way); on(event):
//     'shatter'. handle: { done, shards() (the debris' places, the ice's
//     own space: y up from the feet), dispose() }.
//   shrink({ root, tall, up, seed, on }) → handle; on: 'squeak', 'pop'.
//   light({ root, tall, up, ash, seed, on }) → handle (ash: the beam's, else the Amban's); on: 'gone'.
//   thrown({ root, tall, up, push, seed, on }) → handle; on: 'land'.
//   update(dt): once a frame. A handle owns the root from the moment it's
//     made (the caller stops posing it); dispose() puts back its materials,
//     scale and visibility.

import * as THREE from 'three';

const V = THREE.Vector3;
const FREEZE = { frost: 0.35, grow: 0.45, hold: 1.5, shake: 0.28, fly: 1.35 };
const SHRINK = { down: 0.5, to: 0.1, squeak: 0.52, pop: 1.15, fade: 0.45 };
const LIGHT = { flash: 0.12, gone: 0.45, motes: 0.9 }; // seconds: the flash through them, till they're gone, the motes' drift
const THROWN = { speed: 9, lift: 4.5, rest: 1.1, fade: 0.4 }; // m/s out and up, seconds down before they go
const PALE = new THREE.Color('#d8f0ff');
const EMBER = new THREE.Color('#ff7a2a');
const SOOT = new THREE.Color('#2a2420');
const ICE = new THREE.Color('#cdeeff');
const ICE_GLOW = new THREE.Color('#2f86ff');
const PINK = new THREE.Color('#ff4fd8');
const CRYSTALS = 22;
const SHARDS = 26;

const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const back = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; // (overshoots, then settles)
const clamp01 = (k) => Math.min(1, Math.max(0, k));

// a seeded stream, so a kill looks the same each time it's drawn from the same seed
const stream = (seed) => {
  let s = Math.floor(seed * 1e6) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

const softDot = () => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// a rough block of ice, its base at the origin: a cylinder of a few sides,
// its corners pushed about, flat-shaded so each face catches the light
const iceBlock = (rand) => {
  const g = new THREE.CylinderGeometry(0.85, 1, 1, 7, 3, false).translate(0, 0.5, 0);
  const p = g.attributes.position;
  const seen = new Map(); // (the seam's twin corners move together)
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [1 + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.08]);
    const [r, y] = seen.get(key);
    p.setXYZ(i, p.getX(i) * r, Math.max(0, p.getY(i) + (p.getY(i) > 0.01 && p.getY(i) < 0.99 ? y : 0)), p.getZ(i) * r);
  }
  g.computeVertexNormals();
  return g.toNonIndexed();
};

export function createGadgetFx({ parent }) {
  const crystal = new THREE.OctahedronGeometry(1, 0).scale(0.28, 1, 0.28);
  const shard = new THREE.TetrahedronGeometry(1, 0);
  const ring = new THREE.TorusGeometry(1, 0.06, 6, 40).rotateX(Math.PI / 2);
  const dot = softDot();
  const live = new Set();

  // the figure's materials, copied so only this figure changes, and put back
  const swapMaterials = (root, make) => {
    const swapped = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const own = (m) => {
        if (!swapped.has(m)) swapped.set(m, make(m.clone(), m));
        return swapped.get(m);
      };
      o.userData.gadgetMat = o.material;
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    });
    return {
      list: [...swapped.values()],
      restore() {
        root.traverse((o) => {
          if (o.userData.gadgetMat) {
            o.material = o.userData.gadgetMat;
            delete o.userData.gadgetMat;
          }
        });
        for (const m of swapped.values()) m.dispose();
        swapped.clear();
      },
    };
  };

  // a frame at the feet with +y up the ground's normal and +z the push
  const frameAt = (root, up, push) => {
    const U = up.clone().normalize();
    const P = (push ?? new V(0, 0, 1)).clone().addScaledVector(U, -(push ?? new V(0, 0, 1)).dot(U));
    if (P.lengthSq() < 1e-6) P.set(1, 0, 0).addScaledVector(U, -U.x);
    P.normalize();
    const X = new V().crossVectors(U, P);
    const g = new THREE.Group();
    g.position.copy(root.position);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, U, P));
    parent.add(g);
    return g;
  };

  const sprites = (g, n, color, owned) => {
    if (!dot) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: dot, color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true, opacity: 0 });
      owned.push(m);
      const s = new THREE.Sprite(m);
      s.visible = false;
      g.add(s);
      out.push(s);
    }
    return out;
  };

  function freeze({ root, tall, up, push, seed = Math.random() * 10, on = null }) {
    if (!root || !tall) return null;
    const rand = stream(seed);
    const owned = [];
    const m = tall / 1.8; // (a metre, where they stand)
    const start = root.position.clone();
    const mats = swapMaterials(root, (c) => {
      c.userData.from = { color: c.color?.clone(), rough: c.roughness, metal: c.metalness };
      if (c.emissive) c.emissive = c.emissive.clone();
      return c;
    });
    const g = frameAt(root, up, push);

    const iceMat = new THREE.MeshStandardMaterial({ color: ICE, emissive: ICE_GLOW, emissiveIntensity: 0.3, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.82, flatShading: true });
    const shellMat = new THREE.MeshStandardMaterial({ color: ICE, emissive: ICE_GLOW, emissiveIntensity: 0.18, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, flatShading: true });
    owned.push(iceMat, shellMat);
    // the block they're shut in, grown up from the feet
    const blockGeo = iceBlock(rand);
    owned.push(blockGeo);
    const shell = new THREE.Mesh(blockGeo, shellMat);
    shell.scale.set(0.3 * tall, 0.0001, 0.27 * tall);
    shell.renderOrder = 3;
    g.add(shell);
    // the crystals bristling out of it, the low ones first
    const pieces = [];
    for (let i = 0; i < CRYSTALS; i++) {
      const h = Math.pow(i / CRYSTALS, 0.8) * 0.95;
      const a = rand() * Math.PI * 2;
      const r = (0.2 + rand() * 0.1) * tall * (1 - h * 0.25);
      const o = new THREE.Mesh(crystal, iceMat);
      o.position.set(Math.cos(a) * r, h * tall, Math.sin(a) * r);
      const out = new V(Math.cos(a), 0.4 + rand() * 0.8, Math.sin(a)).normalize();
      o.quaternion.setFromUnitVectors(new V(0, 1, 0), out);
      o.userData = { len: (0.1 + rand() * 0.16) * tall, at: 0.04 + h * FREEZE.grow + rand() * 0.06 };
      o.scale.setScalar(0.0001);
      g.add(o);
      pieces.push(o);
    }
    // and what's left of it all once it goes: more shards, from inside
    const debris = [];
    const mist = sprites(g, 8, '#dff4ff', owned);
    const glints = sprites(g, 12, '#bfe6ff', owned);
    let t = 0;
    let shattered = false;
    const shatter = () => {
      shattered = true;
      on?.('shatter');
      root.visible = false;
      shell.visible = false;
      const fly = (o, size) => {
        const a = rand() * Math.PI * 2;
        const out = new V(Math.cos(a), 0, Math.sin(a)).multiplyScalar((1.6 + rand() * 3.4) * m);
        out.z += (1 + rand() * 2.4) * m; // (mostly the way the shot went)
        o.userData.vel = out.setY((1.2 + rand() * 3.2) * m);
        o.userData.spin = new V(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        o.userData.rate = 6 + rand() * 14;
        o.userData.size = size;
        debris.push(o);
      };
      for (const o of pieces) fly(o, o.scale.clone());
      for (let i = 0; i < SHARDS; i++) {
        const o = new THREE.Mesh(shard, iceMat);
        o.position.set((rand() - 0.5) * 0.4 * tall, (0.05 + rand() * 0.9) * tall, (rand() - 0.5) * 0.3 * tall);
        o.quaternion.setFromAxisAngle(new V(rand(), rand(), rand()).normalize(), rand() * 6);
        o.scale.setScalar((0.03 + rand() * 0.06) * tall);
        g.add(o);
        fly(o, o.scale.clone());
      }
      glints.forEach((s, i) => {
        s.userData = { from: new V((rand() - 0.5) * 0.3 * tall, (0.2 + rand() * 0.7) * tall, (rand() - 0.5) * 0.3 * tall), vel: new V(rand() - 0.5, rand() * 0.8, rand() - 0.5).multiplyScalar(3 * m), at: i * 0.012 };
      });
    };

    const h = {
      done: false,
      shards: () => debris.map((o) => o.position.clone()),
      step(dt) {
        if (this.done) return;
        t += dt;
        // the frost: the figure's colour goes to ice, shiny and lit from within
        const f = easeOut(clamp01(t / FREEZE.frost));
        for (const c of mats.list) {
          const from = c.userData.from;
          if (from.color) c.color.copy(from.color).lerp(ICE, f * 0.75);
          if ('roughness' in c) c.roughness = from.rough + (0.1 - from.rough) * f;
          if ('metalness' in c) c.metalness = from.metal + (0.25 - from.metal) * f;
          if (c.emissive) c.emissive.copy(ICE_GLOW).multiplyScalar(0.22 * f);
        }
        if (!shattered) {
          shell.scale.y = Math.max(0.0001, 1.08 * tall * easeOut(clamp01((t - 0.05) / FREEZE.grow)));
          for (const o of pieces) {
            const k = clamp01((t - o.userData.at) / 0.18);
            o.scale.setScalar(Math.max(0.0001, o.userData.len * back(k)));
          }
          // the creak before it goes
          const shake = clamp01((t - (FREEZE.hold - FREEZE.shake)) / FREEZE.shake);
          const j = shake * shake * 0.012 * tall;
          root.position.copy(start).add(new V((rand() - 0.5) * j, 0, (rand() - 0.5) * j));
          g.position.copy(root.position);
          if (t >= FREEZE.hold) shatter();
        } else {
          const s = t - FREEZE.hold;
          const grav = 9.8 * m;
          for (const o of debris) {
            const d = o.userData;
            d.vel.y -= grav * dt;
            o.position.addScaledVector(d.vel, dt);
            if (o.position.y < 0) {
              // a bounce off the ground, skittering on
              o.position.y = 0;
              d.vel.y = Math.abs(d.vel.y) * 0.28;
              d.vel.x *= 0.62;
              d.vel.z *= 0.62;
              d.rate *= 0.6;
            }
            o.rotateOnAxis(d.spin, d.rate * dt);
            o.scale.copy(d.size).multiplyScalar(Math.max(0.0001, 1 - clamp01((s - FREEZE.fly + 0.5) / 0.5))); // (melting)
          }
          for (const sp of glints) {
            const d = sp.userData;
            const k = (s - d.at) / 0.5;
            sp.visible = k > 0 && k < 1;
            if (!sp.visible) continue;
            sp.position.copy(d.from).addScaledVector(d.vel, k * 0.5);
            sp.scale.setScalar(0.07 * tall * (1 - k * 0.5));
            sp.material.opacity = 1 - k;
          }
          if (s >= FREEZE.fly) {
            this.done = true;
            for (const o of debris) o.visible = false;
          }
        }
        // the cold coming off them, low round the feet
        mist.forEach((sp, i) => {
          const k = ((t * 0.7 + i / mist.length) % 1);
          const showing = t < FREEZE.hold + 0.6;
          sp.visible = showing;
          if (!showing) return;
          const a = (i / mist.length) * Math.PI * 2 + t * 0.4;
          sp.position.set(Math.cos(a) * 0.3 * tall * (0.6 + k), 0.06 * tall + k * 0.25 * tall, Math.sin(a) * 0.3 * tall * (0.6 + k));
          sp.scale.setScalar((0.25 + k * 0.35) * tall);
          sp.material.opacity = 0.22 * Math.sin(k * Math.PI) * clamp01(t / 0.3);
        });
      },
      dispose() {
        live.delete(h);
        parent.remove(g);
        mats.restore();
        root.position.copy(start);
        root.visible = true;
        for (const o of owned) o.dispose();
      },
    };
    live.add(h);
    return h;
  }

  function shrink({ root, tall, up, seed = Math.random() * 10, on = null }) {
    if (!root || !tall) return null;
    const rand = stream(seed);
    const owned = [];
    const start = { at: root.position.clone(), scale: root.scale.clone() };
    const U = up.clone().normalize();
    const mats = swapMaterials(root, (c) => {
      if (c.emissive) c.emissive = c.emissive.clone();
      c.userData.glow = c.emissive ? c.emissive.clone() : null;
      return c;
    });
    const g = frameAt(root, up, null);
    // the ray's ring round them, pulled in as they go
    const ringMat = new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    owned.push(ringMat);
    const halo = new THREE.Mesh(ring, ringMat);
    g.add(halo);
    const motes = sprites(g, 14, '#ff8ce6', owned);
    motes.forEach((s, i) => {
      s.userData = { a: rand() * Math.PI * 2, h: rand(), at: (i / motes.length) * 0.3 };
    });
    const burst = sprites(g, 14, '#ffd0f4', owned);
    const flash = sprites(g, 1, '#ffffff', owned)[0];
    let t = 0;
    let squeaked = false;
    let popped = false;

    const h = {
      done: false,
      step(dt) {
        if (this.done) return;
        t += dt;
        // the hit: a pink flash through them, fading to a glow
        const glow = Math.max(0, 1 - t / 0.3) * 0.75 + 0.12;
        for (const c of mats.list) if (c.emissive) c.emissive.copy(PINK).multiplyScalar(glow);
        // down to a tenth, squashing and stretching on the way
        const k = clamp01(t / SHRINK.down);
        const size = 1 + (SHRINK.to - 1) * easeInOut(k);
        const wob = Math.sin(t * 34) * 0.16 * (1 - k);
        root.scale.set(start.scale.x * size * (1 - wob * 0.6), start.scale.y * size * (1 + wob), start.scale.z * size * (1 - wob * 0.6));
        // then hopping about on the spot, tiny
        const hop = t > SHRINK.down ? Math.abs(Math.sin((t - SHRINK.down) * Math.PI * 5)) * 0.07 * tall : 0;
        root.position.copy(start.at).addScaledVector(U, hop);
        if (t >= SHRINK.squeak && !squeaked) {
          squeaked = true;
          on?.('squeak');
        }
        ringMat.opacity = popped ? 0 : 0.85 * Math.sin(Math.PI * clamp01(t / (SHRINK.down + 0.1)));
        const rr = (0.45 * (1 - easeOut(k)) + 0.04) * tall;
        halo.scale.set(rr, rr, rr);
        halo.position.y = (0.5 * (1 - k) + 0.02) * tall;
        for (const s of motes) {
          const d = s.userData;
          const q = (t - d.at) / 0.35;
          s.visible = q > 0 && q < 1;
          if (!s.visible) continue;
          const a = d.a + q * 5;
          const r = 0.5 * tall * (1 - q);
          s.position.set(Math.cos(a) * r, d.h * tall * (1 - q), Math.sin(a) * r);
          s.scale.setScalar(0.05 * tall);
          s.material.opacity = Math.sin(q * Math.PI);
        }
        if (t >= SHRINK.pop && !popped) {
          popped = true;
          on?.('pop');
          root.visible = false;
          burst.forEach((s) => {
            const a = rand() * Math.PI * 2;
            s.userData = { vel: new V(Math.cos(a), 0.4 + rand(), Math.sin(a)).multiplyScalar((0.4 + rand() * 0.6) * tall) };
          });
        }
        if (popped) {
          const q = clamp01((t - SHRINK.pop) / SHRINK.fade);
          for (const s of burst) {
            s.visible = q < 1;
            s.position.copy(s.userData.vel).multiplyScalar(easeOut(q) * 0.5);
            s.scale.setScalar(0.06 * tall * (1 - q));
            s.material.opacity = 1 - q;
          }
          if (flash) {
            flash.visible = q < 0.5;
            flash.position.set(0, 0.06 * tall, 0);
            flash.scale.setScalar(0.5 * tall * easeOut(q * 2));
            flash.material.opacity = 1 - q * 2;
          }
          if (q >= 1) this.done = true;
        }
      },
      dispose() {
        live.delete(h);
        parent.remove(g);
        mats.restore();
        root.position.copy(start.at);
        root.scale.copy(start.scale);
        root.visible = true;
        for (const o of owned) o.dispose();
      },
    };
    live.add(h);
    return h;
  }

  function light({ root, tall, up, ash = false, seed = Math.random() * 10, on = null }) {
    if (!root || !tall) return null;
    const rand = stream(seed);
    const owned = [];
    const start = { at: root.position.clone(), scale: root.scale.clone() };
    const mats = swapMaterials(root, (c) => {
      c.userData.from = c.color?.clone() ?? null;
      if (c.emissive) c.emissive = c.emissive.clone();
      return c;
    });
    const g = frameAt(root, up, null);
    const glow = ash ? EMBER : PALE;
    const motes = sprites(g, 18, ash ? '#9a8f86' : '#e8f6ff', owned);
    motes.forEach((sp) => {
      const a = rand() * Math.PI * 2;
      const r = rand() * 0.22 * tall;
      sp.userData = { from: new V(Math.cos(a) * r, (0.1 + rand() * 0.85) * tall, Math.sin(a) * r), vel: new V((rand() - 0.5) * 0.4, ash ? -0.2 - rand() * 0.4 : 0.6 + rand() * 0.9, (rand() - 0.5) * 0.4).multiplyScalar(tall), size: (0.03 + rand() * 0.04) * tall };
    });
    const flash = sprites(g, 1, ash ? '#ffb070' : '#ffffff', owned)[0];
    let t = 0;
    let gone = false;
    const h = {
      done: false,
      step(dt) {
        if (this.done) return;
        t += dt;
        // through them: the light (or the ember), then for ash the dark as it cools
        const k = clamp01(t / LIGHT.flash);
        const cool = ash ? clamp01((t - LIGHT.flash) / (LIGHT.gone - LIGHT.flash)) : 0;
        for (const c of mats.list) {
          if (c.emissive) c.emissive.copy(glow).multiplyScalar((ash ? 1.6 : 3) * k * (1 - cool));
          if (c.userData.from && c.color) c.color.copy(c.userData.from).lerp(ash ? SOOT : PALE, Math.max(k * 0.6, cool));
        }
        // (the Amban's swell as it takes them; the ash sinks a little as it goes)
        const swell = ash ? 1 - 0.08 * cool : 1 + 0.06 * k;
        root.scale.set(start.scale.x * swell, start.scale.y * (ash ? 1 - 0.12 * cool : 1), start.scale.z * swell);
        if (flash) {
          const f = t / (LIGHT.gone + 0.2);
          flash.visible = f < 1;
          flash.position.set(0, 0.55 * tall, 0);
          flash.scale.setScalar(tall * (ash ? 0.8 : 1.4) * easeOut(clamp01(f * 2)));
          flash.material.opacity = (ash ? 0.5 : 0.9) * (1 - f);
        }
        if (t >= LIGHT.gone && !gone) {
          gone = true;
          root.visible = false;
          on?.('gone');
        }
        const q = (t - LIGHT.gone * 0.7) / LIGHT.motes;
        for (const sp of motes) {
          const d = sp.userData;
          sp.visible = q > 0 && q < 1;
          if (!sp.visible) continue;
          sp.position.copy(d.from).addScaledVector(d.vel, q * LIGHT.motes);
          sp.scale.setScalar(d.size * (1 - q * 0.5));
          sp.material.opacity = Math.sin(Math.PI * q) * (ash ? 0.8 : 1);
        }
        if (q >= 1) this.done = true;
      },
      dispose() {
        live.delete(h);
        parent.remove(g);
        mats.restore();
        root.position.copy(start.at);
        root.scale.copy(start.scale);
        root.visible = true;
        for (const o of owned) o.dispose();
      },
    };
    live.add(h);
    return h;
  }

  function thrown({ root, tall, up, push, seed = Math.random() * 10, on = null }) {
    if (!root || !tall) return null;
    const rand = stream(seed);
    const owned = [];
    const m = tall / 1.8; // (a metre, where they stand)
    const start = { at: root.position.clone(), q: root.quaternion.clone(), scale: root.scale.clone() };
    const U = up.clone().normalize();
    const P = (push ?? new V(0, 0, 1)).clone().addScaledVector(U, -(push ?? new V(0, 0, 1)).dot(U));
    if (P.lengthSq() < 1e-6) P.set(1, 0, 0);
    P.normalize();
    const side = new V().crossVectors(U, P).normalize();
    const g = frameAt(root, up, push);
    const flash = sprites(g, 1, '#bfefff', owned)[0];
    const speed = THROWN.speed * (0.85 + rand() * 0.3) * m;
    const lift = THROWN.lift * m;
    const grav = 9.8 * m;
    const air = (2 * lift) / grav; // (up and back down to where they stood)
    const turn = new THREE.Quaternion();
    let t = 0;
    let landed = false;
    const h = {
      done: false,
      step(dt) {
        if (this.done) return;
        t += dt;
        const ta = Math.min(t, air);
        // out along the push and up, falling back (a skid on landing); over backwards once
        // and a quarter in the air, to land on their back (the head the way they went)
        root.position.copy(start.at).addScaledVector(P, speed * ta + (t > air ? speed * 0.3 * Math.min(0.25, t - air) : 0)).addScaledVector(U, Math.max(0, lift * ta - 0.5 * grav * ta * ta));
        turn.setFromAxisAngle(side, Math.PI * 2.5 * (ta / air));
        root.quaternion.copy(start.q).premultiply(turn);
        if (t >= air && !landed) {
          landed = true;
          on?.('land');
        }
        if (flash) {
          const f = t / 0.3;
          flash.visible = f < 1;
          flash.position.set(0, 0.5 * tall, 0);
          flash.scale.setScalar(0.9 * tall * easeOut(clamp01(f)));
          flash.material.opacity = 1 - f;
        }
        // down a while, then gone
        const k = clamp01((t - air - THROWN.rest) / THROWN.fade);
        root.scale.copy(start.scale).multiplyScalar(Math.max(0.0001, 1 - k));
        if (k >= 1) {
          root.visible = false;
          this.done = true;
        }
      },
      dispose() {
        live.delete(h);
        parent.remove(g);
        root.position.copy(start.at);
        root.quaternion.copy(start.q);
        root.scale.copy(start.scale);
        root.visible = true;
        for (const o of owned) o.dispose();
      },
    };
    live.add(h);
    return h;
  }

  return {
    freeze,
    shrink,
    light,
    thrown,
    get count() {
      return live.size;
    },
    update(dt) {
      for (const h of live) h.step(Math.min(dt, 0.05));
    },
    dispose() {
      for (const h of [...live]) h.dispose();
      crystal.dispose();
      shard.dispose();
      ring.dispose();
      dot?.dispose();
    },
  };
}
