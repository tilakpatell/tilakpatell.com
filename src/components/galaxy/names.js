// The galaxy's systems by name, and nothing else: small enough for the
// site's multiplayer (online/where.js) to say "on Hoth" without bringing the
// whole galaxy (systems.js, which the tests keep in step with this) into
// every page.

export const GALAXY = '/galaxy';

export const SYSTEM_NAMES = {
  tatooine: 'Tatooine',
  hoth: 'Hoth',
  endor: 'Endor',
  yavin: 'Yavin 4',
  alderaan: 'Alderaan',
  bespin: 'Bespin',
  dagobah: 'Dagobah',
  mustafar: 'Mustafar',
  coruscant: 'Coruscant',
  naboo: 'Naboo',
  kashyyyk: 'Kashyyyk',
  kamino: 'Kamino',
  geonosis: 'Geonosis',
  scarif: 'Scarif',
  nevarro: 'Nevarro',
  mandalore: 'Mandalore',
  lothal: 'Lothal',
  sorgan: 'Sorgan',
  felucia: 'Felucia',
  kessel: 'Kessel',
  sullust: 'Sullust',
  pillio: 'Pillio',
  vardos: 'Vardos',
  fondor: 'Fondor',
  // (the charted worlds: charted/index.js)
  utapau: 'Utapau',
  mygeeto: 'Mygeeto',
  saleucami: 'Saleucami',
  catoneimoidia: 'Cato Neimoidia',
  polismassa: 'Polis Massa',
  malastare: 'Malastare',
  jedha: 'Jedha',
  eadu: 'Eadu',
  lahmu: 'Lah’mu',
  wobani: 'Wobani',
  kafrene: 'Ring of Kafrene',
  dantooine: 'Dantooine',
  ordmantell: 'Ord Mantell',
  corellia: 'Corellia',
  tython: 'Tython',
  arvala: 'Arvala-7',
  trask: 'Trask',
  corvus: 'Corvus',
  morak: 'Morak',
  plazir: 'Plazir-15',
  seatos: 'Seatos',
};

// Where each system sits on the galaxy's disc, for the universe map's
// gateway (galaxy/gateway.js) to light it there: [x, z] from the galaxy's
// middle as a share of its radius (+x east, +z south, as the galaxy map has
// them; systems.js's pos, CORE and RIM, kept in step by its tests) and the
// system's own colour.
export const SYSTEM_MARKS = {
  tatooine: [0.519, 0.519, '#f0c27a'],
  hoth: [-0.148, 0.704, '#bfe1ff'],
  endor: [-0.417, 0.528, '#8fd27a'],
  yavin: [0.324, -0.398, '#9fe07a'],
  alderaan: [0.046, -0.028, '#8fc3ff'],
  bespin: [-0.111, 0.741, '#ffb79a'],
  dagobah: [0.046, 0.806, '#a8c48a'],
  mustafar: [-0.046, 0.806, '#ff8a4a'],
  coruscant: [-0.046, -0.12, '#ffd08a'],
  naboo: [0.231, 0.62, '#7fd8a8'],
  kashyyyk: [0.324, -0.12, '#b5d97a'],
  kamino: [0.602, 0.435, '#8ec7e8'],
  geonosis: [0.481, 0.565, '#ff9a6a'],
  scarif: [0.611, -0.37, '#6fe0d8'],
  nevarro: [-0.241, 0.85, '#f4a27c'],
  mandalore: [0.241, -0.426, '#c3b8f0'],
  lothal: [0.713, -0.093, '#d8dc84'],
  sorgan: [-0.639, 0.333, '#86d6a6'],
  felucia: [0.537, -0.444, '#c7e86a'],
  kessel: [0.648, -0.028, '#e8d8a0'],
  sullust: [0.324, 0.907, '#f0a060'],
  pillio: [0.481, 0.769, '#7fd0e8'],
  vardos: [0.5, 0.889, '#a8c8e0'],
  fondor: [0.222, 0.111, '#c8c0b0'],
  utapau: [0.134, 0.833, '#e0c79c'],
  mygeeto: [-0.167, -0.532, '#b4e4f4'],
  saleucami: [0.644, -0.204, '#d2c486'],
  catoneimoidia: [0.227, 0.019, '#94c8b0'],
  polismassa: [-0.097, 0.889, '#c9bdb0'],
  malastare: [0.176, 0.532, '#b8c48e'],
  jedha: [-0.407, -0.019, '#e6d6bc'],
  eadu: [0.773, 0.005, '#a8b4c4'],
  lahmu: [-0.065, -0.644, '#9ccaa0'],
  wobani: [0.491, -0.171, '#c4b49c'],
  kafrene: [-0.167, 0.343, '#d6a888'],
  dantooine: [-0.093, -0.569, '#c0d888'],
  ordmantell: [-0.083, -0.343, '#88c0e0'],
  corellia: [0.042, 0.046, '#94d0c0'],
  tython: [-0.014, 0.014, '#d4dc9c'],
  arvala: [0.653, 0.324, '#e2b48c'],
  trask: [0.486, 0.431, '#8cbcd4'],
  corvus: [0.509, -0.366, '#c0b8ac'],
  morak: [-0.375, 0.741, '#7ed6a0'],
  plazir: [0.106, -0.727, '#b4dca4'],
  seatos: [0.023, 0.847, '#86ccc0'],
};

// a galaxy path's system ('/galaxy/hoth' and '/galaxy/hoth/mission' are
// Hoth), or null
export function systemOfPath(pathname) {
  const m = /^\/galaxy\/([a-z0-9-]+)/.exec(pathname ?? '');
  return m && SYSTEM_NAMES[m[1]] ? m[1] : null;
}

// flying in the galaxy: at a system, or arriving at one ('/galaxy'), not
// reading a mission's briefing
export const inGalaxyFlight = (where) => where === GALAXY || /^\/galaxy\/[a-z0-9-]+$/.test(where ?? '');
