// The charted worlds of The Mandalorian and Ahsoka, from the ground
// (charted/newRepublic.js has them in the galaxy): Corellia, Tython,
// Arvala-7, Trask, Corvus, Morak, Plazir-15 and Seatos, each a free roam at
// its episode’s moment. (sites/index.js has what a site is.)

import { grove } from './stand';
import { sky, palette, hostile, troops, NATURE } from './outerKit';

// n spots evenly round a circle of radius r (a turn of `phase` first), each [x, z, yaw] facing the middle
const ring = (n, r, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2];
  });

export const SITES = {
  corellia: {
    place: 'The shipyards of Corellia',
    line: 'Smoke, cranes and slipways to the horizon: the yards that built half the ships in the galaxy, and are building something else now.',
    sky: sky('#7a8a9c', '#d0c4b0', '#fff0d6', { hazeColor: '#c8bca8', clouds: { cover: 0.5, color: '#e6e0d6', shade: '#8a867e', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#b2aa9c', density: 0.0022 },
    light: { sun: 2.2, sky: '#b0b8c4', ground: '#6a645a', ambient: 0.85 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.8 }, seed: 91, layers: [{ type: 'swell', scale: 420, height: 4 }, { type: 'hills', scale: 160, height: 4 }, { type: 'mountains', from: 700, to: 3000, height: 220, scale: 1200 }], palette: palette('#6a665e', '#7c7870', '#4a4642', '#6a5a48', { mark: '#3a3632' }) },
    weather: [{ kind: 'ash', count: 200 }],
    land: { at: [0, 0], yaw: 2.2 },
    places: [
      { id: 'yards', name: 'The slipways', at: [250, 40], r: 80, flat: { r: 70 }, about: 'Hulls on the ways and cranes over them, droids working the night shift and the day shift too. Somewhere in here, a hyperspace ring is being built for someone who shouldn’t have one.', things: [{ kind: 'coronettower', at: [0, -48], solid: false }, { kind: 'works', at: [50, -6], yaw: 1 }, { kind: 'smoke', at: [50, -6], opts: { h: 80, n: 9, color: '#4a4440' } }, { kind: 'crates', at: [-20, 30] }] },
      { id: 'coronet', name: 'Coronet City', at: [-220, -150], r: 70, flat: { r: 58 }, city: { plan: 'grid', r: 170, street: 10, block: 48, plaza: 42, kit: [{ kind: 'coronetblock', weight: 3 }, { kind: 'coronetshop', weight: 2 }], clutter: { kinds: ['crates', 'barrels'], n: 2 }, crowd: { kinds: ['villager'], n: 16, name: 'Corellian', says: ['Ships out of the yards every day, and none of them ours.', 'Mind your pockets in the arcades, spacer.'] }, traffic: { kind: 'airspeeder', n: 4, y: 18 } }, about: 'The capital: old stone and new towers, and spacers in every bar trading stories about the ships they flew out of here.', things: [{ kind: 'coronetspire', at: [0, 10], yaw: 0.3 }, { kind: 'coronetspire', at: [44, 26], yaw: 1.2, scale: 0.6 }, { kind: 'coronetspire', at: [-40, 30], yaw: 2.6, scale: 0.75 }, { kind: 'plaza', at: [0, -30], opts: { w: 40, d: 24 } }, { kind: 'cantina', at: [-30, -24], yaw: 0.8 }] },
      { id: 'office', name: 'The yard office', at: [-120, 220], r: 40, flat: { r: 32 }, about: 'Where the yards keep their records: what was built, and who paid for it, and where it was delivered.', things: [{ kind: 'bunker', at: [0, 0], yaw: 4.4, opts: { w: 16, d: 10 } }, { kind: 'pad', at: [22, 10], opts: { r: 10 } }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.stone, n: 50, within: [30, 560], scale: [0.6, 1.8], opts: { color: '#4a4642' } }],
    flora: { biome: 'tundra' },
    things: [{ kind: 'barrels', at: [10, -10] }, { kind: 'crates', at: [-12, 10] }],
    life: [
      { kind: 'ahsoka', id: 'ahsoka', at: [-108, 210], still: true, face: 3.6, name: 'Ahsoka Tano', named: true, quest: ['records', 'droids'], says: ['I’m no Jedi.', 'Someone here built a hyperspace ring. I want to know who.'] },
      { kind: 'droid', at: [-100, 214], still: true, face: 3.2, name: 'Huyang', says: ['I have taught generations of younglings. None of them were this impatient.'] },
      { kind: 'officer', at: [-130, 230], still: true, face: 1, name: 'The yard administrator', says: ['Our records are in order. Entirely in order.'] },
      { kind: 'ugnaught', n: 4, at: [250, 40], spread: 40, roam: 18, speed: 0.8, name: 'Yard worker', says: ['Overtime again. For whoever’s paying.'] },
    ],
    quests: [
      { id: 'records', name: 'The records', giver: 'ahsoka', intro: [['Ahsoka Tano', 'The yard’s records are in its office. Pull the delivery logs for anything shaped like a ring.']], steps: [{ type: 'use', id: 'logs', at: [-120, 220], r: 10, prompt: 'Pull the delivery logs', text: 'Pull the yard office’s delivery logs' }, { type: 'reach', at: [250, 40], r: 40, text: 'Follow the delivery to the slipways' }], done: [['Ahsoka Tano', 'Morgan Elsbeth. Of course it is.']] },
      { id: 'droids', name: 'Assassins', giver: 'ahsoka', intro: [['Ahsoka Tano', 'Someone’s sent assassin droids after us in the yards. Deal with them.']], steps: [{ type: 'shoot', tag: 'assassins', at: [250, 40], n: 4, text: 'Destroy the assassin droids in the slipways', spawn: { kind: 'superdroid', n: 4, at: [256, 52], spread: 16, roam: 6, hp: 4, tag: 'assassins', hostile: hostile(42, 1.6, 9) } }], done: [['Ahsoka Tano', 'Someone doesn’t want us to find that ring.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 2, metres: 40, alt: 160, speed: 40, every: 60 }, { kind: 'shuttle', n: 1, metres: 20, alt: 120, speed: 50, every: 90 }],
  },

  tython: {
    place: 'The seeing stone on Tython',
    line: 'Green hills, old stones, and a temple on the highest of them that the Force still answers in.',
    sky: sky('#6c94c4', '#d2dcd8', '#fff6e2', { clouds: { cover: 0.45, color: '#ffffff', shade: '#a2aab0', scale: 0.6, speed: 0.005 } }),
    fog: { color: '#bcc8c4', density: 0.0012 },
    light: { sun: 2.6, sky: '#b8c8dc', ground: '#5a6a40', ambient: 0.8 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.7 }, seed: 92, layers: [{ type: 'swell', scale: 360, height: 10 }, { type: 'hills', scale: 140, height: 14 }, { type: 'ridges', scale: 240, height: 10 }, { type: 'island', at: [220, -160], r: 110, height: 36, core: 0.3, ragged: 0.25 }, { type: 'mountains', from: 650, to: 2600, height: 420, scale: 1000 }], palette: palette('#4e6236', '#667a44', '#6a6a60', '#7a8448', { hLow: 0, hHigh: 30, rockAt: 0.36, mark: '#3e4a2a' }) },
    grass: { h: [0.25, 0.5], w: 0.05, root: '#3e4a2a', mid: '#5e7040', tip: '#94a462', dry: '#9a9460', cover: 0.7, scale: 80, wind: 0.5 },
    weather: [],
    land: { at: [0, 0], yaw: 2.4 },
    places: [
      // (on the hilltop: the island in the ground's layers lifts it)
      { id: 'stone', name: 'The seeing stone', at: [220, -160], r: 40, flat: { r: 30 }, about: 'A ring of standing stones round a flat rock on the hilltop, where a Jedi can call out to any other who will hear.', things: [{ kind: 'seeingstone', at: [0, 0], yaw: 0.2, sink: 5, solid: false }] },
      { id: 'temple', name: 'The temple ruins', at: [-210, 120], r: 50, flat: { r: 40 }, about: 'Older than the Jedi Order, from when the first of them came here to learn the Force: walls fallen into the grass, and steps up to nothing.', things: [{ kind: 'ruins', at: [0, 0], yaw: 0.8, opts: { seed: 11 } }, { kind: 'pillars', at: [18, -10], yaw: 1.4 }, { kind: 'statue', at: [-14, 12], opts: { h: 16 } }] },
      { id: 'landing', name: 'Where the Razor Crest stood', at: [60, 200], r: 36, flat: { r: 28 }, about: 'Where the Mandalorian set down his ship, before an Imperial cruiser turned it into a crater.', things: [{ kind: 'razorcrest', at: [0, 0], yaw: 2.1 }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.rock, n: 90, within: [20, 560], scale: [0.6, 2.8], opts: { color: '#6a6a60' } }],
    flora: { biome: 'temperate', tint: { Rocks: { recolour: '#7a7a70' } } },
    things: [{ kind: 'crates', at: [10, 8] }],
    life: [
      { kind: 'mando', id: 'mando', at: [196, -140], still: true, face: 2.2, name: 'The Mandalorian', named: true, quest: 'tragedy', says: ['This is the Way.', 'He’s on the stone. Nobody touches him till he’s done.'] },
      { kind: 'grogu', at: [220, -160], still: true, face: 0, name: 'Grogu', says: ['(He sits in the middle of the stones, eyes shut. The air round him hums.)'] },
      { kind: 'bobafett', at: [70, 210], still: true, face: 3.4, name: 'Boba Fett', says: ['I’m a simple man making his way through the galaxy. Like my father before me.'] },
      { kind: 'fennec', at: [80, 196], still: true, face: 3, name: 'Fennec Shand', says: ['Stormtroopers. Two transports. Coming over the ridge.'] },
    ],
    quests: [
      { id: 'tragedy', name: 'The Tragedy', giver: 'mando', intro: [['The Mandalorian', 'Imperial transports. They’ll come up the hill for the kid. Hold them off the stone.']], steps: [{ type: 'reach', at: [190, -120], r: 24, text: 'Get to the slope under the seeing stone' }, { type: 'shoot', tag: 'hilltroops', n: 8, text: 'Hold the stormtroopers off the hill', time: 150, spawn: [troops('hilltroops', 5, [160, -90]), troops('hilltroops', 3, [176, -70])] }], done: [['The Mandalorian', 'They took him. Dark troopers. They took him.'], [null, '(The stones are quiet. The sky over them is empty.)']] },
    ],
    flyovers: [{ kind: 'transport', n: 1, metres: 24, alt: 120, speed: 50, every: 90 }],
  },

  arvala: {
    place: 'The badlands of Arvala-7',
    line: 'Red rock, dust, a moisture farmer who has spoken, and somewhere out here a bounty worth more than its weight.',
    sky: sky('#8ab0d0', '#ead2ae', '#fff2d2', { hazeColor: '#e8cfa8', clouds: { cover: 0.2, color: '#fbf2e2', shade: '#b2a088', scale: 0.7, speed: 0.006 } }),
    fog: { color: '#dcc4a0', density: 0.0012 },
    light: { sun: 2.8, sky: '#c4d0dc', ground: '#a87c56', ambient: 0.8 },
    ground: { detail: 'redsoil', detailLook: { color: 0.75, normal: 0.8 }, seed: 93, wind: 0.8, layers: [{ type: 'swell', scale: 420, height: 8 }, { type: 'mesas', scale: 480, height: 40, cover: 0.32, cliff: 0.05 }, { type: 'ridges', scale: 140, height: 4 }, { type: 'mountains', from: 700, to: 3000, height: 340, scale: 1200 }], palette: palette('#b8865c', '#cfa274', '#8a5638', '#c49064', { mark: '#7a4a30' }) },
    weather: [{ kind: 'sand', count: 300 }],
    land: { at: [0, 0], yaw: 0.4 },
    places: [
      { id: 'farm', name: 'Kuiil’s farm', at: [170, 120], r: 50, flat: { r: 40 }, about: 'An Ugnaught’s moisture farm, worked off a debt he paid years ago: vaporators, a shed for the speeder he rebuilt by hand, and the blurrgs in their pen.', things: [{ kind: 'homestead', at: [0, 0], yaw: 0.6 }, { kind: 'vaporator', at: [16, 10] }, { kind: 'vaporator', at: [-16, 12] }, { kind: 'vaporator', at: [10, -18] }, { kind: 'crates', at: [-10, -14] }] },
      { id: 'compound', name: 'The Nikto compound', at: [-230, -160], r: 56, flat: { r: 46 }, about: 'Mercenaries guarding something small behind a wall of scrap: the bounty the Mandalorian came for, and nobody here knows what it is.', things: [{ kind: 'niktocompound', at: [0, 0], yaw: 0.4, solid: false }] },
      { id: 'crawler', name: 'The Jawas’ sandcrawler', at: [-140, 230], r: 50, flat: { r: 40 }, about: 'Where the Jawas park their crawler and sell back what they took: the Razor Crest’s parts, for a price.', things: [{ kind: 'sandcrawler', at: [0, 0], yaw: 1.2 }, { kind: 'crates', at: [24, 10] }] },
      { id: 'cave', name: 'The Mudhorn’s cave', at: [300, -230], r: 40, about: 'A hollow in the cliff, a nest of hide and bone, and the Mudhorn that lives in it, who doesn’t want visitors.', things: grove(93, 10, 8, 32, ['needle'], [0.5, 0.9]) },
    ],
    flora: { biome: 'dry', game: 'badlands', tint: { Rocks: { recolour: '#9a7a5a' } } },
    things: [{ kind: 'razorcrest', at: [-20, -14], yaw: 0.8 }],
    life: [
      { kind: 'kuiil', id: 'kuiil', at: [176, 106], still: true, face: 3, name: 'Kuiil', named: true, quest: ['compound', 'parts'], says: ['I have spoken.', 'Your ship is in pieces, and the Jawas have the pieces.'] },
      { kind: 'ig11', at: [-200, -140], still: true, face: 3.6, name: 'IG-11', says: ['I am IG-11. I have been programmed to collect the asset.'] },
      { kind: 'blurrg', n: 3, at: [186, 140], spread: 10, roam: 14, speed: 0.6, r: 1.6 },
      { kind: 'jawa', n: 5, at: [-140, 230], spread: 18, roam: 10, speed: 1.2, name: 'Jawa', says: ['Utinni!', '(A rapid argument about prices, all on their side.)'] },
      { kind: 'mudhorn', at: [300, -230], roam: 14, speed: 0.8, r: 2.6, name: 'The Mudhorn' },
    ],
    quests: [
      { id: 'compound', name: 'The asset', giver: 'kuiil', intro: [['Kuiil', 'The Nikto camp is guarding what you seek. Another hunter has come for it too. I have spoken.']], steps: [{ type: 'reach', at: [-190, -130], r: 24, text: 'Get to the Nikto compound' }, { type: 'shoot', tag: 'nikto', n: 8, text: 'Take the compound', time: 180, spawn: { kind: 'aqualish', n: 8, at: [-230, -160], spread: 18, roam: 6, hp: 2, tag: 'nikto', hostile: hostile(42, 2.2, 7) } }, { type: 'use', id: 'pram', at: [-230, -160], r: 8, prompt: 'Look inside', text: 'Find the asset', end: [{ say: [[null, '(Something small and green looks up at you, ears out, and makes a sound.)']] }] }], done: [['Kuiil', 'Now you will take it to the Client. Or not. I have spoken.']] },
      { id: 'parts', name: 'The parts', giver: 'kuiil', intro: [['Kuiil', 'The Jawas stripped your ship. They will trade, if you have something they want. They want a Mudhorn egg.']], steps: [{ type: 'reach', at: [300, -230], r: 30, text: 'Find the Mudhorn’s cave' }, { type: 'shoot', tag: 'mudhorn', n: 1, text: 'Get past the Mudhorn', spawn: { kind: 'mudhorn', at: [304, -236], hp: 18, leash: 30, roam: 6, tag: 'mudhorn', hostile: { range: 14, chase: 2, melee: true, reach: 4, every: 2.4, damage: 18, delay: 1 } } }, { type: 'collect', item: 'egg', n: 1, spots: [[296, -244]], text: 'Take the egg' }, { type: 'talk', actor: 'kuiil', text: 'Bring it back' }], done: [['Kuiil', 'The Jawas will trade now. And the creature: it moved. You saw it too.']] },
    ],
    flyovers: [],
  },

  trask: {
    place: 'The harbour on Trask',
    line: 'An estuary moon of mist and grey water, Mon Calamari and Quarren fishermen, and a harbour where anything can be bought.',
    sky: sky('#6a7c88', '#b8c4c4', '#eef2ee', { hazeColor: '#aab6b6', clouds: { cover: 0.8, color: '#d2d8d8', shade: '#7a8486', scale: 0.5, speed: 0.008 } }),
    fog: { color: '#9aa8aa', density: 0.0034 },
    light: { sun: 1.6, sky: '#94a4ac', ground: '#4a524a', ambient: 0.9 },
    ground: { detail: 'mud', detailLook: { color: 0.7, normal: 0.7 }, seed: 94, layers: [{ type: 'island', at: [-60, 40], r: 480, height: 10, core: 0.5, ragged: 0.3 }, { type: 'swell', scale: 240, height: 3 }, { type: 'hills', scale: 90, height: 3 }, { type: 'mountains', from: 900, to: 3000, height: 200, scale: 1200 }], palette: palette('#4a4e46', '#5a6250', '#3a3c3a', '#56604a', { hLow: 0, hHigh: 8, mark: '#2e322c', wet: { level: 0, band: 1.4, color: '#2a2e2a' } }) },
    water: { level: -0.6, color: '#4a6266', deep: '#24343a', kind: 'sea', foam: 0.14 },
    weather: [{ kind: 'spray', count: 300 }],
    land: { at: [0, 0], yaw: 1.8 },
    places: [
      { id: 'harbour', name: 'The harbour', at: [260, -40], r: 70, flat: { r: 46 }, city: { plan: 'grid', r: 140, street: 8, block: 34, plaza: 30, kit: ['traskhall'], clutter: { kinds: ['crates', 'barrels'], n: 3 }, crowd: { kinds: ['villager'], n: 10, name: 'Fisherman', says: ['Good catch today. Better than the Quarren’s.', 'Mind the nets.'] } }, about: 'Boats in from the deep water with their catch, the market on the quay, and the Mon Calamari and the Quarren pretending not to notice each other.', things: [{ kind: 'catamaran', at: [40, 20], yaw: 1.4 }, { kind: 'catamaran', at: [46, -16], yaw: 1.8 }, { kind: 'stall', at: [-8, 0] }, { kind: 'stall', at: [-8, 14], yaw: 0.4 }, { kind: 'crates', at: [10, -14] }, { kind: 'lamp', at: [0, -20], opts: { h: 5, light: '#ffcf8a' } }] },
      { id: 'inn', name: 'The inn', at: [-150, -150], r: 40, flat: { r: 32 }, about: 'Where the Mandalorian ate chowder, and the Quarren tried to drown him for it.', things: [{ kind: 'cantina', at: [0, 0], yaw: 0.6 }, { kind: 'barrels', at: [14, 10] }] },
      { id: 'dock', name: 'The freighter dock', at: [-180, 180], r: 50, flat: { r: 40 }, about: 'Where an Imperial freighter took on weapons the Remnant shouldn’t have, and Bo-Katan’s Nite Owls came aboard to take them back.', things: [{ kind: 'dockingbay', at: [0, 0], opts: { r: 18, h: 7 } }, { kind: 'gr75', at: [0, 30], yaw: 1.4, scale: 0.4 }] },
    ],
    scatter: [{ kind: 'reeds', n: 140, within: [30, 500], scale: [0.8, 1.6] }, { kind: 'rock', model: NATURE.rock, n: 60, within: [20, 500], scale: [0.6, 2.4], opts: { color: '#3a3c3a' } }],
    flora: { biome: 'tundra', tint: { Rocks: { recolour: '#3a3c3a' } } },
    things: [{ kind: 'crates', at: [10, 8] }, { kind: 'barrel', at: [-8, 10] }],
    life: [
      { kind: 'bokatan', id: 'bokatan', at: [-170, 166], still: true, face: 3.4, name: 'Bo-Katan Kryze', named: true, quest: 'freighter', says: ['You’re a Child of the Watch, aren’t you?', 'We take the weapons. We take back Mandalore.'] },
      { kind: 'mando', at: [-140, -140], still: true, face: 3, name: 'The Mandalorian', says: ['I’m looking for other Mandalorians.'] },
      { kind: 'ackbar', n: 2, at: [260, -40], spread: 18, roam: 10, speed: 0.7, name: 'Mon Calamari fisherman', says: ['Good catch today. Better than the Quarren’s.'] },
      { kind: 'villager', n: 3, at: [250, -20], spread: 18, roam: 10, speed: 0.7, name: 'Quarren fisherman', says: ['(A wet, unfriendly look.)', 'You want passage? Pay first.'] },
    ],
    quests: [
      { id: 'freighter', name: 'The Heiress', giver: 'bokatan', intro: [['Bo-Katan Kryze', 'The freighter’s guard is changing. Take them, and the weapons are ours.']], steps: [{ type: 'reach', at: [-170, 190], r: 24, text: 'Get to the freighter dock' }, { type: 'shoot', tag: 'docktroops', n: 7, text: 'Take the freighter’s guard', spawn: troops('docktroops', 7, [-186, 204]) }, { type: 'use', id: 'cargo', at: [-180, 200], r: 8, prompt: 'Open the hold', text: 'Open the freighter’s hold' }], done: [['Bo-Katan Kryze', 'Weapons enough for an army. Thank you, Mandalorian.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 140, speed: 40, every: 90 }],
  },

  corvus: {
    place: 'The burnt forest of Corvus',
    line: 'A forest burnt to grey sticks, ash on everything, and the walled city of Calodan held by a magistrate who burnt it.',
    sky: sky('#6a6e70', '#a8a6a0', '#e6dfd0', { hazeColor: '#a2a098', clouds: { cover: 0.7, color: '#bcbab4', shade: '#5c5c5a', scale: 0.5, speed: 0.004 } }),
    fog: { color: '#8e8c88', density: 0.0034 },
    light: { sun: 1.4, sky: '#8c9094', ground: '#4a4844', ambient: 0.85 },
    ground: { detail: 'ash', detailLook: { color: 0.7, normal: 0.8 }, seed: 95, layers: [{ type: 'swell', scale: 300, height: 6 }, { type: 'hills', scale: 120, height: 8 }, { type: 'mountains', from: 650, to: 2800, height: 260, scale: 1100 }], palette: palette('#5a5854', '#6a6864', '#3a3836', '#4a4642', { mark: '#2a2826' }) },
    weather: [{ kind: 'ash', count: 700 }],
    land: { at: [0, 0], yaw: 0.9 },
    places: [
      { id: 'calodan', name: 'Calodan', at: [250, 80], r: 80, flat: { r: 66 }, city: { plan: 'grid', r: 140, street: 9, block: 36, plaza: 36, kit: ['calodanhouse', { kind: 'calodanpagoda', weight: 0.12 }], clutter: { kinds: ['crates', 'barrels'], n: 2 }, crowd: { kinds: ['villager'], n: 14, name: 'Calodan villager', says: ['(They won’t meet your eyes. The guards are watching.)', 'The magistrate takes the trees, and then she takes the people.'] } }, about: 'The city behind its walls, the forest burnt to the stumps round it to feed the magistrate’s works, and her guards on every gate.', things: [{ kind: 'calodangate', at: [0, -40], yaw: Math.PI }, ...[[-36, 8, 1.57], [-36, 30, 1.57], [36, 8, -1.57], [36, 30, -1.57], [-30, 58, 2.4], [30, 58, -2.4]].map(([x, z, yaw], i) => ({ kind: 'calodanhouse', at: [x, z], yaw, scale: [1, 0.9, 1, 0.85, 0.95, 1][i] })), { kind: 'lookout', at: [-50, -44], opts: { h: 20 } }, { kind: 'lookout', at: [50, -44], opts: { h: 20 } }, { kind: 'plaza', at: [0, 20], opts: { w: 40, d: 30, fountain: true } }, { kind: 'calodanpagoda', at: [0, 46], yaw: Math.PI }] },
      { id: 'garden', name: 'The magistrate’s garden', at: [300, 170], r: 40, flat: { r: 30 }, about: 'The only green on Corvus: a garden walled in the city’s heart, where Morgan Elsbeth met Ahsoka with a staff of beskar.', things: [{ kind: 'jungletree', at: [0, 0] }, { kind: 'jungletree', at: [12, 10], scale: 0.8 }, { kind: 'pillars', at: [-14, 6], yaw: 1 }] },
      { id: 'forest', name: 'The burnt forest', at: [-200, -150], r: 60, about: 'Where Ahsoka Tano waited in the ash, and the magistrate’s men went out to find her and didn’t come back.', things: [...grove(95, 22, 6, 58, ['gnarltree', 'log'], [0.8, 1.6]), { kind: 'smoke', at: [10, 6], opts: { h: 40, n: 6, color: '#4a4846' } }] },
    ],
    scatter: [{ kind: 'gnarltree', n: 160, within: [40, 620], scale: [0.8, 1.6], opts: { color: '#3a3836' } }, { kind: 'log', model: NATURE.log, n: 60, within: [20, 500], scale: [0.7, 1.5] }, { kind: 'deadtree', model: 'kit:naturemega/DeadTree_2', n: 50, within: [60, 600], scale: [0.9, 1.3], clear: 25 }, { kind: 'deadtree', model: 'kit:naturemega/DeadTree_4', n: 40, within: [60, 600], scale: [0.9, 1.3], clear: 25 }],
    flora: { biome: 'tundra', tint: { Bark_DeadTree: { recolour: '#2e2a28' } } },
    things: [{ kind: 'crates', at: [10, -8] }],
    life: [
      { kind: 'ahsoka', id: 'ahsoka', at: [-190, -140], still: true, face: 2.8, name: 'Ahsoka Tano', named: true, quest: 'magistrate', says: ['The Magistrate has been burning this world for her war.', 'Grogu? I can feel him. He’s been hidden a long time.'] },
      { kind: 'mando', at: [-178, -148], still: true, face: 3, name: 'The Mandalorian', says: ['Bo-Katan sent me.'] },
      { kind: 'mercenary', at: [244, 22], still: true, face: 1, name: 'Lang', says: ['I’d think twice about it, friend.'] },
      { kind: 'civcity1', n: 4, at: [250, 80], spread: 30, roam: 12, speed: 0.6, name: 'Calodan villager', says: ['(They won’t meet your eyes. The guards are watching.)'] },
    ],
    quests: [
      { id: 'magistrate', name: 'The Jedi', giver: 'ahsoka', intro: [['Ahsoka Tano', 'Clear her guards off the walls, and I’ll go in for her.']], steps: [{ type: 'reach', at: [250, 30], r: 30, text: 'Get to Calodan’s gate' }, { type: 'shoot', tag: 'walls', n: 7, text: 'Clear the guards off the walls', spawn: { kind: 'mercenary', n: 7, at: [250, 20], spread: 30, roam: 6, hp: 3, tag: 'walls', hostile: hostile(44, 2, 8) } }, { type: 'reach', at: [300, 170], r: 20, text: 'Get to the magistrate’s garden' }], done: [['Ahsoka Tano', 'Where is Grand Admiral Thrawn? She’ll tell us. Eventually.']] },
    ],
    flyovers: [],
  },

  morak: {
    place: 'The rhydonium refinery on Morak',
    line: 'Hot jungle, the Empire’s refinery cut into it, and juggernauts of volatile fuel crawling down the one road out.',
    sky: sky('#7ea2b8', '#d0d8c0', '#fff4da', { hazeColor: '#c4ccb4', clouds: { cover: 0.55, color: '#f2f4ea', shade: '#9aa48e', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#a8b49a', density: 0.0028 },
    light: { sun: 2.4, sky: '#b4c4c8', ground: '#4a5a32', ambient: 0.85 },
    ground: { detail: 'leaves', detailLook: { color: 0.8, normal: 0.7 }, seed: 96, layers: [{ type: 'swell', scale: 320, height: 10 }, { type: 'hills', scale: 120, height: 14 }, { type: 'ridges', scale: 260, height: 18 }, { type: 'mountains', from: 600, to: 2600, height: 360, scale: 1000 }], palette: palette('#4a4a2e', '#3e5030', '#5a5a4a', '#5a4a34', { mark: '#2e2a1c' }) },
    weather: [{ kind: 'motes', count: 260 }],
    land: { at: [0, 0], yaw: 4.2 },
    places: [
      { id: 'refinery', name: 'The refinery', at: [240, -140], r: 80, flat: { r: 66 }, about: 'Where the Empire, or what’s left of it, turns rhydonium into fuel: towers, tanks and a terminal in the officers’ mess with the Remnant’s records on it.', things: [{ kind: 'morakrefinery', at: [24, -22], yaw: 0.4, scale: 0.7 }, { kind: 'bunker', at: [-36, 26], yaw: 2, opts: { w: 18, d: 12 } }, { kind: 'turret', at: [-40, -30], yaw: 3, opts: { color: '#5e605c' } }, { kind: 'smoke', at: [0, 0], opts: { h: 70, n: 8, color: '#4a4844' } }] },
      { id: 'road', name: 'The convoy road', at: [-60, 220], r: 50, flat: { r: 30 }, about: 'The road the juggernauts take out of the jungle, slow and careful: one wrong bump and a load of rhydonium goes up.', things: [{ kind: 'juggernaut', at: [0, 0], yaw: 1.2 }, { kind: 'crates', at: [14, -10] }] },
      { id: 'ridge', name: 'The pirates’ ridge', at: [-240, -60], r: 40, about: 'Where the pirates wait for the convoys, and where Mayfeld nearly lost the ride to the refinery.', things: grove(96, 10, 6, 34, ['jungletree'], [0.8, 1.4]) },
    ],
    scatter: [{ kind: 'jungletree', n: 200, within: [40, 620], scale: [0.8, 1.6] }, { kind: 'fern', model: NATURE.bush, n: 120, within: [10, 400], scale: [0.8, 1.5], solid: false }, { kind: 'plant', model: NATURE.shrub, n: 120, within: [10, 300], scale: [1, 1.8], solid: false }],
    flora: { biome: 'jungle' },
    things: [{ kind: 'crates', at: [-10, 8] }],
    life: [
      { kind: 'mercenary', id: 'mayfeld', at: [-48, 206], still: true, face: 3.4, name: 'Migs Mayfeld', named: true, quest: 'terminal', says: ['Everybody’s got a little Imperial in them.', 'We drive the juggernaut in, we walk out with the coordinates. Easy.'] },
      { kind: 'mando', at: [-36, 212], still: true, face: 3, name: 'The Mandalorian', says: ['I can’t take my helmet off. Not in front of people.'] },
      { kind: 'stormtrooper', n: 4, at: [216, -118], spread: 22, roam: 16, speed: 1, name: 'Stormtrooper', says: ['Convoy’s late. Again.'] },
      { kind: 'officer', at: [210, -116], still: true, face: 2, name: 'Valin Hess', says: ['Some say it’s freedom. Others say it’s chaos.'] },
    ],
    quests: [
      { id: 'terminal', name: 'The Believer', giver: 'mayfeld', intro: [['Migs Mayfeld', 'The terminal’s in the officers’ mess. Get us past the pirates on the ridge first, or there’s no refinery to get to.']], steps: [{ type: 'shoot', tag: 'pirates', at: [-240, -60], n: 6, text: 'Drive off the pirates on the ridge', spawn: { kind: 'aqualish', n: 6, at: [-232, -70], spread: 14, roam: 6, hp: 2, tag: 'pirates', hostile: hostile(42, 2.2, 7) } }, { type: 'reach', at: [210, -116], r: 20, text: 'Get into the refinery' }, { type: 'use', id: 'terminal', at: [204, -112], r: 6, prompt: 'Use the terminal', text: 'Get Moff Gideon’s coordinates from the terminal' }], done: [['Migs Mayfeld', 'You didn’t see a thing. Right?']] },
    ],
    flyovers: [{ kind: 'tie', n: 1, metres: 7, alt: 110, speed: 110, every: 90 }],
  },

  plazir: {
    place: 'The dome city of Plazir-15',
    line: 'A sealed world under a dome: pastel towers, clipped lawns, a Duchess who wants nothing to happen, and droids who keep making things happen.',
    sky: sky('#9ac2e2', '#f2e2d6', '#fff8ec', { hazeColor: '#f0e0d8', clouds: { cover: 0.15, color: '#ffffff', shade: '#d8c8c8', scale: 0.8, speed: 0.003 } }),
    fog: { color: '#e6dcd6', density: 0.0009 },
    light: { sun: 2.8, sky: '#d4dcea', ground: '#9aac7a', ambient: 0.9 },
    ground: { detail: 'grass', detailLook: { color: 0.6, normal: 0.5 }, seed: 97, layers: [{ type: 'swell', scale: 500, height: 3 }, { type: 'hills', scale: 200, height: 3 }, { type: 'mountains', from: 650, to: 2400, height: 220, scale: 900 }], palette: palette('#88a462', '#9ab872', '#c4b4a8', '#d8c8b8', { mark: '#6a844a', road: '#d4ccc0' }) },
    grass: { h: [0.08, 0.16], w: 0.04, root: '#6a844a', mid: '#88a462', tip: '#a8c47e', dry: '#b4c48a', cover: 0.95, scale: 200, wind: 0.1 },
    weather: [],
    land: { at: [0, 0], yaw: 3.2 },
    places: [
      { id: 'palace', name: 'The Duchess’s palace', at: [240, -60], r: 70, flat: { r: 60 }, city: { plan: 'rings', r: 170, street: 10, block: 30, plaza: 66, kit: ['plazirvilla'], clutter: { kinds: ['crates'], n: 0 }, crowd: { kinds: ['villager'], n: 14, name: 'Plazirian', says: ['Isn’t Plazir-15 wonderful? Nothing ever goes wrong here.', 'The droids do the work. We do the dinners.'] }, traffic: { kind: 'airspeeder', n: 4, y: 18 } }, about: 'Pale stone and gardens: the seat of a government elected because nobody else wanted the job, where the Duchess holds court and the Captain keeps the peace.', things: [{ kind: 'plazirdome', at: [0, -14], scale: 0.7 }, { kind: 'plaza', at: [0, 40], opts: { w: 50, d: 30, fountain: true } }, { kind: 'statue', at: [-22, 40], opts: { h: 10 } }, { kind: 'statue', at: [22, 40], opts: { h: 10 } }] },
      { id: 'resistor', name: 'The Resistor', at: [-180, -160], r: 40, flat: { r: 32 }, about: 'A bar for droids, run by droids, and the one place on Plazir the droids say what they think.', things: [{ kind: 'club', at: [0, 0], yaw: 0.8 }, { kind: 'lamp', at: [12, 10], opts: { h: 4, light: '#ff7ad0' } }] },
      { id: 'docks', name: 'The droid docks', at: [-150, 220], r: 46, flat: { r: 38 }, about: 'Where the reprogrammed Separatist droids work the cargo, and where they started to go wrong.', things: [{ kind: 'dockingbay', at: [0, 0], opts: { r: 16, h: 6 } }, { kind: 'crates', at: [20, 10] }, { kind: 'crates', at: [-18, 12], yaw: 1 }] },
    ],
    flora: { biome: 'plains', trees: true },
    things: [{ kind: 'statue', at: [-16, 12], opts: { h: 8 } }],
    life: [
      { kind: 'villager', id: 'duchess', at: [228, -20], still: true, face: 3, name: 'The Duchess', named: true, quest: 'droids', says: ['We don’t like violence here. We have people for that.', 'Our droids have been behaving… creatively.'] },
      { kind: 'villager', at: [250, -20], still: true, face: 3.4, name: 'Captain Bombardier', says: ['Everyone stays calm. That’s an order.'] },
      { kind: 'bokatan', at: [214, -24], still: true, face: 2.8, name: 'Bo-Katan Kryze', says: ['They want a favour. We want their help. Do the favour.'] },
      { kind: 'battledroid', n: 3, at: [-150, 220], spread: 18, roam: 10, speed: 0.8, name: 'Reprogrammed droid', says: ['I enjoy my work. I enjoy my work. I enjoy…'] },
      { kind: 'civcity3', n: 4, at: [240, -20], spread: 24, roam: 14, speed: 0.6, name: 'Plazir citizen', says: ['Lovely weather. It’s always lovely weather. The dome sees to that.'] },
    ],
    quests: [
      { id: 'droids', name: 'Guns for Hire', giver: 'duchess', intro: [['The Duchess', 'Some of our droids have gone wrong at the docks. Find out why, and fix it. Quietly.']], steps: [{ type: 'reach', at: [-180, -160], r: 24, text: 'Ask about it at the Resistor' }, { type: 'reach', at: [-150, 220], r: 30, text: 'Go to the droid docks' }, { type: 'shoot', tag: 'rogues', n: 5, text: 'Stop the droids that have gone wrong', spawn: { kind: 'battledroid', n: 5, at: [-140, 230], spread: 14, roam: 6, hp: 2, tag: 'rogues', hostile: hostile(38, 2.2, 6) } }], done: [['The Duchess', 'The commissioner, all along? How tiresome. Thank you.']] },
    ],
    flyovers: [{ kind: 'shuttle', n: 1, metres: 20, alt: 100, speed: 40, every: 100 }],
  },

  seatos: {
    place: 'The temple on Seatos',
    line: 'Green cliffs over a grey sea, and the ruins of a temple older than anyone remembers, with a map hidden in it.',
    sky: sky('#7a98b4', '#d4dad4', '#fff4e0', { hazeColor: '#cdd4ce', clouds: { cover: 0.55, color: '#f4f6f4', shade: '#98a2a4', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#b8c2c0', density: 0.0018 },
    light: { sun: 2.2, sky: '#b4c2cc', ground: '#4e6040', ambient: 0.85 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.7 }, seed: 98, layers: [{ type: 'island', at: [0, 0], r: 500, height: 28, core: 0.55, ragged: 0.25 }, { type: 'swell', scale: 260, height: 6 }, { type: 'hills', scale: 110, height: 8 }, { type: 'mountains', from: 900, to: 3000, height: 200, scale: 1200 }], palette: palette('#3e4a36', '#56683e', '#5a5a52', '#6a7646', { hLow: 2, hHigh: 30, rockAt: 0.34, mark: '#2e3828', wet: { level: -1, band: 2, color: '#2a2e2a' } }) },
    water: { level: -1, color: '#4a6068', deep: '#22323c', kind: 'sea', foam: 0.2 },
    grass: { h: [0.25, 0.55], w: 0.05, root: '#36442a', mid: '#566a3a', tip: '#8a9c5e', dry: '#8e8e5c', cover: 0.7, scale: 80, wind: 0.8, above: 2 },
    weather: [],
    land: { at: [0, 0], yaw: 5.2 },
    places: [
      { id: 'temple', name: 'The temple ruins', at: [220, -100], r: 60, flat: { r: 46 }, about: 'Walls and stairs of a people nobody remembers, and under the floor, a chamber the Jedi never found, with a map in it that goes to another galaxy.', things: [...ring(6, 38, 0.5).map(([x, z, yaw], i) => ({ kind: 'seatosmonolith', at: [x, z], yaw, scale: [1, 0.8, 0.9, 1.1, 0.85, 0.95][i] }))] },
      { id: 'cliffs', name: 'The sea cliffs', at: [-280, 240], r: 46, about: 'Where the island falls into the sea, and the wind comes straight off the water at you.', things: grove(98, 8, 6, 36, ['needle'], [0.4, 0.8]) },
      { id: 'landing', name: 'The shuttle’s landing', at: [-140, -170], r: 40, flat: { r: 32 }, about: 'Where Baylan Skoll and Shin Hati set down, a step behind Ahsoka, as they would be all the way to Peridea.', things: [{ kind: 'mpad', at: [0, 0], opts: { r: 14 } }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.rock, n: 80, within: [20, 460], scale: [0.6, 2.6], opts: { color: '#5a5a52' } }],
    flora: { biome: 'temperate', trees: false, tint: { Rocks: { recolour: '#5a5a52' } } },
    things: [{ kind: 'crates', at: [10, -8] }],
    life: [
      { kind: 'ahsoka', id: 'ahsoka', at: [200, -84], still: true, face: 3.2, name: 'Ahsoka Tano', named: true, quest: ['map', 'shin'], says: ['The map is here. I can feel it.', 'Huyang, keep the ship warm.'] },
      { kind: 'droid', at: [-20, 16], still: true, face: 1.2, name: 'Huyang', says: ['I have built lightsabers for three thousand years. I do not do sentry duty.'] },
    ],
    quests: [
      { id: 'map', name: 'Master and Apprentice', giver: 'ahsoka', intro: [['Ahsoka Tano', 'The pieces of the mechanism are in the ruins. Find them, and the map will open for us.']], steps: [{ type: 'collect', item: 'piece', n: 3, spots: [[208, -116], [236, -90], [226, -122]], text: 'Find the pieces of the mechanism in the ruins' }, { type: 'use', id: 'map', at: [220, -100], r: 8, prompt: 'Open the chamber', text: 'Open the map’s chamber', end: [{ shake: 0.5 }, { say: [[null, '(The floor drops away into stairs. At the bottom, a sphere of etched stone: the map.)']] }] }], done: [['Ahsoka Tano', 'A map to Thrawn. Now everyone will want it.']] },
      { id: 'shin', name: 'Shin Hati', giver: 'ahsoka', intro: [['Ahsoka Tano', 'Someone landed behind us. A Dark Jedi’s apprentice, by the feel of her.']], steps: [{ type: 'reach', at: [-130, -150], r: 24, text: 'Go to the shuttle’s landing' }, { type: 'shoot', tag: 'shin', n: 1, text: 'Face Shin Hati', lines: [[null, '(She lights an orange blade, and smiles.)']], spawn: { kind: 'shin', at: [-140, -170], hp: 8, leash: 26, roam: 3, tag: 'shin', hostile: { range: 16, chase: 2.4, melee: true, reach: 2.8, every: 1.4, damage: 14, delay: 1, parry: 0.65, riposte: 0.3, guard: 3, blade: { color: '#ff8a1e' } } } }], done: [['Ahsoka Tano', 'She’ll be back. Her master too.']] },
    ],
    flyovers: [],
  },
};
