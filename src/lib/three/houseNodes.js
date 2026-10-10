// house.js on the node renderer: the one look every world wears, its
// shade a colour and its fog the sky, as node hooks (./hookNodes.js) on
// node materials, with the same names, arguments and uniforms (uniform
// nodes under the GLSL's names). LOOK, shadowFor, envLevel and
// shadowFromEnv are house.js's, copied: importing them would bring its
// GLSL into a 'nodes' world's closure.
//
//   createHouse(look) → { uniforms, toneMapping, exposure, material(opts) (a
//     MeshLambertNodeMaterial), adopt(root) (a classic lit material met is
//     swapped on its object for its node twin), set(look), light(...), sky(...),
//     ground(map: groundmapNodes', opts) }
//   houseOn({ renderer, scene, ... }) → the house, following the world's light
//   LOOK, shadowFor(mood), envLevel(texture), shadowFromEnv(level, k)
//
// The look goes on after three has lit the point (onLight), so call adopt()
// after any other hook, as before.

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { clamp, diffuseColor, dot, emissive, max, metalness, mix, normalWorldGeometry, normalize, positionWorld, pow, select, smoothstep, uniform, vec3 } from 'three/tsl';
import { asNode, onColor, onFog, onLight, viewRay } from './hookNodes';

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

const lookLuma = (c) => dot(c, vec3(0.2126, 0.7152, 0.0722));

// houseSky: the sky along a direction, as the fog sees it
const houseSky = (u, d) => {
  const c = select(d.y.lessThan(0), u.uLookFogLow.mul(u.uLookFogBelow), mix(u.uLookFogLow, u.uLookFogHigh, pow(max(d.y, 0), 0.5)));
  return c.add(u.uLookHalo.mul(pow(max(dot(d, u.uLookSunDir), 0), 6)));
};

const LIT = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));
const colour = (v, out) => (v?.isColor ? out.copy(v) : out.set(v));

export function createHouse(look = {}) {
  // (`fog: false`: a world whose fog is already the sky's, its own way)
  const fog = look.fog !== false;
  const uniforms = {
    uLookRef: uniform(new THREE.Color(1, 1, 1)),
    uLookShadow: uniform(new THREE.Color()),
    uLookEdge: uniform(new THREE.Vector2()),
    uLookMix: uniform(1),
    uLookFogLow: uniform(new THREE.Color()),
    uLookFogHigh: uniform(new THREE.Color()),
    uLookFogBelow: uniform(1),
    uLookSunDir: uniform(new THREE.Vector3(0, 1, 0)),
    uLookHalo: uniform(new THREE.Color()),
    uLookFogMix: uniform(1),
    uLookBounce: uniform(new THREE.Vector3(1.5, 0.5, 0.6)),
  };
  let grounded = null; // the ground map's functions, once ground(map)
  const patched = new Set();
  const twins = new WeakMap(); // a classic material → its node twin, so one shared stays shared
  const own = { ...uniforms };

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

  const tag = () => `house${grounded ? ':ground' : ''}${fog ? '' : ':nofog'}`;
  // the look onto one node material, once
  const patch = (m) => {
    if (!LIT(m) || m.userData.house || m.userData.noHouse) return false;
    const u = uniforms;
    // the bounce (BOUNCE_FS): the ground's colour into the albedo, low and facing down, inside the map
    onColor(
      m,
      (d) => {
        if (!grounded) return null;
        const p = positionWorld;
        const at = p.xz.sub(grounded.uniforms.uGroundRect.xy).mul(grounded.uniforms.uGroundRect.zw);
        const inside = at.x.greaterThan(0).and(at.y.greaterThan(0)).and(at.x.lessThan(1)).and(at.y.lessThan(1));
        const near = pow(clamp(p.y.sub(grounded.groundHeight(p.xz)).div(u.uLookBounce.x).oneMinus(), 0, 1), 2).mul(u.uLookBounce.y);
        const down = clamp(normalize(normalWorldGeometry).y.negate().add(u.uLookBounce.z).mul(1.5), 0, 1);
        return select(inside, mix(d.rgb, grounded.groundColour(p.xz), near.mul(down)), d.rgb);
      },
      tag,
      own,
    );
    // the look (LOOK_GLSL): how lit the point is picks between three's light and the albedo in the shadow's colour
    onLight(m, (light) => {
      const albedo = diffuseColor.rgb;
      const lit = light.sub(emissive);
      const k = lookLuma(lit).div(max(lookLuma(albedo.mul(u.uLookRef)), 1e-4));
      let shade = smoothstep(u.uLookEdge.x, u.uLookEdge.y, k).oneMinus().mul(u.uLookMix);
      if (m.isMeshStandardMaterial) shade = shade.mul(metalness.oneMinus());
      return mix(lit, albedo.mul(u.uLookShadow), shade).add(emissive);
    }, 'house:look');
    // the fog the sky's colour along the view ray (FOG_SKY)
    if (fog) onFog(m, (fogColor) => mix(fogColor, houseSky(u, viewRay()), u.uLookFogMix), 'house:fog');
    patched.add(m);
    // (the mark made one a copy doesn't take: Material.copy copies userData
    // through JSON, which would carry it to a material the look was never put on)
    Object.defineProperty(m.userData, 'house', { value: uniforms, enumerable: false, configurable: true });
    return true;
  };
  // a classic material in the scene: its node twin put in its place
  const nodeOf = (m) => {
    if (!m || m.isNodeMaterial || !LIT(m)) return m;
    if (!twins.has(m)) twins.set(m, asNode(m));
    return twins.get(m);
  };

  const tmp = new THREE.Color();
  return {
    uniforms,
    toneMapping: THREE.NeutralToneMapping,
    exposure: look.exposure ?? LOOK.exposure,
    set,
    // every lit material under `root` (a mesh, a group, a scene) in the
    // look; how many it took on (each is patched once, however often asked)
    // (a classic lit material met here is swapped for its node twin on the
    // object, so a loaded model takes the look on the node renderer)
    adopt(root) {
      let n = 0;
      root?.traverse?.((o) => {
        if (!o.material) return;
        if (Array.isArray(o.material)) o.material = o.material.map(nodeOf);
        else o.material = nodeOf(o.material);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (patch(m)) n += 1;
      });
      return n;
    },
    // a new material, already in the look (a Lambert: no specular, the
    // illustrated finish)
    material(opts = {}) {
      const m = new MeshLambertNodeMaterial(opts);
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
      grounded = map;
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
// never grey. `mood` is { shadow?, hemiSky (hex), hemi (intensity) }; its own
// `shadow` wins. Returns a hex colour.
const VIOLET = new THREE.Color(0x7a6ad8);
const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
export function shadowFor(mood) {
  if (mood.shadow != null) return mood.shadow;
  const sky = new THREE.Color(mood.hemiSky ?? 0xcfe2ff);
  const want = 0.42 * lumOf(sky) * (mood.hemi ?? 1);
  const c = sky.clone().lerp(VIOLET, 0.35);
  const l = lumOf(c);
  if (l > 0) c.multiplyScalar(want / l);
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
  // (no frame guard on the node renderer: lib/three/frameGuard is the
  // classic renderer's; what comes in late is adopted by follow({ adopt }))
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
        house.set({ shadow: shadowFor({ hemiSky: hex, hemi: sky.intensity }) });
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
