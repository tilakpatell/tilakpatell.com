// The sea and the sky over it. The sky is a photographed one (a CC0 Poly
// Haven HDRI, range-compressed into public/games/caribbean/sky.webp by
// scripts/caribbean.mjs): it is what you see, what lights the ships, and what
// the water reflects. The water is a disc of Gerstner waves that follows the
// camera, fine near it and coarse toward the horizon, shaded here: the sky
// mirrored by angle, light through the crests toward the sun, the sun's
// glitter, foam where the waves steepen and along the shores, turquoise
// shallows round the islands, and a haze that melts it into the sky.
//
// The same waves are worked out in JavaScript (heightAt), so a hull rides the
// water that's drawn.

import * as THREE from 'three';
import { sharpen, loadTexture } from '../../../lib/three/textures';

const TAU = Math.PI * 2;

// direction (radians), wavelength, steepness. The steepnesses sum under 1,
// so no crest folds over on itself.
export const WAVES = [
  [0.9, 97, 0.13],
  [0.3, 61, 0.11],
  [1.65, 37, 0.1],
  [2.5, 23, 0.085],
  [-0.45, 14, 0.07],
  [1.2, 8.5, 0.05],
].map(([dir, len, steep]) => {
  const k = TAU / len;
  return { dx: Math.cos(dir), dz: Math.sin(dir), k, c: Math.sqrt(9.8 / k) * 0.85, steep, amp: steep / k, len };
});

// The water's height at a place and time. Gerstner waves slide the surface
// sideways as well as up, so look up the point that slid to here (twice is
// close enough), then take its height.
export function heightAt(x, z, t, sea = 1) {
  let qx = x;
  let qz = z;
  for (let i = 0; i < 2; i++) {
    let ox = 0;
    let oz = 0;
    for (const w of WAVES) {
      const c = Math.cos(w.k * (w.dx * qx + w.dz * qz - w.c * t)) * w.amp * sea;
      ox += w.dx * c;
      oz += w.dz * c;
    }
    qx = x - ox;
    qz = z - oz;
  }
  let y = 0;
  for (const w of WAVES) y += Math.sin(w.k * (w.dx * qx + w.dz * qz - w.c * t)) * w.amp * sea;
  return y;
}

// The waves in GLSL: gerstner(p, t, dist) returns the displacement, and
// fills in the normal and how pinched the surface is there (for foam).
// Short waves fade out with distance, where the mesh is too coarse for them.
export const WAVES_GLSL = `
  uniform float uTime;
  uniform float uSea;
  vec3 gerstner(vec2 p, float dist, out vec3 normal, out float pinch) {
    vec3 d = vec3(0.0);
    float txx = 0.0, tzz = 0.0, txz = 0.0, nx = 0.0, nz = 0.0;
    ${WAVES.map(
      (w) => `{
      float fade = (1.0 - smoothstep(${(w.len * 8).toFixed(1)}, ${(w.len * 16).toFixed(1)}, dist)) * uSea;
      float f = ${w.k.toFixed(5)} * (dot(vec2(${w.dx.toFixed(5)}, ${w.dz.toFixed(5)}), p) - ${w.c.toFixed(4)} * uTime);
      float s = sin(f), c = cos(f);
      float a = ${w.amp.toFixed(5)} * fade, st = ${w.steep.toFixed(4)} * fade;
      d += vec3(${w.dx.toFixed(5)} * a * c, a * s, ${w.dz.toFixed(5)} * a * c);
      txx += ${(w.dx * w.dx).toFixed(5)} * st * s;
      tzz += ${(w.dz * w.dz).toFixed(5)} * st * s;
      txz += ${(w.dx * w.dz).toFixed(5)} * st * s;
      nx += ${w.dx.toFixed(5)} * st * c;
      nz += ${w.dz.toFixed(5)} * st * c;
    }`,
    ).join('\n')}
    normal = normalize(vec3(-nx, 1.0 - txx - tzz, -nz));
    pinch = (1.0 - txx) * (1.0 - tzz) - txz * txz;
    return d;
  }
`;

