// The modes rulebook (src/data/bf2017/modes.json): which of the game's modes
// each level carries, read from the mode layers among its `subworlds` (the
// web build's map manifest, maps/<path>.json), gathered by the galaxy's
// world the level is set on, with the modes' and levels' names from the
// game's strings. The galaxy's landing menu (surface/modes.js) reads it.
//
// The layer numbers are the game's own mode numbers: its rich-presence
// strings name them (ID_RP_GAMEMODE_MODE1 "Supremacy", MODE3 "Ewok Hunt",
// MODE5 "Extraction", MODE6 "Hero Showdown", MODE7 "Hero Starfighters",
// MODE9 "Co-op Missions", MODEC "Jetpack Cargo"), and the levels carry
// exactly those layers (Endor_02's Mode3, the space levels' Mode7).
//
//   LAYER_MODES                 [layer pattern, mode id]
//   MODE_STRINGS, LEVEL_STRINGS the string keys of each mode's and level's name
//   LEVEL_WORLDS                level file name → { world, space? }
//   modesOf(subworlds)          the mode ids, in MODE_ORDER
//   modesRulebook(levels, strings) → { names, levels, worlds }
//
// The sequel era is refused (isSequel): its levels are never listed.

import { isSequel } from './bf2017-manifest.mjs';
import { resolveStrings } from './bf2017-ebx.mjs';

export const LAYER_MODES = [
  [/^FantasyBattle$/i, 'galacticAssault'],
  [/^SpaceBattle$/i, 'starfighter'],
  [/^(HeroArena|HeroesVsVillains)$/i, 'hvv'],
  [/^(TeamDeathmatch|TeamDeathmatch_Sk\w*|Blast)$/i, 'blast'],
  [/^Domination$/i, 'strike'],
  [/^Mode1$/i, 'supremacy'],
  [/^(Mode5|Extraction)$/i, 'extraction'],
  [/^Mode6$/i, 'showdown'],
  [/^Mode3$/i, 'ewokHunt'],
  [/^Mode7$/i, 'heroStarfighters'],
  [/^ModeC$/i, 'jetpackCargo'],
  [/^Mode9$/i, 'coop'],
  [/^(PlanetaryMissions|SpaceArcadeTeamBattle)$/i, 'arcade'],
];
export const MODE_ORDER = LAYER_MODES.map(([, m]) => m).filter((m, i, a) => a.indexOf(m) === i);

export const MODE_STRINGS = {
  galacticAssault: 'ID_RP_GAMEMODE_PLANETARYBATTLES',
  starfighter: 'ID_RP_GAMEMODE_SPACEBATTLES',
  hvv: 'ID_RP_GAMEMODE_HEROESVSVILLAINS',
  blast: 'ID_RP_GAMEMODE_BLAST',
  // (Strike has no rich-presence string: UI/Data/GameModes/Domination's GameModeName, by its hash)
  strike: '#312DD139',
  supremacy: 'ID_RP_GAMEMODE_MODE1',
  ewokHunt: 'ID_RP_GAMEMODE_MODE3',
  extraction: 'ID_RP_GAMEMODE_MODE5',
  showdown: 'ID_RP_GAMEMODE_MODE6',
  heroStarfighters: 'ID_RP_GAMEMODE_MODE7',
  coop: 'ID_RP_GAMEMODE_MODE9',
  jetpackCargo: 'ID_RP_GAMEMODE_MODEC',
  arcade: 'ID_PLAY_SCR_SKIRMISH',
};

