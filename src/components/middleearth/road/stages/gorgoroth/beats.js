// Gorgoroth’s beats (the design’s §4.3, row 14; the plan’s Stage table):
// the plain of ash under a red-black sky, the orc column on the road and
// its whip, the Eye’s beam passing over the two under their cloaks, the
// wind from the west turning the clouds, Sam carrying Frodo up the
// Mountain, the Cracks of Doom, the eruption with Barad-dûr falling, and
// the Eagles. `at` in metres into the stage, `hold` in seconds; a `params`
// height is over the ground (`above`), else the Sammath Naur’s own
// (place.js, under the plain); the stage’s scene reads the rest.
// Pure.

import { CRACKS } from "./place";

export { entered, left } from "../../beats";

export const BEATS = [
  // the plain under the pall, the Tower on the horizon, the Mountain ahead
  {
    id: "plain",
    kind: "plain",
    at: 8,
    hold: 0,
    rig: "wide",
    reach: 16,
    params: { at: [-6, 3, 2], lookAt: [10, 20, 90], above: true },
  },
  // the orc column on the road, the whip; the two pressed among it
  { id: "column", kind: "column", at: 30, hold: 8, rig: "side", reach: 14 },
  // the Eye’s beam across the plain; the two under their cloaks
  {
    id: "beam",
    kind: "beam",
    at: 52,
    hold: 10,
    rig: "wide",
    cut: 0,
    reach: 14,
    params: { at: [-5, 1.4, 46], lookAt: [6, 3, 58], above: true },
    deed: {
      verb: "hold",
      label: "Keep still under the cloaks",
      stance: "crouch",
      seconds: 4,
      at: 2.5,
      lines: ["gorgoroth-beam"],
    },
  },
  // the wind from the west: the sky brightening behind
  { id: "wind", kind: "wind", at: 74, hold: 0, rig: "follow", reach: 14 },
  // Frodo can go no further: Sam carries him up the slope
  // (from beside: from behind, Frodo on his back hid Sam; from over them, the frame was ash)
  {
    id: "carry",
    kind: "carry",
    at: 100,
    hold: 6,
    rig: "side",
    reach: 14,
    deed: {
      verb: "rhythm",
      label: "Carry him up the Mountain",
      beats: 14,
      at: 0.5,
      clip: "carryYou",
    },
  },
  // the Cracks of Doom: the ledge, the Ring on, Gollum, the finger, over
  {
    id: "cracks",
    kind: "cracks",
    at: 126,
    hold: 20,
    rig: "seat",
    cut: 0,
    reach: 12,
    params: { at: CRACKS.camera, lookAt: CRACKS.look, under: true },
    clip: "myPrecious",
    fx: [{ kind: "vision", at: 4, seconds: 6 }],
    deed: {
      verb: "hold",
      label: "Reach for Frodo’s hand",
      seconds: 3,
      at: 13,
      lines: ["gorgoroth-hand"],
    },
  },
  // the Mountain breaks, Barad-dûr falls, the Eye goes out
  // (from the slope's top, 3 m over it, looking up the lane between the Mountain, 9° right, and the Tower, 31°)
  {
    id: "eruption",
    kind: "eruption",
    at: 146,
    hold: 8,
    rig: "wide",
    reach: 14,
    params: { at: [-10, 27.5, 138], lookAt: [23.6, 46.6, 230.2] },
    clip: "oneRing",
    fx: [{ kind: "shake", at: 0.5, seconds: 4 }],
  },
  // the Eagles: up and away west over the ruin
  // (from the slope behind the rock, 3.5 m over it and clear of its crest, looking down on the two lying on it: the
  // Eagles come down into the frame over the camera, take them and climb out of it; then black: the Road cuts to
  // the White City, its land never drawn beside Mordor's, stages/index.js's `cut`)
  {
    id: "eagles",
    kind: "eagles",
    at: 166,
    hold: 8,
    rig: "wide",
    reach: 14,
    params: { at: [-9, 25.3, 145], lookAt: [5, 15, 168] },
    fx: [{ kind: "black", at: 6.8, seconds: 3 }],
  },
];
