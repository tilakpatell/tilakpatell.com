// A world's ground, drawn: the height grid (terrain.js) as one mesh, fine
// where you walk and stretched out to the horizon, coloured by a shader
// that reads the site's palette by height and slope (sand in the hollows,
// paler on the crests, rock on the cliffs, snow on the tops), broken up by
// noise at three sizes so no stretch of it repeats, with ripples in the
// light across it (wind-blown sand, wind-scoured snow) and grain close up.
// It takes the scene's light, shadows and fog like anything else (it's a
// MeshStandardMaterial underneath). `marks` is a texture over the walkable
// square that tints where something's been (the dark under a footprint,
// footprints in the snow): the scene paints into it.
//
// palette: { low, high, rock, accent, deep? } colours; hLow, hHigh: the
// heights low gives way to high between; rock: the slope (0 flat … 1 a
// wall) rock starts at; accent: how much of the accent there is (0…1) in
// patches; ripple: { strength, scale, wind }; grain: 0…1; sparkle: 0…1
// (snow, salt); wet: { level, color } darkening the ground near the water.
//
// Up close, the ground wears a photo-scanned surface (public/cc0/galaxy/,
// kit.js's scans: sand, snow, grass, a pine floor, leaf litter, mud, ash,
// red soil, gravel, a beach), by the site's `ground.detail` (a role) and
// `ground.detailLook` ({ color, normal, metres, near, far }): its detail
// colour map laid over the palette's colour and its normal map tilting the
// light, at the scan's real size, fading out between `near` and `far`
// metres so the far ground stays the shader's own. Not on the low tier.

import * as THREE from 'three';
import { HALF } from './terrain';
import { noiseTexture } from './noiseTex';
import { loadScan, scanOf } from './kit';
import { detailLevel } from '../../../lib/detail';
import { sharpen } from '../../../lib/three/textures';
import { GROUND_GLSL } from '../../../lib/three/groundmap';

// (noise read from noiseTex.js's tile, at a few scales, rather than worked out)
const NOISE = `
uniform sampler2D uNoise;
float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec4 gTex(vec2 p) { return texture2D(uNoise, p); }
`;

// lava: { texture, half, reach } (lavaRules.js's field, as lava.js keeps it):
// the bank glows by how near the lava is, the rock hot from below
export function groundMaterial(site, { small = false, map = null, lava = null } = {}) {
  const g = site.ground;
  const p = g.palette;
  const col = (c, fallback) => new THREE.Color(c ?? fallback);
  const uniforms = {
    uLow: { value: col(p.low) },
    uHigh: { value: col(p.high, p.low) },
    uRock: { value: col(p.rock, p.low) },
    uAccent: { value: col(p.accent, p.high ?? p.low) },
    uDeep: { value: col(p.deep, p.low) },
    uHeights: { value: new THREE.Vector4(p.hLow ?? 0, p.hHigh ?? 30, p.rockAt ?? 0.42, p.accentCover ?? 0) },
    uRipple: { value: new THREE.Vector4(p.ripple?.strength ?? 0, p.ripple?.scale ?? 2.4, Math.cos(p.ripple?.wind ?? g.wind ?? 0), Math.sin(p.ripple?.wind ?? g.wind ?? 0)) },
    uGrain: { value: new THREE.Vector3(p.grain ?? 0.5, small ? 0 : (p.sparkle ?? 0), p.patch ?? 0.5) },
    uWet: { value: new THREE.Vector4(p.wet?.level ?? -1e4, p.wet?.band ?? 1.5, 0, 0) },
    uWetColor: { value: col(p.wet?.color, '#000000') },
    uMarks: { value: null },
    uMarkColor: { value: col(p.mark, '#000000') },
    uHalf: { value: HALF },
    uNoise: { value: noiseTexture() },
    // the scan underfoot: its maps, repeats a metre, how strongly its colour
    // and its normal show, where it fades (near, far), and the linear
    // brightness its detail map is centred on (set when it's loaded)
    uScan: { value: null },
    uScanN: { value: null },
    uScanK: { value: new THREE.Vector4(0.5, 0, 0, 0.5) },
    uScanFade: { value: new THREE.Vector2(28, 90) },
    ...(lava ? { uLavaField: { value: lava.texture }, uLavaK: { value: new THREE.Vector3(lava.half, lava.reach, lava.strength ?? 1.6) } } : {}),
  };
  const look = g.detailLook ?? {};
  const scan = g.detail && !small && detailLevel() !== 'low' ? scanOf(g.detail) : null;
  if (scan) {
    uniforms.uScanFade.value.set(look.near ?? 28, look.far ?? 90);
    loadScan(g.detail).then((got) => {
      if (!got) return;
      uniforms.uScan.value = got.map;
      uniforms.uScanN.value = got.normalMap;
      const metres = look.metres ?? scan.metres ?? 2;
      uniforms.uScanK.value.set(1 / metres, look.color ?? 0.75, got.normalMap ? (look.normal ?? 0.7) : 0, Math.pow(scan.mean ?? 0.8, 2.2));
    });
  }
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: p.roughness ?? 0.94, metalness: 0 });
  // (the ground map, lib/three/groundmap: inside the walkable square the
  // floor takes its colour, the same rule painted once with the trees'
  // shade in it, so the floor, the grass and the bounce agree; fading to the
  // shader's own toward the square's edge and beyond)
  const fromMap = map
    ? `
  vec2 mq = abs(xz) / uHalf;
  c = mix(c, groundColour(xz), 1.0 - smoothstep(0.88, 1.0, max(mq.x, mq.y)));`
    : '';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, map?.uniforms ?? {});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;\nvarying vec3 vGroundN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGroundN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vGround;
