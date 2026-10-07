// The Mandalorian's and Ahsoka's worlds, from the ground: Nevarro, Mandalore,
// Lothal and Sorgan. (sites/index.js has what a site is.)

import { grove } from './stand';

const sky = (zenith, horizon, sun, extra = {}) => ({ zenith, horizon, haze: 0.8, hazeColor: horizon, suns: [{ az: 0.6, el: 0.35, color: sun, size: 0.016, glow: 1.1 }], clouds: { cover: 0.3, color: '#ffffff', shade: '#9aa0aa', scale: 0.6, speed: 0.005 }, ...extra });
const palette = (low, high, rock, accent, extra = {}) => ({ low, high, rock, accent, deep: rock, hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, ...extra });
const hostile = (range, every, damage) => ({ range, every, damage, spread: 0.06 });
const troops = (tag, n, at, kind = 'stormtrooper') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(42, 2.3, 8) });
// n spots evenly round a circle of radius r (a turn of `phase` first), each
// [x, z, yaw] with its front to the middle
const ring = (n, r, phase = 0) => Array.from({ length: n }, (_, i) => {
  const a = phase + (i / n) * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2];
});

// Lothal's rock spires out west, between the landing and the old tower (the
// star map mission's run goes through them)
const LOTHAL_SPIRES = [[-31, 4, 0.32], [-9, 35, 0.42], [-48, 46, 0.37], [-68, 14, 0.46], [-108, 32, 0.42], [-114, 69, 0.42], [-161, 68, 0.32], [-181, 37, 0.46], [-218, 53, 0.37], [-231, 88, 0.42], [-271, 71, 0.42], [-276, 34, 0.46]].map(([x, z, scale], i) => ({ kind: 'lothspire', at: [x, z], yaw: i * 1.7, opts: { h: scale * 49, r: scale * 11, seed: i + 1 } }));

