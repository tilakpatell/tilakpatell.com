// How much of the endless universe is made and drawn, by device: one table,
// read by every lane that adds to the space, so a phone gets less of it
// built rather than a broken scene, and a strong desktop more.
//
// BUDGET: { low, mid, high, ultra }, a row each:
//   systemsBuilt  the generated systems built whole (star and light,
//                 planets on their orbits, moons, rings), never under 1
//   discs         the far bodies drawn as discs of their true size
//   slotSize      specks a sector's slot holds in the far layer, in hundreds
//   nearSlots     sector slots in the far layer, the 3 × 3 × 3 and spare
//   beyondRings   rings of sectors past the 3 × 3 × 3 drawn as starfield
//   thingsNear    small things in space built as meshes round the ship
//   thingKinds    a share of `discs` by kind (lane 4a fills it)
//   workers       the worker pool's threads making sectors
//   expanseMs     main-thread milliseconds a frame for taking sectors in
//   traffic       traffic groups flying round the ship
//   events        events at once
//   nebula        { res: the volume's resolution against the screen, steps }
//   gargantuan    the detail a gargantuan is built at
//   planetMap     a generated planet's orbit map, [width, height]
//
// universeBudget({ tier, detail }, step = 0, floor = false) → a row, fresh
//   The detail level in force picks the row (lib/device's: the visitor's
//   pick, or Auto's); a detail it doesn't know goes by the tier; anything
//   else is mid. `step` is the pace's quality step, 0 to 3, which takes
//   discs, things and traffic down to 1, 0.75, 0.5 and 0.35 of the row
//   and, from 2, a ring of starfield and half the nebula's steps; `floor`
//   is the quality's floor, a quarter of them. No step raises anything.

export const BUDGET = {
  low: { systemsBuilt: 1, discs: 400, slotSize: 400, nearSlots: 64, beyondRings: 1, thingsNear: 16, thingKinds: {}, workers: 1, expanseMs: 1, traffic: 2, events: 1, nebula: { res: 0.25, steps: 16 }, gargantuan: 'low', planetMap: [256, 128] },
  mid: { systemsBuilt: 1, discs: 1200, slotSize: 400, nearSlots: 64, beyondRings: 1, thingsNear: 32, thingKinds: {}, workers: 2, expanseMs: 1.5, traffic: 4, events: 2, nebula: { res: 0.5, steps: 32 }, gargantuan: 'mid', planetMap: [256, 128] },
  high: { systemsBuilt: 2, discs: 2500, slotSize: 400, nearSlots: 64, beyondRings: 2, thingsNear: 64, thingKinds: {}, workers: 3, expanseMs: 2, traffic: 6, events: 3, nebula: { res: 0.5, steps: 48 }, gargantuan: 'high', planetMap: [512, 256] },
  ultra: { systemsBuilt: 3, discs: 4000, slotSize: 400, nearSlots: 64, beyondRings: 2, thingsNear: 96, thingKinds: {}, workers: 4, expanseMs: 2, traffic: 8, events: 3, nebula: { res: 1, steps: 64 }, gargantuan: 'high', planetMap: [512, 256] },
};

export const STEPS = [1, 0.75, 0.5, 0.35];
const FLOOR = 0.25;
const SCALED = ['discs', 'thingsNear', 'traffic'];

const rowFor = ({ tier, detail } = {}) => BUDGET[detail] ?? BUDGET[tier] ?? BUDGET.mid;

export function universeBudget(dev = {}, step = 0, floor = false) {
  const base = rowFor(dev);
  const row = { ...base, thingKinds: { ...base.thingKinds }, nebula: { ...base.nebula }, planetMap: [...base.planetMap] };
  const s = Math.max(0, Math.min(STEPS.length - 1, Math.round(Number(step) || 0)));
  const k = STEPS[s] * (floor ? FLOOR : 1);
  for (const f of SCALED) row[f] = Math.max(1, Math.round(base[f] * k));
  if (s >= 2) {
    row.beyondRings = Math.max(0, base.beyondRings - 1);
    row.nebula.steps = Math.max(1, Math.round(base.nebula.steps / 2));
  }
  row.systemsBuilt = Math.max(1, base.systemsBuilt);
  return row;
}