varying vec3 vGroundN;
uniform vec3 uLow, uHigh, uRock, uAccent, uDeep, uGrain, uWetColor, uMarkColor;
uniform vec4 uHeights, uRipple, uWet, uScanK;
uniform vec2 uScanFade;
uniform sampler2D uMarks, uScan, uScanN;
uniform float uHalf;
${lava ? 'uniform sampler2D uLavaField;\nuniform vec3 uLavaK;' : ''}
${map ? GROUND_GLSL : ''}
${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 xz = vGround.xz;
  float dist = length(vGround - cameraPosition);
  float nBig = gTex(xz / 560.0).r * 0.65 + gTex(xz / 140.0).g * 0.35;
  float nMid = gTex(xz / 70.0).g * 0.6 + gTex(xz / 22.0).b * 0.4;
  float nFine = gTex(xz / 9.0).a;
  float slope = 1.0 - clamp(vGroundN.y, 0.0, 1.0);
  float h = vGround.y + (nBig - 0.5) * (uHeights.y - uHeights.x) * 0.35;
  vec3 c = mix(uLow, uHigh, smoothstep(uHeights.x, uHeights.y, h));
  // patches of the accent, and the deep colour in the hollows
  c = mix(c, uAccent, smoothstep(1.0 - uHeights.w, 1.0 - uHeights.w + 0.12, nBig * 0.7 + nMid * 0.45) * step(0.001, uHeights.w));
  c = mix(c, uDeep, smoothstep(0.62, 0.8, nMid) * 0.35 * uGrain.z);
  // rock where it's steep
  float rock = smoothstep(uHeights.z, uHeights.z + 0.14, slope + (nMid - 0.5) * 0.16);
  vec3 rockC = uRock * (0.78 + 0.4 * gTex(vec2(xz.x * 0.004 + xz.y * 0.003, vGround.y * 0.035)).b); // strata
  c = mix(c, rockC, rock);
  // darker toward the water's edge
  c = mix(c, uWetColor, (1.0 - smoothstep(uWet.x, uWet.x + uWet.y, vGround.y)) * 0.75 * step(-9999.0, uWet.x));${fromMap}
  // grain close up, fading out before it shimmers
  float near = 1.0 - smoothstep(30.0, 160.0, dist);
  c *= 1.0 + ((nFine - 0.5) * 0.12 + (nMid - 0.5) * 0.16) * uGrain.x * mix(0.5, 1.0, near);
  // the scan underfoot, close up: its grain over the colour, centred on
  // its own brightness so the palette's colour still says what the ground is
  if (uScanK.y > 0.0) {
    float scanNear = 1.0 - smoothstep(uScanFade.x, uScanFade.y, dist);
    vec3 sc = texture2D(uScan, xz * uScanK.x).rgb / max(uScanK.w, 0.05);
    c *= mix(vec3(1.0), sc, uScanK.y * scanNear);
  }
  // where things have been
  vec2 muv = xz / (2.0 * uHalf) + 0.5;
  if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) c = mix(c, uMarkColor, texture2D(uMarks, muv).r);
  diffuseColor.rgb *= c;
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  // ripples across the wind, and a little roughness everywhere, in the light
  float dist = length(vGround - cameraPosition);
  float fadeR = 1.0 - smoothstep(40.0, 220.0, dist);
  vec2 xz = vGround.xz;
  vec2 across = vec2(uRipple.z, uRipple.w);
  float phase = dot(xz, across) * uRipple.y + gTex(xz / 40.0).b * 9.0;
  float flatK = smoothstep(0.65, 0.95, vGroundN.y);
  vec3 tilt = vec3(across.x, 0.0, across.y) * cos(phase) * uRipple.x * fadeR * flatK;
  vec2 g = xz / 7.0;
  float e = 1.0 / 256.0;
  float n0 = gTex(g).a;
  tilt += vec3(gTex(g + vec2(e, 0.0)).a - n0, 0.0, gTex(g + vec2(0.0, e)).a - n0) * 2.2 * uGrain.x * fadeR;
  // the scan's own relief, close up (its normal map laid flat on the ground)
  if (uScanK.z > 0.0) {
    float scanNear = 1.0 - smoothstep(uScanFade.x, uScanFade.y, dist);
    vec3 tn = texture2D(uScanN, xz * uScanK.x).xyz * 2.0 - 1.0;
    tilt -= vec3(tn.x, 0.0, tn.y) * uScanK.z * scanNear * flatK;
  }
  normal = normalize(normal - (viewMatrix * vec4(tilt, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  // glints off snow and salt, close up
  float dist = length(vGround - cameraPosition);
  // (a pin-prick at a random spot in one cell in seventy: a crystal catching
  // the sun, not a square of the cell; which ones shift as you move, as
  // real glitter does)
  vec2 gq = vGround.xz * 9.0;
  vec2 cellP = floor(gq);
  float seed = gHash(cellP + floor(cameraPosition.xz * 0.6));
  vec2 spot = vec2(gHash(cellP + 17.3), gHash(cellP + 41.9)) * 0.7 + 0.15;
  float pin = smoothstep(0.16, 0.0, length(fract(gq) - spot));
  float glint = step(0.986, seed) * pin;
  totalEmissiveRadiance += vec3(glint * uGrain.y * (1.0 - smoothstep(3.0, 16.0, dist)) * 1.2);${
    lava
      ? `
  // the bank by the lava, hot: a glow from its edge out, strongest in the
  // cracks and hollows of the rock, broken up so it isn't a band
  vec2 luv = vGround.xz / (2.0 * uLavaK.x) + 0.5;
  if (luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) {
    vec2 lf = texture2D(uLavaField, luv).rg;
    float lnear = lf.g * uLavaK.y;
    float lk = (1.0 - smoothstep(0.0, uLavaK.y, lnear)) * step(lf.r, 0.002);
    float lbreak = 0.55 + 0.9 * gTex(vGround.xz / 5.0).a * gTex(vGround.xz / 17.0).b;
    totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * pow(lk, 2.2) * lbreak * uLavaK.z;
  }`
      : ''
  }
}`,
      );
  };
  mat.customProgramCacheKey = () => `galaxy-ground${map ? ':map' : ''}${lava ? ':lava' : ''}`;
  return { material: mat, uniforms };
}

// The mesh, from the height grid: lines × lines vertices, each cell two
// triangles split from (i, j + 1) to (i + 1, j) (as heightGrid reads them)
export function groundMesh(grid, material) {
  const { lines, heights, size: w } = grid;
  const pos = new Float32Array(w * w * 3);
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 3;
      pos[k] = lines[i];
      pos[k + 1] = heights[j * w + i];
      pos[k + 2] = lines[j];
    }
  const index = new Uint32Array((w - 1) * (w - 1) * 6);
  let t = 0;
  for (let j = 0; j < w - 1; j++)
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i; // (i, j)
      const b = a + 1; // (i + 1, j)
      const c = a + w; // (i, j + 1)
      const d = c + 1; // (i + 1, j + 1)
      index[t++] = a;
      index[t++] = c;
      index[t++] = b;
      index[t++] = c;
      index[t++] = d;
      index[t++] = b;
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

// Where things have been, over the walkable square: a canvas the scene
// paints soft dabs into, as a texture the ground reads (red: how much)
export function createMarks(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  sharpen(texture);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let dirty = false;
  let sent = -Infinity; // (when it last went up to the graphics chip: a 512² upload, at most four times a second)
  return {
    texture,
    // a dab at (x, z), r metres across, `k` strong (0…1)
    dab(x, z, r = 1.2, k = 0.35) {
      const u = ((x / (2 * HALF)) + 0.5) * size;
      const v = ((z / (2 * HALF)) + 0.5) * size;
      if (u < 0 || v < 0 || u > size || v > size) return;
      const px = Math.max(1, (r / (2 * HALF)) * size);
      const grad = c.createRadialGradient(u, v, 0, u, v, px);
      grad.addColorStop(0, `rgba(255,0,0,${k})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      c.fillStyle = grad;
      c.fillRect(u - px, v - px, px * 2, px * 2);
      dirty = true;
    },
    flush(now = performance.now()) {
      if (!dirty || now - sent < 250) return;
      dirty = false;
      sent = now;
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
    },
  };
}
