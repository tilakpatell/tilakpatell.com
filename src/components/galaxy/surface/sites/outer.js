// The Mandalorian's and Ahsoka's worlds, from the ground: Nevarro, Mandalore,
// Lothal and Sorgan. (sites/index.js has what a site is.)

import { grove } from './stand';
import { sky, palette, hostile, troops } from './outerKit';
import { nevarro } from './nevarro';

// n spots evenly round a circle of radius r (a turn of `phase` first), each
// [x, z, yaw] with its front to the middle
const ring = (n, r, phase = 0) => Array.from({ length: n }, (_, i) => {
  const a = phase + (i / n) * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2];
});

// Lothal's rock spires out west, between the landing and the old tower (the
// star map mission's run goes through them)
const LOTHAL_SPIRES = [[-31, 4, 0.32], [-9, 35, 0.42], [-48, 46, 0.37], [-68, 14, 0.46], [-108, 32, 0.42], [-114, 69, 0.42], [-161, 68, 0.32], [-181, 37, 0.46], [-218, 53, 0.37], [-231, 88, 0.42], [-271, 71, 0.42], [-276, 34, 0.46]].map(([x, z, scale], i) => ({ kind: 'lothtemple', at: [x, z], yaw: i * 1.7, scale: scale * 0.7, sink: 0.5 }));

