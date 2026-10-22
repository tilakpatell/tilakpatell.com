// Who is aboard the two Death Stars, as plain data: the model each kind is
// drawn with, how tall it stands, the tint multiplied into its colours, the
// side it fights for, what it carries, how much it takes to put down, the
// voice its lines are said in, and the mind it gets by default. One table
// so the figures, the minds, the fights and the voices all agree on who a
// `kind` is. Most people are the site’s rigged models loaded by URL
// (Chewbacca is the cockpit’s, made and rigged by Meshy on the crew’s own
// skeleton, so he walks and fights on their clips); a few are another model
// dressed differently (the Death Star trooper is the officer in black under
// a helmet built in code, the Royal Guard is the senate guard in red), and
// two (the IT-O and the dianoga) are built in code until
// scripts/meshy-deathstar.mjs makes them models. Where the 2017 game has
// the person, `game` names its row of the site’s one cast table
// (src/lib/cast/bodies.js) and the figure is the game’s own body, the model
// its stand-in should that not load (scene/figures.js’s loadGame; the
// battlefront-by-default design, 2026-10-21, decision 4): the troops, the
// officers in the officer’s uniform (each in its tint, the technician dyed
// black), the Death Star troopers and gunners as the game’s death trooper
// in his own black armour, Vader, the Emperor, the heroes, the droids. The
// Royal Guard (the game has none), the TIE pilot (its pilots fly unseen),
// old Ben (its Obi-Wan is the Clone Wars general), the mouse droid, the
// IT-O and the dianoga stay as they are. Tarkin, the Emperor,
// Jerjerrod, Motti and Tagge get their voices along with the world’s lines,
// through the voices pipeline, so they have none here. Pure.
//
//   CAST[kind] → { name, model, game?, tall, tint?, dye?, side, gun?, blade?, hp, voice?, role, speed?, armour?,
//                  helmet?, built?, scripted?, perception? }
//     model: a path under public/, or null for a kind built in code, with `built` naming its builder
//       ('ito' | 'dianoga'); game: its row of the cast table, the body it is drawn as where that loads;
//       tall: metres; tint: a colour (0xrrggbb) multiplied into its materials;
//       dye: scene/dye.js’s { color, gain, keep, roughness }, its materials’ light and shade in that colour
//     side: 'imperial' | 'rebel' | 'neutral' (the station’s own words: doors, bolts and talks use them)
//     gun: a combat.js WEAPONS key; blade: { type: 'saber', colour } | { type: 'pike' }
//     voice: a speaker of scripts/voices, whose folder under public/audio/voiced/ its lines come from
//     role: 'soldier' | 'officer' | 'worker' | 'droid' | 'hero' | 'boss' | 'beast', the mind it starts with
//     speed: a scale on the walker’s walk and run (1 when absent); armour: its armour can be taken and
//     worn as a disguise; helmet: a helmet built in code to put on its model; scripted: only the story moves it
//     perception: where its senses differ from PERCEPTION’s
//   PERCEPTION → { sight, cone, far, shots, steps }   the station’s senses: sight in metres, the cone’s
//     cosine (55° either side), seconds to be sure at the edge of sight, how far a shot and a running step are heard
//   perceptionOf(kind) → { sight, cone, far, shots, steps }   PERCEPTION with the kind’s own changes, a fresh copy

const freeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v);
  return Object.freeze(o);
};

export const PERCEPTION = Object.freeze({ sight: 22, cone: 0.57, far: 1.2, shots: 18, steps: 6 });

const OFFICER = '/models/galaxy/crew/officer.glb';
const SHARP = { sight: 26 }; // an officer’s or a Royal Guard’s trained eye
// The Death Star’s own troops, gunners and crew wear black, not the officers’ grey: the officer’s
// uniform dyed charcoal (scene/dye.js), its folds and seams kept, with a little of a pressed
// cloth’s sheen. (A tint, a multiply, took the olive down to a silhouette.)
const BLACK = Object.freeze({ color: 0x34363c, gain: 2.2, keep: 0.05, roughness: 0.62 });

// The Death Star trooper and the gunner are the same man in the same black
// uniform and helmet; only the trooper carries a rifle. The station’s crew
// say their barks in the Imperial officer’s voice, the nearest the voices
// pipeline has to a naval rating’s.
// (on the game’s body, its death trooper: black armour and helmet of his own)
const NAVY = { model: OFFICER, game: 'deathtrooper', tall: 1.8, dye: BLACK, helmet: 'dstrooper', side: 'imperial', hp: 60, voice: 'imperialofficer' };

