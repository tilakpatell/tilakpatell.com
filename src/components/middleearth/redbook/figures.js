// The people and creatures the pop-ups are cut from, each { outline,
// draw(b), aspect }: painted with ./brush.js in its card’s 0…1 box, feet on
// the bottom edge, `aspect` its width over its height (a scene gives a card
// its height and takes its width from this). A figure is drawn in its own
// units, the height 1 and x from its middle (fx), so a hobbit is the same
// hobbit on any card.
//
//   hobbit, wizard, ranger, wraith, elf, dwarf, smeagol, rider (a horse and
//   who sits it), king (a stone colossus), eye (the Eye), dragon (a firework), bird

import { INK, blob, circle, many, mixc, oval, rough, shade, smooth, tint } from './brush';

export const SKIN = '#e9bf97';

// a figure’s frame: points in its units to the card’s box
function frame(aspect) {
  const X = (x) => 0.5 + x / aspect;
  const pts = (list) => list.map(([x, y]) => [X(x), y]);
  return {
    aspect,
    X,
    pts,
    sm: (list) => smooth(pts(list)),
    o: (x, y, rx, ry) => oval(X(x), y, rx / aspect, ry),
    c: (x, y, r) => circle(X(x), y, r / aspect),
  };
}

const face = (b, f, x, y, s, { skin = SKIN, beard = null, shadow = false } = {}) => {
  b.wash(f.o(x, y, s, s * 1.08), { radial: [f.X(x - s * 0.3), y - s * 0.4, (s * 2) / f.aspect], stops: [[0, tint(skin, 0.25)], [1, shade(skin, 0.18)]] }, { edge: 0.3, grain: 0.15 });
  if (shadow) return;
  b.fill(f.c(x - s * 0.38, y - s * 0.05, s * 0.12), INK, 0.85);
  b.fill(f.c(x + s * 0.38, y - s * 0.05, s * 0.12), INK, 0.85);
  b.fill(f.c(x - s * 0.55, y + s * 0.35, s * 0.22), '#d77a62', 0.35);
  b.fill(f.c(x + s * 0.55, y + s * 0.35, s * 0.22), '#d77a62', 0.35);
  if (!beard) b.line(f.pts([[x - s * 0.18, y + s * 0.5], [x, y + s * 0.58], [x + s * 0.18, y + s * 0.5]]), { width: 0.00025, alpha: 0.6, twice: false });
};

