// The library (the design’s §4.4): a long, high room of stacks either side of
// one aisle, the reading tables down it under their lamps, tall windows at
// the far end, and some fifteen thousand books, every one a draw’s share of
// one draw (parts/shelves.js). Madam Pince at her desk by the door. At the
// back, behind a red rope on brass posts, the Restricted Section: darker
// shelves, books chained to them, and on a lectern the one chained shut that
// shrieks when it is opened. And a book left open on a stand by the desk,
// with a page you can read, on the house you are in.
//
// Night’s quest (Lane F, §4.8) reads `set({ night })`: by night the rope can
// be stepped over, and opening the chained book tells 'restricted' { opened,
// quiet } (quiet: whether Lumos was out and you came softly is the quest’s to say).

import { LINES, NAMES } from '../rules/lines';
import { bookcase, chain, chair, rod, table } from './parts/furniture';
import { commonRoom } from './common/shared';
import { createBooks } from './parts/shelves';
import { createWindows } from './parts/glass';
import { figure } from '../cast/figures';

const W = 9; // m from the aisle’s middle to the side walls
const L = 20; // m from the middle to the end walls
const H = 9;
const ROPE = -13.6; // z of the rope across the aisle
const ROWS = [-9.6, -5.6, -1.6, 2.4, 6.4]; // z of each double stack
const STACK = { from: 2.2, to: 8.6, h: 4.2, shelves: 7 };

// a page from the book left open: on the house you are in, the site’s own words
export const PAGES = {
  gryffindor: { title: 'Hogwarts: A History, the chapter on the tower', text: 'Gryffindor’s door is a painting because Godric trusted no lock he could not argue with. The password changes when the Fat Lady is bored, which is often.' },
  slytherin: { title: 'Hogwarts: A History, the chapter on the dungeons', text: 'The Slytherin rooms run under the lake, and the windows were Salazar’s idea: he liked a view nobody else could have.' },
  ravenclaw: { title: 'Hogwarts: A History, the chapter on the west tower', text: 'Rowena put a riddle on her door instead of a password, holding that a student who can think deserves to be let in, and one who cannot will learn.' },
  hufflepuff: { title: 'Hogwarts: A History, the chapter on the kitchens corridor', text: 'Helga chose rooms near the kitchens, and nobody has ever proved that this was not the cleverest choice of the four.' },
  none: { title: 'Hogwarts: A History, the preface', text: 'There are four houses, and a hat to choose between them. The book has a great deal more to say, and says it slowly.' },
};

const stacks = [];
for (const z of ROWS) for (const side of [-1, 1]) stacks.push({ x: side * ((STACK.from + STACK.to) / 2), z, w: STACK.to - STACK.from });

