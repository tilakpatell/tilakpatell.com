// The Ring vision’s state, pure: how far the world has gone over (`amount`,
// 0…1, linear toward on or off at `rate` a second), the direction its wind
// of streaks blows across the sky (`wind`, radians, turning slowly) and a
// pulse of half a hertz (`pulse`, −1…1) for the fog’s throb. hooks.js’s
// uVision is `amount`; the sky reads `wind`; the module the pulse.
// (0.4 s for Bilbo’s vanishing, 12 s at Weathertop, the whole of the Cracks.)
//
//   newVision() → { amount, wind, pulse, t }
//   stepVision(v, dt, { on, rate = 2.5 }) → the next

const PULSE = 0.5; // Hz
const TURN = 0.15; // rad a second

export const newVision = () => ({ amount: 0, wind: 0.6, pulse: 0, t: 0 });

export function stepVision(v, dt, { on, rate = 2.5 } = {}) {
  const t = v.t + dt;
  const to = on ? 1 : 0;
  const step = rate * dt;
  const amount = v.amount < to ? Math.min(to, v.amount + step) : Math.max(to, v.amount - step);
  // (the wind turns while the vision is up, and rests with it)
  const wind = v.wind + TURN * dt * (0.4 + 0.6 * amount);
  return { amount, wind, pulse: Math.sin(2 * Math.PI * PULSE * t), t };
}
