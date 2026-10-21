// The castle’s materials, one a kind so the whole castle near is a draw
// each: two stones (`ashlar`, the walls’ dressed blocks; `rubble`, the
// rough stacked stone of the plinths, the viaduct’s piers, the crag’s
// retaining walls and the Owlery), `slate` for the roofs and the cones,
// `lead` for the flats, the finials and the clock’s face rim, `glass` that
// glows warm at night, `timber` for the bridge and the doors, `iron` for the
// glasshouses’ frames and the clock’s hands, and `pane`, their glass.
//
// Each is the house’s Lambert (houseNodes, through `house`) with the part’s
// tone in its vertex colours (mesh.js), and the stones and the slate wear
// a photo scan (public/cc0/galaxy/: ashlar, rubble, slate, Poly Haven, CC0):
// the stones triplanar in the world (coreNodes’ wear), the slate along the
// roof’s own metres so its courses run level round a cone. Every stone is
// weathered in the shader: a damp darkening at its foot, rain streaks down
// it, broad patches of grime; snow settles on what faces up (`snow`), rain
// darkens it (`wet`). The scans load in the background over stand-ins the
// shader was built with, so nothing is compiled twice. On low: no scans.
//
// The windows (glass) light by `night` (rules/clock.js’s windowsAt): each
// pane’s threshold (mesh.js’s aLit) says when, so they come on one at a
// time at dusk, warm, a candle’s colour, each a little different, a slow
// flicker in them.
//
//   createCastleMaterials({ house, tier }) → { ashlar, rubble, slate, lead, glass, timber, iron, pane,
//     uniforms: { uNight, uSnow, uWet, uTime }, set({ night, snow, wet }), update(dt), ready, dispose() }
//   TONES: the parts’ colours (linear), by name, for parts.js and far.js

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, float, mix, normalWorld, positionWorld, sin, smoothstep, texture, uniform, uv, vec3 } from 'three/tsl';
import { loadCore, wear } from '../../../../lib/three/coreNodes';
import { onColor } from '../../../../lib/three/hookNodes';
import { noiseWith } from '../../../../lib/three/noiseNodes';
import { CASTLE_FLOOR } from '../../rules/places';

const lin = (hex) => new THREE.Color(hex).toArray();
// the castle’s palette (sRGB in, linear out): a pale grey stone warmed by
// lichen, the plinths and the piers darker, a few towers paler or older,
// the Highland slate’s blue-grey, weathered lead, old oak, black iron
export const TONES = {
  stone: lin(0x9a948a),
  pale: lin(0xaaa498),
  old: lin(0x847e74),
  plinth: lin(0x6f6a62),
  pier: lin(0x7a7469),
  slate: lin(0x5d636c),
  slateDark: lin(0x4a4f57),
  lead: lin(0x5a6068),
  timber: lin(0x5a3f2a),
  oak: lin(0x3e2a1c),
  iron: lin(0x1c1d20),
  glass: lin(0x1e2630),
  pane: lin(0xb8d0c0),
  face: lin(0xd8cfb8),
  white: [1, 1, 1],
};

const blank = (r, g, b) => {
  const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};

