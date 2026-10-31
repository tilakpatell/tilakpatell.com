// One look for every world, after Bruno Simon's folio-2025 (its one
// MeshDefaultMaterial) and Active Theory's one lighting include
// (docs/research/2026-10-06-why-theirs-look-expensive.md): polish made here
// reaches every material a world hands over, and each world supplies only a
// small look.
//
// It goes on last, after three has lit the point (the sun, the sky, lamps,
// shadow maps, occlusion, the baked floor light of lib/three/groundwork all
// count), and does two things to what three worked out:
//
//   - shade is a colour. How lit the point is (`k`, three's light against
//     the full light of the world's sun and sky on the same albedo) picks
//     between three's light and the albedo times the look's shadow colour,
//     with a soft edge between: a soft terminator, and shadows that go
//     violet or blue or warm, never grey. Metals keep their own light;
//     anything glowing is added back as it was.
//   - fog is the sky. Three's fog factor, but its colour is the sky's along
//     the view ray (the horizon below, a horizon-to-zenith gradient above,
//     the sun's halo), so far ground melts into the sky exactly.
//
//   - with a ground map (lib/three/groundmap, `ground(map)`), the light the
//     ground bounces up: low, downward faces take the colour of the ground
//     under them into their albedo, by how near it they are, so nothing
//     floats over it (Bruno's light bounce, 1.5 m deep).
//
//   createHouse(look) → { uniforms, toneMapping, exposure, material(opts), adopt(root),
//     set(look), light({ sun, hemi }), sky({ low, high, below, sunDir, halo }),
//     ground(map, { height, strength, offset }) }
//   houseShader(shader, { fog, ground }, chunks) → { vertexShader, fragmentShader, swapped }
//
// A look: { shadow, edge: [from, to], mix, fogLow, fogHigh, fogBelow, halo,
// fogMix, exposure, fog (false: leave the world's own fog as it is), grey
// (houseOn: how far the shade it takes from the sky light leans to grey,
// shadowFor) }. All the materials of one world share one set of uniforms, so a
// frame sets them once. Call adopt() after anything else that patches the
// world's materials (lib/three/groundwork's groundWorld): its shade then
// replaces their tints, and one shadow colour reaches everything.

import * as THREE from 'three';
import { GROUND_GLSL } from './groundmap';
import { guardOf } from './frameGuard';

export const LOOK = {
  shadow: 0x9d93c4, // the albedo times this, in full shade (sRGB)
  edge: [0.16, 0.82], // where shade turns to light, as a share of full light
  mix: 1, // how much of the look (0: three's own light)
  fogLow: 0xf6dfb0, // the sky at the horizon, and the haze below it
  fogHigh: 0x3f7ccc, // the sky overhead
  fogBelow: 0.92, // the haze below the horizon, as a share of fogLow
  halo: 0x000000, // the sun's glow in the fog (a colour, added)
  fogMix: 1, // how much of the sky's colour the fog takes (0: three's fogColor)
  // the house tone mapper is Neutral, which leaves mid-grey about where it
  // is; ACES (what the worlds were tuned under) lifts it by about 1.4, so a
  // world multiplies its own exposure by this to keep its brightness
  exposure: 1.4,
};

const PARS = /* glsl */ `
#ifndef LOOK_REF
#define LOOK_REF
uniform vec3 uLookRef;
#endif
uniform vec3 uLookShadow;
uniform vec2 uLookEdge;
uniform float uLookMix;
uniform vec3 uLookFogLow;
uniform vec3 uLookFogHigh;
uniform float uLookFogBelow;
uniform vec3 uLookSunDir;
uniform vec3 uLookHalo;
uniform float uLookFogMix;
float lookLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// the sky along a direction, as the fog sees it
vec3 houseSky(vec3 d) {
  vec3 c = d.y < 0.0 ? uLookFogLow * uLookFogBelow : mix(uLookFogLow, uLookFogHigh, pow(max(d.y, 0.0), 0.5));
  return c + uLookHalo * pow(max(dot(d, uLookSunDir), 0.0), 6.0);
}
`;

