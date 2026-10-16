// Infiltration: the rules, apart from the drawing, so they can be tested.
//
// Natasha's route through a HYDRA facility, planned on the holotable a turn at
// a time. A level is a grid. Each turn she does one thing (step, wait, take a
// guard down, use her Widow's Bite, hack a terminal) and then the facility
// takes its turn: every guard does the next thing on his schedule (a step, a
// turn on the spot, or nothing), every camera sweeps on, and the lasers keep
// their cycle. If she ends her turn, or the facility ends its turn, where a
// guard or a camera can see her, or on a live laser, she's caught and the
// level starts again. Get the file, then get out.
//
// Coordinates: x across (east), y down the map (south); a tile's centre is at
// its integer coordinates. Angles in degrees, 0 east, 90 south.

export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const ANGLE = { E: 0, S: 90, W: 180, N: 270 };
export const angleOf = (dir) => ANGLE[dir];

// A guard's torch: how far and how wide he sees.
export const VISION = { range: 4.5, half: 36 };
// A camera: further, narrower.
export const CAMERA = { range: 5.5, half: 24 };
// The Widow's Bite: a clear straight line, this many tiles at most; the guard
// it hits is out for this many of the facility's turns.
export const BITE = { range: 2, stun: 4 };

// The map's letters.
//   #  wall          R  server racks      C  crates (all three block sight)
//   =  glass         d  desk              (block the way, not the view)
//   .  floor         S  start   F  the file   E  the exit
//   T  terminal (step into it to hack it: its cameras go dark)
//   G  guard, K  camera (their details in order of reading, left to right,
//      top to bottom)
// Guard schedules, one letter a turn, repeating: N E S W step that way,
// n e s w turn to face that way, `.` stand. Camera sweeps: a list of angles,
// one a turn. Lasers: the tiles from `a` to `b`, on (X) or off (.) by turn.
const OPAQUE = new Set(['#', 'R', 'C']);
const SOLID = new Set(['#', 'R', 'C', '=', 'd', 'T']);

