#!/usr/bin/env node
// A level pack's draw calls, counted in Node through the scene's own code
// (fidelity lane U): src/components/galaxy/surface/level/levelScene.js on
// the pack's far table and horizon, every GLB parsed as the level loader
// parses it (levelPack.js's splitTextures, its maps bound from one shared
// cache by name, so a mesh's LODs wear the same texture objects), at a few
// spots, with lane L's InstancedMesh path and with lane U's batches. No
// GPU: the counts are the scene's (stats()), the frame times are the
// laptop's (scripts/perf-probe.mjs with GPU=).
//
//   node scripts/level-draws.mjs [world=hoth] [--tier high] [--json out.json]
//
// The node renderer's game materials (lane Q1) are made one per GLB
// material and key a batch by themselves (levelBatch.js): this counts the
// classic material path, the batches' best case; `--own` keys every
// material by itself, their worst.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createLevelScene } from "../src/components/galaxy/surface/level/levelScene.js";
import { splitTextures } from "../src/components/galaxy/surface/level/levelPack.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const world =
  argv.find(
    (a) =>
      !a.startsWith("--") &&
      argv[argv.indexOf(a) - 1]?.startsWith("--") !== true,
  ) ?? "hoth";
const tier = arg("tier", "high");
const own = argv.includes("--own");
const dir = join(ROOT, "public/models/galaxy/bf2017/levels", world);
const pack = JSON.parse(readFileSync(join(dir, "level.json"), "utf8"));
const bytes = (f) => {
  const b = readFileSync(join(dir, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

// one texture object a map, whatever names it (levelGltf.js's cache)
const cache = new Map();
const textureOf = (uri) => {
  if (!cache.has(uri))
    cache.set(uri, Object.assign(new THREE.Texture(), { name: uri }));
  return cache.get(uri);
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const files = new Map();
const loadGltf = (glb) => {
  if (!files.has(glb)) {
    files.set(
      glb,
      (async () => {
        const { buffer, slots } = splitTextures(bytes(glb));
        const gltf = await loader.parseAsync(buffer, "");
        const mats = await gltf.parser.getDependencies("material");
        for (const { material, slot, uri } of slots) {
          const m = mats[material];
          if (slot === "metalRough")
            m.roughnessMap = m.metalnessMap = textureOf(uri);
          else m[slot] = textureOf(uri);
        }
        if (own)
          gltf.scene.traverse(
            (o) => o.isMesh && (o.material.userData.batchKey = o.material.uuid),
          );
        return gltf;
      })().catch((e) => (console.error(glb, e.message), null)),
    );
  }
  return files.get(glb);
};

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await Promise.all(files.values());
    await new Promise((r) => setTimeout(r, 0));
  }
};

// the spots: the arena's middle, and the middle of its three fullest cells
const fullest = Object.entries(
  pack.far.draws.reduce((acc, d) => {
    for (const [k, [, n]] of Object.entries(d.cells ?? {}))
      acc[k] = (acc[k] ?? 0) + n;
    return acc;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([k]) => k.split(",").map((v) => (Number(v) + 0.5) * pack.cell));
const spots = [[0, 0], ...fullest];

const rows = [];
for (const batch of [false, true]) {
  const scene = new THREE.Scene();
  const level = createLevelScene({
    scene,
    pack,
    loadGltf,
    tier,
    batch,
    occlude: batch ? { isOccluded: () => false } : null,
  });
  level.setTable(bytes(pack.far.bin));
  if (pack.horizon?.bin) level.setHorizon(bytes(pack.horizon.bin));
  for (const at of spots) {
    level.update([at[0] + 1000, at[1]]); // (a long way off first, so each spot sorts afresh)
    level.update(at);
    await settle();
    level.update([at[0] + 1000, at[1]]);
    level.update(at);
    await settle();
    rows.push({
      path: batch ? "batched" : "instanced",
      at: at.map((v) => Math.round(v)),
      ...level.stats(),
    });
  }
  level.dispose();
}

const out = {
  world,
  tier,
  materials: own ? "own" : "shared maps",
  glbs: files.size,
  textures: cache.size,
  rows,
};
if (arg("json", null))
  writeFileSync(arg("json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `${world}, ${tier}, ${out.glbs} GLBs, ${out.textures} maps (${out.materials})`,
);
console.log(
  "| path | at | instances | triangles | draw calls | batches (arena / horizon) | still instanced | occlusion blocks |",
);
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows)
  console.log(
    `| ${r.path} | ${r.at.join(", ")} | ${r.instances} | ${Math.round(r.tris)} | ${r.calls} | ${r.batches == null ? "–" : `${r.bands.arena ?? 0} / ${r.bands.horizon ?? 0}`} | ${r.instanced ?? r.calls} | ${r.blocks ?? "–"} |`,
  );
