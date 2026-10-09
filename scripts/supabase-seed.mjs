// Writes supabase/seed.sql: the planets a thing may be built on (50 at
// launch) and the fixed places on them where nothing may be. A planet not in
// the table cannot be built on (the foreign key), which is the point.
// Design: docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md (Pillar 2).
//
// Where the planets come from: lane A's src/lib/land/flight/planetSpec.js
// (PLANETS, and planetSpecOf(id).pois) when it is in the tree, else
// scripts/fixtures/planets.json, which carries the same 50 ids in the
// roster's order (docs/research/2026-10-09-planet-geographies.md: 37 named
// worlds, then 13 Expanse planets as makeSector lists them) and Echo Base
// alone. The fixture's named rows have placeholder types and seeds until
// planetSpec.js lands; seed.sql upserts, so the owner re-runs this script
// and applies seed.sql again after lane A merges, and the rows are corrected.
//
//   node scripts/supabase-seed.mjs             # write supabase/seed.sql
//   node scripts/supabase-seed.mjs --fixture   # rebuild scripts/fixtures/planets.json from makeSector
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SPEC = 'src/lib/land/flight/planetSpec.js';
const FIXTURE = 'scripts/fixtures/planets.json';
const OUT = 'supabase/seed.sql';

// the roster's named worlds in its order (docs/research/2026-10-09-planet-geographies.md,
// "The roster"): the galaxy's 17, the Rick and Morty sector's 10, the
// universe map's 10 fandom planets; names and types are placeholders until
// planetSpec.js gives its own
const NAMED = [
  ['tatooine', 'Tatooine', 'desert'], ['hoth', 'Hoth', 'ice'], ['endor', 'Endor', 'forest'], ['yavin', 'Yavin 4', 'forest'],
  ['bespin', 'Bespin', 'gas'], ['dagobah', 'Dagobah', 'swamp'], ['mustafar', 'Mustafar', 'lava'], ['coruscant', 'Coruscant', 'city'],
  ['naboo', 'Naboo', 'temperate'], ['kashyyyk', 'Kashyyyk', 'forest'], ['kamino', 'Kamino', 'ocean'], ['geonosis', 'Geonosis', 'desert'],
  ['scarif', 'Scarif', 'ocean'], ['nevarro', 'Nevarro', 'lava'], ['mandalore', 'Mandalore', 'desert'], ['lothal', 'Lothal', 'temperate'],
  ['sorgan', 'Sorgan', 'forest'],
  ['gazorpazorp', 'Gazorpazorp', 'desert'], ['squanch', 'Squanch', 'stylised'], ['birdworld', 'Bird World', 'stylised'],
  ['gearworld', 'Gear World', 'stylised'], ['pluto', 'Pluto', 'ice'], ['snakeplanet', 'Snake Planet', 'temperate'],
  ['nuptia', 'Nuptia 4', 'stylised'], ['resort', 'Immortality Field Resort', 'stylised'], ['cronenberg', 'Cronenberg World', 'temperate'],
  ['purge', 'Purge Planet', 'temperate'],
  ['cybertron', 'Cybertron', 'metal'], ['middle-earth', 'Middle-earth', 'temperate'], ['caribbean', 'The Caribbean', 'ocean'],
  ['albuquerque', 'Albuquerque', 'desert'], ['scranton', 'Scranton', 'temperate'], ['avengers', 'Avengers Compound', 'temperate'],
  ['invincible', 'Invincible', 'temperate'], ['c-137', 'Earth C-137', 'temperate'], ['earth', 'Earth', 'temperate'],
  ['dot-matrix', 'Dot Matrix', 'stylised'],
];
export const AUTHORED = NAMED.map(([id]) => id);
// the order the plan gives: sectors round home, until 42 are listed
const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];
// the migration's check on planets.id
export const ID = /^[A-Za-z0-9:_,-]{1,64}$/;

