// Kaon, the Decepticons' capital, the way Fall of Cybertron has it: dark
// plating lit red and violet, Megatron's fortress across the north end of
// the great avenue with its spire over everything, the pits (Kaon's arena,
// where Megatron fought before the war) in the middle of the city, and the
// dark-energon refinery to the east. Megatron's campaign is played here:
// Soundwave, Shockwave, Barricade and Starscream give the orders;
// the Autobots' raiders (Ironhide, Warpath, Ratchet, Bumblebee, Jazz) and, at the last,
// Zeta Prime himself are the enemy.
//
// As data, the way areas/iacon.js is: rules.js reads its solids, people,
// pickups and missions; stage/kaon.js draws it from the same numbers.

const rng = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
};

const AVENUE = 30; // the avenue's half-width, north to south
const CROSS = [-150, 250]; // the cross streets' middles (z)
const FORTRESS = { x: 0, z: -340, hw: 80, hd: 36, top: 170 };
const ARENA = { x: 0, z: 50, r: 80, seats: 112 };
const REFINERY = { x: 260, z: 150, r: 70 };

// the arena: a ring of wall in sixteen pieces round the pit floor, a gate at
// each quarter, and the seats stepping up behind (solid: you can't climb in)
function arena() {
  const out = [];
  const n = 16;
  for (let k = 0; k < n; k++) {
    if (k % 4 === 0) continue; // a gate
    const a = (k / n) * Math.PI * 2;
    const yaw = -(a + Math.PI / 2); // (along the ring)
    const half = ARENA.r * Math.sin(Math.PI / n) * 1.04;
    out.push({ kind: 'box', x: ARENA.x + Math.cos(a) * ARENA.r, z: ARENA.z + Math.sin(a) * ARENA.r, hw: half, hd: 2.5, top: 12, yaw, tag: 'arena-wall' });
    const rs = (ARENA.r + ARENA.seats) / 2 + 2;
    out.push({ kind: 'box', x: ARENA.x + Math.cos(a) * rs, z: ARENA.z + Math.sin(a) * rs, hw: rs * Math.sin(Math.PI / n) * 1.04, hd: (ARENA.seats - ARENA.r) / 2 - 2, top: 30, yaw, tag: 'arena-seats' });
  }
  return out;
}

// towers on every block the avenue, the cross streets, the arena, the
// fortress and the refinery leave, taller toward the fortress
function towers() {
  const rand = rng(4242);
  const out = [];
  const clear = (x, z, w, d) => {
    const r = Math.max(w, d) / 2;
    if (Math.abs(x) < AVENUE + w / 2 + 12) return false;
    if (CROSS.some((c) => Math.abs(z - c) < 15 + d / 2 + 8)) return false;
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.seats + r + 14) return false;
    if (Math.abs(x - FORTRESS.x) < FORTRESS.hw + w / 2 + 20 && z - d / 2 < FORTRESS.z + FORTRESS.hd + 30) return false;
    if (Math.hypot(x - REFINERY.x, z - REFINERY.z) < REFINERY.r + r + 10) return false;
    return true;
  };
  for (let z = -385; z < 385; ) {
    const depth = 36 + rand() * 40;
    for (let x = -390; x < 390; ) {
      const width = 36 + rand() * 44;
      const cx = x + width / 2;
      const cz = z + depth / 2;
      if (clear(cx, cz, width, depth) && rand() > 0.12) {
        const nearFortress = 1 - Math.min(1, Math.abs(cz - FORTRESS.z) / 700);
        out.push({ kind: 'box', x: +cx.toFixed(1), z: +cz.toFixed(1), hw: +(width / 2).toFixed(1), hd: +(depth / 2).toFixed(1), top: Math.round(70 + rand() * 110 + nearFortress * 120), tag: 'tower' });
      }
      x += width + 16 + rand() * 12;
    }
    z += depth + 16 + rand() * 10;
  }
  return out;
}

