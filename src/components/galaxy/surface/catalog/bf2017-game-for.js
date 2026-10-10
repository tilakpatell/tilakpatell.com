// The worlds' generic props, the game's where the game has the same thing
// (the fifth design, lane O): a kind the sites place by the dozen (a crate,
// a barrel, a vaporator) drawn as the drop's own object of it on mid and
// up, from the object library (catalog/bf2017-library.js). On low, the
// phone's, the site's own model or build stays: the game's cut is the
// heavier. A kind whose game object is not published yet stays the site's
// own at every level, so nothing is lost while an import is pending.
//
// A kind is here only where one object of the game's suits every world
// that places it: the lamp posts (74 of them, Theed's to Mos Eisley's) are
// each world's own, and stay so.
//
//   GAME_FOR: { [site kind]: 'game:<manifest name>' } (written out whole,
//     so the library's import reads them: --from this file)
//   modelFor(kind, level, models) → 'game:<name>' where the table maps the
//     kind, the level is mid or up and the object is in `models`; else null

export const GAME_FOR = {
  // Tatooine's: the moisture vaporator (3.7 m: the 20,000-triangle one is
  // a hero piece, not one of a farm's dozen), a plastic barrel, a metal crate
  vaporator: 'game:objects/props/objectsets/tatooine/moisturevaporator_02/moisturevaporator_02_mesh',
  barrel: 'game:objects/props/objectsets/tatooine/barrelplastic_01/barrelplastic_01_mesh',
  rustycrate: 'game:objects/props/objectsets/tatooine/cratemetal_01/cratemetal_01_mesh',
  bevelcrate: 'game:objects/props/objectsets/tatooine/crate_m_01/crate_m_01_mesh',
  // the Empire's cargo
  impcrate: 'game:objects/props/objectsets/_galacticempire/box_m_04/box_m_04_mesh',
  empirecrate: 'game:objects/props/objectsets/_galacticempire/box_m_06/box_m_06_mesh',
  longcrate: 'game:objects/props/objectsets/_galacticempire/box_m_05/box_m_05_mesh',
  // the Rebellion's: its crates, its ammunition cases, its fuel flasks
  hothcrate: 'game:objects/props/objectsets/_rebelalliance/box_m_02/box_m_02_mesh',
  ammocan: 'game:objects/props/objectsets/_rebelalliance/box_s_04/box_s_04_mesh',
  barrels: 'game:objects/props/objectsets/_rebelalliance/gasflask_01/gasflask_01_mesh',
};

const LOW = new Set(['low']);

export function modelFor(kind, level, models) {
  const game = GAME_FOR[kind];
  if (!game || LOW.has(level)) return null;
  return models?.[game] ? game : null;
}
