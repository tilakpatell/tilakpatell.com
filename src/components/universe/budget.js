// How much of the endless universe a device draws: one table, a row a
// quality level, so every lane reads the same numbers (the design's
// section H). Pure (no three.js, no DOM), so it runs in Node.
//
//   systemsBuilt  the nearest generated systems built whole (near.js)
//   discs         stars, planets and wonders drawn as discs within the far plane
//   slotSize      the far layer's points a sector's slot holds
//   nearSlots     the far layer's slots
//   beyondRings   the rings of sectors past the 3 × 3 × 3 drawn as specks
//   thingsNear    things in space built as meshes near you
//   thingKinds    a share of `discs` by kind of thing (filled by the things' lane)
//   workers       the worker pool's sector makers
//   expanseMs     the Expanse's own time a frame, in milliseconds
//   traffic       traffic groups at once
//   events        events at once
//   nebula        the nebula impostor's resolution and ray-march steps
//   gargantuan    a gargantuan's detail: 'low', 'mid' or 'high'
//   planetMap     a generated planet's map, [width, height]
//
// universeBudget({ tier, detail }, step = 0, floor = false) → a row. The
// level is the detail level's where it is one, as lib/device's budget()
// reads it (a held Low draws Low's row), otherwise the tier's; any it
// doesn't know reads as mid. `step` is the pace's (qualityStep.js): steps 0
// to 3 take discs, thingsNear and traffic to 1, 0.75, 0.5 and 0.35 of the
// row's, rounded, and any step past 3 reads as 3. Step 2 and up takes one
// from beyondRings (never below none) and halves the nebula's steps. The
// floor takes those counts to a quarter of the step's. Nothing here raises a
// count, and systemsBuilt stays at least 1.

const freeze = (row) => Object.freeze({ ...row, thingKinds: Object.freeze({ ...row.thingKinds }), nebula: Object.freeze({ ...row.nebula }), planetMap: Object.freeze([...row.planetMap]) });

const SLOTS = { slotSize: 400, nearSlots: 64 };

export const BUDGET = Object.freeze({
  low: freeze({ systemsBuilt: 1, discs: 400, ...SLOTS, beyondRings: 1, thingsNear: 16, thingKinds: {}, workers: 1, expanseMs: 1, traffic: 2, events: 1, nebula: { res: 0.25, steps: 16 }, gargantuan: 'low', planetMap: [256, 128] }),
  mid: freeze({ systemsBuilt: 1, discs: 1200, ...SLOTS, beyondRings: 1, thingsNear: 32, thingKinds: {}, workers: 2, expanseMs: 1.5, traffic: 4, events: 2, nebula: { res: 0.5, steps: 32 }, gargantuan: 'mid', planetMap: [256, 128] }),
  high: freeze({ systemsBuilt: 2, discs: 2500, ...SLOTS, beyondRings: 2, thingsNear: 64, thingKinds: {}, workers: 3, expanseMs: 2, traffic: 6, events: 3, nebula: { res: 0.5, steps: 48 }, gargantuan: 'high', planetMap: [512, 256] }),
  ultra: freeze({ systemsBuilt: 3, discs: 4000, ...SLOTS, beyondRings: 2, thingsNear: 96, thingKinds: {}, workers: 4, expanseMs: 2, traffic: 8, events: 3, nebula: { res: 1, steps: 64 }, gargantuan: 'high', planetMap: [512, 256] }),
});

// (the share of the counts at each of the pace's steps, and at the floor)
const SHARE = [1, 0.75, 0.5, 0.35];
const FLOOR = 0.25;

const has = (level) => typeof level === 'string' && Object.hasOwn(BUDGET, level);

export function universeBudget({ tier, detail } = {}, step = 0, floor = false) {
  const row = BUDGET[has(detail) ? detail : has(tier) ? tier : 'mid'];
  const s = Number.isFinite(step) ? Math.min(SHARE.length - 1, Math.max(0, Math.floor(step))) : 0;
  if (s === 0 && !floor) return row;
  const k = SHARE[s] * (floor ? FLOOR : 1);
  const less = s >= 2;
  return freeze({
    ...row,
    discs: Math.round(row.discs * k),
    thingsNear: Math.round(row.thingsNear * k),
    traffic: Math.round(row.traffic * k),
    beyondRings: less ? Math.max(0, row.beyondRings - 1) : row.beyondRings,
    nebula: less ? { ...row.nebula, steps: Math.round(row.nebula.steps / 2) } : row.nebula,
    systemsBuilt: Math.max(1, row.systemsBuilt),
  });
}
