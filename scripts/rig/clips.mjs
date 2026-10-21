// A skinned figure's own idle, walk and run, beside it as Meshy's figures
// have theirs (NAME-idle.glb, NAME-walk.glb, NAME-run.glb: what
// src/components/middleearth/road/cast.js loads a figure with), made from
// the site's clip library the way clipLibrary.js's forFigure makes a copy
// for a figure: each bone's turn as the clip has it, the hips' height
// scaled from the clip's rig to this one's; nothing else (another bone's
// offset would stretch the figure to the clip's proportions). Each file is
// the figure's skeleton and the one clip, nothing to draw.
//
// Which clips: the Universal Animation Library's (Quaternius, CC0), baked
// onto Luke's skeleton, which skin.mjs's skeleton is fitted from. On a
// big-headed figure they keep the feet down where Meshy's own walk, made
// on Rick's rig, lets a planted toe slide (rig-check.mjs: 0.11 m/s against
// 0.35 on the first figure, the bar 0.15).
//
//   node scripts/rig/clips.mjs FIGURE.glb [--idle idle.calm --walk walk.formal --run sprint]
//   ownClips(figure, { idle, walk, run }) → { idle: file, walk: file, run: file }

import { Document } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LOCO = { idle: 'idle.calm', walk: 'walk.formal', run: 'sprint' };

// the library's file for a clip, by its name there (clipLibrary.js's CLIPS, read as text: it imports three)
export function fileOf(name) {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'three', 'clipLibrary.js'), 'utf8');
  const esc = name.replace(/[.]/g, '\\.');
  const m = src.match(new RegExp(`^\\s*(?:'${esc}'|${esc}): \\{ url: \`\\$\\{(BASE|TROOPS)\\}/([^\`]+)\``, 'm'));
  if (!m) throw new Error(`no clip ${name} in the library`);
  return join(ROOT, 'public', m[1] === 'BASE' ? 'games/meshy' : 'models/galaxy/troops', m[2]);
}

// The skeleton of `figure` (a Document) and `clip`'s one animation (a
// Document of the library's) on it, as a new Document: rotations as they
// are, the hips' translation scaled by the hips' heights.
export function onFigure(figure, clip, name) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const fRoot = figure.getRoot();
  const armature = fRoot.listNodes().find((n) => n.getName() === 'Armature');
  const fHips = fRoot.listNodes().find((n) => n.getName() === 'Hips');
  const cHips = clip.getRoot().listNodes().find((n) => n.getName() === 'Hips');
  if (!armature || !fHips || !cHips) throw new Error('both need an Armature and Hips');
  const k = fHips.getTranslation()[1] / cHips.getTranslation()[1];
  // the skeleton, copied: the armature and every bone under it, no mesh
  const nodes = new Map();
  const copy = (n) => {
    const c = doc.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    nodes.set(n.getName(), c);
    for (const ch of n.listChildren()) if (!ch.getMesh()) c.addChild(copy(ch));
    return c;
  };
  doc.createScene().addChild(copy(armature));
  const [anim] = clip.getRoot().listAnimations();
  if (!anim) throw new Error('the clip file has no animation');
  const out = doc.createAnimation(name);
  for (const ch of anim.listChannels()) {
    const target = ch.getTargetNode()?.getName();
    const path = ch.getTargetPath();
    const node = nodes.get(target);
    if (!node || !(path === 'rotation' || (path === 'translation' && target === 'Hips'))) continue;
    const s = ch.getSampler();
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(s.getInput().getArray())).setBuffer(buf);
    const from = s.getOutput();
    const values = new Float32Array(from.getCount() * from.getElementSize());
    const e = [];
    for (let i = 0; i < from.getCount(); i++) values.set(from.getElement(i, e), i * from.getElementSize());
    if (path === 'translation') for (let i = 0; i < values.length; i++) values[i] *= k;
    const output = doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(values).setBuffer(buf);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    out.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
  }
  return { doc, k };
}

// The three files beside the figure: NAME-idle.glb, NAME-walk.glb, NAME-run.glb.
export async function ownClips(figure, pick = {}) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { meshopt, resample, prune } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const fig = await io.read(figure);
  const files = {};
  for (const [loco, name] of Object.entries({ ...LOCO, ...pick })) {
    const { doc } = onFigure(fig, await io.read(fileOf(name)), loco);
    // (keys a linear blend would put back thinned out, then packed as the figures are)
    await doc.transform(resample(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    files[loco] = figure.replace(/\.glb$/, `-${loco}.glb`);
    await io.write(files[loco], doc);
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const pick = Object.fromEntries(['idle', 'walk', 'run'].map((n) => [n, flag(n)]).filter(([, v]) => v));
  const [figure] = args;
  if (!figure) throw new Error('usage: node scripts/rig/clips.mjs FIGURE.glb [--idle NAME --walk NAME --run NAME]');
  for (const [loco, file] of Object.entries(await ownClips(resolve(figure), pick))) console.log(`${loco}: ${file}`);
}
