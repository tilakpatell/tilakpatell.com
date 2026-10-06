// Dead man's tide: the rules. A sea with islands in it, the Black Pearl (you
// are Jack Sparrow), the navy, a fort, the Flying Dutchman and the kraken, stepped in seconds with nothing drawn
// here (./Tide3D.js draws it, ./DeadMansTide.jsx is the screen and the keys).
//
// The sea is flat in here: x runs east and y south, a heading is an angle from
// east turning to starboard, and a ship's guns point square off her sides. You
// set the sails (furled, half, full), put the helm over and fire a broadside
// from either side; a side fires where it's pointed, eased toward whatever is
// in its arc. Five chapters, with a pick of three refits after each.
//
// Everything random comes from the game's own seeded generator, so a seed
// plays the same way twice.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrap = (a) => {
  const w = (a + Math.PI) % TAU;
  return (w < 0 ? w + TAU : w) - Math.PI;
};

export const TIDE = {
  R: 560, // the sea is a disc this far from its middle; past it, fog
  range: 150, // how far a ball carries
  ball: 118, // and how fast
  arc: 0.5, // a broadside reaches this far (radians) either way off the beam
  sails: [0, 0.55, 1], // furled, half, full
  pickup: 9,
  levels: {
    easy: { name: 'Deckhand', hull: 1.4, hurt: 0.65, foe: 0.8, aim: 0.2, score: 0.8 },
    normal: { name: 'Captain', hull: 1, hurt: 1, foe: 1, aim: 0.15, score: 1 },
    hard: { name: 'Pirate lord', hull: 0.9, hurt: 1.25, foe: 1.2, aim: 0.1, score: 1.5 },
  },
};

// len and beam in the sea's units; speed under full sail with the wind
// behind; turn in radians a second; guns a side; reload in seconds
export const SHIPS = {
  pearl: { len: 44, beam: 11, speed: 27, turn: 0.66, hp: 100, guns: 5, reload: 2.6, dmg: 7 },
  sloop: { len: 31, beam: 8, speed: 23, turn: 0.6, hp: 75, guns: 3, reload: 6, dmg: 3, gold: 150 },
  navy: { len: 46, beam: 12, speed: 19, turn: 0.42, hp: 150, guns: 6, reload: 7, dmg: 3, gold: 350 },
  ghost: { len: 52, beam: 14, speed: 22, turn: 0.5, hp: 440, guns: 6, reload: 7, dmg: 4, gold: 1500 },
};

// The islands: where each is, how far its shore reaches, which way it faces.
export const ISLES = [
  { kind: 'port', x: -330, y: 255, r: 56, a: 2.2 },
  { kind: 'skull', x: 305, y: -275, r: 58, a: 2.4 },
  { kind: 'fort', x: 335, y: 240, r: 44, a: -2.3 },
  { kind: 'palms', x: -165, y: -335, r: 27, a: 0.3 },
  { kind: 'palms', x: 55, y: 345, r: 24, a: 1.9 },
  { kind: 'palms', x: -405, y: -70, r: 29, a: 3.6 },
  { kind: 'palms', x: 440, y: -25, r: 23, a: 5.1 },
  { kind: 'palms', x: -215, y: 30, r: 21, a: 4.2 },
  { kind: 'palms', x: 95, y: -205, r: 25, a: 2.7 },
  { kind: 'palms', x: 175, y: 120, r: 20, a: 0.9 },
];
const FORT = ISLES.find((i) => i.kind === 'fort');

export const CHAPTERS = [
  { id: 'patrol', name: 'A sail on the horizon', goal: 'Sink the navy patrol' },
  { id: 'gold', name: 'Dead men’s gold', goal: 'Take the four chests' },
  { id: 'fort', name: 'The fort', goal: 'Silence the fort’s mortars' },
  { id: 'cursed', name: 'The Flying Dutchman', goal: 'Send her back to the deep' },
  { id: 'kraken', name: 'The kraken', goal: 'Kill the beast' },
];

// The refits offered after a chapter: three of these, one to keep.
export const UPS = {
  guns: { name: 'More guns', note: 'One more gun a side', max: 3 },
  reload: { name: 'Powder monkeys', note: 'Reload a fifth faster', max: 3 },
  shot: { name: 'Heavy shot', note: 'Each ball hits a quarter harder', max: 3 },
  range: { name: 'Long nines', note: 'A fifth more range', max: 2 },
  hull: { name: 'Ironwood hull', note: '30 more hull, and a full repair', max: 3 },
  sails: { name: 'Black sails', note: 'Faster, and quicker on the helm', max: 3 },
  carpenter: { name: 'Ship’s carpenter', note: 'Mends the hull when the guns go quiet', max: 1 },
  prow: { name: 'Iron prow', note: 'Ramming hurts them and not you', max: 1 },
};

// mulberry32
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// What the refits have made of your ship.
export function fitted(g) {
  const u = g.ups;
  const s = SHIPS.pearl;
  return {
    guns: s.guns + (u.guns ?? 0),
    reload: s.reload * 0.8 ** (u.reload ?? 0),
    dmg: s.dmg * (1 + 0.25 * (u.shot ?? 0)),
    range: TIDE.range * (1 + 0.2 * (u.range ?? 0)),
    speed: s.speed * (1 + 0.12 * (u.sails ?? 0)),
    turn: s.turn * (1 + 0.12 * (u.sails ?? 0)),
    max: Math.round((s.hp + 30 * (u.hull ?? 0)) * g.L.hull),
  };
}

