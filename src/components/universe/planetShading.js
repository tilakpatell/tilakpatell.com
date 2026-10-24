// How the planets on the universe map are shaded, beyond their own maps
// (planets.js builds them and uses all of this):
// - the air: halo(radius, colour, seg, light), a halo just outside a planet's
//   edge, and airGlow(mat, colour, { night, sun }), a glow on its own rim and
//   its cities' lights on its night side, both following its sun;
// - the ground: styleFor(u, T, { tier }) says what a planet's ground is given
//   (its cloud layer, its roughness, whether its detail comes up close), and
//   groundHooks(mat, style) adds it: the clouds' shadows, the detail, a sea's
//   glint;
// - the styles: celShade (C-137 as the show draws it) and ditherShade (Dot
//   Matrix in four greens);
// - variants(planets): the program variants all that makes, for the warm-up.

import * as THREE from 'three';
import { tileFbm } from '../../lib/texture';
import { AIR } from './entry';

export const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // the scene's old fixed key: a planet's sun when it isn't given one

// The air round a planet, in its colour, brightest on its sunlit side: a
// halo just outside its edge (the back of a slightly bigger sphere, fading
// out from the limb) and a glow on the surface's own rim (added to the
// planet's material, below), so it's one extra draw a planet as before.
// the halo's reach, as a share of the planet's radius: the air's top, which
// the ship flies down into to land (entry.js), so what glows is what it goes into
const HALO = AIR;
const HALO_VERT = `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vL = normalize((viewMatrix * vec4(uLight, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAG = `
uniform vec3 uColor;
uniform float uStrength;
uniform float uReach;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec3 n = normalize(vN);
  // how far out from the planet's edge this ray passes, 0 at the edge and 1
  // at the halo's, so the air thins out evenly rather than ending in a rim
  float c = -dot(n, normalize(vV));
  float x = clamp((sqrt(max(1.0 - c * c, 0.0)) * uReach - 1.0) / (uReach - 1.0), 0.0, 1.0);
  float lit = 0.12 + 0.88 * smoothstep(-0.45, 0.5, dot(n, vL));
  gl_FragColor = vec4(uColor * pow(1.0 - x, 3.0) * uStrength * lit, 1.0);
  #include <colorspace_fragment>
}`;

export const RIM = { idle: 0.5, hover: 1.3, selected: 0.95 };

export function halo(radius, color, seg, light = LIGHT) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: RIM.idle }, uLight: { value: light }, uReach: { value: HALO } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * HALO, seg[0], seg[1]), mat);
  mesh.renderOrder = 2;
  return mesh;
}

// The glow on a planet's own rim, in its material, and (for Earth) its
// cities' lights on the night side: both follow the sun.
export function airGlow(mat, color, { night = null, sun = LIGHT } = {}) {
  const u = {
    uRimColor: { value: new THREE.Color(color) },
    uRimStrength: { value: RIM.idle * 0.8 },
    uSunW: { value: sun },
    uNight: { value: night },
  };
  mat.userData.air = u;
  // (after any hook the planet's builder gave it, such as Cybertron's skin)
  const prev = mat.onBeforeCompile;
  // (a key someone set, not three's default, which is the hook's own source)
  const prevKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform vec3 uSunW;\nuniform sampler2D uNight;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // (the sphere's own normal, not the relief's: a steep slope in the
          // normal map isn't the planet's edge)
          vec3 sunV = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
          float day = dot(nonPerturbedNormal, sunV);
          float rim = pow(1.0 - saturate(dot(nonPerturbedNormal, normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += uRimColor * rim * uRimStrength * (0.2 + 0.8 * smoothstep(-0.3, 0.6, day));
          ${night ? 'totalEmissiveRadiance += texture2D(uNight, vMapUv).rgb * 1.5 * smoothstep(0.12, -0.3, day);' : ''}
        }`,
      );
  };
  mat.customProgramCacheKey = () => `${night ? 'air-night' : 'air'}${prevKey ? `-${prevKey.call(mat)}` : ''}`;
  return mat;
}

// What a planet's ground is given beyond its own maps (groundHooks): its
// cloud layer's texture, and whether that's an alpha map (read from its
// green) or a picture (read from its alpha); its roughness map; and whether
// the ground comes up in detail as you come in (not on low, not a station).
const CLOUDS = { middleearth: ['middleearth-clouds', false], breakingbad: ['breakingbad-clouds', true], rickmorty: ['rickmorty-clouds', false], caribbean: ['caribbean-clouds', true], invincible: ['invincible-clouds', true], potter: ['potter-clouds', true], travel: ['earth-clouds', true] };
const ROUGH = { travel: 'earth-rough' };
// (drawn in flat colour, cel or dithered: a mottle would undo it)
const FLAT = new Set(['rickmorty', 'gaming', 'marvel']);
export function styleFor(u, T = {}, { tier = 'high' } = {}) {
  const [name, alpha] = CLOUDS[u.id] ?? [null, false];
  return { clouds: (name && tier !== 'low' && T[name]) || null, alpha, rough: T[ROUGH[u.id] ?? `${u.id}-rough`] ?? null, detail: u.kind !== 'core' && !u.portal && !FLAT.has(u.id) && tier !== 'low' };
}