const LOOK_GLSL = /* glsl */ `
{
  vec3 lkAlbedo = diffuseColor.rgb;
  vec3 lkLight = outgoingLight - totalEmissiveRadiance;
  float lkLit = lookLuma(lkLight) / max(lookLuma(lkAlbedo * uLookRef), 1e-4);
  float lkShade = (1.0 - smoothstep(uLookEdge.x, uLookEdge.y, lkLit)) * uLookMix;
  #ifdef STANDARD
    lkShade *= 1.0 - metalnessFactor;
  #endif
  outgoingLight = mix(lkLight, lkAlbedo * uLookShadow, lkShade) + totalEmissiveRadiance;
}
`;

const FOG_LINE = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
// (the view ray in the world, from the view-space position every lit shader has)
const FOG_SKY = `{
		vec3 lkDir = normalize(transpose(mat3(viewMatrix)) * -vViewPosition);
		gl_FragColor.rgb = mix( gl_FragColor.rgb, mix(fogColor, houseSky(lkDir), uLookFogMix), fogFactor );
	}`;

// the bounce: the world position and normal of each point (instancing
// included), and the ground's colour mixed into the albedo before any light
const BOUNCE_VS = (nrm) => `
{
  vec4 lp = vec4(transformed, 1.0);
  vec3 ln = ${nrm};
  #ifdef USE_INSTANCING
    lp = instanceMatrix * lp;
    ln = mat3(instanceMatrix) * ln;
  #endif
  vLookPos = (modelMatrix * lp).xyz;
  vLookN = mat3(modelMatrix) * ln;
}`;
const BOUNCE_FS = /* glsl */ `
{
  vec2 lkUv = (vLookPos.xz - uGroundRect.xy) * uGroundRect.zw;
  if (lkUv.x > 0.0 && lkUv.y > 0.0 && lkUv.x < 1.0 && lkUv.y < 1.0) {
    float lkNear = pow(clamp(1.0 - (vLookPos.y - groundHeight(vLookPos.xz)) / uLookBounce.x, 0.0, 1.0), 2.0) * uLookBounce.y;
    float lkDown = clamp((-normalize(vLookN).y + uLookBounce.z) * 1.5, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, groundColour(vLookPos.xz), lkNear * lkDown);
  }
}`;

// The rewrite of a lit material's shaders, as pure strings. `chunks` is
// three's ShaderChunk (passed in so this can be tested with stubs). A part
// whose line isn't where this expects it (another three version) is left
// out, and says so in `swapped`.
export function houseShader({ vertexShader, fragmentShader }, { fog = true, ground = false } = {}, chunks = THREE.ShaderChunk) {
  const swapped = { look: false, fog: false, ground: false };
  if (!fragmentShader.includes('#include <opaque_fragment>')) return { vertexShader, fragmentShader, swapped };
  let vs = vertexShader;
  let fs = fragmentShader.replace('#include <common>', `#include <common>\n${PARS}`).replace('#include <opaque_fragment>', `${LOOK_GLSL}#include <opaque_fragment>`);
  swapped.look = true;
  if (ground && vs.includes('#include <project_vertex>') && fs.includes('#include <color_fragment>')) {
    const nrm = vs.includes('#include <beginnormal_vertex>') ? 'objectNormal' : 'normal';
    vs = vs.replace('#include <common>', '#include <common>\nvarying vec3 vLookPos;\nvarying vec3 vLookN;').replace('#include <project_vertex>', `#include <project_vertex>${BOUNCE_VS(nrm)}`);
    // (a floor painted by the map has its functions already)
    const decl = `varying vec3 vLookPos;\nvarying vec3 vLookN;\nuniform vec3 uLookBounce;\n${fs.includes('uniform sampler2D uGroundMap;') ? '' : GROUND_GLSL}`;
    fs = fs.replace('#include <common>', `#include <common>\n${decl}`).replace('#include <color_fragment>', `#include <color_fragment>${BOUNCE_FS}`);
    swapped.ground = true;
  }
  const chunk = chunks.fog_fragment;
  if (fog && typeof chunk === 'string' && chunk.includes(FOG_LINE) && fs.includes('#include <fog_fragment>')) {
    fs = fs.replace('#include <fog_fragment>', chunk.replace(FOG_LINE, FOG_SKY));
    swapped.fog = true;
  }
  return { vertexShader: vs, fragmentShader: fs, swapped };
}