// A hobbit, front on: curls, a round face, a jacket and waistcoat, breeches,
// big bare feet. `pack`: a pack on his back; `pans`: Sam’s, hung from it;
// `cloak`: an Elven cloak; `livery`: Pippin’s black and silver of Gondor.
export function hobbit({ coat = '#5d7a3a', vest = '#c9a23a', breeches = '#7a5532', hair = '#5a3418', skin = SKIN, pack = false, pans = false, cloak = null, livery = false, ghost = false } = {}) {
  const f = frame(0.56);
  const head = 0.115;
  const body = f.sm([[-0.15, 0.34], [0, 0.32], [0.15, 0.34], [0.2, 0.5], [0.19, 0.68], [0, 0.7], [-0.19, 0.68], [-0.2, 0.5]]);
  const legs = many(f.sm([[-0.17, 0.64], [-0.02, 0.64], [-0.03, 0.85], [-0.15, 0.85]]), f.sm([[0.02, 0.64], [0.17, 0.64], [0.15, 0.85], [0.03, 0.85]]));
  const feet = many(f.o(-0.11, 0.945, 0.1, 0.05), f.o(0.11, 0.945, 0.1, 0.05));
  const shins = many(f.pts([[-0.13, 0.84], [-0.05, 0.84], [-0.06, 0.93], [-0.12, 0.93]]), f.pts([[0.05, 0.84], [0.13, 0.84], [0.12, 0.93], [0.06, 0.93]]));
  const arms = many(f.sm([[-0.16, 0.35], [-0.21, 0.4], [-0.25, 0.58], [-0.2, 0.6], [-0.15, 0.45]]), f.sm([[0.16, 0.35], [0.21, 0.4], [0.25, 0.58], [0.2, 0.6], [0.15, 0.45]]));
  const hands = many(f.c(-0.225, 0.61, 0.04), f.c(0.225, 0.61, 0.04));
  const curls = blob(f.X(0), 0.16, 0.14 / f.aspect, { bumps: 11, depth: 0.3, seed: 4, aspect: f.aspect });
  const cape = cloak ? f.sm([[-0.12, 0.31], [0.12, 0.31], [0.24, 0.5], [0.27, 0.8], [0, 0.83], [-0.27, 0.8], [-0.24, 0.5]]) : null;
  const sack = pack ? f.sm([[-0.24, 0.3], [0.24, 0.3], [0.27, 0.62], [-0.27, 0.62]]) : null;
  const outline = many(curls, f.o(0, 0.21, head, head * 1.08), body, arms, hands, legs, shins, feet, cape, sack, pans ? f.c(0.27, 0.5, 0.06) : null, f.o(-0.13, 0.21, 0.035, 0.03), f.o(0.13, 0.21, 0.035, 0.03));
  const draw = (b) => {
    const k = ghost ? (c) => mixc(c, '#dfe8f4', 0.75) : (c) => c;
    if (sack) b.wash(sack, k('#8a6a42'), { edge: 0.5 }).ink(sack, { width: 0.0004 });
    if (pans) {
      b.wash(f.c(0.27, 0.5, 0.06), { radial: [f.X(0.25), 0.48, 0.12 / f.aspect], stops: [[0, '#c8c0b0'], [1, '#5a544c']] }).ink(f.c(0.27, 0.5, 0.06), { width: 0.0004 });
    }
    b.wash(feet, { v: [k(tint(skin, 0.1)), k(shade(skin, 0.2))], y0: 0.9, y1: 1 }, { edge: 0.4 });
    b.hatch(feet, { angle: -1.3, gap: 0.0009, alpha: 0.45, colour: shade(hair, 0.2), fade: (x, y) => (y < 0.95 ? 1 : 0) });
    b.wash(shins, k(skin), { edge: 0.3 });
    b.wash(legs, { v: [k(breeches), k(shade(breeches, 0.35))], y0: 0.64, y1: 0.86 }, { edge: 0.5 });
    b.wash(body, { h: [k(tint(livery ? '#2a2a30' : coat, 0.15)), k(shade(livery ? '#2a2a30' : coat, 0.35))], x0: f.X(-0.2), x1: f.X(0.2) }, { edge: 0.5 });
    // the waistcoat down the front, its buttons
    const front = f.sm([[-0.07, 0.36], [0.07, 0.36], [0.09, 0.62], [0, 0.66], [-0.09, 0.62]]);
    b.wash(front, k(livery ? '#c8ccd4' : vest), { edge: 0.4 });
    if (livery) b.ink(f.c(0, 0.45, 0.04), { width: 0.0003, colour: '#e8ecf4', alpha: 0.9 });
    else b.stipple(null, { n: 4, size: 0.00035, colour: '#e8d08a', box: [f.X(-0.005), 0.42, f.X(0.005), 0.6] });
    b.wash(arms, { h: [k(tint(livery ? '#2a2a30' : coat, 0.1)), k(shade(livery ? '#2a2a30' : coat, 0.4))], x0: f.X(-0.25), x1: f.X(0.25) }, { edge: 0.5 });
    b.wash(hands, k(skin), { edge: 0.3 });
    if (cape) {
      b.wash(cape, { v: [k(tint(cloak, 0.1)), k(shade(cloak, 0.3))], y0: 0.3, y1: 0.85 }, { alpha: 0.92, edge: 0.5 });
      b.hatch(cape, { angle: 1.5, gap: 0.0012, alpha: 0.3, fade: (x) => (x > 0.5 ? 1 : 0.2) });
      b.fill(f.c(0, 0.33, 0.03), '#9ac36a');
    }
    b.wash(f.o(-0.13, 0.21, 0.035, 0.03), k(skin)).wash(f.o(0.13, 0.21, 0.035, 0.03), k(skin));
    face(b, f, 0, 0.215, head, { skin: k(skin) });
    b.wash(curls, { v: [k(tint(hair, 0.2)), k(shade(hair, 0.3))], y0: 0.06, y1: 0.22 }, { edge: 0.3 });
    // the curls sit on top of the head, so the face shows again under them
    b.clip(f.o(0, 0.25, head * 0.92, head * 0.85), () => face(b, f, 0, 0.215, head, { skin: k(skin) }));
    b.silhouette(outline, { width: 0.00045, alpha: 0.75, twice: false });
    b.ink(f.pts([[0, 0.66], [0, 0.85]]), { width: 0.0003, alpha: 0.5, closed: false, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// A wizard: the tall hat with its brim and bent point, the long beard, the
// robe to the ground and a staff taller than he is
export function wizard({ robe = '#8b8f96', hat = null, beard = '#ecebe6', staff = '#6b4a2a', ghost = false } = {}) {
  const f = frame(0.44);
  const brim = f.o(-0.01, 0.205, 0.17, 0.028);
  const cone = f.sm([[-0.08, 0.2], [-0.03, 0.1], [0.02, 0.03], [0.1, 0.0], [0.05, 0.06], [0.06, 0.13], [0.09, 0.2]]);
  const gown = f.sm([[-0.1, 0.3], [0.1, 0.3], [0.15, 0.5], [0.2, 0.75], [0.22, 0.98], [0, 1], [-0.22, 0.98], [-0.2, 0.75], [-0.15, 0.5]]);
  const sleeve = f.sm([[0.08, 0.32], [0.16, 0.36], [0.2, 0.47], [0.15, 0.5], [0.1, 0.42]]);
  const sleeveL = f.sm([[-0.08, 0.32], [-0.15, 0.37], [-0.18, 0.56], [-0.12, 0.58], [-0.09, 0.42]]);
  const rod = f.pts([[0.17, 0.06], [0.195, 0.06], [0.19, 0.995], [0.172, 0.995]]);
  const knot = f.o(0.183, 0.07, 0.03, 0.03);
  const whiskers = f.sm([[-0.07, 0.24], [0.07, 0.24], [0.06, 0.34], [0.02, 0.45], [0, 0.52], [-0.02, 0.45], [-0.06, 0.34]]);
  const outline = many(cone, brim, gown, sleeve, sleeveL, rod, knot, f.o(0, 0.235, 0.055, 0.05), whiskers);
  const draw = (b) => {
    const k = ghost ? (c) => mixc(c, '#e6eef8', 0.7) : (c) => c;
    b.wash(rod, { h: [k(tint(staff, 0.2)), k(shade(staff, 0.3))], x0: f.X(0.17), x1: f.X(0.2) }, { edge: 0.3 }).wash(knot, k(shade(staff, 0.1)));
    b.wash(gown, { h: [k(tint(robe, 0.25)), k(shade(robe, 0.35))], x0: f.X(-0.22), x1: f.X(0.22) }, { edge: 0.5 });
    // the folds, falling from the belt
    for (const x of [-0.12, -0.05, 0.04, 0.11]) b.curve(f.pts([[x * 0.6, 0.55], [x * 0.85, 0.75], [x, 0.98]]), { width: 0.0003, alpha: 0.4, twice: false });
    b.hatch(gown, { angle: 1.4, gap: 0.0011, alpha: 0.35, fade: (x) => Math.max(0, (x - 0.55) * 3) });
    b.fill(f.pts([[-0.14, 0.5], [0.14, 0.5], [0.145, 0.52], [-0.145, 0.52]]), k('#5a4632'));
    b.wash(sleeveL, { h: [k(tint(robe, 0.2)), k(shade(robe, 0.3))], x0: f.X(-0.18), x1: f.X(-0.08) }, { edge: 0.4 });
    b.wash(sleeve, k(shade(robe, 0.1)), { edge: 0.4 });
    b.wash(f.c(0.185, 0.47, 0.03), k(SKIN));
    face(b, f, 0, 0.24, 0.05, { skin: k(SKIN), beard: true });
    b.wash(whiskers, { v: [k(beard), k(shade(beard, 0.15))], y0: 0.24, y1: 0.52 }, { edge: 0.3 });
    b.hatch(whiskers, { angle: 1.5, gap: 0.0008, alpha: 0.3, colour: '#8a8a8a' });
    const h2 = hat ?? robe;
    b.wash(cone, { h: [k(tint(h2, 0.15)), k(shade(h2, 0.4))], x0: f.X(-0.08), x1: f.X(0.1) }, { edge: 0.5 });
    b.wash(brim, { v: [k(tint(h2, 0.1)), k(shade(h2, 0.45))], y0: 0.18, y1: 0.235 }, { edge: 0.5 });
    b.silhouette(outline, { width: 0.00045, alpha: 0.75, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// A Ranger in a long cloak: hooded (Strider in the corner) or bare-headed
// (Aragorn), a sword at his hip
export function ranger({ cloak = '#3e4a36', hood = true, hair = '#2e2218', glint = false, ghost = false } = {}) {
  const f = frame(0.4);
  const mantle = f.sm([[-0.1, 0.18], [0, 0.04], [0.1, 0.18], [0.16, 0.4], [0.2, 0.7], [0.21, 0.97], [0.08, 0.95], [0, 0.98], [-0.08, 0.95], [-0.21, 0.97], [-0.2, 0.7], [-0.16, 0.4]]);
  const hem = rough(f.pts([[-0.21, 0.97], [-0.1, 0.95], [0, 0.98], [0.1, 0.95], [0.21, 0.97]]), 0.012, 3);
  const legs = many(f.pts([[-0.09, 0.8], [-0.02, 0.8], [-0.03, 1], [-0.1, 1]]), f.pts([[0.02, 0.8], [0.09, 0.8], [0.1, 1], [0.03, 1]]));
  const sword = f.pts([[-0.15, 0.48], [-0.13, 0.47], [-0.06, 0.82], [-0.08, 0.83]]);
  const outline = many(mantle, legs, sword, hood ? null : f.o(0, 0.14, 0.07, 0.075));
  const draw = (b) => {
    const k = ghost ? (c) => mixc(c, '#dfe8f4', 0.7) : (c) => c;
    b.wash(legs, { v: [k('#3a2c20'), k('#1e1610')], y0: 0.8, y1: 1 }, { edge: 0.3 });
    b.wash(mantle, { h: [k(tint(cloak, 0.15)), k(shade(cloak, 0.45))], x0: f.X(-0.2), x1: f.X(0.2) }, { edge: 0.55 });
    b.hatch(mantle, { angle: 1.45, gap: 0.0011, alpha: 0.4, fade: (x, y) => (y > 0.3 ? 0.4 + (x - 0.5) * 1.4 : 0) });
    b.fill(hem.concat([[1, 1.2], [0, 1.2]]), k(shade(cloak, 0.5)), 0.4);
    for (const x of [-0.1, 0, 0.1]) b.curve(f.pts([[x * 0.4, 0.3], [x * 0.8, 0.6], [x * 1.4, 0.95]]), { width: 0.0003, alpha: 0.35, twice: false });
    b.wash(sword, { h: [k('#6a5030'), k('#2a1c10')], x0: f.X(-0.15), x1: f.X(-0.06) });
    if (hood) {
      // the face in the hood’s shadow, and the glow of a pipe under it
      b.fill(f.o(0, 0.16, 0.055, 0.06), '#120d09');
      b.fill(f.c(-0.02, 0.15, 0.008), k('#c8b08a'), 0.6);
      b.fill(f.c(0.02, 0.15, 0.008), k('#c8b08a'), 0.6);
      if (glint) b.glow(0.62, 0.21, 0.004, '#ff9a3a', 1).fill(f.c(0.05, 0.205, 0.012), '#ffb04a');
    } else {
      b.wash(f.o(0, 0.1, 0.07, 0.06), k(hair)); // the hair, long and dark
      face(b, f, 0, 0.145, 0.055, { skin: k('#d9ae86') });
      b.hatch(f.o(0, 0.18, 0.05, 0.025), { angle: 1.4, gap: 0.0006, alpha: 0.4 });
      b.wash(f.pts([[-0.08, 0.1], [-0.05, 0.08], [-0.06, 0.26], [-0.09, 0.26]]), k(hair));
      b.wash(f.pts([[0.08, 0.1], [0.05, 0.08], [0.06, 0.26], [0.09, 0.26]]), k(hair));
    }
    b.silhouette(outline, { width: 0.00045, alpha: 0.8, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// A Ringwraith on foot: a tall black hood with nothing in it, a ragged hem,
// a pale sword. `pale`: the king he was, as the Ring shows him
export function wraith({ pale = false, sword = true } = {}) {
  const f = frame(0.46);
  const body = f.sm([[-0.07, 0.12], [-0.02, 0.02], [0.04, 0.0], [0.08, 0.12], [0.15, 0.32], [0.2, 0.6], [0.24, 0.98], [-0.24, 0.98], [-0.2, 0.6], [-0.15, 0.32]]);
  const tatter = rough(f.pts([[-0.24, 0.92], [-0.12, 0.96], [0, 0.93], [0.12, 0.97], [0.24, 0.92]]), 0.03, 9, { n: 10 });
  const blade = f.pts([[0.13, 0.5], [0.16, 0.49], [0.33, 0.05], [0.31, 0.04]]);
  const outline = many(body, sword ? blade : null, tatter.concat([[f.X(0.24), 1], [f.X(-0.24), 1]]));
  const draw = (b) => {
    const cloth = pale ? '#dfe7f2' : '#17141a';
    if (sword) b.wash(blade, { v: [pale ? '#ffffff' : '#c6cfd8', pale ? '#b8c8e0' : '#6a7480'], y0: 0.04, y1: 0.5 }, { edge: 0.3 });
    b.wash(body, { h: [tint(cloth, pale ? 0 : 0.12), shade(cloth, pale ? 0.15 : 0.4)], x0: f.X(-0.24), x1: f.X(0.24) }, { edge: 0.4 });
    b.fill(tatter.concat([[f.X(0.24), 1], [f.X(-0.24), 1]]), cloth, 0.9);
    b.fill(f.o(0.01, 0.13, 0.05, 0.06), pale ? '#a8b8d0' : '#030203');
    if (pale) {
      // a crown, and the face of a king long dead
      b.wash(f.pts([[-0.05, 0.07], [-0.03, 0.03], [-0.01, 0.065], [0.01, 0.02], [0.03, 0.065], [0.05, 0.03], [0.06, 0.08]]), '#ffffff');
      b.fill(f.c(-0.015, 0.125, 0.008), '#5a6a88').fill(f.c(0.03, 0.125, 0.008), '#5a6a88');
      b.glow(0.5, 0.45, 0.03, '#eaf2ff', 0.6);
    } else {
      b.hatch(body, { angle: 1.4, gap: 0.0012, colour: '#5a5260', alpha: 0.35 });
      b.fill(f.c(-0.012, 0.13, 0.006), '#8a1a10', 0.7).fill(f.c(0.032, 0.13, 0.006), '#8a1a10', 0.7);
    }
    b.silhouette(outline, { width: 0.00045, colour: pale ? '#7a8aa8' : INK, alpha: 0.8, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// An Elf: tall, a long gown or robe, long hair. `crown`: a circlet; `light`:
// shining as the Ring shows them
export function elf({ gown = '#e8e4d8', hair = '#3a2a1e', crown = false, light = false, cloakColour = null, ghost = false } = {}) {
  const f = frame(0.38);
  const dress = f.sm([[-0.08, 0.24], [0.08, 0.24], [0.11, 0.42], [0.16, 0.7], [0.2, 0.98], [0, 1], [-0.2, 0.98], [-0.16, 0.7], [-0.11, 0.42]]);
  const locks = f.sm([[-0.07, 0.06], [0.07, 0.06], [0.1, 0.2], [0.11, 0.44], [0.06, 0.4], [-0.06, 0.4], [-0.11, 0.44], [-0.1, 0.2]]);
  const arms = many(f.sm([[-0.08, 0.26], [-0.14, 0.32], [-0.15, 0.5], [-0.11, 0.51], [-0.09, 0.36]]), f.sm([[0.08, 0.26], [0.14, 0.32], [0.15, 0.5], [0.11, 0.51], [0.09, 0.36]]));
  const mantle = cloakColour ? f.sm([[-0.1, 0.22], [0.1, 0.22], [0.22, 0.98], [-0.22, 0.98]]) : null;
  const outline = many(locks, mantle, dress, arms, f.o(0, 0.13, 0.05, 0.055));
  const draw = (b) => {
    const k = ghost || light ? (c) => mixc(c, '#f2f6ff', 0.65) : (c) => c;
    if (light) b.glow(0.5, 0.5, 0.06, '#fffbe8', 0.9);
    b.wash(locks, { v: [k(tint(hair, 0.15)), k(shade(hair, 0.25))], y0: 0.06, y1: 0.45 }, { edge: 0.3 });
    if (mantle) b.wash(mantle, { h: [k(tint(cloakColour, 0.1)), k(shade(cloakColour, 0.4))], x0: f.X(-0.22), x1: f.X(0.22) }, { edge: 0.5 });
    b.wash(dress, { h: [k(tint(gown, 0.3)), k(shade(gown, 0.3))], x0: f.X(-0.2), x1: f.X(0.2) }, { edge: 0.45 });
    for (const x of [-0.08, 0, 0.08]) b.curve(f.pts([[x * 0.5, 0.45], [x * 0.9, 0.7], [x * 1.6, 0.98]]), { width: 0.00028, alpha: 0.3, twice: false });
    b.wash(arms, { h: [k(tint(gown, 0.25)), k(shade(gown, 0.25))], x0: f.X(-0.15), x1: f.X(0.15) }, { edge: 0.4 });
    face(b, f, 0, 0.135, 0.045, { skin: k('#f0d2b4') });
    if (crown) b.ink(f.pts([[-0.045, 0.1], [0.045, 0.1]]), { width: 0.0005, colour: '#e0c060', closed: false, twice: false }).fill(f.c(0, 0.098, 0.008), '#f4f0ff');
    b.silhouette(outline, { width: 0.0004, alpha: light ? 0.4 : 0.75, twice: false, colour: light ? '#9aa8c0' : INK });
  };
  return { outline, draw, aspect: f.aspect };
}

// A Dwarf: broad, a helm, a great beard in two braids, mail, an axe
export function dwarf({ beard = '#a8481e', coat = '#5a3a2a', helm = '#8a8a90' } = {}) {
  const f = frame(0.74);
  const trunk = f.sm([[-0.2, 0.3], [0.2, 0.3], [0.28, 0.5], [0.27, 0.8], [-0.27, 0.8], [-0.28, 0.5]]);
  const legs = many(f.pts([[-0.2, 0.78], [-0.04, 0.78], [-0.05, 1], [-0.22, 1]]), f.pts([[0.04, 0.78], [0.2, 0.78], [0.22, 1], [0.05, 1]]));
  const cap = f.sm([[-0.13, 0.17], [-0.1, 0.06], [0, 0.02], [0.1, 0.06], [0.13, 0.17]]);
  const whiskers = f.sm([[-0.12, 0.2], [0.12, 0.2], [0.14, 0.4], [0.08, 0.62], [0.04, 0.5], [0, 0.56], [-0.04, 0.5], [-0.08, 0.62], [-0.14, 0.4]]);
  const haft = f.pts([[0.22, 0.12], [0.25, 0.12], [0.3, 0.85], [0.27, 0.85]]);
  const head = f.sm([[0.18, 0.1], [0.34, 0.02], [0.37, 0.16], [0.34, 0.3], [0.2, 0.22]]);
  const outline = many(trunk, legs, cap, whiskers, haft, head, f.o(0, 0.19, 0.1, 0.08));
  const draw = (b) => {
    b.wash(legs, { v: ['#4a3828', '#22180e'], y0: 0.78, y1: 1 }, { edge: 0.4 });
    b.wash(trunk, { h: [tint(coat, 0.15), shade(coat, 0.4)], x0: f.X(-0.28), x1: f.X(0.28) }, { edge: 0.5 });
    b.hatch(trunk, { angle: 0.8, gap: 0.0008, alpha: 0.3, colour: '#2a2a2a' }).hatch(trunk, { angle: -0.8, gap: 0.0008, alpha: 0.2, colour: '#2a2a2a' });
    b.fill(f.pts([[-0.27, 0.62], [0.27, 0.62], [0.27, 0.66], [-0.27, 0.66]]), '#3a2614');
    b.wash(haft, { h: ['#8a6038', '#3a2410'], x0: f.X(0.22), x1: f.X(0.3) });
    b.wash(head, { v: ['#e2e6ec', '#7a8088'], y0: 0.02, y1: 0.3 }, { edge: 0.4 });
    face(b, f, 0, 0.19, 0.09, { beard: true });
    b.wash(whiskers, { v: [tint(beard, 0.15), shade(beard, 0.3)], y0: 0.2, y1: 0.62 }, { edge: 0.4 });
    b.hatch(whiskers, { angle: 1.5, gap: 0.0008, alpha: 0.35, colour: shade(beard, 0.5) });
    b.wash(cap, { v: [tint(helm, 0.3), shade(helm, 0.35)], y0: 0.02, y1: 0.18 }, { edge: 0.4 });
    b.fill(f.pts([[-0.012, 0.15], [0.012, 0.15], [0.008, 0.23], [-0.008, 0.23]]), shade(helm, 0.2));
    b.silhouette(outline, { width: 0.00045, alpha: 0.8, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// Sméagol, crouched: thin limbs, a big bald head, great pale eyes
export function smeagol({ ghost = false } = {}) {
  const f = frame(1.0);
  const skin = ghost ? '#e2e8f0' : '#b8b294';
  const torso = f.sm([[-0.18, 0.42], [0.0, 0.34], [0.16, 0.4], [0.2, 0.62], [0.06, 0.7], [-0.16, 0.66]]);
  const skull = f.o(0.18, 0.3, 0.16, 0.16);
  const limbs = many(
    f.sm([[0.1, 0.56], [0.22, 0.7], [0.3, 0.98], [0.24, 0.99], [0.16, 0.72], [0.06, 0.62]]),
    f.sm([[-0.12, 0.62], [-0.3, 0.72], [-0.34, 0.98], [-0.27, 0.99], [-0.24, 0.76], [-0.08, 0.68]]),
    f.sm([[-0.14, 0.6], [-0.06, 0.82], [0.02, 0.99], [-0.05, 0.99], [-0.14, 0.82], [-0.2, 0.64]]),
  );
  const outline = many(torso, skull, limbs);
  const draw = (b) => {
    b.wash(limbs, { v: [skin, shade(skin, 0.35)], y0: 0.5, y1: 1 }, { edge: 0.5 });
    b.wash(torso, { h: [tint(skin, 0.1), shade(skin, 0.35)], x0: f.X(-0.2), x1: f.X(0.2) }, { edge: 0.5 });
    b.hatch(torso, { angle: 1.2, gap: 0.0007, alpha: 0.35, fade: (x, y) => (y > 0.5 ? 1 : 0.3) });
    b.wash(skull, { radial: [f.X(0.12), 0.24, 0.3], stops: [[0, tint(skin, 0.2)], [1, shade(skin, 0.3)]] }, { edge: 0.4 });
    b.fill(f.o(0.12, 0.3, 0.05, 0.045), '#f4f2e0').fill(f.o(0.26, 0.3, 0.05, 0.045), '#f4f2e0');
    b.fill(f.c(0.135, 0.305, 0.022), '#2a4a7a').fill(f.c(0.245, 0.305, 0.022), '#2a4a7a');
    b.fill(f.c(0.135, 0.305, 0.01), '#050505').fill(f.c(0.245, 0.305, 0.01), '#050505');
    for (const x of [0.08, 0.14, 0.2]) b.curve(f.pts([[x, 0.15], [x - 0.03, 0.08], [x - 0.07, 0.05]]), { width: 0.0002, alpha: 0.6, twice: false });
    b.silhouette(outline, { width: 0.0004, alpha: 0.8, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// A horse side on, head to the right, and who rides it: a Black Rider
// hunched in a ragged cloak, or Arwen with Frodo before her
export function rider({ horse = '#141110', who = 'wraith', mane = null, cloak = '#0e0c0c', hair = '#22160e' } = {}) {
  const f = frame(1.15);
  const far = many(
    f.sm([[0.16, 0.66], [0.24, 0.66], [0.27, 0.8], [0.29, 0.97], [0.23, 0.98], [0.21, 0.82]]),
    f.sm([[-0.3, 0.62], [-0.22, 0.66], [-0.2, 0.8], [-0.2, 0.97], [-0.26, 0.98], [-0.27, 0.82]]),
  );
  const body = f.sm([
    [0.53, 0.47], [0.5, 0.38], [0.44, 0.3], [0.42, 0.21], [0.38, 0.27], [0.3, 0.31], [0.2, 0.39], [0.05, 0.43], [-0.15, 0.42], [-0.28, 0.43], [-0.35, 0.5],
    [-0.36, 0.6], [-0.32, 0.68], [-0.31, 0.8], [-0.31, 0.97], [-0.24, 0.98], [-0.25, 0.82], [-0.22, 0.71], [-0.12, 0.69], [0.06, 0.69], [0.12, 0.71],
    [0.14, 0.82], [0.14, 0.97], [0.21, 0.98], [0.21, 0.82], [0.24, 0.69], [0.3, 0.58], [0.35, 0.5], [0.42, 0.46], [0.48, 0.49],
  ]);
  const tail = f.sm([[-0.33, 0.46], [-0.42, 0.54], [-0.47, 0.72], [-0.44, 0.88], [-0.38, 0.72], [-0.35, 0.56]]);
  const hairLine = f.sm([[0.41, 0.24], [0.33, 0.28], [0.22, 0.36], [0.14, 0.4], [0.24, 0.32], [0.36, 0.23]]);
  const man =
    who === 'wraith'
      ? f.sm([[0.04, 0.1], [0.13, 0.02], [0.2, 0.13], [0.2, 0.24], [0.29, 0.34], [0.22, 0.38], [0.22, 0.6], [0.06, 0.66], [-0.12, 0.64], [-0.26, 0.6], [-0.32, 0.5], [-0.2, 0.36], [-0.06, 0.26]])
      : f.sm([[-0.06, 0.44], [-0.04, 0.24], [0.02, 0.14], [0.08, 0.16], [0.12, 0.3], [0.14, 0.44]]);
  const outline = many(far, tail, body, man, who === 'wraith' ? null : f.o(0.04, 0.1, 0.045, 0.045), who === 'wraith' ? null : f.o(0.14, 0.32, 0.04, 0.04));
  const draw = (b) => {
    b.wash(far, shade(horse, 0.35), { edge: 0.3 });
    b.wash(tail, mane ?? shade(horse, 0.2), { edge: 0.3 });
    b.hatch(tail, { angle: 1.4, gap: 0.0007, alpha: 0.4, colour: shade(mane ?? horse, 0.5) });
    b.wash(body, { v: [tint(horse, 0.18), shade(horse, 0.3)], y0: 0.25, y1: 0.98 }, { edge: 0.45 });
    b.light(body, f.X(0.0), 0.48, 0.25, '#ffffff', horse === '#141110' ? 0.08 : 0.35);
    b.hatch(body, { angle: 1.25, gap: 0.0011, alpha: 0.3, colour: '#4a4440', fade: (x, y) => (y > 0.55 ? 0.8 : 0.1) });
    b.wash(hairLine, mane ?? shade(horse, 0.3), { edge: 0.3 });
    b.fill(f.c(0.445, 0.3, 0.009), horse === '#141110' ? '#c43a1a' : INK);
    if (who === 'wraith') {
      b.wash(man, { h: [tint(cloak, 0.15), shade(cloak, 0.3)], x0: f.X(-0.2), x1: f.X(0.15) }, { edge: 0.3 });
      b.fill(rough(f.pts([[-0.3, 0.56], [-0.18, 0.66], [-0.04, 0.68], [0.1, 0.66], [0.22, 0.6]]), 0.025, 5, { n: 8 }).concat([[f.X(0.2), 0.5], [f.X(-0.28), 0.5]]), cloak, 0.95);
      b.fill(f.o(0.155, 0.13, 0.03, 0.045), '#000000');
      b.hatch(man, { angle: 1.4, gap: 0.0011, colour: '#4a4450', alpha: 0.35 });
    } else {
      // Arwen, and Frodo held before her, small and grey
      b.wash(man, { v: ['#4a5a70', '#2a3446'], y0: 0.14, y1: 0.44 }, { edge: 0.4 });
      b.wash(f.sm([[0.02, 0.06], [0.08, 0.06], [0.06, 0.3], [-0.02, 0.32]]), hair);
      face(b, f, 0.045, 0.1, 0.04, { skin: '#f0d2b4' });
      b.wash(f.o(0.14, 0.4, 0.05, 0.05), '#7a8070').wash(f.o(0.14, 0.32, 0.035, 0.035), SKIN);
    }
    b.silhouette(outline, { width: 0.0005, alpha: 0.8, twice: false, colour: horse === '#141110' ? '#000000' : INK });
  };
  return { outline, draw, aspect: f.aspect };
}

// A king in stone, a colossus: crowned and helmed, the left hand raised
// palm out against the north, an axe in the right
export function king({ stone = '#9a958a', moss = '#5f7040', mirror = false } = {}) {
  const f = frame(0.55);
  const s = mirror ? -1 : 1;
  const P = (list) => list.map(([x, y]) => [x * s, y]);
  const robe = f.sm(P([[-0.12, 0.24], [0.12, 0.24], [0.18, 0.5], [0.24, 0.98], [-0.24, 0.98], [-0.18, 0.5]]));
  const arm = f.sm(P([[-0.1, 0.27], [-0.2, 0.2], [-0.25, 0.08], [-0.27, 0.0], [-0.21, -0.0], [-0.19, 0.08], [-0.12, 0.17]]));
  const helm = f.sm(P([[-0.07, 0.17], [-0.07, 0.07], [0, 0.03], [0.07, 0.07], [0.07, 0.17]]));
  const axe = f.pts(P([[0.15, 0.2], [0.17, 0.2], [0.17, 0.75], [0.15, 0.75]]));
  const blade = f.sm(P([[0.17, 0.2], [0.27, 0.15], [0.29, 0.28], [0.17, 0.3]]));
  const base = f.pts([[0, 0.9], [1, 0.9], [1, 1], [0, 1]]);
  const outline = many(robe, arm, helm, axe, blade, base, f.o(0, 0.2, 0.06, 0.05));
  const draw = (b) => {
    const lit = (shape, x0, x1) => b.wash(shape, { h: [tint(stone, 0.25), shade(stone, 0.4)], x0: f.X(x0 * s), x1: f.X(x1 * s) }, { edge: 0.5 });
    lit(robe, -0.24, 0.24);
    lit(arm, -0.27, -0.1);
    lit(helm, -0.07, 0.07);
    lit(axe, 0.15, 0.17);
    lit(blade, 0.17, 0.29);
    b.wash(base, { v: [shade(stone, 0.1), shade(stone, 0.4)], y0: 0.9, y1: 1 });
    b.fill(f.o(0, 0.2, 0.06, 0.05), shade(stone, 0.1));
    b.fill(f.o(0, 0.2, 0.035, 0.025), shade(stone, 0.5), 0.8);
    // the stone’s cracks, its age, and moss in the folds
    b.hatch(robe, { angle: 1.5, gap: 0.0016, alpha: 0.35, fade: (x) => (mirror ? 1 - x : x) * 1.2 - 0.2 });
    for (let i = 0; i < 6; i++) b.line(rough(f.pts(P([[-0.15 + i * 0.06, 0.4 + (i % 3) * 0.15], [-0.12 + i * 0.06, 0.48 + (i % 3) * 0.15]])), 0.01, i + 2), { width: 0.0003, alpha: 0.5, twice: false });
    b.stipple(robe, { n: 80, size: 0.0007, colour: moss, alpha: 0.6, where: (x, y) => (y > 0.6 ? 1 : 0.2) });
    b.silhouette(outline, { width: 0.0006, alpha: 0.8, twice: false });
  };
  return { outline, draw, aspect: f.aspect };
}

// The Eye: lidless, wreathed in flame, the slit of its pupil
export function eye() {
  const lid = (ctx, w, h) => {
    ctx.moveTo(0.04 * w, 0.5 * h);
    ctx.quadraticCurveTo(0.5 * w, -0.05 * h, 0.96 * w, 0.5 * h);
    ctx.quadraticCurveTo(0.5 * w, 1.05 * h, 0.04 * w, 0.5 * h);
    ctx.closePath();
  };
  return {
    outline: lid,
    aspect: 2,
    draw: (b) => {
      b.fill(lid, { radial: [0.5, 0.5, 0.5], stops: [[0, '#fff2a0'], [0.25, '#ffb440'], [0.6, '#e2531a'], [1, '#5a1004']] });
      b.hatch(lid, { angle: 0, gap: 0.0005, colour: '#ffd070', alpha: 0.3 });
      b.fill(oval(0.5, 0.5, 0.035, 0.42), '#120604');
      b.fill(oval(0.5, 0.5, 0.012, 0.36), '#000000');
      b.ink(lid, { width: 0.0006, colour: '#3a0802', alpha: 0.8, twice: false });
    },
  };
}

// A dragon of sparks, Gandalf’s best, flying: horned head, long neck, two
// bat’s wings raised, a barbed tail; green fire and gold
export function dragon() {
  const near = [
    [0.98, 0.42], [0.92, 0.35], [0.87, 0.3], [0.84, 0.18], [0.82, 0.31], [0.76, 0.39], [0.68, 0.43], [0.64, 0.42], [0.72, 0.02], [0.64, 0.2], [0.58, 0.23],
    [0.54, 0.11], [0.5, 0.27], [0.44, 0.22], [0.47, 0.45], [0.4, 0.48], [0.28, 0.5], [0.16, 0.44], [0.06, 0.34], [0.1, 0.45], [0.03, 0.5], [0.18, 0.56],
    [0.3, 0.6], [0.45, 0.63], [0.47, 0.75], [0.52, 0.7], [0.6, 0.62], [0.65, 0.69], [0.69, 0.61], [0.74, 0.54], [0.82, 0.48], [0.9, 0.48], [0.96, 0.46],
  ];
  const far = [[0.6, 0.44], [0.4, 0.05], [0.42, 0.22], [0.35, 0.27], [0.37, 0.44]];
  const shape = many(near, far);
  return {
    outline: shape,
    aspect: 1.5,
    draw: (b) => {
      b.wash(far, { v: ['#2e8a44', '#124a24'] }, { edge: 0.4 });
      b.wash(near, { from: [0.3, 0.1], to: [0.8, 0.7], stops: [[0, '#8ef07a'], [0.5, '#3eb04e'], [1, '#14602c']] }, { edge: 0.5 });
      b.glow(0.6, 0.45, 0.012, '#e8ffb0', 0.8);
      b.hatch(near, { angle: -1.0, gap: 0.0007, colour: '#d8ffa0', alpha: 0.5, fade: (x, y) => (y < 0.45 && x > 0.45 && x < 0.72 ? 1 : 0) });
      b.stipple(near, { n: 90, size: 0.00045, colour: '#fff4a0', alpha: 0.95 });
      b.stipple(far, { n: 30, size: 0.0004, colour: '#fff4a0', alpha: 0.8 });
      b.fill(circle(0.9, 0.38, 0.012), '#ffd23a');
      b.silhouette(shape, { width: 0.0004, colour: '#0e3418' });
    },
  };
}

// a bird in flight, two strokes of the brush, at (x, y) in the box, s its span
export function bird(b, x, y, s, colour = INK) {
  const { ctx, w, h } = b;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, s * w * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo((x - s) * w, y * h);
  ctx.quadraticCurveTo((x - s * 0.4) * w, (y - s * 0.6 * (w / h)) * h, x * w, y * h);
  ctx.quadraticCurveTo((x + s * 0.4) * w, (y - s * 0.6 * (w / h)) * h, (x + s) * w, y * h);
  ctx.stroke();
  ctx.restore();
}