export const SITES = {
  nevarro: {
    place: 'The lava fields outside Nevarro City',
    line: 'Black rock, rivers of fire, and a town that runs on bounties.',
    // (The Mandalorian's Nevarro: black volcanic rock and grey ash under a
    // cool steel-blue overcast, the haze grey, not brown)
    sky: sky('#5a6d8e', '#a9b5c3', '#ffe2c0', { clouds: { cover: 0.6, color: '#c9ced4', shade: '#4c5058', scale: 0.6, speed: 0.006 } }),
    fog: { color: '#9ca6b0', density: 0.0012 },
    light: { sun: 2.4, sky: '#b4c0d0', ground: '#3a3b40', ambient: 0.72 },
    ground: { detail: 'ash', detailLook: { color: 0.7, normal: 0.8 }, seed: 21, layers: [{ type: 'swell', scale: 380, height: 10 }, { type: 'hills', scale: 120, height: 8 }, { type: 'mountains', from: 650, to: 3000, height: 480, scale: 1100 }], palette: palette('#26282e', '#36373d', '#1e2226', '#5a5a56', { mark: '#18191c' }) },
    land: { at: [0, 0], yaw: 0.6 },
    places: [
      { id: 'town', name: 'Nevarro City', at: [140, -90], r: 60, flat: { r: 58 }, about: 'The guild’s town: Greef Karga’s cantina, the bounty hunters’ haunt, the Armorer’s forge under the streets.', things: [{ kind: 'cantina', at: [0, 0], yaw: 0.3 }, { kind: 'nevarrodome', at: [27, 18], yaw: 0.4, sink: 0.3 }, { kind: 'nevarrodome', at: [-29, 21], yaw: 1.9, scale: 0.85, sink: 0.3 }, { kind: 'nevarrodome', at: [21, -29], yaw: 2.8, scale: 1.15, sink: 0.3 }, { kind: 'nevarrodome', at: [-24, -26], yaw: 0.9, scale: 0.7, sink: 0.3 }, { kind: 'nevarrodome', at: [40, -4], yaw: 3.3, scale: 0.9, sink: 0.3 }, { kind: 'nevarroarch', at: [-40, 25], yaw: -1, sink: 0.2 }, { kind: 'crates', at: [-14, -12] }, { kind: 'stall', at: [12, 14], yaw: 2.4 }, { kind: 'stall', at: [-10, 16], yaw: 0.6 }, { kind: 'lamp', at: [-34, 18] }, { kind: 'lamp', at: [-30, 29] }, ...grove(7, 26, 50, 78, ['lavarock'], [1.2, 4]).filter((t) => Math.hypot(t.at[0] + 40, t.at[1] - 25) > 16)] },
      { id: 'crest', name: 'The Razor Crest', at: [40, -170], r: 30, flat: { r: 30 }, about: 'Din Djarin’s gunship, older than it looks and patched in more places than it should be.', things: [{ kind: 'razorcrest', at: [0, 0], yaw: 1.2 }] },
      { id: 'base', name: 'The Imperial base', at: [-260, 160], r: 50, flat: { r: 48 }, about: 'An Imperial Remnant outpost, still running, still guarding something.', things: [{ kind: 'bunker', at: [0, 0], yaw: 2 }, { kind: 'crates', at: [16, 10] }, { kind: 'crates', at: [-12, 14] }, { kind: 'lamp', at: [10, -14] }] },
      // (pools of it, sunk in the flats: lavaRules.js's, and they burn)
      { id: 'lava', name: 'The lava flats', at: [300, 260], r: 50, about: 'A crust of black glass over rivers of fire. Don’t stop walking.', things: grove(41, 14, 4, 40, ['lavarock'], [1.5, 4.5]), pits: [{ at: [0, 0], r: 22, depth: 4, lava: 1.2 }, { at: [-30, 20], r: 13, depth: 3.5, lava: 1.1 }, { at: [28, -24], r: 15, depth: 3.5, lava: 1.1 }] },
    ],
    // the guild's cargo where you set down, and black lava rock everywhere,
    // the big ones further out
    things: [
      { kind: 'cratecube', at: [14, 10], yaw: 0.4 },
      { kind: 'cratecube', at: [15.3, 10.5], yaw: 1.1 },
      { kind: 'barrel', at: [12.5, 12], yaw: 0.2 },
      { kind: 'empirecrate', at: [-16, -8], yaw: 2.3 },
      { kind: 'lamp', at: [18, 6] },
    ],
    scatter: [
      { kind: 'lavarock', n: 110, within: [24, 420], scale: [0.35, 1.6], sink: 0.25, solid: 0.6 },
      { kind: 'lavarock', n: 40, within: [120, 800], scale: [2, 5], sink: 0.6 },
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
      { kind: 'r5', n: 1, at: [12, 6], roam: 6, speed: 0.6, name: 'An R5 unit', says: ['(A sulky beep. Somebody stole its restraining bolt. For the bolt.)'] },
      // (the beasts of burden: blurrgs on the lava fields, a happabore in town)
      { kind: 'blurrg', n: 2, at: [70, -130], spread: 12, roam: 14, speed: 0.9, r: 1 },
      { kind: 'happabore', n: 1, at: [178, -108], roam: 8, speed: 0.5, r: 1.8 },
      { kind: 'aqualish', n: 1, at: [-14, -4], still: true, face: 0.8, name: 'Bounty hunter', says: ['Guild business. Keep walking.', 'Cantina’s in town. Karga’s buying. Karga’s never buying.'] },
    ],
    quests: [
      { id: 'puck', name: 'The bounty puck', giver: 'greef', intro: [['Greef Karga', 'A puck for you: the client wants an asset from the Imperial base. Alive. Questions are extra.']], steps: [{ type: 'reach', at: [-260, 160], r: 40, text: 'Go to the Imperial base' }, { type: 'shoot', tag: 'basetroops', n: 6, text: 'Get past the guards', spawn: troops('basetroops', 6, [-260, 160]) }, { type: 'collect', item: 'asset', n: 1, spots: [[-252, 166]], text: 'Collect the asset' }, { type: 'talk', zone: 'cantina', actor: 'greef', text: 'Take it to Greef Karga' }], done: [['Greef Karga', 'The client is pleased. Here: camtono of beskar. Don’t spend it all at once.']] },
      { id: 'protect', name: 'This is the Way', giver: 'mando', intro: [['The Mandalorian', 'Death troopers. They’ve tracked the kid here. Help me hold them off.']], steps: [{ type: 'shoot', tag: 'death', n: 5, text: 'Protect the Child from the death troopers', spawn: { ...troops('death', 5, [90, -210], 'deathtrooper'), hostile: { ...hostile(45, 2.6, 7), burst: { n: 3, gap: 0.1 }, strafe: { speed: 2.6, every: 2.2, keep: 14 } } } }], done: [['The Mandalorian', 'This is the Way.']] },
    ],
    flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 90, speed: 100, every: 50 }],
  },

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
      { id: 'mines', name: 'The mines', at: [-200, -180], r: 40, about: 'Old tunnels under the glass, and at the bottom of them, the Living Waters.', things: [{ kind: 'needle', at: [0, 0], scale: 0.75, sink: 1 }, { kind: 'lamp', at: [6, 6] }, ...grove(29, 10, 12, 30, ['glassshard'], [0.8, 2.4])] },
      { id: 'covert', name: 'The covert’s camp', at: [-120, 220], r: 30, flat: { r: 24 }, about: 'Mandalorians, home again for the first time in years.', things: [{ kind: 'tent', at: [0, 0] }, { kind: 'tent', at: [8, -6], yaw: 1.4 }, { kind: 'fire', at: [2, 4] }] },
    ],
    // the glass the bombs left, in shards across the plain
    scatter: [{ kind: 'glassshard', n: 160, within: [25, 650], scale: [0.6, 2.6], sink: 0.3, solid: 0.4 }],
    life: [
      { kind: 'armorer', id: 'armorer', at: [-116, 226], still: true, face: 2, name: 'The Armorer', named: true, quest: ['waters', 'reclaim'], says: ['This is the Way.'] },
      { kind: 'mando', n: 3, at: [-120, 220], spread: 8, roam: 6, speed: 1, name: 'Mandalorian', says: ['This is the Way.', 'For Mandalore!'] },
      { kind: 'bobafett', at: [205, 85], still: true, face: 1, name: 'A bounty hunter in green armour', says: ['(He says nothing. He doesn’t need to.)'] },
    ],
    quests: [
      { id: 'waters', name: 'The Living Waters', giver: 'armorer', intro: [['The Armorer', 'Go down to the Living Waters, under the mines, and you will be redeemed.']], steps: [{ type: 'reach', at: [-200, -180], r: 14, text: 'Go down to the mines' }, { type: 'use', id: 'bathe', at: [-200, -180], r: 8, prompt: 'Recite the Creed', text: 'Bathe in the Living Waters', end: [{ say: [[null, '(The water is cold and very deep. Something huge moves far below you.)']] }, { shake: 0.6 }] }], done: [['The Armorer', 'You are redeemed. This is the Way.']] },
      { id: 'reclaim', name: 'For Mandalore', giver: 'armorer', steps: [{ type: 'shoot', tag: 'remnant', n: 8, text: 'Drive the Remnant out of Sundari', spawn: troops('remnant', 8, [215, 100]) }], done: [['The Armorer', 'Mandalore is ours again.']] },
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
    grass: { h: [0.8, 1.3], w: 0.15, root: '#86704a', mid: '#c6ad72', tip: '#ead9a8', dry: '#b0a26c', cover: 0.93, scale: 150, wind: 1.0, patch: 1.15, flower: { color: '#f2e6bc', share: 0.02 } },
    land: { at: [0, 0], yaw: 1 },
    places: [
      { id: 'capital', name: 'Capital City', at: [260, -60], r: 60, flat: { r: 56 }, about: 'Lothal’s capital: stone towers, and an Imperial factory where the farms used to be.', things: [{ kind: 'lothdome', at: [0, 4], yaw: 3.4, sink: 0.2 }, { kind: 'lothdome', at: [27, 18], yaw: 4.2, scale: 0.85, sink: 0.2 }, { kind: 'lothdome', at: [-26, 16], yaw: 2.4, scale: 0.9, sink: 0.2 }, { kind: 'lothdome', at: [20, -24], yaw: 5.4, scale: 0.75, sink: 0.2 }, { kind: 'crates', at: [8, -16] }, { kind: 'crates', at: [-10, -12], yaw: 0.7 }] },
      { id: 'factory', name: 'The Imperial factory', at: [-220, -200], r: 50, flat: { r: 46 }, about: 'Where the TIEs are built. The grass doesn’t grow back round it.', things: [{ kind: 'bunker', at: [0, 0], yaw: 1 }, { kind: 'crates', at: [14, 8] }] },
      { id: 'tower', name: 'The old Imperial tower', at: [-320, 60], r: 40, flat: { r: 30 }, about: 'A comms tower the Empire left behind on the plains. Sabine Wren lives in it now, and paints it.', things: [{ kind: 'lookout', at: [0, 0], yaw: 0.3 }, { kind: 'crates', at: [10, -8] }] },
      { id: 'spires', name: 'The Jedi temple', at: [-140, 230], r: 50, flat: { r: 34 }, about: 'A great cone of banded stone in the grass, older than the Empire, older than the Republic. The way in only opens to the Force.', things: [{ kind: 'lothtemple', at: [0, -12], yaw: 0.4, sink: 1 }, { kind: 'lothtemple', at: [30, 6], yaw: 2, scale: 0.26, sink: 0.5 }, { kind: 'lothtemple', at: [-28, 2], yaw: 4, scale: 0.32, sink: 0.5 }, { kind: 'lothtemple', at: [-20, -40], yaw: 1, scale: 0.22, sink: 0.5 }, { kind: 'lothtemple', at: [24, -38], yaw: 3, scale: 0.18, sink: 0.5 }] },
    ],
    life: [
      { kind: 'ahsoka', id: 'ahsoka', at: [-130, 220], still: true, face: 3, name: 'Ahsoka Tano', named: true, quest: 'starmap', says: ['I’m no Jedi.', 'The Force will show you the way.'] },
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
      { id: 'factory', name: 'Shut down the factory', giver: 'ryder', steps: [{ type: 'shoot', tag: 'factory', n: 8, text: 'Clear the Remnant from the factory', spawn: troops('factory', 8, [-220, -200]) }, { type: 'use', id: 'power', at: [-220, -200], r: 6, prompt: 'Shut down the power', text: 'Shut the factory down', end: [{ sound: 'crash' }, { shake: 0.8 }] }], done: [['Governor Azadi', 'No more TIEs from Lothal.']] },
    ],
    // (the plains' tall grass is the grass field round you: `grass`)
    scatter: [],
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
    // (the wet meadow round the krill farm, olive under a grey sky)
    grass: { h: [0.3, 0.6], w: 0.06, root: '#4a482d', mid: '#5f6236', tip: '#7f7c4a', dry: '#887a4c', cover: 0.72, scale: 90, wind: 0.2 },
    land: { at: [0, 0], yaw: 0.3 },
    places: [
      { id: 'village', name: 'The krill farmers’ village', at: [180, 120], r: 50, flat: { r: 46 }, about: 'Huts on stilts over the ponds, and a harvest the raiders keep coming back for.', things: [...ring(5, 21, 0.4).map(([x, z, yaw]) => ({ kind: 'stilthut', at: [x, z], yaw, sink: 0.15 })), { kind: 'fire', at: [2, -4] }, { kind: 'crates', at: [-8, -10] }, { kind: 'crates', at: [9, 6], yaw: 0.8 }, ...ring(7, 34, 0.9).map(([x, z, yaw]) => ({ kind: 'sorganfern', at: [x, z], yaw, scale: 1.3, solid: false })), ...grove(11, 30, 54, 84, ['sorganbirch', 'sorganbirch', 'sorganfir'])] },
      { id: 'raiders', name: 'The raiders’ camp', at: [-240, -160], r: 40, flat: { r: 30 }, about: 'Klatooinian raiders, and something big under a tarp.', things: [{ kind: 'tent', at: [0, 0] }, { kind: 'fire', at: [4, 4] }, { kind: 'crates', at: [-6, 8] }] },
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
      { kind: 'rock', n: 60, within: [40, 500], scale: [0.6, 2.4], opts: { color: '#6a6a5a' } },
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
      { id: 'raiders', name: 'Sanctuary', giver: 'omera', intro: [['Omera', 'Raiders. And they’ve got an Imperial walker. Will you help us?']], steps: [{ type: 'shoot', tag: 'raiders', n: 6, text: 'Drive off the Klatooinian raiders', spawn: { kind: 'aqualish', n: 6, at: [-240, -160], spread: 14, roam: 6, hp: 2, tag: 'raiders', hostile: hostile(42, 2.4, 8) } }, { type: 'shoot', tag: 'walker', n: 1, text: 'Bring down the AT-ST', lines: [[null, '(The trees split. An AT-ST steps out of them.)']], spawn: { kind: 'atst', at: [-220, -140], hp: 16, roam: 10, speed: 1.2, tag: 'walker', hostile: hostile(60, 2, 12) } }], done: [['Omera', 'You could stay, you know. There’s room here.']] },
    ],
    flyovers: [{ kind: 'freighter', n: 1, metres: 40, alt: 160, speed: 40, every: 90 }],
  },
};
