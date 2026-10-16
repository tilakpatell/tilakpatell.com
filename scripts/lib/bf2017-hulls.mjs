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
//   drawnPoints(doc, frame) → Float32Array, nearestOf(points) → (x, y, z) → distance
//   facing(hullPoints, drawnPoints) → { placed, ways, better }: a turn or a
//     mirror that fits the drawing better than the hull as placed
//   assemble(shapes, properties, names?) → { radius, parts, shapes } for packHull
//   partName(file, index, count) → a capital's part's name: its module's
//     file slug, `#<index>` after it where the module's asset has more parts
//
// A game capital's hull is its kit's modules' Havok shapes (the space level
// places a capital as dozens of modules, bf2017-space.mjs's piecesOf), each
// module's shapes where the kit places it, in the frame its fleet file
// (bf2017-fleet.mjs) is drawn in; every part of every module its own part, so
// a hit on a shield generator or a turret names it. A ship the game never had,
// or whose game shapes miss the model the galaxy draws, has a site hull: its
// render model simplified, one part (bf2017-hulls-site.mjs's siteHull and
// subsystemParts).
//
//   CAPITAL_KITS: kind → { space, model } (its kit in a space level) | { physics } (one asset)
//   capitalKinds({ load }) → the kinds the battles fly as flagships and escorts
//   bothRoots(shapes) → an asset's shapes with one root met both ways
//   kitShapes(space, kit, assets) → { shapes, parts, missing }, in the kit's frame (metres)
//   noseMatrix(doc) → the GLB's `nose` node's matrix (the kit's frame into the file's)
//   drawnPrimitives(doc, frame) → [{ points, triangles }]: the drawn model in its frame
//   hunterCuts(HUNTER_GLB, galaxyModels) → [{ kind, url, nose }]: hunters drawn as another model
//   wingEdge(hull, share) → [{ side, widest, at, inside }]: a point `share` out on the
//     widest section, inside a root 0 solid or not
//   SITE_OVER_GAME: kind → why its game shapes give way to a site hull
//   SITE_PROPERTY, OBJECTIVE, majority(properties)

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitScale } from '../../src/components/universe/shipFit.js';
import { physicsKey } from './bf2017-physics.mjs';
import { rotate } from './bf2017-space.mjs';

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

// The capitals the game has, each the kit its fleet file was made from
// (bf2017-fleet.mjs's `space` rows: the space level and the model its
// piecesOf makes of the kit), or, for the Nebulon-B, which the fleet imports
// as one model, that model's one physics asset (the close-up `hq/nebulon` the
// same shapes, in its own file's frame)
const NEBULON = 'Objects/Props/Landmarks/_RebelAlliance/BD_FrigateNebulonB_01/FrigateNebulonB_01_Physics_Win32';
export const CAPITAL_KITS = {
  destroyer: { space: 'endor', model: 'endor-isd' },
  moncal: { space: 'endor', model: 'endor-mc80' },
  corvette: { space: 'endor', model: 'corvettecr90-01' },
  venator: { space: 'kamino', model: 'kamino-venator' },
  providence: { space: 'kamino', model: 'providenceclassdreadnaught-01' },
  lucrehulk: { space: 'naboo', model: 'naboo-lucrehulk' },
  lightcruiser: { space: 'fondor', model: 'fondor-arquitens' },
  nebulon: { physics: NEBULON },
  'hq/nebulon': { physics: NEBULON },
};

// The kinds the game has whose game shapes miss the model the galaxy draws by
// more than the 2 % fit, so the site's hull of the drawn model stands in
// (measured by the CLI each run, its numbers in the kind's row); the part's
// property is still the game's (its parts' most common)
export const SITE_OVER_GAME = {
  interceptor: "the game's bolt shapes stop short of the forward wing tips the galaxy draws",
  lightcruiser: "the game's Arquitens has no shape over its command bridge (the module has no physics; only the campaign's prefab places a bridge's), which the galaxy draws",
  lucrehulk: "the game's forward control tower reaches higher than the galaxy's cut of the Lucrehulk draws it (the fleet's 24,000-triangle cut stops 703 m up, where the tower and the space level's own cut reach 816 m)",
  'hq/nebulon': "the game's Nebulon-B has no shape over its engine block (a model of its own with no physics), which the close-up draws",
};