// level file name → the galaxy's world it is set on (`space`: above it)
export const LEVEL_WORLDS = {
  hoth_01: { world: 'hoth' },
  hoth_02: { world: 'hoth' },
  endor_01: { world: 'endor' },
  endor_02: { world: 'endor' },
  endor_04: { world: 'endor' },
  sb_endor_01: { world: 'endor', space: true },
  tatooine_01: { world: 'tatooine' },
  tatooine_02: { world: 'tatooine' },
  jabbaspalace_01: { world: 'tatooine' },
  geonosis_01: { world: 'geonosis' },
  geonosis_02: { world: 'geonosis' },
  kashyyyk_01: { world: 'kashyyyk' },
  kashyyyk_02: { world: 'kashyyyk' },
  naboo_01: { world: 'naboo' },
  naboo_02: { world: 'naboo' },
  naboo_03: { world: 'naboo' },
  yavin_01: { world: 'yavin' },
  kamino_01: { world: 'kamino' },
  kamino_03: { world: 'kamino' },
  sb_kamino_01: { world: 'kamino', space: true },
  cloudcity_01: { world: 'bespin' },
  scarif_02: { world: 'scarif' },
  felucia_01: { world: 'felucia' },
  deathstar02_01: { world: 'deathstar' },
  kessel_01: { world: 'kessel' },
  sb_fondor_01: { world: 'fondor', space: true },
  sb_droidbattleship_01: { world: 'ryloth', space: true },
};
export const LEVEL_STRINGS = { hoth: 'ID_RP_LEVEL_HOTH', endor: 'ID_RP_LEVEL_ENDOR', tatooine: 'ID_RP_LEVEL_TATOOINE', geonosis: 'ID_RP_LEVEL_GEONOSIS', kashyyyk: 'ID_RP_LEVEL_KASHYYYK', naboo: 'ID_RP_LEVEL_NABOO', yavin: 'ID_RP_LEVEL_YAVIN', kamino: 'ID_RP_LEVEL_KAMINO', bespin: 'ID_RP_LEVEL_BESPIN', felucia: 'ID_RP_LEVEL_FELUCIA', deathstar: 'ID_RP_LEVEL_DEATHSTARII', fondor: 'ID_RP_LEVEL_FONDOR', ryloth: 'ID_RP_LEVEL_DROIDBATTLESHIP', jabbaspalace_01: 'ID_RP_LEVEL_JABBASPALACE' };

const shortOf = (s) => String(typeof s === 'string' ? s : (s?.name ?? s?.path ?? '')).split('/').pop();
const fileOf = (level) => shortOf(level).toLowerCase();

export function modesOf(subworlds = []) {
  const got = new Set();
  for (const s of subworlds) {
    const name = shortOf(s);
    for (const [re, mode] of LAYER_MODES) if (re.test(name)) got.add(mode);
  }
  return MODE_ORDER.filter((m) => got.has(m));
}

// (an upper-case string, ARCADE, as the menu's other names are cased)
const cased = (t) => (t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);
const nameOf = (key, strings) => (strings && key ? (cased(key.startsWith('#') ? (strings.strings ?? strings)[key.slice(1)] : resolveStrings([key], strings)[key]) ?? null) : null);

// levels: [{ level: 'Levels/MP/Hoth_01/Hoth_01', subworlds: [...], modes? }] (modes: the level's rulebook's, when it has one)
export function modesRulebook(levels, strings = null) {
  const out = { names: { modes: {}, worlds: {} }, levels: {}, worlds: {} };
  for (const mode of MODE_ORDER) out.names.modes[mode] = { id: MODE_STRINGS[mode], text: nameOf(MODE_STRINGS[mode], strings) };
  for (const { level, subworlds, modes: given } of levels) {
    const file = fileOf(level);
    const at = LEVEL_WORLDS[file];
    if (!at || isSequel(level)) continue;
    const modes = given ? MODE_ORDER.filter((m) => given.includes(m)) : modesOf(subworlds);
    if (!modes.length) continue;
    out.levels[file] = { level, world: at.world, ...(at.space ? { space: true } : {}), modes, ...(LEVEL_STRINGS[file] ? { name: { id: LEVEL_STRINGS[file], text: nameOf(LEVEL_STRINGS[file], strings) } } : {}) };
    const w = (out.worlds[at.world] ??= { ground: [], space: [], modes: [] });
    w[at.space ? 'space' : 'ground'].push(file);
    w.modes = MODE_ORDER.filter((m) => w.modes.includes(m) || modes.includes(m));
  }
  for (const world of Object.keys(out.worlds).sort()) out.names.worlds[world] = { id: LEVEL_STRINGS[world] ?? null, text: nameOf(LEVEL_STRINGS[world], strings) };
  // (worlds in order, for a stable file)
  out.worlds = Object.fromEntries(Object.entries(out.worlds).sort(([a], [b]) => a.localeCompare(b)));
  out.levels = Object.fromEntries(Object.entries(out.levels).sort(([a], [b]) => a.localeCompare(b)));
  return out;
}
