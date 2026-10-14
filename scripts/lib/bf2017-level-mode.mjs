// A mode's part of a level (the GA pack, `hoth/ga`: scripts/bf2017-level.mjs
// --district ga --subs FantasyBattle --part), read from the mode's sub-world
// the way the game builds it: every mesh the map's manifest places in the
// sub-level matched to the record that put it there (a layer's reference
// object, through the prefabs it opens), and what the records make of it: a
// door's leaves that slide (PF_AutomaticDoor_Controller, through the door
// prefab and its core), the hangar gates' leaves and their ruins, the wrecks
// and ruins a vehicle spawner shows once its vehicle is destroyed, the
// pickups and the charges an objective holds; and the mode's invisible
// collision (the OBBCollisionEntityData of its layers). Pure: the records
// come through `load(name) → asset | null` (bf2017-ebx.mjs's follow), the
// manifest's instances through `instances`. bf2-re findings/58 is the worked
// example.
//
//   readMode(load, { sub, instances, origin, layers }) → mode.json's
//     { controller, doors, gates, props, boxes, statics, unmatched, _source }
//   expand(load, blueprint, world) → [{ mesh, world, path: [object index…], blueprint }]
//   layerObjects(load, sub) → [{ id: '<layer>:<i>', layer, i, o, guid, world }]
//   assign(instances, owners) → instances with { owner, path, d }: the nearest placement of the same mesh
//   valueAt(load, chain, field, levelInto) → a field's value at the end of a chain of prefabs
//   boxesOf(layer, origin) → the OBBCollisionEntityData of a layer as boxes
//   T(lt), mul(local, parent), quatOf(t), fromManifest(m, offset), fieldValue(text), meshFile(asset)
//
// Transforms are { r, u, f, t } (Frostbite's LinearTransform: right, up,
// forward, translation, in the export's frame); a child's world is
// mul(child, parent): local first, then the parent (the row-vector order).

import { fieldHash as H } from './bf2017-abilities.mjs';

const s32 = (h) => h | 0;
const v3 = (p) => [p?.x ?? 0, p?.y ?? 0, p?.z ?? 0];
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const round = (a) => a.map(r4);
const last = (name) => String(name).slice(String(name).lastIndexOf('/') + 1);
const len = (a) => Math.hypot(...a);
const unit = (a) => {
  const l = len(a) || 1;
  return a.map((x) => x / l);
};

// ── transforms ──

export const T = (lt) => ({ r: lt?.right ? v3(lt.right) : [1, 0, 0], u: lt?.up ? v3(lt.up) : [0, 1, 0], f: lt?.forward ? v3(lt.forward) : [0, 0, 1], t: v3(lt?.trans) });
export const IDENTITY = { r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, 1], t: [0, 0, 0] };
// (a vector in a transform's axes, out in its parent's frame)
export const turn = (p, a) => [0, 1, 2].map((k) => a[0] * p.r[k] + a[1] * p.u[k] + a[2] * p.f[k]);
export function mul(local, parent) {
  const t = turn(parent, local.t);
  return { r: turn(parent, local.r), u: turn(parent, local.u), f: turn(parent, local.f), t: [t[0] + parent.t[0], t[1] + parent.t[1], t[2] + parent.t[2]] };
}
// the manifest's 12 numbers (column-major 3×4: right, up, forward, translation)
export const fromManifest = (m, o = 0) => ({ r: [m[o], m[o + 1], m[o + 2]], u: [m[o + 3], m[o + 4], m[o + 5]], f: [m[o + 6], m[o + 7], m[o + 8]], t: [m[o + 9], m[o + 10], m[o + 11]] });

// the rotation whose matrix has the transform's axes as its columns, [x, y, z, w]
export function quatOf(t) {
  const [m00, m10, m20] = unit(t.r);
  const [m01, m11, m21] = unit(t.u);
  const [m02, m12, m22] = unit(t.f);
  const tr = m00 + m11 + m22;
  let x;
  let y;
  let z;
  let w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const l = Math.hypot(x, y, z, w) || 1;
  return [x / l, y / l, z / l, w / l];
}

// ── placements ──

export const meshFile = (asset) => `models/${String(asset).toLowerCase()}.glb`;

