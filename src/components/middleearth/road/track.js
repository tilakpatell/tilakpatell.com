// The road underfoot: a ribbon laid along a stage’s road over its ground,
// shaped and shaded in the road’s own frame (metres across, metres along),
// as the ground map, a metre a texel, never could draw it. A lane has two
// wheel ruts and the grass down the crown between them; a path has one
// trodden line. Either way the shoulders are loose dirt with stones in it,
// the edge breaks into the verge, and where the stage is wet, water stands
// in the ruts with the sky in it. Its soil’s road scan (soil.js’s) is the
// dirt close up. The ground’s paint wears the road only as wide as the
// ribbon (ground.js’s `wear`), so the verge’s grass comes up to its edge.
//
//   lift(row, x) → metres over the land x metres across (pure): the camber, the ruts
//   trackGeometry(land, row, { tier }) → a BufferGeometry: rows STEP apart down the
//     whole road, COLS across, each vertex the land exactly under it plus its lift;
//     uv (metres across, metres along) and aDry (0 on a river's water: cut there)
//   createTrack(land, row, { house, soil, tier }) → { mesh, dispose } | null
//     (null for a stage without a track, stages/tracks.js, and on low: the paint is its road there)
//   trackJob(land, row, opts): the same as a generator, a few rows a step (terrain.js's run)

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { abs, attribute, cameraPosition, dot, exp, float, floor, length, mat2, max, mix, mx_cell_noise_float, mx_noise_float, mx_worley_noise_float, normalWorldGeometry, normalize, positionWorld, pow, sign, smoothstep, texture, uniform, uv, vec2, vec3 } from 'three/tsl';
import { loadScan, scanOf } from '../../../lib/three/scansNodes';
import { asNode, onColor, onLight } from '../../../lib/three/hookNodes';
import { run } from './terrain';

const STEP = { mid: 1, high: 0.5, ultra: 0.5 }; // m between rows
const COLS = { mid: 13, high: 19, ultra: 19 }; // across, edge to edge
const LIFT = 0.035; // m over the land at its edge
const CAMBER = 0.03; // m its middle stands over its shoulders
const RUT = { depth: 0.035, half: 0.22 }; // a lane's ruts, m
const TROD = { depth: 0.015, half: 0.4 }; // a path's trodden line, m
const NEAR = 24; // m: the close-up whole to here (as soil.js's)
const FAR = 80; // m: gone by here
const LUMA = vec3(0.2126, 0.7152, 0.0722);
const HUE = 0.35; // (the scan's own colour, as soil.js has it)
const TURN = mat2(0.8, -0.6, 0.6, 0.8);
const STONE = { light: new THREE.Color(0x9a948a), dark: new THREE.Color(0x4e4a44) };
const POOL = new THREE.Color(0x1c2024);

export function lift(row, x) {
  const half = row.width / 2;
  const a = Math.min(1, Math.abs(x) / half);
  let h = LIFT + CAMBER * (1 - a * a);
  if (row.kind === 'lane') h -= RUT.depth * Math.exp(-(((Math.abs(x) - row.ruts) / RUT.half) ** 2));
  else h -= TROD.depth * Math.exp(-((x / TROD.half) ** 2));
  return h;
}

export function trackGeometry(land, row, opts) {
  return run(geometryJob(land, row, opts));
}

