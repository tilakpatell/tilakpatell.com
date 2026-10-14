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
// floor in front of them (bf2-re findings/58).
//
//   gatesOf(root, dir, sub) → [{ id, name, at, yaw, panel: { id, at, yaw }, unlock: path id | null,
//     barredBy: [path id], interact: { distance, scale, angle, hold, _source } | null, _source }] | []

import { fieldHash as H } from './bf2017-abilities.mjs';
import { follow, objectsOf, shortName, transformOf } from './bf2017-ebx.mjs';
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
      _source: `${g.subName}#PropertyConnections+EventConnections (${name}: its Enabled's Bool, the EventGate that sets it, the routes into its In and Close; its panel's locator)`,
    });
  }
  return gates.sort((a, b) => a.id.localeCompare(b.id));
}