function makeShip(g, kind, x, y, a, more = {}) {
  const k = SHIPS[kind];
  const foe = kind === 'pearl' ? 1 : g.L.foe;
  const hp = Math.round(k.hp * (kind === 'pearl' ? g.L.hull : foe));
  return {
    id: g.id++,
    kind,
    x,
    y,
    a,
    v: 0,
    rudder: 0,
    sail: 1,
    hp,
    max: hp,
    len: k.len,
    beam: k.beam,
    r: k.len * 0.4,
    speed: k.speed,
    turn: k.turn,
    guns: k.guns,
    dmg: k.dmg,
    reloadTime: k.reload / (kind === 'pearl' ? 1 : Math.sqrt(foe)),
    reload: [1.2, 1.2], // port, starboard: seconds until loaded
    hit: 0, // just struck: counts down, for the flash
    sunk: 0, // going down: counts up
    under: 0, // the cursed ship beneath the water: 0 up … 1 gone
    side: g.rand() < 0.5 ? -1 : 1, // which side it likes to fight from
    flip: 9 + g.rand() * 8,
    aim: null, // { side, t }: about to fire
    ram: 0,
    ...more,
  };
}

export function newGame({ seed = 1, level = 'normal' } = {}) {
  const L = TIDE.levels[level] ?? TIDE.levels.normal;
  const g = {
    seed,
    rand: seeded(seed),
    level: TIDE.levels[level] ? level : 'normal',
    L,
    id: 1,
    t: 0,
    status: 'sail', // sail | pick | won | lost
    over: null, // { won, t }: the last seconds, before the status changes
    chapter: 0,
    chapT: 0,
    ships: [],
    reserve: [], // sails still to come over the horizon this chapter
    volleys: [],
    balls: [],
    zones: [],
    arms: [],
    pickups: [],
    fort: null,
    kraken: null,
    boss: null, // { name, hp, max } for the bar
    wind: { a: 0.9 },
    gold: 0,
    combo: 0,
    comboT: 0,
    quiet: 0, // seconds since anyone hit you
    edge: 0,
    ups: {},
    offer: [],
    events: [],
    stats: { shots: 0, hits: 0, sunk: 0, taken: 0, chests: 0, time: 0 },
    input: { steer: 0, sail: 2, port: false, star: false },
    result: null,
  };
  g.p = makeShip(g, 'pearl', -215, 160, -0.35);
  g.p.reload = [0, 0];
  begin(g, 0);
  return g;
}

const say = (g, text, tone = 'stage') => g.events.push({ type: 'callout', text, tone });

// a place `d` off the player at bearing `b`, kept on the sea and off the islands
function place(g, d, b) {
  for (let i = 0; i < 14; i++) {
    const a = b + (i ? (g.rand() - 0.5) * 0.5 * i : 0);
    let x = g.p.x + Math.cos(a) * d;
    let y = g.p.y + Math.sin(a) * d;
    const m = Math.hypot(x, y);
    if (m > TIDE.R - 60) {
      x *= (TIDE.R - 60) / m;
      y *= (TIDE.R - 60) / m;
    }
    if (ISLES.every((s) => Math.hypot(x - s.x, y - s.y) > s.r + 45) && Math.hypot(x - g.p.x, y - g.p.y) > 90) return { x, y };
  }
  return { x: g.p.x * 0.3, y: g.p.y * 0.3 };
}

function spawn(g, kind, d, b, more) {
  const at = place(g, d, b);
  const s = makeShip(g, kind, at.x, at.y, Math.atan2(g.p.y - at.y, g.p.x - at.x), more);
  s.v = s.speed * 0.6;
  g.ships.push(s);
  return s;
}

function begin(g, i) {
  g.chapter = i;
  g.chapT = 0;
  const c = CHAPTERS[i];
  const hard = g.level === 'hard';
  const ahead = g.p.a;
  g.events.push({ type: 'chapter', i, name: c.name, goal: c.goal });
  if (c.id === 'patrol') {
    spawn(g, 'sloop', 250, ahead - 0.5);
    spawn(g, 'sloop', 290, ahead + 0.6);
    // and more come out of the fog as these go down
    g.reserve = [g.level === 'easy' ? 'sloop' : 'navy'];
  } else if (c.id === 'gold') {
    const sites = [
      [240, -175],
      [-110, -265],
      [-330, -5],
      [110, 285],
    ];
    for (const [x, y] of sites) g.pickups.push({ id: g.id++, kind: 'chest', quest: true, x, y, gold: 300, t: 0 });
    spawn(g, 'navy', 300, ahead + 0.3);
    spawn(g, 'sloop', 280, ahead - 1.2);
    if (hard) spawn(g, 'sloop', 320, ahead + 2.4);
  } else if (c.id === 'fort') {
    const hp = Math.round(240 * g.L.foe);
    g.fort = { x: FORT.x, y: FORT.y, r: FORT.r - 6, hp, max: hp, cool: 3, hit: 0 };
    g.boss = { name: 'The fort', hp, max: hp };
    spawn(g, 'sloop', 260, Math.atan2(FORT.y - g.p.y, FORT.x - g.p.x) + 0.5);
    spawn(g, hard ? 'navy' : 'sloop', 300, Math.atan2(FORT.y - g.p.y, FORT.x - g.p.x) - 0.5);
  } else if (c.id === 'cursed') {
    const s = spawn(g, 'ghost', 230, ahead + 0.4, { dive: 11, state: 'up' });
    g.boss = { name: 'The Flying Dutchman', hp: s.hp, max: s.max, ship: s.id };
  } else if (c.id === 'kraken') {
    const hp = Math.round(300 * g.L.foe);
    g.kraken = { x: 0, y: 0, a: 0, hp, max: hp, phase: 'arms', t: 2.5, volleys: 0, up: 0, spit: 0, hit: 0 };
    g.boss = { name: 'The kraken', hp, max: hp };
  }
}

// After a chapter: three refits to choose from (ones that still have room).
function offer(g) {
  const pool = Object.keys(UPS).filter((id) => (g.ups[id] ?? 0) < UPS[id].max);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(g.rand() * pool.length), 1)[0]);
  return out;
}

