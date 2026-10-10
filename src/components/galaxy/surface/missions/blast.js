// Blast, as plain numbers: ten a side on the level's team-deathmatch
// ground (missions/arenas.js), the first side to RULES.kills kills wins.
// The soldiers are the galactic assault's (./assault.js: its squads,
// cover, suppression, waves), fought with no command posts: each side has
// its own fixed post at its spawn cluster, where its waves come back, and
// one post in the ground's middle nobody can take (r 0), which both sides
// make for; each soldier, sent there, roams the ground instead (a spot
// anywhere in it, a new one when it gets there). No tickets: the kill
// counter is the score. Pure and seeded, so it's tested; blastScene.js
// draws it with assaultScene.js's drawing.
//
// The light side (team 1's spawns) is the assault's `attack`, the dark
// (team 2's) its `defend`: the attackers press, the defenders hold behind
// their line, as each side's squads do in the assault.
//
//   RULES                         kills to win (hand: 100)
//   newBlast(mission, { n, seed }) → b (assault.js's battle, with b.blast)
//   chooseSide(b, side)           ('attack' | 'defend' | null: nobody plays)
//   stepBlast(b, dt, you, env)    → assault.js's events
//   hitSoldier(b, id, damage)     yours: → the `down` event (counted)
//   youDown(b), deploy(b, id), canDeploy, endBlast(b, won), blastView(b)
//   blastMission(world)           the mission row (missions/index.js)

import { SOLDIERS, battleView, canDeploy as canDeployAt, chooseSide as pick, deploy as deployAt, endBattle, hitSoldier as hitOne, newBattle, stepBattle, youDown as putDown } from './assault';
import { ASSAULTS, sidesFor } from './assaults';
import { groundFor, inside, pull, spawnFor } from './arenas';

export const RULES = {
  kills: 100, // (hand: the game's Blast)
  n: 10, // a side (hand: the game's; the tier's SOLDIERS cap it)
  harder: 14, // of a soldier's hp, added to each bolt that hits one: three hits down, not the assault's four (hand: a Blast with the assault's rate ran past fifteen minutes)
};
export { SOLDIERS };

const other = (side) => (side === 'attack' ? 'defend' : 'attack');
const centre = (pts) => [pts.reduce((n, p) => n + p[0], 0) / pts.length, pts.reduce((n, p) => n + p[1], 0) / pts.length];
// (a cluster's reach: the farthest of its spawns from its middle, and room to stand)
const reach = (pts, c) => Math.max(6, ...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) + 3));

export function newBlast(mission, { n = RULES.n, seed = 1 } = {}) {
  const b = newBattle(mission, { n, seed });
  // (the middle post: nobody's, nobody can stand in it, so nobody takes it)
  const field = b.posts.find((p) => p.id === 'field');
  field.owner = null;
  field.meter = 0;
  // (the fight's middle: halfway between the two sides' spawns, not the
  // ground's, so neither side starts nearer it: with the ground's middle the
  // side whose spawns were nearer won seven runs in eight)
  const [L, D] = [b.posts.find((p) => p.fixed === 'attack'), b.posts.find((p) => p.fixed === 'defend')];
  const ground = groundFor(mission.system, 'blast');
  const mid = pull(ground.points, ground.at, (L.at[0] + D.at[0]) / 2, (L.at[1] + D.at[1]) / 2);
  b.blast = { kills: { attack: 0, defend: 0 }, ground, mid };
  return b;
}

// a spot to roam to: anywhere in the ground, drawn toward its middle (so
// the two sides meet: spread over the whole of Tatooine's ground they
// seldom did)
export const ROAM = 0.3; // (hand: of the way from the middle to the ground's edge)
const roam = (b) => {
  const g = b.blast.ground;
  for (let i = 0; i < 12; i++) {
    const x = b.blast.mid[0] + (b.r() - 0.5) * (g.bounds.max[0] - g.bounds.min[0]) * ROAM;
    const z = b.blast.mid[1] + (b.r() - 0.5) * (g.bounds.max[1] - g.bounds.min[1]) * ROAM;
    if (inside(g.points, x, z)) return [x, z];
  }
  return [b.blast.mid[0], b.blast.mid[1]];
};