export const SITES = {
  // (Nevarro, rebuilt: sites/nevarro.js)
  nevarro,

  mandalore: {
    place: 'The glassed plains of Mandalore',
    line: 'The Empire turned the surface to glass. Under it, the Living Waters still run.',
    // (as the show has it: an overcast grey-blue sky going to a pale sand
    // haze at the horizon, pale grey-beige sand, dark glassed rock; no purple)
    sky: sky('#7f93a3', '#c9c4b4', '#f4f1e8', { hazeColor: '#d2cbb4', below: '#8a8678', clouds: { cover: 0.55, color: '#e8e8e4', shade: '#8e9696', scale: 0.6, speed: 0.004 } }),
    fog: { color: '#bdb8aa', density: 0.0014 },
    light: { sun: 2.4, sky: '#b9c4cc', ground: '#8a8476', ambient: 0.8 },
    ground: { detail: 'gravel', detailLook: { color: 0.6, normal: 0.7 }, seed: 33, wind: 0.8, layers: [{ type: 'swell', scale: 420, height: 6 }, { type: 'mesas', scale: 500, height: 30, cover: 0.25, cliff: 0.05 }, { type: 'mountains', from: 650, to: 3000, height: 400, scale: 1200 }], palette: palette('#b9ab8e', '#d0c6b2', '#3a4344', '#5f6a66', { deep: '#4a4f4c', mark: '#7a7466' }) },
    weather: [{ kind: 'sand', count: 700 }],
    land: { at: [0, 0], yaw: 2.2 },
    places: [
      { id: 'sundari', name: 'The ruins of Sundari', at: [300, 170], r: 95, flat: { r: 80 }, about: 'The dome city, scorched and silent. Glass where the gardens were.', things: [{ kind: 'sundaridome', at: [0, 0], yaw: 2.6, sink: 1.5 }, ...grove(17, 28, 72, 96, ['glassshard'], [1, 3.2])] },
      { id: 'mines', name: 'The mines', at: [-200, -180], r: 40, about: 'Old tunnels under the glass, and at the bottom of them, the Living Waters.', things: [{ kind: 'needle', at: [0, 0], scale: 0.75, sink: 1, opts: { color: '#41494a', foot: '#383d3c' } }, { kind: 'lamp', at: [6, 6] }, ...grove(29, 10, 12, 30, ['glassshard'], [0.8, 2.4])] },
      { id: 'covert', name: 'The covert’s camp', at: [-120, 220], r: 30, flat: { r: 24 }, about: 'Mandalorians, home again for the first time in years.', things: [{ kind: 'tent', at: [0, 0], opts: { r: 1.9, h: 4.4, color: '#3f424b' } }, { kind: 'tent', at: [8, -6], yaw: 1.4, opts: { r: 1.9, h: 4.4, color: '#3f424b' } }, { kind: 'fire', at: [2, 4] }] },
    ],
    // the glass the bombs left, in shards across the plain
    scatter: [{ kind: 'glassshard', n: 160, within: [25, 650], scale: [0.6, 2.6], sink: 0.3, solid: 0.4 }],
    // the drop's badlands under the glass (flora.js, gameFlora.js)
    flora: { biome: 'none', game: 'badlands' },
    life: [
      { kind: 'armorer', id: 'armorer', at: [-116, 226], still: true, face: 2, name: 'The Armorer', named: true, quest: ['waters', 'reclaim'], says: ['This is the Way.'] },
      { kind: 'mando', n: 3, at: [-120, 220], spread: 8, roam: 6, speed: 1, name: 'Mandalorian', says: ['This is the Way.', 'For Mandalore!'] },
      { kind: 'bobafett', at: [205, 85], still: true, face: 1, name: 'A bounty hunter in green armour', says: ['(He says nothing. He doesn’t need to.)'] },
    ],
    quests: [
      { id: 'waters', name: 'The Living Waters', giver: 'armorer', intro: [['The Armorer', 'Go down to the Living Waters, under the mines, and you will be redeemed.']], steps: [{ type: 'reach', at: [-200, -180], r: 14, text: 'Go down to the mines' }, { type: 'use', id: 'bathe', at: [-200, -180], r: 8, prompt: 'Recite the Creed', text: 'Bathe in the Living Waters', end: [{ say: [[null, '(The water is cold and very deep. Something huge moves far below you.)']] }, { shake: 0.6 }] }], done: [['The Armorer', 'You are redeemed. This is the Way.']] },
      { id: 'reclaim', name: 'For Mandalore', giver: 'armorer', steps: [{ type: 'shoot', tag: 'remnant', at: [215, 100], n: 8, text: 'Drive the Remnant out of Sundari', spawn: troops('remnant', 8, [215, 100]) }], done: [['The Armorer', 'Mandalore is ours again.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 110, speed: 110, every: 60 }],
  },

  lothal: {
    place: 'The grass plains of Lothal',
    line: 'Tall grass to the horizon, stone spires, and Imperial factories on the edge of it all.',
    // (Rebels' Lothal, McQuarrie's: a golden afternoon over a sea of straw)
    sky: sky('#6f8fcf', '#efdab6', '#fff0d0'),
    fog: { color: '#e8d6b6', density: 0.0008 },
    light: { sun: 3, sky: '#c4d0ee', ground: '#a8915e', ambient: 0.75 },
    ground: { detail: 'grass', detailLook: { color: 0.7, normal: 0.6 }, seed: 45, layers: [{ type: 'swell', scale: 460, height: 8 }, { type: 'hills', scale: 160, height: 10 }, { type: 'mountains', from: 700, to: 3000, height: 360, scale: 1300 }], palette: palette('#a48a58', '#bba775', '#7a7268', '#b39a7e', { mark: '#6e5a3a', accentCover: 0.18 }) },
    // the prairie: waist-high straw, olive in drifts, rolling in the wind
    grass: { h: [0.8, 1.3], w: 0.15, root: '#86704a', mid: '#c6ad72', tip: '#ead9a8', dry: '#b0a26c', cover: 0.93, scale: 150, wind: 1.0, patch: 1.15 },
    // the kit's cover in it (flora.js), straw and cream like the grass: no
    // trees, as the prairie's spires stand alone
    flora: { biome: 'plains', trees: false, game: 'plains-imperial', tint: { Grass: { recolour: '#c6ad72' }, Leaves: { recolour: '#a99a5e' }, Leaves_TwistedTree: { recolour: '#9a8c52' }, Leaves_NormalTree: { recolour: '#a49658' }, Flowers: '#f2e6bc' } },
    land: { at: [0, 0], yaw: 1 },
    places: [
      { id: 'capital', name: 'Capital City', at: [260, -60], r: 60, flat: { r: 56 }, about: 'Lothal’s capital: stone towers, and an Imperial factory where the farms used to be.', things: [{ kind: 'lothdome', at: [0, 4], yaw: 3.4, sink: 0.2 }, { kind: 'lothdome', at: [27, 18], yaw: 4.2, scale: 0.85, sink: 0.2 }, { kind: 'lothdome', at: [-26, 16], yaw: 2.4, scale: 0.9, sink: 0.2 }, { kind: 'lothdome', at: [20, -24], yaw: 5.4, scale: 0.75, sink: 0.2 }, { kind: 'crates', at: [8, -16] }, { kind: 'crates', at: [-10, -12], yaw: 0.7 }] },
      { id: 'factory', name: 'The Imperial factory', at: [-220, -200], r: 50, flat: { r: 46 }, about: 'Where the TIEs are built. The grass doesn’t grow back round it.', things: [{ kind: 'bunkerash', at: [0, 0], yaw: 1 }, { kind: 'crates', at: [14, 8] }] },
      { id: 'tower', name: 'The old Imperial tower', at: [-320, 60], r: 40, flat: { r: 30 }, about: 'A comms tower the Empire left behind on the plains. Sabine Wren lives in it now, and paints it.', things: [{ kind: 'lothtower', at: [0, 0], yaw: 0.3, solid: { r: 3.2 } }, { kind: 'crates', at: [10, -8] }] },
      { id: 'spires', name: 'The Jedi temple', at: [-140, 230], r: 50, flat: { r: 34 }, about: 'A great cone of banded stone in the grass, older than the Empire, older than the Republic. The way in only opens to the Force.', things: [{ kind: 'lothtemple', at: [0, -12], yaw: 0.4, sink: 1 }, { kind: 'lothtemple', at: [30, 6], yaw: 2, scale: 0.26, sink: 0.5 }, { kind: 'lothtemple', at: [-28, 2], yaw: 4, scale: 0.32, sink: 0.5 }, { kind: 'lothtemple', at: [-20, -40], yaw: 1, scale: 0.22, sink: 0.5 }, { kind: 'lothtemple', at: [24, -38], yaw: 3, scale: 0.18, sink: 0.5 }] },
    ],
    life: [
      { kind: 'ahsoka', id: 'ahsoka', at: [-130, 220], still: true, face: 3, name: 'Ahsoka Tano', named: true, quest: ['starmap', 'inquisitor'], says: ['I’m no Jedi.', 'The Force will show you the way.'] },
      { kind: 'farmer', id: 'ryder', at: [250, -50], still: true, face: 2, name: 'Governor Azadi', named: true, quest: 'factory', says: ['Lothal is free. Let’s keep it that way.'] },
      { kind: 'stormtrooper', n: 4, at: [-220, -200], spread: 18, roam: 12, speed: 1.2, name: 'Remnant stormtrooper', says: ['Back away from the factory.'] },
      { kind: 'villager', n: 5, at: [260, -60], spread: 30, roam: 15, speed: 1, name: 'Lothal farmer', says: ['The loth-wolves came back. That has to mean something.'] },
      { kind: 'farmer', n: 1, at: [-14, 12], roam: 6, speed: 0.8, name: 'Haulier', says: ['Grain for Capital City. Half of it goes to the garrison, whether we like it or not.', 'Watch the spires. The wolves den there.'] },
      // (the plains' own: loth-cats about the capital, and the wolves by the spires)
      { kind: 'lothcat', n: 3, at: [222, -24], spread: 16, roam: 10, speed: 1.2, r: 0.3 },
      { kind: 'lothwolf', n: 2, at: [-150, 110], spread: 10, roam: 24, speed: 1.6, r: 0.9 },
      { kind: 'astromech', n: 1, at: [-10, 18], roam: 5, speed: 0.6, name: 'Astromech', says: ['(A grumpy, clipped beep. It would rather be fixing a ship.)'] },
    ],
    quests: [
      { id: 'starmap', name: 'The star map', giver: 'ahsoka', intro: [['Ahsoka Tano', 'The map to Thrawn is in pieces, hidden in the old temple stones. Find them.']], steps: [{ type: 'collect', item: 'shard', n: 3, spots: [[-150, 240], [-128, 218], [-146, 214]], text: 'Find the pieces of the star map' }, { type: 'use', id: 'map', at: [-140, 230], r: 6, prompt: 'Fit the pieces together', text: 'Open the star map', end: [{ shake: 0.4 }, { say: [[null, '(Points of light fill the air: a route to another galaxy.)']] }] }], done: [['Ahsoka Tano', 'Peridea. So that’s where they went.']] },
      // one of the Empire's hunters, left behind in the grass: a duellist with a staff that blocks, parries and ripostes (duellists.js)
      { id: 'inquisitor', name: 'The Inquisitor', giver: 'ahsoka', intro: [['Ahsoka Tano', 'Someone followed the map here. An Inquisitor: he’s waiting in the grass south of the temple.']], steps: [{ type: 'reach', at: [-150, 180], r: 20, text: 'Find the Inquisitor in the grass south of the temple' }, { type: 'shoot', tag: 'inquisitor', n: 1, text: 'Face the Inquisitor', lines: [[null, '(A grey figure in black rises out of the straw. His blade lights at both ends.)']], spawn: { kind: 'inquisitor', at: [-152, 172], hp: 7, leash: 26, roam: 3, tag: 'inquisitor', hostile: { range: 16, chase: 2.2, melee: true, reach: 2.8, every: 1.5, damage: 14, delay: 1, parry: 0.65, riposte: 0.3, guard: 3, blade: { color: '#ff3b3b', stance: 'double' } } } }], done: [['Ahsoka Tano', 'The Empire’s hunters never did know when to stop.']] },
      { id: 'factory', name: 'Shut down the factory', giver: 'ryder', steps: [{ type: 'shoot', tag: 'factory', at: [-220, -200], n: 8, text: 'Clear the Remnant from the factory', spawn: troops('factory', 8, [-220, -200]) }, { type: 'use', id: 'power', at: [-220, -200], r: 6, prompt: 'Shut down the power', text: 'Shut the factory down', end: [{ sound: 'crash' }, { shake: 0.8 }] }], done: [['Governor Azadi', 'No more TIEs from Lothal.']] },
    ],
    // (the plains' tall grass is the grass field round you: `grass`; its
    // cover is the flora's)
    // (the game's living world: convors on the prairie)
    scatter: [{ kind: 'game', model: 'game:objects/livingworld/convor_01/convor_01_sitting_mesh', n: 16, within: [20, 320], scale: [0.9, 1.2], solid: false, shadow: false }],
    rides: [{ kind: 'speederbike', at: [12, -10], yaw: -1.2 }],
    // a haulier's truck at the landing, its load beside it
    things: [
      ...LOTHAL_SPIRES,
      { kind: 'speedertruck', at: [-18, 16], yaw: 0.4 },
      { kind: 'barrel', at: [-14, 20], yaw: 0.3 },
      { kind: 'barrel', at: [-12.8, 20.8], yaw: 1.4 },
      { kind: 'cratecube', at: [-15.5, 22.5], yaw: 0.7 },
    ],
    flyovers: [{ kind: 'xwing', n: 1, metres: 12.5, alt: 80, speed: 100, every: 70 }, { kind: 'tie', n: 1, metres: 7, alt: 100, speed: 110, every: 90 }],
  },

  sorgan: {
    place: 'The forests of Sorgan',
    line: 'Misty woods, krill ponds, and a village with nothing worth stealing but its harvest.',
    sky: sky('#7a98b0', '#d0dcd8', '#fff0d8', { clouds: { cover: 0.5, color: '#f0f4f4', shade: '#a0aca8', scale: 0.6, speed: 0.004 } }),
    fog: { color: '#c0ccc4', density: 0.0018 },
    light: { sun: 2.4, sky: '#b8c8d0', ground: '#4a5a3a', ambient: 0.8 },
    ground: { detail: 'needles', detailLook: { color: 0.8, normal: 0.7 }, seed: 57, layers: [{ type: 'swell', scale: 300, height: 6 }, { type: 'hills', scale: 110, height: 9 }, { type: 'mountains', from: 650, to: 3000, height: 300, scale: 1100 }], palette: palette('#4f4c2e', '#5e6034', '#5a5a50', '#6a5e3a', { mark: '#3a3824' }) },
    // the drop's woods under the built firs and birches (flora.js, gameFlora.js)
    flora: { biome: 'none', game: 'woods' },
    // (the wet meadow round the krill farm, olive under a grey sky)
    grass: { h: [0.3, 0.6], w: 0.06, root: '#4a482d', mid: '#5f6236', tip: '#7f7c4a', dry: '#887a4c', cover: 0.72, scale: 90, wind: 0.2 },
    land: { at: [0, 0], yaw: 0.3 },
    places: [
      { id: 'village', name: 'The krill farmers’ village', at: [180, 120], r: 50, flat: { r: 46 }, about: 'Huts on stilts over the ponds, and a harvest the raiders keep coming back for.', things: [...ring(5, 21, 0.4).map(([x, z, yaw]) => ({ kind: 'stilthut', at: [x, z], yaw, sink: 0.15 })), { kind: 'fire', at: [2, -4] }, { kind: 'crates', at: [-8, -10] }, { kind: 'crates', at: [9, 6], yaw: 0.8 }, ...ring(7, 34, 0.9).map(([x, z, yaw]) => ({ kind: 'sorganfern', at: [x, z], yaw, scale: 1.3, solid: false })), ...grove(11, 30, 54, 84, ['sorganbirch', 'sorganbirch', 'sorganfir'])] },
      { id: 'raiders', name: 'The raiders’ camp', at: [-240, -160], r: 40, flat: { r: 30 }, about: 'Klatooinian raiders, and something big under a tarp.', things: [{ kind: 'tent', at: [0, 0], opts: { r: 4, h: 3.6, sides: 4, color: '#4b4d40' } }, { kind: 'fire', at: [4, 4] }, { kind: 'crates', at: [-6, 8] }] },
      { id: 'woods', name: 'The deep woods', at: [-120, 220], r: 40, about: 'Old trees and mist. Something with a lot of teeth hunts here at night.', things: [{ kind: 'log', at: [0, 0], yaw: 0.7 }, { kind: 'log', at: [9, -6], yaw: 2.1, scale: 0.8 }, ...grove(23, 40, 8, 60, ['sorganfir', 'sorganbirch'], [1, 1.5]), ...grove(5, 30, 4, 50, ['sorganfern'], [1, 2])] },
    ],
    // the woods: birches and firs all round, thinning out far off, ferns
    // under them (the village and the landing are kept clear)
    // the farmers' cart and its barrels where you set down
    things: [
      { kind: 'barrel', at: [16, 14], yaw: 0.2 },
      { kind: 'barrel', at: [17.2, 14.6], yaw: 1.3 },
      { kind: 'barrel', at: [16.4, 15.8], yaw: 2.1 },
      { kind: 'crates', at: [-12, 10] },
      { kind: 'log', at: [12, -14], yaw: 0.8 },
    ],
    scatter: [
      // (the game's living world: lanternbirds in the woods)
      { kind: 'game', model: 'game:objects/livingworld/lanternbird_01/lanternbird_01_sitting_mesh', n: 16, within: [10, 260], scale: [0.9, 1.2], solid: false, shadow: false },
      // (Quaternius's ground cover, under the built plants: catalog/quaternius.js)
      { kind: 'qgrass', n: 200, within: [4, 120], scale: [0.8, 1.5], solid: false },
      { kind: 'qclover', n: 120, within: [4, 90], scale: [0.8, 1.6], solid: false },
      { kind: 'rock', model: 'game:objects/nature/forest/_forestbase/forestbase_rockmedium_02/forestbase_rockmedium_02_mesh', n: 60, within: [40, 500], scale: [0.6, 2.4], opts: { color: '#6a6a5a' } },
      // (the woods as the episode has them: a wall of dark conifers round
      // the clearings)
      { kind: 'spruce', n: 240, within: [45, 640], scale: [1.0, 1.6], opts: { seed: 7, h: 24, leaf: '#2c3624', bark: '#4a3f33' } },
      { kind: 'sorganfir', n: 60, within: [60, 650], scale: [0.8, 1.4], sink: 0.3, solid: 0.6 },
      { kind: 'sorganfern', n: 140, within: [18, 360], scale: [0.8, 1.8], solid: false },
    ],
    life: [
      { kind: 'villager', id: 'omera', at: [186, 112], still: true, face: 2.4, name: 'Omera', named: true, quest: 'raiders', says: ['We can pay. Not much, but we can pay.'] },
      { kind: 'villager', n: 5, at: [180, 120], spread: 20, roam: 12, speed: 0.9, name: 'Krill farmer', says: ['The raiders come at harvest. Every harvest.'] },
      { kind: 'grogu', at: [176, 126], still: true, face: 1, name: 'The Child', says: ['(He’s eating a frog. Again.)'] },
      { kind: 'villager', n: 2, at: [14, 10], spread: 5, roam: 8, speed: 0.9, name: 'Krill farmer', says: ['The village is that way, through the trees. Bring your own boots.', 'Krill harvest’s in. The raiders know it too.'] },
    ],
    quests: [
      { id: 'raiders', name: 'Sanctuary', giver: 'omera', intro: [['Omera', 'Raiders. And they’ve got an Imperial walker. Will you help us?']], steps: [{ type: 'shoot', tag: 'raiders', at: [-240, -160], n: 6, text: 'Drive off the Klatooinian raiders', spawn: { kind: 'aqualish', n: 6, at: [-240, -160], spread: 14, roam: 6, hp: 2, tag: 'raiders', hostile: hostile(42, 2.4, 8) } }, { type: 'shoot', tag: 'walker', at: [-220, -140], n: 1, text: 'Bring down the AT-ST', lines: [[null, '(The trees split. An AT-ST steps out of them.)']], spawn: { kind: 'atst', at: [-220, -140], hp: 16, roam: 10, speed: 1.2, tag: 'walker', hostile: hostile(60, 2, 12) } }], done: [['Omera', 'You could stay, you know. There’s room here.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 160, speed: 40, every: 90 }],
  },
};
