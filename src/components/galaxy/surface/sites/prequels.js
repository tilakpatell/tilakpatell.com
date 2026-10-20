// The charted worlds of the prequels, from the ground (charted/republic.js
// has them in the galaxy): Utapau, Mygeeto, Saleucami, Cato Neimoidia,
// Polis Massa and Malastare, each a free roam at its film's moment. (sites/
// index.js has what a site is.)

import { grove } from './stand';
import { sky, palette, hostile, NATURE } from './outerKit';

// n spots evenly round a circle of radius r (a turn of `phase` first), each [x, z, yaw] facing the middle
const ring = (n, r, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2];
  });
const droids = (tag, n, at, kind = 'battledroid') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(40, 2.2, 7) });

export const SITES = {
  utapau: {
    place: 'The sinkholes of Utapau',
    line: 'Bare rock in a wind that never stops, and the cities down the sinkholes, out of it.',
    sky: sky('#8fb2c4', '#e6d6b2', '#fff0d0', { clouds: { cover: 0.2, color: '#f4ecdc', shade: '#b0a48c', scale: 0.7, speed: 0.008 } }),
    fog: { color: '#d8caa8', density: 0.0012 },
    light: { sun: 2.7, sky: '#c4d0d8', ground: '#a8946e', ambient: 0.8 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.8 }, seed: 71, wind: 1.2, layers: [{ type: 'swell', scale: 420, height: 6 }, { type: 'mesas', scale: 520, height: 36, cover: 0.3, cliff: 0.05 }, { type: 'ridges', scale: 140, height: 3 }, { type: 'mountains', from: 650, to: 3000, height: 360, scale: 1200 }], palette: palette('#b39a72', '#cdb88e', '#7c6a52', '#9a8462', { mark: '#6a5a44' }) },
    weather: [{ kind: 'sand', count: 320 }],
    land: { at: [0, 0], yaw: 0.6 },
    places: [
      // (the capital down the deepest sinkhole: a pit, its landing pads round the rim and a bridge across it)
      { id: 'pau', name: 'Pau City', at: [250, 110], r: 90, pits: [{ at: [0, 0], r: 58, depth: 46 }], about: 'The capital, built down the walls of the deepest sinkhole, a landing platform on every level. General Grievous waited on the tenth.', things: [{ kind: 'skybridge', at: [0, 0], yaw: 0.3, opts: { len: 128, w: 5 } }, ...ring(5, 76, 0.4).map(([x, z, yaw]) => ({ kind: 'mpad', at: [x, z], yaw, opts: { r: 9 } })), ...ring(5, 100, 1.03).slice(0, 3).map(([x, z, yaw], i) => ({ kind: 'pautower', at: [x, z], yaw, scale: [1, 0.85, 0.92][i] })), { kind: 'lamp', at: [70, 20] }, { kind: 'crates', at: [64, -30] }] },
      { id: 'pens', name: 'The varactyl pens', at: [-190, 150], r: 40, flat: { r: 34 }, about: 'Where the Pau’ans keep their mounts: varactyls, that run up sheer rock as if it were flat ground.', things: [{ kind: 'tent', at: [0, 0], opts: { r: 4, h: 3.4, sides: 6, color: '#7a6248' } }, { kind: 'tent', at: [12, 8], yaw: 1, opts: { r: 3, h: 3, sides: 6, color: '#86704e' } }, { kind: 'fire', at: [4, -6] }, { kind: 'crates', at: [-8, 6] }] },
      { id: 'command', name: 'The Separatist command post', at: [-160, -230], r: 46, flat: { r: 38 }, about: 'The Confederacy’s last headquarters before Mustafar: a bunker on the plateau, its guns on the sinkhole road.', things: [{ kind: 'bunker', at: [0, 0], yaw: 0.7, opts: { w: 18, d: 12 } }, { kind: 'turret', at: [16, 14], yaw: 2, opts: { color: '#8a7a64' } }, { kind: 'droidplatform', at: [-18, 8], yaw: 1.2 }, { kind: 'crates', at: [10, -14] }] },
      { id: 'rim', name: 'The windward rim', at: [80, -320], r: 40, about: 'The edge of the plateau, where the wind comes off the plains below and the rock is cut into fins.', things: grove(41, 9, 6, 36, ['needle'], [0.5, 0.9]) },
    ],
    flora: { biome: 'dry', game: 'badlands', tint: { Rocks: { recolour: '#a89c88' } } },
    things: [{ kind: 'crates', at: [-12, 8] }, { kind: 'barrel', at: [-9, 11], yaw: 0.4 }],
    life: [
      { kind: 'obiwan', id: 'kenobi', at: [232, 40], still: true, face: 2.6, name: 'Obi-Wan Kenobi', named: true, quest: 'grievous', says: ['Hello there.', 'The general’s on the tenth level. I’ll need the droids kept busy.'] },
      { kind: 'villager', id: 'medon', at: [276, 30], still: true, face: 3.2, name: 'Tion Medon', named: true, quest: 'command', says: ['We are not at war here. The droids came, and we were made to keep them.', 'Ten thousand of them, at least.'] },
      { kind: 'villager', n: 4, at: [-190, 150], spread: 14, roam: 10, speed: 0.8, name: 'Pau’an keeper', says: ['Boga is the fastest of them. She was taken by a Jedi, they say.', 'Keep to the rock. The wind will have you off the rim.'] },
      { kind: 'varactyl', n: 3, at: [-200, 160], spread: 18, roam: 22, speed: 1.6, r: 1.6 },
      { kind: 'battledroid', n: 4, at: [-160, -230], spread: 18, roam: 10, speed: 1, name: 'B1 battle droid', says: ['Roger, roger.'] },
    ],
    quests: [
      { id: 'grievous', name: 'The tenth level', giver: 'kenobi', intro: [['Obi-Wan Kenobi', 'Grievous is here. Clear the droids off the pads round the rim, and I’ll take care of the rest.']], steps: [{ type: 'reach', at: [318, 146], r: 26, text: 'Get to the landing pads on the sinkhole’s rim' }, { type: 'shoot', tag: 'paudroids', n: 7, text: 'Clear the droids off the landing pads', spawn: [droids('paudroids', 5, [326, 160]), droids('paudroids', 2, [330, 150], 'superdroid')] }], done: [['Obi-Wan Kenobi', 'So uncivilised. Thank you.']] },
      { id: 'command', name: 'The droids’ guns', giver: 'medon', intro: [['Tion Medon', 'Their command post on the plateau has guns on our road. Silence it and the city can breathe.']], steps: [{ type: 'shoot', tag: 'postdroids', at: [-160, -230], n: 6, text: 'Take the Separatist command post', spawn: droids('postdroids', 6, [-160, -230]) }, { type: 'use', id: 'guns', at: [-160, -230], r: 8, prompt: 'Shut the guns down', text: 'Shut the post’s guns down', end: [{ sound: 'crash' }, { shake: 0.5 }] }], done: [['Tion Medon', 'Utapau thanks you. Quietly, as we do everything.']] },
    ],
    flyovers: [{ kind: 'gunship', n: 1, metres: 18, alt: 120, speed: 70, every: 70 }, { kind: 'vulture', n: 2, metres: 7, alt: 140, speed: 120, every: 80 }],
  },

  mygeeto: {
    place: 'The crystal cities of Mygeeto',
    line: 'Ice, wind and the Muuns’ towers of crystal, the banking clan’s vaults under them, and a war on the bridges between.',
    sky: sky('#5a6c8a', '#c8d4e2', '#f0f4ff', { hazeColor: '#d4dcea', clouds: { cover: 0.75, color: '#e4eaf2', shade: '#8a96a8', scale: 0.5, speed: 0.01 } }),
    fog: { color: '#c2ccd8', density: 0.0024 },
    light: { sun: 1.9, sky: '#b4c2d6', ground: '#c8d2e0', ambient: 0.95 },
    ground: { detail: 'snow', detailLook: { color: 0.5, normal: 0.6 }, seed: 72, wind: 0.9, layers: [{ type: 'swell', scale: 380, height: 8 }, { type: 'ridges', scale: 220, height: 14, wind: 0.9 }, { type: 'dunes', scale: 30, height: 1.2, wind: 0.9 }, { type: 'mountains', from: 600, to: 2600, height: 520, scale: 1000 }], palette: palette('#dfe6ef', '#f2f6fb', '#6c7a90', '#b8c6da', { sparkle: 0.6, mark: '#9aaac0' }) },
    weather: [{ kind: 'snow', count: 900 }],
    land: { at: [0, 0], yaw: 2.4 },
    places: [
      { id: 'towers', name: 'The crystal towers', at: [260, -80], r: 80, flat: { r: 64 }, about: 'The Muuns’ city: towers of the planet’s own crystal, grown up out of the ice, and glowing from inside where the power still runs.', things: [{ kind: 'mygeetotower', at: [0, 0], yaw: 0.3 }, { kind: 'mygeetotower', at: [50, 34], yaw: 1.4, scale: 0.8 }, { kind: 'mygeetotower', at: [-44, 40], yaw: 2.2, scale: 0.66 }, ...grove(72, 14, 40, 70, ['glassshard'], [1.4, 3.2])] },
      { id: 'bridge', name: 'The broken bridge', at: [-60, -260], r: 50, flat: { r: 30 }, about: 'Where Ki-Adi-Mundi led the Galactic Marines across, and where his own men turned their guns on him.', things: [{ kind: 'skybridge', at: [0, 0], yaw: 1.1, opts: { len: 80, w: 7 } }, { kind: 'barricade', at: [-12, 18], yaw: 1.1, opts: { len: 12 } }, { kind: 'barricade', at: [14, -16], yaw: 1.1, opts: { len: 10 } }] },
      { id: 'vaults', name: 'The banking clan’s vaults', at: [-250, 120], r: 44, flat: { r: 36 }, about: 'The InterGalactic Banking Clan kept the Separatists’ money here, behind doors the clones were sent to open.', things: [{ kind: 'datavault', at: [0, 0], yaw: 0.6, opts: { hw: 10, hd: 22, h: 16 } }, ...grove(73, 8, 24, 40, ['glassshard'], [1.2, 2.4])] },
      { id: 'crags', name: 'The ice crags', at: [120, 300], r: 30, about: 'Shards of crystal as tall as a gunship, half buried in the ice. The wind sings through them.', things: grove(74, 12, 6, 30, ['glassshard'], [1.6, 3.6]) },
    ],
    scatter: [{ kind: 'glassshard', n: 140, within: [30, 620], scale: [0.8, 2.6], sink: 0.4, solid: 0.4 }, { kind: 'snowrock', n: 90, within: [20, 560], scale: [0.6, 2], sink: 0.4 }, { kind: 'iceblock', n: 24, at: [120, 300], within: [8, 70], scale: [1.4, 3], sink: 0.5 }, { kind: 'iceblock', n: 10, at: [-250, 120], within: [30, 60], scale: [1.2, 2.4], sink: 0.5 }],
    flora: { biome: 'tundra', tint: { Rocks: { recolour: '#9aa6b4' } } },
    things: [{ kind: 'crates', at: [10, -12], opts: { color: '#6a7488' } }],
    life: [
      { kind: 'clone', id: 'bacara', at: [-52, -230], still: true, face: 3.4, name: 'Commander Bacara', named: true, quest: 'bridge', says: ['Galactic Marines, hold this line.', 'The bridge is ours by nightfall, General.'] },
      { kind: 'clone', n: 5, at: [-70, -230], spread: 14, roam: 8, speed: 1, name: 'Galactic Marine', says: ['Cold enough for you?', 'Droids on the far side. Keep your head down.'] },
      { kind: 'clone', id: 'vaultsgt', at: [-230, 104], still: true, face: 4, name: 'A clone sergeant', quest: 'vaults', says: ['The doors are tougher than the droids.'] },
    ],
    quests: [
      { id: 'bridge', name: 'Hold the bridge', giver: 'bacara', intro: [['Commander Bacara', 'The droids are coming over the bridge. Hold it till the walkers are across.']], steps: [{ type: 'reach', at: [-60, -260], r: 30, text: 'Get to the bridge' }, { type: 'shoot', tag: 'bridgedroids', n: 8, text: 'Hold the bridge against the droids', time: 150, spawn: [droids('bridgedroids', 6, [-30, -300]), droids('bridgedroids', 2, [-36, -292], 'superdroid')] }], done: [['Commander Bacara', 'The bridge holds. Good work.']] },
      { id: 'vaults', name: 'The vaults', giver: 'vaultsgt', intro: [['A clone sergeant', 'Three charge packs to blow the vault doors. They’re out in the crags where the gunship dropped them.']], steps: [{ type: 'collect', item: 'charge', n: 3, spots: [[110, 290], [138, 316], [96, 322]], text: 'Find the charge packs in the crags' }, { type: 'use', id: 'doors', at: [-250, 120], r: 8, prompt: 'Set the charges', text: 'Blow the vault doors', end: [{ shake: 1 }, { sound: 'crash' }] }], done: [['A clone sergeant', 'That’s the Separatists’ money gone. Good.']] },
    ],
    flyovers: [{ kind: 'gunship', n: 2, metres: 18, alt: 140, speed: 60, every: 60 }],
  },

  saleucami: {
    place: 'The fungal plains of Saleucami',
    line: 'A dry world dotted with the giant fungus that grows where nothing else will, and the clones’ speeder bikes out among it.',
    sky: sky('#8aa6c2', '#e2d2b6', '#fff2d6', { clouds: { cover: 0.25, color: '#f6efe2', shade: '#a89c88', scale: 0.7, speed: 0.006 } }),
    fog: { color: '#d4c6a8', density: 0.001 },
    light: { sun: 2.6, sky: '#c0ccd8', ground: '#a29068', ambient: 0.8 },
    ground: { detail: 'sand', detailLook: { color: 0.7, normal: 0.7, metres: 6 }, seed: 73, wind: 0.6, layers: [{ type: 'swell', scale: 480, height: 8 }, { type: 'hills', scale: 160, height: 6 }, { type: 'dunes', scale: 54, height: 3, wind: 0.6 }, { type: 'mountains', from: 700, to: 3000, height: 300, scale: 1300 }], palette: palette('#b8a07a', '#cfbb94', '#8a7458', '#9c8a5e', { mark: '#7a6648' }) },
    weather: [{ kind: 'sand', count: 260 }],
    land: { at: [0, 0], yaw: 1.4 },
    places: [
      { id: 'grove', name: 'The fungus grove', at: [220, 160], r: 30, about: 'A clearing where the fungus grows thickest: domes and stalks taller than a house, in every colour the desert lacks. Stass Allie was riding through it when the order came.', things: grove(75, 6, 8, 26, ['karst'], [1.2, 2]) },
      { id: 'crater', name: 'The crater city', at: [-200, -170], r: 60, flat: { r: 48 }, about: 'Saleucami’s towns are built in old craters, out of the wind: domed houses round a well.', things: [...ring(5, 28, 0.3).map(([x, z, yaw], i) => ({ kind: 'lawquanefarm', at: [x, z], yaw, scale: [1, 0.85, 0.92, 1, 0.8][i] })), { kind: 'stall', at: [0, 8] }, { kind: 'vaporator', at: [-6, -4] }] },
      { id: 'scouts', name: 'The scouts’ camp', at: [-160, 220], r: 36, flat: { r: 28 }, about: 'Clone scouts camped with their bikes, out on the plain where the Separatists’ last droids hide.', things: [{ kind: 'tent', at: [0, 0], opts: { r: 3.4, h: 3, sides: 6, color: '#5a5e48' } }, { kind: 'speederbike', at: [8, 6], yaw: 1 }, { kind: 'speederbike', at: [10, -4], yaw: 1.4 }, { kind: 'crates', at: [-8, 4] }] },
    ],
    scatter: [{ kind: 'fungus', n: 70, at: [220, 160], within: [10, 110], scale: [1.6, 3.8], solid: 0.5 }, { kind: 'fungus', n: 110, within: [40, 600], scale: [1, 3], solid: 0.5 }, { kind: 'rock', model: NATURE.mudrock, n: 70, within: [20, 560], scale: [0.8, 2.6], opts: { color: '#8a7458' } }, { kind: 'stones', model: NATURE.canyon, n: 90, within: [8, 360], scale: [0.5, 1.2], solid: false, opts: { color: '#8a7458' } }],
    flora: { biome: 'dry', tint: { Rocks: { recolour: '#9a8262' } } },
    things: [{ kind: 'barrel', at: [12, 10] }],
    rides: [{ kind: 'speederbike', at: [14, -8], yaw: 1.6 }],
    life: [
      { kind: 'clone', id: 'scout', at: [-150, 214], still: true, face: 2.2, name: 'A clone scout', quest: 'patrol', says: ['Droids out past the grove. We ride at dawn.', 'Mind the fungus. It’s harder than it looks.'] },
      { kind: 'clone', n: 2, at: [-160, 220], spread: 8, roam: 6, speed: 1, name: 'Clone scout', says: ['Bikes are fuelled.'] },
      { kind: 'villager', n: 4, at: [-200, -170], spread: 18, roam: 12, speed: 0.8, name: 'Saleucami farmer', says: ['The clones are polite enough. It’s the droids I don’t trust.', 'The fungus is good eating, if you know which.'] },
    ],
    quests: [
      { id: 'patrol', name: 'The patrol', giver: 'scout', intro: [['A clone scout', 'Take a bike through the grove and flush out the droids hiding in it.']], steps: [{ type: 'ride', kind: 'speederbike', text: 'Get on a speeder bike' }, { type: 'race', ride: 'speederbike', gates: [[-100, 170], [0, 160], [120, 190], [200, 160], [250, 120]], r: 14, time: 50, text: 'Ride through the fungus grove' }, { type: 'shoot', tag: 'grovedroids', at: [230, 160], n: 5, text: 'Flush out the droids', spawn: droids('grovedroids', 5, [236, 150]) }], done: [['A clone scout', 'Clear. Good riding.']] },
    ],
    flyovers: [{ kind: 'gunship', n: 1, metres: 18, alt: 110, speed: 60, every: 90 }],
  },

  catoneimoidia: {
    place: 'The bridge cities of Cato Neimoidia',
    line: 'Cities slung between great arches of rock over misted valleys: the Trade Federation’s richest world, and its most guarded.',
    sky: sky('#7c90a8', '#d2d8dc', '#fff4e0', { hazeColor: '#c8d0d4', clouds: { cover: 0.55, color: '#eef0f0', shade: '#98a0a8', scale: 0.5, speed: 0.005 } }),
    fog: { color: '#b8c2c8', density: 0.0026 },
    light: { sun: 2.2, sky: '#b8c4d0', ground: '#6a7258', ambient: 0.85 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, seed: 74, layers: [{ type: 'swell', scale: 300, height: 10 }, { type: 'ridges', scale: 180, height: 24 }, { type: 'channels', scale: 420, depth: 18, width: 0.08 }, { type: 'mountains', from: 600, to: 2600, height: 480, scale: 900 }], palette: palette('#5a6a46', '#6e7c52', '#5c5852', '#7c7a5e', { mark: '#4a5238' }) },
    weather: [],
    land: { at: [0, 0], yaw: 3 },
    places: [
      { id: 'bridgecity', name: 'The bridge city', at: [240, 60], r: 80, flat: { r: 56 }, about: 'A Neimoidian city hung from an arch of rock: halls and hangars on the span, and nothing under them but mist.', things: [{ kind: 'catobridge', at: [0, -16], yaw: 0.2, solid: false }, { kind: 'hangar', at: [0, 26], yaw: 0.2, opts: { w: 40, d: 28, h: 16 } }] },
      { id: 'crash', name: 'Plo Koon’s crash', at: [-180, -200], r: 40, about: 'Where the Jedi Master’s starfighter came down, shot out of the sky by his own wingmen when Order 66 came.', things: [{ kind: 'probewreck', at: [0, 0], yaw: 0.8, scale: 1.4 }, { kind: 'wrecksmoke', at: [2, 0], opts: { h: 18 } }] },
      { id: 'palace', name: 'The viceroy’s palace', at: [-220, 170], r: 50, flat: { r: 40 }, about: 'Nute Gunray’s seat on his homeworld, its treasury under it: the Federation’s wealth, and its droids standing over it.', things: [{ kind: 'skyscraper', at: [0, 0], opts: { style: 1, h: 90, w: 26, seed: 7 } }, { kind: 'plaza', at: [0, 34], opts: { w: 40, d: 24 } }, { kind: 'droidplatform', at: [26, 18], yaw: 2 }] },
    ],
    scatter: [{ kind: 'karst', n: 60, within: [60, 600], scale: [2, 5], solid: 0.6 }, { kind: 'jungletree', n: 80, within: [40, 600], scale: [0.8, 1.4] }],
    flora: { biome: 'temperate', trees: false, tint: { Rocks: { recolour: '#6a6658' } } },
    grass: { h: [0.3, 0.6], w: 0.05, root: '#3e4a2c', mid: '#5a6a3c', tip: '#8a9a5e', dry: '#8a8a5c', cover: 0.6, scale: 90, wind: 0.4 },
    things: [{ kind: 'crates', at: [-10, 10] }],
    life: [
      { kind: 'neimoidian', id: 'deputy', at: [252, 80], still: true, face: 3.4, name: 'A Neimoidian deputy viceroy', named: true, quest: 'treasury', says: ['The viceroy is away. Indefinitely, we hope.', 'Our droids are expensive. Please don’t break them.'] },
      { kind: 'neimoidian', n: 3, at: [240, 60], spread: 20, roam: 12, speed: 0.7, name: 'Neimoidian clerk', says: ['Everything here has a price.'] },
      { kind: 'battledroid', n: 4, at: [-220, 170], spread: 16, roam: 8, speed: 1, name: 'B1 battle droid', says: ['Roger, roger.'] },
      { kind: 'clone', id: 'wolfpack', at: [-170, -186], still: true, face: 2, name: 'A Wolfpack trooper', quest: 'wolfpack', says: ['He was a good general. I don’t understand it either.'] },
    ],
    quests: [
      { id: 'wolfpack', name: 'The crash site', giver: 'wolfpack', intro: [['A Wolfpack trooper', 'The general’s fighter is down in the valley, and the droids are picking it over. Get there first.']], steps: [{ type: 'reach', at: [-180, -200], r: 30, text: 'Get to the crash site' }, { type: 'shoot', tag: 'crashdroids', n: 5, text: 'Drive the droids off the wreck', spawn: droids('crashdroids', 5, [-170, -214]) }], done: [['A Wolfpack trooper', 'Thank you. Leave him be now.']] },
      { id: 'treasury', name: 'The treasury', giver: 'deputy', intro: [['A Neimoidian deputy viceroy', 'The palace droids have gone wrong. Shut down their control platform before they shoot the treasury.']], steps: [{ type: 'shoot', tag: 'palacedroids', at: [-220, 170], n: 6, text: 'Stop the palace droids', spawn: droids('palacedroids', 6, [-214, 160]) }, { type: 'use', id: 'control', at: [-194, 188], r: 6, prompt: 'Shut the control platform down', text: 'Shut down the droids’ control platform' }], done: [['A Neimoidian deputy viceroy', 'Excellent. Your fee will be paid in full. Eventually.']] },
    ],
    flyovers: [{ kind: 'vulture', n: 2, metres: 7, alt: 160, speed: 120, every: 70 }, { kind: 'federation', n: 1, metres: 60, alt: 300, speed: 30, every: 120 }],
  },

  polismassa: {
    place: 'The asteroid of Polis Massa',
    line: 'A rock with no air, a medical station dug into it, and the stars all round, hard and close.',
    sky: { zenith: '#020308', horizon: '#0c0e16', haze: 0.2, hazeColor: '#141824', below: '#16161c', suns: [{ az: 2.2, el: 0.5, color: '#f4f0e6', size: 0.012, glow: 0.4 }], clouds: null, stars: 1, bodies: [{ az: 0.9, el: 0.35, size: 0.16, color: '#5a5048', color2: '#3a342e', bands: 0, lit: 0.6 }] },
    fog: { color: '#0e1018', density: 0.0004 },
    light: { sun: 3, sky: '#3a4050', ground: '#4a4440', ambient: 0.5 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.9 }, seed: 75, layers: [{ type: 'swell', scale: 260, height: 8 }, { type: 'ridges', scale: 90, height: 3 }, { type: 'mountains', from: 500, to: 1800, height: 260, scale: 700 }], pits: [{ at: [-150, 190], r: 40, depth: 9, cone: true }, { at: [210, -200], r: 30, depth: 7, cone: true }, { at: [60, 300], r: 22, depth: 5, cone: true }], palette: palette('#6a625a', '#7e766c', '#3e3a36', '#5a524a', { mark: '#2e2a26' }) },
    weather: [],
    land: { at: [0, 0], yaw: 1 },
    places: [
      { id: 'station', name: 'The medical station', at: [230, 60], r: 60, flat: { r: 50 }, about: 'Where Padmé Amidala gave birth to the twins, and died. A white hall under the rock, and a hangar for the ships that came in secret.', things: [{ kind: 'massabase', at: [14, 18], yaw: 1.2 }, { kind: 'mpad', at: [-30, -22], opts: { r: 14 } }, { kind: 'lamp', at: [20, -16] }] },
      { id: 'dig', name: 'The excavation', at: [-160, -170], r: 46, flat: { r: 32 }, about: 'The Polis Massans came to dig for the remains of their own lost homeworld: trenches, lamps and the finds laid out on tables.', things: [{ kind: 'tent', at: [0, 0], opts: { r: 4, h: 3, sides: 4, color: '#8a8478' } }, { kind: 'lamp', at: [8, 6] }, { kind: 'lamp', at: [-8, -6] }, { kind: 'crates', at: [10, -8] }, { kind: 'mining', at: [-22, 14], yaw: 1, scale: 0.4 }] },
      { id: 'crater', name: 'The great crater', at: [-150, 190], r: 50, about: 'Struck when the asteroid broke off its world. Nothing has moved in it since but the station’s survey droids.' },
    ],
    scatter: [{ kind: 'rock', model: NATURE.rock, n: 120, within: [12, 600], scale: [0.5, 2.4], opts: { color: '#5a524a', sharp: 0.7 } }, { kind: 'stones', model: NATURE.stone, n: 80, within: [8, 300], scale: [0.6, 1.4], solid: false, opts: { color: '#6a625a' } }],
    flora: { biome: 'tundra', tint: { Rocks: { recolour: '#6a625a' } } },
    things: [{ kind: 'crates', at: [12, -10], opts: { color: '#d8d4cc' } }],
    life: [
      { kind: 'droid', id: 'meddroid', at: [214, 44], still: true, face: 2, name: 'A medical droid', named: true, quest: 'supplies', says: ['The patient has lost the will to live.', 'Supplies are short. They always are, out here.'] },
      { kind: 'villager', id: 'digger', at: [-150, -160], still: true, face: 4, name: 'A Polis Massan archaeologist', quest: 'finds', says: ['(She signs, slowly: they are looking for where they came from.)'] },
      { kind: 'villager', n: 3, at: [-160, -170], spread: 12, roam: 8, speed: 0.6, name: 'Polis Massan', says: ['(A slow, careful sign of welcome.)'] },
    ],
    quests: [
      { id: 'supplies', name: 'Supplies', giver: 'meddroid', intro: [['A medical droid', 'The supply drop missed the station. Three canisters, out by the great crater.']], steps: [{ type: 'collect', item: 'canister', n: 3, spots: [[-130, 170], [-170, 214], [-120, 214]], text: 'Collect the supply canisters by the crater' }, { type: 'talk', actor: 'meddroid', text: 'Bring them back to the station' }], done: [['A medical droid', 'Thank you. We will need them.']] },
      { id: 'finds', name: 'What was lost', giver: 'digger', intro: [[null, '(The archaeologist points at the far crater, then at her tools.)']], steps: [{ type: 'reach', at: [210, -200], r: 24, text: 'Search the small crater east of the dig' }, { type: 'use', id: 'find', at: [210, -200], r: 8, prompt: 'Dig', text: 'Dig out what the survey found', end: [{ say: [[null, '(A fragment of carved stone. Someone lived here, once, when this rock was a world.)']] }] }], done: [[null, '(She holds the stone a long time.)']] },
    ],
    flyovers: [{ kind: 'shuttle', n: 1, metres: 20, alt: 120, speed: 50, every: 120 }],
  },

  malastare: {
    place: 'The grasslands of Malastare',
    line: 'Low hills of grass, the Dugs’ fuel works smoking on the skyline, and a podrace course cut through all of it.',
    sky: sky('#7ea2c6', '#dcdcc4', '#fff4dc', { clouds: { cover: 0.4, color: '#f6f6ee', shade: '#a6aa9a', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#cad0bc', density: 0.0011 },
    light: { sun: 2.7, sky: '#bcccd8', ground: '#7a8250', ambient: 0.8 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, seed: 76, layers: [{ type: 'swell', scale: 420, height: 10 }, { type: 'hills', scale: 150, height: 12 }, { type: 'mountains', from: 700, to: 3000, height: 280, scale: 1300 }], palette: palette('#6e7c44', '#869454', '#6a6656', '#8a8a54', { mark: '#4e5832' }) },
    grass: { h: [0.4, 0.8], w: 0.06, root: '#4a5428', mid: '#7a8a44', tip: '#b4b870', dry: '#a8a062', cover: 0.85, scale: 110, wind: 0.7 },
    weather: [],
    land: { at: [0, 0], yaw: 0.2 },
    places: [
      { id: 'course', name: 'The podrace course', at: [220, -120], r: 70, flat: { r: 56 }, about: 'The Malastare 100: grandstands on the hill, the start grid below, and a course that eats engines.', things: [{ kind: 'stall', at: [-20, -30] }, { kind: 'stall', at: [0, -34] }, { kind: 'stall', at: [20, -30] }, { kind: 'pillars', at: [0, 30], yaw: 0 }, { kind: 'podracer', at: [-10, 4], yaw: 1.6 }, { kind: 'podracer', at: [10, 4], yaw: 1.6 }] },
      { id: 'works', name: 'The fuel works', at: [-240, -120], r: 56, flat: { r: 46 }, about: 'Malastare’s fuel, pumped out of the ground and sold to half the Republic. The Dugs run it, and run it hard.', things: [{ kind: 'works', at: [0, 0], yaw: 0.5 }, { kind: 'smoke', at: [6, -6], opts: { h: 70, n: 8, color: '#5a5650' } }, { kind: 'barrels', at: [24, 16] }] },
      { id: 'village', name: 'The Dug village', at: [-120, 240], r: 46, flat: { r: 38 }, about: 'Round huts on the hillside, a market and a well. The Dugs walk on their hands and argue with them too.', things: [...ring(5, 18, 0.2).map(([x, z, yaw]) => ({ kind: 'adobe', at: [x, z], yaw, opts: { r: 4 } })), { kind: 'stall', at: [0, 0] }, { kind: 'fire', at: [6, -6] }] },
      { id: 'palace', name: 'The Imperial palace', at: [280, 180], r: 60, flat: { r: 50 }, about: 'Where the Dug Council rules Malastare: black spires round one needle, lit amber at their foot, over the plain the Republic fought for.', things: [{ kind: 'dugpalace', at: [0, 0], yaw: 4.1 }] },
    ],
    flora: { biome: 'plains', trees: false },
    things: [{ kind: 'crates', at: [-10, 12] }, { kind: 'barrel', at: [-12, 14] }],
    rides: [{ kind: 'speederbike', at: [12, 8], yaw: -0.6 }],
    life: [
      { kind: 'villager', id: 'starter', at: [214, -150], still: true, face: 2.8, name: 'The race starter', named: true, quest: 'malastare100', says: ['The Malastare 100! Fastest course in the Mid Rim, and the shortest careers.'] },
      { kind: 'villager', n: 5, at: [220, -120], spread: 30, roam: 14, speed: 1, name: 'Race fan', says: ['Sebulba’s won it three years running. Nobody knows how. Everybody knows how.'] },
      { kind: 'villager', n: 4, at: [-120, 240], spread: 16, roam: 10, speed: 0.8, name: 'Dug', says: ['Outlander. Hmph.', 'The works pay well. The works also explode.'] },
      { kind: 'villager', id: 'foreman', at: [-226, -140], still: true, face: 1.4, name: 'The works foreman', quest: 'leak', says: ['Something in the pipes. Something big.'] },
    ],
    quests: [
      { id: 'malastare100', name: 'The Malastare 100', giver: 'starter', intro: [['The race starter', 'No pod? Then a bike. Round the gates and back, faster than the last fool.']], steps: [{ type: 'ride', kind: 'speederbike', text: 'Get on a speeder bike' }, { type: 'race', ride: 'speederbike', gates: [[100, -60], [20, 80], [-120, 180], [-200, 60], [-140, -100], [60, -160], [200, -120]], r: 14, time: 75, text: 'Run the course' }], done: [['The race starter', 'Not bad. Not Sebulba, but not bad.']] },
      { id: 'leak', name: 'Something in the pipes', giver: 'foreman', intro: [['The works foreman', 'Pirates tapped our lines. They’re in the works now, filling their tanks. Get them out.']], steps: [{ type: 'shoot', tag: 'pirates', at: [-240, -120], n: 6, text: 'Drive the pirates out of the fuel works', spawn: { kind: 'aqualish', n: 6, at: [-232, -110], spread: 14, roam: 6, hp: 2, tag: 'pirates', hostile: hostile(40, 2.3, 7) } }], done: [['The works foreman', 'Good. Now nobody light anything.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 160, speed: 40, every: 100 }],
  },
};
