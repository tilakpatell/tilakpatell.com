// The skill tree's four guns in the hand (lib/arms/hand.js's unique ones),
// built in code as gunplay.js's are (./kit.js), and spread into its GUNS:
// how each is held, how it kicks, its flash and its bolt.
//
// - The Amban phase-pulse rifle (The Mandalorian): long and thin, a scope,
//   the barrel ending in a pair of prongs with a pale light between them.
// - The particle beam (Rick's): a boxy body, a chamber of green glass, coils
//   round the barrel and a dish at its end.
// - The M60 (the one from the trunk): belt-fed, a carry handle on the barrel,
//   the bipod folded under it and the ammunition box hung on its left.
// - The repulsor gauntlet (Tony's): red and gold plate over the hand and the
//   forearm, the palm's ring lit, held as a pistol is (the "muzzle" the palm).

import { kit, mats } from './kit';

const PALE = '#bfe6ff';
const GREEN = '#7dff9a';
const REPULSOR = '#bfefff';

export const UNIQUE_GUNS = {
  amban: {
    hands: 2,
    support: false,
    stock: true,
    pitch: 0.06,
    reach: 0.38,
    rise: -0.15,
    lateral: -0.3,
    kick: { back: 1.6, up: 2.8 },
    casing: false,
    flash: { color: PALE, size: 0.3 },
    bolt: '#e6f4ff',
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.04, 0.058, 0.26, m.gunmetal, [0, 0.05, 0.06]); // the receiver
      k.tube(0.016, 0.18, m.steel, [0, 0.06, 0.28]); // the barrel's shroud
      k.tube(0.01, 0.42, m.steel, [0, 0.06, 0.56]); // the barrel
      for (const sx of [-1, 1]) k.box(0.006, 0.006, 0.07, m.steel, [sx * 0.013, 0.06, 0.8]); // the prongs
      k.ring(0.013, 0.003, m.glow(PALE, 3), [0, 0.06, 0.78], [0, 0, 0]); // the light between them
      k.tube(0.015, 0.26, m.black, [0, 0.112, 0.12]); // the scope
      k.tube(0.02, 0.03, m.black, [0, 0.112, 0.24]); // its bell
      k.box(0.008, 0.026, 0.014, m.black, [0, 0.088, 0.04]);
      k.box(0.008, 0.026, 0.014, m.black, [0, 0.088, 0.18]);
      k.box(0.03, 0.054, 0.28, m.wood, [0, 0.03, -0.2]); // the stock
      k.box(0.034, 0.09, 0.03, m.brown, [0, 0.005, -0.33]); // the butt
      k.box(0.03, 0.09, 0.035, m.brown, [0, -0.035, -0.02], [0.28, 0, 0]).name = 'grip';
      k.box(0.024, 0.006, 0.05, m.steel, [0, 0.0, 0.03]);
      k.box(0.004, 0.024, 0.012, m.steel, [0, 0.012, 0.03], [0.3, 0, 0]);
      k.point('muzzle', [0, 0.06, 0.84]);
      k.point('foregrip', [0, 0.01, 0.3]);
      k.point('fore', [0, 0.045, 0.3]);
    },
    fore: { r: 0.02, axis: 'dir' },
  },
  particle: {
    hands: 2,
    support: false,
    stock: true,
    pitch: 0.06,
    reach: 0.36,
    rise: -0.15,
    lateral: -0.3,
    kick: { back: 0.2, up: 0.3 },
    casing: false,
    flash: { color: GREEN, size: 0.2 },
    bolt: GREEN,
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.07, 0.08, 0.3, m.grey, [0, 0.05, 0.05]); // the body
      k.tube(0.028, 0.14, m.glass(GREEN), [0, 0.11, 0.06]); // the chamber
      k.tube(0.012, 0.12, m.glow(GREEN, 2), [0, 0.11, 0.06]); // what's in it
      k.tube(0.018, 0.22, m.gunmetal, [0, 0.05, 0.3]); // the barrel
      for (let i = 0; i < 4; i++) k.ring(0.028, 0.006, m.steel, [0, 0.05, 0.23 + i * 0.04], [0, 0, 0]); // the coils
      k.cone(0.02, 0.045, 0.05, m.grey, [0, 0.05, 0.43]); // the dish
      k.ball(0.012, m.glow(GREEN, 3), [0, 0.05, 0.44]);
      k.box(0.04, 0.06, 0.14, m.grey, [0, 0.03, -0.16]); // the stock
      k.box(0.03, 0.09, 0.035, m.black, [0, -0.035, -0.02], [0.28, 0, 0]).name = 'grip';
      k.point('muzzle', [0, 0.05, 0.46]);
      k.point('foregrip', [0, 0.0, 0.24]);
      k.point('fore', [0, 0.05, 0.24]);
    },
    fore: { r: 0.03, axis: 'dir' },
  },
  m60: {
    hands: 2,
    support: false,
    stock: true,
    pitch: 0.06,
    reach: 0.36,
    rise: -0.15,
    lateral: -0.3,
    kick: { back: 0.9, up: 1.2 },
    casing: true,
    smoke: 2,
    flash: { color: '#ffd36b', size: 0.3 },
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      k.box(0.05, 0.07, 0.3, m.gunmetal, [0, 0.05, 0.05]); // the receiver
      k.box(0.052, 0.02, 0.14, m.black, [0, 0.095, 0.02]); // the feed cover
      k.tube(0.012, 0.5, m.gunmetal, [0, 0.06, 0.46]); // the barrel
      k.tube(0.022, 0.2, m.black, [0, 0.055, 0.28]); // the handguard
      k.tube(0.008, 0.3, m.gunmetal, [0, 0.035, 0.42]); // the gas tube
      k.box(0.01, 0.03, 0.1, m.black, [0, 0.1, 0.34]); // the carry handle
      for (const sx of [-1, 1]) k.box(0.006, 0.006, 0.26, m.steel, [sx * 0.02, 0.03, 0.54]); // the bipod, folded
      k.cone(0.014, 0.02, 0.05, m.black, [0, 0.06, 0.73]); // the flash hider
      k.box(0.06, 0.08, 0.1, m.olive, [-0.065, 0.0, 0.05]); // the ammunition box
      for (let i = 0; i < 4; i++) k.box(0.012, 0.008, 0.02, m.steel, [-0.03, 0.07, 0.01 + i * 0.022]); // the belt
      k.box(0.035, 0.07, 0.26, m.black, [0, 0.035, -0.22]); // the stock
      k.box(0.04, 0.1, 0.03, m.black, [0, 0.01, -0.35]);
      k.box(0.03, 0.09, 0.035, m.black, [0, -0.035, -0.02], [0.28, 0, 0]).name = 'grip';
      k.box(0.024, 0.006, 0.05, m.steel, [0, 0.0, 0.03]);
      k.box(0.004, 0.024, 0.012, m.steel, [0, 0.012, 0.03], [0.3, 0, 0]);
      k.point('muzzle', [0, 0.06, 0.76]);
      k.point('foregrip', [0, 0.02, 0.26]);
      k.point('fore', [0, 0.055, 0.26]);
      k.point('eject', [0.03, 0.06, 0.04]);
    },
    fore: { r: 0.022, axis: 'dir' },
  },
  gauntlet: {
    hands: 1,
    support: false,
    stock: false,
    pitch: 0.05,
    reach: 0.95,
    rise: 0.12,
    lateral: 0.0,
    kick: { back: 0.6, up: 1.8 },
    casing: false,
    flash: { color: REPULSOR, size: 0.32 },
    bolt: REPULSOR,
    build(g, owned) {
      const m = mats(owned);
      const k = kit(g, owned);
      const red = m.paint('#a3121c', 0.7);
      const gold = m.paint('#d4a43a', 0.85);
      k.tube(0.042, 0.2, red, [0, 0.02, -0.1]); // the forearm
      k.ring(0.043, 0.006, gold, [0, 0.02, -0.02], [0, 0, 0]); // the cuff
      k.box(0.07, 0.03, 0.09, gold, [0, 0.02, 0.05]); // the back of the hand
      for (let i = 0; i < 4; i++) k.box(0.014, 0.014, 0.05, red, [-0.024 + i * 0.016, 0.02, 0.115]); // the fingers
      k.box(0.016, 0.014, 0.04, red, [0.042, 0.01, 0.06], [0, -0.5, 0]); // the thumb
      k.ring(0.017, 0.004, m.glow(REPULSOR, 3), [0, 0.0, 0.1], [Math.PI / 2, 0, 0]); // the palm's ring
      k.ball(0.011, m.glow(REPULSOR, 4), [0, 0.0, 0.1]);
      k.box(0.03, 0.06, 0.03, red, [0, -0.02, 0.0]).name = 'grip';
      k.point('muzzle', [0, 0.0, 0.14]);
    },
  },
};