function chapterDone(g) {
  // what's left of the navy strikes its colours and runs
  for (const s of g.ships) if (!s.sunk) s.flee = true;
  g.zones.length = 0;
  g.events.push({ type: 'cleared', i: g.chapter });
  if (g.chapter === CHAPTERS.length - 1) {
    g.over = { won: true, t: 4 };
    return;
  }
  g.offer = offer(g);
  if (g.offer.length) g.status = 'pick';
  else next(g);
}

function next(g) {
  g.offer = [];
  g.status = 'sail';
  g.boss = null;
  const f = fitted(g);
  g.p.max = f.max;
  g.p.hp = Math.min(f.max, g.p.hp + Math.round(f.max * 0.5));
  begin(g, g.chapter + 1);
}

export function choose(g, id) {
  if (g.status !== 'pick' || !g.offer.includes(id)) return false;
  g.ups[id] = (g.ups[id] ?? 0) + 1;
  if (id === 'hull') g.p.hp = fitted(g).max;
  g.events.push({ type: 'refit', id });
  next(g);
  return true;
}

// ── sailing ──

function sail(g, s, steer, canvas, dt, speed = s.speed, turn = s.turn) {
  s.rudder += (clamp(steer, -1, 1) - s.rudder) * (1 - Math.exp(-dt * 5));
  // running before the wind is quickest, beating into it slowest
  const wind = 0.8 + 0.2 * Math.cos(s.a - g.wind.a);
  const top = speed * canvas * wind;
  s.v += (top - s.v) * (1 - Math.exp(-dt * (top > s.v ? 0.5 : 0.75)));
  // a ship with no way on barely answers her helm
  const helm = turn * (0.3 + 0.7 * Math.min(1, s.v / Math.max(1, speed * 0.45)));
  s.a = wrap(s.a + s.rudder * helm * dt);
  s.v *= 1 - Math.abs(s.rudder) * 0.1 * dt;
  s.x += Math.cos(s.a) * s.v * dt;
  s.y += Math.sin(s.a) * s.v * dt;
}

// the way a side's guns point: -1 port, 1 starboard
const beam = (s, side) => s.a + (side * Math.PI) / 2;

// Everything your guns can hit, as circles with a speed (for leading it).
export function marks(g) {
  const out = [];
  for (const s of g.ships) if (!s.sunk && s.under < 0.5 && !s.gone) out.push({ x: s.x, y: s.y, r: s.r, vx: Math.cos(s.a) * s.v, vy: Math.sin(s.a) * s.v, ship: s });
  if (g.fort && g.fort.hp > 0) out.push({ x: g.fort.x, y: g.fort.y, r: g.fort.r, vx: 0, vy: 0, fort: g.fort });
  for (const a of g.arms) if (a.hp > 0 && a.st !== 'warn' && a.st !== 'sink') out.push({ x: a.x, y: a.y, r: a.r, vx: 0, vy: 0, arm: a });
  const k = g.kraken;
  if (k && k.phase === 'head' && k.up > 0.6) out.push({ x: k.x, y: k.y, r: 20, vx: 0, vy: 0, kraken: k });
  return out;
}

// What a side would fire at: the mark nearest the middle of its arc, in
// range. Returns { m, d, off } or null.
function sight(from, side, range, list) {
  let best = null;
  for (const m of list) {
    const dx = m.x - from.x;
    const dy = m.y - from.y;
    const d = Math.hypot(dx, dy) - m.r * 0.5;
    if (d > range) continue;
    const off = wrap(Math.atan2(dy, dx) - beam(from, side));
    const reach = TIDE.arc + Math.atan2(m.r, Math.max(1, d)) * 0.6;
    if (Math.abs(off) > reach) continue;
    const score = Math.abs(off) + d / range;
    if (!best || score < best.score) best = { m, d: Math.max(8, d), off, score };
  }
  return best;
}

// For the screen: which of your sides has something in its arc.
export function bearing(g) {
  const list = marks(g);
  const range = fitted(g).range;
  return { port: sight(g.p, -1, range, list), star: sight(g.p, 1, range, list) };
}

// A broadside: the guns go off one after another down the side, each from
// where the ship is by then.
function broadside(g, s, side, { owner, guns, dmg, range, at = null, err = 0, hot = false }) {
  let dir = beam(s, side);
  let dist = range;
  if (at) {
    // lead it: where it'll be when the ball gets there
    const t = at.d / TIDE.ball;
    const off = wrap(Math.atan2(at.m.y + at.m.vy * t - s.y, at.m.x + at.m.vx * t - s.x) - dir);
    dir += clamp(off, -TIDE.arc, TIDE.arc) + err;
    dist = Math.min(range, at.d + 26);
  }
  g.volleys.push({ ship: s, side, i: 0, n: guns, t: 0, dir, dist, owner, dmg, hot });
  s.reload[side < 0 ? 0 : 1] = s.kind === 'pearl' ? fitted(g).reload : s.reloadTime;
}

export function fire(g, side) {
  const p = g.p;
  if (g.status !== 'sail' || g.over || p.reload[side < 0 ? 0 : 1] > 0) return false;
  const f = fitted(g);
  broadside(g, p, side, { owner: 'p', guns: f.guns, dmg: f.dmg, range: f.range, at: sight(p, side, f.range, marks(g)) });
  g.stats.shots += f.guns;
  g.events.push({ type: 'broadside', side, owner: 'p' });
  return true;
}

