// The Mandalorian's and Ahsoka's worlds, from the ground: Nevarro, Mandalore,
// Lothal and Sorgan. (sites/index.js has what a site is.)

const sky = (zenith, horizon, sun, extra = {}) => ({ zenith, horizon, haze: 0.8, hazeColor: horizon, suns: [{ az: 0.6, el: 0.35, color: sun, size: 0.016, glow: 1.1 }], clouds: { cover: 0.3, color: '#ffffff', shade: '#9aa0aa', scale: 0.6, speed: 0.005 }, ...extra });
const palette = (low, high, rock, accent, extra = {}) => ({ low, high, rock, accent, deep: rock, hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, ...extra });
const hostile = (range, every, damage) => ({ range, every, damage, spread: 0.06 });
const troops = (tag, n, at, kind = 'stormtrooper') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(42, 2.3, 8) });

export const SITES = {
  nevarro: {
    place: 'The lava fields outside Nevarro City',
    line: 'Black rock, rivers of fire, and a town that runs on bounties.',
    sky: sky('#5a6a80', '#c8a890', '#ffd8b0', { clouds: { cover: 0.55, color: '#d8ccc0', shade: '#5a5048', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#a89080', density: 0.0012 },
    light: { sun: 2.4, sky: '#b0b8c8', ground: '#5a4038', ambient: 0.7 },
    ground: { seed: 21, layers: [{ type: 'swell', scale: 380, height: 10 }, { type: 'hills', scale: 120, height: 8 }, { type: 'mountains', from: 650, to: 3000, height: 480, scale: 1100 }], palette: palette('#3a3432', '#5a504a', '#2a2422', '#7a3a22', { mark: '#2a2220' }) },
    land: { at: [0, 0], yaw: 0.6 },
    places: [
      { id: 'town', name: 'Nevarro City', at: [140, -90], r: 60, flat: { r: 58 }, about: 'The guild’s town: Greef Karga’s cantina, the bounty hunters’ haunt, the Armorer’s forge under the streets.', things: [{ kind: 'cantina', at: [0, 0], yaw: 0.3 }, { kind: 'adobe', at: [26, 18] }, { kind: 'adobe', at: [-28, 20] }, { kind: 'adobe', at: [20, -28] }, { kind: 'crates', at: [-14, -12] }, { kind: 'stall', at: [12, 14], yaw: 2.4 }] },
      { id: 'crest', name: 'The Razor Crest', at: [40, -170], r: 30, flat: { r: 30 }, about: 'Din Djarin’s gunship, older than it looks and patched in more places than it should be.', things: [{ kind: 'razorcrest', at: [0, 0], yaw: 1.2 }] },
      { id: 'base', name: 'The Imperial base', at: [-260, 160], r: 50, flat: { r: 48 }, about: 'An Imperial Remnant outpost, still running, still guarding something.', things: [{ kind: 'bunker', at: [0, 0], yaw: 2 }, { kind: 'crates', at: [16, 10] }, { kind: 'crates', at: [-12, 14] }, { kind: 'lamp', at: [10, -14] }] },
      { id: 'lava', name: 'The lava flats', at: [300, 260], r: 50, about: 'A crust of black glass over rivers of fire. Don’t stop walking.', things: [{ kind: 'needle', at: [0, 0], scale: 0.38, sink: 1 }] },
    ],
    zones: [
      {
        id: 'cantina',
        name: 'Greef Karga’s cantina',
        music: 'cantina',
        door: { at: [143, -80.4], r: 2.6, prompt: 'Go into the cantina' },
        back: [143.7, -78],
        inside: { build: 'cantinainside', spawn: [0, 14.6], yaw: Math.PI, exit: { at: [0, 16], r: 1.5 }, bounds: [11.5, 17, 6.6], rooms: [[0, 13.6, 1.6, 3.1, 0, 3.2], [0, 0, 11, 11, 0, 6.6, 'round']], light: { sky: '#8a7a6a', ground: '#201814', ambient: 0.6, fog: '#14100c', density: 0.018 }, lamps: [[0, 3.6, -1, '#ffb070', 34, 16], [0, 3, -8.2, '#9a7dff', 20, 10], [-7, 2.6, 3, '#ff9a50', 16, 12], [7, 2.6, 3, '#ff9a50', 16, 12]] },
        life: [
          { kind: 'villager', id: 'greef', at: [-9.9, -0.8], still: true, face: 1.5, name: 'Greef Karga', named: true, quest: 'puck', says: ['I have a job. It pays well. It’s not for everyone.'] },
          { kind: 'wuher', at: [0, 0.8], still: true, face: 0, name: 'The barkeep', says: ['Guild members only past the bar.'] },
          { kind: 'aqualish', n: 2, at: [4, 4], spread: 2, roam: 2, speed: 0.5, name: 'Bounty hunter', says: ['Took a puck? So did I. Same one, probably.'] },
          { kind: 'twilek', at: [-4, 5], still: true, face: 2.4, name: 'A Twi’lek hunter', says: ['Mandalorians. Never take the helmet off.'] },
        ],
      },
    ],
    life: [
      { kind: 'dindjarin', id: 'mando', at: [48, -160], still: true, face: 2.4, name: 'The Mandalorian', named: true, quest: 'protect', says: ['This is the Way.', 'I can bring you in warm, or I can bring you in cold.'] },
      { kind: 'grogu', at: [44, -156], still: true, face: 2.6, name: 'The Child', says: ['(He holds up a tiny hand, and looks very serious about it.)', '(A small coo.)'] },
      { kind: 'ig11', at: [130, -60], roam: 8, speed: 0.8, name: 'IG-11', named: true, says: ['I am a nurse droid. I am programmed to protect the child.'] },
      { kind: 'stormtrooper', n: 4, at: [-260, 160], spread: 20, roam: 12, speed: 1.2, name: 'Remnant stormtrooper', says: ['Move along. This area is restricted.'] },
      { kind: 'villager', n: 4, at: [140, -90], spread: 30, roam: 18, speed: 1, name: 'Nevarro local', says: ['The guild’s back in business. The Empire’s not.'] },
    ],
    quests: [
      { id: 'puck', name: 'The bounty puck', giver: 'greef', intro: [['Greef Karga', 'A puck for you: the client wants an asset from the Imperial base. Alive. Questions are extra.']], steps: [{ type: 'reach', at: [-260, 160], r: 40, text: 'Go to the Imperial base' }, { type: 'shoot', tag: 'basetroops', n: 6, text: 'Get past the guards', spawn: troops('basetroops', 6, [-260, 160]) }, { type: 'collect', item: 'asset', n: 1, spots: [[-252, 166]], text: 'Collect the asset' }, { type: 'talk', zone: 'cantina', actor: 'greef', text: 'Take it to Greef Karga' }], done: [['Greef Karga', 'The client is pleased. Here: camtono of beskar. Don’t spend it all at once.']] },
      { id: 'protect', name: 'This is the Way', giver: 'mando', intro: [['The Mandalorian', 'Death troopers. They’ve tracked the kid here. Help me hold them off.']], steps: [{ type: 'shoot', tag: 'death', n: 5, text: 'Protect the Child from the death troopers', spawn: { ...troops('death', 5, [90, -210], 'deathtrooper'), hostile: hostile(45, 1.8, 10) } }], done: [['The Mandalorian', 'This is the Way.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 90, speed: 100, every: 50 }],
  },

  mandalore: {
    place: 'The glassed plains of Mandalore',
    line: 'The Empire turned the surface to glass. Under it, the Living Waters still run.',
    sky: sky('#5a4a78', '#c8a8c8', '#f0d8ff'),
    fog: { color: '#a890b0', density: 0.0014 },
    light: { sun: 2.2, sky: '#c0a8d8', ground: '#4a3a4a', ambient: 0.75 },
    ground: { seed: 33, wind: 0.8, layers: [{ type: 'swell', scale: 420, height: 6 }, { type: 'mesas', scale: 500, height: 30, cover: 0.25, cliff: 0.05 }, { type: 'mountains', from: 650, to: 3000, height: 400, scale: 1200 }], palette: palette('#6a6070', '#8a8090', '#3a3240', '#a8d0e0', { mark: '#4a4050' }) },
    weather: [{ kind: 'sand', count: 700 }],
    land: { at: [0, 0], yaw: 2.2 },
    places: [
      { id: 'sundari', name: 'The ruins of Sundari', at: [220, 120], r: 60, flat: { r: 50 }, about: 'The dome city, broken open. Glass where the gardens were.', things: [{ kind: 'adobe', at: [0, 0] }, { kind: 'adobe', at: [24, -10] }, { kind: 'needle', at: [-20, 16], scale: 0.5, sink: 1 }] },
      { id: 'mines', name: 'The mines', at: [-200, -180], r: 40, about: 'Old tunnels under the glass, and at the bottom of them, the Living Waters.', things: [{ kind: 'needle', at: [0, 0], scale: 0.75, sink: 1 }, { kind: 'lamp', at: [6, 6] }] },
      { id: 'covert', name: 'The covert’s camp', at: [-120, 220], r: 30, flat: { r: 24 }, about: 'Mandalorians, home again for the first time in years.', things: [{ kind: 'tent', at: [0, 0] }, { kind: 'tent', at: [8, -6], yaw: 1.4 }, { kind: 'fire', at: [2, 4] }] },
    ],
    life: [
      { kind: 'mando', id: 'armorer', at: [-116, 226], still: true, face: 2, name: 'The Armorer', named: true, quest: ['waters', 'reclaim'], says: ['This is the Way.'] },
      { kind: 'mando', n: 3, at: [-120, 220], spread: 8, roam: 6, speed: 1, name: 'Mandalorian', says: ['This is the Way.', 'For Mandalore!'] },
      { kind: 'bobafett', at: [210, 110], still: true, face: 1, name: 'A bounty hunter in green armour', says: ['(He says nothing. He doesn’t need to.)'] },
    ],
    quests: [
      { id: 'waters', name: 'The Living Waters', giver: 'armorer', intro: [['The Armorer', 'Go down to the Living Waters, under the mines, and you will be redeemed.']], steps: [{ type: 'reach', at: [-200, -180], r: 14, text: 'Go down to the mines' }, { type: 'use', id: 'bathe', at: [-200, -180], r: 8, prompt: 'Recite the Creed', text: 'Bathe in the Living Waters', end: [{ say: [[null, '(The water is cold and very deep. Something huge moves far below you.)']] }, { shake: 0.6 }] }], done: [['The Armorer', 'You are redeemed. This is the Way.']] },
      { id: 'reclaim', name: 'For Mandalore', giver: 'armorer', steps: [{ type: 'shoot', tag: 'remnant', n: 8, text: 'Drive the Remnant out of Sundari', spawn: troops('remnant', 8, [220, 120]) }], done: [['The Armorer', 'Mandalore is ours again.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 110, speed: 110, every: 60 }],
  },

  lothal: {
    place: 'The grass plains of Lothal',
    line: 'Tall grass to the horizon, stone spires, and Imperial factories on the edge of it all.',
    sky: sky('#5a90c8', '#d8e4c0', '#fff4d8'),
    fog: { color: '#c8d4b8', density: 0.0008 },
    light: { sun: 3, sky: '#b8d0f0', ground: '#7a8a4a', ambient: 0.75 },
    ground: { seed: 45, layers: [{ type: 'swell', scale: 460, height: 8 }, { type: 'hills', scale: 160, height: 10 }, { type: 'mountains', from: 700, to: 3000, height: 360, scale: 1300 }], palette: palette('#7a9a48', '#a8b868', '#7a7268', '#c8b858', { mark: '#5a6a38' }) },
    land: { at: [0, 0], yaw: 1 },
    places: [
      { id: 'capital', name: 'Capital City', at: [260, -60], r: 60, flat: { r: 56 }, about: 'Lothal’s capital: stone towers, and an Imperial factory where the farms used to be.', things: [{ kind: 'adobe', at: [0, 0] }, { kind: 'adobe', at: [20, 14] }, { kind: 'adobe', at: [-18, 12] }, { kind: 'crates', at: [8, -16] }] },
      { id: 'factory', name: 'The Imperial factory', at: [-220, -200], r: 50, flat: { r: 46 }, about: 'Where the TIEs are built. The grass doesn’t grow back round it.', things: [{ kind: 'bunker', at: [0, 0], yaw: 1 }, { kind: 'crates', at: [14, 8] }] },
      { id: 'tower', name: 'The old Imperial tower', at: [-320, 60], r: 40, flat: { r: 30 }, about: 'A comms tower the Empire left behind on the plains. Sabine Wren lives in it now, and paints it.', things: [{ kind: 'lookout', at: [0, 0], yaw: 0.3 }, { kind: 'crates', at: [10, -8] }] },
      { id: 'spires', name: 'The Jedi temple ruins', at: [-140, 230], r: 40, about: 'Old stones in the grass, older than the Empire, older than the Republic.', things: [{ kind: 'needle', at: [0, 0], scale: 0.62, sink: 1 }, { kind: 'needle', at: [10, 8], scale: 0.38, sink: 1 }] },
    ],
    life: [
      { kind: 'ahsoka', id: 'ahsoka', at: [-130, 220], still: true, face: 3, name: 'Ahsoka Tano', named: true, quest: 'starmap', says: ['I’m no Jedi.', 'The Force will show you the way.'] },
      { kind: 'farmer', id: 'ryder', at: [250, -50], still: true, face: 2, name: 'Governor Azadi', named: true, quest: 'factory', says: ['Lothal is free. Let’s keep it that way.'] },
      { kind: 'stormtrooper', n: 4, at: [-220, -200], spread: 18, roam: 12, speed: 1.2, name: 'Remnant stormtrooper', says: ['Back away from the factory.'] },
      { kind: 'villager', n: 5, at: [260, -60], spread: 30, roam: 15, speed: 1, name: 'Lothal farmer', says: ['The loth-wolves came back. That has to mean something.'] },
    ],
    quests: [
      { id: 'starmap', name: 'The star map', giver: 'ahsoka', intro: [['Ahsoka Tano', 'The map to Thrawn is in pieces, hidden in the old temple stones. Find them.']], steps: [{ type: 'collect', item: 'shard', n: 3, spots: [[-150, 240], [-128, 218], [-146, 214]], text: 'Find the pieces of the star map' }, { type: 'use', id: 'map', at: [-140, 230], r: 6, prompt: 'Fit the pieces together', text: 'Open the star map', end: [{ shake: 0.4 }, { say: [[null, '(Points of light fill the air: a route to another galaxy.)']] }] }], done: [['Ahsoka Tano', 'Peridea. So that’s where they went.']] },
      { id: 'factory', name: 'Shut down the factory', giver: 'ryder', steps: [{ type: 'shoot', tag: 'factory', n: 8, text: 'Clear the Remnant from the factory', spawn: troops('factory', 8, [-220, -200]) }, { type: 'use', id: 'power', at: [-220, -200], r: 6, prompt: 'Shut down the power', text: 'Shut the factory down', end: [{ sound: 'crash' }, { shake: 0.8 }] }], done: [['Governor Azadi', 'No more TIEs from Lothal.']] },
    ],
    // the rock spires out west, between the landing and the old tower (the
    // star map mission's run goes through them)
    things: [[-31, 4, 0.32], [-9, 35, 0.42], [-48, 46, 0.37], [-68, 14, 0.46], [-108, 32, 0.42], [-114, 69, 0.42], [-161, 68, 0.32], [-181, 37, 0.46], [-218, 53, 0.37], [-231, 88, 0.42], [-271, 71, 0.42], [-276, 34, 0.46]].map(([x, z, scale]) => ({ kind: 'needle', at: [x, z], scale, sink: 1 })),
    rides: [{ kind: 'speederbike', at: [12, -10], yaw: -1.2 }],
    flyovers: [{ kind: 'xwing', n: 1, metres: 12.5, alt: 80, speed: 100, every: 70 }, { kind: 'tie', n: 1, metres: 7, alt: 100, speed: 110, every: 90 }],
  },

  sorgan: {
    place: 'The forests of Sorgan',
    line: 'Misty woods, krill ponds, and a village with nothing worth stealing but its harvest.',
    sky: sky('#7a98b0', '#d0dcd8', '#fff0d8', { clouds: { cover: 0.5, color: '#f0f4f4', shade: '#a0aca8', scale: 0.6, speed: 0.004 } }),
    fog: { color: '#c0ccc4', density: 0.0018 },
    light: { sun: 2.4, sky: '#b8c8d0', ground: '#4a5a3a', ambient: 0.8 },
    ground: { seed: 57, layers: [{ type: 'swell', scale: 300, height: 6 }, { type: 'hills', scale: 110, height: 9 }, { type: 'mountains', from: 650, to: 3000, height: 300, scale: 1100 }], palette: palette('#4a6a38', '#6a8a48', '#5a5a50', '#8a7a48', { mark: '#3a4a2a' }) },
    land: { at: [0, 0], yaw: 0.3 },
    places: [
      { id: 'village', name: 'The krill farmers’ village', at: [180, 120], r: 50, flat: { r: 46 }, about: 'Huts on stilts over the ponds, and a harvest the raiders keep coming back for.', things: [{ kind: 'tent', at: [0, 0] }, { kind: 'tent', at: [12, 8], yaw: 1 }, { kind: 'tent', at: [-10, 10], yaw: 2 }, { kind: 'fire', at: [2, -4] }, { kind: 'crates', at: [-8, -10] }] },
      { id: 'raiders', name: 'The raiders’ camp', at: [-240, -160], r: 40, flat: { r: 30 }, about: 'Klatooinian raiders, and something big under a tarp.', things: [{ kind: 'tent', at: [0, 0] }, { kind: 'fire', at: [4, 4] }, { kind: 'crates', at: [-6, 8] }] },
      { id: 'woods', name: 'The deep woods', at: [-120, 220], r: 40, about: 'Old trees and mist. Something with a lot of teeth hunts here at night.', things: [{ kind: 'needle', at: [0, 0], scale: 0.38, sink: 1 }] },
    ],
    scatter: [{ kind: 'rock', n: 80, within: [40, 500], scale: [0.6, 2.4], opts: { color: '#6a6a5a' } }],
    life: [
      { kind: 'villager', id: 'omera', at: [186, 112], still: true, face: 2.4, name: 'Omera', named: true, quest: 'raiders', says: ['We can pay. Not much, but we can pay.'] },
      { kind: 'villager', n: 5, at: [180, 120], spread: 20, roam: 12, speed: 0.9, name: 'Krill farmer', says: ['The raiders come at harvest. Every harvest.'] },
      { kind: 'grogu', at: [176, 126], still: true, face: 1, name: 'The Child', says: ['(He’s eating a frog. Again.)'] },
    ],
    quests: [
      { id: 'raiders', name: 'Sanctuary', giver: 'omera', intro: [['Omera', 'Raiders. And they’ve got an Imperial walker. Will you help us?']], steps: [{ type: 'shoot', tag: 'raiders', n: 6, text: 'Drive off the Klatooinian raiders', spawn: { kind: 'aqualish', n: 6, at: [-240, -160], spread: 14, roam: 6, hp: 2, tag: 'raiders', hostile: hostile(42, 2.4, 8) } }, { type: 'shoot', tag: 'walker', n: 1, text: 'Bring down the AT-ST', lines: [[null, '(The trees split. An AT-ST steps out of them.)']], spawn: { kind: 'atst', at: [-220, -140], hp: 16, roam: 10, speed: 1.2, tag: 'walker', hostile: hostile(60, 2, 12) } }], done: [['Omera', 'You could stay, you know. There’s room here.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 160, speed: 40, every: 90 }],
  },
};
