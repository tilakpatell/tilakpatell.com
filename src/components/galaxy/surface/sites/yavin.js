// Yavin 4, from the ground: the Great Temple and its hangar, the landing
// field, the lookout tower, a lesser temple in the jungle and the river.
// (sites/index.js has what a site is; forest.js has the other forest
// worlds.)

export const SITE = {
  // lit as the game lights its level (src/data/bf2017/light/yavin.json, gameLit.js)
  gameLight: 'yavin',
  // the look (look.js): green-grey shade under the canopy, a warm halo
  // through it; the grass on the ground map (groundPaint.js), thin under
  // the trees' crowns and thick in the clearings
  look: { shadow: '#3a4a3a', edge: [0.18, 0.85], halo: '#fff0c0' },
  grass: { h: [0.18, 0.5], w: 0.05, cover: 0.55, wind: 0.5, scale: 70, root: '#2e3a22', mid: '#4a5a30', tip: '#7a8a46', dry: '#8a8450' },
  place: 'The jungle of Yavin 4',
  line: 'Steaming jungle, ancient temples, and a gas giant filling half the sky.',
  sky: {
    zenith: '#5b8ec2',
    horizon: '#d2dac6',
    haze: 0.85,
    hazeColor: '#dfe4d2',
    suns: [{ az: -0.5, el: 0.62, color: '#fff2da', size: 0.015, glow: 1.1 }],
    clouds: { cover: 0.3, color: '#ffffff', shade: '#c4ccc4', scale: 0.6, speed: 0.004 },
    bodies: [
      // Yavin, the gas giant, rising behind the Great Temple
      { az: 3.0, el: 0.36, size: 0.3, color: '#d8763e', color2: '#f2d2a6', bands: 10, twist: 1.4 },
      { az: 2.3, el: 0.7, size: 0.012, color: '#d0ccc0' },
    ],
  },
  fog: { color: '#b8c8b0', density: 0.0022 },
  light: { sun: 3.0, sky: '#c8daea', ground: '#4a4028', ambient: 0.8 },
  water: { level: -3, color: '#5a7a5a', deep: '#22382a', kind: 'swamp', waves: 1.2 },
  dust: '#8a8a60',
  edge: 'The jungle closes in. Somewhere out there are temples nobody has seen in four thousand years.',
  ground: { detail: 'leaves', detailLook: { color: 0.8, normal: 0.7 },
    seed: 14,
    wind: 0.8,
    base: 0,
    layers: [
      { type: 'swell', scale: 380, height: 8 },
      { type: 'hills', scale: 140, height: 10 },
      { type: 'channels', scale: 700, depth: 12, width: 0.05 },
      { type: 'mountains', from: 1000, to: 3400, height: 300, scale: 1100 },
    ],
    palette: {
      // (the jungle floor as filmed: dark soil, leaf litter, moss)
      low: '#4a3a26',
      high: '#3a4228',
      rock: '#6a6450',
      accent: '#6e5644',
      deep: '#2b220e',
      hLow: -2,
      hHigh: 12,
      rockAt: 0.5,
      accentCover: 0.3,
      grain: 0.85,
      wet: { level: -3, band: 1.2, color: '#3a3a26' },
    },
  },
  weather: [{ kind: 'motes', count: 500, color: '#f0f8c0' }],
  land: { at: [0, 0], yaw: 3.0 },
  lines: {
    out: {
      xwing: [['luke', 'Yavin 4. Home, for a while. Artoo, remember the medals?'], ['r2', '(A proud, happy whistle.)']],
      falcon: [['han', 'Back where it all started. I almost didn’t come back for the kid, you know.'], ['chewie', '(A knowing, sarcastic growl.)']],
      cruiser: [['morty', 'Rick, there’s a giant orange planet in the sky!'], ['rick', 'Gas giant, Morty. We’re on its moon. Basic orbital stuff.']],
      rv: [['jesse', 'Yo, it’s hot as balls out here. Like Florida, but in space.'], ['walt', 'Humidity like this ruins equipment, Jesse.']],
    },
  },
  places: [
    {
      id: 'temple',
      name: 'The Great Temple',
      at: [0, -240],
      r: 92,
      flat: { r: 74, h: 9 }, // (the hangar's floor at 9: its life stands on it, under the temple's roof)
      about: 'The Great Temple of Massassi, raised for the Sith thousands of years ago and overgrown ever since: the Rebel Alliance’s base, its hangar at the foot, its war room deep inside.',
      lines: {
        xwing: [['luke', 'The Massassi temple. Every fighter we had took off from in there.'], ['r2', '(An excited, nostalgic burble.)']],
        falcon: [['han', 'I dropped the kid off here and left with the reward. Then I came back. Don’t tell anybody.'], ['chewie', '(A teasing rumble.)']],
        cruiser: [['morty', 'It’s like a Mayan pyramid, but in space!'], ['rick', 'Every civilisation builds the same stairs, Morty. Lack of imagination.']],
        rv: [['walt', 'A secret base inside a thousand-year-old temple. Clever.'], ['jesse', 'Yo, I bet there’s like, booby traps.']],
      },
      things: [
        { kind: 'massassi', at: [0, 0], yaw: 0 },
        { kind: 'massassiplugs', at: [0, 0], yaw: 0 },
        { kind: 'lamp', at: [-14, 49], opts: { h: 5, light: '#ffe0a0' } },
        { kind: 'lamp', at: [14, 49], opts: { h: 5, light: '#ffe0a0' } },
      ],
    },
    {
      id: 'hangar',
      name: 'The hangar',
      at: [0, -218],
      r: 16,
      about: 'Under the temple, where Red and Gold squadrons waited for the Death Star to come round Yavin: X-wings, Y-wings, fuel lines, astromechs being loaded aboard. Thirty went up; three came home.',
      lines: {
        xwing: [['luke', 'This is where Biggs and I took off together. He didn’t come back.'], ['r2', '(A long, low, sad note.)']],
        falcon: [['han', 'They’re gonna need more than luck, Chewie. Come on, we’ve got our reward.'], ['chewie', '(An angry, disappointed growl.)']],
        cruiser: [['rick', 'One-man fighters versus a planet-killer. Bold strategy, Morty.'], ['morty', 'It worked though, didn’t it?']],
      },
      things: [
        // (the temple model's tunnel is x ±10.4, from its back wall at -10.5
        // out to the mouth at 26: the X-wings one behind the other on the
        // right, the Y-wing down the left)
        { kind: 'hangarfloor', at: [0, 0], y: 0.57, solid: false }, // (just over the temple model's own floor)
        { kind: 'parked', at: [4.8, -1], y: 0.55, yaw: 0.05, opts: { kind: 'xwing', metres: 12.5 } },
        { kind: 'parked', at: [4.8, 13], y: 0.55, yaw: -0.05, opts: { kind: 'xwing', metres: 12.5 } },
        { kind: 'ywing', at: [-6, 11], y: 0.55, yaw: 0.02 },
        { kind: 'yavinramp', at: [8.6, -3], y: 0.55, yaw: 0 },
        { kind: 'crates', at: [-7, 23.5], y: 0.55 },
        { kind: 'ammocan', at: [-4.4, 23.8], y: 0.55, yaw: 0.3 },
        { kind: 'ammocan', at: [-4.6, 22.8], y: 0.55, yaw: 0.2 },
        { kind: 'ammocan', at: [8.6, 4.8], y: 0.55, yaw: 1.4 },
        { kind: 'welderrack', at: [8.4, 21.5], y: 0.55, yaw: -2.4 },
        { kind: 'yavinspeeder', at: [-6.4, -7.2], y: 0.55, yaw: 1.4 },
      ],
    },
    {
      id: 'summit',
      name: 'The temple summit',
      at: [0, -251],
      r: 6,
      about: 'The top of the Great Temple, high over the canopy, where Rebel lookouts watched the sky for the Death Star. On a clear day, the jungle goes on forever, and Yavin fills the horizon.',
      lines: {
        xwing: [['luke', 'You can see the whole jungle from up here. And Yavin, like it’s right on top of us.']],
        falcon: [['han', 'Nice view. Shame about the stairs.'], ['chewie', '(Panting.)']],
        cruiser: [['morty', 'W-we climbed all of those, Rick?'], ['rick', 'Cardio, Morty. Even in a galaxy far, far away.']],
        rv: [['jesse', 'This is the best view I’ve ever seen, yo.'], ['walt', 'Catch your breath, Jesse.']],
      },
    },
    {
      id: 'field',
      name: 'The landing field',
      at: [0, -112],
      r: 36,
      flat: { r: 32 },
      about: 'The clearing in front of the temple, where the Falcon set down with the stolen plans, and where Rogue One’s U-wing left for Scarif without orders.',
      lines: {
        xwing: [['luke', 'The Falcon landed right here, with the princess and the plans.']],
        falcon: [['han', 'Set her down right here. Easiest money I ever almost made.'], ['chewie', '(A rumble about the money.)']],
        rv: [['jesse', 'A U-wing. Rogue One, yo. They didn’t come back either.'], ['walt', 'Some jobs you don’t come back from, Jesse.']],
      },
      things: [
        { kind: 'parked', at: [-14, 2], yaw: 0.6, opts: { kind: 'uwing', metres: 24, lift: 1.4 } },
        { kind: 'crates', at: [10, -8] },
        { kind: 'crates', at: [16, 6] },
        { kind: 'crates', at: [-4, 18] },
        { kind: 'lamp', at: [6, 14], opts: { h: 5, light: '#ffe0a0' } },
      ],
    },
    {
      id: 'lookout',
      name: 'The lookout tower',
      at: [-200, -120],
      r: 18,
      flat: { r: 10 },
      about: 'A steel tower up through the canopy, where a Rebel sentry watched the sky. He saw the Millennium Falcon coming in over the trees, with a princess and the Death Star plans aboard.',
      lines: {
        xwing: [['luke', 'The sentry up there spotted us coming in with the plans.'], ['r2', '(A cheerful whistle up at him.)']],
        falcon: [['han', 'Bet he was glad to see us. Everybody usually is.'], ['chewie', '(A doubtful huff.)']],
        cruiser: [['rick', 'One guy, a tower and a pair of binoculars. That’s the whole early-warning system, Morty.']],
      },
      things: [{ kind: 'lookout', at: [0, 0], yaw: 0.4 }],
    },
    {
      id: 'ruin',
      name: 'A lesser temple',
      at: [260, 170],
      r: 40,
      flat: { r: 28 },
      about: 'One of the Massassi’s smaller temples, swallowed by the jungle: the Sith’s slaves built dozens across Yavin 4, and the forest has taken most of them back.',
      lines: {
        xwing: [['luke', 'There are temples all over this moon. Nobody knows how many.']],
        falcon: [['han', 'Creepy. Let’s not go in.'], ['chewie', '(A nervous, agreeing whine.)']],
        cruiser: [['morty', 'Rick, should we go inside?'], ['rick', 'Sith temple, Morty. Ancient evil. Bad vibes. Absolutely not.']],
        rv: [['jesse', 'Indiana Jones, yo.'], ['walt', 'Don’t touch anything, Jesse.']],
      },
      // (the Great Temple's model drawn small, its crossed tunnels plugged
      // dark; the built ruin if the model doesn't load)
      things: [
        { kind: 'ruin', url: '/models/galaxy/surface/massassi.glb', metres: 34, at: [0, 0], yaw: 0.6, solid: { box: [15, 15] } },
        { kind: 'ruin', at: [0, 0], yaw: 0.6, opts: { core: true }, solid: false },
        { kind: 'jungletree', at: [19, -6], scale: 1.1, opts: { seed: 5, leaf: '#3c4a22' } },
        { kind: 'jungletree', at: [-12, 16], scale: 0.9, opts: { seed: 6, leaf: '#46522a' } },
      ],
    },
    {
      id: 'river',
      name: 'The river',
      at: [-290, -280],
      r: 28,
      about: 'A slow green river winding through the jungle past the temples. The Rebels drew their water from it, and kept an eye on whatever else came down to drink.',
      lines: {
        xwing: [['luke', 'More water here than on all of Tatooine.'], ['r2', '(A nervous beep: he remembers Dagobah.)']],
        falcon: [['han', 'Don’t drink that, Chewie.'], ['chewie', '(A defiant slurp.)']],
        rv: [['jesse', 'Yo, there could be alligators in there. Space alligators.'], ['walt', 'Then stay out of the water, Jesse.']],
      },
      things: [
        { kind: 'log', at: [6, 10], yaw: 1.2, opts: { len: 11, r: 0.8, bark: '#6a6250', moss: '#4e6a2c' } },
        { kind: 'log', at: [-10, -6], yaw: -0.4, opts: { len: 7, r: 0.6, bark: '#6a6250', moss: '#4e6a2c' } },
      ],
    },
  ],
  things: [
    // where you set down: Gold Squadron's dispersal on the field's edge, a
    // Y-wing under its ramp, the ground crew's gear
    { kind: 'ywing', at: [28, -22], yaw: 2.7 },
    { kind: 'yavinramp', at: [20, -14], yaw: 2.7 },
    { kind: 'ammocan', at: [12, -6], yaw: 0.3 },
    { kind: 'ammocan', at: [13.1, -5.4], yaw: 1.1 },
    { kind: 'cratecube', at: [-14, -10], yaw: 0.6 },
    { kind: 'barrel', at: [-12.6, -8.4], yaw: 0.2 },
    { kind: 'welderrack', at: [-10, -14], yaw: 2.2 },
    { kind: 'lamp', at: [-16, -2], opts: { h: 5, light: '#ffe0a0' } },
    { kind: 'lamp', at: [16, -30], opts: { h: 5, light: '#ffe0a0' } },
  ],
  scatter: [
    // (Quaternius's ground cover, under the built plants: catalog/quaternius.js)
    { kind: 'qfern', n: 80, within: [8, 120], scale: [0.8, 1.5], solid: false },
    { kind: 'qclover', n: 120, within: [4, 80], scale: [0.8, 1.6], solid: false },
    // the tall trees, vines hanging from them, then the built ones between
    // (the jungle's own trees close in all round, their umbrella crowns a
    // roof overhead, as the film's are: built here, in the world's own
    // light, where the photographed yavintree model stood out of it)
    { kind: 'jungletree', n: 330, within: [22, 640], scale: [0.8, 1.4], opts: { seed: 1, leaf: '#3c4a22' } },
    { kind: 'jungletree', n: 200, within: [22, 640], scale: [0.7, 1.2], opts: { seed: 2, bark: '#7a7462', leaf: '#46522a', creepers: false } },
    { kind: 'jungletree', n: 180, within: [640, 1400], scale: [1.0, 1.6], solid: false, opts: { seed: 3, lo: true, leaf: '#3c4a22' } },
    { kind: 'plant', n: 700, within: [6, 480], scale: [0.8, 2.0], solid: false, clear: -8, opts: { seed: 4, color: '#4a5a30' } },
    { kind: 'fern', n: 400, within: [6, 480], scale: [0.8, 1.7], solid: false, clear: -8, opts: { seed: 5, color: '#4a5230' } },
    // (the undergrowth near you, thick, as the jungle's floor is in the film)
    { kind: 'fern', n: 1200, within: [4, 90], scale: [0.7, 1.6], solid: false, clear: -10, opts: { seed: 15, n: 7, color: '#465030' } },
    { kind: 'plant', n: 500, within: [4, 90], scale: [0.7, 1.6], solid: false, clear: -10, opts: { seed: 16, color: '#50603a' } },
    { kind: 'rock', n: 50, within: [20, 560], scale: [0.6, 2.4], opts: { color: '#6a6656', sharp: 0.4 } },
    { kind: 'log', n: 24, within: [30, 520], scale: [0.9, 1.5], solid: false, opts: { seed: 7, bark: '#6a6250', moss: '#4e6a2c' } },
  ],
  // where the people go (needs.js): the techs between the landing (knelt at
  // a ship's works), the hangar mouth (at its panels) and the field
  wants: [
    { id: 'landing', kind: 'work', at: [8, -6], slots: 2, clip: 'kneel.fix', pause: 8 },
    { id: 'hangarmouth', kind: 'work', at: [0, -196], slots: 2, clip: 'interact', pause: 10 },
    { id: 'field', kind: 'rest', at: [0, -112], pause: 6 },
  ],
  life: [
    { kind: 'rebelpilot', id: 'redleader', at: [7, -195], level: 9, still: true, face: 1.2, name: 'Red Leader', named: true, quest: 'scramble', says: { when: { done: ['scramble'] }, lines: ['Red Leader, standing by. Good run out there.', 'All wings report in.'], else: ['Red Leader, standing by.', 'All wings report in.', 'Lock S-foils in attack position.'] } },
    { kind: 'rebelpilot', n: 1, at: [18, -16], still: true, face: 2.4, name: 'Gold Squadron pilot', says: ['Gold Leader, standing by.', 'Y-wings take the first run at the trench. Keep the fighters off us.'] },
    { kind: 'rebeltech', n: 2, at: [6, -12], spread: 8, roam: 8, speed: 0.9, needs: ['work', 'rest'], name: 'Rebel technician', says: ['Proton torpedoes loaded. Both of them.', 'She’s old, but she flies.', 'Don’t stand under the ramp.'] },
    { kind: 'astromech', n: 1, at: [20, -26], roam: 5, speed: 0.6, name: 'Astromech', says: ['(A low, grumbling whistle: the Y-wing’s deflector is shot again.)'] },
    { kind: 'rebel', n: 6, at: [0, -112], spread: 18, roam: 12, speed: 1.1, name: 'Rebel trooper', says: ['They got the plans out! The princess brought them herself.', 'The Death Star’s coming round the planet. Thirty minutes, they say.', 'Massassi built this place. Who they were, nobody knows.', 'May the Force be with you.'] },
    { kind: 'rebelpilot', n: 4, at: [0, -222], level: 9, spread: 8, roam: 6, speed: 1.0, name: 'X-wing pilot', says: ['Red Five standing by.', 'Look at the size of that thing!', 'Stay on target… stay on target…', 'I used to bullseye womp rats in my T-16 back home. They’re not much bigger than two metres.'] },
    { kind: 'droid', n: 3, at: [0, -216], level: 9, spread: 8, roam: 6, speed: 0.6, name: 'Astromech', says: ['(A brisk, busy whistle.)', '(It plugs into a fuel line and beeps happily.)'] },
    { kind: 'c3po', n: 1, at: [0, -225.5], level: 9, still: true, face: 3.4, name: 'C-3PO', says: { when: { done: ['scramble'] }, lines: ['Oh, I do hope Artoo comes back in one piece.', 'You wouldn’t want my life to get boring, would you?'], else: ['Hang on tight, Artoo. You’ve got to come back.', 'You wouldn’t want my life to get boring, would you?', 'Oh, I do hope they know what they’re doing.'] } },
    { kind: 'rebel', n: 1, at: [-200, -120], still: true, face: 0.3, name: 'Rebel sentry', says: { when: { rank: 2 }, lines: ['(He straightens up.) Sir. All quiet up here. Just the jungle, and Yavin.', '(He lowers his macrobinoculars.) Ship coming in. It’s the Falcon!'], else: ['(He lowers his macrobinoculars.) Ship coming in. It’s the Falcon!', 'All quiet up here. Just the jungle, and Yavin.'] } },
    { kind: 'rebel', n: 2, at: [-284, -270], spread: 6, roam: 6, speed: 0.9, group: true, name: 'Rebel scout', says: ['Fresh water, and plenty of it. Just don’t go in past your knees.', 'Something big came down to drink last night. We didn’t stay to find out what.'] },
    { kind: 'rebel', n: 2, path: [[-30, -190], [30, -190], [30, -186], [-30, -186]], speed: 1.1, name: 'Rebel guard', says: ['Halt. Who goes there? …Oh, it’s you. Go on in.', 'Keep an eye on the sky.'] },
  ],
  rides: [],

  // ── The places you go into ──
  zones: [
    {
      id: 'warroom',
      name: 'the war room',
      door: { at: [-4, -227.6], r: 3, prompt: 'Go down to the war room' },
      back: [-4, -226],
      inside: {
        build: 'warroom',
        spawn: [0, 8.2],
        yaw: Math.PI,
        exit: { at: [0, 9.4], r: 1.6 },
        bounds: [14, 10, 6],
        rooms: [[0, 0, 14, 10, 0, 6]],
        light: { sky: '#8aa0c8', ground: '#3a3630', ambient: 0.6, fog: '#161a20', density: 0.016 },
        lamps: [[1, 4.5, -6.5, '#5ad0ff', 30, 14], [-7, 5, 2, '#ffe0a0', 26, 14], [7, 5, 2, '#ffe0a0', 26, 14], [0, 5, 8, '#ffe0a0', 18, 10]],
      },
      life: [
        { kind: 'rebel', id: 'dodonna', at: [-4, -6.6], still: true, face: 0, name: 'General Dodonna', named: true, quest: ['briefing', 'remotes'], says: { when: { done: ['briefing'] }, lines: ['The battle station will be in range in thirty minutes.', 'Man your ships. And may the Force be with you.'], else: ['The battle station is heavily shielded and carries a firepower greater than half the star fleet.', 'Its defences are designed around a direct, large-scale assault. A small one-man fighter should be able to penetrate the outer defence.', 'The battle station will be in range in thirty minutes.'] } },
        { kind: 'rebelpilot', id: 'goldleader', at: [-3, -1], still: true, face: Math.PI, name: 'Gold Leader', named: true, says: ['Pardon me for asking, sir, but what good are snubfighters going to be against that?'] },
        { kind: 'rebelpilot', id: 'wedge', at: [4, 0.6], still: true, face: Math.PI, name: 'Wedge Antilles', named: true, says: { when: { hero: 'luke' }, lines: ['That’s impossible, even for a computer.', 'Look at the size of that thing.'], else: ['Look at the size of that thing.', 'You’re flying with us? Then stay on my wing.'] } },
        { kind: 'rebelpilot', id: 'biggs', at: [6.5, 0.6], still: true, face: Math.PI, name: 'Biggs Darklighter', named: true, says: ['It’s not impossible. I used to bullseye womp rats in my T-16 back home, they’re not much bigger than two metres.', 'Luke! I told you I’d make it someday.'] },
        { kind: 'rebelpilot', n: 8, at: [0, 3.8], spread: 7, still: true, face: Math.PI, name: 'Rebel pilot', says: ['(He listens, and says nothing. Thirty minutes.)', 'Stay on target. That’s all I’m thinking. Stay on target.'] },
        { kind: 'rebel', n: 3, at: [-9, -4], spread: 2, roam: 2, speed: 0.6, name: 'Rebel officer', says: ['The plans are being analysed now.', 'An approach down the trench. A two-metre port. Nobody’s laughing.'] },
        { kind: 'c3po', at: [9, -6], still: true, face: -2.2, name: 'C-3PO', says: ['Oh, Artoo. I do hope they know what they’re doing.'] },
      ],
    },
    {
      id: 'stair',
      name: 'the temple stair',
      door: { at: [4, -227.6], r: 2.6, prompt: 'Climb the inner stair' },
      back: [0, -250],
      inside: {
        build: 'templestair',
        spawn: [0, 10.5],
        yaw: Math.PI,
        exit: { at: [0, -10.5], r: 2 },
        bounds: [6, 12, 16],
        rooms: [[0, 0, 6, 12, 0, 16]],
        light: { sky: '#a89c84', ground: '#2a2620', ambient: 0.55, fog: '#1a1812', density: 0.02 },
        lamps: [[0, 2.6, 11, '#ffe0a0', 20, 10], [0, 9.6, -11, '#ffe0a0', 20, 10], [0, 16.6, -11, '#ffe0a0', 20, 10], [0, 16.6, 11, '#ffe0a0', 20, 10]],
      },
      life: [{ kind: 'rebel', at: [0, 9], still: true, face: 0, name: 'Rebel sentry', says: ['The throne room’s at the top. Mind the steps, they’re four thousand years old.'] }],
    },
    {
      id: 'ceremony',
      name: 'the throne room',
      door: { at: [0, -250], r: 3, prompt: 'Go into the throne room' },
      back: [0, -248],
      inside: {
        build: 'ceremonyhall',
        spawn: [0, 20],
        yaw: Math.PI,
        exit: { at: [0, 21.4], r: 2 },
        bounds: [16, 22, 12],
        rooms: [[0, 0, 16, 22, 0, 12]],
        light: { sky: '#fff4dc', ground: '#6a6050', ambient: 0.85, fog: '#4a4638', density: 0.006 },
        lamps: [[0, 10, -16, '#fff4dc', 60, 30], [0, 10, 0, '#fff4dc', 50, 30], [0, 10, 14, '#ffe0c0', 40, 24], [0, 4, -18, '#ffe8c8', 30, 12]],
      },
      life: [
        { kind: 'villager', id: 'leia', at: [0, -17.4], level: 1.2, still: true, face: 0, name: 'Princess Leia', named: true, quest: 'ceremony', says: { when: { done: ['ceremony'] }, lines: ['(She smiles.) You earned it.', 'You’re all clear, kid. Now let’s blow this thing and go home. That’s what you said, isn’t it?'], else: ['(She holds the medal out, and smiles.)', 'You’re all clear, kid. Now let’s blow this thing and go home. That’s what you said, isn’t it?'] } },
        { kind: 'rebel', id: 'dodonna2', at: [-4, -17.4], level: 1.2, still: true, face: 0.3, name: 'General Dodonna', named: true, says: { when: { rank: 3 }, lines: ['The Rebellion owes you a debt it can never repay, Commander.'], else: ['The Rebellion owes you a debt it can never repay.'] } },
        { kind: 'wookiee', at: [3.5, -14], still: true, face: 0, name: 'Chewbacca', says: ['(A roar that shakes the banners. Everyone cheers louder.)'] },
        { kind: 'c3po', at: [-3.5, -14], still: true, face: 0.4, name: 'C-3PO', says: ['Oh, Artoo, you’ve been fully restored. And polished!'] },
        { kind: 'droid', at: [-2.4, -14], still: true, face: 0, name: 'R2-D2', says: ['(A triumphant whistle.)'] },
      ],
    },
  ],

  // ── Things to do ──
  quests: [
    {
      id: 'briefing',
      name: 'The briefing',
      giver: 'dodonna',
      achievement: 'yavinbriefing',
      about: 'The war room under the hangar. General Dodonna has the plans up on the holotable, and thirty minutes.',
      intro: [['General Dodonna', 'Get everyone to the war room. The plans are up, and the station is coming round the planet.']],
      steps: [
        { type: 'reach', zone: 'warroom', at: [-4, -5], r: 3, text: 'Go to the lectern in the war room' },
        { type: 'talk', actor: 'dodonna', text: 'Take your seat for the briefing' },
        { type: 'use', zone: 'warroom', id: 'brief', at: [1, -4], r: 3.5, prompt: 'Start the briefing', text: 'Start the briefing', end: [{ signal: 'brief' }, { say: [['General Dodonna', 'The approach will not be easy. You are required to manoeuvre straight down this trench and skim the surface to this point. The target area is only two metres wide.'], ['Gold Leader', 'Pardon me for asking, sir, but what good are snubfighters going to be against that?'], ['General Dodonna', 'The Empire doesn’t consider a small one-man fighter to be any threat, or they’d have a tighter defence.']] }] },
      ],
      done: [['Wedge Antilles', 'That’s impossible, even for a computer.'], ['Biggs Darklighter', 'It’s not impossible. I used to bullseye womp rats in my T-16 back home.'], ['General Dodonna', 'Man your ships, and may the Force be with you.']],
    },
    {
      id: 'scramble',
      name: 'Scramble',
      giver: 'redleader',
      achievement: 'yavinscramble',
      about: 'The station is in range in minutes. Through the hangar to your fighter, and up.',
      intro: [['Red Leader', 'Pilots, to your ships. The station clears the planet in thirty minutes. Go!']],
      steps: [
        { type: 'race', gates: [[0, -212], [0, -195], [0, -178], [0, -160], [0, -140]], r: 8, time: 40, text: 'Run the taxi line to your fighter', lines: [['Red Leader', 'Red Five, you’re with me. Move!']] },
        { type: 'reach', at: [0, -130], r: 10, text: 'Lift off', end: [{ say: [['Red Leader', 'Lock S-foils in attack position.']] }, { go: '/deathstar' }] },
      ],
      done: [['Red Leader', 'All wings report in.'], [null, '(Up through the canopy, and the Death Star is coming round Yavin.)']],
    },
    {
      id: 'ceremony',
      name: 'The medal ceremony',
      giver: 'leia',
      after: ['briefing', 'scramble'],
      achievement: 'yavinceremony',
      about: 'The throne room at the summit, the whole Rebellion in rows, and the Princess at the dais.',
      intro: [['Princess Leia', 'Come up. All of you. They want to see you.']],
      steps: [{ type: 'reach', zone: 'ceremony', at: [0, -16], r: 3, text: 'Walk the aisle to the dais' }],
      done: [[null, '(The medal goes round your neck. Chewie roars. The whole Rebellion is cheering, and it doesn’t stop.)']],
    },
    { id: 'remotes', name: 'Blast shield down', giver: 'dodonna', intro: [['General Dodonna', 'Pilots warm up on the remotes by the lookout. Your turn.']], steps: [{ type: 'shoot', tag: 'remote', n: 6, text: 'Hit the training remotes', spawn: { kind: 'remote', n: 6, at: [-200, -120], spread: 8, roam: 6, speed: 2, hp: 1, tag: 'remote' } }, { type: 'reach', at: [0, -251], r: 5, text: 'Climb to the throne room for the ceremony' }], done: [[null, '(The doors open. The whole Rebellion is standing there, and they’re cheering for you.)']] },
  ],
  flyovers: [
    { kind: 'xwing', n: 3, metres: 12.5, alt: 80, speed: 120, every: 45 },
    { kind: 'ywing', n: 2, metres: 16, alt: 90, speed: 100, every: 60 },
    { kind: 'freighter', n: 1, metres: 34, alt: 70, speed: 70, every: 110 },
    { kind: 'uwing', n: 1, metres: 24, alt: 110, speed: 80, every: 100 },
  ],

};
