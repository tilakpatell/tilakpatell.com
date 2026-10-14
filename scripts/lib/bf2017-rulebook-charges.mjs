// A Galactic Assault level's fuel charges (maps/<level>.json `charges`):
// Hoth's three PF_Interact_PlanetaryBattle_Bomb in the stage-3 fuel rooms,
// read as the game wires them (bf2-re findings/61), beside the gates
// (bf2017-rulebook-gates.mjs) and the spawn logic out of the same sub-world.
//
// A charge prefab holds PF_Interact_PlanetaryBattle_Core, which holds
// PF_Interact_Keypad, which holds PF_Interact_Button (its WorldInteraction):
//
//   the place     the level's LocatorEntityData wired into the charge's 778378373
//                 is the charge model's; the keypad sits in the core at its own
//                 BlueprintTransform, the button in the keypad at its own.
//   the reach     the keypad sets the button's InteractionMaxDistance (1) and
//                 InteractionMaxAngle (360); the button scales its interaction's
//                 transform by its TransformMultiplier's In1 (3×), so 3 m, any side.
//   who           the keypad's PropertySelect gives the button the attackers' team
//                 while the charge is off and the defenders' once it is armed (its
//                 EventGates on the armed and defused events); one at a time (the
//                 button's AllowMoreInteractors is a Bool set false on
//                 OnInteractStart); a hold let go starts again (the button's
//                 EventGate resets its StopWatch on OnInteractStop).
//   the holds     the keypad's ConditionalFloat: ValueIfFalse while the charge is
//                 off (the arm), ValueIfTrue once armed (the defuse; its EventSwitch
//                 on the button's Success sets the Bool), from the core's
//                 SelectFloats' "Bomb: " inputs, each a BattlepointUnitCost
//                 (GLOBAL_BOMB_INTERACT_TIME_OFF, _ON) of Online/BattlepointCostData.
//   the fuse      the core's StopWatch whose OnTrigger sets IsDestroyed: started on
//                 the keypad's armed event, its TriggerOnTime the SelectFloat input
//                 a charge selects (GLOBAL_BOMB_DETONATE_TIME), its Multiplier a
//                 ConditionalFloat that is 1 for a charge; stopped while a defender
//                 holds the keypad (an EventGate open between armed and defused, In
//                 on OnInteractStart) and started again on OnInteractStop; reset on
//                 a defuse. A second StopWatch runs the fuse less the core's 1.33,
//                 the explosion's sound.
//   the delays    the keypad comes on a Delay chain after the charge is enabled (5 s);
//                 the keypad's Delay between a finished hold and the armed or defused
//                 event (0.1 s).
//   the round     the charges' detonated event (628087861) into an EventAndGate: its
//                 EventCount is how many must go (Hoth: all three).
//
//   chargeRules(root, bomb) → { local, interact, arm, defuse, fuse, live, settle, _source } | null
//   chargesOf(root, dir, sub) → [{ id, name, at, yaw, label, charge, keypad, enabledBy,
//     interact, arm, defuse, fuse, live, settle, win, _source }] | []

import { fieldHash as H } from './bf2017-abilities.mjs';
import { follow, loadAsset, objectsOf, rootOf, shortName } from './bf2017-ebx.mjs';
import { graphOf } from './bf2017-rulebook-spawnlogic.mjs';

const s32 = (h) => h | 0;
const r3 = (v) => Math.round(v * 10000) / 10000;
// the charge prefab's ports
export const CHARGE_LOCATOR = 778378373;
export const DETONATED = 628087861;
// the core's: a charge's "is a bomb" (true for a charge, false for the hacks)
const IS_BOMB = 936959072;
// the keypad's: armed, defused, its enable, the holds' ON and OFF times
export const ARMED = -1163975271;
export const DEFUSED = 243521495;
const KEYPAD_ENABLE = 112496486;
const HOLD_ON = 557666635;
const HOLD_OFF = 1223129541;
// the button's: its completion (the keypad's Delay on it), whether a hold survives a let-go
const BUTTON_DONE = 918477720;
const BUTTON_KEEP = 679638177;
const COSTS = 'Online/BattlepointCostData';
const ON_START = H('OnInteractStart');
// the keypad's own server events for the button's OnInteractStart and OnInteractStop
const KEYPAD_START = 1081396819;
const KEYPAD_STOP = 536040107;