// A site hull's part's property, for a ship the game never had: a fighter
// the game's fighters' (every one's `VehicleEntityData.MaterialPair` and most
// of its parts p68, findings/62 §2), a capital its capitals' hulls' (p132:
// the Star Destroyer's, MC80's, Venator's, Lucrehulk's and Providence's hull
// modules, findings/62 §7)
export const SITE_PROPERTY = { fighter: 68, capital: 132 };
// The war's subsystems on a site hull carry the property of the game's
// capitals' targets: every one the kits carry is p206 (the Star Destroyer's
// reactor, the MC80's nodules, the Venator's bridge towers, the Lucrehulk's
// generators and tractor beam; findings/62 §4's squad-bonus objectives)
export const OBJECTIVE = 206;

// the most common of a list's values (the first of a tie)
export function majority(list) {
  const counts = new Map();
  for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  for (const [v, n] of counts) if (best === null || n > counts.get(best)) best = v;
  return best;
}

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

// The kinds the battles fly as capitals (a role of flagship or escort): the
// war's sides' (universe/wars.js) and each line of battle's flagship and
// escorts (galaxy/battles.js's TEMPLATES and HUTTS). A site hull of one takes
// a capital's budget.
export async function capitalKinds({ load = importRepo } = {}) {
  const { WARS } = await load('src/components/universe/wars.js');
  const { TEMPLATES, HUTTS } = await load('src/components/galaxy/battles.js');
  const kinds = new Set();
  for (const side of WARS.starwars.sides) for (const c of side.capitals) kinds.add(c.kind);
  const walk = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value.flagship?.kind) kinds.add(value.flagship.kind);
    for (const e of Array.isArray(value.escorts) ? value.escorts : []) if (e?.kind) kinds.add(e.kind);
    for (const v of Object.values(value)) walk(v, seen);
  };
  walk({ TEMPLATES, HUTTS });
  return [...kinds].sort();
}

// The hunters drawn as a model that is none of the galaxy's cuts of their
// kind (models.js's HUNTER_GLB, flown by universe/glbFleet.js, which
// normalises as galaxy/models.js does): each has a hull of its own,
// `hunter/<kind>`. (A hunter flying another kind's model, Wedge in the
// X-wing's, has no kind of its own to draw.)
export function hunterCuts(HUNTER_GLB, galaxy) {
  const out = [];
  for (const [kind, def] of Object.entries(HUNTER_GLB)) {
    if (!Object.hasOwn(galaxy.MODELS, kind)) continue;
    if (!cutsOf(galaxy, kind).some((c) => c.url === def.url)) out.push({ kind, url: def.url, nose: def.nose ?? 0 });
  }
  return out;
}