const LIT = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));
const colour = (v, out) => (v?.isColor ? out.copy(v) : out.set(v));

export function createHouse(look = {}) {
  // (`fog: false`: a world whose fog is already the sky's, its own way)
  const fog = look.fog !== false;
  const uniforms = {
    uLookRef: { value: new THREE.Color(1, 1, 1) },
    uLookShadow: { value: new THREE.Color() },
    uLookEdge: { value: new THREE.Vector2() },
    uLookMix: { value: 1 },
    uLookFogLow: { value: new THREE.Color() },
    uLookFogHigh: { value: new THREE.Color() },
    uLookFogBelow: { value: 1 },
    uLookSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uLookHalo: { value: new THREE.Color() },
    uLookFogMix: { value: 1 },
    uLookBounce: { value: new THREE.Vector3(1.5, 0.5, 0.6) },
  };
  let grounded = false;
  const patched = new Set();

  const set = (o = {}) => {
    const u = uniforms;
    if (o.shadow != null) colour(o.shadow, u.uLookShadow.value);
    if (o.edge) u.uLookEdge.value.set(o.edge[0], o.edge[1]);
    if (o.mix != null) u.uLookMix.value = o.mix;
    if (o.fogLow != null) colour(o.fogLow, u.uLookFogLow.value);
    if (o.fogHigh != null) colour(o.fogHigh, u.uLookFogHigh.value);
    if (o.fogBelow != null) u.uLookFogBelow.value = o.fogBelow;
    if (o.halo != null) colour(o.halo, u.uLookHalo.value);
    if (o.fogMix != null) u.uLookFogMix.value = o.fogMix;
  };
  set({ ...LOOK, ...look });

  // the look onto one material, once
  const patch = (m) => {
    if (!LIT(m) || m.userData.house || m.userData.noHouse) return false;
    const before = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      before?.call(m, sh, r);
      Object.assign(sh.uniforms, uniforms);
      const out = houseShader(sh, { ground: grounded, fog });
      sh.vertexShader = out.vertexShader;
      sh.fragmentShader = out.fragmentShader;
    };
    const key = m.customProgramCacheKey;
    m.customProgramCacheKey = () => `${key ? key.call(m) : ''}|house${grounded ? ':ground' : ''}${fog ? '' : ':nofog'}`;
    m.userData.house = uniforms;
    patched.add(m);
    m.needsUpdate = true;
    // (the mark made one a copy doesn't take: Material.copy copies userData
    // through JSON, which would carry it, and the textures in it, to a
    // material the look was never put on)
    Object.defineProperty(m.userData, 'house', { value: uniforms, enumerable: false, configurable: true });
    return true;
  };

  const tmp = new THREE.Color();
  return {
    uniforms,
    toneMapping: THREE.NeutralToneMapping,
    exposure: look.exposure ?? LOOK.exposure,
    set,
    // every lit material under `root` (a mesh, a group, a scene) in the
    // look; how many it took on (each is patched once, however often asked)
    adopt(root) {
      let n = 0;
      root?.traverse?.((o) => {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (patch(m)) n += 1;
      });
      return n;
    },
    // a new material, already in the look (a Lambert: no specular, the
    // illustrated finish)
    material(opts = {}) {
      const m = new THREE.MeshLambertMaterial(opts);
      patch(m);
      return m;
    },
    // full light, from the world's sun and sky: what a face square to the
    // sun, open to the sky, takes in (three's Lambert divides by pi). Once a
    // frame where the light moves; never quite nothing, so night still has
    // a scale to measure by.
    // (`env`: { level, intensity }, an HDR environment's mean radiance
    // (envLevel) and the scene's environmentIntensity: its diffuse light on
    // a face is about that, with no pi to divide by)
    light({ sun = null, hemi = null, ambient = null, env = null } = {}) {
      const ref = uniforms.uLookRef.value.setRGB(0, 0, 0);
      if (sun) ref.add(tmp.copy(sun.color).multiplyScalar(sun.intensity));
      if (hemi) ref.add(tmp.copy(hemi.color).multiplyScalar(hemi.intensity));
      if (ambient) ref.add(tmp.copy(ambient.color).multiplyScalar(ambient.intensity));
      ref.multiplyScalar(1 / Math.PI);
      if (env?.level) ref.add(tmp.copy(env.level).multiplyScalar(env.intensity ?? 1));
      ref.setRGB(Math.max(ref.r, 1e-3), Math.max(ref.g, 1e-3), Math.max(ref.b, 1e-3));
    },
    // the world's ground map (lib/three/groundmap): its colour bounces up
    // onto everything low that faces down, `height` metres deep, at most
    // `strength`, from faces `offset` short of level. Every material in the
    // look compiles with it from then on (those already made, again).
    ground(map, { height = 1.5, strength = 0.5, offset = 0.6 } = {}) {
      Object.assign(uniforms, map.uniforms);
      uniforms.uLookBounce.value.set(height, strength, offset);
      grounded = true;
      for (const m of patched) m.needsUpdate = true;
    },
    // the sky the fog is coloured by: its horizon, its zenith, how the haze
    // below the horizon compares, the direction to the sun and its glow
    sky({ low = null, high = null, below = null, sunDir = null, halo = null } = {}) {
      if (low) colour(low, uniforms.uLookFogLow.value);
      if (high) colour(high, uniforms.uLookFogHigh.value);
      if (below != null) uniforms.uLookFogBelow.value = below;
      if (sunDir) uniforms.uLookSunDir.value.copy(sunDir).normalize();
      if (halo) colour(halo, uniforms.uLookHalo.value);
    },
  };
}

