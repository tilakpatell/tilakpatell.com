// Iacon at war, the Autobots' capital in Fall of Cybertron's last days: the
// great boulevard runs north from the gates (where the Decepticons are
// breaking in) to the plaza of the Hall of Records, with Autobot HQ on its
// east side; two cross streets, towers between them too tall to climb, and
// to the west the pad where the space bridge stands. Metroplex is on the
// skyline to the east, Trypticon far off to the west, Soundwave on a roof.
//
// As data: rules.js reads its solids, people, pickups, exits and missions;
// stage/iacon.js draws it from the same numbers and `stage`.

const rng = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
};

const BOULEVARD = 30; // its half-width
const STREETS = [150, -60]; // the cross streets' middles (z), each 30 m wide
const PLAZA = { x: 0, z: -300, r: 110 };
const PAD = { x: -300, z: -150, r: 60 };
const GATE = { z: 400 };

// Towers: the blocks between the streets, cut into lots with alleys between
// (wide enough for a robot) and a tower on each, taller toward the plaza
function towers() {
  const rand = rng(1013);
  const out = [];
  const bands = [
    [165, 395],
    [-45, 135],
    [-190, -75],
  ];
  for (const side of [-1, 1])
    for (const [z0, z1] of bands) {
      let z = z0 + 6;
      while (z < z1 - 30) {
        const depth = Math.min(z1 - 6 - z, 40 + rand() * 50);
        let x = BOULEVARD + 14;
        while (x < 400) {
          const width = 40 + rand() * 50;
          const cx = side * (x + width / 2);
          const cz = z + depth / 2;
          const clearPad = Math.hypot(cx - PAD.x, cz - PAD.z) > PAD.r + Math.max(width, depth) / 2 + 18;
          const clearPlaza = Math.hypot(cx - PLAZA.x, cz - PLAZA.z) > PLAZA.r + Math.max(width, depth) / 2 + 10;
          // a lane to the pad from the south street
          const lane = Math.abs(cx - PAD.x) < width / 2 + 16 && cz < -45 && cz > PAD.z;
          if (clearPad && clearPlaza && !lane && rand() > 0.08) {
            const nearHall = 1 - Math.min(1, Math.abs(cz - PLAZA.z) / 700);
            out.push({ kind: 'box', x: cx, z: cz, hw: width / 2, hd: depth / 2, top: 80 + rand() * 120 + nearHall * 110, tag: 'tower', style: Math.floor(rand() * 4) });
          }
          x += width + 16 + rand() * 14;
        }
        z += depth + 16 + rand() * 10;
      }
    }
  return out;
}

const solids = [
  ...towers(),
  // the Hall of Records, across the north end of the plaza
  { kind: 'box', x: 0, z: -390, hw: 75, hd: 28, top: 96, tag: 'hall' },
  // Autobot HQ, on the plaza's east side
  { kind: 'box', x: 160, z: -300, hw: 36, hd: 50, top: 128, tag: 'hq' },
  // the gate's two pylons, and the barricades and crates the Autobots hold
  { kind: 'box', x: -48, z: 405, hw: 16, hd: 14, top: 64, tag: 'pylon' },
  { kind: 'box', x: 48, z: 405, hw: 16, hd: 14, top: 64, tag: 'pylon' },
  { kind: 'box', x: -18, z: 330, hw: 10, hd: 1.2, top: 2.6, yaw: 0.08, tag: 'barricade' },
  { kind: 'box', x: 16, z: 334, hw: 9, hd: 1.2, top: 2.6, yaw: -0.12, tag: 'barricade' },
  { kind: 'box', x: -6, z: 290, hw: 7, hd: 1.2, top: 2.6, tag: 'barricade' },
  { kind: 'box', x: 22, z: 270, hw: 2.4, hd: 2.4, top: 4.8, yaw: 0.4, tag: 'crate' },
  { kind: 'box', x: -24, z: 255, hw: 2.4, hd: 2.4, top: 4.8, yaw: -0.3, tag: 'crate' },
  { kind: 'box', x: -20, z: 360, hw: 2.4, hd: 2.4, top: 4.8, yaw: 0.7, tag: 'crate' },
  // the space bridge's pad, a step up from the street
  { kind: 'circle', x: PAD.x, z: PAD.z, r: PAD.r, top: 1, tag: 'pad' },
  // the plaza's statue plinth (Optimus's predecessors), and a fountain of energon
  { kind: 'circle', x: 0, z: -300, r: 9, top: 6, tag: 'plinth' },
];

// the gates for the drive to wake Metroplex, round the city to the east edge
const METRO_GATES = [
  { x: 0, z: -120, r: 14 },
  { x: 0, z: -60, r: 14 },
  { x: 200, z: -60, r: 14 },
  { x: 380, z: -60, r: 14 },
  { x: 380, z: 150, r: 14 },
  { x: 200, z: 150, r: 14 },
];