const objOf = (A, ref) => A?.objects?.[ref?.$ref ?? ref] ?? null;
const top = (A) => A.objects[0];
const ifaceRef = (A) => A.objects.findIndex((o) => o?.$type === 'InterfaceDescriptorData');
const ifaceField = (A, id) => (A.objects[ifaceRef(A)]?.Fields ?? []).find((f) => s32(f.Id) === s32(id)) ?? null;
const props = (A) => top(A).PropertyConnections ?? [];
const events = (A) => top(A).EventConnections ?? [];
const into = (A, ref, field) => props(A).filter((c) => c.Target?.$ref === ref && (field === undefined || s32(c.TargetFieldId) === s32(field)));
const evInto = (A, ref, ev) => events(A).filter((c) => c.Target?.$ref === ref && (ev === undefined || s32(c.TargetEvent?.Id) === s32(ev)));
const evFrom = (A, ref, ev) => events(A).filter((c) => c.Source?.$ref === ref && (ev === undefined || s32(c.SourceEvent?.Id) === s32(ev)));
const indexOfRef = (A, re) => (A?.objects ?? []).findIndex((o) => re.test(o?.Blueprint?.$asset ?? ''));
const isIface = (A, r) => A.objects[r?.$ref]?.$type === 'InterfaceDescriptorData';
const typed = (A, type) => A.objects.map((o, i) => (o?.$type === type ? i : -1)).filter((i) => i >= 0);

// an interface value as a number or a bool ("Float32 3", "Int32 2", "Boolean True")
function valueOf(v) {
  if (typeof v !== 'string') return v ?? null;
  const n = /^(?:Float32|Int32|UInt32) (-?[\d.]+(?:e[+-]?\d+)?)$/.exec(v);
  if (n) return Number(n[1]);
  if (/^Boolean /.test(v)) return v === 'Boolean True';
  return v === '' ? null : v;
}

// the interface value wired into an object's field: [value, the interface field id] or null
function ifaceInto(A, ref, field) {
  const c = into(A, ref, field).find((x) => isIface(A, x.Source));
  return c ? [valueOf(ifaceField(A, c.SourceFieldId)?.Value), c.SourceFieldId] : null;
}

// a LinearTransform: apply, compose, yaw
const tf = (t) => ({ r: t.right, u: t.up, f: t.forward, t: t.trans });
const apply = (T, p) => ({ x: T.t.x + p.x * T.r.x + p.y * T.u.x + p.z * T.f.x, y: T.t.y + p.x * T.r.y + p.y * T.u.y + p.z * T.f.y, z: T.t.z + p.x * T.r.z + p.y * T.u.z + p.z * T.f.z });
const dir = (T, v) => ({ x: v.x * T.r.x + v.y * T.u.x + v.z * T.f.x, y: v.x * T.r.y + v.y * T.u.y + v.z * T.f.y, z: v.x * T.r.z + v.y * T.u.z + v.z * T.f.z });
const compose = (A, B) => ({ r: dir(A, B.r), u: dir(A, B.u), f: dir(A, B.f), t: apply(A, B.t) });
const yawOf = (f) => Math.atan2(f.x, f.z);
const len = (v) => (v ? Math.hypot(v.x, v.y, v.z) : 1);

// the cost table's value of a setting (Online/BattlepointCostData: the GameMode's table for the Map, else GLOBAL)
function costOf(root, mode, map, name) {
  const asset = loadAsset(root, COSTS);
  const r = asset ? rootOf(asset) : null;
  const configs = r?.UnitCostConfig ?? [];
  for (const m of [map, 'GLOBAL']) {
    const c = configs.findIndex((cfg) => String(cfg.GameMode) === mode && String(cfg.Map ?? '') === m);
    if (c < 0) continue;
    const i = (configs[c].BattlepointUnitCostEntries ?? []).findIndex((e) => e.Character === name);
    if (i >= 0) return { value: configs[c].BattlepointUnitCostEntries[i].Cost, _source: `${COSTS}#${r.$type}.UnitCostConfig.${c}.BattlepointUnitCostEntries.${i}.Cost (${name})` };
  }
  return null;
}