// the spec's hoth example: Echo Base levelled within r, the land easing in over
// edge; nothing is built anywhere the land is not its own (r + edge)
const ECHO_BASE = { id: 'hoth:echo-base', planetId: 'hoth', name: 'Echo Base', x: 1200, z: -800, r: 220 + 160 };

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const num = (n) => {
  if (!Number.isFinite(n)) throw new Error(`not a number: ${n}`);
  return String(n);
};

export function seedSql({ planets, pois }, source) {
  const ids = new Set();
  for (const p of planets) {
    if (!ID.test(p.id)) throw new Error(`planet id the table refuses: ${p.id}`);
    if (ids.has(p.id)) throw new Error(`planet listed twice: ${p.id}`);
    ids.add(p.id);
  }
  for (const p of pois) if (!ids.has(p.planetId)) throw new Error(`POI on a planet not listed: ${p.id}`);
  const lines = [
    '-- The planets a thing may be built on, and the places on them where nothing',
    `-- may be. Written by scripts/supabase-seed.mjs from ${source}; do not edit by hand.`,
    '-- Upserts, so it can be applied again after the list changes.',
    '',
    ...planets.map(
      (p) =>
        `insert into public.planets (id, name, type, seed) values (${q(p.id)}, ${q(p.name)}, ${q(p.type)}, ${q(p.seed)}) ` +
        'on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;',
    ),
    '',
    ...pois.map(
      (p) =>
        `insert into public.pois (id, planet_id, name, x, z, r) values (${q(p.id)}, ${q(p.planetId)}, ${q(p.name)}, ${num(p.x)}, ${num(p.z)}, ${num(p.r)}) ` +
        'on conflict (id) do update set planet_id = excluded.planet_id, name = excluded.name, x = excluded.x, z = excluded.z, r = excluded.r;',
    ),
    '',
  ];
  return lines.join('\n');
}

// src modules use Vite's extensionless imports: loaded through Vite
async function viteLoader() {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  return { load: (p) => vite.ssrLoadModule(p), close: () => vite.close() };
}

async function fromSpec() {
  const { load, close } = await viteLoader();
  try {
    const { PLANETS, planetSpecOf } = await load(`/${SPEC}`);
    const planets = PLANETS.map(({ id, name, type, seed }) => ({ id, name, type, seed: String(seed) }));
    const pois = planets.flatMap(({ id }) =>
      (planetSpecOf(id)?.pois ?? []).map((p) => ({ id: `${id}:${p.id}`, planetId: id, name: p.name, x: p.at[0], z: p.at[1], r: p.r + (p.edge ?? 0) })),
    );
    return { planets, pois };
  } finally {
    await close();
  }
}

async function buildFixture() {
  const { load, close } = await viteLoader();
  try {
    const { makeSector } = await load('/src/components/expanse/gen/sector.js');
    const { UNIVERSE, hash64 } = await load('/src/components/expanse/gen/seed.js');
    const planets = NAMED.map(([id, name, type]) => ({
      id,
      name,
      type,
      seed: id === 'hoth' ? String(0x48f1a2c3) : String(hash64('planet', id)),
    }));
    for (const [sx, sz] of SECTORS)
      for (const system of makeSector(UNIVERSE, sx, sz).systems)
        for (const p of system.planets) if (planets.length < 50) planets.push({ id: p.id, name: p.name, type: p.type, seed: String(p.seed) });
    if (planets.length !== 50) throw new Error(`only ${planets.length} planets in the listed sectors`);
    return { planets, pois: [ECHO_BASE] };
  } finally {
    await close();
  }
}

async function main() {
  if (process.argv.includes('--fixture')) {
    const fixture = await buildFixture();
    await writeFile(join(ROOT, FIXTURE), `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`wrote ${FIXTURE}: ${fixture.planets.length} planets, ${fixture.pois.length} POI`);
    return;
  }
  const spec = existsSync(join(ROOT, SPEC));
  const list = spec ? await fromSpec() : JSON.parse(await readFile(join(ROOT, FIXTURE), 'utf8'));
  const source = spec ? SPEC : FIXTURE;
  await writeFile(join(ROOT, OUT), seedSql(list, source));
  console.log(`wrote ${OUT} from ${source}: ${list.planets.length} planets, ${list.pois.length} POI`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
