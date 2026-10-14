// A hull for every kind the galaxy's space flies (the hulls design,
// docs/superpowers/specs/2026-10-14-galaxy-space-hulls-design.md §2.1),
// made ahead of time by scripts/bf2017-hulls.mjs; this is its pure part.
//
// A game fighter's hull is its flying asset's Havok shapes (the export's
// `physics/Gameplay/Vehicles/Air/…_Physics_Win32.glb`, read by
// bf2017-physics.mjs), both roots kept: root 0 for contact, root 1 for
// bolts (`RigidBodyData.CollisionRootShapeIndex 0`, `RaycastRootShapeIndex
// 1`, findings/62 §5). Each shape is put in the frame galaxy/models.js draws
// the kind in, worked out from the same cut's box, so the hull never drifts
// from the ship drawn: the game's frame into the GLB's (the fleet file's
// `nose` node, the scale and the place lane V's import stood it at), then
// normalise()'s turn by the row's nose, its centre and its fitScale.
//
// A part's property (the material grid's property index a bolt is judged
// by) is the asset's `Materials[PartSlot[part]] >> 22` (findings/62 §1-2,
// `FUN_14143fad0`): the table and a slot byte a part, from the raw
// `HavokPhysicsData` header the exporter's `resdump` writes. The export's
// GLBs carry the table but not the slots, and a shape's own Havok tag is not
// a property.
//
//   FIGHTER_PHYSICS: kind → its flying asset under physics/Gameplay/Vehicles/Air/
//   RENDER_MODEL: kind → the models.jsonl model whose box its file has, where
//     that is not the model it was cut from
//   rosterKinds({ load, read, list }) → string[]
//   cutsOf(galaxyModels, kind) → [{ url, nose, plain }], the plain cut first
//   resOf(path), headerFile(name), readHeader(buffer) → { parts, slots, materials }
//   partProperties(header, what) → a property a part
//   sceneBox(doc), boxOf(shapes) → { min, max }
//   frameOf(doc, nose, kind) → { nose, centre, k, size }
//   gameToGlb(doc, gameBox) → a column-major 4 × 4 matrix
//   fitShapes(shapes, matrix, frame) → shapes
//   offBy(hullBox, frame) → { off, face }
//   assemble(shapes, properties) → { radius, parts, shapes } for packHull

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitScale } from '../../src/components/universe/shipFit.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The fighters the game flies, each its flying asset (not the
// `_Static_DONOTUSE` one its render model is named for, nor a landmark's):
// the one whose parts the finding's tables read (findings/62 §2). The
// Falcon's is the flying Falcon's, gear up, not the landmark the fleet's
// file was cut from: the landmark is the parked ship, its landing gear in
// its shapes and every one of its 39 parts p132 (a hull no bolt hurts),
// where the flying one's are p68 and p222 as the finding has them, and
// bf2017-fleet.mjs leaves the landmark's legs out of the drawing. The two are modelled in one
// frame (their meshes' boxes are the same along x and z).
export const FIGHTER_PHYSICS = {
  xwing: 'XWing_T65/Vehicle_Air_XWing_T65_Physics_Win32.glb',
  xwing65: 'XWing_T65/Vehicle_Air_XWing_T65_Physics_Win32.glb',
  awing: 'AWing/Vehicle_Air_AWing_Physics_Win32.glb',
  ywing: 'Ywing/Vehicle_Air_YWing_Physics_Win32.glb',
  uwing: 'Uwing/Vehicle_Air_UWing_Gunship_Physics_Win32.glb',
  tie: 'TieFighter/Vehicle_Air_TieFighter_Physics_Win32.glb',
  interceptor: 'TieInterceptor/Vehicle_Air_TieInterceptor_Physics_Win32.glb',
  tiebomber: 'TieBomber/Vehicle_Air_TieBomber_Physics_Win32.glb',
  tieadvanced: 'TieAdvancedX1/Vehicle_Air_TieAdvancedX1_Physics_Win32.glb',
  vulture: 'VultureDroid/Vehicle_Air_VultureDroid_Physics_Win32.glb',
  trifighter: 'DroidTriFighter/Vehicle_Air_DroidTriFighter_Physics_Win32.glb',
  arc170: 'ARC170/Vehicle_Air_ARC170_Physics_Win32.glb',
  n1: 'N1Starfighter/Vehicle_Air_N1Starfighter_Physics_Win32.glb',
  slave1: 'Slave1/Vehicle_Air_Slave1_Physics_Win32.glb',
  falcon: 'MillenniumFalcon/Vehicle_Air_MillenniumFalcon_Physics_Win32.glb',
  vwing: 'Vwing/Vehicle_Air_Vwing_Physics_Win32.glb',
  hyena: 'HyenaBomber/Vehicle_Air_HyenaBomber_Physics_Win32.glb',
};
export const AIR = 'physics/Gameplay/Vehicles/Air';

