// A contact sheet of generated planets, for looking the endless universe's
// variety over (its spec, section E): planets drawn at random from the
// generator, each seen from orbit and on the ground, so one look says
// whether two planets read as one recoloured, whether a map shows its land
// and its sea, whether a ground is a flat plane, and whether the colours
// seen from orbit are the ground's.
//
// The draw is seeded (lib/seeded.js): a sector with x and z in −30…30, never
// home (0, 0) nor the seeded thirteen's (1, 0), then one of its systems and
// one of that system's planets. A planet is kept when it's rock, ice,
// desert, forest, lava or ocean (the round ones that land), isn't one of the
// fifty and wasn't drawn already; the draw stops at --count.
//
// A draw over thousands of sectors hardly ever puts two planets of one
// system on a sheet, so --system lays out one system's kept planets instead,
// in its order: its siblings side by side, for judging that no two read as
// one planet recoloured (the variety's sibling guarantee).
//
// For each planet, n from 1:
//   - n-orbit.png: its orbit map (lib/land/flight/orbitMap.js), 512 × 256,
//     written opaque so the sea's colour shows (the map's alpha, 0 under the
//     water, is the orbit shader's mask);
//   - n-ground.png: the middle 3 km of the flight's chart, 384 × 384 at 8 m a
//     pixel, in groundColour's colours (the one rule the map is baked by),
//     times 0.55 + 0.45 × max(0, normal · sun) in linear light, the sun from
//     the north-west and 40° up; the slope is read over 8 m either way, as the
//     map's is (sphereField.js's SLOPE_STEP).
// Then sheet.png, six to a row: each tile its caption (name; type, terrain
// character and exotic), its orbit map at 384 × 192 and its ground under it;
// and index.json, [{ n, id, name, type, character, exotic, weather, sky }].
//
//   node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--out lab/planets/contact]
//   node scripts/planet-contact-sheet.mjs --system E:sx,sz:i [--out lab/planets/contact]
//
// Writes into --out (a folder under the repo when it's relative; lab/ is
// git-ignored, so nothing it writes is committed), replacing only the files
// a run of it writes, then prints the folder. Exits 1 when it found fewer
// than --count planets (with --system, when the system has none). The src modules are loaded through Vite, as
// scripts/flight-expanse-fixture.mjs loads them.
//
//   KEEP → the types drawn
//   drawPlanets({ count, random, sectorOf(sx, sz) → makeSector's sector,
//     roster: Set of lower-case ids, tries = 50 × count }) → lower-case ids
//   systemPlanets(system, roster) → its kept planets' lower-case ids, in order
//   SUN → the unit direction to the sun, chart +x east, +y up, −z north
//   lightOf(gx, gz) → the light on ground whose height rises gx a metre east
//     and gz a metre south
//   argsOf(argv) → { count, seed, out, system: { id, sx, sz, i } | null }, or
//     throws on a value it can't read

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseSpaceId } from '../src/lib/space/address.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'usage: node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--system E:sx,sz:i] [--out lab/planets/contact]';

// ── the draw ──

export const KEEP = Object.freeze(['rock', 'ice', 'desert', 'forest', 'lava', 'ocean']);
const REACH = 30; // sectors out from home, either way
const SKIPPED = new Set(['0,0', '1,0']);
const TRIES = 50; // draws for each planet asked, at most
const kept = (planet, roster) => planet && KEEP.includes(planet.type) && !roster.has(planet.id.toLowerCase());

