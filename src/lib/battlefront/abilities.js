// Abilities as the game's state machine runs them (bf2-re finding 33:
// `BasicPlayerAbilityAsset`, `RetriggerablePlayerAbilityAsset`,
// `CharacterStatePlayerAbilityAsset`), on the fields each row carries from
// its record (abilities.json, scripts/lib/bf2017-rulebook.mjs's
// stateMachineOf). The game's states (`PlayerAbilityState`): Disabled 0,
// Recharge 1, Blocked 2, Ready 3, Activating 4, Active 5.
//
// - A press spends `TriggerCost` of a bar (a fraction: the roll's 0.5 is two
//   charges) that refills over `RechargeTime` while the ability is idle; it
//   runs `ActivationTime`, then `ActiveTime`, then recharges.
// - `InfiniteActiveTime` (`infinite`, or `active: Infinity`) stays active
//   until its own event ends it (`end`: the sentry's heat, the shield's 0).
// - Blocking is the record's: an ability names the others it blocks
//   (`BlockedPlayerAbilityIds`, by their `Identifier`, while it activates
//   and/or is active: `blocks.activation`, `blocks.active`), or by rules
//   (`BlockPlayerAbilitiesRules`, each with its own phases); and an
//   ability's `BlockingChannels` (`blockedWhen`) block it while the
//   channel holds the value: `BlockAbilities` (raised while the soldier is
//   disabled: `setChannel`), `CurrentAbility` (the grenades' "not 0": no
//   throw during a roll or a hero move).
// - A character-state ability (`activeWhen: CurrentAbility == n`) takes the
//   state machine's CurrentAbility while it runs; another can start only
//   while it is free (0) or one of its own allowed values.
// - A retriggerable ability (`retrigger: { count, cooldown, hold? }`) is
//   ended by a further press once `RetriggerCooldown` has passed (the
//   turret's must be held `hold` seconds); `RequireHoldDuringActivationTime`
//   (`holdActivation`) cancels on a release before the activation is over,
//   the charge given back.
// - A press while another ability activates waits in the input queue
//   (`WSPlayerAbilitySetComponentData`: three presses, half a second) if the
//   ability `SupportsInputQueue`; else it is lost.
// - A held ability (`hold`: a grenade still in the hand) stays active past
//   its ActiveTime until it is let go. Pure.
//
//   createAbilities(rows, { rand }) → abs     (rows: ability rows, each with an optional `slot`)
//   press(abs, slot, now) → { fired, why?: 'recharging' | 'blocked' | 'queued' | 'retriggered' | 'held' }
//   tick(abs, dt, now, { held }) → events [{ type: 'ability', id, slot, phase: 'start' | 'active' | 'end', why? }]   (held: the slot whose key is down)
//   end(abs, slot, now, why?) → bool (an active ability ended by its event; the recharge starts)
//   hold(abs, slot, on)   setChannel(abs, name, value)   current(abs) → CurrentAbility
//   charges(abs, slot) → number        blocked(abs, slot) → bool
//   state(abs, slot) → 'disabled' | 'recharge' | 'blocked' | 'ready' | 'activating' | 'active'
//   recharge(abs, slot) → 0…1 (the bar toward the next charge, the HUD's sweep)

// The input queue, the game's (WSPlayerAbilitySetComponentData): presses held, and for how long.
export const QUEUE = 3;
export const QUEUE_TIMEOUT = 0.5;
// The game's state names by number (`PlayerAbilityState`).
export const STATES = ['disabled', 'recharge', 'blocked', 'ready', 'activating', 'active'];

// The combat roll (`Ability_<Class>_CombatRoll_CharacterState`: TriggerCost
// 0.5, RechargeTime 4, ActiveTime 0.1, RequiredForActive CurrentAbility 17,
// SetChannelValuesOnActiveTimeFinished CurrentPose 1; read by
// scripts/lib/bf2017-rulebook.test.mjs from the record). The class rows do
// not list it (it is the kit's evade), so its numbers sit here. Its prefab
// (`PF_Ability_CombatRoll_Shared`, finding 33) applies
// `Affector_Evading_DMGMultiplier` (0.8 of the damage taken) for 2 s.
export const ROLL = { id: 'Ability_Assault_CombatRoll_CharacterState', kind: 'state', activation: 0, active: 0.1, recharge: 4, cost: 0.5, channels: [], activeWhen: [{ channel: 'CurrentAbility', values: [17], invert: false }], evade: { taken: 0.8, seconds: 2 } };

