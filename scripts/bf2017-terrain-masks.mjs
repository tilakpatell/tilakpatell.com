// Hoth's terrain layer masks into its level pack, from the game's own
// TerrainStreamingTree resource (scripts/lib/bf2017-terrain-tree.mjs reads
// it; bf2-re/findings/58 is the format and its proofs). The game keeps
// each of its eight painted layers as 72² u8 rasters on a quadtree, 8 m to
// 0.5 m a texel; the tile shader blends the nine layers by them
// (findings/35; src/lib/three/ground/snow.js draws the same). Here the
// rasters are laid into two frames, each from the corner of one level of
// the tree, all the size of the finest (one KTX2 array binds once: the
// ground's textures are counted, ground.js):
//
//   near  from the 0.5 m level's corner, 0.5 m a texel (its extent: the play strip)
//   far   from the 8 m level's, 2 m a texel (the whole painted extent,
//         2,560 m a side; nothing is painted past it: layer 0 there)
//
// The game's virtual texture draws a tile at the quadtree level its
// distance asks for (findings/11, 63): past the play strip only its coarse
// levels are ever on screen, so the 1 m level's ring round the strip (its
// own frame until 2026-10-14, a third of the array) is drawn from its 2 m
// mean, as the game's coarser tiles hold it.
//
// as the four layers of one KTX2 array (UASTC, linear, mipmapped: a texel
// the mean of the game's own finer texels, as a parent raster is): each
// frame's masks 1–4 in one layer's RGBA, 5–8 in the next. It is written at
// each size its tiers read (terrain/masks.<width>.ktx2, the bigger file's
// mips dropped), level.json's terrain.masks says where each frame lies (its
// corner and texel size in the pack's frame, as terrain.holes does, and its
// two layers) and a tex row its sizes. The colour tree (the resource's far
// colour) is read and counted: on Hoth it is white, so it is not written
// (findings/58).
//
//   node scripts/bf2017-terrain-masks.mjs [hoth] [--tree <file>] [--preview <dir>] [--check]
//
//   tree     the resource's bytes: `bf2export terrainprobe --filter hoth_01_terrain`'s
//            probe/levels~mp~hoth_01~hoth_01_terrain~hoth_01_terrain.streamingtree_win32.TerrainStreamingTree.bin,
//            or bf2-re's Frosty dump (the default; a ResMeta in front is stripped)
//   preview  each layer as a grey PNG per frame, for a look
//   check    the proofs and the counts only; nothing written
//
// Then publish the files (the key from the environment):
//
//   node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/hoth/terrain/masks.*'

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { basisuPath, encodeArgs } from './ktx2.mjs';
import { parseArgs } from './lib/args.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { agreement, bc3Decode, colourTree, composeMasks, framesOf, maskRasters, treeOf } from './lib/bf2017-terrain-tree.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TREE = 'C:/Users/tilak/source/repos/bf2-re/data/tools-eval/FrostyToolsuite/res/TerrainStreamingTree/levels_mp_hoth_01_hoth_01_terrain_hoth_01_terrain.streamingtree_win32.bin';
// the frames: the tree level whose extent each covers, and its texel size
export const FRAMES = {
  near: { level: 0.5, mpp: 0.5 },
  far: { level: 8, mpp: 2 },
};
// the width each tier reads, as a fraction of the frame's own (low draws no masks)
export const TIER_SCALE = { mid: 0.25, high: 0.5, ultra: 1 };
export const GROUPS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
];

// a frame from a level's corner, in the game's frame: its own extent, or w × h texels
export function frameOf(rasters, { level, mpp }, size = null) {
  const f = framesOf(rasters, level);
  if (!f) return null;
  const [w, h] = size ?? [Math.round((f.maxX - f.minX) / mpp), Math.round((f.maxZ - f.minZ) / mpp)];
  return { minX: f.minX, minZ: f.minZ, mpp, w, h };
}

// a tier's width of a frame, held to a multiple of 4 (a block) by its mips
export const tierWidths = (w) => Object.fromEntries(Object.entries(TIER_SCALE).map(([t, s]) => [t, Math.max(4, Math.round(w * s))]));