// A shadow colour from a sky light, for a world (or a mood) that gives none
// of its own: the sky light's hue leaned a third toward violet, as bright as
// the sky light lets it be: pale lilac under a day sky, deep blue at night,
// never grey. `mood` is { shadow?, hemiSky (hex), hemi (intensity), grey? };
// its own `shadow` wins; `grey` (0…1) leans the colour that far toward its
// own grey, as bright (a world drawn as a film's or a game's is, the
// galaxy's space: a cool grey shade, not a coloured one). Returns a hex colour.
const VIOLET = new THREE.Color(0x7a6ad8);
const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
export function shadowFor(mood) {
  if (mood.shadow != null) return mood.shadow;
  const sky = new THREE.Color(mood.hemiSky ?? 0xcfe2ff);
  const want = 0.42 * lumOf(sky) * (mood.hemi ?? 1);
  const c = sky.clone().lerp(VIOLET, 0.35);
  const l = lumOf(c);
  if (l > 0) c.multiplyScalar(want / l);
  if (mood.grey) c.lerp(new THREE.Color(want, want, want), mood.grey);
  return c.getHex();
}

// A world put on the house look in one call: the house tone mapper (its
// exposure lifted to keep the world's brightness from its ACES days, unless
// `keepExposure`: a world tuned under Neutral already; `toneMap: false`: a
// world whose post pass tone-maps the house's way itself), everything in the
// scene adopted, and follow(): the look's full light from the world's sun
// (and sky light or ambient, if any) and its shadow colour from the sky
// light (or the ambient where there's no sky),
// recomputed when the sky light changes; `{ adopt: true }` also takes on
// whatever has come into the scene since. Call follow() after the world
// sets its lights (once a frame, or when they change).
export function houseOn({ renderer, scene, sun = null, hemi = null, ambient = null, env = null, keepExposure = false, toneMap = true, look = {} }) {
  const house = createHouse(look);
  if (toneMap) {
    renderer.toneMapping = house.toneMapping;
    if (!keepExposure) renderer.toneMappingExposure *= house.exposure;
  }
  // (the shade's colour from the sky light, or from an ambient light where there's no sky)
  const sky = hemi ?? ambient;
  house.adopt(scene);
  // what comes into the scene late, held back by the renderer's frame guard
  // (lib/three/frameGuard), takes the look before its shader is compiled,
  // not on the next follow({ adopt }) after it's been drawn (which compiled
  // it again, mid-frame)
  guardOf(renderer)?.adopt(scene, (object) => house.adopt(object));
  const seen = { hex: -1, k: -1 };
  // (an HDR environment: its mean radiance, measured again whenever its
  // picture is swapped for another)
  const envLight = env ? { level: null, intensity: 1, of: null } : null;
  house.follow = ({ adopt = false } = {}) => {
    if (envLight) {
      if (env.texture !== envLight.of) {
        envLight.of = env.texture;
        envLight.level = envLevel(env.texture);
        seen.k = -1;
      }
      envLight.intensity = typeof env.intensity === 'function' ? env.intensity() : (env.intensity ?? 1);
    }
    house.light({ sun, hemi, ambient, env: envLight });
    if (envLight?.level) {
      // (lit mostly by its environment: the shade's hue is the environment's)
      if (envLight.intensity !== seen.k) {
        seen.k = envLight.intensity;
        house.set({ shadow: shadowFromEnv(envLight.level, envLight.intensity) });
      }
    } else if (sky) {
      const hex = sky.color.getHex();
      if (hex !== seen.hex || sky.intensity !== seen.k) {
        seen.hex = hex;
        seen.k = sky.intensity;
        house.set({ shadow: shadowFor({ hemiSky: hex, hemi: sky.intensity, grey: look.grey }) });
      }
    }
    if (adopt) house.adopt(scene);
  };
  house.follow();
  return house;
}

