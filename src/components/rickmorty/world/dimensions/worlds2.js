// The rest of the places' worlds (./worlds.js's header says what a record
// holds; it merges these into its WORLDS): kept apart only for size.

export const WORLDS2 = {
  // Planet Squanch: a village of cat-tree houses round the wedding, taller ones
  // in the haze east, west and south, the north left open on the arch and the
  // ringed planet; the suckulents as they are (their model), and the guests (from
  // other dimensions) in a pen by the arch, on the dance floor and about the
  // grass, gone once the wedding's over
  squanch: {
    look: { walls: [0xcdb68a, 0xd8c8a8], roofs: [0x8a6a4a, 0xd8c8a8], lit: [0xffd890], trim: 0x5a3a2a },
    edge: { kind: 'bushes', h: 0.9, models: ['q:Bush_Common_Flowers', 'q:Bush_Long_1'] },
    ring: {
      n: { styles: ['stack', 'mushroom', 'dome'], rows: 2, h: [7, 11] },
      e: { styles: ['stack', 'mushroom', 'dome'], rows: 2, h: [7, 11] },
      w: { styles: ['stack', 'mushroom', 'dome'], rows: 2, h: [7, 11] },
      s: { styles: ['mushroom', 'dome'], rows: 1, h: [7, 10] },
    },
    far: { e: { styles: ['mushroom', 'stack'], h: [34, 48] }, s: { styles: ['mushroom', 'stack'], h: [34, 44] }, w: { styles: ['mushroom', 'stack'], h: [34, 48] } },
    hero: [6, -12.6],
    vista: 0.3,
    pieces: [
      { model: '/models/c137/rm/sm/suckulent.glb', at: [-19, 12.1], turn: 0.4, h: 1.8 },
      { model: '/models/c137/rm/sm/suckulent.glb', at: [-28, -8], turn: 2.1, h: 1.4 },
      { model: '/models/c137/rm/sm/suckulent.glb', at: [27, 2], turn: 5.3, h: 1.55 },
      { model: '/models/c137/rm/sm/suckulent.glb', at: [-8, 19], turn: 0.7, h: 1.15 },
      { model: '/models/c137/rm/sm/suckulent.glb', at: [28, 17], turn: 3.3, h: 1.3 },
      { model: '/models/c137/rm/sm/suckulent.glb', at: [-30, 16], turn: 1.6, h: 1.7 },
      { model: '/models/c137/rm/sm/suckulent.glb', at: [14, 20], turn: 4.2, h: 1.05 },
    ],
    crowd: {
      walk: [{ kinds: ['gearperson-a', 'zigerion-b'], n: { high: 8, mid: 6, low: 4 }, loop: [[-5, 7], [13, 7], [13, 10], [-5, 10]], speed: 0.8, until: 'squanch' }],
      gather: [
        { kinds: ['plutonian-a', 'gearperson-b', 'zigerion-b', 'gearperson-a'], n: { high: 10, mid: 7, low: 5 }, at: [17.4, -9.25], r: 2, face: [6, -12.6], block: 'pen', until: 'squanch' },
        { kinds: ['plutonian-a', 'plutonian-b', 'gearperson-a'], n: { high: 9, mid: 6, low: 4 }, at: [-11, 3.5], r: 2, y: 0.3, face: [6, -12.6], block: 'floor', until: 'squanch' },
      ],
    },
  },

  // Bird World: clay towers with vines down them round the clearing, two
  // perches in the row north, either side of Birdperson's house, and the
  // builder's hazy towers beyond them kept (taller ones in the haze east, west
  // and south, clear of those); rocks for an edge, and no crowd: there are no
  // bird people but the place's own
  birdworld: {
    look: { walls: [0xd8b88a, 0xb8946a], roofs: [0xb8d88a, 0xa8c87a], lit: [0xffb84a], trim: 0x5a7a2a },
    edge: { kind: 'rocks', h: 0.8, models: ['q:Rock_Medium_1', 'q:Rock_Medium_4', 'q:Rock_Desert_2'] },
    ring: {
      n: { styles: ['adobe'], rows: 1, h: [8, 13], sets: [{ model: '/models/c137/rm/birdperch.glb', h: 13, n: 2 }] },
      e: { styles: ['adobe'], rows: 2, h: [8, 13] },
      w: { styles: ['adobe'], rows: 2, h: [8, 13] },
      s: { styles: ['adobe'], rows: 1, h: [8, 12] },
    },
    far: { e: { styles: ['adobe'], h: [40, 56] }, s: { styles: ['adobe'], h: [40, 52] }, w: { styles: ['adobe'], h: [40, 56] } },
    hero: [0, -16],
    vista: 0.3,
    forecourt: { props: [{ model: 'q:Flower_1_Single', h: 0.5, n: 6 }] },
  },

  // Gear World: a brass city round the square behind a rail, gear towers
  // beyond it with their cogs turning on top, the great gear due north past
  // the rail, and gear people walking the street round the box and across the
  // square
  gearworld: {
    look: { walls: [0xb87a3a, 0xc8a24a, 0x9a6a3a], roofs: [0xd8b86a, 0x7a4a22, 0xc8a24a], lit: [0xffd890], trim: 0x5a3a1a },
    edge: { kind: 'rail', h: 1.1 },
    ring: {
      n: { styles: ['stack', 'tower', 'block'], rows: 1, h: [8, 14] },
      e: { styles: ['stack', 'tower', 'block'], rows: 1, h: [8, 14] },
      w: { styles: ['stack', 'tower', 'block'], rows: 1, h: [8, 14] },
      s: { styles: ['block', 'stack'], rows: 1, h: [8, 12] },
    },
    far: { n: { styles: ['tower', 'stack'], h: [45, 80] }, e: { styles: ['tower', 'stack'], h: [45, 80] }, s: { styles: ['tower', 'stack'], h: [45, 70] }, w: { styles: ['tower', 'stack'], h: [45, 80] } },
    hero: [0, -75],
    vista: 0.3,
    // (the gear towers the cogs turn on, beyond the ring's row)
    landmarks: [
      { at: [-44, -60], style: 'stack', w: 12, d: 12, h: 24 },
      { at: [46, -56], style: 'stack', w: 14, d: 14, h: 28 },
      { at: [-80, -16], style: 'stack', w: 12, d: 12, h: 22 },
      { at: [80, 6], style: 'stack', w: 12, d: 12, h: 26 },
      { at: [-54, 62], style: 'stack', w: 12, d: 12, h: 20 },
      { at: [50, 64], style: 'stack', w: 12, d: 12, h: 22 },
      { at: [-26, -88], style: 'stack', w: 12, d: 12, h: 30 },
      { at: [28, -86], style: 'stack', w: 12, d: 12, h: 26 },
    ],
    pieces: [
      { model: '/models/c137/rm/gearbig.glb', at: [0, -75], turn: 0, h: 40, w: 38.6, d: 16.5 },
      // (a cog lying flat is 0.22 of its width high: one on each tower's top drum, and a collar on two)
      { model: '/models/c137/rm/sm/gearcog.glb', at: [-44, -60], turn: 0, h: 2.15, w: 9.7, d: 9.7, y: 23.52, spin: 0.35 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [46, -56], turn: 0.3, h: 2.52, w: 11.4, d: 11.4, y: 27.44, spin: -0.3 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [46, -56], turn: 0.1, h: 3.55, w: 16, d: 16, y: 9.43, spin: 0.22 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [-80, -16], turn: 0.5, h: 2.15, w: 9.7, d: 9.7, y: 21.56, spin: 0.4 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [80, 6], turn: 0.2, h: 2.15, w: 9.7, d: 9.7, y: 25.48, spin: -0.35 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [-54, 62], turn: 0.7, h: 2.15, w: 9.7, d: 9.7, y: 19.6, spin: 0.3 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [50, 64], turn: 0.4, h: 2.15, w: 9.7, d: 9.7, y: 21.56, spin: -0.4 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [-26, -88], turn: 0.6, h: 2.15, w: 9.7, d: 9.7, y: 29.4, spin: 0.25 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [-26, -88], turn: 0, h: 3.02, w: 13.6, d: 13.6, y: 10.49, spin: -0.2 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [28, -86], turn: 0.9, h: 2.15, w: 9.7, d: 9.7, y: 25.48, spin: -0.3 },
    ],
    crowd: {
      walk: [
        { kinds: ['gearperson-a', 'gearperson-b'], n: { high: 18, mid: 12, low: 8 }, loop: 'street', speed: 1.1 },
        { kinds: ['gearperson-b', 'gearperson-a'], n: { high: 8, mid: 6, low: 4 }, loop: [[-15, 10.2], [15, 10.2], [15, 12.5], [-15, 12.5]], speed: 0.9 },
      ],
    },
  },

  // Pluto: Plutonian domes and mushroom houses round the plain, giant
  // mushrooms and domes on the horizon, and the plutonium mines Scroopy warns
  // of, their wheels turning on the headframes; a rally on a riser west of the
  // podium, hopping now and then while the king speaks and on and on once
  // Morty's said it; Plutonians walking the plain's edge and across it
  pluto: {
    look: { walls: [0xb8c8e8, 0xe8e0cc], roofs: [0xc84a4a, 0x4a8ad8, 0xd84a8a, 0x8a4ad8], lit: [0xffd98a, 0x9adcff], trim: 0x6a7a98 },
    edge: { kind: 'rocks', h: 0.8, models: ['q:Rock_Medium_1', 'q:Rock_Medium_2'] },
    ring: {
      n: { styles: ['dome', 'mushroom'], rows: 1, h: [8, 14] },
      e: { styles: ['dome', 'mushroom'], rows: 2, h: [7, 13] },
      w: { styles: ['dome', 'mushroom'], rows: 2, h: [7, 13] },
      s: { styles: ['mushroom', 'dome'], rows: 1, h: [6, 10] },
    },
    far: { n: { styles: ['dome', 'mushroom'], h: [44, 70] }, e: { styles: ['dome'], h: [44, 64] }, w: { styles: ['dome'], h: [44, 64] }, s: { styles: ['dome', 'mushroom'], h: [44, 60] } },
    hero: [0, -19],
    vista: 0.26,
    // the mines: a winding house and a headframe each, in the mines' own grey
    landmarks: [
      { at: [66, -52], style: 'mast', w: 5, d: 5, h: 24, look: { walls: [0x6a6a7a], roofs: [0x3a3a4a], lit: [0xffd98a], trim: 0x3a3a4a } },
      { at: [79, -40], style: 'block', w: 10, d: 8, h: 7, look: { walls: [0x6a6a7a], roofs: [0x3a3a4a], lit: [0xffd98a], trim: 0x3a3a4a } },
      { at: [-64, -48], style: 'mast', w: 5, d: 5, h: 22, look: { walls: [0x6a6a7a], roofs: [0x3a3a4a], lit: [0xffd98a], trim: 0x3a3a4a } },
      { at: [-77, -36], style: 'block', w: 10, d: 8, h: 6, look: { walls: [0x6a6a7a], roofs: [0x3a3a4a], lit: [0xffd98a], trim: 0x3a3a4a } },
    ],
    // the headframes' wheels, lying on their tops and turning (a cog's height is 0.22 of its width)
    pieces: [
      { model: '/models/c137/rm/sm/gearcog.glb', at: [66, -52], y: 19.2, h: 1.33, w: 6, d: 6, spin: 0.6 },
      { model: '/models/c137/rm/sm/gearcog.glb', at: [-64, -48], y: 17.6, h: 1.11, w: 5, d: 5, spin: -0.7 },
    ],
    scatter: [
      { model: 'q:Mushroom_RedCap', h: 2.6, n: { high: 16, mid: 10, low: 5 }, r: [14, 90] },
      { model: 'q:Mushroom_Common', h: 1.6, n: { high: 14, mid: 8, low: 0 }, r: [12, 60] },
      { model: 'q:Rock_Medium_1', h: 1.8, n: { high: 10, mid: 6, low: 3 }, r: [20, 140] },
    ],
    forecourt: { path: { w: 2.6, color: 0xa8b8d8 }, props: [{ model: 'q:Mushroom_RedCap', h: 0.8, n: 6 }, { model: 'q:Rock_Medium_1', h: 0.5, n: 4 }] },
    crowd: {
      walk: [
        { kinds: ['plutonian-a'], n: { high: 8, mid: 5, low: 3 }, loop: 'street', speed: 1 },
        { kinds: ['plutonian-b'], n: { high: 4, mid: 2, low: 2 }, loop: [[-9, 9.5], [8, 9.5], [8, 11], [-9, 11]], speed: 0.9 },
      ],
      gather: [
        { kinds: ['plutonian-a', 'plutonian-b'], n: { high: 12, mid: 8, low: 5 }, at: [-11.5, 4.5], r: 2.6, y: 0.45, face: [0, -9.2], block: 'rally', beat: 6, until: 'pluto' },
        { kinds: ['plutonian-b', 'plutonian-a'], n: { high: 12, mid: 8, low: 5 }, at: [-11.5, 4.5], r: 2.6, y: 0.45, face: [0, -9.2], block: 'rally', beat: 1.4, after: 'pluto' },
      ],
    },
  },

  // Mr. Nimbus's beach: the sea open to the north, and out in it, half-sunk,
  // Atlantis's gold domes and green spires; black rocky headlands either side,
  // sea stacks off them, a white villa up the beach behind; no one about but
  // the king and his guard (the Atlanteans hunt here, and they're his people)
  nimbus: {
    look: { walls: [0x2a2e34, 0x3a4048], roofs: [0x4a5058, 0x3a4048], lit: [0x6ad8ff], trim: 0x2a2e34 },
    edge: { kind: 'rocks', h: 0.8, models: ['q:Rock_Medium_1', 'q:Rock_Medium_2'] },
    ring: { n: null, e: { styles: ['berm'], rows: 2, h: [6, 12] }, w: { styles: ['berm'], rows: 2, h: [6, 12] }, s: null },
    far: { n: null, e: { styles: ['berm'], h: [40, 56] }, w: { styles: ['berm'], h: [40, 56] }, s: { styles: ['berm'], h: [40, 50] } },
    hero: [0, -16.6],
    vista: 0.3,
    landmarks: [
      // Atlantis, standing in the sea up to its middle
      { at: [-4, -148], y: -12, style: 'dome', w: 32, d: 32, h: 30, look: { walls: [0x7ac8c0, 0x5aa8b0], roofs: [0xe8c84a, 0x6ad8ff], lit: [0x9adcff, 0x6ad8ff], trim: 0x2a6a7a } },
      { at: [-36, -136], y: -10, style: 'spire', w: 12, d: 12, h: 48, look: { walls: [0x7ac8c0, 0x5aa8b0], roofs: [0xe8c84a, 0x6ad8ff], lit: [0x9adcff, 0x6ad8ff], trim: 0x2a6a7a } },
      { at: [30, -140], y: -10, style: 'spire', w: 12, d: 12, h: 42, look: { walls: [0x7ac8c0, 0x5aa8b0], roofs: [0xe8c84a, 0x6ad8ff], lit: [0x9adcff, 0x6ad8ff], trim: 0x2a6a7a } },
      { at: [18, -156], y: -14, style: 'tower', w: 16, d: 16, h: 44, look: { walls: [0x7ac8c0, 0x5aa8b0], roofs: [0xe8c84a, 0x6ad8ff], lit: [0x9adcff, 0x6ad8ff], trim: 0x2a6a7a } },
      { at: [-60, -150], y: -8, style: 'tower', w: 12, d: 12, h: 26, look: { walls: [0x7ac8c0, 0x5aa8b0], roofs: [0xe8c84a, 0x6ad8ff], lit: [0x9adcff, 0x6ad8ff], trim: 0x2a6a7a } },
      { at: [56, -128], y: -9, style: 'spire', w: 8, d: 8, h: 30, look: { walls: [0x7ac8c0, 0x5aa8b0], roofs: [0xe8c84a, 0x6ad8ff], lit: [0x9adcff, 0x6ad8ff], trim: 0x2a6a7a } },
      // the villa, up the beach behind the way in
      { at: [6, 50], style: 'block', w: 22, d: 12, h: 8, look: { walls: [0xf6f2ea], roofs: [0x2a8ac8], lit: [0xfff0d0], trim: 0x2a8ac8 } },
      { at: [-12, 52], style: 'tower', w: 9, d: 9, h: 14, look: { walls: [0xf6f2ea], roofs: [0x2a8ac8], lit: [0xfff0d0], trim: 0x2a8ac8 } },
    ],
    scatter: [
      { model: 'q:Rock_Medium_2', h: 3.2, n: { high: 14, mid: 8, low: 4 }, r: [16, 150] },
      { model: 'q:Rock_Desert_1', h: 1.6, n: { high: 12, mid: 8, low: 4 }, r: [12, 80] },
    ],
    forecourt: { path: { w: 2.2, color: 0xb89a6a }, props: [{ model: 'q:Grass_Wispy_Short', h: 0.45, n: 3 }, { model: 'q:Rock_Desert_1', h: 0.5, n: 3 }] },
  },

  // Nuptia 4: the retreat's lodges round the lawn east, west and south, white
  // with violet roofs, a white rail along the cliff; north, nothing but the
  // cloud and far spires standing up out of it; no one more (the mythologs
  // hunt here, and the couple on the lawn is the Smiths)
  nuptia: {
    look: { walls: [0xf6f2ff, 0xece4f8, 0xf2eaf6], roofs: [0x6a4a8a, 0x8a6ab8, 0x5a3a7a], lit: [0xffe0c0, 0x9ad8ff], trim: 0x6a4a8a },
    edge: { kind: 'rail', h: 1.1, color: 0xf6f2ff },
    ring: { n: null, e: { styles: ['house', 'hut'], rows: 2, h: [6, 10] }, w: { styles: ['house', 'hut'], rows: 2, h: [6, 10] }, s: { styles: ['house', 'hut'], rows: 1, h: [6, 9] } },
    far: { n: { styles: ['spire'], h: [40, 80] }, e: { styles: ['spire'], h: [40, 70] }, w: { styles: ['spire'], h: [40, 70] }, s: { styles: ['berm', 'spire'], h: [36, 56] } },
    hero: [0, -13.4],
    vista: 0.26,
    forecourt: { path: { w: 2.4, color: 0xd8c8f0 }, props: [{ model: 'q:Flower_3_Single', h: 0.6, n: 8 }, { model: 'q:Bush_Common_Flowers', h: 1, n: 4 }] },
  },

  // the Immortality Field Resort: white hotels with gold and blue roofs east
  // and west past the kerb and, north and south, out past the field's dome; the
  // Whirly Dirly's track climbing out of the field in the open view north;
  // guests wading at the swim-up bar and in the pool, strolling across the lawn
  // and round the promenade
  resort: {
    look: { walls: [0xf6f2e8, 0xffe8c0, 0xbfe0f8], roofs: [0xc8a24a, 0x3a7ad8, 0x4ad8ff], lit: [0x6ad8ff, 0xfff8e8], trim: 0xf6f2e8 },
    edge: { kind: 'kerb', h: 0.15, color: 0xf6f2e8 },
    ring: { n: null, e: { styles: ['tower', 'block'], rows: 2, h: [10, 16] }, w: { styles: ['tower', 'block'], rows: 2, h: [10, 16] }, s: null },
    far: { n: { styles: ['tower', 'spire'], h: [50, 80] }, e: { styles: ['tower', 'block'], h: [50, 75] }, s: { styles: ['tower', 'block'], h: [50, 70] }, w: { styles: ['tower', 'block'], h: [50, 75] } },
    hero: [0, -8],
    vista: 0.3,
    // the hotels north and south, 13 m out at least (the dome reaches 9 m past
    // the kerb there), clear of the Whirly Dirly's track
    landmarks: [
      { at: [-26, -44], style: 'tower', w: 12, d: 10, h: 24 },
      { at: [-50, -44], style: 'block', w: 16, d: 10, h: 14 },
      { at: [46, -44], style: 'tower', w: 12, d: 12, h: 22 },
      { at: [-32, 46], style: 'block', w: 18, d: 10, h: 14 },
      { at: [0, 48], style: 'tower', w: 14, d: 12, h: 26 },
      { at: [32, 46], style: 'block', w: 18, d: 10, h: 14 },
    ],
    scatter: [
      { model: 'q:CommonTree_5', h: 7, n: { high: 12, mid: 8, low: 4 }, r: [20, 120] },
      { model: 'q:Bush_Common_Flowers', h: 1.3, n: { high: 14, mid: 8, low: 4 }, r: [14, 60] },
    ],
    forecourt: { path: { w: 2.4, color: 0xf6f2e8 }, props: [{ model: 'q:Prop_Planter_Single', h: 0.6, n: 4 }, { model: 'q:Flower_3_Single', h: 0.6, n: 6 }] },
    crowd: {
      walk: [
        { kinds: ['resortguest-a', 'resortguest-b'], n: { high: 5, mid: 3, low: 2 }, loop: [[-6, -0.3], [26, -0.3], [26, 2.6], [-6, 2.6]], speed: 0.8 },
        { kinds: ['resortguest-b', 'resortguest-a'], n: { high: 6, mid: 4, low: 2 }, loop: 'street', speed: 0.9 },
      ],
      gather: [
        // at the swim-up bar, in the water along the pool's north side, facing the bar
        { kinds: ['resortguest-a', 'resortguest-b'], n: { high: 6, mid: 4, low: 3 }, at: [-14, 2.2], row: 7, r: 0, y: -0.4, face: [-14, -1.6], block: 'pool' },
        // in the pool's east end, bobbing
        { kinds: ['resortguest-b', 'resortguest-a'], n: { high: 4, mid: 3, low: 2 }, at: [-11, 5], r: 1.6, y: -0.4, face: 'hero', block: 'pool', beat: 3 },
      ],
    },
  },

  // Snake Planet: the snakes' domes round the dust plain, in their own green
  // and yellow and the rocket's grey and red, more on the horizon, rocks for an
  // edge, the moon left open to the north; the space programme's launch towers
  // out north-east and a rocket going up over them now and then; snakes (they
  // strike here) gathered out past the rocks with a few astronauts, watching
  // the pad
  snakeplanet: {
    look: { walls: [0xd8c8a8, 0xb1b656, 0x8f9293], roofs: [0x5c9536, 0x77a340, 0xa44646], lit: [0xffe24a], trim: 0x3a2a3a },
    edge: { kind: 'rocks', h: 0.8, models: ['q:Rock_Medium_1', 'q:Rock_Medium_2', 'q:Rock_Desert_2'] },
    ring: {
      n: { styles: ['dome'], rows: 1, h: [6, 11] },
      e: { styles: ['dome'], rows: 2, h: [6, 11] },
      w: { styles: ['dome'], rows: 2, h: [6, 11] },
      s: { styles: ['dome'], rows: 1, h: [6, 10] },
    },
    far: { n: { styles: ['dome'], h: [40, 60] }, e: { styles: ['dome'], h: [40, 56] }, s: { styles: ['dome'], h: [40, 52] }, w: { styles: ['dome'], h: [40, 56] } },
    hero: [12, -17],
    vista: 0.3,
    // the launch towers, in the pad's grey with its red light
    landmarks: [
      { at: [64, -64], style: 'mast', w: 6, d: 6, h: 30, look: { walls: [0x8a8a8a], roofs: [0xc8c8c8], lit: [0xff5a3a], trim: 0x6a6a70 } },
      { at: [76, -54], style: 'mast', w: 6, d: 6, h: 22, look: { walls: [0x8a8a8a], roofs: [0xc8c8c8], lit: [0xff5a3a], trim: 0x6a6a70 } },
    ],
    scatter: [
      { model: 'q:Rock_Medium_2', h: 3, n: { high: 14, mid: 8, low: 4 }, r: [16, 140] },
      { model: 'q:Rock_Desert_1', h: 1.6, n: { high: 10, mid: 6, low: 3 }, r: [12, 80] },
    ],
    forecourt: { path: { w: 2.2, color: 0x9a7a6a }, props: [{ model: 'q:Rock_Desert_1', h: 0.5, n: 4 }, { model: 'q:Grass_Wispy_Short', h: 0.45, n: 4 }] },
    crowd: {
      gather: [
        { kinds: ['snake-a', 'snake-b'], n: { high: 12, mid: 8, low: 5 }, at: [-6, -38], r: 3.5, face: [12, -17] },
        { kinds: ['snakeastronaut'], n: { high: 4, mid: 3, low: 2 }, at: [8, -36], r: 2, face: [12, -17] },
      ],
    },
    // (a rocket off the pad between the launch towers, climbing out of sight)
    fliers: [{ model: '/models/c137/rm/snakerocket.glb', n: { high: 1, mid: 1, low: 0 }, climb: [70, -59], speed: 9, h: 10 }],
  },

  // the Purge Planet: the village's own cottages, barn and well (their models,
  // where the code ones stood), farmhouses and sheds round it behind a rail
  // fence, two more cottages among them, woods and low hills out to the dusk;
  // the villagers (the purge's hunters) only out past the fence, gathered in
  // the field beyond the barn and watching the village
  purge: {
    look: { walls: [0xf2ead6, 0xe8dcc0, 0x9a3a2a], roofs: [0xc8a24a, 0x5a3a2a, 0xb8923a], lit: [0xffc070, 0xffb060], trim: 0x5a3a22 },
    edge: { kind: 'fence', h: 1.2, color: 0x5a3a22 },
    ring: {
      n: { styles: ['house', 'hut'], rows: 1, h: [6, 9] },
      e: { styles: ['house', 'hut'], rows: 2, h: [6, 9], sets: [{ model: '/models/c137/rm/purgecottage.glb', h: 5, n: 1 }] },
      w: { styles: ['house', 'hut'], rows: 2, h: [6, 9], sets: [{ model: '/models/c137/rm/purgecottage.glb', h: 5, n: 1 }] },
      s: { styles: ['house', 'hut'], rows: 1, h: [6, 8] },
    },
    far: null,
    hero: [0, -19],
    vista: 0.35,
    // low hills round the valley, in the fields' own olive under the dusk
    landmarks: [
      { at: [-40, -175], style: 'berm', w: 90, d: 40, h: 24, look: { walls: [0x5a6a32, 0x4e5e2e], roofs: [0x6e7a3a], lit: [0xffc070], trim: 0x4a5428 } },
      { at: [80, -150], style: 'berm', w: 70, d: 36, h: 18, look: { walls: [0x5a6a32, 0x4e5e2e], roofs: [0x6e7a3a], lit: [0xffc070], trim: 0x4a5428 } },
      { at: [-170, -30], style: 'berm', w: 80, d: 40, h: 20, look: { walls: [0x5a6a32, 0x4e5e2e], roofs: [0x6e7a3a], lit: [0xffc070], trim: 0x4a5428 } },
      { at: [175, 20], style: 'berm', w: 90, d: 40, h: 22, look: { walls: [0x5a6a32, 0x4e5e2e], roofs: [0x6e7a3a], lit: [0xffc070], trim: 0x4a5428 } },
      { at: [20, 175], style: 'berm', w: 80, d: 36, h: 18, look: { walls: [0x5a6a32, 0x4e5e2e], roofs: [0x6e7a3a], lit: [0xffc070], trim: 0x4a5428 } },
    ],
    scatter: [
      { model: 'q:CommonTree_3', h: 9.4, n: { high: 26, mid: 16, low: 8 }, r: [22, 170] },
      { model: 'q:CommonTree_5', h: 7, n: { high: 14, mid: 8, low: 4 }, r: [16, 110] },
      { model: 'q:Bush_Long_1', h: 1.5, n: { high: 12, mid: 8, low: 0 }, r: [12, 60] },
    ],
    forecourt: { path: { w: 2.4, color: 0x9a8a5a }, props: [{ model: 'q:Grass_Wispy_Short', h: 0.45, n: 6 }, { model: 'q:Flower_1_Single', h: 0.5, n: 4 }, { model: 'q:Rock_Medium_1', h: 0.5, n: 2 }] },
    // the village's own, where the code ones stood, each filling its solid's
    // footprint (a cottage 1.66 of its height long and 1.49 wide, turned to
    // face the lane; the barn 0.96 long and 0.75 wide, its side to the way in;
    // the well as wide as it's high); the siren stays the builder's (its pull
    // spot is 1.4 m from its pole, inside any piece's reach)
    pieces: [
      { model: '/models/c137/rm/purgecottage.glb', at: [-22, -10], turn: 1.5708, h: 4 },
      { model: '/models/c137/rm/purgecottage.glb', at: [-22, 6], turn: 1.5708, h: 4 },
      { model: '/models/c137/rm/purgecottage.glb', at: [18, -13], turn: -1.5708, h: 4 },
      { model: '/models/c137/rm/purgecottage.glb', at: [22, 6], turn: -1.5708, h: 4 },
      { model: '/models/c137/rm/purgebarn.glb', at: [0, -19], turn: -1.5708, h: 9.3 },
      { model: '/models/c137/rm/purgewell.glb', at: [3, -3.4], turn: 0, h: 2.1 },
      // (the siren on its pole, by its own pull)
      { model: '/models/c137/rm/purgesiren.glb', at: [-11, -13.4], turn: 0, h: 6.9, own: 'siren' },
    ],
    crowd: {
      gather: [
        { kinds: ['magdalian-a', 'magdalian-b', 'magdalian-c'], n: { high: 10, mid: 6, low: 4 }, at: [10, -38], r: 2.5, face: [0, 0] },
        { kinds: ['magdalian-c', 'magdalian-a', 'magdalian-b'], n: { high: 8, mid: 5, low: 0 }, at: [-11, -44], r: 2.5, face: [0, 0] },
      ],
    },
  },

  // Cronenberg World: the Smiths' street a year on, their house its model where
  // the code one stood, the neighbours' houses in the street's design gone grey
  // and boarded up all round, wrecks in two of the empty lots across the back,
  // a wall of rubble for an edge and the dead town's towers in the haze; no one
  // about but the Smiths and the Cronenbergs
  cronenberg: {
    look: { walls: [0xb8a890, 0x9a8a72, 0x8a8478], roofs: [0x5a4a4a, 0x4a3a3a, 0x6a5a4a], lit: [0x6a4a2a, 0x3a2a1a], trim: 0x6a5a5a },
    edge: { kind: 'wall', h: 0.9, color: 0x6a5a5a },
    ring: {
      n: { styles: ['house'], rows: 2, h: [7, 10], sets: [{ model: '/models/c137/rm/croncar.glb', h: 1.6, n: 2 }] },
      e: { styles: ['house'], rows: 1, h: [7, 9] },
      w: { styles: ['house'], rows: 1, h: [7, 9] },
      s: { styles: ['house'], rows: 2, h: [7, 10] },
    },
    far: { n: { styles: ['block', 'tower'], h: [36, 60] }, e: { styles: ['block', 'tower'], h: [36, 56] }, w: { styles: ['block', 'tower'], h: [36, 56] } },
    hero: [-16, -20],
    vista: 0.26,
    scatter: [
      { model: 'q:Rock_Medium_2', h: 1.4, n: { high: 18, mid: 10, low: 5 }, r: [12, 110] },
      { model: 'q:Rock_Medium_4', h: 0.9, n: { high: 12, mid: 8, low: 4 }, r: [10, 70] },
      { model: 'q:Grass_Wispy_Short', h: 0.6, n: { high: 24, mid: 14, low: 0 }, r: [10, 60] },
    ],
    forecourt: { props: [{ model: 'q:Rock_Medium_1', h: 0.5, n: 4 }, { model: 'q:Grass_Wispy_Short', h: 0.45, n: 6 }] },
    // the house fills its solid (1.57 of its height across, 0.96 deep); the
    // car stays the builder's (its look spot is 2 m from its middle)
    pieces: [
      { model: '/models/c137/rm/cronhouse.glb', at: [-16, -20], turn: 0, h: 8.3 },
      // (the wreck on its solid, by its own look)
      { model: '/models/c137/rm/croncar.glb', at: [16, 12], turn: 0.2, h: 1.6, w: 4.1, d: 1.9, own: 'wreckedcar' },
    ],
    // (Cronenbergs beyond the rubble, out past the hunters' 7 m, watching)
    crowd: { gather: [{ kinds: ['cronenberg'], n: { high: 10, mid: 6, low: 4 }, at: [6, -42], r: 3, face: [0, 0] }] },
  },

  // the Blood Dome: the Death Stalkers on stands of scrap east, west and north
  // of the ring, behind a wall of tyres, cheering on a beat, a wreck at the end
  // of each side stand and more of them milling outside the wall; buttes and
  // mesas out across the wasteland, a trampled way from the way in to the ring
  blooddome: {
    look: { walls: [0xb8743a, 0xa8642e, 0xc8844a], roofs: [0x8a4a22, 0xd8945a], lit: [0x8a5a2a, 0xff8a3a], trim: 0x1a1a1a },
    edge: { kind: 'barrier', h: 1.1, color: 0x1a1a1a },
    ring: { n: null, e: null, s: null, w: null },
    far: { n: { styles: ['berm'], h: [28, 48] }, e: { styles: ['berm'], h: [28, 48] }, s: { styles: ['berm'], h: [28, 44] }, w: { styles: ['berm'], h: [28, 48] } },
    hero: [0, -5],
    vista: 0.2,
    // the mesas, wide and flat, beyond the buttes
    landmarks: [
      { at: [-70, -175], style: 'berm', w: 70, d: 40, h: 34 },
      { at: [95, -155], style: 'berm', w: 50, d: 36, h: 28 },
      { at: [-185, 20], style: 'berm', w: 80, d: 40, h: 30 },
      { at: [180, -40], style: 'berm', w: 60, d: 36, h: 36 },
      { at: [60, 175], style: 'berm', w: 70, d: 40, h: 26 },
    ],
    scatter: [
      { model: 'q:Rock_Desert_2', h: 3, n: { high: 14, mid: 8, low: 4 }, r: [16, 150] },
      { model: 'q:Rock_Desert_1', h: 1.6, n: { high: 12, mid: 8, low: 4 }, r: [12, 90] },
    ],
    forecourt: { path: { w: 3, color: 0xb08048 }, props: [{ model: 'q:Rock_Desert_1', h: 0.6, n: 4 }, { model: 'q:Grass_Wispy_Short', h: 0.4, n: 3 }] },
    // (the stands in the wrecks' own rust, steel blue and scrap)
    stands: [
      { at: [0, -37], w: 32, d: 8, h: 5, rows: 2, face: [0, -5], kinds: ['deathstalker-a', 'deathstalker-b'], n: { high: 6, mid: 5, low: 4 }, beat: 2.5, look: { walls: [0x8a5a2a, 0x5a6a8a, 0x6a5a4a], roofs: [0x3a3a3a, 0x4a4a4a], lit: [0xff8a3a], trim: 0x3a3a3a } },
      { at: [47, -8], w: 26, d: 8, h: 4.5, rows: 2, face: [0, -5], kinds: ['deathstalker-b', 'deathstalker-a'], n: { high: 7, mid: 4, low: 2 }, beat: 2.5, look: { walls: [0x8a5a2a, 0x5a6a8a, 0x6a5a4a], roofs: [0x3a3a3a, 0x4a4a4a], lit: [0xff8a3a], trim: 0x3a3a3a } },
      { at: [-47, -8], w: 26, d: 8, h: 4.5, rows: 2, face: [0, -5], kinds: ['deathstalker-a', 'deathstalker-b'], n: { high: 7, mid: 4, low: 2 }, beat: 2.5, look: { walls: [0x8a5a2a, 0x5a6a8a, 0x6a5a4a], roofs: [0x3a3a3a, 0x4a4a4a], lit: [0xff8a3a], trim: 0x3a3a3a } },
    ],
    // a wreck at the south end of each side stand (a car 2.57 of its height long, 1.21 wide)
    pieces: [
      { model: '/models/c137/rm/croncar.glb', at: [47, 9], turn: 1.9, h: 1.6, w: 4.1, d: 1.9 },
      { model: '/models/c137/rm/croncar.glb', at: [-47, 9], turn: -1.3, h: 1.6, w: 4.1, d: 1.9 },
    ],
    crowd: { walk: [{ kinds: ['deathstalker-a', 'deathstalker-b'], n: { high: 4, mid: 2, low: 0 }, loop: 'street', speed: 1.2 }] },
  },

  // Mr. Frundles' Earth: the street goes on past the kerb, and every house on
  // it is his: his house twice more (its model) and the rest the same design in
  // code, in his fur's colours; trees and hills beyond; and on every front
  // lawn, his copies and the dog's (they hunt here: out past the kerb only),
  // staring in
  frundles: {
    look: { walls: [0xc36759, 0xc66b5f, 0xd17a6f], roofs: [0xb55f53, 0x8a4a2a, 0xe39d95], lit: [0xfff0d8], trim: 0x9a9a96 },
    edge: { kind: 'kerb', h: 0.15, color: 0x9a9a96 },
    ring: {
      n: { styles: ['house'], rows: 2, h: [6, 8], sets: [{ model: '/models/c137/rm/frundleshouse.glb', h: 7, n: 2 }] },
      e: { styles: ['house'], rows: 2, h: [6, 8] },
      w: { styles: ['house'], rows: 2, h: [6, 8] },
      s: { styles: ['house'], rows: 2, h: [6, 8] },
    },
    far: { n: { styles: ['berm', 'tower'], h: [32, 48] }, e: { styles: ['berm'], h: [32, 44] }, s: { styles: ['berm', 'tower'], h: [32, 48] }, w: { styles: ['berm'], h: [32, 44] } },
    hero: [-3, -38],
    vista: 0,
    scatter: [
      { model: 'q:CommonTree_3', h: 9.4, n: { high: 20, mid: 12, low: 6 }, r: [20, 150] },
      { model: 'q:CommonTree_5', h: 7, n: { high: 12, mid: 8, low: 4 }, r: [16, 100] },
    ],
    crowd: {
      gather: [
        { kinds: ['frundles', 'frundlesdog'], n: { high: 10, mid: 6, low: 4 }, at: [0, -32.2], row: 30, r: 0, face: [0, 0] },
        { kinds: ['frundlesdog', 'frundles'], n: { high: 3, mid: 2, low: 1 }, at: [42.2, -14], row: 14, r: 0, face: [0, -14] },
        { kinds: ['frundles', 'frundlesdog'], n: { high: 3, mid: 2, low: 1 }, at: [42.2, 14], row: 14, r: 0, face: [0, 14] },
        { kinds: ['frundles', 'frundlesdog'], n: { high: 3, mid: 2, low: 1 }, at: [-42.2, -14], row: 14, r: 0, face: [0, -14] },
        { kinds: ['frundlesdog', 'frundles'], n: { high: 3, mid: 2, low: 1 }, at: [-42.2, 14], row: 14, r: 0, face: [0, 14] },
        { kinds: ['frundles', 'frundlesdog'], n: { high: 6, mid: 3, low: 2 }, at: [0, 32.2], row: 30, r: 0, face: [0, 0] },
      ],
    },
  },

  // the Jerryboree: a ribbon of windows over the TV onto a city of towers and
  // domes in the daycare's pastels; Ricks lined up by the desk to drop off, and
  // Jerrys in golf clothes (none of the candidates' outfits) waist-deep in the
  // ball pit, watching the TV
  jerryboree: {
    look: { walls: [0xf6e6a8, 0xbfe0e8, 0xf2b8c8], roofs: [0x7ab8d8, 0xf2a0b0, 0x9ad89a], lit: [0xfff2c8, 0xf6dc7a], trim: 0x2a5a8a },
    windows: [{ wall: 'n', from: -9.6, to: 9.6, y0: 2.1, h: 1.5, mullion: 1.6 }],
    outside: 'ground',
    ground: 0xd8d0c0,
    sky: { top: 0x3a8ad8, mid: 0x9ad0f0, low: 0xf2eaf0, sun: 0xfff6e8, clouds: 0.8, moons: 0 },
    ring: { n: { styles: ['tower', 'dome', 'block'], rows: 2, h: [10, 22] }, e: null, s: null, w: null },
    far: { n: { styles: ['tower', 'dome', 'spire'], h: [50, 90] } },
    crowd: {
      gather: [
        { kinds: ['jerry-golf'], n: { high: 7, mid: 5, low: 4 }, at: [5, -4], r: 1.6, face: [-2, -7.4], block: 'ballpit' },
        { kinds: ['crowd:doofusrick', 'crowd:cowboyrick', 'crowd:pilotrick', 'crowd:sweaterrick', 'crowd:mulletrick'], n: { high: 5, mid: 4, low: 3 }, at: [10, 4.6], row: 4, face: [6.5, 3.1], block: 'dropoff' },
      ],
    },
  },

  // St. Gloopy Noops: the ward's north wall glazed either side of the theatre's
  // bay, onto a medical city of white and mint towers under two moons; nurses
  // walking the side aisles and the street outside (the doctors who hunt are
  // Glip-Glops: none of those)
  gloopynoops: {
    look: { walls: [0xf6faf8, 0xc8f0e0, 0xd8e0dc], roofs: [0x6ab8a0, 0x9aa8a0, 0xf6faf8], lit: [0xbfe8ff, 0x6aff9a], trim: 0x6ab8a0 },
    windows: [
      { wall: 'n', from: -19, to: -5.5, y0: 1.1, h: 3.1, mullion: 2.25 },
      { wall: 'n', from: 5.5, to: 19, y0: 1.1, h: 3.1, mullion: 2.25 },
    ],
    outside: 'ground',
    ground: 0xc8d8d0,
    sky: { top: 0x1a5a7a, mid: 0x7ac8d0, low: 0xe0f6f0, sun: 0xf8fff8, clouds: 0.5, moons: 2 },
    ring: { n: { styles: ['tower', 'block', 'dome'], rows: 2, h: [12, 24] }, e: null, s: null, w: null },
    far: { n: { styles: ['tower', 'spire', 'dome'], h: [50, 90] } },
    crowd: {
      walk: [
        { kinds: ['gloopnurse'], n: { high: 3, mid: 2, low: 2 }, loop: [[-20.8, -15], [-19.4, -15], [-19.4, 8.5], [-20.8, 8.5]], speed: 0.9 },
        { kinds: ['gloopnurse'], n: { high: 3, mid: 2, low: 2 }, loop: [[19.6, -15], [21, -15], [21, 15], [19.6, 15]], speed: 0.8 },
        { kinds: ['gloopnurse'], n: { high: 5, mid: 3, low: 0 }, loop: 'street', speed: 1.1 },
      ],
    },
  },

  // Heist-Con: glass behind the keynote stage, under the con's banner, onto a
  // casino strip at night in the hall's black, gold and neon; Zigerions (con
  // men) behind the booths' counters, a queue for badges by the way in, a crowd
  // at a casino's door across the strip, and no heisters' kind among them (two
  // of theirs are recruitable)
  heistcon: {
    look: { walls: [0x2a2420, 0x3a302a, 0x1a1612], roofs: [0xd8b25a, 0x8a1e22, 0x1a1612], lit: [0xffd080, 0xff4a8a, 0x6ad8ff, 0xd8b25a], trim: 0xd8b25a, night: true },
    windows: [{ wall: 'n', from: -9, to: 9, y0: 1, h: 5, mullion: 3 }],
    outside: 'ground',
    ground: 0x1e1a18,
    sky: { top: 0x07050f, mid: 0x1e1430, low: 0x5a2a48, sun: 0xffd8a0, clouds: 0, moons: 1 },
    ring: { n: { styles: ['tower', 'block', 'dome'], rows: 2, h: [12, 28] }, e: null, s: null, w: null },
    far: { n: { styles: ['tower', 'spire'], h: [60, 120] } },
    crowd: {
      gather: [
        { kinds: ['zigerion', 'zigerion-b'], n: { high: 2, mid: 2, low: 1 }, at: [15, 12.82], row: 2.4, face: [15, 0], block: 'booth-a' },
        { kinds: ['zigerion-b', 'zigerion'], n: { high: 2, mid: 2, low: 1 }, at: [-15, 12.82], row: 2.4, face: [-15, 0], block: 'booth-b' },
        { kinds: ['zigerion', 'zigerion-b'], n: { high: 2, mid: 2, low: 1 }, at: [17.82, -10], row: 2.4, face: [0, -10], block: 'booth-c' },
        { kinds: ['zigerion-b', 'zigerion'], n: { high: 2, mid: 2, low: 1 }, at: [-17.82, -10], row: 2.4, face: [0, -10], block: 'booth-d' },
        { kinds: ['gearperson-a', 'plutonian-b', 'magdalian-a'], n: { high: 7, mid: 3, low: 3 }, at: [-4.1, 14.9], r: 1.5, face: [-8, 13], block: 'badgequeue' },
        { kinds: ['magdalian-a', 'gearperson-a', 'plutonian-b'], n: { high: 3, mid: 0, low: 0 }, at: [6, -22.5], r: 2, face: [6, -32] },
      ],
    },
  },

  // the Federation prison: the north wall behind the Brainalyzer glazed onto
  // space, barred, a Federation ship going by now and then out of the dark;
  // in the cells down the west wall, who the cells' look says is there (two
  // aliens, a Rick who isn't ours, a very quiet Jerry; the last one has only a
  // sauce packet). The guards' kind is nowhere in it.
  prison: {
    windows: [{ wall: 'n', from: -12, to: 12, y0: 1.2, h: 5.4, mullion: 2.4, frame: 0x2a3a32 }],
    outside: 'space',
    // (black, from past the room's own depth: a ship comes and goes in it)
    fog: [0x000000, 70, 380],
    crowd: {
      gather: [
        { kinds: ['crowd:punkrick'], n: { high: 1, mid: 1, low: 1 }, at: [-18.6, 10.5], row: 1, face: [0, 10.5], block: 'cells' },
        { kinds: ['jerry-cardigan'], n: { high: 1, mid: 1, low: 1 }, at: [-18.6, 13], row: 1, face: [0, 13], block: 'cells' },
        { kinds: ['zigerion', 'deathstalker-a'], n: { high: 2, mid: 2, low: 1 }, at: [-18.6, 8], row: 1.6, face: [0, 8], block: 'cells' },
      ],
    },
    fliers: [{ model: '/models/c137/fedship.glb', n: { high: 1, mid: 1, low: 0 }, y: [11, 15], speed: 18, h: 4.5 }],
  },

  // the Vindicators' ship: the long window in the hall's east wall made real,
  // on deep space, and a Federation ship now and then coming in out of it
  // over the hull; no one more aboard than the team
  vindicators: {
    windows: [{ wall: 'e', from: -7, to: 7, y0: 1.3, h: 3.4, mullion: 2.8, frame: 0xc8d2e0 }],
    outside: 'space',
    // (a blue planet, and its moon, out past the long window)
    bodies: [
      { bearing: 100, up: 2, size: 7, color: 0x4a6ac8 },
      { bearing: 75, up: 6, size: 1.5, color: 0xc8c8d0 },
    ],
    // (black, from past the hall's own depth: a ship comes and goes in it)
    fog: [0x000000, 45, 360],
    fliers: [{ model: '/models/c137/fedship.glb', n: { high: 1, mid: 1, low: 0 }, y: [9, 12], speed: 18, h: 4.5 }],
  },

  // Rick Prime's fortress: the north wall over his console glazed, a long
  // window between the ribs onto space; his spare drones racked out past the
  // glass, one hanging dormant in each bay but the one behind him, that turn
  // with the three inside when they see Morty (the drones' kind hunts in
  // here: behind the glass only)
  fortress: {
    windows: [{ wall: 'n', from: -14, to: 14, y0: 1.6, h: 7, mullion: 4, frame: 0x2a2e38 }],
    outside: 'space',
    // (Rick Prime's moon, hanging in the long window beside him)
    bodies: [{ bearing: -10, up: 5, size: 7, color: 0x8a8a92 }],
    crowd: {
      gather: [
        { kinds: ['primedrone'], n: { high: 1, mid: 1, low: 0 }, at: [-12, -19.2], row: 1, y: 4.4, face: [-12, 0] },
        { kinds: ['primedrone'], n: { high: 1, mid: 1, low: 0 }, at: [-8, -19.2], row: 1, y: 4.4, face: [-8, 0] },
        { kinds: ['primedrone'], n: { high: 1, mid: 1, low: 0 }, at: [-4, -19.2], row: 1, y: 4.4, face: [-4, 0] },
        { kinds: ['primedrone'], n: { high: 1, mid: 1, low: 0 }, at: [4, -19.2], row: 1, y: 4.4, face: [4, 0] },
        { kinds: ['primedrone'], n: { high: 1, mid: 1, low: 0 }, at: [8, -19.2], row: 1, y: 4.4, face: [8, 0] },
        { kinds: ['primedrone'], n: { high: 1, mid: 1, low: 0 }, at: [12, -19.2], row: 1, y: 4.4, face: [12, 0] },
      ],
    },
  },

  // Evil Rick's lair: the north wall's painting of the dome made a window onto
  // the dome itself, its Mortys (the light copies) packed tight on its tiers in
  // the dark, breathing, every one of them watching the door Morty walks in by;
  // the lair's towers behind them, lit green
  evilrick: {
    look: { walls: [0x2a3a30, 0x1e2a22], roofs: [0x121a14, 0x24302a], lit: [0x4aff7a, 0xff3a3a], trim: 0x121a14, night: true },
    windows: [{ wall: 'n', from: -10, to: 10, y0: 1.6, h: 7.2, mullion: 2.5 }],
    outside: 'ground',
    ground: 0x121a14,
    sky: { top: 0x020604, mid: 0x0a1a10, low: 0x1e3a28, sun: 0x9affc0, clouds: 0, moons: 0 },
    ring: { n: null, e: null, s: null, w: null },
    far: { n: { styles: ['tower', 'block'], h: [40, 70] } },
    // (the dome's tiers, behind the console, facing the way in)
    stands: [{ at: [0, -29], w: 14, d: 12, h: 9, rows: 5, face: [0, 15.4], kinds: ['crowd:morty'], n: { high: 55, mid: 34, low: 0 } }],
  },

  // Mr. Goldenfold's dream: three windows on the north wall, each at a height
  // of its own, onto a dream city at a violet dusk: crooked houses in the
  // room's colours, the school (its model) on the way in's line between them,
  // door frames floating in front of them and over them, going nowhere, spires
  // beyond; no one out there
  dream: {
    look: { walls: [0xd8c8e8, 0xf2b8d8, 0xb8e8d8, 0xf6e6a8], roofs: [0x5a3a7a, 0x3a2a4a, 0xb87aff, 0xff6ab0], lit: [0xffe08a, 0xff6ab0, 0xb87aff], trim: 0x3a2a4a },
    windows: [
      { wall: 'n', from: -19, to: -11, y0: 2.4, h: 3.2, mullion: 2 },
      { wall: 'n', from: -6, to: 9, y0: 1, h: 4.8, mullion: 2.5 },
      { wall: 'n', from: 12, to: 18, y0: 1.6, h: 5.6, mullion: 2 },
    ],
    outside: 'ground',
    ground: 0x8a7aa8,
    sky: { top: 0x2a1a4a, mid: 0x8a5ab8, low: 0xf2c8e8, sun: 0xfff0f8, clouds: 0.5, moons: 2 },
    ring: { n: { styles: ['house', 'tudor', 'hut', 'house', 'tower'], rows: 2, h: [6, 16] }, e: null, s: null, w: null },
    far: { n: { styles: ['spire', 'tower', 'dome'], h: [40, 80] } },
    hero: [0, -62],
    vista: 0.35,
    // (the floating door frames: cream, an arch in gold, the door in the painted doors' brown)
    landmarks: [
      { at: [-14, -24], y: 2.6, style: 'hangar', w: 2.2, d: 0.3, h: 3.6, look: { walls: [0xf6f0e0], roofs: [0xd8b25a], lit: [0x8a6a4a], trim: 0x6a4a2a } },
      { at: [5, -25], y: 2.2, style: 'hangar', w: 2.4, d: 0.3, h: 4, look: { walls: [0xf6f0e0], roofs: [0xd8b25a], lit: [0x8a6a4a], trim: 0x6a4a2a } },
      { at: [15.5, -22.5], y: 1.8, style: 'hangar', w: 2, d: 0.3, h: 3.4, look: { walls: [0xf6f0e0], roofs: [0xd8b25a], lit: [0x8a6a4a], trim: 0x6a4a2a } },
      { at: [-3, -44], y: 4.5, style: 'hangar', w: 3, d: 0.4, h: 5, look: { walls: [0xf6f0e0], roofs: [0xd8b25a], lit: [0x8a6a4a], trim: 0x6a4a2a } },
      { at: [-22, -43], y: 25, style: 'hangar', w: 4, d: 0.5, h: 6.5, look: { walls: [0xf6f0e0], roofs: [0xd8b25a], lit: [0x8a6a4a], trim: 0x6a4a2a } },
      { at: [19, -42], y: 22, style: 'hangar', w: 4, d: 0.5, h: 6.5, look: { walls: [0xf6f0e0], roofs: [0xd8b25a], lit: [0x8a6a4a], trim: 0x6a4a2a } },
    ],
    // (Harry Herpson High, 11 m tall: 2.65 times that across, 2.4 deep)
    pieces: [{ model: '/models/c137/school.glb', at: [0, -62], turn: 0, h: 11, w: 29.1, d: 26.4 }],
  },

  // Needful Things: one window, in the back wall's corner by the clock, onto a
  // small town's street at night: houses in the street's own designs (its
  // tints, darkened for the night), their windows lit, street lights along the
  // pavement, hills and a church's spire beyond; no one about
  needful: {
    look: { walls: [0xa38d71, 0x80948b, 0xa2817b, 0x8891a1, 0xa89b6c], roofs: [0x41434c, 0x4d3426, 0x552d27, 0x3c434d], lit: [0xffd890, 0xffc070], trim: 0x3a2e24 },
    windows: [{ wall: 'n', from: -6.1, to: -3.2, y0: 1, h: 2.1, mullion: 1.45 }],
    outside: 'ground',
    ground: 0x2a2a30,
    sky: { top: 0x05060f, mid: 0x141a3a, low: 0x2e3452, sun: 0xd8e0ff, clouds: 0.15, moons: 1 },
    ring: { n: { styles: ['house'], rows: 2, h: [6, 9] }, e: null, s: null, w: null },
    far: { n: { styles: ['berm', 'berm', 'spire'], h: [30, 45] } },
    scatter: [{ model: 'q:Streetlight_Single', h: 5.6, n: { high: 8, mid: 8, low: 0 }, r: [13, 20] }],
  },

  // the vat of acid: a band of high windows round the back room, north, east
  // and west, onto an industrial yard under a smoggy green dusk (sheds, works,
  // tanks and silos in the room's steel and acid greens, pylons beyond); no
  // one more about than the deal's three
  vat: {
    look: { walls: [0x7a8a8a, 0x6a7a6a, 0x9aa8a8], roofs: [0x3a6a3a, 0x2a3a2a, 0x5a6a6a], lit: [0xbfffa0, 0xffe08a], trim: 0x2a3a2a },
    windows: [
      { wall: 'n', from: -10.5, to: 10.5, y0: 4.4, h: 2, mullion: 2.1, frame: 0x3a4a3a },
      { wall: 'e', from: -9, to: 7, y0: 4.4, h: 2, mullion: 2, frame: 0x3a4a3a },
      { wall: 'w', from: -9, to: 7, y0: 4.4, h: 2, mullion: 2, frame: 0x3a4a3a },
    ],
    outside: 'ground',
    ground: 0x3e4640,
    sky: { top: 0x24302c, mid: 0x6a8270, low: 0xc0d4a8, sun: 0xf2ffd0, clouds: 0.8, moons: 0 },
    ring: { n: { styles: ['hangar', 'block', 'dome', 'spire'], rows: 2, h: [8, 14] }, e: { styles: ['hangar', 'block'], rows: 2, h: [8, 12] }, w: { styles: ['hangar', 'block'], rows: 2, h: [8, 12] }, s: null },
    far: { n: { styles: ['block', 'tower', 'mast'], h: [40, 70] }, e: { styles: ['block', 'mast'], h: [40, 60] }, w: { styles: ['block', 'mast'], h: [40, 60] } },
  },

  // the Story Train: the carriage's scrolling windows kept, no window out;
  // passengers off the anthology standing in the vestibules at either end,
  // behind brass rails in the corners, turned to the aisle (Story Lord's at
  // the far end, the way in at the near one)
  storytrain: {
    look: { walls: [0x5a1e18], roofs: [0x8a1e22], lit: [0xffe0a0], trim: 0xc8a24a },
    outside: null,
    crowd: {
      gather: [
        { kinds: ['resortguest-a', 'magdalian-b'], n: { high: 3, mid: 2, low: 2 }, at: [-3.75, -13.05], r: 1, face: [0, -12.6], block: 'vestibule-nw' },
        { kinds: ['resortguest-b', 'resortguest-a'], n: { high: 3, mid: 2, low: 1 }, at: [3.75, -13.05], r: 1, face: [0, -12.6], block: 'vestibule-ne' },
        { kinds: ['magdalian-b', 'resortguest-b'], n: { high: 2, mid: 2, low: 1 }, at: [-3.75, 13.05], r: 1, face: [0, 12.6], block: 'vestibule-sw' },
        { kinds: ['resortguest-b', 'magdalian-b'], n: { high: 2, mid: 1, low: 1 }, at: [3.75, 13.05], r: 1, face: [0, 12.6], block: 'vestibule-se' },
      ],
    },
  },

  // Anatomy Park: no window out of Ruben; the plague, the one disease still in
  // its pen, packed in there with two more of it a step behind, either side,
  // on the pen's stone. The four that got out hunt the park, and their pens
  // stand empty: none of their kinds in here.
  anatomy: {
    outside: null,
    crowd: {
      gather: [
        { kinds: ['plague'], n: { high: 1, mid: 1, low: 1 }, at: [5, -10.8], r: 0.2, y: 0.5, face: [7, 0], block: 'pen-3' },
        { kinds: ['plague'], n: { high: 1, mid: 1, low: 1 }, at: [9, -10.8], r: 0.2, y: 0.5, face: [7, 0], block: 'pen-3' },
      ],
    },
  },
};