export const LEVELS = [
  {
    name: 'Patrol',
    tip: 'A guard walks the corridor. The red is what his torch can see: end a turn in it and you’re caught. Wait for his back.',
    map: [
      '#########',
      '#RR#..E.#',
      '#.F#....#',
      '##.##.###',
      '#G......#',
      '###.#####',
      '###S#####',
    ],
    guards: [{ dir: 'E', route: 'EEEEEEw.WWWWWWe.' }],
  },
  {
    name: 'Turning guard',
    tip: 'This one holds his post at the desks and looks around on a count. The arrow shows where he looks next: move when it points away.',
    map: [
      '###########',
      '#S..#..F..#',
      '#.........#',
      '#....d..C.#',
      '#.C.dGd...#',
      '#....d....#',
      '#E..#...RR#',
      '###########',
    ],
    guards: [{ dir: 'E', route: 'e.s.w.n.' }],
  },
  {
    name: 'Takedown',
    tip: 'Step into a guard from behind or from the side to take him down. Never from the front.',
    map: [
      '###########',
      '#RR..F..RR#',
      '#G........#',
      '#####G#####',
      '#.........#',
      '#C.......C#',
      '#S.......E#',
      '###########',
    ],
    guards: [
      { dir: 'E', route: 'EEEEEEEEw.WWWWWWWWe.' },
      { dir: 'S', route: 's...n...' },
    ],
  },
  {
    name: 'Lasers',
    tip: 'Laser gates switch on and off on a cycle, and flicker the turn before they fire. Never stop on a live beam.',
    map: [
      '###########',
      '#S.......F#',
      '#.#######.#',
      '#....C....#',
      '##.#####.##',
      '#E...G....#',
      '###########',
    ],
    guards: [{ dir: 'E', route: 'EEEEw.WWWWe.' }],
    lasers: [
      { a: [3, 1], b: [3, 1], cycle: 'XX..' },
      { a: [5, 1], b: [5, 1], cycle: 'XXX..' },
      { a: [7, 1], b: [7, 1], cycle: 'X..' },
      { a: [6, 3], b: [6, 3], cycle: 'XX..' },
    ],
  },
  {
    name: 'Widow’s Bite',
    tip: 'Widow’s Bite: a guard in a straight line, up to two tiles away, is out for three turns, and can be taken down from any side. You have one.',
    charges: 1,
    map: [
      '###########',
      '#RRC##F..E#',
      '########.##',
      '#....G....#',
      '##.########',
      '#S.....CC.#',
      '###########',
    ],
    guards: [{ dir: 'N', route: 'wnes' }],
  },
  {
    name: 'Camera',
    tip: 'A camera sweeps the vault. Step into the terminal to switch it off, or slip through between its sweeps.',
    map: [
      '#############',
      '#T..#K......#',
      '#...#.......#',
      '#...#..RR.F.#',
      '#.......RR..#',
      '#C..#.......#',
      '#S..#G....E.#',
      '#############',
    ],
    guards: [{ dir: 'E', route: 'EEEEw.WWWWe.' }],
    cameras: [{ wall: 'N', sweep: [15, 30, 45, 60, 75, 60, 45, 30] }],
  },
  {
    name: 'Covering fire',
    tip: 'These two watch each other’s backs: take one down and the other sees it happen. Unless he can’t see anything.',
    charges: 1,
    map: [
      '###########',
      '#F.#.....E#',
      '#..#.###..#',
      '#...G..G..#',
      '##.##..##.#',
      '#S........#',
      '###########',
    ],
    guards: [
      { dir: 'E', route: 'eeew' },
      { dir: 'E', route: 'ewee' },
    ],
  },
  {
    name: 'The archive',
    tip: 'Everything at once: a laser door, a patrol, the security office, the vault’s camera, and a guard on the way out. Two bites.',
    charges: 2,
    map: [
      '##############',
      '#T...#....K..#',
      '#....#.......#',
      '#..G.#.RR..F.#',
      '##.######.####',
      '#..G.........#',
      '##.#######G###',
      '#S..C#.....E.#',
      '#....#.......#',
      '##############',
    ],
    guards: [
      { dir: 'N', route: 'n.w.s.e.' },
      { dir: 'E', route: 'EEEEEEw.WWWWWWe.' },
      { dir: 'N', route: 'n.....s.' },
    ],
    cameras: [{ wall: 'N', sweep: [90, 115, 140, 115, 90, 65, 40, 65] }],
    lasers: [{ a: [2, 6], b: [2, 6], cycle: 'XX..' }],
  },
];

// how many levels the game has (fixed when the module loads)
export const LEVEL_COUNT = LEVELS.length;

const key = (x, y) => `${x},${y}`;

// ── a level's fixed parts ──
const parsed = new Map();
export function parseLevel(index) {
  if (parsed.has(index)) return parsed.get(index);
  const L = LEVELS[index];
  const rows = L.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => r.padEnd(w, '#').split(''));
  let start = null;
  let file = null;
  let exit = null;
  const guards = [];
  const cameras = [];
  const terminals = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      if (c === 'S') start = [x, y];
      else if (c === 'F') file = [x, y];
      else if (c === 'E') exit = [x, y];
      else if (c === 'G') {
        const g = L.guards[guards.length];
        guards.push({ id: guards.length, x, y, dir: g.dir, route: (g.route ?? g.dir.toLowerCase()).replace(/\s/g, '') });
      } else if (c === 'K') {
        const k = L.cameras[cameras.length];
        cameras.push({ id: cameras.length, x, y, wall: k.wall, sweep: k.sweep });
      } else if (c === 'T') terminals.push({ id: terminals.length, x, y, cams: null });
      // what's left under a marker is floor
      if ('SFEGK'.includes(c)) grid[y][x] = c === 'F' || c === 'E' ? c : '.';
    }
  terminals.forEach((t, i) => (t.cams = L.terminals?.[i]?.cams ?? cameras.map((c) => c.id)));
  const lasers = (L.lasers ?? []).map((l, id) => {
    const cells = [];
    const [ax, ay] = l.a;
    const [bx, by] = l.b;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 0; i <= n; i++) cells.push([ax + Math.sign(bx - ax) * i, ay + Math.sign(by - ay) * i]);
    return { id, cells, cycle: l.cycle, along: ay === by && n > 0 ? 'x' : ax === bx && n > 0 ? 'y' : null };
  });
  const laserAt = new Map();
  for (const l of lasers) for (const [x, y] of l.cells) laserAt.set(key(x, y), l.id);
  const def = { index, name: L.name, tip: L.tip, w, h, grid, start, file, exit, guards, cameras, terminals, lasers, laserAt, charges: L.charges ?? 0, visionCache: new Map() };
  parsed.set(index, def);
  return def;
}