// the mesh an ObjectBlueprint's entity draws (its StaticModelEntityData's Mesh)
function meshOfObject(a) {
  const top = a.objects[a.root];
  const obj = top?.Object?.$ref != null ? a.objects[top.Object.$ref] : null;
  return obj?.Mesh?.$asset ? meshFile(obj.Mesh.$asset) : null;
}

const PLACING = /^(ObjectReferenceObjectData|SpatialPrefabReferenceObjectData)$/;

export function expand(load, blueprint, world = IDENTITY, path = [], depth = 0) {
  const a = load(blueprint);
  if (!a || depth > 8) return [];
  const top = a.objects[a.root];
  if (top?.$type === 'ObjectBlueprint') {
    const mesh = meshOfObject(a);
    return mesh ? [{ mesh, world, path, blueprint }] : [];
  }
  const out = [];
  for (const ref of top?.Objects ?? []) {
    const o = a.objects[ref?.$ref];
    if (!o?.Blueprint?.$asset || !PLACING.test(o.$type)) continue;
    out.push(...expand(load, o.Blueprint.$asset, mul(T(o.BlueprintTransform), world), [...path, ref.$ref], depth + 1));
  }
  return out;
}

export function layerObjects(load, sub) {
  const subAsset = load(sub);
  const top = subAsset?.objects?.[subAsset.root ?? 0];
  const out = [];
  for (const ref of top?.Objects ?? []) {
    const layer = load(subAsset.objects[ref.$ref]?.Blueprint?.$asset);
    if (!layer) continue;
    layer.objects.forEach((o, i) => {
      if (o?.Blueprint?.$asset && (PLACING.test(o.$type) || o.$type === 'LogicPrefabReferenceObjectData')) out.push({ id: `${last(layer.name)}:${i}`, layer: layer.name, i, o, guid: o.$guid, world: T(o.BlueprintTransform) });
    });
  }
  return out;
}

