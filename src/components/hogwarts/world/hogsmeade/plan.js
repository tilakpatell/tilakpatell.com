// How each of the village’s houses is put together, as numbers (the
// builder, ./house.js, draws what this says): a stone ground floor with the
// shop’s window and its door in the middle of the front (where
// rules/hogsmeade.js puts the door), a jettied upper floor of oak and
// plaster with its casements, a steep slate roof with its gables at the
// ends, dormers on a wide one, a cross gable to the street on the two big
// ones, the chimneys at the gable ends, the sign on its bracket by the
// door. Every house is a little crooked by its `lean`. In the house’s own
// frame: x along its front, z out of the front (the front at z = d/2), y up.
// Pure.
//
//   TONES: { tone: { plaster, paint, stone } } the colours a house is (sRGB hex)
//   planHouse(site) → { w, d, ground, upper, eaves, ridge, overhang, pitch, door: { x, w, h, double },
//     bays: [{ x, w }], small: [{ x }], casements: [{ x, y, w, h, lit }], sides: [{ x?, z, side, y, lit }],
//     dormers: [{ x, w }], gable: { w } | null, chimneys: [{ x, z, top }], sign: { x, y }, sag, shear, tone }

export const TONES = {
  old: { plaster: '#d9ccb0', paint: '#4a3b2c', stone: '#8a8070' },
  grey: { plaster: '#c9c6bd', paint: '#3d4a52', stone: '#7e7c78' },
  pink: { plaster: '#e2b7b9', paint: '#7d2c4c', stone: '#8c8076' },
  warm: { plaster: '#e3cfa2', paint: '#6e3a1e', stone: '#8e8272' },
  blue: { plaster: '#b9c8d4', paint: '#24466e', stone: '#7c7e80' },
  green: { plaster: '#c8d2b4', paint: '#2f5a3a', stone: '#83806f' },
  orange: { plaster: '#e8c49a', paint: '#a8471c', stone: '#8a7c6a' },
  dark: { plaster: '#8f8a7e', paint: '#2c2620', stone: '#5e5a54' },
  shack: { plaster: '#6e6456', paint: '#3a3128', stone: '#5a544c' },
};

// (a house’s own small numbers, the same every time: its id hashed)
function seeded(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

export function planHouse(site) {
  const rnd = seeded(site.id);
  const { w, d, h } = site;
  const shack = site.tone === 'shack';
  const pub = site.id === 'broomsticks' || site.id === 'hogshead';
  // the floors: the ground floor a little taller on the big shops
  const ground = shack ? 3.0 : h >= 9 ? 3.5 : 3.15;
  const eaves = Math.max(ground + 2.5, h * 0.6);
  const upper = eaves - ground;
  // the roof steep (the north’s snow slides off), the ridge where `h` says
  const span = d + 0.8;
  const ridge = Math.max(eaves + span * 0.42, h);
  const pitch = Math.atan2(ridge - eaves, span / 2);
  const door = { x: 0, w: pub ? 1.7 : 1.1, h: pub ? 2.5 : 2.25, double: pub };
  // the shop’s windows either side of the door: a bay each side on a wide
  // front, one bay and a plain window on a narrow one
  const room = w / 2 - door.w / 2 - 0.9;
  const bays = [];
  const small = [];
  if (!shack) {
    const bw = Math.min(4.2, room - 0.6);
    if (bw > 1.6) {
      bays.push({ x: -(door.w / 2 + 0.75 + bw / 2), w: bw });
      if (w >= 11 || pub) bays.push({ x: door.w / 2 + 0.75 + bw / 2, w: bw });
      else small.push({ x: door.w / 2 + 0.6 + Math.min(1.1, room / 2) });
    }
  }
  // the upper floor’s casements, spread along the front; some lit, some not
  const n = Math.max(2, Math.floor(w / 2.7));
  const casements = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    casements.push({ x, y: ground + Math.min(0.8, upper * 0.3), w: 0.95, h: Math.min(1.35, upper * 0.55), lit: !shack && rnd() > (site.id === 'hogshead' ? 0.75 : 0.3) });
  }
  // a window in each end wall upstairs, and one at the back
  const sides = [
    { side: -1, z: 0, y: ground + upper * 0.35, lit: !shack && rnd() > 0.5 },
    { side: 1, z: 0, y: ground + upper * 0.35, lit: !shack && rnd() > 0.5 },
  ];
  // dormers on a wide roof, a cross gable to the street on the two biggest
  const gable = !shack && w >= 14 ? { w: Math.min(6.5, w * 0.42) } : null;
  const dormers = [];
  if (!shack && w >= 9.5 && !gable) {
    const k = w >= 12 ? 2 : 1;
    for (let i = 0; i < k; i++) dormers.push({ x: k === 1 ? (rnd() - 0.5) * 2 : (i === 0 ? -1 : 1) * w * 0.24, w: 1.5 });
  } else if (gable && w >= 15) for (const s of [-1, 1]) dormers.push({ x: s * w * 0.36, w: 1.4 });
  // the chimneys at the gable ends, up through the roof near the ridge
  const chimneys = [];
  const ends = site.chimney >= 2 ? [-1, 1] : [rnd() > 0.5 ? 1 : -1];
  for (const s of ends.slice(0, Math.max(1, site.chimney))) chimneys.push({ x: s * (w / 2 - 0.75), z: -0.4 - rnd() * 0.6, top: ridge + 1.0 + rnd() * 0.6 });
  // the sign hangs off a bracket beside the door, over the pavement
  const sign = { x: door.w / 2 + 0.9 + (bays.length > 1 ? 0 : 0.2), y: ground + 0.55 };
  return {
    w,
    d,
    ground,
    upper,
    eaves,
    ridge,
    overhang: shack ? 0.15 : 0.42,
    pitch,
    door,
    bays,
    small,
    casements,
    sides,
    dormers,
    gable,
    chimneys,
    sign,
    // (the crookedness: the upper floor leant over, the ridge sagging and tilted)
    shear: site.lean * (rnd() > 0.5 ? 0.3 : -0.3),
    sag: 0.12 + site.lean * 1.6,
    tilt: site.lean * (rnd() > 0.5 ? 0.25 : -0.25),
    tone: TONES[site.tone] ?? TONES.old,
    shack,
    pub,
  };
}
