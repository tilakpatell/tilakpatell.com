// A mode's spawn logic, run as the game runs it (bf2-re findings/55): the
// graph of logic records the map rulebook keeps (`spawnLogic`, written by
// scripts/lib/bf2017-rulebook-spawnlogic.mjs from the sub-world's own
// connection lists) that switches each spawn point and spawn area on and off.
// Its leaves are the mode's: the stage (the mode prefab's stage ports and its
// stage-changed event), the other prefabs' outputs the mode sets (a capture
// point's owner, a charge spent, the escort's lead walker), geometry triggers
// it fires and the graph's own timers. Pure: nothing here knows a soldier.
//
//   createLogic(spec, { stage }) → vm
//   setStage(vm, n)              the stage's ports, then its stage-changed event
//   setInput(vm, ref, value)     a prefab's output ('<id>.<field>')
//   fireEvent(vm, ref)           an event from outside ('<id>.<event>')
//   tick(vm, dt)                 the graph's delays
//   enabled(vm, id)              true | false (a spawn record the graph switches), null when it does not
//   portsOf(vm, role)            [{ id, ref, node }]: the prefab ports of a role ('lead', 'ownedByTeam2', 'destroyed', 'opened', 'stageChanged')
//   (a mode part's graph, map/doors.js's, adds `synced` bools, which pass their In on until an
//   event sets them, and `waypoint` and `route` nodes, which only the page fires)

// How many rounds a settle runs before it stops: the graph has no loop the
// game would run forever, so this is only a guard.
const SETTLE_PASSES = 32;

const split = (ref) => {
  const i = ref.lastIndexOf('.');
  return [ref.slice(0, i), ref.slice(i + 1)];
};

export function createLogic(spec, { stage = 1 } = {}) {
  const vm = { spec, stage, t: 0, bools: {}, ints: {}, open: {}, ext: {}, once: new Set(), timers: [], last: {}, fired: [] };
  // the watched values as they start: a listener reports a change, not its first value
  for (const [id, n] of Object.entries(spec.nodes)) if (n.type === 'listener' || n.onChange) vm.last[id] = watched(vm, id);
  return vm;
}

// a property's value: '<id>.<field>'
export function value(vm, ref, depth = 0) {
  if (!ref || depth > 64) return false;
  if (ref in vm.ext) return vm.ext[ref];
  const [id, field] = split(ref);
  const n = vm.spec.nodes[id];
  const ins = vm.spec.inputs[id] ?? {};
  const get = (name, dflt) => (ins[name] ? value(vm, ins[name], depth + 1) : dflt);
  switch (n?.type) {
    case 'prefab': {
      const role = n.roles?.[field];
      if (role?.role === 'stage') return vm.stage === role.stage;
      return false;
    }
    case 'bool':
      return vm.bools[id] ?? n.value;
    // (a synced bool passes its In on until an event sets it: a mode part's graph, spawnLogic's `targets`)
    case 'synced':
      return vm.bools[id] ?? get('In', n.value);
    case 'and':
    case 'or': {
      const vals = [];
      for (let k = 1; k <= n.n; k++) vals.push(Boolean(get(`In${k}`, n.type === 'and')));
      return n.type === 'and' ? vals.every(Boolean) : vals.some(Boolean);
    }
    case 'not':
      return !get('In', n.value);
    case 'int':
      return vm.ints[id] ?? n.value;
    case 'listener':
      return get('In', 0);
    default:
      return false;
  }
}

// what a listener or an on-change compare watches
function watched(vm, id) {
  const n = vm.spec.nodes[id];
  const ins = vm.spec.inputs[id] ?? {};
  if (n.type === 'listener') return value(vm, ins.In);
  if (n.type === 'compareInt') return `${ins.A ? value(vm, ins.A) : n.a}|${ins.B ? value(vm, ins.B) : n.b}`;
  if (n.type === 'compareBool') return Boolean(ins.Bool ? value(vm, ins.Bool) : n.value);
  return null;
}

function emit(vm, ref, depth = 0) {
  if (depth > 64) return;
  vm.fired.push(ref);
  for (const to of vm.spec.events[ref] ?? []) deliver(vm, to, depth + 1);
}

