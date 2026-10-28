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