// what a SelectFloat input carries: a BattlepointUnitCost's Cost through a PropertyCast (its Character looked up
// in the cost table), else the interface's value wired to it
function inputOf(root, C, sel, field) {
  for (const c of into(C, sel, field)) {
    if (objOf(C, c.Source)?.$type !== 'PropertyCastEntityData') continue;
    const k = into(C, c.Source.$ref)
      .map((x) => objOf(C, x.Source))
      .find((o) => o?.$type === 'BattlepointUnitCostEntityData');
    if (!k) continue;
    const cost = costOf(root, k.GameMode, k.Map, k.Character);
    if (cost) return { ...cost, setting: k.Character };
  }
  const v = ifaceInto(C, sel, field);
  return v ? { value: v[0], _source: `${C.name}#InterfaceDescriptorData field ${s32(v[1])}` } : null;
}

// the core's own interface value of a field, as the charge prefab sets it (or leaves it at the core's default)
function coreValue(B, coreRef, C, field) {
  const set = into(B, coreRef, field).find((x) => isIface(B, x.Source));
  if (set) return valueOf(ifaceField(B, set.SourceFieldId)?.Value) ?? false;
  return valueOf(ifaceField(C, field)?.Value) ?? false;
}

// the input a SelectFloat ends on: of the CompareBools that send it a select, the one whose Bool (a core
// interface field, as the charge sets it) takes that branch. A select names its input by its field's hash
// ("Bomb: "), or as Select<n> for In<n>.
function selectedInput(B, coreRef, C, sel) {
  const S = C.objects[sel];
  const fields = (S.Inputs ?? []).map((label, n) => (label ? H(label) : H(`In${n}`)));
  for (const e of evInto(C, sel)) {
    if (objOf(C, e.Source)?.$type !== 'CompareBoolEntityData') continue;
    const bool = ifaceInto(C, e.Source.$ref, H('Bool'));
    if (!bool) continue;
    const v = coreValue(B, coreRef, C, bool[1]);
    if (s32(e.SourceEvent.Id) !== (v ? H('OnTrue') : H('OnFalse'))) continue;
    const ev = s32(e.TargetEvent.Id);
    if (fields.includes(ev)) return ev;
    const n = fields.findIndex((_, i) => H(`Select${i}`) === ev);
    if (n >= 0) return fields[n];
  }
  return fields[S.InputSelect ?? 0];
}

// the delay a DelayEntityData waits: its own, or the interface values a FloatHub feeds it
function delayOf(C, d) {
  const fed = into(C, d, H('Delay'))[0];
  if (!fed) return C.objects[d].Delay ?? 0;
  const vals = into(C, fed.Source.$ref)
    .filter((x) => isIface(C, x.Source))
    .map((x) => valueOf(ifaceField(C, x.SourceFieldId)?.Value) ?? 0);
  return vals.length ? Math.max(...vals) : 0;
}

