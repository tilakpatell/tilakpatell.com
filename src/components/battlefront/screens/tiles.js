// What a Play tile's tree is filled with on the canvas (Play.jsx's tiles,
// the 2026-10-13 canvas design, phase 1): the game's PlayTile keeps its own
// title and description; the game's code fills the rest, and here the
// table does (src/data/bf2017/NOTES.md, "The screens on the canvas"). Pure.
//
// tileValues(tiles, { notYet }) → values(box, path): `tiles` by the tile's
//   name ({ title, aurebesh, film?, go }), a tile with no `go` still to come
//   (drawn as the game draws a disabled tile); `film` only where the screen
//   names none;
//   `aurebesh` the words of the title the tile draws (the tree's, where it has one)

import { offline } from './menuHeader';

const TILE_PARTS_LEFT_OUT = new Set(['RequiresConnection', 'SplitScreen', 'PlayScenarioWidget', 'EmblemsWidget']);
const LABEL_H = 40; // (PlayTileLabel's AutoSizedContainer, 40 high)

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
    // (the screen gives each tile its film, UI/Video/Tiles/…: the table's only where it gives none)
    if (part === 'Video' && path.includes('VideoWidget')) return t.film && !b.film ? { film: t.film } : null;
    // (the focused tile's top line is as long as its title: its Points are the title's TextSize)
    if (part === 'SelectedTopLine') return { follow: 'Title' };
    if (part === 'NotInBeta') return t.go ? { hidden: true } : { text: notYet };
    // (the pad's button prompt: the PC's game draws none, the live game's Play screens)
    if (part === 'Play prompt') return { hidden: true };
    // The player count (PlayTileLabel): its words the screen's, a range's
    // numbers the game's code fills (`t.players`); its rules as wide as its
    // words (an AutoSizedContainer) and, at its timeline's end, one at its top
    // and one at its foot (both start mid-height and part, 20 to 0 and 20 to 40).
    if (path.includes('PlayerAmount') && part !== 'SplitScreen') {
      if (part === 'Text' && t.players && /\{0/.test(b.text ?? '')) return { text: b.text.replace(/\{(\d)(?::\w+)?\}/g, (_, i) => String(t.players[+i] ?? '')) };
      if (part === 'TopLine') return { follow: 'Text' };
      if (part === 'BottomLine') return { follow: 'Text', y: b.y + LABEL_H - 1 };
      return null;
    }
    // (the split-screen label widget is the console's; the stack named PlayerAmount/SplitScreen holds the count)
    if (part === 'SplitScreen' && b.type !== 'widget') return null;
    return TILE_PARTS_LEFT_OUT.has(part) ? { hidden: true } : null;
  };
}

