// The Dead Marshes' water, for the ground and the props alike (pure): the
// three pools with the candles and the dead faces under them, and the meres
// between, either side of the track all the way over the marsh, with reeds
// round them and a candle over some. The ground sinks a hollow for each
// (stages/index.js) and plants nothing in it (its `clear`), so the water
// shows; the props stand the reeds and candles, the scene lays the water.
//
//   POOLS, MERES: { at: [x, z], r } in the stage's frame (the track is x = 0)
//   hollowsOf(list, height) → the ground's relief layers for them
//   clearOf(list) → the ground's rings where nothing is planted

export const POOLS = [
  { at: [-16, 70], r: 14 },
  { at: [14, 84], r: 12 },
  { at: [-12, 98], r: 11 },
];

// (each kept 4 m or more off the track: the walkers go two abreast)
export const MERES = [
  { at: [10, 40], r: 5.5 },
  { at: [-10, 48], r: 6 },
  { at: [12, 56], r: 6.5 },
  { at: [-30, 48], r: 7 },
  { at: [9, 68], r: 4.5 },
  { at: [32, 72], r: 8 },
  { at: [-34, 84], r: 7 },
  { at: [11, 102], r: 6 },
  { at: [-30, 114], r: 7 },
  { at: [-10, 118], r: 5.5 },
  { at: [26, 114], r: 6 },
];

export const hollowsOf = (list, height) => list.map((p) => ({ type: 'island', at: p.at, r: p.r, height, core: 0.5, ragged: 0.4 }));

// (a little inside the hollow's edge: its rim is planted, the reeds' line)
export const clearOf = (list) => list.map((p) => ({ at: p.at, r: p.r * 0.75 }));
