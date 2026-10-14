// A mode's interact gates, run as the game runs them (bf2-re findings/58):
// Hoth's two hangar blast doors (the map rulebook's `gates`, read from the
// mode sub-world's graph by scripts/lib/bf2017-rulebook-gates.mjs). A gate is
// locked until the walker on its route finishes it; the first walker home
// unlocks its own gate and bars the other (the EventGate's Close). An
// unlocked gate opens when anyone holds the interaction at its panel for a
// second (PF_Interact_Button: its StopWatch's TriggerOnTime 1, EnabledTeam
// TeamNeutral), in front of the panel (its WorldInteraction's
// InteractionMaxAngle 90 from the panel's facing) and within its reach: the
// InteractionMaxDistance 2 on the interaction's transform, which the button
// scales 3× (its TransformMultiplier's In1), so 6 m in the world. Hoth's
// panels are set in the wall beside each door, facing the field: 4.3 m from
// the nearest floor in front of them, 0.6 m from the base's floor behind.
// The gate's leaves then slide open over a second and a half, the door
// controller's interpolator (PF_AutomaticDoor_Controller: Sine, EaseOut,
// Duration 1.5). The row's `interact` carries the numbers; these are the
// button's own where a row has none. Pure.
//
//   createGates(rows) → gates
//   arrive(gates, path) → events   a walker finished its route (path: its AIWaypointsShapeData id)
//   tick(gates, dt, soldiers) → events   soldiers: [{ at: [x, y, z], alive, interact }]
//     events: { type: 'gate', id, state: 'unlocked' | 'barred' | 'opened' | 'open' }
//   openness(gate) → 0…1 (the leaves' slide, eased)     gateOf(gates, id)
//   reachOf(gate) → m      canUse(gate, at) → whether a soldier at [x, y, z] can hold its panel

// m: the interaction's distance on its own transform (PF_Interact_Button's WorldInteractionEntityData.InteractionMaxDistance)
export const REACH = 2;
// ×: the interaction transform's scale (PF_Interact_Button's TransformMultiplierEntityData.In1)
export const SCALE = 3;
// degrees: how far off the panel's facing an interactor may stand (WorldInteractionEntityData.InteractionMaxAngle)
export const ANGLE = 90;
// s: the hold (PF_Interact_Button's StopWatchEntityData.TriggerOnTime)
export const HOLD = 1;
// s: the leaves' slide (PF_AutomaticDoor_Controller's FloatInterpolatorEntityData.Duration, Sine EaseOut)
export const OPEN_SECONDS = 1.5;

export function createGates(rows = []) {
  return { list: rows.map((r) => ({ ...r, state: 'locked', hold: 0, t: 0 })) };
}

export const gateOf = (gates, id) => gates.list.find((g) => g.id === id) ?? null;

export function arrive(gates, path) {
  const out = [];
  // (the first home unlocks its own and bars the rest its route closes: in the game, the EventGates' Close)
  for (const g of gates.list) {
    if (g.state !== 'locked') continue;
    if (g.unlock === path) {
      g.state = 'unlocked';
      out.push({ type: 'gate', id: g.id, state: 'unlocked' });
    } else if (g.barredBy?.includes(path)) {
      g.state = 'barred';
      out.push({ type: 'gate', id: g.id, state: 'barred' });
    }
  }
  return out;
}

export const reachOf = (g) => (g.interact?.distance ?? REACH) * (g.interact?.scale ?? SCALE);

export function canUse(g, at) {
  const p = g.panel?.at;
  if (!p) return false;
  const d = [at[0] - p[0], at[1] - p[1], at[2] - p[2]];
  if (Math.hypot(...d) > reachOf(g)) return false;
  // (in front: the way from the panel to the soldier, on the ground, within the angle of its facing)
  const flat = Math.hypot(d[0], d[2]);
  if (flat < 1e-6) return true;
  const yaw = g.panel.yaw ?? 0;
  const cos = (d[0] * Math.sin(yaw) + d[2] * Math.cos(yaw)) / flat;
  return cos >= Math.cos(((g.interact?.angle ?? ANGLE) * Math.PI) / 180) - 1e-9;
}

export function tick(gates, dt, soldiers = []) {
  const out = [];
  for (const g of gates.list) {
    if (g.state === 'unlocked') {
      const held = soldiers.some((s) => s.alive && s.interact && canUse(g, s.at));
      g.hold = held ? g.hold + dt : 0;
      if (g.hold >= (g.interact?.hold ?? HOLD) - 1e-9) {
        g.state = 'opening';
        g.t = 0;
        out.push({ type: 'gate', id: g.id, state: 'opened' });
      }
    } else if (g.state === 'opening') {
      g.t += dt;
      if (g.t >= OPEN_SECONDS - 1e-9) {
        g.state = 'open';
        out.push({ type: 'gate', id: g.id, state: 'open' });
      }
    }
  }
  return out;
}

export function openness(g) {
  if (g.state === 'open') return 1;
  if (g.state !== 'opening') return 0;
  return Math.sin((Math.PI / 2) * Math.min(1, g.t / OPEN_SECONDS));
}