// the fuse: the core's StopWatch whose OnTrigger sets the SyncedBool on IsDestroyed
function fuseOf(root, B, ci, C, ki) {
  const destroyedBool = into(C, ifaceRef(C), H('IsDestroyed'))[0]?.Source.$ref;
  const watches = typed(C, 'StopWatchEntityData');
  const fuseRef = watches.find((w) => evFrom(C, w, H('OnTrigger')).some((e) => e.Target.$ref === destroyedBool && s32(e.TargetEvent.Id) === H('SetTrue')));
  if (fuseRef === undefined) return null;
  const sel = into(C, fuseRef, H('TriggerOnTime'))[0]?.Source.$ref;
  const seconds = sel !== undefined && C.objects[sel]?.$type === 'SelectFloatEntityData' ? inputOf(root, C, sel, selectedInput(B, ci, C, sel)) : { value: C.objects[fuseRef].TriggerOnTime };
  // (its Multiplier: a ConditionalFloat on And(the keypad's BB-unit flag, Not(the core's is-a-bomb)): its false branch for a charge)
  const condF = into(C, fuseRef, H('Multiplier'))[0]?.Source.$ref;
  const cf = condF !== undefined ? C.objects[condF] : null;
  const multiplier = cf ? (coreValue(B, ci, C, IS_BOMB) ? cf.ValueIfFalse : cf.ValueIfTrue) : C.objects[fuseRef].Multiplier;
  // (stopped while a defender holds: an EventGate opened by armed whose Out stops the fuse and whose In is a
  // CompareBool on the keypad's OnInteractStart; started again by the gate whose In is OnInteractStop)
  const gates = typed(C, 'EventGateEntityData');
  const opened = (g) => evInto(C, g, H('Open')).some((e) => e.Source.$ref === ki && s32(e.SourceEvent.Id) === ARMED);
  const outTo = (g, ev) => evFrom(C, g, H('Out')).some((e) => e.Target.$ref === fuseRef && s32(e.TargetEvent.Id) === H(ev));
  const fromKeypad = (ref, ev) => evInto(C, ref).some((x) => x.Source.$ref === ki && s32(x.SourceEvent.Id) === s32(ev));
  const pausedWhileHeld = gates.some((g) => opened(g) && outTo(g, 'Stop') && evInto(C, g, H('In')).some((e) => fromKeypad(e.Source.$ref, KEYPAD_START)));
  const resumes = gates.some((g) => opened(g) && outTo(g, 'Start') && fromKeypad(g, KEYPAD_STOP));
  // (a defuse resets it: the keypad's defused event into a CompareBool whose branch for a charge resets the fuse)
  const resetOnDefuse = evInto(C, fuseRef, H('Reset')).some((e) => {
    if (objOf(C, e.Source)?.$type !== 'CompareBoolEntityData') return false;
    const b = ifaceInto(C, e.Source.$ref, H('Bool'));
    const v = b ? coreValue(B, ci, C, b[1]) : false;
    return s32(e.SourceEvent.Id) === (v ? H('OnTrue') : H('OnFalse')) && fromKeypad(e.Source.$ref, DEFUSED);
  });
  // (the second StopWatch: started on armed, its TriggerOnTime a MathOp of the fuse less an interface value)
  const warnRef = watches.find((w) => w !== fuseRef && evInto(C, w, H('Start')).some((e) => e.Source.$ref === ki && s32(e.SourceEvent.Id) === ARMED));
  const sub = warnRef !== undefined ? into(C, warnRef, H('TriggerOnTime'))[0]?.Source.$ref : undefined;
  const warn = sub !== undefined && C.objects[sub]?.$type === 'MathOpEntityData' ? (ifaceInto(C, sub, H('In1'))?.[0] ?? null) : null;
  return {
    seconds: seconds?.value ?? null,
    ...(seconds?.setting ? { setting: seconds.setting } : {}),
    multiplier,
    pausedWhileHeld,
    resumes,
    resetOnDefuse,
    warn,
    _source: `${C.name}#StopWatchEntityData.${fuseRef} (its OnTrigger sets IsDestroyed): TriggerOnTime ← ${seconds?._source ?? 'its own'}; Multiplier the ConditionalFloat's branch for a charge; stopped and started by the EventGates on OnInteractStart/Stop between armed and defused; reset on defused; StopWatchEntityData.${warnRef ?? '?'} the fuse less ${warn ?? '?'} s (the explosion's sound)`,
  };
}