function volleys(g, dt) {
  for (let i = g.volleys.length - 1; i >= 0; i--) {
    const v = g.volleys[i];
    const s = v.ship;
    v.t -= dt;
    while (v.t <= 0 && v.i < v.n && !s.sunk) {
      const along = v.n > 1 ? (v.i / (v.n - 1) - 0.5) * s.len * 0.62 : 0;
      const fx = Math.cos(s.a);
      const fy = Math.sin(s.a);
      const nx = -fy * v.side;
      const ny = fx * v.side;
      const x = s.x + fx * along + nx * s.beam * 0.5;
      const y = s.y + fy * along + ny * s.beam * 0.5;
      const dir = v.dir + (g.rand() - 0.5) * (v.owner === 'p' ? 0.07 : 0.15);
      const speed = TIDE.ball * (0.96 + g.rand() * 0.08);
      // the navy's gunners are no match for yours: a good half of theirs fall short
      const life = (v.owner === 'p' ? v.dist + (g.rand() - 0.5) * 12 : v.dist * (0.55 + g.rand() * 0.5)) / speed;
      g.balls.push({ id: g.id++, x, y, vx: Math.cos(dir) * speed + fx * s.v * 0.5, vy: Math.sin(dir) * speed + fy * s.v * 0.5, t: 0, life, owner: v.owner, dmg: v.dmg, hot: v.hot });
      g.events.push({ type: 'gun', x, y, dir, owner: v.owner, hot: v.hot });
      v.i += 1;
      v.t += 0.05 + g.rand() * 0.035;
    }
    if (v.i >= v.n || s.sunk) g.volleys.splice(i, 1);
  }
}

// inside a hull: an ellipse a little bigger than the ship
function inHull(s, x, y, pad = 2) {
  const dx = x - s.x;
  const dy = y - s.y;
  const c = Math.cos(s.a);
  const n = Math.sin(s.a);
  const lx = (dx * c + dy * n) / (s.len / 2 + pad);
  const ly = (-dx * n + dy * c) / (s.beam / 2 + pad);
  return lx * lx + ly * ly < 1;
}

function gain(g, gold) {
  const mult = 1 + Math.min(4, Math.floor(g.combo / 5)) * 0.25;
  g.gold += Math.round(gold * g.L.score * mult);
}

function hurtPlayer(g, dmg, x, y, by) {
  const p = g.p;
  if (g.over || p.sunk) return;
  const d = dmg * g.L.hurt;
  p.hp -= d;
  p.hit = 0.35;
  g.quiet = 0;
  g.combo = 0;
  g.stats.taken += d;
  g.events.push({ type: 'hurt', x, y, dmg: d, by });
  if (p.hp <= 0) {
    p.hp = 0;
    p.sunk = 0.001;
    g.over = { won: false, t: 3.6 };
    g.events.push({ type: 'sunk', kind: 'pearl', x: p.x, y: p.y, id: p.id });
  }
}

function sink(g, s) {
  s.sunk = 0.001;
  s.aim = null;
  g.stats.sunk += 1;
  gain(g, SHIPS[s.kind].gold ?? 0);
  g.events.push({ type: 'sunk', kind: s.kind, x: s.x, y: s.y, id: s.id });
  if (g.reserve?.length && !g.over) {
    spawn(g, g.reserve.shift(), 300, g.p.a + (g.rand() - 0.5) * 2.4);
    g.events.push({ type: 'sail' });
  }
  // what floats up: a chest, and from the big ones a cask of rum
  g.pickups.push({ id: g.id++, kind: 'chest', x: s.x + (g.rand() - 0.5) * 14, y: s.y + (g.rand() - 0.5) * 14, gold: 60, t: 0 });
  if (s.kind !== 'sloop' || g.rand() < 0.4) g.pickups.push({ id: g.id++, kind: 'rum', x: s.x + (g.rand() - 0.5) * 22, y: s.y + (g.rand() - 0.5) * 22, t: 0 });
}

function strike(g, m, b) {
  g.stats.hits += 1;
  g.combo += 1;
  g.comboT = 4;
  gain(g, 10);
  g.events.push({ type: 'hit', x: b.x, y: b.y, dmg: b.dmg, on: m.ship ? 'ship' : m.fort ? 'stone' : 'flesh', id: m.ship?.id });
  if (m.ship) {
    const s = m.ship;
    s.hp -= b.dmg;
    s.hit = 0.3;
    if (s.hp <= 0) sink(g, s);
  } else if (m.fort) {
    m.fort.hp -= b.dmg;
    m.fort.hit = 0.3;
    if (m.fort.hp <= 0) {
      m.fort.hp = 0;
      gain(g, 800);
      g.events.push({ type: 'sunk', kind: 'fort', x: m.fort.x, y: m.fort.y });
    }
  } else if (m.arm) {
    m.arm.hp -= b.dmg;
    m.arm.hit = 0.3;
    if (m.arm.hp <= 0) {
      m.arm.st = 'sink';
      m.arm.t = 0.9;
      gain(g, 80);
      if (g.kraken) woundKraken(g, 26);
      if (g.rand() < 0.4) g.pickups.push({ id: g.id++, kind: 'rum', x: m.arm.x, y: m.arm.y, t: 0 });
      g.events.push({ type: 'severed', x: m.arm.x, y: m.arm.y });
    }
  } else if (m.kraken) {
    m.kraken.hit = 0.3;
    woundKraken(g, b.dmg);
  }
}

function woundKraken(g, dmg) {
  const k = g.kraken;
  if (!k || k.phase === 'dead') return;
  k.hp -= dmg;
  if (k.hp <= 0) {
    k.hp = 0;
    k.phase = 'dead';
    k.t = 0;
    for (const a of g.arms) {
      a.st = 'sink';
      a.t = 0.9;
    }
    g.zones.length = 0;
    gain(g, 3000);
    g.events.push({ type: 'sunk', kind: 'kraken', x: k.x, y: k.y });
  }
}

