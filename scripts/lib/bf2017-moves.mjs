// The heroes' and reinforcements' moves as the soldier state machine plays
// them (Gameplay/SoldierStateMachine/DefaultSoldierStateMachine; bf2-re
// findings 41 and 61): a character-state ability asks the machine for a move
// (`SetChannelValuesOnTryActivate AttackType = n`), turns Active once the move
// holds `CurrentAbility` at the ability's `RequiredForActive` value, stays
// Active while it does (`CharacterStateDrivesActiveTime`), and its prefab lays
// its affectors while the move keys `TriggerAffectorEnum` (the prefab's
// IntToEvent picks the affector set by the value: Luke's push is 1 at tick
// 10). A move is a clip node (`CharacterStateClipControllerData`, its own
// keyed channels and clips) or a flow of nodes (`…StateFlowControllerData`:
// Enter, Loop, Hit, Exit, each keyed, joined by transitions on channels).
// Ticks are the machine's 60 a second (finding 41: a 30 fps clip of 55
// frames is 109 ticks). Pure: the machine's objects in, rows out.
//
//   indexMachine(objects, clipNames?) → machine   (clipNames: per clip controller in object order, the ANT names of
//                                                  its clips: web/ant/ebx_state_machine.json, bf2-re tools/ant-tuning.py)
//   nodeOf(machine, i) → { name, length, current: [[t, n, v]], triggers: [[t, n, v]], unstaggerable: [[t, n]],
//                          branches: { ability, evade, movement, intoAir, end }, clips: [{ name, length, start, startIn }],
//                          next: [{ to, tick, length, channel, invert, always }] }
//   movesFor(machine, value, names) → candidate moves keying CurrentAbility = value whose node or flow names one of `names`
//   pickMove(candidates) → the move the ground plays (no air variant, the forward of a directional set)
//   pathOf(machine, move) → [node…] the move's main path (a flow's entry node, then each node's held-on exit)
//   summary(machine, move) → { node, flow, length, active, triggers, unstaggerable, branches, root, clip }   (seconds, metres)

export const TICKS = 60;
// (the root's travel kept every 6 ticks: a tenth of a second)
export const ROOT_EVERY = 6;

const refOf = (v) => (v && typeof v === 'object' && '$ref' in v ? v.$ref : null);

export function indexMachine(objects, clipNames = null) {
  const flowOf = new Map(); // node index → the flow's name
  const clipOrder = [];
  objects.forEach((o, i) => {
    if (o?.$type === 'CharacterStateClipControllerData') clipOrder.push(i);
  });
  const clips = new Map(); // clip controller index → [ANT clip names]
  if (clipNames) clipOrder.forEach((i, k) => clips.set(i, clipNames[k] ?? []));
  const m = { objects, flowOf, clips };
  // every flow's nodes, from its entry through the transitions
  objects.forEach((o) => {
    if (o?.$type !== 'CharacterStateStateFlowControllerData') return;
    const start = (o.Subjects ?? []).map(refOf).find((j) => j != null);
    const seen = new Set();
    const queue = start != null ? [start] : [];
    while (queue.length) {
      const j = queue.shift();
      if (seen.has(j)) continue;
      seen.add(j);
      if (!flowOf.has(j)) flowOf.set(j, { flow: o.Name ?? '', entry: start });
      for (const t of objects[j]?.Transitions ?? []) {
        const to = refOf(t.Target);
        if (to != null && objects[to]?.$type === 'CharacterStateStateFlowNodeControllerData') queue.push(to);
      }
    }
  });
  return m;
}

const nameOf = (m, v) => m.objects[refOf(v)]?.Name ?? null;

// a node's keyed channels: its own controller (a clip node) or its list (a flow node)
function keyed(m, o) {
  const ctrls = [refOf(o.ChannelController), ...(o.ChannelControllers ?? []).map(refOf)].filter((j) => j != null).map((j) => m.objects[j]);
  const out = { ints: [], bools: [] };
  for (const c of ctrls) {
    for (const [kind, key] of [
      ['ints', 'IntChannelController'],
      ['bools', 'BoolChannelController'],
    ]) {
      const k = m.objects[refOf(c?.[key])];
      if (!k) continue;
      (k.Tracks ?? []).forEach((tr, n) => out[kind].push({ channel: nameOf(m, k.Channels?.[n]), keys: tr.Keyframes ?? [] }));
    }
  }
  return out;
}