// (a few rows a step: the land exactly under every vertex is its noise each
// time, and a stage ahead is built a few milliseconds a frame, terrain.js's run)
function* geometryJob(land, row, { tier = 'high' } = {}) {
  const road = land.road;
  const step = STEP[tier] ?? STEP.high;
  const cols = COLS[tier] ?? COLS.high;
  const half = row.width / 2;
  const n = Math.max(1, Math.ceil(road.length / step));
  const pos = new Float32Array((n + 1) * cols * 3);
  const uvs = new Float32Array((n + 1) * cols * 2);
  const dry = new Float32Array((n + 1) * cols);
  for (let i = 0; i <= n; i++) {
    const m = (i / n) * road.length;
    const p = road.pointAt(m);
    const [tx, , tz] = p.tangent;
    const l = Math.hypot(tx, tz) || 1;
    // (across: to the walker's left as they face along the road)
    const nx = tz / l;
    const nz = -tx / l;
    for (let j = 0; j < cols; j++) {
      const off = -half + (j / (cols - 1)) * row.width;
      const x = p.x + nx * off;
      const z = p.z + nz * off;
      const k = i * cols + j;
      pos.set([x, land.field(x, z) + lift(row, off), z], k * 3);
      uvs.set([off, m], k * 2);
      dry[k] = land.wet?.(x, z) ? 0 : 1;
    }
    if (i % 24 === 23) yield;
  }
  const index = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      // (wound to face up: the other way, every triangle is culled from every camera)
      index.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('aDry', new THREE.BufferAttribute(dry, 1));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const linear = (hex) => new THREE.Color(hex);

export function createTrack(land, row, opts) {
  return run(trackJob(land, row, opts));
}

export function* trackJob(land, row, { house = null, soil = null, tier = 'high' } = {}) {
  if (!row || tier === 'low' || !land?.road) return null;
  const geometry = yield* geometryJob(land, row, { tier });
  const raw = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  const m = asNode(raw);
  const lane = row.kind === 'lane';
  const u = {
    uDirt: uniform(linear(soil?.dirt ?? 0xb59d72)),
    uGrass: uniform(linear(soil?.greens?.[1] ?? 0x5c8f3a).multiplyScalar(0.8)),
    uStoneLight: uniform(STONE.light.clone()),
    uStoneDark: uniform(STONE.dark.clone()),
    uPool: uniform(POOL.clone()),
    uScan: texture(null),
    uScanK: uniform(new THREE.Vector2(0.5, 0.6)),
  };
  // (a blank till the scan comes, its own; the scan is the loader's, shared, and not this one's to dispose)
  const blank = new THREE.DataTexture(Uint8Array.from([153, 153, 153, 255]), 1, 1);
  blank.needsUpdate = true;
  u.uScan.value = blank;
  const role = soil?.scans?.road;
  if (role && scanOf(role))
    loadScan(role).then((got) => {
      if (!got?.map) return;
      u.uScan.value = got.map;
      const r = scanOf(role);
      u.uScanK.value.set(1 / (r.metres ?? 2), Math.pow(r.mean ?? 0.8, 2.2));
    });

  // where it is, in its own frame: across and along, m
  const p = uv();
  const ax = abs(p.x);
  const half = float(row.width / 2);
  const side = sign(p.x);
  const near = () => smoothstep(NEAR, FAR, length(positionWorld.sub(cameraPosition))).oneMinus();
  // (the edge broken by two noises down the road, each side its own)
  const ragged = () => mx_noise_float(vec2(p.y.mul(0.55), side.mul(7.3))).mul(0.1).add(mx_noise_float(vec2(p.y.mul(2.7), side.mul(3.1))).mul(0.05));
  const reach = () => ax.div(half).add(ragged());
  // the ruts (a lane's two, a path's one line), worn where the wheels and the feet go
  const worn = () => (lane ? exp(ax.sub(row.ruts).div(RUT.half).pow2().negate()) : exp(p.x.div(TROD.half + 0.05).pow2().negate()).mul(0.65));

  // its edge, and none on the water
  m.opacityNode = smoothstep(0.86, 0.98, reach()).oneMinus().mul(attribute('aDry', 'float'));
  m.alphaTest = 0.5;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;

  onColor(
    m,
    (d) => {
      const k = near();
      const a = reach();
      // the dirt close up: the scan's light and shade over the soil's own colour, at two sizes
      const s1 = u.uScan.sample(p.mul(u.uScanK.x)).rgb;
      const s2 = u.uScan.sample(TURN.mul(p).mul(u.uScanK.x.mul(0.37))).rgb;
      const scan = mix(s1, s1.mul(s2).div(u.uScanK.y.max(0.05)), 0.5).div(u.uScanK.y.max(0.05));
      const detail = mix(vec3(dot(scan, LUMA)), scan, HUE);
      const rut = worn().toVar();
      // (packed in the ruts: less of the grain, darker)
      let c = u.uDirt.mul(mix(vec3(1), detail, k.mul(mix(0.9, 0.45, rut))));
      // the shoulders loose and paler; the ruts dark, fading with distance as they thin to a line
      const far = smoothstep(40, 140, length(positionWorld.sub(cameraPosition))).oneMinus();
      // (a lane's ruts hold the wet, dark; a path's trodden line is packed pale)
      c = c.mul(mix(1, 1.08, smoothstep(0.55, 0.9, a))).mul(mix(1, lane ? 0.62 : 1.18, rut.mul(far.mul(0.7).add(0.3))));
      // the grass: down a lane's crown in patches, and the verge's creeping in at the edge
      const crown = lane ? smoothstep(0.12, 0.42, ax).oneMinus().mul(smoothstep(-0.15, 0.25, mx_noise_float(p.mul(vec2(1.2, 0.35))))).mul(row.crown ?? 0) : float(0);
      const verge = smoothstep(0.7, 0.95, a).mul(smoothstep(-0.2, 0.3, mx_noise_float(p.mul(1.7))));
      const green = max(crown, verge.mul(0.8));
      c = mix(c, u.uGrass.mul(mix(vec3(1), detail, k.mul(0.5))), green);
      // stones: a cell's nearest point near enough, each its own grey, fewer pressed into the ruts
      // (each with the shade it casts round its foot, so it sits in the dirt rather than on it)
      if (row.stones > 0) {
        const q = p.mul(2.4);
        const f = mx_worley_noise_float(q).toVar();
        const some = k.mul(rut.mul(0.7).oneMinus()).mul(green.oneMinus()).mul(smoothstep(1 - row.stones, 1.01 - row.stones * 0.6, mx_cell_noise_float(floor(q))));
        const stone = smoothstep(0.13, 0.19, f).oneMinus().mul(some);
        const foot = smoothstep(0.16, 0.27, f).oneMinus().sub(stone).mul(some);
        c = c.mul(foot.mul(0.3).oneMinus());
        c = mix(c, mix(u.uStoneDark, u.uStoneLight, mx_cell_noise_float(floor(q).add(17.3))).mul(f.mul(-2.2).add(1.25)), stone);
      }
      // water standing in the ruts, where the ground dips
      if (row.puddles > 0) {
        const pool = smoothstep(0.35, 0.6, rut.mul(smoothstep(-0.1, 0.25, mx_noise_float(p.mul(vec2(0.9, 0.22)).add(3.1))))).mul(row.puddles);
        c = mix(c, u.uPool, pool);
      }
      return d.rgb.mul(c);
    },
    'road:track',
    u,
  );
  // the sky off the puddles, low to the eye (the look's high fog is the sky's colour)
  if (row.puddles > 0 && house?.uniforms?.uLookFogHigh)
    onLight(
      m,
      (light) => {
        const rut = worn();
        const pool = smoothstep(0.35, 0.6, rut.mul(smoothstep(-0.1, 0.25, mx_noise_float(p.mul(vec2(0.9, 0.22)).add(3.1))))).mul(row.puddles);
        const view = normalize(cameraPosition.sub(positionWorld));
        const fresnel = pow(float(1).sub(max(dot(view, normalize(normalWorldGeometry)), 0)), 3);
        // (faint, and gone with distance: down a long street at a slant the sheen read as white lines painted on it)
        const near = smoothstep(8, 40, length(positionWorld.sub(cameraPosition))).oneMinus();
        return light.add(house.uniforms.uLookFogHigh.mul(pool.mul(near).mul(fresnel.mul(0.3).add(0.04))));
      },
      'road:pools',
    );
  const mesh = new THREE.Mesh(geometry, m);
  mesh.name = 'road:track';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return {
    mesh,
    dispose() {
      geometry.dispose();
      m.dispose();
      if (raw !== m) raw.dispose();
      blank.dispose();
    },
  };
}