export function drawPlanets({ count, random, sectorOf, roster = new Set(), tries = TRIES * count }) {
  const ids = [];
  const seen = new Set();
  const side = 2 * REACH + 1;
  for (let t = 0; t < tries && ids.length < count; t++) {
    const sx = Math.floor(random() * side) - REACH;
    const sz = Math.floor(random() * side) - REACH;
    if (SKIPPED.has(`${sx},${sz}`)) continue;
    const { systems } = sectorOf(sx, sz);
    const system = systems[Math.floor(random() * systems.length)];
    const planet = system?.planets[Math.floor(random() * system.planets.length)];
    if (!kept(planet, roster)) continue;
    const id = planet.id.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export const systemPlanets = (system, roster = new Set()) => (system?.planets ?? []).filter((p) => kept(p, roster)).map((p) => p.id.toLowerCase());

// ── the light ──

const ELEVATION = (40 * Math.PI) / 180;
export const SUN = Object.freeze([-Math.cos(ELEVATION) / Math.SQRT2, Math.sin(ELEVATION), -Math.cos(ELEVATION) / Math.SQRT2]);

// the normal is (−gx, 1, −gz), made unit
export function lightOf(gx, gz) {
  const along = (-gx * SUN[0] + SUN[1] - gz * SUN[2]) / Math.hypot(1, gx, gz);
  return 0.55 + 0.45 * Math.max(0, along);
}

// ── the arguments ──

export function argsOf(argv) {
  const args = { count: 24, seed: 1, out: 'lab/planets/contact', system: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--count' || flag === '--seed') {
      const name = flag.slice(2);
      if (!/^-?\d+$/.test(value ?? '') || (name === 'count' && Number(value) < 1)) throw new Error(`--${name} takes a whole number${name === 'count' ? ' from 1' : ''}, not ${value ?? 'nothing'}`);
      args[name] = Number(value);
    } else if (flag === '--out') {
      if (!value || value.startsWith('--')) throw new Error('--out takes a folder');
      args.out = value;
    } else if (flag === '--system') {
      // a system of the middle layer: the one layer makeSector makes
      const at = parseSpaceId(value);
      if (!at || at.sy !== 0 || at.system === undefined || at.planet !== undefined || at.wonder !== undefined) throw new Error(`--system takes a system's id, E:sx,sz:i, not ${value ?? 'nothing'}`);
      args.system = { id: value.toLowerCase(), sx: at.sx, sz: at.sz, i: at.system };
    } else throw new Error(`${flag}: not a flag this script knows\n${USAGE}`);
  }
  return args;
}

// ── the pictures ──

const ORBIT = { width: 512, height: 256 };
const TILE = 384; // px: a ground's side, and a tile's width
const METRES = 8; // a ground pixel's side
const COLUMNS = 6;
const CAPTION = 46;
const GAP = 8;
const BACKGROUND = '#1a2029';

const LINEAR = Float64Array.from({ length: 256 }, (_, b) => (b / 255 <= 0.04045 ? b / 255 / 12.92 : ((b / 255 + 0.055) / 1.055) ** 2.4));
const byteOf = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)));

// the chart's middle, a pixel's height read once: (TILE + 2)² heights, the
// border's for the slopes at the edge
function groundPixels(spec, { planetField, groundColour }) {
  const field = planetField(spec);
  const n = TILE + 2;
  const at = (k) => (k - 1 - TILE / 2 + 0.5) * METRES;
  const h = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = field.heightAt(at(i), at(j));
  const px = Buffer.alloc(TILE * TILE * 3);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const c = (j + 1) * n + i + 1;
      const gx = (h[c + 1] - h[c - 1]) / (2 * METRES);
      const gz = (h[c + n] - h[c - n]) / (2 * METRES);
      const { rgb } = groundColour(spec, { h: h[c], slope: 1 - 1 / Math.hypot(1, gx, gz) });
      const light = lightOf(gx, gz);
      const o = (j * TILE + i) * 3;
      for (let k = 0; k < 3; k++) px[o + k] = byteOf(LINEAR[rgb[k]] * light);
    }
  return px;
}

const escaped = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const captionOf = (row) => {
  const line = [row.type, row.character?.kind ?? 'no character', row.exotic ?? 'not exotic'].join(' · ');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${CAPTION}">` +
      `<text x="4" y="19" font-family="sans-serif" font-size="17" fill="#e8e6df">${row.n} · ${escaped(row.name)}</text>` +
      `<text x="4" y="38" font-family="sans-serif" font-size="13" fill="#9aa3ad">${escaped(line)}</text></svg>`,
  );
};

// what a run writes, so a second run leaves no planet of the first behind
const OURS = /^(?:\d+-(?:orbit|ground)\.png|sheet\.png|index\.json)$/;
function clearOurs(dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (OURS.test(f)) rmSync(join(dir, f));
}

