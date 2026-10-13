// The foot of the front end's screens, as the PC's game draws it (the
// captures: one outlined BACK at the bottom left, QUIT on HOME): the game's
// own footer bar (FooterActionBarFullScreen) with only its first Back cell,
// the PC's button, its outline round its word. The code fills and sizes it;
// here, by hand from the captures: the word in the button's 20 px face
// (0.48 em a letter, screens.js's) with 33 px each side. Pure.
//
// FOOTER_DROP: screen()'s `drop` for the footer's other cells
// footerValues(word, tree) → values(box, path) for the footer bar of `tree`
//   (screen()'s, resolved with FOOTER_DROP)

export const FOOTER_DROP = { FooterBar: ['Select', 'Edit', 'View', 'Select#2', 'Back#2', 'Select#3', 'Back#3', 'c11'] };

const PAD = 33;
const FACE = 20;
const LETTER_EM = 0.48;
const CONSOLE = new Set(['ConsoleBlur', 'CONSOLE Text and button']);
const KEEP = Object.freeze({});

// the Back cell's left edge, where the button and its word start
function backX(tree) {
  const find = (bs) => {
    for (const b of bs ?? []) {
      if (b.type === 'cell' && b.id.includes('/FooterBar/') && b.id.endsWith('/Back')) return b.x;
      const x = find(b.children);
      if (x !== null) return x;
    }
    return null;
  };
  return find(tree?.boxes);
}

export function footerValues(word, tree) {
  const w = Math.round(String(word).length * LETTER_EM * FACE + 2 * PAD);
  const x = backX(tree);
  return (b, path) => {
    if (!path.includes('FooterBar')) return null;
    const name = path.at(-1);
    if (b.type === 'cell' && name === 'Back') return { label: word, w };
    if (name === 'PCButtonText') return { text: word, x: x ?? b.x, w, align: ['center', 'center'] };
    if (name === 'PCBlur' || name === 'PCOutline') return { w };
    // (the button's right edge, recorded 2 px in from its 32 px)
    if (name === 'RightLine') return { x: b.x + w - 32 };
    // (the bar is this file's: the rest of it is drawn as the tree has it, and no
    // later rule of a screen's, the social hub's, reaches into it)
    return CONSOLE.has(name) ? { hidden: true } : KEEP;
  };
}
