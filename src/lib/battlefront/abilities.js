// Abilities on channels (spec catalogue 3, `BasicPlayerAbilityAsset`,
// `CharacterStatePlayerAbilityAsset`): each a bar that a press spends
// `TriggerCost` of (a fraction, so the roll's 0.5 gives two charges) and
// that refills over `RechargeTime`; a press runs `ActivationTime` then
// `ActiveTime`; an ability on a channel another ability is using is
// blocked; a press while one is activating waits in the game's input queue
// (`WSPlayerAbilitySetComponentData`: three presses for half a second).
// Pure.
//
//   createAbilities(rows, { rand }) → abs     (rows: ability rows, each with an optional `slot`)
//   press(abs, slot, now) → { fired, why?: 'recharging' | 'blocked' | 'queued' }
//   tick(abs, dt, now) → events [{ type: 'ability', id, phase: 'start' | 'active' | 'end' }]
//   charges(abs, slot) → number        blocked(abs, slot) → bool

// The input queue, the game's (WSPlayerAbilitySetComponentData): presses held, and for how long.
export const QUEUE = 3;
export const QUEUE_TIMEOUT = 0.5;

// The combat roll (`Ability_<Class>_CombatRoll_CharacterState`): the team
// data names it but lane 0's abilities.json has no row for it, so its
// numbers are the record's as the design's survey read them (TriggerCost
// 0.5, RechargeTime 4, ActiveTime 0.1), and the roll's travel (`ROLL_SPEED`
// in soldier.js) is the game's by observation.
export const ROLL = { id: 'Ability_Assault_CombatRoll_CharacterState', kind: 'state', activation: 0, active: 0.1, recharge: 4, cost: 0.5, channels: [] };

export function createAbilities(rows, { rand = null } = {}) {
  return {
    rand,
    list: rows.map((row, i) => ({ row, slot: row.slot ?? i, bar: 1, phase: 'idle', until: 0 })),
    queue: [],
    events: [],
  };
}

const find = (abs, slot) => abs.list.find((a) => a.slot === slot) ?? abs.list[slot] ?? null;
const costOf = (a) => a.row.cost ?? 1;

export const charges = (abs, slot) => {
  const a = find(abs, slot);
  return a ? Math.floor(a.bar / costOf(a) + 1e-9) : 0;
};

export function blocked(abs, slot) {
  const a = find(abs, slot);
  if (!a) return true;
  const mine = a.row.channels ?? [];
  if (!mine.length) return false;
  return abs.list.some((o) => o !== a && o.phase !== 'idle' && (o.row.channels ?? []).some((c) => mine.includes(c)));
}

function start(abs, a, now) {
  a.bar -= costOf(a);
  const activation = a.row.activation ?? 0;
  const active = a.row.active ?? 0;
  abs.events.push({ type: 'ability', id: a.row.id, phase: 'start' });
  if (activation > 0) {
    a.phase = 'activating';
    a.until = now + activation;
  } else if (active > 0) {
    a.phase = 'active';
    a.until = now + active;
    abs.events.push({ type: 'ability', id: a.row.id, phase: 'active' });
  } else {
    abs.events.push({ type: 'ability', id: a.row.id, phase: 'end' });
  }
}

function attempt(abs, a, now) {
  if (charges(abs, a.slot) < 1) return { fired: false, why: 'recharging' };
  if (blocked(abs, a.slot)) return { fired: false, why: 'blocked' };
  start(abs, a, now);
  return { fired: true };
}

export function press(abs, slot, now) {
  const a = find(abs, slot);
  if (!a) return { fired: false, why: 'blocked' };
  if (abs.list.some((o) => o.phase === 'activating')) {
    if (abs.queue.length >= QUEUE) return { fired: false, why: 'blocked' };
    abs.queue.push({ slot: a.slot, at: now });
    return { fired: false, why: 'queued' };
  }
  return attempt(abs, a, now);
}

export function tick(abs, dt, now) {
  for (const a of abs.list) {
    if (a.phase === 'activating' && now >= a.until) {
      const active = a.row.active ?? 0;
      a.phase = active > 0 ? 'active' : 'idle';
      a.until += active;
      abs.events.push({ type: 'ability', id: a.row.id, phase: active > 0 ? 'active' : 'end' });
    }
    if (a.phase === 'active' && now >= a.until) {
      a.phase = 'idle';
      abs.events.push({ type: 'ability', id: a.row.id, phase: 'end' });
    }
    const recharge = a.row.recharge ?? 0;
    a.bar = recharge > 0 ? Math.min(1, a.bar + dt / recharge) : 1;
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
