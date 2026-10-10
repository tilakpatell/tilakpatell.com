// Hoth, from the ground. (sites/index.js has what a site is.)

import { ECHO_BASE, zoneRooms } from './echoLayout';

// a walkers' beat: a loop of points round an ellipse
const loop = ([cx, cz], [rx, rz], n = 10) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.round(cx + Math.cos(a) * rx), Math.round(cz + Math.sin(a) * rz)];
  });

// Echo Base as the site built it (the flight's planet still builds it here;
// on the surface the game's hangar is the base)
const ECHO = { at: [-150, 200], yaw: 2.5 };

// the way in on the surface: the game's own hangar, its west mouth 30 m
// south of the landing, opening north (lane L's level pack); and a spot in
// its frame (x across the mouth, z out of it), for the base's
// people, who stand about the way in
const MOUTH = { at: [-20, -30], yaw: 0, door: [-20, -32], back: [-20, -26] };
const mouth = ([x, z]) => [Math.round((MOUTH.at[0] + x * Math.cos(MOUTH.yaw) + z * Math.sin(MOUTH.yaw)) * 10) / 10, Math.round((MOUTH.at[1] - x * Math.sin(MOUTH.yaw) + z * Math.cos(MOUTH.yaw)) * 10) / 10];

// the trench line, the same
const TRENCH = [100, 370];

// the wampa's cave, and a spot in its own frame put in the world's (as
// siteFrom turns a place's things)
const CAVE = { at: [-380, -280], yaw: 0.9 };
const cave = ([x, z]) => [Math.round((CAVE.at[0] + x * Math.cos(CAVE.yaw) + z * Math.sin(CAVE.yaw)) * 10) / 10, Math.round((CAVE.at[1] - x * Math.sin(CAVE.yaw) + z * Math.cos(CAVE.yaw)) * 10) / 10];

