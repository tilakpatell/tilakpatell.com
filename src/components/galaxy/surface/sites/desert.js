// Tatooine, from the ground. (sites/index.js has what a site is.)
//
// Things to do: the cantina (Greedo, who won't get to shoot first; Ben
// Kenobi, looking for a ship), Jabba's palace (an audience with the Hutt,
// a trapdoor, his rancor; Boba Fett's bounty on the Tuskens), Tosche
// Station (Biggs and the womp rats of Beggar's Canyon, Camie's canyon
// run, Owen's power converters) and a farmhand's droid, taken by Tuskens.

const { PI, cos, sin } = Math;
const r1 = (v) => Math.round(v * 10) / 10;
// a spot in something's own frame (x across it, z out of its front), in
// the world's
const from = ({ at, yaw }, [x, z]) => [r1(at[0] + x * cos(yaw) + z * sin(yaw)), r1(at[1] - x * sin(yaw) + z * cos(yaw))];

const CANTINA = { at: [300, -230], yaw: 0.3 }; // (at the middle of Mos Eisley)
const BAY = { at: [266, -208], yaw: 2.2 }; // Docking Bay 94
const PALACE = { at: [-430, -40], yaw: PI / 2 };
const TOSCHE = [-20, 330];
// Beggar's Canyon: down from the north through the eastern mesa, a run of
// pits each down to the canyon's floor
const CANYON = [[470, 112], [488, 62], [482, 18], [500, -26], [492, -70], [472, -112], [482, -152], [462, -198]];
const canyonPits = () => {
  const pits = [];
  for (let i = 0; i < CANYON.length - 1; i++) {
    const [a, b] = [CANYON[i], CANYON[i + 1]];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8);
    for (let j = 0; j < n; j++) pits.push({ at: [r1(a[0] + ((b[0] - a[0]) * j) / n), r1(a[1] + ((b[1] - a[1]) * j) / n)], r: 13, floor: 6 });
  }
  return pits;
};
// a booth in the cantina, round its wall: where someone sits, facing in
const booth = (a) => ({ at: [r1(sin(a) * 9.9), r1(cos(a) * 9.9)], face: r1(Math.atan2(-sin(a), -cos(a))) });

