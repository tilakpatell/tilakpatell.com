// A level pack's placed lights (lights.json, scripts/bf2017-lights.mjs): on
// the node renderer, lane R's pools (src/lib/three/light/placed.js: a
// thousand clustered points on WebGPU, 64 over WebGL 2, 16 spots); on the
// classic renderer, where every light is in every material's shader, the
// three nearest points by screen area, a fixed pool so nothing recompiles.
// None on low. The game's lumens come to the site's units by `scale`
// (lightScale: the record's exposure, as lane R's entry reads it).
//
//   GLSL_POOL = 3
//   lightScale(record) → the game's candela to the site's (pure)
//   createLevelLights({ scene, renderer, json, tier, scale }) → Promise<{ update(camera), lit(), dispose() }>

import * as THREE from 'three';
import { backendOf } from '../../../../lib/three/light/three.js';
import { CELL, cellsNear, createPlacedLights, lightsFor } from '../../../../lib/three/light/placed.js';

export const GLSL_POOL = 3;

export function lightScale(record) {
  const t = record?.weathers?.[record.main]?.tonemap;
  const comp = t?.compensation ?? 0;
  const ev = t?.maxEV ?? 14;
  return 2 ** comp / (1.2 * 2 ** ev);
}

export async function createLevelLights({ scene, renderer, json, tier = 'high', scale = 1 }) {
  if (tier === 'low' || !json?.cells) return null;
  if (backendOf(renderer) !== 'webgl') {
    const placed = await createPlacedLights(scene, renderer, { source: json, scale });
    return { update: (camera) => placed.update(camera), lit: () => placed.lit, dispose: () => placed.dispose() };
  }
  const pool = Array.from({ length: GLSL_POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 1, 2);
    l.name = 'level-light';
    scene.add(l);
    return l;
  });
  let lit = 0;
  return {
    update(camera) {
      const cells = cellsNear([camera.position.x, camera.position.y, camera.position.z], json.cell ?? CELL);
      const near = lightsFor(json, cells, camera, { max: GLSL_POOL, kind: 'point' }).map((p) => ({ ...json.cells[p.cell][p.i], weight: p.weight }));
      lit = near.length;
      pool.forEach((l, i) => {
        const r = near[i];
        if (!r) {
          l.intensity = 0;
          return;
        }
        l.position.set(...r.pos);
        l.distance = r.range ?? 10;
        l.color.setRGB(...(r.color ?? [1, 1, 1]));
        l.intensity = (r.candela ?? 0) * (r.weight ?? 1) * scale;
      });
      return lit;
    },
    lit: () => lit,
    dispose() {
      for (const l of pool) {
        scene.remove(l);
        l.dispose();
      }
    },
  };
}
