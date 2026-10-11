// Each side's crest on the holotable (Emblem.jsx draws them): on its fleets,
// in the war's strength strip and in the key. The four sides the 2017 game
// has (the Republic, the Separatists, the Rebellion, the Empire) wear its
// own faction icons (lib/bf2017/icons.js's `side:*`, the factions sprite,
// white made currentColor so they take the side's colour); the New
// Republic, the Remnant and the Hutts, which the game has no icon for, keep
// the site's crests: simple geometric marks, one shape apiece so they're
// told apart at a glance and small, drawn in the side's colour
// (currentColor), stand-ins of our own, not the films' insignia. A crest is
// SVG paths in EMBLEM_BOX, each filled, `evenodd` where a path cuts a hole
// in itself. Tested: one for every side in sides.js, so a side keeps a mark
// should its icon go.
//
// emblemOf(side) → { sprite, href, box } (the game's icon, and the part of
//   its 96 box its art fills) | { shapes } (the site's crest) | null

import { icon } from '../../lib/bf2017/icons';

export const EMBLEM_BOX = '0 0 24 24';

// the sides the game has, by the icon table's name for each
export const GAME_SIDES = { republic: 'side:republic', separatists: 'side:separatists', rebel: 'side:rebel', empire: 'side:empire' };
// The four faction icons draw their art between about 19 and 76 of their 96
// box (measured, rasterised: the Rebellion 19.7–75.6, the Empire 19.7–75.6,
// the Republic 20.9–74.6, the Separatists 19.0–76.3), a margin the crests
// lack (they fill 75 to 92 % of EMBLEM_BOX); drawn whole they stood a third
// smaller than the Hutts' gem beside them. This crop keeps a little margin
// and brings the art to about 84 % of the emblem's box.
export const GAME_BOX = '14 14 68 68';

export function emblemOf(side) {
  const game = GAME_SIDES[side] ? icon(GAME_SIDES[side]) : null;
  if (game) return { sprite: game.sprite, href: game.href, box: GAME_BOX };
  return EMBLEMS[side] ? { shapes: EMBLEMS[side] } : null;
}

export const EMBLEMS = {
  // the Republic: the Senate's column (a star in a ring, at first, looked like the map's + for a front)
  republic: [
    { d: 'M4 3.5H20V6.5H4Z' },
    { d: 'M6.5 7.5H17.5V17.5H6.5Z M8.9 9V16H10.3V9Z M11.3 9V16H12.7V9Z M13.7 9V16H15.1V9Z', evenodd: true },
    { d: 'M3 18.5H21V21H3Z' },
  ],
  // the Separatists: a hexagon, a droid's eye in it
  separatists: [
    { d: 'M12 1L21.5 6.5V17.5L12 23L2.5 17.5V6.5Z M12 3.7L19.2 7.85V16.15L12 20.3L4.8 16.15V7.85Z', evenodd: true },
    { d: 'M8.4 12a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0Z' },
  ],
  // the Rebellion: a dart, climbing
  rebel: [{ d: 'M12 1.5L21.5 21.5L12 16.2L2.5 21.5Z' }],
  // the Empire: a diamond in a diamond
  empire: [
    { d: 'M12 1L23 12L12 23L1 12Z M12 4.3L19.7 12L12 19.7L4.3 12Z', evenodd: true },
    { d: 'M12 8L16 12L12 16L8 12Z' },
  ],
  // the New Republic: a dawn over the horizon
  newrepublic: [{ d: 'M3 15.5a9 9 0 0 1 18 0Z' }, { d: 'M1.5 17.8H22.5V20.4H1.5Z' }],
  // the Remnant: a shield, barred
  remnant: [
    { d: 'M3.5 2.5H20.5V12C20.5 17 16.8 20.6 12 22.5C7.2 20.6 3.5 17 3.5 12Z M6 5H18V12C18 15.6 15.5 18.3 12 19.8C8.5 18.3 6 15.6 6 12Z', evenodd: true },
    { d: 'M8.5 9.8H15.5V12.4H8.5Z' },
  ],
  // the Hutts: a cut gem
  hutt: [{ d: 'M6 3.5H18L22.5 9L12 21.5L1.5 9Z M7.6 10.6H16.4L12 16.8Z', evenodd: true }],
};