function balls(g, dt) {
  const list = marks(g);
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const b = g.balls[i];
    b.t += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let gone = false;
    if (b.owner === 'p') {
      for (const m of list) {
        const hit = m.ship ? inHull(m.ship, b.x, b.y) : Math.hypot(b.x - m.x, b.y - m.y) < m.r + 2;
        if (!hit) continue;
        strike(g, m, b);
        gone = true;
        break;
      }
    } else if (!g.p.sunk && inHull(g.p, b.x, b.y, 1)) {
      hurtPlayer(g, b.dmg, b.x, b.y, b.ink ? 'ink' : 'ball');
      gone = true;
    }
    if (!gone)
      for (const s of ISLES) {
        if (s.kind === 'fort' && g.fort && g.fort.hp > 0) continue; // the fort is a mark, above
        if (Math.hypot(b.x - s.x, b.y - s.y) < s.r * 0.8) {
          g.events.push({ type: 'thud', x: b.x, y: b.y });
          gone = true;
          break;
        }
      }
    if (!gone && b.t >= b.life) {
      g.events.push({ type: 'splash', x: b.x, y: b.y, big: Boolean(b.ink) });
      gone = true;
    }
    if (gone) g.balls.splice(i, 1);
  }
}

// ── the navy ──

// Where a ship wants to head, bent away from islands, the fog and (a
// little) other ships.
export function course(g, s, want) {
  let vx = Math.cos(want);
  let vy = Math.sin(want);
  for (const isle of ISLES) {
    const dx = s.x - isle.x;
    const dy = s.y - isle.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = clamp(1 - (d - isle.r - s.r * 0.5) / 85, 0, 1);
    if (w > 0) {
      // push round it, not just back: mostly along the shore, the way already going
      const tx = -dy / d;
      const ty = dx / d;
      const way = tx * Math.cos(s.a) + ty * Math.sin(s.a) >= 0 ? 1 : -1;
      vx += ((dx / d) * 1.2 + tx * way * 1.6) * w * 2;
      vy += ((dy / d) * 1.2 + ty * way * 1.6) * w * 2;
    }
  }
  const m = Math.hypot(s.x, s.y);
  if (!s.flee && m > TIDE.R - 110) {
    const w = clamp((m - (TIDE.R - 110)) / 80, 0, 1.5);
    vx -= (s.x / m) * w * 2.5;
    vy -= (s.y / m) * w * 2.5;
  }
  for (const o of g.ships) {
    if (o === s || o.sunk || o.under > 0.5) continue;
    const dx = s.x - o.x;
    const dy = s.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = clamp(1 - (d - 30) / 50, 0, 1);
    vx += (dx / d) * w * 1.5;
    vy += (dy / d) * w * 1.5;
  }
  return Math.atan2(vy, vx);
}

function navy(g, s, dt) {
  const p = g.p;
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  const d = Math.hypot(dx, dy);
  const to = Math.atan2(dy, dx);
  s.flip -= dt;
  if (s.flip <= 0) {
    s.side = -s.side;
    s.flip = 10 + g.rand() * 10;
  }
  let want;
  let canvas = 1;
  if (s.flee) want = Math.atan2(s.y, s.x);
  else if (d > TIDE.range * 0.8) want = to + s.side * 0.3; // close, a little off the bow
  else {
    // run alongside, with the player on the side the guns are; open out if too near
    want = to + s.side * (Math.PI / 2 + (d < 62 ? 0.45 : -0.12));
    if (d < 90) canvas = 0.7;
  }
  sail(g, s, clamp(wrap(course(g, s, want) - s.a) * 2.2, -1, 1), canvas, dt);
  if (s.flee) {
    if (Math.hypot(s.x, s.y) > TIDE.R + 60) s.gone = true;
    return;
  }
  if (g.over || p.sunk) return;
  // the guns: whichever side the player is on, once it's loaded and bears
  if (s.aim) {
    s.aim.t -= dt;
    if (s.aim.t <= 0) {
      const at = sight(s, s.aim.side, TIDE.range, [{ x: p.x, y: p.y, r: p.r, vx: Math.cos(p.a) * p.v, vy: Math.sin(p.a) * p.v }]);
      if (at) {
        broadside(g, s, s.aim.side, { owner: 'e', guns: s.guns, dmg: s.dmg, range: TIDE.range, at, err: (g.rand() - 0.5) * 2 * g.L.aim, hot: s.kind === 'ghost' });
        g.events.push({ type: 'broadside', side: s.aim.side, owner: 'e', x: s.x, y: s.y });
      } else s.reload[s.aim.side < 0 ? 0 : 1] = 0.8; // lost the bearing: hold fire a moment
      s.aim = null;
    }
    return;
  }
  for (const side of [-1, 1]) {
    if (s.reload[side < 0 ? 0 : 1] > 0) continue;
    const at = sight(s, side, TIDE.range * 0.95, [{ x: p.x, y: p.y, r: p.r, vx: 0, vy: 0 }]);
    if (!at) continue;
    s.aim = { side, t: 1 };
    g.events.push({ type: 'aim', id: s.id, side, x: s.x, y: s.y });
    break;
  }
}

