// The galaxy's battle plans: what each kind of battle's stages may be, and
// what the films pinned at Endor, Scarif and Hoth (universe/battlePlan.js
// draws among them, seeded by the battle's id, so every pilot gets the same
// plan; universe/battleDirector.js runs it; universe/battleStages.js puts
// its objectives in the battle). Pure, tested.
//
// Each kind's menu is a stage at a time, each stage a few options to draw
// from (one that doesn't fit the battle, a droid control relay where there
// are no droids, says null), so two sieges of Coruscant needn't be fought
// alike:
// - assault: the flagship's shield (its two generators, or four
//   shield-projector satellites round it, three to take), its batteries
//   (four of six) or their fleet uplink to hold; then its bridge, the comms
//   relay over it to hold or, against the Separatists, the droid control
//   relay (down, their droid fighters stop dead for 30 s); then its reactor.
// - siege: the planet's orbital defence platforms (three of five), the
//   planetary ion cannon, the flagship's shield or batteries, or (the
//   Empire after the Rebellion over Scarif) the Tantive IV to board; then
//   its bridge or a data beacon to slice; then its reactor.
// - interdiction: the Interdictor's four gravity wells (its two domes and
//   two under its hull; while they stand nobody jumps out), its shield
//   satellites or the uplink; then its bridge or the comms relay; then its
//   reactor.
// - blockade: the picket (its engines disabled, then held beside while a
//   shuttle docks) or its batteries (three of four); then the bridge or the
//   relay; then the reactor; the attacker's runners through it all.
// - evacuation: the planetary ion cannon, the transports' shield frigate or
//   the flagship's shield satellites; then its bridge or a data beacon; then
//   its reactor; the defender's transports running for the jump.
// - ambush: the jammer to hold, the escort's batteries or (the Civil War's
//   Empire after the Rebellion at Tatooine or Scarif) the Tantive IV to
//   board; then the bridge; then the reactor.
// On the way, where there's a line of battle, the attacker's bomber waves
// (3:00 and 6:30), and from 4:00 the aces: each side's own, the Remnant's
// always Moff Gideon in his TIE Defender, each four times as hard to bring
// down as a fighter of theirs would be.
// Pinned, as the films had them: Endor with the Rebellion attacking (the
// moon's shield generator, then the Executor's bridge, then the run on the
// Death Star's reactor), Scarif with the Rebellion attacking (the
// Persecutor's shield, its bridge, then the Shield Gate), Hoth with the
// Empire attacking (Echo Base's ion cannon, then the flagship's bridge and
// reactor, the transports running all the while).
//
// At Endor, wherever the Rebellion and the Empire meet there, the Death
// Star's superlaser takes a Rebel cruiser every minute and a bit.
//
// MENUS[kind] = { stages: [[option(c)…]…] }, MENUS.pinned(c), MENUS.side(c),
// MENUS.losses(c, stages) (the set pieces' own losses, each with `by`);
// planOf(sys, battle, laid) → the battle's plan (universe/battlePlan.js's
// shape). An option's `c` is the battle (its kind, war, system, sides by
// team, attacker and defender, each side's capital ships, its aces) with
// the stage's index, hp to share out (`budget`) and the plan's seeded rand.

import { planFor } from '../universe/battlePlan';
import { TURRETS } from '../universe/wars';
import { BATTLE_KINDS } from './battles';

// the defender's line, and the ship the objectives are on in it
const fleet = (c) => c.capitals[c.defender];
const objectiveIndex = (c) => (c.objectivesOn === 'interdictor' ? Math.max(0, fleet(c).findIndex((x) => x.kind === 'interdictor')) : 0);
const objective = (c) => fleet(c)[objectiveIndex(c)];
// the first of the defender's escorts (not the objectives' ship) that `ok` takes
const escortIndex = (c, ok) => fleet(c).findIndex((x, i) => i > 0 && i !== objectiveIndex(c) && ok(x));
const hp = (c, n = 1) => Math.round(c.budget / n);
const flank = (c) => (c.rand() < 0.5 ? 1 : -1);
const sub = (id, kind, name, hpOf, type = 'destroy') => ({ id, type, kind, name, hp: hpOf, on: { sub: id } });