// An HDR environment's mean radiance (an equirect DataTexture's pixels, RGB
// or RGBA, float or half float), each row weighted by the area of sky it
// covers: about the diffuse light it gives a face, by three's Lambert.
export function envLevel(texture) {
  const img = texture?.image;
  const data = img?.data;
  // (a PMREM has no pixels to read: lib/hdri measures the HDR it was made from)
  if (!data || !img.width || !img.height) return texture?.userData?.level ?? null;
  const { width: w, height: h } = img;
  const ch = Math.round(data.length / (w * h));
  const half = data instanceof Uint16Array;
  const read = (k) => (half ? THREE.DataUtils.fromHalfFloat(data[k]) : data[k]);
  const sum = [0, 0, 0];
  let weight = 0;
  // (about 256 x 128 of its texels are plenty: a 2K sky in a few milliseconds)
  const sx = Math.max(1, Math.floor(w / 256));
  const sy = Math.max(1, Math.floor(h / 128));
  for (let y = 0; y < h; y += sy) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const wy = Math.cos(lat);
    for (let x = 0; x < w; x += sx) {
      const k = (y * w + x) * ch;
      sum[0] += read(k) * wy;
      sum[1] += read(k + 1) * wy;
      sum[2] += read(k + 2) * wy;
      weight += wy;
    }
  }
  return new THREE.Color(sum[0] / weight, sum[1] / weight, sum[2] / weight);
}

// A shadow colour for a world lit by its environment: the environment's
// hue leaned a third toward violet, about a third brighter than the light
// it gives a shaded face (as shadowFor has it under a sky light).
export function shadowFromEnv(level, intensity = 1) {
  const c = level.clone();
  const l = lumOf(c);
  if (l <= 0) return 0x000000;
  c.multiplyScalar(1 / Math.max(c.r, c.g, c.b)).lerp(VIOLET, 0.35);
  c.multiplyScalar((1.33 * l * intensity) / lumOf(c));
  return c.getHex();
}