// The fleet's Falcon is the landmark with its legs left out
// (bf2017-fleet.mjs's `drop`), which leaves the flying Falcon's outline:
// its box is that model's (y −3.54 to 4.18 against the landmark's −4.48),
// the landmark's box being the gear's.
export const RENDER_MODEL = {
  falcon: 'gameplay/vehicles/air/millenniumfalcon/vehicle_air_millenniumfalcon_static_donotuse_mesh',
};

// ── the roster ──

// (a module of the repository's, by its path: Vite resolves the galaxy's
// extensionless imports under vitest, and the CLI hands in its own loader)
const importRepo = (path) => import(new URL(`../../${path}`, import.meta.url).href);
const readRepo = (path) => readFileSync(join(REPO, path), 'utf8');
const listRepo = (dir) => readdirSync(join(REPO, dir)).map((f) => `${dir}/${f}`);

// every `kind` field under a value (the battles' templates: ship(kind)s and
// fighter lists, nested as they come)
function kindsUnder(value, out, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (typeof value.kind === 'string') out.add(value.kind);
  for (const v of Object.values(value)) kindsUnder(v, out, seen);
}

// Every kind the galaxy's space flies on the Star Wars side: the war's
// sides (universe/wars.js), the battles' fleets and fighters
// (galaxy/battles.js's TEMPLATES, which hold the Galactic Civil War's own and
// battlesWars.js's Clone Wars and Remnant ones, and the Hutts'), the hunters
// (galaxy/hunted.js's Star Wars factions and models.js's HUNTER_GLB), and the
// ships the set pieces, the Interdictor and the war pieces put in by name
// (read from their source: those come as strings in their code, not as
// data). Each is a kind galaxy/models.js draws from a model, since a hull is
// made from one: the hunters' `redleader` flies the X-wing's, and the
// pirates' skiff, built in code, has none.
export async function rosterKinds({ load = importRepo, read = readRepo, list = listRepo } = {}) {
  const { MODELS, HUNTER_GLB } = await load('src/components/galaxy/models.js');
  const { WARS } = await load('src/components/universe/wars.js');
  const { TEMPLATES, HUTTS } = await load('src/components/galaxy/battles.js');
  const { FACTIONS, KINDS } = await load('src/components/galaxy/hunted.js');
  const kinds = new Set();
  for (const side of WARS.starwars.sides) for (const s of [...side.fighters, ...side.capitals]) kinds.add(s.kind);
  kindsUnder({ TEMPLATES, HUTTS }, kinds);
  // (a hunter drawn as another kind's model, universe/hunters.js's drawnAs:
  // the navy's repair shuttle is the shuttle)
  const hunter = (kind) => {
    kinds.add(kind);
    if (KINDS[kind]?.model) kinds.add(KINDS[kind].model);
  };
  for (const f of Object.values(FACTIONS)) {
    if (f.family !== 'starwars') continue;
    for (const [kind] of f.kinds ?? []) hunter(kind);
    if (f.ace) hunter(f.ace);
  }
  for (const kind of Object.keys(HUNTER_GLB)) kinds.add(kind);
  const named = ['src/components/universe/setpieces.js', 'src/components/galaxy/interdictor.js', ...list('src/components/galaxy/warpieces').filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))];
  for (const file of named) for (const [, word] of read(file).matchAll(/['"]([a-z0-9]+)['"]/g)) if (Object.hasOwn(MODELS, word)) kinds.add(word);
  return [...kinds].filter((k) => Object.hasOwn(MODELS, k)).sort();
}

// The cuts a kind is drawn in (galaxy/models.js's modelsAt at each detail:
// the plain cut, the light cut on low and mid, the ultra cut on ultra), each
// { url, nose, plain }, the plain one first: the frame is its. An HQ row
// (the close-up Nebulon-B) has a hull of its own, `hq/<kind>`, so isn't one.
export const DETAILS = ['high', 'ultra', 'mid', 'low'];
export function cutsOf({ modelsAt, LIGHT_CUTS, ULTRA, HD_MAPS = {} }, kind) {
  const lighter = new Set([...Object.values(LIGHT_CUTS), ...Object.values(ULTRA), ...Object.values(HD_MAPS)]);
  const cuts = new Map();
  for (const detail of DETAILS) {
    const row = modelsAt(detail)[kind];
    if (row && !row.hq && !cuts.has(row.url)) cuts.set(row.url, { url: row.url, nose: row.nose ?? 0, plain: !lighter.has(row.url) });
  }
  const list = [...cuts.values()].sort((a, b) => b.plain - a.plain);
  if (!list[0]?.plain) throw new Error(`${kind}: no plain cut in galaxy/models.js`);
  return list;
}

// ── the header: each part's property ──

// physics/Gameplay/…/X_Physics_Win32.glb → gameplay/…/x_physics_win32 (the
// asset's `res` in physics.jsonl)
export const resOf = (path) =>
  String(path)
    .replace(/^(web\/)?physics\//, '')
    .replace(/\.glb$/i, '')
    .toLowerCase();
// the dump's file of an asset: its `res` with `/` as `_` (resdump's names)
export const headerFile = (name) => `${resOf(name).replace(/\//g, '_')}.bin`;

// A HavokPhysicsData resource as resdump writes it: 16 bytes of the
// resource's own meta, then the resource, whose header the game's
// part-material getter reads (GroupRigidBody slot 91, FUN_14143fad0; the
// layout the exporter's PhysicsExport.cs ParseHeader): the part count at
// +0, a slot byte a part counted at +0x1c from the offset at +0x20, the
// `Packed` table counted at +0x28 from the offset at +0x2c (offsets from
// the resource's start, 64-bit).
export const RES_META = 16;
export function readHeader(buffer) {
  const raw = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (raw.byteLength < RES_META + 0x34) throw new Error(`a physics header of ${raw.byteLength} bytes is shorter than its fields`);
  const dv = new DataView(raw.buffer, raw.byteOffset + RES_META, raw.byteLength - RES_META);
  const parts = dv.getUint32(0, true);
  const nSlots = dv.getUint32(0x1c, true);
  const atSlots = Number(dv.getBigUint64(0x20, true));
  const nTable = dv.getUint32(0x28, true);
  const atTable = Number(dv.getBigUint64(0x2c, true));
  if ((nSlots && atSlots + nSlots > dv.byteLength) || (nTable && atTable + nTable * 4 > dv.byteLength)) throw new Error(`a physics header's tables run past its ${dv.byteLength} bytes`);
  const slots = nSlots ? Array.from(raw.subarray(RES_META + atSlots, RES_META + atSlots + nSlots)) : [];
  const materials = Array.from({ length: nTable }, (_, i) => dv.getUint32(atTable + i * 4, true));
  return { parts, slots, materials };
}

// Each part's property: its slot's `Packed` bits 22–31 (findings/62 §1,
// FUN_1474bf830's `>> 0x16`), where the entry has its valid bit (11). One
// without it is the grid's default (FUN_1474bf390), which is property 0 as
// the default slot's 0x00000800 is: the X-wing's part 1 (the cockpit's 24
// triangles) is on that slot, and the damage then falls back to the
// vehicle's MaterialPair (findings/62 §2: Task 9's, not the hull's). A part
// with no slot or a slot past the table fails the kind: the game would read
// the default there, but none of the 666 dumped assets has one, so one now
// is a header misread.
export function partProperties({ parts, slots, materials }, what) {
  if (slots.length < parts) throw new Error(`${what}: ${parts} parts, ${slots.length} slot${slots.length === 1 ? '' : 's'} in its header`);
  return Array.from({ length: parts }, (_, part) => {
    const slot = slots[part];
    if (slot >= materials.length) throw new Error(`${what}: part ${part}’s slot ${slot} is past its table of ${materials.length}`);
    const packed = materials[slot];
    return (packed >>> 11) & 1 ? packed >>> 22 : 0;
  });
}

// ── the frame ──

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// (a column-major 4 × 4 times a point)
const apply = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const emptyBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const grow = (b, p, r = 0) => {
  for (let k = 0; k < 3; k++) {
    b.min[k] = Math.min(b.min[k], p[k] - r);
    b.max[k] = Math.max(b.max[k], p[k] + r);
  }
};
const sizeOf = (b) => b.max.map((v, k) => v - b.min[k]);
const centreOf = (b) => b.max.map((v, k) => (v + b.min[k]) / 2);
// (three's rotation.y: x' = x cos + z sin, z' = −x sin + z cos)
const turnY = (nose, [x, y, z]) => [x * Math.cos(nose) + z * Math.sin(nose), y, -x * Math.sin(nose) + z * Math.cos(nose)];

// Every POSITION element of every primitive through its node's world matrix,
// each turned by `nose`: the box three's Box3.setFromObject(turn, true) gives
// normalise() (getElement undoes a normalised accessor as three's
// fromBufferAttribute does).
function measure(doc, nose = 0) {
  const box = emptyBox();
  const e = [0, 0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e);
        grow(box, turnY(nose, apply(m, e[0], e[1], e[2])));
      }
    }
  }
  return box;
}
export const sceneBox = (doc) => measure(doc, 0);