// ── the first stage: what keeps the rest from being got at ──
const gens = (c) => ({ id: 'shield', type: 'group', need: 2, shields: true, objectives: [sub('gen-port', 'shieldgen', 'Shield generator', hp(c, 2), 'group'), sub('gen-star', 'shieldgen', 'Shield generator', hp(c, 2), 'group')] });
// four round the ship, above and below it (clear of the escorts beside it)
const SATS = [
  [-0.3, 0.3, 0.25],
  [0.3, 0.3, -0.25],
  [-0.3, -0.26, -0.25],
  [0.3, -0.26, 0.25],
];
const satellites = (c) => ({ id: 'satellites', type: 'group', need: 3, shields: true, objectives: SATS.map((at, n) => ({ id: `sat-${n}`, type: 'group', kind: 'satellite', name: 'Shield projector', hp: hp(c, 3), r: Math.max(0.9, objective(c).size * 0.035), on: { ship: 'objective', at } })) });
// `n` of a ship's batteries spread down its length, `need` of them to take
const batteriesOf = (c, ship, id, n, need, name) => {
  const kind = ship === 'objective' ? objective(c).kind : fleet(c)[ship]?.kind;
  const all = TURRETS[kind]?.length ?? 0;
  if (all < n) return null;
  const picks = Array.from({ length: n }, (_, j) => Math.round((j * (all - 1)) / (n - 1)));
  return { id, type: 'group', need, objectives: picks.map((t, j) => ({ id: `${id}-${j}`, type: 'group', kind: 'battery', name, hp: hp(c, need), on: { turret: t, ship } })) };
};
const batteries = (c) => batteriesOf(c, 'objective', 'battery', 6, 4, 'Turbolaser battery');
const uplink = (c) => ({ id: 'uplink', type: 'zone', objectives: [{ id: 'uplink', type: 'zone', kind: 'beacon', name: 'their fleet uplink', hp: hp(c), hold: 40, zone: 10, on: { field: [0.45, flank(c) * 28, 4] } }] });
const platforms = (c) => ({ id: 'platforms', type: 'group', need: 3, objectives: [0, 1, 2, 3, 4].map((n) => ({ id: `plat-${n}`, type: 'group', kind: 'platform', name: 'Orbital defence platform', hp: hp(c, 3), r: 3, on: { field: [0.55, (n - 2) * 34, 24] } })) });
const ionCannon = (c) => ({ id: 'cannon', type: 'destroy', objectives: [{ id: 'cannon', type: 'destroy', kind: 'cannon', name: 'the planetary ion cannon', hp: hp(c), r: 2.4, on: { planet: 1.5 } }] });
const frigate = (c) => {
  const neb = escortIndex(c, (x) => x.kind === 'nebulon');
  const j = neb >= 0 ? neb : escortIndex(c, () => true);
  if (j < 0) return null;
  const ship = fleet(c)[j];
  return { id: 'frigate', type: 'destroy', objectives: [{ id: 'frigate', type: 'destroy', kind: 'projector', name: ship.kind === 'nebulon' ? 'the transports’ shield frigate' : 'their escort’s shield projector', hp: hp(c), r: Math.max(0.8, ship.size * 0.06), on: { ship: j, at: [0, 0.16, 0.05] } }] };
};
// the Interdictor's gravity wells: the domes on its back, and two under its hull
const wells = (c) => {
  if (c.objectivesOn !== 'interdictor') return null;
  const r = Math.max(0.6, objective(c).size * 0.03);
  const under = (n, x) => ({ id: `well-${n}`, type: 'group', kind: 'well', name: 'Gravity well', hp: hp(c, 4), r, on: { ship: 'objective', at: [x, -0.15, 0.04] } });
  return { id: 'wells', type: 'group', need: 4, shields: true, interdicts: true, crew: 'interdictor', objectives: [sub('gen-port', 'well', 'Gravity well', hp(c, 4), 'group'), sub('gen-star', 'well', 'Gravity well', hp(c, 4), 'group'), under(0, -0.12), under(1, 0.12)] };
};
// a ship boarded: its engines disabled, then held beside while a shuttle docks
const board = (c, j, name) => {
  const ship = fleet(c)[j];
  return {
    id: 'board',
    type: 'board',
    need: 2,
    objectives: [
      { id: 'engines', type: 'destroy', kind: 'engines', name: `${name}’s engines`, verbs: ['Disable', 'Defend'], hp: Math.round(c.budget * 0.4), r: Math.max(0.6, ship.size * 0.12), on: { ship: j, at: [0, 0, -0.5] } },
      { id: 'dock', type: 'zone', kind: 'dock', name, verbs: ['Board', 'Defend'], hp: Math.round(c.budget * 0.6), hold: 25, zone: Math.max(6, ship.size * 0.8), after: 'engines', on: { ship: j, at: [0.6, 0.05, 0] } },
    ],
  };
};
const PICKETS = ['corvette', 'lightcruiser', 'munificent', 'gozanti', 'acclamator', 'nebulon'];
const picketIndex = (c) => {
  const j = escortIndex(c, (x) => PICKETS.includes(x.kind));
  return j >= 0 ? j : escortIndex(c, () => true);
};
const picket = (c) => {
  const j = picketIndex(c);
  return j < 0 ? null : board(c, j, fleet(c)[j].name ?? 'the picket ship');
};
const picketBatteries = (c) => (picketIndex(c) < 0 ? null : batteriesOf(c, picketIndex(c), 'picket', 4, 3, 'Picket battery'));
const jammer = (c) => ({ id: 'jammer', type: 'zone', objectives: [{ id: 'jammer', type: 'zone', kind: 'relay', name: 'their jammer', hp: hp(c), hold: 40, zone: 12, on: { field: [0.3, flank(c) * 36, -4] } }] });
const escortBatteries = (c) => {
  const j = escortIndex(c, () => true);
  return j < 0 ? null : batteriesOf(c, j, 'escort', 4, 3, 'Escort battery');
};
// the Civil War's: the Empire running down the Tantive IV, at Tatooine and over Scarif
const tantive = (c) => {
  if (c.war !== 'gcw' || !['tatooine', 'scarif'].includes(c.sys) || c.sides[c.attacker] !== 'empire' || c.sides[c.defender] !== 'rebel') return null;
  const named = escortIndex(c, (x) => x.name === 'Tantive IV');
  const j = named >= 0 ? named : escortIndex(c, (x) => x.kind === 'corvette');
  return j < 0 ? null : board(c, j, 'the Tantive IV');
};