export const cell = (def, x, y) => (x < 0 || y < 0 || x >= def.w || y >= def.h ? '#' : def.grid[y][x]);
export const opaque = (def, x, y) => OPAQUE.has(cell(def, x, y));
export const solid = (def, x, y) => SOLID.has(cell(def, x, y));

// ── sight ──
const EPS = 1e-3;
// Where along a→b (0..1) the segment enters a box, or Infinity.
function enter(ax, ay, dx, dy, x0, y0, x1, y1) {
  let t0 = 0;
  let t1 = 1;
  for (const [a, d, lo, hi] of [
    [ax, dx, x0, x1],
    [ay, dy, y0, y1],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (a < lo || a > hi) return Infinity;
    } else {
      let ta = (lo - a) / d;
      let tb = (hi - a) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}

// The fraction of the way from a to b at which something opaque stops the
// view (1 when nothing does).
function sightClip(def, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const x0 = Math.floor(Math.min(ax, bx) + 0.5);
  const x1 = Math.floor(Math.max(ax, bx) + 0.5);
  const y0 = Math.floor(Math.min(ay, by) + 0.5);
  const y1 = Math.floor(Math.max(ay, by) + 0.5);
  let best = 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!opaque(def, x, y)) continue;
      const t = enter(ax, ay, dx, dy, x - 0.5 + EPS, y - 0.5 + EPS, x + 0.5 - EPS, y + 0.5 - EPS);
      if (t < best) best = t;
    }
  return best;
}
const lineOfSight = (def, ax, ay, bx, by) => sightClip(def, ax, ay, bx, by) >= 1;

// Whether a viewer at (ox, oy) looking along `angle` sees the tile (x, y).
function inCone(def, ox, oy, angle, x, y, { range, half }) {
  const dx = x - ox;
  const dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (d < 0.5 || d > range) return false;
  const a = (angle * Math.PI) / 180;
  const f = dx * Math.cos(a) + dy * Math.sin(a);
  if (f <= 0) return false;
  const off = Math.acos(Math.min(1, f / d));
  if (off > (half * Math.PI) / 180 + 1e-9) return false;
  return lineOfSight(def, ox, oy, x, y);
}

// Every tile a viewer sees, as a set of "x,y" (the walls never move, so it's
// worked out once for each place and direction).
export function visibleTiles(def, ox, oy, angle, spec = VISION) {
  const k = `${ox},${oy},${angle},${spec.range},${spec.half}`;
  let set = def.visionCache.get(k);
  if (set) return set;
  set = new Set();
  const r = Math.ceil(spec.range);
  for (let y = oy - r; y <= oy + r; y++)
    for (let x = ox - r; x <= ox + r; x++) {
      if (opaque(def, x, y)) continue;
      if (inCone(def, ox, oy, angle, x, y, spec)) set.add(key(x, y));
    }
  def.visionCache.set(k, set);
  return set;
}

// The shape of what a viewer sees, for drawing: the origin, then points
// round the edge of the cone where the walls stop it.
export function visionPolygon(def, ox, oy, angle, spec = VISION, rays = 40) {
  const pts = [[ox, oy]];
  for (let i = 0; i <= rays; i++) {
    const a = ((angle - spec.half + (2 * spec.half * i) / rays) * Math.PI) / 180;
    const bx = ox + Math.cos(a) * spec.range;
    const by = oy + Math.sin(a) * spec.range;
    const k = sightClip(def, ox, oy, bx, by);
    pts.push([ox + (bx - ox) * k, oy + (by - oy) * k]);
  }
  return pts;
}