async function encodeArray(layers, w, h) {
  const tmp = mkdtempSync(join(tmpdir(), 'masks-'));
  try {
    const files = [];
    for (const [i, rgba] of layers.entries()) {
      const f = join(tmp, `l${i}.png`);
      await sharp(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } })
        .png()
        .toFile(f);
      files.push('-file', f);
    }
    const out = join(tmp, 'out.ktx2');
    execFileSync(basisuPath(), [...encodeArgs({ role: 'other' }), '-tex_type', '2darray', ...files, '-output_file', out], { stdio: 'ignore' });
    return await readFile(out);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main(args) {
  const world = args._[0] ?? 'hoth';
  const buf = treeOf(await readFile(args.tree ?? TREE));
  const { rasters, records, blocks } = maskRasters(buf);
  const proof = agreement(buf, rasters);
  console.log(`masks: ${records} records, ${rasters.length} rasters in ${blocks} blocks`);
  console.log(`  borders: ${proof.borders[0]} of ${proof.borders[1]} border texels are the neighbour's inner ones (rows z, columns x)`);
  console.log(`  parents: ${proof.parents.n} texels, the 2×2 children's mean within ${proof.parents.meanAbs.toFixed(3)} on average (at most ${proof.parents.maxAbs})`);
  console.log(`  missing rasters: ${proof.ancestors.agree} of ${proof.ancestors.n} painted border texels into a node without the layer are its ancestor's (${proof.ancestors.zero} are 0)`);
  // the colour tree: how much of it is anything but white
  const tree = colourTree(buf);
  let texels = 0;
  let white = 0;
  for (const n of tree.nodes) {
    if (n.at === null) continue;
    const img = bc3Decode(buf, n.at);
    for (let i = 0; i < img.length; i += 4) {
      texels++;
      if (img[i] >= 250 && img[i + 1] >= 250 && img[i + 2] >= 250) white++;
    }
  }
  console.log(`colour tree: ${tree.nodes.length} nodes, ${tree.nodes.filter((n) => n.at !== null).length} rasters; ${((100 * white) / texels).toFixed(3)}% of ${texels} texels white (not written)`);
  if (args.check) return;

  const pack = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const level = JSON.parse(await readFile(join(pack, 'level.json'), 'utf8'));
  const origin = level.origin ?? [0, 0, 0];
  await mkdir(join(pack, 'terrain'), { recursive: true });
  const masks = {
    _source: 'TerrainStreamingTree (Levels/MP/Hoth_01/Hoth_01_Terrain), section 1: the layer-mask rasters (scripts/bf2017-terrain-masks.mjs, bf2-re/findings/58)',
    groups: GROUPS,
    tex: 'terrain/masks.ktx2',
    frames: {},
  };
  const finest = frameOf(rasters, FRAMES.near);
  const size = [finest.w, finest.h];
  const layers = [];
  for (const [name, spec] of Object.entries(FRAMES)) {
    const f = frameOf(rasters, spec, size);
    if (!f) continue;
    const pair = GROUPS.map((g) => composeMasks(buf, rasters, g, f));
    if (args.preview) {
      await mkdir(args.preview, { recursive: true });
      for (const [gi, g] of GROUPS.entries()) {
        for (const [ch, layer] of g.entries()) {
          const grey = new Uint8Array(f.w * f.h);
          for (let i = 0; i < grey.length; i++) grey[i] = pair[gi][i * 4 + ch];
          await sharp(Buffer.from(grey), { raw: { width: f.w, height: f.h, channels: 1 } })
            .png()
            .toFile(join(args.preview, `${name}-layer${layer}.png`));
        }
      }
    }
    masks.frames[name] = {
      // (the corner of texel 0, in the pack's frame: the game's less the pack's origin)
      corner: [f.minX - origin[0], f.minZ - origin[2]],
      metresPerPixel: f.mpp,
      layers: [layers.length, layers.length + 1],
    };
    layers.push(...pair);
    console.log(`${name}: ${f.w} × ${f.h} at ${f.mpp} m from (${f.minX}, ${f.minZ})`);
  }
  masks.size = size;
  const ktx2 = await encodeArray(layers, size[0], size[1]);
  const info = ktx2Info(ktx2);
  const widths = tierWidths(size[0]);
  const sizes = [...new Set(Object.values(widths))];
  for (const s of sizes) await writeFile(join(pack, 'terrain', `masks.${s}.ktx2`), dropMips(ktx2, Math.min(mipsToFit(info.width, s), info.levels - 1)));
  level.tex.masks = { ...widths, srgb: false };
  console.log(`masks: ${layers.length} layers of ${size[0]} × ${size[1]} → ${sizes.map((s) => `${s} px`).join(', ')}`);
  level.terrain.masks = masks;
  await writeFile(join(pack, 'level.json'), `${JSON.stringify(level)}\n`);
  console.log(`${world}: level.json's terrain.masks and tex rows written`);
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
