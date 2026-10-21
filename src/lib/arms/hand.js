// Every gun a crew member can carry in the hand, as numbers: one table for
// every world they walk (the galaxy's worlds and the planets they land on;
// the design: docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md,
// Parts 5, 6 and 8). Each kind's model is universe/gunplay.js's GUNS; the
// heat, the vent and the sights' rules are galaxy/surface/weaponRules.js's,
// which re-exports all of this for the callers it had. Pure data.
//
//   WEAPONS       by kind: { name, about, side ('galaxy' | 'elsewhere'), damage (hits a shot is worth: a stormtrooper has 2), every (seconds between shots), spread (radians of scatter), heat (0…1 a shot adds), cool (a second), range (metres), zoom (the sights' magnification), burst? (shots a pull fires), pellets? (a shotgun's), kick, unique? (one of UNIQUE_HAND), beam? (held: a hit every `every`), stream? (past the surface's floor between shots), climb? (radians a shot walks the aim up), charge? (seconds held to a full charge, fired on letting go) }
//   WEAPON_IDS, PICKABLE (anyone may pick), SHOW_KILLS (a kill that's a show), UNIQUE_HAND (gun → node)
//   pickableWith(arms) → PICKABLE and the unique guns opened
//   MODS by id: { name, about, ...multipliers on the numbers }, MOD_IDS, MAX_MODS

export const MAX_MODS = 2;

