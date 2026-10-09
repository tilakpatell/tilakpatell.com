// The roster held to: every ship each war's battles, fleets, hunters,
// traffic and scenery name, side by side, checked against roster.js (who
// flies what, in which war). A row a mix is a ship flown in the wrong war or
// by the wrong side. Pure, tested (rosterAudit.test.js, which fails on any
// mix); scripts/roster-audit.mjs prints it. The design:
// docs/superpowers/specs/2026-10-09-space-battles-design.md, piece 1.
//
// kindsOfPiece(piece) → the ship kinds a systems.js piece flies;
// auditRoster() → [{ war, side, source, kind, ok }] (one row each, the same
//   row once); mixes() → the rows that aren't ok.
// Sources: template:<system> (each war's lines at each system: flagship,
// escorts, fighters, aces), hutts, runners:<battle kind>, owners (what a
// holder drops in, flies by and parks), roles:<garrison> (its drop-in and
// your wing), hunters:<faction> (who hunts for it, its navy, the droids'
// leftovers, the bounty hunters and pirates: anyone's), interdiction (the
// pack an Interdictor launches), ace:remnant (the Remnant's planned ace),
// outofwar:<system> (who hunts and drops in where no war's holder is),
// scenery:<system> (every piece the war shows, for each of its holders).

import { allowed, runnerOf } from './roster';
import { BATTLE_KINDS, HUTTS, templateFor } from './battles';
import { WAR_SYSTEMS } from './gcw';
import { OWNERS, effectsFor, piecesShown } from './warEffects';
import { ESCORTS, ROLES, galaxySide } from './roamRules';
import { FACTIONS } from './hunted';
import { interdictionFor } from './interdiction';
import { GIDEON } from './battlePlans';
import { WARS } from './sides';
import { SYSTEMS } from './systems';

export function kindsOfPiece(p) {
  switch (p.type) {
    case 'fleet':
      return p.ships.map((s) => s.kind);
    case 'battle':
      return [...Object.values(p.sides).flatMap((list) => list.map((s) => s.kind)), ...Object.values(p.fighters ?? {}).flat()];
    case 'chase':
      return [p.runner.kind, p.hunter.kind];
    case 'stream':
      return [...p.kinds];
    case 'patrol':
    case 'depart':
    case 'liftoff':
    case 'escape':
      return [p.kind, ...(p.escort ? [p.escort] : [])];
    default:
      return [];
  }
}

// a faction's kinds (hunted.js's rows: [[kind, weight]…], and its ace)
const factionKinds = (id) => {
  const f = FACTIONS[id];
  return f ? [...f.kinds.map(([k]) => k), ...(f.ace ? [f.ace] : [])] : [];
};
// anyone's: a ship nobody's side flies, or the Hutts'
const neutral = (kind, war) => allowed(kind, war, null) || allowed(kind, war, 'hutt');

export function auditRoster() {
  const rows = new Map();
  const add = (war, side, source, kind, ok = allowed(kind, war, side)) => {
    const key = `${war}|${side}|${source}|${kind}`;
    if (!rows.has(key)) rows.set(key, { war, side, source, kind, ok });
  };
  for (const w of Object.values(WARS)) {
    const war = w.id;
    const sides = [w.liberator, w.raider];
    const byStance = { light: w.liberator, dark: w.raider };
    // the lines of battle, at every system the war's fought at
    for (const sys of WAR_SYSTEMS) {
      const t = templateFor(sys, war);
      for (const [stance, side] of Object.entries(byStance)) {
        const line = t[stance];
        for (const c of [line.flagship, ...line.escorts]) add(war, side, `template:${sys}`, c.kind);
        for (const f of t.fighters[stance]) add(war, side, `template:${sys}`, f.kind);
        if (t.ace?.[stance]) add(war, side, `template:${sys}`, t.ace[stance].kind);
      }
    }
    for (const c of [HUTTS.flagship, ...HUTTS.escorts]) add(war, 'hutt', 'hutts', c.kind);
    for (const f of HUTTS.fighters) add(war, 'hutt', 'hutts', f.kind);
    // who runs an evacuation or a blockade
    for (const k of Object.values(BATTLE_KINDS))
      if (k.runners) for (const side of [...sides, 'hutt']) add(war, side, `runners:${k.id}`, runnerOf(k.id, side));
    // what each holder drops in, flies by, parks, and who hunts for it
    for (const side of [...sides, 'hutt']) {
      const o = OWNERS[side];
      for (const k of [o.capital, ...o.traffic, ...o.escorts].filter(Boolean)) add(war, side, 'owners', k);
      const r = ROLES[o.garrison];
      if (!r) continue;
      for (const k of [r.capitalShip, ...(r.escort ?? []), ...(ESCORTS[side] ?? [])].filter(Boolean)) add(war, side, `roles:${o.garrison}`, k);
      for (const id of r.hunt) for (const k of factionKinds(id)) add(war, side, `hunters:${id}`, k);
      if (r.capital) for (const k of factionKinds(r.capital)) add(war, side, `hunters:${r.capital}`, k);
      for (const id of [...r.bounty, 'weequay']) for (const k of factionKinds(id)) add(war, null, `hunters:${id}`, k, neutral(k, war));
    }
    // the droids' leftovers, where a holder's world was the Separatists'
    for (const sys of SYSTEMS.filter((s) => s.faction === 'separatists'))
      for (const owner of [...sides, 'hutt']) {
        const e = effectsFor(sys.id, { systems: [{ id: sys.id, owner, front: true }] }, { war, side: null });
        if (e?.droids) for (const k of factionKinds('separatists')) add(war, 'separatists', 'hunters:droids', k);
      }
    // the Interdictor's pack, if the war has one
    const pack = interdictionFor(war);
    add(war, pack ?? 'nobody', 'interdiction', pack ? 'interdictor' : 'none', true);
    if (pack) for (const k of factionKinds(pack)) add(war, pack, 'interdiction', k);
    if (war === 'remnant') add(war, 'remnant', 'ace:remnant', GIDEON.kind);
    // a system out of the war: its own faction's hunters and drop-in, if that's in this war
    for (const sys of SYSTEMS.filter((s) => !WAR_SYSTEMS.includes(s.id))) {
      const g = galaxySide(sys, null, war);
      const ships = [g.capitalShip, ...Object.values(g.factions).filter((f) => f.role === 'hunt' || f.role === 'capital').flatMap((f) => f.kinds.map(([k]) => k))].filter(Boolean);
      for (const k of ships) add(war, '*', `outofwar:${sys.id}`, k, sides.some((sd) => allowed(k, war, sd)));
    }
    // the systems' scenery, for each of the war's holders
    const flyers = [...sides, 'hutt', null];
    for (const sys of SYSTEMS)
      for (const owner of [...sides, 'hutt']) {
        const shown = piecesShown(sys, { fleet: owner, heat: 1, war });
        sys.pieces.forEach((p, i) => {
          if (!shown[i]) return;
          for (const k of kindsOfPiece(p)) add(war, '*', `scenery:${sys.id}`, k, flyers.some((s) => allowed(k, war, s)));
        });
      }
  }
  return [...rows.values()];
}

// (the scenery's rows are shown but not yet held to: the next change hides
// another war's pieces, and holds them too)
export const mixes = () => auditRoster().filter((r) => !r.ok && !r.source.startsWith('scenery:'));
