// The galaxy's face for its 2017 people's look: a figure on the game's
// skeleton dressed in the game's own surface shader, its kind's recipes
// (crew/<kind>.recipes.json) on the node renderer. Re-exports only, so a
// world that draws the same crew files (the Battlefront's soldiers) wears
// them as the galaxy does, without the galaxy's catalogue in its bundle.

export { dressCrew, watchCrew } from '../surface/crewSurface';
