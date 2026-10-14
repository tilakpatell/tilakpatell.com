// A mode's interact gates (maps/<level>.json `gates`): Hoth's two hangar blast
// doors as the game wires them (bf2-re findings/58), read out of the mode
// sub-world's own graph, beside its spawn logic (bf2017-rulebook-spawnlogic.mjs).
//
// A PF_InteractGate_* prefab's input -1960580174 is its door core's Enabled
// (PF_InteractDoor_Core: it switches on the two PF_Interact_Button panels,
// placed at the locator wired into 1485282277/8). That input is a Bool; the
// Bool is set by an EventGate whose In is a walker's FollowWaypoints route
// event (1762125924): the gate unlocks when that walker finishes its route.
// The EventGate's Close is the other walker's route event (through a
// splitter): the first walker home unlocks its gate and bars the other. The
// gate's output -1157191321 is the door opened at its panel (the spawn
// logic's 'opened' port).
//
// The panel's interaction is the button's WorldInteraction: within
// InteractionMaxDistance of its transform and InteractionMaxAngle of its
// facing, for the StopWatch's TriggerOnTime. That transform is the panel's
// own (In2 of a TransformMultiplier) under the multiplier's In1, a 3× scale,
// so the reach in the world is the distance times that scale: Hoth's panels
// sit in the wall beside each door, facing the field, 4.3 m from the nearest
// floor in front of them (bf2-re findings/59).
//
// The leaves are PF_AutomaticDoor_Controller's: a FloatInterpolator (Sine,
// EaseOut) whose Duration and the leaves' slide (into its Vec3Builders) the
// gate prefab's own interface sets through the door core: Hoth's 70 s and
// 8.96 m, where the controller's own interpolator says 1.5 s. Closed, the two
// leaves overlap past the gate's middle by their meshes' bounds (the export's
// web/models.jsonl).
//
//   gatesOf(root, dir, sub) → [{ id, name, at, yaw, panel: { id, at, yaw }, unlock: path id | null,
//     barredBy: [path id], interact: { distance, scale, angle, hold, _source } | null,
//     door: { seconds, slide, curve, mode, overlap, _source } | null, _source }] | []

import { readFileSync } from 'node:fs';
import { fieldHash as H } from './bf2017-abilities.mjs';
import { follow, objectsOf, shortName, transformOf, webFile } from './bf2017-ebx.mjs';
import { graphOf } from './bf2017-rulebook-spawnlogic.mjs';

const s32 = (h) => h | 0;
const r3 = (v) => Math.round(v * 10000) / 10000;
export const GATE_ENABLED = -1960580174;
export const GATE_PANEL = [1485282277, 1485282278];
export const GATE_OPENED = -1157191321;
export const ROUTE_DONE = 1762125924;
const SPLIT_OUT = -137490305;
const SPLIT_IN = 1723395486;

// a prefab's reference to another prefab, by the referenced one's name
const refTo = (asset, re) => (asset?.objects ?? []).find((o) => re.test(o?.Blueprint?.$asset ?? ''))?.Blueprint ?? null;
const len = (v) => (v ? Math.hypot(v.x, v.y, v.z) : 1);

const indexOfRef = (asset, re) => (asset?.objects ?? []).findIndex((o) => re.test(o?.Blueprint?.$asset ?? ''));
// the interface field of a prefab wired into field `id` of its object `ref` (an index), or null
const fedBy = (asset, ref, id) =>
  (asset.objects[0].PropertyConnections ?? []).find((c) => c.Target?.$ref === ref && s32(c.TargetFieldId) === s32(id) && asset.objects[c.Source?.$ref]?.$type === 'InterfaceDescriptorData')?.SourceFieldId ?? null;
const fieldValue = (asset, id) => (id === null ? '' : (objectsOf(asset, 'InterfaceDescriptorData')[0]?.Fields ?? []).find((f) => s32(f.Id) === s32(id))?.Value ?? '');
const num = (v) => {
  const m = /^(?:Float32|Int32) (-?[\d.]+(?:e[+-]?\d+)?)$/.exec(v);
  return m ? Number(m[1]) : null;
};

