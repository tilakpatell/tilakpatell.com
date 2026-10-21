// Nothing walked or seen through: the walkers stepping round what stands in
// their lane, and the camera kept out of walls and figures, on a stage's
// solids.js grid (scenes.js fills it). Points are in the grid's frame (the
// stage's land; the module turns the scene's into it). Pure but for the
// eased amounts it keeps.
//
//   createClear() → {
//     walker(id, { x, z, y }, grid, dt) → the x to stand at: round the nearest
//       thing in their way a few steps ahead, eased there and back (never a jump)
//     camera(at, eye, { rig, lookAt }, grid, dt) → where the camera stands:
//       a shot hung off the lead pulled in along its boom short of what's
//       between them (in at once, out again slowly); a placed shot (wide,
//       seat) moved toward what it looks at, out of what it's in
//     reset(): nothing eased (a jump, a new stage)
//   }
//   tooNear(camera, at, { radius, high }) → whether the camera is in a figure standing at `at`

export const ASIDE = 1.6; // m/s a walker eases aside, and back
export const LOOK = [0.4, 1.5, 3]; // m ahead of a walker its body is checked: the nearest thing in the way steers it
export const OUT = 1.5; // 1/s: how fast a pulled-in boom lets out again
const PLACED = new Set(['wide', 'seat']);

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function createClear() {
  const aside = new Map(); // id → m eased aside
  let boom = 1;
  return {
    walker(id, { x, z, y }, grid, dt) {
      let want = 0;
      if (grid)
        for (const d of LOOK) {
          const to = grid.sidestep(x, z + d, y);
          if (to !== x) {
            want = to - x;
            break;
          }
        }
      const was = aside.get(id) ?? 0;
      const k = Math.min(Math.abs(want - was), ASIDE * dt);
      const now = was + Math.sign(want - was) * k;
      aside.set(id, now);
      return x + now;
    },
    camera(at, eye, { rig = 'follow', lookAt = eye } = {}, grid, dt) {
      if (!grid) {
        boom = 1;
        return at;
      }
      if (PLACED.has(rig)) {
        // (a placed shot is where the beat put it, unless that's in something)
        if (!grid.at(at[0], at[1], at[2], 0.2)) return at;
        return lerp(lookAt, at, grid.boom(lookAt, at));
      }
      const t = grid.boom(eye, at);
      boom = t < boom ? t : Math.min(t, boom + OUT * dt);
      return lerp(eye, at, boom);
    },
    reset() {
      aside.clear();
      boom = 1;
    },
    // (how far out the boom is, 0…1: the development hook's)
    get boom() {
      return boom;
    },
  };
}

export const tooNear = (camera, at, { radius = 0.6, high = 1.9 } = {}) => Math.hypot(camera[0] - at[0], camera[2] - at[2]) < radius && camera[1] > at[1] - 0.2 && camera[1] < at[1] + high;