export const SITES = {
  hoth: {
    // drawn from the game's level (/models/galaxy/bf2017/levels/hoth/level.json,
    // by scripts/bf2017-level.mjs; surface/level/): Echo Base, the trenches,
    // the rocks and the ridges as the game placed them. A thing marked `game`
    // is the game's too: the flight's planet still builds it, the surface
    // leaves it to the level
    level: 'hoth',
    place: 'The ice fields outside Echo Base',
    line: 'Ice to the horizon, wind off the glaciers, and colder every night.',
    // what its surfaces are, as the 2017 game's material grid for Hoth has
    // them (lib/physics/materials.js): until the level's own collision tags
    // its shapes, the ground is snow (28), a wall metal (14), a rock rock
    // under snow (91); by hand, src/data/bf2017/physics/NOTES.md
    materials: { level: 'hoth_01', ground: 28, box: 14, circle: 91 },
    // (every one of them a model, never one built in code: surface/cast.js;
    // whoever holds Hoth, their soldiers in snow kit)
    cast: 'models',
    uniforms: { stormtrooper: 'snowtrooper', rebel: 'hothtrooper' },
    // lit as the game lights Hoth_01 (src/data/bf2017/light/hoth.json,
    // gameLit.js): its sun, sky, bounce, fog, probe and grade over these
    gameLight: 'hoth',
    sky: {
      zenith: '#6f98c8',
      horizon: '#e4ecf4',
      haze: 0.95,
      hazeColor: '#eef3f9',
      suns: [{ az: 2.4, el: 0.2, color: '#fff4e6', size: 0.014, glow: 1.0 }],
      clouds: { cover: 0.42, color: '#ffffff', shade: '#b4c2d6', scale: 0.6, speed: 0.006 },
      // Hoth's three moons, pale in the day
      bodies: [
        { az: -0.62, el: 0.24, size: 0.034, color: '#e6ebf2', color2: '#c4ccd8', bands: 0 },
        { az: -0.3, el: 0.31, size: 0.013, color: '#d8dee6' },
        { az: 0.42, el: 0.2, size: 0.009, color: '#dce2ea' },
      ],
    },
    fog: { color: '#e2eaf3', density: 0.0011 },
    light: { sun: 2.6, sky: '#9fbce6', ground: '#e6edf6', ambient: 0.9 },
    dust: '#f4f8fd',
    edge: 'Nothing out there but ice and wind, and it’s colder every night. Better turn back.',
    ground: { detail: 'snow', detailLook: { color: 0.5, normal: 0.6 },
      seed: 7,
      wind: 0.6,
      // the game's own ground: its heightmaps, 0 at the landing by the hangar
      layers: [{ type: 'image', pack: 'hoth' }],
      // (the land the flight's planet sums for Hoth, which has no heightmap
      // yet: the site's own, as it was)
      flight: [
        { type: 'swell', scale: 520, height: 6 },
        { type: 'hills', scale: 300, height: 14 },
        { type: 'dunes', scale: 36, height: 1.1, wind: 0.6 },
        // the glacier Echo Base is cut into, and the hills the wampa hunts
        { type: 'island', at: [-330, 440], r: 300, height: 80, core: 0.35 },
        { type: 'island', at: [-470, -350], r: 170, height: 34, core: 0.3 },
        { type: 'mountains', from: 680, to: 3200, height: 700, scale: 1500 },
      ],
      // (where the transport's set down)
      flats: [{ at: [-280, 70], r: 50, edge: 30 }],
      palette: {
        low: '#dfe7f1',
        high: '#f4f8fc',
        rock: '#7e8fa6',
        accent: '#cbdaeb',
        deep: '#c6d6e8',
        hLow: -4,
        hHigh: 26,
        rockAt: 0.48,
        accentCover: 0.22,
        ripple: { strength: 0.07, scale: 2.2, wind: 0.6 },
        grain: 0.45,
        sparkle: 0.7,
        mark: '#a8bcd4',
      },
    },
    weather: [
      { kind: 'snow', count: 2200, speed: 1.2 },
      { kind: 'spray', count: 1100, color: '#ffffff' },
    ],
    land: { at: [0, 0], yaw: -0.75 },
    lines: {
      out: {
        xwing: [['luke', 'Hoth. Keep your sensors on the ridges, Artoo. There are wampas out here.'], ['r2', '(A shivering, chattering warble.)']],
        falcon: [['han', 'Hoth. Of all the frozen rocks in the galaxy.'], ['chewie', '(A miserable, freezing howl.)']],
        cruiser: [['morty', 'R-Rick, it’s s-so cold!'], ['rick', 'It’s an ice planet, Morty. Should’ve brought a jacket. Or a tauntaun.']],
        rv: [['jesse', 'Yo, it is mad cold out here, Mr. White.'], ['walt', 'Then we work fast.']],
      },
    },
    // the game's own Echo Base inside the glacier (lane E0: the pack
    // /models/galaxy/bf2017/levels/hoth/base/level.json, `node scripts/bf2017-level.mjs levels/mp/hoth_01
    // --world hoth --district base --inside --spot 205 -1540 --arena 640`:
    // the 14,535 pieces lane L's world leaves under the ice, in the same
    // frame as the world's), a district you walk down into from the mouth
    districts: [
      {
        id: 'base',
        name: 'Echo Base',
        level: 'hoth/base',
        // (on the hangar's floorboards, three metres under the mouth's snow)
        land: { at: [5, -40], yaw: Math.PI },
        line: 'The hangars, the halls and the command centre, cut into the glacier.',
        // (a flat floor just under the hangar's, the game's floors over it; no weather in here)
        ground: { layers: [], base: -3.1 },
        site: { weather: [], fog: { color: '#9fb4ca', density: 0.012 } },
        door: { at: [5, -28], r: 2.4, prompt: 'Back out onto the ice' },
      },
    ],
    // inside Echo Base: in through the hangar's back-left door (the hangar
    // stands 30 m into the place, its back wall 59 m into the hangar)
    zones: [
      // (and beside it, the way down into the game's own halls: the base district)
      { id: 'echohalls', name: 'Echo Base, the halls', door: { at: [-12, -32], r: 2.4, prompt: 'Walk down into the halls' }, to: { district: 'base' } },
      {
        id: 'echo',
        name: 'Echo Base',
        door: { at: MOUTH.door, r: 2.4, prompt: 'Go into the base' },
        back: MOUTH.back,
        inside: {
          build: 'echoinside',
          spawn: ECHO_BASE.spawn,
          yaw: ECHO_BASE.yaw,
          exit: ECHO_BASE.exit,
          bounds: ECHO_BASE.bounds,
          rooms: zoneRooms(ECHO_BASE.rooms),
          light: { sky: '#b8cde4', ground: '#3a4a5c', ambient: 0.8, fog: '#9fb4ca', density: 0.012 },
          lamps: [
            [0, 3.2, 12, '#e6f0ff', 14, 16],
            [0, 3.6, -2, '#e6f0ff', 12, 12],
            [-26, 4.8, -2, '#9fc8ff', 26, 18],
            [23, 3.6, -2, '#cfeee6', 14, 12],
            [0, 6, -24, '#ffe2b0', 22, 18],
          ],
        },
        life: [
          { kind: 'hothtrooper', at: [0.9, 19], still: true, face: Math.PI, name: 'Rebel trooper', says: ['Stay clear of the hangar doors when they open. It’s minus sixty out there tonight.', 'Command centre’s left at the junction. Medical’s right.'] },
          { kind: 'rebel', at: [-21.8, -2], still: true, face: -Math.PI / 2, name: 'General Rieekan', named: true, says: ['Our first catch of the day. An Imperial probe droid.', 'Prepare for ground assault. Send all troops in sector twelve to the south slope.', 'Commence the evacuation. The transports go first, one at a time, behind the ion cannon.'] },
          { kind: 'rebel', at: [-30, 3.6], still: true, face: Math.PI, name: 'Toryn Farr', named: true, says: ['First transport is away.', 'Stand by, ion control. Fire!', 'Shield’s holding. For now.'] },
          { kind: 'rebel', at: [-21, -8.1], still: true, face: 0, name: 'Controller', says: ['(Eyes on the scope.) Something’s out there, past the north ridge.'] },
          { kind: 'c3po', at: [-27.6, -5], roam: 2, speed: 0.4, name: 'C-3PO', named: true, says: ['Sir, the odds of surviving a night on the surface are seven hundred and twenty-five to one.', 'Master Luke is still out there. Oh dear.'] },
          { kind: 'droid', at: [-25, 0.8], roam: 2, speed: 0.5, name: 'R2-D2', named: true, says: ['(A long, worried whistle at the doors.)'] },
          { kind: 'rebel', at: [21.5, -3.6], still: true, face: 1.2, name: 'Medic', says: ['He’s in the bacta tank. Give it a few hours. He’ll be fine.', 'Frostbite, mostly. And a wampa. Mostly the wampa.'] },
          { kind: 'tauntaun', n: 2, at: [-3, -26], spread: 2, roam: 3, speed: 0.6, name: 'Tauntaun', says: ['(It snorts, and steams.)'] },
          { kind: 'hothtrooper', at: [3, -20], roam: 4, speed: 0.8, name: 'Tauntaun handler', says: ['They don’t like the cold any more than we do. Worse at night.'] },
          // (the game's own droids about the base: a treadwell at the repairs, a gonk at the power)
          { kind: 'treadwell', at: [24, -6], roam: 3, speed: 0.4, name: 'A treadwell droid', says: ['(Its arms whirr. It is fixing something, or taking it apart.)'] },
          { kind: 'gonk', at: [-24, 6], roam: 2, speed: 0.2, name: 'A power droid', says: ['Gonk.', 'Gonk. Gonk.'] },
        ],
      },
    ],
    places: [
      {
        id: 'echobase',
        name: 'Echo Base',
        at: ECHO.at,
        yaw: ECHO.yaw,
        r: 60,
        flat: { r: 64, edge: 30, game: true },
        about: 'The Rebellion’s hidden base, cut into the glacier: hangars for the X-wings and snowspeeders, pens for the tauntauns, and a shield to keep the Empire’s guns out. Until a probe droid found it.',
        lines: {
          xwing: [['luke', 'Echo Base. We were all crammed in there, waiting for the Empire to find us.'], ['r2', '(A cheerful beep, then a worried one.)']],
          falcon: [['han', 'Echo Base. Where a certain princess called me a scruffy-looking nerf herder.'], ['chewie', '(A laughing roar.)']],
          cruiser: [['morty', 'Rick, they built a whole base inside a glacier!'], ['rick', 'And one probe droid found it, Morty. One.']],
          rv: [['jesse', 'They live in an ice cave, yo. On purpose.'], ['walt', 'Remote. Defensible. I respect it.']],
        },
        things: [
          // (the game's hangar and what stands in its mouths: the level
          // draws them on the surface; the flight's planet builds these)
          { game: true, kind: 'echobase', at: [0, 30] },
          // in the hangar
          { game: true, kind: 'parkedxwing', at: [-9, 8] },
          { game: true, kind: 'parkedxwing', at: [8, -8], yaw: -0.15, opts: { stripe: '#c8602a' } },
          { game: true, kind: 'snowspeeder', at: [-12, -14], yaw: 0.5 },
          { game: true, kind: 'snowspeeder', at: [11, 18], yaw: -0.3 },
          { game: true, kind: 'crates', at: [-6, -24], opts: { color: '#8a929a' } },
          { game: true, kind: 'crates', at: [2, -25], opts: { color: '#6a6458' } },
          // lined up outside, ready to go
          { game: true, kind: 'snowspeeder', at: [-10, 42] },
          { game: true, kind: 'snowspeeder', at: [0, 44] },
          { game: true, kind: 'snowspeeder', at: [10, 42] },
          { game: true, kind: 'lamp', at: [-24, 33], opts: { h: 5, light: '#ffe2b0' } },
          { game: true, kind: 'lamp', at: [24, 33], opts: { h: 5, light: '#ffe2b0' } },
          { game: true, kind: 'turret', at: [-30, 44], yaw: -0.2 },
          { game: true, kind: 'turret', at: [30, 44], yaw: 0.2 },
          { game: true, kind: 'tauntaunpen', at: [-44, 54], yaw: Math.PI - 0.3 },
        ],
      },
      {
        id: 'ioncannon',
        name: 'The ion cannon',
        at: [-30, 340],
        r: 40,
        flat: { r: 34, game: true },
        about: 'The v-150 Planet Defender. One shot knocks out a Star Destroyer’s systems long enough for a transport to slip past the blockade, and it fired until the last of them was away.',
        lines: {
          xwing: [['luke', 'The first transport is away! That thing gave every one of them a chance.'], ['r2', '(An impressed whistle.)']],
          falcon: [['han', 'That cannon’s the only reason anyone got off this ice ball.'], ['chewie', '(An agreeing woof.)']],
          cruiser: [['rick', 'An ion cannon the size of a building, Morty. One shot, then it needs a nap.'], ['morty', 'Kinda relatable, Rick.']],
          rv: [['jesse', 'It shoots, like, a big red ball of nope.'], ['walt', 'An electromagnetic pulse. Elegant.']],
        },
        things: [
          // the sphere (Meshy, from a still of it firing), tipped half a
          // radian toward its aim and sunk to a third of it in the snow, set
          // back so its middle stands over the place's; the shot from it
          { kind: 'v150', at: [-2.43, -5.74], yaw: 0.4, pitch: 0.5, sink: 6.4, solid: false },
          { kind: 'ioncannon', at: [0, 0], yaw: 0.4, opts: { shell: false, tilt: 1.07, centre: 5, muzzle: 18 } },
          { kind: 'hothconsole', at: [0, -21], yaw: Math.PI },
        ],
      },
      {
        id: 'shieldgen',
        name: 'The shield generator',
        at: [90, 240],
        r: 40,
        flat: { r: 32, game: true },
        about: 'The power generator for Echo Base’s energy shield, strong enough to turn any bombardment. So the Empire came on foot, and General Veers’ walkers made it their target.',
        lines: {
          xwing: [['luke', 'If the walkers reach the generator, the shield’s down and the base is open.'], ['r2', '(A worried warble.)']],
          falcon: [['han', 'They put the shield generator right out here in the open. Nice going.'], ['chewie', '(A doubtful grunt.)']],
          cruiser: [['morty', 'Why is the most important thing just… sitting outside, Rick?'], ['rick', 'Military architecture, Morty. Every empire, every rebellion. Same mistake.']],
          rv: [['walt', 'A single point of failure.'], ['jesse', 'So, like… if that goes, everything goes?']],
        },
        things: [
          { kind: 'hothgenerator', at: [0, 0] },
          { kind: 'hothcrate', at: [-16, -12], yaw: 0.3 },
          { kind: 'hothcrate', at: [-14.6, -11.2], yaw: 1.2 },
          { kind: 'turret', at: [-22, 16], yaw: -0.2 },
          { kind: 'turret', at: [22, 18], yaw: 0.3 },
        ],
      },
      {
        id: 'trenches',
        name: 'The trenches',
        at: TRENCH,
        r: 50,
        flat: { r: 58, game: true },
        about: 'Where the Rebel troopers dug in across the ice field with their trench guns, to hold the walkers back long enough for the transports to get away.',
        lines: {
          xwing: [['luke', 'Rogue Group, use your harpoons and tow cables. Go for the legs.'], ['r2', '(A determined toot.)']],
          falcon: [['han', 'Holding the line against those things with rifles. Brave. Crazy, but brave.'], ['chewie', '(A respectful rumble.)']],
          cruiser: [['morty', 'They’re fighting giant robot camels with snow forts, Rick!'], ['rick', 'Asymmetric warfare, Morty. The snow forts lose.']],
          rv: [['jesse', 'Yo, those things are like, fifty feet tall.'], ['walt', 'And these people are holding them off with a ditch.']],
        },
        things: [
          { kind: 'snowtrench', at: [-40, 0], opts: { len: 26 } },
          { kind: 'snowtrench', at: [-13, 2], opts: { len: 26 } },
          { kind: 'snowtrench', at: [14, -1], opts: { len: 26 } },
          { kind: 'snowtrench', at: [41, 1], opts: { len: 26 } },
          { kind: 'turret', at: [-27, -4.5] },
          { kind: 'turret', at: [0, -4], yaw: 0.1 },
          { kind: 'turret', at: [28, -4.5], yaw: -0.1 },
          { kind: 'crates', at: [-44, -8], opts: { color: '#7a8088' } },
          { kind: 'crates', at: [40, -9], opts: { color: '#7a8088' } },
        ],
      },
      {
        id: 'walker',
        name: 'The fallen walker',
        at: [300, 300],
        r: 44,
        about: 'An AT-AT brought down by a snowspeeder’s tow cable, wrapped round and round its legs till it tripped, and fell, and didn’t get up again.',
        lines: {
          xwing: [['luke', 'That armour’s too strong for blasters. So you trip them.'], ['r2', '(A triumphant toot.)']],
          falcon: [['han', 'Took a cable and a lot of nerve.'], ['chewie', '(An approving roar.)']],
          cruiser: [['morty', 'They tripped it! With a rope!'], ['rick', 'A billion credits of war machine, Morty, beaten by string.']],
          rv: [['jesse', 'Yo, it just faceplanted.'], ['walt', 'Top-heavy. Bad engineering.']],
        },
        things: [
          { kind: 'atat', at: [0, 0], yaw: 2.2, sink: 3, roll: 1.45, solid: { box: [6, 12] } },
          { kind: 'wrecksmoke', at: [4, 12], solid: false, opts: { h: 26, r: 2.4 } },
          { kind: 'snowspeeder', at: [-26, -18], yaw: 1.1, pitch: 0.15, roll: 0.3, sink: 0.4 },
          { kind: 'wrecksmoke', at: [-26, -18], solid: false, opts: { h: 12, r: 1.0 } },
          { kind: 'eweb', at: [-12, 24], yaw: 3.6 },
        ],
      },
      {
        id: 'probe',
        name: 'The probe droid’s crater',
        at: [380, -160],
        r: 28,
        about: 'Where an Imperial probe droid came down in the night. Han and Chewie found it; it blew itself up, and the Empire knew exactly where the Rebels were.',
        lines: {
          falcon: [['han', 'It’s a probe droid. Imperial. And it’s not much good now. Self-destruct.'], ['chewie', '(A worried grumble.)']],
          xwing: [['luke', 'A probe droid. That’s how they found us.'], ['r2', '(A nervous beep.)']],
          cruiser: [['morty', 'It blew itself up, Rick? Why would it do that?'], ['rick', 'Loyalty, Morty. Disgusting, robotic loyalty.']],
          rv: [['jesse', 'So it’s, like, a robot snitch?'], ['walt', 'Somebody always talks.']],
        },
        flat: { r: 16 },
        things: [
          { kind: 'probewreck', at: [0, 0] },
          { kind: 'wrecksmoke', at: [0.4, 0.2], solid: false, opts: { h: 14, r: 0.8, n: 10 } },
        ],
      },
      {
        id: 'wampa',
        name: 'The wampa’s cave',
        at: CAVE.at,
        yaw: CAVE.yaw,
        r: 34,
        flat: { r: 22, edge: 18 },
        about: 'Where a wampa dragged Luke Skywalker after it brought down his tauntaun: hung upside down from the ice, he called his lightsaber out of the snow and into his hand.',
        lines: {
          xwing: [['luke', 'I really don’t want to go back in there.'], ['r2', '(A frightened squeal.)']],
          falcon: [['han', 'This is where the kid got dragged off to. Wampa. Big. Hungry.'], ['chewie', '(A low, uneasy growl.)']],
          cruiser: [['morty', 'Th-there’s a guy hanging from the ceiling, Rick!'], ['rick', 'Wampas hang their food, Morty. Like a pantry. A pantry with screaming.']],
          rv: [['jesse', 'There’s a lightsaber just lying there, Mr. White.'], ['walt', 'Don’t touch it. We don’t know whose it is. Or what’s watching it.']],
        },
        things: [{ kind: 'wampacave', at: [0, 0] }],
      },
      {
        id: 'shelter',
        name: 'Where Han found Luke',
        at: [160, -400],
        r: 26,
        flat: { r: 12 },
        about: 'The night Han rode out alone into the storm after Luke: he cut his tauntaun open to keep him warm, and built a shelter to last till the snowspeeders found them at dawn.',
        lines: {
          falcon: [['han', 'And I thought they smelled bad on the outside.'], ['chewie', '(A fond rumble.)']],
          xwing: [['luke', 'Han came out here for me. In that cold. On a tauntaun.'], ['r2', '(A grateful whistle.)']],
          cruiser: [['morty', 'He slept inside a dead animal, Rick?'], ['rick', 'Thermal efficiency, Morty. Gross, but the numbers check out.']],
          rv: [['jesse', 'He slept inside a tauntaun? That’s… actually kinda smart.'], ['walt', 'Survival is never pretty.']],
        },
        things: [
          { kind: 'hanshelter', at: [0, 0], yaw: 2.6 },
          // (his tauntaun, on its side beside the shelter)
          { kind: 'tauntaun', at: [-4.5, -1.4], yaw: 3.0, roll: 1.5, y: 0.4, solid: { r: 1.3 } },
          // the snowspeeder that found them at dawn
          { kind: 'snowspeeder', at: [10, -8], yaw: 1.9 },
        ],
      },
    ],
    things: [
      // where you set down: the perimeter post, a snowspeeder on the snow,
      // its crew's crates and an E-Web
      { kind: 'snowspeeder', at: [22, -12], yaw: 1.2 },
      { kind: 'hothcrate', at: [14, 10], yaw: 0.2 },
      { kind: 'hothcrate', at: [15.6, 10.8], yaw: 0.9 },
      { kind: 'hothcrate', at: [14.4, 12.2], yaw: 0.4 },
      { kind: 'hothcrate', at: [-19, 7], yaw: 2.1 },
      { kind: 'eweb', at: [-15, -17], yaw: 3.2 },
      { kind: 'lamp', at: [-10, 16], opts: { h: 4, light: '#ffe2b0' } },
      { kind: 'lamp', at: [18, 4], opts: { h: 4, light: '#ffe2b0' } },
      // a GR-75 transport, loading for the run past the blockade
      { kind: 'gr75', at: [-280, 70], yaw: 0.35 },
      { kind: 'hothcrate', at: [-250, 48], yaw: 0.4 },
      { kind: 'hothcrate', at: [-248.4, 49.2], yaw: 1.1 },
      { kind: 'hothcrate', at: [-258, 94], yaw: 2.3 },
      { kind: 'crates', at: [-252, 52], opts: { color: '#8a929a' } },
      { kind: 'crates', at: [-256, 92], opts: { color: '#6a6458' } },
      // Rogue Group, flying round over the battlefield
      { kind: 'speederflight', at: [100, 440], solid: false, opts: { r: 170, h: 36, squash: 0.55, built: false } },
      { kind: 'speederflight', at: [-40, 120], solid: false, opts: { r: 120, h: 48, n: 2, speed: 0.08, squash: 0.8, built: false } },
      // the patrol markers: out from the base to the wampas' hills, and on
      // round to where Han found Luke
      { kind: 'lamp', at: [-170, 50], opts: { h: 3, light: '#ff8a5a' } },
      { kind: 'lamp', at: [-245, -50], opts: { h: 3, light: '#ff8a5a' } },
      { kind: 'lamp', at: [-315, -165], opts: { h: 3, light: '#ff8a5a' } },
      { kind: 'lamp', at: [-220, -350], opts: { h: 3, light: '#ff8a5a' } },
      { kind: 'lamp', at: [-40, -390], opts: { h: 3, light: '#ff8a5a' } },
    ],
    // (the game's rocks, snow piles and ice stand where it put them: the
    // scatter is the flight's planet's)
    scatter: [
      { game: true, kind: 'iceblock', n: 110, within: [40, 570], scale: [0.6, 3.4] },
      { game: true, kind: 'snowrock', n: 80, within: [60, 580], scale: [0.8, 4.2] },
      { game: true, kind: 'snowdrift', n: 160, within: [20, 580], scale: [1.2, 4.0], sink: 0.3 },
    ],
    life: [
      // the perimeter post at the landing
      { kind: 'hothtrooper', n: 3, at: [6, 4], spread: 8, roam: 8, speed: 1.1, name: 'Rebel trooper', says: ['Perimeter post three. Nothing but wind out here. So far.', 'Keep your eyes on the north ridge.', 'Echo Base is that way. Follow the markers.'] },
      { kind: 'rebelpilot', n: 1, at: [18, -6], still: true, face: 2.2, name: 'Rogue Group pilot', says: ['Harpoon’s armed. Tow cable’s good. Now we wait.', 'Can’t see a thing in this.'] },
      { kind: 'tauntaun', n: 2, at: [-22, 14], spread: 4, roam: 5, speed: 0.8, r: 0.8 },
      { kind: 'droid', n: 1, at: [12, 14], roam: 6, speed: 0.6, name: 'Astromech', says: ['(A shivering beep. It would like to go inside now.)'] },
      // the walkers, on their way in
      { kind: 'atat', n: 4, path: loop([110, 480], [200, 60], 12), speed: 2.2, r: 2.2, name: 'AT-AT', says: ['(Twenty metres up, its head swivels round toward you. Somewhere inside, General Veers is not impressed.)', '(The ground shakes with every step.)'] },
      { kind: 'snowtrooper', n: 3, path: loop([250, 360], [50, 30], 8), speed: 1.3, name: 'Snowtrooper', says: ['Imperial troops have entered the base!', 'Keep moving. The walkers are almost at the generator.', 'Halt! Identify yourself.'] },
      { kind: 'snowtrooper', n: 2, at: [290, 322], spread: 3, still: true, face: 3.6, name: 'Snowtrooper', says: ['Get that E-Web set up!', 'Watch the trenches. Rebels everywhere.'] },
      { kind: 'vader', n: 1, at: [276, 296], still: true, face: 3.4, name: 'Darth Vader', named: true, says: ['(The breathing. Just the breathing.)', 'Admiral Ozzel came out of lightspeed too close to the system. He will not do so again.', 'There is no escape. Don’t make me destroy you.', 'Asteroids do not concern me. I want that ship.'] },
      // the trench line, holding
      { kind: 'hothtrooper', n: 1, at: [TRENCH[0] - 46, TRENCH[1] - 0.2], still: true, face: 0.1, name: 'Rebel trooper', says: ['Here they come! Hold your positions!', 'Imperial walkers on the north ridge!'] },
      { kind: 'hothtrooper', n: 1, at: [TRENCH[0] - 20, TRENCH[1] + 1.8], still: true, face: -0.1, name: 'Rebel trooper', says: ['The shield’s still up. Hold them off till the transports are clear.', 'Those things are too tough for blasters.'] },
      { kind: 'hothtrooper', n: 1, at: [TRENCH[0] + 6, TRENCH[1] - 1.2], still: true, face: 0.2, name: 'Rebel trooper', says: ['Don’t let them get to the generator.'] },
      { kind: 'hothtrooper', n: 1, at: [TRENCH[0] + 22, TRENCH[1] - 1.2], still: true, face: 0, name: 'Rebel trooper', says: ['Where are those snowspeeders?', 'Rogue Group’s coming in!'] },
      { kind: 'hothtrooper', n: 1, at: [TRENCH[0] + 48, TRENCH[1] + 0.8], still: true, face: -0.2, name: 'Rebel trooper', says: ['Fall back to the base when the shield goes. Not before.'] },
      // Echo Base, getting ready to go
      { kind: 'hothtrooper', id: 'officer', quest: 'luke', at: mouth([5, 24]), still: true, face: MOUTH.yaw + 0.4, name: 'Deck officer', says: ['Sir, all the patrols are in. Except one.', 'The shield doors close at nightfall. I’m sorry.'] },
      { kind: 'hothtrooper', id: 'loadmaster', quest: 'transport', at: [-258, 44], still: true, face: 2.4, name: 'Loadmaster', says: ['First transport’s loaded and away. The rest go when the cannon’s ready.', 'Everything else stays. Leave it for the Empire.'] },
      { kind: 'hothtrooper', n: 4, at: mouth([0, 6]), spread: 8, roam: 9, speed: 1.2, name: 'Echo Base crew', says: ['The first transport is away!', 'Your tauntaun will freeze before you reach the first marker.', 'We’ve got to get the speeders adapted to the cold.', 'Sir, all patrols are in. Except one.', 'All troops to the north slope!'] },
      { kind: 'rebelpilot', n: 2, at: mouth([0, 38]), spread: 8, roam: 8, speed: 1.1, name: 'Rogue Group pilot', says: ['Rogue Group, use your harpoons and tow cables!', 'That armour’s too strong for blasters. Go for the legs.', 'Echo Base, this is Rogue Two. Ready for takeoff.'] },
      { kind: 'droid', n: 2, at: mouth([2, 0]), spread: 6, roam: 8, speed: 0.6, name: 'Astromech', says: ['(A worried beep: the shield’s on its last legs.)', '(A busy whistle. It has a speeder to fix.)'] },
      { kind: 'tauntaun', n: 3, at: mouth([-44, 55]), spread: 3, roam: 4, speed: 0.9, r: 0.8 },
      // the wampa, at home
      { kind: 'wampa', n: 1, at: [-390.6, -288.4], still: true, face: 0.9, r: 1, name: 'Wampa', says: ['(A roar that shakes the snow off the roof of the cave.)', '(It looks at you the way it looked at the tauntaun.)'] },
      // Luke, hung by his ankles from the roof of the cave, his feet at the
      // ice block 4.6 m up (the saber step takes him down)
      { kind: 'luke', id: 'hungluke', at: cave([0, -10]), still: true, hang: 4.6, face: CAVE.yaw, name: 'Luke Skywalker', named: true, says: ['(Upside down, eyes shut, reaching for the saber in the snow.)'] },
      // more walkers, out at the edge of the plain, coming in (their own
      // model, walking; inside the world's edge, as an actor can't step past it)
      { kind: 'atat', n: 1, path: [[20, 580], [20, 470]], speed: 2.2, r: 2.2, name: 'AT-AT' },
      { kind: 'atat', n: 1, path: [[260, 520], [260, 420]], speed: 2.2, r: 2.2, name: 'AT-AT' },
      { kind: 'atat', n: 1, path: [[430, 380], [430, 260]], speed: 2.2, r: 2.2, name: 'AT-AT' },
      // another probe droid, still looking
      { kind: 'probe', id: 'probe', n: 1, at: [350, -110], y: 2.2, roam: 40, speed: 1.6, r: 0.6, name: 'Probe droid', says: ['(A burst of Imperial code, crackling and urgent.)', '(It stops, turns its lenses on you, and transmits.)'] },
    ],
    quests: [
      {
        id: 'luke',
        name: 'Find Commander Skywalker',
        about: 'Luke rode out on patrol and never came back, and the night’s coming in at fifty below. The shield doors close at nightfall. Someone has to go after him.',
        giver: 'officer',
        intro: {
          all: [['Deck officer', 'Commander Skywalker hasn’t come back. The temperature’s dropping too rapidly, and the doors close at nightfall.']],
          falcon: [['han', 'That’s right. And my friend’s out in it.']],
          xwing: [['r2', '(A frightened, mournful whistle: Luke? Out there?)']],
          cruiser: [['rick', 'A rescue mission, Morty. On a lizard. In a blizzard.'], ['morty', 'I-I don’t like any of those words, Rick.']],
          rv: [['walt', 'He’ll freeze by morning.'], ['jesse', 'Then we go now, yo.']],
        },
        steps: [
          { type: 'ride', kind: 'tauntaun', text: 'Saddle up a tauntaun', lines: { all: [['Deck officer', 'Your tauntaun will freeze before you reach the first marker!']], falcon: [['han', 'Then I’ll see you in hell!']] } },
          { type: 'reach', at: [-170, 50], r: 12, text: 'Ride out past the first marker' },
          { type: 'reach', at: [-377, -277], r: 10, text: 'Follow the tracks to the ice cave', lines: { all: [['Echo Base', 'Echo Base to patrol: no word. Keep looking.']], xwing: [['r2', '(A frantic beeping: that way! That way!)']] } },
          { type: 'use', id: 'saber', at: [-383, -285], r: 2.8, prompt: 'Pick up the lightsaber', text: 'Find what he left behind', lines: [['Wampa', '(A roar, from somewhere at the back of the cave.)']], end: [{ signal: 'saber', on: false }, { hide: 'hungluke' }, { shake: 0.4 }] },
          { type: 'reach', at: [160, -400], r: 12, time: 240, text: 'Get him to shelter before the storm', lines: { all: [['Luke', 'Ben… Ben Kenobi… the Dagobah system…']], falcon: [['han', 'Hang on, kid. Hang on.']] } },
        ],
        done: {
          all: [['Rogue Two', 'Echo Base, this is Rogue Two. I’ve found them. Repeat, I’ve found them.']],
          falcon: [['han', 'Not bad for a little furball.'], ['chewie', '(A relieved roar.)']],
          xwing: [['luke', 'I’ll be fine, Artoo. Really.'], ['r2', '(An unconvinced, overjoyed warble.)']],
          cruiser: [['morty', 'We did it, Rick! We saved Luke Skywalker!'], ['rick', 'Yeah, yeah. Put it on my Wikipedia page.']],
          rv: [['jesse', 'Yo, we saved the space wizard, Mr. White!'], ['walt', 'Don’t let it go to your head.']],
        },
        reward: 'The snowspeeders find you both at dawn. Luke owes you one.',
      },
      {
        id: 'probe',
        name: 'Something out there',
        about: 'Something came down out of the sky in the night, out past the ridge. Better find out what, before it finds out about you.',
        place: 'probe',
        intro: {
          all: [['Echo Base', 'Patrol, we’ve picked up something outside the base, in your zone. It’s metal. Check it out.']],
          falcon: [['han', 'Chewie and I will take a look.'], ['chewie', '(A doubtful grumble.)']],
          xwing: [['luke', 'Something’s moving out there, Artoo.'], ['r2', '(A nervous beep.)']],
        },
        steps: [{ type: 'talk', actor: 'probe', text: 'Get close to whatever it is', end: [{ hide: 'probe' }, { shake: 0.9 }] }],
        done: {
          all: [['Echo Base', 'Patrol, what was it?']],
          falcon: [['han', 'Could be a probe droid. Imperial. Not much good now, though. It’s blown itself up.'], ['chewie', '(An uneasy growl.)']],
          xwing: [['luke', 'An Imperial probe droid. It blew itself up the second it saw us.'], ['r2', '(A long, worried whistle.)']],
          cruiser: [['morty', 'It just— it just exploded, Rick!'], ['rick', 'Self-destruct, Morty. The Empire’s version of “read receipts”.']],
          rv: [['jesse', 'It blew itself up, yo. Like, on purpose.'], ['walt', 'Which means it already sent everything it saw.']],
        },
        reward: 'The Empire knows the Rebels are here. Time to get the transports moving.',
      },
      {
        id: 'transport',
        name: 'The first transport',
        about: 'The first transport’s loading, and there’s a Star Destroyer sitting right in its way. The ion cannon has to clear the path the moment it lifts.',
        giver: 'loadmaster',
        intro: { all: [['Loadmaster', 'The Empire’s here. This one goes now, cargo or no cargo. Help me get the last of it aboard.']] },
        steps: [
          { type: 'use', id: 'cargo', at: [-252, 52], r: 3.2, prompt: 'Load the last crates', text: 'Get the last of the cargo aboard' },
          { type: 'reach', at: [-30, 316], r: 7, time: 150, text: 'Run for the ion cannon', lines: [['Loadmaster', 'She’s lifting! Get to the ion cannon, quick!']] },
          { type: 'use', id: 'fire', at: [-30, 317], r: 4, prompt: 'Fire the ion cannon', text: 'Fire on the Star Destroyer', end: [{ signal: 'fire' }, { shake: 0.6 }] },
        ],
        done: {
          all: [['Echo Base', 'The first transport is away!']],
          falcon: [['han', 'One down. Plenty more to go.'], ['chewie', '(A triumphant roar.)']],
          xwing: [['luke', 'Right through the blockade. Nice shot!'], ['r2', '(A celebratory toot.)']],
          cruiser: [['rick', 'One ion pulse and the big triangle goes blind, Morty.'], ['morty', 'We’re, uh, we’re actually good at this?']],
          rv: [['walt', 'Clean. Efficient. That’s how it’s done.'], ['jesse', 'Yeah, science, bitch! Space science!']],
        },
        reward: 'One shot from the ion cannon, and the Star Destroyer’s blind long enough for the transport to slip past.',
      },
    ],
    rides: [
      { kind: 'tauntaun', at: [14, 12], yaw: -0.8 },
      { kind: 'tauntaun', at: mouth([-30, 64]), yaw: 2.2 },
    ],
    flyovers: [
      { kind: 'transport', n: 1, metres: 90, alt: 170, speed: 55, every: 70 },
      { kind: 'xwing', n: 2, metres: 12.5, alt: 90, speed: 120, every: 60 },
      { kind: 'shuttle', n: 1, metres: 20, alt: 130, speed: 70, every: 90 },
    ],
  },
};