// The cuts a kind is drawn in (galaxy/models.js's modelsAt at each detail:
// the plain cut, the light cut on low and mid, the game's plain surface cut
// and the kits' ultra cuts on high and ultra), each { url, nose, plain }, the
// plain one first: the frame is its. An HQ row (the close-up Nebulon-B) has a
// hull of its own, `hq/<kind>`, so isn't one.
export const DETAILS = ['high', 'ultra', 'mid', 'low'];
export function cutsOf({ modelsAt, LIGHT_CUTS, ULTRA, HD_MAPS = {}, HIGH_CUTS = {} }, kind) {
  // (this kind's own lighter cuts: another kind's plain file can be this one's
  // high cut, the T-65's the X-wing's, and is still that kind's plain cut)
  const lighter = new Set([LIGHT_CUTS[kind], ULTRA[kind], HD_MAPS[kind], HIGH_CUTS[kind]?.url].filter(Boolean));
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
// (the turn bf2017-fleet.mjs writes over a file's scene, or none)
export function noseMatrix(doc) {
  const noseNode = doc
    .getRoot()
    .listScenes()
    .flatMap((s) => s.listChildren())
    .find((n) => n.getName() === 'nose');
  return noseNode ? noseNode.getMatrix() : IDENTITY;
}

export function gameToGlb(doc, gameBox) {
  const N = noseMatrix(doc);
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
// (A face that isn't a number is the worst: a NaN fails the 2 % gate, not passes it.)
export function offBy(hullBox, { size, k }) {
  const faces = [];
  for (let a = 0; a < 3; a++) {
    const half = (size[a] * k) / 2;
    for (const [end, v, drawn] of [
      ['min', hullBox.min[a], -half],
      ['max', hullBox.max[a], half],
    ])
      faces.push({ off: Math.abs(v - drawn), face: `${'xyz'[a]} ${end} ${v.toFixed(4)} against ${drawn.toFixed(4)}` });
  }
  return faces.find((f) => Number.isNaN(f.off)) ?? faces.reduce((a, b) => (b.off > a.off ? b : a));
}

// ── which way round ──

// Each drawn primitive's vertices in the frame normalise() draws the model
// in (each through its node's world matrix, turned by the nose, less the
// centre, times k): [{ points, triangles }], `triangles` its index list where
// it is drawn as triangles (as is, or a vertex a corner), else null.
export function drawnPrimitives(doc, { nose, centre, k }) {
  const out = [];
  const e = [0, 0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const points = new Float32Array(pos.getCount() * 3);
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e);
        const p = turnY(nose, apply(m, e[0], e[1], e[2]));
        points.set([(p[0] - centre[0]) * k, (p[1] - centre[1]) * k, (p[2] - centre[2]) * k], i * 3);
      }
      const ind = prim.getIndices();
      const triangles = prim.getMode() !== 4 ? null : ind ? Uint32Array.from(ind.getArray()) : Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
      out.push({ points, triangles });
    }
  }
  return out;
}

// The drawn model's vertices, every primitive's: what a hull's shapes are
// held to point by point.
export function drawnPoints(doc, frame) {
  const prims = drawnPrimitives(doc, frame);
  const out = new Float32Array(prims.reduce((n, p) => n + p.points.length, 0));
  let o = 0;
  for (const { points } of prims) {
    out.set(points, o);
    o += points.length;
  }
  return out;
}

// The distance from a point to the nearest of `points` (xyz runs): the
// points bucketed on a grid of `cell`, searched a ring of cells at a time
// out from the point's cell (clamped into the grid: a point outside it is
// at least as far from every cell as its clamp is), till the next ring can
// hold nothing nearer.
export function nearestOf(points, cell = 0.02) {
  const n = points.length / 3;
  if (!n) throw new Error('no points to be near');
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 3; i++) {
    lo[i % 3] = Math.min(lo[i % 3], points[i]);
    hi[i % 3] = Math.max(hi[i % 3], points[i]);
  }
  const dim = [0, 1, 2].map((a) => Math.max(1, Math.floor((hi[a] - lo[a]) / cell) + 1));
  const at = (v, a) => Math.min(dim[a] - 1, Math.max(0, Math.floor((v - lo[a]) / cell)));
  const key = (i, j, l) => (l * dim[1] + j) * dim[0] + i;
  // (a counting sort: each cell's points a run of `order`, from `start`)
  const start = new Int32Array(dim[0] * dim[1] * dim[2] + 1);
  const of = new Int32Array(n);
  for (let p = 0; p < n; p++) start[(of[p] = key(at(points[p * 3], 0), at(points[p * 3 + 1], 1), at(points[p * 3 + 2], 2))) + 1]++;
  for (let c = 1; c < start.length; c++) start[c] += start[c - 1];
  const fill = start.slice(0, -1);
  const order = new Int32Array(n);
  for (let p = 0; p < n; p++) order[fill[of[p]]++] = p;
  const reach = Math.max(...dim);
  return (x, y, z) => {
    // (a point that isn't a number is nowhere: NaN, which fails what it reaches)
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) return NaN;
    const c = [at(x, 0), at(y, 1), at(z, 2)];
    let best = Infinity;
    for (let r = 0; r <= reach; r++) {
      for (let l = Math.max(0, c[2] - r); l <= Math.min(dim[2] - 1, c[2] + r); l++)
        for (let j = Math.max(0, c[1] - r); j <= Math.min(dim[1] - 1, c[1] + r); j++)
          for (let i = Math.max(0, c[0] - r); i <= Math.min(dim[0] - 1, c[0] + r); i++) {
            if (Math.max(Math.abs(i - c[0]), Math.abs(j - c[1]), Math.abs(l - c[2])) !== r) continue;
            const k = key(i, j, l);
            for (let s = start[k]; s < start[k + 1]; s++) {
              const p = order[s] * 3;
              best = Math.min(best, (points[p] - x) ** 2 + (points[p + 1] - y) ** 2 + (points[p + 2] - z) ** 2);
            }
          }
      if (best <= (r * cell) ** 2) break;
    }
    return Math.sqrt(best);
  };
}

