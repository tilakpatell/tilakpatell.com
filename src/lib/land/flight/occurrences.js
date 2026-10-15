// The things that are simply there as a planet's ground streams in, the way
// Minecraft's structures are: a wreck with salvage in it, a cave with
// something living in it, a camp that fires on you, a beacon calling, a ruin
// or a field of bones to fly over. Each world's list is its fiction's (docs/
// research/2026-10-09-planet-geographies.md, “The life of each world”, the
// occurrences column); an Expanse planet's comes from its system, as its life
// does. A dead world has none: nothing is there but the weather.
//
// Placed per 2,048 m cell (the shared grid, lib/net/cells.js), seeded by the
// planet and the cell, so every visit and every pilot in the cell finds the
// same ones in the same places with nothing stored; never inside a place's
// flat or its eased edge, never on a slope over 0.7, at most OCC_CAP a cell.
// A rule says what one does when you come near (applyRule); what it has
// done this visit lives in the caller's `state`, so a salvage is taken once.
//
// Pure: no three.js.
//
//   OCC_CAP; OCCURRENCES[archetype] → { rule, r, foot }
//   OCC[planetId] → [{ kind, name, chance, biome? }]
//   occurrencesFor(spec, life?, { expanse }) → rows (the named world's, the Expanse's rule, or none when dead)
//   placeOccurrences(spec, rows, key, field) → [{ id, kind, name, rule, r, at: [x, y, z], yaw }]
//   applyRule(occ, ship, state, dt) → { toast?, marker?, hostile?: [{ from, to }], pickup? }

import { isDead, lifeFor, systemOf } from './lifeTables.js';
import { LIFE_CELL, cellBounds, rngOf } from './routes.js';
import { slopeAt } from './roster.js';

export const OCC_CAP = 6;
const SLOPE = 0.7;
const TRIES = 10;

// what an occurrence is and what it does: `r` is how near its rule reaches
// (m, along the ground), `foot` how much ground it stands on
export const OCCURRENCES = {
  wreck: { rule: 'salvage', r: 90, foot: 30 },
  cave: { rule: 'lair', r: 160, foot: 40 },
  camp: { rule: 'hostile', r: 300, foot: 40 },
  outpost: { rule: 'hostile', r: 420, foot: 50 },
  beacon: { rule: 'call', r: 900, foot: 10 },
  ruin: { rule: 'sight', r: 220, foot: 50 },
  field: { rule: 'sight', r: 260, foot: 60 },
  site: { rule: 'sight', r: 200, foot: 40 },
};

// a row: the archetype, its name in the world's words, its chance in a cell
const o = (kind, name, chance, more = {}) => ({ kind, name, chance, ...more });

