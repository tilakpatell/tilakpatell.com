// The land the city stands on, drawn: one mesh 14 km across, raised into
// the hills to the north and the mountains round the edge, and painted in
// its shader from where each point is in the world (./map.js's grid), so
// it's as sharp from the street as from two kilometres up: asphalt with its
// lanes, double yellow and crossings, pavements, car parks, the plaza's
// paving, the parks' paths, the suburbs' lawns and their streets, the
// school's field, the beach, the river's embankments, the hills. At night
// the street lamps leave pools of light on it. The river and the sea are
// one sheet of water that reflects the sky. From far off the streets are
// drawn wider and their paint fades as it goes under a pixel, and the
// water's edge is a line of light, so the city still reads from 2 km up.

import * as THREE from 'three';
import { noiseAtlas } from '../../../lib/texture';
import { BEACH, CITY, COAST, GRID, HILLS, LOT, RIVER, SUBURB, WATER_Y, WORLD, blockKind, groundAt, subBlock } from './map';

export const LAND = 7000; // how far the river runs north, off the edge of the world
const LAND_FAR = 40000; // how far the land goes
const KIND_CODE = { built: 1, park: 2, plaza: 3, lot: 4, gda: 5 };

// From far off. The streets are drawn wider with the distance, from 1× at
// `near` metres to `wide`× at `far`: a 14 m street is under two pixels at
// 2 km, and the grid went to speckle. Where the river and the sea meet the
// land, a line of light a pixel wide (`edge`, times `day` at noon and
// `night` at night), faded in from `edgeFrom` metres off so it's an outline
// from the air, not a stripe at his feet.
export const FAR = { near: 300, far: 2000, wide: 2, edge: [0.78, 0.9, 1], day: 0.55, night: 0.3, edgeFrom: [60, 250] };
const glslVec = (c) => `vec3(${c.map((v) => Number(v).toFixed(3)).join(', ')})`;

// the land past the edge of the world: mountains, rising away from it
const ridge = (x, z) => {
  const n = (a, b, s) => (Math.sin(a / s + Math.sin(b / (s * 1.7)) * 1.3) * Math.cos(b / (s * 0.8) - Math.sin(a / (s * 2.3))) + 1) / 2;
  return n(x, z, 520) * 0.6 + n(z + 900, x, 210) * 0.3 + n(x - z, x + z, 90) * 0.1;
};
// The mountains part for the river as far as its water runs (LAND), `GORGE`
// metres from its banks, then close over it: it ran into a wall of them at
// the world's north edge.
const GORGE = 700;
const smooth01 = (v) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
export function landAt(x, z) {
  const g = groundAt(x, z);
  if (z > COAST - BEACH) return g;
  const out = Math.max(Math.abs(x) - WORLD.half, -z - WORLD.half, 0);
  if (out <= 0) return g;
  const bank = Math.max(RIVER.x0 - x, x - RIVER.x1);
  const past = Math.max(0, -LAND - z);
  if (bank <= 0 && past <= 0) return g;
  const t = Math.min(1, out / 1800);
  const coast = Math.min(1, (COAST - BEACH - z) / 700);
  return Math.max(g, smooth01(t) * (350 + 650 * ridge(x, z)) * coast * smooth01((Math.max(0, bank) + past) / GORGE));
}

// which kind each town block is, as a texture the shader reads by block
function kindTexture() {
  const i0 = Math.ceil(CITY.x0 / GRID.cell);
  const i1 = Math.floor(CITY.x1 / GRID.cell);
  const j0 = Math.ceil(CITY.z0 / GRID.cell);
  const j1 = Math.floor(CITY.z1 / GRID.cell);
  const ni = i1 - i0 + 1;
  const nj = j1 - j0 + 1;
  const data = new Uint8Array(ni * nj * 4);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) data[((j - j0) * ni + (i - i0)) * 4] = KIND_CODE[blockKind(i, j)] ?? 0;
  const tex = new THREE.DataTexture(data, ni, nj, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { tex, box: new THREE.Vector4(i0, j0, ni, nj) };
}

