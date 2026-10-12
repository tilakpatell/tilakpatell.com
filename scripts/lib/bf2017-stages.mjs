// Which spawn areas and spawn points a Galactic Assault stage enables, read
// from the wiring instead of from where they sit (bf2-re finding 27 §4c).
// The mode prefab (`PF_GameMode_Conquest_Staged`, placed in `<Mode>_Logic`)
// has six stage-enable output ports (Team1 stage 1/2/3, Team2 stage 1/2/3);
// the sub-world's `PropertyConnections` carry each port into the And/Or/Not
// gates of `<Mode>_Spawns` and from there into every spawn area's and spawn
// point's `Enabled` (field hash 2662400). The gates also read Bools the
// level sets at run time, by `EventConnections`:
//
//   steps    a `SelectEventEntityData` on the escort tracker's int (the
//            walkers' waypoint triggers passed, 0…7) fires the event named by
//            its value into splitters that set one Bool true and the last
//            one false: the spawn areas walk forward with the walkers
//   opening  Bools the prefab's start event (-474851384, the round controller
//            hub's, once a round) sets false through a Delay (25 s on Hoth):
//            the rooms open only as the round starts
//   gated    any other event-set Bool (a gate's opening): enabled, listed
//
// This walks those chains for each stage with that stage's two ports true
// and the other four false. Pure over the export's JSON.
//
//   buildGraph(sub, layers) → graph        sub: the sub-world file; layers: { name: file }
//   evalField(graph, guid, field, ports, state) → true | false | 'gated' | null (no driver)
//   stepStates(graph) → { selector, states: [Map(bool guid → value)], at: { path id: [waypoint index] } } | null
//   openingBools(graph, prefab) → Map(bool guid → seconds)
//   stageSets(graph, { prefab, ports, stages, teams }) → per stage { areas, points, steps?, opening? }
//     areas, points: { attack, defend, gated } (ids, every step's and the opening's together)
//     steps: { areas: { attack: [[n]], defend: [[n]] }, points: … } (object indices in the kind's layer, a list a step)
//     opening: { seconds, areas: { attack: [n], defend: [n] }, points: … } (only as the first stage starts)

export const ENABLED = 2662400;
// The GA prefab's stage-enable ports, by team and stage (finding 27 §2).
export const GA_PORTS = { 1: [985615985, 985615986, 985615987], 2: [985719506, 985719505, 985719504] };
export const AREA = 'SpawnLocationFinderShapeData';
export const POINT = 'AlternateSpawnEntityData';

// the export's name hash (djb2 with xor), as an unsigned int
export const hash = (name) => {
  let h = 5381;
  for (const c of Buffer.from(name)) h = ((h * 33) ^ c) >>> 0;
  return h;
};
const SET_TRUE = hash('SetTrue');
const SET_FALSE = hash('SetFalse');
const push = (map, key, v) => (map.get(key) ?? map.set(key, []).get(key)).push(v);

export function buildGraph(sub, layers) {
  const nodes = new Map();
  for (const [name, file] of Object.entries(layers)) file.objects.forEach((o, i) => o?.$guid && nodes.set(o.$guid, { layer: name, index: i, obj: o }));
  const top = sub.objects[0];
  const into = new Map(); // guid → [{ from: guid, field: SourceFieldId, to: TargetFieldId }]
  for (const c of top.PropertyConnections ?? []) if (c.Source?.$class && c.Target?.$class) push(into, c.Target.$class, { from: c.Source.$class, field: c.SourceFieldId, to: c.TargetFieldId });
  // events out of a node, and the nodes an event reaches (a Bool with an event into it is set at run time)
  const out = new Map(); // guid → [{ event, to, toEvent }]
  const eventSet = new Set();
  for (const c of top.EventConnections ?? []) {
    if (!c.Source?.$class || !c.Target?.$class) continue;
    push(out, c.Source.$class, { event: c.SourceEvent.Id >>> 0, to: c.Target.$class, toEvent: c.TargetEvent.Id >>> 0 });
    eventSet.add(c.Target.$class);
  }
  const links = new Map(); // guid → [{ to, field: TargetFieldId }]
  for (const c of top.LinkConnections ?? []) if (c.Source?.$class && c.Target?.$class) push(links, c.Source.$class, { to: c.Target.$class, field: c.TargetFieldId });
  return { nodes, into, out, eventSet, links, layers };
}

const and3 = (vals) => (vals.some((v) => v === false) ? false : vals.some((v) => v === 'gated' || v == null) ? 'gated' : true);
const or3 = (vals) => (vals.some((v) => v === true) ? true : vals.some((v) => v === 'gated' || v == null) ? 'gated' : false);