export const OCC = {
  // ── the galaxy ──
  hoth: [o('cave', 'an ice cave', 0.35, { biome: ['range', 'glacier'] }), o('wreck', 'a crashed snowspeeder', 0.3), o('field', 'probe droid pod craters', 0.25), o('site', 'a fissure venting steam', 0.2)],
  tatooine: [o('wreck', 'a sandcrawler', 0.15, { biome: ['dunesea', 'wastes'] }), o('field', 'krayt dragon bones', 0.25), o('site', 'a vaporator farm', 0.25, { biome: ['plateau', 'chott'] }), o('wreck', 'a crashed escape pod', 0.25), o('camp', 'a Tusken camp', 0.3, { biome: ['jundland', 'dunesea', 'wastes'] })],
  endor: [o('site', 'an Ewok trap', 0.3, { biome: ['redwoods'] }), o('ruin', 'a fallen redwood bridge', 0.25), o('outpost', 'an Imperial outpost', 0.2), o('site', 'a glade with a campfire', 0.25)],
  yavin: [o('ruin', 'a Massassi ruin', 0.35), o('wreck', 'a crashed TIE in a clearing', 0.3), o('site', 'a river ford', 0.25, { biome: ['rivers'] })],
  bespin: [o('site', 'a gas platform', 0.3), o('beacon', 'a drifting tibanna balloon', 0.25), o('wreck', 'a cloud car wreck', 0.25)],
  dagobah: [o('wreck', 'a ship sunk in the swamp', 0.2), o('cave', 'a gnarltree cave', 0.3), o('site', 'a rotting log island', 0.3)],
  mustafar: [o('site', 'a lava collector', 0.3), o('field', 'an obsidian spire field', 0.3, { biome: ['glass', 'fields'] }), o('wreck', 'wreckage on a cooled flow', 0.25), o('cave', 'a cave mouth breathing heat', 0.2, { biome: ['volcanoes', 'ash'] })],
  coruscant: [o('site', 'a landing platform', 0.4), o('ruin', 'a senate pod cluster', 0.2), o('field', 'the Works’ smoke stacks', 0.3, { biome: ['works'] })],
  naboo: [o('ruin', 'a Gungan sacred place', 0.25), o('site', 'a waterfall', 0.25, { biome: ['lakecountry', 'gallo'] }), o('site', 'a shaak pen', 0.25, { biome: ['plains'] }), o('field', 'a droid wreck field', 0.25, { biome: ['plains'] })],
  kashyyyk: [o('camp', 'a Trandoshan hunters’ camp', 0.3, { biome: ['shadow', 'wroshyr'] }), o('site', 'a wroshyr with a village', 0.3), o('field', 'a beached sea creature', 0.25, { biome: ['coast'] })],
  kamino: [o('ruin', 'a drowned tower top', 0.3), o('wreck', 'a wreck on a reef', 0.3, { biome: ['shoals'] })],
  geonosis: [o('ruin', 'a hive spire', 0.35, { biome: ['hives', 'mesas'] }), o('outpost', 'a droid foundry mouth', 0.2), o('camp', 'a sonic cannon post', 0.25), o('field', 'an old arena’s bones', 0.15)],
  scarif: [o('outpost', 'a landing pad', 0.25, { biome: ['islands'] }), o('outpost', 'a bunker', 0.2, { biome: ['islands', 'volcano'] }), o('wreck', 'a beached cargo shuttle', 0.25, { biome: ['islands', 'reef'] })],
  nevarro: [o('beacon', 'a bounty puck’s beacon', 0.25), o('ruin', 'a lava bridge', 0.2, { biome: ['fields', 'flats'] }), o('outpost', 'a remnant outpost', 0.2)],
  mandalore: [o('field', 'a glassed crater', 0.35, { biome: ['glass'] }), o('ruin', 'a dome ruin', 0.3, { biome: ['broken', 'drifts'] }), o('cave', 'a mine mouth', 0.25)],
  lothal: [o('ruin', 'a rock spire', 0.3), o('site', 'a farm', 0.3, { biome: ['grass'] }), o('outpost', 'an Imperial comms tower', 0.2), o('cave', 'a mine pit', 0.2, { biome: ['scarred', 'hills'] })],
  sorgan: [o('site', 'a krill pond', 0.3, { biome: ['lakes', 'swamp'] }), o('camp', 'a raiders’ camp', 0.25), o('site', 'a mist hollow', 0.25)],
  // ── the Rick and Morty sector ──
  gazorpazorp: [o('ruin', 'the women’s gate', 0.15), o('field', 'a bone field', 0.3), o('wreck', 'a robot crash', 0.25)],
  squanch: [o('site', 'a party venue', 0.25), o('site', 'a cat tree grove', 0.3)],
  birdworld: [o('ruin', 'a nest stack', 0.3), o('field', 'a feather field', 0.3)],
  gearworld: [o('ruin', 'a gear monument', 0.2), o('field', 'a bolt field', 0.3), o('cave', 'a cog quarry', 0.25)],
  pluto: [o('cave', 'a mine pit', 0.3, { biome: ['mines', 'craters'] }), o('site', 'a drill rig', 0.25), o('beacon', 'a plutonium glow', 0.2)],
  snakeplanet: [o('site', 'a launch pad', 0.25), o('ruin', 'a snake city block', 0.25), o('ruin', 'a snake monument', 0.2)],
  nuptia: [o('ruin', 'a counselling centre annex', 0.2), o('site', 'a cliff lookout', 0.3, { biome: ['cliffs'] })],
  resort: [o('site', 'a pool', 0.35), o('ruin', 'a hotel tower', 0.2)],
  cronenberg: [o('ruin', 'a wrecked street', 0.3), o('field', 'a flesh mound', 0.3), o('camp', 'a nest of the changed', 0.2)],
  purge: [o('site', 'a farm', 0.35, { biome: ['farmland'] }), o('ruin', 'a burnt-out barn', 0.2), o('beacon', 'a lighthouse lamp', 0.1, { biome: ['coast'] })],
  // ── the universe map's fandom planets ──
  cybertron: [o('site', 'a spaceport', 0.2), o('field', 'a crystal grove', 0.3, { biome: ['canyons', 'manganese'] }), o('wreck', 'a rust wreck', 0.3, { biome: ['rust'] }), o('cave', 'a mining trench', 0.25)],
  'middle-earth': [o('site', 'a hobbit hole', 0.3, { biome: ['shire'] }), o('ruin', 'a watchtower', 0.25), o('camp', 'an orc camp', 0.3, { biome: ['mordor', 'misty'] }), o('ruin', 'standing stones', 0.25), o('field', 'a troll turned to stone', 0.15)],
  caribbean: [o('wreck', 'a shipwreck', 0.35, { biome: ['reef', 'islands'] }), o('cave', 'a sea cave', 0.25, { biome: ['islands', 'peaks'] }), o('beacon', 'a beacon fire', 0.2)],
  albuquerque: [o('site', 'a car wash', 0.15, { biome: ['grid'] }), o('site', 'a desert cook site', 0.25, { biome: ['mesa', 'whitesands'] }), o('camp', 'a roadblock', 0.2), o('wreck', 'a lab trailer', 0.2)],
  scranton: [o('site', 'an office park', 0.2, { biome: ['city', 'valley'] }), o('site', 'a beet farm', 0.25), o('field', 'a culm bank', 0.3, { biome: ['culm'] })],
  avengers: [o('site', 'a helipad', 0.2), o('field', 'a training range', 0.25), o('wreck', 'a downed drone', 0.25)],
  invincible: [o('site', 'a stadium', 0.15), o('ruin', 'a fight’s crater', 0.25), o('site', 'a park', 0.3)],
  'c-137': [o('site', 'a garage', 0.2), o('ruin', 'a burnt-out school bus', 0.2), o('beacon', 'a portal’s afterglow', 0.15)],
  earth: [o('site', 'a farm', 0.3, { biome: ['temperate'] }), o('ruin', 'a ruin', 0.25), o('beacon', 'a lighthouse', 0.2, { biome: ['coast'] }), o('wreck', 'a crashed plane', 0.15)],
  'dot-matrix': [o('site', 'a pipe', 0.35), o('field', 'a coin ring', 0.3), o('cave', 'a lava pit', 0.25, { biome: ['lava'] }), o('ruin', 'a block tower', 0.3)],
};

