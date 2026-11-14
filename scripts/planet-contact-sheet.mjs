// A contact sheet of generated planets, for judging "unique" by eye (the
// endless universe's spec, section E): a seeded draw of rocky, icy, desert,
// forest, lava and ocean planets from the Expanse, never the roster's, each
// shown from orbit (its baked orbit map, lib/land/flight/orbitMap.js, flat
// and on a lit globe with a preview of its clouds and air from its spec's
// sky: lane 5b's orbit shader is the real one), its sky, and on the ground
// (the chart's middle 3 km, 8 m a pixel, lit from the north-west, in the
// same colour rule), captioned with its name, type, character and any exotic
// touch.
//
//   node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--out lab/planets/contact]
//
// Writes <out>/<n>-orbit.png, <n>-ground.png, sheet.png (6 columns) and
// index.json; lab/* is git-ignored, so nothing it writes is committed. Exits
// 1 when it finds fewer planets than asked.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const COUNT = Number(arg('count', 24));
const SEED = Number(arg('seed', 1));
const OUT = arg('out', 'lab/planets/contact');
const LANDABLE = new Set(['rock', 'ice', 'desert', 'forest', 'lava', 'ocean']);
const COLS = 6;
const TILE = 384;
const GROUND = 384; // px
const METRES = 8; // a pixel
const CAPTION = 56;