// The hull as placed, and each way round a frame that is off could have put
// it instead: turned half round (nose for tail), a quarter either way, and
// mirrored across x or z (a re-import that baked a turn or a flip into its
// vertices and wrote no `nose` node: the boxes alone can't tell, a ship's
// box being the same turned half round or mirrored).
export const WAYS = {
  'turned π': (x, y, z) => [-x, y, -z],
  'turned π/2': (x, y, z) => [z, y, -x],
  'turned −π/2': (x, y, z) => [-z, y, x],
  'mirrored in x': (x, y, z) => [-x, y, z],
  'mirrored in z': (x, y, z) => [x, y, -z],
};
// a way round that beats the hull as placed by no more than this (a share
// of the length) is a tie, not a better fit: a ship that is the same
// mirrored, as nearly every one is across x, ties by its meshes' rounding
export const TIE = 0.0005;

// Which way round the hull's points sit best on the drawn model's: each
// way's one-way chamfer (the mean distance from a hull point to the nearest
// drawn vertex), and `better`, a way that beats the hull as placed by more
// than TIE, if one does. A hull that a turn or a mirror would fit better is
// on a frame the boxes didn't see was wrong.
export function facing(hull, drawn, { tie = TIE } = {}) {
  const near = nearestOf(drawn);
  const chamfer = (way) => {
    let sum = 0;
    for (let i = 0; i < hull.length; i += 3) sum += near(...way(hull[i], hull[i + 1], hull[i + 2]));
    return sum / (hull.length / 3);
  };
  const placed = chamfer((x, y, z) => [x, y, z]);
  const ways = Object.entries(WAYS).map(([name, way]) => ({ name, chamfer: chamfer(way) }));
  const best = ways.reduce((a, b) => (b.chamfer < a.chamfer ? b : a));
  return { placed, ways, better: !(best.chamfer >= placed - tie) ? best : null };
}

// ── the hull ──

// A capital's part is one part of one of its kit's modules (the module's
// physics asset has parts of its own, each with its own property: the
// Venator's control towers mix p206, the default slot and p132), named for
// the module's file: `stardestroyer_solarionizationreactor_01#0` (its asset's
// part 0 of 2), or the bare slug where the asset has one part
// (`corvettecr90_01` has two, `providenceclassdreadnaught_01` one). A model
// file, a blueprint or a physics asset of the module gives the same slug:
// the last of its path, lower case, without `.glb`, `_physics_win32`, a LOD's
// `_lod<n>` or `_mesh`. (src/data/bf2017/damage.json keys a capital's parts'
// health by these names.)
const slugOfFile = (file) =>
  String(file)
    .split('/')
    .pop()
    .toLowerCase()
    .replace(/\.glb$/, '')
    .replace(/_physics_win32$/, '')
    .replace(/_lod\d+$/, '')
    .replace(/_mesh$/, '');
export function partName(file, index, count) {
  if (!(Number.isInteger(count) && count >= 1 && Number.isInteger(index) && index >= 0 && index < count)) throw new Error(`${file}: part ${index} of ${count}`);
  return count === 1 ? slugOfFile(file) : `${slugOfFile(file)}#${index}`;
}

// The shapes with each one's material set to its part's property, the
// parts list (`part<N>` a part, or its name where `names` has one, each with
// its property, as the shapes bin's version 2 names them: Task 3's hullOf
// reads a triangle's property by its part's index), and the bounding radius:
// the farthest any shape reaches from the middle, either root.
export function assemble(shapes, properties, names = null) {
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
  return { radius, parts: properties.map((property, n) => ({ name: names?.[n] ?? `part${n}`, property })), shapes: out };
}

