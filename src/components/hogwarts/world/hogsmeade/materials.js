// The village’s surfaces (in a browser): the photo-scanned stone, plaster,
// oak and iron worn over each house’s own colours (lib/three/coreNodes’
// triplanar scans: the grain at its real size, with its relief), the
// painted slates, setts and flags with theirs, the leaded glass lit from
// inside as the light goes, the shop windows’ goods, the signs and the
// fascias; and the snow, laid by one number on everything that faces up
// (roofs, sills, the street, the ground), broken up so it lies in drifts
// and patches as it thins. On low, no scans.
//
//   createVillageMaterials({ tier, renderer, scans, atlases }) → {
//     mats, set({ snow, windows, lamps, smoke }), dispose() }
//   scans: { role: scan } (loadCore’s, those that loaded); atlases: { signs, fascia, goods } canvases

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { clamp, mix, normalWorldGeometry, normalize, positionWorld, pow, smoothstep, texture, uniform, uv, vec3 } from 'three/tsl';
import { canvasTexture, hot } from '../../../../lib/three/canvasTexture';
import { wear } from '../../../../lib/three/coreNodes';
import { onColor } from '../../../../lib/three/hookNodes';
import { flagsCanvas, leadedCanvas, noiseCanvas, settsCanvas, slateCanvas } from './canvases';

const SNOW = new THREE.Color('#eef2f7');