const solids = [
  ...towers(),
  ...arena(),
  // Megatron's fortress, across the north end of the avenue
  { kind: 'box', x: FORTRESS.x, z: FORTRESS.z, hw: FORTRESS.hw, hd: FORTRESS.hd, top: FORTRESS.top, tag: 'fortress' },
  // the refinery's dark-energon vats
  ...[0, 1, 2, 3, 4, 5].map((k) => {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    return { kind: 'circle', x: +(REFINERY.x + Math.cos(a) * 34).toFixed(1), z: +(REFINERY.z + Math.sin(a) * 34).toFixed(1), r: 9, top: 22, tag: 'vat' };
  }),
  // a column in the arena's middle, for cover
  { kind: 'circle', x: ARENA.x, z: ARENA.z, r: 5, top: 9, tag: 'arena-column' },
];

// the checkpoints for the tank's run: down the avenue, along the north cross
// street to the refinery, and back by the south one
const RUN_GATES = [
  { x: 0, z: -110, r: 14 },
  { x: 0, z: 200, r: 14 },
  { x: 200, z: 250, r: 14 },
  { x: 360, z: 250, r: 14 },
  { x: 360, z: -150, r: 14 },
  { x: 120, z: -150, r: 14 },
];

// Autobots round the pit floor, or wherever a step puts them
const ring = (n, r, at = ARENA, kind = 'autobot') => Array.from({ length: n }, (_, i) => ({ kind, x: +(at.x + Math.cos((i / n) * Math.PI * 2 + 0.4) * r).toFixed(1), z: +(at.z + Math.sin((i / n) * Math.PI * 2 + 0.4) * r).toFixed(1) }));

