// The squadron behaviour tree on a fixture flight (the bots lane, task 6):
// one fighter flying the game's dogfight tree (src/lib/battlefront/ai/
// squadron.js, ai.squadron.json) against three enemies circling 400 m round
// the middle at 90 m/s, one of them turning onto its tail now and then,
// for each of twelve seeds (where the fighter and the enemies start). A
// simple point-mass flight stands in for the fighters lane's flight model:
// 100 m/s at full throttle, the sticks turning 1.2 rad/s at full. Reports
// the time to its first shot and to its first missile, and the share of
// ticks each node kind was flown.
//
//   node scripts/battlefront-squadron.mjs [--seeds 12] [--seconds 120] [--tree PF_DogfightBehaviour]

import { readFileSync } from 'node:fs';
import { createSquadronMind, DOGFIGHT } from '../src/lib/battlefront/ai/squadron.js';
import { seeded } from '../src/lib/seeded.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const SEEDS = Number(opt('seeds', 12));
const SECONDS = Number(opt('seconds', 120));
const TREE = opt('tree', DOGFIGHT);
const DT = 0.05;
const trees = JSON.parse(readFileSync(new URL('../src/data/bf2017/ai.squadron.json', import.meta.url))).rows.trees;

const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k);

// the fighter turned by its sticks: yaw about up, pitch about the side
function fly(f, cmd, dt) {
  const side = norm(cross(f.up, f.fwd));
  f.fwd = norm(add(add(f.fwd, side, cmd.yaw * 1.2 * dt), f.up, cmd.pitch * 1.2 * dt));
  f.up = norm(cross(f.fwd, side));
  f.speed = 100 * Math.max(0.2, cmd.throttle);
  f.at = add(f.at, f.fwd, f.speed * dt);
}

function round(seed) {
  const rand = seeded(seed);
  const me = { at: [(rand() - 0.5) * 600, 50, (rand() - 0.5) * 600], fwd: norm([rand() - 0.5, 0, rand() - 0.5]), up: [0, 1, 0], speed: 100 };
  const enemies = [0, 1, 2].map((i) => ({ id: `e${i}`, phase: rand() * Math.PI * 2, h: 30 + 40 * i, chase: i === 0 }));
  const place = (e, t) => {
    if (e.chase && Math.floor(t / 20) % 2 === 1) {
      // on the fighter's tail, 90 m behind
      e.at = add(me.at, me.fwd, -90);
      e.fwd = [...me.fwd];
    } else {
      const a = e.phase + (t * 90) / 400;
      e.at = [400 * Math.cos(a), e.h, 400 * Math.sin(a)];
      e.fwd = [-Math.sin(a), 0, Math.cos(a)];
    }
    e.vel = e.fwd.map((x) => x * 90);
  };
  const mind = createSquadronMind(trees[TREE], { rand });
  const count = {};
  let fire = null;
  let missile = null;
  let n = 0;
  for (let t = 0; t < SECONDS; t += DT) {
    enemies.forEach((e) => place(e, t));
    const near = enemies.reduce((b, e) => (!b || Math.hypot(...add(e.at, me.at, -1)) < Math.hypot(...add(b.at, me.at, -1)) ? e : b), null);
    const cmd = mind.tick(DT, { self: me, nearestEnemy: () => near, attackers: () => enemies, areas: () => ({ keepIn: { centre: [0, 50, 0], radius: 1500 } }), waypoints: () => null });
    count[mind.active ?? 'none'] = (count[mind.active ?? 'none'] ?? 0) + 1;
    n++;
    if (cmd.fire && fire === null) fire = t;
    if (cmd.missile && missile === null) missile = t;
    fly(me, cmd, DT);
  }
  return { seed, fire, missile, share: Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / n])) };
}

const rows = Array.from({ length: SEEDS }, (_, i) => round(i + 1));
const kinds = [...new Set(rows.flatMap((r) => Object.keys(r.share)))].sort();
const pct = (v) => `${(100 * (v ?? 0)).toFixed(1)}`;
const s = (v) => (v === null ? '—' : v.toFixed(1));
console.log(`${TREE}, ${SEEDS} seeds, ${SECONDS} s each: the share of ticks (%) in each node kind`);
console.log(['seed', 'first shot s', 'first missile s', ...kinds].join(' | '));
for (const r of rows) console.log([r.seed, s(r.fire), s(r.missile), ...kinds.map((k) => pct(r.share[k]))].join(' | '));
const mean = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
const fired = rows.filter((r) => r.fire !== null);
console.log(['mean', fired.length ? (fired.reduce((a, r) => a + r.fire, 0) / fired.length).toFixed(1) : '—', '', ...kinds.map((k) => pct(mean((r) => r.share[k] ?? 0)))].join(' | '));