export function createAbilities(rows, { rand = null } = {}) {
  return {
    rand,
    list: rows.map((row, i) => ({ row, slot: row.slot ?? i, bar: 1, phase: 'idle', until: 0, startedAt: -Infinity, activeAt: -Infinity, held: false, triggers: 0, holdSince: null })),
    queue: [],
    events: [],
    ch: { BlockAbilities: false },
    current: 0,
    owner: null,
  };
}

const find = (abs, slot) => abs.list.find((a) => a.slot === slot) ?? abs.list[slot] ?? null;
const costOf = (a) => a.row.cost ?? 1;
const busy = (a) => a.phase !== 'idle';
const infinite = (row) => row.infinite || row.active === Infinity;

export const charges = (abs, slot) => {
  const a = find(abs, slot);
  return a ? Math.floor(a.bar / costOf(a) + 1e-9) : 0;
};

export const recharge = (abs, slot) => {
  const a = find(abs, slot);
  if (!a) return 0;
  const c = costOf(a);
  return charges(abs, slot) >= 1 / c - 1e-9 ? 1 : Math.min(1, (a.bar % c) / c);
};

export const setChannel = (abs, name, value) => void (abs.ch[name] = value);
export const current = (abs) => abs.current;

// a channel condition met (`CharacterState*RequiredChannelValueData`, an `…OrRequiredData` of them)
function met(abs, c) {
  if (c.or) return c.or.some((x) => met(abs, x)) !== Boolean(c.invert);
  const v = c.channel === 'CurrentAbility' ? abs.current : abs.ch[c.channel];
  const hit = (c.values ?? []).some((x) => x === v || (x === true && v === true) || (x === 0 && v == null));
  return hit !== Boolean(c.invert);
}

// whether ability o, in its phase, blocks a (its blocked ids, its rules)
function blocks(abs, o, a) {
  if (o === a) return false;
  const id = a.row.identifier;
  const phase = o.phase === 'activating' ? 'activation' : o.phase === 'active' ? 'active' : charges(abs, o.slot) >= 1 ? 'ready' : 'recharge';
  if (id != null && o.row.blocks?.ids?.includes(id) && o.row.blocks[phase]) return true;
  for (const r of o.row.blockRules ?? []) if (id != null && r.ids.includes(id) && r[phase]) return true;
  // (a row without the record's ids: the names it blocks while it runs)
  return Array.isArray(o.row.blocks) && busy(o) && o.row.blocks.includes(a.row.id);
}

// the CurrentAbility value a character-state ability holds while it runs (its own allowed one, not 0)
const stateOf = (row) => {
  const c = (row.activeWhen ?? []).find((x) => x.channel === 'CurrentAbility');
  return c ? (c.values.find((v) => v !== 0) ?? `ability:${row.id}`) : null;
};

export function blocked(abs, slot) {
  const a = find(abs, slot);
  if (!a) return true;
  if (abs.list.some((o) => blocks(abs, o, a))) return true;
  if ((a.row.blockedWhen ?? []).some((c) => met(abs, c))) return true;
  // (a character-state move waits for the state machine: another move holding CurrentAbility keeps it out)
  const mine = stateOf(a.row);
  if (mine == null || abs.current === 0) return false;
  const allowed = (a.row.activeWhen ?? []).find((x) => x.channel === 'CurrentAbility')?.values ?? [];
  return abs.current !== mine && !allowed.includes(abs.current);
}

export function state(abs, slot) {
  const a = find(abs, slot);
  if (!a) return 'disabled';
  if (a.phase === 'activating' || a.phase === 'active') return a.phase;
  if (blocked(abs, slot)) return 'blocked';
  return charges(abs, slot) >= 1 ? 'ready' : 'recharge';
}

const push = (abs, a, phase, extra = null) => abs.events.push({ type: 'ability', id: a.row.id, slot: a.slot, phase, ...(extra ?? {}) });

function release(abs, a) {
  if (stateOf(a.row) != null && abs.current === stateOf(a.row)) abs.current = 0;
}

function finish(abs, a, now, why = null) {
  a.phase = 'idle';
  a.until = now;
  a.held = false;
  a.holdSince = null;
  release(abs, a);
  push(abs, a, 'end', why ? { why } : null);
}