export function assign(instances, owners) {
  const byMesh = new Map();
  for (const w of owners) {
    if (!byMesh.has(w.mesh)) byMesh.set(w.mesh, []);
    byMesh.get(w.mesh).push(w);
  }
  return instances.map((inst) => {
    let best = null;
    let bd = Infinity;
    for (const w of byMesh.get(inst.mesh) ?? []) {
      const d = len([0, 1, 2].map((k) => w.world.t[k] - inst.world.t[k]));
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    return { ...inst, owner: best?.owner ?? null, path: best?.path ?? null, blueprint: best?.blueprint ?? null, d: bd };
  });
}

// ── values ──

// an interface field's written value: 'Float32 1.5' → 1.5, 'Boolean True' → true, 'TeamId Team1' → 1; '' → undefined
export function fieldValue(text) {
  if (text == null || text === '') return undefined;
  const [kind, ...rest] = String(text).split(' ');
  const v = rest.join(' ');
  if (kind === 'Boolean') return v === 'True';
  if (kind === 'TeamId') return v === 'TeamNeutral' ? 0 : Number(v.replace('Team', ''));
  if (/^(Float|Int|Uint)/.test(kind)) return Number(v);
  return v;
}

const ifaceIndex = (a) => a.objects.findIndex((o) => o?.$type === 'InterfaceDescriptorData');
const defaultOf = (a, field) => {
  const f = (a?.objects[ifaceIndex(a)]?.Fields ?? []).find((x) => s32(x.Id) === s32(field));
  return f ? fieldValue(f.Value) : undefined;
};
// (the property connections into one object's field, the last made first: a later one writes over an earlier)
const intoRef = (a, index, field) => (a.objects[a.root].PropertyConnections ?? []).filter((c) => c.Target?.$ref === index && s32(c.TargetFieldId) === s32(field)).reverse();
// (an entity whose value is its own: a Bool's, a Float's, an Int's default)
const constantOf = (o) => (o && 'DefaultValue' in o && typeof o.DefaultValue !== 'object' ? o.DefaultValue : undefined);

// The value a field of an object deep in placed prefabs gets: from that object out,
// at each prefab the last property connection into it (an interface field of the
// prefab around it, followed on out; or an entity there, whose own value it is),
// and at the outermost the level's connection into the placement
// (`levelInto(field)`), else the interface's default. `chain`: [{ asset, index }],
// the outermost prefab first (its index the placement's in its layer, unused),
// each next one the object index inside the one before.
export function valueAt(load, chain, field, levelInto = () => undefined) {
  let f = field;
  for (let k = chain.length - 1; k >= 1; k--) {
    const holder = load(chain[k - 1].asset);
    const into = intoRef(holder, chain[k].index, f)[0];
    if (!into) return defaultOf(load(chain[k].asset), f);
    const src = holder.objects[into.Source.$ref];
    if (src?.$type !== 'InterfaceDescriptorData') {
      const c = constantOf(src);
      return c !== undefined ? c : { from: `${last(holder.name)}:${into.Source.$ref}`, type: src?.$type ?? null };
    }
    f = into.SourceFieldId;
  }
  const lv = levelInto(f);
  return lv !== undefined ? lv : defaultOf(load(chain[0].asset), f);
}
const plain = (v) => (v && typeof v === 'object' ? (v.value ?? undefined) : v);

// ── the door controller ──

// Gameplay/GameModes/Shared/Doors/PF_AutomaticDoor_Controller's interface, by the
// graph inside it (findings/58 §2): the three team bools the core sets from the
// door's TeamId (TeamIdToInt → IntToEvent 0, 1, 2), the duration into its
// FloatInterpolator, the two slides (Vec3Builders into the leaves'
// TransformBuilders: the left leaf's blend takes the first, the right's the
// second), the SelectVec3's axis bools (Select0 the X builder, Select1 Z,
// Select2 Y), the both-teams bool, the two blends out to the leaves
export const CONTROLLER = 'Gameplay/GameModes/Shared/Doors/PF_AutomaticDoor_Controller';
export const PORT = {
  duration: 1350828081,
  slideLeft: -1015536881,
  slideRight: -297181580,
  axisX: -739750147,
  axisZ: -818160449,
  axisY: -928313764,
  bothTeams: -936368495,
  leftLeaf: -1467831627,
  rightLeaf: -769738674,
};
const LEAF_OUT = { [s32(PORT.leftLeaf)]: 'left', [s32(PORT.rightLeaf)]: 'right' };
const TRANSFORM = H('Transform');
const TEAM = H('TeamId');
const OPEN_DOOR = H('OpenDoor');
const CLOSE_DOOR = H('CloseDoor');
const ENABLED = H('Enabled');
const VISIBLE = H('Visible');

export function controllerRecord(load) {
  const a = load(CONTROLLER);
  if (!a) return null;
  const k = a.objects.findIndex((o) => o?.$type === 'FloatInterpolatorEntityData');
  const interp = a.objects[k];
  return {
    curve: String(interp?.InterpolationType ?? '').replace('PropertyInterpolationType_', ''),
    mode: String(interp?.InterpolationMode ?? '').replace('PropertyInterpolationMode_', ''),
    duration: interp?.Duration ?? null,
    triggers: a.objects.filter((o) => o?.$type === 'GeometryTriggerEntityData').map((o) => ({ include: String(o.Include ?? ''), allies: Number(String(o.TeamOfAllies ?? '').replace('Team', '')) || 0 })),
    _source: `${CONTROLLER}#FloatInterpolatorEntityData[${k}], GeometryTriggerEntityData`,
  };
}

// a door prefab's core (PF_AutomaticDoor_Core, PF_InteractDoor_Core), its leaves and, per
// leaf, the controller whose blend moves it (the core's output wired to the leaf's Transform)
function doorOf(load, prefab) {
  const a = load(prefab);
  const top = a?.objects[a.root];
  const coreRef = (top?.Objects ?? []).map((r) => r.$ref).find((i) => /\/Doors\/PF_(Automatic|Interact)Door_Core$/.test(a.objects[i]?.Blueprint?.$asset ?? ''));
  if (coreRef == null) return null;
  const coreName = a.objects[coreRef].Blueprint.$asset;
  const core = load(coreName);
  const cTop = core.objects[core.root];
  const cIface = ifaceIndex(core);
  const leaves = [];
  for (const c of top.PropertyConnections ?? []) {
    if (c.Source?.$ref !== coreRef || s32(c.TargetFieldId) !== TRANSFORM) continue;
    const o = a.objects[c.Target.$ref];
    if (o?.$type !== 'ObjectReferenceObjectData') continue;
    const via = (cTop.PropertyConnections ?? []).find((p) => p.Target?.$ref === cIface && s32(p.TargetFieldId) === s32(c.SourceFieldId) && core.objects[p.Source?.$ref]?.Blueprint?.$asset === CONTROLLER);
    if (!via) continue;
    leaves.push({ index: c.Target.$ref, side: LEAF_OUT[s32(via.SourceFieldId)] ?? null, controller: via.Source.$ref, blueprint: o.Blueprint.$asset, local: T(o.BlueprintTransform) });
  }
  const link = (top.LinkConnections ?? []).find((l) => l.Source?.$ref === coreRef && a.objects[l.Target?.$ref]?.$type === 'OBBData');
  const obb = link ? a.objects[link.Target.$ref] : null;
  return { coreRef, core: coreName, leaves, trigger: obb ? { local: T(obb.Transform), half: v3(obb.HalfExtents) } : null };
}

// ── the mode's part ──

// the blueprints' names along a placed mesh's path, the outermost first
function pathNames(load, blueprint, path) {
  const out = [last(blueprint)];
  let a = load(blueprint);
  for (const i of path) {
    const name = a?.objects[i]?.Blueprint?.$asset;
    if (!name) break;
    out.push(last(name));
    a = load(name);
  }
  return out;
}

const KIND = [
  // (a walker's destruction stages and its fall's dressing, played where it falls: the walker's own, not the spawner's place)
  [/VehicleSpawner_AT-AT/i, 'walker'],
  [/VehicleSpawner/i, 'wreck'],
  [/Destruction_Gate$/, 'gateRuin'],
  [/PF_Pickup_/, 'pickup'],
  [/PF_Interact_PlanetaryBattle_/, 'charge'],
];

// what switches a mesh of a placed prefab on: at each prefab on its path, from
// the outermost in, a property connection into that object's Enabled or Visible
// (a Bool's own value, an interface field, another entity's output); the first
// found decides, none is a mesh that always stands
function switchOf(load, blueprint, path) {
  let a = load(blueprint);
  for (let k = 0; k < path.length && a; k++) {
    const i = path[k];
    const into = (a.objects[a.root].PropertyConnections ?? []).find((c) => c.Target?.$ref === i && (s32(c.TargetFieldId) === ENABLED || s32(c.TargetFieldId) === VISIBLE));
    if (into) {
      const src = a.objects[into.Source.$ref];
      const field = s32(into.TargetFieldId) === ENABLED ? 'Enabled' : 'Visible';
      if (src?.$type === 'InterfaceDescriptorData') return { field, from: 'interface', port: s32(into.SourceFieldId), in: `${last(a.name)}:${i}` };
      return { field, from: src?.$type ?? null, start: constantOf(src), in: `${last(a.name)}:${i}` };
    }
    a = load(a.objects[i]?.Blueprint?.$asset);
  }
  return { always: true };
}

// the sub-world's static model groups: their members' meshes, each drawn
// wherever the group puts it and switched by nothing (Frostbite batches a
// layer's plain static models into one StaticModelGroupEntityData)
function staticGroups(load, subAsset) {
  const out = new Map();
  subAsset.objects.forEach((o, i) => {
    if (o?.$type !== 'StaticModelGroupEntityData') return;
    for (const m of o.MemberDatas ?? []) {
      const bp = load(m.MemberType?.$asset);
      const mesh = bp && meshOfObject(bp);
      if (mesh) out.set(mesh, `${last(subAsset.name)}#StaticModelGroupEntityData[${i}] (${last(m.MemberType.$asset)} ×${m.InstanceCount ?? '?'})`);
    }
  });
  return out;
}

// a prefab's kind by its name, and the end-of-round room inside the mode prefab (never drawn in a round)
const EOR = /PF_EOR_|NowhereDome|StarCard/i;

export function readMode(load, { sub, instances, origin = [0, 0, 0], layers = [] }) {
  const subAsset = load(sub);
  const top = subAsset?.objects?.[subAsset?.root ?? 0];
  if (!top) throw new Error(`${sub}: no sub-world`);
  const objects = layerObjects(load, sub);
  const byGuid = new Map(objects.map((x) => [`${x.layer}|${x.guid}`, x]));
  // (the logic records of the layers, for the far end of a connection: any object with a guid)
  const anyEnd = (end) => {
    if (!end?.$asset) return null;
    const hit = byGuid.get(`${end.$asset}|${end.$class}`);
    if (hit) return hit;
    const a = load(end.$asset);
    const i = a?.objects.findIndex((o) => o?.$guid === end.$class) ?? -1;
    return i >= 0 ? { id: `${last(a.name)}:${i}`, layer: a.name, i, o: a.objects[i] } : null;
  };
  const subIface = subAsset.objects[ifaceIndex(subAsset)];
  const subField = (id) => (subIface?.Fields ?? []).find((f) => s32(f.Id) === s32(id));
  const pc = top.PropertyConnections ?? [];
  const ec = top.EventConnections ?? [];
  // a level's connections into a placement's field: the sub-world's interface constants and the entities' own values;
  // a graph's live output kept beside them (`live`: what feeds it, the page's to run)
  const levelInto = (id) => (field) => {
    const into = pc.filter((c) => anyEnd(c.Target)?.id === id && s32(c.TargetFieldId) === s32(field));
    if (!into.length) return undefined;
    const vals = into.map((c) => {
      if (c.Source?.$ref != null && subAsset.objects[c.Source.$ref]?.$type === 'InterfaceDescriptorData') return fieldValue(subField(c.SourceFieldId)?.Value);
      const s = anyEnd(c.Source);
      const k = constantOf(s?.o);
      return k !== undefined ? k : { live: s?.id ?? null, type: s?.o?.$type ?? null };
    });
    const constant = vals.find((v) => typeof v !== 'object');
    const live = vals.filter((v) => typeof v === 'object');
    return live.length ? { value: constant, live } : constant;
  };
  const eventsInto = (id, event) =>
    ec
      .filter((c) => anyEnd(c.Target)?.id === id && s32(c.TargetEvent?.Id) === s32(event))
      .map((c) => {
        const s = anyEnd(c.Source);
        return { from: s?.id ?? null, type: s?.o?.$type ?? null, ...(s?.o?.$type === 'DelayEntityData' ? { delay: s.o.Delay } : {}) };
      });

  const owners = [];
  for (const x of objects) for (const e of expand(load, x.o.Blueprint.$asset, x.world)) owners.push({ ...e, owner: x.id });
  const placed = assign(instances, owners);
  const byOwner = new Map();
  for (const p of placed) if (p.d < 0.05) (byOwner.get(p.owner) ?? byOwner.set(p.owner, []).get(p.owner)).push(p);
  const toPack = (t) => round([t[0] - origin[0], t[1] - origin[1], t[2] - origin[2]]);
  const inst = (p) => ({ mesh: p.mesh, at: toPack(p.world.t) });

  const controller = controllerRecord(load);
  const doors = [];
  const gates = [];
  const props = [];
  const taken = new Set();
  for (const x of objects) {
    const bp = x.o.Blueprint.$asset;
    const name = last(bp);
    const mine = byOwner.get(x.id) ?? [];
    const door = /Door|Gate_Hoth/.test(name) && x.o.$type === 'SpatialPrefabReferenceObjectData' ? doorOf(load, bp) : null;
    if (door?.leaves.length) {
      const into = levelInto(x.id);
      const ctl = door.leaves[0].controller;
      const chain = [{ asset: bp, index: x.i }, { asset: door.core, index: door.coreRef }, { asset: CONTROLLER, index: ctl }];
      const at = (port) => valueAt(load, chain, port, into);
      const axis = plain(at(PORT.axisX)) ? 'x' : plain(at(PORT.axisZ)) ? 'z' : plain(at(PORT.axisY)) ? 'y' : 'x';
      const slide = { left: plain(at(PORT.slideLeft)) ?? 0, right: plain(at(PORT.slideRight)) ?? 0 };
      const leaves = door.leaves.map((l) => {
        const world = mul(l.local, x.world);
        const p = mine.find((m) => m.path?.[0] === l.index);
        if (p) taken.add(p);
        const by = slide[l.side] ?? 0;
        // (the controller's TransformMultiplier: the slide in the leaf's own axes, then the leaf's world)
        const offset = turn(world, axis === 'x' ? [by, 0, 0] : axis === 'y' ? [0, by, 0] : [0, 0, by]);
        return { side: l.side, mesh: p?.mesh ?? null, at: toPack(world.t), slide: round(offset) };
      });
      const box = door.trigger ? mul(door.trigger.local, x.world) : null;
      const team = into(TEAM) ?? defaultOf(load(bp), TEAM);
      const rec = {
        id: x.id,
        prefab: name,
        at: toPack(x.world.t),
        team: plain(team) ?? 0,
        ...(team && typeof team === 'object' ? { teamLive: team.live.map((l) => l.live) } : {}),
        duration: plain(at(PORT.duration)) ?? controller?.duration ?? null,
        bothTeams: Boolean(plain(at(PORT.bothTeams))),
        axis,
        leaves,
        trigger: box ? { at: toPack(box.t), half: round(door.trigger.half.map((h, k) => h * len([box.r, box.u, box.f][k]))), rotation: round(quatOf(box)) } : null,
        opens: eventsInto(x.id, OPEN_DOOR),
        closes: eventsInto(x.id, CLOSE_DOOR),
        _source: `${x.layer}#${x.o.$type}[${x.i}] → ${bp} → ${door.core} → ${CONTROLLER}`,
      };
      if (/Gate/.test(name)) {
        rec.interactTeam = plain(into(-1074593163)) ?? null;
        rec.leavesEnabled = into(-1756439259) ?? null;
        rec.panelEnabled = into(-1960580174) ?? null;
        gates.push(rec);
      } else doors.push(rec);
    }
    const rest = mine.filter((p) => !taken.has(p));
    if (!rest.length) continue;
    const kind = KIND.find(([re]) => re.test(name))?.[1] ?? 'static';
    const parts = new Map();
    for (const p of rest) {
      // (the end of round's room the mode prefab holds: its own cameras' only, never a round's)
      const eor = pathNames(load, bp, p.path).find((n) => EOR.test(n));
      const sw = eor ? { never: true, in: eor } : switchOf(load, bp, p.path);
      const key = JSON.stringify(sw);
      if (!parts.has(key)) parts.set(key, { switch: sw, instances: [] });
      parts.get(key).instances.push(inst(p));
    }
    props.push({ id: x.id, prefab: name, kind, at: toPack(x.world.t), enabled: levelInto(x.id)(ENABLED) ?? null, visible: levelInto(x.id)(VISIBLE) ?? null, parts: [...parts.values()], _source: `${x.layer}#${x.o.$type}[${x.i}] → ${bp}` });
  }

  const boxes = layers.flatMap((l) => boxesOf(load(l), origin));
  // (what no placement explains: a static group's member stands; the rest is left to its own rows, the actors)
  const groups = staticGroups(load, subAsset);
  const loose = placed.filter((p) => !(p.d < 0.05));
  const statics = [];
  for (const p of loose) {
    const from = groups.get(p.mesh);
    if (!from) continue;
    let row = statics.find((x) => x._source === from);
    if (!row) statics.push((row = { mesh: p.mesh, instances: [], _source: from }));
    row.instances.push(inst(p));
  }
  return {
    controller,
    doors,
    gates,
    props,
    boxes,
    statics,
    unmatched: loose.filter((p) => !groups.has(p.mesh)).map((p) => ({ mesh: p.mesh, at: toPack(p.world.t), d: Number.isFinite(p.d) ? r4(p.d) : null })),
    _source: `${sub}#Objects (its layers' reference objects, through their prefabs), matched to the manifest's instances by mesh and place`,
  };
}

// An OBBCollisionEntityData as a box (a SphereCollisionEntityData as a ball): its transform's middle and turn, its
// half extents times its axes' scale; `layer`: the game's collision layer
// (CharacterCollisionGeometry meets characters and ragdolls only, findings/46's
// pair table; Static meets everything)
export function boxesOf(layer, origin = [0, 0, 0]) {
  if (!layer) return [];
  return layer.objects.flatMap((o, i) => {
    const layerOf = /CharacterCollisionGeometry/.test(o?.CollisionLayer ?? '') ? 'character' : 'static';
    // (a SphereCollisionEntityData: its Position and Radius)
    if (o?.$type === 'SphereCollisionEntityData' && o.Enabled !== false) {
      const p = v3(o.Position);
      return [{ at: round([p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]]), radius: r4(o.Radius ?? 0), layer: layerOf, _source: `${layer.name}#SphereCollisionEntityData[${i}]` }];
    }
    if (o?.$type !== 'OBBCollisionEntityData' || o.Enabled === false) return [];
    const t = T(o.Transform);
    return [
      {
        at: round([t.t[0] - origin[0], t.t[1] - origin[1], t.t[2] - origin[2]]),
        half: round(v3(o.HalfExtents).map((h, k) => h * len([t.r, t.u, t.f][k]))),
        rotation: round(quatOf(t)),
        layer: layerOf,
        _source: `${layer.name}#OBBCollisionEntityData[${i}]`,
      },
    ];
  });
}
