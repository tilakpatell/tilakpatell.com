// The scenarios bf2-web's gate runs through each module's CPU driver, restated
// here (bf2-web's test files build and run on import, so they can't be read
// for their lists) for scripts/bf2web-golden.mjs. Each names its bf2-web
// sources, its gate and its scripts, line for line as the gate writes them.
//
//   MODULES[name] → { sources, gate, scenarios({ webPort, site }) → { [scenario]: lines[] } }
//     or, for a driver that takes a scenario's name and prints its records: { sources, gate, named: [scenario, …] }

// Onslaught's custom-menu defaults with the Medium intensity row and the menu's
// smallest score limit (bf2-web WebPort/tests/arcade-round.mjs, onslaughtRules)
export const onslaughtRules = {
  humanTeam: 2, aiPlayers: 15, scoreLimit: 10, aiScoreLimit: 100, timeLimit: 40, eliminationBonus: 3, lives: 0,
  killsPerStep: 2, minAI: 6, maxAI: 15, deathPenalty: 0, squadNormal: 2, squadAtMax: 4, timeBetweenWaves: 10, minCountSpawn: 2, spawnDelay: 0,
};
const rulesLine = (over = {}) => 'rules ' + Object.entries({ ...onslaughtRules, ...over }).map(([k, v]) => k + ' ' + v).join(' ');
const T = 1 / 30;