// What normalise() works out for a model: its turn, the centre of its box
// after the turn, and the scale that makes it 1 long (or 1 at its biggest
// side, universe/shipFit.js); `size` the turned box's.
export function frameOf(doc, nose, kind) {
  const box = measure(doc, nose);
  const [x, y, z] = sizeOf(box);
  return { nose, centre: centreOf(box), k: fitScale(kind, { x, y, z }), size: [x, y, z] };
}

// how far two boxes' sizes may differ and still be one model (lane V's
// import measured its cuts on a sample of the vertices; the game's LODs
// keep their outline)
export const SAME = 0.01;

// The game's mesh frame into the GLB's scene frame: the GLB's `nose` node
// (bf2017-fleet.mjs writes one over the scene, turning the file so the row's
// nose brings it to +z), then the scale and translation that put the game
// model's render box on the GLB's box. Lane V's import (surface-model.mjs's
// grounded) stood each model on y = 0 centred over its footprint, scaled to
// LOD0's height as it measured the cut: the scale is 1 where the sizes agree
// within 1 % as they are, else the one the three sides agree on within 1 %
// (the vulture's light cut, its LOD3 stood at LOD0's height: 1.0183). Boxes
// that agree on neither are refused: a turn or a stretch the import made
// that this doesn't know, or a box from another model or another LOD.
export function gameToGlb(doc, gameBox) {
  const noseNode = doc
    .getRoot()
    .listScenes()
    .flatMap((s) => s.listChildren())
    .find((n) => n.getName() === 'nose');
  const N = noseNode ? noseNode.getMatrix() : IDENTITY;
  const turned = emptyBox();
  for (const x of [gameBox.min[0], gameBox.max[0]]) for (const y of [gameBox.min[1], gameBox.max[1]]) for (const z of [gameBox.min[2], gameBox.max[2]]) grow(turned, apply(N, x, y, z));
  const glb = sceneBox(doc);
  const ratios = sizeOf(glb).map((v, k) => v / sizeOf(turned)[k]);
  const agree = (s) => ratios.every((r) => Math.abs(r / s - 1) <= SAME);
  const median = [...ratios].sort((a, b) => a - b)[1];
  const s = agree(1) ? 1 : agree(median) ? median : null;
  if (s === null) throw new Error(`the GLB's box (${sizeOf(glb).map((v) => v.toFixed(3)).join(' × ')}) is not the game's (${sizeOf(turned).map((v) => v.toFixed(3)).join(' × ')}) within ${SAME * 100} % at one scale`);
  const t = centreOf(glb).map((v, k) => v - s * centreOf(turned)[k]);
  const m = N.map((v, i) => (i % 4 < 3 && i < 12 ? v * s : v));
  return [...m.slice(0, 12), m[12] * s + t[0], m[13] * s + t[1], m[14] * s + t[2], 1];
}

