// The Instant Action Overhaul V2's adaptive difficulty as a driver any
// battle can take: every so often each side's aim noise scale is drawn
// again, evenly, from the mod's ten (its records: `mods/iao-v2.json`'s
// `adaptive`, NOTES.md, "The Overhaul's records"). The sim's Overhaul round
// steps it (sim.js: a bot's noise is its weapon class's × that scale,
// bots.js's `aimScale`); a battle whose bots take a difficulty row instead
// (difficulty.js) takes the row with its aim widened by the side's scale
// (`adaptiveDifficulty`), so the galaxy's ground war can offer `adaptive`
// beside the difficulty's names.
//
// By hand: the first draw a tenth of a second after the driver is made (the
// mod's lag after the event that starts it, which here is the round's start),
// and the sides drawn in their order, team 1 first (the mod's two random
// events fire together). Pure.
//
//   ADAPTIVE           { every, lag, scales } (the mod's; each `_source` in the rulebook)
//   createAdaptive({ now, sides }) → driver   ({ [side]: scale, next })
//   stepAdaptive(driver, now, rand) → true when the scales were drawn this step
//   scaleOf(driver, side) → the side's aim noise scale now (1 with no driver)
//   adaptiveDifficulty(driver, side, ai, base?) → difficulty.js's row of `base` (normal by default), its aim
//     scale times the side's

import { adaptive as RULE } from '../../../data/bf2017/mods/iao-v2.json';
import { difficultyFor } from './difficulty.js';

// The setting's name beside difficulty.js's DIFFICULTIES: a battle that offers it drives its difficulty by this.
export const ADAPTIVE_NAME = 'adaptive';
export const ADAPTIVE = { every: RULE.every, lag: RULE.lag, scales: [...RULE.scales] };

export function createAdaptive({ now = 0, sides = [1, 2], rule = ADAPTIVE } = {}) {
  const driver = { next: now + rule.lag, sides: [...sides], rule };
  for (const side of sides) driver[side] = 1;
  return driver;
}

export function stepAdaptive(driver, now, rand = Math.random) {
  if (!driver || now + 1e-9 < driver.next) return false;
  const { scales, every } = driver.rule;
  for (const side of driver.sides) driver[side] = scales[Math.floor(rand() * scales.length)];
  driver.next += every;
  return true;
}

export const scaleOf = (driver, side) => driver?.[side] ?? 1;

export function adaptiveDifficulty(driver, side, ai, base = 'normal') {
  const row = difficultyFor(base, ai);
  const scale = scaleOf(driver, side);
  return { ...row, adaptive: scale, aim: { ...row.aim, scale: row.aim.scale * scale } };
}