// a mesh's bounds as the export wrote them (web/models.jsonl), by the mesh's name
function boundsOf(root, names) {
  const file = webFile(root, 'models.jsonl');
  if (!file) return null;
  const want = new Set(names.map((n) => n.toLowerCase()));
  const out = new Map();
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const at = line.indexOf('"name":"');
    if (at < 0) continue;
    const name = line.slice(at + 8, line.indexOf('"', at + 8)).toLowerCase();
    if (!want.has(name)) continue;
    const row = JSON.parse(line);
    out.set(name, { min: row.min, max: row.max });
  }
  return out.size === want.size ? out : null;
}

// a gate's leaves: PF_InteractGate_* → its PF_InteractDoor_Core → its PF_AutomaticDoor_Controller, each
// value the outermost prefab's that sets it; the leaves' meshes past the gate's middle
export function doorOf(root, gate) {
  const G = follow(root, gate);
  const ci = indexOfRef(G, /PF_InteractDoor_Core$/);
  const D = ci >= 0 ? follow(root, G.objects[ci].Blueprint) : null;
  const ki = D ? indexOfRef(D, /PF_AutomaticDoor_Controller$/) : -1;
  const C = ki >= 0 ? follow(root, D.objects[ki].Blueprint) : null;
  const ii = C ? C.objects.findIndex((o) => o?.$type === 'FloatInterpolatorEntityData') : -1;
  if (ii < 0) return null;
  const interp = C.objects[ii];
  // (the outermost value given the controller's interface field x: the gate's, else the core's, else its own)
  const value = (x) => {
    const xD = fedBy(D, ki, x);
    const xG = xD === null ? null : fedBy(G, ci, xD);
    return num(fieldValue(G, xG)) ?? num(fieldValue(D, xD)) ?? num(fieldValue(C, x));
  };
  const dur = fedBy(C, ii, H('Duration'));
  const slides = new Set();
  for (const c of C.objects[0].PropertyConnections ?? []) if (C.objects[c.Target?.$ref]?.$type === 'Vec3BuilderEntityData' && C.objects[c.Source?.$ref]?.$type === 'InterfaceDescriptorData') slides.add(c.SourceFieldId);
  const slide = Math.max(0, ...[...slides].map((x) => Math.abs(value(x) ?? 0)));
  // (closed, each leaf reaches past the gate's middle: the right one's max x, the left one's −min x)
  const meshes = (G.objects ?? []).filter((o) => o?.$type === 'ObjectReferenceObjectData').map((o) => objectsOf(follow(root, o.Blueprint), 'StaticModelEntityData')[0]?.Mesh?.$asset).filter(Boolean);
  const bounds = meshes.length ? boundsOf(root, meshes) : null;
  const overlap = bounds ? [...bounds.values()].reduce((sum, b) => sum + Math.max(0, Math.min(b.max[0], -b.min[0])), 0) : null;
  return {
    seconds: (dur === null ? null : value(dur)) ?? interp.Duration,
    slide: r3(slide),
    curve: (interp.InterpolationType ?? '').replace('PropertyInterpolationType_', ''),
    mode: (interp.InterpolationMode ?? '').replace('PropertyInterpolationMode_', ''),
    overlap: overlap === null ? null : r3(overlap),
    _source: `${G.name} → ${D.name} → ${C.name}: the FloatInterpolatorEntityData's Duration and the Vec3Builders' slide as the gate's interface sets them; the leaves' meshes' bounds (web/models.jsonl)`,
  };
}

