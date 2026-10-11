// A level cell's walk-world shapes from the game's own Havok shapes (lane
// P0), in lane L's form (lib/level/collision.js's { floors, boxes }), for
// the devices that load no physics engine: each hull of each placed piece
// as a box turned by the piece's yaw (havok.js's solidsOf), or, if it is
// thin and wide (a floor plate, a stair's tread), a floor at its top, as
// lane L's rule reads bounds; a standing capsule or a ball a circle. Pieces
// whose mesh has no shapes come back in `without`, for lane L's bounds.
// Trimeshes aren't walk shapes: a hangar's shell isn't a box. Pure.
//
//   shapeSolids(draws, bin, shapesByMesh) → { floors, boxes, circles,
//     without: draws } (bin: the cell's 32-byte records; shapesByMesh:
//     { <mesh>: shapes } already read)
//   shapeReader(pack, loadBin) → (mesh) → Promise<shapes | null>, once a mesh
//   deckFloor(box) → the floor at a broad box's top (4 m each way), or null

import { readShapes, solidsOf } from '../physics/havok.js';
import { instancesOf } from '../../components/galaxy/surface/level/levelPhysics.js';

const FLOOR = { thick: 1, wide: 2 };
// a hull this wide each way is a deck as well as a box: a landing platform,
// a thick gangway. The walker climbs onto a box's top from beside it, but
// it is set down (a landing, a teleport, a respawn) on floors alone, so a
// platform with no floor at its top put you at the fall line under it
const DECK = 4;

// deckFloor(box) → a floor at its top, or null
export function deckFloor(b) {
  return Math.min(b.hw, b.hd) * 2 >= DECK ? { x: b.x, z: b.z, hw: b.hw, hd: b.hd, yaw: b.yaw, y: b.top } : null;
}

export function shapeSolids(draws, bin, shapesByMesh) {
  const floors = [];
  const boxes = [];
  const circles = [];
  const without = [];
  for (const d of draws) {
    const shapes = shapesByMesh[d.mesh];
    if (!shapes?.some((s) => s.kind !== 'mesh')) {
      without.push(d);
      continue;
    }
    for (const inst of instancesOf([d], bin))
      for (const s of solidsOf(shapes, inst)) {
        if (s.type === 'circle') circles.push(s);
        else if (s.top - s.base <= FLOOR.thick && Math.min(s.hw, s.hd) * 2 >= FLOOR.wide) floors.push({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, yaw: s.yaw, y: s.top });
        else {
          const box = { x: s.x, z: s.z, hw: s.hw, hd: s.hd, yaw: s.yaw, top: s.top, base: s.base };
          boxes.push(box);
          const deck = deckFloor(box);
          if (deck) floors.push(deck);
        }
      }
  }
  return { floors, boxes, circles, without };
}

export function shapeReader(pack, loadBin) {
  const cache = new Map();
  return (mesh) => {
    const key = String(mesh);
    if (!cache.has(key)) {
      const rec = pack?.physics?.meshes?.[key];
      cache.set(
        key,
        rec
          ? Promise.resolve(loadBin(rec.file))
              .then(readShapes)
              .catch(() => null)
          : Promise.resolve(null),
      );
    }
    return cache.get(key);
  };
}
