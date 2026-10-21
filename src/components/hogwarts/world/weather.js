// The weather over the grounds, drawn: Highland rain and the term’s snow
// falling round you (the Road’s weather.js on lib/three/particles: the
// CPU emitter or its GPU twin, instanced quads, the Road’s own records,
// src/data/middleearth/fx/, and its sheets, public/models/middleearth/fx/:
// the site’s own work), a kind a draw, its rate the weather’s (rules/
// weather.js); and the mist that lies on the lake at dawn, a few sheets of
// slow noise low over the water, thicker where the ground is low, lit by the
// day’s haze.
//
//   createWeather(renderer, { tier, outputs, groundMap }) → {
//     group, set(weather, light), update(dt, camera), stats(), dispose() }
//   countFor(n, tier), SHARE

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, float, length, mrt, output, positionWorld, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import { OWNER, spawnCount } from '../../../lib/three/particles/emitter';
import { evalCurve } from '../../../lib/three/particles/curves';
import { createSim } from '../../../lib/three/particles/gpu';
import { createShared, createSpriteMesh } from '../../../lib/three/particles/sprites';
import { noiseWith } from '../../../lib/three/noiseNodes';
import rain from '../../../data/middleearth/fx/rain.json';
import snow from '../../../data/middleearth/fx/snow.json';

const KINDS = { rain, snow };
const BOX = { rain: [44, 22, 44], snow: [40, 16, 40] };
export const SHARE = { low: 0.25, mid: 0.5, high: 1, ultra: 1 };
export const countFor = (n, tier) => Math.max(1, Math.round(n * (SHARE[tier] ?? 1)));
const MIST_LAYERS = { low: 1, mid: 2, high: 3, ultra: 3 };

function recordFor(name, count) {
  const em = structuredClone(KINDS[name]);
  em.maxCount = count;
  em.spawn.rate = Math.ceil(count / Math.max(1e-3, evalCurve(em.lifetime, 0, 0)));
  const box = BOX[name];
  if (em.spawn.position?.box) {
    em.spawn.position.box.size = [box[0], 0, box[2]];
    em.spawn.position.box.center = [0, box[1], 0];
  }
  return em;
}

