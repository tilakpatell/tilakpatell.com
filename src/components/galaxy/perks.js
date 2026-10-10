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
//     { hurt (damage taken), guard (the guard's size), parry (the window),
//       lunge, heat, cool, cycle (seconds between shots), cooldown (the
//       abilities'), deflect (guard a turned bolt costs), regen (health a
//       second), dodge (its cooldown), damage (dealt) }

export const MAX_PERKS = 3;

export const PERKS = {
  survivor: { name: 'Survivor', about: 'Take a quarter less from everything.', hurt: 0.75 },
  ironguard: { name: 'Iron guard', about: 'A guard half again as deep.', guard: 1.5 },
  riposte: { name: 'Riposte', about: 'A wider window to parry in.', parry: 1.7 },
  longreach: { name: 'Long reach', about: 'Strokes step further in to their mark.', lunge: 1.6 },
  heatsink: { name: 'Heat sink', about: 'The gun heats slower and cools faster.', heat: 0.75, cool: 1.35 },
  quicktrigger: { name: 'Quick trigger', about: 'A faster cycle between shots.', cycle: 0.85 },
  focus: { name: 'Focus', about: 'The abilities come back sooner.', cooldown: 0.65 },
  secondwind: { name: 'Second wind', about: 'Health comes back twice as fast.', regen: 2 },
  deflector: { name: 'Deflector', about: 'Turning a bolt costs half the guard.', deflect: 0.5 },
  nimble: { name: 'Nimble', about: 'Dodge again sooner.', dodge: 0.5 },
  heavyhands: { name: 'Heavy hands', about: 'Every hit lands a quarter harder.', damage: 1.25 },
};
export const PERK_IDS = Object.keys(PERKS);
const KEYS = ['hurt', 'guard', 'parry', 'lunge', 'heat', 'cool', 'cycle', 'cooldown', 'deflect', 'regen', 'dodge', 'damage'];

export const readPerks = (list) => (Array.isArray(list) ? [...new Set(list.filter((p) => PERKS[p]))].slice(0, MAX_PERKS) : []);

export function perkEffects(ids) {
  const fx = Object.fromEntries(KEYS.map((k) => [k, 1]));
  for (const id of readPerks(ids)) for (const k of KEYS) if (PERKS[id][k] != null) fx[k] *= PERKS[id][k];
  return fx;
}