// Where a direction lands in the sky picture, and its light. The picture is
// the sky from straight up down to 11.25° below the horizon.
const SKY_GLSL = `
  uniform sampler2D uSky;
  uniform float uSkyScale;
  uniform float uSkyGain;
  vec3 skyLight(vec3 dir) {
    float u = atan(dir.z, dir.x) / 6.2831853 + 0.5;
    float el = asin(clamp(dir.y, -1.0, 1.0));
    float v = 1.0 - (0.5 - el / 3.14159265) / 0.5625;
    vec3 c = texture2D(uSky, vec2(u, clamp(v, 0.004, 0.996))).rgb;
    c = min(pow(c, vec3(2.2)), 0.9985);
    return c / (1.0 - c) / uSkyScale * uSkyGain;
  }
`;

// A small repeating texture for the fine detail: a normal in RG (the slope
// of many small ripples) and two noises in B and A. Built from sines with
// whole-number frequencies, so it tiles.
function rippleTexture(size = 256) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const comps = (n, kMax, power) =>
    Array.from({ length: n }, () => {
      const kx = Math.round((rand() * 2 - 1) * kMax);
      const ky = Math.round((rand() * 2 - 1) * kMax) || 1;
      return { kx, ky, a: 1 / Math.hypot(kx, ky) ** power, p: rand() * TAU };
    });
  const ripple = comps(46, 14, 1.15);
  const blotch = comps(22, 5, 1);
  const fine = comps(30, 20, 0.6);
  const data = new Uint8Array(size * size * 4);
  const field = (set, u, v) => {
    let s = 0;
    for (const c of set) s += Math.sin(TAU * (c.kx * u + c.ky * v) + c.p) * c.a;
    return s;
  };
  const norm = (set) => set.reduce((s, c) => s + c.a, 0) * 0.5;
  const nb = norm(blotch);
  const nf = norm(fine);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let dx = 0;
      let dy = 0;
      for (const c of ripple) {
        const co = Math.cos(TAU * (c.kx * u + c.ky * v) + c.p) * c.a;
        dx += co * c.kx;
        dy += co * c.ky;
      }
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, 128 + dx * 9));
      data[i + 1] = Math.max(0, Math.min(255, 128 + dy * 9));
      data[i + 2] = Math.max(0, Math.min(255, 128 + (field(blotch, u, v) / nb) * 128));
      data[i + 3] = Math.max(0, Math.min(255, 128 + (field(fine, u, v) / nf) * 128));
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  sharpen(t);
  t.needsUpdate = true;
  return t;
}