// ── the second: what commands their fleet ──
const bridge = (c, name = 'Bridge') => ({ id: 'bridge', type: 'destroy', objectives: [sub('bridge', 'bridge', name, hp(c))] });
const relay = (c) => ({ id: 'relay', type: 'zone', objectives: [{ id: 'relay', type: 'zone', kind: 'relay', name: 'the comms relay', hp: hp(c), hold: 45, zone: 12, on: { ship: 'objective', at: [0, 0.42, -0.1] } }] });
const beacon = (c) => ({ id: 'beacon', type: 'zone', objectives: [{ id: 'beacon', type: 'zone', kind: 'beacon', name: 'the data beacon', verbs: ['Slice', 'Contest'], hp: hp(c), hold: 15, zone: 3, on: { field: [0.1, flank(c) * 22, -6] } }] });
const droids = (c) =>
  c.war === 'clone' && c.sides[c.defender] === 'separatists'
    ? { id: 'droids', type: 'destroy', objectives: [{ id: 'droid-relay', type: 'destroy', kind: 'droidrelay', name: 'the droid control relay', hp: hp(c), r: Math.max(1, objective(c).size * 0.03), on: { ship: 'objective', at: [0, 0.26, 0.08] }, effect: { freeze: 30 } }] }
    : null;

// ── the last: the ship itself ──
const reactor = (c) => ({ id: 'reactor', type: 'destroy', why: c.objectivesOn === 'interdictor' ? 'interdictor' : 'flagship', breaks: true, objectives: [sub('reactor', 'reactor', 'Reactor', hp(c))] });

// ── the films' own ──
const moonGen = (c) => ({ id: 'moon', type: 'destroy', objectives: [{ id: 'moon-gen', type: 'destroy', kind: 'shieldgen', name: 'the shield generator', hp: hp(c), on: { piece: 'endor' } }] });
const executor = (c) => bridge(c, 'the Executor’s bridge');
// (the run's reactor takes 40 shots: each of them worth a fortieth of the stage)
const ds2 = (c) => ({ id: 'core', type: 'run', why: 'deathstar', objectives: [{ id: 'ds2-core', type: 'run', kind: 'reactor', name: 'the Death Star’s main reactor', hp: hp(c), unit: hp(c) / 40, on: { piece: 'endor' } }] });
const persecutor = (c) => bridge(c, 'the Persecutor’s bridge');
const gate = (c) => ({ id: 'gate', type: 'destroy', why: 'gate', crew: 'gate', objectives: [{ id: 'gate', type: 'destroy', kind: 'gate', name: 'the Shield Gate', hp: hp(c), on: { piece: 'scarif' } }] });
const echoCannon = (c) => ({ id: 'cannon', type: 'destroy', objectives: [{ id: 'ion-cannon', type: 'destroy', kind: 'cannon', name: 'Echo Base’s ion cannon', hp: hp(c), on: { piece: 'hoth' } }] });

