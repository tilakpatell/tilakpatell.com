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
// dressCapital(holder, kind, { plating }) after models.js has fitted the model (its
// holder: the unit frame, nose +z, 1 long); patched materials are copies
// (one per mesh that needs its own frame), the template's to keep.
// isCapital(kind); plateTint(kind) and LENGTH (metres a ship is long, so the
// plates are a plate's size on any of them) are the data.

import * as THREE from 'three';
import { HULLS } from '../universe/wars';

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
// (the kinds whose own maps are next to flat colour, a few KB each: plated over them)
const PLATE_ALL = new Set(['acclamator']);
const LAMP = /glow|lamp|bluelight|redlight|beacon/i;
const MARKING = '#8e2b22'; // (the Republic's red)

// ── the plating ──
const PLATE_VERT = `
uniform mat4 uUnit;
uniform float uLength;
varying vec3 vShip;
varying vec3 vShipN;
varying float vPerMetre;`;
const PLATE_FRAG = `
uniform float uLit;
varying vec3 vShip;
varying vec3 vShipN;
varying float vPerMetre;
float plHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
// one course of plates at \`size\` metres: its shade, how far to its nearest edge (m), a second dice
vec3 plCells( vec2 p, vec2 size ) {
  vec2 q = p / size;
  q.x += plHash( vec2( floor( q.y ), 3.7 ) );
  vec2 id = floor( q );
  vec2 f = fract( q );
  vec2 e = min( f, 1.0 - f ) * size;
  return vec3( plHash( id ), min( e.x, e.y ), plHash( id + 19.3 ) );
}
// a plane's plating: (shade, seam, height, windows); px: metres a pixel spans
vec4 plPlating( vec2 p, float px, float wall ) {
  // (three courses: sections of the hull, the plates on them, the panels on those)
  vec3 s = plCells( p + vec2( 11.0, 5.0 ), vec2( 96.0, 52.0 ) );
  vec3 a = plCells( p, vec2( 26.0, 14.0 ) );
  vec3 b = plCells( p + vec2( 3.1, 1.7 ), vec2( 6.5, 3.5 ) );
  // (a seam's weight: whole where it's wider than a pixel, its mean where it's not)
  float ws = clamp( 1.6 / px, 0.0, 1.0 );
  float wa = clamp( 0.7 / px, 0.0, 1.0 );
  float wb = clamp( 0.3 / px, 0.0, 1.0 );
  float ss = ( 1.0 - smoothstep( 0.4, 1.6, s.y ) ) * ws;
  float sa = ( 1.0 - smoothstep( 0.15, 0.7, a.y ) ) * wa;
  float sb = ( 1.0 - smoothstep( 0.05, 0.3, b.y ) ) * wb;
  float shade = ( s.x - 0.5 ) * 0.14 + ( a.x - 0.5 ) * 0.1 * clamp( 3.0 / px, 0.3, 1.0 ) + ( b.x - 0.5 ) * 0.05 * wb;
  // a raised panel or a dark vent, here and there among the small plates
  float raised = step( 0.82, b.z ) * wb;
  float vent = step( b.z, 0.07 ) * smoothstep( 0.3, 0.9, b.y ) * wb;
  float h = raised * 0.6 - sa * 1.0 - sb * 0.45 - vent * 0.5;
  // windows: on a wall, a row along some big plates' middles, each lit or not
  float lit = 0.0;
  if ( wall > 0.5 && a.z > 0.5 ) {
    vec2 w = vec2( p.x / 3.2, ( p.y - 1.0 ) / 14.0 );
    float row = abs( fract( w.y ) - 0.5 ) * 14.0;
    float col = abs( fract( w.x ) - 0.5 ) * 3.2;
    float on = step( 0.45, plHash( floor( w ) + a.x * 31.0 ) );
    float pane = ( 1.0 - smoothstep( 0.35, 0.5, row ) ) * ( 1.0 - smoothstep( 0.55, 0.8, col ) );
    // (its share of the plate's light where a pane is under a pixel: a faint glow, never a glitter)
    lit = on * mix( 0.08, pane, clamp( 0.8 / px, 0.0, 1.0 ) );
  }
  return vec4( shade - vent * 0.2, ss * 0.45 + sa * 0.32 + sb * 0.16, h * wb - ss * ws, lit );
}
// the bump: the normal tilted by the height's slope across the screen
// (three's perturbNormalArb; the height in the view's units, vPerMetre)
vec3 plBump( vec3 surf, vec3 n, vec2 dH, float faceDirection ) {
  vec3 sx = dFdx( surf.xyz );
  vec3 sy = dFdy( surf.xyz );
  vec3 r1 = cross( sy, n );
  vec3 r2 = cross( n, sx );
  float det = dot( sx, r1 ) * faceDirection;
  vec3 g = sign( det ) * ( dH.x * r1 + dH.y * r2 );
  return normalize( abs( det ) * n - g );
}`;

