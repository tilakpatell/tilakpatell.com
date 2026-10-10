// The galaxy's wars' battles, at their planets (gcw.js says where they're
// on; warfront.js fights them, through universe/battle.js): what kind of
// battle each system fights, which fleets and fighters each war's is fought
// with, and where it's fought, off the planet on its sunlit side, clear of
// its surface, its stations and a Death Star's shield. Pure (tested).
//
// Every ship's size is the galaxy's (a ship's real length at SIZE's scale,
// 53 metres to a map unit: the Star Destroyer 30, the MC80 22.5, the X-wing
// about a quarter; the Executor's held to 110, short of its 19 kilometres,
// the Lucrehulk to 45, and the worlds are grown to be wider still: fit.js).
//
// BATTLE_KINDS: the six kinds of battle (systems.js's `war.kind`): its
// name, its words for the holotable for whoever attacks and defends, whose objectives are
// where, and the runners that decide it. kindFor(id) → the system's kind.
// TEMPLATES[war][id]: { name, light, dark, fighters: { light, dark }, ace?:
// { light?, dark? } }, a line { flagship, escorts: [{ kind, size, name? }] },
// by stance (sides.js: the liberator's light, the raider's dark), and HUTTS,
// the Hutts' line in whichever war; templateFor(id, war) → the system's, or
// the line of battle the war fights anywhere else.
// obstacles(sys) → [{ c: { x, y, z }, r }]: the planet and what's built round
// it, for the fighters to keep out of and the line to be laid clear of.
// layBattle(sys, battle, { now, tier }) → createBattle's options for the
// battle gcw.js has on there (its sides by team: battleAt's `sides`), with
// its `kind`, and no ticket end (`tickets: false`).
// layStarfighter(sys, battle, level, { now, tier }) → the same for a space
// level's Starfighter Assault (surface/missions/starfighter.js's levelOf),
// with its `layout` and `frame`.

import { WARS as UNIVERSE_WARS } from '../universe/wars';
import { WIDTH, createBattle, perSide } from '../universe/battle';
import { widthOf } from '../universe/battleKit';
import { cloneTemplates, remnantTemplates } from './battlesWars';
import { seeded, warInfo } from './gcw';
import { SIDES } from './sides';
import { systemById } from './systems';
import { METRES, frameOf, layoutOf, sideShips } from './surface/missions/starfighter';

const M = 53.3; // metres to a map unit (the Star Destroyer's 1,600 m is 30)
const m = (metres) => +(metres / M).toFixed(2);
export const SIZE = {
  destroyer: 30,
  executor: 110, // (19,000 m, held to this: a world is grown wider than it, fit.js)
  interdictor: m(600),
  lightcruiser: m(450),
  gozanti: 2.4, // (64 m; a little bigger, to read as a ship of the line)
  moncal: m(1200),
  nebulon: m(300),
  corvette: m(150),
  hammerhead: m(315),
  transport: 2.2, // (a GR-75's 90 m, a little bigger)
  venator: m(1137),
  acclamator: m(752),
  munificent: m(825),
  providence: m(1088),
  lucrehulk: 45, // (3,170 m, held to this)
};
const ship = (kind, name = null, size = SIZE[kind]) => ({ kind, size, ...(name ? { name } : {}) });

