// The charted worlds' planets (./index.js), as bodies.js draws them: one
// look each, in the families and slots bodies.js's FAMILIES has (and its
// gas giants for the two worlds that are moons). Pure data, kept here once
// and spread into both LOOKS: bodies.js's and nodes/bodies.js's, which copy
// rather than import each other, and would otherwise carry these twice.
// Each is drawn from what the films and the shows show of the world, or
// what the atlas says of one they only name.

// atmo: { color, top (shell radius, in radii), falloff, density, glow (toward the sun), sunset }
// clouds: { cover 0..1, sharp, drift (radians a second), scale, color }
const air = (color, density = 2, top = 1.06, sunset = '#ffa070', falloff = 3.5, glow = 0.8) => ({ color, top, falloff, density, glow, sunset });
const sky = (cover, color = '#ffffff', sharp = 1.6, scale = 3, drift = 0.004) => ({ cover, sharp, drift, scale, color });

export const CHARTED_LOOKS = {
  // ── The Republic's last days ──
  // Utapau: dry plains pocked with the sinkholes its cities hang in
  utapau: {
    name: 'Utapau', swatch: '#b8a074', family: 'desert', bump: 0.026, flags: ['CRATERS'], detail: ['gravel', 'rock'],
    pal: { sand: '#bca47a', sand2: '#9c8460', rock: '#7a6448', dark: '#2e241a', salt: '#d8ccb0', crest: '#ccb88e' },
    p: { dunes: 0.2, rock: 0.25, craters: 1, salt: 0.2, scars: 0, duneFreq: 26, canyons: 0.5, mesas: 0.6 },
    clouds: sky(0.12, '#e8dcc8', 1.4, 3.4, 0.005),
    atmo: air('#d8c4a0', 1.6, 1.05, '#ffa868', 3.8),
  },
  // Mygeeto: ice and the crystal of the banking clan's cities
  mygeeto: {
    name: 'Mygeeto', swatch: '#cfe2f2', family: 'ice', bump: 0.024,
    pal: { snow: '#e4eef8', ice: '#9cc4ea', rock: '#4c5a6e', deep: '#3a6a9e' },
    p: { ice: 0.75, mountains: 0.7, crevasses: 1 },
    clouds: sky(0.4, '#f4f8ff', 1.5, 4.2, 0.006),
    atmo: air('#a8d0ff', 2.3, 1.065, '#c0a8ff'),
  },
  // Saleucami: an arid world of comet craters, swamp and scrub
  saleucami: {
    name: 'Saleucami', swatch: '#8a8a54', family: 'lush', bump: 0.022, flags: ['SWAMP'], detail: ['gravel', 'rock'],
    pal: { deep: '#1c3640', shallow: '#3a6458', forest: '#4a5a30', grass: '#a49a5c', rock: '#7a6248', snow: '#ece8dc', beach: '#bca878', murk: '#3a4028' },
    p: { sea: -0.34, forest: 0.25, mountains: 0.55, caps: 0.03, islands: 0, swamp: 0.55, rivers: 0, scale: 2.3 },
    clouds: sky(0.22, '#f0ece0', 1.5, 3.8),
    atmo: air('#c8c098', 1.9, 1.06, '#ff9a60'),
  },
  // Cato Neimoidia: forest and mist round the stone arches its cities hang from
  catoneimoidia: {
    name: 'Cato Neimoidia', swatch: '#5a7a5e', family: 'lush', bump: 0.024, flags: ['RIVERS'], detail: ['leaves', 'rock'],
    pal: { deep: '#123446', shallow: '#2a5e6a', forest: '#2e5236', grass: '#5e7a50', rock: '#7a6e64', snow: '#e8ecee', beach: '#8a8270', murk: '#2a3a32' },
    p: { sea: -0.05, forest: 0.85, mountains: 1, caps: 0.04, islands: 0, swamp: 0, rivers: 0.7, scale: 2.5 },
    clouds: sky(0.48, '#e4e8ec', 1.1, 3.2, 0.004),
    atmo: air('#a0b8c8', 2.6, 1.07, '#e0a888'),
  },
  // Polis Massa: a planetoid, a shard of a world that broke apart
  polismassa: {
    name: 'Polis Massa', swatch: '#9a8e80', family: 'moon', bump: 0.034, detail: ['gravel', 'rock'],
    pal: { base: '#9c9284', dark: '#5e564c', bright: '#c8beb0', crack: '#3a342e' },
    p: { craters: 1, maria: 0.2, cracks: 0.5 },
  },
  // Malastare: dark forest and grey rock, the Dugs' podrace country
  malastare: {
    name: 'Malastare', swatch: '#5e6e4a', family: 'lush', bump: 0.022, detail: ['gravel', 'rock'],
    pal: { deep: '#1a3040', shallow: '#3a5a5a', forest: '#2e4228', grass: '#6a7444', rock: '#6e665c', snow: '#e8e8e4', beach: '#8a7e62', murk: '#2c3428' },
    p: { sea: -0.18, forest: 0.8, mountains: 0.75, caps: 0.06, islands: 0, swamp: 0, rivers: 0.2, scale: 2.2 },
    clouds: sky(0.3, '#eceee8', 1.6, 4.2),
    atmo: air('#9cb8b0', 2.2, 1.065),
  },
  // ── The Empire's years ──
  // Jedha: a cold desert moon of pale sand and mesas
  jedha: {
    name: 'Jedha', swatch: '#c8b49a', family: 'desert', bump: 0.024, flags: ['CRATERS'], detail: ['sand', 'rock'],
    pal: { sand: '#cbb89e', sand2: '#a8947c', rock: '#7e6c5c', dark: '#3a3028', salt: '#e8e2d8', crest: '#dacab2' },
    p: { dunes: 0.6, rock: 0.15, craters: 0.25, salt: 0.5, scars: 0, duneFreq: 36, canyons: 0.7, mesas: 1 },
    atmo: air('#d4d0c8', 1.4, 1.045, '#ffb890', 4),
  },
  // NaJedha: the gas giant Jedha circles, cold blue-grey
  najedha: {
    name: 'NaJedha', swatch: '#8a9cae', family: 'gas', bump: 0.002,
    pal: { band1: '#7e90a4', band2: '#a2b2c2', band3: '#6a7a8e', band4: '#c0ccd6', band5: '#5a6a7e', storm: '#dce4ea' },
    p: { bands: 8, turb: 0.5, flow: 0.003, fine: 1, stormSize: 0.04, stormLat: 0.25, stormLon: 1.4 },
    atmo: air('#a8bccc', 2.2, 1.03),
  },
  // Eadu: black rock and rain, a storm that never moves off
  eadu: {
    name: 'Eadu', swatch: '#4e5660', family: 'lush', bump: 0.026, flags: ['STORMS'], detail: ['gravel', 'rock'],
    pal: { deep: '#141e28', shallow: '#26323e', forest: '#2a3430', grass: '#46504a', rock: '#3e4248', snow: '#c8d0d8', beach: '#4a4e52', murk: '#22282a' },
    p: { sea: -0.2, forest: 0.2, mountains: 1.1, caps: 0, islands: 0, swamp: 0, rivers: 0.3, scale: 2.4 },
    clouds: sky(0.68, '#7c8690', 0.9, 2.6, 0.007),
    atmo: air('#7e8a98', 2.8, 1.07, '#b08a70'),
  },
  // Lah'mu: green plateaus over black sand and grey sea
  lahmu: {
    name: 'Lah’mu', swatch: '#5a7458', family: 'lush', bump: 0.022, flags: ['ISLANDS'], detail: ['gravel', 'rock'],
    pal: { deep: '#14283a', shallow: '#3a5a64', forest: '#3a5a3a', grass: '#7a9064', rock: '#3a3836', snow: '#e4e8e8', beach: '#2a2826', murk: '#2a3430' },
    p: { sea: 0.18, forest: 0.3, mountains: 0.6, caps: 0.04, islands: 0.45, swamp: 0, rivers: 0, scale: 2.2 },
    clouds: sky(0.42, '#f0f2f2', 1.4, 4),
    atmo: air('#9cb8c8', 2.3, 1.065),
  },
  // Wobani: mud plains and low hills under a grey sky
  wobani: {
    name: 'Wobani', swatch: '#7a6e5e', family: 'desert', bump: 0.02, detail: ['gravel', 'rock'],
    pal: { sand: '#7c705e', sand2: '#625846', rock: '#4e463a', dark: '#2a241c', salt: '#9e9686', crest: '#8a7e6a' },
    p: { dunes: 0.15, rock: 0.2, craters: 0, salt: 0.35, scars: 0, duneFreq: 22, canyons: 0.3, mesas: 0.2 },
    clouds: sky(0.5, '#a8a49c', 1, 3, 0.004),
    atmo: air('#a09a8e', 2.2, 1.06, '#c09070'),
  },
  // The Ring of Kafrene: the asteroid the colony is built across, rust and dust
  kafrene: {
    name: 'The Ring of Kafrene', swatch: '#8e6a52', family: 'moon', bump: 0.036, detail: ['redsoil', 'rock'],
    pal: { base: '#8a6a54', dark: '#4e3a2e', bright: '#b8957a', crack: '#2e221a' },
    p: { craters: 0.9, maria: 0.3, cracks: 0.6 },
  },
  // Dantooine: rolling grassland, a few forests and lakes
  dantooine: {
    name: 'Dantooine', swatch: '#8aa45a', family: 'lush', bump: 0.018, flags: ['RIVERS'], detail: ['gravel', 'rock'],
    pal: { deep: '#18405a', shallow: '#3a7484', forest: '#3e6a34', grass: '#9aac5e', rock: '#7a7262', snow: '#f0f2ee', beach: '#b4aa7e', murk: '#34442c' },
    p: { sea: -0.28, forest: 0.25, mountains: 0.35, caps: 0.05, islands: 0, swamp: 0, rivers: 0.45, scale: 2 },
    clouds: sky(0.3, '#ffffff', 1.7, 4.6),
    atmo: air('#90bce8', 2.2, 1.065),
  },
  // Ord Mantell: mountains and mesas, and islands in a wide sea
  ordmantell: {
    name: 'Ord Mantell', swatch: '#4e7a8a', family: 'lush', bump: 0.022, flags: ['ISLANDS'], detail: ['gravel', 'rock'],
    pal: { deep: '#0e2e52', shallow: '#2a6e8e', forest: '#3a5e3a', grass: '#7a8a54', rock: '#8a7660', snow: '#eef0f2', beach: '#c4b490', murk: '#2a3a32' },
    p: { sea: 0.22, forest: 0.4, mountains: 0.9, caps: 0.05, islands: 0.7, swamp: 0, rivers: 0, scale: 2.1 },
    clouds: sky(0.3, '#ffffff', 1.8, 4.6),
    atmo: air('#86b4ec', 2.3, 1.065),
  },
  // ── After the Empire ──
  // Corellia: forest and sea round the shipyards' sprawl
  corellia: {
    name: 'Corellia', swatch: '#4e7a6a', family: 'lush', bump: 0.02, flags: ['RIVERS'], detail: ['gravel', 'rock'],
    pal: { deep: '#0e3050', shallow: '#2a6a84', forest: '#2e5a38', grass: '#6a8a52', rock: '#76706a', snow: '#f0f2f4', beach: '#a8a086', murk: '#2e3a34' },
    p: { sea: 0.12, forest: 0.6, mountains: 0.5, caps: 0.08, islands: 0, swamp: 0, rivers: 0.5, scale: 2.1 },
    clouds: sky(0.34, '#eef0f2', 1.5, 4.2),
    atmo: air('#90b0d8', 2.4, 1.065, '#ff9a70'),
  },
  // Tython: green and gold grassland, mountains, the Jedi's first home
  tython: {
    name: 'Tython', swatch: '#8aa060', family: 'lush', bump: 0.022, flags: ['RIVERS'], detail: ['gravel', 'rock'],
    pal: { deep: '#163e5c', shallow: '#3a7a8a', forest: '#46703a', grass: '#a8b46a', rock: '#827a6a', snow: '#f2f4f2', beach: '#c0b488', murk: '#3a4a30' },
    p: { sea: -0.3, forest: 0.3, mountains: 0.85, caps: 0.06, islands: 0, swamp: 0, rivers: 0.35, scale: 2.2 },
    clouds: sky(0.26, '#ffffff', 1.8, 4.6),
    atmo: air('#94c0f0', 2.1, 1.065),
  },
  // Arvala-7: hardened mud and dust, a cracked desert
  arvala: {
    name: 'Arvala-7', swatch: '#a8805a', family: 'desert', bump: 0.024, flags: ['CRATERS'], detail: ['redsoil', 'rock'],
    pal: { sand: '#a8845e', sand2: '#8a6a4a', rock: '#6e5238', dark: '#3a2a1c', salt: '#cdb89a', crest: '#bc9a72' },
    p: { dunes: 0.3, rock: 0.3, craters: 0.35, salt: 0.7, scars: 0, duneFreq: 30, canyons: 0.8, mesas: 0.7 },
    atmo: air('#e0bc98', 1.4, 1.045, '#ff9858', 4),
  },
  // Trask: a sea moon, estuaries and trawler ports
  trask: {
    name: 'Trask', swatch: '#3e6a7e', family: 'lush', bump: 0.016, flags: ['ISLANDS', 'STORMS'],
    pal: { deep: '#0c2a44', shallow: '#2a5c6e', forest: '#2e4a3a', grass: '#5a6e5a', rock: '#565a5a', snow: '#dce4e8', beach: '#7a7c72', murk: '#283636' },
    p: { sea: 0.5, forest: 0.3, mountains: 0.35, caps: 0.04, islands: 0.6, swamp: 0, rivers: 0, scale: 2.3 },
    clouds: sky(0.5, '#c8d0d6', 1.2, 3, 0.006),
    atmo: air('#8aa4b8', 2.6, 1.065, '#d09a7a'),
  },
  // Kol Iben: Trask's gas giant, green and gold
  koliben: {
    name: 'Kol Iben', swatch: '#a8a070', family: 'gas', bump: 0.002,
    pal: { band1: '#9a9466', band2: '#c0b884', band3: '#7a7a58', band4: '#d6cca0', band5: '#6a6a4a', storm: '#ece4c4' },
    p: { bands: 11, turb: 0.7, flow: 0.004, fine: 1.1, stormSize: 0.05, stormLat: -0.3, stormLon: 0.6 },
    atmo: air('#c8c098', 2.2, 1.03),
  },
  // Corvus: a forest burnt to ash and stumps
  corvus: {
    name: 'Corvus', swatch: '#5e5a54', family: 'lush', bump: 0.022, detail: ['gravel', 'rock'],
    pal: { deep: '#1a2a36', shallow: '#3a4e56', forest: '#3a3632', grass: '#6a6458', rock: '#4e4a46', snow: '#d8d8d4', beach: '#6e6658', murk: '#2a2a28' },
    p: { sea: -0.25, forest: 0.9, mountains: 0.45, caps: 0, islands: 0, swamp: 0, rivers: 0.25, scale: 2.4 },
    clouds: sky(0.36, '#9a948c', 1.1, 3.2, 0.003),
    atmo: air('#b0a898', 2.3, 1.06, '#ff8a50'),
  },
  // Morak: jungle and chains of islands, the refinery's smoke
  morak: {
    name: 'Morak', swatch: '#3a7a4a', family: 'lush', bump: 0.02, flags: ['ISLANDS', 'RIVERS'], detail: ['leaves', 'rock'],
    pal: { deep: '#0c3446', shallow: '#227a7a', forest: '#245a2c', grass: '#4e8a3e', rock: '#5a5848', snow: '#e4ece4', beach: '#a09a6c', murk: '#24382a' },
    p: { sea: 0.14, forest: 1.2, mountains: 0.45, caps: 0, islands: 0.8, swamp: 0.15, rivers: 0.4, scale: 2.5 },
    clouds: sky(0.46, '#f4f6f2', 1.6, 4.6),
    atmo: air('#8ccab8', 2.6, 1.07),
  },
  // Plazir-15: marsh and grass plains round its domed city
  plazir: {
    name: 'Plazir-15', swatch: '#7a9a6a', family: 'lush', bump: 0.018, flags: ['SWAMP', 'RIVERS'], detail: ['gravel', 'rock'],
    pal: { deep: '#18405a', shallow: '#3e7a7a', forest: '#3e6440', grass: '#8aa66a', rock: '#7a786a', snow: '#f0f2f0', beach: '#b0aa82', murk: '#3a4a36' },
    p: { sea: -0.2, forest: 0.35, mountains: 0.3, caps: 0.04, islands: 0, swamp: 0.6, rivers: 0.5, scale: 2.2 },
    clouds: sky(0.28, '#ffffff', 1.7, 4.4),
    atmo: air('#9ac4e0', 2.2, 1.065),
  },
  // Seatos: forest and ocean, the Eye of Sion's ruins on the shore
  seatos: {
    name: 'Seatos', swatch: '#3e7a6e', family: 'lush', bump: 0.022, flags: ['ISLANDS'], detail: ['leaves', 'rock'],
    pal: { deep: '#0e2e48', shallow: '#2a6a78', forest: '#2a5236', grass: '#5a7a4a', rock: '#6a6458', snow: '#eceff0', beach: '#a09478', murk: '#283830' },
    p: { sea: 0.24, forest: 1, mountains: 0.6, caps: 0.05, islands: 0.5, swamp: 0, rivers: 0, scale: 2.4 },
    clouds: sky(0.4, '#eef0f2', 1.5, 4.2),
    atmo: air('#8ab4d0', 2.4, 1.065, '#ffa070'),
  },
};