// the interaction a gate's panels carry: PF_InteractGate_* → its PF_InteractDoor_Core → its PF_Interact_Button
export function interactOf(root, gate) {
  const core = refTo(follow(root, gate), /PF_InteractDoor_Core$/);
  const button = core ? follow(root, refTo(follow(root, core), /PF_Interact_Button$/)) : null;
  const wi = button ? objectsOf(button, 'WorldInteractionEntityData')[0] : null;
  if (!wi) return null;
  const mul = objectsOf(button, 'TransformMultiplierEntityData')[0];
  const watch = objectsOf(button, 'StopWatchEntityData')[0];
  return {
    distance: wi.InteractionMaxDistance,
    scale: r3(len(mul?.In1?.right)),
    angle: wi.InteractionMaxAngle,
    hold: watch?.TriggerOnTime ?? 1,
    _source: `${button.name}: WorldInteractionEntityData.InteractionMaxDistance, .InteractionMaxAngle; TransformMultiplierEntityData.In1's scale (on the interaction's Transform); StopWatchEntityData.TriggerOnTime`,
  };
}

export function gatesOf(root, dir, sub) {
  const g = graphOf(root, dir, sub);
  if (!g) return [];
  const { byGuid, pin, evin, links } = g;
  const prefix = `${sub}_`.toLowerCase();
  // a FollowWaypoints' path: the AIWaypointsShapeData it links to
  const pathOf = (fw) => (links.get(fw.id) ?? []).find((l) => l.t.o.$type === 'AIWaypointsShapeData')?.t.id ?? null;
  // the route events reaching an event input, through splitters
  const routesInto = (id, event) => {
    const out = [];
    const walk = (to, ev, depth) => {
      if (depth > 6) return;
      for (const v of evin.get(to) ?? []) {
        if (s32(v.event) !== s32(ev)) continue;
        if (v.src.o.$type === 'FollowWaypointsEntityData' && s32(v.srcEvent) === ROUTE_DONE) {
          const p = pathOf(v.src);
          if (p && !out.includes(p)) out.push(p);
        } else if (v.src.o.$type === 'EventSplitterEntityData' && s32(v.srcEvent) === SPLIT_OUT) walk(v.src.id, SPLIT_IN, depth + 1);
      }
    };
    walk(id, event, 0);
    return out;
  };
  const gates = [];
  for (const e of byGuid.values()) {
    const name = shortName(e.o.Blueprint?.$asset ?? '');
    if (!/^PF_InteractGate_/.test(name) || !e.layer.toLowerCase().startsWith(prefix)) continue;
    const t = transformOf(e.o);
    if (!t) continue;
    const ins = pin.get(e.id) ?? [];
    const loc = ins.find((p) => GATE_PANEL.includes(s32(p.field)))?.src ?? null;
    const lt = loc ? transformOf(loc.o) : null;
    // the Bool on its Enabled, the EventGates that set it true, the routes into their In and their Close
    const bool = ins.find((p) => s32(p.field) === GATE_ENABLED)?.src ?? null;
    let unlock = null;
    const barredBy = [];
    for (const v of bool ? (evin.get(bool.id) ?? []) : []) {
      if (s32(v.event) !== H('SetTrue') || v.src.o.$type !== 'EventGateEntityData') continue;
      unlock ??= routesInto(v.src.id, H('In'))[0] ?? null;
      for (const p of routesInto(v.src.id, H('Close'))) if (!barredBy.includes(p)) barredBy.push(p);
    }
    gates.push({
      id: e.id,
      name,
      at: t.at.map(r3),
      yaw: r3(t.yaw),
      panel: lt ? { id: loc.id, at: lt.at.map(r3), yaw: r3(lt.yaw) } : null,
      unlock,
      barredBy,
      interact: interactOf(root, e.o.Blueprint),
      door: doorOf(root, e.o.Blueprint),
      _source: `${g.subName}#PropertyConnections+EventConnections (${name}: its Enabled's Bool, the EventGate that sets it, the routes into its In and Close; its panel's locator)`,
    });
  }
  return gates.sort((a, b) => a.id.localeCompare(b.id));
}