export const CAST = freeze({
  stormtrooper: { name: 'Stormtrooper', model: '/models/galaxy/troops/stormtrooper.glb', game: 'stormtrooper', tall: 1.83, side: 'imperial', gun: 'e11', hp: 60, voice: 'stormtrooper', role: 'soldier', armour: true },
  dstrooper: { name: 'Death Star trooper', ...NAVY, gun: 'e11', role: 'soldier' },
  gunner: { name: 'Death Star gunner', ...NAVY, role: 'worker' },
  officer: { name: 'Imperial officer', model: OFFICER, game: 'officer', tall: 1.78, side: 'imperial', gun: 'dh17', hp: 40, voice: 'imperialofficer', role: 'officer', perception: SHARP },
  tiepilot: { name: 'TIE pilot', model: '/models/galaxy/crew/tiepilot.glb', tall: 1.8, side: 'imperial', hp: 50, voice: 'imperialofficer', role: 'worker' },
  technician: { name: 'Imperial technician', model: OFFICER, game: 'officer', tall: 1.75, dye: BLACK, side: 'imperial', hp: 30, voice: 'imperialofficer', role: 'worker' },
  // the archive’s keeper, whom talk.js already gives a talk of his own by kind
  librarian: { name: 'Archive keeper', model: OFFICER, game: 'officer', tall: 1.74, side: 'imperial', hp: 30, voice: 'imperialofficer', role: 'worker' },
  vader: { name: 'Darth Vader', model: '/models/galaxy/crew/vader.glb', game: 'vader', tall: 2.03, side: 'imperial', blade: { type: 'saber', colour: 0xff2a1f }, hp: 300, voice: 'vader', role: 'boss', speed: 0.8, scripted: true },
  // the conference room’s three in the officer’s uniform, each a shade apart
  // so the eye tells them apart across the table
  tarkin: { name: 'Grand Moff Tarkin', model: OFFICER, game: 'officer', tall: 1.83, tint: 0xc8ccb4, side: 'imperial', hp: 40, role: 'officer', perception: SHARP },
  motti: { name: 'Admiral Motti', model: OFFICER, game: 'officer', tall: 1.8, tint: 0xb0b4b4, side: 'imperial', hp: 40, role: 'officer', perception: SHARP },
  tagge: { name: 'General Tagge', model: OFFICER, game: 'officer', tall: 1.85, tint: 0x8a8e8c, side: 'imperial', hp: 40, role: 'officer', perception: SHARP },
  // “Commander” on screen; his nameplate (an egg) says Moff
  jerjerrod: { name: 'Commander Jerjerrod', model: OFFICER, game: 'officer', tall: 1.78, side: 'imperial', hp: 40, role: 'officer', perception: SHARP },
  emperor: { name: 'The Emperor', model: '/models/galaxy/crew/palpatine.glb', game: 'palpatine', tall: 1.73, side: 'imperial', hp: 200, role: 'boss', speed: 0.5, scripted: true },
  // the senate guard’s blue robes dyed the Emperor’s crimson
  royalguard: { name: 'Royal Guard', model: '/models/galaxy/crew/senateguard.glb', tall: 1.9, dye: { color: 0xb0121c, gain: 3.2, keep: 0, roughness: 0.5 }, side: 'imperial', blade: { type: 'pike' }, hp: 90, role: 'soldier', perception: SHARP },
  leia: { name: 'Princess Leia', model: '/models/galaxy/crew/leia.glb', game: 'leia', tall: 1.5, side: 'rebel', gun: 'e11', hp: 100, voice: 'leia', role: 'hero' },
  // the story hands Luke his saber where he draws it (the second station)
  luke: { name: 'Luke Skywalker', model: '/models/galaxy/crew/luke.glb', game: 'luke', tall: 1.72, side: 'rebel', gun: 'e11', hp: 100, voice: 'luke', role: 'hero' },
  han: { name: 'Han Solo', model: '/models/galaxy/crew/han.glb', game: 'han', tall: 1.85, side: 'rebel', gun: 'dl44', hp: 100, voice: 'han', role: 'hero' },
  // old Ben, as the first film has him (the galaxy’s Obi-Wan is the Clone Wars general)
  obiwan: { name: 'Obi-Wan Kenobi', model: '/models/deathstar/obiwan.glb', tall: 1.78, side: 'rebel', blade: { type: 'saber', colour: 0x3f8cff }, hp: 100, voice: 'obiwan', role: 'hero' },
  chewie: { name: 'Chewbacca', model: '/models/cockpit/chewie.glb', game: 'chewie', tall: 2.28, side: 'rebel', hp: 160, role: 'hero' },
  // (the surfaces’ C-3PO, rigged again on the crew’s skeleton by scripts/rig-transfer.mjs)
  threepio: { name: 'C-3PO', model: '/models/deathstar/c3po.glb', game: 'c3po', tall: 1.67, side: 'rebel', hp: 40, voice: 'threepio', role: 'hero', speed: 0.6 },
  artoo: { name: 'R2-D2', model: '/models/galaxy/surface/r2d2.glb', game: 'astromech', tall: 1.09, side: 'rebel', hp: 60, role: 'hero', speed: 0.7 },
  // the station’s droids belong to nobody’s fight: troopers and Rebels both let them by
  mouse: { name: 'Mouse droid', model: '/models/galaxy/surface/mousedroid.glb', tall: 0.25, side: 'neutral', hp: 10, role: 'droid', speed: 1.6, perception: { sight: 8 } },
  gonk: { name: 'GNK power droid', model: '/models/galaxy/surface/gonk.glb', game: 'gonk', tall: 1.1, side: 'neutral', hp: 50, role: 'droid', speed: 0.3 },
  r5: { name: 'R5 astromech', model: '/models/galaxy/surface/r5.glb', game: 'r5', tall: 1.1, side: 'neutral', hp: 40, role: 'droid', speed: 0.7 },
  // the interrogator works for the Empire, so it is on the Empire’s side
  ito: { name: 'IT-O interrogator', model: null, built: 'ito', tall: 0.3, side: 'imperial', hp: 20, role: 'droid', speed: 0.8 },
  // tall: how far its eyestalk rises out of the compactor’s water; the rest stays under
  dianoga: { name: 'Dianoga', model: null, built: 'dianoga', tall: 1.4, side: 'neutral', hp: 250, role: 'beast', speed: 0.5 },
});

export function perceptionOf(kind) {
  return { ...PERCEPTION, ...CAST[kind]?.perception };
}
