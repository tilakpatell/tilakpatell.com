// The modes the sim runs (sim.js's `mode`), by id: each with Galactic
// Assault's shape (galacticAssault.js): create, tick, onEvent, sideOf,
// teamOf, spawnSets, canRespawn, walkersOf, view, force.
//
//   modeFor(id) → the mode, or null      MODES: the ids

import * as ga from './galacticAssault.js';
import * as strike from './strike.js';
import * as extraction from './extraction.js';
import * as ewokHunt from './ewokHunt.js';
import * as supremacy from './supremacy.js';

const assault = { ...ga, create: ga.createAssault, teamOf: ga.teamOf };

const BY_ID = {
  galacticAssault: assault,
  strike: { ...strike, create: strike.createMode },
  extraction: { ...extraction, create: extraction.createMode },
  ewokHunt: { ...ewokHunt, create: ewokHunt.createMode },
  supremacy: { ...supremacy, create: supremacy.createMode },
};

export const MODES = Object.keys(BY_ID);
export const modeFor = (id) => BY_ID[id] ?? null;
