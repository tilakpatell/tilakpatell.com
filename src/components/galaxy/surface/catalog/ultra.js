// The ultra cut of a surface model: for the kinds seen most (each world's
// landmark and what it places most), a <kind>.ultra.glb beside the plain
// file, up to four times the catalogue's `tris` with maps up to 8192, made
// by the importer that made the plain one with --ultra (scripts/ultra/
// commands.mjs lists them). A kind that has one says so in its entry,
// `ultra: { tris, tex }`; the placer loads it at the ultra level only, and
// at ultra draws every model whole at any distance (no far copy). The
// catalogue's `tris` stays the high cut, so nothing at high gets heavier.
// Which file a level loads and whether it swaps to the far copy are read by
// the placer through ./index.js (modelUrlFor, wantsLod, on lib/budgets);
// this file holds the cut's numbers for the importers and the tests.

import { budget } from '../../../../lib/budgets.js';

export const ULTRA = { factor: 4, tex: 8192, bytes: 24 * 1024 * 1024 };

// what an ultra cut of this entry keeps
export const ultraCut = (entry) => entry.ultra ?? { tris: ULTRA.factor * entry.tris, tex: ULTRA.tex };

// whether a kind loads its ultra cut at this level
export const usesUltra = (entry, level) => level === 'ultra' && Boolean(entry?.ultra);

// whether far-off things swap to their light copy (<kind>.lod1.glb) at this
// level: the level's budget says (lib/budgets' lod1; ultra keeps the whole model)
export const farCopies = (level) => Boolean(budget(level).lod1);
