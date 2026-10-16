// The site's surface roles (the grounds underfoot, the props' trims: the
// roles scripts/galaxy-textures.mjs once made from Poly Haven's scans) on
// the 2017 game's own maps instead, for the Star Wars worlds (the owner's
// rule of 2026-10-10, 04:40: every texture in a Star Wars world is the
// game's). Each role takes one map set from the drop's textures, chosen by
// looking at what the bucket holds: the game's tiling detail arrays where
// it has them (`ta_*`, already grey grain, made for this), else a terrain
// or trim set; never the sequel era (Takodana, Jakku, Starkiller, the First
// Order's ships). scripts/bf2017-textures.mjs makes them the roles' WebPs.
//
// ROLE_SOURCES[role] → { color, normal, orm (bucket paths; color null where
//   the game has none: the grain is the occlusion's), metres (how much
//   ground a tile covers), keep (how much of its colour to keep, 0 … 1),
//   mean (the brightness the detail is centred on, sRGB), crop ([x0, y0,
//   x1, y1] of the map, 0 … 1: the tiling part of a trim sheet) }
// roleFiles(role, size) → the three WebPs ('' the 1024 set, 'sm' half)

const NAT = 'web/textures/objects/nature';
const ARC = 'web/textures/objects/architecture';

const arcticRock = (layer) => ({ color: `${NAT}/arctic/_arcticbase/_commontextures/ta_arcticbase_rockdetail_01_c_00${layer}.png`, normal: `${NAT}/arctic/_arcticbase/_commontextures/ta_arcticbase_rockdetail_01_n_00${layer}.png` });
const desertDetail = (layer) => ({ color: `${NAT}/desert/_desertbase/_detailtextures/ta_desertbase_detail_02_c_00${layer}.png`, normal: `${NAT}/desert/_desertbase/_detailtextures/ta_desertbase_detail_02_n_00${layer}.png` });
const set = (dir, stem, n, orm) => ({ color: `${dir}/${stem}_cs.ktx2`, normal: `${dir}/${stem}_${n}__normal.ktx2`, orm: orm ? `${dir}/${stem}_${n}__orm_${orm}.ktx2` : null });
const naboo = (stem, orm) => set(`${NAT}/naboo/_naboobase/_terraintextures`, stem, 'noh', orm);
const forestMud = set(`${NAT}/forest/_forestbase/_terraintextures/virtualterraintextures`, 't_forestbase_mud_02', 'noh', '602ad4ec');
const snow = { color: null, normal: `${NAT}/arctic/_arcticbase/_terraintextures/t_arcticbase_snow_02_n__normal.ktx2`, orm: `${NAT}/arctic/_arcticbase/_terraintextures/t_arcticbase_snow_02_n__orm_a2c9de6a.ktx2` };
const mossRock = { color: `${NAT}/arctic/_arcticbase/_commontextures/t_arcticbase_mossrock_01_c.ktx2`, normal: `${NAT}/arctic/_arcticbase/_commontextures/t_arcticbase_mossrock_01_n__normal.ktx2` };