export const KAON = {
  id: 'kaon',
  name: 'Kaon',
  era: 'foc',
  side: 'decepticon',
  player: { robot: 'megatron-foc', vehicle: null }, // (his tank is his own model, on its own clip)
  bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
  spawn: { x: 0, z: -230, yaw: 0 },
  spawns: { start: { x: 0, z: -230, yaw: 0 } },
  solids,
  // who plays the enemy here: the Autobots
  foes: { autobot: ['ironhide-foc', 'warpath-foc', 'ratchet-foc', 'bumblebee-wfc', 'jazz'], zeta: ['zeta-prime'], trooper: ['ironhide-foc', 'ratchet-foc', 'jazz'] },
  people: [
    {
      id: 'soundwave',
      kind: 'soundwave-foc',
      name: 'Soundwave',
      x: 22,
      z: -262,
      yaw: -0.4,
      lines: ['Soundwave superior. The Autobots have been brought to the pits. Show Kaon who leads it.', 'Iacon listens. Iacon fears.'],
    },
    {
      id: 'shockwave',
      kind: 'shockwave-foc',
      name: 'Shockwave',
      x: -24,
      z: -268,
      yaw: 0.4,
      lines: ['The war machine runs on dark energon, and the refinery is slow. Bring me what has spilled in the streets. Logic dictates haste.', 'Every cube is a weapon not yet made.'],
    },
    {
      id: 'barricade',
      kind: 'barricade',
      name: 'Barricade',
      x: 22,
      z: -128,
      yaw: -0.6,
      lines: ['Autobot runners got into the refinery district. Get in your tank and run them down, Lord Megatron.', 'Fast is the only way to catch an Autobot.'],
    },
    {
      id: 'starscream',
      kind: 'starscream-foc',
      name: 'Starscream',
      x: -20,
      z: -150,
      yaw: 0.5,
      lines: ['Zeta Prime has come to Kaon himself, Lord Megatron. He means to take the fortress. I would, of course, hold the skies.', 'The seekers are yours to command. For now.'],
    },
  ],
  exits: [],
  pickups: [
    [0, -60],
    [-40, 250],
    [60, 250],
    [-200, 250],
    [200, -150],
    [-120, -150],
    [-300, -150],
    [0, 300],
    [300, 330],
    [-330, 60],
    [150, 60],
    [-150, 60],
  ].map(([x, z], i) => ({ id: `kaon-energon-${i}`, kind: 'energon', x, y: 0, z })),
  missions: [
    {
      id: 'kaon-pits',
      title: 'The pits of Kaon',
      giver: 'soundwave',
      achievement: 'cyKaonPits',
      steps: [
        { type: 'talk', target: 'soundwave', text: 'Talk to Soundwave at the fortress' },
        { type: 'reach', at: { x: ARENA.x, z: ARENA.z - 30, r: 40 }, text: 'Go down into the pits' },
        { type: 'clear', count: 4, spawn: ring(4, 55), text: 'The first Autobots into the pit' },
        { type: 'clear', count: 5, spawn: ring(5, 60), text: 'The second' },
        { type: 'clear', count: 6, spawn: ring(6, 62), text: 'The last of them' },
        { type: 'talk', target: 'soundwave', text: 'Back to Soundwave' },
      ],
    },
    {
      id: 'kaon-dark',
      title: 'Fuel the war machine',
      giver: 'shockwave',
      achievement: 'cyDarkEnergon',
      steps: [
        { type: 'talk', target: 'shockwave', text: 'Talk to Shockwave at the fortress' },
        { type: 'collect', kind: 'energon', count: 8, within: 150, reset: 'energon', text: 'Gather 8 dark energon before it burns away' },
        { type: 'talk', target: 'shockwave', text: 'Bring the dark energon to Shockwave' },
      ],
    },
    {
      id: 'kaon-run',
      title: 'Run them down',
      giver: 'barricade',
      achievement: 'cyRunThemDown',
      steps: [
        { type: 'talk', target: 'barricade', text: 'Talk to Barricade on the avenue' },
        { type: 'transform', to: 'vehicle', text: 'Transform into your tank (Q)' },
        { type: 'drive', gates: RUN_GATES, within: 80, text: 'Run the checkpoints after the Autobots' },
        { type: 'clear', count: 4, spawn: ring(4, 50, REFINERY), text: 'Catch the runners at the refinery' },
        { type: 'talk', target: 'barricade', text: 'Back to Barricade' },
      ],
    },
    {
      id: 'kaon-zeta',
      title: "Zeta Prime's last stand",
      giver: 'starscream',
      requires: ['kaon-pits', 'kaon-dark', 'kaon-run'],
      achievement: 'cyZeta',
      say: 'Zeta Prime has come to Kaon himself, Lord Megatron. He means to take the fortress. I would, of course, hold the skies.',
      steps: [
        { type: 'talk', target: 'starscream', text: 'Talk to Starscream on the avenue' },
        { type: 'reach', at: { x: 0, z: -40, r: 40 }, text: 'Meet the Autobots on the avenue' },
        { type: 'clear', count: 6, spawn: ring(6, 40, { x: 0, z: 40 }), text: "Break Zeta Prime's guard" },
        { type: 'defeat', target: 'zeta', spawn: [{ kind: 'zeta', id: 'zeta', x: 0, z: 70 }], text: 'Defeat Zeta Prime' },
        { type: 'talk', target: 'starscream', text: 'Kaon is yours: back to Starscream' },
      ],
    },
  ],
  look: {
    sky: 'kaon',
    fog: ['#14080e', 120, 1100],
    sun: { dir: [-0.4, 0.55, -0.6], color: '#ffb0a0', intensity: 1.2 },
    ambient: ['#3a2030', 0.5],
    env: 1.0,
    exposure: 1.05,
    bloom: 1,
    energon: '#b06bff', // (Kaon's is dark energon)
  },
  stage: {
    avenue: AVENUE,
    cross: CROSS,
    fortress: FORTRESS,
    arena: ARENA,
    refinery: REFINERY,
    beacons: RUN_GATES,
    trypticon: { x: -1150, z: -500, yaw: 0.8 },
    flyovers: ['skywarp-jet', 'thundercracker-jet'], // (the seekers, circling)
    skyline: [
      { x: -820, z: 640, r: 300, tiers: 5, war: 0.8 },
      { x: 760, z: -820, r: 260, tiers: 4, war: 0.6 },
      { x: 950, z: 300, r: 200, tiers: 4, war: 0.9 },
      { x: -300, z: -1050, r: 340, tiers: 6, war: 1 },
    ],
    fires: [
      [-60, 380],
      [120, -40],
      [-200, 120],
      [240, 300],
      [-320, -200],
      [330, -60],
    ],
  },
};
