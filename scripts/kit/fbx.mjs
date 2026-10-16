// A Quaternius pack that comes as FBX only (the farm animals, the street and
// the furniture packs) as GLBs the kit's import reads: every
// lab/assets/<pack>/FBX/<Name>.fbx through scripts/fbx-to-glb.mjs (three's
// FBXLoader and GLTFExporter in headless Chromium, through the dev server;
// skeleton, skin and clips kept, the FBX's material colours as they are) into
// lab/assets/<pack>-glb/<Name>.glb, which scripts/kit/import.mjs's SOURCES
// reads. Each GLB is then rewritten in three ways: in metres (the FBX is in
// centimetres, which FBXLoader keeps), with each clip named for its action
// alone (Blender's exporter names it for its armature too, `Armature|Walk`),
// so the manifest and the runtime's mixer know `Walk`, and without the notes
// FBXLoader leaves on every node (an eighth of the farm's bytes).
// The dev server is the one on 5188 when it is up, else one started here on
// a free port and stopped at the end, error or not. The manual is
// scripts/kit/README.md.
//
//   node scripts/kit/fbx.mjs <pack>
//   clipName(name) → string        ('Armature|Walk' → 'Walk')
//   renameClips(doc) → string[]    (a gltf-transform Document's clips renamed so; their names)
//   toMetres(doc) → number         (its root scaled by extras.unitScaleFactor / 100; that scale)
//   dropLoaderNotes(doc) → number  (FBXLoader's node extras taken off; how many nodes had them)
//   convertPack(pack, { log }) → [{ name, file, clips }]

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEV = 'http://127.0.0.1:5188';

// A clip's name without the armature Blender's FBX export puts before it.
export const clipName = (name) => name.replace(/^.*\|/, '');

// The scene in metres. FBXLoader keeps the file's units, and Blender's FBX
// is in centimetres (UnitScaleFactor 1, every object scaled ×100: a horse
// 692 tall); the factor rides on the scene's root as `extras.unitScaleFactor`,
// so the root is scaled by it over 100, which gives the pack's OBJ sizes, and
// the factor is taken off (doing it twice changes nothing). Returns the scale
// applied.
export function toMetres(doc) {
  let applied = 1;
  for (const scene of doc.getRoot().listScenes()) {
    for (const node of scene.listChildren()) {
      const { unitScaleFactor: unit, ...rest } = node.getExtras();
      if (typeof unit !== 'number') continue;
      applied = unit / 100;
      node.setScale(node.getScale().map((s) => s * applied)).setExtras(rest);
    }
  }
  return applied;
}

// Every clip in the document renamed so. Two that come to one name would
// leave the second unreachable by it, so that is an error.
export function renameClips(doc) {
  const names = [];
  for (const anim of doc.getRoot().listAnimations()) {
    const name = clipName(anim.getName());
    if (names.includes(name)) throw new Error(`two clips named ${name}`);
    anim.setName(name);
    names.push(name);
  }
  return names;
}

// What FBXLoader keeps on each node for its own use, `originalName` and
// `transformData` (its rotation order, pivots and parents' matrices), which
// GLTFExporter writes out as extras: nothing reads them after the load, and
// they were 130 KB of the farm's 1.05 MB. Any other extra stays.
const LOADER_NOTES = ['originalName', 'transformData'];
export function dropLoaderNotes(doc) {
  let n = 0;
  for (const node of doc.getRoot().listNodes()) {
    const extras = node.getExtras();
    if (!LOADER_NOTES.some((k) => k in extras)) continue;
    node.setExtras(Object.fromEntries(Object.entries(extras).filter(([k]) => !LOADER_NOTES.includes(k))));
    n++;
  }
  return n;
}

const answers = async (url) => {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
};

// The dev server fbx-to-glb reads through: 5188's if it answers, else vite
// started on a free port (as scripts/bake-floor-shadows.mjs does). `stop`
// stops only a server started here.
async function devServer(log) {
  if (await answers(DEV)) return { base: DEV, stop: () => {} };
  const port = await new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
  // vite found as node finds it: a worktree has no node_modules of its own
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  const server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  const stop = () => {
    process.off('exit', stop);
    server.kill();
  };
  process.once('exit', stop);
  const base = `http://127.0.0.1:${port}`;
  for (const t0 = Date.now(); !(await answers(base)); ) {
    if (Date.now() - t0 > 60000) {
      stop();
      throw new Error('vite never answered');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  log(`dev server on ${port} (5188 is down)`);
  return { base, stop };
}

async function convertPack(pack, { log = console.log } = {}) {
  const src = join(ROOT, 'lab', 'assets', pack, 'FBX');
  if (!existsSync(src)) throw new Error(`no ${src}: fetch the pack first (node scripts/assets-fetch.mjs ${pack})`);
  const fbx = readdirSync(src).filter((f) => extname(f).toLowerCase() === '.fbx').sort();
  if (!fbx.length) throw new Error(`no .fbx in ${src}`);
  const out = join(ROOT, 'lab', 'assets', `${pack}-glb`);
  await mkdir(out, { recursive: true });
  const { fbxToGlb } = await import('../fbx-to-glb.mjs');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const server = await devServer(log);
  try {
    const done = [];
    for (const f of fbx) {
      const name = f.slice(0, -extname(f).length);
      const file = join(out, `${name}.glb`);
      await fbxToGlb(join(src, f), file, { base: server.base });
      const doc = await io.read(file);
      toMetres(doc);
      dropLoaderNotes(doc);
      const clips = renameClips(doc);
      await io.write(file, doc);
      log(`${`${name}.glb`.padEnd(24)} ${String(Math.round((await stat(file)).size / 1024)).padStart(5)} KB  ${clips.length ? clips.join(', ') : 'no clips'}`);
      done.push({ name, file, clips });
    }
    log(`${done.length} files → ${out}`);
    return done;
  } finally {
    server.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pack = process.argv[2];
  if (!pack) {
    console.log('node scripts/kit/fbx.mjs <pack>');
    process.exit(1);
  }
  await convertPack(pack);
}