export const GIDEON = { kind: 'tie', name: 'Moff Gideon’s TIE fighter', hp: 14 };

// the second Death Star's superlaser, on the Rebel cruisers at Endor: the
// first a minute or so in (the Liberty, as in the film, if she's there),
// then one every minute and a bit while there are cruisers left to take.
// Their times are the plan's, so every pilot sees the same ships go when
// they do (endor.js fires the beam to meet them). Never a ship an
// objective's on.
const SUPERLASER = { first: [50, 80], every: [70, 95], size: 4 };
function superlaser(c, stages) {
  if (c.war !== 'gcw' || c.sys !== 'endor' || c.sides[0] !== 'rebel' || c.sides[1] !== 'empire') return [];
  const used = new Set();
  if (c.defender === 0) for (const s of stages) for (const o of s.objectives) if (typeof o.on?.ship === 'number') used.add(o.on.ship);
  const free = c.capitals[0].map((cap, i) => ({ cap, i })).filter(({ cap, i }) => cap.role === 'escort' && cap.size > SUPERLASER.size && !used.has(i));
  const span = ([lo, hi]) => lo + c.rand() * (hi - lo);
  const out = [];
  for (let at = span(SUPERLASER.first); free.length && at < c.length - 10; at += span(SUPERLASER.every)) {
    const named = free.findIndex(({ cap }) => cap.name === 'Liberty');
    const [{ i }] = free.splice(named >= 0 ? named : Math.floor(c.rand() * free.length), 1);
    out.push({ team: 0, index: i, at: Math.round(at), by: 'superlaser' });
  }
  return out;
}

export const MENUS = {
  assault: { stages: [[gens, satellites, batteries, uplink], [bridge, relay, droids], [reactor]] },
  siege: { stages: [[platforms, ionCannon, gens, batteries, tantive], [bridge, beacon, droids], [reactor]] },
  interdiction: { stages: [[wells, gens, satellites, uplink], [bridge, relay], [reactor]] },
  blockade: { stages: [[picket, picketBatteries], [bridge, relay], [reactor]] },
  evacuation: { stages: [[ionCannon, frigate, satellites], [bridge, beacon], [reactor]] },
  ambush: { stages: [[jammer, escortBatteries, tantive], [bridge], [reactor]] },
  // the films', as they had them (and only that way round)
  pinned(c) {
    if (c.war !== 'gcw') return null;
    const att = c.sides[c.attacker];
    const def = c.sides[c.defender];
    if (c.sys === 'endor' && att === 'rebel' && def === 'empire') return { id: 'endor', stages: [[moonGen], [executor], [ds2]], losses: false };
    if (c.sys === 'scarif' && att === 'rebel' && def === 'empire') return { id: 'scarif', stages: [[gens], [persecutor], [gate]], losses: false };
    if (c.sys === 'hoth' && att === 'empire' && def === 'rebel') return { id: 'hoth', stages: [[echoCannon], [bridge], [reactor]] };
    return null;
  },
  // the ships the films' set pieces lose at their own times
  losses: (c, stages) => superlaser(c, stages),
  // the bomber waves, where there's a line of battle, and the aces
  side(c) {
    const out = [];
    if (c.line !== false) for (const [n, at] of [180, 390].entries()) out.push({ id: `w${n}`, type: 'wave', team: c.attacker, at, n: 6, travel: 30, name: 'the bomber wave' });
    for (const team of [0, 1]) {
      const own = c.ace?.[team] ?? null;
      const a = c.sides[team] === 'remnant' ? { ...GIDEON, hp: Math.max(GIDEON.hp, own?.hp ?? 0) } : own;
      if (a) out.push({ id: `ace-${team}`, type: 'ace', team, at: 240, hp: a.hp * 4, kind: a.kind, name: a.name });
    }
    return out;
  },
};

// the plan for gcw.js's `battle` at `sys`, laid out as `laid` (battles.js's layBattle)
export function planOf(sys, battle, laid) {
  const sides = battle.sides ?? ['rebel', 'empire'];
  return planFor(
    {
      id: battle.id,
      kind: laid.kind,
      war: laid.war.id,
      sys: sys.id,
      sides,
      attacker: laid.attacker,
      objectivesOn: laid.objectivesOn,
      runners: laid.runners,
      length: laid.clock,
      capitals: laid.war.sides.map((s) => s.capitals.map(({ kind, role, size, name }) => ({ kind, role, size, ...(name ? { name } : {}) }))),
      ace: laid.ace,
      line: BATTLE_KINDS[laid.kind]?.line ?? true,
    },
    MENUS,
  );
}
