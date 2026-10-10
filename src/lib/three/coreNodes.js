// core.js on the node renderer: the kit of photo-scanned surfaces worn
// over a material's colour in the world (triplanar), as node hooks
// (./hookNodes.js) on a node material: the same names, arguments and
// uniforms (uniform and texture nodes under the GLSL's names). The kit's
// files, its loading, meanColour, dress and rolesFor are core.js's, copied:
// importing them would bring its GLSL into a 'nodes' world's closure.
//
//   CORE, coreOf(role), coreFiles(role, { xl, base, index }), loadCore(role, { xl, base, index })
//   wear(material, scan, { metres, strength, normal, mean }) → the node material
//   dress(materials, roles, opts) → how many it dressed (a classic material in
//     `materials` is replaced there by its node twin)
//   meanColour(texture), rolesFor(materials)

import * as THREE from 'three';
import SCANS from '../../../public/cc0/galaxy/index.json';
import { budget } from '../device';
import { loadTexture, sharpen } from './textures';
import { abs, cameraViewMatrix, faceDirection, mix, normalWorldGeometry, normalize, positionWorld, pow, texture, uniform, vec3, vec4 } from 'three/tsl';
import { asNode, onColor, onNormal } from './hookNodes';

// (a texture node needs a picture: a flat relief where a scan has none)
const FLAT = (() => {
  const t = new THREE.DataTexture(Uint8Array.from([128, 128, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

export const CORE = SCANS;
export const coreOf = (role) => SCANS[role] ?? null;

const BASE = '/cc0/galaxy';

// A scan's files: its 1K WebPs, or with `xl` (ultra's, asked for only
// there) its 8192 colour and normal maps where scripts/galaxy-textures.mjs
// --ultra has made them (the index's `xl`: 'ktx2' or 'webp'); the 1K set
// where it hasn't. The ARM map stays the small one.
export function coreFiles(role, { xl = false, index = SCANS, base = BASE } = {}) {
  const big = xl ? index[role]?.xl : null;
  const file = (name) => (big ? `${base}/${role}/${name}-xl.${big}` : `${base}/${role}/${name}.webp`);
  return { color: file('color'), normal: file('normal'), arm: index[role]?.arm ? `${base}/${role}/arm.webp` : null };
}

// The scans, each loaded once for the page (every world shares them; a new
// renderer uploads them again by itself): role → a promise of { map,
// normalMap, arm }, or of null where they can't be had. With `xl` (ultra),
// the 8192 set where there is one, the 1K set if it won't load.
const loaded = new Map();
export function loadCore(role, { xl = false, base = BASE, index = SCANS } = {}) {
  const files = coreFiles(role, { xl, base, index });
  const key = files.color;
  if (!loaded.has(key)) {
    const loader = new THREE.TextureLoader();
    const get = (url, srgb) =>
      (/\.ktx2$/.test(url) ? loadTexture(url, { color: srgb }) : loader.loadAsync(url)).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        sharpen(t);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });
    const small = xl && key !== coreFiles(role, { base, index }).color ? () => loadCore(role, { base, index }) : () => null;
    loaded.set(
      key,
      Promise.all([get(files.color, true), get(files.normal, false), files.arm ? get(files.arm, false) : null])
        .then(([map, normalMap, arm]) => ({ map, normalMap, arm }))
        .catch(small),
    );
  }
  return loaded.get(key);
}

// coreWeights: which way the surface faces, as the three axes' shares
const weightsOf = (n) => {
  const w = pow(abs(n), vec3(4));
  return w.div(w.x.add(w.y).add(w.z));
};

const LIT = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial));

// A scan ({ map, normalMap }) on a lit material, once: `metres` of world a
// repeat, `strength` of its colour (0 to 1), `normal` its relief, `mean` the
// sRGB brightness its detail map is centred on.
export function wear(material, scan, { metres = 2, strength = 0.55, normal = 0.8, mean = 0.8 } = {}) {
  if (!LIT(material) || !scan?.map || material.userData.core) return material;
  const uniforms = {
    uCoreMap: texture(scan.map),
    uCoreNormal: texture(scan.normalMap ?? FLAT),
    uCoreScale: uniform(1 / metres),
    uCoreStrength: uniform(strength),
    uCoreNormalStrength: uniform(scan.normalMap ? normal : 0),
    // (the map is read decoded to linear: its sRGB mean, linear)
    uCoreMean: uniform(mean ** 2.2),
  };
  // (a mark a copy doesn't take: Material.copy copies userData through JSON)
  const m = asNode(material);
  Object.defineProperty(m.userData, 'core', { value: uniforms, enumerable: false, configurable: true });
  const withNormal = Boolean(scan.normalMap);
  // vCorePos and vCoreNormal: the world point and the geometry's world
  // normal, instancing in (three's positionWorld, normalWorldGeometry)
  const nw = () => normalize(normalWorldGeometry);
  const cp = () => positionWorld.mul(uniforms.uCoreScale);
  onColor(
    m,
    (d) => {
      const w = weightsOf(nw());
      const p = cp();
      const cc = uniforms.uCoreMap.sample(p.zy).rgb.mul(w.x).add(uniforms.uCoreMap.sample(p.xz).rgb.mul(w.y)).add(uniforms.uCoreMap.sample(p.xy).rgb.mul(w.z));
      return d.rgb.mul(mix(vec3(1, 1, 1), cc.div(uniforms.uCoreMean), uniforms.uCoreStrength));
    },
    `core${withNormal ? ':n' : ''}`,
    uniforms,
  );
  // (the relief: Ben Golus's "UDN" triplanar, FRAG_NORMAL's lines)
  if (withNormal)
    onNormal(
      m,
      (normal) => {
        const n = nw();
        const w = weightsOf(n);
        const p = cp();
        const unpack = (at) => uniforms.uCoreNormal.sample(at).xyz.mul(2).sub(1);
        const s = uniforms.uCoreNormalStrength;
        const tx = unpack(p.zy);
        const ty = unpack(p.xz);
        const tz = unpack(p.xy);
        const x = vec3(tx.xy.mul(s).add(n.zy), n.x);
        const y = vec3(ty.xy.mul(s).add(n.xz), n.y);
        const z = vec3(tz.xy.mul(s).add(n.xy), n.z);
        const dn = normalize(x.zyx.mul(w.x).add(y.xzy.mul(w.y)).add(z.xyz.mul(w.z)));
        const shift = cameraViewMatrix.mul(vec4(dn.sub(n), 0)).xyz;
        return normalize(normal.add(shift.mul(faceDirection)));
      },
      'core:normal',
    );
  return m;
}

// A picture's mean colour, linear: a DataTexture's bytes, or a canvas or
// bitmap drawn small.
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function meanColour(texture) {
  const img = texture?.image;
  if (!img) return null;
  let data = img.data;
  if (!data && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    try {
      g.drawImage(img, 0, 0, 16, 16);
      data = g.getImageData(0, 0, 16, 16).data;
    } catch {
      return null;
    }
  }
  if (!data?.length) return null;
  const srgb = texture.colorSpace === THREE.SRGBColorSpace || !img.data;
  const sum = [0, 0, 0];
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4)
    for (let k = 0; k < 3; k++) {
      const v = data[i + k] / 255;
      sum[k] += srgb ? toLin(v) : v;
    }
  return new THREE.Color().setRGB(sum[0] / n, sum[1] / n, sum[2] / n, THREE.LinearSRGBColorSpace);
}

