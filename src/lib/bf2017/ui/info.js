// The game's modes, levels and planets as its menus name them (src/data/
// bf2017/info.json, from the information assets: the GameModesList's order,
// each mode's levels, each level's planet), for the game's own screens and
// the galaxy's landing menu, so the two never disagree.
//
// info(kind, id) → row | null: kind 'mode' (by its GameModeId, 'SpaceBattle'),
//   'level' (by its asset's name, 'EchoBase', or its key, 'Hoth_01') or
//   'planet' ('Hoth'); the row with `title` and `blurb` in the game's words
//   (a level's blurb for a mode: info('level', id, { mode }))
// infoList() → the modes in the game's order, each with its title
// modeFor(site) → the game's mode id for one of the site's ('galacticAssault')
// levelFor(site) → the level row for one of the site's worlds ('hoth')

import BOOK from '../../../data/bf2017/info.json';
import { STRINGS, text } from '../strings';

const ROWS = BOOK.rows;
const TABLE = { ...STRINGS, ...ROWS.strings };
const say = (key) => (key ? text(key, [], { strings: TABLE }) : null);

// the site's modes and worlds → the game's
export const MODE_IDS = { galacticAssault: 'PlanetaryBattles', assault: 'PlanetaryBattles', starfighter: 'SpaceBattle', hvv: 'HeroesVersusVillains', heroes: 'HeroesVersusVillains', blast: 'Blast', strike: 'Domination', extraction: 'DominationExtraction', ewokHunt: 'Mode6', coop: 'ModeDefend', supremacy: 'Mode1', skirmish: 'SkirmishBlast' };
export const LEVEL_KEYS = { hoth: 'Hoth_01', endor: 'Endor_01', tatooine: 'Tatooine_01', naboo: 'Naboo_01', kashyyyk: 'Kashyyyk_01', kamino: 'Kamino_01', geonosis: 'Geonosis_01', yavin: 'Yavin_01', jabba: 'JabbasPalace_01', bespin: 'Bespin_01', felucia: 'Felucia_01', scarif: 'Scarif_01', deathstar: 'DeathStar02_01', kessel: 'Kessel_01' };

export const modeFor = (site) => MODE_IDS[site] ?? site;

const levelByKey = (key) => Object.entries(ROWS.levels).find(([, l]) => l.key?.toLowerCase() === String(key).toLowerCase());

export function info(kind, id, { mode = null } = {}) {
  if (kind === 'mode') {
    const m = ROWS.modes[id] ?? ROWS.modes[modeFor(id)];
    return m ? { ...m, title: say(m.name) ?? m.aurebesh, blurb: say(m.description) } : null;
  }
  if (kind === 'level') {
    const hit = ROWS.levels[id] ? [id, ROWS.levels[id]] : levelByKey(id);
    if (!hit) return null;
    const [name, l] = hit;
    const over = mode ? l.overrides?.[modeFor(mode)] : null;
    return { ...l, id: name, title: say(l.name) ?? l.aurebesh, blurb: say(over ?? l.description) };
  }
  if (kind === 'planet') {
    const p = ROWS.planets[id];
    return p ? { ...p, title: say(p.name) } : null;
  }
  return null;
}

export const infoList = () => ROWS.order.map((id) => info('mode', id)).filter(Boolean);

export const levelFor = (site) => (LEVEL_KEYS[site] ? info('level', LEVEL_KEYS[site]) : null);