// the suburbs' blocks that aren't houses: the strip, the school, its field, Burger Mart
function subTexture(landmarks) {
  const A = Math.floor((SUBURB.x1 - SUBURB.x0) / SUBURB.cx);
  const m0 = Math.ceil((HILLS + 80) / SUBURB.cz);
  const m1 = Math.floor((COAST - BEACH - 40) / SUBURB.cz);
  const nm = m1 - m0 + 1;
  const data = new Uint8Array(A * nm * 4);
  for (let a = 0; a < A; a++) for (let m = m0; m <= m1; m++) data[((m - m0) * A + a) * 4] = a === 0 ? 1 : 0;
  const at = (x, z) => {
    for (let a = 0; a < A; a++)
      for (let m = m0; m <= m1; m++) {
        const B = subBlock(a, m);
        if (Math.abs(x - B.cx) < B.w / 2 && Math.abs(z - B.cz) < B.d / 2) return (m - m0) * A + a;
      }
    return -1;
  };
  for (const l of landmarks) {
    const code = { school: 2, field: 3, burgermart: 4 }[l.id];
    const k = code ? at(l.x, l.z) : -1;
    if (k >= 0) data[k * 4] = code;
  }
  const tex = new THREE.DataTexture(data, A, nm, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { tex, box: new THREE.Vector4(A, m0, nm, 0) };
}

let atlas = null;
export function noiseTexture() {
  if (atlas) return atlas;
  const size = 256;
  atlas = new THREE.DataTexture(noiseAtlas(size, 5), size, size, THREE.RGBAFormat);
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  return atlas;
}

const GLSL_CONST = `
  #define CELL ${GRID.cell.toFixed(1)}
  #define LOTH ${LOT.toFixed(1)}
  #define RX0 ${RIVER.x0.toFixed(1)}
  #define RX1 ${RIVER.x1.toFixed(1)}
  #define COASTZ ${COAST.toFixed(1)}
  #define BEACHW ${BEACH.toFixed(1)}
  #define HILLZ ${HILLS.toFixed(1)}
  #define CX0 ${CITY.x0.toFixed(1)}
  #define CX1 ${CITY.x1.toFixed(1)}
  #define CZ0 ${CITY.z0.toFixed(1)}
  #define CZ1 ${CITY.z1.toFixed(1)}
  #define SX1 ${SUBURB.x1.toFixed(1)}
  #define SX0 ${SUBURB.x0.toFixed(1)}
  #define SCX ${SUBURB.cx.toFixed(1)}
  #define SCZ ${SUBURB.cz.toFixed(1)}
  #define SST ${SUBURB.street.toFixed(1)}
  #define WHALF ${WORLD.half.toFixed(1)}
  #define FARNEAR ${FAR.near.toFixed(1)}
  #define FARFAR ${FAR.far.toFixed(1)}
  #define FARWIDE ${FAR.wide.toFixed(2)}
  #define EDGEC ${glslVec(FAR.edge)}
  #define EDGEDAY ${FAR.day.toFixed(3)}
  #define EDGENIGHT ${FAR.night.toFixed(3)}
  #define EDGEFROM vec2(${FAR.edgeFrom.map((v) => v.toFixed(1)).join(', ')})
`;

function landMaterial(kinds, subs, uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, {
      uKinds: { value: kinds.tex },
      uKindsBox: { value: kinds.box },
      uSub: { value: subs.tex },
      uSubBox: { value: subs.box },
      uNoise: { value: noiseTexture() },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${GLSL_CONST}
        uniform float uNight;
        uniform float uWater;
        uniform vec3 uTint;
        uniform sampler2D uKinds, uSub, uNoise;
        uniform vec4 uKindsBox, uSubBox;
        varying vec3 vW;
        varying vec3 vWN;
        // distance to the nearest of a set of lines every 'p' metres, offset 'o'
        float lineD(float v, float p, float o) { return (0.5 - abs(fract((v - o) / p) - 0.5)) * p; }
        float band(float d, float w) { return 1.0 - step(w, d); }
        // how much of a painted line 'w' metres wide to draw where a pixel
        // spans 'px' metres: all of it from a pixel and a half, none under half
        float seen(float w, float px) { return smoothstep(0.5, 1.5, w / px); }
        float cityKind(vec2 p) {
          vec2 ij = floor(p / CELL + 0.5);
          vec2 uv = (ij - uKindsBox.xy + 0.5) / uKindsBox.zw;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
          return floor(texture2D(uKinds, uv).r * 255.0 + 0.5);
        }
        float subKind(vec2 p) {
          float a = floor((SX1 - p.x) / SCX);
          float m = floor(p.y / SCZ + 0.5);
          vec2 uv = vec2((a + 0.5) / uSubBox.x, (m - uSubBox.y + 0.5) / uSubBox.z);
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
          return floor(texture2D(uSub, uv).r * 255.0 + 0.5);
        }
        vec3 grass(vec2 p, float n, float g) { return mix(vec3(0.16, 0.25, 0.09), vec3(0.27, 0.36, 0.13), n) * (0.88 + 0.24 * g); }
        `,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 p = vW.xz;
        // (how far off this is, how much wider the streets, how many metres a pixel spans)
        float camD = length(cameraPosition - vW);
        float wide = 1.0 + (FARWIDE - 1.0) * smoothstep(FARNEAR, FARFAR, camD);
        float mpx = max(max(fwidth(p.x), fwidth(p.y)), 1e-3);
        float wpx = max(fwidth(vW.y), 1e-4); // (outside the branches: a derivative inside one is undefined)
        float shore = 0.0;
        vec4 nz = texture2D(uNoise, p / 37.0);
        vec4 nf = texture2D(uNoise, p / 4.3);
        float macro = texture2D(uNoise, p / 610.0).r;
        float g = nf.a;
        vec3 col = grass(p, nz.r, g) * (0.85 + 0.3 * macro);
        float rough = 0.95;
        float lamp = 0.0;
        float isSea = step(COASTZ - BEACHW, p.y);
        if (isSea > 0.5) {
          // the beach: dry sand, then wet, darker, going under
          float t = clamp((p.y - (COASTZ - BEACHW)) / BEACHW, 0.0, 1.0);
          col = mix(vec3(0.78, 0.7, 0.53), vec3(0.42, 0.37, 0.28), smoothstep(0.45, 0.7, t)) * (0.9 + 0.16 * nz.g + 0.08 * g);
          rough = mix(0.95, 0.5, smoothstep(0.45, 0.7, t));
          // the waterline: the pixel of sand just above the sea, surf white
          // (lit as well, as the sand round it is as bright: FAR)
          float above = (vW.y - uWater) / wpx;
          shore = step(0.0, above) * (1.0 - smoothstep(1.0, 2.0, above)) * smoothstep(EDGEFROM.x, EDGEFROM.y, camD);
          col = mix(col, vec3(0.95, 0.97, 1.0), shore);
        } else if (p.x > RX0 - 15.0 && p.x < RX1 + 15.0 && p.y > CZ0 - 120.0) {
          // the river: its bed, and the embankments' concrete
          float bank = step(p.x, RX0) + step(RX1, p.x);
          col = mix(vec3(0.17, 0.16, 0.13), vec3(0.5, 0.49, 0.46) * (0.85 + 0.2 * nz.r), bank);
          float k = fract(p.y / 3.0);
          col *= 1.0 - 0.15 * bank * step(0.95, k);
          rough = 0.9;
        } else if (vW.y > 0.05 || p.y < HILLZ || abs(p.x) > WHALF || p.y < -WHALF) {
          // the hills and the mountains: meadow, scrub and rock by height and slope
          float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
          vec3 meadow = grass(p, nz.r, g) * vec3(1.0, 1.03, 0.9);
          vec3 scrub = mix(vec3(0.2, 0.22, 0.12), vec3(0.32, 0.3, 0.2), nz.g);
          vec3 rock = mix(vec3(0.36, 0.34, 0.31), vec3(0.55, 0.52, 0.48), nz.b) * (0.85 + 0.3 * g);
          col = mix(meadow, scrub, smoothstep(60.0, 200.0, vW.y + 80.0 * (nz.r - 0.5)));
          col = mix(col, rock, smoothstep(0.32, 0.55, slope + 0.12 * (nz.g - 0.5)) + smoothstep(420.0, 700.0, vW.y));
          col = mix(col, vec3(0.92, 0.94, 0.97), smoothstep(780.0, 900.0, vW.y + 60.0 * nz.r) * (1.0 - smoothstep(0.45, 0.7, slope)));
        } else if (p.x <= SX1 + SST * 0.5 && p.x >= SX0) {
          // the suburbs: streets, pavements, lawns
          float dx = lineD(p.x, SCX, SX1);
          float dz = lineD(p.y, SCZ, SCZ * 0.5);
          float d = min(dx, dz);
          float kind = subKind(p);
          vec3 lawn = grass(p, nz.r, g) * (0.94 + 0.08 * step(0.5, fract((p.x + p.y * 0.02) / 1.6)));
          col = lawn;
          float road = (SST * 0.5 - 1.2) * wide;
          if (d < road) {
            col = vec3(0.19, 0.19, 0.2) * (0.85 + 0.25 * nz.r + 0.1 * g);
            rough = 0.88;
            // a faint dashed line down the middle of the long streets
            float mid = (dz < dx) ? dz : dx;
            float along = (dz < dx) ? p.x : p.y;
            col = mix(col, vec3(0.72, 0.62, 0.3), band(mid, 0.12) * step(0.55, fract(along / 8.0)) * step(SST * 0.5, max(dx, dz)) * seen(0.24, mpx));
          } else if (d < road + 3.2) {
            col = vec3(0.6, 0.59, 0.56) * (0.9 + 0.15 * nz.r);
            rough = 0.9;
          } else if (kind > 0.5) {
            vec2 l = vec2(dx, dz);
            if (kind < 1.5 || kind > 3.5) {
              // the strip and Burger Mart: car parks with their bays
              col = vec3(0.21, 0.21, 0.22) * (0.85 + 0.25 * nz.r);
              float bay = band(lineD(p.y, 3.0, 0.0), 0.08) * step(SCX * 0.5 - 40.0, dx) * seen(0.16, mpx);
              col = mix(col, vec3(0.85), bay * 0.8);
              rough = 0.85;
            } else if (kind < 2.5) {
              col = mix(vec3(0.55, 0.54, 0.5), lawn, step(0.5, nz.g));
            } else {
              // the school's field: stripes and yard lines
              col = mix(vec3(0.2, 0.4, 0.14), vec3(0.24, 0.46, 0.17), step(0.5, fract(p.x / 6.0)));
              col = mix(col, vec3(0.92), band(lineD(p.x, 9.0, 0.0), 0.12) * step(10.0, dz) * seen(0.24, mpx));
              rough = 0.95;
            }
          }
          lamp = exp(-dot(vec2(dz - SST * 0.5 - 1.0, lineD(p.x, 45.0, 0.0)), vec2(dz - SST * 0.5 - 1.0, lineD(p.x, 45.0, 0.0))) / 30.0);
        } else if (p.x >= CX0 - 40.0 && p.x <= CX1 + 40.0 && p.y >= CZ0 - 40.0 && p.y <= CZ1 + 40.0) {
          // the city: streets every 80 m, the blocks between
          float dx = lineD(p.x, CELL, CELL * 0.5);
          float dz = lineD(p.y, CELL, CELL * 0.5);
          float d = min(dx, dz);
          vec2 l = p - floor(p / CELL + 0.5) * CELL; // in the block, from its middle
          float kind = cityKind(p);
          if (d < 7.0 * wide) {
            vec3 asphalt = vec3(0.13, 0.13, 0.14) * (0.8 + 0.3 * nz.r + 0.12 * g);
            // the wheels' tracks, a little darker and smoother
            float lane = (dz < dx) ? dz : dx;
            asphalt *= 1.0 - 0.12 * band(abs(fract(lane / 3.5) - 0.5), 0.18) * seen(1.26, mpx);
            col = asphalt;
            rough = 0.82;
            bool cross = dx < 10.0 && dz < 10.0;
            if (!cross) {
              float along = (dz < dx) ? p.x : p.y;
              // the double yellow, the lanes' dashes
              col = mix(col, vec3(0.86, 0.68, 0.18), band(abs(lane - 0.22), 0.09) * seen(0.3, mpx));
              col = mix(col, vec3(0.88), band(abs(lane - 3.5), 0.08) * step(0.55, fract(along / 9.0)) * seen(0.16, mpx));
              // the crossings and the stop lines, just short of the corner
              float o = (dz < dx) ? dx : dz;
              col = mix(col, vec3(0.9), step(10.5, o) * step(o, 13.5) * step(0.5, fract(lane / 1.1)) * seen(0.55, mpx));
              col = mix(col, vec3(0.9), step(14.0, o) * step(o, 14.5) * step(lane, 7.0) * step(0.3, lane) * seen(0.5, mpx));
            }
          } else if (d < 7.0 * wide + 3.0) {
            col = vec3(0.56, 0.55, 0.52) * (0.88 + 0.18 * nz.r);
            col *= 1.0 - 0.1 * band(abs(fract((dz < dx ? p.x : p.y) / 1.8) - 0.5), 0.03) * seen(0.11, mpx);
            rough = 0.9;
          } else if (kind < 0.5) {
            col = grass(p, nz.r, g);
          } else if (kind < 1.5) {
            col = vec3(0.42, 0.41, 0.39) * (0.85 + 0.25 * nz.r);
            rough = 0.9;
          } else if (kind < 2.5) {
            // a park: lawns and a cross of paths
            col = grass(p, nz.r, g) * vec3(0.95, 1.05, 0.95);
            float path = band(min(abs(l.x), abs(l.y)), 2.2) + band(abs(length(l) - 18.0), 1.6);
            col = mix(col, vec3(0.62, 0.56, 0.45) * (0.9 + 0.2 * nz.g), clamp(path, 0.0, 1.0));
          } else if (kind < 3.5) {
            // the plaza: pale paving in squares, a ring round the hall
            col = vec3(0.7, 0.68, 0.63) * (0.9 + 0.12 * nz.r);
            col *= 1.0 - 0.12 * (band(abs(fract(l.x / 3.0) - 0.5), 0.03) + band(abs(fract(l.y / 3.0) - 0.5), 0.03)) * seen(0.18, mpx);
            col = mix(col, vec3(0.55, 0.42, 0.24), band(abs(length(l) - 24.0), 0.8));
            rough = 0.75;
          } else if (kind < 4.5) {
            // a car park
            col = vec3(0.17, 0.17, 0.18) * (0.85 + 0.25 * nz.r);
            col = mix(col, vec3(0.86), band(abs(fract(l.x / 2.8) - 0.5) * 2.8, 0.07) * step(4.0, abs(abs(l.y) - 13.0)) * step(abs(l.y), 24.0) * seen(0.14, mpx));
            rough = 0.85;
          } else {
            // the GDA: concrete, and a helipad
            col = vec3(0.45, 0.45, 0.43) * (0.85 + 0.2 * nz.r);
            vec2 h = l - vec2(18.0, 16.0);
            float r = length(h);
            col = mix(col, vec3(0.25, 0.27, 0.27), step(r, 8.0));
            col = mix(col, vec3(0.92, 0.85, 0.3), band(abs(r - 7.0), 0.3));
            float H = step(abs(h.x), 2.4) * step(abs(h.y), 3.0) * (step(1.6, abs(h.x)) + step(abs(h.y), 0.4));
            col = mix(col, vec3(0.92), clamp(H, 0.0, 1.0));
          }
          // the street lamps: along both pavements every 30 m
          float lx = dx - 8.6;
          float lz = dz - 8.6;
          vec2 a = vec2(lx, lineD(p.y, 30.0, 0.0));
          vec2 b = vec2(lz, lineD(p.x, 30.0, 0.0));
          lamp = exp(-dot(a, a) / 9.0) * step(d, 11.0) + exp(-dot(b, b) / 9.0) * step(d, 11.0);
        } else {
          // farmland east of town
          float f = step(0.5, fract(p.y / 9.0 + nz.r * 0.3));
          col = mix(col, mix(vec3(0.36, 0.33, 0.18), vec3(0.25, 0.3, 0.12), f), step(CX1 + 120.0, p.x) * 0.7);
        }
        // (the colours above are as they'd be picked on a screen: into linear light)
        diffuseColor.rgb = pow(col, vec3(2.2));
        float landRough = rough;
        float landLamp = lamp;
        float landShore = shore;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = landRough;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        diffuseColor.rgb *= uTint;
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * landLamp * uNight * 0.16;
        totalEmissiveRadiance += EDGEC * landShore * mix(EDGEDAY, EDGENIGHT, uNight);`,
      );
  };
  m.customProgramCacheKey = () => 'inv-land';
  return m;
}