// ── a level being played ──
export function newLevel(index) {
  const def = parseLevel(index);
  return {
    index,
    def,
    phase: 'play', // play | caught | won
    t: 0, // the facility's turns
    turns: 0, // her turns
    px: def.start[0],
    py: def.start[1],
    face: 'S',
    file: false,
    charges: def.charges,
    takedowns: 0,
    bites: 0,
    guards: def.guards.map((g) => ({ id: g.id, x: g.x, y: g.y, dir: g.dir, step: 0, stun: 0, down: false })),
    cams: def.cameras.map((c) => ({ id: c.id, i: 0, off: false })),
    terminals: def.terminals.map((t) => ({ id: t.id, used: false })),
    caught: null,
  };
}

export const laserOn = (def, id, t) => {
  const c = def.lasers[id].cycle;
  return c[t % c.length] === 'X';
};
export const camAngle = (def, s, id) => {
  const sw = def.cameras[id].sweep;
  return sw[s.cams[id].i % sw.length];
};
export const guardAt = (s, x, y) => s.guards.find((g) => !g.down && g.x === x && g.y === y);
export const bodyAt = (s, x, y) => s.guards.find((g) => g.down && g.x === x && g.y === y);
export const awake = (g) => !g.down && g.stun === 0;

// Who sees her where she stands, at the facility's turn `t`: a guard, a
// camera or a laser, or null.
export function spotted(s, t = s.t) {
  const def = s.def;
  const k = key(s.px, s.py);
  for (const g of s.guards) if (awake(g) && visibleTiles(def, g.x, g.y, ANGLE[g.dir], VISION).has(k)) return { by: 'guard', id: g.id };
  for (const c of def.cameras) if (!s.cams[c.id].off && visibleTiles(def, c.x, c.y, camAngle(def, s, c.id), CAMERA).has(k)) return { by: 'camera', id: c.id };
  const l = def.laserAt.get(k);
  if (l != null && laserOn(def, l, t)) return { by: 'laser', id: l };
  return null;
}

// What a guard will do on the facility's next turn: where he'll stand and
// which way he'll face (for the arrows on the table and for the rules).
export function intent(s, g) {
  const route = s.def.guards[g.id].route;
  if (g.down || g.stun > 0) return { x: g.x, y: g.y, dir: g.dir, cmd: '.' };
  const cmd = route[g.step % route.length];
  if (DIRS[cmd]) {
    const [dx, dy] = DIRS[cmd];
    const nx = g.x + dx;
    const ny = g.y + dy;
    if (solid(s.def, nx, ny)) return { x: g.x, y: g.y, dir: cmd, cmd };
    return { x: nx, y: ny, dir: cmd, cmd };
  }
  if ('nesw'.includes(cmd)) return { x: g.x, y: g.y, dir: cmd.toUpperCase(), cmd };
  return { x: g.x, y: g.y, dir: g.dir, cmd };
}

// The guard a bite that way would hit: the first thing in a clear straight
// line, if it's an awake guard within range.
function biteTarget(s, dir) {
  const [dx, dy] = DIRS[dir];
  for (let i = 1; i <= BITE.range; i++) {
    const x = s.px + dx * i;
    const y = s.py + dy * i;
    if (solid(s.def, x, y)) return null;
    const g = guardAt(s, x, y);
    if (g) return g.stun > 0 ? null : g;
  }
  return null;
}
export const biteTargets = (s) =>
  s.charges > 0
    ? Object.keys(DIRS)
        .map((dir) => ({ dir, guard: biteTarget(s, dir) }))
        .filter((b) => b.guard)
    : [];

function caughtBy(s, ev, who, when) {
  s.phase = 'caught';
  s.caught = { ...who, when };
  ev.push({ type: 'caught', ...who, when, x: s.px, y: s.py });
  return ev;
}

