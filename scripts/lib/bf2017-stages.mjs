// Which spawn areas and spawn points a Galactic Assault stage enables, read
// from the wiring instead of from where they sit (bf2-re finding 27 §4c).
// The mode prefab (`PF_GameMode_Conquest_Staged`, placed in `<Mode>_Logic`)
// has six stage-enable output ports (Team1 stage 1/2/3, Team2 stage 1/2/3);
// the sub-world's `PropertyConnections` carry each port into the And/Or/Not
// gates of `<Mode>_Spawns` (and two constant Bools) and from there into every
// spawn area's and spawn point's `Enabled` (field hash 2662400). This walks
// those chains for each stage with that stage's two ports true and the other
// four false; a chain that also waits on something the ports do not decide
// (a trigger, an event-set Bool) is `gated`: enabled in the stage, but only
// once the trigger fires. Pure over the export's JSON.
//
//   buildGraph(sub, layers) → graph        sub: the sub-world file; layers: { name: file }
//   evalField(graph, guid, field, ports) → true | false | 'gated' | null (no driver)
//   stageSets(graph, { prefab, ports, stages, teams }) → [{ areas, points }] per stage, each { attack, defend, gated }

export const ENABLED = 2662400;
// The GA prefab's stage-enable ports, by team and stage (finding 27 §2).
export const GA_PORTS = { 1: [985615985, 985615986, 985615987], 2: [985719506, 985719505, 985719504] };
export const AREA = 'SpawnLocationFinderShapeData';
export const POINT = 'AlternateSpawnEntityData';

export function buildGraph(sub, layers) {
  const nodes = new Map();
  for (const [name, file] of Object.entries(layers)) file.objects.forEach((o, i) => o?.$guid && nodes.set(o.$guid, { layer: name, index: i, obj: o }));
  const top = sub.objects[0];
  const into = new Map(); // guid → [{ from: guid, field: SourceFieldId, to: TargetFieldId }]
  for (const c of top.PropertyConnections ?? []) {
    const a = c.Source?.$class;
    const b = c.Target?.$class;
    if (!a || !b) continue;
    if (!into.has(b)) into.set(b, []);
    into.get(b).push({ from: a, field: c.SourceFieldId, to: c.TargetFieldId });
  }
  // a Bool with an event into it is set at run time, not a constant
  const eventSet = new Set();
  for (const c of top.EventConnections ?? []) if (c.Target?.$class) eventSet.add(c.Target.$class);
  return { nodes, into, eventSet };
}

const and3 = (vals) => (vals.some((v) => v === false) ? false : vals.some((v) => v === 'gated' || v == null) ? 'gated' : true);
const or3 = (vals) => (vals.some((v) => v === true) ? true : vals.some((v) => v === 'gated' || v == null) ? 'gated' : false);

// the value a node puts out on `field` (the gates have one output; a port is the prefab's field)
function evalOut(graph, guid, field, ports, seen) {
  if (ports.has(guid)) return ports.get(guid).get(field) ?? false;
  const n = graph.nodes.get(guid);
  if (!n) return 'gated';
  const key = `${guid}:${field}`;
  if (seen.has(key)) return 'gated';
  seen.add(key);
  const t = n.obj.$type;
  const ins = (graph.into.get(guid) ?? []).map((e) => evalOut(graph, e.from, e.field, ports, seen));
  let out;
  if (t === 'AndEntityData') out = ins.length ? and3(ins) : 'gated';
  else if (t === 'OrEntityData') out = ins.length ? or3(ins) : 'gated';
  else if (t === 'NotEntityData') out = ins.length ? (ins[0] === 'gated' ? 'gated' : !ins[0]) : !n.obj.In;
  else if (t === 'BoolEntityData') out = graph.eventSet.has(guid) ? 'gated' : !!n.obj.DefaultValue;
  else out = 'gated';
  seen.delete(key);
  return out;
}

export function evalField(graph, guid, field, ports) {
  const drivers = (graph.into.get(guid) ?? []).filter((e) => e.to === field);
  if (!drivers.length) return null;
  return or3(drivers.map((e) => evalOut(graph, e.from, e.field, ports, new Set())));
}

const idOf = (n) => `${n.layer}:${n.index}`;
const teamOf = (o) => Number(String(o.Team ?? '').replace(/^Team/, '')) || 0;

// ports: { team: [port per stage] }; teams: { attack: 2, defend: 1 }
export function stageSets(graph, { prefab, ports = GA_PORTS, stages = 3, teams = { attack: 2, defend: 1 } }) {
  const sideOf = { [teams.attack]: 'attack', [teams.defend]: 'defend' };
  const portMap = (on) => new Map([[prefab, new Map(Object.entries(ports).flatMap(([team, list]) => list.map((p, k) => [p, on(Number(team), k)])))]]);
  const out = [];
  for (let k = 0; k < stages; k++) {
    const sets = { areas: { attack: [], defend: [], gated: [] }, points: { attack: [], defend: [], gated: [] } };
    const both = portMap((team, s) => s === k);
    const only = (t) => portMap((team, s) => s === k && team === t);
    for (const n of graph.nodes.values()) {
      const t = n.obj.$type;
      if (t !== AREA && t !== POINT) continue;
      const v = evalField(graph, n.obj.$guid, ENABLED, both);
      if (v === null || v === false) continue;
      const own = teamOf(n.obj);
      // a neutral area belongs to the side whose port alone opens it
      const side = sideOf[own] ?? (evalField(graph, n.obj.$guid, ENABLED, only(teams.attack)) ? 'attack' : evalField(graph, n.obj.$guid, ENABLED, only(teams.defend)) ? 'defend' : null);
      if (!side) continue;
      const bucket = t === AREA ? sets.areas : sets.points;
      bucket[side].push(idOf(n));
      if (v === 'gated') bucket.gated.push(idOf(n));
    }
    for (const b of [sets.areas, sets.points]) for (const key of ['attack', 'defend', 'gated']) b[key].sort(byIndex);
    out.push(sets);
  }
  return out;
}

const byIndex = (a, b) => a.localeCompare(b, 'en', { numeric: true });

// The GA prefab's instance in a level's logic layer
export function findPrefab(layers, blueprint = 'PF_GameMode_Conquest_Staged') {
  for (const [name, file] of Object.entries(layers)) for (const o of file.objects) if (o?.$type === 'SpatialPrefabReferenceObjectData' && o.Blueprint?.$asset?.endsWith(blueprint)) return { guid: o.$guid, id: `${name}:${file.objects.indexOf(o)}` };
  return null;
}
