// What the expanse is made of, as data: the stars, the planets, who holds
// a system (by how far out from home it is), what's dangerous there and the
// wonders between the systems. sector.js draws from these by weight. Pure.
//
// STAR_CLASSES: [{ class, color: '#rrggbb', size: [least, most] map units, weight }]
// PLANET_TYPES: [{ type, radius: [least, most], colors: ['#rrggbb'…], moons: [least, most], rings: chance, weight }]
// FACTIONS: [{ upTo: Chebyshev distance in sectors, list: [{ id, name, weight }] }];
//   factionBand(d) → that band's list. The id 'generated' stands for a
//   faction sector.js names there and then.
// HAZARDS: [null, 'storm', 'pirates', 'minefield']; hazardWeights(d) → [[hazard, weight]…]
// WONDERS: [{ kind, size: [least, most] (its radius), weight }]; WONDER_KINDS: their kinds
// STATION_NAMES: what a station is called after its system's name

export const STAR_CLASSES = [
  { class: "O", color: "#9bb0ff", size: [320, 420], weight: 0.4 },
  { class: "B", color: "#aabfff", size: [260, 360], weight: 1 },
  { class: "A", color: "#cad7ff", size: [200, 300], weight: 2 },
  { class: "F", color: "#f8f7ff", size: [160, 240], weight: 3 },
  { class: "G", color: "#fff4ea", size: [130, 200], weight: 4 },
  { class: "K", color: "#ffd2a1", size: [100, 170], weight: 5 },
  { class: "M", color: "#ffb56c", size: [80, 140], weight: 7 },
  { class: "white dwarf", color: "#e8f0ff", size: [60, 90], weight: 0.8 },
  { class: "neutron", color: "#b8f4ff", size: [60, 80], weight: 0.3 },
];

export const PLANET_TYPES = [
  {
    type: "rock",
    radius: [18, 50],
    colors: ["#8a7f73", "#6f6a64", "#a39383", "#5c544c"],
    moons: [0, 2],
    rings: 0.03,
    weight: 5,
  },
  {
    type: "ice",
    radius: [20, 60],
    colors: ["#d8ecf5", "#b9d9ea", "#eaf6fb", "#9cc4d9"],
    moons: [0, 2],
    rings: 0.08,
    weight: 3,
  },
  {
    type: "gas",
    radius: [80, 140],
    colors: ["#d9b38c", "#c99c6e", "#a7c4d9", "#e0c9a6", "#b5a0d0"],
    moons: [1, 6],
    rings: 0.3,
    weight: 3,
  },
  {
    type: "lava",
    radius: [18, 45],
    colors: ["#5a1d0f", "#7a2a12", "#3d140b"],
    moons: [0, 1],
    rings: 0,
    weight: 1.5,
  },
  {
    type: "ocean",
    radius: [30, 70],
    colors: ["#1f5f8b", "#2a7bb0", "#174a6e"],
    moons: [0, 3],
    rings: 0.05,
    weight: 1.5,
  },
  {
    type: "desert",
    radius: [24, 60],
    colors: ["#d4a96a", "#c28f4f", "#e3c08a"],
    moons: [0, 2],
    rings: 0.05,
    weight: 2,
  },
  {
    type: "forest",
    radius: [28, 65],
    colors: ["#3f7a3a", "#2f6a3f", "#5a8a3c"],
    moons: [0, 2],
    rings: 0.03,
    weight: 1,
  },
  {
    type: "ringed",
    radius: [70, 130],
    colors: ["#e6d3a3", "#c8b48a", "#d1c2e0"],
    moons: [1, 5],
    rings: 1,
    weight: 1,
  },
];

// Near home the authored sides' factions hold the space (sides.js's ids);
// further out more of it's nobody's, or a faction of its own
export const FACTIONS = [
  {
    upTo: 1,
    list: [
      { id: "empire", name: "The Galactic Empire", weight: 3 },
      { id: "federation", name: "The Galactic Federation", weight: 3 },
      { id: "dea", name: "The DEA", weight: 1 },
      { id: "independent", name: "Independent", weight: 1 },
    ],
  },
  {
    upTo: 4,
    list: [
      { id: "empire", name: "The Galactic Empire", weight: 1.5 },
      { id: "federation", name: "The Galactic Federation", weight: 1.5 },
      { id: "independent", name: "Independent", weight: 3 },
      { id: "generated", name: "", weight: 3 },
    ],
  },
  {
    upTo: Infinity,
    list: [
      { id: "independent", name: "Independent", weight: 4 },
      { id: "generated", name: "", weight: 5 },
    ],
  },
];
export const factionBand = (d) => FACTIONS.find((b) => d <= b.upTo).list;
// what a generated faction calls itself after its name
export const FACTION_KINDS = [
  "Compact",
  "League",
  "Hegemony",
  "Concord",
  "Syndicate",
  "Collective",
  "Dominion",
  "Accord",
  "Free Worlds",
  "Combine",
];

export const HAZARDS = [null, "storm", "pirates", "minefield"];
export const hazardWeights = (d) => [
  [null, 10],
  ["storm", 0.5 + 0.4 * d],
  ["pirates", 0.3 + 0.5 * d],
  ["minefield", 0.1 + 0.25 * d],
];

export const WONDERS = [
  { kind: "nebula", size: [1200, 2800], weight: 3 },
  { kind: "pulsar", size: [200, 500], weight: 1 },
  { kind: "derelict", size: [300, 900], weight: 2 },
  { kind: "rogue", size: [100, 260], weight: 2 },
];
export const WONDER_KINDS = WONDERS.map((w) => w.kind);

export const STATION_NAMES = [
  "Station",
  "Dock",
  "Exchange",
  "Port",
  "Yards",
  "Waystation",
];