const BRANCH = { 'CharacterState.Ability.Branch': 'ability', 'CharacterState.Evade.Branch': 'evade', 'CharacterState.Movement.Branch': 'movement', 'CharacterState.IntoAir.Branch': 'intoAir', 'End.3P.Branch': 'end' };

export function nodeOf(m, i) {
  const o = m.objects[i];
  const { ints, bools } = keyed(m, o);
  const intKeys = (ch) => ints.filter((t) => t.channel === ch).flatMap((t) => t.keys.map((k) => [k.Time, k.Length, k.Value]));
  const boolOn = (ch) => bools.filter((t) => t.channel === ch).flatMap((t) => t.keys.filter((k) => k.Value === true).map((k) => [k.Time, k.Length]));
  const branches = {};
  for (const [ch, key] of Object.entries(BRANCH)) {
    const on = boolOn(ch);
    if (on.length) branches[key] = Math.min(...on.map((k) => k[0]));
  }
  // (a flow node's length is its clip subject's)
  const subjects = (o.Subjects ?? []).map(refOf).filter((j) => m.objects[j]?.$type === 'CharacterStateClipControllerData');
  const clipNode = o.$type === 'CharacterStateClipControllerData' ? i : (subjects[0] ?? null);
  const cn = clipNode != null ? m.objects[clipNode] : null;
  const names = clipNode != null ? (m.clips.get(clipNode) ?? []) : [];
  // (a node that is its own clip names it as its controller: the ANT summary's controller name, after its clips')
  const clips = (cn?.ClipInfos ?? []).map((c, k) => ({ name: names[k] ?? null, length: c.Length, start: c.StartTime, startIn: c.StartInTime }));
  if (!clips.length && cn && names.self) clips.push({ name: names.self, length: cn.Length, start: 0, startIn: 0 });
  const next = (o.Transitions ?? []).map((t) => ({ to: nameOf(m, t.Target), index: refOf(t.Target), tick: t.StartTick, length: t.Length, channel: nameOf(m, t.BoolChannel1) ?? nameOf(m, t.IntChannel) ?? nameOf(m, t.FloatChannel), invert: Boolean(t.Invert), always: Boolean(t.AlwaysActive) }));
  // (the root's travel the move carries its body by, a key a tick: its transform track's translation, in the body's frame)
  const track = m.objects[refOf(cn?.TransformChannelController)]?.Tracks?.[0]?.Keyframes ?? [];
  const root = track.map((k) => [k.Time, k.Value?.trans?.x ?? 0, k.Value?.trans?.y ?? 0, k.Value?.trans?.z ?? 0]);
  return { index: i, name: o.Name ?? '', type: o.$type, length: cn?.Length ?? null, current: intKeys('CurrentAbility'), triggers: intKeys('TriggerAffectorEnum'), unstaggerable: boolOn('Unstaggerable'), branches, clips, next, root };
}

const lower = (s) => String(s ?? '').toLowerCase();

export function movesFor(m, value, names) {
  const want = names.map(lower);
  const out = [];
  m.objects.forEach((o, i) => {
    if (o?.$type !== 'CharacterStateClipControllerData' && o?.$type !== 'CharacterStateStateFlowNodeControllerData') return;
    if (!o.ChannelController && !o.ChannelControllers) return;
    const n = nodeOf(m, i);
    if (!n.current.some((k) => k[2] === value)) return;
    const flow = m.flowOf.get(i)?.flow ?? '';
    const label = lower(`${n.name} ${flow}`);
    if (!want.some((w) => label.includes(w))) return;
    out.push({ ...n, flow, entry: m.flowOf.get(i)?.entry ?? null });
  });
  return out;
}