// each soldier its own place to go: the assault sends it to the middle
// post's very middle, Blast sends it somewhere in the ground
function spread(b) {
  const mid = b.mission.posts.find((p) => p.id === 'field').at;
  for (const s of b.soldiers) {
    if (!s.up) continue;
    if (!s.spot || (s.spot[0] === mid[0] && s.spot[1] === mid[1])) s.spot = roam(b);
    // (and never off the ground)
    if (!inside(b.blast.ground.points, s.x, s.z)) [s.x, s.z] = pull(b.blast.ground.points, b.blast.ground.at, s.x, s.z);
  }
}

// a kill counted: to the side that made it
function count(b, events) {
  for (const e of events) {
    if (e.type !== 'kill') continue;
    b.blast.kills[other(e.side)] += 1;
  }
  for (const side of ['attack', 'defend']) {
    if (b.result || b.blast.kills[side] < RULES.kills) continue;
    const won = b.you.side ? b.you.side === side : null;
    events.push({ type: 'end', won, why: 'kills', side });
    endBlast(b, won);
  }
}

export function chooseSide(b, side = null) {
  pick(b, side);
  // (the defenders out of the middle and onto their own spawns, as the attackers are)
  const own = b.posts.find((p) => p.fixed === 'defend');
  for (const s of b.soldiers) {
    if (s.side !== 'defend') continue;
    const a = b.r() * Math.PI * 2;
    const d = Math.sqrt(b.r()) * own.r * 0.7;
    s.x = own.at[0] + Math.cos(a) * d;
    s.z = own.at[1] + Math.sin(a) * d;
  }
  spread(b);
}

// one back from down: at one of the level's spawns (its side's or
// either's), as the game's Blast brings them back, not at the cluster it
// started at: the nearest the middle with no enemy within SAFE metres
// (failing that, the one farthest from them)
export const SAFE = 30; // (hand)
const SIDE = { attack: 'light', defend: 'dark' };
function quiet(b, side, near) {
  const g = b.blast.ground;
  let best = null;
  let bestD = Infinity;
  for (const sp of [...g.spawns[side], ...g.spawns.any]) {
    if (near.some((e) => Math.hypot(e.x - sp[0], e.z - sp[1]) < SAFE)) continue;
    const d = Math.hypot(sp[0] - b.blast.mid[0], sp[1] - b.blast.mid[1]) + b.r() * 20;
    if (d < bestD) {
      best = sp;
      bestD = d;
    }
  }
  return best ?? spawnFor(g, side, b.r, near);
}
function respawned(b, events) {
  for (const e of events) {
    if (e.type !== 'spawn') continue;
    const s = b.soldiers[e.id];
    const near = b.soldiers.filter((o) => o.up && o.side !== s.side).map((o) => ({ x: o.x, z: o.z }));
    const at = quiet(b, SIDE[s.side], near);
    s.x = at[0];
    s.z = at[1];
    s.spot = null;
    s.post = null;
  }
}

export function stepBlast(b, dt, you = null, env) {
  const events = stepBattle(b, dt, you, env);
  // (each bolt that found a soldier still up, harder)
  for (const e of events.slice()) {
    if (e.type !== 'shot' || !e.hit || e.target == null || !b.soldiers[e.target].up) continue;
    const down = hitOne(b, e.target, RULES.harder, b.soldiers[e.id]);
    if (down) events.push(down, { type: 'kill', victim: down.id, side: b.soldiers[down.id].side, by: down.by });
  }
  respawned(b, events);
  // (the middle post stays nobody's: a phase never ends)
  const mid = b.posts.find((p) => p.id === 'field');
  mid.owner = null;
  spread(b);
  count(b, events);
  return events;
}

export function hitSoldier(b, id, damage) {
  const ev = hitOne(b, id, damage, 'you');
  if (ev) count(b, [{ type: 'kill', side: b.soldiers[id].side }]);
  return ev;
}

export function youDown(b) {
  if (!b.you.up) return;
  putDown(b);
  count(b, [{ type: 'kill', side: b.you.side }]);
}

export const canDeploy = canDeployAt;
export const deploy = (b, id) => deployAt(b, id);

export function endBlast(b, won) {
  if (b.result) return;
  endBattle(b, won, 'kills');
  b.result.score = { ...b.blast.kills };
}