// Every point of every shape through `matrix` (the game's frame into the
// GLB's), turned by the frame's nose, less its centre, times its k: the
// frame galaxy/models.js draws the kind in. (Radii scale by k alone: the
// matrix's scale is its uniform one, the turns keep lengths.)
export function fitShapes(shapes, matrix, { nose, centre, k }) {
  const s = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const to = (x, y, z) => turnY(nose, apply(matrix, x, y, z)).map((v, i) => (v - centre[i]) * k);
  const points = (list) => {
    const out = new Float32Array(list.length);
    for (let i = 0; i < list.length; i += 3) out.set(to(list[i], list[i + 1], list[i + 2]), i);
    return out;
  };
  return shapes.map((sh) => {
    const out = { kind: sh.kind, root: sh.root, part: sh.part, instance: sh.instance, material: sh.material, points: points(sh.points) };
    if (sh.indices) out.indices = sh.indices;
    if (sh.kind === 'capsule') {
      out.a = to(...sh.a);
      out.b = to(...sh.b);
    }
    if (sh.kind === 'sphere') out.centre = to(...sh.centre);
    if (sh.radius !== undefined) out.radius = sh.radius * s * k;
    return out;
  });
}

// the box of shapes (a capsule's and a sphere's grown by their radius)
export function boxOf(shapes) {
  const box = emptyBox();
  for (const s of shapes) {
    if (s.kind === 'capsule') {
      grow(box, s.a, s.radius);
      grow(box, s.b, s.radius);
    } else if (s.kind === 'sphere') grow(box, s.centre, s.radius);
    else for (let i = 0; i < s.points.length; i += 3) grow(box, [s.points[i], s.points[i + 1], s.points[i + 2]]);
  }
  return box;
}