function plate(m, unit, length) {
  const was = m.onBeforeCompile;
  const key = Object.hasOwn(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null;
  m.userData.plated = true;
  m.onBeforeCompile = (shader, renderer) => {
    was?.call(m, shader, renderer);
    shader.uniforms.uUnit = { value: unit };
    shader.uniforms.uLength = { value: length };
    shader.uniforms.uLit = { value: 1.6 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PLATE_VERT}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShip = ( uUnit * vec4( position, 1.0 ) ).xyz * uLength;\nvShipN = normalize( mat3( uUnit ) * objectNormal );\nvPerMetre = length( modelMatrix[ 0 ].xyz ) / ( length( uUnit[ 0 ].xyz ) * uLength );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PLATE_FRAG}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  vec3 plW = pow( abs( vShipN ), vec3( 4.0 ) );
  plW /= plW.x + plW.y + plW.z + 1e-5;
  float plPx = length( fwidth( vShip ) ) + 1e-4;
  float plWall = 1.0 - smoothstep( 0.35, 0.6, abs( vShipN.y ) );
  vec4 plX = plPlating( vShip.zy, plPx, plWall );
  vec4 plY = plPlating( vShip.xz, plPx, 0.0 );
  vec4 plZ = plPlating( vShip.xy, plPx, plWall );
  vec4 plP = plX * plW.x + plY * plW.y + plZ * plW.z;
  diffuseColor.rgb *= ( 1.0 + plP.x ) * ( 1.0 - plP.y );`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp( roughnessFactor + plP.y * 0.25 - plP.x * 0.3, 0.3, 0.95 );')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = plBump( -vViewPosition, normal, vec2( dFdx( plP.z ), dFdy( plP.z ) ) * vPerMetre * 0.35, faceDirection );')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3( 1.0, 0.94, 0.82 ) * plP.w * uLit;');
  };
  m.customProgramCacheKey = () => `${key ? key.call(m) : ''}|plated`;
  m.needsUpdate = true;
}

// ── the engines: lit where they face aft ──
const AFT_VERT = `
uniform mat4 uUnit;
varying float vAft;
varying float vAftZ;`;
function burn(m, unit, colour) {
  const was = m.onBeforeCompile;
  const key = Object.hasOwn(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null;
  m.userData.burning = true;
  m.emissive?.setRGB(...colour);
  m.emissiveIntensity = 1;
  m.onBeforeCompile = (shader, renderer) => {
    was?.call(m, shader, renderer);
    shader.uniforms.uUnit = { value: unit };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${AFT_VERT}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAft = -normalize( mat3( uUnit ) * objectNormal ).z;\nvAftZ = ( uUnit * vec4( position, 1.0 ) ).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAft;\nvarying float vAftZ;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float aftLit = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );\n  totalEmissiveRadiance *= smoothstep( 0.55, 0.9, vAft ) * smoothstep( 0.25, 0.8, aftLit ) * ( 1.0 - smoothstep( -0.3, -0.15, vAftZ ) ) * 1.6;');
  };
  m.customProgramCacheKey = () => `${key ? key.call(m) : ''}|aft`;
  m.needsUpdate = true;
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
// the windows and the engines are lit whatever the detail)
export function dressCapital(holder, kind, { plating = true } = {}) {
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
      // the game's lights and engine glow in one material of their own (the
      // Nebulon-B's `Emissive`, bare as it came: tune() greyed it): alight
      if (LIT.test(m.name) && !m.map) {
        const l = m.clone();
        l.color.setRGB(0.12, 0.13, 0.15);
        l.emissive.setRGB(...colour);
        l.emissiveIntensity = 0.9;
        engines.push(mesh);
        return l;
      }
      // a kind whose own maps are next to flat colour: plated over them
      if (PLATE_ALL.has(kind) && m.map && !m.transparent && !ENGINE_NAME.test(m.name)) {
        const p = m.clone();
        if (plating) plate(p, unit, length);
        return p;
      }
      // the hull's great plates: no colour map of their own (the Venator's
      // red markings came as a bare material named for their colour)
      if (!m.map && !m.transparent && (HULL.test(m.name) || RED.test(m.name) || m.color.getHex() === 0x6b6f76 || m.color.getHex() === 0xffffff)) {
        const p = m.clone();
        p.color.set(RED.test(m.name) ? MARKING : tint);
        p.metalness = 0.35;
        p.roughness = 0.62;
        if (plating) plate(p, unit, length);
        return p;
      }
      // the windows' glass, lit
      if (WINDOW.test(m.name) && m.transparent) {
        const w = m.clone();
        w.emissive.setRGB(0.85, 0.92, 1.0);
        w.emissiveIntensity = 1.5;
        w.opacity = 0.85;
        return w;
      }
      // (a hull metal or a hatch whose name only has 'light' in it, the
      // MC80's `light_Met`, the Arquitens' `ImperialLightCruiser_Hatch`, not
      // a lamp: models.js's tune() lit it whole, white)
      if (m.emissiveIntensity === 3.2 && !LAMP.test(m.name) && !ENGINE_NAME.test(m.name)) {
        const d = m.clone();
        d.emissive.setRGB(0, 0, 0);
        d.emissiveIntensity = 1;
        return d;
      }
      // an engine: its own texture, alight only where it faces aft
      if (ENGINE_NAME.test(m.name)) {
        const e = m.clone();
        e.emissiveMap = null;
        burn(e, unit, colour);
        engines.push(mesh);
        return e;
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
  }
  const nozzles = nozzlesOf(engines);
  if (nozzles.length) holder.add(glowsOf(nozzles, colour, k));
  return { nozzles };
}