// the interaction the charges of one prefab share: charge → core → keypad → button
export function chargeRules(root, bomb) {
  const B = follow(root, bomb);
  const ci = indexOfRef(B, /PF_Interact_PlanetaryBattle_Core$/);
  const C = ci >= 0 ? follow(root, B.objects[ci].Blueprint) : null;
  const ki = C ? indexOfRef(C, /PF_Interact_Keypad$/) : -1;
  const K = ki >= 0 ? follow(root, C.objects[ki].Blueprint) : null;
  const bi = K ? indexOfRef(K, /PF_Interact_Button$/) : -1;
  const U = bi >= 0 ? follow(root, K.objects[bi].Blueprint) : null;
  const wi = U ? U.objects.findIndex((o) => o?.$type === 'WorldInteractionEntityData') : -1;
  if (wi < 0) return null;
  const W = U.objects[wi];
  const mul = objectsOf(U, 'TransformMultiplierEntityData')[0];
  const chain = `${B.name} → ${C.name} → ${K.name} → ${U.name}`;

  // the keypad's place in the charge: the core's own place in the charge, the keypad's in the core, the button's in the keypad
  const local = compose(compose(tf(B.objects[ci].BlueprintTransform), tf(C.objects[ki].BlueprintTransform)), tf(K.objects[bi].BlueprintTransform));

  // the reach: the keypad's values into the button's fields, else the button's own
  const kv = (field) => ifaceInto(K, bi, field)?.[0];
  const distance = kv(H('InteractionMaxDistance')) ?? W.InteractionMaxDistance;
  const angle = kv(H('InteractionMaxAngle')) ?? W.InteractionMaxAngle;
  // (the facing: the charge's SelectFloat into the core's, as the charge's own CompareBool selects it)
  let facing = W.InteractionFacingMaxAngle;
  const facingSel = into(B, ci, H('InteractionFacingMaxAngle'))
    .map((c) => c.Source.$ref)
    .find((r) => B.objects[r]?.$type === 'SelectFloatEntityData');
  if (facingSel !== undefined) {
    const cmp = evInto(B, facingSel).find((e) => objOf(B, e.Source)?.$type === 'CompareBoolEntityData');
    const bool = cmp ? ifaceInto(B, cmp.Source.$ref, H('Bool')) : null;
    const want = bool?.[0] ? H('OnTrue') : H('OnFalse');
    const ev = evInto(B, facingSel).find((e) => e.Source.$ref === cmp?.Source.$ref && s32(e.SourceEvent.Id) === want);
    const v = ev ? ifaceInto(B, facingSel, ev.TargetEvent.Id) : null;
    if (typeof v?.[0] === 'number') facing = v[0];
  }
  // (one at a time: the Bool on AllowMoreInteractors is set false when an interaction starts)
  const allow = into(U, wi, H('AllowMoreInteractors'))[0]?.Source.$ref;
  const one = allow !== undefined && evInto(U, allow, H('SetFalse')).some((e) => e.Source.$ref === wi && s32(e.SourceEvent.Id) === ON_START);
  // (a hold let go starts again unless the keypad sets the button's keep field)
  const keep = Boolean(kv(BUTTON_KEEP));

  // the holds: the keypad's ConditionalFloat on the button's hold, OFF while the charge is off, ON once it is armed
  const condRef = K.objects.findIndex((o, i) => o?.$type === 'ConditionalFloatEntityData' && into(K, i, H('ValueIfFalse')).some((c) => isIface(K, c.Source) && s32(c.SourceFieldId) === HOLD_OFF));
  const holdOf = (keypadField) => {
    const sel = into(C, ki, keypadField)
      .map((c) => c.Source.$ref)
      .find((r) => C.objects[r]?.$type === 'SelectFloatEntityData');
    return sel === undefined ? null : inputOf(root, C, sel, selectedInput(B, ci, C, sel));
  };
  const off = holdOf(HOLD_OFF);
  const on = holdOf(HOLD_ON);

  // the keypad comes on a Delay chain after the charge is enabled: the Delays back from the Bool SetTrue that
  // feeds the And into the keypad's enable
  let live = 0;
  const andRef = into(C, ki, KEYPAD_ENABLE)[0]?.Source.$ref;
  const liveBools = andRef !== undefined ? into(C, andRef).map((c) => c.Source.$ref).filter((r) => C.objects[r]?.$type === 'BoolEntityData') : [];
  const delayIn = (ref, ev) => evInto(C, ref, H(ev)).find((e) => C.objects[e.Source.$ref]?.$type === 'DelayEntityData')?.Source.$ref;
  for (const b of liveBools) {
    let sum = 0;
    for (let at = delayIn(b, 'SetTrue'), guard = 0; at !== undefined && guard < 8; at = delayIn(at, 'In'), guard++) sum += delayOf(C, at);
    live = Math.max(live, sum);
  }
  // the keypad's Delay between the button's finished hold and its armed/defused EventGates
  const settleRef = K.objects.findIndex((o, i) => o?.$type === 'DelayEntityData' && evInto(K, i, H('In')).some((e) => e.Source.$ref === bi && s32(e.SourceEvent.Id) === BUTTON_DONE));

  return {
    local,
    interact: {
      distance,
      scale: r3(len(mul?.In1?.right)),
      angle,
      facing,
      one,
      keep,
      _source: `${chain}: the keypad's InteractionMaxDistance and InteractionMaxAngle into the button's WorldInteractionEntityData; the button's TransformMultiplierEntityData.In1 (the interaction's Transform); the charge's SelectFloat into InteractionFacingMaxAngle; the Bool on AllowMoreInteractors set false on OnInteractStart; the button's EventGate resetting its StopWatch on OnInteractStop`,
    },
    arm: { hold: off?.value ?? null, by: 'attack', ...(off?.setting ? { setting: off.setting } : {}), _source: `${K.name}#ConditionalFloatEntityData.${condRef}.ValueIfFalse (the charge off) ← ${C.name}'s SelectFloat "Bomb: " ← ${off?._source ?? '?'}` },
    defuse: { hold: on?.value ?? null, by: 'defend', ...(on?.setting ? { setting: on.setting } : {}), _source: `${K.name}#ConditionalFloatEntityData.${condRef}.ValueIfTrue (armed: its EventSwitch on the button's Success) ← ${C.name}'s SelectFloat "Bomb: " ← ${on?._source ?? '?'}` },
    fuse: fuseOf(root, B, ci, C, ki),
    live: { seconds: live, _source: `${C.name}#DelayEntityData: the chain from the charge's enable to the Bool on the keypad's enable (${KEYPAD_ENABLE})` },
    settle: { seconds: settleRef >= 0 ? K.objects[settleRef].Delay : 0, _source: `${K.name}#DelayEntityData.${settleRef} on the button's ${BUTTON_DONE} into the armed/defused EventGates` },
    _source: chain,
  };
}