// Stand-ins for a role's scan until it has loaded (dress with `keep`): a
// picture at the scan's centred brightness and a flat relief, so the
// material looks as it did, but it's drawn from the first frame with the
// shader the scan will be, and the scan's pictures go in later with no
// shader made again. Made again just after a world's first frame, that
// shader was left out of the frame by lib/three/frameGuard for a few frames
// while it readied it: walls on screen dropped out and came back.
const standIns = new Map(); // centred brightness → { map, normalMap }
function standIn(mean) {
  let s = standIns.get(mean);
  if (!s) {
    const px = (r, g, b) => {
      const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    };
    // (linear, at what the scan's sRGB mean decodes to: the detail's divided by it, so 1)
    const v = Math.round(255 * mean ** 2.2);
    s = { map: px(v, v, v), normalMap: px(128, 128, 255) };
    standIns.set(mean, s);
  }
  return s;
}

// A world's named materials onto the kit's roles: each one's own painted
// picture folded into its colour (and its own relief dropped), and the
// role's scan put on, at its real size. `keep` leaves the picture and the
// relief where they carry the design (cobbles, ruts, coursed blocks) and
// lays the scan's grain over them. Not on the lowest tier, where
// everything stays as it was. Resolves to how many it dressed.
export async function dress(materials, roles, { strength = 0.55, normal = 0.9, keep = false, load = loadCore, tier = budget().tier } = {}) {
  if (tier === 'low') return 0;
  const jobs = Object.entries(roles).map(async ([name, role]) => {
    const m = materials[name];
    if (!LIT(m) || m.userData.core) return 0;
    const { metres = 2, mean: centre = 0.8 } = coreOf(role) ?? {};
    // (with `keep` nothing of the material changes when the scan comes but
    // its pictures, so it's worn at once, on stand-ins)
    // (a classic material is swapped for its node twin in `materials`: the
    // world reads its materials from there)
    let worn = m;
    if (keep) worn = materials[name] = wear(m, standIn(centre), { metres, mean: centre, strength, normal });
    const scan = await load(role);
    if (keep) {
      const u = worn.userData.core;
      if (!scan?.map) {
        u.uCoreStrength.value = 0;
        u.uCoreNormalStrength.value = 0;
        return 0;
      }
      u.uCoreMap.value = scan.map;
      u.uCoreNormal.value = scan.normalMap ?? u.uCoreNormal.value;
      u.uCoreNormalStrength.value = scan.normalMap ? normal : 0;
      return 1;
    }
    if (!scan) return 0;
    const mean = meanColour(m.map);
    if (mean) m.color.multiply(mean);
    if (m.map) m.map = null;
    if (m.normalMap) m.normalMap = null;
    materials[name] = wear(m, scan, { metres, mean: centre, strength, normal });
    return 1;
  });
  return (await Promise.all(jobs)).reduce((a, b) => a + b, 0);
}