export const ROLE_SOURCES = {
  // (Mos Eisley's buildings' own grain, for the adobe)
  adobe: { color: `${NAT}/desert/_desertbase/_detailtextures/ta_moseisley_buildings_detail_04_c_000.png`, normal: `${NAT}/desert/_desertbase/_detailtextures/ta_moseisley_buildings_detail_04_n_000.png`, metres: 3, keep: 0.1, mean: 0.82 },
  // (Yavin's temple: its broken stone blocks, its floor)
  stone: { color: `${NAT}/yavin/_yavintemple/_commontextures/t_yavintemple_maintemple_brickbroken_tile_01_co.ktx2`, normal: null, orm: `${NAT}/yavin/_yavintemple/_commontextures/t_yavintemple_maintemple_brickbroken_tile_01_co__orm_8b4ccb1e.ktx2`, metres: 4, keep: 0.2, mean: 0.8 },
  // (Kamino's dome metal; the MC80's painted grey; Endor's bunker grating)
  metal: { ...set(`${ARC}/kamino/domes/textures`, 't_kam_basemetaldome_01', 'nam', 'e5499c5e'), metres: 2, keep: 0.1, mean: 0.78 },
  paint: { ...set(`${ARC}/rebel/mc80/airlock/textures`, 't_mc80_airlock_metalpainted_gray_01', 'nm', 'fec73450'), metres: 2, keep: 0, mean: 0.86 },
  bark: { color: `${NAT}/forest/_forestbase/forestbase_treelarge_01/t_forestbase_treelarge_tile_01_c.ktx2`, normal: `${NAT}/forest/_forestbase/forestbase_treelarge_01/t_forestbase_treelarge_tile_01_n__normal.ktx2`, metres: 2, keep: 0.3, mean: 0.78 },
  wood: { ...set(`${ARC}/kashyyyk/_textures`, 't_kas_woodplanks_01', 'nam', '348fedf4'), metres: 2, keep: 0.3, mean: 0.8 },
  concrete: { color: `${NAT}/volcanic/_volcanicbase/_terraintextures/t_volcanicbase_concreterough_01_c.ktx2`, normal: `${NAT}/volcanic/_volcanicbase/_terraintextures/t_volcanicbase_concreterough_01_n__normal.ktx2`, metres: 3, keep: 0.1, mean: 0.84 },
  // (Hoth's own rock and snow)
  rock: { ...arcticRock(0), metres: 4, keep: 0.25, mean: 0.8 },
  sand: { ...desertDetail(0), metres: 3, keep: 0.15, mean: 0.82 },
  snow: { ...snow, metres: 3, keep: 0.05, mean: 0.9 },
  // (the game's grass is cards, not ground: Endor's forest floor for its grain)
  grass: { ...forestMud, metres: 3, keep: 0.2, mean: 0.78 },
  // (Endor's forest floor)
  needles: { ...forestMud, metres: 3, keep: 0.2, mean: 0.76 },
  leaves: { ...forestMud, metres: 2, keep: 0.2, mean: 0.76 },
  mud: { ...forestMud, metres: 3, keep: 0.2, mean: 0.74 },
  // (Sullust's sulphur sand)
  ash: { color: `${NAT}/volcanic/_volcanicsulfur/_terraintextures/t_volcanicsulfur_sandrocky_01_c.ktx2`, normal: null, metres: 3, keep: 0.1, mean: 0.76 },
  redsoil: { color: `${NAT}/desert/_desertbase/desertbase_cliffmudrocklarge_01/t_desertbase_cliffmudrocklarge_01_c.ktx2`, normal: `${NAT}/desert/_desertbase/desertbase_cliffmudrocklarge_01/t_desertbase_cliffmudrocklarge_01_n__normal.ktx2`, metres: 4, keep: 0.2, mean: 0.78 },
  gravel: { ...naboo('t_naboo_gravelfine_01', '845ed280'), metres: 2, keep: 0.1, mean: 0.8 },
  beach: { ...desertDetail(1), metres: 3, keep: 0.15, mean: 0.84 },
  tiles: { ...naboo('t_naboo_stonetiles_04', '7309833c'), metres: 4, keep: 0.15, mean: 0.84 },
  // (a trim sheet: its tread plate, not the grating strip along its top)
  deck: { ...set(`${ARC}/_galacticempire/bunkersystem_01`, 't_bs_01_grating_a_01', 'nam', 'ee62fbb6'), crop: [0, 0.34, 0.66, 1], metres: 2, keep: 0.05, mean: 0.8 },
  redrock: { color: `${NAT}/desert/desertcanyon/_terraintextures/t_desertcanyon_rock_01_c.ktx2`, normal: `${NAT}/desert/desertcanyon/_terraintextures/t_desertcanyon_rock_01_n__normal.ktx2`, metres: 4, keep: 0.3, mean: 0.78 },
  mossrock: { ...mossRock, metres: 3, keep: 0.35, mean: 0.72 },
  // (the layered ground's extras at ultra)
  dryground: { ...desertDetail(1), metres: 3, keep: 0.2, mean: 0.8 },
  stones: { ...arcticRock(1), metres: 4, keep: 0.2, mean: 0.78 },
  aerialrock: { ...arcticRock(2), metres: 6, keep: 0.2, mean: 0.78 },
  snowfield: { ...snow, metres: 6, keep: 0.05, mean: 0.9 },
  moss: { ...mossRock, metres: 3, keep: 0.3, mean: 0.74 },
  swampmud: { ...forestMud, metres: 4, keep: 0.25, mean: 0.72 },
  paving: { color: `${NAT}/yavin/_yavintemple/_commontextures/t_yavintemple_floor_tile_01_co.ktx2`, normal: `${NAT}/yavin/_yavintemple/_commontextures/t_yavintemple_floor_tile_01_nss__normal.ktx2`, orm: `${NAT}/yavin/_yavintemple/_commontextures/t_yavintemple_floor_tile_01_nss__orm_9093a788.ktx2`, metres: 3, keep: 0.1, mean: 0.82 },
};

const BF2017_SCANS = '/textures/galaxy/bf2017';

export const roleFiles = (role, size = '') => {
  const f = (name) => `${BF2017_SCANS}/${role}/${name}${size ? `-${size}` : ''}.webp`;
  return { color: f('color'), normal: f('normal'), arm: f('arm') };
};