// the value a node puts out on `field` (the gates have one output; a port is the prefab's field)
function evalOut(graph, guid, field, ports, state, seen) {
  if (ports.has(guid)) return ports.get(guid).get(field) ?? false;
  const n = graph.nodes.get(guid);
  if (!n) return 'gated';
  const key = `${guid}:${field}`;
  if (seen.has(key)) return 'gated';
  seen.add(key);
  const t = n.obj.$type;
  const ins = (graph.into.get(guid) ?? []).map((e) => evalOut(graph, e.from, e.field, ports, state, seen));
  let v;
  if (t === 'AndEntityData') v = ins.length ? and3(ins) : 'gated';
  else if (t === 'OrEntityData') v = ins.length ? or3(ins) : 'gated';
  else if (t === 'NotEntityData') v = ins.length ? (ins[0] === 'gated' ? 'gated' : !ins[0]) : !n.obj.In;
  else if (t === 'BoolEntityData') v = state?.has(guid) ? state.get(guid) : graph.eventSet.has(guid) ? 'gated' : !!n.obj.DefaultValue;
  else v = 'gated';
  seen.delete(key);
  return v;
}

export function evalField(graph, guid, field, ports, state = null) {
  const drivers = (graph.into.get(guid) ?? []).filter((e) => e.to === field);
  if (!drivers.length) return null;
  return or3(drivers.map((e) => evalOut(graph, e.from, e.field, ports, state, new Set())));
}

// an event arriving at a node: a Bool is set, a splitter or a delay passes it on
function fire(graph, state, guid, toEvent, seen = new Set()) {
  const n = graph.nodes.get(guid);
  if (!n) return;
  const t = n.obj.$type;
  if (t === 'BoolEntityData') {
    if (toEvent === SET_TRUE) state.set(guid, true);
    else if (toEvent === SET_FALSE) state.set(guid, false);
  } else if ((t === 'EventSplitterEntityData' || t === 'DelayEntityData') && !seen.has(guid)) {
    seen.add(guid);
    for (const e of graph.out.get(guid) ?? []) fire(graph, state, e.to, e.toEvent, seen);
  }
}

const idOf = (n) => `${n.layer}:${n.index}`;
const teamOf = (o) => Number(String(o.Team ?? '').replace(/^Team/, '')) || 0;

// The escort tracker's waypoints: each waypoint trigger that feeds the
// selector's driver is linked to its path by the waypoint's name hash.
function trackerWaypoints(graph, selector) {
  const trackers = new Set((graph.into.get(selector) ?? []).map((e) => e.from));
  const at = {};
  for (const [src, edges] of graph.out) {
    const n = graph.nodes.get(src);
    if (n?.obj.$type !== 'WaypointTriggerEntityData' || !edges.some((e) => trackers.has(e.to))) continue;
    for (const l of graph.links.get(src) ?? []) {
      const shape = graph.nodes.get(l.to);
      if (shape?.obj.$type !== 'AIWaypointsShapeData') continue;
      const objects = graph.layers[shape.layer].objects;
      const i = shape.obj.Waypoints.findIndex((r) => r && objects[r.$ref]?.SchematicsNameHash === l.field);
      if (i >= 0) (at[idOf(shape)] ??= []).push(i);
    }
  }
  for (const list of Object.values(at)) list.sort((a, b) => a - b);
  return { at, tracker: [...trackers].map((g) => graph.nodes.get(g)).filter(Boolean).map(idOf)[0] ?? null };
}

// The selector's steps: the Bools' state after each of its events in turn, from their defaults.
export function stepStates(graph) {
  for (const [guid, n] of graph.nodes) {
    if (n.obj.$type !== 'SelectEventEntityData') continue;
    const state = new Map();
    const raw = [];
    for (const name of n.obj.Events ?? []) {
      for (const e of graph.out.get(guid) ?? []) if (e.event === hash(name)) fire(graph, state, e.to, e.toEvent);
      raw.push(new Map(state));
    }
    const touched = [...new Set(raw.flatMap((s) => [...s.keys()]))];
    if (!touched.length) continue;
    const states = raw.map((s) => new Map(touched.map((g) => [g, s.has(g) ? s.get(g) : !!graph.nodes.get(g).obj.DefaultValue])));
    return { selector: idOf(n), states, ...trackerWaypoints(graph, guid) };
  }
  return null;
}