// (the ground's: no air variant; a directional set's forward; a flow's entry node first; then the longest hold)
export function pickMove(cands) {
  const score = (c) => {
    const s = lower(`${c.name} ${c.flow}`);
    return (/depricated|deprecated|landing/.test(s) ? 1000 : 0) + (/air|jump/.test(s) ? 100 : 0) + (c.triggers.length ? 0 : 20) + (/(bwd|back|left|right)/.test(s) && !/fwd/.test(s) ? 10 : 0) + (c.entry != null && c.entry !== c.index ? 5 : 0) + (/abort|exit/.test(s) ? 3 : 0);
  };
  return [...cands].sort((a, b) => score(a) - score(b) || (b.current[0]?.[1] ?? 0) - (a.current[0]?.[1] ?? 0))[0] ?? null;
}

// a flow's main path: from the move's node, each next node the move holds on to (one that still keys the same
// CurrentAbility), by the transition that opens first; a clip node is its own path
export function pathOf(m, move) {
  const value = move.current[0]?.[2];
  const path = [move];
  const seen = new Set([move.index]);
  let at = move;
  while (at.next?.length) {
    const nexts = at.next.map((t) => (t.index != null ? nodeOf(m, t.index) : null)).filter((n) => n && !seen.has(n.index) && n.current.some((k) => k[2] === value));
    if (!nexts.length) break;
    // (the loop before the hit or the exit: the one whose own hold is longest)
    nexts.sort((a, b) => (b.current[0]?.[1] ?? 0) - (a.current[0]?.[1] ?? 0));
    at = nexts[0];
    seen.add(at.index);
    path.push(at);
    if (path.length > 4) break;
  }
  return path;
}

const sec = (t) => Math.round((t / TICKS) * 1000) / 1000;
// (a key held "forever" is the node's own hold: 9,999,999 ticks; with no clip to end it, the move has no length of its own)
export const FOREVER = 1e6;
const span = (n, k) => Math.min(k[1], n.length ?? k[1]);

export function summary(m, move) {
  const path = pathOf(m, move);
  let t0 = 0;
  const triggers = [];
  const unstaggerable = [];
  let active = 0;
  const root = [];
  path.forEach((n, j) => {
    const cur = n.current[0];
    const hold = cur ? Math.min(span(n, cur), cur[1]) : 0;
    for (const k of n.triggers) triggers.push({ at: sec(t0 + k[0]), length: sec(span(n, k)), value: k[2], node: n.name });
    for (const k of n.unstaggerable) unstaggerable.push([sec(t0 + k[0]), sec(span(n, k))]);
    active = t0 + (cur ? cur[0] + hold : 0);
    // (the travel, every ROOT_EVERY ticks, on from where the last node left it)
    const from = root.length ? root[root.length - 1] : [0, 0, 0, 0];
    const base = n.root[0] ?? [0, 0, 0, 0];
    // (the last node's travel to its own end: the body is still carried once the ability is back to recharging)
    const upTo = j === path.length - 1 ? Math.min(n.length ?? hold, FOREVER) : hold;
    for (const k of n.root) if (k[0] <= upTo && (k[0] % ROOT_EVERY === 0 || k[0] === Math.min(upTo, n.root[n.root.length - 1][0]))) root.push([t0 + k[0], from[1] + k[1] - base[1], from[2] + k[2] - base[2], from[3] + k[3] - base[3]]);
    t0 += hold;
  });
  const main = path[0];
  const clip = main.clips.find((c) => c.name) ?? null;
  return {
    node: main.name,
    flow: move.flow || null,
    path: path.map((n) => n.name),
    length: main.length != null ? sec(main.length) : null,
    active: active >= FOREVER ? null : sec(active),
    triggers,
    unstaggerable,
    branches: Object.fromEntries(Object.entries(main.branches).map(([k, v]) => [k, sec(v)])),
    // ([seconds, x left, y up, z ahead] metres, cumulative)
    root: root.map((k) => [sec(k[0]), ...k.slice(1).map((v) => Math.round(v * 1000) / 1000)]),
    clip: clip ? { name: clip.name, offset: sec(-Math.min(0, clip.start)), length: sec(clip.length) } : null,
  };
}