export function createCastleMaterials({ house = null, tier = 'high' } = {}) {
  const uniforms = { uNight: uniform(0), uSnow: uniform(0), uWet: uniform(0), uTime: uniform(0), uSeed: uniform(new THREE.Vector3(2.7, 8.1, 4.4)) };
  const { noise } = noiseWith(uniforms.uSeed, { octaves: 2 });
  const made = [];
  const lambert = (opts) => {
    const m = house ? house.material({ vertexColors: true, ...opts }) : new MeshLambertNodeMaterial({ vertexColors: true, ...opts });
    made.push(m);
    return m;
  };
  const scans = tier !== 'low';

  // the weather on stone: a damp foot, streaks, grime, the snow on what faces up, the wet
  const weathered = (m, { streaks = 1, snowy = 1 } = {}) => {
    onColor(
      m,
      (d) => {
        const p = positionWorld;
        // (the damp a metre or two up from wherever the wall stands is read off the castle’s floor and the lake’s)
        const foot = smoothstep(2.5, 0, p.y.sub(CASTLE_FLOOR)).max(smoothstep(4, 0, p.y)).mul(0.22);
        const grime = noise(p.mul(vec3(0.05, 0.09, 0.05)), uniforms.uSeed).mul(0.5).add(0.5);
        const streak = noise(p.mul(vec3(0.9, 0.035, 0.9)), uniforms.uSeed).mul(0.5).add(0.5);
        const dark = float(1).sub(foot).sub(grime.mul(0.16)).sub(smoothstep(0.55, 0.9, streak).mul(0.14 * streaks));
        const c = d.rgb.mul(dark).mul(mix(float(1), float(0.72), uniforms.uWet));
        const up = smoothstep(0.55, 0.85, normalWorld.y).mul(uniforms.uSnow).mul(snowy);
        return mix(c, vec3(0.86, 0.88, 0.92), up.mul(smoothstep(0.2, 0.5, grime.add(0.25))));
      },
      'castle:weather',
      uniforms,
    );
    return m;
  };

  // a stone, its scan triplanar over its tone (a stand-in until the scan is
  // in, at the brightness the scan is centred on, linear: so 1 times the tone)
  const STAND = { map: blank(146, 146, 146), normalMap: blank(128, 128, 255) };
  const stone = (role, { metres, strength, normal }) => {
    let m = lambert({ color: 0xffffff });
    if (scans) m = wear(m, STAND, { metres, strength, normal, mean: 0.78 });
    weathered(m);
    return { m, role };
  };
  const ashlar = stone('ashlar', { metres: 2.5, strength: 0.8, normal: 0.9 });
  const rubble = stone('rubble', { metres: 2.5, strength: 0.85, normal: 1 });

  // the slate along the roof’s own metres (mesh.js’s uv), its courses level
  const slateMap = texture(blank(131, 131, 131));
  const slateK = uniform(new THREE.Vector2(1 / 3, 0.74 ** 2.2));
  const slate = lambert({ color: 0xffffff });
  if (scans)
    onColor(
      slate,
      (d) => {
        const s = slateMap.sample(uv().mul(slateK.x)).rgb.div(slateK.y.max(0.05));
        return d.rgb.mul(mix(vec3(1), s, 0.85));
      },
      'castle:slate',
      { slateMap, slateK },
    );
  weathered(slate, { streaks: 0.4, snowy: 1.4 });

  const lead = weathered(lambert({ color: 0xffffff }), { streaks: 0.6 });
  const timber = lambert({ color: 0xffffff });
  const iron = lambert({ color: 0xffffff });

  // the windows: dark by day, warm at night, each on its own threshold
  const glass = lambert({ color: 0xffffff });
  const aLit = attribute('aLit', 'float');
  const on = smoothstep(aLit.sub(0.05), aLit.add(0.05), uniforms.uNight);
  // (a candle’s warmth, a few windows whiter and a few redder, by the threshold; a slow flicker each)
  const hue = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.62, 0.3), sin(aLit.mul(97.3)).mul(0.5).add(0.5));
  const flicker = sin(uniforms.uTime.mul(aLit.mul(3).add(1.3)).add(aLit.mul(41))).mul(0.06).add(0.94);
  glass.emissiveNode = hue.mul(on).mul(flicker).mul(2.6);

  // the glasshouses’ glass: pale green, thin, the sky through it
  const pane = lambert({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });

  // the scans in, over their stand-ins
  const ready = scans
    ? Promise.all(
        [ashlar, rubble].map(({ m, role }) =>
          loadCore(role).then((got) => {
            const u = m.userData.core;
            if (!got || !u) return;
            u.uCoreMap.value = got.map;
            if (got.normalMap) u.uCoreNormal.value = got.normalMap;
          }),
        ),
      )
        .then(() => loadCore('slate'))
        .then((got) => {
          if (got?.map) slateMap.value = got.map;
        })
        .catch(() => {})
    : Promise.resolve();

  return {
    ashlar: ashlar.m,
    rubble: rubble.m,
    slate,
    lead,
    glass,
    timber,
    iron,
    pane,
    uniforms,
    ready,
    set({ night = null, snow = null, wet = null } = {}) {
      if (night != null) uniforms.uNight.value = night;
      if (snow != null) uniforms.uSnow.value = snow;
      if (wet != null) uniforms.uWet.value = wet;
    },
    update(dt) {
      uniforms.uTime.value += dt;
    },
    dispose() {
      for (const m of made) m.dispose();
    },
  };
}
