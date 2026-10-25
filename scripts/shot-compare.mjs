// Two runs of the same check set side by side: every shot in both folders
// (pixels off by more than OFF in a colour channel, as a share of the shot,
// and the largest difference), and each pose's draw calls, triangles and
// overlay marks from the reports beside the folders (universe-check.mjs's
// <dir>.json, with --lock). Two runs of the same code differ a little (the
// software renderer, the timing of a frame), so a comparison is held to a
// floor: two runs of the code before, written once with --write and read
// with --floor. A move that changes no pixel stays within it.
//
//   node scripts/shot-compare.mjs <before dir> <after dir> [--write floor.json] [--floor floor.json]
//
// Prints each shot and pose, and with --floor an OVER line for each thing
// past it and `within the floor`, or `N over the floor` (exit 1).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// (a channel off by this much or less is the renderer's own wobble)
export const OFF = 8;

// a and b: { data, width, height, channels }: the share of pixels with a
// colour channel off by more than OFF, and the largest difference, or null
// when the two aren't the same size
export function diffPixels(a, b) {
  if (a.width !== b.width || a.height !== b.height) return null;
  const n = a.width * a.height;
  let off = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const ia = i * a.channels;
    const ib = i * b.channels;
    let worst = 0;
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(a.data[ia + c] - b.data[ib + c]));
    if (worst > OFF) off++;
    max = Math.max(max, worst);
  }
  return { share: n ? off / n : 0, max };
}

// Each pose both reports have: its draw calls and triangles before and after,
// and the overlay marks that differ ('<index> <class>'), or its error.
export function compareReports(a, b) {
  const out = {};
  for (const [name, pa] of Object.entries(a.poses ?? {})) {
    const pb = b.poses?.[name];
    if (!pb) continue;
    if (pa.error || pb.error) {
      out[name] = { error: pa.error ?? pb.error };
      continue;
    }
    const ma = pa.overlay ?? [];
    const mb = pb.overlay ?? [];
    const overlay = [];
    for (let i = 0; i < Math.max(ma.length, mb.length); i++) {
      if (JSON.stringify(ma[i]) !== JSON.stringify(mb[i])) overlay.push(`${i} ${(ma[i] ?? mb[i]).c}`);
    }
    out[name] = { calls: [pa.calls, pb.calls], triangles: [pa.triangles, pb.triangles], overlay };
  }
  return out;
}

const pct = (v) => `${(v * 100).toFixed(3)}%`;
const span = (pair) => [Math.min(...pair), Math.max(...pair)];

// What in a comparison goes past the floor (two runs of the code before):
// a shot more off than the floor's, two sizes, a draw call or triangle count
// outside the floor's two, an overlay that differs where the floor's didn't,
// a pose that failed. [] is within the floor.
export function judge(result, floor) {
  const over = [];
  for (const [name, d] of Object.entries(result.images ?? {})) {
    if (!d) {
      over.push(`${name}: the sizes differ`);
      continue;
    }
    const allowed = floor.images?.[name]?.share ?? 0;
    if (d.share > allowed) over.push(`${name}: ${pct(d.share)} of pixels off, over the floor's ${pct(allowed)}`);
  }
  for (const [name, p] of Object.entries(result.poses ?? {})) {
    if (p.error) {
      over.push(`${name}: the pose failed (${p.error})`);
      continue;
    }
    const f = floor.poses?.[name];
    for (const key of ['calls', 'triangles']) {
      if (!f?.[key]) continue;
      const [lo, hi] = span(f[key]);
      const after = p[key][1];
      if (after < lo || after > hi) over.push(`${name}: ${after} ${key}, outside the floor's ${lo}–${hi}`);
    }
    if (p.overlay?.length && !f?.overlay?.length) over.push(`${name}: the overlay differs (${p.overlay.join(', ')})`);
  }
  return over;
}

async function pixels(file) {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function readReport(dir) {
  const f = `${dir.replace(/\/$/, '')}.json`;
  return existsSync(f) ? JSON.parse(await readFile(f, 'utf8')) : { poses: {} };
}

async function main(argv) {
  const dirs = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
    else dirs.push(resolve(argv[i]));
  }
  if (dirs.length !== 2) throw new Error('usage: shot-compare.mjs <before dir> <after dir> [--write floor.json] [--floor floor.json]');
  const [before, after] = dirs;
  const shots = (await readdir(before)).filter((f) => /\.(webp|png)$/.test(f)).sort();
  const images = {};
  for (const f of shots) {
    if (!existsSync(join(after, f))) {
      images[f] = null;
      continue;
    }
    images[f] = diffPixels(await pixels(join(before, f)), await pixels(join(after, f)));
    console.log(`${f.padEnd(32)} ${images[f] ? `${pct(images[f].share).padStart(9)} off, max ${images[f].max}` : 'sizes differ'}`);
  }
  const poses = compareReports(await readReport(before), await readReport(after));
  for (const [name, p] of Object.entries(poses)) console.log(`${name.padEnd(32)} ${p.error ? `error ${p.error}` : `calls ${p.calls.join(' → ')}  tris ${p.triangles.join(' → ')}${p.overlay.length ? `  overlay ${p.overlay.join(', ')}` : ''}`}`);
  const result = { images, poses };
  if (flags.write) {
    await writeFile(flags.write, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`wrote ${basename(flags.write)}`);
  }
  if (flags.floor) {
    const over = judge(result, JSON.parse(await readFile(flags.floor, 'utf8')));
    for (const o of over) console.log(`OVER ${o}`);
    console.log(over.length ? `${over.length} over the floor` : 'within the floor');
    return over.length ? 1 : 0;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
