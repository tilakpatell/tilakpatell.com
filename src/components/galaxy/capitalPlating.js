// A capital ship's hull, layered as the films' models and the 2017 game's
// kits are: whatever the model's own map gives (the trenches' greebles, a
// tower's decks), and over it, in metres on the ship (so a plate is a
// plate's size on any of them, fixed to the hull as it flies):
//
//   - the detail map (hullDetail.js, baked once in a worker): plates, the
//     panels cut into them, the small parts on those, every kind of panel the
//     films' kitbashing gives a Star Destroyer; its slopes tilt the light at
//     every bevel and groove, its shade paints each plate its own grey and
//     the seams' dark lines, its cavity keeps the light from all round (the
//     sky's, the bounce's) out of the grooves. A map with mipmaps, so it
//     holds as the hull goes off into the distance, never glittering;
//   - over that, sections of the hull far bigger than the map, each its own
//     grey (the patchwork on every Star Destroyer on screen), a slow drift of
//     tone, and grime in faint streaks running fore and aft, so the map's
//     repeat is never seen;
//   - a sheen of its own on every plate (a darker plate rougher), so the
//     light breaks up across the hull as it does on painted metal;
//   - on a bare hull's walls, rows of small lit windows.
//
// Over a model's own map it goes on with a lighter hand (`mapped`, MAPPED):
// the map's detail is the model's.
//
// plate(material, unit, length, { mapped, size, lite }) patches a
// MeshStandardMaterial (patchShaders, its program keyed `plated`); `unit`
// is the mesh's matrix into the ship's unit frame (nose +z, 1 long), `length`
// its metres, `size` the detail map's pixels (detailMap(size) bakes it),
// `lite` a phone's: the map and the sections, no drift or grime.

import * as THREE from 'three';
import { TILE } from './hullDetail';