function deliver(vm, to, depth) {
  const [id, ev] = split(to);
  const n = vm.spec.nodes[id];
  const ins = vm.spec.inputs[id] ?? {};
  switch (n?.type) {
    case 'bool':
    case 'synced':
      if (ev === 'SetTrue') vm.bools[id] = true;
      else if (ev === 'SetFalse') vm.bools[id] = false;
      else if (ev === 'Toggle') vm.bools[id] = !(vm.bools[id] ?? n.value);
      return;
    case 'splitter':
      if (n.once && vm.once.has(id)) return;
      vm.once.add(id);
      emit(vm, `${id}.Out`, depth);
      return;
    case 'delay':
      if (n.once && vm.once.has(id)) return;
      if (n.dedupe && vm.timers.some((x) => x.id === id)) return;
      vm.once.add(id);
      vm.timers.push({ id, at: vm.t + n.seconds });
      return;
    case 'select': {
      const sel = ins.Selected ? value(vm, ins.Selected) : n.value;
      emit(vm, `${id}.${Number(sel) | 0}`, depth);
      return;
    }
    case 'gate':
      if (ev === 'Open') vm.open[id] = true;
      else if (ev === 'Close') vm.open[id] = false;
      else if (vm.open[id] ?? n.open) emit(vm, `${id}.Out`, depth);
      return;
    case 'int': {
      const v = vm.ints[id] ?? n.value;
      if (ev === 'Increment') vm.ints[id] = v + n.step;
      else if (ev === 'Decrement') vm.ints[id] = v - n.step;
      else if (ev === 'Reset') vm.ints[id] = n.value;
      return;
    }
    case 'compareInt':
      compareInt(vm, id, depth);
      return;
    case 'compareBool':
      emit(vm, `${id}.${(ins.Bool ? value(vm, ins.Bool) : n.value) ? 'OnTrue' : 'OnFalse'}`, depth);
      return;
    case 'trigger':
      return;
    default:
  }
}

function compareInt(vm, id, depth) {
  const n = vm.spec.nodes[id];
  const ins = vm.spec.inputs[id] ?? {};
  const a = Number(ins.A ? value(vm, ins.A) : n.a);
  const b = Number(ins.B ? value(vm, ins.B) : n.b);
  const outs = [];
  if (a === b) outs.push('A=B', 'A<=B', 'A>=B');
  else outs.push('A!=B', a < b ? 'A<B' : 'A>B', a < b ? 'A<=B' : 'A>=B');
  for (const o of outs) emit(vm, `${id}.${o}`, depth);
}

// the listeners and on-change compares whose value moved report it, until nothing moves
function settle(vm) {
  for (let pass = 0; pass < SETTLE_PASSES; pass++) {
    let moved = false;
    for (const id of Object.keys(vm.last)) {
      const v = watched(vm, id);
      if (v === vm.last[id]) continue;
      vm.last[id] = v;
      moved = true;
      const n = vm.spec.nodes[id];
      if (n.type === 'listener') emit(vm, `${id}.Changed`);
      else deliver(vm, `${id}.In`, 0);
    }
    if (!moved) return;
  }
}

export function setStage(vm, n) {
  vm.stage = n;
  for (const p of portsOf(vm, 'stageChanged')) emit(vm, p.ref);
  settle(vm);
}

export function setInput(vm, ref, v) {
  if (vm.ext[ref] === v) return;
  vm.ext[ref] = v;
  settle(vm);
}

export function fireEvent(vm, ref) {
  const [id] = split(ref);
  const n = vm.spec.nodes[id];
  if (n?.type === 'trigger') {
    if (n.once && vm.once.has(id)) return;
    vm.once.add(id);
  }
  emit(vm, ref);
  settle(vm);
}

export function tick(vm, dt) {
  const end = vm.t + dt;
  for (;;) {
    const due = vm.timers.filter((x) => x.at <= end + 1e-9).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    vm.timers.splice(vm.timers.indexOf(due), 1);
    vm.t = Math.max(vm.t, due.at);
    emit(vm, `${due.id}.Out`);
    settle(vm);
  }
  vm.t = end;
}

export function enabled(vm, id) {
  const refs = vm.spec.enables[id];
  if (!refs) return null;
  return (Array.isArray(refs) ? refs : [refs]).some((r) => Boolean(value(vm, r)));
}

export function portsOf(vm, role) {
  const out = [];
  for (const [id, n] of Object.entries(vm.spec.nodes)) {
    if (n.type !== 'prefab') continue;
    for (const [port, r] of Object.entries(n.roles ?? {})) if (r?.role === role) out.push({ id, ref: `${id}.${port}`, node: n });
  }
  return out;
}

// The PF_EscortTracker the graph reads (its SelectInt over two counters): each
// walker counts the waypoint triggers it has passed; the lead is the count of
// the walker last found at or past the other's, and of the other when one dies.
export function escortLead(tracker, walkers, state = { sel: 0, counts: [0, 0] }) {
  const counts = tracker.walkers.map((w, k) => {
    const at = walkers[k]?.passed ?? -1;
    return w.at.filter((i) => i <= at).length;
  });
  let sel = state.sel;
  for (const k of [0, 1]) if (counts[k] > state.counts[k] && counts[k] >= counts[sel]) sel = k;
  if (walkers[sel] && walkers[sel].alive === false && walkers[1 - sel]?.alive !== false) sel = 1 - sel;
  return { sel, counts, lead: counts[sel] };
}
