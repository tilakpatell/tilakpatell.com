// Abilities on channels (spec catalogue 3, `BasicPlayerAbilityAsset`,
// `CharacterStatePlayerAbilityAsset`; bf2-re finding 33): each a bar that a
// press spends `TriggerCost` of (a fraction, so the roll's 0.5 gives two
// charges) and that refills over `RechargeTime` once the ability is done;
// a press runs `ActivationTime` then `ActiveTime`; an ability on a channel
// another ability is using, or named in an active ability's
// `BlockedPlayerAbilityIds` (a grenade in the hand blocks the class's
// middle and right), is blocked; a press while one is activating, or that
// cannot act yet (its ability recharging or blocked), waits in the game's
// input queue (`WSPlayerAbilitySetComponentData`: three presses for half a
// second) and acts if the ability becomes able in that time. The recharge
// begins when the active time ends, the timer reloaded at each change of
// state. The game's states (`PlayerAbilityState`): Disabled 0,
// Recharge 1, Blocked 2, Ready 3, Activating 4, Active 5. An ability with
// `InfiniteActiveTime` (`active: Infinity`: the sentry, the vanguard,
// infiltration, the shield, the turret, the binoculars) stays active until
// its own event ends it (`end`: the sentry's heat, the vanguard's 12.5 s,
// the shield's 0 health); a `RetriggerablePlayerAbilityAsset` (`retrigger:
// { cooldown }`) is ended by a second press once `RetriggerCooldown` has
// passed (the shield's and the turret's 2 s, the flash's 0.6); a held ability
// (`hold`: a grenade still in the hand) stays active past its `ActiveTime`
// until it is let go. Pure.
//
//   createAbilities(rows, { rand, hold }) → abs     (rows: ability rows, each with an optional `slot`; hold: whether a
//     press that cannot act yet waits its half second, a human's; a bot's press is its brain's to make again)
//   press(abs, slot, now) → { fired, why?: 'recharging' | 'blocked' | 'queued' | 'retriggered', held? }   (held: it waits)
//   tick(abs, dt, now) → events [{ type: 'ability', id, slot, phase: 'start' | 'active' | 'end', why? }]
//   end(abs, slot, now, why?) → bool (an active ability ended by its event; the recharge starts)
//   hold(abs, slot, on) → void (an active ability kept past its ActiveTime while `on`)
//   charges(abs, slot) → number        blocked(abs, slot) → bool
//   state(abs, slot) → 'disabled' | 'recharge' | 'blocked' | 'ready' | 'activating' | 'active'
//   recharge(abs, slot) → 0…1 (the bar toward the next charge, the HUD's sweep)

// The input queue, the game's (WSPlayerAbilitySetComponentData): presses held, and for how long.
export const QUEUE = 3;
export const QUEUE_TIMEOUT = 0.5;
// The game's state names by number (`PlayerAbilityState`).
export const STATES = ['disabled', 'recharge', 'blocked', 'ready', 'activating', 'active'];

// The combat roll (`Ability_<Class>_CombatRoll_CharacterState`): the team
// data names it but lane 0's abilities.json has no row for it, so its
// numbers are the record's as the design's survey read them (TriggerCost
// 0.5, RechargeTime 4, ActiveTime 0.1), and the roll's travel (`ROLL_SPEED`
// in soldier.js) is the game's by observation. Its prefab
// (`PF_Ability_CombatRoll_Shared`, finding 33) applies
// `Affector_Evading_DMGMultiplier` (0.8 of the damage taken) for 2 s.
export const ROLL = { id: 'Ability_Assault_CombatRoll_CharacterState', kind: 'state', activation: 0, active: 0.1, recharge: 4, cost: 0.5, channels: [], evade: { taken: 0.8, seconds: 2 } };

export function createAbilities(rows, { rand = null, hold = false } = {}) {
  return {
    rand,
    hold,
    list: rows.map((row, i) => ({ row, slot: row.slot ?? i, bar: 1, phase: 'idle', until: 0, startedAt: -Infinity, activeAt: -Infinity, held: false })),
    queue: [],
    events: [],
  };
}

const find = (abs, slot) => abs.list.find((a) => a.slot === slot) ?? abs.list[slot] ?? null;
const costOf = (a) => a.row.cost ?? 1;
const busy = (a) => a.phase !== 'idle';
// whether a busy ability holds its blocks now: all the while by default; a row that carries its record's two flags
// (`blocksWhile`, a hero's: ApplyBlockPlayerAbilitiesDuringActivation and …DuringActive) only where they say so
const blocking = (o) => (o.row.blocksWhile ? (o.phase === 'activating' ? o.row.blocksWhile.activation : o.phase === 'active' && o.row.blocksWhile.active) : busy(o));

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