export function chargesOf(root, dir, sub) {
  const g = graphOf(root, dir, sub);
  if (!g) return [];
  const { byGuid, pin, evin } = g;
  const byId = new Map([...byGuid.values()].map((e) => [e.id, e]));
  const prefix = `${sub}_`.toLowerCase();
  const rules = new Map();
  const out = [];
  for (const e of byGuid.values()) {
    const name = shortName(e.o.Blueprint?.$asset ?? '');
    if (!/^PF_Interact_PlanetaryBattle_Bomb/.test(name) || !e.layer.toLowerCase().startsWith(prefix)) continue;
    const T = e.o.BlueprintTransform;
    if (!T?.trans) continue;
    const bp = e.o.Blueprint.$asset;
    if (!rules.has(bp)) rules.set(bp, chargeRules(root, e.o.Blueprint));
    const R = rules.get(bp);
    const ins = pin.get(e.id) ?? [];
    const loc = ins.find((p) => s32(p.field) === CHARGE_LOCATOR)?.src ?? null;
    const enabled = ins.find((p) => s32(p.field) === H('Enabled'))?.src ?? null;
    const label = ins.find((p) => s32(p.field) === H('ObjectiveName'))?.src?.o?.Sid ?? null;
    const world = R ? compose(tf(T), R.local) : null;
    // (the charges' detonated event into an EventAndGate: its EventCount)
    let win = null;
    for (const [id, list] of evin) {
      const t = byId.get(id);
      if (t?.o.$type !== 'EventAndGateEntityData' || !list.some((v) => v.src.id === e.id && s32(v.srcEvent) === DETONATED)) continue;
      win = { gate: id, of: t.o.EventCount ?? null, _source: `${g.subName}#EventConnections (the charges' ${DETONATED} into ${id}, EventAndGateEntityData.EventCount)` };
    }
    const { local, _source: chain, ...shared } = R ?? {};
    out.push({
      id: e.id,
      name,
      at: [T.trans.x, T.trans.y, T.trans.z].map(r3),
      yaw: r3(yawOf(T.forward)),
      label,
      charge: loc?.o?.Transform ? { id: loc.id, at: [loc.o.Transform.trans.x, loc.o.Transform.trans.y, loc.o.Transform.trans.z].map(r3) } : null,
      keypad: world ? { at: [world.t.x, world.t.y, world.t.z].map(r3), yaw: r3(yawOf(world.f)) } : null,
      enabledBy: enabled?.id ?? null,
      ...shared,
      win,
      _source: `${g.subName}#PropertyConnections (${name}: the locator on its ${CHARGE_LOCATOR}, its Enabled, its ObjectiveName); ${chain ?? bp}`,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
