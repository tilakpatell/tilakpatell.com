// Every rigged figure and clip the worlds load, checked by name against the
// code that animates them (src/lib/three/rigCheck.js): a figure missing a
// role (a foot, the toes the stride is measured by) or a clip with a track
// for a bone the figures lack is found here, at commit, not by a visitor as
// a T-pose. One row a file: its family, joints, toes, clips and their
// unresolved tracks, and the hips' height (the bake's extras.hips, else the
// Hips node's rest y).
//
//   node scripts/rig-check.mjs [--check] [--figure family=path.glb] [paths…]
//
// With no paths, the committed rigs and clips: public/games/meshy/rick-*,
// clips-* and ual-*.glb, and public/models/galaxy/troops/*.glb. A clip file
// carries no skin, so its tracks are checked against a figure of its family
// (Meshy's: Luke, whose rest skeleton the UAL clips are baked onto; another
// with --figure). --check exits 1 on a failure, except a path listed in
// scripts/rig-check.allow.json with the reason it's known.
//
// It reads only the GLB's JSON chunk (names, the node tree, the animations'
// channels and extras), never its buffers: the whole set in well under a
// second, and no meshopt decoder for the files that need one (which
// @gltf-transform/core's NodeIO, as the bake uses, would want registered).

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkClip, checkRig, hipsOf } from '../src/lib/three/rigCheck.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ALLOW = join(ROOT, 'scripts/rig-check.allow.json');
// a figure of each family the clip files are played on
export const FIGURES = { meshy: 'public/models/galaxy/crew/luke.glb' };
// the committed rigs and clips: a directory and the names in it
const SETS = [
  ['public/games/meshy', /^(rick|clips|ual)-.*\.glb$/],
  ['public/models/galaxy/troops', /\.glb$/],
];

export function committed(root = ROOT) {
  return SETS.flatMap(([dir, re]) =>
    readdirSync(join(root, dir))
      .filter((n) => re.test(n))
      .sort()
      .map((n) => `${dir}/${n}`),
  );
}

// a GLB's (or a .gltf's) JSON
export function readGltf(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) return JSON.parse(buf.toString('utf8')); // not 'glTF': a .gltf
  const len = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('the first chunk is not JSON');
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

// glTF's channel paths in three's track names
const PATH = { translation: 'position', rotation: 'quaternion', scale: 'scale', weights: 'morphTargetInfluences' };

// what a file holds, by name
export function describe(json) {
  const nodes = json.nodes ?? [];
  const name = (i) => nodes[i]?.name ?? `node_${i}`;
  const joints = [...new Set((json.skins ?? []).flatMap((s) => s.joints ?? []))].map(name);
  const clips = (json.animations ?? []).map((a, k) => ({
    name: a.name ?? `animation_${k}`,
    extras: a.extras ?? {},
    tracks: [...new Set((a.channels ?? []).filter((c) => c.target?.node != null).map((c) => `${name(c.target.node)}.${PATH[c.target.path] ?? c.target.path}`))],
  }));
  const rest = (n) => {
    const i = nodes.findIndex((o) => o.name === n);
    return i < 0 ? null : { position: { y: nodes[i].translation?.[1] ?? 0 } };
  };
  return { nodes: nodes.map((o, i) => o.name ?? `node_${i}`), joints, clips, rest };
}

const round = (v) => (v == null ? null : Math.round(v * 100) / 100);

// One file's row. `figures`: { family: joint names } for clip files.
export function checkFile(json, { figures = {} } = {}) {
  const d = describe(json);
  const failures = [];
  const skinned = d.joints.length > 0;
  const rig = checkRig(skinned ? d.joints : d.nodes);
  if (skinned && rig.missing.length) failures.push(`missing ${rig.missing.join(', ')}`);
  const against = skinned ? d.joints : figures[rig.family];
  const clips = d.clips.map((c) => {
    const r = against ? checkClip(c.tracks, against) : { unresolved: c.tracks, root: null };
    if (!against) failures.push(`${c.name}: no ${rig.family ?? 'known'} figure to play on`);
    else if (r.unresolved.length) failures.push(`${c.name}: ${r.unresolved.length} unresolved (${r.unresolved.slice(0, 3).join(', ')}${r.unresolved.length > 3 ? '…' : ''})`);
    return { name: c.name, tracks: c.tracks.length, unresolved: r.unresolved, root: r.root, hips: round(hipsOf({ userData: { ...c.extras } }, d.rest(rig.roles.hips))) };
  });
  const hips = clips[0]?.hips ?? round(d.rest(rig.roles.hips)?.position.y ?? null);
  return { family: rig.family, joints: d.joints.length, toes: rig.toes, missing: rig.missing, clips, hips, failures };
}

export function loadAllow(path = ALLOW) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

const readFile = (root, p) => readGltf(readFileSync(join(root, p)));

// Every path's row, with whether it fails and whether that's allowed.
export function checkFiles(paths = committed(), { root = ROOT, allow = loadAllow(), figures = FIGURES } = {}) {
  const joints = {};
  for (const [fam, p] of Object.entries(figures)) joints[fam] = describe(readFile(root, p)).joints;
  return paths.map((p) => {
    const file = relative(root, join(root, p)).split('\\').join('/');
    let row;
    try {
      row = checkFile(readFile(root, file), { figures: joints });
    } catch (e) {
      row = { family: null, joints: 0, toes: false, missing: [], clips: [], hips: null, failures: [`unreadable: ${e.message}`] };
    }
    const ok = row.failures.length === 0;
    return { file, ...row, ok, allowed: !ok && file in allow ? allow[file] : null };
  });
}

export function table(rows) {
  const head = ['file', 'family', 'joints', 'toes', 'clips', 'hips', 'verdict'];
  const cells = rows.map((r) => [
    r.file,
    r.family ?? '?',
    String(r.joints),
    r.joints ? (r.toes ? 'yes' : 'no') : '-',
    r.clips.length ? r.clips.map((c) => `${c.name}${c.unresolved.length ? ` (${c.unresolved.length} unresolved)` : ''}`).join('; ') : '-',
    r.hips == null ? '-' : String(r.hips),
    r.ok ? 'ok' : r.allowed ? `allowed: ${r.allowed}` : `FAIL: ${r.failures.join('; ')}`,
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...cells.map((c) => (i === 6 ? 0 : c[i].length))));
  return [head, ...cells].map((c) => c.map((v, i) => (i === 6 ? v : v.padEnd(w[i]))).join('  ')).join('\n');
}

function main(argv) {
  const check = argv.includes('--check');
  const figures = { ...FIGURES };
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') continue;
    if (argv[i] === '--figure') {
      const [fam, p] = String(argv[++i]).split('=');
      figures[fam] = relative(ROOT, resolve(p));
    } else paths.push(relative(ROOT, resolve(argv[i])));
  }
  const rows = checkFiles(paths.length ? paths : committed(), { figures });
  console.log(table(rows));
  const bad = rows.filter((r) => !r.ok && !r.allowed);
  const stale = Object.keys(loadAllow()).filter((f) => rows.some((r) => r.file === f && r.ok));
  for (const f of stale) console.log(`(${f} passes now: take it off scripts/rig-check.allow.json)`);
  console.log(`${rows.length} files, ${rows.filter((r) => r.ok).length} ok, ${rows.filter((r) => r.allowed).length} allowed, ${bad.length} failing`);
  if (check && bad.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