// src modules use Vite's extensionless imports: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { planetSpecOf, PLANETS } = await vite.ssrLoadModule('/src/components/expanse/flight/planets.js');
  const { makeSector } = await vite.ssrLoadModule('/src/components/expanse/gen/sector.js');
  const { UNIVERSE } = await vite.ssrLoadModule('/src/components/expanse/gen/seed.js');
  const { bakeOrbitMap, groundColour } = await vite.ssrLoadModule('/src/lib/land/flight/orbitMap.js');
  const { planetField } = await vite.ssrLoadModule('/src/lib/land/flight/field.js');
  const { seeded } = await vite.ssrLoadModule('/src/lib/seeded.js');
  const { noise3For } = await vite.ssrLoadModule('/src/lib/land/flight/fnl.js');
  const { uvOfDir } = await vite.ssrLoadModule('/src/lib/land/flight/sphere.js');

  // ── choosing ──
  const rnd = seeded(SEED);
  const roster = new Set(PLANETS.map((p) => p.id));
  const picked = [];
  const seen = new Set();
  for (let tries = 0; picked.length < COUNT && tries < COUNT * 200; tries++) {
    const sx = Math.floor(rnd() * 61) - 30;
    const sz = Math.floor(rnd() * 61) - 30;
    if ((sx === 0 || sx === 1) && sz === 0) continue;
    const systems = makeSector(UNIVERSE, sx, sz).systems;
    if (!systems.length) continue;
    const s = systems[Math.floor(rnd() * systems.length)];
    const p = s.planets[Math.floor(rnd() * s.planets.length)];
    const id = p.id.toLowerCase();
    if (!LANDABLE.has(p.type) || roster.has(id) || seen.has(id)) continue;
    seen.add(id);
    picked.push(planetSpecOf(id));
  }

  // ── drawing ──
  const out = `${ROOT}${OUT}`;
  mkdirSync(out, { recursive: true });
  const png = (rgb, w, h) => sharp(Buffer.from(rgb), { raw: { width: w, height: h, channels: 3 } }).png();
  const sun = (() => {
    const e = (30 * Math.PI) / 180;
    const v = [-Math.cos(e) * Math.SQRT1_2, Math.sin(e), -Math.cos(e) * Math.SQRT1_2];
    return v;
  })();

  function groundImage(spec) {
    const f = planetField(spec);
    const rgb = new Uint8Array(GROUND * GROUND * 3);
    const half = (GROUND * METRES) / 2;
    for (let j = 0; j < GROUND; j++)
      for (let i = 0; i < GROUND; i++) {
        const x = -half + (i + 0.5) * METRES;
        const z = -half + (j + 0.5) * METRES;
        const h = f.heightAt(x, z);
        const gx = (f.heightAt(x + METRES, z) - f.heightAt(x - METRES, z)) / (2 * METRES);
        const gz = (f.heightAt(x, z + METRES) - f.heightAt(x, z - METRES)) / (2 * METRES);
        const len = Math.hypot(gx, 1, gz);
        const n = [-gx / len, 1 / len, -gz / len];
        const lit = 0.4 + 0.6 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
        const { rgb: c } = groundColour(spec, { h, slope: 1 - 1 / len });
        const k = (j * GROUND + i) * 3;
        for (let q = 0; q < 3; q++) rgb[k + q] = Math.min(255, Math.round(c[q] * lit));
      }
    return rgb;
  }

  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // the map on a globe, lit from the upper left, its clouds and its air over it (a preview)
  const GLOBE = TILE / 2;
  function globeImage(spec, orbit) {
    const rgb = new Uint8Array(GLOBE * GLOBE * 3);
    const clouds = noise3For(spec.seed + 99, { frequency: 2.4, octaves: 5, warp: 0.3 });
    const cloud = rgbOf(spec.sky.cloudColour);
    const air = rgbOf(spec.sky.high);
    const glow = rgbOf(spec.sky.low);
    const L = [-0.55, 0.45, 0.7];
    const ll = Math.hypot(...L);
    const turn = spec.seed % 360;
    const [c, s] = [Math.cos((turn * Math.PI) / 180), Math.sin((turn * Math.PI) / 180)];
    for (let j = 0; j < GLOBE; j++)
      for (let i = 0; i < GLOBE; i++) {
        const x = ((i + 0.5) / GLOBE) * 2.2 - 1.1;
        const y = 1.1 - ((j + 0.5) / GLOBE) * 2.2;
        const r2 = x * x + y * y;
        const k = (j * GLOBE + i) * 3;
        if (r2 > 1) {
          const halo = Math.max(0, 1 - (Math.sqrt(r2) - 1) / 0.09) ** 2 * (0.35 + 0.65 * spec.sky.haze);
          for (let q = 0; q < 3; q++) rgb[k + q] = Math.round(air[q] * halo * 0.8);
          continue;
        }
        const z = Math.sqrt(1 - r2);
        const dir = [x * c + z * s, y, -x * s + z * c];
        const [u, v] = uvOfDir(dir);
        const t = (Math.min(orbit.height - 1, Math.floor(v * orbit.height)) * orbit.width + Math.min(orbit.width - 1, Math.floor(u * orbit.width))) * 4;
        let col = [orbit.rgba[t], orbit.rgba[t + 1], orbit.rgba[t + 2]];
        const cl = smooth(1 - spec.sky.clouds * 0.9, 1.15 - spec.sky.clouds * 0.9, clouds(...dir) * 0.5 + 0.5);
        col = col.map((v2, q) => v2 + (cloud[q] - v2) * cl * 0.9);
        const lit = 0.12 + 0.88 * Math.max(0, (x * L[0] + y * L[1] + z * L[2]) / ll);
        const rim = (1 - z) ** 3 * (0.3 + 0.7 * spec.sky.haze);
        for (let q = 0; q < 3; q++) rgb[k + q] = Math.min(255, Math.round(col[q] * lit + glow[q] * rim * lit + air[q] * rim * 0.25));
      }
    return rgb;
  }

  // its sky, from the ground looking up: its high colour over its low, and its haze
  function skyImage(spec, w, h) {
    const rgb = new Uint8Array(w * h * 3);
    const lo = rgbOf(spec.sky.low);
    const hi = rgbOf(spec.sky.high);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const t = (j / (h - 1)) ** (1 - spec.sky.haze * 0.6);
        for (let q = 0; q < 3; q++) rgb[(j * w + i) * 3 + q] = Math.round(hi[q] + (lo[q] - hi[q]) * t);
      }
    return rgb;
  }

  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const tiles = [];
  const index = [];
  for (const [n, spec] of picked.entries()) {
    const orbit = bakeOrbitMap(spec, { width: 512, height: 256 });
    const orbitRgb = new Uint8Array(512 * 256 * 3);
    for (let k = 0; k < 512 * 256; k++) for (let q = 0; q < 3; q++) orbitRgb[k * 3 + q] = orbit.rgba[k * 4 + q];
    await png(orbitRgb, 512, 256).toFile(`${out}/${n}-orbit.png`);
    const ground = groundImage(spec);
    await png(ground, GROUND, GROUND).toFile(`${out}/${n}-ground.png`);
    const caption = `${spec.name} · ${spec.type} · ${spec.character?.kind ?? '—'}${spec.exotic ? ` · ${spec.exotic}` : ''}`;
    const sub = `${spec.id} · ${spec.weather.kind} · ${spec.pois.map((p) => p.kind).join(', ') || 'no places'}`;
    const svg = `<svg width="${TILE}" height="${CAPTION}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="8" y="22" font-family="sans-serif" font-size="17" fill="#eee">${esc(caption)}</text><text x="8" y="44" font-family="sans-serif" font-size="12" fill="#9a9a9a">${esc(sub)}</text></svg>`;
    tiles.push({
      left: (n % COLS) * TILE,
      top: Math.floor(n / COLS) * (TILE / 2 + GROUND + CAPTION),
      parts: [
        { input: await png(globeImage(spec, orbit), GLOBE, GLOBE).toBuffer(), dy: 0 },
        { input: await png(orbitRgb, 512, 256).resize(TILE / 2, TILE / 4).toBuffer(), dy: 0, dx: TILE / 2 },
        { input: await png(skyImage(spec, TILE / 2, TILE / 4), TILE / 2, TILE / 4).toBuffer(), dy: TILE / 4, dx: TILE / 2 },
        { input: await png(ground, GROUND, GROUND).toBuffer(), dy: TILE / 2 },
        { input: Buffer.from(svg), dy: TILE / 2 + GROUND },
      ],
    });
    index.push({ n, id: spec.id, name: spec.name, type: spec.type, character: spec.character, exotic: spec.exotic, weather: spec.weather, sky: spec.sky });
  }
  const rows = Math.ceil(picked.length / COLS);
  const sheet = sharp({ create: { width: COLS * TILE, height: Math.max(1, rows) * (TILE / 2 + GROUND + CAPTION), channels: 3, background: '#000' } });
  await sheet.composite(tiles.flatMap((t) => t.parts.map((p) => ({ input: p.input, left: t.left + (p.dx ?? 0), top: t.top + p.dy })))).png().toFile(`${out}/sheet.png`);
  writeFileSync(`${out}/index.json`, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`${OUT}: ${picked.length} planets`);
  if (picked.length < COUNT) process.exitCode = 1;
} finally {
  await vite.close();
}
