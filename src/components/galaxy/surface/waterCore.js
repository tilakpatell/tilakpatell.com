// The water's workings (water.js's createWater), whatever draws it: the
// plane of lava or cloud, the sea's disc of Gerstner waves with its baked
// depth, the spray off its legs and the splashes. GLSL-free: the two
// surfaces' looks are handed in, water.js's shaders on the classic renderer
// and nodes/water.js's node materials on the node renderer.
//
//   createWater(site, sunDir, sunColor, opts, looks) → water.js's
//   looks.plane(values, late, { fine, video }) → { material, uniforms }
//   looks.sea(values, late, waves, { fine }) → { material, uniforms }
//   (values: the uniforms' values by name; late: the textures, which a
//   uniform merge would clone, so they're handed in apart)

import * as THREE from 'three';
import { FAR, HALF } from './terrain';
import { noiseTexture } from './noiseTex';
import { sprayAt } from './floats';
import { bakeDepth, discRings, heightAt as waveHeight, seaFor, snapCentre, wavesFor } from './ocean';

const KIND = { sea: 0, swamp: 0, clouds: 1, lava: 2, salt: 0 };

export function createWater(site, sunDir, sunColor, opts = {}, looks) {
  const w = site.water;
  if (w.kind === 'sea' || w.kind === 'swamp' || w.kind === 'salt') return createSea(site, sunDir, sunColor, opts, looks);
  const values = {
    uColor: new THREE.Color(w.color),
    uDeep: new THREE.Color(w.deep ?? w.color),
    uSun: sunDir.clone(),
    uSunColor: new THREE.Color(sunColor),
    uSky: new THREE.Color(site.sky.horizon),
    uTime: 0,
    uKind: KIND[w.kind] ?? 0,
    uFoam: w.foam ?? (w.kind === 'sea' ? 0.5 : 0),
    uGlow: w.glow ?? 3,
    uWaves: w.waves ?? (w.kind === 'swamp' ? 2.2 : w.kind === 'clouds' ? 0.12 : 1),
    uWaves2: (w.waves ?? (w.kind === 'swamp' ? 2.2 : w.kind === 'clouds' ? 0.12 : 1)) * 2.3,
    uNoise: noiseTexture(),
  };
  const video = w.kind === 'lava' && opts.flow ? opts.flow : null;
  // (the film's texture shared, not copied: handed in apart from the values)
  const late = video ? { uFlow: video, uFlowFlip: opts.flipped ? 1 : 0 } : {};
  const { material, uniforms } = looks.plane(values, late, { fine: Boolean(opts.foam), video: Boolean(video) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2.2, FAR * 2.2, 1, 1).rotateX(-Math.PI / 2), material);
  mesh.position.y = w.level;
  mesh.receiveShadow = false;
  mesh.name = 'water';
  // lava lights what's round it
  const glow = w.kind === 'lava' ? new THREE.HemisphereLight('#000000', '#ff6a1a', 0.9) : null;
  return {
    mesh,
    glow,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// ── The sea and the swamp ──

function discGeometry({ radii, around }) {
  const pos = new Float32Array(radii.length * around * 3);
  radii.forEach((r, i) => {
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2 + (i % 2) * (Math.PI / around);
      const o = (i * around + j) * 3;
      pos[o] = Math.cos(a) * r;
      pos[o + 2] = Math.sin(a) * r;
    }
  });
  const index = [];
  for (let i = 0; i < radii.length - 1; i++)
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      index.push(a, b, a + around, b, b + around, a + around);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

function createSea(site, sunDir, sunColor, { heightAt, small = false, id, rings: ringOpts = { small }, depthN = small ? 256 : 512, foam: fine = false } = {}, looks) {
  const w = site.water;
  const sea = seaFor(id, w);
  const waves = wavesFor(sea);
  const rings = discRings(ringOpts);
  // (no ground to bake: all of it deep)
  const depth = bakeDepth(heightAt ?? (() => -Infinity), w.level, { half: HALF, n: depthN, max: 24 });
  const depthTex = new THREE.DataTexture(depth.rg, depth.n, depth.n, THREE.RGFormat, THREE.UnsignedByteType);
  depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
  depthTex.wrapS = depthTex.wrapT = THREE.ClampToEdgeWrapping;
  depthTex.colorSpace = THREE.NoColorSpace;
  depthTex.needsUpdate = true;
  const sun = new THREE.Color(sunColor);
  const values = {
    uCentre: new THREE.Vector2(),
    uHalf: depth.half,
    uMax: depth.max,
    uReach: depth.reach,
    uLevel: w.level,
    uTime: 0,
    uColor: new THREE.Color(w.color),
    uDeep: new THREE.Color(w.deep ?? w.color),
    uShallow: new THREE.Color(sea.shallow),
    uBed: new THREE.Color(sea.bed),
    uSun: sunDir.clone(),
    uSunColor: sun.multiplyScalar(sea.glint > 0.5 ? 2.2 : 1),
    uZenith: new THREE.Color(site.sky.zenith ?? site.sky.horizon),
    uHorizon: new THREE.Color(site.sky.horizon),
    uClarity: sea.clarity,
    uCaps: sea.caps * (w.foam != null ? 0.5 + w.foam : 1),
    uShore: sea.shore,
    uBreakers: sea.breakers,
    uGlint: sea.glint,
    uRough: sea.rough,
    uScum: sea.scum ?? 0,
    uFar: new THREE.Color(sea.far ?? w.deep ?? w.color),
    uFarMix: sea.far ? (sea.farMix ?? 0.5) : 0,
    uSkyMix: sea.sky ?? 1,
  };
  // (the textures apart from the values, which a merge would clone)
  const late = { uDepth: depthTex, uNoise: noiseTexture() };
  // (ultra: the foam's lace and the wash finer, the shore blended into the sand)
  const { material, uniforms } = looks.sea(values, late, waves, { fine });
  const mesh = new THREE.Mesh(discGeometry(rings), material);
  mesh.frustumCulled = false; // (it goes where the camera goes)
  mesh.receiveShadow = false;
  mesh.name = 'water';
  const height = (x, z, t = uniforms.uTime.value) => w.level + waveHeight(x, z, t, waves, depth.at(x, z), sea);
  const spray = createSpray(small ? 260 : 700);
  // (each leg read at a few points round it, the water there last frame)
  const legs = (w.legs ?? []).map(([x, z, r]) => ({ x, z, r, at: Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, h: w.level, owed: 0 })) }));
  let lastT = null;
  return {
    mesh,
    glow: null,
    spray: spray.points,
    depth,
    update(t, camera) {
      const dt = lastT == null ? 0 : t - lastT;
      lastT = t;
      uniforms.uTime.value = t;
      if (camera) {
        const [x, z] = snapCentre(camera.position.x, camera.position.z, rings.step);
        uniforms.uCentre.value.set(x, z);
      }
      if (!(dt > 0) || dt > 0.5) return;
      for (const leg of legs) {
        // (spray far off isn't seen through the rain)
        if (camera && Math.hypot(camera.position.x - leg.x, camera.position.z - leg.z) > 420) continue;
        for (const p of leg.at) {
          const x = leg.x + Math.cos(p.a) * leg.r;
          const z = leg.z + Math.sin(p.a) * leg.r;
          const h = height(x, z, t);
          const k = sprayAt(h, p.h, dt, { level: w.level });
          p.h = h;
          p.owed += k * dt * 90;
          for (; p.owed >= 1; p.owed -= 1) spray.emit(x, h, z, Math.cos(p.a), Math.sin(p.a), 3 + k * 7);
        }
      }
      spray.step(dt);
    },
    // the water's surface there and then (what's drawn, to a few cm)
    height,
    // a burst of spray: something going into the water, or coming out
    splash(x, z, k = 1) {
      const h = height(x, z);
      for (let i = 0; i < 50 * k; i++) {
        const a = Math.random() * Math.PI * 2;
        spray.emit(x + Math.cos(a) * 2, h, z + Math.sin(a) * 2, Math.cos(a), Math.sin(a), 5 + Math.random() * 8 * k);
      }
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      depthTex.dispose();
      spray.dispose();
    },
  };
}