export default commonRoom({
  id: 'library',
  name: 'The library',
  bounds: { x0: -W + 0.5, x1: W - 0.5, z0: -L + 0.6, z1: L - 0.6 },
  colliders: [
    ...stacks.map((s) => ({ kind: 'box', at: [s.x, s.z], w: s.w, d: 0.95, turn: 0 })),
    // the reading tables down the aisle, Pince’s desk, the rope (by day)
    ...[-7.6, -3.6, 0.4, 4.4].map((z) => ({ kind: 'box', at: [0, z], w: 1.2, d: 2.6, turn: 0 })),
    { kind: 'box', at: [5.4, 15.2], w: 2.6, d: 1.0, turn: 0 },
    { kind: 'box', at: [0, ROPE], w: 3.6, d: 0.3, turn: 0 },
    // the back’s shelves and the chained book’s lectern
    { kind: 'circle', at: [0, -17], r: 0.6 },
  ],
  spawn: { at: [0, 0, L - 1.6], yaw: 0 },
  places: [
    { id: 'library', name: 'The library', at: [0, 4], r: 14 },
    { id: 'restricted', name: 'The Restricted Section', at: [0, -17], r: 4 },
  ],
  light: { hemi: [0xffe2b8, 0x2a2016, 0.85], points: [[0, 2.6, -5.6, 0xffc070, 9], [0, 2.6, 2.4, 0xffc070, 9], [5.4, 2.2, 14.6, 0xffb060, 6], [0, 3, -17, 0xff9a50, 5]] },
  poses: {
    aisle: { at: [0, 1.6, 16], look: [0, 2.2, -14] },
    stacks: { at: [-1.4, 1.5, 4.2], look: [-8, 2.2, 4.4] },
    desk: { at: [2.2, 1.5, 12.4], look: [5.6, 1.4, 15.4] },
    restricted: { at: [0, 1.5, -10.6], look: [0, 1.4, -18] },
  },
  make(kit, { renderer, group, rt, props, tell, toast, place }) {
    // the hall: dressed stone, a ribbed ceiling of dark timber, flags underfoot
    kit.box('ashlar', -W - 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('ashlar', W + 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('ashlar', 0, 0, L + 0.5, W * 2, H, 1);
    kit.box('flags', 0, -0.3, 0, W * 2, 0.3, L * 2);
    kit.box('darkoak', 0, H, 0, W * 2 + 2, 0.4, L * 2 + 2);
    for (let z = -L + 2; z < L; z += 4) kit.box('darkoak', 0, H - 0.5, z, W * 2, 0.5, 0.35);
    // the far wall: three tall windows over the Restricted Section
    kit.box('ashlar', 0, 0, -L - 0.5, W * 2, 3.6, 1);
    kit.box('ashlar', 0, 8.2, -L - 0.5, W * 2, H - 8.2, 1);
    for (const x of [-W + 1.5, -2.2, 2.2, W - 1.5]) kit.box('ashlar', x, 3.6, -L - 0.5, x === -2.2 || x === 2.2 ? 2.6 : 3, 4.6, 1);
    const windows = createWindows(
      [-4.6, 4.6, 0].map((x) => ({ at: [x, 3.6, -L + 0.02], w: x === 0 ? 1.6 : 2.4, h: 4.6, ry: 0 })),
      { renderer },
    );
    windows.set({ day: props.night ? 0 : 0.6, dusk: 0.15 });
    group.add(windows.group);
    // the stacks, back to back down either side, their shelves full
    const shelves = [];
    for (const s of stacks) {
      shelves.push(...bookcase(kit, { at: [s.x, 0, s.z + 0.22], ry: 0, w: s.w, h: STACK.h, shelves: STACK.shelves }));
      shelves.push(...bookcase(kit, { at: [s.x, 0, s.z - 0.22], ry: Math.PI, w: s.w, h: STACK.h, shelves: STACK.shelves }));
      // a carved end on each, toward the aisle, a brass number plate on it
      const end = s.x < 0 ? -STACK.from + 0.04 : STACK.from - 0.04;
      kit.box('darkoak', end, 0, s.z, 0.1, STACK.h + 0.3, 0.98);
      kit.box('brass', end + (s.x < 0 ? 0.06 : -0.06), 2.6, s.z, 0.02, 0.16, 0.24);
    }
    // the back: the Restricted Section’s shelves, darker, along the end and the sides
    const back = [
      ...bookcase(kit, { at: [-5.6, 0, -L + 0.3], ry: 0, w: 5.4, h: 3.4, shelves: 6, mat: 'darkoak' }),
      ...bookcase(kit, { at: [5.6, 0, -L + 0.3], ry: 0, w: 5.4, h: 3.4, shelves: 6, mat: 'darkoak' }),
      ...bookcase(kit, { at: [-W + 0.25, 0, -16.6], ry: Math.PI / 2, w: 5, h: 3.4, shelves: 6, mat: 'darkoak' }),
      ...bookcase(kit, { at: [W - 0.25, 0, -16.6], ry: -Math.PI / 2, w: 5, h: 3.4, shelves: 6, mat: 'darkoak' }),
    ];
    const books = createBooks(shelves, { seed: 7, fill: 0.93 });
    const old = createBooks(back, { seed: 19, fill: 0.82 });
    group.add(books.mesh, old.mesh);
    // the chains across the back shelves, a run of iron along each
    for (const sh of back.filter((_, i) => i % 2 === 0)) kit.box('iron', sh.at[0], sh.at[1] + sh.h * 0.55, sh.at[2], Math.abs(Math.cos(sh.ry)) > 0.5 ? sh.w : 0.03, 0.025, Math.abs(Math.cos(sh.ry)) > 0.5 ? 0.03 : sh.w);
    // the reading tables, their chairs and their lamps
    for (const z of [-7.6, -3.6, 0.4, 4.4]) {
      table(kit, { at: [0, 0, z], ry: 0, len: 2.4, w: 1.1, top: 0.76, mat: 'oak' });
      for (const dz of [-0.7, 0.7]) {
        chair(kit, { at: [-0.95, 0, z + dz], ry: Math.PI / 2, back: 1.1 });
        chair(kit, { at: [0.95, 0, z + dz], ry: -Math.PI / 2, back: 1.1 });
      }
      kit.cyl('brass', 0, 0.76, z, 0.08, 0.1, 0.05, { seg: 10 });
      kit.cyl('brass', 0, 0.81, z, 0.015, 0.015, 0.36, { seg: 6 });
      kit.cyl(kit.glow('#ffcf7a', 2.2), 0, 1.12, z, 0.07, 0.09, 0.14, { seg: 10 });
      kit.cyl('brass', 0, 1.26, z, 0.12, 0.05, 0.06, { seg: 10 });
    }
    // Pince’s desk by the door: a high counter, a ledger, a stamp, a lamp
    kit.box('darkoak', 5.4, 0, 15.2, 2.6, 1.05, 1.0);
    kit.box('oak', 5.4, 1.05, 15.2, 2.8, 0.06, 1.15);
    kit.box(kit.paint('#e8dcc0', { rough: 0.9 }), 5.0, 1.11, 15.0, 0.6, 0.03, 0.42, { ry: 0.1 });
    kit.cyl(kit.glow('#ffcf7a', 2.2), 6.2, 1.2, 15.3, 0.07, 0.09, 0.14, { seg: 10 });
    // the book left open on its stand by the desk
    kit.cyl('darkoak', 2.6, 0, 15.6, 0.05, 0.08, 1.0, { seg: 8 });
    kit.box('darkoak', 2.6, 1.0, 15.6, 0.5, 0.04, 0.36, { rx: -0.35 });
    kit.box(kit.paint('#efe4c8', { rough: 0.95 }), 2.6, 1.05, 15.6, 0.44, 0.02, 0.32, { rx: -0.35 });
    // the rope across the aisle: brass posts, a red rope sagging between
    for (const x of [-1.7, 1.7]) {
      kit.cyl('brass', x, 0, ROPE, 0.14, 0.16, 0.05, { seg: 12 });
      kit.cyl('brass', x, 0.05, ROPE, 0.03, 0.03, 0.95, { seg: 8 });
      kit.cyl('brass', x, 1.0, ROPE, 0.05, 0.04, 0.06, { seg: 8 });
    }
    const red = kit.paint('#8a1a1a', { rough: 0.7 });
    const sag = (u) => 0.98 - 0.22 * (1 - (u / 1.7) ** 2);
    for (let i = 0; i < 8; i++) {
      const u0 = -1.7 + (i / 8) * 3.4;
      const u1 = -1.7 + ((i + 1) / 8) * 3.4;
      rod(kit, red, [u0, sag(u0), ROPE], [u1, sag(u1), ROPE], 0.025);
    }
    // the chained book on its lectern: black leather, iron clasps, chains to the floor ring
    kit.cyl('darkoak', 0, 0, -17, 0.28, 0.34, 0.1, { seg: 12 });
    kit.cyl('darkoak', 0, 0.1, -17, 0.07, 0.1, 0.9, { seg: 8 });
    kit.box('darkoak', 0, 1.0, -17, 0.6, 0.05, 0.44, { rx: 0.3 });
    kit.box(kit.paint('#14100e', { rough: 0.6 }), 0, 1.06, -17, 0.4, 0.12, 0.3, { rx: 0.3 });
    for (const x of [-0.12, 0.12]) kit.box('iron', x, 1.06, -16.9, 0.04, 0.13, 0.32, { rx: 0.3 });
    for (const [x, z] of [[-0.7, -16.4], [0.7, -16.4], [0, -17.8]]) {
      chain(kit, [x * 0.25, 1.08, -17 + (z + 17) * 0.25], [x, 0.04, z], { link: 0.06 });
      kit.cyl('iron', x, 0, z, 0.08, 0.08, 0.04, { seg: 8 });
    }
    // Madam Pince behind her desk, the vulture of the place
    const pince = figure('pince', { rt, seed: 4 });
    pince.group.position.set(5.6, 0, 16.2);
    pince.group.rotation.y = Math.PI;
    pince.set({ base: null, speed: 0 });
    group.add(pince.group);
    let warned = false;
    let shrieks = 0;
    let night = Boolean(props.night);
    const house = props.house ?? 'none';
    const page = PAGES[house] ?? PAGES.none;
    return {
      live: [
        {
          step(dt, c = {}) {
            pince.tick(dt);
            // (she says her piece once, as you come near the desk)
            if (!warned && c.at && Math.hypot(c.at[0] - 5.4, c.at[1] - 15.2) < 3.2) {
              warned = true;
              tell('line', { who: 'pince', name: NAMES.pince, text: LINES.pince.breathe });
            }
          },
          set(p = {}) {
            if (p.night != null) night = Boolean(p.night);
          },
          dispose() {
            pince.dispose();
            books.dispose();
            old.dispose();
            windows.dispose();
          },
        },
      ],
      doors: [
        {
          id: 'page',
          at: [2.6, 14.6],
          r: 1.2,
          verb: 'Read',
          name: 'A book left open',
          act: () => tell('line', { who: 'book', name: page.title, text: page.text }),
        },
        // the rope, from either side: by day Pince won’t have it, by night over you go
        ...[1, -1].map((side) => ({
          id: side > 0 ? 'rope' : 'rope-back',
          at: [0, ROPE + side * 0.9],
          r: 1.0,
          verb: side > 0 ? 'Step over' : 'Step back over',
          name: 'The rope',
          act: () => {
            if (side > 0 && !night) return tell('line', { who: 'pince', name: NAMES.pince, text: LINES.pince.rope });
            place([0, ROPE - side * 1.2], side > 0 ? 0 : Math.PI);
            if (side > 0) toast('You step over the rope. The shelves here are older, and some of the books are chained to them.');
          },
        })),
        {
          id: 'chained',
          at: [0, -16.2],
          r: 1.0,
          verb: 'Open',
          name: 'The chained book',
          act: () => {
            shrieks++;
            toast(shrieks === 1 ? 'The book opens an inch and shrieks, a long thin scream that goes up into the rafters.' : 'It shrieks again. Somewhere, a door opens.');
            tell('restricted', { opened: true, night });
          },
        },
      ],
    };
  },
});
