// The capital ships' hulls as the films and the 2017 game have them, where
// the export lost it. The game's kits draw a capital's great plates (its
// `Hull`, `MainHull` and `PanelTile` materials) with a tiling shader of its
// own, and its windows with a lit glass; neither came through, so a Star
// Destroyer's deck, a Venator's, a Lucrehulk's ring and an Arquitens' flanks
// were flat grey slabs with no texture at all, its windows dark film over
// them, and its engines (every mesh named for one made white-hot whole)
// white blobs. Here, on the classic renderer (the galaxy's):
//
// - a hull material with no colour map is plated: big plates staggered like
//   brickwork, each its own shade, smaller plates inside them, their seams
//   cut in (a groove the light catches), here and there a raised panel or a
//   vent, and, on the walls, rows of small lit windows; all of it in the
//   ship's own frame and metres (the plates the same size on every mesh,
//   fixed to the hull as it flies), and fading to its mean where a pixel is
//   wider than a seam, so it never shimmers far off;
// - the windows' glass is lit, a cool white;
// - an engine glows only where it faces aft at the stern (its nozzles),
//   blue-white, the housing round it its own texture (and a hull metal the
//   site took for a lamp, the MC80's `light_Met`, is metal again); and each
//   nozzle has a soft glow drawn
//   over it (one draw a ship: `glows`), so the stern burns as it does on screen.
//
// dressCapital(holder, kind, { plating, size, lite }) after models.js has fitted the model (its
// holder: the unit frame, nose +z, 1 long); patched materials are copies
// (one per mesh that needs its own frame), the template's to keep.
// isCapital(kind); plateTint(kind) and LENGTH (metres a ship is long, so the
// plates are a plate's size on any of them) are the data.

import * as THREE from 'three';
import { HULLS } from '../universe/wars';
import { panes, patchShaders, plate } from './capitalPlating';

// metres long, Wookieepedia's (the plates are metres, whatever a ship's drawn at)
export const LENGTH = { destroyer: 1600, executor: 19000, interdictor: 1600, venator: 1137, acclamator: 752, moncal: 1200, nebulon: 300, corvette: 150, hammerhead: 315, lightcruiser: 325, gozanti: 64, transport: 90, providence: 1088, munificent: 825, lucrehulk: 3170 };
// the plating's grey by kind: the films' light Imperial grey, the Republic's
// paler one, the Separatists' tan and blue-grey
const TINT = { destroyer: '#878d95', interdictor: '#878d95', executor: '#7c8188', venator: '#a3a6a8', acclamator: '#9a9da0', lightcruiser: '#8e949b', lucrehulk: '#8f8170', providence: '#7f8893', munificent: '#8d8a84', moncal: '#9d8f74' };
export const plateTint = (kind) => TINT[kind] ?? '#8c9198';
// an engine's light, by side (the Separatists' a little violet)
const ENGINE = { lucrehulk: [0.75, 0.75, 1.6], providence: [0.75, 0.75, 1.6], munificent: [0.75, 0.75, 1.6] };
const engineOf = (kind) => ENGINE[kind] ?? [0.62, 0.86, 1.7];

export const isCapital = (kind) => Boolean(HULLS[kind]) && kind in LENGTH;

const HULL = /hull|paneltile|tiling|plate/i;
const WINDOW = /window/i;
const ENGINE_NAME = /engine|thruster/i;
const RED = /^red$/i;
const LIT = /emissive/i;
// (the kinds whose own maps are next to flat colour at a ship's size, a few
// KB each, or one scratched metal tiled over the whole of it: plated over them)
const PLATE_ALL = new Set(['acclamator', 'executor', 'gozanti']);
const LAMP = /glow|lamp|bluelight|redlight|whitelight|beacon/i;
// (black and glass: no paint to layer)
const BARE_BLACK = /^dark$|glass/i;
// paint, as the game's is: a dielectric (the export gave most of the
// game's materials a metal's whole shine with nothing to reflect but a dark
// sky, a navy speckle where the films have grey plating; the game's
// capitals' materials are dielectrics, their metal only where a mask says,
// bf2-re's findings/17-materials.md), so the parts and the hull's own map
// (capitalHull.js, metalness 0) are one paint
const PAINT = { metalness: 0, roughness: 0.58 };
const saturation = (c) => {
  const hi = Math.max(c.r, c.g, c.b);
  return hi > 0 ? (hi - Math.min(c.r, c.g, c.b)) / hi : 0;
};
const painted = (m) => {
  // (down to paint, never up: a material the model made plain stays plain)
  m.metalness = Math.min(m.metalness, m.metalnessMap ? 0.5 : PAINT.metalness);
  if (!m.roughnessMap) m.roughness = PAINT.roughness;
  return m;
};
const MARKING = '#8e2b22'; // (the Republic's red)

