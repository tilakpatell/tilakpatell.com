// Where things stand in the arrival’s two built sets (the design’s §4.2):
// the station (./station.js) and the steps from the harbour to the Entrance
// Hall (./steps.js), in each set’s own frame, read by the sets that draw
// them and by the shots (./shots.js) that frame them. Pure.
//
//   STATION: the platform along +x (its edge at z 0.5, its top y 0), the track
//     on its −z side, the engine’s buffer beam, where Hagrid stands, the lamps
//   STEPS: the quay, the water, the stair up +z, the Entrance Hall, the marble stair
//   stairY(z) → the stair’s tread under z

export const STATION = {
  platform: { x0: -52, x1: 44, z0: 0.5, z1: 7, height: 0.95 },
  track: { z: -1.35, y: -0.95 },
  engine: { front: 15 }, // m: the engine’s buffer beam, facing +x
  hagrid: [17.5, 0, 2.2],
  lamps: [-44, -32, -20, -8, 4, 16, 28, 40],
};

export const STEPS = {
  quay: { x0: -2, x1: 5, z0: -14, z1: 6, y: 0.6 },
  water: { x0: -8, x1: -2, z0: -40, z1: 4 },
  stair: { z0: 6, z1: 60, y0: 0.6, y1: 13.5, w: 3.2 },
  hall: { x0: -9, x1: 9, z0: 65, z1: 86, y: 13.5, h: 13 },
  marble: { z0: 77, z1: 86, rise: 4.2 },
  mcgonagall: [0, 0, 79.4],
};

export const stairY = (z) => {
  const s = STEPS.stair;
  if (z <= s.z0) return s.y0;
  if (z >= s.z1) return s.y1;
  // (treads: a riser every 0.75 m along)
  const k = Math.floor((z - s.z0) / 0.75) * 0.75;
  return s.y0 + (k / (s.z1 - s.z0)) * (s.y1 - s.y0);
};