// Spray: soft white drops thrown out and up, falling back, gone in two
// seconds; one draw for all of them
let puffTex = null;
function puff() {
  if (puffTex) return puffTex;
  // (a soft round dot, white, fading out from its middle; made in numbers,
  // not on a canvas, so it's made the same anywhere)
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * Math.max(0, 1 - d) ** 1.6 * 0.95);
    }
  puffTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  puffTex.magFilter = puffTex.minFilter = THREE.LinearFilter;
  puffTex.needsUpdate = true;
  return puffTex;
}

function createSpray(n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(-1e6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const vel = new Float32Array(n * 3);
  const age = new Float32Array(n).fill(99);
  const material = new THREE.PointsMaterial({ color: '#e8f0f4', map: puff(), size: 2.6, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true, fog: true });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.name = 'spray';
  let next = 0;
  let live = 0;
  return {
    points,
    // a drop at (x, y, z), thrown out along (dx, dz) and up at `up` m/s
    emit(x, y, z, dx, dz, up) {
      const i = next++ % n;
      const out = 1.5 + Math.random() * 3;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 3] = dx * out + (Math.random() - 0.5) * 2;
      vel[i * 3 + 1] = up * (0.6 + Math.random() * 0.6);
      vel[i * 3 + 2] = dz * out + (Math.random() - 0.5) * 2;
      age[i] = 0;
      live = 2;
    },
    step(dt) {
      if (!live) return;
      let any = false;
      for (let i = 0; i < n; i++) {
        if (age[i] > 2) continue;
        age[i] += dt;
        if (age[i] > 2) {
          pos[i * 3 + 1] = -1e6;
          continue;
        }
        any = true;
        vel[i * 3 + 1] -= 9.8 * dt;
        const drag = Math.exp(-dt * 0.8);
        vel[i * 3] *= drag;
        vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      // (one more frame to park the last of them, then nothing to do)
      if (!any) live -= 1;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