// ── the capitals: their kits' modules ──

// A static asset with one root has that root for its collision and its
// raycast alike, where a vehicle's two roots split them (findings/62 §5): its
// shapes go to root 1 for bolts and its convex ones to root 0 as well, so in
// a kit of both kinds every module is hit and touched (a hull's bin with two
// roots tests bolts on root 1 and contact on root 0's solids alone,
// src/lib/combat/hulls.js). An asset with two keeps them as they are.
export function bothRoots(shapes) {
  if (new Set(shapes.map((s) => s.root)).size !== 1) return shapes;
  return [...shapes.filter((s) => s.kind !== 'mesh').map((s) => ({ ...s, root: 0 })), ...shapes.map((s) => ({ ...s, root: 1 }))];
}

// A kit's shapes: each of its modules' (`space` piecesOf's result, `kit` its
// model's slug) Havok shapes, from `assets` (physicsKey(file) → { shapes,
// properties }, each part's property from the asset's raw header), through
// the module's place in the kit (`at`, `quaternion`, `scale`: a point is
// at + q (scale × p), in metres in the kit's frame, the anchor hull's). Each
// part of each module is a part of its own, in the kit's order, named
// partName's way and carrying its own property; a module with no physics
// asset (the windows, the decals) is named in `missing`.
export function kitShapes(space, kit, assets) {
  const model = space.models[kit];
  if (!model) throw new Error(`${kit}: no such model in the level (${Object.keys(space.models).join(', ')})`);
  const parts = [];
  const shapes = [];
  const missing = [];
  for (const placed of model.parts) {
    const asset = assets.get(physicsKey(placed.file));
    if (!asset) {
      missing.push(slugOfFile(placed.file));
      continue;
    }
    const first = parts.length;
    const n = asset.properties.length;
    asset.properties.forEach((property, i) => parts.push({ name: partName(placed.file, i, n), property }));
    const { at, quaternion, scale } = placed;
    const to = (x, y, z) => rotate(quaternion, [x * scale[0], y * scale[1], z * scale[2]]).map((v, k) => v + at[k]);
    const points = (list) => {
      const out = new Float32Array(list.length);
      for (let i = 0; i < list.length; i += 3) out.set(to(list[i], list[i + 1], list[i + 2]), i);
      return out;
    };
    for (const s of bothRoots(asset.shapes)) {
      if (!(s.part < n)) throw new Error(`${slugOfFile(placed.file)}: a shape names part ${s.part} of ${n}`);
      const out = { kind: s.kind, root: s.root, part: first + s.part, instance: s.instance ?? 0, material: asset.properties[s.part], points: points(s.points) };
      if (s.indices) out.indices = s.indices;
      if (s.kind === 'capsule') {
        out.a = to(...s.a);
        out.b = to(...s.b);
      }
      if (s.kind === 'sphere') out.centre = to(...s.centre);
      if (s.radius !== undefined) out.radius = s.radius * Math.max(...scale.map(Math.abs));
      shapes.push(out);
    }
  }
  return { shapes, parts, missing };
}

// The points `share` of the length out either side on the hull's widest
// section (where its root 0 corners reach farthest in x, at that corner's
// height and place along it), and whether each is inside one of root 0's
// solids (`hull` hulls.js's hullOf: a solid's planes, inside where n·p ≤ d)
export function wingEdge({ probes, solids }, share) {
  const out = [];
  for (const side of [1, -1]) {
    let best = -1;
    for (let i = 0; i < probes.length; i += 3) if (best < 0 || side * probes[i] > side * probes[best]) best = i;
    const at = [side * share, probes[best + 1], probes[best + 2]];
    const inside = solids.some(({ planes }) => {
      for (let i = 0; i < planes.length; i += 4) if (planes[i] * at[0] + planes[i + 1] * at[1] + planes[i + 2] * at[2] > planes[i + 3] + 1e-6) return false;
      return true;
    });
    out.push({ side: side > 0 ? 'x+' : 'x−', widest: probes[best], at, inside });
  }
  return out;
}
