// Perks: what a hero carries into a fight besides the weapon, Battlefront
// II's star cards in spirit (three slots, each bending one number). Pure
// and tested; heroes.js keeps the choice with the hero, DeployPanel.jsx
// offers it, surface/scene.js multiplies by `perkEffects` where each
// number is used.
//
//   PERKS            by id: { name, about, ...one or two multipliers }
//   PERK_IDS, MAX_PERKS
//   readPerks(list)  the ids that are perks, no twice, at most MAX_PERKS
//   perkEffects(ids) every multiplier, 1 where no perk touches it:
//     { hurt (damage taken), guard (the stamina a blocked strike costs, as
//       one over it: lib/combat/saber2017.js's), heat, cool, cycle (seconds
//       between shots), cooldown (the abilities'), deflect (stamina a turned
//       bolt costs), regen (health a second), dodge (the dodge's recharge),
//       damage (dealt) }
// (the game has no parry, and a strike's lunge is its animation's: the
// perks that bent those are gone, and a kept choice drops them)

export const MAX_PERKS = 3;

export const PERKS = {
  survivor: { name: 'Survivor', about: 'Take a quarter less from everything.', hurt: 0.75 },
  ironguard: { name: 'Iron guard', about: 'A blocked strike costs a third less stamina.', guard: 1.5 },
  heatsink: { name: 'Heat sink', about: 'The gun heats slower and cools faster.', heat: 0.75, cool: 1.35 },
  quicktrigger: { name: 'Quick trigger', about: 'A faster cycle between shots.', cycle: 0.85 },
  focus: { name: 'Focus', about: 'The abilities come back sooner.', cooldown: 0.65 },
  secondwind: { name: 'Second wind', about: 'Health comes back twice as fast.', regen: 2 },
  deflector: { name: 'Deflector', about: 'Turning a bolt costs half the stamina.', deflect: 0.5 },
  nimble: { name: 'Nimble', about: 'The dodges come back twice as fast.', dodge: 0.5 },
  heavyhands: { name: 'Heavy hands', about: 'Every hit lands a quarter harder.', damage: 1.25 },
};
export const PERK_IDS = Object.keys(PERKS);
const KEYS = ['hurt', 'guard', 'heat', 'cool', 'cycle', 'cooldown', 'deflect', 'regen', 'dodge', 'damage'];

export const readPerks = (list) => (Array.isArray(list) ? [...new Set(list.filter((p) => PERKS[p]))].slice(0, MAX_PERKS) : []);

export function perkEffects(ids) {
  const fx = Object.fromEntries(KEYS.map((k) => [k, 1]));
  for (const id of readPerks(ids)) for (const k of KEYS) if (PERKS[id][k] != null) fx[k] *= PERKS[id][k];
  return fx;
}
