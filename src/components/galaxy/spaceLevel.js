// A space level's pack drawn round its Starfighter Assault in the galaxy's
// flight (warfront.js's starfighter: the battle's `draw`). The pack is lane
// L's (scripts/bf2017-level.mjs, drawn by surface/level/: streamed by cells,
// each mesh at the LOD its size and distance give it), in the game's metres
// round its spot; here it's scaled into the battle's units (53.3 m to one,
// surface/missions/starfighter.js's METRES) and set so the level's origin
// is the battle's middle, as the battle's ships and objectives are.
//
//   drawSpaceLevel(scene, { pack, origin, packOrigin, tier, renderer, area, ships }) →
//     (laid, { unhide }) → { update(cameraPosition), group, area, dispose() }
//   (`ships`: the level's, levelOf's; one the pack should draw whose hull
//   its tier leaves out is told `unhide(id)`, for the battle to draw it)
//   (`origin`: the level's point at the battle's middle, the stages file's;
//   `packOrigin`: the pack's own, its builder's --spot, with no ground its y 0;
//   `area`: a level fought in an area of its own, levelArea.js's, the stages
//   file's { radius, sea } in metres with its sky and fog)

import * as THREE from 'three';
import { createLevel, packOf } from './surface/level';
import { createLevelArea } from './levelArea';
import { LIGHTS } from '../../data/bf2017/light';
import { METRES } from './surface/missions/starfighter';

const _v = new THREE.Vector3();
// (a mesh the export gives no colour map, the Death Star's wreckage among
// them, drawn the game's hull grey and a little metal, not plain white)
const HULL = new THREE.Color(0x6b6f76);
const greyed = (root) =>
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      if (!m || m.userData.spaceGrey || m.map || !m.color) continue;
      m.userData.spaceGrey = true;
      m.color.copy(HULL);
      if ('metalness' in m) m.metalness = Math.max(m.metalness, 0.45);
      if ('roughness' in m) m.roughness = Math.min(m.roughness, 0.6);
    }
  });

export function drawSpaceLevel(scene, { pack, origin, packOrigin, tier, renderer = null, area = null, ships = [] }) {
  return (laid, { unhide = () => {} } = {}) => {
    const group = new THREE.Group();
    group.name = `level-${pack}`;
    group.scale.setScalar(1 / METRES);
    group.position.set(...laid.at.map((x, k) => x + (packOrigin[k] - origin[k]) / METRES));
    scene.add(group);
    group.updateMatrixWorld(true);
    const level = createLevel({ scene: group, site: { level: pack }, tier, renderer });
    let gone = false;
    packOf(pack)
      .then((p) => {
        if (gone) return;
        const out = new Set((p.cull?.[tier] ?? p.cull?.high)?.dropped ?? []);
        const left = new Set(p.meshes.filter((m, i) => out.has(i) || !m.glb.some(Boolean)).map((m) => m.name.split('/').pop()));
        for (const s of ships) if (s.pack && left.has(`${s.mesh}_mesh.glb`)) unhide(s.id);
      })
      .catch(() => {});
    // (its own sky, sea and storm round it, where it has an area of its own)
    // (lit by the world's own light record, its weather the level's own: levelArea.js)
    const room = area
      ? createLevelArea(scene, {
          at: laid.at,
          radius: area.radius / METRES,
          sea: area.sea === null ? null : laid.frame([0, area.sea, 0])[1],
          sky: area.sky,
          fog: area.fog ? { ...area.fog, density: area.fog.density * METRES } : null,
          light: area.light ? (LIGHTS[area.light] ?? null) : null,
          fill: area.fill ?? null,
          probe: area.probe ? (LIGHTS[area.probe] ?? null) : null,
          metres: METRES,
          weather: `/models/galaxy/bf2017/levels/${pack}/area.json`,
          frame: laid.frame,
        })
      : null;
    let last = performance.now();
    let looked = -Infinity;
    return {
      group,
      // (where the camera is in the pack's own metres: its LODs and cells by that)
      update(at) {
        const now0 = performance.now();
        room?.update({ position: at }, now0 / 1000, Math.min(0.1, (now0 - last) / 1000));
        last = now0;
        if (!at || !level) return;
        _v.set(at.x, at.y, at.z);
        group.worldToLocal(_v);
        level.update([_v.x, _v.z]);
        // (the draws come in as their meshes load: looked over every second)
        const now = performance.now();
        if (now - looked >= 1000) {
          looked = now;
          greyed(group);
        }
      },
      area: room,
      stats: () => level?.stats() ?? null,
      dispose() {
        gone = true;
        room?.dispose();
        level?.dispose();
        scene.remove(group);
      },
    };
  };
}