// The cursed ship fights like the navy, and every so often goes under and
// comes up again alongside you.
function cursed(g, s, dt) {
  const p = g.p;
  if (s.state === 'up') {
    navy(g, s, dt);
    s.dive -= dt;
    if (s.dive <= 0 && !s.aim && !g.over) {
      s.state = 'down';
      s.t = 0;
      g.events.push({ type: 'dive', x: s.x, y: s.y });
    }
    return;
  }
  s.t += dt;
  if (s.state === 'down') {
    s.under = Math.min(1, s.t / 1.5);
    s.v *= 1 - dt * 1.5;
    if (s.t >= 2.4) {
      // come up abeam of where you'll be, heading your way
      const side = g.rand() < 0.5 ? -1 : 1;
      const lead = 2.2;
      let x = p.x + Math.cos(p.a) * p.v * lead - Math.sin(p.a) * side * 82;
      let y = p.y + Math.sin(p.a) * p.v * lead + Math.cos(p.a) * side * 82;
      const clear = ISLES.every((i) => Math.hypot(x - i.x, y - i.y) > i.r + 40) && Math.hypot(x, y) < TIDE.R - 40;
      if (!clear) ({ x, y } = place(g, 95, p.a + Math.PI));
      s.x = x;
      s.y = y;
      s.a = p.a;
      s.side = -side; // the player is on the far side from the way it came up
      s.state = 'rise';
      s.t = 0;
      g.zones.push({ id: g.id++, kind: 'bubble', x, y, r: 30, t: 1.9, t0: 1.9 });
      g.events.push({ type: 'surface', x, y });
    }
  } else if (s.state === 'rise') {
    s.under = clamp(1 - (s.t - 1.1) / 0.8, 0, 1);
    if (s.t >= 1.9) {
      s.state = 'up';
      s.under = 0;
      s.v = s.speed * 0.5;
      s.reload = [1.1, 1.1];
      s.dive = (s.hp < s.max / 2 ? 9 : 14) + g.rand() * 3;
      g.events.push({ type: 'risen', x: s.x, y: s.y });
    }
  }
}

// ── the fort ──

function fort(g, dt) {
  const f = g.fort;
  const p = g.p;
  f.hit = Math.max(0, f.hit - dt);
  if (f.hp <= 0 || g.over) return;
  f.cool -= dt;
  const d = Math.hypot(p.x - f.x, p.y - f.y);
  if (f.cool > 0 || d > 330) return;
  const fuse = 2.2;
  const shells = f.hp < f.max / 2 ? 2 : 1;
  for (let i = 0; i < shells; i++) {
    // where you'll be if you hold your course, give or take
    const lead = fuse * (0.75 + g.rand() * 0.35);
    const x = p.x + Math.cos(p.a) * p.v * lead + (g.rand() - 0.5) * (20 + i * 46);
    const y = p.y + Math.sin(p.a) * p.v * lead + (g.rand() - 0.5) * (20 + i * 46);
    g.zones.push({ id: g.id++, kind: 'mortar', x, y, r: 17, t: fuse, t0: fuse, dmg: 13 });
    g.events.push({ type: 'mortar', x: f.x, y: f.y, tx: x, ty: y, fuse });
  }
  f.cool = (f.hp < f.max / 2 ? 2.7 : 3.4) / Math.sqrt(g.L.foe);
}

// ── the kraken ──

const ARM = { warn: 1.5, rise: 0.6, hold: 0.95, slam: 0.28, down: 2.4, sink: 0.9, reach: 54, wide: 7.5 };

function kraken(g, dt) {
  const k = g.kraken;
  const p = g.p;
  k.hit = Math.max(0, k.hit - dt);
  if (k.phase === 'dead') {
    k.t += dt;
    k.up = Math.max(0, k.up - dt * 0.35);
    return;
  }
  if (g.over) return;
  k.t -= dt;
  const rage = k.hp < k.max / 2;
  if (k.phase === 'arms') {
    k.up = Math.max(0, k.up - dt * 1.2);
    if (k.t <= 0 && !g.arms.some((a) => a.st === 'warn' || a.st === 'rise' || a.st === 'hold')) {
      if (k.volleys >= (rage ? 2 : 3)) {
        // the head: up ahead of you and to one side, after a warning
        const at = place(g, 105, p.a + (g.rand() < 0.5 ? -0.9 : 0.9));
        k.x = at.x;
        k.y = at.y;
        k.phase = 'rising';
        k.t = 2;
        k.volleys = 0;
        g.zones.push({ id: g.id++, kind: 'bubble', x: k.x, y: k.y, r: 34, t: 2, t0: 2 });
        g.events.push({ type: 'surface', x: k.x, y: k.y, big: true });
      } else {
        const n = (rage ? 3 : 2) + (g.level === 'easy' ? 0 : 1);
        const lead = 1.4 + g.rand() * 0.8;
        const cx = p.x + Math.cos(p.a) * p.v * lead;
        const cy = p.y + Math.sin(p.a) * p.v * lead;
        const turn = g.rand() * TAU;
        for (let i = 0; i < n; i++) {
          const a = turn + (i / n) * TAU;
          const d = 30 + g.rand() * 16;
          const x = cx + Math.cos(a) * d;
          const y = cy + Math.sin(a) * d;
          if (ISLES.some((s) => Math.hypot(x - s.x, y - s.y) < s.r + 10)) continue;
          const hp = Math.round(28 * g.L.foe);
          g.arms.push({ id: g.id++, x, y, r: 7, hp, max: hp, st: 'warn', t: ARM.warn + i * 0.22, dir: 0, hit: 0, struck: false });
          g.zones.push({ id: g.id++, kind: 'bubble', x, y, r: 11, t: ARM.warn + i * 0.22, t0: ARM.warn + i * 0.22 });
        }
        g.events.push({ type: 'arms', x: cx, y: cy });
        k.volleys += 1;
        k.t = rage ? 4.2 : 5.2;
      }
    }
  } else if (k.phase === 'rising') {
    if (k.t <= 0) {
      k.phase = 'head';
      k.t = rage ? 10 : 12;
      k.spit = 1.6;
      k.a = Math.atan2(p.y - k.y, p.x - k.x);
      g.events.push({ type: 'kraken', x: k.x, y: k.y });
    }
  } else if (k.phase === 'head') {
    k.up = Math.min(1, k.up + dt * 1.4);
    k.a += wrap(Math.atan2(p.y - k.y, p.x - k.x) - k.a) * Math.min(1, dt * 1.5);
    k.spit -= dt;
    if (k.spit <= 0 && k.up > 0.9) {
      // ink: slow, heavy, and aimed where you're going
      const d = Math.hypot(p.x - k.x, p.y - k.y);
      const speed = 52;
      const t = d / speed;
      const dir = Math.atan2(p.y + Math.sin(p.a) * p.v * t * 0.7 - k.y, p.x + Math.cos(p.a) * p.v * t * 0.7 - k.x) + (g.rand() - 0.5) * 0.12;
      g.balls.push({ id: g.id++, x: k.x + Math.cos(dir) * 16, y: k.y + Math.sin(dir) * 16, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, t: 0, life: Math.min(4.5, (d + 30) / speed), owner: 'e', dmg: 6, ink: true });
      g.events.push({ type: 'spit', x: k.x, y: k.y, dir });
      k.spit = rage ? 1.6 : 2.2;
    }
    if (k.t <= 0) {
      k.phase = 'arms';
      k.t = 2.2;
      g.events.push({ type: 'dive', x: k.x, y: k.y, big: true });
    }
  }
}