// Hoth_01's TeamDeathmatch_Global layer, the one bf2-web's spawn finder reads
// (44 AlternateSpawnEntityData, 8 SpawnLocationFinderShapeData), from the
// site's own map rulebook, which carries it for Blast
export async function hothSpawnLayer(site) {
  const { readFile } = await import('node:fs/promises');
  const { rows } = JSON.parse(await readFile(`${site}/src/data/bf2017/maps/hoth.json`, 'utf8'));
  const mine = (r) => r.layer === 'TeamDeathmatch_Global';
  return {
    points: rows.spawns.filter(mine).map((s) => ({ position: s.at, yaw: s.yaw ?? 0, team: s.team, enabled: s.enabled !== false })),
    zones: rows.polygons.filter(mine).map((z) => ({ team: z.team, enabled: z.enabled !== false, xz: z.points.flat() })),
  };
}
// The street-0 player of bf2-web's World runs (WebPort/tests/bot-spawns.mjs, streetPlayer)
export const streetPlayer = { team: 2, feet: [226.53, 359.14, -1692.96], facing: [1, 0] };
const insidePolygon = (xz, x, z) => {
  let inside = false;
  for (let i = 0, n = xz.length / 2, j = n - 1; i < n; j = i++) {
    const xi = xz[2 * i], zi = xz[2 * i + 1], xj = xz[2 * j], zj = xz[2 * j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

// A mesh as bf2-web's BFNAVPK1 package (its runtime/nav/navgraph-v43.js
// buildNavPackage's layout: the header, a JSON manifest with the counts, then
// the sections, four bytes a value), from the planner's own arrays so both
// sides read the same numbers
export async function navPackage(mesh) {
  const { navArraysFromMesh } = await import('../../src/lib/battlefront/bf2web/navMesh.js');
  const a = navArraysFromMesh(mesh);
  const A = a.areaEdgeStart.length - 1, E = a.edgeAdjacent.length;
  let manifest = Buffer.from(JSON.stringify({ schema: 'bf2web-nav-package/1', name: 'site-test', counts: { graphs: 1, areas: A, edges: E } }));
  manifest = Buffer.concat([manifest, Buffer.alloc((4 - (manifest.length % 4)) % 4, 0x20)]);
  const words = 16 * A + (A + 1) + 6 * E;
  const out = Buffer.alloc(16 + manifest.length + 4 * words);
  out.write('BFNAVPK1', 0, 'latin1');
  out.writeUInt32LE(1, 8);
  out.writeUInt32LE(manifest.length, 12);
  manifest.copy(out, 16);
  let p = 16 + manifest.length;
  const f32 = (list) => list.forEach((x) => ((p = out.writeFloatLE(x, p)), 0));
  const u32 = (list) => list.forEach((x) => ((p = out.writeUInt32LE(x >>> 0, p)), 0));
  f32(a.areaPos);
  u32(new Array(A).fill(0)); // areaRadius
  f32(a.areaBounds);
  u32(new Array(A).fill(0)); // areaUsageFlags
  for (let k = 0; k < A; k++) u32([a.areaEdgeStart[k + 1] - a.areaEdgeStart[k], 0, 0, 0]); // areaFlags: flags1 & 0x7f, the edge count
  u32(new Array(A).fill(0)); // areaGraph
  u32(a.areaEdgeStart);
  f32(a.edgePos);
  u32(a.edgeAdjacent);
  u32(new Array(2 * E).fill(0)); // edgeFlags
  return out;
}

export const MODULES = {
  arcadeRound: {
    sources: ['ai/arcade-round.cpp', 'ai/arcade-driver.cpp'],
    gate: 'WebPort/tests/arcade-round.mjs',
    scenarios: async () => ({
      spawner: [rulesLine(), 'setup', 'tick 5 ' + T, 'state', 'ai 0', 'tick 1 ' + T, 'state', 'ai 0', 'tick 1 ' + T, 'state', 'tick 3 ' + T, 'state'],
      max: [rulesLine({ scoreLimit: 100 }), 'setup', 'tick 3 ' + T, ...Array(18).fill('ai 0'), 'tick 10 ' + T, 'state', 'ai 0', 'tick 1 ' + T, 'state', 'ai 0', 'ai 0', 'tick 30 ' + T, 'state'],
      timer: [rulesLine({ scoreLimit: 100 }), 'setup', 'tick 4 0.5', 'state', 'ai 0', 'state', 'tick 2 0.5', 'state', 'ai 0', 'state',
        'human 0', 'tick 1 0.5', 'state', 'tick 4 0.5', 'state', 'spawn', 'tick 2 0.5', 'state'],
      counters: [rulesLine({ scoreLimit: 100 }), 'setup', 'ai 2', 'ai 3', 'state', 'ai 1', 'state', 'ai 0', 'state'],
      win: [rulesLine(), 'setup', 'tick 3 ' + T, ...Array(9).fill('ai 0'), 'state', 'ai 0', 'tick 3 ' + T, 'state'],
      timeout: [rulesLine(), 'setup', 'ai 0', 'tick 84 0.5', 'state', 'tick 2 0.5', 'state'],
      unlimited: [rulesLine(), 'setup', 'human 0', 'human 2', 'human 1', 'state'],
      oneLife: [rulesLine({ lives: 1 }), 'setup', 'human 0', 'state'],
    }),
  },
  blaster: {
    sources: ['physics/player/blaster-weapon.cpp', 'physics/player/blaster-driver.cpp'],
    gate: 'WebPort/tests/blaster-weapon.mjs',
    named: ['hold', 'release', 'tap', 'wall', 'rng'],
  },
  health: {
    sources: ['physics/player/soldier-health.cpp', 'physics/player/blaster-weapon.cpp', 'physics/player/soldier-health-driver.cpp'],
    gate: 'WebPort/tests/soldier-health.mjs',
    named: ['bot-body', 'bot-head', 'bot-30m', 'bot-50m', 'assault-body', 'assault-head', 'ai-on-assault', 'assault-regen', 'trooper-regen', 'bot-regen', 'threshold', 'respawn'],
  },
  nav: {
    sources: ['ai/nav-mesh.cpp', 'ai/nav-driver.cpp'],
    gate: 'WebPort/tests/hoth-nav.mjs',
    // the driver reads the package first: the test's grid, packed
    prepare: async ({ work, write }) => {
      const { navGrid } = await import('../../src/lib/battlefront/bf2web/fixtures/navGrid.js');
      const file = `${work}/grid.bfnav`;
      await write(file, await navPackage(navGrid()));
      return [file];
    },
    // the gate's kinds of query on the grid: points on, off and between the floors, paths across the holes and the
    // ramp, to the island (partial) and off the mesh, straight lines into walls, random patrol goals, seeded pairs
    scenarios: async () => ({
      grid: [
        'closest 6 0.5 6 3', 'closest 18 0 10 3', 'closest -2 0 -2 5', 'closest 100 0 100 3', 'closest 19.5 3 13 1',
        'area 6 0.5 6 2', 'area 18 0.5 10 2', 'area 30 3.5 20 2', 'area 6 9 6 2',
        'path 2 0.2 2 30 3 30', 'path 2 0.2 2 26 2.5 18', 'path 6 0.6 14 30 2.6 6', 'path 2 0.2 2 44 4 10',
        'path 14 1 2 14 1.4 30', 'path -1 0 -1 6 0.5 6', 'path 2 0.2 2 2.5 0.2 2.5',
        'straight 2 0.2 2 14 1 2', 'straight 2 0.2 10 26 2 10', 'straight 10 1 30 10 1 2', 'straight 30 2.8 34 30 2.8 2',
        'random 7 12 2 0.2 2 20 1.5 18 14', 'random 99 6 42 4 10 42 4 10 6',
        'pairs 1234 16 20 1.5 18 22',
      ],
    }),
  },
  spawns: {
    sources: ['physics/player/spawn-finder.cpp', 'ai/spawn-waves.cpp', 'ai/spawn-driver.cpp'],
    gate: 'WebPort/tests/bot-spawns.mjs',
    // bf2-web's script line for line, on the same layer
    scenarios: async ({ site }) => {
      const layer = await hothSpawnLayer(site);
      const P = streetPlayer;
      const infl = 'infl ' + P.team + ' ' + P.feet.join(' ') + ' ' + P.facing.join(' ');
      const streetZones = layer.zones.map((z, k) => (insidePolygon(z.xz, P.feet[0], P.feet[2]) ? k : -1)).filter((k) => k >= 0);
      const bases = (team) => layer.zones.map((z, k) => 'base ' + k + ' ' + team);
      const street = () => streetZones.map((k) => 'base ' + k + ' 1');
      return {
        hoth: [
          ...layer.points.map((p) => 'point ' + [...p.position, p.yaw, p.team, p.enabled ? 1 : 0].join(' ')),
          ...layer.zones.map((z) => 'zone ' + [z.team, z.enabled ? 1 : 0, z.xz.length / 2, ...z.xz].join(' ')),
          'level', infl,
          'choose 1 0', 'choose 1 0.5', 'choose 1 1', ...bases(2),
          'choose 2 9.9', ...bases(2), 'choose 2 11.5', ...bases(2),
          'choose 1 25', 'death 1 ' + P.feet.join(' ') + ' 5 26', ...street(), 'clear', 'choose 1 35.5', ...street(),
          'choose 1 36.5', ...street(),
          'join 7 1', 'update 200', 'join 1 1', 'join 2 1', 'join 3 1', 'join 4 1', 'join 5 1', 'update 200',
        ],
      };
    },
  },
};
