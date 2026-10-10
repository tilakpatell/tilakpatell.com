// The forest worlds, from the ground: Endor, Kashyyyk and Dagobah (Yavin 4
// is yavin.js's).
// (sites/index.js has what a site is.)

import { grove } from './stand';

// Endor's sun, for its sky and the light slanting through its trees
const ENDOR_SUN = { az: 0.9, el: 1.02 };

// what Kashyyyk's beach defenders say, clones and Wookiees along the line
const CLONE_SAYS = ['Droids coming across the lagoon, sir!', 'Hold the line!', 'The Wookiees fight like nothing I’ve ever seen.', 'Execute Order… (He stops, and listens to his helmet.) Nothing, sir. Never mind.'];
const WOOKIEE_SAYS = ['(A battle roar that rattles your teeth.)', '(It hefts a bowcaster and points across the lagoon.)', 'Rrraaaaaaaaghhh!', '(It thumps its chest, then yours. Friendly. You think.)'];

// the Ewok village: five trees round a clearing, a deck up each, rope
// bridges between, huts on the decks (all relative to the village)
const VILLAGE = (() => {
  const trees = [
    { a: 0.3, d: 22, h: 9, h2: 16, stair: 0.3 },
    { a: 1.55, d: 24, h: 11 },
    { a: 2.8, d: 21, h: 8.5, h2: 15 },
    { a: 4.0, d: 23, h: 10.5, stair: 4.0 },
    { a: 5.2, d: 22, h: 12 },
  ].map((t, i) => ({ ...t, at: [Math.sin(t.a) * t.d, Math.cos(t.a) * t.d], seed: 50 + i }));
  const deck = 7;
  const things = [];
  trees.forEach((t, i) => {
    const next = trees[(i + 1) % trees.length];
    const prev = trees[(i + trees.length - 1) % trees.length];
    const bearing = (to) => Math.atan2(to.at[0] - t.at[0], to.at[1] - t.at[1]);
    things.push({ kind: 'ewoktree', at: t.at, model: false, opts: { h: t.h, h2: t.h2, deck, stair: t.stair ?? null, seed: t.seed, gaps: [bearing(next), bearing(prev)] } });
    // its bridge to the next tree
    const dx = next.at[0] - t.at[0];
    const dz = next.at[1] - t.at[1];
    const d = Math.hypot(dx, dz);
    const len = d - deck * 2 + 1.6;
    things.push({ kind: 'ropebridge', at: [t.at[0] + dx / 2, t.at[1] + dz / 2], yaw: Math.atan2(dx, dz), opts: { len, h0: t.h, h1: next.h, sag: 0.45 } });
    // a hut on its deck, its door to the clearing, and one up top
    const out = Math.atan2(-t.at[0], -t.at[1]) + 0.9;
    // (the hut model is 4 m across: scaled to the built one's radius)
    things.push({ kind: 'ewokhut', at: [t.at[0] + Math.sin(out + Math.PI) * 4.9, t.at[1] + Math.cos(out + Math.PI) * 4.9], y: t.h, yaw: out + Math.PI, solid: false, scale: 0.85, opts: { r: 1.7 } });
    if (t.h2) things.push({ kind: 'ewokhut', at: [t.at[0] + Math.sin(out) * 3.5, t.at[1] + Math.cos(out) * 3.5], y: t.h2, yaw: out, solid: false, scale: 0.65, opts: { r: 1.3 } });
  });
  // Ewoks pacing their decks: an arc on the far side from the hut
  const walks = trees.map((t) => {
    const out = Math.atan2(-t.at[0], -t.at[1]) + 0.9;
    const arc = [-0.9, -0.3, 0.3, 0.9].map((da) => [t.at[0] + Math.sin(out + da) * 5.4, t.at[1] + Math.cos(out + da) * 5.4]);
    return [...arc, arc[2], arc[1]];
  });
  return { trees, things, walks };
})();
const at = (o, [x, z]) => [o[0] + x, o[1] + z];
const V = [-210, 150]; // the village