// along a strip from (x, y) toward dir: how far (0…len) and how far off it
function strip(a, x, y) {
  const dx = x - a.x;
  const dy = y - a.y;
  return { along: dx * Math.cos(a.dir) + dy * Math.sin(a.dir), off: Math.abs(-dx * Math.sin(a.dir) + dy * Math.cos(a.dir)) };
}

function arms(g, dt) {
  const p = g.p;
  for (let i = g.arms.length - 1; i >= 0; i--) {
    const a = g.arms[i];
    a.hit = Math.max(0, a.hit - dt);
    a.t -= dt;
    if (a.t > 0) continue;
    if (a.st === 'warn') {
      // as it breaks the water it picks where to come down: at you, as you
      // are now. A ship with way on is gone by then; one lying still is not
      a.st = 'rise';
      a.t = ARM.rise;
      a.dir = Math.atan2(p.y - a.y, p.x - a.x);
      const fuse = ARM.rise + ARM.hold + ARM.slam;
      g.zones.push({ id: g.id++, kind: 'slam', x: a.x, y: a.y, dir: a.dir, len: ARM.reach, r: ARM.wide, t: fuse, t0: fuse });
      g.events.push({ type: 'arm', x: a.x, y: a.y });
    } else if (a.st === 'rise') {
      a.st = 'hold';
      a.t = ARM.hold;
    } else if (a.st === 'hold') {
      a.st = 'slam';
      a.t = ARM.slam;
    } else if (a.st === 'slam') {
      a.st = 'down';
      a.t = ARM.down;
      g.events.push({ type: 'slam', x: a.x + Math.cos(a.dir) * ARM.reach * 0.6, y: a.y + Math.sin(a.dir) * ARM.reach * 0.6, dir: a.dir });
      // across the deck: anywhere along your length under the strip
      let hit = false;
      for (const along of [-0.4, 0, 0.4]) {
        const s = strip(a, p.x + Math.cos(p.a) * p.len * along, p.y + Math.sin(p.a) * p.len * along);
        if (s.along > -4 && s.along < ARM.reach + 4 && s.off < ARM.wide + p.beam * 0.5) hit = true;
      }
      if (hit) hurtPlayer(g, 11, p.x, p.y, 'arm');
    } else if (a.st === 'down') {
      a.st = 'sink';
      a.t = ARM.sink;
    } else g.arms.splice(i, 1);
  }
}

// ── everything else ──

function zones(g, dt) {
  const p = g.p;
  for (let i = g.zones.length - 1; i >= 0; i--) {
    const z = g.zones[i];
    z.t -= dt;
    if (z.t > 0) continue;
    if (z.kind === 'mortar') {
      g.events.push({ type: 'boom', x: z.x, y: z.y, r: z.r });
      const d = Math.hypot(p.x - z.x, p.y - z.y);
      if (d < z.r + p.beam * 0.6) hurtPlayer(g, z.dmg * (d < z.r * 0.5 ? 1 : 0.6), z.x, z.y, 'mortar');
    }
    g.zones.splice(i, 1);
  }
}

function pickups(g, dt) {
  const p = g.p;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const c = g.pickups[i];
    c.t += dt;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 46 && !p.sunk) {
      // the wake pulls it in
      c.x += (dx / d) * 16 * dt;
      c.y += (dy / d) * 16 * dt;
    }
    if (d < p.beam + TIDE.pickup && !p.sunk) {
      if (c.kind === 'chest') {
        gain(g, c.gold);
        g.stats.chests += 1;
        p.hp = Math.min(p.max, p.hp + 6);
      } else p.hp = Math.min(p.max, p.hp + Math.round(p.max * 0.3));
      g.events.push({ type: 'pickup', kind: c.kind, quest: Boolean(c.quest), x: c.x, y: c.y });
      g.pickups.splice(i, 1);
    } else if (!c.quest && c.t > 45) g.pickups.splice(i, 1);
  }
}