// A disc of rings round the middle: even steps close in, then each ring a
// little wider than the last, out to the horizon.
function discGeometry({ around = 224, near = 44, step = 1.6, grow = 1.034, far = 3200 } = {}) {
  const radii = [0];
  for (let r = step; r < near; r += step) radii.push(r);
  for (let r = near; r < far; r *= grow) radii.push(r);
  radii.push(far);
  const pos = new Float32Array(radii.length * around * 3);
  radii.forEach((r, i) => {
    for (let j = 0; j < around; j++) {
      const a = (j / around) * TAU + (i % 2) * (Math.PI / around);
      const o = (i * around + j) * 3;
      pos[o] = Math.cos(a) * r;
      pos[o + 1] = 0;
      pos[o + 2] = Math.sin(a) * r;
    }
  });
  const index = [];
  for (let i = 0; i < radii.length - 1; i++)
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      const c = a + around;
      const d = b + around;
      index.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

export function loadSky() {
  // (decoded off the main thread; always seen magnified, so no mipmaps)
  return loadTexture('/games/caribbean/sky.webp', { color: false, mipmaps: false, aniso: 1 }).then((t) => {
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

// SKY: what scripts/caribbean.mjs measured (public/games/caribbean/credits.json)
export const SKY = { u: 0.5968, elevation: 9.98, scale: 0.4455 };
const sunAz = (SKY.u - 0.5) * TAU;
const sunEl = (SKY.elevation * Math.PI) / 180;
export const SUN = new THREE.Vector3(Math.cos(sunAz) * Math.cos(sunEl), Math.sin(sunEl), Math.sin(sunAz) * Math.cos(sunEl));

export function createSea(stage, skyTex, isles) {
  const { scene, renderer } = stage;
  const shared = {
    uTime: { value: 0 },
    uSea: { value: 1 },
    uSky: { value: skyTex },
    uSkyScale: { value: SKY.scale },
    uSkyGain: { value: 0.42 },
  };

  // the sky: a dome that goes where the camera goes
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { uSky: shared.uSky, uSkyScale: shared.uSkyScale, uSkyGain: shared.uSkyGain },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position * 4000.0 + cameraPosition, 1.0); }',
      fragmentShader: `
        varying vec3 vDir;
        ${SKY_GLSL}
        void main() {
          gl_FragColor = vec4(skyLight(normalize(vDir)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  // the light it gives: the dome alone, blurred into an environment map
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(
    dome.geometry,
    new THREE.ShaderMaterial({
      uniforms: dome.material.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position * 50.0, 1.0); }',
      // below the horizon the "sky" is the sea: darker, and bluer
      fragmentShader: `
        varying vec3 vDir;
        ${SKY_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          vec3 up = skyLight(vec3(d.x, abs(d.y), d.z));
          vec3 c = d.y >= 0.0 ? up : mix(up * vec3(0.25, 0.42, 0.48), vec3(0.02, 0.07, 0.09), smoothstep(0.0, -0.35, d.y));
          gl_FragColor = vec4(min(c, vec3(60.0)), 1.0);
        }`,
    }),
  );
  envScene.add(envDome);
  const envTarget = pm.fromScene(envScene, 0, 0.1, 100);
  scene.environment = envTarget.texture;
  pm.dispose();
  envDome.material.dispose();

  // the water
  const ripples = rippleTexture();
  const isleData = Array.from({ length: 12 }, (_, i) => (isles[i] ? new THREE.Vector3(isles[i].x, isles[i].y, isles[i].r) : new THREE.Vector3(0, 0, -1)));
  const water = new THREE.Mesh(
    discGeometry(),
    new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uCentre: { value: new THREE.Vector2() },
        uRipples: { value: ripples },
        uSun: { value: SUN.clone() },
        uSunColor: { value: new THREE.Color(1.0, 0.72, 0.46).multiplyScalar(9) },
        uDeep: { value: new THREE.Color(0.004, 0.035, 0.052) },
        uScatter: { value: new THREE.Color(0.02, 0.2, 0.2) },
        uShallow: { value: new THREE.Color(0.05, 0.5, 0.46) },
        uIsles: { value: isleData },
        uHaze: { value: 0.00105 },
      },
      fog: false,
      vertexShader: `
        uniform vec2 uCentre;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vPinch;
        ${WAVES_GLSL}
        void main() {
          vec2 p = position.xz + uCentre;
          float dist = length(position.xz);
          vec3 n; float pinch;
          vec3 d = gerstner(p, dist, n, pinch);
          vWorld = vec3(p.x, 0.0, p.y) + d;
          vNormal = n;
          vPinch = pinch;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uRipples;
        uniform vec3 uSun, uSunColor, uDeep, uScatter, uShallow;
        uniform vec3 uIsles[12];
        uniform float uHaze, uTime;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vPinch;
        ${SKY_GLSL}
        void main() {
          vec3 toEye = cameraPosition - vWorld;
          float dist = length(toEye);
          vec3 V = toEye / dist;

          // fine ripples: two layers of the tile sliding past each other, and
          // a broad slow one; fainter with distance, where they'd only sparkle
          vec2 w = vWorld.xz;
          vec2 r1 = texture2D(uRipples, w * 0.031 + uTime * vec2(0.021, 0.013)).rg - 0.5;
          vec2 r2 = texture2D(uRipples, w * 0.083 + uTime * vec2(-0.034, 0.027)).rg - 0.5;
          vec2 r3 = texture2D(uRipples, w * 0.0071 + uTime * vec2(0.004, -0.006)).rg - 0.5;
          float near = 1.0 / (1.0 + dist * 0.004);
          vec2 rip = (r1 * 0.9 + r2 * 0.6) * (0.35 + 0.65 * near) + r3 * 0.5;
          vec3 N = normalize(vNormal + vec3(rip.x, 0.0, rip.y) * 0.55);

          // how much is mirror and how much is water, by the angle you look at
          float facing = max(dot(N, V), 0.0);
          float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
          vec3 R = reflect(-V, N);
          R.y = abs(R.y) + 0.02;
          // (the sun itself is in the sky picture: capped, or its mirror image whites out the screen)
          vec3 mirror = min(skyLight(normalize(R)), vec3(5.0));

          // the body of the water: dark in the troughs, green where a crest
          // stands between you and the sun
          float crest = smoothstep(-1.5, 3.2, vWorld.y);
          vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z));
          float through = pow(max(dot(V, -sunFlat), 0.0), 3.0) * crest;
          vec3 body = mix(uDeep, uScatter, crest * 0.45 + through * 1.4);

          // shallows and surf round the islands
          float shore = 0.0;
          float shoal = 0.0;
          for (int i = 0; i < 12; i++) {
            if (uIsles[i].z < 0.0) continue;
            float d = distance(w, uIsles[i].xy) - uIsles[i].z;
            shoal = max(shoal, 1.0 - smoothstep(-4.0, 34.0, d));
            float surf = (1.0 - smoothstep(0.0, 9.0, abs(d - 1.0))) * (0.55 + 0.45 * sin(d * 0.9 - uTime * 1.6));
            shore = max(shore, surf);
          }
          body = mix(body, uShallow, shoal * 0.75);

          vec3 col = mix(body, mirror, fresnel * (1.0 - shoal * 0.35));

          // the sun's road on the water
          vec3 H = normalize(uSun + V);
          float glint = pow(max(dot(N, H), 0.0), 300.0);
          col += uSunColor * glint * (0.25 + 0.75 * near);

          // foam: where the waves pinch, broken up by the tile's noises
          vec4 n1 = texture2D(uRipples, w * 0.045 + uTime * vec2(0.01, 0.006));
          vec4 n2 = texture2D(uRipples, w * 0.17 - uTime * vec2(0.008, 0.012));
          float lumpy = n1.b * 0.6 + n2.a * 0.4;
          float foam = smoothstep(0.78, 0.52, vPinch) * smoothstep(0.38, 0.62, lumpy);
          foam = max(foam, shore * smoothstep(0.3, 0.7, lumpy + shore * 0.3));
          vec3 foamCol = vec3(0.82, 0.88, 0.9) * (0.5 + 0.9 * max(dot(N, uSun), 0.0) + 0.5);
          col = mix(col, foamCol, clamp(foam, 0.0, 1.0) * 0.9);

          // haze: the far water takes the colour of the sky just above it
          vec3 horizon = skyLight(normalize(vec3(-V.x, 0.035, -V.z)));
          float haze = 1.0 - exp(-pow(dist * uHaze, 1.35));
          col = mix(col, horizon, haze);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  water.frustumCulled = false;
  water.renderOrder = -5;
  scene.add(water);

  let time = 0;
  return {
    shared,
    ripples,
    water,
    get time() {
      return time;
    },
    // every frame: the clock, how rough it is, and where the camera is
    update(dt, camera, sea = 1) {
      time += dt;
      shared.uTime.value = time;
      shared.uSea.value += (sea - shared.uSea.value) * Math.min(1, dt * 0.6);
      water.material.uniforms.uCentre.value.set(camera.position.x, camera.position.z);
    },
    height: (x, z) => heightAt(x, z, time, shared.uSea.value),
    dispose() {
      envTarget.dispose();
      ripples.dispose();
      skyTex.dispose();
    },
  };
}