export const SITES = {
  endor: {
    // lit as the game lights its level (src/data/bf2017/light/endor.json, gameLit.js)
    gameLight: 'endor',
    place: 'The forest moon',
    line: 'Redwoods older than the Empire, and something small watching you from the ferns.',
    sky: {
      zenith: '#5d8ec4',
      horizon: '#a8bcae',
      haze: 0.8,
      hazeColor: '#94aa9a',
      suns: [{ ...ENDOR_SUN, color: '#fff1d4', size: 0.014, glow: 1.1 }],
      clouds: { cover: 0.28, color: '#ffffff', shade: '#b4c2c4', scale: 0.6, speed: 0.004 },
      bodies: [
        // Endor itself, the gas giant the moon goes round
        { az: -2.3, el: 0.42, size: 0.26, color: '#7ea6aa', color2: '#4a6a7a', bands: 9, twist: 1.2 },
        { az: -1.7, el: 0.62, size: 0.018, color: '#d8d4c8' },
      ],
    },
    fog: { color: '#83998a', density: 0.0042 },
    light: { sun: 2.7, sky: '#d2e2d8', ground: '#4a5634', ambient: 0.8 },
    dust: '#7a6a4c',
    edge: 'The forest goes on, and on. Best not to get lost in it.',
    ground: { detail: 'needles', detailLook: { color: 0.8, normal: 0.7 },
      seed: 7,
      wind: 0.3,
      // (the redwood country as filmed: the floor rises and falls, folded
      // into ravines and spurs, the village and the bunker on their own
      // level ground; the forest moon's mountains far off, in the haze)
      layers: [
        { type: 'swell', scale: 420, height: 22 },
        { type: 'hills', scale: 130, height: 14 },
        { type: 'ridges', scale: 300, height: 8 },
        { type: 'mountains', from: 900, to: 3200, height: 320, scale: 1300 },
      ],
      palette: {
        // (the redwood floor as filmed: cinnamon duff and needles, the
        // fern beds darker olive, rust where the bark's fallen)
        // (the floor itself part green: moss and sorrel in patches over
        // the duff, as the redwood floor is where the light gets down)
        low: '#5e4630',
        high: '#4a5030',
        rock: '#5a5040',
        accent: '#4a5a2c',
        deep: '#2a1f14',
        hLow: -8,
        hHigh: 12,
        rockAt: 0.48,
        accentCover: 0.62,
        grain: 0.9,
        patch: 0.8,
      },
    },
    // (the floor's low growth, as the film's: short grass and sorrel in
    // drifts between the fern beds, soft green over the dirt, not a lawn)
    grass: { h: [0.12, 0.36], w: 0.035, root: '#3a4a26', mid: '#52703a', tip: '#8fae62', dry: '#8c8050', cover: 0.62, scale: 45, above: 0, wind: 0.35 },
    weather: [{ kind: 'motes', count: 700 }],
    land: { at: [0, 0], yaw: 0.6 },
    lines: {
      out: {
        xwing: [['luke', 'Endor. Quiet, Artoo. There could be scout troopers anywhere.'], ['r2', '(A very quiet beep.)']],
        falcon: [['han', 'Trees. Big trees. Chewie, you’re gonna love it here.'], ['chewie', '(A happy, homesick moan.)']],
        cruiser: [['morty', 'Rick, these trees are huge! Like, Redwood-National-Park huge!'], ['rick', 'They filmed it in one, Morty. Don’t think about it too hard.']],
        rv: [['jesse', 'Yo, it smells like… Christmas trees. Like, a billion of them.'], ['walt', 'Stay close to the RV, Jesse. Something’s watching us.']],
      },
    },
    places: [
      {
        id: 'village',
        name: 'Bright Tree Village',
        at: V,
        r: 46,
        flat: { r: 40 },
        about: 'The Ewoks’ home, high in the trees: huts on decks round the trunks, rope bridges between, and a fire in the middle where they nearly roasted Han Solo. Then they made Threepio a god.',
        lines: {
          xwing: [['luke', 'Bright Tree Village. They were going to cook Han, Chewie and me for Threepio’s feast.'], ['r2', '(A gleeful burble.)']],
          falcon: [['han', 'I was the main course here, once. Long story.'], ['chewie', '(A laugh that goes on a bit too long.)']],
          cruiser: [['morty', 'Th-they’re like teddy bears, Rick! Murder teddy bears!'], ['rick', 'Spears and catapults, Morty. They took down the Empire. Respect the bears.']],
          rv: [['jesse', 'Little bear dudes living in treehouses. This is the best day of my life.'], ['walt', 'They’re armed, Jesse.']],
        },
        things: [
          ...VILLAGE.things,
          { kind: 'fire', at: [0, 0], scale: 1.8 },
          { kind: 'drums', at: [6, -4], yaw: 0.6 },
          { kind: 'log', at: [-4.5, 3], yaw: 0.9, opts: { len: 4, r: 0.35 } },
          { kind: 'log', at: [4.5, 4], yaw: -0.8, opts: { len: 4, r: 0.35 } },
          { kind: 'lightshafts', at: [0, 0], opts: { ...ENDOR_SUN, n: 7, spread: 26, seed: 11 } },
        ],
      },
      {
        id: 'bunker',
        name: 'The bunker',
        at: [250, -40],
        r: 34,
        flat: { r: 28 },
        about: 'The back door to the shield generator: an armoured entrance dug into the hillside, where the strike team went in and a stolen AT-ST came back out with an Ewok at the controls.',
        lines: {
          xwing: [['luke', 'The bunker. If Han’s team hadn’t blown it, the fleet would’ve been wiped out.']],
          falcon: [['han', 'Jabba’s palace was easier to get into than this.'], ['chewie', '(A grumble of agreement.)']],
          cruiser: [['rick', 'One back door, Morty, guarded by guys who can’t aim. Evil empire. Sure.'], ['morty', 'Rick, there’s a guy in white right there!']],
          rv: [['walt', 'One entrance. Armoured. Out in the middle of nowhere.'], ['jesse', 'Yo, it’s like a superlab for space Nazis.']],
        },
        things: [
          { kind: 'bunker', at: [0, -6], yaw: 0 },
          { kind: 'bunkerbank', at: [0, -8.5], yaw: 0 },
          { kind: 'redwood', at: [-7, -24], model: false, opts: { seed: 21, h: 60, r: 2.2 } },
          { kind: 'redwood', at: [9, -27], model: false, opts: { seed: 22, h: 56, r: 2.0 } },
          { kind: 'crates', at: [-10, 4] },
          { kind: 'crates', at: [9, 6] },
          { kind: 'lamp', at: [-7, 6], opts: { h: 3.2, light: '#ffe0a0' } },
          { kind: 'lamp', at: [7, 6], opts: { h: 3.2, light: '#ffe0a0' } },
        ],
      },
      {
        id: 'generator',
        name: 'The shield generator',
        at: [400, -230],
        r: 64,
        flat: { r: 58 },
        about: 'The great dish projecting the deflector shield round the second Death Star overhead, beside the landing platform where the stolen shuttle Tydirium set down.',
        lines: {
          xwing: [['luke', 'The generator. While that was up, nothing could touch the Death Star.'], ['r2', '(An anxious whistle.)']],
          falcon: [['han', 'That’s the shuttle we stole. Tydirium. It’s an older code, sir, but it checks out.'], ['chewie', '(A nervous rumble.)']],
          cruiser: [['morty', 'That’s a big dish, Rick.'], ['rick', 'It’s a space umbrella for a space ball, Morty. Fragile, and load-bearing.']],
          rv: [['jesse', 'Yo, that’s the biggest satellite dish I ever saw.'], ['walt', 'And they guarded it with a dozen men and some walkers. Sloppy.']],
        },
        things: [
          { kind: 'shieldgen', at: [0, -10], yaw: 0.2, solid: { r: 22 } },
          { kind: 'pad', at: [-10, 42], opts: { r: 14, color: '#5e6064', light: '#ffd070', shape: 'square', marks: 'rings' } },
          { kind: 'lambda', at: [-10, 41], yaw: -0.4 },
          { kind: 'crates', at: [-30, 26] },
          { kind: 'crates', at: [24, 30] },
          { kind: 'lamp', at: [4, 30], opts: { h: 8, light: '#ffe0a0' } },
          { kind: 'lamp', at: [-24, 32], opts: { h: 8, light: '#ffe0a0' } },
        ],
      },
      {
        id: 'scoutcamp',
        name: 'The scout troopers’ camp',
        at: [60, 250],
        r: 26,
        flat: { r: 18 },
        about: 'Where the strike team crept up on two scout troopers by their speeder bikes; Han stepped on a twig, and the chase through the trees began.',
        lines: {
          xwing: [['luke', 'This is where Leia and I took the bikes. Seventy kilometres an hour through the trees.'], ['r2', '(An alarmed whistle.)']],
          falcon: [['han', 'Go around? Chewie and me’ll take care of this. Quietly.'], ['chewie', '(A muffled snort.)']],
          rv: [['jesse', 'Hover bikes! Mr. White, I am riding one of these.'], ['walt', 'Jesse, they’re government property.']],
        },
        things: [
          { kind: 'fire', at: [0, 0] },
          { kind: 'crates', at: [-6, -5] },
          { kind: 'log', at: [3, -3], yaw: 0.4, opts: { len: 5, r: 0.4 } },
        ],
      },
      {
        id: 'nettrap',
        name: 'The net trap',
        at: [-140, -170],
        r: 20,
        flat: { r: 10 },
        about: 'A dead animal on a stake, and a net in the branches above. Chewbacca grabbed the bait, and Ewoks came out of the ferns.',
        lines: {
          xwing: [['luke', 'Chewie, don’t! Wait… too late.'], ['r2', '(A smug little whistle.)']],
          falcon: [['han', 'Great, Chewie. Great. Always thinking with your stomach.'], ['chewie', '(A sheepish whine.)']],
          cruiser: [['morty', 'Is— is that meat on a stick? Rick, don’t touch it!'], ['rick', 'I wasn’t gonna, Morty. *burp* Okay, I was.']],
        },
        things: [{ kind: 'nettrap', at: [-8.5, 3], yaw: 0 }],
      },
      {
        id: 'logtrap',
        name: 'The log trap',
        at: [140, 110],
        r: 22,
        flat: { r: 14 },
        about: 'Two logs swung from the trees, and an AT-ST’s head caught between them: the Ewoks’ own way of fighting the Empire’s war machines.',
        lines: {
          xwing: [['luke', 'Stones and logs against walkers. And they won.']],
          falcon: [['han', 'Remind me never to get on the wrong side of an Ewok.'], ['chewie', '(An impressed whoop.)']],
          cruiser: [['rick', 'Primitive tech beats military-industrial complex, Morty. Write that down.'], ['morty', 'Rick, I don’t have a pen.']],
        },
        things: [
          { kind: 'logtrap', at: [0, 0], yaw: 0.5 },
          { kind: 'atst', at: [5, -5], yaw: 2.2, roll: 1.42, y: 1.1, solid: { r: 3 } },
        ],
      },
      {
        id: 'pyre',
        name: 'Vader’s pyre',
        at: [-330, -80],
        r: 16,
        flat: { r: 12 },
        about: 'Where Luke burned his father’s armour, alone in the forest, while the fireworks went up over the village: the end of Darth Vader, and of Anakin Skywalker.',
        lines: {
          xwing: [['luke', 'I burned his armour here. He was Anakin Skywalker again, at the end.'], ['r2', '(A soft, low whistle.)']],
          falcon: [['han', 'The kid never said much about it. I never asked.'], ['chewie', '(A quiet, respectful rumble.)']],
          rv: [['walt', 'A man’s whole legacy, up in smoke.'], ['jesse', 'That’s deep, Mr. White.']],
        },
        things: [{ kind: 'pyre', at: [0, 0], yaw: 0.4 }],
      },
    ],
    things: [
      // where you set down: the strike team's camp among the ferns
      { kind: 'fire', at: [12, 8] },
      { kind: 'log', at: [16, 4], yaw: 1.1, opts: { len: 4, r: 0.35 } },
      { kind: 'log', at: [8, 12], yaw: -0.6, opts: { len: 3.5, r: 0.3 } },
      { kind: 'cratecube', at: [20, 12], yaw: 0.3 },
      { kind: 'cratecube', at: [21.3, 12.4], yaw: 0.9 },
      { kind: 'barrel', at: [19, 14], yaw: 0.5 },
      { kind: 'cooler', at: [18, 10.4], yaw: 2.1 },
      { kind: 'redwood', at: [-22, 24], model: false, opts: { seed: 31, h: 64, r: 2.4 } },
      { kind: 'redwood', at: [28, -26], model: false, opts: { seed: 32, h: 58, r: 2.1 } },
      // the second Death Star, half built, over the trees (N8's model, from
      // Sketchfab; clear of the fog, its bite turned to the forest), hung
      // where you see it as you climb out of the ship: ahead and to the
      // right of the landing, a hand's width over the treetops
      { kind: 'ds2sky', at: [2600, 700], abs: true, y: 1200, yaw: 2.6, scale: 2.0, solid: false, fog: false },
      { kind: 'lightshafts', at: [0, 0], opts: { ...ENDOR_SUN, n: 8, spread: 40, seed: 5 } },
      { kind: 'lightshafts', at: [130, -110], opts: { ...ENDOR_SUN, n: 8, spread: 46, seed: 7 } },
      { kind: 'lightshafts', at: [-90, 60], opts: { ...ENDOR_SUN, n: 8, spread: 46, seed: 9 } },
    ],
    scatter: [
      // (Quaternius's ground cover, under the built plants: catalog/quaternius.js)
      { kind: 'qfern', n: 120, within: [5, 60], scale: [0.7, 1.4], solid: false },
      { kind: 'qmushroom', n: 30, within: [6, 60], scale: [0.6, 1.3], solid: false },
      // (the stand close set, as a redwood grove is: trunks in every
      // direction, the nearest ring thickest so the clearing you land in
      // reads as one, and the far ones carrying the forest to the hills)
      // (the full trees where you walk, from the edge of the glade you land
      // in: 60 m out, so the sky and the Death Star show over the trunks
      // from its middle; past the fog's reach, where a tree is a trunk in
      // the mist, the light ones, as many again)
      { kind: 'redwood', n: 320, within: [60, 280], scale: [0.75, 1.35], opts: { seed: 1, leaf: '#3a4626' } },
      { kind: 'redwood', n: 150, within: [60, 280], scale: [0.6, 1.2], opts: { seed: 2, h: 58, r: 2.0, bark: '#7a4a32', leaf: '#3e4a28' } },
      { kind: 'redwood', n: 100, within: [60, 200], scale: [0.7, 1.25], opts: { seed: 13, leaf: '#3c4828' } },
      { kind: 'redwood', n: 300, within: [280, 640], scale: [0.75, 1.35], opts: { seed: 14, lo: true, leaf: '#3a4626' } },
      { kind: 'redwood', n: 140, within: [280, 640], scale: [0.6, 1.2], opts: { seed: 15, lo: true, h: 58, r: 2.0, bark: '#7a4a32', leaf: '#3e4a28' } },
      { kind: 'redwood', n: 200, within: [600, 1300], scale: [1.0, 1.5], solid: false, opts: { seed: 3, lo: true, leaf: '#3a4626' } },
      { kind: 'spruce', n: 160, within: [20, 420], scale: [0.7, 1.3], opts: { seed: 4, leaf: '#2f3e26' } },
      { kind: 'fern', n: 1100, within: [6, 240], scale: [0.9, 2.1], solid: false, clear: -12, opts: { seed: 5, n: 11, color: '#56592c' } },
      // (the floor near you carpeted, as the film's is: low ferns, close set)
      { kind: 'fern', n: 1500, within: [4, 90], scale: [0.7, 1.5], solid: false, clear: -14, opts: { seed: 12, n: 7, color: '#5a5e2e' } },
      { kind: 'fern', n: 160, within: [17, 60], scale: [0.9, 1.8], solid: false, clear: -30, opts: { seed: 9, n: 10, color: '#5e6230' } },
      { kind: 'fern', n: 500, within: [6, 240], scale: [0.6, 1.3], solid: false, clear: -14, opts: { seed: 6, color: '#626436', n: 7, len: 1.0 } },
      { kind: 'fern', n: 700, within: [240, 600], scale: [1.0, 2.2], solid: false, clear: -10, opts: { seed: 8, n: 9, color: '#52562c' } },
      { kind: 'log', n: 70, within: [20, 560], scale: [0.8, 1.4], solid: false, opts: { seed: 7 } },
      // (the floor's boulders mossy, as the film's are; scrub and toadstools under the ferns)
      { kind: 'rock', n: 110, within: [14, 560], scale: [0.6, 2.4], opts: { color: '#6e7460', sharp: 0.4, to: 'mossrock' } },
      { kind: 'stones', n: 320, within: [6, 300], scale: [0.25, 0.7], solid: false, opts: { color: '#6a6e5a', to: 'mossrock' } },
      // (the shrub layer thick, two greens of it, and broad-leaved plants
      // in the fern beds: the floor reads as growth, not dirt with ferns on)
      { kind: 'bush', n: 380, within: [10, 420], scale: [0.7, 1.5], solid: false, clear: -8, opts: { seed: 14, s: 1.8, color: '#3e4e2a' } },
      { kind: 'bush', n: 260, within: [8, 300], scale: [0.5, 1.1], solid: false, clear: -10, opts: { seed: 17, s: 1.3, color: '#4c6232' } },
      { kind: 'plant', n: 320, within: [6, 260], scale: [0.7, 1.5], solid: false, clear: -10, opts: { seed: 18, color: '#44622c', n: 7, len: 1.5 } },
      { kind: 'fungus', n: 240, within: [6, 200], scale: [0.8, 1.6], solid: false, clear: -12, opts: { seed: 8 } },
    ],
    life: [
      // (the game's own: profoggs ambling in the undergrowth by the log trap)
      { kind: 'profogg', n: 3, at: [140, 112], spread: 26, roam: 20, speed: 0.4, r: 0.2, solid: false },
      { kind: 'ewok', n: 7, at: V, spread: 6, roam: 6, speed: 0.9, name: 'Ewok', says: ['Yub nub!', 'Ee chee wa maa!', '(It dances round the fire, banging a stick on a helmet.)', '(It looks at you, then at the fire, then back at you. Thoughtfully.)', 'Gunda!'] },
      ...VILLAGE.walks.map((path, i) => ({ kind: 'ewok', n: 1, path, speed: 0.7, pause: 2.5 + i, name: 'Ewok', says: ['(It waves its spear at you from the deck.)', 'Yub yub!', '(A long, suspicious sniff.)'] })),
      { kind: 'c3po', n: 1, at: at(V, [4, -5]), still: true, face: -0.7, name: 'C-3PO', says: ['Oh my! I seem to have become something of a deity here.', '(He tells the Ewoks the whole story of the Rebellion: the Death Star, Cloud City, Han frozen in carbonite. With sound effects.)', 'It’s against my programming to impersonate a deity.', 'Oh dear. I’m afraid you’re to be the guest of honour at the banquet.'] },
      { kind: 'rebel', n: 3, at: [14, 6], spread: 6, roam: 6, speed: 0.9, name: 'Rebel commando', says: ['Keep it down. Scouts patrol this ridge.', 'The bunker’s east. We move at dusk.', 'Nice of the locals to leave us alone. So far.'] },
      { kind: 'ithorian', n: 1, at: [10, -2], roam: 5, speed: 0.6, name: 'Ithorian Rebel', says: ['(A slow, stereo rumble from both mouths. It sounds like a warning about the trees.)', '(It presses a leaf into your hand. For luck, perhaps.)'] },
      { kind: 'ewok', n: 1, at: [18, -16], roam: 6, speed: 0.8, name: 'Wicket', says: ['Yub nub!', '(He pokes you with his spear, then sniffs your boots.)', '(He offers you half a strange fruit. The bitten half.)'] },
      { kind: 'ewok', n: 3, at: [-140, -164], spread: 5, roam: 6, speed: 0.9, name: 'Ewok hunter', says: ['(It points at the net, very proud of it.)', 'Ee chee wa maa!'] },
      { kind: 'ewok', n: 2, at: [148, 100], spread: 5, roam: 6, speed: 0.9, name: 'Ewok', says: ['(It mimes a log swinging, and a walker going over.)', 'Yub nub!'] },
      // (Wicket's cousin, who wants the walker at the generator brought down the Ewok way; and a Rebel pilot on the platform's edge, after the shuttle's codes)
      { kind: 'ewok', id: 'paploo', at: [126, 118], roam: 4, speed: 0.9, name: 'Paploo', quest: 'ewokwar', says: ['(He hefts a stone and points east, growling.)', 'Yub nub!'] },
      { kind: 'scouttrooper', n: 2, path: [[236, -30], [264, -30], [264, -12], [236, -12]], speed: 1.3, name: 'Scout trooper', says: ['Hey! You there! Freeze!', 'Go for help! Go!', 'Nobody gets in without authorisation.', 'Quiet out here. Too quiet.'] },
      { kind: 'stormtrooper', n: 1, at: [245, -38], still: true, face: 0, name: 'Stormtrooper', says: ['This area is off limits.', 'Move along.'] },
      { kind: 'stormtrooper', n: 1, at: [255, -38], still: true, face: 0, name: 'Stormtrooper', says: ['Freeze! Don’t move!', 'There’s nothing to see here.'] },
      { kind: 'rebel', n: 3, at: [214, -12], spread: 4, roam: 3, speed: 0.8, name: 'Rebel commando', says: ['Quiet. There’s a scout trooper right over there.', 'We go in on General Solo’s signal.', 'I hope the fleet’s on time.'] },
      { kind: 'rebelpilot', id: 'tydirium', at: [-14, -6], still: true, face: 1.2, name: 'The shuttle’s pilot', quest: 'tydirium', says: ['That code was old. They’ll have changed it by now.'] },
      { kind: 'scouttrooper', n: 2, at: [60, 250], spread: 4, roam: 5, speed: 0.8, name: 'Scout trooper', says: ['Hey, did you hear something?', 'Stay with the bikes. I’ll check the perimeter.'] },
      { kind: 'atst', n: 1, path: [[400, -282], [430, -270], [442, -240], [430, -210], [400, -198], [370, -210], [358, -240], [370, -270]], speed: 1.4, r: 1.6, name: 'AT-ST', says: ['(The walker stops, its head turning toward you with a hiss of hydraulics.)', '(Its chin guns track you. Then it stalks on.)'] },
      { kind: 'scouttrooper', n: 2, path: [[420, -200], [442, -200], [442, -182], [420, -182]], speed: 1.2, name: 'Scout trooper', says: ['The shield must stay up. Lord Vader’s orders.', 'Back to the platform. Now.'] },
    ],
    rides: [
      { kind: 'speederbike', at: [-14, 10], yaw: 0.3 },
      { kind: 'speederbike', at: [66, 244], yaw: 2.4 },
      { kind: 'speederbike', at: [54, 256], yaw: 2.0 },
    ],
    flyovers: [
      { kind: 'shuttle', n: 1, metres: 20, alt: 120, speed: 60, every: 70 },
      { kind: 'tie', n: 2, metres: 7, alt: 110, speed: 120, every: 60 },
    ],
    skyships: [{ kind: 'executor', metres: 260, at: [-1800, 2200, -3600], yaw: 1.2 }],
  },

  kashyyyk: {
    // lit as the game lights its level (src/data/bf2017/light/kashyyyk.json, gameLit.js)
    gameLight: 'kashyyyk',
    place: 'The shore at Kachirho',
    line: 'Wroshyr trees as tall as mountains, and a lagoon full of trouble.',
    sky: {
      zenith: '#6c9cc8',
      horizon: '#dcdcc4',
      haze: 0.9,
      hazeColor: '#e6e2c8',
      suns: [{ az: 2.3, el: 0.5, color: '#fff0cc', size: 0.016, glow: 1.2 }],
      clouds: { cover: 0.35, color: '#ffffff', shade: '#c0c4b6', scale: 0.55, speed: 0.004 },
      bodies: [{ az: -0.6, el: 0.42, size: 0.03, color: '#cfcac0', color2: '#aaa59c' }],
    },
    fog: { color: '#c4cebe', density: 0.0017 },
    light: { sun: 3.0, sky: '#c8dcea', ground: '#6a7a48', ambient: 0.8 },
    // (Kachirho's lagoon as filmed: milky olive-grey, not a tropical blue)
    // (wadeMax: how deep you can wade before the lagoon turns you back)
    water: { level: 0, color: '#7b8575', deep: '#3a4a40', kind: 'sea', foam: 0.2, wadeMax: 1.2 },
    dust: '#bca880',
    edge: 'Beyond here the forest drops away into the Shadowlands. Even Wookiees don’t go down there.',
    ground: { detail: 'leaves', detailLook: { color: 0.7, normal: 0.7 },
      seed: 21,
      wind: -0.6,
      base: -10,
      layers: [
        { type: 'island', at: [-40, -560], r: 820, height: 26, core: 0.42, ragged: 0.25 },
        { type: 'swell', scale: 300, height: 3 },
        { type: 'hills', scale: 110, height: 6 },
        { type: 'mountains', from: 1100, to: 3400, height: 420, scale: 900 },
      ],
      // The beach in front of Kachirho, as the film has it: a shore of sand a
      // metre over the lagoon, and in front of it the shallows the droids
      // wade out of, knee-deep, before the lagoon falls away. Later flats win
      // where they overlap, so the shallows go down first and the beach is
      // laid over their near side: the shore eases from sand into wading
      // water along z ≈ 78. Each is a row of round flats, as a single round
      // one big enough to reach both ends of the beach would flood the beach's
      // middle or bury the shallows' (one circle can't make a straight shore).
      flats: [
        { at: [25, 96], r: 38, edge: 14, h: -0.45 },
        { at: [95, 96], r: 38, edge: 14, h: -0.45 },
        ...[-10, 30, 70, 110].map((x) => ({ at: [x, 38], r: 34, edge: 14, h: 1.0 })),
      ],
      palette: {
        // (the beach grey-white sand, the forest floor a cool dark green)
        low: '#c5c4bb',
        high: '#3b4232',
        rock: '#8a8676',
        accent: '#5a5440',
        deep: '#2a3028',
        hLow: 1.2,
        hHigh: 4,
        rockAt: 0.5,
        accentCover: 0.35,
        grain: 0.7,
        wet: { level: 0, band: 1.0, color: '#7a6a48' },
      },
    },
    weather: [{ kind: 'motes', count: 400 }],
    land: { at: [0, -40], yaw: -1.1 },
    lines: {
      out: {
        xwing: [['luke', 'Kashyyyk. Chewie’s home. Everything here is enormous, Artoo.'], ['r2', '(An awed, rising whistle.)']],
        falcon: [['han', 'Home sweet home, pal. Go on, I’ll wait.'], ['chewie', '(An overjoyed roar that echoes off the trees.)']],
        cruiser: [['morty', 'Rick, those trees are like, a kilometre tall!'], ['rick', 'Wroshyr trees, Morty. They grow into each other. Like a family. Gross.']],
        rv: [['jesse', 'Yo, it’s like Planet Earth up in here. With Bigfoots.'], ['walt', 'Wookiees, Jesse. Show some respect: they can pull your arms off.']],
      },
    },
    places: [
      {
        id: 'kachirho',
        name: 'Kachirho',
        at: [-140, -30],
        r: 60,
        flat: { r: 46 },
        about: 'The Wookiee city on the lagoon: a single wroshyr tree, its trunk ringed with decks and houses, its crown lost in the sky. Clones and Wookiees held its shore together against the droid army.',
        lines: {
          xwing: [['luke', 'A whole city in one tree.'], ['r2', '(A long, impressed whistle.)']],
          falcon: [['han', 'Chewie grew up somewhere up there. Took me years to get him to talk about it.'], ['chewie', '(A proud, rolling growl.)']],
          cruiser: [['morty', 'Rick, it’s a tree-city! A city-tree!'], ['rick', 'Real estate’s vertical, Morty. Even out here.']],
          rv: [['walt', 'A single structure, housing thousands. Built entirely by hand.'], ['jesse', 'Treehouse goals, man.']],
        },
        things: [
          { kind: 'kachirho', at: [0, 0], yaw: 0.15 },
          { kind: 'fire', at: [14, 38] },
          { kind: 'crates', at: [-16, 40] },
        ],
      },
      {
        id: 'beach',
        name: 'The beachhead',
        // (its ground is the beach's own flats, above: no flat of its own)
        at: [50, 40],
        r: 60,
        about: 'Where clones and Wookiees dug in against the Separatist landing: sharpened-log barricades on the sand, AT-RTs on patrol, the droid army coming across the lagoon.',
        lines: {
          xwing: [['luke', 'Clones and Wookiees, side by side. Before the clones turned.']],
          falcon: [['han', 'Barricades of logs against droid tanks. That’s Wookiees for you.'], ['chewie', '(A fierce, remembering roar.)']],
          cruiser: [['morty', 'R-Rick, the droids are coming out of the water!'], ['rick', 'Roger roger, Morty. They fold like laundry.']],
          rv: [['jesse', 'This is like Saving Private Ryan but with Chewbacca.'], ['walt', 'Keep your head down, Jesse.']],
        },
        things: [
          // the line, across the beach and facing the lagoon (south), as the
          // film has it: the droids come straight up out of the shallows at it
          { kind: 'barricade', at: [-50, 18], yaw: 0.05, opts: { len: 12 } },
          { kind: 'barricade', at: [-25, 20], yaw: 0, opts: { len: 12 } },
          { kind: 'barricade', at: [0, 19], yaw: -0.05, opts: { len: 12 } },
          { kind: 'barricade', at: [25, 20], yaw: 0.03, opts: { len: 12 } },
          { kind: 'barricade', at: [50, 18], yaw: 0.05, opts: { len: 12 } },
          // cover on the sand in front of it, between the barricades and the
          // water: what a droid wading ashore gets behind
          { kind: 'crates', at: [-40, 26] },
          { kind: 'crates', at: [36, 30] },
          // (boulders: the shore's own mossy limestone, a karst cut down to a
          // rock's size, 2 m tall: `rock` is a scatter kind only, not placeable)
          { kind: 'karst', at: [-10, 30], opts: { w: 3.4, h: 0.3, seed: 9 } },
          { kind: 'karst', at: [-60, 32], opts: { w: 3.4, h: 0.3, seed: 10 } },
          { kind: 'log', at: [14, 26], yaw: 0.2, opts: { bark: '#6a5a46' } },
          // the stores, back behind the line
          { kind: 'crates', at: [-24, -6] },
          { kind: 'crates', at: [2, -12] },
          { kind: 'lamp', at: [-10, -14], opts: { h: 4, light: '#ffd9a0' } },
        ],
      },
      {
        id: 'lagoon',
        name: 'The catamaran moorings',
        at: [150, 40],
        r: 40,
        about: 'Wookiee catamarans, flying boats of wood and leather, riding the lagoon. They skimmed out to meet the droid tanks before they reached the shore.',
        lines: {
          xwing: [['luke', 'Wooden boats, against droid tanks. And they flew.']],
          falcon: [['han', 'Chewie says his cousin raced these. Lost most of his fur in a crash.'], ['chewie', '(An embarrassed huff.)']],
          cruiser: [['rick', 'Organic hover-boats. Wood, leather, a little repulsor tech. I respect it, Morty.'], ['morty', 'C-can we ride one?']],
        },
        things: [
          { kind: 'catamaran', at: [6, 18], yaw: 0.4, abs: true, y: -0.2 },
          { kind: 'catamaran', at: [-12, 26], yaw: 0.8, abs: true, y: -0.2 },
          { kind: 'catamaran', at: [24, 8], yaw: 0.2, abs: true, y: -0.2 },
          { kind: 'karst', at: [60, 150], opts: { w: 22, h: 16, seed: 3 } },
          { kind: 'karst', at: [-50, 190], opts: { w: 16, h: 13, seed: 4 } },
        ],
      },
      {
        id: 'command',
        name: 'The command post',
        // (at the beach's rear, by Kachirho's foot, looking down the line:
        // a little over the sand, as the land here is at the water's level)
        at: [-60, 10],
        r: 26,
        flat: { r: 14, h: 1.6 },
        about: 'At the back of the beach, by Kachirho’s foot, where Yoda watched the battle with Commander Gree, until the order came through and Gree turned his blaster on him. Yoda felt it coming.',
        lines: {
          xwing: [['luke', 'Master Yoda was here when the clones turned on the Jedi. He felt every one of them die.'], ['r2', '(A sad, low tone.)']],
          falcon: [['han', 'Order 66. They didn’t teach that in the Imperial Academy. Funny, that.']],
          cruiser: [['morty', 'Rick, wh-why are the clones looking at the little green guy like that?'], ['rick', 'Don’t trust anybody who comes in a box of a million, Morty.']],
        },
        things: [
          { kind: 'crates', at: [-6, 4] },
          { kind: 'crates', at: [6, -5] },
          { kind: 'lamp', at: [4, 6], opts: { h: 3.6, light: '#b8d8ff' } },
        ],
      },
      {
        id: 'pod',
        name: 'Yoda’s escape pod',
        at: [-120, -380],
        r: 20,
        flat: { r: 12 },
        about: 'Hidden in the forest, where Chewbacca and Tarfful got Yoda away from the clones. He climbed in and left for Dagobah, and exile.',
        lines: {
          xwing: [['luke', 'This is how Master Yoda got off Kashyyyk. Chewie was there.'], ['r2', '(A curious beep.)']],
          falcon: [['han', 'You never told me you knew Yoda, pal.'], ['chewie', '(A sheepish, shrugging grumble.)']],
          rv: [['jesse', 'A tiny little escape pod. For a tiny little dude.'], ['walt', 'Every operation needs an exit, Jesse.']],
        },
        things: [{ kind: 'yodapod', at: [0, 0], yaw: 0.5 }],
      },
      {
        id: 'village',
        name: 'A Wookiee village',
        at: [-370, -170],
        r: 40,
        flat: { r: 32 },
        about: 'Wookiee homes on stilts among the roots of the wroshyrs: curved wooden pods with round doors, built by hand, lit by lanterns at night.',
        lines: {
          xwing: [['luke', 'Wookiees live for hundreds of years. Some of these houses must be older than the Republic.']],
          falcon: [['han', 'Chewie, is this… is this where your family lives?'], ['chewie', '(A warm, rumbling purr.)']],
          cruiser: [['rick', 'Big hairy guys, small cosy houses. That’s the whole species, Morty.'], ['morty', 'I feel like we should take our shoes off.']],
        },
        things: [
          { kind: 'wookieehouse', at: [0, 16], yaw: 3.1, solid: { r: 4 } },
          { kind: 'wookieehouse', at: [17, 2], yaw: 4.6, solid: { r: 4 } },
          { kind: 'wookieehouse', at: [-16, 4], yaw: 1.7, solid: { r: 4 } },
          { kind: 'wookieehouse', at: [8, -16], yaw: 5.8, solid: { r: 4 } },
          { kind: 'wookieehouse', at: [-10, -15], yaw: 0.6, solid: { r: 4 } },
          { kind: 'fire', at: [0, 0], scale: 1.3 },
        ],
      },
    ],
    things: [
      // where you set down: a clone BARC speeder and the beachhead's stores
      { kind: 'barc', at: [14, -28], yaw: 0.8 },
      { kind: 'cratecube', at: [-12, -48], yaw: 0.4 },
      { kind: 'cratecube', at: [-10.7, -47.4], yaw: 1.1 },
      { kind: 'barrel', at: [-13, -46], yaw: 0.2 },
      { kind: 'barrel', at: [-11.8, -45.2], yaw: 1.6 },
      { kind: 'empirecrate', at: [10, -52], yaw: 2.4 },
      // a spider droid left burning on the sand at the beach's east end,
      // between the water and the barricades, where the first droids got
      // ashore (cover for the next ones)
      { kind: 'homingspider', at: [96, 68], yaw: 3.6, roll: 0.5, sink: 0.6, solid: { r: 3 } },
      { kind: 'wrecksmoke', at: [96, 68], solid: false, opts: { h: 14, r: 1.0 } },
      { kind: 'karst', at: [-80, 260], opts: { w: 26, h: 18, seed: 5 } },
      { kind: 'karst', at: [120, 330], opts: { w: 20, h: 14, seed: 6 } },
      { kind: 'karst', at: [320, 250], opts: { w: 28, h: 20, seed: 7 } },
      { kind: 'karst', at: [-260, 330], opts: { w: 22, h: 15, seed: 8 } },
      // the great wroshyrs, as tall as the city's tree
      { kind: 'wroshyrgreat', at: [60, -150], yaw: 0.4, sink: 2, solid: { r: 28 } },
      { kind: 'wroshyrgreat', at: [-300, -300], yaw: 2.1, scale: 1.1, sink: 2, solid: { r: 31 } },
      { kind: 'wroshyrgreat', at: [330, -260], yaw: 3.6, scale: 0.9, sink: 2, solid: { r: 25 } },
    ],
    scatter: [
      // (Quaternius's ground cover, under the built plants: catalog/quaternius.js)
      { kind: 'qfern', n: 100, within: [8, 120], scale: [0.8, 1.5], solid: false },
      { kind: 'wroshyr', n: 110, within: [50, 640], scale: [0.7, 1.4], opts: { seed: 1, leaf: '#354832', bark: '#50554e' } },
      { kind: 'wroshyr', n: 70, within: [640, 1400], scale: [1.0, 1.8], solid: false, opts: { seed: 2, lo: true, leaf: '#354832', bark: '#50554e' } },
      { kind: 'karst', n: 30, within: [200, 900], scale: [7, 16], stretch: [1.0, 1.8], dry: false, opts: { seed: 3 } },
      { kind: 'karst', n: 40, within: [900, 2000], scale: [14, 30], stretch: [1.0, 1.6], dry: false, solid: false, opts: { seed: 4 } },
      { kind: 'plant', n: 600, within: [8, 500], scale: [0.8, 1.8], solid: false, clear: -8, opts: { seed: 5, color: '#57695d' } },
      { kind: 'plant', n: 120, within: [16, 60], scale: [0.9, 1.9], solid: false, clear: -30, opts: { seed: 8, color: '#5e7262' } },
      { kind: 'fern', n: 300, within: [8, 500], scale: [0.8, 1.6], solid: false, clear: -8, opts: { seed: 6, color: '#4f6250' } },
      { kind: 'rock', n: 60, within: [10, 560], scale: [0.6, 2.4], opts: { color: '#9a9686', sharp: 0.5 } },
      { kind: 'log', n: 20, within: [40, 520], scale: [0.9, 1.5], solid: false, opts: { seed: 7, bark: '#6a5a46' } },
    ],
    life: [
      // (the game's own: tachs about Kachirho's roots)
      { kind: 'tach', n: 4, at: [-120, -12], spread: 20, roam: 14, speed: 0.7, r: 0.5, solid: false },
      // the line's defenders, standing behind the barricades and facing the
      // water, a few behind each (a group stands in a disc round its `at`, so
      // one group spread along 100 m of line would put some of it in the
      // lagoon: so a group to each barricade)
      ...[[0, 2], [50, 2], [100, 1]].map(([x, n]) => ({ kind: 'clone', n, at: [x, 52], spread: 4, still: true, face: 0, name: 'Clone trooper', says: CLONE_SAYS })),
      ...[25, 75].map((x) => ({ kind: 'wookiee', n: 2, at: [x, 52], spread: 4, still: true, face: 0, name: 'Wookiee warrior', says: WOOKIEE_SAYS })),
      { kind: 'wookiee', n: 2, at: [6, -34], spread: 5, roam: 6, speed: 1.0, name: 'Wookiee', says: ['(It beats its chest once, and points you up the beach.)', '(A warm growl: a welcome.)'] },
      { kind: 'clone', n: 2, at: [16, -40], spread: 4, roam: 4, speed: 1.0, name: 'Clone trooper', says: ['BARC’s fuelled, sir. The beach is that way.', 'Droids are wading in from the lagoon. We hold the barricades.'] },
      { kind: 'atrt', n: 2, path: [[0, 40], [60, 36], [110, 40], [60, 36]], speed: 1.6, r: 0.8, name: 'AT-RT', says: ['(The clone rider nods down at you.) Good hunting, sir.', '(The walker clanks past, its rider scanning the lagoon.)'] },
      // (the AT-AP's beat behind the stores, clear of them and of Gree)
      { kind: 'atap', n: 1, path: [[20, 18], [90, 18]], speed: 1.0, r: 2.2, name: 'AT-AP', says: ['(Its heavy cannon swings out toward the water.)'] },
      { kind: 'yoda', n: 1, at: [-58, 8], still: true, face: 1.1, name: 'Yoda', says: ['Go, I will. Good relations with the Wookiees, I have.', 'A great disturbance in the Force, I feel.', 'Into exile I must go. Failed, I have.'] },
      { kind: 'clone', n: 2, at: [-64, 14], spread: 4, roam: 4, speed: 0.8, name: 'Clone trooper', says: ['Sir.', 'Communications are clear, Commander.'] },
      { kind: 'wookiee', n: 1, at: [-116, -376], still: true, face: 3.5, name: 'Chewbacca', says: ['(Chewbacca throws back his head and roars.)', '(He points at the pod, then at the sky: away.)'] },
      { kind: 'wookiee', n: 5, at: [-370, -170], spread: 12, roam: 10, speed: 0.9, name: 'Wookiee', says: ['(A friendly, gargling growl.)', '(It offers you a bowl of something. It is moving.)', '(It ruffles your hair. Hard.)'] },
      { kind: 'wookiee', n: 4, at: [-136, 14], spread: 6, roam: 6, speed: 1.0, name: 'Wookiee', says: ['(It waves you up the steps to the city.)', '(A long, musical howl, answered from far up the tree.)'] },
    ],
    rides: [{ kind: 'speederbike', at: [22, -30], yaw: 0.6 }],
    flyovers: [
      { kind: 'arc170', n: 2, metres: 14.5, alt: 90, speed: 110, every: 50 },
      { kind: 'vulture', n: 3, metres: 3.5, alt: 70, speed: 140, every: 60 },
      { kind: 'trifighter', n: 2, metres: 5.4, alt: 80, speed: 130, every: 70 },
      { kind: 'acclamator', n: 1, metres: 700, alt: 700, speed: 30, every: 160 },
    ],
    skyships: [{ kind: 'munificent', metres: 820, at: [2600, 1700, 3600], yaw: -2.4 }],
  },

  dagobah: {
    place: 'The swamp',
    line: 'Mist, black water, and something watching from the roots.',
    sky: {
      zenith: '#7e8a7c',
      horizon: '#aab49c',
      haze: 1,
      hazeColor: '#b2bba2',
      suns: [{ az: 0.6, el: 0.9, color: '#f0ecd0', size: 0.022, glow: 0.5 }],
      clouds: { cover: 0.85, color: '#c6ccba', shade: '#8a9282', scale: 0.7, speed: 0.003 },
    },
    fog: { color: '#97a28c', density: 0.0105 },
    light: { sun: 1.3, sky: '#c4ceb4', ground: '#3a4028', ambient: 1.05 },
    // (the swamp's water as filmed: black where it's deep, the mist's own
    // grey where it catches it)
    water: { level: 0, color: '#4a5650', deep: '#141a16', kind: 'swamp' },
    dust: '#5a5a40',
    edge: 'The mist closes in. Your lamp barely reaches your feet. Best go back.',
    ground: { detail: 'mud', detailLook: { color: 0.8, normal: 0.8 },
      seed: 5,
      wind: 0.2,
      base: -0.5,
      layers: [
        { type: 'swell', scale: 90, height: 2.2 },
        { type: 'hills', scale: 38, height: 1.8 },
      ],
      palette: {
        // (mud, brown-grey, wet at the water; moss in patches)
        low: '#3c3629',
        high: '#4a4535',
        rock: '#4a4436',
        accent: '#4c5232',
        deep: '#26221a',
        hLow: 0,
        hHigh: 1.8,
        rockAt: 0.55,
        accentCover: 0.4,
        grain: 0.9,
        wet: { level: 0, band: 0.5, color: '#22241a' },
      },
    },
    weather: [{ kind: 'motes', count: 1000, color: '#fff2d0' }],
    land: { at: [0, 0], yaw: -0.5, h: 0.7 },
    lines: {
      out: {
        xwing: [['luke', 'This is the place, Artoo. I can feel it. Something’s… strange here.'], ['r2', '(A very worried whistle, and a splash.)']],
        falcon: [['han', 'This is where the kid learned all that stuff? I’ve seen nicer swamps on… no. No, I haven’t.'], ['chewie', '(A grumble about the smell.)']],
        cruiser: [['morty', 'Ugh, Rick, it smells like your fridge.'], ['rick', 'Bog gas, Morty. Very rich in the Force. And methane.']],
        rv: [['jesse', 'Yo, this is like the worst camping trip ever.'], ['walt', 'Keep the RV running, Jesse. I don’t like this place.']],
      },
    },
    places: [
      {
        id: 'hut',
        name: 'Yoda’s hut',
        at: [-90, 60],
        r: 18,
        flat: { r: 12, h: 0.6 },
        about: 'A mud-and-stone house under a gnarltree, its windows lit, a pot of rootleaf stew on the fire: the home of the last Jedi Master, hiding where the Emperor would never think to look.',
        lines: {
          xwing: [['luke', 'Mudhole? Slimy? My home this is. That’s what he said.'], ['r2', '(A doubtful little beep.)']],
          falcon: [['han', 'Somebody actually lives here? On purpose?'], ['chewie', '(He sniffs. The stew smells good.)']],
          cruiser: [['morty', 'It’s a little mud house, Rick! It’s adorable!'], ['rick', 'Nine hundred years old and still renting, Morty.']],
          rv: [['walt', 'Off the grid. No neighbours. I can respect that.'], ['jesse', 'Yo, there’s soup.']],
        },
        things: [
          { kind: 'yodahut', at: [0, 0], yaw: 0.5 },
          { kind: 'gnarltree', at: [-4, -6], opts: { seed: 41, h: 12, roots: 8 } },
          { kind: 'lamp', at: [3, 5], opts: { h: 1.4, light: '#ffb060', color: '#3a3428' } },
        ],
      },
      {
        id: 'xwing',
        name: 'The X-wing in the bog',
        at: [40, 74],
        r: 24,
        about: 'Where Luke’s X-wing went into the swamp, and where Yoda raised it out again with the Force, while Luke watched. “I don’t believe it.” “That is why you fail.”',
        lines: {
          xwing: [['luke', 'I don’t believe it.'], ['r2', '(A whistle that sounds a lot like “that is why you fail”.)']],
          falcon: [['han', 'He just lifted it? With his mind? Kid, you never told me that part.'], ['chewie', '(A long, impressed hoot.)']],
          cruiser: [['rick', 'Telekinesis, Morty. Ships everywhere could save a fortune on tow trucks.'], ['morty', 'It’s sinking, Rick.']],
          rv: [['jesse', 'Dude parked his spaceship in a swamp. Classic.'], ['walt', 'That’s a very expensive mistake.']],
        },
        things: [{ kind: 'xwingbog', at: [0, 0], yaw: 2.2, abs: true, y: 0, solid: { r: 5 } }],
        pits: [{ at: [0, 0], r: 18, depth: 2.6 }],
      },
      {
        id: 'cave',
        name: 'The cave',
        at: [-70, -120],
        r: 20,
        flat: { r: 14, h: 0.5 },
        about: 'A dark place under a dead tree, strong with the dark side. Luke went in with his weapons, and found Darth Vader waiting, with his own face under the mask.',
        lines: {
          xwing: [['luke', 'What’s in there? Only what you take with you. I took my lightsaber.'], ['r2', '(A frightened squeak, and a roll backwards.)']],
          falcon: [['han', 'I’ve got a bad feeling about this.'], ['chewie', '(A low, unhappy whine.)']],
          cruiser: [['morty', 'R-Rick, I really don’t want to go in there.'], ['rick', 'It shows you yourself, Morty. Trust me, you don’t want to see that.']],
          rv: [['walt', 'You face what you are in there. That’s what they say.'], ['jesse', 'Nope. Nope nope nope.']],
        },
        things: [{ kind: 'cavetree', at: [0, -2], yaw: 0.2 }],
      },
      {
        id: 'training',
        name: 'The training ground',
        at: [100, -60],
        r: 22,
        flat: { r: 16, h: 0.6 },
        about: 'Where Luke ran the swamp with Yoda on his back, flipped over logs, stood on one hand and lifted stones with the Force, and learned that size matters not.',
        lines: {
          xwing: [['luke', 'Run, jump, climb, and Yoda on my back the whole time. Then the rocks.'], ['r2', '(A cheeky whistle: he remembers you falling over.)']],
          falcon: [['han', 'Floating rocks. Sure. Why not.'], ['chewie', '(He pokes one. It wobbles.)']],
          cruiser: [['morty', 'Th-the rocks are floating, Rick!'], ['rick', 'Size matters not, Morty. Which is… *burp* … a thing I’ve also said.']],
        },
        things: [
          { kind: 'floatrocks', at: [2, -3] },
          { kind: 'log', at: [-7, 4], yaw: 0.4, opts: { len: 6, r: 0.5, bark: '#4c463a', moss: '#5a6a34' } },
          { kind: 'log', at: [6, 8], yaw: -0.8, opts: { len: 7, r: 0.55, bark: '#4c463a', moss: '#5a6a34' } },
          { kind: 'gnarltree', at: [-10, -8], opts: { seed: 43, h: 11 } },
        ],
      },
      {
        id: 'camp',
        name: 'Luke’s camp',
        at: [-26, -46],
        r: 14,
        flat: { r: 9, h: 0.7 },
        about: 'A supply crate, a lamp and a little fire: where Luke set up while he looked for a great warrior, and a strange little creature went through his things.',
        lines: {
          xwing: [['luke', 'He went through all my stuff. Took my lamp. That was Yoda, the whole time.'], ['r2', '(An “I told you so” warble.)']],
          falcon: [['han', 'Nice place you got here, kid. Very… damp.']],
          rv: [['jesse', 'Little green dude stole his flashlight. Respect.']],
        },
        things: [
          { kind: 'crates', at: [2, 2], opts: { color: '#7a7a70' } },
          { kind: 'fire', at: [-2, -1] },
          { kind: 'lamp', at: [3, -2], opts: { h: 1.6, light: '#d8ecff' } },
        ],
      },
      {
        id: 'bog',
        name: 'The dragonsnake’s pool',
        at: [130, 110],
        r: 20,
        about: 'Deep, black water, and something big moving in it. It swallowed Artoo whole, and spat him out again. Not to its taste.',
        lines: {
          xwing: [['luke', 'Artoo! Artoo, where are you? …He’s lucky he doesn’t taste very good.'], ['r2', '(A furious, gurgling stream of beeps.)']],
          falcon: [['han', 'Something just moved in there. Something big.'], ['chewie', '(A warning growl at the water.)']],
          cruiser: [['morty', 'There’s a snake, Rick! A huge one!'], ['rick', 'It’s a dragonsnake, Morty. Don’t pet it.']],
        },
        things: [{ kind: 'dragonsnake', at: [0, 0], abs: true, y: 0 }],
        pits: [{ at: [0, 0], r: 15, depth: 3 }],
      },
    ],
    // stands of great cypresses round the landing, roots in the bog between
    // them, kept off the places (Yoda's hut, the X-wing, the cave, the camp)
    things: grove(31, 46, 30, 190, ['dagocypress', 'dagocypress', 'dagoroots'], [0.7, 1.25]).filter(({ at: [x, z] }) => [[-90, 60, 30], [40, 74, 34], [-70, -120, 30], [100, -60, 32], [-26, -46, 24], [130, 110, 30], [0, 0, 26]].every(([px, pz, r]) => Math.hypot(x - px, z - pz) > r)),
    scatter: [
      // (Quaternius's ground cover, under the built plants: catalog/quaternius.js)
      { kind: 'qfern', n: 100, within: [5, 80], scale: [0.7, 1.4], solid: false },
      { kind: 'qmushroom', n: 30, within: [6, 80], scale: [0.6, 1.4], solid: false },
      // great cypresses on their roots, mangrove roots standing in the bog
      // (the great trees few and far, shapes in the mist; the gnarled ones
      // close in all round, crowded, as the film's are)
      { kind: 'dagocypress', n: 18, within: [60, 560], scale: [0.7, 1.2], dry: false, sink: 0.6, solid: 1.2 },
      { kind: 'dagoroots', n: 40, within: [10, 420], scale: [0.8, 1.6], dry: false, sink: 0.4, solid: 0.5 },
      { kind: 'gnarltree', n: 70, within: [18, 320], scale: [0.8, 1.4], dry: false, opts: { seed: 1 } },
      { kind: 'gnarltree', n: 60, within: [18, 420], scale: [0.7, 1.3], dry: false, opts: { seed: 2, bark: '#55503f', moss: '#5e6450', roots: 6 } },
      { kind: 'gnarltree', n: 40, within: [420, 900], scale: [1.0, 1.6], dry: false, solid: false, opts: { seed: 3, lo: true } },
      { kind: 'reeds', n: 700, within: [5, 420], scale: [0.7, 1.6], solid: false, dry: false, clear: -10, opts: { seed: 4, color: '#5a5c44' } },
      { kind: 'fungus', n: 220, within: [5, 420], scale: [0.8, 2], solid: false, clear: -8, opts: { seed: 5 } },
      { kind: 'fern', n: 200, within: [5, 420], scale: [0.7, 1.4], solid: false, clear: -8, opts: { seed: 6, color: '#474931' } },
      { kind: 'log', n: 36, within: [20, 460], scale: [0.7, 1.3], solid: false, dry: false, opts: { seed: 7, bark: '#4c463a', moss: '#5a6a34' } },
      { kind: 'rock', n: 40, within: [10, 460], scale: [0.6, 2], opts: { color: '#5a5a48', sharp: 0.3 } },
    ],
    life: [
      { kind: 'droid', n: 1, at: [-22, -42], roam: 4, speed: 0.5, name: 'R2-D2', says: ['(An indignant whistle: he was nearly eaten, you know.)', '(He beeps, and shakes off a strand of swamp weed.)', '(A worried warble at the mist.)'] },
      { kind: 'ghostben', n: 1, at: [96, -52], still: true, face: 2.6, name: 'Obi-Wan Kenobi', voice: 'ben', says: ['You will go to the Dagobah system. There you will learn from Yoda, the Jedi Master who instructed me.', 'If you choose the quick and easy path, as Vader did, you will become an agent of evil.', 'That boy is our last hope.', 'Use the Force.'] },
      { kind: 'bogwing', n: 8, at: [0, 0], spread: 160, roam: 40, speed: 3, y: 3.5, solid: false },
    ],
    rides: [],
    flyovers: [{ kind: 'xwing', n: 1, metres: 12.5, alt: 160, speed: 90, every: 240 }],
  },
};