// ── the engines: lit where they face aft ──
const AFT_VERT = `
#ifndef CAP_UNIT
#define CAP_UNIT
uniform mat4 uUnit; // (the plating's and the engines' both: declared once)
#endif
varying float vAft;
varying float vAftZ;`;
function burn(m, unit, colour) {
  m.userData.burning = true;
  m.emissive?.setRGB(...colour);
  m.emissiveIntensity = 1;
  patchShaders(m, 'aft', (shader) => {
    shader.uniforms.uUnit = { value: unit };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${AFT_VERT}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAft = -normalize( mat3( uUnit ) * objectNormal ).z;\nvAftZ = ( uUnit * vec4( position, 1.0 ) ).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAft;\nvarying float vAftZ;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float aftLit = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );\n  totalEmissiveRadiance *= smoothstep( 0.55, 0.9, vAft ) * smoothstep( 0.25, 0.8, aftLit ) * ( 1.0 - smoothstep( -0.3, -0.15, vAftZ ) ) * 1.6;');
  });
}

// ── the nozzles' glow: one draw a ship, each a soft disc facing the eye ──
const GLOW_VERT = `
attribute vec2 corner;
attribute float size;
varying vec2 vCorner;
void main() {
  vCorner = corner;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  float scale = length( modelMatrix[ 0 ].xyz );
  mv.xy += corner * size * scale;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
uniform vec3 uColour;
varying vec2 vCorner;
void main() {
  float r = length( vCorner );
  if ( r > 1.0 ) discard;
  float a = exp( -r * r * 7.0 ) * 0.55 + exp( -r * r * 40.0 ) * 0.8;
  gl_FragColor = vec4( uColour * a, 1.0 );
}`;
// the engine meshes' faces that look aft at the ship's stern, each patch of
// them that shares corners a nozzle's mouth ([x, y, z, r] in the unit frame)
export function nozzlesOf(meshes) {
  const faces = []; // [corners (three [x, y, z])]
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const count = index ? index.count : pos.count;
    const at = (k) => (index ? index.getX(k) : k);
    for (let k = 0; k + 2 < count; k += 3) {
      a.fromBufferAttribute(pos, at(k)).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, at(k + 1)).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, at(k + 2)).applyMatrix4(mesh.matrixWorld);
      n.subVectors(c, b).cross(e.subVectors(a, b));
      if (n.lengthSq() < 1e-14) continue;
      n.normalize();
      // (wound either way: a face along the ship's axis, whichever side)
      if (Math.abs(n.z) < 0.85) continue;
      faces.push([a.toArray(), b.toArray(), c.toArray()]);
    }
  }
  if (!faces.length) return [];
  // (only the hindmost: a nozzle's mouth, not a step in the housing ahead of it)
  const back = Math.min(...faces.map((f) => Math.min(f[0][2], f[1][2], f[2][2])));
  const near = faces.filter((f) => (f[0][2] + f[1][2] + f[2][2]) / 3 < back + 0.04);
  const key = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
  const up = near.map((_, i) => i);
  const find = (i) => {
    while (up[i] !== i) i = up[i] = up[up[i]];
    return i;
  };
  const owner = new Map();
  near.forEach((f, i) => {
    for (const p of f) {
      const k = key(p);
      if (owner.has(k)) up[find(i)] = find(owner.get(k));
      else owner.set(k, i);
    }
  });
  const groups = new Map();
  near.forEach((f, i) => {
    const g = find(i);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(...f);
  });
  const out = [...groups.values()].map((pts) => {
    const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const r = Math.max(...pts.map((p) => Math.hypot(p[0] - x, p[1] - y)));
    return [x, y, Math.min(...pts.map((p) => p[2])), r];
  });
  // (the biggest first; a sliver or a speck is no nozzle)
  const big = Math.max(...out.map((o) => o[3]));
  return out
    .filter((o) => o[3] > big * 0.25)
    .sort((p, q) => q[3] - p[3])
    .slice(0, 24);
}
function glowsOf(nozzles, colour, k) {
  const n = nozzles.length;
  const position = new Float32Array(n * 4 * 3);
  const corner = new Float32Array(n * 4 * 2);
  const size = new Float32Array(n * 4);
  const index = [];
  const C = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  nozzles.forEach(([x, y, z, r], i) => {
    for (let c = 0; c < 4; c++) {
      position.set([x / k, y / k, (z - r * 0.15) / k], (i * 4 + c) * 3);
      corner.set(C[c], (i * 4 + c) * 2);
      size[i * 4 + c] = (r * 1.9) / k;
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius += Math.max(...nozzles.map((o) => o[3])) * 3;
  const mat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: { uColour: { value: new THREE.Color(...colour) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glow = new THREE.Mesh(geo, mat);
  glow.renderOrder = 3;
  glow.userData.glows = true;
  return glow;
}

// (`plating`: off on the lowest detail, where a phone's every fragment counts;
// the windows and the engines are lit whatever the detail; `size` and
// `lite`: the plating's detail map and a phone's lighter hand, capitalPlating.js)
export function dressCapital(holder, kind, { plating = true, size = 2048, lite = false } = {}) {
  if (!isCapital(kind)) return null;
  holder.updateMatrixWorld(true);
  const k = holder.scale.x;
  const length = LENGTH[kind];
  const tint = new THREE.Color(plateTint(kind));
  const colour = engineOf(kind);
  const engines = [];
  const meshes = [];
  holder.traverse((o) => o.isMesh && meshes.push(o));
  for (const mesh of meshes) {
    const unit = mesh.matrixWorld.clone();
    const one = (m) => {
      if (!m?.isMeshStandardMaterial) return m;
      // (the game's own hull, capitalHull.js: its maps are the game's, nothing laid over them)
      if (m.userData.gameHull) return m;
      // the game's lights and engine glow in one material of their own (the
      // Nebulon-B's `Emissive`, bare as it came: tune() greyed it, and its
      // mask, which lights only its windows and lamps, didn't come through):
      // dark, small lights on it as on the window strips, and its faces aft
      // the nozzles' glow
      if (LIT.test(m.name) && !m.map) {
        const l = m.clone();
        l.color.setRGB(0.12, 0.13, 0.15);
        l.emissive.setRGB(1.0, 0.88, 0.7);
        l.emissiveIntensity = plating ? 1.4 : 0.3;
        if (plating) panes(l, unit, length);
        engines.push(mesh);
        return l;
      }
      // a kind whose own maps are next to flat colour: plated over them
      if (PLATE_ALL.has(kind) && m.map && !m.transparent && !ENGINE_NAME.test(m.name)) {
        const p = painted(m.clone());
        if (plating) plate(p, unit, length, { size, lite });
        return p;
      }
      // the hull's great plates: no colour map of their own (the Venator's
      // red markings came as a bare material named for their colour)
      // (and a bare one a model left black, a map it never had: its hull's
      // grey, in shadow; one named for it is black on purpose)
      const black = !m.map && !LAMP.test(m.name) && !BARE_BLACK.test(m.name) && m.color.r + m.color.g + m.color.b < 0.06;
      if (!m.map && !m.transparent && (black || HULL.test(m.name) || RED.test(m.name) || m.color.getHex() === 0x6b6f76 || m.color.getHex() === 0xffffff)) {
        const p = painted(m.clone());
        p.color.set(RED.test(m.name) ? MARKING : tint);
        if (black) p.color.multiplyScalar(0.5);
        if (plating) plate(p, unit, length, { size, lite });
        return p;
      }
      // the windows' glass: dark, and on it rows of small lit panes
      if (WINDOW.test(m.name) && m.transparent) {
        const w = m.clone();
        w.color.setRGB(0.03, 0.035, 0.045);
        w.emissive.setRGB(1.0, 0.88, 0.7);
        // (without the panes, the lowest detail's, a strip's mean light: never a slab)
        w.emissiveIntensity = plating ? 1.6 : 0.3;
        w.opacity = 0.9;
        if (plating) panes(w, unit, length);
        return w;
      }
      // a lamp, glass, black: as it came
      if (m.transparent || LAMP.test(m.name) || BARE_BLACK.test(m.name)) return m;
      // (a bare one of a strong colour a model didn't name, the Acclamator's
      // blue ones: a lamp, alight in its colour)
      if (!m.map && saturation(m.color) > 0.6) {
        const l = m.clone();
        l.emissive.copy(m.color);
        l.emissiveIntensity = 1.2;
        return l;
      }
      // an engine: its own texture, painted and plated as the hull round it
      // is, alight only where it faces aft
      if (ENGINE_NAME.test(m.name)) {
        const e = painted(m.clone());
        e.emissiveMap = null;
        if (plating) plate(e, unit, length, { mapped: true, size, lite });
        burn(e, unit, colour);
        engines.push(mesh);
        return e;
      }
      // the rest of the hull, its own maps (the trenches, the towers, the
      // decks' details): painted, and the plating over them lightly (a hull
      // metal tune() took for a lamp by its name, the MC80's `light_Met`, the
      // Arquitens' `ImperialLightCruiser_Hatch`, put out first)
      const d = painted(m.clone());
      if (d.emissiveIntensity === 3.2) {
        d.emissive.setRGB(0, 0, 0);
        d.emissiveIntensity = 1;
      }
      if (plating) plate(d, unit, length, { mapped: true, size, lite });
      return d;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
  }
  const nozzles = nozzlesOf(engines);
  if (nozzles.length) holder.add(glowsOf(nozzles, colour, k));
  return { nozzles };
}