// The Bools the prefab's own events shut through a Delay: true by default, false the delay later.
export function openingBools(graph, prefab) {
  const out = new Map();
  for (const e of graph.out.get(prefab) ?? []) {
    const n = graph.nodes.get(e.to);
    if (n?.obj.$type !== 'DelayEntityData') continue;
    const state = new Map();
    fire(graph, state, e.to, e.toEvent);
    for (const [g, v] of state) if (v === false && graph.nodes.get(g).obj.DefaultValue) out.set(g, n.obj.Delay);
  }
  return out;
}

const byIndex = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const numberOf = (id) => Number(id.slice(id.lastIndexOf(':') + 1));

// ports: { team: [port per stage] }; teams: { attack: 2, defend: 1 }
export function stageSets(graph, { prefab, ports = GA_PORTS, stages = 3, teams = { attack: 2, defend: 1 } }) {
  const sideOf = { [teams.attack]: 'attack', [teams.defend]: 'defend' };
  const portMap = (on) => new Map([[prefab, new Map(Object.entries(ports).flatMap(([team, list]) => list.map((p, k) => [p, on(Number(team), k)])))]]);
  const steps = stepStates(graph);
  const opening = openingBools(graph, prefab);
  const shut = new Map([...opening.keys()].map((g) => [g, false]));
  const open = new Map([...opening.keys()].map((g) => [g, true]));
  const spawnNodes = [...graph.nodes.values()].filter((n) => n.obj.$type === AREA || n.obj.$type === POINT);

  // one evaluation: each kind's ids by side, and the ones an unread Bool still holds
  const evaluate = (k, state) => {
    const sets = { areas: { attack: [], defend: [], gated: [] }, points: { attack: [], defend: [], gated: [] } };
    const both = portMap((team, s) => s === k);
    const only = (t) => portMap((team, s) => s === k && team === t);
    for (const n of spawnNodes) {
      const v = evalField(graph, n.obj.$guid, ENABLED, both, state);
      if (v === null || v === false) continue;
      // a neutral area belongs to the side whose port alone opens it
      const side = sideOf[teamOf(n.obj)] ?? (evalField(graph, n.obj.$guid, ENABLED, only(teams.attack), state) ? 'attack' : evalField(graph, n.obj.$guid, ENABLED, only(teams.defend), state) ? 'defend' : null);
      if (!side) continue;
      const bucket = n.obj.$type === AREA ? sets.areas : sets.points;
      bucket[side].push(idOf(n));
      if (v === 'gated') bucket.gated.push(idOf(n));
    }
    for (const b of [sets.areas, sets.points]) for (const key of ['attack', 'defend', 'gated']) b[key].sort(byIndex);
    return sets;
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const union = (lists) => [...new Set(lists.flat())].sort(byIndex);

  const out = [];
  for (let k = 0; k < stages; k++) {
    // (a later stage finds the selector where the escort left it: its last state)
    const states = steps ? steps.states.map((s) => new Map([...s, ...shut])) : [shut];
    const each = (k === 0 ? states : [states[states.length - 1]]).map((s) => evaluate(k, s));
    const first = k === 0 && opening.size ? evaluate(k, new Map([...(steps?.states[0] ?? []), ...open])) : null;
    const all = first ? [...each, first] : each;
    const stage = { areas: {}, points: {} };
    for (const kind of ['areas', 'points']) for (const key of ['attack', 'defend', 'gated']) stage[kind][key] = union(all.map((e) => e[kind][key]));
    if (each.length > 1 && each.some((e) => !same(e, each[0]))) {
      stage.steps = { by: 'escort', selector: steps.selector, tracker: steps.tracker, at: steps.at };
      for (const kind of ['areas', 'points']) stage.steps[kind] = { attack: each.map((e) => e[kind].attack.map(numberOf)), defend: each.map((e) => e[kind].defend.map(numberOf)) };
    }
    if (first && !same(first, each[0])) {
      stage.opening = { seconds: Math.max(...opening.values()) };
      for (const kind of ['areas', 'points']) {
        const only = (side) => first[kind][side].filter((id) => !each[0][kind][side].includes(id)).map(numberOf);
        stage.opening[kind] = { attack: only('attack'), defend: only('defend') };
      }
    }
    out.push(stage);
  }
  return out;
}

// The GA prefab's instance in a level's logic layer
export function findPrefab(layers, blueprint = 'PF_GameMode_Conquest_Staged') {
  for (const [name, file] of Object.entries(layers)) for (const o of file.objects) if (o?.$type === 'SpatialPrefabReferenceObjectData' && o.Blueprint?.$asset?.endsWith(blueprint)) return { guid: o.$guid, id: `${name}:${file.objects.indexOf(o)}` };
  return null;
}