// The facility's turn.
function world(s, ev) {
  const def = s.def;
  const before = def.lasers.map((l) => laserOn(def, l.id, s.t));
  for (const g of s.guards) {
    if (g.down) continue;
    if (g.stun > 0) {
      g.stun--;
      if (g.stun === 0) ev.push({ type: 'wake', id: g.id });
      continue;
    }
    const next = intent(s, g);
    g.step++;
    if (next.x === s.px && next.y === s.py) {
      // he walks straight into her
      g.dir = next.dir;
      return caughtBy(s, ev, { by: 'guard', id: g.id }, 'world');
    }
    if (next.x !== g.x || next.y !== g.y) ev.push({ type: 'step', id: g.id, from: [g.x, g.y], to: [next.x, next.y] });
    else if (next.dir !== g.dir) ev.push({ type: 'turn', id: g.id, from: g.dir, to: next.dir });
    g.x = next.x;
    g.y = next.y;
    g.dir = next.dir;
  }
  for (const c of s.cams) if (!c.off) c.i++;
  s.t++;
  def.lasers.forEach((l, i) => {
    const on = laserOn(def, l.id, s.t);
    if (on !== before[i]) ev.push({ type: 'laser', id: l.id, on });
  });
  return ev;
}

// Natasha's turn: { type: 'move', dir } | { type: 'wait' } | { type: 'bite', dir }.
// Returns what happened; an action that can't be done ('bump') takes no turn.
export function act(s, a) {
  if (s.phase !== 'play') return [];
  const def = s.def;
  const ev = [];
  if (a.type === 'move') {
    const [dx, dy] = DIRS[a.dir];
    const tx = s.px + dx;
    const ty = s.py + dy;
    const g = guardAt(s, tx, ty);
    if (g) {
      if (g.stun === 0 && g.dir === OPP[a.dir]) return [{ type: 'bump', dir: a.dir, why: 'face' }];
      g.down = true;
      g.stun = 0;
      s.takedowns++;
      s.face = a.dir;
      ev.push({ type: 'takedown', id: g.id, dir: a.dir, x: tx, y: ty });
    } else if (cell(def, tx, ty) === 'T') {
      const term = def.terminals.find((t) => t.x === tx && t.y === ty);
      const st = s.terminals[term.id];
      if (st.used) return [{ type: 'bump', dir: a.dir, why: 'used' }];
      st.used = true;
      for (const id of term.cams) s.cams[id].off = true;
      s.face = a.dir;
      ev.push({ type: 'hack', id: term.id, cams: term.cams, x: tx, y: ty });
    } else if (solid(def, tx, ty)) {
      return [{ type: 'bump', dir: a.dir, why: 'wall' }];
    } else {
      ev.push({ type: 'move', from: [s.px, s.py], to: [tx, ty], dir: a.dir });
      s.px = tx;
      s.py = ty;
      s.face = a.dir;
      if (!s.file && tx === def.file[0] && ty === def.file[1]) {
        s.file = true;
        ev.push({ type: 'file', x: tx, y: ty });
      }
      if (s.file && tx === def.exit[0] && ty === def.exit[1]) {
        s.turns++;
        s.phase = 'won';
        ev.push({ type: 'won', index: s.index, turns: s.turns });
        if (s.index === LEVEL_COUNT - 1) ev.push({ type: 'reward', stone: 'soul-natasha' });
        return ev;
      }
      if (!s.file && tx === def.exit[0] && ty === def.exit[1]) ev.push({ type: 'locked' });
    }
  } else if (a.type === 'bite') {
    const g = s.charges > 0 ? biteTarget(s, a.dir) : null;
    if (!g) return [{ type: 'bump', dir: a.dir, why: s.charges > 0 ? 'bite' : 'charges' }];
    g.stun = BITE.stun;
    s.charges--;
    s.bites++;
    s.face = a.dir;
    ev.push({ type: 'bite', id: g.id, dir: a.dir, from: [s.px, s.py], to: [g.x, g.y] });
  } else if (a.type === 'wait') {
    ev.push({ type: 'wait' });
  } else return [];
  s.turns++;
  // her turn ends: is she seen?
  const seen = spotted(s, s.t);
  if (seen) return caughtBy(s, ev, seen, 'move');
  // the facility's turn ends: is she seen now?
  world(s, ev);
  if (s.phase === 'caught') return ev;
  const after = spotted(s, s.t);
  if (after) return caughtBy(s, ev, after, 'world');
  return ev;
}