function activate(abs, a, now) {
  a.activeAt = now;
  a.triggers = 0;
  const active = infinite(a.row) ? Infinity : (a.row.active ?? 0);
  if (active > 0) {
    a.phase = 'active';
    a.until = now + active;
    push(abs, a, 'active');
  } else finish(abs, a, now);
}

function start(abs, a, now) {
  a.bar -= costOf(a);
  a.startedAt = now;
  const st = stateOf(a.row);
  if (st != null) abs.current = st;
  const activation = a.row.activation ?? 0;
  push(abs, a, 'start');
  if (activation > 0) {
    a.phase = 'activating';
    a.until = now + activation;
  } else activate(abs, a, now);
}

function attempt(abs, a, now) {
  if (charges(abs, a.slot) < 1) return { fired: false, why: 'recharging' };
  if (blocked(abs, a.slot)) return { fired: false, why: 'blocked' };
  start(abs, a, now);
  return { fired: true };
}

// an active ability ended by its own event (the heat, the time, the health, the second press)
export function end(abs, slot, now, why = 'event') {
  const a = find(abs, slot);
  if (!a || a.phase !== 'active') return false;
  finish(abs, a, now, why);
  return true;
}

// an ability kept active past its ActiveTime by what it holds (a grenade in the hand until the key's release)
export function hold(abs, slot, on) {
  const a = find(abs, slot);
  if (a) a.held = Boolean(on);
}

export function press(abs, slot, now) {
  const a = find(abs, slot);
  if (!a) return { fired: false, why: 'blocked' };
  // (a toggle's further press, once its retrigger cooldown has passed, ends it; the turret's wants the key held)
  if (a.phase === 'active' && a.row.retrigger) {
    if (now - a.activeAt + 1e-9 < (a.row.retrigger.cooldown ?? 0)) return { fired: false, why: 'blocked' };
    if (a.row.retrigger.hold > 0) {
      a.holdSince = now;
      return { fired: false, why: 'held' };
    }
    a.triggers++;
    abs.events.push({ type: 'ability', id: a.row.id, slot: a.slot, phase: 'retrigger' });
    if (a.triggers >= (a.row.retrigger.count ?? 1)) end(abs, a.slot, now, 'retrigger');
    return { fired: false, why: 'retriggered' };
  }
  if (abs.list.some((o) => o.phase === 'activating')) {
    // (a record's row queues only if it SupportsInputQueue; a row made by hand always does)
    if (!a.row.queue && a.row.identifier != null) return { fired: false, why: 'blocked' };
    if (abs.queue.length >= QUEUE) return { fired: false, why: 'blocked' };
    abs.queue.push({ slot: a.slot, at: now });
    return { fired: false, why: 'queued' };
  }
  return attempt(abs, a, now);
}

export function tick(abs, dt, now, { held = null } = {}) {
  for (const a of abs.list) {
    const down = held != null && held === a.slot;
    // (RequireHoldDuringActivationTime: let go before the wind-up is over and it is called off, the charge back)
    if (a.phase === 'activating' && a.row.holdActivation && held != null && !down) {
      a.phase = 'idle';
      a.bar = Math.min(1, a.bar + costOf(a));
      release(abs, a);
      push(abs, a, 'end', { why: 'released' });
      continue;
    }
    if (a.phase === 'activating' && now >= a.until - 1e-9) activate(abs, a, a.until);
    // (a held retrigger: the key kept down its `hold` seconds ends it)
    if (a.holdSince != null) {
      if (!down && held != null) a.holdSince = null;
      else if (now - a.holdSince >= a.row.retrigger.hold - 1e-9) end(abs, a.slot, now, 'retrigger');
    }
    if (a.phase === 'active' && now >= a.until && !a.held) finish(abs, a, now);
    // (the recharge runs while the ability is not activating or active: Active → Recharge → Ready)
    const rt = a.row.recharge ?? 0;
    if (!busy(a)) a.bar = rt > 0 ? Math.min(1, a.bar + dt / rt) : 1;
  }
  abs.queue = abs.queue.filter((q) => now - q.at <= QUEUE_TIMEOUT);
  while (abs.queue.length && !abs.list.some((o) => o.phase === 'activating')) {
    const q = abs.queue.shift();
    attempt(abs, find(abs, q.slot), now);
  }
  const out = abs.events;
  abs.events = [];
  return out;
}