export function blocked(abs, slot) {
  const a = find(abs, slot);
  if (!a) return true;
  // (an active ability that names this one: BlockedPlayerAbilityIds, held through its activation too)
  if (abs.list.some((o) => o !== a && blocking(o) && (o.row.blocks ?? []).includes(a.row.id))) return true;
  const mine = a.row.channels ?? [];
  if (!mine.length) return false;
  return abs.list.some((o) => o !== a && busy(o) && (o.row.channels ?? []).some((c) => mine.includes(c)));
}

export function state(abs, slot) {
  const a = find(abs, slot);
  if (!a) return 'disabled';
  if (a.phase === 'activating' || a.phase === 'active') return a.phase;
  if (blocked(abs, slot)) return 'blocked';
  return charges(abs, slot) >= 1 ? 'ready' : 'recharge';
}

const push = (abs, a, phase, extra = null) => abs.events.push({ type: 'ability', id: a.row.id, slot: a.slot, phase, ...(extra ?? {}) });

function activate(abs, a, now) {
  const active = a.row.active ?? 0;
  a.activeAt = now;
  if (active > 0) {
    a.phase = 'active';
    a.until = now + active;
    push(abs, a, 'active');
  } else {
    a.phase = 'idle';
    a.idleAt = now;
    push(abs, a, 'end');
  }
}

function start(abs, a, now) {
  a.bar -= costOf(a);
  a.startedAt = now;
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
  a.phase = 'idle';
  a.until = now;
  a.idleAt = now;
  a.held = false;
  push(abs, a, 'end', { why });
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
  // (a toggle's second press, once its retrigger cooldown has passed, lowers it)
  if (a.phase === 'active' && a.row.retrigger) {
    if (now - a.activeAt + 1e-9 < (a.row.retrigger.cooldown ?? 0)) return { fired: false, why: 'blocked' };
    end(abs, a.slot, now, 'retrigger');
    return { fired: false, why: 'retriggered' };
  }
  if (abs.list.some((o) => o.phase === 'activating')) {
    // (the roll is the caller's to perform at the press, so it cannot wait in the queue: during another ability's
    // activation it is refused, as the game's records have it, the dodge in most abilities' blocked list then)
    if (a.slot === 0 || abs.queue.length >= QUEUE) return { fired: false, why: 'blocked' };
    abs.queue.push({ slot: a.slot, at: now });
    return { fired: false, why: 'queued' };
  }
  const r = attempt(abs, a, now);
  // (a human's press that cannot act yet, the ability recharging or blocked, is held as the game holds it and acts
  // if the ability becomes able inside QUEUE_TIMEOUT: watched in the running game. Not a bot's: its brain takes
  // `fired: false` as final and presses again when it means to; whether the game holds an AutoPlayer's press was
  // not read. The roll's press is the caller's to act on there and then, so a roll with no charge is not held.)
  if (r.fired || !abs.hold || a.slot === 0 || abs.queue.length >= QUEUE) return r;
  abs.queue.push({ slot: a.slot, at: now });
  return { ...r, held: true };
}

export function tick(abs, dt, now) {
  for (const a of abs.list) {
    if (a.phase === 'activating' && now >= a.until) activate(abs, a, a.until);
    if (a.phase === 'active' && now >= a.until && !a.held) {
      a.phase = 'idle';
      // (its active time's own end, or this step's start where something held it past that)
      a.idleAt = Math.max(a.until, now - dt);
      push(abs, a, 'end');
    }
    // (the recharge runs while the ability is not activating or active: Active → Recharge → Ready. It begins when
    // the active time ends, as the game's timer is reloaded on the change of state: of the step the ability went
    // idle in, only what was left of it recharges, so a press is ready again exactly its three times later)
    const rt = a.row.recharge ?? 0;
    if (!busy(a)) a.bar = rt > 0 ? Math.min(1, a.bar + Math.max(0, Math.min(dt, now - (a.idleAt ?? -Infinity))) / rt) : 1;
  }
  abs.queue = abs.queue.filter((q) => now - q.at <= QUEUE_TIMEOUT + 1e-9);
  // (each waiting press is tried again, in order, while no ability is activating: a human's that still cannot act
  // waits out its half second; a bot's is tried the once, as before)
  const waiting = [];
  for (const q of abs.queue) {
    if (abs.list.some((o) => o.phase === 'activating')) waiting.push(q);
    else if (!attempt(abs, find(abs, q.slot), now).fired && abs.hold) waiting.push(q);
  }
  abs.queue = waiting;
  const out = abs.events;
  abs.events = [];
  return out;
}