export function blastView(b) {
  const v = battleView(b);
  return { ...v, kills: { ...b.blast.kills }, goal: RULES.kills, key: `${v.key}|${b.blast.kills.attack}|${b.blast.kills.defend}` };
}

// ── the mission row a world gets (missions/index.js) ──
const LIGHT_IDS = new Set(['rebels', 'republic', 'newrepublic']);
const LINES = {
  start: {
    xwing: [['luke', 'No posts, no objective. Just them and us.'], ['r2', '(A wary whistle.)']],
    falcon: [['han', 'A straight-up firefight. Finally, something simple.'], ['chewie', '(A battle roar.)']],
    cruiser: [['rick', 'Team deathmatch, Morty. The purest form of conflict.'], ['morty', 'That’s a horrible thing to say, Rick.']],
    rv: [['walt', 'A hundred. Count them.'], ['jesse', 'Yo, that’s a lot of guys.']],
  },
  won: {
    xwing: [['luke', 'A hundred. That’s the field.'], ['r2', '(A triumphant trill.)']],
    falcon: [['han', 'A hundred and done. Drinks are on me.'], ['chewie', '(A long, victorious howl.)']],
    cruiser: [['rick', 'One hundred, Morty. Round numbers are the best numbers.']],
    rv: [['walt', 'Decisively.'], ['jesse', 'Yeah, science!']],
  },
  lost: {
    xwing: [['luke', 'They got there first. Regroup.']],
    falcon: [['han', 'They outshot us. Once. Go again.']],
    cruiser: [['morty', 'They won, Rick.'], ['rick', 'Statistically, Morty, somebody had to.']],
    rv: [['walt', 'Again. Fewer mistakes.']],
  },
};
export function blastMission(world) {
  const g = groundFor(world, 'blast');
  if (!g) return null;
  // (the world's own two armies: its assault's sides, or the Galactic Civil War's)
  const sides = ASSAULTS[world]?.sides ?? sidesFor('gcw');
  const light = LIGHT_IDS.has(sides.attack.id) ? sides.attack : sides.defend;
  const dark = light === sides.attack ? sides.defend : sides.attack;
  const cluster = (side) => {
    const pts = g.spawns[side].length ? g.spawns[side] : g.spawns.any;
    const c = centre(pts);
    return { at: [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10], r: Math.round(reach(pts, c)) };
  };
  const L = cluster('light');
  const D = cluster('dark');
  return {
    id: 'blast',
    system: world,
    kind: 'blast',
    name: 'Blast',
    line: `Ten a side on the level’s own ground: ${light.name.replace(/^The /, 'the ')} against ${dark.name.replace(/^The /, 'the ')}. No posts to take. The first to a hundred kills wins.`,
    ride: null,
    start: [g.at[0], g.at[1]],
    yaw: 0,
    stars: [480, 720],
    achievement: 'blast',
    sides: { attack: light, defend: dark },
    posts: [
      { id: 'lightspawn', name: `${light.short}’s spawn`, at: L.at, r: L.r, fixed: 'attack' },
      { id: 'field', name: 'The ground', at: [g.at[0], g.at[1]], r: 0 },
      { id: 'darkspawn', name: `${dark.short}’s spawn`, at: D.at, r: D.r, fixed: 'defend' },
    ],
    phases: [{ name: 'Blast', posts: ['field'], tickets: 0 }],
    // (no tickets: the kill counter ends it)
    tickets: { attack: 1e6, defend: 1e6 },
    // (the waves come back at the spawns, not on a staging line short of the middle)
    forward: 1e4,
    // (the world's own soldiers of the two armies out of the way while it's fought)
    hideLife: ASSAULTS[world]?.hideLife ?? [...light.kinds, ...dark.kinds].map(([k]) => k),
    ground: g.volume,
    ends: { won: 'A hundred kills', lost: 'They got to a hundred', why: { kills: 'The other side reached a hundred kills first.' } },
    lines: LINES,
    barks: ASSAULTS[world]?.barks ? { attack: ASSAULTS[world].barks[light === ASSAULTS[world].sides.attack ? 'attack' : 'defend'], defend: ASSAULTS[world].barks[light === ASSAULTS[world].sides.attack ? 'defend' : 'attack'] } : undefined,
  };
}