const base = { damage: 1, every: 0.24, spread: 0.012, heat: 0.14, cool: 0.35, range: 90, zoom: 1.4, kick: 1 };
export const WEAPONS = {
  // ── Star Wars ──
  blaster: { ...base, name: 'DL-44', about: 'Han’s heavy blaster pistol. Hits hard, heats fast.', side: 'galaxy', damage: 2, every: 0.3, heat: 0.14, cool: 0.3, zoom: 1.3 },
  rifle: { ...base, name: 'E-11', about: 'The stormtrooper’s rifle: steady, decent cooling.', side: 'galaxy', damage: 1, every: 0.16, spread: 0.014, heat: 0.065, cool: 0.35, range: 110, zoom: 1.8 },
  a280: { ...base, name: 'A280', about: 'The Rebel rifle from Endor: three-shot bursts, long reach.', side: 'galaxy', damage: 1, every: 0.42, burst: 3, spread: 0.01, heat: 0.16, cool: 0.35, range: 130, zoom: 2.2 },
  dlt19: { ...base, name: 'DLT-19', about: 'The heavy repeater: a stream of light bolts, slow to heat.', side: 'galaxy', damage: 1, every: 0.09, spread: 0.028, heat: 0.03, cool: 0.4, range: 100, zoom: 1.5, kick: 0.6 },
  ee3: { ...base, name: 'EE-3', about: 'Boba Fett’s carbine: a quick two-shot burst, a good scope.', side: 'galaxy', damage: 1, every: 0.36, burst: 2, spread: 0.008, heat: 0.13, cool: 0.35, range: 140, zoom: 2.6 },
  westar: { ...base, name: 'WESTAR-34', about: 'Jango’s pistol: light and very fast.', side: 'galaxy', damage: 1, every: 0.12, spread: 0.02, heat: 0.055, cool: 0.4, range: 70, zoom: 1.3, kick: 0.7 },
  // (the soldiers' own: ground/troops.js; not in PICKABLE, so never offered to you)
  dc15: { ...base, name: 'DC-15A', about: 'The clone trooper’s rifle: three-shot bursts.', side: 'galaxy', damage: 1, every: 0.4, burst: 3, spread: 0.012, range: 120 },
  e5: { ...base, name: 'E-5', about: 'The battle droid’s carbine: slow and wide.', side: 'galaxy', damage: 1, every: 0.5, spread: 0.03, range: 70 },
  bowcaster: { ...base, name: 'Bowcaster', about: 'Chewie’s: a slow, heavy quarrel.', side: 'galaxy', damage: 3, every: 0.7, spread: 0.006, heat: 0.25, cool: 0.3, range: 120, zoom: 1.6, kick: 1.6 },
  // ── Elsewhere ──
  shotgun: { ...base, name: 'Scattergun', about: 'Seven pellets at once. Close in, nothing survives it.', side: 'elsewhere', damage: 1, every: 0.8, pellets: 7, spread: 0.07, heat: 0.26, cool: 0.3, range: 30, zoom: 1.1, kick: 2 },
  sniper: { ...base, name: 'Longrifle', about: 'One slow shot at a time, from a long way off.', side: 'elsewhere', damage: 4, every: 1.3, spread: 0.002, heat: 0.4, cool: 0.3, range: 220, zoom: 4, kick: 1.8 },
  smg: { ...base, name: 'Machine pistol', about: 'Rattles through a clip. Wild past twenty metres.', side: 'elsewhere', damage: 1, every: 0.07, spread: 0.04, heat: 0.028, cool: 0.4, range: 50, zoom: 1.2, kick: 0.5 },
  revolver: { ...base, name: 'Revolver', about: 'Walt’s snub-nose. Six shots, each one counts.', side: 'elsewhere', damage: 2, every: 0.45, spread: 0.008, heat: 0.17, cool: 0.3, range: 60, zoom: 1.3, kick: 1.5 },
  pistol: { ...base, name: 'Pistol', about: 'Jesse’s. Quick and a little loose.', side: 'elsewhere', damage: 1, every: 0.18, spread: 0.02, heat: 0.08, cool: 0.35, range: 60 },
  portal: { ...base, name: 'Portal gun', about: 'Rick’s. Whoever it drops goes through a portal, and not all the way.', side: 'elsewhere', damage: 2, every: 0.35, spread: 0.01, heat: 0.15, cool: 0.35, range: 80 },
  freeze: { ...base, name: 'Freeze ray', about: 'Rick’s. Ices them where they stand, then they shatter.', side: 'elsewhere', damage: 3, every: 0.6, spread: 0.008, heat: 0.22, cool: 0.32, range: 70, kick: 0.6 },
  shrink: { ...base, name: 'Shrink ray', about: 'Rick’s. Down to a tenth, a squeak, a pop.', side: 'elsewhere', damage: 3, every: 0.6, spread: 0.008, heat: 0.22, cool: 0.32, range: 70, kick: 0.7 },
  laser: { ...base, name: 'Laser pistol', about: 'Morty’s ray gun.', side: 'elsewhere', damage: 1, every: 0.2, spread: 0.015, heat: 0.08, cool: 0.35, range: 70 },
  coppistol: { ...base, name: 'Service pistol', about: 'Citadel issue.', side: 'elsewhere', damage: 1, every: 0.2, spread: 0.015, heat: 0.08, cool: 0.35, range: 70 },
  // ── The unique four (the skill tree's, UNIQUE_HAND: galaxy/surface/handArms.js plays what each does past a shot) ──
  amban: { ...base, name: 'Amban rifle', about: 'The Mandalorian’s phase-pulse rifle: one heavy shot at a time, a long reach and a scope. Whoever it drops goes in a flash of light.', side: 'galaxy', damage: 6, every: 1.5, spread: 0.002, heat: 0.45, cool: 0.3, range: 240, zoom: 5, kick: 2.2, unique: true },
  particle: { ...base, name: 'Particle beam', about: 'Rick’s. Held, not fired: a beam that hits ten times a second, and heats as fast. Whoever it drops is ash.', side: 'elsewhere', damage: 1, every: 0.1, spread: 0, heat: 0.06, cool: 0.4, range: 45, zoom: 1.3, kick: 0.15, beam: true, unique: true },
  m60: { ...base, name: 'M60', about: 'The one from the trunk of Walt’s car: a long stream, slow to heat, and a kick that walks your aim up the longer you hold it.', side: 'elsewhere', damage: 1, every: 0.085, spread: 0.026, heat: 0.02, cool: 0.45, range: 110, zoom: 1.4, kick: 1.1, stream: true, climb: 0.008, unique: true },
  gauntlet: { ...base, name: 'Repulsor gauntlet', about: 'Tony’s. A palm blast at close range that throws them back: hold it to charge it bigger.', side: 'elsewhere', damage: 2, every: 0.5, spread: 0.01, heat: 0.2, cool: 0.35, range: 28, zoom: 1.1, kick: 1.4, charge: 1.2, unique: true },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
// the ones the hero panel offers (a hero's own gun always, these besides)
export const PICKABLE = ['blaster', 'rifle', 'a280', 'dlt19', 'ee3', 'westar', 'bowcaster', 'shotgun', 'sniper', 'smg', 'revolver', 'portal', 'freeze', 'shrink'];
// the guns whose kills are a show of their own (lib/three/portalFx.js, gadgetFx.js: activity.js plays them)
export const SHOW_KILLS = ['portal', 'freeze', 'shrink', 'amban', 'particle', 'gauntlet'];
// the unique four, each with the skill tree's node that opens it (hangar/
// skills/tree.js's, which names the gun as `arms`): carried only while it's
// taken, and free once it is
export const UNIQUE_HAND = { amban: 'u-amban', particle: 'u-particle', m60: 'u-m60', gauntlet: 'u-gauntlet' };
// what may be picked, with `arms` the unique ones opened (the skill tree's fx.arms)
export const pickableWith = (arms) => [...PICKABLE, ...Object.keys(UNIQUE_HAND).filter((g) => Array.isArray(arms) && arms.includes(g))];

export const MODS = {
  cooling: { name: 'Cooling cell', about: 'Builds heat slower, sheds it faster.', heat: 0.7, cool: 1.3 },
  choke: { name: 'Tight choke', about: 'Half the scatter.', spread: 0.5 },
  barrel: { name: 'Long barrel', about: 'Further and a little harder, a touch slower.', range: 1.3, damage: 1.2, every: 1.1 },
  scope: { name: 'Scope', about: 'Twice the sights.', zoom: 2 },
  trigger: { name: 'Hair trigger', about: 'A faster cycle, a little more heat.', every: 0.78, heat: 1.15 },
  stock: { name: 'Steady stock', about: 'Less kick, a steadier aim.', kick: 0.5, spread: 0.75 },
};
export const MOD_IDS = Object.keys(MODS);
