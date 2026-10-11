// The galaxy's face for its things: what it lends a world that draws them by
// kind. Re-exports only, from the files a borrower read before, so a model the
// catalogue swaps (a game's own, by kind) reaches the borrower with no change
// of its own, and the galaxy's insides stay free to move behind this file.

// the catalogue: which kinds exist and where their files are, and its groups
// (the game's own come last, so a kind they name wins over the same kind before)
export { GROUPS, SURFACE_MODELS, lodUrlFor, modelUrlFor, wantsLod } from '../surface/catalog';
// (the drop's object library: a thing whose model is `game:<name>`, its row in SURFACE_MODELS)
export { isGame } from '../surface/catalog/bf2017-library';
// the placer: putting a kind on the ground, singly or as a cluster
export { createPlacer, loadModel, usesModel, clusterSpecs } from '../surface/placer';
// the code-built props, for a check that a kind is drawable either way
export { PROPS } from '../surface/props';
// the kit: a world's set of pieces, keyed
export { createKit } from '../surface/kit';
// the people
export { FIGURES, buildFigure } from '../surface/figures';
// the ships
export { GALAXY_KINDS, buildGalaxyShip } from '../fleet';