// A fine noise tile, made once, for the ground's detail coming up close
let detailTex = null;
function detailTile() {
  if (detailTex) return detailTex;
  const N = 256;
  const f = tileFbm(7, { base: 4, octaves: 5 });
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) data.fill(Math.round(f(x / N, y / N) * 255), (y * N + x) * 4, (y * N + x) * 4 + 4);
  detailTex = new THREE.DataTexture(data, N, N);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.magFilter = THREE.LinearFilter;
  detailTex.minFilter = THREE.LinearMipmapLinearFilter;
  detailTex.generateMipmaps = true;
  detailTex.needsUpdate = true;
  return detailTex;
}

// The ground's hooks, after airGlow's (and any the builder gave it), each
// with its own part of the cache key: the clouds' shadows on it (darkening
// the ground by up to 0.55 under them, their texture read where they've
// turned to over it, so it wraps: planetMaps.js's wrapRound), the ground's
// own detail fading in from three radii to 1.3 (so it mottles rather than
// blurs as you come in), and a floor on how glossy it can be (0.22: a sea's
// glint, not a white disc).
export function groundHooks(mat, { clouds, alpha, detail, rough }) {
  if (!clouds && !detail && !rough) return null;
  const u = {
    uClouds: { value: clouds },
    uCloudAlpha: { value: alpha ? 1 : 0 },
    uCloudTurn: { value: 0 },
    uDetail: { value: detail ? detailTile() : null },
    uCamDist: { value: 1e9 },
    uCloudOn: { value: 1 }, // (0 from the pace's step 3: no new shader)
  };
  mat.userData.ground = u;
  const prev = mat.onBeforeCompile;
  // (a key someone set, not three's default, which is the hook's own source)
  const prevKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uClouds;\nuniform float uCloudAlpha;\nuniform float uCloudTurn;\nuniform sampler2D uDetail;\nuniform float uCamDist;\nuniform float uCloudOn;`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
        ${clouds ? '{ vec4 cl = texture2D(uClouds, vec2(vMapUv.x - uCloudTurn, vMapUv.y)); diffuseColor.rgb *= 1.0 - 0.55 * uCloudOn * mix(cl.a, cl.g, uCloudAlpha); }' : ''}
        ${detail ? '{ float k = smoothstep(3.0, 1.3, uCamDist); diffuseColor.rgb *= mix(1.0, 0.82 + 0.36 * texture2D(uDetail, vMapUv * vec2(96.0, 48.0)).r, k); }' : ''}
        #endif`,
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${rough ? 'roughnessFactor = max(roughnessFactor, 0.22);' : ''}`);
  };
  const parts = [clouds && 'clouds', detail && 'detail', rough && 'rough'].filter(Boolean).join('-');
  mat.customProgramCacheKey = () => `${parts}${prevKey ? `-${prevKey.call(mat)}` : ''}`;
  return u;
}

// C-137 as the show draws it: its sun's light in three flat bands (full
// above 0.55 of n·l, 0.72 down to 0.15, 0.45 to the terminator, night past
// it; any other light, the fill, a soft wash under them), each edge two pixels soft (from how fast the normal turns on the
// screen) so it doesn't crawl as the planet turns; no specular but a flat
// glint where it's glossy (its seas), as the show draws one; and, with `ink`,
// its limb inked: darkened by pow(1 − n·v, ink) × 0.8, so it's outlined like
// everything else in the show. Composes after any hook already on it.
export function celShade(mat, { bands = [0.55, 0.15], levels = [1, 0.72, 0.45], ink = 8 } = {}) {
  const f = (v) => v.toFixed(3);
  const prev = mat.onBeforeCompile;
  const prevKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <lights_physical_pars_fragment>',
        `#include <lights_physical_pars_fragment>
        float celEdge;
        void RE_Direct_Cel(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
          float ndl = dot(geometryNormal, directLight.direction);
          float lit = ${f(levels[2])} * smoothstep(-celEdge, celEdge, ndl);
          lit = mix(lit, ${f(levels[1])}, smoothstep(${f(bands[1])} - celEdge, ${f(bands[1])} + celEdge, ndl));
          lit = mix(lit, ${f(levels[0])}, smoothstep(${f(bands[0])} - celEdge, ${f(bands[0])} + celEdge, ndl));
          // (only its own sun is drawn in bands, and glints, the show's one
          // light: the scene's cool fill, banded too, ruled three hard lines
          // across a plain sea and put a second sun in it, so it's a soft wash)
          float celKey = 1.0;
          #ifdef KEY_SUN
          celKey = step(0.9999, dot(directLight.direction, normalize((viewMatrix * vec4(uKeySunW, 0.0)).xyz)));
          lit = mix(0.6 * smoothstep(-0.2, 0.8, ndl), lit, celKey);
          #endif
          reflectedLight.directDiffuse += lit * directLight.color * BRDF_Lambert(material.diffuseContribution);
          float gloss = 1.0 - smoothstep(0.3, 0.6, material.roughness);
          float h = dot(geometryNormal, normalize(directLight.direction + geometryViewDir));
          reflectedLight.directSpecular += directLight.color * 0.35 * gloss * celKey * smoothstep(0.985 - celEdge, 0.985 + celEdge, h) * step(0.0, ndl);
        }
        // (the sky's light on it stays, flat; its reflection goes)
        void RE_IndirectSpecular_Cel(const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
          reflectedLight.indirectDiffuse += material.diffuseContribution * irradiance * RECIPROCAL_PI;
        }
        #undef RE_Direct
        #define RE_Direct RE_Direct_Cel
        #undef RE_IndirectSpecular
        #define RE_IndirectSpecular RE_IndirectSpecular_Cel`,
      )
      .replace('#include <lights_fragment_begin>', 'celEdge = max(length(fwidth(normal)), 1e-4) * 2.0;\n#include <lights_fragment_begin>')
      .replace('#include <opaque_fragment>', `${ink ? `outgoingLight *= 1.0 - 0.8 * pow(1.0 - saturate(dot(nonPerturbedNormal, normalize(vViewPosition))), ${f(ink)});` : ''}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `cel${ink ? `-ink${ink}` : ''}${prevKey ? `-${prevKey.call(mat)}` : ''}`;
  return mat;
}

// Dot Matrix as a Game Boy shows it: each pixel one of the four greens,
// picked by its own tone (the nearest of the four) stepped down by how lit
// it is against a 4 × 4 ordered dither, so the terminator is a Bayer pattern.
// The dither's cells are two of the page's pixels (gl_FragCoord over the
// ratio it's drawn at, `dpr`, a uniform the scene sets), so they're the same
// size on every screen and every pace step. With `outline`, the limb's last
// pixel in the lightest green, the screen's own edge to the world.
const BAYER = '0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0';
// (how lit a pixel in the full sun is, against its own colour: the key's
// strength over π, with the sky's; read in whichever of its colours it has
// most of, so an orange star on its greens isn't taken for a dim one)
const DITHER_FULL = 0.75;
export function ditherShade(mat, { palette, dpr = { value: 1 }, outline = false } = {}) {
  const u = { uPalette: { value: palette.map((c) => new THREE.Color(c)) }, uDpr: dpr };
  const prev = mat.onBeforeCompile;
  const prevKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uPalette[4];\nuniform float uDpr;').replace(
      '#include <opaque_fragment>',
      `{
        const float bayer[16] = float[16](${BAYER});
        float own = 0.0;
        float best = 1e9;
        for (int i = 0; i < 4; i++) {
          float d = distance(diffuseColor.rgb, uPalette[i]);
          if (d < best) { best = d; own = float(i); }
        }
        vec3 has = step(vec3(0.02), diffuseColor.rgb);
        vec3 by = outgoingLight / max(diffuseColor.rgb, vec3(1e-3)) * has;
        float lit = clamp(max(by.r, max(by.g, by.b)) / ${DITHER_FULL.toFixed(2)}, 0.0, 1.0);
        vec2 cell = mod(floor(gl_FragCoord.xy / (uDpr * 2.0)), 4.0);
        float th = (bayer[int(cell.x) + int(cell.y) * 4] + 0.5) / 16.0;
        int tone = int(clamp(floor(own * lit + th), 0.0, 3.0));
        outgoingLight = uPalette[tone] * ${DITHER_FULL.toFixed(2)};
        ${outline ? 'float nv = dot(nonPerturbedNormal, normalize(vViewPosition));\n        if (nv < fwidth(nv) * 1.5) outgoingLight = uPalette[3] * ' + DITHER_FULL.toFixed(2) + ';' : ''}
      }
      #include <opaque_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => `dither${outline ? '-outline' : ''}${prevKey ? `-${prevKey.call(mat)}` : ''}`;
  mat.userData.dither = u;
  return u;
}

// The shader variants the planets' own hooks make (the air's rim, the
// ground's, the styles'): each one a program the warm-up compiles before the
// first frame, so a count to keep an eye on. A variant is the material's kind,
// its hooks' key and which of its maps it has (each changes the program).
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap', 'metalnessMap'];
export function variants(planets) {
  const out = new Set();
  for (const p of planets) {
    p.group.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) {
        if (!Object.hasOwn(m, 'customProgramCacheKey')) continue;
        out.add([m.type, m.customProgramCacheKey(), SLOTS.map((s) => (m[s] ? 1 : 0)).join(''), o.isInstancedMesh ? 'instanced' : '', m.transparent ? 'blend' : ''].join('|'));
      }
    });
  }
  return out;
}
