// The 2017 game's front end, as kits (scripts/bf2017-kit.mjs writes each
// row): the hero-select stage the loadout's hero stands on (the Frontend
// level's Backdrop_01: the dome and its pill lights, src/components/galaxy/
// surface/heroStage.js). The level factory (lane E0's --inside) is not on
// main yet, so the stage is a kit of its two pieces rather than a pack.

export const KITS = {
  frontendstage: { made: 'bf2017', as: 'the hero-select stage of the game’s front end, behind the loadout', url: '/models/galaxy/kits/frontendstage.glb', lod: 0, tex: 1024, from: 'levels/frontend/objects', pieces: { nowheredome_01: { min: [-24.516, -0.107, -24.469], max: [24.516, 30.063, 24.469] }, nowherepilllights_01: { min: [0, -0.141, -7.68], max: [0, 5.121, 7.68] } } },
};
