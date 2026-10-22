// The hero castle's materials, one a class of its faces (the cut names its
// primitives by what they are: scripts/lib/voxel-castle.mjs): the stone
// walls in the castle's ashlar scan, the roofs and cones in its slate, the
// boathouse's hill in the cliffs' rock (the terrain's own, so the hill and
// the crag are one rock), the courts' lawns and beds, the timber, the
// greenhouses' glass, the lanterns, and the windows: dark by day, lit warm
// from dusk, each on its own threshold so they come on one at a time.
//
// The model has no UVs and no vertex colours (its classes are its paint),
// so every scan is worn triplanar in the world (coreNodes' wear), each class
// its tone, and the weather on all the stone as on the kit's (castle/
// materials.js): a damp foot, rain streaks, grime, snow on what faces up, the
// wet. A window's threshold is a hash of the window's own place (a voxel
// window is a few metres across, so a cell of that size is one window).
// On low: no scans.
//
//   createHeroMaterials({ house, tier }) → { stone, slate, rock, earth, grass, wood, window, glass, lamp,
//     uniforms, set({ night, snow, wet }), update(dt), ready, dispose() }

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { float, floor, mix, normalWorld, positionWorld, sin, smoothstep, uniform, vec3 } from 'three/tsl';
import { loadCore, wear } from '../../../../lib/three/coreNodes';
import { onColor } from '../../../../lib/three/hookNodes';
import { noiseWith } from '../../../../lib/three/noiseNodes';
import { CASTLE_FLOOR } from '../../rules/places';
import { CASTLE_SCANS, TONES } from './materials';

const lin = (hex) => new THREE.Color(hex);
// each class's tone (sRGB): the castle's pale weathered stone, the Highland
// slate, the cliffs' grey rock, earth, a court's lawn, old oak, the night's glass
const TONE = {
  stone: new THREE.Color().fromArray(TONES.stone),
  slate: new THREE.Color().fromArray(TONES.slate),
  rock: lin(0x55534d),
  earth: lin(0x5a4632),
  grass: lin(0x46582e),
  wood: new THREE.Color().fromArray(TONES.timber),
  window: new THREE.Color().fromArray(TONES.glass),
};

const blank = (r, g, b) => {
  const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};
const STAND = { map: blank(146, 146, 146), normalMap: blank(128, 128, 255) };

export function createHeroMaterials({ house = null, tier = 'high' } = {}) {
  const uniforms = { uNight: uniform(0), uSnow: uniform(0), uWet: uniform(0), uTime: uniform(0), uSeed: uniform(new THREE.Vector3(2.7, 8.1, 4.4)) };
  const { noise, hash13 } = noiseWith(uniforms.uSeed, { octaves: 2 });
  const made = [];
  const lambert = (colour, opts = {}) => {
    const m = house ? house.material({ color: colour, ...opts }) : new MeshLambertNodeMaterial({ color: colour, ...opts });
    made.push(m);
    return m;
  };
  const scans = tier !== 'low';

  // the weather on stone, as the kit's: a damp foot, streaks, grime, the snow, the wet
  const weathered = (m, { streaks = 1, snowy = 1, blocks = 1 } = {}) => {
    onColor(
      m,
      (d) => {
        const p = positionWorld;
        const foot = smoothstep(2.5, 0, p.y.sub(CASTLE_FLOOR)).max(smoothstep(4, 0, p.y)).mul(0.22);
        const grime = noise(p.mul(vec3(0.05, 0.09, 0.05)), uniforms.uSeed).mul(0.5).add(0.5);
        const streak = noise(p.mul(vec3(0.9, 0.035, 0.9)), uniforms.uSeed).mul(0.5).add(0.5);
        // (a block a shade of its own: from across the lake, where the scan’s courses are a pixel, it still reads as built)
        const block = hash13(floor(p.mul(vec3(0.8, 1.6, 0.8))), uniforms.uSeed).sub(0.5).mul(0.16 * blocks);
        const dark = float(1).sub(foot).sub(grime.mul(0.16)).sub(smoothstep(0.55, 0.9, streak).mul(0.14 * streaks)).add(block);
        const c = d.rgb.mul(dark).mul(mix(float(1), float(0.72), uniforms.uWet));
        const up = smoothstep(0.55, 0.85, normalWorld.y).mul(uniforms.uSnow).mul(snowy);
        return mix(c, vec3(0.86, 0.88, 0.92), up.mul(smoothstep(0.2, 0.5, grime.add(0.25))));
      },
      'hero:weather',
      uniforms,
    );
    return m;
  };
  const scanned = (colour, role, look, weather) => {
    let m = lambert(colour);
    if (scans) m = wear(m, STAND, look);
    if (weather) weathered(m, weather);
    return { m, role };
  };

  const stone = scanned(TONE.stone, 'ashlar', { metres: 2.5, strength: 0.85, normal: 1.3, mean: 0.78 }, {});
  const slate = scanned(TONE.slate, 'slate', { metres: 1.6, strength: 0.9, normal: 1.2, mean: 0.74 }, { streaks: 0.4, snowy: 1.4, blocks: 0 });
  const rock = scanned(TONE.rock, 'rock', { metres: 4, strength: 0.95, normal: 1.4, mean: 0.5 }, { streaks: 0.7, blocks: 0 });
  const grass = scanned(TONE.grass, 'grass', { metres: 2, strength: 0.8, normal: 0.6, mean: 0.4 }, null);
  const earth = lambert(TONE.earth);
  const wood = lambert(TONE.wood);

  // the windows: a hash of the window’s cell its threshold, warm from dusk, a slow flicker each
  const window = lambert(TONE.window);
  const cell = floor(positionWorld.mul(vec3(0.45, 0.3, 0.45)));
  const lit = hash13(cell, uniforms.uSeed).mul(0.9).add(0.05);
  const on = smoothstep(lit.sub(0.05), lit.add(0.05), uniforms.uNight);
  const hue = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.62, 0.3), sin(lit.mul(97.3)).mul(0.5).add(0.5));
  const flicker = sin(uniforms.uTime.mul(lit.mul(3).add(1.3)).add(lit.mul(41))).mul(0.06).add(0.94);
  window.emissiveNode = hue.mul(on).mul(flicker).mul(2.8);
  // the lanterns: always a little warm, bright at night
  const lamp = lambert(lin(0xffd9a0));
  lamp.emissiveNode = vec3(1.0, 0.72, 0.36).mul(mix(float(0.25), float(3.2), uniforms.uNight));
  // the greenhouses’ glass: pale green, thin, the sky through it
  const glass = lambert(lin(0xb8d0c0), { transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });

  const ready = scans
    ? Promise.all(
        [
          [stone, CASTLE_SCANS],
          [slate, CASTLE_SCANS],
          [rock, undefined],
          [grass, undefined],
        ].map(([{ m, role }, index]) =>
          loadCore(role, index ?? {})
            .then((got) => {
              const u = m.userData.core;
              if (!got || !u) return;
              u.uCoreMap.value = got.map;
              if (got.normalMap) u.uCoreNormal.value = got.normalMap;
            })
            .catch(() => {}),
        ),
      )
    : Promise.resolve();

  return {
    stone: stone.m,
    slate: slate.m,
    rock: rock.m,
    grass: grass.m,
    earth,
    wood,
    window,
    glass,
    lamp,
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
