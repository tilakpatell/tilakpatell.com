// The charted worlds of Rogue One and the originals, from the ground
// (charted/empire.js has them in the galaxy): Jedha, Eadu, Lah’mu, Wobani,
// the Ring of Kafrene, Dantooine and Ord Mantell, each a free roam at its
// film’s moment. (sites/index.js has what a site is.)

import { grove } from './stand';
import { sky, palette, hostile, troops, NATURE } from './outerKit';

// n spots evenly round a circle of radius r (a turn of `phase` first), each [x, z, yaw] facing the middle
const ring = (n, r, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2];
  });
const deathtroopers = (tag, n, at) => ({ kind: 'deathtrooper', n, at, spread: 10, roam: 5, hp: 4, tag, hostile: hostile(46, 1.5, 10) });

export const SITES = {
  jedha: {
    place: 'The Holy City of Jedha',
    line: 'A cold desert moon, the pilgrims’ city on its mesa, and a Star Destroyer hanging over all of it.',
    sky: sky('#98acc0', '#e4dac6', '#fff6e6', { hazeColor: '#e8dccc', clouds: { cover: 0.3, color: '#f2ece2', shade: '#a49c90', scale: 0.7, speed: 0.004 } }),
    fog: { color: '#d8ccb8', density: 0.0014 },
    light: { sun: 2.4, sky: '#c4ccd6', ground: '#a8987c', ambient: 0.85 },
    ground: { detail: 'sand', detailLook: { color: 0.7, normal: 0.8, metres: 6 }, seed: 81, wind: 0.4, layers: [{ type: 'swell', scale: 420, height: 6 }, { type: 'mesas', scale: 460, height: 30, cover: 0.34, cliff: 0.05 }, { type: 'dunes', scale: 48, height: 3, wind: 0.4 }, { type: 'mountains', from: 700, to: 3000, height: 320, scale: 1200 }], palette: palette('#c2b296', '#d6c8ac', '#8a8070', '#a89a80', { mark: '#7a6e5c' }) },
    weather: [{ kind: 'sand', count: 380 }],
    land: { at: [0, 0], yaw: 2 },
    places: [
      { id: 'city', name: 'The Holy City', at: [240, -60], r: 80, flat: { r: 70 }, about: 'NiJedha, the oldest city of the Jedi faith: pilgrims from a hundred worlds in its streets, and stormtroopers on every corner, here for the kyber.', things: [...ring(8, 40, 0.2).map(([x, z, yaw], i) => ({ kind: 'adobe', at: [x, z], yaw, opts: { r: 5 + (i % 3) } })), { kind: 'stall', at: [-8, 4] }, { kind: 'stall', at: [8, -6], yaw: 1 }, { kind: 'tent', at: [0, 18], opts: { r: 3, h: 2.6, sides: 4, color: '#8a5a3e' } }, { kind: 'statue', at: [0, -20], opts: { h: 26 } }, { kind: 'lamp', at: [14, 12] }] },
      { id: 'temple', name: 'The Temple of the Kyber', at: [-200, -200], r: 50, flat: { r: 40 }, about: 'The temple where the Guardians of the Whills kept watch over the kyber. The Empire took the crystals, and the Guardians were left to keep watch over nothing.', things: [{ kind: 'kybertemple', at: [0, -26] }, { kind: 'statue', at: [-16, 10], opts: { h: 18 } }, { kind: 'statue', at: [16, 14], opts: { h: 18 } }] },
      { id: 'heads', name: 'The fallen guardians', at: [-60, 270], r: 50, about: 'The heads of the old Jedi statues, toppled into the sand long ago and too heavy to move. The pilgrims leave kyber at their feet.', things: [{ kind: 'stonehead', at: [0, 0], yaw: 0.4, scale: 2.4, opts: { s: 1 } }, { kind: 'stonehead', at: [22, 14], yaw: 2.2, scale: 1.8 }, { kind: 'stonehead', at: [-20, 18], yaw: 4.1, scale: 1.6 }] },
      { id: 'partisans', name: 'Saw Gerrera’s camp', at: [320, 250], r: 40, flat: { r: 30 }, about: 'Where Saw’s partisans hide between raids on the Empire: older than the Rebellion, and angrier.', things: [{ kind: 'tent', at: [0, 0], opts: { r: 4, h: 3, sides: 6, color: '#5a4a3a' } }, { kind: 'tent', at: [10, 8], yaw: 1.2, opts: { r: 3, h: 2.6, sides: 6, color: '#6a5a44' } }, { kind: 'crates', at: [-8, 6] }, { kind: 'fire', at: [4, -6] }] },
    ],
    flora: { biome: 'dry', game: 'badlands', tint: { Rocks: { recolour: '#c4b49c' } } },
    skyships: [{ kind: 'destroyer', metres: 1600, at: [500, 900, -1400], yaw: 2.4 }],
    things: [{ kind: 'crates', at: [10, -10] }],
    life: [
      { kind: 'chirrut', id: 'chirrut', at: [-186, -190], still: true, face: 3, name: 'Chirrut Îmwe', named: true, quest: 'kyber', says: ['The Force is with me, and I am with the Force.', 'Are you kidding me? I’m blind.'] },
      { kind: 'baze', at: [-178, -184], still: true, face: 3.4, name: 'Baze Malbus', says: ['I don’t need luck. I have you.'] },
      { kind: 'jyn', id: 'jyn', at: [228, -40], still: true, face: 2, name: 'Jyn Erso', named: true, quest: 'tank', says: ['Rebellions are built on hope.', 'Saw Gerrera’s people are watching us. I can feel it.'] },
      { kind: 'k2so', at: [236, -32], still: true, face: 2.4, name: 'K-2SO', says: ['Congratulations. You are being rescued.', 'I have a bad feeling about this.'] },
      { kind: 'villager', n: 6, at: [240, -60], spread: 40, roam: 16, speed: 0.8, name: 'Pilgrim', says: ['The temple is closed. The Empire closed it.', 'May the Force be with us.'] },
      { kind: 'stormtrooper', n: 4, at: [250, -80], spread: 30, roam: 18, speed: 1.1, name: 'Stormtrooper', says: ['Move along.'] },
      { kind: 'rebel', n: 3, at: [320, 250], spread: 12, roam: 8, speed: 1, name: 'Partisan', says: ['Saw doesn’t trust you. Saw doesn’t trust anyone.'] },
    ],
    quests: [
      { id: 'tank', name: 'The kyber tank', giver: 'jyn', intro: [['Jyn Erso', 'The partisans are hitting a kyber tank in the square. When it starts, we’re in the middle of it.']], steps: [{ type: 'reach', at: [262, -84], r: 20, text: 'Get into the square' }, { type: 'shoot', tag: 'squaretroops', n: 7, text: 'Get through the fight in the square', spawn: troops('squaretroops', 7, [270, -90]) }], done: [['Jyn Erso', 'The partisans have the tank. Now Saw has to talk to us.']] },
      { id: 'kyber', name: 'The kyber', giver: 'chirrut', intro: [['Chirrut Îmwe', 'The pilgrims hid three crystals from the Empire at the fallen guardians. Bring them to the temple, before the Empire finds them.']], steps: [{ type: 'collect', item: 'kyber', n: 3, spots: [[-60, 262], [-40, 280], [-76, 286]], text: 'Find the kyber at the fallen guardians' }, { type: 'use', id: 'temple', at: [-200, -200], r: 8, prompt: 'Lay the crystals in the temple', text: 'Lay the kyber in the temple', end: [{ say: [[null, '(The crystals catch the light all at once, as if they knew where they were.)']] }] }], done: [['Chirrut Îmwe', 'The strongest stars have hearts of kyber.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 120, speed: 110, every: 60 }],
  },

  eadu: {
    place: 'The research facility on Eadu',
    line: 'Rain without end on black rock, and the Empire’s kyber refinery up on the cliffs.',
    sky: sky('#2a3038', '#58626c', '#c8d0dc', { hazeColor: '#5a6470', clouds: { cover: 0.95, color: '#6a7480', shade: '#2a3038', scale: 0.4, speed: 0.012 } }),
    fog: { color: '#4a525c', density: 0.0042 },
    light: { sun: 0.9, sky: '#5a6878', ground: '#2e3034', ambient: 0.75 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.9 }, seed: 82, layers: [{ type: 'swell', scale: 280, height: 10 }, { type: 'ridges', scale: 120, height: 16 }, { type: 'mesas', scale: 360, height: 40, cover: 0.42, cliff: 0.04 }, { type: 'mountains', from: 450, to: 2000, height: 520, scale: 800 }], palette: palette('#2e3032', '#3e4244', '#1e2022', '#4a4c4a', { mark: '#16181a', wet: { level: 30, band: 30, color: '#1a1c1e' } }) },
    weather: [{ kind: 'rain', count: 1800 }],
    land: { at: [0, 0], yaw: 4 },
    places: [
      { id: 'facility', name: 'The kyber refinery', at: [250, -100], r: 70, flat: { r: 56 }, about: 'Where Galen Erso was made to finish the Death Star’s weapon: halls of grey metal, lit from inside, and the rain beating on them.', things: [{ kind: 'eadulab', at: [-6, -26] }, { kind: 'turret', at: [-28, 18], yaw: 1, opts: { color: '#5a5e62' } }, { kind: 'lamp', at: [-16, 4], opts: { h: 6, light: '#cfe4ff' } }, { kind: 'lamp', at: [18, 4], opts: { h: 6, light: '#cfe4ff' } }] },
      { id: 'platform', name: 'The landing platform', at: [180, 120], r: 44, flat: { r: 36 }, about: 'Where Krennic called the engineers out into the rain, and where the Rebellion’s bombs found Galen Erso.', things: [{ kind: 'mpad', at: [0, 0], opts: { r: 22 } }, { kind: 'lambda', at: [4, 6], yaw: 2 }, { kind: 'lamp', at: [18, -10], opts: { h: 6, light: '#cfe4ff' } }] },
      { id: 'crash', name: 'The U-wing’s crash', at: [-170, 160], r: 40, about: 'Where Rogue One’s ship came down in the storm, short of the facility and out of the Empire’s sight, just.', things: [{ kind: 'uwing', at: [0, 0], yaw: 0.8 }, { kind: 'wrecksmoke', at: [2, 0], opts: { h: 14 } }] },
      { id: 'ridge', name: 'The sniper’s ridge', at: [80, 240], r: 36, about: 'The rock over the platform, where Cassian lay in the rain with his orders and his rifle.', things: grove(82, 10, 6, 30, ['needle'], [0.5, 0.8]) },
    ],
    scatter: [{ kind: 'basalt', n: 110, within: [20, 600], scale: [0.8, 2.6] }, { kind: 'rock', model: NATURE.rock, n: 90, within: [10, 500], scale: [0.6, 2.4], opts: { color: '#2e3032', sharp: 0.7 } }],
    flora: { biome: 'ash', tint: { Rocks: { recolour: '#3a3c3e' } } },
    things: [{ kind: 'crates', at: [-10, 8], opts: { color: '#4a4c50' } }],
    life: [
      { kind: 'cassian', id: 'cassian', at: [86, 230], still: true, face: 0.4, name: 'Cassian Andor', named: true, quest: 'sniper', says: ['I’ve been in this fight since I was six years old.', 'Stay with me.'] },
      { kind: 'jyn', id: 'jyn', at: [-160, 150], still: true, face: 4, name: 'Jyn Erso', named: true, quest: 'father', says: ['My father is up there.'] },
      { kind: 'krennic', at: [176, 112], still: true, face: 3, name: 'Director Krennic', says: ['We were on the verge of greatness.'] },
      { kind: 'deathtrooper', n: 4, at: [180, 120], spread: 14, roam: 6, speed: 1, name: 'Death trooper', says: ['(A crackle of comm noise, and nothing anyone could understand.)'] },
      { kind: 'officer', n: 2, at: [250, -100], spread: 20, roam: 12, speed: 0.9, name: 'Imperial engineer', says: ['Director Krennic is here. Look busy.'] },
    ],
    quests: [
      { id: 'sniper', name: 'Orders', giver: 'cassian', intro: [['Cassian Andor', 'The death troopers are on the platform. Keep them off Jyn while she gets in.']], steps: [{ type: 'reach', at: [150, 150], r: 24, text: 'Get down off the ridge to the platform' }, { type: 'shoot', tag: 'platformtroops', n: 4, text: 'Take the death troopers on the platform', spawn: deathtroopers('platformtroops', 4, [176, 136]) }], done: [['Cassian Andor', 'I didn’t take the shot. You should know that.']] },
      { id: 'father', name: 'Galen Erso', giver: 'jyn', intro: [['Jyn Erso', 'He’s on that platform. I have to get to him before the bombers do.']], steps: [{ type: 'reach', at: [180, 120], r: 26, text: 'Get to the landing platform' }, { type: 'use', id: 'galen', at: [186, 116], r: 6, prompt: 'Go to him', text: 'Find Galen Erso on the platform', end: [{ shake: 1 }, { sound: 'crash' }, { say: [[null, '(The Rebellion’s bombs, too early. In the rain and the fire, he knows her.)']] }] }], done: [['Jyn Erso', 'He’s gone. But he left us a way in.']] },
    ],
    flyovers: [{ kind: 'xwing', n: 2, metres: 12.5, alt: 90, speed: 110, every: 80 }],
  },

  lahmu: {
    place: 'The Erso farm on Lah’mu',
    line: 'Black sand, grey sky, green grass to the sea: the farm where the Ersos hid from the Empire.',
    sky: sky('#76858e', '#c6cac4', '#f6f2e6', { hazeColor: '#c2c6c0', clouds: { cover: 0.7, color: '#e2e4e0', shade: '#8a908c', scale: 0.5, speed: 0.006 } }),
    fog: { color: '#b8bcb6', density: 0.0018 },
    light: { sun: 2, sky: '#aeb8bc', ground: '#4a5438', ambient: 0.85 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, seed: 83, wind: 0.5, layers: [{ type: 'island', at: [0, 0], r: 540, height: 16, core: 0.45, ragged: 0.3 }, { type: 'swell', scale: 300, height: 4 }, { type: 'hills', scale: 120, height: 8 }, { type: 'mountains', from: 800, to: 3000, height: 300, scale: 1200 }], palette: palette('#2a2a28', '#5a6c42', '#2c2a28', '#4a5a36', { hLow: 2, hHigh: 14, mark: '#1e1e1c', wet: { level: -1, band: 1.5, color: '#141414' } }) },
    water: { level: -1, color: '#4a5a62', deep: '#22303a', kind: 'sea', foam: 0.16 },
    grass: { h: [0.3, 0.6], w: 0.05, root: '#3a4628', mid: '#5a6c3a', tip: '#8a9a5c', dry: '#8a8a5c', cover: 0.75, scale: 90, wind: 0.6, above: 1.4 },
    weather: [],
    land: { at: [0, 0], yaw: 2.6 },
    places: [
      { id: 'farm', name: 'The farm', at: [160, 60], r: 50, flat: { r: 40 }, about: 'A dome of a house built into the hill, a field of crops and the machines that tend them. Galen Erso wanted it to be the end of his part in the war.', things: [{ kind: 'ersohome', at: [-6, -24], yaw: 0.4 }, { kind: 'crates', at: [12, -4] }] },
      { id: 'hideout', name: 'The hideout', at: [-140, -170], r: 36, flat: { r: 22 }, about: 'A hatch in the rocks, and a hole under it with a lamp, a blanket and room for one girl to wait for someone who doesn’t come.', things: [{ kind: 'lamp', at: [0, 0], opts: { h: 2.4 } }, ...grove(83, 9, 6, 22, ['needle'], [0.3, 0.55])] },
      { id: 'shuttle', name: 'Krennic’s landing', at: [-40, 210], r: 40, flat: { r: 32 }, about: 'Where the shuttle came down out of the grey with the Director on it, and his troopers in black.', things: [{ kind: 'lambda', at: [0, 0], yaw: 3.4 }] },
      { id: 'beach', name: 'The black sand beach', at: [420, -60], r: 50, about: 'Where the grass ends and the sand goes down to the sea, black as coal, the waves grey on it.', things: [{ kind: 'log', at: [0, 0], yaw: 0.7, scale: 1.4 }, { kind: 'log', at: [12, 8], yaw: 2.2 }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.rock, n: 90, within: [20, 560], scale: [0.6, 2.4], opts: { color: '#2c2a28' } }],
    flora: { biome: 'temperate', trees: false, tint: { Rocks: { recolour: '#2c2a28' } } },
    things: [{ kind: 'crates', at: [10, 8] }],
    life: [
      { kind: 'villager', id: 'lyra', at: [150, 70], still: true, face: 3, name: 'Lyra Erso', named: true, quest: 'hide', says: ['Trust the Force.', 'If they come, you know where to go.'] },
      { kind: 'villager', id: 'galen', at: [170, 50], still: true, face: 2.4, name: 'Galen Erso', named: true, quest: 'harvest', says: ['I’m a farmer now.', 'Whatever I do, I do it to protect you.'] },
    ],
    quests: [
      { id: 'harvest', name: 'The harvest', giver: 'galen', intro: [['Galen Erso', 'The harvester broke down in the far field. Bring in what it dropped, before the rain.']], steps: [{ type: 'collect', item: 'crop', n: 4, spots: [[210, 120], [226, 104], [200, 140], [236, 128]], text: 'Bring in the crops from the far field' }, { type: 'talk', actor: 'galen', text: 'Bring them back to Galen' }], done: [['Galen Erso', 'Good. A quiet day. We don’t get many.']] },
      { id: 'hide', name: 'They’re here', giver: 'lyra', intro: [['Lyra Erso', 'A shuttle. It’s him. Get to the hideout, and whatever happens, don’t come out.']], steps: [{ type: 'reach', at: [-140, -170], r: 18, text: 'Get to the hideout in the rocks' }, { type: 'shoot', tag: 'searchers', n: 4, text: 'Hold off the death troopers searching the rocks', spawn: deathtroopers('searchers', 4, [-128, -150]) }], done: [[null, '(The shuttle lifts. Someone is coming over the rocks: Saw Gerrera, as Lyra said he would.)']] },
    ],
    flyovers: [],
  },

  wobani: {
    place: 'The labour camp on Wobani',
    line: 'Mud, rain and wire: the Empire’s labour camp, where Jyn Erso was serving her sentence when the Rebellion came for her.',
    sky: sky('#4a525a', '#868a86', '#dcd8cc', { hazeColor: '#7a7e7a', clouds: { cover: 0.9, color: '#8a8e8c', shade: '#3a3e40', scale: 0.4, speed: 0.01 } }),
    fog: { color: '#6a6c68', density: 0.003 },
    light: { sun: 1.1, sky: '#6a747c', ground: '#3e3428', ambient: 0.8 },
    ground: { detail: 'mud', detailLook: { color: 0.8, normal: 0.8 }, seed: 84, layers: [{ type: 'swell', scale: 260, height: 5 }, { type: 'hills', scale: 110, height: 6 }, { type: 'mountains', from: 600, to: 2600, height: 240, scale: 1000 }], palette: palette('#4a3e30', '#5a4e3a', '#3a3a36', '#5a5440', { mark: '#2e2620', wet: { level: 2, band: 2, color: '#2a221a' } }) },
    weather: [{ kind: 'rain', count: 1100 }],
    land: { at: [0, 0], yaw: 1.2 },
    places: [
      { id: 'camp', name: 'The labour camp', at: [-230, 60], r: 70, flat: { r: 60 }, about: 'Barracks, wire and searchlights in the mud, and the prisoners marched out each morning to dig what the Empire wants dug.', things: [{ kind: 'bunker', at: [0, 0], yaw: 1.6, opts: { w: 24, d: 12 } }, ...ring(4, 28, 0.4).map(([x, z, yaw]) => ({ kind: 'tent', at: [x, z], yaw, opts: { r: 4, h: 3, sides: 4, color: '#5a5448' } })), { kind: 'barricade', at: [0, 44], opts: { len: 30 } }, { kind: 'turret', at: [30, 30], yaw: 3.6, opts: { color: '#5e605c' } }, { kind: 'lamp', at: [-30, 30], opts: { h: 7, light: '#e8f0ff' } }, { kind: 'wobanitower', at: [-42, -38], yaw: 0.8 }, { kind: 'wobanitower', at: [44, -36], yaw: 2.4 }, { kind: 'wobanitower', at: [-40, 40], yaw: 5.5 }] },
      { id: 'road', name: 'The transport road', at: [120, 160], r: 46, flat: { r: 30 }, about: 'The track the prison transports take through the mud. The Rebellion stopped one here, and asked for a prisoner by name.', things: [{ kind: 'speedertruck', at: [0, 0], yaw: 1.2 }, { kind: 'crates', at: [10, 8] }] },
      { id: 'quarry', name: 'The quarry', at: [200, -200], r: 50, flat: { r: 34 }, about: 'Where the prisoners work: a pit, a crane and the mud running into it every time it rains, which is always.', things: [{ kind: 'mining', at: [0, 0], yaw: 0.6, scale: 0.4 }, ...grove(84, 8, 18, 40, ['needle'], [0.3, 0.6])] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.rock, n: 80, within: [20, 560], scale: [0.6, 2.2], opts: { color: '#4a4436' } }, { kind: 'stones', model: NATURE.stone, n: 70, within: [10, 300], scale: [0.6, 1.2], solid: false, opts: { color: '#4a3e30' } }],
    flora: { biome: 'ash', tint: { Rocks: { recolour: '#4a4436' } } },
    things: [{ kind: 'crates', at: [-12, 10], opts: { color: '#5a5650' } }],
    life: [
      { kind: 'k2so', id: 'k2so', at: [110, 146], still: true, face: 2.2, name: 'K-2SO', named: true, quest: 'transport', says: ['I find that answer vague and unconvincing.', 'There is a ninety-seven point six per cent chance of failure.'] },
      { kind: 'rebel', at: [126, 150], still: true, face: 2, name: 'Sergeant Melshi', says: ['Liana Hallik? Let’s go.'] },
      { kind: 'villager', n: 5, at: [-230, 60], spread: 28, roam: 10, speed: 0.6, name: 'Prisoner', says: ['Keep your head down and your shovel moving.', 'Nobody leaves here. Nobody.'] },
      { kind: 'stormtrooper', n: 3, at: [-230, 60], spread: 26, roam: 14, speed: 1, name: 'Stormtrooper', says: ['Back to work.'] },
    ],
    quests: [
      { id: 'transport', name: 'A prisoner by name', giver: 'k2so', intro: [['K-2SO', 'The transport carrying Jyn Erso is due through the camp. Stop it, and we can all leave this delightful mud.']], steps: [{ type: 'reach', at: [-170, 90], r: 24, text: 'Get to the camp’s gate' }, { type: 'shoot', tag: 'gatetroops', n: 6, text: 'Take the guards at the gate', spawn: troops('gatetroops', 6, [-176, 96]) }, { type: 'use', id: 'cells', at: [-200, 70], r: 8, prompt: 'Open the cells', text: 'Open the prisoners’ cells', end: [{ sound: 'crash' }] }], done: [['K-2SO', 'Congratulations. You are being rescued. Please do not resist.']] },
    ],
    flyovers: [{ kind: 'tie', n: 1, metres: 7, alt: 100, speed: 110, every: 80 }],
  },

  kafrene: {
    place: 'The Ring of Kafrene',
    line: 'A trading post wedged between two asteroids: towers, cables and alleys, and nobody looking too closely at anyone.',
    sky: { zenith: '#04060c', horizon: '#141822', haze: 0.4, hazeColor: '#1c2230', below: '#1a1a20', suns: [{ az: 1.6, el: 0.7, color: '#f2ead8', size: 0.014, glow: 0.6 }], clouds: null, stars: 0.9, bodies: [{ az: 4.2, el: 0.6, size: 0.5, color: '#4a4440', color2: '#2e2a26', bands: 0, lit: 0.7 }] },
    fog: { color: '#141822', density: 0.0012 },
    light: { sun: 2.4, sky: '#3a4458', ground: '#4a4440', ambient: 0.6 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.9 }, seed: 85, layers: [{ type: 'swell', scale: 200, height: 8 }, { type: 'ridges', scale: 80, height: 5 }, { type: 'mountains', from: 380, to: 1400, height: 420, scale: 600 }], palette: palette('#5a524a', '#6c645a', '#33302c', '#4a443e', { mark: '#24221e' }) },
    weather: [{ kind: 'motes', count: 300 }],
    land: { at: [0, 0], yaw: 0.8 },
    places: [
      { id: 'market', name: 'The trading post', at: [200, 40], r: 70, flat: { r: 56 }, about: 'Towers built on the rock wherever there was rock, joined by cables and walkways, and a market in every gap between them.', things: [{ kind: 'kafrenering', at: [-4, -28], yaw: 0.5, sink: 16 }, { kind: 'stall', at: [14, 6] }, { kind: 'stall', at: [-16, 6], yaw: 1.4 }, { kind: 'lamp', at: [4, 12] }] },
      { id: 'alley', name: 'Tivik’s alley', at: [-150, 160], r: 34, flat: { r: 24 }, about: 'A dead end behind the market, where Cassian Andor met an informant who knew too much and couldn’t run.', things: [{ kind: 'crates', at: [0, 0] }, { kind: 'crates', at: [6, 4], yaw: 1 }, { kind: 'lamp', at: [-4, 6], opts: { h: 3, light: '#ffb86a' } }] },
      { id: 'docks', name: 'The docks', at: [-190, -170], r: 46, flat: { r: 38 }, about: 'Berths cut into the asteroid’s face, freighters coming and going, and stormtroopers checking whoever looks worth checking.', things: [{ kind: 'dockingbay', at: [0, 0], opts: { r: 18, h: 7 } }, { kind: 'hangar', at: [30, 10], yaw: 1.4, opts: { w: 30, d: 20, h: 12 } }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.rock, n: 120, within: [12, 560], scale: [0.6, 2.6], opts: { color: '#4a443e', sharp: 0.8 } }, { kind: 'blackspire', n: 26, within: [100, 560], scale: [0.8, 1.6] }],
    flora: { biome: 'tundra', tint: { Rocks: { recolour: '#4a443e' } } },
    things: [{ kind: 'skyring', at: [0, 0], opts: { az: 2.2, el: 0.5, width: 0.06, dist: 9000 } }, { kind: 'crates', at: [10, -8] }],
    life: [
      { kind: 'cassian', id: 'cassian', at: [-138, 150], still: true, face: 3, name: 'Cassian Andor', named: true, quest: 'informant', says: ['Calm down. Every time.', 'They’re onto us. We have to go.'] },
      { kind: 'villager', n: 6, at: [204, 62], spread: 28, roam: 16, speed: 0.8, name: 'Trader', says: ['Everything’s for sale. Some of it’s even legal.', 'Keep your hand on your credits.'] },
      { kind: 'stormtrooper', n: 3, at: [204, 62], spread: 28, roam: 22, speed: 1.1, name: 'Stormtrooper', says: ['Papers.'] },
    ],
    quests: [
      { id: 'informant', name: 'The informant', giver: 'cassian', intro: [['Cassian Andor', 'My contact had word from an Imperial pilot. Troopers are coming down the alley. We go out over the stacks.']], steps: [{ type: 'shoot', tag: 'alleytroops', at: [-150, 160], n: 4, text: 'Get past the stormtroopers in the alley', spawn: troops('alleytroops', 4, [-136, 172]) }, { type: 'reach', at: [-190, -170], r: 30, text: 'Get to the docks' }], done: [['Cassian Andor', 'An Imperial pilot, defected. From Jedha. That’s all we have.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 140, speed: 40, every: 80 }, { kind: 'shuttle', n: 1, metres: 20, alt: 120, speed: 50, every: 110 }],
  },

  dantooine: {
    place: 'The plains of Dantooine',
    line: 'Grass to the horizon, and the ruins of a Rebel base the Empire found too late.',
    sky: sky('#7aa0c8', '#d8e2d4', '#fff6e2', { clouds: { cover: 0.35, color: '#ffffff', shade: '#a8b0b0', scale: 0.6, speed: 0.005 } }),
    fog: { color: '#c8d2c4', density: 0.001 },
    light: { sun: 2.7, sky: '#bed0e0', ground: '#6a7a46', ambient: 0.8 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, seed: 86, layers: [{ type: 'swell', scale: 480, height: 8 }, { type: 'hills', scale: 180, height: 10 }, { type: 'mountains', from: 750, to: 3000, height: 260, scale: 1300 }], palette: palette('#5e7040', '#768a4e', '#6a6858', '#8a8e5a', { mark: '#46542e' }) },
    grass: { h: [0.5, 0.9], w: 0.06, root: '#44522a', mid: '#6a7c40', tip: '#a8b26a', dry: '#b0a86a', cover: 0.88, scale: 130, wind: 0.8 },
    weather: [],
    land: { at: [0, 0], yaw: 3.6 },
    places: [
      { id: 'base', name: 'The abandoned Rebel base', at: [240, 120], r: 70, flat: { r: 56 }, about: 'Where the Rebellion hid before Yavin. Princess Leia gave the Empire its name to save Alderaan; it saved nothing, and the scouts found the base long empty.', things: [{ kind: 'bunker', at: [0, 0], yaw: 0.4, opts: { w: 22, d: 14 } }, { kind: 'turret', at: [24, 20], yaw: 0.8 }, { kind: 'turret', at: [-26, 18], yaw: 5.6 }, { kind: 'probewreck', at: [18, -22], yaw: 1.2 }, { kind: 'tent', at: [-16, -20], opts: { r: 3.4, h: 2.8, sides: 4, color: '#6a6a5a' } }] },
      { id: 'enclave', name: 'The old enclave', at: [-210, -160], r: 50, flat: { r: 40 }, about: 'Older than the Rebellion, older than the Empire: stones the Jedi set up here once, and the grass grown over them.', things: [{ kind: 'ruins', at: [0, 0], yaw: 1.2, opts: { seed: 7 } }, { kind: 'pillars', at: [16, 12], yaw: 0.3 }, { kind: 'statue', at: [-14, 14], opts: { h: 14 } }] },
      { id: 'herd', name: 'The banthas’ grazing', at: [-120, 260], r: 60, about: 'A herd out on the long grass, moving slowly north the way they have since before anyone counted.' },
    ],
    flora: { biome: 'plains', trees: true },
    things: [{ kind: 'crates', at: [-10, 10] }],
    life: [
      { kind: 'farmer', id: 'farmer', at: [-24, 14], still: true, face: 1.2, name: 'A Dantooine farmer', quest: 'search', says: ['The Rebels left years ago. Took everything worth taking, mostly.', 'Imperial scouts went out to the old base this morning.'] },
      { kind: 'bantha', n: 5, at: [-120, 260], spread: 30, roam: 30, speed: 0.6, r: 2.2 },
      { kind: 'scouttrooper', n: 3, at: [240, 120], spread: 24, roam: 14, speed: 1, name: 'Scout trooper', says: ['Nothing here. Nothing for years.'] },
    ],
    quests: [
      { id: 'search', name: 'What was left', giver: 'farmer', intro: [['A Dantooine farmer', 'The Rebels left their charts in the old base, I’d bet on it. Get them before the scouts do.']], steps: [{ type: 'collect', item: 'chart', n: 3, spots: [[224, 104], [256, 136], [262, 98]], text: 'Search the base for the Rebels’ charts' }, { type: 'shoot', tag: 'basescouts', at: [240, 120], n: 4, text: 'Deal with the scout troopers', spawn: { kind: 'scouttrooper', n: 4, at: [250, 130], spread: 14, roam: 6, hp: 2, tag: 'basescouts', hostile: hostile(38, 1.8, 7) } }], done: [['A Dantooine farmer', 'Long gone, those Rebels. Best you are too.']] },
    ],
    flyovers: [{ kind: 'tie', n: 1, metres: 7, alt: 120, speed: 110, every: 100 }],
  },

  ordmantell: {
    place: 'The scrapyards of Ord Mantell',
    line: 'Junk, smoke and bounty hunters: a world where Han Solo met one he’d rather not have.',
    sky: sky('#8a8c84', '#d6c8a4', '#fff0c8', { hazeColor: '#cfc2a0', clouds: { cover: 0.55, color: '#e4dcc6', shade: '#8a8270', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#bcb296', density: 0.002 },
    light: { sun: 2.2, sky: '#b4b4a8', ground: '#7a6a52', ambient: 0.85 },
    ground: { detail: 'gravel', detailLook: { color: 0.7, normal: 0.8 }, seed: 87, layers: [{ type: 'swell', scale: 360, height: 6 }, { type: 'hills', scale: 120, height: 5 }, { type: 'mountains', from: 650, to: 2800, height: 280, scale: 1100 }], palette: palette('#7a6a52', '#8c7c60', '#5a4a3a', '#8a5a3a', { mark: '#4a3a2a' }) },
    weather: [{ kind: 'ash', count: 260 }],
    land: { at: [0, 0], yaw: 5 },
    places: [
      { id: 'scrap', name: 'The scrapyards', at: [220, 140], r: 70, flat: { r: 56 }, about: 'Ships nobody will fly again, picked over by scavengers and stacked till the stacks fall over. Some still have something worth stealing.', things: [{ kind: 'probewreck', at: [0, 0], yaw: 0.4, scale: 1.6 }, { kind: 'probewreck', at: [24, 16], yaw: 2.2, scale: 1.2 }, { kind: 'probewreck', at: [-22, 20], yaw: 4, scale: 1.4 }, { kind: 'wrecksmoke', at: [4, 2], opts: { h: 22 } }, { kind: 'crates', at: [-10, -16] }, { kind: 'barrels', at: [16, -14] }] },
      { id: 'worlport', name: 'Worlport', at: [-200, -140], r: 70, flat: { r: 58 }, about: 'The capital: old towers, older markets, and a cantina where you can buy a ship, a crew or someone to find either.', things: [{ kind: 'mantellpalace', at: [0, -34], scale: 0.8 }, { kind: 'cantina', at: [30, 14], yaw: 0.3 }, { kind: 'stall', at: [-24, 10] }] },
      { id: 'field', name: 'The landing field', at: [-120, 220], r: 50, flat: { r: 42 }, about: 'Pads and fuel lines for whoever pays the fee, and a bounty board on the fence that’s always full.', things: [{ kind: 'pad', at: [0, 0], opts: { r: 16 } }, { kind: 'pad', at: [36, 4], opts: { r: 12, number: 2 } }, { kind: 'barrels', at: [18, -16] }] },
    ],
    scatter: [{ kind: 'rock', model: NATURE.mudrock, n: 70, within: [20, 560], scale: [0.8, 2.4], opts: { color: '#6a5a44' } }],
    flora: { biome: 'dry', tint: { Rocks: { recolour: '#7a6a52' } } },
    things: [{ kind: 'barrel', at: [10, 10] }, { kind: 'crates', at: [-12, 8] }],
    life: [
      { kind: 'rodian', id: 'dealer', at: [206, 120], still: true, face: 3.4, name: 'A scrap dealer', quest: 'parts', says: ['Everything’s got a price. Most of it’s low.', 'Bounty hunters in town. Bad for business, good for business.'] },
      { kind: 'bossk', at: [-196, -116], still: true, face: 2, name: 'Bossk', says: ['(A low hiss. He’s counting your credits from here.)'] },
      { kind: 'villager', n: 5, at: [-200, -118], spread: 26, roam: 16, speed: 0.9, name: 'Worlport local', says: ['Keep moving. Nobody here wants to know you.'] },
      { kind: 'villager', id: 'boss', at: [-110, 230], still: true, face: 4, name: 'The landing field’s boss', quest: 'hunters', says: ['There’s a price on someone’s head. Three hunters want it. I want them gone.'] },
    ],
    quests: [
      { id: 'parts', name: 'Salvage', giver: 'dealer', intro: [['A scrap dealer', 'Three hyperdrive motivators, out in the stacks. Bring them and I’ll split what they fetch.']], steps: [{ type: 'collect', item: 'motivator', n: 3, spots: [[236, 156], [204, 162], [244, 120]], text: 'Find the motivators in the scrap' }], done: [['A scrap dealer', 'Good condition, too. You’ve done this before.']] },
      { id: 'hunters', name: 'The bounty hunters', giver: 'boss', intro: [['The landing field’s boss', 'Three hunters waiting for a ship that isn’t coming. Persuade them to leave.']], steps: [{ type: 'shoot', tag: 'hunters', at: [-120, 220], n: 3, text: 'Drive off the bounty hunters', spawn: { kind: 'mercenary', n: 3, at: [-110, 236], spread: 12, roam: 6, hp: 4, tag: 'hunters', hostile: hostile(44, 1.6, 10) } }], done: [['The landing field’s boss', 'Quiet again. For a day.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 150, speed: 40, every: 80 }],
  },
};