export function createVillageMaterials({ tier = 'high', renderer = null, scans = {}, atlases = {} } = {}) {
  const made = [];
  const textures = [];
  const T = (c, o = {}) => {
    const t = canvasTexture(c, renderer, o);
    textures.push(t);
    return t;
  };
  const snow = uniform(0);
  const noise = T(noiseCanvas());
  const noiseNode = texture(noise);
  const scanned = tier !== 'low';

  // the snow on a material: where the face looks up, in drifts that thin to patches
  const snowy = (m, { lo = 0.55, hi = 0.82, strength = 1 } = {}) => {
    onColor(
      m,
      (d) => {
        const up = smoothstep(lo, hi, normalize(normalWorldGeometry).y);
        const n = noiseNode.sample(positionWorld.xz.mul(0.11)).r;
        const fine = noiseNode.sample(positionWorld.xz.mul(0.9)).r;
        const cover = clamp(snow.mul(1.8).add(n.mul(0.6)).add(fine.mul(0.2)).sub(0.8), 0, 1);
        return mix(d.rgb, vec3(SNOW.r, SNOW.g, SNOW.b), up.mul(cover).mul(strength));
      },
      'village:snow',
      { snow },
    );
    return m;
  };
  const make = (opts, { scan = null, metres = 2, strength = 0.55, snowOn = null } = {}) => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, ...opts });
    made.push(m);
    if (scanned && scan && scans[scan]) wear(m, scans[scan], { metres, strength, normal: 0.85 });
    if (snowOn) snowy(m, snowOn);
    return m;
  };

  const slate = slateCanvas();
  const setts = settsCanvas();
  const flags = flagsCanvas();
  const rep = (c, srgb = true) => T(c, { srgb, wrap: true });
  const leaded = T(leadedCanvas(), { wrap: false });
  const signs = atlases.signs ? T(atlases.signs, { wrap: false }) : null;
  const fascia = atlases.fascia ? T(atlases.fascia, { wrap: false }) : null;
  const goods = atlases.goods ? T(atlases.goods, { wrap: false }) : null;

  const mats = {
    stone: make({ color: 0xffffff, vertexColors: true, roughness: 0.92 }, { scan: 'stone', metres: 1.5, strength: 0.75, snowOn: { lo: 0.6, hi: 0.85 } }),
    plaster: make({ color: 0xffffff, vertexColors: true, roughness: 0.95 }, { scan: 'adobe', metres: 1.4, strength: 0.42 }),
    timber: make({ color: 0x3a2a1d, roughness: 0.85 }, { scan: 'wood', metres: 1.1, strength: 0.6, snowOn: { lo: 0.7, hi: 0.9, strength: 0.9 } }),
    paint: make({ color: 0xffffff, vertexColors: true, roughness: 0.6 }, { scan: 'wood', metres: 1.2, strength: 0.3, snowOn: { lo: 0.7, hi: 0.9 } }),
    shackwood: make({ color: 0xffffff, vertexColors: true, roughness: 0.95 }, { scan: 'wood', metres: 1.3, strength: 0.75, snowOn: { lo: 0.6, hi: 0.85 } }),
    slate: make({ color: 0xffffff, vertexColors: true, map: rep(slate.map), normalMap: rep(slate.normal, false), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.72 }, { snowOn: { lo: 0.35, hi: 0.6 } }),
    setts: make({ color: 0xffffff, map: rep(setts.map), normalMap: rep(setts.normal, false), roughness: 0.8 }, { snowOn: { lo: 0.6, hi: 0.9 } }),
    flags: make({ color: 0xffffff, map: rep(flags.map), normalMap: rep(flags.normal, false), roughness: 0.85 }, { snowOn: { lo: 0.6, hi: 0.9 } }),
    ground: make({ color: 0xffffff, vertexColors: true, roughness: 1 }, { scan: 'grass', metres: 2.5, strength: 0.6, snowOn: { lo: 0.2, hi: 0.6 } }),
    rock: make({ color: 0xffffff, vertexColors: true, roughness: 1 }, { scan: 'rock', metres: 9, strength: 0.6, snowOn: { lo: 0.45, hi: 0.75 } }),
    iron: make({ color: 0x23211f, roughness: 0.45, metalness: 0.6 }, { scan: 'metal', metres: 0.8, strength: 0.4, snowOn: { lo: 0.75, hi: 0.95, strength: 0.8 } }),
    pot: make({ color: 0x9a5236, roughness: 0.8 }),
    // the glass: dark by day, warm from inside at night (the bloom finds it)
    glassLit: make({ color: 0x3a4048, map: leaded, emissiveMap: leaded, emissive: hot(0xffa850, 1.8), emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 }),
    glassDark: make({ color: 0x2a3036, map: leaded, emissiveMap: leaded, emissive: hot(0xff9a48, 0.25), emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 }),
    goods: make({ color: 0x9a9088, map: goods, emissiveMap: goods, emissive: hot(0xffe8cc, 0.9), emissiveIntensity: 0.1, roughness: 0.2, metalness: 0.1 }),
    signs: make({ color: 0xffffff, map: signs, roughness: 0.7, side: THREE.DoubleSide }),
    // (the fascia catches the shop’s light at night)
    fascia: make({ color: 0xffffff, map: fascia, emissiveMap: fascia, emissive: new THREE.Color(0xffd8a0), emissiveIntensity: 0, roughness: 0.6 }),
    lamp: new MeshBasicNodeMaterial({ color: hot(0xffb460, 0.2) }),
    // a warm pool of light on the ground, thrown by a window or a lamp: soft-edged, added on
    pool: new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }),
  };
  const poolK = uniform(0);
  const rr = uv().sub(0.5).mul(2).length();
  mats.pool.colorNode = vec3(1, 0.62, 0.3).mul(pow(smoothstep(0, 1, rr).oneMinus(), 2).mul(poolK).mul(0.55));
  for (const m of [mats.lamp, mats.pool]) {
    m.userData.noHouse = true;
    made.push(m);
  }

  const lampBase = new THREE.Color(0xffb460);
  return {
    mats,
    snow,
    set({ snow: s = null, windows = null, lamps = null } = {}) {
      if (s != null) snow.value = s;
      if (windows != null) {
        mats.glassLit.emissiveIntensity = windows;
        mats.glassDark.emissiveIntensity = windows * 0.25;
        mats.goods.emissiveIntensity = 0.1 + windows * 0.6;
        mats.fascia.emissiveIntensity = windows * 0.22;
        poolK.value = windows;
      }
      if (lamps != null) mats.lamp.color.copy(lampBase).multiplyScalar(0.25 + lamps * 3.2);
    },
    dispose() {
      for (const m of made) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