// How far a hull's box is off a cut's as normalise() draws it (centred, its
// size × k): the worst of its six faces, as a share of the length the ship
// is drawn at (1 in this frame: a fighter's nose to tail, a ship fitted by
// its biggest side that side).
export function offBy(hullBox, { size, k }) {
  let off = 0;
  let face = null;
  for (let a = 0; a < 3; a++) {
    const half = (size[a] * k) / 2;
    for (const [end, v, drawn] of [
      ['min', hullBox.min[a], -half],
      ['max', hullBox.max[a], half],
    ]) {
      const d = Math.abs(v - drawn);
      if (face === null || d > off) [off, face] = [d, `${'xyz'[a]} ${end} ${v.toFixed(4)} against ${drawn.toFixed(4)}`];
    }
  }
  return { off, face };
}

// ── the hull ──

// The shapes with each one's material set to its part's property, the
// parts list (`part<N>` a part, each with its property, as the shapes bin's
// version 2 names them: Task 3's hullOf reads a triangle's property by its
// part's index), and the bounding radius: the farthest any shape reaches
// from the middle, either root.
export function assemble(shapes, properties) {
  const out = shapes.map((s) => {
    if (!(s.part < properties.length)) throw new Error(`a shape names part ${s.part} of ${properties.length}`);
    return { ...s, material: properties[s.part] };
  });
  let radius = 0;
  const reach = (p, r = 0) => (radius = Math.max(radius, Math.hypot(p[0], p[1], p[2]) + r));
  for (const s of out) {
    if (s.kind === 'capsule') {
      reach(s.a, s.radius);
      reach(s.b, s.radius);
    } else if (s.kind === 'sphere') reach(s.centre, s.radius);
    else for (let i = 0; i < s.points.length; i += 3) reach([s.points[i], s.points[i + 1], s.points[i + 2]]);
  }
  return { radius, parts: properties.map((property, n) => ({ name: `part${n}`, property })), shapes: out };
}
