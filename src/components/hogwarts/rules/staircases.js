// The Grand Staircase’s stairs that move (the design’s §4.4). Eight floors
// of landings, two a floor (the west wall’s and the east’s), and a stair
// up from each landing that swings its top between two landings above:
// `{ id, from, to, alt }`, pivoting at `from`. Every so
// often the schedule swings one stair, by a seeded order, but never the
// one you are on, and never one whose swing would leave a landing that no
// way reaches: a landing is always reachable once a stair has settled.
// Three floors have a fixed way across (the Entrance Hall’s, the fourth
// floor’s bridge and the seventh floor’s corridor), so every stair may take
// its turn; the rule still checks each swing, for a castle laid out with fewer.
// Pure.
//
//   LANDINGS: [{ id, floor, side, name, doors: [roomId | 'locked:<words>'] }]
//   STAIRS: [{ id, from, to, alt }]     GALLERIES: [[a, b]] (never move)
//   EVERY, SWING: seconds between swings, seconds a swing takes
//   createStairs({ stairs, galleries, seed, every, swing }) → state
//     state: { ends: { id: 'to' | 'alt' }, t, order, next, swinging: null | { id, t, toward }, ... }
//   endOf(state, id) → the landing a stair’s top is at now (null while it swings)
//   links(state) → [{ a, b, stair }] the ways between landings now (stair null for a gallery)
//   connected(state, landings, { ends }?) → every landing reachable from every other
//   settled(state) → the state as it will stand once the swing under way is done
//   canSwing(state, id, { on, landings }) → it may swing now
//   stepStairs(state, dt, { on, landings }) → the next state; a swing starts
//     on the schedule’s beat and settles SWING seconds later
//   route(state, from, to) → [{ stair, to }] the ways to walk, or null

export const EVERY = 9; // s between swings
export const SWING = 3; // s a stair takes to swing

const NAMES = ['The Entrance Hall', 'The first floor', 'The second floor', 'The third floor', 'The fourth floor', 'The fifth floor', 'The sixth floor', 'The seventh floor'];

// what each landing opens on: a room the registry knows, or a door that says why not
const DOORS = {
  '0w': ['greatHall'],
  '0e': ['potions', 'slytherin', 'hufflepuff', 'kitchens'],
  '1w': ['locked:The hospital wing. Madam Pomfrey is busy. Not today.'],
  '1e': ['locked:The trophy room. Filch has just polished it. Not today.'],
  '2w': ['charms'],
  '2e': ['locked:The Muggle Studies corridor. Not today.'],
  '3w': ['defence'],
  '3e': ['locked:The One-Eyed Witch. Her hump is stuck. Not today.'],
  '4w': ['library'],
  '4e': ['locked:The Transfiguration corridor. Not today.'],
  '5w': ['ravenclaw'],
  '5e': ['locked:The prefects’ bathroom. The password changed this morning. Not today.'],
  '6w': ['owlery'],
  '6e': ['locked:The Divination ladder. Professor Trelawney saw you coming. Not today.'],
  '7w': ['gryffindor'],
  '7e': ['requirement', 'astronomy'],
};

export const LANDINGS = Array.from({ length: 16 }, (_, i) => {
  const floor = Math.floor(i / 2);
  const side = i % 2 ? 'e' : 'w';
  const id = `${floor}${side}`;
  return { id, floor, side, name: `${NAMES[floor]}, ${side === 'w' ? 'west' : 'east'}`, doors: DOORS[id] };
});

// two a floor: up the same wall, or swung across to the other side
export const STAIRS = Array.from({ length: 7 }, (_, f) => [
  { id: `w${f}`, from: `${f}w`, to: `${f + 1}w`, alt: `${f + 1}e` },
  { id: `e${f}`, from: `${f}e`, to: `${f + 1}e`, alt: `${f + 1}w` },
]).flat();