// ── the detail map: one for every capital, baked in a worker ──
// (a uniform every plated material shares, so the map baked takes the
// place of the flat one it starts with in all of them at once)
const DETAIL = { value: null, size: 0 };
const flat = () => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 0]), 1, 1);
  t.needsUpdate = true;
  return t;
};
export function detailTexture(pixels, size) {
  const t = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
// who sends a new map to the GPU before the hulls take it (galaxy/scene.js:
// its renderer, in spare time): a 2,048 map and its mips sent in the frame
// that first drew it was a hitch; without one, it goes up then all the same
let send = null;
export const sendDetailWith = (fn) => {
  send = fn;
};
// the worker's map in the shared uniform, once it's been sent
export function takeDetail(next, size) {
  return Promise.resolve(send ? send(next) : null)
    .catch(() => {})
    .then(() => {
      // (a bigger one asked for since)
      if (size !== DETAIL.size) return void next.dispose();
      const was = DETAIL.value;
      DETAIL.value = next;
      was?.dispose();
    });
}

// the shared uniform, its map at `size` asked for (the biggest asked wins;
// where there's no worker, the flat one stays)
export function detailMap(size) {
  DETAIL.value ??= flat();
  if (!size || size <= DETAIL.size) return DETAIL;
  DETAIL.size = size;
  if (typeof Worker === 'undefined') return DETAIL;
  let worker;
  try {
    worker = new Worker(new URL('./hullDetail.worker.js', import.meta.url), { type: 'module' });
  } catch {
    return DETAIL;
  }
  worker.onmessage = ({ data }) => {
    worker.terminate();
    if (data?.size !== DETAIL.size) return; // (a bigger one asked for since)
    takeDetail(detailTexture(data.pixels, data.size), data.size);
  };
  worker.onerror = () => worker.terminate();
  worker.postMessage({ size });
  return DETAIL;
}

// (the shader's own words: three's standard material, patched where its
// chunks are)
const PLATE_VERT = `
#ifndef CAP_UNIT
#define CAP_UNIT
uniform mat4 uUnit; // (the plating's and the engines' both: declared once)
#endif
uniform float uLength;
varying vec3 vShip;
varying vec3 vShipN;
varying vec3 vShipX;
varying vec3 vShipY;
varying vec3 vShipZ;`;
// the plating's relief: the slope its bevels catch the light at, and how
// dark its grooves go; a lit deck a calm plane under it, as the game's
// frames show a lit hull (it read as crumpled foil at 4 and 0.35)
export const SLOPE = 2.6;
export const CAVITY = 0.22;

const PLATE_FRAG = `
uniform sampler2D uDetail;
uniform float uLit;
uniform float uLength;
varying vec3 vShip;
varying vec3 vShipN;
varying vec3 vShipX;
varying vec3 vShipY;
varying vec3 vShipZ;
float plHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
float plHash3( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}
float plNoise3( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float a = mix( mix( plHash3( i ), plHash3( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( plHash3( i + vec3( 0.0, 1.0, 0.0 ) ), plHash3( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y );
  float b = mix( mix( plHash3( i + vec3( 0.0, 0.0, 1.0 ) ), plHash3( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( plHash3( i + vec3( 0.0, 1.0, 1.0 ) ), plHash3( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y );
  return mix( a, b, f.z );
}
// a wall's windows: a row along some of its big plates' middles, each lit or not
float plWindows( vec2 p, float px ) {
  vec2 q = p / vec2( 26.0, 13.0 );
  q.x += plHash( vec2( floor( q.y ), 3.7 ) );
  vec2 id = floor( q );
  // (far off, where a pixel holds many plates or panes, which are lit goes to
  // their mean: lit or dark by the one a pixel fell on, a dark wall glittered
  // all over, the Executor's from a few kilometres)
  float plates = clamp( 4.0 / px, 0.0, 1.0 );
  float lit = mix( 0.5, step( 0.5, plHash( id + 19.3 ) ), plates );
  if ( lit == 0.0 ) return 0.0;
  // (small panes, half a metre by seven tenths, two and a half metres apart)
  vec2 w = vec2( p.x / 2.4, ( p.y - 1.0 ) / 13.0 );
  float row = abs( fract( w.y ) - 0.5 ) * 13.0;
  float col = abs( fract( w.x ) - 0.5 ) * 2.4;
  float near = clamp( 0.35 / px, 0.0, 1.0 );
  float on = mix( 0.55, step( 0.45, plHash( floor( w ) + plHash( id ) * 31.0 ) ), near );
  float pane = ( 1.0 - smoothstep( 0.18, 0.26, row ) ) * ( 1.0 - smoothstep( 0.28, 0.38, col ) );
  // (its share of the plate's light where a pane is under a pixel: a faint glow, never a glitter)
  return lit * on * mix( 0.03, pane, near );
}
struct Plating {
  float shade; // the paint's grey, about 0
  float cavity; // how deep in a groove
  vec3 grad; // the slope, in the ship's frame
  float lit; // a window's light
};
// the detail map on the three planes, each by how square the hull faces it
// (its slopes and the windows on the hull's own axes; a plane with next to
// no share isn't sampled, its texture's slopes across the screen taken first)
Plating plOf( vec3 ship, vec3 n ) {
  vec3 w = pow( abs( n ), vec3( 4.0 ) );
  w /= w.x + w.y + w.z + 1e-5;
  float wall = 1.0 - smoothstep( 0.35, 0.6, abs( n.y ) );
  float px = length( fwidth( ship ) ) + 1e-4;
  vec2 cx = ship.zy / ${TILE.toFixed(1)};
  vec2 cy = ( ship.zx + vec2( 37.0, 91.0 ) ) / ${TILE.toFixed(1)};
  vec2 cz = ( ship.xy + vec2( 71.0, 13.0 ) ) / ${TILE.toFixed(1)};
  vec2 dxx = dFdx( cx ), dyx = dFdy( cx ), dxy = dFdx( cy ), dyy = dFdy( cy ), dxz = dFdx( cz ), dyz = dFdy( cz );
  Plating o = Plating( 0.0, 0.0, vec3( 0.0 ), 0.0 );
  if ( w.x > 0.01 ) {
    vec4 d = textureGrad( uDetail, cx, dxx, dyx );
    o.shade += ( d.b - 0.5 ) * w.x;
    o.cavity += d.a * w.x;
    o.grad += vec3( 0.0, d.g - 0.5, d.r - 0.5 ) * ${SLOPE.toFixed(3)} * w.x;
    o.lit += plWindows( ship.zy, px ) * wall * w.x;
  }
  if ( w.y > 0.01 ) {
    vec4 d = textureGrad( uDetail, cy, dxy, dyy );
    o.shade += ( d.b - 0.5 ) * w.y;
    o.cavity += d.a * w.y;
    o.grad += vec3( d.g - 0.5, 0.0, d.r - 0.5 ) * ${SLOPE.toFixed(3)} * w.y;
  }
  if ( w.z > 0.01 ) {
    vec4 d = textureGrad( uDetail, cz, dxz, dyz );
    o.shade += ( d.b - 0.5 ) * w.z;
    o.cavity += d.a * w.z;
    o.grad += vec3( d.r - 0.5, d.g - 0.5, 0.0 ) * ${SLOPE.toFixed(3)} * w.z;
    o.lit += plWindows( ship.xy, px ) * wall * w.z;
  }
  return o;
}`;

// how much of each layer over a model's own map (its detail is the model's),
// where its texels are no bigger than a pixel; a bare hull has all of each
export const MAPPED = { shade: 0.45, big: 0.6, cavity: 0.5, bump: 0.3, rough: 0.6 };
const f = (v) => v.toFixed(3);

// a patch laid on a material's shaders after any it had (each of the
// plating's, the panes' and the engines' aft glow chains onto the last), its
// program keyed apart by `key`
export function patchShaders(m, key, change) {
  const was = m.onBeforeCompile;
  const keyWas = Object.hasOwn(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null;
  m.onBeforeCompile = (shader, renderer) => {
    was?.call(m, shader, renderer);
    change(shader);
  };
  m.customProgramCacheKey = () => `${keyWas ? keyWas.call(m) : ''}|${key}`;
  m.needsUpdate = true;
}

export function plate(m, unit, length, { mapped = false, size = 2048, lite = false, windows = true } = {}) {
  const detail = detailMap(size);
  m.userData.plated = true;
  // (the ship's length and the hand it was plated with, for a part built on it later: capitalParts.js)
  m.userData.plating = { length, lite };
  patchShaders(m, `plated${mapped ? '-mapped' : ''}${lite ? '-lite' : ''}`, (shader) => {
    shader.uniforms.uUnit = { value: unit };
    shader.uniforms.uLength = { value: length };
    shader.uniforms.uDetail = detail;
    // (the bare walls' lit panes: none over a model's own map, nor on a part built on the hull)
    shader.uniforms.uLit = { value: mapped || !windows ? 0 : 1.2 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${PLATE_VERT}`).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vShip = ( uUnit * vec4( position, 1.0 ) ).xyz * uLength;
vShipN = normalize( mat3( uUnit ) * objectNormal );
mat3 plToModel = transpose( mat3( uUnit ) );
vShipX = normalize( normalMatrix * plToModel[ 0 ] );
vShipY = normalize( normalMatrix * plToModel[ 1 ] );
vShipZ = normalize( normalMatrix * plToModel[ 2 ] );`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PLATE_FRAG}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  Plating plP = plOf( vShip, normalize( vShipN ) );
  // (over a model's own map, the more of each layer the more the map's
  // texels are magnified: where one spans several pixels the map is a blur,
  // and the plating is all the detail there is)
  float plLay = ${mapped ? '0.0' : '1.0'};
  #ifdef USE_MAP
    plLay = max( plLay, 0.85 * ( 1.0 - smoothstep( 0.12, 0.5, length( fwidth( vMapUv ) ) * float( textureSize( map, 0 ).x ) ) ) );
  #endif
  vec4 plK = mix( vec4( ${[MAPPED.shade, MAPPED.big, MAPPED.cavity, MAPPED.bump].map(f).join(', ')} ), vec4( 1.0 ), plLay );
  float plKr = mix( ${f(MAPPED.rough)}, 1.0, plLay );
  // (the sections, a box of the ship's space each, to their mean where a
  // pixel spans one: far off, each pixel's section a hash, they were a
  // speckle; on a ship of many kilometres, the Executor's, blocks of them a
  // city's size, each its own grey, as the films' model's patchwork; the
  // drift; the grime, long fore and aft)
  float plPx = length( fwidth( vShip ) );
  float plSec = ( plHash3( floor( vShip / vec3( 52.0, 26.0, 104.0 ) ) ) - 0.5 ) * ( 1.0 - smoothstep( 8.0, 30.0, plPx ) );
  plSec += ( plHash3( floor( vShip / vec3( 420.0, 210.0, 840.0 ) ) + 5.0 ) - 0.5 ) * 1.6 * smoothstep( 3000.0, 12000.0, uLength ) * ( 1.0 - smoothstep( 60.0, 240.0, plPx ) );
  float plDrift = ${lite ? '0.0' : 'plNoise3( vShip / 140.0 ) - 0.5'};
  float plGrime = ${lite ? '0.0' : 'plNoise3( vShip * vec3( 0.12, 0.12, 0.006 ) ) * 0.7 + plNoise3( vShip * vec3( 0.4, 0.4, 0.02 ) + 7.0 ) * 0.3 - 0.5'};
  float plShade = plP.shade * plK.x + ( plSec * 0.14 + plDrift * 0.1 - plGrime * 0.12 ) * plK.y;
  diffuseColor.rgb *= clamp( 1.0 + plShade, 0.4, 1.6 ) * ( 1.0 - plP.cavity * ${f(CAVITY)} * plK.z );`,
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n  roughnessFactor = clamp( mix( roughnessFactor, 0.52 - plShade * 0.8 + plP.cavity * 0.3 + plGrime * 0.12, plKr ), 0.3, 0.92 );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n  normal = normalize( normal - ( vShipX * plP.grad.x + vShipY * plP.grad.y + vShipZ * plP.grad.z ) * plK.w );`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3( 1.0, 0.9, 0.74 ) * plP.lit * uLit;')
      // (the cavity: a groove's shadow on the light from all round, the sky's and the bounce's)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n  float plAo = clamp( 1.0 - plP.cavity * 1.2 * plK.z, 0.2, 1.0 );\n  reflectedLight.indirectDiffuse *= plAo;\n  reflectedLight.indirectSpecular *= plAo;`);
  });
}

// ── the windows: rows of small panes on the game's glass ──
// (its window strips came without the window map the game draws on them:
// lit flat, each was a white slab. Here a pane every metre and a half along
// a row, a row every two metres and a bit, two in three lit, a warm light;
// far off, the strip's mean, a faint line of light, as on screen)
const PANE_VERT = `
#ifndef CAP_UNIT
#define CAP_UNIT
uniform mat4 uUnit; // (the plating's and the engines' both: declared once)
#endif
uniform float uLength;
varying vec3 vPane;
varying vec3 vPaneN;`;
const PANE_FRAG = `
varying vec3 vPane;
varying vec3 vPaneN;
float paHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
float paPanes( vec2 p, float px ) {
  vec2 w = p / vec2( 1.5, 2.2 );
  vec2 f = abs( fract( w ) - 0.5 ) * vec2( 1.5, 2.2 );
  float pane = ( 1.0 - smoothstep( 0.32, 0.45, f.x ) ) * ( 1.0 - smoothstep( 0.2, 0.28, f.y ) );
  // (far off, where a pixel holds many panes, both their shape and which are
  // lit go to their means: lit or dark by the pane a pixel fell on, they
  // sparkled as the ship moved)
  float near = clamp( 0.4 / px, 0.0, 1.0 );
  float on = mix( 0.66, step( 0.34, paHash( floor( w ) ) ), near );
  return on * mix( 0.1, pane, near );
}`;
export function panes(m, unit, length) {
  m.userData.panes = true;
  patchShaders(m, 'panes', (shader) => {
    shader.uniforms.uUnit = { value: unit };
    shader.uniforms.uLength = { value: length };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${PANE_VERT}`).replace('#include <begin_vertex>', '#include <begin_vertex>\nvPane = ( uUnit * vec4( position, 1.0 ) ).xyz * uLength;\nvPaneN = mat3( uUnit ) * objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PANE_FRAG}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  vec3 paN = abs( normalize( vPaneN ) );
  float paPx = length( fwidth( vPane ) ) + 1e-4;
  // (along the strip: the hull's length on a wall facing out, its breadth on one facing fore or aft)
  vec2 paP = paN.x > max( paN.y, paN.z ) ? vPane.zy : paN.z > paN.y ? vPane.xy : vPane.xz;
  totalEmissiveRadiance *= paPanes( paP, paPx );`,
      );
  });
}
