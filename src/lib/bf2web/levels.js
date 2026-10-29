// The galaxy's worlds bf2-web's engine plays, read off the build the site serves
// (docs/decisions/2026-10-29-battlefront-is-bf2-webs-engine.md): play.json's levels (the build's own play-config.json
// levels, as scripts/bf2web-adopt.mjs writes them) matched to the worlds whose ground they are (the 2017 game's levels
// by world, src/data/bf2017/modes.json). A build that lists another world's level opens that world in the engine as
// Hoth is, with no change here. Pure but for the two records it reads (with their extensions and attributes: the
// prerender reads this file in Node, through the galaxy's systems.js).
//
//   worldsOf(levels, worlds) → the world ids whose ground a level is, in modes.json's order (['Hoth_01'] → ['hoth'])
//   ENGINE_WORLDS            the live build's

import PLAY from '../../data/bf2web/play.json' with { type: 'json' };
import BOOK from '../../data/bf2017/modes.json' with { type: 'json' };

export function worldsOf(levels = [], worlds = {}) {
  const played = new Set((levels ?? []).map((l) => String(l).toLowerCase()));
  return Object.entries(worlds ?? {})
    .filter(([, w]) => (w.ground ?? []).some((g) => played.has(g)))
    .map(([id]) => id);
}

export const ENGINE_WORLDS = PLAY.build ? worldsOf(PLAY.levels, BOOK.worlds) : [];
