// The bots' grenade (bf2-re finding 34 §4: `StormTrooperAI`'s
// `AIProjectileComponentData`, its `BattleAIProjectile` row, and
// `GameTweakCommon.GrenadeTokens`): a bot throws at a target 10 to 50 m
// away, solving the parabola for a flight time of 0.5 s at 10 m to 2 s at
// 50 m (`Curve BattleAIProjectileType_Parabolic`, the velocity from the
// time: at 50 m in 2 s, 25 m/s forward and 9.8 up, the player's own
// 25.2), at the target's last known position (`UseLastKnownPosition`),
// the aim point put off by 0.5 to 2 m across and up (`Dispersion`, more
// with distance), the arc ray-tested against the level before the throw
// (`ValidateTrajectoryPreThrow`); the team's tokens ration it to one
// grenade in the air at a time (`MaxSimultaneousGrenades 1`) and one every
// 12 to 24 s (`GrenadeMinimumTime 12`, `GrenadeMaximumTime 24`: rookie
// 24–48, expert 7–14). The online fill's AutoPlayers press no grenade,
// sentry or shield: the officer's turret is the one trooper ability they
// use (`AP_OfficerTurret_DamageMult` is their only trooper-ability row).
// Pure.
//
//   RANGE, TIME, DISPERSION, TOKENS, AUTOPLAYER
//   solveThrow(from, to, { gravity }) → { vel, time } | null     (the parabola over the distance's flight time)
//   disperse(to, dist, rand) → to'                                 (the aim point put off)
//   arcClear(from, vel, { heightAt, solid, gravity, step }) → bool (no ground or solid before the landing)
//   createTokens() → tokens      tokenFree(tokens, team, now) → bool
//   takeToken(tokens, team, now, rand, difficulty) → void         (the press: the team's next grenade is 12 to 24 s on)
//   grenadeOut(tokens, team) → void    grenadeGone(tokens, team) → void   (the grenade in the air, and gone)
//   planThrow({ from, target, now, rand, team, tokens, heightAt, solid }) → { at, vel, to, time } | null
//     (a plan takes no token: the caller takes it once the ability is pressed)
//   pressesAbility(logic, { autoPlayer }) → bool                  (which ability logics an AutoPlayer runs)

import { FLIGHT } from '../grenades.js';

// `BattleAIProjectile.Minimum { Distance 10, Time 0.5 }`, `Maximum { Distance 50, Time 2 }`
export const RANGE = [10, 50];
export const TIME = [0.5, 2];
// `Dispersion { MinimumHorizontal 0.5, MaximumHorizontal 2, MinimumVertical 0.5, MaximumVertical 2, ScalingDistance 5 }`:
// read as the offset growing from its minimum at the near range to its maximum at the far
export const DISPERSION = { min: 0.5, max: 2 };
// `GrenadeTokens` on the MP default row; the rookie's and the expert's by name
export const TOKENS = { default: { min: 12, max: 24 }, rookie: { min: 24, max: 48 }, expert: { min: 7, max: 14 }, simultaneous: 1 };
// the AutoPlayer's trooper abilities: the turret alone
export const AUTOPLAYER = { Grenade: false, Sentry: false, Shield: false, Turret: true, Battle_Command: false, Infiltration02: false, ScanPistol: false };

export const pressesAbility = (logic, { autoPlayer = false } = {}) => !autoPlayer || AUTOPLAYER[logic] === true;

export const flightTime = (dist) => {
  const t = (dist - RANGE[0]) / (RANGE[1] - RANGE[0]);
  return TIME[0] + (TIME[1] - TIME[0]) * Math.max(0, Math.min(1, t));
};

export function solveThrow(from, to, { gravity = FLIGHT.gravity } = {}) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const dist = Math.hypot(dx, dz);
  if (dist < RANGE[0] - 1e-9 || dist > RANGE[1] + 1e-9) return null;
  const time = flightTime(dist);
  const dy = to[1] - from[1];
  return { vel: [dx / time, (dy - 0.5 * gravity * time * time) / time, dz / time], time };
}

export function disperse(to, dist, rand) {
  const k = Math.max(0, Math.min(1, (dist - RANGE[0]) / (RANGE[1] - RANGE[0])));
  const r = DISPERSION.min + (DISPERSION.max - DISPERSION.min) * k;
  const a = rand() * Math.PI * 2;
  const h = r * Math.sqrt(rand());
  return [to[0] + Math.cos(a) * h, to[1] + (rand() * 2 - 1) * r, to[2] + Math.sin(a) * h];
}

export function arcClear(from, vel, { heightAt, solid = null, gravity = FLIGHT.gravity, step = 0.1, time = null } = {}) {
  const end = time ?? Math.max(0.5, (2 * vel[1]) / -gravity + 1);
  let p = [...from];
  for (let t = step; t <= end + 1e-9; t += step) {
    const q = [from[0] + vel[0] * t, from[1] + vel[1] * t + 0.5 * gravity * t * t, from[2] + vel[2] * t];
    if (solid && solid(p, q)) return t * 1 >= end - step - 1e-9; // the landing itself may touch the ground
    if (heightAt && q[1] < heightAt(q[0], q[2]) - 0.05) return t >= end - step - 1e-9;
    p = q;
  }
  return true;
}

export const createTokens = () => ({ 1: { air: 0, nextAt: -Infinity }, 2: { air: 0, nextAt: -Infinity } });

const teamOf = (tokens, team) => (tokens[team] ??= { air: 0, nextAt: -Infinity });

export const tokenFree = (tokens, team, now) => {
  const t = teamOf(tokens, team);
  return t.air < TOKENS.simultaneous && now >= t.nextAt;
};

// the difficulty's row by its name ('rookie', 'multiplayer:expert'), else the default
export const tokensFor = (difficulty) => {
  const row = TOKENS[String(difficulty ?? '').split(':').pop().toLowerCase()];
  return row?.min != null ? row : TOKENS.default;
};

export function takeToken(tokens, team, now, rand, difficulty = null) {
  const { min, max } = tokensFor(difficulty);
  teamOf(tokens, team).nextAt = now + min + rand() * (max - min);
}

export function grenadeOut(tokens, team) {
  teamOf(tokens, team).air++;
}

export function grenadeGone(tokens, team) {
  const t = teamOf(tokens, team);
  t.air = Math.max(0, t.air - 1);
}

// the whole plan: the token free, the range, the dispersion, the arc
export function planThrow({ from, target, now, rand, team, tokens = null, heightAt = null, solid = null }) {
  if (tokens && !tokenFree(tokens, team, now)) return null;
  const dist = Math.hypot(target[0] - from[0], target[2] - from[2]);
  if (dist < RANGE[0] || dist > RANGE[1]) return null;
  const to = disperse(target, dist, rand);
  const sol = solveThrow(from, to);
  if (!sol) return null;
  if (!arcClear(from, sol.vel, { heightAt, solid, time: sol.time })) return null;
  return { at: [...from], vel: sol.vel, to, time: sol.time };
}