const wave = (n, z, spread = 70) => Array.from({ length: n }, (_, i) => ({ kind: 'trooper', x: (i - (n - 1) / 2) * (spread / n) * 2, z: z + (i % 2) * 14 }));

export const IACON = {
  id: 'iacon',
  name: 'Iacon',
  era: 'foc',
  player: { robot: 'optimus-wfc', vehicle: 'cybertruck' },
  bounds: { minX: -420, maxX: 420, minZ: -420, maxZ: 420 },
  spawn: { x: 0, z: -200, yaw: 0 },
  spawns: {
    start: { x: 0, z: -200, yaw: 0 },
    bridge: { x: -262, z: -112, yaw: Math.PI * 0.75 },
  },
  solids,
  people: [
    {
      id: 'bumblebee',
      kind: 'bumblebee-wfc',
      name: 'Bumblebee',
      x: 116,
      z: -236,
      yaw: -2.2,
      lines: ['Optimus! The Ark needs every cube of energon we can find before it launches.', "They're scattered all over the city. I'll keep count if you do the driving."],
    },
    {
      id: 'jazz',
      kind: 'jazz',
      name: 'Jazz',
      x: 20,
      z: 70,
      yaw: -1.4,
      lines: ['Iacon looks good on fire, almost. Almost.', "Grimlock's holding the gate his own way. Loudly."],
    },
    {
      id: 'grimlock',
      kind: 'grimlock',
      name: 'Grimlock',
      x: 24,
      z: 300,
      yaw: -1.9,
      lines: ['Me Grimlock hold gate. You help. Then me Grimlock smash more.', 'Decepticons come in threes. Then fours. Then lots.'],
    },
    {
      id: 'jetfire',
      kind: 'jetfire',
      name: 'Jetfire',
      x: -250,
      z: -96,
      yaw: 2.4,
      lines: ['Metroplex is asleep out east. His beacons are dark, every one of them.', 'Drive the beacons in order and he will hear you. Faster is better.'],
    },
    {
      id: 'magnus',
      kind: 'ultra-magnus-foc',
      name: 'Ultra Magnus',
      x: 112,
      z: -214,
      yaw: -0.9,
      lines: ['Iacon stands as long as its walls do. Hold the gate and I will hold the city.', 'Orders are orders, Optimus. Even yours.'],
    },
    {
      id: 'zeta',
      kind: 'zeta-prime',
      name: 'Zeta Prime',
      x: -36,
      z: -318,
      yaw: 0.6,
      lines: ['The Hall remembers every Prime. It will remember what you do here.', 'When the gates and the city are ours again, Megatron will come for the bridge himself.'],
    },
  ],
  // Soundwave on a roof, watching; nothing to say
  watchers: [{ kind: 'soundwave-foc', x: 0, y: 0, z: 0, tower: 'nearGate' }],
  pickups: [
    [0, 220],
    [-20, 120],
    [24, 10],
    [-150, -60],
    [-330, -60],
    [150, -60],
    [330, 150],
    [-220, 150],
    [80, 150],
    [-60, -260],
    [60, -350],
    [-300, -150],
  ]
    .map(([x, z], i) => ({ id: `iacon-energon-${i}`, kind: 'energon', x, y: x === -300 ? 1 : 0, z }))
    // the Matrix of Leadership, on the Hall's steps while its mission's on
    .concat([{ id: 'iacon-matrix', kind: 'matrix', x: 0, y: 0, z: -336, mission: 'matrix' }]),
  exits: [{ id: 'space-bridge', x: PAD.x, z: PAD.z, r: 10, to: 'base', at: 'bridge', label: 'Space bridge to Earth' }],
  missions: [
    {
      id: 'hold-gates',
      title: 'Hold the gates',
      giver: 'grimlock',
      achievement: 'cyHoldGates',
      steps: [
        { type: 'talk', target: 'grimlock', text: 'Talk to Grimlock at the gate' },
        { type: 'reach', at: { x: 0, z: 300, r: 45 }, text: 'Get to the barricades' },
        { type: 'clear', count: 4, spawn: wave(4, 395), text: 'Hold the gate: the first wave' },
        { type: 'clear', count: 4, spawn: wave(4, 400, 90), text: 'Hold the gate: the second wave' },
        { type: 'clear', count: 5, spawn: [...wave(4, 400, 110), { kind: 'barricade', x: 0, z: 425 }], text: 'Hold the gate: the last wave, and Barricade' },
        { type: 'talk', target: 'grimlock', text: 'Tell Grimlock the gate is held' },
      ],
    },
    {
      id: 'energon-run',
      title: 'Energon run',
      giver: 'bumblebee',
      achievement: 'cyEnergonRun',
      steps: [
        { type: 'talk', target: 'bumblebee', text: 'Talk to Bumblebee by HQ' },
        { type: 'collect', kind: 'energon', count: 8, within: 150, reset: 'energon', text: 'Collect 8 energon cubes before the Ark launches' },
        { type: 'talk', target: 'bumblebee', text: 'Bring the energon to Bumblebee' },
      ],
    },
    {
      id: 'wake-metroplex',
      title: 'Wake Metroplex',
      giver: 'jetfire',
      achievement: 'cyMetroplex',
      steps: [
        { type: 'talk', target: 'jetfire', text: 'Talk to Jetfire at the pad' },
        { type: 'transform', to: 'vehicle', text: 'Transform (Q)' },
        { type: 'drive', gates: METRO_GATES, within: 70, text: "Drive through Metroplex's beacons in order" },
        { type: 'talk', target: 'jetfire', text: 'Metroplex is awake: back to Jetfire' },
      ],
    },
    {
      id: 'defend-pad',
      title: 'Defend the bridge',
      giver: 'zeta',
      requires: ['hold-gates', 'energon-run', 'wake-metroplex'],
      achievement: 'cyMegatron',
      steps: [
        { type: 'talk', target: 'zeta', text: 'Talk to Zeta Prime in the plaza' },
        { type: 'reach', at: { x: PAD.x, z: PAD.z, r: 55 }, text: 'Get to the space bridge' },
        { type: 'clear', count: 6, spawn: wave(6, -60, 60).map((e) => ({ ...e, x: e.x - 300 })), text: 'Clear the troopers off the pad' },
        { type: 'defeat', target: 'megatron', spawn: [{ kind: 'megatron', id: 'megatron', x: -300, z: -40 }], text: 'Drive off Megatron' },
        { type: 'talk', target: 'zeta', text: 'Tell Zeta Prime the bridge is safe' },
      ],
    },
    {
      id: 'matrix',
      title: 'The Matrix of Leadership',
      giver: 'zeta',
      requires: ['defend-pad'],
      achievement: 'cyMatrix',
      say: 'Megatron is gone, but Shockwave slipped into the Hall while we fought. He is after the Matrix of Leadership. Optimus, it must not leave Iacon.',
      steps: [
        { type: 'talk', target: 'zeta', text: 'Talk to Zeta Prime' },
        { type: 'reach', at: { x: 0, z: -330, r: 34 }, text: 'Get to the Hall of Records' },
        { type: 'defeat', target: 'shockwave', spawn: [{ kind: 'shockwave', id: 'shockwave', x: 30, z: -340 }], text: 'Stop Shockwave' },
        { type: 'collect', kind: 'matrix', count: 1, text: 'Take up the Matrix' },
        { type: 'talk', target: 'zeta', text: 'Bring the Matrix to Zeta Prime' },
      ],
    },
  ],
  look: {
    sky: 'iacon',
    fog: ['#0b1220', 120, 1100],
    sun: { dir: [-0.4, 0.55, -0.6], color: '#9fb8ff', intensity: 1.4 },
    ambient: ['#2a3550', 0.55],
    env: 1.0, // (its sky as light: the fires low on the horizon in every wall)
    exposure: 1.05,
    bloom: 0.9,
  },
  stage: {
    plaza: PLAZA,
    pad: PAD,
    gate: GATE,
    boulevard: BOULEVARD,
    streets: STREETS,
    metroplex: { x: 1150, z: -150, yaw: -Math.PI / 2 },
    trypticon: { x: -1300, z: 700, yaw: 2.2 },
    beacons: METRO_GATES,
    fires: [
      [-40, 418],
      [30, 380],
      [-180, 300],
      [210, 260],
      [-320, 80],
      [300, -10],
      [-120, -190],
      [260, -230],
    ],
    parked: [
      { kind: 'wheeljack-car', x: 70, z: -210, yaw: 2.6 },
      { kind: 'bumblebee-car-wfc', x: 132, z: -252, yaw: 0.5 },
    ],
    // the megastructures beyond the city, as the planet shows them from
    // orbit: rings stepping up round a spire, lit at their rims, some
    // burning (where they are, how wide, how many rings)
    skyline: [
      { x: -820, z: -620, r: 300, tiers: 5, war: 0.7 },
      { x: 760, z: 820, r: 260, tiers: 4, war: 0.4 },
      { x: -900, z: 260, r: 180, tiers: 4, war: 0 },
      { x: 240, z: -1050, r: 340, tiers: 6, war: 1 },
      { x: 980, z: -760, r: 150, tiers: 3, war: 0.2 },
    ],
  },
};
