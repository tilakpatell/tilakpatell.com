// A mode's interact gates, run as the game runs them (bf2-re findings/59):
// Hoth's two hangar blast doors (the map rulebook's `gates`, read from the
// mode sub-world's graph by scripts/lib/bf2017-rulebook-gates.mjs). A gate is
// locked until a walker finishes its route; the first walker home unlocks the
// gate its route unlocks and bars the other (the EventGate's Close), and the
// gate it reached is blown a second later (its leaves' Enabled set false: the
// walker's fire), open from then on. An
// unlocked gate opens when anyone holds the interaction at its panel for a
// second (PF_Interact_Button: its StopWatch's TriggerOnTime 1, EnabledTeam
// TeamNeutral), in front of the panel (its WorldInteraction's
// InteractionMaxAngle 90 from the panel's facing) and within its reach: the
// InteractionMaxDistance 2 on the interaction's transform, which the button
// scales 3× (its TransformMultiplier's In1), so 6 m in the world. Hoth's
// panels are set in the wall beside each door, facing the field: 4.3 m from
// the nearest floor in front of them, 0.6 m from the base's floor behind.
// The gate's leaves then slide apart, the door controller's interpolator
// (PF_AutomaticDoor_Controller: Sine, EaseOut) over the gate's own run:
// Hoth's sets 70 s and 8.96 m a leaf where the controller says 1.5 s. Its
// way through is open to a soldier once the leaves' gap, less their closed
// overlap, passes one (`passable`: the doorway the navmesh then joins). The
// row's `interact` and `door` carry the numbers; these are the prefabs' own
// where a row has none. Pure.
//
//   createGates(rows) → gates
//   arrive(gates, path) → events   a walker finished its route (path: its AIWaypointsShapeData id)
//   tick(gates, dt, soldiers) → events   soldiers: [{ at: [x, y, z], alive, interact }]
//     events: { type: 'gate', id, state: 'unlocked' | 'barred' | 'blown' | 'opened' | 'passable' | 'open' }
//   openness(gate) → 0…1 (the leaves' slide, eased)     gap(gate) → m between the leaves     gateOf(gates, id)
//   reachOf(gate) → m      canUse(gate, at) → whether a soldier at [x, y, z] can hold its panel

// m: the interaction's distance on its own transform (PF_Interact_Button's WorldInteractionEntityData.InteractionMaxDistance)
export const REACH = 2;
// ×: the interaction transform's scale (PF_Interact_Button's TransformMultiplierEntityData.In1)
export const SCALE = 3;
// degrees: how far off the panel's facing an interactor may stand (WorldInteractionEntityData.InteractionMaxAngle)
export const ANGLE = 90;
// s: the hold (PF_Interact_Button's StopWatchEntityData.TriggerOnTime)
export const HOLD = 1;
// s: the leaves' slide where the gate sets none (PF_AutomaticDoor_Controller's FloatInterpolatorEntityData.Duration, Sine EaseOut)
export const OPEN_SECONDS = 1.5;
// m: the gap a soldier passes, its capsule's width (DefaultSoldierPhysics#CharacterPhysicsData.PhysicalRadius 0.3, twice)
export const PASS = 0.6;

export function createGates(rows = []) {
  return { list: rows.map((r) => ({ ...r, state: 'locked', hold: 0, t: 0, passable: false, blowIn: null })) };
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
      // (the walker at this gate blows it, its delay on: the row's blownBy)
      g.blowIn = g.blownBy?.find((b) => b.path === path)?.after ?? null;
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
    if (g.state === 'barred' && g.blowIn !== null) {
      g.blowIn -= dt;
      if (g.blowIn <= 1e-9) {
        g.state = 'blown';
        g.blowIn = null;
        g.passable = true;
        out.push({ type: 'gate', id: g.id, state: 'blown' }, { type: 'gate', id: g.id, state: 'passable' });
      }
    } else if (g.state === 'unlocked') {
      const held = soldiers.some((s) => s.alive && s.interact && canUse(g, s.at));
      g.hold = held ? g.hold + dt : 0;
      if (g.hold >= (g.interact?.hold ?? HOLD) - 1e-9) {
        g.state = 'opening';
        g.t = 0;
        out.push({ type: 'gate', id: g.id, state: 'opened' });
      }
    } else if (g.state === 'opening') {
      g.t += dt;
      const done = g.t >= secondsOf(g) - 1e-9;
      if (done) g.state = 'open';
      if (!g.passable && (done || gap(g) >= PASS - 1e-9)) {
        g.passable = true;
        out.push({ type: 'gate', id: g.id, state: 'passable' });
      }
      if (done) out.push({ type: 'gate', id: g.id, state: 'open' });
    }
  }
  return out;
}

const secondsOf = (g) => g.door?.seconds ?? OPEN_SECONDS;

export function openness(g) {
  if (g.state === 'open' || g.state === 'blown') return 1;
  if (g.state !== 'opening') return 0;
  // (the game's Sine EaseOut: 1 − f(1 − t) of the ease-in 1 − cos(tπ/2), sin(tπ/2))
  return Math.sin((Math.PI / 2) * Math.min(1, g.t / secondsOf(g)));
}

// the leaves' gap: each slid its way by the eased run, less what they overlap shut (none known: shut till open)
export function gap(g) {
  const { slide, overlap } = g.door ?? {};
  if (g.state === 'blown') return Infinity;
  if (!slide || overlap === null || overlap === undefined) return g.state === 'open' ? Infinity : 0;
  return Math.max(0, 2 * slide * openness(g) - overlap);
}
