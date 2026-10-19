// A contact sheet of generated planets, each seen from orbit and on the
// ground, for judging by eye that no two are one planet recoloured and that
// the world seen from orbit is the world landed on.
//
// A seeded draw picks an Expanse sector (x and z in −30…30, never the
// authored (0, 0) or the seeded (1, 0)), then a system and a planet in it,
// and keeps the landable families (rock, ice, desert, forest, lava, ocean),
// skipping the fifty and any planet drawn before, until it has `count`. For
// each planet:
//   - n-orbit.png, its orbit map, bakeOrbitMap at 512 × 256 (the bake's
//     colours, the sea painted as the water sheet draws it; the bake's alpha,
//     0 under water, is what the progress line's sea share counts)
//   - n-ground.png, 384 × 384 px: the middle 3 km of its chart (round the
//     first place, where a ship lands) at 8 m a pixel, north up, each pixel
//     groundColour × (0.55 + 0.45 × max(0, normal · sun)), the sun from the
//     north-west 40° up (the water's surface is flat, so it's lit flat)
// and then sheet.png (6 columns, the orbit map at 384 × 192 over the ground,
// a ring on the map where the ground is, and a caption: name, type,
// character and exotic) and index.json ([{ n, id, name, type, character,
// exotic, weather, sky }]). A 512 × 256 bake takes a few seconds, so 24
// planets take a couple of minutes. Exits 1 when it found fewer than count.
//
//   node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--out lab/planets/contact]
//
// Writes to lab/planets/contact/ (git-ignored: lab/* is the contact sheets
// the scripts write for looking over).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '24' },
    seed: { type: 'string', default: '1' },
    out: { type: 'string', default: 'lab/planets/contact' },
  },
});
const COUNT = Number(args.count);
const SEED = Number(args.seed);
if (!Number.isInteger(COUNT) || COUNT < 1) throw new Error(`--count wants a whole number of planets, not ${args.count}.`);
if (!Number.isFinite(SEED)) throw new Error(`--seed wants a number, not ${args.seed}.`);
const OUT = join(ROOT, args.out);

const TYPES = new Set(['rock', 'ice', 'desert', 'forest', 'lava', 'ocean']);
const SPAN = 30;
// the authored sector and the seeded one: the roster's, not the generator's to show
const KEEP_OUT = new Set(['0,0', '1,0']);
// draws before giving up: a sector can come up empty, a planet gas or drawn before
const TRIES = 200;

const ORBIT = { width: 512, height: 256 };
const GROUND = 384; // px
const METRES = 8; // a pixel
// toward the sun, chart +x east and −z north: from the north-west, 40° up
const UP = (40 * Math.PI) / 180;
const SUN = [-Math.cos(UP) * Math.SQRT1_2, Math.sin(UP), -Math.cos(UP) * Math.SQRT1_2];