// Which role a world's material wears, by its name: the usual names of
// stone, wood, bark, turf, plaster, iron and rock in the worlds' kits. What
// glows (or is lit from within by a map: lit windows), what is
// see-through, and anything named for skin, eyes, glass,
// cloth, food, fire or the like wears nothing.
const NOT_WORN = /skin|eye|glow|hair|lava|flame|fire|water|glass|pane|lamp|lantern|void|smoke|plume|web|silk|wax|food|bread|meat|flower|blossom|leaf|tuft|thatch|banner|flag|cloth|velvet|tapestry|fur|page|parchment|book|mouth|tooth|fang|gold|gilt|brass|pewter|ember|coal|statue|carve|emblem|shadow|robe/i;
const ROLE_NAMES = [
  [/bark/i, 'bark'],
  [/wood|timber|beam|log|plank|board|fence|barn|cart/i, 'wood'],
  [/turf|grass|lawn|moss/i, 'grass'],
  [/plaster|adobe|daub|^house$/i, 'adobe'],
  [/iron|steel|metal|gauntlet|armou?r/i, 'metal'],
  [/rock|cliff|crag|boulder|obsidian/i, 'rock'],
  [/stone|paving|wall|court|marble|ashlar|cobble|trim|vault|hearth/i, 'stone'],
  [/road|gravel/i, 'gravel'],
  [/sand/i, 'sand'],
  [/snow/i, 'snow'],
  [/mud|soil/i, 'mud'],
  [/^ash$/i, 'ash'],
];
export function rolesFor(materials) {
  const out = {};
  for (const [name, m] of Object.entries(materials ?? {})) {
    if (!LIT(m) || m.userData?.noCore || m.emissiveMap || NOT_WORN.test(name)) continue;
    if (m.transparent && m.opacity < 1) continue;
    // (cut out by its picture, a road's ragged edge: its picture is its shape)
    if (m.alphaMap || (m.alphaTest > 0 && m.map)) continue;
    const glow = m.emissive ? Math.max(m.emissive.r, m.emissive.g, m.emissive.b) * (m.emissiveIntensity ?? 1) : 0;
    if (glow > 0.05) continue;
    const hit = ROLE_NAMES.find(([re]) => re.test(name));
    if (hit && coreOf(hit[1])) out[name] = hit[1];
  }
  return out;
}
