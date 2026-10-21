// The farm horse’s gait by its speed over the ground (the pack’s own clips:
// Idle, WalkSlow, Walk, Run). Pure.
//
//   gaitFor(speed) → 'Idle' | 'WalkSlow' | 'Walk' | 'Run'
//   GAITS: each clip’s speed at a scale of 1 (the clip’s stride over its length), for pacing

export const STILL = 0.1; // m/s: under this it stands
export const SLOW = 1.2; // under this, the slow walk
export const TROT = 3; // under this, the walk; at or over, the run

export function gaitFor(speed) {
  const v = Math.abs(speed);
  if (v < STILL) return 'Idle';
  if (v < SLOW) return 'WalkSlow';
  if (v < TROT) return 'Walk';
  return 'Run';
}

// (the pace each clip was made at, for a 1.6 m horse: its feet don’t slide at these)
export const GAITS = { Idle: 0, WalkSlow: 0.8, Walk: 1.8, Run: 5.5 };
