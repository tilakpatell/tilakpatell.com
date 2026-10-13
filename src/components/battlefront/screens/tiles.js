// What a Play tile's tree is filled with on the canvas (Play.jsx's tiles,
// the 2026-10-13 canvas design, phase 1): the game's PlayTile keeps its own
// title and description; the game's code fills the rest, and here the
// table does (src/data/bf2017/NOTES.md, "The screens on the canvas"). Pure.
//
// tileValues(tiles, { notYet }) → values(box, path): `tiles` by the tile's
//   name ({ title, aurebesh, film, go }), a tile with no `go` still to come;
//   `aurebesh` the words of the title the tile draws (the tree's, where it has one)

import { offline } from './menuHeader';

const TILE_PARTS_LEFT_OUT = new Set(['RequiresConnection', 'SplitScreen', 'PlayScenarioWidget', 'EmblemsWidget']);

export function tileValues(tiles, { notYet = 'NOT IN THIS WORLD YET' } = {}) {
  return (b, path) => {
    const off = offline(b, path);
    if (off) return off;
    const name = path.find((p) => tiles[p]);
    if (!name) return null;
    const t = tiles[name];
    const part = path.at(-1);
    if (part === name) return t.go ? null : { coming: true };
    if (part === 'Title') return b.text ? null : { text: t.title };
    if (part === 'AurebeshTitle') return { text: t.aurebesh ?? t.title };
    if (part === 'Video' && path.includes('VideoWidget')) return t.film ? { film: t.film } : null;
    if (part === 'NotInBeta') return t.go ? { hidden: true } : { text: notYet };
    return TILE_PARTS_LEFT_OUT.has(part) ? { hidden: true } : null;
  };
}