// ── The kinds of battle ──
// runners: whose (the attacker's or the defender's), how many go and how
// many must get out; `kind` by the runners' stance
export const BATTLE_KINDS = {
  assault: { id: 'assault', name: 'Fleet assault', text: { attack: 'Bring down their flagship', defend: 'Hold the line' }, objective: 'flagship', runners: null, rocks: false, line: true },
  evacuation: {
    id: 'evacuation',
    name: 'Evacuation',
    text: { attack: 'Stop the evacuation', defend: 'Hold the evacuation' },
    objective: 'flagship',
    runners: { side: 'defender', kind: { light: 'transport', dark: 'gozanti', hutt: 'gozanti' }, count: 8, need: 6, every: 38, speed: 8, hp: 34 },
    rocks: false,
    line: true,
  },
  siege: { id: 'siege', name: 'Siege', text: { attack: 'Break the siege line', defend: 'Hold the siege line' }, objective: 'flagship', runners: null, rocks: false, line: true },
  interdiction: { id: 'interdiction', name: 'Interdiction', text: { attack: 'Bring down the Interdictor', defend: 'Keep the Interdictor flying' }, objective: 'interdictor', runners: null, rocks: false, line: true },
  blockade: {
    id: 'blockade',
    name: 'Blockade',
    text: { attack: 'Run the blockade', defend: 'Hold the blockade' },
    objective: 'flagship',
    runners: { side: 'attacker', kind: { light: 'corvette', dark: 'gozanti', hutt: 'gozanti' }, count: 5, need: 3, every: 45, speed: 7, hp: 60 },
    rocks: false,
    line: true,
  },
  ambush: { id: 'ambush', name: 'Ambush', text: { attack: 'Spring the ambush', defend: 'Fight out of the ambush' }, objective: 'flagship', runners: null, rocks: true, line: false },
};
export const kindFor = (id) => (BATTLE_KINDS[warInfo(id).kind] ? warInfo(id).kind : 'assault');

// ── The fighters, by side ──
const FIGHTERS = {
  rebel: [
    { kind: 'xwing', role: 'fighter', weight: 3 },
    { kind: 'awing', role: 'interceptor', weight: 2 },
    { kind: 'ywing', role: 'bomber', weight: 1.5 },
    { kind: 'bwing', role: 'bomber', weight: 1 },
  ],
  empire: [
    { kind: 'tie', role: 'fighter', weight: 4 },
    { kind: 'interceptor', role: 'interceptor', weight: 2 },
    { kind: 'tiebomber', role: 'bomber', weight: 1.5 },
  ],
  republic: [
    { kind: 'arc170', role: 'fighter', weight: 3 },
    { kind: 'delta7', role: 'interceptor', weight: 1.2 },
    { kind: 'ywing', role: 'bomber', weight: 1.5 },
  ],
  separatists: [
    { kind: 'vulture', role: 'fighter', weight: 4 },
    { kind: 'trifighter', role: 'interceptor', weight: 1.5 },
    { kind: 'vulture', role: 'bomber', weight: 1 },
  ],
  hutt: [
    { kind: 'skiff', role: 'fighter', weight: 3 },
    { kind: 'skiff', role: 'bomber', weight: 1 },
  ],
};
FIGHTERS.newrepublic = FIGHTERS.rebel;
FIGHTERS.remnant = FIGHTERS.empire;
const withVader = [...FIGHTERS.empire, { kind: 'tieadvanced', role: 'fighter', weight: 0.4 }];
const VADER = { kind: 'tieadvanced', name: 'Darth Vader', hp: 16 };
const WEDGE = { kind: 'xwing', name: 'Wedge Antilles', hp: 12 };

// ── The lines of battle ──
// each war's anywhere without one of its own
const DEFAULT = {
  gcw: {
    light: { flagship: ship('moncal'), escorts: [ship('nebulon'), ship('hammerhead'), ship('corvette'), ship('corvette'), ship('nebulon'), ship('transport')] },
    dark: { flagship: ship('destroyer'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('lightcruiser'), ship('gozanti'), ship('gozanti'), ship('interdictor')] },
    fighters: { light: FIGHTERS.rebel, dark: FIGHTERS.empire },
  },
  clone: {
    light: { flagship: ship('venator'), escorts: [ship('venator'), ship('acclamator'), ship('acclamator'), ship('corvette'), ship('corvette')] },
    dark: { flagship: ship('providence'), escorts: [ship('munificent'), ship('munificent'), ship('munificent'), ship('munificent'), ship('interdictor')] },
    fighters: { light: FIGHTERS.republic, dark: FIGHTERS.separatists },
  },
  remnant: {
    light: { flagship: ship('moncal'), escorts: [ship('nebulon'), ship('nebulon'), ship('corvette'), ship('corvette'), ship('hammerhead')] },
    dark: { flagship: ship('destroyer'), escorts: [ship('lightcruiser'), ship('lightcruiser'), ship('gozanti'), ship('gozanti'), ship('interdictor')] },
    fighters: { light: FIGHTERS.newrepublic, dark: FIGHTERS.remnant },
  },
};
// the Hutts', in any war: a kajidic's Gozanti at the head of what it can buy
export const HUTTS = {
  flagship: ship('gozanti', 'Kajidic flagship', 9),
  escorts: [ship('corvette'), ship('gozanti'), ship('corvette'), ship('gozanti')],
  fighters: FIGHTERS.hutt,
};