// ── the Expanse: by its system (the note's last row) ──
function expanseOccurrences(spec, system) {
  const out = [o('wreck', 'a wreck', 0.3)];
  if (spec.type === 'rock' || spec.type === 'desert' || spec.type === 'ice') out.push(o('cave', 'a mine', 0.25));
  if (system?.faction?.id && system.faction.id !== 'independent') out.push(o('beacon', 'a colony beacon', 0.2));
  if (system?.hazard === 'pirates') out.push(o('camp', 'a pirates’ camp', 0.3));
  return out;
}

// (the Expanse given as lifeTables' lifeFor is given it)
export function occurrencesFor(spec, life = null, { expanse = null } = {}) {
  life ??= lifeFor(spec, { expanse });
  if (!spec?.id || isDead(life)) return [];
  return OCC[spec.id] ?? expanseOccurrences(spec, systemOf(spec.id, { expanse }));
}

export function placeOccurrences(spec, rows, key, field) {
  if (!rows.length) return [];
  const [x0, z0] = cellBounds(key);
  const rand = rngOf(spec.seed, key, 'occ');
  const specHas = (ids) => (spec.biomes ?? []).some((b) => ids.includes(b.id));
  const out = [];
  // (each row gets its chance in turn, in the table's order, until the cap)
  for (let i = 0; i < rows.length && out.length < OCC_CAP; i++) {
    const row = rows[i];
    const def = OCCURRENCES[row.kind];
    if (!def || rand() >= row.chance) continue;
    for (let t = 0; t < TRIES; t++) {
      const x = x0 + (0.05 + rand() * 0.9) * LIFE_CELL;
      const z = z0 + (0.05 + rand() * 0.9) * LIFE_CELL;
      // (clear of every place's flat and the edge the land eases over, by its own footing too)
      if ((spec.pois ?? []).some((p) => Math.hypot(x - p.at[0], z - p.at[1]) <= p.r + (p.edge ?? 0) + def.foot)) continue;
      if (row.biome && specHas(row.biome) && !row.biome.includes(spec.biomes?.[field.biomeAt(x, z)]?.id)) continue;
      if (slopeAt(field.heightAt, x, z) > SLOPE) continue;
      const y = field.heightAt(x, z);
      if (!Number.isFinite(y)) continue;
      out.push({ id: `${key}:o${i}`, kind: row.kind, name: row.name, rule: def.rule, r: def.r, at: [x, y, z], yaw: rand() * Math.PI * 2 });
      break;
    }
  }
  return out;
}

const HOSTILE_EVERY = 1.4; // s between a camp's volleys
const LOW = 600; // m over it: higher, a camp can't reach you and a cave hasn't seen you
const TAKE = { r: 90, up: 120 }; // m: near and low enough to take salvage
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// what an occurrence does with the ship near it this frame; `state` is its
// visit's own ({} the first time), changed in place
export function applyRule(occ, ship, state, dt) {
  const d = Math.hypot(ship.x - occ.at[0], ship.z - occ.at[2]);
  const up = ship.y - occ.at[1];
  const near = d <= occ.r && up <= LOW;
  switch (occ.rule) {
    case 'salvage':
      if (state.taken || d > TAKE.r || up > TAKE.up) return {};
      state.taken = true;
      return { pickup: occ.id, toast: `Salvage taken from ${occ.name}.` };
    case 'lair':
      if (!near || state.told) return {};
      state.told = true;
      return { toast: `Something stirs in ${occ.name}.` };
    case 'hostile': {
      if (!near) {
        state.wait = 0;
        return {};
      }
      const out = {};
      if (!state.told) {
        state.told = true;
        out.toast = `${cap(occ.name)}: incoming fire.`;
      }
      state.wait = (state.wait ?? 0) - dt;
      if (state.wait <= 0) {
        state.wait = HOSTILE_EVERY;
        out.hostile = [{ from: [occ.at[0], occ.at[1] + 4, occ.at[2]], to: [ship.x, ship.y, ship.z] }];
      }
      return out;
    }
    case 'call':
      if (d > occ.r || state.told) return {};
      state.told = true;
      return { toast: `${cap(occ.name)} is calling: it’s on your map.`, marker: occ.id };
    default:
      if (!near || state.told) return {};
      state.told = true;
      return { toast: `Below you: ${occ.name}.` };
  }
}