export function createWeather(renderer, { tier = 'high', outputs = [], groundMap = null } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:weather';
  const shared = createShared();
  let lit = null;
  shared.then((sh) => (lit = sh));
  let gone = false;
  const handles = {};
  const last = new THREE.Vector3();
  let lastSet = false;

  // a kind’s pool, made the first time it is asked for (a dry autumn day makes no rain)
  const make = (name) => {
    const n = countFor(KINDS[name].maxCount, tier);
    const em = recordFor(name, n);
    const owners = new Float32Array(OWNER);
    owners[3] = 1;
    owners[7] = 1;
    const h = { name, em, n, owners, k: 0, state: { t: 0, acc: 0, burst: false }, sim: null, mesh: null };
    h.ready = (async () => {
      const sim = await createSim(em, n, { renderer, seed: name === 'rain' ? 3 : 5 });
      if (gone) return sim.dispose?.();
      h.sim = sim;
      const [map, sh] = await Promise.all([
        new THREE.TextureLoader().loadAsync(`/models/middleearth/fx/${em.sheet}.webp`).then((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }),
        shared,
      ]);
      if (gone) return;
      const mesh = await createSpriteMesh(em, sim, { shared: sh, map });
      if (gone) return;
      const still = mesh.material.mrtNode;
      if (!outputs.length) mesh.material.mrtNode = null;
      else {
        const own = { output };
        if (outputs.includes('normal')) {
          own.normal = vec4(0.5, 0.5, 1, 1);
          mesh.material.alphaTest = 0.04;
        }
        mesh.material.mrtNode = outputs.includes('velocity') && still ? still.merge(mrt(own)) : mrt(own);
      }
      mesh.name = `weather:${name}`;
      h.mesh = mesh;
      group.add(mesh);
    })().catch(() => {});
    handles[name] = h;
    return h;
  };

  // the mist: flat sheets over the lake, low, slow, thicker over low ground
  const layers = MIST_LAYERS[tier] ?? 2;
  const uMist = uniform(0);
  const uTime = uniform(0);
  const uHaze = uniform(new THREE.Color(0.7, 0.72, 0.76));
  const uSeed = uniform(new THREE.Vector3(4.4, 1.9, 7.2));
  const { noise } = noiseWith(uSeed, { octaves: 3 });
  const mistMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  mistMat.colorNode = Fn(() => {
    const p = positionWorld;
    const drift = vec3(uTime.mul(0.6), 0, uTime.mul(0.25));
    const n = noise(p.add(drift).mul(vec3(0.012, 0.05, 0.012)), uSeed).mul(0.6).add(noise(p.add(drift.mul(1.7)).mul(0.04), uSeed).mul(0.4));
    const lay = smoothstep(-0.2, 0.6, n);
    const ground = groundMap ? groundMap.groundHeight(p.xz) : float(-5);
    const low = smoothstep(6, 0.5, ground.sub(p.y).add(4));
    // (thin close to the eye, where a sheet would read as a sheet, and gone far off into the fog)
    const d = length(cameraPosition.sub(p));
    const seen = smoothstep(6, 30, d).mul(smoothstep(900, 400, d));
    return vec4(uHaze, lay.mul(low).mul(seen).mul(uMist).mul(0.42));
  })();
  const mistGeo = new THREE.BufferGeometry();
  {
    const planes = [];
    for (let i = 0; i < layers; i++) {
      const g = new THREE.PlaneGeometry(1800, 1100, 1, 1).rotateX(-Math.PI / 2).translate(-250, 0.9 + i * 1.6, 120);
      planes.push(g);
    }
    const pos = [];
    for (const g of planes) {
      const a = g.toNonIndexed().attributes.position.array;
      pos.push(...a);
      g.dispose();
    }
    mistGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }
  const mist = new THREE.Mesh(mistGeo, mistMat);
  mist.name = 'hogwarts:mist';
  mist.renderOrder = 3;
  mist.frustumCulled = false;
  mist.visible = false;
  group.add(mist);

  let want = { rain: 0, snow: 0 };
  return {
    group,
    set(w, light) {
      want = { rain: w.rain ?? 0, snow: w.snow ?? 0 };
      for (const name of ['rain', 'snow']) if (want[name] > 0.02 && !handles[name]) make(name);
      uMist.value = w.mist ?? 0;
      mist.visible = uMist.value > 0.01;
      if (light) {
        // (the mist lit by the haze it is part of, a little brighter, so dawn’s gold reaches it)
        uHaze.value.setRGB(...light.fog.colour).multiplyScalar(1.15);
        if (lit) {
          const { az, el, colour } = light.sun;
          lit.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
          lit.sunColor.value.setRGB(...colour).multiplyScalar(Math.max(0, Math.min(1, (el + 0.05) / 0.3)));
          lit.ambient.value.setRGB(...light.fog.colour).multiplyScalar(0.25 + light.ambient * 0.8);
        }
      }
    },
    update(dt, camera, { wind = null } = {}) {
      uTime.value += dt;
      if (!(dt > 0)) return;
      if (lit && lastSet) lit.camVel.value.subVectors(camera.position, last).divideScalar(dt);
      last.copy(camera.position);
      lastSet = true;
      for (const h of Object.values(handles)) {
        if (!h.sim) continue;
        const o = h.owners;
        o[0] = camera.position.x;
        o[1] = camera.position.y;
        o[2] = camera.position.z;
        const k = want[h.name] ?? 0;
        const count = k > 0.02 ? spawnCount(h.state, h.em, dt, { factor: k }) : 0;
        h.sim.step(dt, { batches: count ? [{ owner: 0, count }] : [], owners: o, wind });
      }
    },
    stats: () => ({ rain: want.rain, snow: want.snow, mist: uMist.value, kinds: Object.keys(handles) }),
    dispose() {
      gone = true;
      for (const h of Object.values(handles)) {
        if (h.mesh) {
          group.remove(h.mesh);
          h.mesh.geometry.dispose();
          h.mesh.material.dispose();
        }
        h.sim?.dispose?.();
      }
      mistGeo.dispose();
      mistMat.dispose();
    },
  };
}