// The shortest way across the floor to a tile, ignoring who'd see her (for the
// route drawn under the pointer): a list of [x, y] after her own tile, or null.
export function pathTo(s, tx, ty, limit = 40) {
  const def = s.def;
  if (tx === s.px && ty === s.py) return [];
  const goal = key(tx, ty);
  const prev = new Map([[key(s.px, s.py), null]]);
  let frontier = [[s.px, s.py]];
  for (let n = 0; n < limit && frontier.length; n++) {
    const next = [];
    for (const [x, y] of frontier)
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx;
        const ny = y + dy;
        const k = key(nx, ny);
        if (prev.has(k)) continue;
        const target = k === goal;
        // through floor only; the goal itself may be a guard or a terminal
        if (!target && (solid(def, nx, ny) || guardAt(s, nx, ny))) continue;
        if (target && solid(def, nx, ny) && cell(def, nx, ny) !== 'T') continue;
        prev.set(k, [x, y]);
        if (target) {
          const path = [[nx, ny]];
          let p = [x, y];
          while (p && key(p[0], p[1]) !== key(s.px, s.py)) {
            path.unshift(p);
            p = prev.get(key(p[0], p[1]));
          }
          return path;
        }
        next.push([nx, ny]);
      }
    frontier = next;
  }
  return null;
}

// ── solving (for the tests, and for checking levels while making them) ──
export const cloneState = (s) => ({
  ...s,
  guards: s.guards.map((g) => ({ ...g })),
  cams: s.cams.map((c) => ({ ...c })),
  terminals: s.terminals.map((t) => ({ ...t })),
});
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function stateKey(s, period) {
  let k = `${s.px},${s.py},${s.file ? 1 : 0},${s.charges},${s.t % period}`;
  for (const g of s.guards) k += g.down ? '|d' : `|${g.step % s.def.guards[g.id].route.length},${g.stun}`;
  for (const c of s.cams) k += c.off ? '|o' : `|${c.i % s.def.cameras[c.id].sweep.length}`;
  return k;
}
export const ACTIONS = [...Object.keys(DIRS).map((dir) => ({ type: 'move', dir })), { type: 'wait' }, ...Object.keys(DIRS).map((dir) => ({ type: 'bite', dir }))];

// Breadth-first over every state the level can be in: the fewest turns to
// win, and the actions that do it, or null. `allow` can rule out takedowns
// or bites, to check that a level needs them.
export function solveLevel(index, { allow = {}, maxStates = 400000, stats = {} } = {}) {
  const def = parseLevel(index);
  const period = def.lasers.reduce((p, l) => (p * l.cycle.length) / gcd(p, l.cycle.length), 1);
  const start = newLevel(index);
  const seen = new Set([stateKey(start, period)]);
  let frontier = [{ s: start, path: [] }];
  while (frontier.length && seen.size < maxStates) {
    const next = [];
    for (const { s, path } of frontier)
      for (const a of ACTIONS) {
        if (a.type === 'bite' && (allow.bite === false || s.charges === 0)) continue;
        if (a.type === 'move' && (allow.takedown === false || allow.hack === false)) {
          const [dx, dy] = DIRS[a.dir];
          if (allow.takedown === false && guardAt(s, s.px + dx, s.py + dy)) continue;
          if (allow.hack === false && cell(def, s.px + dx, s.py + dy) === 'T') continue;
        }
        const n = cloneState(s);
        const ev = act(n, a);
        if (!ev.length || ev[0].type === 'bump') continue;
        if (n.phase === 'won') return { turns: path.length + 1, actions: [...path, a] };
        if (n.phase !== 'play') continue;
        const k = stateKey(n, period);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: n, path: [...path, a] });
      }
    frontier = next;
  }
  stats.states = seen.size;
  stats.capped = seen.size >= maxStates;
  return null;
}