function collide(g) {
  const p = g.p;
  const all = [p, ...g.ships];
  // ships and islands
  for (const s of all) {
    if (s.sunk || s.under > 0.5) continue;
    for (const isle of ISLES) {
      const dx = s.x - isle.x;
      const dy = s.y - isle.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = isle.r + s.beam * 0.7;
      if (d >= min) continue;
      s.x = isle.x + (dx / d) * min;
      s.y = isle.y + (dy / d) * min;
      if (s === p && s.v > 9 && s.ram <= 0) {
        hurtPlayer(g, 4 + (s.v / SHIPS.pearl.speed) * 8, s.x, s.y, 'aground');
        s.ram = 1.2;
        g.events.push({ type: 'aground', x: s.x, y: s.y });
      }
      s.v *= 0.35;
    }
  }
  // you and them
  for (const s of g.ships) {
    if (s.sunk || s.under > 0.5 || s.gone || p.sunk) continue;
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const min = (p.r + s.r) * 0.62;
    if (d >= min) continue;
    const push = (min - d) / 2;
    s.x += (dx / d) * push;
    s.y += (dy / d) * push;
    p.x -= (dx / d) * push;
    p.y -= (dy / d) * push;
    const closing = p.v * (Math.cos(p.a) * (dx / d) + Math.sin(p.a) * (dy / d)) - s.v * (Math.cos(s.a) * (dx / d) + Math.sin(s.a) * (dy / d));
    if (closing > 7 && p.ram <= 0) {
      p.ram = 1.4;
      const prow = g.ups.prow ? 1 : 0;
      const b = { x: (p.x + s.x) / 2, y: (p.y + s.y) / 2, dmg: 12 + closing * 0.5 + prow * 22 };
      g.events.push({ type: 'ram', x: b.x, y: b.y });
      strike(g, { ship: s }, b);
      if (!prow) hurtPlayer(g, 5, b.x, b.y, 'ram');
      p.v *= 0.5;
    }
  }
  // the fog at the edge of the chart turns you back
  const m = Math.hypot(p.x, p.y);
  if (m > TIDE.R) {
    p.x *= TIDE.R / m;
    p.y *= TIDE.R / m;
    p.v *= 0.9;
    if (g.edge <= 0) {
      g.edge = 6;
      say(g, 'Here be monsters. Come about.', 'bad');
    }
  }
}

function goal(g) {
  const id = CHAPTERS[g.chapter].id;
  const afloat = g.ships.some((s) => !s.sunk && !s.flee);
  if (id === 'patrol') return !afloat && !g.reserve?.length;
  if (id === 'gold') return !g.pickups.some((c) => c.quest);
  if (id === 'fort') return g.fort.hp <= 0;
  if (id === 'cursed') return !afloat;
  return g.kraken.phase === 'dead';
}

// How far along the chapter is, for the screen: [done, of].
export function progress(g) {
  const id = CHAPTERS[g.chapter].id;
  if (id === 'gold') {
    const left = g.pickups.filter((c) => c.quest).length;
    return [4 - left, 4];
  }
  if (id === 'patrol') {
    return [g.stats.sunk, g.stats.sunk + g.ships.filter((s) => !s.sunk).length + (g.reserve?.length ?? 0)];
  }
  return null;
}

export function step(g, dt) {
  if (g.status !== 'sail') return;
  const d = Math.min(dt, 0.05);
  const p = g.p;
  g.t += d;
  g.chapT += d;
  g.stats.time += d;
  g.quiet += d;
  g.edge -= d;
  if (g.comboT > 0) {
    g.comboT -= d;
    if (g.comboT <= 0) g.combo = 0;
  }

  // you
  p.hit = Math.max(0, p.hit - d);
  p.ram = Math.max(0, p.ram - d);
  p.reload[0] = Math.max(0, p.reload[0] - d);
  p.reload[1] = Math.max(0, p.reload[1] - d);
  if (p.sunk) p.sunk += d;
  else {
    const f = fitted(g);
    p.max = f.max;
    p.sail = clamp(Math.round(g.input.sail), 0, 2);
    sail(g, p, g.input.steer, TIDE.sails[p.sail], d, f.speed, f.turn);
    if (g.input.port) fire(g, -1);
    if (g.input.star) fire(g, 1);
    if (g.ups.carpenter && g.quiet > 5 && p.hp < p.max) p.hp = Math.min(p.max, p.hp + 2.2 * d);
  }

  // them
  for (let i = g.ships.length - 1; i >= 0; i--) {
    const s = g.ships[i];
    s.hit = Math.max(0, s.hit - d);
    s.reload[0] = Math.max(0, s.reload[0] - d);
    s.reload[1] = Math.max(0, s.reload[1] - d);
    if (s.sunk) {
      s.sunk += d;
      s.v *= 1 - d;
      if (s.sunk > 7) g.ships.splice(i, 1);
    } else if (s.gone) g.ships.splice(i, 1);
    else if (s.kind === 'ghost') cursed(g, s, d);
    else navy(g, s, d);
  }
  if (g.boss?.ship) {
    const s = g.ships.find((o) => o.id === g.boss.ship);
    g.boss.hp = s && !s.sunk ? s.hp : 0;
  } else if (g.boss && g.fort && CHAPTERS[g.chapter].id === 'fort') g.boss.hp = g.fort.hp;
  else if (g.boss && g.kraken) g.boss.hp = g.kraken.hp;

  volleys(g, d);
  balls(g, d);
  if (g.fort) fort(g, d);
  if (g.kraken) {
    kraken(g, d);
    arms(g, d);
  }
  zones(g, d);
  pickups(g, d);
  collide(g);

  if (g.over) {
    g.over.t -= d;
    if (g.over.t <= 0) {
      g.status = g.over.won ? 'won' : 'lost';
      const s = g.stats;
      const bonus = g.over.won ? Math.round((Math.max(0, 600 - s.time) * 4 + p.hp * 10) * g.L.score) : 0;
      g.gold += bonus;
      g.result = { won: g.over.won, gold: g.gold, bonus, chapter: g.chapter, level: g.level, time: s.time, sunk: s.sunk, chests: s.chests, accuracy: s.shots ? s.hits / s.shots : 0 };
      g.events.push({ type: g.over.won ? 'won' : 'lost' });
    }
    return;
  }
  if (goal(g)) chapterDone(g);
}

// ── the other players ──

// Where your ship is, as a traveller's step for the towns' rooms
// (middleearth/towns/travellers.js): the sea's x and y as they are for x and
// z (the room reaches as far as the sea does, past the towns' 200), her
// heading turned the way Tide3D turns her model (π − a) for the facing, and
// her speed.
export const STEP_BOUND = TIDE.R + 40;
export const shipStep = (s) => ({ x: s.x, z: s.y, face: wrap(Math.PI - s.a), speed: s.v });

export { ARM };
