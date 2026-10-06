// The compound, the world: grass on the lawn round Spider-Man. Blades, not a
// picture of them: one small blade shape, drawn tens of thousands of times
// in one go, in a patch that goes with him (each blade keeps its place on the
// lawn until it's left behind, then comes round to the far side), leaning in
// the breeze, darker at the root, lit by the sun with the lawn's cloud
// shadows and mowing stripes. A mask of the lawn keeps it off the drives,
// the landing pad, the painted ground and from under the buildings.
//
// createGrass(scene, { count, patch, material }) → { update(x, z, t), dispose }
// (`material` makes the blades' material: the scene's own, so they're lit
// and shadowed as the lawn is).

import * as THREE from 'three';
import { APRON } from '../compound/plan';
import { BUILDINGS, CRATER, LAWN_W, PLANTERS, ROADS_W, ROAD_HALF, S } from './rules';

// the bare ground, painted in plan units [x0, y0, x1, y1]: the helipad, the
// track, the range, the car park (the scene paints them)
const PAINTED = [
  [60, 42, 80, 62],
  [97, 45, 127, 63],
  [-19, 15, -5, 65],
  [49, 96, 73, 106],
];

// Where grass grows, as a picture of the lawn from above: white where it
// does, black where it doesn't. → { texture, box: [x0, z0, x1, z1] }
function lawnMask(px = 1024) {
  const xs = LAWN_W.map((p) => p[0]);
  const zs = LAWN_W.map((p) => p[1]);
  // (square, as the picture is)
  const x0 = Math.min(...xs) - 4;
  const z0 = Math.min(...zs) - 4;
  const side = Math.max(Math.max(...xs) + 4 - x0, Math.max(...zs) + 4 - z0);
  const box = [x0, z0, x0 + side, z0 + side];
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const k = px / side;
  const at = (x, z) => [(x - box[0]) * k, (z - box[1]) * k];
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.closePath();
  };
  g.fillStyle = '#000';
  g.fillRect(0, 0, px, px);
  g.fillStyle = '#fff';
  poly(LAWN_W);
  g.fill();
  // and none where it isn't lawn
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = (ROAD_HALF * 2 + 1.6) * k;
  for (const r of ROADS_W) {
    g.beginPath();
    r.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.stroke();
  }
  poly(APRON.map(([x, y]) => [x * S, y * S]));
  g.fill();
  g.lineWidth = 2 * k;
  for (const b of BUILDINGS) {
    poly(b.foot);
    g.fill();
    g.stroke();
  }
  for (const [x0, y0, x1, y1] of PAINTED) {
    const [a, b] = at(x0 * S, y0 * S);
    const [c2, d] = at(x1 * S, y1 * S);
    g.fillRect(a, b, c2 - a, d - b);
  }
  for (const [x, z, r] of [[CRATER.x, CRATER.z, CRATER.r + 0.6], ...PLANTERS.map((p) => [p.x, p.z, 0.9])]) {
    g.beginPath();
    g.arc(...at(x, z), r * k, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.flipY = false; // (row 0 is the lawn's north edge, as the shader reads it)
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return { texture, box };
}

// one blade: a tapering strip, two segments up to a point, a metre tall
// (scaled per blade: a mown lawn's is a hand high), its uv.y how far up it is
function bladeGeometry() {
  const w = 0.04;
  const pos = [];
  const uv = [];
  const ys = [0, 0.5];
  for (const y of ys) {
    const half = (w / 2) * (1 - y * 0.8);
    pos.push(-half, y, 0, half, y, 0);
    uv.push(0, y, 1, y);
  }
  pos.push(0, 1, 0);
  uv.push(0.5, 1);
  const idx = [0, 1, 2, 1, 3, 2, 2, 3, 4];
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Each blade's place in the patch (x, z), and two random numbers, as
// [x, z, r1, r2] per blade. The places follow the R2 sequence (Roberts'
// plastic-number one), a little jittered: any first part of it covers the
// whole patch evenly, so the watchdog's thinning (drawing only the first
// blades) leaves thinner grass everywhere, not a hard-edged strip of it
// with bare lawn beside.
export function bladeLayout(count, patch) {
  const offs = new Float32Array(count * 4);
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const g = 1.324717957244746;
  const a1 = 1 / g;
  const a2 = 1 / (g * g);
  const jitter = 0.7 / Math.sqrt(count);
  const frac = (v) => v - Math.floor(v);
  for (let i = 0; i < count; i++) {
    offs[i * 4] = (frac(0.5 + a1 * i + (rand() - 0.5) * jitter) - 0.5) * patch;
    offs[i * 4 + 1] = (frac(0.5 + a2 * i + (rand() - 0.5) * jitter) - 0.5) * patch;
    offs[i * 4 + 2] = rand();
    offs[i * 4 + 3] = rand();
  }
  return offs;
}

export function createGrass(scene, { count = 44000, patch = 30, material }) {
  const geo = bladeGeometry();
  const offs = bladeLayout(count, patch);
  geo.setAttribute('aBlade', new THREE.InstancedBufferAttribute(offs, 4));
  geo.instanceCount = count;

  const mask = lawnMask();
  const U = {
    uCenter: { value: new THREE.Vector2() },
    uPatch: { value: patch },
    uTime: { value: 0 },
    uMask: { value: mask.texture },
    uMaskBox: { value: new THREE.Vector4(...mask.box) },
  };
  const mat = material();
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aBlade;
        uniform vec2 uCenter;
        uniform float uPatch, uTime;
        uniform sampler2D uMask;
        uniform vec4 uMaskBox;
        varying float vUp;
        varying float vTone;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        // lit as the lawn is, from above, with a little of the blade's own facing
        objectNormal = normalize(vec3(0.0, 1.0, 0.0) + objectNormal * 0.25);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // its place on the lawn: fixed, until it's left behind and comes round ahead
          vec2 wp = aBlade.xy + uPatch * floor((uCenter - aBlade.xy) / uPatch + 0.5);
          vec2 muv = (wp - uMaskBox.xy) / (uMaskBox.zw - uMaskBox.xy);
          float grow = texture2D(uMask, muv).r;
          float d = length(wp - uCenter) / uPatch;
          float fade = 1.0 - smoothstep(0.3, 0.5, d);
          float k = grow * fade;
          float h = (0.07 + aBlade.z * 0.08) * k;
          // as thin as it is short: where none grows (off the lawn, past the
          // patch's round edge) the blade is nothing, not a flat dark sliver
          // (those speckled the drives and the helipad, and filled the
          // patch's square corners round him)
          float wide = smoothstep(0.0, 0.2, k);
          float a = aBlade.w * 6.2832;
          float c = cos(a), sn = sin(a);
          vec3 p = vec3(position.x * c * wide, position.y * h, position.x * sn * wide);
          // leaning over in the breeze, more toward the tip
          float gust = sin(uTime * 1.7 + wp.x * 0.19 + wp.y * 0.13) * 0.6 + sin(uTime * 3.1 + wp.x * 0.7 - wp.y * 0.5) * 0.25;
          float lean = (0.3 + gust * 0.35) * position.y * position.y * h;
          p.x += lean * 0.8;
          p.z += lean * 0.5 + (aBlade.z - 0.5) * 0.12 * position.y * h;
          transformed = vec3(wp.x, 0.02, wp.y) + p;
          vUp = position.y;
          vTone = aBlade.z;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;\nvarying float vTone;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // darker at the root, lighter and a touch yellower at the tip, each blade its own
        diffuseColor.rgb *= mix(0.5, 0.96, vUp) * mix(0.88, 1.06, vTone);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.03, 0.86), vUp * vTone * 0.3);`,
      );
  };
  const key = mat.customProgramCacheKey?.() ?? '';
  mat.customProgramCacheKey = () => `${key}|grass-blades`;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.renderOrder = 0;
  scene.add(mesh);
  return {
    mesh,
    // how much of it to draw, 0 to 1 (the frame rate's watchdog thins it)
    density(k) {
      geo.instanceCount = Math.round(count * Math.max(0, Math.min(1, k)));
      mesh.visible = k > 0;
    },
    // round (x, z), at time t (s)
    update(x, z, t) {
      U.uCenter.value.set(x, z);
      U.uTime.value = t;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
      mask.texture.dispose();
    },
  };
}