// The water: dark, smooth, catching the sky, its surface moving; the
// river's banks a line of light from far off (FAR).
function waterMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0f2a35, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uNight = uniforms.uNight;
    sh.uniforms.uWater = uniforms.uWater;
    sh.uniforms.uNoise = { value: noiseTexture() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_CONST}\nuniform float uTime;\nuniform float uNight;\nuniform float uWater;\nuniform sampler2D uNoise;\nvarying vec3 vW;`)
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 p = vW.xz;
          float e = 0.6;
          vec2 a = p / 23.0 + vec2(uTime * 0.021, uTime * 0.013);
          vec2 b = p / 9.0 - vec2(uTime * 0.034, -uTime * 0.027);
          float h0 = texture2D(uNoise, a).r + 0.5 * texture2D(uNoise, b).r;
          float hx = texture2D(uNoise, a + vec2(e / 23.0, 0.0)).r + 0.5 * texture2D(uNoise, b + vec2(e / 9.0, 0.0)).r;
          float hz = texture2D(uNoise, a + vec2(0.0, e / 23.0)).r + 0.5 * texture2D(uNoise, b + vec2(0.0, e / 9.0)).r;
          // flatter far off, so the horizon doesn't shimmer
          float far = 1.0 - smoothstep(200.0, 2500.0, length(cameraPosition - vW));
          vec3 wn = normalize(vec3(-(hx - h0) * 2.4 * far, 1.0, -(hz - h0) * 2.4 * far));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // the pixel of water along each bank, down to the beach
          float e = min(abs(vW.x - RX0), abs(vW.x - RX1)) / max(fwidth(vW.x), 1e-4);
          float edge = (1.0 - smoothstep(1.0, 2.0, e)) * step(vW.z, COASTZ - BEACHW) * smoothstep(EDGEFROM.x, EDGEFROM.y, length(cameraPosition - vW));
          totalEmissiveRadiance += EDGEC * edge * mix(EDGEDAY, EDGENIGHT, uNight);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'inv-water';
  return m;
}

export function buildGround(world, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'ground';
  const uniforms = { uNight: { value: 0 }, uTime: { value: 0 }, uWater: { value: WATER_Y }, uTint: { value: new THREE.Vector3(1, 1, 1) } };

  // the land: a disc of rings round the city, 45 m apart over the world and
  // further apart beyond it, out to 40 km (the mountains round the basin,
  // the sea to the south), so from high up there's no edge to it
  const radii = [0];
  while (radii[radii.length - 1] < WORLD.half * 2.4) radii.push(radii[radii.length - 1] + (small ? 70 : 45));
  while (radii[radii.length - 1] < LAND_FAR) radii.push(radii[radii.length - 1] * 1.07);
  const segs = small ? 220 : 320;
  const pos = [];
  for (const r of radii)
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x, landAt(x, z), z);
      if (r === 0) break;
    }
  const index = [];
  for (let k = 0; k < segs; k++) index.push(0, 1 + ((k + 1) % segs), 1 + k);
  for (let i = 1; i < radii.length - 1; i++) {
    const a0 = 1 + (i - 1) * segs;
    const a1 = 1 + i * segs;
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % segs;
      index.push(a0 + k, a0 + k1, a1 + k, a0 + k1, a1 + k1, a1 + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, landMaterial(kindTexture(), subTexture(world.landmarks), uniforms));
  land.receiveShadow = true;
  land.name = 'land';
  group.add(land);

  // the water: the sea out to the horizon, and the river down to it
  const wm = waterMaterial(uniforms);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 30000, 1, 1).rotateX(-Math.PI / 2), wm);
  sea.position.set(0, WATER_Y, COAST - BEACH + 15000);
  const riverLen = COAST - BEACH + LAND + 40;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0, riverLen, 1, 1).rotateX(-Math.PI / 2), wm);
  river.position.set((RIVER.x0 + RIVER.x1) / 2, WATER_Y, -LAND + riverLen / 2);
  for (const w of [sea, river]) {
    w.receiveShadow = true;
    w.name = 'water';
    group.add(w);
  }

  return {
    group,
    uniforms,
    setNight(k) {
      uniforms.uNight.value = k;
    },
    // a dimension's water level and palette (./dimensions.js)
    setDimension({ water = WATER_Y, tint = null } = {}) {
      uniforms.uWater.value = water;
      sea.position.y = water;
      river.position.y = water;
      uniforms.uTint.value.set(...(tint ?? [1, 1, 1]));
    },
    update(t) {
      uniforms.uTime.value = t;
    },
  };
}
