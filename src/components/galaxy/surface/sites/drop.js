// The 2017 game's own worlds, from the ground (the fifth design's lane E5):
// Felucia, Kessel, Sullust, Pillio, Vardos and Fondor, each drawn from its
// game map (`level`: the pack scripts/bf2017-level.mjs wrote under
// public/models/galaxy/bf2017/levels/<world>/, its binaries published by
// hash), a place to land rather than a front. Kessel's pack is made; its
// people, things and quests wait on lanes A and O (`life: []`), its places
// the map's own spots, in the pack's frame (the spot the pack was built at is
// the site's 0, 0). The other five are free roams of their own till their
// packs are made: ground, places, people and something to do, after the
// game's maps and the films. (sites/index.js has what a site is.)

import { grove } from './stand';
import { sky, palette, hostile, troops, NATURE } from './outerKit';

// n spots evenly round a circle of radius r (a turn of `phase` first), each [x, z, yaw] facing the middle
const ring = (n, r, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2];
  });
// the drop's own things (catalog: the game's library, published)
const G = (path) => `game:objects/${path}`;
const SULLUST = {
  bucket: G('props/objectsets/sullust/bucketsmelting_xl_01/bucketsmelting_xl_bucket_01_mesh'),
  container: G('props/objectsets/sullust/containersullustan_xl_01/containersullustan_xl_01_mesh'),
  machine: G('props/objectsets/sullust/machine_l_05/machine_l_05_mesh'),
  crater: G('nature/volcanic/sullustan/volcaniccrater_rockmedium_01/volcaniccrater_rockmedium_01_mesh'),
};
const EMPIRE = { box: G('props/objectsets/_galacticempire/box_m_05/box_m_05_mesh'), container: G('props/objectsets/_galacticempire/container_xl_02/container_xl_02_a_mesh') };

