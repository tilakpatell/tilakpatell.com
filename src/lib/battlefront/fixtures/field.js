// A synthetic field for the battle rules' tests: flat ground at 0 with one
// steep hill, one wall 2 m tall and one crate 1.2 m tall, ±100 m.
//   wall: 30 m long (x −15…15), 1 m thick, at z 20; crate: 1.2 m cube at [10, −10]

const smooth = (t) => t * t * (3 - 2 * t);

export const HILL = { at: [60, 60], r: 20, height: 20 };

export function fieldHeight(x, z) {
  const d = Math.hypot(x - HILL.at[0], z - HILL.at[1]);
  return d >= HILL.r ? 0 : HILL.height * smooth(1 - d / HILL.r);
}

export const WALL = { at: [0, 1, 20], half: [15, 1, 0.5], yaw: 0 };
export const CRATE = { at: [10, 0.6, -10], half: [0.6, 0.6, 0.6], yaw: 0 };

export const field = () => ({ heightAt: fieldHeight, bounds: { min: [-100, -100], max: [100, 100] }, cell: 2, solids: [WALL, CRATE] });
