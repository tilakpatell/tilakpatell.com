// A town of Middle-earth on baked floor light (lib/three/groundwork, after
// Bruno Simon's folio): the town's terrain shaded by the static world over
// it, soft and warm, a bounce off the ground on everything, a blob under
// everyone who walks, and no shadow pass.
//
// groundTown({ renderer, scene, terrain, outdoors, sun, height, people,
//   skip, tier, centre, radius, shade, matcap }) → groundWorld's handle
//
// `terrain` the floor (a mesh, or several: a city's streets with its land);
// `height(x, z)` the floor's height for the blobs (null: as baked);
// `people` [{ object, size }] or [object] (a figure 0.84 m across);
// `centre` [x, z] and `radius` the part of the town that's baked (the play
// space, with room for what shadows its edge; a null radius: the floor's own
// extent, at most 240 m a side); `clip` for one zone of a town shown a zone at
// a time (lib/three/groundwork); `sunFloor` how much of the sun the floor
// keeps where the mask has none (a wood: under the canopy the mask's sun is
// nought, and a floor lit by the sky's term alone goes black). `place` names
// the bake (a town, or a town's zone) so it's kept for the next visit
// (lib/three/bakeCache).

import { groundWorld } from '../../../lib/three/groundwork';

export const FIGURE = 0.84; // a figure's blob, across (the circles it replaces were 0.42 in radius)

export function groundTown({ renderer, scene, terrain, outdoors, sun, height, people = [], skip = [], tier = 'mid', centre = [0, 0], radius = 60, shade = 0x2e2620, sunFloor = 0, matcap = [], bounce = {}, clip = false, place = null }) {
  const movers = people.filter(Boolean).map((p) => (p.object ? { size: [FIGURE, FIGURE], ...p } : { object: p, size: [FIGURE, FIGURE] }));
  return groundWorld({
    renderer,
    scene,
    floor: [].concat(terrain),
    area: radius == null ? null : { x0: centre[0] - radius, z0: centre[1] - radius, w: radius * 2, d: radius * 2 },
    sun,
    casters: [outdoors],
    skip,
    movers,
    shade,
    sunFloor,
    bounce,
    height,
    tier,
    matcap,
    auto: true,
    clip,
    cache: place ? { world: 'middle-earth', place } : null,
  });
}