const COLS = 6;
const TILE = { width: 384, map: 192, caption: 44 };
const TILE_H = TILE.map + GROUND + TILE.caption;
const GAP = 8;

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// src modules use Vite's extensionless imports: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let found = 0;
try {
  const { PLANETS, planetSpecOf } = await vite.ssrLoadModule('/src/components/expanse/flight/planets.js');
  const { makeSector } = await vite.ssrLoadModule('/src/components/expanse/gen/sector.js');
  const { UNIVERSE } = await vite.ssrLoadModule('/src/components/expanse/gen/seed.js');
  const { bakeOrbitMap, groundColour } = await vite.ssrLoadModule('/src/lib/land/flight/orbitMap.js');
  const { planetField } = await vite.ssrLoadModule('/src/lib/land/flight/field.js');
  const { uvOfDir } = await vite.ssrLoadModule('/src/lib/land/flight/sphere.js');
  const { seeded } = await vite.ssrLoadModule('/src/lib/seeded.js');

  // ── the draw ──

  const roster = new Set(PLANETS.map((p) => p.id));
  const rnd = seeded(SEED);
  const coord = () => Math.floor(rnd() * (2 * SPAN + 1)) - SPAN;
  const chosen = [];
  const seen = new Set();
  for (let t = 0; t < COUNT * TRIES && chosen.length < COUNT; t++) {
    const sx = coord();
    const sz = coord();
    // (both drawn whatever the sector holds, so every try reads four numbers)
    const a = rnd();
    const b = rnd();
    const s = makeSector(UNIVERSE, sx, sz).systems;
    const system = s[Math.floor(a * s.length)] ?? null;
    const p = system ? system.planets[Math.floor(b * system.planets.length)] : null;
    if (KEEP_OUT.has(`${sx},${sz}`) || !p || !TYPES.has(p.type)) continue;
    const id = p.id.toLowerCase();
    if (roster.has(id) || seen.has(id)) continue;
    seen.add(id);
    chosen.push(id);
  }

  await mkdir(OUT, { recursive: true });

  // ── the ground ──

  // heights at the pixels' middles and a ring of pixels round them, so every
  // pixel's slope is read 8 m either way, as the flight's ground reads it
  function groundOf(spec) {
    const field = planetField(spec);
    const N = GROUND + 2;
    const half = GROUND / 2;
    const h = new Float64Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = (j - 0.5 - half) * METRES;
      for (let i = 0; i < N; i++) h[j * N + i] = field.heightAt((i - 0.5 - half) * METRES, z);
    }
    const rgb = Buffer.alloc(GROUND * GROUND * 3);
    for (let j = 0; j < GROUND; j++) {
      for (let i = 0; i < GROUND; i++) {
        const k = (j + 1) * N + i + 1;
        const gx = (h[k + 1] - h[k - 1]) / (2 * METRES);
        const gz = (h[k + N] - h[k - N]) / (2 * METRES);
        const len = Math.hypot(1, gx, gz);
        const { rgb: c, water } = groundColour(spec, { h: h[k], slope: 1 - 1 / len });
        const lit = water ? SUN[1] : (-gx * SUN[0] + SUN[1] - gz * SUN[2]) / len;
        const f = 0.55 + 0.45 * Math.max(0, lit);
        const at = (j * GROUND + i) * 3;
        for (let c3 = 0; c3 < 3; c3++) rgb[at + c3] = Math.round(c[c3] * f);
      }
    }
    return rgb;
  }

  // ── each planet ──

  const index = [];
  const tiles = [];
  for (const [k, id] of chosen.entries()) {
    const n = k + 1;
    const t0 = performance.now();
    const spec = planetSpecOf(id);
    if (!spec?.round) {
      console.log(`  ${n}/${chosen.length} ${id}: no round spec, left out`);
      continue;
    }
    const map = bakeOrbitMap(spec, ORBIT);
    let sea = 0;
    for (let i = 3; i < map.rgba.length; i += 4) if (map.rgba[i] === 0) sea++;
    const orbit = await sharp(Buffer.from(map.rgba.buffer), { raw: { width: map.width, height: map.height, channels: 4 } })
      .removeAlpha()
      .png()
      .toBuffer();
    const ground = await sharp(groundOf(spec), { raw: { width: GROUND, height: GROUND, channels: 3 } }).png().toBuffer();
    await writeFile(join(OUT, `${n}-orbit.png`), orbit);
    await writeFile(join(OUT, `${n}-ground.png`), ground);

    const { character: ch, exotic } = spec;
    index.push({ n, id, name: spec.name, type: spec.type, character: ch, exotic, weather: spec.weather, sky: spec.sky });
    const land = `${ch.kind}, sea ${Math.round(ch.sea * 100)}%, peaks ${Math.round(ch.peaks)} m`;
    const [u, v] = uvOfDir(spec.round.at);
    const caption = Buffer.from(
      `<svg width="${TILE.width}" height="${TILE_H}" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="${u * TILE.width}" cy="${v * TILE.map}" r="7" fill="none" stroke="#ffffff" stroke-width="2"/>` +
        `<circle cx="${u * TILE.width}" cy="${v * TILE.map}" r="9" fill="none" stroke="#000000" stroke-width="1.5"/>` +
        `<g font-family="sans-serif" font-size="15">` +
        `<text x="8" y="${TILE.map + GROUND + 18}" fill="#ffffff">${n}. ${xml(spec.name)} · ${xml(spec.type)}</text>` +
        `<text x="${TILE.width - 8}" y="${TILE.map + GROUND + 18}" fill="#8a8f98" font-size="12" text-anchor="end">${xml(id)}</text>` +
        `<text x="8" y="${TILE.map + GROUND + 37}" fill="#c9ced6" font-size="13">${xml(land)} · ${xml(exotic ?? 'no exotic')}</text>` +
        `</g></svg>`,
    );
    const mapTile = await sharp(orbit).resize(TILE.width, TILE.map).toBuffer();
    tiles.push(
      await sharp({ create: { width: TILE.width, height: TILE_H, channels: 3, background: '#16181c' } })
        .composite([
          { input: mapTile, left: 0, top: 0 },
          { input: ground, left: 0, top: TILE.map },
          { input: caption, left: 0, top: 0 },
        ])
        .png()
        .toBuffer(),
    );
    found++;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`  ${n}/${chosen.length} ${id}  ${spec.name} · ${spec.type} · ${land} · sea ${Math.round((100 * sea) / (map.width * map.height))}% of the map  ${secs} s`);
  }

  // ── the sheet and the index ──

  if (tiles.length) {
    const rows = Math.ceil(tiles.length / COLS);
    const cols = Math.min(COLS, tiles.length);
    await sharp({
      create: { width: GAP + cols * (TILE.width + GAP), height: GAP + rows * (TILE_H + GAP), channels: 3, background: '#0b0c0e' },
    })
      .composite(tiles.map((input, i) => ({ input, left: GAP + (i % COLS) * (TILE.width + GAP), top: GAP + Math.floor(i / COLS) * (TILE_H + GAP) })))
      .png()
      .toFile(join(OUT, 'sheet.png'));
  }
  await writeFile(join(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`${args.out}: ${found} planets`);
} finally {
  await vite.close();
}
if (found < COUNT) {
  console.error(`found ${found} of ${COUNT} planets in ${COUNT * TRIES} draws`);
  process.exitCode = 1;
}