export const SITES = {

  kessel: {
    // the pack /models/galaxy/bf2017/levels/kessel/level.json:
    // Kessel_01 (Extraction's and Blast's), `node scripts/bf2017-level.mjs
    // s3/levels/kessel_01 --world kessel --spot 0 -53 --subs Kessel_01,Art
    // --ultra`: the spot is Blast's first spawn on the mine floor, its ground
    // 578 m in the game (TeamDeathmatch_Global:6); the mine keeps its
    // pieces in the `Art` sub-level
    level: 'kessel',
    place: 'The spice mines of Kessel',
    line: 'White salt, black rock, and the mine’s corridors cut into it, under a sky the colour of dust.',
    sky: sky('#7a8aa0', '#e8e4d8', '#fff4e4', { hazeColor: '#ece6d8', clouds: { cover: 0.6, color: '#e8e4dc', shade: '#9a948c', scale: 0.7, speed: 0.004 } }),
    fog: { color: '#dcd8cc', density: 0.0016 },
    light: { sun: 2.4, sky: '#c4c8cc', ground: '#c8c0b0', ambient: 0.85 },
    dust: '#f0ece2',
    edge: 'Salt flats and the Maw’s pull past them. Nothing out there to land on. Better turn back.',
    ground: {
      detail: 'gravel',
      detailLook: { color: 0.6, normal: 0.7 },
      seed: 62,
      wind: 0.7,
      // the game's own ground: Kessel_01's heightmap, 0 on the mine floor
      layers: [{ type: 'image', pack: 'kessel' }],
      palette: palette('#e2ded2', '#f2f0ea', '#5a544c', '#b8b0a0', { deep: '#8a847a', mark: '#6a6058' }),
    },
    weather: [{ kind: 'sand', count: 500 }],
    land: { at: [0, 0], yaw: 0 },
    places: [
      { id: 'mine', name: 'The mine', at: [0, 0], r: 50, about: 'The corridors where the spice comes out, and where the Empire’s guard stands over every door.' },
      // (the extraction’s payload, V_KesselPayload, 157 m north of the landing)
      { id: 'payload', name: 'The payload’s run', at: [-31, 157], r: 40, about: 'The track the stolen coaxium is pushed along to the Millennium Falcon, and the corridors that overlook it.' },
      // (Heroes vs Villains’ first spawn, HeroesVsVillains_Logic:10, by the quarry pools)
      { id: 'quarry', name: 'The quarry pools', at: [-47, -75], r: 40, about: 'Pools of still water in the salt where the quarry was dug out, and the heroes’ ground in the game.' },
    ],
    life: [],
    quests: [],
  },

  felucia: {
    place: 'The fungal jungle of Felucia',
    line: 'A jungle of fungus the size of houses, in colours no forest should have, steaming under a yellow sky.',
    sky: sky('#a6b46a', '#e6dc9a', '#fff4c2', { hazeColor: '#dcd48c', clouds: { cover: 0.6, color: '#f2ecc2', shade: '#a49c62', scale: 0.5, speed: 0.004 } }),
    fog: { color: '#c4c47a', density: 0.0034 },
    light: { sun: 2.2, sky: '#c4c88a', ground: '#5a6a2a', ambient: 0.9 },
    ground: { detail: 'leaves', detailLook: { color: 0.8, normal: 0.7 }, seed: 101, layers: [{ type: 'swell', scale: 300, height: 8 }, { type: 'hills', scale: 110, height: 12 }, { type: 'ridges', scale: 220, height: 10 }, { type: 'mountains', from: 650, to: 2600, height: 320, scale: 1000 }], palette: palette('#5a6a2a', '#7a8a32', '#5a4a3a', '#a86a2a', { mark: '#3a4418', accentCover: 0.3 }) },
    weather: [{ kind: 'motes', count: 500 }],
    land: { at: [0, 0], yaw: 1.6 },
    places: [
      { id: 'grove', name: 'The great fungi', at: [220, 120], r: 30, about: 'A clearing among the biggest of Felucia’s fungus: caps wide as landing pads, stalks thick as towers, all of it glowing faintly at dusk.', things: grove(101, 6, 8, 26, ['cavetree'], [1.2, 2]) },
      { id: 'outpost', name: 'The 327th’s outpost', at: [-200, -150], r: 50, flat: { r: 40 }, about: 'Where Commander Bly’s clones held the line for General Aayla Secura, until the order came that ended it.', things: [{ kind: 'commandpost', at: [0, 0], yaw: 0.8 }, { kind: 'turret', at: [18, 14], yaw: 1, opts: { color: '#8a8a7a' } }, { kind: 'tent', at: [-14, 12], opts: { r: 3.4, h: 3, sides: 6, color: '#7a6a3a' } }, { kind: 'crates', at: [10, -14] }] },
      { id: 'pond', name: 'The sarlacc pond', at: [-120, 240], r: 40, about: 'Felucia’s sarlaccs live in its ponds as well as its sand: still water, and something under it that isn’t.', things: [{ kind: 'sarlacc', at: [0, 0], scale: 0.7 }] },
      { id: 'farm', name: 'The nicillin farm', at: [150, -210], r: 40, flat: { r: 30 }, about: 'Where the farmers grow nicillin, the medicine half the galaxy wants: the farm that hired bounty hunters to hold it against Hondo Ohnaka’s pirates.', things: [{ kind: 'felwatertower', at: [0, 0], yaw: 0.6 }, { kind: 'felwatertower', at: [16, 10], yaw: 2, scale: 0.85 }, { kind: 'crates', at: [-8, 6] }] },
    ],
    scatter: [{ kind: 'fungus', n: 90, at: [220, 120], within: [10, 120], scale: [2, 4.4], solid: 0.5 }, { kind: 'fungus', n: 220, within: [30, 620], scale: [1.2, 4], solid: 0.5 }, { kind: 'jungletree', n: 90, within: [50, 620], scale: [0.8, 1.6] }, { kind: 'plant', n: 140, within: [6, 400], scale: [0.8, 1.6], solid: false }, { kind: 'fern', n: 120, within: [6, 400], scale: [0.8, 1.6], solid: false }],
    flora: { biome: 'jungle', trees: false, tint: { Leaves: { recolour: '#8a9a34' }, Rocks: { recolour: '#6a5a3a' } } },
    things: [{ kind: 'crates', at: [10, 8] }],
    life: [
      { kind: 'clone', id: 'bly', at: [-186, -136], still: true, face: 3.4, name: 'Commander Bly', named: true, quest: 'separatists', says: ['327th Star Corps, hold the outpost.', 'The general’s out ahead. As usual.'] },
      { kind: 'clone', n: 4, at: [-200, -150], spread: 16, roam: 8, speed: 1, name: 'Clone trooper', says: ['Everything here wants to eat you. Even the plants.'] },
      { kind: 'felbird', n: 4, at: [200, 140], spread: 30, roam: 24, speed: 1.4, r: 0.4 },
      { kind: 'felripper', n: 3, at: [-60, 180], spread: 20, roam: 20, speed: 1.6, r: 0.3 },
    ],
    quests: [
      { id: 'separatists', name: 'The 327th', giver: 'bly', intro: [['Commander Bly', 'Droids in the great fungi, digging in. Clear them out before they get a gun up.']], steps: [{ type: 'reach', at: [200, 110], r: 26, text: 'Get to the great fungi' }, { type: 'shoot', tag: 'fungidroids', n: 7, text: 'Clear the droids out of the fungi', spawn: [{ kind: 'battledroid', n: 5, at: [214, 124], spread: 14, roam: 6, hp: 2, tag: 'fungidroids', hostile: hostile(40, 2.2, 7) }, { kind: 'superdroid', n: 2, at: [222, 130], spread: 8, roam: 4, hp: 4, tag: 'fungidroids', hostile: hostile(42, 1.8, 9) }] }], done: [['Commander Bly', 'Good. The general will be pleased. She’s hard to please.']] },
    ],
    flyovers: [{ kind: 'gunship', n: 1, metres: 18, alt: 110, speed: 60, every: 80 }],
  },

  sullust: {
    place: 'The volcanic works of Sullust',
    line: 'Lava, ash and SoroSuub’s foundries built over both: the Sullustans’ home, and the Empire’s factory.',
    sky: sky('#4a3e3a', '#a46a4a', '#ffd8a8', { hazeColor: '#8a5a44', below: '#3a2a24', clouds: { cover: 0.85, color: '#6a5248', shade: '#2a2220', scale: 0.4, speed: 0.008 } }),
    fog: { color: '#6a4a3e', density: 0.0034 },
    light: { sun: 1.4, sky: '#8a6a5e', ground: '#5a2a1a', ambient: 0.85 },
    ground: { detail: 'ash', detailLook: { color: 0.8, normal: 0.8 }, seed: 102, layers: [{ type: 'swell', scale: 300, height: 8 }, { type: 'ridges', scale: 140, height: 12 }, { type: 'channels', scale: 380, depth: 10, width: 0.07 }, { type: 'mountains', from: 600, to: 2400, height: 480, scale: 900 }], palette: palette('#3a3230', '#524844', '#1c1818', '#6a3a24', { mark: '#141010', wet: { level: -3, band: 3, color: '#8a2a0a' } }) },
    water: { level: -3, color: '#ff5a10', deep: '#2a0a04', kind: 'lava', glow: 2 },
    weather: [{ kind: 'embers', count: 500 }, { kind: 'ash', count: 400 }],
    land: { at: [0, 0], yaw: 3.4 },
    places: [
      { id: 'foundry', name: 'The SoroSuub foundry', at: [230, 60], r: 70, flat: { r: 56 }, about: 'Where the Sullustans pour the metal the Empire buys by the shipload: crucibles over the lava, machines that never stop, and stormtroopers watching the workers.', things: [{ kind: 'sullustfactory', at: [0, -46] }, { kind: 'game', model: SULLUST.bucket, at: [24, 18], yaw: 0.4 }, { kind: 'game', model: SULLUST.machine, at: [-22, 16], yaw: 2 }, { kind: 'game', model: SULLUST.container, at: [18, -24], yaw: 1 }, { kind: 'game', model: SULLUST.container, at: [-18, -26], yaw: 2.6 }, { kind: 'smoke', at: [0, 0], opts: { h: 80, n: 9, color: '#2a2220' } }] },
      { id: 'collector', name: 'The lava collectors', at: [-180, -160], r: 50, flat: { r: 30 }, about: 'Long arms out over the lava, drawing the heat off for the works: the same kind the Separatists built on Mustafar.', things: [{ kind: 'lavacollector', at: [0, 0], yaw: 0.8 }] },
      { id: 'crater', name: 'The crater’s rim', at: [-120, 240], r: 46, about: 'The edge of the old crater, black rock and yellow sulphur, and the whole works below you in the smoke.', things: [{ kind: 'game', model: SULLUST.crater, at: [0, 0], yaw: 0.2, scale: 1.4 }, { kind: 'game', model: SULLUST.crater, at: [14, 10], yaw: 2, scale: 1.1 }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.crater, n: 120, within: [20, 600], scale: [0.6, 2.8], opts: { color: '#2a2422', sharp: 0.7 } }, { kind: 'stones', model: NATURE.sulphur, n: 200, within: [8, 420], scale: [0.25, 0.8], solid: false, opts: { color: '#2e2624' } }, { kind: 'lavacrack', n: 40, within: [40, 500], scale: [0.8, 1.6] }],
    flora: { biome: 'ash' },
    things: [{ kind: 'game', model: EMPIRE.box, at: [10, -10], yaw: 0.4 }],
    life: [
      { kind: 'sullustan', id: 'foreman', at: [214, 40], still: true, face: 2.2, name: 'A Sullustan foreman', named: true, quest: 'sabotage', says: ['The Empire pays in promises. We work for real.', '(He clicks his tongue twice: a Sullustan curse, a polite one.)'] },
      { kind: 'sullustan', n: 4, at: [230, 60], spread: 30, roam: 12, speed: 0.8, name: 'Sullustan worker', says: ['Hot today. Hot every day.'] },
      { kind: 'stormtrooper', n: 4, at: [230, 60], spread: 30, roam: 16, speed: 1, name: 'Stormtrooper', says: ['Back to the line.'] },
    ],
    quests: [
      { id: 'sabotage', name: 'The works', giver: 'foreman', intro: [['A Sullustan foreman', 'The Empire’s order ships tomorrow. Three couplings on the crucibles, loosened, and it ships in pieces.']], steps: [{ type: 'collect', item: 'coupling', n: 3, spots: [[250, 76], [208, 78], [246, 38]], text: 'Loosen the crucibles’ couplings' }, { type: 'shoot', tag: 'works', n: 5, text: 'Get out past the guards', spawn: troops('works', 5, [236, 70]) }], done: [['A Sullustan foreman', 'Accidents happen. In a foundry, they happen a lot.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 120, speed: 110, every: 70 }],
  },

  pillio: {
    place: 'The islands of Pillio',
    line: 'Turquoise water, white sand and green islands, and under one of them the Emperor’s hidden observatory.',
    sky: sky('#5aa0e0', '#d4ecf0', '#fffbe8', { hazeColor: '#d6ecee', clouds: { cover: 0.3, color: '#ffffff', shade: '#a6c0c8', scale: 0.7, speed: 0.005 } }),
    fog: { color: '#cce6ea', density: 0.0009 },
    light: { sun: 3, sky: '#bcdcf0', ground: '#d8d0a8', ambient: 0.85 },
    ground: { detail: 'beach', detailLook: { color: 0.7, normal: 0.7, metres: 6 }, seed: 103, wind: 0.5, layers: [{ type: 'island', at: [0, 0], r: 300, height: 14, core: 0.4, ragged: 0.35 }, { type: 'island', at: [260, 180], r: 160, height: 22, core: 0.3, ragged: 0.3 }, { type: 'island', at: [-280, -120], r: 150, height: 10, core: 0.35, ragged: 0.35 }, { type: 'swell', scale: 160, height: 1.4 }, { type: 'dunes', scale: 26, height: 0.6, wind: 0.5 }], palette: palette('#ece4c6', '#7a9a4a', '#8a8a78', '#5a8a3a', { hLow: 1, hHigh: 8, mark: '#c8bc98', wet: { level: -0.9, band: 1.2, color: '#c0ae84' } }) },
    water: { level: -0.9, color: '#3ac0c8', deep: '#1a5a7a', kind: 'sea', foam: 0.22 },
    weather: [],
    land: { at: [0, 0], yaw: 0.8 },
    places: [
      { id: 'observatory', name: 'The Emperor’s observatory', at: [260, 180], r: 50, flat: { r: 36 }, about: 'Hidden under the island’s hill: one of Palpatine’s observatories, where he watched the Unknown Regions, and kept what he found there.', things: [{ kind: 'pilliovault', at: [0, 0] }, { kind: 'turret', at: [18, -14], yaw: 2.4 }] },
      { id: 'beach', name: 'The white beach', at: [-60, -180], r: 50, about: 'Sand as white as flour, water clear to the bottom, and the shrimp the size of a man wading in the shallows.', things: [{ kind: 'palm', at: [0, 0] }, { kind: 'palm', at: [10, 8], yaw: 1 }, { kind: 'palm', at: [-12, 6], yaw: 2 }] },
      { id: 'cove', name: 'The western island', at: [-280, -120], r: 50, about: 'A low island across the shallows, where the Empire’s garrison keeps its boats.', things: [{ kind: 'pad', at: [0, 0], opts: { r: 12 } }, { kind: 'crates', at: [12, 8] }] },
    ],
    scatter: [{ kind: 'palm', n: 70, within: [20, 360], scale: [0.8, 1.4] }, { kind: 'rock', model: NATURE.rock, n: 50, within: [20, 400], scale: [0.6, 2.2], opts: { color: '#8a8a78' } }],
    flora: { biome: 'tropical' },
    things: [{ kind: 'crates', at: [10, 8] }],
    life: [
      { kind: 'officer', id: 'meeko', at: [14, 10], still: true, face: 2.8, name: 'Del Meeko', named: true, quest: 'observatory', says: ['The Emperor had his secrets here. I want to know what they were.', 'Watch the shrimp. They bite.'] },
      { kind: 'pillioshrimp', n: 4, at: [-60, -190], spread: 20, roam: 18, speed: 0.6, r: 0.8 },
      { kind: 'stormtrooper', n: 3, at: [238, 162], spread: 10, roam: 8, speed: 1, name: 'Stormtrooper', says: ['Restricted area.'] },
    ],
    quests: [
      { id: 'observatory', name: 'The observatory', giver: 'meeko', intro: [['Del Meeko', 'The observatory’s on the east island. Get past the guard and into the vault.']], steps: [{ type: 'reach', at: [236, 160], r: 26, text: 'Cross to the east island' }, { type: 'shoot', tag: 'guard', n: 5, text: 'Get past the observatory’s guard', spawn: troops('guard', 5, [240, 166]) }, { type: 'use', id: 'vault', at: [260, 196], r: 6, prompt: 'Open the vault', text: 'Open the observatory’s vault', end: [{ say: [[null, '(A holoprojector, and a map of stars no Imperial chart ever showed.)']] }] }], done: [['Del Meeko', 'So that’s what he was watching. The Unknown Regions.']] },
    ],
    flyovers: [{ kind: 'tie', n: 1, metres: 7, alt: 120, speed: 110, every: 100 }],
  },

  vardos: {
    place: 'The capital of Vardos',
    line: 'White towers and waterfalls in a green valley: the Empire’s loyal world, until the Empire turned on it.',
    sky: sky('#6a9ad0', '#dce6ea', '#fff8e8', { clouds: { cover: 0.4, color: '#ffffff', shade: '#a8b4bc', scale: 0.6, speed: 0.005 } }),
    fog: { color: '#c8d4d8', density: 0.0012 },
    light: { sun: 2.6, sky: '#bcd0e4', ground: '#5a7040', ambient: 0.85 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, seed: 104, layers: [{ type: 'swell', scale: 380, height: 8 }, { type: 'hills', scale: 150, height: 12 }, { type: 'ridges', scale: 280, height: 20 }, { type: 'mountains', from: 550, to: 2200, height: 620, scale: 900 }], palette: palette('#4e6a38', '#6a8446', '#8a8a82', '#7a8a52', { rockAt: 0.34, mark: '#3a4e28' }) },
    grass: { h: [0.3, 0.6], w: 0.05, root: '#3a4e28', mid: '#5a7440', tip: '#90a866', dry: '#9a9a62', cover: 0.75, scale: 90, wind: 0.5 },
    weather: [],
    land: { at: [0, 0], yaw: 2 },
    places: [
      { id: 'capital', name: 'The capital', at: [240, -80], r: 80, flat: { r: 66 }, about: 'White towers stepped up the valley side, gardens on every terrace, and a garrison that never had to fire a shot. Iden Versio grew up here.', things: [{ kind: 'kestrotower', at: [0, -14] }, { kind: 'plaza', at: [0, 40], opts: { w: 50, d: 26, fountain: true } }] },
      { id: 'falls', name: 'The falls', at: [-200, -150], r: 50, about: 'Where the river comes off the mountains in one long drop, and the mist off it waters the whole valley.', things: [{ kind: 'waterfall', at: [0, 0], yaw: 0.8, opts: { h: 40, w: 16, out: 8 } }] },
      { id: 'garrison', name: 'The garrison', at: [-120, 240], r: 46, flat: { r: 38 }, about: 'The Empire’s barracks on Vardos, proud of a world that never rebelled: until Operation Cinder came for it anyway.', things: [{ kind: 'bunker', at: [0, 0], yaw: 4.6, opts: { w: 20, d: 12 } }, { kind: 'turret', at: [18, 14], yaw: 4 }, { kind: 'pad', at: [-20, -14], opts: { r: 12 } }] },
    ],
    flora: { biome: 'plains', trees: true },
    things: [{ kind: 'crates', at: [10, -8] }],
    life: [
      { kind: 'officer', id: 'versio', at: [226, -50], still: true, face: 2.6, name: 'Admiral Garrick Versio', named: true, quest: 'cinder', says: ['Vardos has always been loyal.', 'The Emperor’s orders stand. Even now.'] },
      { kind: 'civcity1', n: 5, at: [240, -42], spread: 24, roam: 14, speed: 0.6, name: 'Vardos citizen', says: ['Those satellites over the city. What are they for?'] },
      { kind: 'stormtrooper', n: 3, at: [-120, 240], spread: 18, roam: 10, speed: 1, name: 'Stormtrooper', says: ['Vardos is loyal. Vardos is safe.'] },
    ],
    quests: [
      { id: 'cinder', name: 'Operation Cinder', giver: 'versio', intro: [['Admiral Garrick Versio', 'The Emperor’s satellites are over the city. Someone has to get the people out. My daughter would.']], steps: [{ type: 'reach', at: [-120, 240], r: 30, text: 'Get to the garrison’s landing pad' }, { type: 'shoot', tag: 'loyalists', n: 5, text: 'Get past the troopers following the order', spawn: troops('loyalists', 5, [-110, 250]) }, { type: 'use', id: 'shuttles', at: [-140, 226], r: 8, prompt: 'Open the pad to the shuttles', text: 'Open the pad to the evacuation shuttles' }], done: [['Admiral Garrick Versio', 'Go. Get them off the world. I’ll stay.']] },
    ],
    flyovers: [{ kind: 'shuttle', n: 2, metres: 20, alt: 110, speed: 50, every: 70 }],
  },

  fondor: {
    place: 'The shipyards of Fondor',
    line: 'Slipways the length of a Star Destroyer, a city of cranes round them, and the Empire building its fleet here till the end.',
    sky: sky('#6a7a90', '#c4bcae', '#fff0d8', { hazeColor: '#bcb4a6', clouds: { cover: 0.5, color: '#dad6cc', shade: '#7e7a72', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#a8a296', density: 0.0024 },
    light: { sun: 2.1, sky: '#a8b0bc', ground: '#5a5650', ambient: 0.85 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.8 }, seed: 105, layers: [{ type: 'swell', scale: 420, height: 3 }, { type: 'hills', scale: 180, height: 3 }, { type: 'mountains', from: 700, to: 3000, height: 200, scale: 1200 }], palette: palette('#5e5c56', '#6e6c66', '#3e3c38', '#5a5248', { mark: '#2e2c28' }) },
    weather: [{ kind: 'ash', count: 160 }],
    land: { at: [0, 0], yaw: 4 },
    places: [
      { id: 'slipway', name: 'The slipway', at: [260, 40], r: 80, flat: { r: 70 }, about: 'Where the Star Destroyers are built: a trench longer than a city street, gantries along it, and the hull overhead taking shape a plate at a time.', things: [{ kind: 'hangar', at: [0, 0], yaw: 1.6, opts: { w: 80, d: 44, h: 30 } }, { kind: 'fondorgantry', at: [-50, -10], yaw: 1.6 }, { kind: 'fondorgantry', at: [50, -10], yaw: 1.6 + Math.PI }, { kind: 'works', at: [50, 40], yaw: 1 }, { kind: 'game', model: EMPIRE.container, at: [-40, 30], yaw: 0.2 }, { kind: 'game', model: EMPIRE.container, at: [-40, 46], yaw: 0.2 }, { kind: 'smoke', at: [50, 40], opts: { h: 70, n: 8, color: '#3e3a36' } }] },
      { id: 'yardcity', name: 'The yard city', at: [-220, -140], r: 70, flat: { r: 58 }, about: 'Where the yard workers live: towers, canteens, a cantina where nobody talks about what they’re building.', things: [{ kind: 'fondorblock', at: [0, 0], yaw: 0.4 }, { kind: 'fondorblock', at: [44, 26], yaw: 1.9, scale: 1.2 }, { kind: 'cantina', at: [-24, 24], yaw: 1 }] },
      { id: 'cranes', name: 'The crane field', at: [-120, 230], r: 50, flat: { r: 40 }, about: 'Where the hull plates wait to be lifted: stacks of them, and the cranes to lift them, and Ugnaughts to work the cranes.', things: [...ring(4, 22, 0.4).map(([x, z, yaw]) => ({ kind: 'game', model: EMPIRE.container, at: [x, z], yaw })), { kind: 'crates', at: [0, 0] }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.stone, n: 50, within: [30, 560], scale: [0.6, 1.8], opts: { color: '#3e3c38' } }],
    flora: { biome: 'tundra' },
    skyships: [{ kind: 'destroyer', metres: 1600, at: [700, 520, 300], yaw: 1.6 }],
    things: [{ kind: 'game', model: EMPIRE.box, at: [12, -8], yaw: 0.8 }],
    life: [
      { kind: 'rebel', id: 'agent', at: [-206, -116], still: true, face: 2, name: 'A Rebel agent', named: true, quest: 'yards', says: ['That Star Destroyer launches in three days. It mustn’t.'] },
      { kind: 'ugnaught', n: 5, at: [-120, 230], spread: 24, roam: 12, speed: 0.8, name: 'Ugnaught yard worker', says: ['Plates, plates, plates. Always more plates.'] },
      { kind: 'officer', n: 2, at: [260, 40], spread: 30, roam: 14, speed: 0.9, name: 'Imperial yard officer', says: ['Schedule. We are behind schedule.'] },
      { kind: 'stormtrooper', n: 4, at: [260, 40], spread: 40, roam: 18, speed: 1, name: 'Stormtrooper', says: ['Move along.'] },
    ],
    quests: [
      { id: 'yards', name: 'The launch', giver: 'agent', intro: [['A Rebel agent', 'Three charges on the slipway’s gantries, and the Destroyer doesn’t launch. The troopers are thick down there.']], steps: [{ type: 'collect', item: 'charge', n: 3, spots: [[236, 20], [284, 60], [250, 74]], text: 'Set charges on the slipway’s gantries' }, { type: 'shoot', tag: 'yardtroops', at: [260, 40], n: 6, text: 'Fight your way out of the slipway', spawn: troops('yardtroops', 6, [270, 50]) }], done: [['A Rebel agent', 'That’ll set them back a month. Maybe two.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 120, speed: 110, every: 60 }, { kind: 'shuttle', n: 1, metres: 20, alt: 140, speed: 50, every: 90 }],
  },

};