async function sheetOf(rows, dir) {
  const rowsDown = Math.ceil(rows.length / COLUMNS);
  const tall = CAPTION + TILE / 2 + TILE;
  const tiles = [];
  for (const [k, row] of rows.entries()) {
    const left = GAP + (k % COLUMNS) * (TILE + GAP);
    const top = GAP + Math.floor(k / COLUMNS) * (tall + GAP);
    tiles.push({ input: captionOf(row), left, top });
    tiles.push({ input: await sharp(join(dir, row.orbit)).resize(TILE, TILE / 2).png().toBuffer(), left, top: top + CAPTION });
    tiles.push({ input: join(dir, row.ground), left, top: top + CAPTION + TILE / 2 });
  }
  const width = GAP + Math.min(rows.length, COLUMNS) * (TILE + GAP);
  const height = GAP + rowsDown * (tall + GAP);
  await sharp({ create: { width, height, channels: 3, background: BACKGROUND } }).composite(tiles).png().toFile(join(dir, 'sheet.png'));
}

async function main() {
  let args;
  try {
    args = argsOf(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
    return;
  }
  const dir = isAbsolute(args.out) ? args.out : join(ROOT, args.out);
  const shown = relative(ROOT, dir).startsWith('..') ? dir : relative(ROOT, dir) || '.';

  // src modules use Vite's extensionless imports: loaded through Vite
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
  try {
    const { PLANETS, planetSpecOf } = await vite.ssrLoadModule('/src/components/expanse/flight/planets.js');
    const { makeSector } = await vite.ssrLoadModule('/src/components/expanse/gen/sector.js');
    const { UNIVERSE } = await vite.ssrLoadModule('/src/components/expanse/gen/seed.js');
    const { bakeOrbitMap, groundColour } = await vite.ssrLoadModule('/src/lib/land/flight/orbitMap.js');
    const { planetField } = await vite.ssrLoadModule('/src/lib/land/flight/field.js');
    const { seeded } = await vite.ssrLoadModule('/src/lib/seeded.js');

    const sectors = new Map();
    const sectorOf = (sx, sz) => {
      const key = `${sx},${sz}`;
      if (!sectors.has(key)) sectors.set(key, makeSector(UNIVERSE, sx, sz));
      return sectors.get(key);
    };
    const roster = new Set(PLANETS.map((p) => p.id.toLowerCase()));
    const { system } = args;
    const ids = system ? systemPlanets(sectorOf(system.sx, system.sz).systems[system.i], roster) : drawPlanets({ count: args.count, random: seeded(args.seed), sectorOf, roster });

    clearOurs(dir);
    const digits = String(ids.length).length;
    const rows = [];
    for (const id of ids) {
      const spec = planetSpecOf(id);
      if (!spec?.round) {
        console.error(`${id}: no round spec, left out`);
        continue;
      }
      const started = performance.now();
      const n = rows.length + 1;
      const stem = String(n).padStart(digits, '0');
      const row = { n, id, name: spec.name, type: spec.type, character: spec.character, exotic: spec.exotic, weather: spec.weather, sky: spec.sky };
      const map = bakeOrbitMap(spec, ORBIT);
      const orbit = `${stem}-orbit.png`;
      await sharp(Buffer.from(map.rgba.buffer), { raw: { width: map.width, height: map.height, channels: 4 } }).removeAlpha().png().toFile(join(dir, orbit));
      const ground = `${stem}-ground.png`;
      await sharp(groundPixels(spec, { planetField, groundColour }), { raw: { width: TILE, height: TILE, channels: 3 } }).png().toFile(join(dir, ground));
      rows.push({ ...row, orbit, ground });
      const what = [spec.type, spec.character?.kind, spec.exotic].filter(Boolean).join(', ');
      console.log(`${stem} ${id.padEnd(16)} ${spec.name} (${what}) ${((performance.now() - started) / 1000).toFixed(1)} s`);
    }
    if (rows.length) await sheetOf(rows, dir);
    const index = rows.map(({ n, id, name, type, character, exotic, weather, sky }) => ({ n, id, name, type, character, exotic, weather, sky }));
    writeFileSync(join(dir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
    console.log(`${shown}: ${rows.length} planets`);
    if (system ? !rows.length : rows.length < args.count) {
      console.error(system ? `${system.id}: no planet that lands` : `found ${rows.length} of the ${args.count} asked`);
      process.exitCode = 1;
    }
  } finally {
    await vite.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
