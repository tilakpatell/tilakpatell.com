// A mode's interact gates, run as the game runs them (bf2-re findings/58):
// Hoth's two hangar blast doors (the map rulebook's `gates`, read from the
// mode sub-world's graph by scripts/lib/bf2017-rulebook-gates.mjs). A gate is
// locked until the walker on its route finishes it; the first walker home
// unlocks its own gate and bars the other (the EventGate's Close). An
// unlocked gate opens when anyone holds the interaction at its panel for a
// second within two metres (PF_Interact_Button: its WorldInteraction's
// InteractionMaxDistance 2, its StopWatch's TriggerOnTime 1, EnabledTeam
// TeamNeutral); its leaves then slide open over a second and a half, the door
// controller's interpolator (PF_AutomaticDoor_Controller: Sine, EaseOut,
// Duration 1.5). Pure.
//
//   createGates(rows) → gates
//   arrive(gates, path) → events   a walker finished its route (path: its AIWaypointsShapeData id)
//   tick(gates, dt, soldiers) → events   soldiers: [{ at: [x, y, z], alive, interact }]
//     events: { type: 'gate', id, state: 'unlocked' | 'barred' | 'opened' | 'open' }
//   openness(gate) → 0…1 (the leaves' slide, eased)     gateOf(gates, id)

// m: the panel's reach (PF_Interact_Button's WorldInteractionEntityData.InteractionMaxDistance)
export const REACH = 2;
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

const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= r;

export function tick(gates, dt, soldiers = []) {
  const out = [];
  for (const g of gates.list) {
    if (g.state === 'unlocked') {
      const held = g.panel && soldiers.some((s) => s.alive && s.interact && near(s.at, g.panel.at, REACH));
      g.hold = held ? g.hold + dt : 0;
      if (g.hold >= HOLD - 1e-9) {
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