export const SITES = {
  tatooine: {
    // lit as the game lights its level (src/data/bf2017/light/tatooine.json, gameLit.js)
    gameLight: 'tatooine',
    place: 'The Jundland Wastes',
    line: 'Two suns, and sand to the edge of the world.',
    sky: {
      zenith: '#4f86c6',
      // (the colours checked against the films' daylight stills: white suns,
      // a pale blue-grey horizon, neutral haze, sand-coloured below)
      horizon: '#c8d3db',
      below: '#b8a68c',
      haze: 0.8,
      hazeColor: '#dddfdd',
      suns: [
        { az: 0.5, el: 0.3, color: '#fff6e8', size: 0.017, glow: 1.3 },
        { az: 0.66, el: 0.37, color: '#ffe4c4', size: 0.012, glow: 0.9 },
      ],
      clouds: { cover: 0.12, color: '#fffaf0', shade: '#e2d2b4', scale: 0.55, speed: 0.004 },
      bodies: [
        { az: -0.9, el: 0.62, size: 0.024, color: '#e0d8c8', color2: '#bdb4a2', bands: 0 },
        { az: -0.62, el: 0.7, size: 0.011, color: '#cfc6b6' },
      ],
    },
    fog: { color: '#d9dcdb', density: 0.00055 },
    // (the second sun casts no shadow: kept soft, so the shade stays neutral as the films')
    light: { sun: 3.2, second: 0.6, sky: '#b9d2f2', ground: '#b49a7a', ambient: 0.7 },
    ground: { detail: 'sand', detailLook: { color: 0.7, normal: 0.8, metres: 6 },
      seed: 3,
      wind: 0.5,
      layers: [
        { type: 'swell', scale: 420, height: 8 },
        { type: 'dunes', scale: 64, height: 9, wind: 0.5 },
        { type: 'mesas', scale: 560, height: 46, cover: 0.32, cliff: 0.045 },
        { type: 'mountains', from: 700, to: 3000, height: 520, scale: 1300 },
      ],
      palette: {
        low: '#d2b083',
        high: '#ebd4a6',
        rock: '#a46a4e',
        accent: '#c69a6c',
        deep: '#b38e66',
        hLow: -4,
        hHigh: 12,
        rockAt: 0.36,
        accentCover: 0.22,
        ripple: { strength: 0.09, scale: 3.2, wind: 0.5 },
        grain: 0.6,
        mark: '#b98a5a',
      },
      pits: canyonPits(),
    },
    weather: [{ kind: 'sand', count: 1300 }],
    land: { at: [0, 0], yaw: 0.9 },
    places: [
      {
        id: 'homestead',
        name: 'The Lars homestead',
        at: [-170, 150],
        r: 34,
        flat: { r: 24 },
        about: 'Owen and Beru Lars’ moisture farm, where Luke grew up: a domed hut over a courtyard sunk into the sand, out of the heat.',
        lines: {
          xwing: [['luke', 'Uncle Owen’s. I used to stand up there and watch the suns go down.'], ['r2', '(A soft, sad whistle.)']],
          falcon: [['han', 'So this is where the kid’s from. No wonder he wanted off this rock.']],
          cruiser: [['morty', 'Rick, this is the farm! From the movie!'], ['rick', 'Moisture farm, Morty. Nobody ever asks where the water comes from.']],
        },
        things: [
          { kind: 'homestead', at: [0, 0], yaw: 0.4 },
          { kind: 'homesteadring', at: [0, 0], yaw: 0.4 },
          { kind: 'vaporator', at: [16, -6] },
          { kind: 'vaporator', at: [-17, -6] },
          { kind: 'vaporator', at: [22, 12] },
          { kind: 'vaporator', at: [-20, 14] },
          { kind: 'vaporator', at: [4, 22] },
        ],
        // (the courtyard: a pit beside the hut)
        // (behind the hut, 15 m off along its back: the ring's middle)
        pits: [{ at: [-5.8, -13.8], r: 6.5, depth: 6 }],
      },
      {
        id: 'moseisley',
        name: 'Mos Eisley',
        at: [300, -230],
        r: 70,
        flat: { r: 64 },
        about: 'A wretched hive of scum and villainy: domes, docking bays, a cantina and a garrison of stormtroopers looking for two droids.',
        lines: {
          xwing: [['luke', 'Mos Eisley. Ben said we’d never find a more wretched hive of scum and villainy.']],
          falcon: [['han', 'Home sweet home. Keep your head down, Chewie: Jabba’s got people everywhere.'], ['chewie', '(A wary rumble.)']],
          rv: [['walt', 'A cantina full of smugglers and bounty hunters.'], ['jesse', 'So… basically Albuquerque.']],
        },
        things: [
          { kind: 'moscantina', at: [0, 0], yaw: 0.3 },
          { kind: 'dockingbay', at: [-34, 22], yaw: 2.2, model: false },
          { kind: 'adobe', at: [26, 16], opts: { r: 4.5 } },
          { kind: 'adobe', at: [34, -10], opts: { r: 3.6 } },
          { kind: 'adobe', at: [18, -28], opts: { r: 5 } },
          { kind: 'adobe', at: [-12, -30], opts: { r: 4 } },
          { kind: 'adobe', at: [-36, -14], opts: { r: 3.5 } },
          { kind: 'adobe', at: [-24, 48], opts: { r: 4.2 } },
          { kind: 'adobe', at: [8, 44], opts: { r: 3.8 } },
          { kind: 'adobe', at: [44, 34], opts: { r: 4.6 } },
          { kind: 'adobe', at: [52, -30], opts: { r: 3.4 } },
          { kind: 'stall', at: [12, 20], yaw: 2.6 },
          { kind: 'stall', at: [-6, 24], yaw: 3.4 },
          { kind: 'stall', at: [22, -6], yaw: 1.4 },
          { kind: 'crates', at: [-20, 8] },
          { kind: 'crates', at: [30, 2] },
          // (the town round about: towers, spires, arches over the lanes,
          // houses and huts)
          { kind: 'mostower', at: [-48, -32], yaw: 0.5 },
          { kind: 'mostower', at: [58, 8], yaw: -0.9 },
          { kind: 'mosspire', at: [34, -46], yaw: 0.3 },
          { kind: 'mosspire', at: [-46, 38], yaw: 2.1 },
          { kind: 'mosarch', at: [2, -46], yaw: 0.1 },
          { kind: 'mosarch', at: [26, 52], yaw: 0.45 },
          { kind: 'moshouse', at: [-52, -2], yaw: 1.4 },
          { kind: 'moshouse', at: [46, -40], yaw: -0.5 },
          { kind: 'moshut', at: [-28, -50], yaw: 0.8 },
          { kind: 'moshut', at: [56, 26], yaw: -1.9 },
          { kind: 'mosblock', at: [-6, 58], yaw: 3.0 },
          { kind: 'vaporator', at: [-46, 4] },
          { kind: 'vaporator', at: [40, -46] },
          { kind: 'landspeeder', at: [6, 12], yaw: 1.9, y: 0.7, solid: { r: 1.4 } },
        ],
      },
      {
        id: 'sandcrawler',
        name: 'A Jawa sandcrawler',
        at: [140, 250],
        r: 40,
        flat: { r: 30 },
        about: 'The Jawas’ rolling fortress, trawling the wastes for droids and scrap to sell to moisture farmers.',
        lines: {
          xwing: [['luke', 'Jawas! Careful, Artoo. They’ll have you in the back of that thing before you can beep.'], ['r2', '(An indignant squeal.)']],
          falcon: [['han', 'Jawas. Never buy a droid off ’em. Never sell ’em one either.']],
        },
        things: [{ kind: 'sandcrawler', at: [0, 0], yaw: 2.6 }],
      },
      {
        id: 'krayt',
        name: 'The krayt dragon’s bones',
        at: [-330, -150],
        r: 30,
        about: 'All that’s left of a krayt dragon, bleached in the twin suns. Tuskens say its pearl is still out here somewhere.',
        lines: {
          xwing: [['luke', 'A krayt dragon. Ben scared off a whole band of Tuskens with that howl once.']],
          falcon: [['chewie', '(An impressed whoop.)'], ['han', 'Yeah, I wouldn’t want to meet the live one either.']],
        },
        things: [{ kind: 'krayt', at: [0, 0], yaw: 0.7, sink: 0.6 }],
      },
      {
        id: 'escapepod',
        name: 'The escape pod',
        at: [-70, -330],
        r: 22,
        about: 'Where Artoo and Threepio came down, with the Death Star plans. No life forms aboard, said the Star Destroyer’s gunner, so he held his fire.',
        lines: {
          xwing: [['luke', 'This is the pod you and Threepio came down in, isn’t it, Artoo?'], ['r2', '(A proud trill.)']],
        },
        things: [{ kind: 'escapepod', at: [0, 0], yaw: 1.2, sink: 0.4 }],
      },
      {
        id: 'tuskens',
        name: 'A Tusken camp',
        at: [-420, 250],
        r: 34,
        flat: { r: 22 },
        about: 'Sand People: they ride banthas in single file, to hide their numbers, and don’t take kindly to visitors.',
        lines: {
          xwing: [['luke', 'Sand People. Easy, Artoo. Quiet.']],
          falcon: [['han', 'Tuskens. Let’s not stay for dinner.']],
        },
        things: [
          { kind: 'tent', at: [0, 0], yaw: 0.2, opts: { style: 'tusken' } },
          { kind: 'tent', at: [8, -5], yaw: 1.4, opts: { style: 'tusken' } },
          { kind: 'tent', at: [-7, -7], yaw: 2.5, opts: { style: 'tusken' } },
          { kind: 'tent', at: [4, 9], yaw: 3.6, opts: { style: 'tusken' } },
          { kind: 'fire', at: [1, -3] },
        ],
      },
      {
        id: 'benhut',
        name: 'Ben Kenobi’s hut',
        at: [420, 170],
        r: 26,
        flat: { r: 14 },
        about: 'Old Ben’s hermitage on the edge of the Dune Sea, where he gave Luke his father’s lightsaber.',
        lines: {
          xwing: [['luke', 'Ben’s place. He told me about my father here. And gave me his lightsaber.']],
        },
        things: [{ kind: 'benhut', at: [0, 0], yaw: -0.6 }],
      },
      {
        id: 'sarlacc',
        name: 'The Great Pit of Carkoon',
        at: [390, 370],
        r: 40,
        about: 'The nesting place of the all-powerful Sarlacc. In its belly you’ll find a new definition of pain and suffering, as you’re slowly digested over a thousand years.',
        lines: {
          xwing: [['luke', 'The Pit of Carkoon. We nearly went in, all of us.']],
          falcon: [['han', 'I can’t see a thing, but I remember it. I really remember it.'], ['chewie', '(A shuddering groan.)']],
          cruiser: [['morty', 'Th-that thing has teeth, Rick! In the sand!'], ['rick', 'A thousand years of digestion, Morty. Kind of aspirational.']],
        },
        // (and Jabba's skiff, hanging over its mouth, its plank out over the teeth)
        things: [{ kind: 'sarlacc', at: [0, 0], y: 0 }, { kind: 'skiff', at: [-12, 6], y: 7, yaw: 0.5, solid: false }],
        pits: [{ at: [0, 0], r: 26, depth: 11, cone: true }],
      },
      {
        id: 'palace',
        name: 'Jabba’s palace',
        at: PALACE.at,
        yaw: PALACE.yaw,
        r: 70,
        flat: { r: 72, edge: 30 },
        about: 'The B’omarr monks built it; Jabba the Hutt moved in. Behind its gate: the Hutt’s court, his band, his bounty hunters, and under the floor in front of his throne, his rancor.',
        lines: {
          xwing: [['luke', 'Jabba’s palace. Last time I came here I walked in the front door and let them drop me in the rancor pit.'], ['r2', '(A nervous warble.)']],
          falcon: [['han', 'I spent a year on that guy’s wall. Let’s make this quick.'], ['chewie', '(A low, unhappy growl.)']],
          cruiser: [['rick', 'A slug with a palace, Morty. That’s the dream.'], ['morty', 'Th-there’s a monster in the basement, Rick! Everybody knows that!']],
        },
        things: [
          // (the keep's drum front just behind the gate)
          { kind: 'palace', at: [3.5, -9] },
          // (the gate in front of the keep)
          { kind: 'palacegate', at: [0, 22] },
        ],
      },
      {
        id: 'tosche',
        name: 'Tosche Station',
        at: TOSCHE,
        r: 30,
        flat: { r: 28 },
        about: 'A power station on the edge of Anchorhead, where the farm kids hang about, fix their skyhoppers and pick up power converters.',
        lines: {
          xwing: [['luke', 'Tosche Station! I was always going here to pick up power converters.'], ['r2', '(A knowing whistle.)']],
          falcon: [['han', 'Nice place. If you like power converters.']],
        },
        things: [
          { kind: 'adobe', at: [-10, 4] },
          { kind: 'adobe', at: [12, -6] },
          { kind: 'dockingbay', at: [2, 18], yaw: PI, scale: 0.55, wear: 'adobe' },
          { kind: 'vaporator', at: [-18, -10] },
          { kind: 'crates', at: [6, 6] },
          { kind: 'crates', at: [-4, -12] },
          { kind: 'stall', at: [-2, -4], yaw: 0.6 },
        ],
      },
      {
        id: 'canyon',
        name: 'Beggar’s Canyon',
        at: [486, -40],
        r: 60,
        about: 'A winding gorge through the mesas east of Anchorhead. Farm kids race their skyhoppers through it, round the Stone Needle, and bullseye the womp rats on the way.',
        lines: {
          xwing: [['luke', 'Beggar’s Canyon! I used to bullseye womp rats in my T-16 back home.'], ['r2', '(An alarmed beep: Artoo remembers.)']],
          falcon: [['han', 'Kid says he flew through here. In a canyon. On purpose.']],
          cruiser: [['morty', 'Rick, it’s a canyon. People RACE through this?'], ['rick', 'Natural selection, Morty. With a scoreboard.']],
        },
        // the Stone Needle, standing in the canyon at its middle bend
        things: [{ kind: 'needle', at: [10, 10], sink: 1 }],
      },
    ],
    things: [
      // the farm's vaporators, out past the homestead
      { kind: 'vaporator', at: [-120, 110] },
      { kind: 'vaporator', at: [-130, 190] },
      { kind: 'vaporator', at: [-210, 110] },
      // where you set down: the farm's edge, a landspeeder pulled up by its
      // vaporator and the cargo it brought, a Jawa's stall
      { kind: 'vaporator', at: [-34, 22] },
      { kind: 'landspeeder', at: [24, -14], yaw: 2.1, y: 0.7, solid: { r: 1.4 } },
      { kind: 'barrel', at: [20, -9], yaw: 0.4 },
      { kind: 'barrel', at: [21.2, -9.6], yaw: 1.3 },
      { kind: 'bevelcrate', at: [18.6, -10.2], yaw: 0.2 },
      { kind: 'cooler', at: [27, -8], yaw: 2.2 },
      { kind: 'stall', at: [-16, 26], yaw: 2.2 },
      { kind: 'crates', at: [-21, 23] },
      { kind: 'lamp', at: [-12, 30], opts: { h: 3.6 } },
      // the Jawas' beasts, tethered by the sandcrawler's ramp
      { kind: 'ronto', at: [152, 236], yaw: 1.9 },
      { kind: 'eopie', at: [126, 262], yaw: 0.6 },
      { kind: 'eopie', at: [130, 258], yaw: 0.9, scale: 0.9 },
    ],
    scatter: [
      { kind: 'rock', n: 140, within: [30, 560], scale: [0.6, 3.2], opts: { color: '#9e7a56', sharp: 0.5 } },
      { kind: 'stones', n: 260, within: [10, 400], scale: [0.25, 0.7], solid: false, opts: { color: '#a68462' } },
    ],
    // where the people go (needs.js), and what they do there: Owen round his
    // vaporators, kneeling to fix each; Mos Eisley's locals at the stalls; the
    // Tuskens crouched round their fire. (The cantina's bar is its zone's.)
    wants: [
      { id: 'vaporator1', kind: 'work', at: [-154, 144], spots: [[-155.5, 144.6]], clip: 'kneel.fix', pause: 8 },
      { id: 'vaporator2', kind: 'work', at: [-187, 144], spots: [[-185.5, 144.5]], clip: 'kneel.fix', pause: 8 },
      { id: 'vaporator3', kind: 'work', at: [-148, 162], spots: [[-149.4, 161.2]], clip: 'kneel.fix', pause: 8 },
      { id: 'vaporator4', kind: 'work', at: [-190, 164], spots: [[-188.7, 163.1]], clip: 'kneel.fix', pause: 8 },
      { id: 'vaporator5', kind: 'work', at: [-166, 172], spots: [[-166.3, 170.4]], clip: 'kneel.fix', pause: 8 },
      // (a stall's counter, two at a time in front of it)
      { id: 'stall1', kind: 'food', at: [312, -210], slots: 2, spots: [[312.5, -212.5], [313.9, -211.7]], clip: 'interact', pause: 7 },
      { id: 'stall2', kind: 'food', at: [294, -206], slots: 2, spots: [[292.6, -208.1], [294.2, -208.5]], clip: 'interact', pause: 7 },
      { id: 'stall3', kind: 'food', at: [322, -236], slots: 2, spots: [[324.5, -236.4], [324.3, -234.8]], clip: 'interact', pause: 7 },
      { id: 'tuskenfire', kind: 'rest', at: [-419, 247], slots: 3, spots: [[-417.5, 247], [-420.5, 247], [-419, 245.5]], base: 'crouch', pause: 14 },
    ],
    life: [
      // at the landing: a Jawa at its stall, a haulier, an eopie at the trough
      { kind: 'jawa', n: 2, at: [-16, 24], spread: 3, roam: 3, speed: 0.8, group: true, name: 'Jawa trader', says: ['Utinni!', '(It holds up a droid motivator. Slightly used. Very slightly.)', 'M’um m’aloo!'] },
      { kind: 'farmer', n: 1, at: [20, -4], roam: 6, speed: 0.8, name: 'Haulier', says: ['Water run to Anchorhead. Two more stops, then the suns are down.', 'Mind the eopie. She spits.', 'That speeder’s not for sale. Everything else is.'] },
      { kind: 'eopie', n: 1, at: [12, 12], roam: 8, speed: 0.5, r: 0.9 },
      { kind: 'mousedroid', n: 1, at: [26, -2], roam: 6, speed: 1.4, r: 0.2, solid: false },
      { kind: 'jawa', n: 7, at: [140, 268], spread: 14, roam: 16, speed: 0.9, name: 'Jawa', says: ['Utinni!', 'Utinni! (It holds up a power converter, and names a price you don’t understand.)', 'M’um m’aloo!', '(It counts your credits, then counts them again.)'] },
      { kind: 'bantha', n: 4, at: [-400, 230], spread: 20, roam: 20, speed: 0.8, r: 1.5 },
      { kind: 'tusken', id: 'tuskencamp', n: 3, at: [-420, 250], spread: 10, roam: 10, speed: 1.0, needs: ['rest'], name: 'Tusken Raider', says: ['(A long, rising howl, and the gaffi stick held high.)', '(It stares. It doesn’t move. You get the message.)'] },
      { kind: 'stormtrooper', n: 4, path: [[290, -200], [330, -230], [300, -270], [262, -236]], speed: 1.4, name: 'Stormtrooper', says: ['Move along.', 'Let me see your identification.', 'How long have you had these droids?', 'These aren’t the droids we’re looking for.'] },
      { kind: 'sandtrooper', n: 2, at: [-60, -320], spread: 8, roam: 12, speed: 1.1, name: 'Sandtrooper', says: ['Look, sir: droids. Someone was in the pod.', 'The tracks go off in this direction.'] },
      { kind: 'dewback', n: 2, at: [-80, -300], spread: 10, roam: 14, speed: 0.7, r: 1.2 },
      { kind: 'sullustan', n: 1, at: [284, -244], roam: 8, speed: 1.0, name: 'A Sullustan pilot', says: ['(A string of chattering Sullustese, and a grin.)', 'Freighter’s in Bay 86. Cargo? Don’t ask.'] },
      { kind: 'ronto', n: 1, at: [330, -250], roam: 10, speed: 0.4, r: 1.3 },
      // (the game's own: Mos Eisley's chickens and scurriers under the stalls)
      { kind: 'chicken', n: 5, at: [298, -224], spread: 12, roam: 8, speed: 0.5, r: 0.2, solid: false },
      { kind: 'scurrier', n: 4, at: [278, -252], spread: 18, roam: 12, speed: 0.9, r: 0.2, solid: false },
      { kind: 'villager', n: 5, at: [300, -230], spread: 40, roam: 25, speed: 1.1, needs: ['food'], name: 'Mos Eisley local', says: ['Watch yourself. This place can be a little rough.', 'Chalmun’s got a band in tonight. No droids, though.', 'If you’re looking for a pilot, try the cantina.', 'Hutt business. Don’t ask.'] },
      { kind: 'droid', n: 1, at: [-160, 140], roam: 10, speed: 0.6, name: 'An R5 unit', says: ['(A cheerful whistle. Its motivator sounds fine… for now.)'] },
      // who has something for you to do
      { kind: 'farmer', id: 'owen', at: [-158, 160], roam: 6, speed: 0.7, needs: ['work'], name: 'Owen Lars', named: true, quest: 'converters', says: ['Those vaporators won’t fix themselves.', 'You can waste time with your friends when your chores are done.'] },
      { kind: 'rebelpilot', id: 'biggs', at: [-14, 336], still: true, face: 2.6, name: 'Biggs Darklighter', named: true, quest: 'womprats', says: ['I’m going to the Academy. Then I’m jumping ship and joining the Rebellion. Don’t tell anyone.', 'Still the best bush pilot in the Outer Rim.'] },
      { kind: 'villager', id: 'camie', at: [-26, 324], still: true, face: 1.2, name: 'Camie', named: true, quest: 'canyonrun', says: ['Biggs did the canyon in under thirty seconds. Bet you can’t.', 'Wormie’s always talking about Beggar’s Canyon.'] },
      { kind: 'villager', n: 2, at: TOSCHE, spread: 10, roam: 8, speed: 0.9, name: 'Anchorhead local', says: ['Did you hear? There was a big battle up there. Rebels, they say.', 'Power converters? Fixer’s got a crate of them somewhere.'] },
      { kind: 'farmer', id: 'hand', at: [-330, 196], roam: 4, speed: 0.6, name: 'A farmhand', quest: 'kraytcall', says: ['Those Sand People. They took my droid right off the crawler track.', 'Old Ben says they’re scared of krayt dragons. Who isn’t?'] },
      // at Jabba's gate
      { kind: 'gamorrean', n: 1, at: from(PALACE, [-4.5, 55]), still: true, face: PALACE.yaw, name: 'Gamorrean guard', says: ['(It grunts. It points at the gate. It grunts again.)'] },
      { kind: 'gamorrean', n: 1, at: from(PALACE, [4.5, 55]), still: true, face: PALACE.yaw, name: 'Gamorrean guard', says: ['(Snort.)'] },
    ],
    rides: [
      { kind: 'landspeeder', at: [14, -10], yaw: 2.4 },
      { kind: 'landspeeder', at: [-4, 314], yaw: 1.2 },
      { kind: 'landspeeder', at: [452, 132], yaw: 2.8 },
      { kind: 'bantha', at: [-390, 270], yaw: 0.4 },
    ],

    // ── Places you go into ──
    zones: [
      {
        id: 'cantina',
        name: 'the cantina',
        music: 'cantina',
        door: { at: from(CANTINA, [2.5, 9.9]), r: 2.6, prompt: 'Go into the cantina' },
        back: from(CANTINA, [2.5, 12.5]),
        inside: {
          build: 'cantinainside',
          spawn: [0, 14.6],
          yaw: PI,
          exit: { at: [0, 16], r: 1.5 },
          bounds: [11.5, 17, 6.6],
          rooms: [[0, 13.6, 1.6, 3.1, 0, 3.2], [0, 0, 11, 11, 0, 6.6, 'round']],
          light: { sky: '#a4805a', ground: '#2a1e16', ambient: 0.65, fog: '#1a120c', density: 0.018 },
          lamps: [[0, 3.6, -1, '#ffb070', 34, 16], [0, 3.0, -8.2, '#7d9cff', 22, 10], [-7, 2.6, 3, '#ff9a50', 16, 12], [7, 2.6, 3, '#ff9a50', 16, 12]],
        },
        // the bar (props/inside.js's: its counter 3.4 m round [0, −1]): a drink
        // stood at it, between the stools, facing in
        wants: [{ id: 'cantinabar', kind: 'food', at: [0, -1], slots: 5, spots: [[1.96, 2.43], [3.95, -1], [1.96, -4.43], [-3.95, -1], [-1.96, -4.43]], clip: 'drink', pause: 10 }],
        life: [
          { kind: 'wuher', id: 'wuher', at: [0, 0.8], still: true, face: 0, name: 'Wuher', named: true, says: ['We don’t serve their kind here!', 'Your droids. They’ll have to wait outside.', '(He slides a glass of something blue down the bar.)', 'No blasters. No trouble.'] },
          { kind: 'bith', id: 'figrin', at: [-2, -9.3], still: true, face: 0, name: 'Figrin D’an', named: true, says: ['(He doesn’t stop playing. He does raise an eyebrow, if a Bith has eyebrows.)', '(A long, wailing note on his kloo horn, just for you.)'] },
          { kind: 'bith', at: [-1, -9.3], still: true, face: 0, name: 'One of the Modal Nodes', says: ['(The band plays on. Same song as the last six.)'] },
          { kind: 'bith', at: [0, -9.3], still: true, face: 0, name: 'One of the Modal Nodes', says: ['(It nods along, eyes closed.)'] },
          { kind: 'bith', at: [1, -9.3], still: true, face: 0, name: 'One of the Modal Nodes', says: ['(It doesn’t miss a beat.)'] },
          { kind: 'bith', at: [2.1, -9.1], still: true, face: -0.2, name: 'The drummer', says: ['(Ba-dum.)'] },
          { kind: 'greedo', id: 'greedo', ...booth(-1.65), still: true, sit: true, name: 'Greedo', named: true, quest: 'greedo', says: ['(He watches you over his drink, one hand under the table.)'] },
          { kind: 'kenobi', id: 'ben', ...booth(1.65), still: true, name: 'Ben Kenobi', named: true, quest: 'charter', says: ['These aren’t the droids you’re looking for.', 'You will never find a more wretched hive of scum and villainy. We must be cautious.'] },
          { kind: 'aqualish', at: [-3.4, 2.8], still: true, face: 2.4, name: 'Ponda Baba', named: true, says: ['(Huttese, snarling) He doesn’t like you.', 'I don’t like you either.'] },
          { kind: 'villager', at: [-2.4, 3.6], still: true, face: 2.8, name: 'Dr. Evazan', named: true, says: ['You just watch yourself. We’re wanted men. I have the death sentence on twelve systems.'] },
          { kind: 'twilek', n: 2, at: [4.5, 4], spread: 2, roam: 2.5, speed: 0.5, needs: ['food'], name: 'Twi’lek spacer', says: ['Looking for a ship? Try Docking Bay 94.', 'Keep your hand off your blaster in here.'] },
          { kind: 'villager', ...booth(2.25), still: true, name: 'A smuggler', says: ['(He doesn’t look up from his cards.)'] },
          { kind: 'aqualish', ...booth(-2.25), still: true, sit: true, name: 'A bounty hunter', says: ['(It looks you up and down, and decides you aren’t worth it. Yet.)'] },
          { kind: 'jawa', n: 2, at: [-4, 7], spread: 1.5, roam: 2, speed: 0.6, name: 'Jawa', says: ['Utinni!'] },
        ],
      },
      {
        id: 'palace',
        name: 'Jabba’s palace',
        music: 'palace',
        door: { at: from(PALACE, [0, 28.5]), r: 3.4, prompt: 'Knock on the gate' },
        back: from(PALACE, [0, 33]),
        inside: {
          build: 'palaceinside',
          spawn: [0, 27.5],
          yaw: PI,
          exit: { at: [0, 29.4], r: 1.8 },
          bounds: [11.5, 31, 7],
          rooms: [[0, 23, 2.2, 7.2, 0, 5.5], [0, 3, 11, 13.2, 0, 7], [0, -3, 7.2, 8.2, -6, -0.4], [0, -12.9, 2.4, 1.6, -6, -2]],
          light: { sky: '#8a6a50', ground: '#201812', ambient: 0.55, fog: '#120c08', density: 0.022 },
          lamps: [[0, 4.5, 22, '#ff9a3a', 14, 12], [0, 5.5, 5, '#ffa050', 40, 22], [0, 3.4, -6, '#ff7a3a', 22, 10], [0, -1.6, -3, '#a8c070', 26, 14]],
        },
        life: [
          { kind: 'hutt', id: 'jabba', at: [0, -7.4], still: true, face: 0, scale: 1.25, reach: 6.5, solid: false, name: 'Jabba the Hutt', named: true, says: ['(Huttese) Bo shuda! (He laughs, deep and wet, and waves you off.)', '(He takes a frog from a bowl and swallows it whole, watching you.)', '(Huttese) Han ma bookie, keel-ee calleya ku kah.'] },
          { kind: 'bibfortuna', id: 'bib', at: [2, 12.5], still: true, face: 0, name: 'Bib Fortuna', named: true, quest: 'jabba', says: ['De wanna wanga.', 'Jabba is… busy.'] },
          { kind: 'c3po', at: [2.8, -4.8], still: true, face: -0.3, name: 'C-3PO', named: true, says: ['Oh, I don’t think His Excellency is going to like this at all.', 'I am C-3PO, human-cyborg relations. I seem to have been… given as a gift.', 'The Mighty Jabba asks that you keep your distance from the floor in front of the throne.'] },
          { kind: 'bobafett', id: 'boba', at: [-7.2, -2.4], still: true, face: 0.9, name: 'Boba Fett', named: true, quest: 'bounty', says: ['(He says nothing. The visor turns to follow you.)', 'He’s no good to me dead.'] },
          { kind: 'gamorrean', at: [-1.6, 21], still: true, face: PI / 2, name: 'Gamorrean guard', says: ['(It grunts, and hefts its axe.)'] },
          { kind: 'gamorrean', at: [1.6, 25], still: true, face: -PI / 2, name: 'Gamorrean guard', says: ['(Snort.)'] },
          { kind: 'gamorrean', at: [-4.6, -5.4], still: true, face: 0, name: 'Gamorrean guard', says: ['(It watches the trapdoor, and grins.)'] },
          { kind: 'gamorrean', at: [4.6, -5.4], still: true, face: 0, name: 'Gamorrean guard', says: ['(Grunt.)'] },
          // (off duty, sat on the floor by the wall: the game's own guard, on its own rig, lib/three/walrusSets/fauna.js)
          { kind: 'gamorreanguard', at: [-8.6, 14], roam: 0, speed: 0, face: PI / 2, name: 'Gamorrean guard', says: ['(It grunts, and doesn’t get up.)'] },
          { kind: 'bith', at: [8, 3.1], still: true, face: 0, name: 'The organist', says: ['(A slow, greasy riff. Jabba likes it slow.)'] },
          { kind: 'twilek', n: 2, at: [6, 8.5], spread: 1.5, roam: 2, speed: 0.6, name: 'Twi’lek dancer', says: ['(She glances at the trapdoor, and keeps well clear of it.)'] },
          { kind: 'jawa', n: 2, at: [-5, 10], spread: 2, roam: 3, speed: 0.8, name: 'Jawa', says: ['Utinni!'] },
          { kind: 'aqualish', at: [-4, 6], still: true, face: 2.2, name: 'A courtier', says: ['If he laughs, you’re fine. Mostly.'] },
          { kind: 'farmer', id: 'malakili', at: [2.5, 3.6], level: -6, hidden: true, still: true, face: PI, name: 'Malakili', named: true, says: ['(He’s weeping. That rancor was the closest thing he had to family.)'] },
        ],
      },
    ],

    // ── Things to do ──
    quests: [
      {
        id: 'greedo',
        name: 'Shoot first',
        giver: 'greedo',
        achievement: 'shotfirst',
        about: 'A Rodian bounty hunter with a grudge, and his blaster under the table.',
        intro: {
          all: [['Greedo', 'Going somewhere? Jabba’s through with you. He has no time for smugglers who drop their shipments at the first sign of an Imperial cruiser.'], ['Greedo', 'This is the end for you. I’ve been looking forward to this for a long time.']],
          falcon: [['han', 'Yes, I’ll bet you have.']],
        },
        steps: [
          {
            type: 'shoot',
            zone: 'cantina',
            tag: 'greedo',
            n: 1,
            time: 6,
            text: 'Shoot first',
            start: [{ hide: 'greedo' }],
            spawn: { kind: 'greedo', ...booth(-1.65), still: true, hp: 1, tag: 'greedo', hostile: { range: 14, every: 2.6, spread: 0.03, damage: 30, delay: 2.4 } },
          },
        ],
        done: { all: [[null, '(You flip a coin onto the bar.) Sorry about the mess.']], falcon: [['han', 'Sorry about the mess.']] },
      },
      {
        id: 'charter',
        name: 'A fast ship',
        giver: 'ben',
        achievement: 'docking94',
        about: 'An old man and a farm boy, two droids, and the Empire right behind them.',
        intro: {
          all: [['Ben Kenobi', 'I need passage to Alderaan: for myself, the boy and two droids. No questions asked.'], ['Ben Kenobi', 'The Imperials are already searching the docking bays. If you have a ship, now would be the time.']],
          falcon: [['han', 'No questions? What is it, some kind of local trouble?'], ['Ben Kenobi', 'Let’s just say we’d like to avoid any Imperial entanglements.']],
        },
        steps: [
          { type: 'reach', at: BAY.at, r: 10, text: 'Get to Docking Bay 94' },
          {
            type: 'shoot',
            tag: 'bay',
            n: 5,
            text: 'Hold off the stormtroopers',
            lines: [['Stormtrooper', 'Stop that ship! Blast ’em!']],
            spawn: { kind: 'stormtrooper', n: 5, at: from(BAY, [0, 19]), spread: 4, roam: 3, hp: 2, tag: 'bay', hostile: { range: 40, every: 2.6, spread: 0.05, damage: 6, burst: { n: 2, gap: 0.14 } } },
          },
        ],
        done: { all: [['Ben Kenobi', 'You’ve done well. Now: Alderaan. Quickly.']], falcon: [['han', 'Chewie, get us outta here!']] },
      },
      {
        id: 'jabba',
        name: 'An audience with Jabba',
        giver: 'bib',
        achievement: 'rancor',
        about: 'Bib Fortuna will take you to see the Mighty Jabba. Mind where you stand.',
        intro: [['Bib Fortuna', 'Die wanna wanga! … Jabba will see you. Approach the Mighty Jabba. Slowly.']],
        steps: [
          { type: 'reach', zone: 'palace', at: [0, -1.4], r: 1.8, text: 'Go before Jabba the Hutt' },
          {
            type: 'talk',
            zone: 'palace',
            actor: 'jabba',
            text: 'Speak to Jabba',
            lines: [['C-3PO', 'The Mighty Jabba asks why you have come before him… unannounced.']],
            end: [{ to: [0, -2] }, { sound: 'laugh' }, { signal: 'trapdoor' }, { floor: 'trapdoor', off: true }, { shake: 0.4 }],
          },
          {
            type: 'use',
            zone: 'palace',
            id: 'gate',
            at: [-6.4, -8.5],
            level: -6,
            r: 1.9,
            prompt: 'Hit the gate control',
            text: 'Survive the rancor: bring its gate down on it',
            lines: [[null, '(The grate drops away under you. Down in the dark, behind a gate, something enormous stirs.)'], ['C-3PO', 'Oh no. The rancor!']],
            spawn: { kind: 'rancor', at: [0, -9], tag: 'rancor', hp: 999, leash: 15, roam: 3, speed: 1, hostile: { range: 40, chase: 2.7, melee: true, reach: 3.4, every: 1.5, damage: 34, delay: 1.5 } },
            respawn: [5, 3],
            end: [{ signal: 'gate' }, { sound: 'crash' }, { kill: 'rancor' }, { shake: 1 }, { show: 'malakili' }],
          },
          {
            type: 'reach',
            zone: 'palace',
            at: [0, 4.4],
            level: -6,
            r: 1.7,
            text: 'Out through the keeper’s door',
            lines: [['Malakili', '(The rancor’s keeper pushes past you to the gate, weeping.)']],
            end: [{ leave: true }, { floor: 'trapdoor', off: false }, { signal: 'trapdoor', on: false }, { signal: 'gate', on: false }, { hide: 'malakili' }],
          },
        ],
        done: [[null, '(Jabba’s guards drag you up and throw you out of the gate. Behind it, the Hutt is laughing: nobody’s ever killed his rancor and lived to be thrown out before.)']],
      },
      {
        id: 'bounty',
        name: 'Jabba pays',
        giver: 'boba',
        achievement: 'bounty',
        about: 'Boba Fett has a bounty on a Tusken war band. He’d rather you did the walking.',
        intro: [['Boba Fett', 'Jabba has a price on the Tusken band raiding the Dune Sea caravans. Their camp’s in the west. You want the credits, you do the work.']],
        steps: [
          { type: 'reach', at: [-420, 250], r: 34, text: 'Find the Tusken camp' },
          {
            type: 'shoot',
            tag: 'tuskens',
            n: 5,
            text: 'Drive off the Tusken raiders',
            lines: [[null, '(A howl goes up from the rocks, and cycler rifles start to crack.)']],
            start: [{ hide: 'tuskencamp' }],
            spawn: { kind: 'tusken', n: 5, at: [-420, 250], spread: 16, roam: 8, hp: 2, tag: 'tuskens', hostile: { range: 45, every: 2.6, spread: 0.06, damage: 9, chase: 1.6, delay: 1 } },
          },
          { type: 'talk', zone: 'palace', actor: 'boba', text: 'Collect from Boba Fett' },
        ],
        done: [['Boba Fett', 'Jabba pays.'], [null, '(He flips you a credit chip. It’s less than you’d hoped. It’s more than you expected.)']],
      },
      {
        id: 'womprats',
        name: 'Womp rats',
        giver: 'biggs',
        achievement: 'womprats',
        about: 'The womp rats in Beggar’s Canyon are back, chewing through every power line out there.',
        intro: {
          all: [['Biggs Darklighter', 'Remember bullseyeing womp rats in Beggar’s Canyon? They’re back. Big ones. Clear them out and I’ll owe you one.']],
          xwing: [['luke', 'I used to bullseye womp rats in my T-16 back home. They’re not much bigger than two metres.']],
        },
        steps: [
          { type: 'reach', at: CANYON[0], r: 16, text: 'Get to Beggar’s Canyon' },
          {
            type: 'shoot',
            tag: 'womprat',
            n: 8,
            text: 'Bullseye womp rats in the canyon',
            spawn: CANYON.slice(1, 5).map((at) => ({ kind: 'womprat', n: 2, at, spread: 5, roam: 6, speed: 2.6, scale: 2.4, hp: 1, tag: 'womprat' })),
          },
          { type: 'talk', actor: 'biggs', text: 'Tell Biggs at Tosche Station' },
        ],
        done: [['Biggs Darklighter', 'Not bad! Still the best shot this side of Anchorhead.']],
      },
      {
        id: 'canyonrun',
        name: 'The canyon run',
        giver: 'camie',
        achievement: 'canyon',
        about: 'Camie bets you can’t run Beggar’s Canyon in a landspeeder as fast as Biggs did.',
        intro: [['Camie', 'Biggs ran the canyon in under thirty seconds. In a landspeeder. Bet you can’t.']],
        steps: [
          { type: 'ride', kind: 'landspeeder', text: 'Get in a landspeeder' },
          { type: 'reach', at: [470, 128], r: 16, text: 'Ride to the mouth of Beggar’s Canyon' },
          { type: 'race', ride: 'landspeeder', gates: CANYON, r: 11, time: 32, text: 'Run Beggar’s Canyon', lines: [[null, 'Through every gate, round the Stone Needle, out the far end. Go!']] },
        ],
        done: [['Camie', '(over the comlink) You did WHAT? In under thirty? …Biggs is going to hate this.']],
      },
      {
        id: 'converters',
        name: 'Power converters',
        giver: 'owen',
        achievement: 'tosche',
        about: 'Owen Lars needs new power converters for his vaporators, from Tosche Station.',
        intro: {
          all: [['Owen Lars', 'Go to Tosche Station and pick up those power converters. And come straight back.']],
          xwing: [['luke', 'But I was going into Tosche Station to pick up some power converters anyway!']],
        },
        steps: [
          { type: 'collect', item: 'converter', n: 3, spots: [[-30, 322], [-8, 342], [-12, 318]], text: 'Pick up power converters at Tosche Station' },
          { type: 'use', id: 'fit', at: [-154, 144], r: 3, prompt: 'Fit the power converters', text: 'Fit them to the homestead’s vaporator' },
        ],
        done: [['Owen Lars', 'Good. Now the south ridge needs going over, and the condensers on the east side. Then you can go.']],
      },
      {
        id: 'kraytcall',
        name: 'The krayt dragon’s call',
        giver: 'hand',
        about: 'Tuskens took a farmhand’s droid. Sand People are easily startled, and there’s one thing they’re afraid of.',
        intro: [['A farmhand', 'They took my droid to their camp. Old Ben scared a whole band off once: he howled like a krayt dragon.']],
        steps: [
          { type: 'reach', at: [-372, 214], r: 8, text: 'Get up on the ridge over the Tusken camp' },
          { type: 'use', id: 'howl', at: [-372, 214], r: 6, prompt: 'Howl like a krayt dragon', text: 'Scare them off', end: [{ sound: 'roar' }, { hide: 'tuskencamp' }, { say: [[null, '(Your howl rolls off the rocks like a krayt dragon’s. Down in the camp, the Tuskens scatter into the dunes.)']] }] },
          { type: 'collect', item: 'droid', n: 1, spots: [[-414, 246]], text: 'Get the droid back' },
          { type: 'talk', actor: 'hand', text: 'Take it back to the farmhand' },
        ],
        done: [['A farmhand', 'You did it! It’s a bit sandy, but it beeps. Thank you!']],
      },
    ],
    flyovers: [
      { kind: 'tie', n: 2, metres: 7, alt: 90, speed: 110, every: 55 },
      { kind: 'xwing', n: 1, metres: 12.5, alt: 70, speed: 100, every: 90 },
      { kind: 'freighter', n: 1, metres: 40, alt: 160, speed: 45, every: 80 },
    ],
    skyships: [{ kind: 'destroyer', metres: 1600, at: [900, 2600, 3800], yaw: -2.2 }],
  },
};