export const GALLERIES = [
  ['0w', '0e'],
  ['4w', '4e'],
  ['7w', '7e'],
];

// a seeded shuffle (mulberry32): the order the stairs take their turns in
function shuffled(ids, seed) {
  let a = seed >>> 0 || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createStairs({ stairs = STAIRS, galleries = GALLERIES, seed = 7, every = EVERY, swing = SWING } = {}) {
  return { stairs, galleries, every, swing, ends: Object.fromEntries(stairs.map((s) => [s.id, 'to'])), t: 0, order: shuffled(stairs.map((s) => s.id), seed), next: 0, swinging: null, swings: 0 };
}

const stairOf = (state, id) => state.stairs.find((s) => s.id === id);

export function endOf(state, id) {
  if (state.swinging?.id === id) return null;
  const s = stairOf(state, id);
  return s ? s[state.ends[id]] : null;
}

export function links(state, { ends = state.ends } = {}) {
  const out = state.galleries.map(([a, b]) => ({ a, b, stair: null }));
  for (const s of state.stairs) {
    if (state.swinging?.id === s.id) continue;
    out.push({ a: s.from, b: s[ends[s.id]], stair: s.id });
  }
  return out;
}

function reach(edges, start) {
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length) {
    const n = todo.pop();
    for (const e of edges) {
      const o = e.a === n ? e.b : e.b === n ? e.a : null;
      if (o && !seen.has(o)) {
        seen.add(o);
        todo.push(o);
      }
    }
  }
  return seen;
}

export function connected(state, landings = LANDINGS, opts = {}) {
  const ids = landings.map((l) => l.id);
  const seen = reach(links(state, opts), ids[0]);
  return ids.every((id) => seen.has(id));
}

export const settled = (state) => (state.swinging ? { ...state, ends: { ...state.ends, [state.swinging.id]: state.swinging.toward }, swinging: null } : state);

// the stair’s top on its other landing, and the castle still whole once it gets there
export function canSwing(state, id, { on = null, landings = LANDINGS } = {}) {
  if (id === on || state.swinging) return false;
  const flipped = { ...state.ends, [id]: state.ends[id] === 'to' ? 'alt' : 'to' };
  return connected(state, landings, { ends: flipped });
}

export function stepStairs(state, dt, { on = null, landings = LANDINGS } = {}) {
  let s = { ...state, t: state.t + dt };
  if (s.swinging) {
    const t = s.swinging.t + dt;
    if (t < s.swing) return { ...s, swinging: { ...s.swinging, t } };
    s = { ...s, ends: { ...s.ends, [s.swinging.id]: s.swinging.toward }, swinging: null, t: t - s.swing, swings: s.swings + 1 };
  }
  if (s.t < s.every) return s;
  // the next stair in the order that may go; the beat passes if none may
  const n = s.order.length;
  for (let k = 0; k < n; k++) {
    const id = s.order[(s.next + k) % n];
    if (!canSwing(s, id, { on, landings })) continue;
    return { ...s, t: 0, next: (s.next + k + 1) % n, swinging: { id, t: 0, toward: s.ends[id] === 'to' ? 'alt' : 'to' } };
  }
  return { ...s, t: 0 };
}

// the ways from one landing to another as the stairs stand now (breadth first: fewest crossings)
export function route(state, from, to) {
  if (from === to) return [];
  const edges = links(state);
  const back = new Map([[from, null]]);
  const todo = [from];
  while (todo.length) {
    const n = todo.shift();
    for (const e of edges) {
      const o = e.a === n ? e.b : e.b === n ? e.a : null;
      if (!o || back.has(o)) continue;
      back.set(o, { prev: n, stair: e.stair });
      if (o === to) {
        const path = [];
        for (let at = to; back.get(at); at = back.get(at).prev) path.unshift({ stair: back.get(at).stair, to: at });
        return path;
      }
      todo.push(o);
    }
  }
  return null;
}
