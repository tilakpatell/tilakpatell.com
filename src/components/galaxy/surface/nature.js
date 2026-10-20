// The game's own nature the drop's library has published (catalog/
// bf2017-library.js), for a site's scatter row or a biome's recipe
// (flora.js) to wear in place of the built kind it names (the game's on mid
// and up, the built one on a phone): its forest's rocks and logs, the
// desert's mud rocks and canyon stones, the volcano's crater rocks and
// sulphur stones, Kashyyyk's and Yavin's bushes
const N = (path) => `game:objects/nature/${path}`;
export const NATURE = {
  rock: N('forest/_forestbase/forestbase_rockmedium_02/forestbase_rockmedium_02_mesh'),
  stone: N('forest/_forestbase/forestbase_rocksmall_01/forestbase_rocksmall_01_mesh'),
  log: N('forest/_forestbase/forestbase_logsmall_01/forestbase_logsmall_01_mesh'),
  mudrock: N('desert/_desertbase/desertbase_rockmudrockmedium_01/desertbase_rockmudrockmedium_01_mesh'),
  canyon: N('desert/desertcanyon/_meshscattering/ms_desertcanyon_rock_03/ms_desertcanyon_rock_03_mesh'),
  crater: N('volcanic/sullustan/volcaniccrater_rockmedium_01/volcaniccrater_rockmedium_01_mesh'),
  sulphur: N('volcanic/_volcanicsulfur/_meshscatter/ms_volcanicsulfur_rockfrailsmall_01/ms_volcanicsulfur_rockfrailsmall_01_mesh'),
  bush: N('kashyyyk/_kashyyykbase/_meshscattering/ms_kashyyykbase_schefflerabush_01/ms_kashyyykbase_schefflerabush_s_01_mesh'),
  shrub: N('yavin/_yavinbase/_meshscattering/ms_yavinbase_smallbush_07/ms_yavinbase_smallbush_07_mesh'),
};