// ── Each war's battles at its systems ──
const GCW_TEMPLATES = {
  // under the second Death Star: Death Squadron against the whole Rebel fleet
  endor: {
    name: 'The Battle of Endor',
    light: { flagship: ship('moncal', 'Home One', 26), escorts: [ship('moncal', 'Liberty'), ship('nebulon'), ship('nebulon'), ship('hammerhead'), ship('corvette'), ship('corvette')] },
    dark: { flagship: ship('executor', 'Executor'), escorts: [ship('destroyer'), ship('destroyer'), ship('destroyer'), ship('interdictor'), ship('lightcruiser')] },
    fighters: { light: [...FIGHTERS.rebel, { kind: 'bwing', role: 'bomber', weight: 1 }], dark: withVader },
    ace: { light: WEDGE, dark: VADER },
  },
  // Death Squadron over Echo Base, and the Rebellion holding them off while the transports run
  hoth: {
    name: 'The Battle of Hoth',
    light: { flagship: ship('moncal'), escorts: [ship('transport'), ship('transport'), ship('transport'), ship('corvette'), ship('nebulon')] },
    dark: { flagship: ship('executor', 'Executor'), escorts: [ship('destroyer', 'Avenger'), ship('destroyer', 'Tyrant'), ship('destroyer', 'Stalker'), ship('destroyer'), ship('interdictor')] },
    fighters: { light: FIGHTERS.rebel, dark: withVader },
    ace: { light: WEDGE, dark: VADER },
  },
  // the Shield Gate: the Persecutor and the Intimidator, and the Profundity's fleet
  scarif: {
    name: 'The Battle of Scarif',
    light: { flagship: ship('moncal', 'Profundity'), escorts: [ship('hammerhead', 'Lightmaker'), ship('corvette', 'Tantive IV'), ship('corvette'), ship('nebulon'), ship('hammerhead')] },
    dark: { flagship: ship('destroyer', 'Persecutor'), escorts: [ship('destroyer', 'Intimidator'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { light: [...FIGHTERS.rebel, { kind: 'uwing', role: 'fighter', weight: 1.5 }], dark: FIGHTERS.empire },
  },
  yavin: {
    name: 'The Battle of Yavin',
    light: { flagship: ship('moncal'), escorts: [ship('corvette'), ship('corvette'), ship('nebulon'), ship('hammerhead'), ship('transport')] },
    dark: { flagship: ship('destroyer'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { light: FIGHTERS.rebel, dark: withVader },
  },
  // Cloud City's skies, and Vader waiting there
  bespin: {
    name: 'The Battle of Bespin',
    light: { flagship: ship('moncal'), escorts: [ship('corvette'), ship('corvette'), ship('nebulon'), ship('hammerhead')] },
    dark: { flagship: ship('destroyer', 'Executor’s escort'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { light: FIGHTERS.rebel, dark: withVader },
    ace: { dark: VADER },
  },
  // Phoenix Squadron's world: the Ghost among the A-wings
  lothal: {
    name: 'The Battle of Lothal',
    light: { flagship: ship('moncal'), escorts: [ship('hammerhead'), ship('corvette'), ship('corvette'), ship('nebulon'), ship('transport')] },
    dark: { flagship: ship('destroyer', 'Chimaera'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { light: FIGHTERS.rebel, dark: FIGHTERS.empire },
    ace: { light: { kind: 'ghost', name: 'The Ghost (Hera Syndulla)', hp: 30 } },
  },
  // where A New Hope opens: the Devastator runs down the Tantive IV over Tatooine
  tatooine: {
    name: 'The Battle of Tatooine',
    light: { flagship: ship('moncal'), escorts: [ship('corvette', 'Tantive IV'), ship('corvette'), ship('nebulon'), ship('hammerhead')] },
    dark: { flagship: ship('destroyer', 'Devastator'), escorts: [ship('destroyer'), ship('lightcruiser'), ship('gozanti'), ship('gozanti')] },
    fighters: { light: FIGHTERS.rebel, dark: FIGHTERS.empire },
  },
  coruscant: {
    name: 'The Battle of Coruscant',
    light: { flagship: ship('moncal', 'Home One', 26), escorts: [ship('moncal'), ship('moncal'), ship('nebulon'), ship('hammerhead'), ship('corvette'), ship('corvette')] },
    dark: { flagship: ship('destroyer'), escorts: [ship('destroyer'), ship('destroyer'), ship('destroyer'), ship('interdictor'), ship('lightcruiser'), ship('lightcruiser')] },
    fighters: { light: FIGHTERS.rebel, dark: FIGHTERS.empire },
  },
};

// (the Clone Wars' and the Remnant War's own: battlesWars.js, made with these)
const KIT = { ship, FIGHTERS };
export const TEMPLATES = { gcw: GCW_TEMPLATES, clone: cloneTemplates(KIT), remnant: remnantTemplates(KIT) };
const WAR_NAMES = { gcw: 'The Battle of', clone: 'The Battle of', remnant: 'The Battle of' };
const NAMES = { gcw: { kashyyyk: 'The Battle of Kashyyyk', mandalore: 'The Battle of Mandalore' } };
export function templateFor(id, war = 'gcw') {
  const own = TEMPLATES[war]?.[id];
  if (own) return own;
  const base = DEFAULT[war] ?? DEFAULT.gcw;
  return { ...base, name: NAMES[war]?.[id] ?? `${WAR_NAMES[war] ?? 'The Battle of'} ${systemById(id)?.name ?? id}` };
}

const v = (x, y, z) => ({ x, y, z });
const len = (p) => Math.hypot(p.x, p.y, p.z);

// the planet and what's built round it: a Death Star (its shield, at Endor),
// the Shield Gate, the Death Star that drops in over Scarif, a field of rocks
export function obstacles(sys) {
  const out = [{ c: v(0, 0, 0), r: (sys.body?.r ?? 10) + 6 }];
  for (const p of sys.pieces) {
    if (p.type === 'station') out.push({ c: v(...p.at), r: p.size * (p.kind === 'deathstar2' && p.shield ? 0.7 : 0.55) });
    else if (p.type === 'deathstar') out.push({ c: v(...p.at), r: p.r * 1.2 });
    else if (p.type === 'superlaser') out.push({ c: v(...p.from), r: 40 });
    else if (p.type === 'rocks' && p.kind === 'field') out.push({ c: v(...p.at), r: p.radius });
  }
  return out;
}

// each side's look in a battle (universe/wars.js's side shape: its colour,
// its fighters' bolts and its batteries'): the Rebellion's and the Empire's
// the universe map's own
const [REBELS, EMPIRE] = UNIVERSE_WARS.starwars.sides;
const look = (id, laser, turbo) => ({ id, name: SIDES[id].name, short: SIDES[id].short, colour: SIDES[id].colour, laser, turbo });
const LOOKS = {
  rebel: { ...look('rebel', REBELS.laser, REBELS.turbo), colour: REBELS.colour },
  empire: { ...look('empire', EMPIRE.laser, EMPIRE.turbo), colour: EMPIRE.colour },
  republic: look('republic', [5.8, 0.75, 0.55], [0.6, 2.2, 6.5]),
  separatists: look('separatists', [6.0, 2.5, 0.5], [0.6, 5.5, 1.2]),
  newrepublic: look('newrepublic', REBELS.laser, REBELS.turbo),
  remnant: look('remnant', EMPIRE.laser, EMPIRE.turbo),
  hutt: look('hutt', [6.0, 3.0, 0.6], [6.5, 3.4, 0.8]),
};

const sideOf = (base, line, fighters, escorts = line.escorts) => ({
  ...base,
  fighters,
  capitals: [
    { kind: line.flagship.kind, role: 'flagship', size: line.flagship.size, hull: Math.round(18 * line.flagship.size + 40), ...(line.flagship.name ? { name: line.flagship.name } : {}) },
    ...escorts.map((c) => ({ kind: c.kind, role: 'escort', size: c.size, hull: Math.round(18 * c.size + 40), ...(c.name ? { name: c.name } : {}) })),
  ],
});

// a battle of the old shape (no `sides`): the Rebellion's and the Empire's
const sidesOf = (battle) => battle.sides ?? ['rebel', 'empire'];

// the runners' way through the battle laid at `at` along `axis` (by
// team: whose they are), as points: an evacuation's (the defender's) off
// the planet, out through the middle of the fight, past the end of the
// attacker's line and on to the jump beyond it; a blockade's (the
// attacker's) from behind its own line, across the fight, through the gap
// between the defender's flagship and its first escort, and down to the
// planet. `side`: which flank (±1) an evacuation breaks out by.
function runnerRoute({ war, attacker, team, at, axis, lines, radius, objectivesOn, R, side }) {
  const field = createBattle({ war, attacker, at, axis, perSide: 0, lines, radius, objectivesOn });
  const C = v(...at);
  const A = v(axis[0], 0, axis[1]);
  const S = v(A.z, 0, -A.x); // (across the lines)
  const lineOf = (k) => v(C.x - A.x * lines * (k === 0 ? 1 : -1), C.y, C.z - A.z * lines * (k === 0 ? 1 : -1));
  const add = (p, d, n) => v(p.x + d.x * n, p.y + d.y * n, p.z + d.z * n);
  const cl = len(C) || 1;
  const planet = v((C.x / cl) * (R + 4), (C.y / cl) * (R + 4), (C.z / cl) * (R + 4));
  const out = (p) => [p.x, p.y, p.z].map((x) => +x.toFixed(3));
  if (team !== attacker) {
    // the attacker's line: how far it reaches on the side they break out by
    const caps = field.capitals.filter((c) => c.team === attacker);
    const half = Math.max(...caps.map((c) => side * ((c.pos.x - C.x) * S.x + (c.pos.z - C.z) * S.z) + widthOf(c) / 2));
    const theirs = lineOf(attacker);
    const u = v((theirs.x - C.x) / lines, 0, (theirs.z - C.z) / lines);
    const middle = add(C, S, side * lines * 0.3);
    const flank = add(theirs, S, side * (half + 15));
    const jump = add(add(add(C, u, radius * 1.2), S, side * (half + 30)), v(0, 1, 0), 20);
    return [planet, middle, flank, jump].map(out);
  }
  // the defender's flagship and its first escort, and the gap between them
  const flag = field.capitals.find((c) => c.team !== attacker && c.role === 'flagship');
  const next = field.capitals.find((c) => c.team !== attacker && c.role === 'escort') ?? flag;
  const toNext = Math.sign((next.pos.x - flag.pos.x) * S.x + (next.pos.z - flag.pos.z) * S.z) || 1;
  const gap = add(v(flag.pos.x, (flag.pos.y + next.pos.y) / 2, flag.pos.z), S, toNext * (widthOf(flag) / 2 + 3));
  const own = lineOf(attacker);
  const behind = add(own, v((own.x - C.x) / lines, 0, (own.z - C.z) / lines), 30);
  return [behind, gap, planet].map(out);
}

export function layBattle(sys, battle, { now = battle.start, tier = 'high' } = {}) {
  const warId = battle.war ?? 'gcw';
  const t = templateFor(sys.id, warId);
  // (the system's kind, unless the battle's a forced one of another: warfront.js's dev hook)
  const kind = BATTLE_KINDS[battle.kind] ?? BATTLE_KINDS[kindFor(sys.id)];
  const sides = sidesOf(battle);
  const attacker = battle.attackerTeam ?? (battle.sides ? sides.indexOf(battle.attacker) : battle.attacker === 'rebel' ? 0 : 1);
  const defender = 1 - attacker;
  const lineOf = (side) => (side === 'hutt' ? HUTTS : t[SIDES[side].stance]);
  const fightersOf = (side) => (side === 'hutt' ? HUTTS.fighters : t.fighters[SIDES[side].stance]);
  const war = {
    id: warId,
    name: t.name,
    sides: sides.map((side) => {
      const line = lineOf(side);
      return sideOf(LOOKS[side], line, fightersOf(side), kind.line ? line.escorts : line.escorts.slice(0, 1));
    }),
  };
  const objectivesOn = kind.objective === 'interdictor' && lineOf(sides[defender]).escorts.some((c) => c.kind === 'interdictor') ? 'interdictor' : 'flagship';
  const ace = {};
  sides.forEach((side, team) => {
    const a = side === 'hutt' ? null : t.ace?.[SIDES[side].stance];
    if (a) ace[team] = a;
  });
  const biggest = Math.max(...war.sides.flatMap((s) => s.capitals.map((c) => c.size)));
  const lines = Math.max(70, biggest * 0.5 + 40);
  const radius = lines + 60;
  const R = sys.body?.r ?? 30;
  const avoid = obstacles(sys);
  // which way from the planet: where the system's own battle is, or toward its sun, a little above its equator
  const own = sys.pieces.find((p) => p.type === 'battle');
  const sun = sys.suns[0].dir;
  let base = own ? v(...own.at) : v(sun[0], Math.max(0.15, Math.min(0.45, sun[1])), sun[2]);
  const bl = len(base) || 1;
  base = v(base.x / bl, base.y / bl, base.z / bl);
  const rand = seeded(`lay-${battle.seed}`);
  const yaw0 = (rand() - 0.5) * 0.5;
  // round from there till the line's clear of everything (the same tries in the same order for everyone)
  let chosen = null;
  for (let i = 0; i < 36 && !chosen; i++) {
    const yaw = yaw0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 0.35;
    const lift = i < 18 ? 0 : (i % 3) * 0.12;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const d = v(base.x * c - base.z * s, Math.min(0.7, base.y + lift), base.x * s + base.z * c);
    const dl = len(d);
    const dir = v(d.x / dl, d.y / dl, d.z / dl);
    for (const out of [0.85, 1.1, 1.4]) {
      const dist = R + radius * out + biggest * 0.2;
      const at = [dir.x * dist, dir.y * dist, dir.z * dist];
      // the line across the planet's way out, level
      const h = Math.hypot(dir.x, dir.z) || 1;
      const axis = [-dir.z / h, dir.x / h];
      const trial = createBattle({ war, attacker: 0, at, axis, perSide: 0, lines, radius });
      const reach = (cap) => Math.max(cap.size * 0.55, (WIDTH[cap.kind] ?? 0.4) * cap.size * 0.5);
      const clear = trial.capitals.every((cap) => avoid.every((o) => Math.hypot(cap.pos.x - o.c.x, cap.pos.y - o.c.y, cap.pos.z - o.c.z) - reach(cap) > o.r + 4));
      if (clear) {
        chosen = { at, axis };
        break;
      }
    }
  }
  // (never yet: far out, if nothing's clear)
  if (!chosen) {
    const dist = R + radius * 2 + biggest;
    chosen = { at: [base.x * dist, base.y * dist, base.z * dist], axis: [1, 0] };
  }
  // the runners that decide an evacuation or a blockade, on a way through
  // the fight that takes them past the line they have to get by (it ran
  // beside the fight before, and they all got away untouched)
  let runners = null;
  if (kind.runners) {
    const team = kind.runners.side === 'defender' ? defender : attacker;
    const stance = SIDES[sides[team]].stance;
    const r = kind.runners;
    const k = r.kind[stance];
    const route = runnerRoute({ war, attacker, team, at: chosen.at, axis: chosen.axis, lines, radius, objectivesOn, R, side: rand() < 0.5 ? 1 : -1 });
    runners = { team, kind: k, size: SIZE[k], hp: r.hp, count: r.count, need: r.need, every: r.every, speed: r.speed, route, from: route[0], to: route.at(-1), spread: 10 };
  }
  return {
    war,
    kind: kind.id,
    attacker,
    at: chosen.at.map((x) => +x.toFixed(3)),
    axis: chosen.axis.map((x) => +x.toFixed(6)),
    lines,
    radius,
    avoid,
    clock: Math.round((battle.fightEnd - battle.start) / 1000),
    elapsed: Math.max(0, Math.round((now - battle.start) / 1000)),
    perSide: kind.line ? perSide(tier) : Math.round(perSide(tier) * 1.5),
    seed: battle.seed,
    // (the planet, for what a plan puts on it: an ion cannon)
    planet: { at: [0, 0, 0], r: R },
    objectivesOn,
    ace,
    runners,
    // (fought to its clock or its objectives: a ticket end drained the
    // attacker in a couple of minutes, decided in each pilot's own sim)
    tickets: false,
  };
}

// A space level's Starfighter Assault laid at the planet (surface/missions/
// starfighter.js makes the level a battle): fought where the war's battle
// would be (layBattle's spot, clear of the planet and what's built round
// it), its ships where the level has them round that spot (`layout`), its
// lines and its arena the level's own size, its fighters the level's
// classes, and the plan's objectives at the level's points. `level` is
// levelOf's; `frame` maps its metres into the battle's units.
// a level fought in an area of its own (Kamino's, low over Tipoca City in the
// storm, not in orbit): well out from the planet on its night side, the
// area's whole width clear of the planet and of everything built round it
export function areaSpot(sys, radius) {
  const sun = sys.suns[0].dir;
  const h = Math.hypot(sun[0], sun[2]) || 1;
  const dir = [-sun[0] / h, 0, -sun[2] / h];
  const avoid = obstacles(sys);
  let d = (sys.body?.r ?? 30) + radius * 1.6;
  const clear = (at) => avoid.every((o) => Math.hypot(at[0] - o.c.x, at[1] - o.c.y, at[2] - o.c.z) > o.r + radius * 1.05);
  while (!clear(dir.map((x) => x * d)) && d < 8000) d += 25;
  return dir.map((x) => +(x * d).toFixed(3));
}

export function layStarfighter(sys, battle, level, { now = battle.start, tier = 'high' } = {}) {
  const fought = layBattle(sys, { ...battle, kind: 'assault' }, { now, tier });
  // (in its own area: there, with nothing of the system's to steer round)
  const base = level.area ? { ...fought, at: areaSpot(sys, level.area.radius / METRES), avoid: [] } : fought;
  const frame = frameOf(level, base.at);
  const sides = sidesOf(battle);
  const war = {
    id: battle.war ?? 'gcw',
    name: level.name ?? 'Starfighter Assault',
    sides: sides.map((side, team) => {
      const ships = sideShips(level, team);
      const line = { flagship: ship(ships[0].kind, ships[0].name, ships[0].size), escorts: ships.slice(1).map((s) => ship(s.kind, s.name, s.size)) };
      return sideOf(LOOKS[side], line, level.fighters[team] ?? FIGHTERS[side]);
    }),
  };
  // (the lines: half the way between the flagships; the arena out past the level's launch points)
  const flags = [0, 1].map((team) => frame(level.ships.find((s) => s.team === team && s.role === 'flagship').at));
  const dx = flags[1][0] - flags[0][0];
  const dz = flags[1][2] - flags[0][2];
  const lines = Math.max(20, Math.hypot(dx, dz) / 2);
  const reach = Math.max(...level.spawns.flat().map((s) => Math.hypot(...frame(s.at).map((x, k) => x - base.at[k]))), lines);
  return {
    ...base,
    war,
    kind: 'starfighter',
    axis: [dx, dz].map((x) => +(x / (Math.hypot(dx, dz) || 1)).toFixed(6)),
    lines: +lines.toFixed(2),
    radius: +(reach + 15).toFixed(2),
    layout: layoutOf(level, frame),
    objectivesOn: 'flagship',
    ace: {},
    runners: null,
    frame,
  };
}
