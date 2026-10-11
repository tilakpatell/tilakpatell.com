// Bespin, from the ground: Cloud City's top deck and its platforms, the
// dining room, the carbon-freezing chamber, the reactor shaft and the
// weather vane under it all. (sites/index.js has what a site is; edge.js
// has Mustafar and Scarif.)

export const SITE = {
  // lit as the game lights its level (src/data/bf2017/light/bespin.json, gameLit.js)
  gameLight: 'bespin',
  // drawn from the game's level (lane E4: /models/galaxy/bf2017/levels/bespin/level.json,
  // `node scripts/bf2017-level.mjs s2/levels/cloudcity_01 --world bespin
  // --spot 20 0 --floor 199 --walk 192 --arena 1024 --share
  // low=0.35,mid=0.6,high=0.4 --subs CloudCity_01,StreamedLevel`): CloudCity_01's walkways, platforms and
  // halls at the game's 199 m, the city's plazas 204 m below as its
  // backdrop. Each place stands on the game's own: Platform 327 on the great
  // landing platform, the chamber by the Tibanna generators and the
  // Tydirium's pad, the reactor shaft's door in Leia's tower, the east
  // platform where the game parks Slave I, the vane off the X-wing's pad.
  // The built deck, towers, bridges and lamps are the flight's (`game`);
  // the carbon-freezing chamber stays built, the map has none
  level: 'bespin',
  // the record's picture on the node renderer (src/data/bf2017/light/bespin.picture.json, applyGameLight)
  picture: 'bespin.picture.json',
  // the look (look.js): rose shade, gold hour; the haze below the horizon
  // nearly the sky's own, so the cloud sea and the sky meet without a seam
  look: { shadow: '#c07a8a', edge: [0.1, 0.78], halo: '#ffb070', fogBelow: 0.95 },
  place: 'Cloud City',
  line: 'A city in the clouds, gold in the long sunset, and nothing underneath but sky.',
  sky: {
    zenith: '#4a5a9c',
    horizon: '#ffb488',
    below: '#e8a08a',
    haze: 0.9,
    hazeColor: '#ffc89c',
    suns: [{ az: -2.3, el: 0.13, color: '#ffd2a0', size: 0.03, glow: 1.9 }],
    clouds: { cover: 0.5, color: '#ffd6bc', shade: '#c4808a', scale: 0.55, speed: 0.003 },
    bodies: [
      { az: 1.1, el: 0.42, size: 0.03, color: '#efe0d4', color2: '#cdb8a8', bands: 0 },
      { az: 1.45, el: 0.3, size: 0.012, color: '#e6d6ca' },
    ],
  },
  fog: { color: '#f2b69c', density: 0.0007 },
  light: { sun: 2.8, sky: '#e2c4b4', ground: '#f0a888', ambient: 0.95 },
  dust: '#f4e8dc',
  edge: 'Nothing past here but cloud, a long, long way down.',
  noGround: true,
  fall: -40,
  ground: {
    seed: 1,
    layers: [],
    palette: { low: '#e8d8c8', high: '#f0e2d2', rock: '#c8b8a8' },
  },
  water: { level: -380, color: '#f6c4a6', deep: '#c27c78', kind: 'clouds' },
  weather: [{ kind: 'motes', count: 400, color: '#ffe2c8' }],
  land: { at: [-81, 151], yaw: Math.PI },
  lines: {
    out: {
      xwing: [['luke', 'Cloud City. Han and Leia are here somewhere, Artoo. I can feel it.'], ['r2', '(A nervous warble.)']],
      falcon: [['han', 'Lando’s place. Lando! You old smoothie!'], ['chewie', '(A doubtful growl.)']],
      cruiser: [['morty', 'Rick, it’s a city! In the clouds! Like heaven but with landing pads!'], ['rick', 'It’s a gas mine, Morty. A pretty gas mine run by a guy with a cape.']],
      rv: [['jesse', 'Yo, we’re parked on a cloud. An actual cloud, Mr. White.'], ['walt', 'Tibanna gas, Jesse. They mine it from the atmosphere. Somebody here is making a fortune.']],
    },
  },
  places: [
    {
      id: 'platform327',
      name: 'Platform 327',
      at: [-81, 151],
      r: 30,
      about: 'Where the Falcon set down, limping in with no hyperdrive, and Lando came out with his guards to meet his old friend.',
      lines: {
        xwing: [['luke', 'This is where they landed. Han trusted him.'], ['r2', '(A sceptical beep.)']],
        falcon: [['han', 'Why, you slimy, double-crossing, no-good swindler. You’ve got a lot of guts coming here, after what you pulled.'], ['chewie', '(A warning growl.)']],
        cruiser: [['morty', 'Th-there’s a guy in a cape coming, Rick.'], ['rick', 'Never trust a man in a cape, Morty. That’s, like, rule one.']],
        rv: [['walt', 'A welcoming committee. With guns.'], ['jesse', 'Big smile, though. I don’t trust the smile.']],
      },
    },
    {
      id: 'plaza',
      name: 'The Administrator’s plaza',
      at: [0, -10],
      r: 40,
      about: 'The heart of the city, under the Baron Administrator’s tower: Ugnaughts, gas miners, merchants and Wing Guards, and cloud cars parked on the pads.',
      lines: {
        xwing: [['luke', 'A whole city floating on gas. Nobody here knows the Empire’s already here.']],
        falcon: [['han', 'He’s done all right for himself, the old pirate.'], ['chewie', '(An unimpressed huff.)']],
        cruiser: [['morty', 'Rick, it’s so pretty up here!'], ['rick', 'Sure, Morty. A small mining colony run by a guy who sold out his best friend by lunchtime. Very pretty.']],
        rv: [['jesse', 'This is like the nicest mall I’ve ever been in.'], ['walt', 'It’s a company town, Jesse. Everything here belongs to one man.']],
      },
    },
    {
      id: 'dining',
      name: 'The dining room',
      at: [-81, 93],
      r: 18,
      about: 'Lando opened the doors and there he was, at the end of the table. “We would be honoured if you would join us.”',
      lines: {
        xwing: [['luke', 'He was waiting for them in here. My father.'], ['r2', '(A low, frightened whistle.)']],
        falcon: [['han', 'I shot first. Didn’t do a thing.'], ['chewie', '(A furious roar.)']],
        cruiser: [['morty', 'It’s a dinner party, Rick, with D-Darth Vader!'], ['rick', 'Worst dinner party in the galaxy, Morty, and I’ve been to your mom’s work thing.']],
        rv: [['jesse', 'He just… blocked the blaster? With his hand?'], ['walt', 'Never walk into a room you didn’t check first, Jesse.']],
      },
      // (the game's hotel tower stands for the dining room's outside)
      things: [{ kind: 'diningroom', at: [0, 0], yaw: 2.356, abs: true, y: 0, game: true }],
    },
    {
      id: 'carbon',
      name: 'The carbon-freezing chamber',
      at: [68, -99],
      r: 22,
      about: 'Built for freezing Tibanna gas, borrowed by Vader to freeze Han Solo, to see if a man could survive it. “I love you.” “I know.”',
      lines: {
        xwing: [['luke', 'They froze Han in here. To test it. For me.'], ['r2', '(A distressed squeal.)']],
        falcon: [['han', 'I don’t want to talk about it.'], ['chewie', '(A heartbroken howl.)']],
        cruiser: [['morty', 'Rick, they froze a guy! Alive!'], ['rick', 'Carbonite, Morty. Cryogenics for people who don’t read the instructions.']],
        rv: [['walt', 'Liquid carbon, flash-frozen. Remarkable. And completely insane.'], ['jesse', 'He’s alive in there? Like, aware? Yo, that’s messed up.']],
      },
      things: [
        { kind: 'carbonchamber', at: [0, 0], yaw: -0.84, abs: true, y: 0 },
        { kind: 'carbonite', at: [3, 5], yaw: 2.6, abs: true, y: 0 },
        { kind: 'crates', at: [-8, 12], abs: true, y: 0, opts: { color: '#6a625a' } },
      ],
    },
    {
      id: 'reactor',
      name: 'The reactor shaft',
      at: [68, 8],
      r: 16,
      about: 'A gantry out over the city’s core, nothing below but the wind. Where Vader took Luke’s hand, and told him the truth.',
      lines: {
        xwing: [['luke', 'No. No. That’s not true.'], ['r2', '(A soft, sad whistle.)']],
        falcon: [['han', 'Long way down. Kid jumped, they say. Into that.'], ['chewie', '(A worried moan.)']],
        cruiser: [['morty', 'Rick, it’s the “I am your father” spot!'], ['rick', 'Spoilers, Morty. Forty-five years of spoilers.']],
        rv: [['jesse', 'He’d rather fall than join his own dad, yo.'], ['walt', 'Family business. It’s never simple.']],
      },
    },
    {
      id: 'eastplatform',
      name: 'The east platform',
      at: [-18, -140],
      r: 24,
      about: 'Where Boba Fett loaded his prize aboard Slave I and was gone, the carbonite slab on its sled, Leia and Chewie and Lando too late.',
      lines: {
        xwing: [['luke', 'He took Han from here, to Jabba. We’ll get him back, Artoo.'], ['r2', '(A determined beep.)']],
        falcon: [['han', 'Fett. Next time I see him…'], ['chewie', '(A vengeful roar.)']],
        cruiser: [['morty', 'That’s Boba Fett, Rick! The cool one!'], ['rick', 'Cool guy, Morty, famously cool, falls in a hole.']],
      },
      things: [
        { kind: 'cargosled', at: [-6, 4], yaw: 1.2, abs: true, y: 0 },
        { kind: 'crates', at: [8, -10], abs: true, y: 0, opts: { color: '#7a6a5a' } },
      ],
    },
    {
      id: 'vane',
      name: 'The weather vane',
      at: [-130, 59],
      r: 14,
      about: 'Look down: the long vane under the city, where Luke hung on, out of strength, and called for Leia, and she heard him.',
      lines: {
        xwing: [['luke', 'I hung on down there. I called for her. She came.'], ['r2', '(A comforting chirp.)']],
        falcon: [['han', 'Heck of a place to get picked up from.'], ['chewie', '(A long, impressed whoop.)']],
        cruiser: [['morty', 'H-how far down is that, Rick?'], ['rick', 'Far enough, Morty. Step back.']],
      },
    },
  ],
  // the campaign's Bespin (lane E4: /models/galaxy/bf2017/levels/bespin/m2bes/level.json,
  // `node scripts/bf2017-level.mjs levels/sp/a2/m2bes/ds02 --world bespin
  // --district m2bes --spot -2531 2912 --floor 2366.25 --walk 256 --arena 1024
  // --share low=0.5,mid=0.6,high=0.7 --subs AdministratorsPalace,
  // A2_M2BES_DS02_S0600_GP,A2_M2BES_DS02_S0700_GP,BespinAtmosphere`):
  // the Administrator's palace, where the campaign's AT-STs and E-Web
  // stand, the other floating cities round it on the horizon
  districts: [
    {
      id: 'm2bes',
      name: 'The Administrator’s palace',
      level: 'bespin/m2bes',
      land: { at: [0, 0], yaw: 0 },
      line: 'The palace’s terraces, the Empire’s walkers on them, and the other mines floating off in the gold.',
      door: { at: [0, -8], r: 2.5, prompt: 'Take a cloud car back to the platforms' },
    },
  ],
  // the places you go into: the dining room, the freezing chamber, the
  // reactor shaft (nothing under its gantries: fall, and you're back in the
  // control room) and the corridor out to the platforms
  zones: [
    // (from the great landing platform's far edge, a cloud car out to the palace: the m2bes district)
    { id: 'palace', name: 'The Administrator’s palace', door: { at: [-81, 168], r: 4, prompt: 'Take a cloud car to the palace' }, to: { district: 'm2bes' } },
    {
      id: 'dining',
      name: 'the dining room',
      door: { at: [-81, 93], r: 4, prompt: 'Go in to dinner' },
      back: [-81, 99],
      inside: {
        build: 'dininginside',
        spawn: [0, 12.5],
        yaw: Math.PI,
        exit: { at: [0, 13.6], r: 1.6 },
        bounds: [14, 14, 7],
        rooms: [[0, 9.5, 2.6, 4.5, 0, 4.5], [0, -3, 11, 11, 0, 7, true]],
        light: { sky: '#ffd8b0', ground: '#6a5a58', ambient: 0.55, fog: '#5a4a48', density: 0.008 },
        lamps: [[0, 5.5, -3, '#ffd0a0', 30, 26], [0, 3, 9, '#ffe0c0', 14, 12], [-6, 4, -8, '#ffc090', 16, 16], [6, 4, -8, '#ffc090', 16, 16]],
      },
      life: [
        { kind: 'vader', id: 'vaderdinner', at: [0, -8.4], still: true, face: 0, name: 'Darth Vader', named: true, says: { when: { hero: 'luke' }, lines: ['We would be honoured if you would join us.', '(He raises a hand, and the blaster is in it.)', 'You may dispense with the pleasantries, Captain Solo.'], else: ['We would be honoured if you would join us.', '(He raises a hand, and the blaster is in it.)', 'Sit. The meal is getting cold.'] } },
        { kind: 'bobafett', id: 'fettdinner', at: [-3.2, -8], still: true, face: 0.4, name: 'Boba Fett', named: true, says: ['(The helmet turns, slowly, to follow you.)', 'He’s worth a lot to me.'] },
        { kind: 'stormtrooper', n: 2, at: [-8, 0], spread: 1, still: true, face: 1.2, name: 'Stormtrooper', says: ['Stay where you are.'] },
        { kind: 'stormtrooper', n: 2, at: [8, 0], spread: 1, still: true, face: -1.2, name: 'Stormtrooper', says: ['Hands where I can see them.'] },
        { kind: 'wingguard', at: [-2, 10], still: true, face: 0, name: 'Wing Guard', says: ['The Baron Administrator says go in. So go in.'] },
      ],
    },
    {
      id: 'carbon',
      name: 'the carbon-freezing chamber',
      door: { at: [68, -99], r: 5, prompt: 'Go down into the chamber' },
      back: [68, -94],
      inside: {
        build: 'carboninside',
        spawn: [0, 13],
        yaw: Math.PI,
        exit: { at: [0, 15], r: 1.8 },
        bounds: [17, 17, 12],
        rooms: [[0, 0, 17, 17, -3, 12, true]],
        light: { sky: '#ff6a3a', ground: '#1a0e0c', ambient: 0.5, fog: '#1a0c0a', density: 0.02 },
        lamps: [[0, 7, 0, '#ff5a2a', 70, 30], [-10, 6, -8, '#ff8a4a', 30, 18], [10, 6, -8, '#ff8a4a', 30, 18], [0, 5, 12, '#ffb080', 24, 14]],
      },
      life: [
        { kind: 'ugnaught', n: 4, at: [-9, 6], spread: 4, roam: 5, speed: 0.8, name: 'Ugnaught', says: ['(It squeals at you and waves you away from the pit.)', '(It wants the controls. It is very sure of the controls.)', '(It snorts, and points at the pit, and laughs.)'] },
        { kind: 'stormtrooper', n: 3, at: [10, 4], spread: 3, still: true, face: -1.6, name: 'Stormtrooper', says: ['Stand back from the platform.', 'Lord Vader’s orders.'] },
        { kind: 'lando', id: 'landocarbon', at: [8, 11], still: true, face: -2.4, name: 'Lando Calrissian', named: true, says: ['I’ve done all I can. I’m sorry I couldn’t do better.', 'If he survives this, I’ll have done what I could.'] },
        { kind: 'wookiee', id: 'chewiecarbon', at: [-6, 10], still: true, face: 2.6, name: 'Chewbacca', says: ['(A heartbroken roar at the pit, and at the troopers holding him.)'] },
        { kind: 'villager', id: 'leiacarbon', at: [-4, 10.4], still: true, face: 2.9, name: 'Princess Leia', named: true, says: ['I love you.', '(She doesn’t look away from the pit.)'] },
        { kind: 'bobafett', id: 'fettcarbon', at: [5, -11], still: true, face: 0.3, name: 'Boba Fett', named: true, says: ['What if he doesn’t survive? He’s worth a lot to me.', 'He’s no good to me dead.'] },
      ],
    },
    {
      id: 'reactor',
      name: 'the reactor shaft',
      door: { at: [68, 8], r: 5, prompt: 'Go into the control room' },
      back: [-130, 59],
      inside: {
        build: 'reactorinside',
        spawn: [0, 19.5],
        yaw: Math.PI,
        exit: { at: [0, 21.6], r: 1.6 },
        bounds: [20, 24, 30],
        rooms: [[0, 17, 6, 5, -1, 4], [0, -6, 16, 16, -30, 24, true]],
        fall: -30,
        respawn: [0, 19.5],
        light: { sky: '#8aa0d8', ground: '#1a1c24', ambient: 0.45, fog: '#101218', density: 0.012 },
        lamps: [[0, 3.6, 17, '#a8c8ff', 30, 14], [0, 6, -6, '#a8c8ff', 40, 36], [0, -20, -6, '#ffb27a', 60, 40], [0, 2, -10, '#ff5a3a', 16, 10]],
      },
      life: [
        { kind: 'vader', id: 'vaderreactor', at: [0, -9.2], still: true, face: 0, name: 'Darth Vader', named: true, says: { when: { hero: 'luke' }, lines: ['Luke, you do not yet realise your importance.', 'Obi-Wan never told you what happened to your father.', 'No. I am your father.', 'Search your feelings. You know it to be true.', 'Join me, and together we can rule the galaxy as father and son.'], else: ['The Force is strong with this one.', 'You have controlled your fear. Now release your anger.', 'Impressive. Most impressive.'] } },
        { kind: 'wingguard', at: [4, 18], still: true, face: -1.6, name: 'Wing Guard', says: ['Nobody goes out on the gantry. Nobody who comes back, anyway.'] },
      ],
    },
    {
      id: 'corridor',
      name: 'the corridor to the platforms',
      door: { at: [-20, -100], r: 4, prompt: 'Take the corridor to Platform 327' },
      back: [-20, -106],
      inside: {
        build: 'corridorinside',
        spawn: [0, 27],
        yaw: Math.PI,
        exit: { at: [0, -27.5], r: 1.8 },
        bounds: [6, 30, 4.5],
        rooms: [[0, 0, 3.2, 30, 0, 4.5]],
        light: { sky: '#ffe0c0', ground: '#6a5a58', ambient: 0.75, fog: '#4a3c3a', density: 0.012 },
        lamps: [[0, 3.8, 22, '#ffe0a0', 26, 16], [0, 3.8, 3, '#ffe0a0', 26, 16], [0, 3.8, -16, '#ffe0a0', 26, 16], [0, 3.8, -27, '#ffd0b0', 20, 10]],
      },
      life: [
        { kind: 'lobot', id: 'lobotcorridor', at: [2.2, 25], still: true, face: -0.6, name: 'Lobot', named: true, says: ['(He says nothing. The lights on his headband blink, faster.)'] },
        { kind: 'wingguard', n: 2, at: [-2, 12], spread: 1.5, still: true, face: 0, name: 'Wing Guard', says: ['The doors are sealed. Imperial orders.', 'Lobot runs the doors. Lobot runs everything.'] },
        { kind: 'stormtrooper', n: 2, at: [0, -16], spread: 1.5, still: true, face: 0, name: 'Stormtrooper', says: ['This corridor is closed.', 'Turn back.'] },
      ],
    },
  ],
  quests: [
    {
      id: 'han',
      name: 'Too late for Han',
      about: 'Vader has Han, and Boba Fett means to take him to Jabba. Find out where they’ve taken him, and get to the east platform before Slave I lifts off.',
      intro: [['Lando Calrissian', 'I had no choice. They arrived right before you did. They’ve taken Han to the carbon-freezing chamber. Hurry!']],
      steps: [
        { type: 'reach', at: [68, -99], r: 12, text: 'Get to the carbon-freezing chamber' },
        { type: 'talk', actor: 'chewie', text: 'Find Chewbacca', lines: [['Lando Calrissian', 'Chewie’s in there somewhere. If anyone knows where Fett took him…']] },
        { type: 'race', gates: [[150, -55], [200, 0], [245, 0]], r: 9, time: 45, text: 'Run for the east platform before Slave I lifts off', lines: [['Chewbacca', '(A roar: the east platform! Fett’s ship!)']] },
      ],
      done: [['Lando Calrissian', 'He’s gone. Fett’s gone, and Han with him.'], ['Leia', 'We’ll find him. We’ll get him back.']],
      reward: 'Slave I is away, with Han aboard. Next stop: Tatooine.',
    },
    {
      id: 'freezing',
      giver: 'chewie',
      name: 'The freezing',
      achievement: 'bespinfreezing',
      about: 'Vader means to test the carbon-freezing chamber on Han. Clear the chamber of his guards, and lower the platform yourself: it is the only way to know it works.',
      intro: [['Chewbacca', '(A roar, and a paw at the door of the freezing chamber: the Ugnaughts are in there, and the troopers, and Han.)']],
      steps: [
        { type: 'enter', zone: 'carbon', text: 'Go into the carbon-freezing chamber' },
        {
          type: 'shoot',
          zone: 'carbon',
          tag: 'chamberguard',
          n: 6,
          text: 'Clear the chamber of Vader’s guards',
          lines: [['Lando Calrissian', 'The Ugnaughts work for the Empire now. So do the troopers. Watch the pit!']],
          spawn: [
            { kind: 'ugnaught', n: 4, at: [7, -6], spread: 4, roam: 4, speed: 1.6, hp: 2, tag: 'chamberguard', hostile: { melee: true, reach: 1.6, damage: 10, chase: 2.4, every: 1.4, range: 14 } },
            { kind: 'stormtrooper', n: 2, at: [-9, 7], spread: 2, roam: 3, speed: 1.2, hp: 3, tag: 'chamberguard', hostile: { range: 20, every: 1.8, damage: 9 } },
          ],
        },
        { type: 'use', zone: 'carbon', id: 'freeze', at: [0, 0], r: 3.5, prompt: 'Lower the platform', text: 'Lower the platform into the pit', lines: [['Boba Fett', 'What if he doesn’t survive? He’s worth a lot to me.'], ['Darth Vader', 'The Empire will compensate you if he dies. Put him in.']], end: [{ signal: 'freeze' }, { sound: 'crash' }, { shake: 0.6 }, { say: [['Princess Leia', 'I love you.'], ['Han Solo', 'I know.'], [null, '(The platform goes down. The steam comes up. When it clears, the slab comes up out of the pit, and there is a face in it.)']] }] },
      ],
      done: [['Boba Fett', 'He’s alive. And in perfect hibernation.'], ['Darth Vader', 'He’s all yours, bounty hunter. Reset the chamber for Skywalker.']],
      reward: 'The chamber works. Vader has what he wanted, and he wants you next.',
    },
    {
      id: 'duel',
      giver: 'guardreactor',
      name: 'The duel',
      achievement: 'bespinduel',
      after: ['freezing'],
      about: 'Vader is waiting in the reactor control room. Out over the shaft, on the gantry, with nothing under it but the wind, face him.',
      intro: [['Wing Guard', 'He went into the reactor control room, sir. He said he was waiting for you. I wouldn’t.']],
      steps: [
        { type: 'enter', zone: 'reactor', text: 'Go into the reactor control room' },
        {
          type: 'shoot',
          zone: 'reactor',
          tag: 'vader',
          n: 1,
          text: 'Face Vader on the gantry',
          // (the Vader standing in the control room steps into the fight: one Vader, not two)
          start: [{ hide: 'vaderreactor' }],
          lines: [['Darth Vader', 'The Force is with you, young Skywalker. But you are not a Jedi yet.']],
          respawn: [0, 19.5],
          spawn: { kind: 'vader', at: [0, -9.2], hp: 7, leash: 30, roam: 2, tag: 'vader', hostile: { range: 16, chase: 2, melee: true, reach: 2.8, every: 1.5, damage: 16, delay: 1, parry: 0.8, guard: 4, blade: { color: '#ff3b3b' }, force: { every: 7, push: 9 } } },
        },
      ],
      done: [['Darth Vader', 'Obi-Wan never told you what happened to your father.'], ['Darth Vader', 'No. I am your father.'], [null, '(There is nothing under the vane but the wind. You let go.)']],
      reward: 'You know it to be true.',
    },
    {
      id: 'lobot',
      giver: 'lobot',
      name: 'Lobot’s codes',
      achievement: 'bespinlobot',
      after: ['freezing'],
      about: 'Lobot has the city’s security codes, and the Wing Guard still answers to Lando. Open the corridor to the platforms, fight your way through it with the Guard, and run for Platform 327.',
      intro: [['Lobot', '(He says nothing. He hands you a code cylinder, and the lights on his headband blink.)'], ['Lando Calrissian', 'That’ll open the corridor doors. The Guard will meet you inside. Go!']],
      steps: [
        { type: 'enter', zone: 'corridor', text: 'Take the corridor to the platforms' },
        { type: 'use', zone: 'corridor', id: 'lobot1', at: [0, 10], r: 3, prompt: 'Use Lobot’s codes', text: 'Open the first door', end: [{ signal: 'lobot1' }, { solid: 'door1', off: true }, { sound: 'crash' }] },
        {
          type: 'shoot',
          zone: 'corridor',
          tag: 'escort',
          n: 4,
          text: 'Fight through the corridor with the Wing Guard',
          lines: [['Wing Guard', 'Stormtroopers, ahead! With you, sir!']],
          spawn: [
            { kind: 'stormtrooper', n: 4, at: [0, -4], spread: 2.5, roam: 3, speed: 1.2, hp: 3, tag: 'escort', hostile: { range: 22, every: 1.8, damage: 9 } },
            { kind: 'wingguard', n: 3, at: [0, 13], spread: 2, roam: 3, speed: 1.4, hp: 12, tag: 'guard', side: 'yours', hostile: { range: 20, every: 1.6, damage: 9 } },
          ],
        },
        { type: 'use', zone: 'corridor', id: 'lobot2', at: [0, -10], r: 3, prompt: 'Use Lobot’s codes', text: 'Open the far door', end: [{ signal: 'lobot2' }, { solid: 'door2', off: true }, { sound: 'crash' }, { leave: true }] },
        { type: 'race', gates: [[14, -185], [8, -215], [0, -240]], r: 9, time: 40, text: 'Run for Platform 327', lines: [['Lando Calrissian', 'This way! The Falcon’s on 327!']] },
      ],
      done: [['Lando Calrissian', 'Leia! Go! Go! Go!'], [null, '(Every stormtrooper on Cloud City is behind you. The Falcon’s ramp is down.)']],
      reward: 'The corridor is yours, and the Falcon is waiting.',
    },
  ],
  things: [
    // the city: its deck, its tower, its towers, its bridges and platforms
    // (the flight's: the game's walkways and platforms stand for them)
    { kind: 'bespindeck', at: [0, 0], abs: true, y: 0, opts: { r: 170, gaps: [Math.PI, Math.PI / 2, -Math.PI / 2, 2.356] }, game: true },
    { kind: 'cloudcity', at: [0, 0], abs: true, y: 0, scale: 2.2, model: false, game: true },
    // the plaza's terraces, north of the plaza before the tower (the Meshy model)
    { kind: 'cloudplaza', at: [0, 72], abs: true, y: 0, yaw: Math.PI, game: true },
    { kind: 'bespinplatform', at: [0, -255], abs: true, y: 0, opts: { r: 28, gap: 0 }, game: true },
    { kind: 'bespinbridge', at: [0, -199], abs: true, y: 0, opts: { len: 62, w: 7 }, game: true },
    { kind: 'bespinplatform', at: [255, 0], abs: true, y: 0, opts: { r: 22, gap: -Math.PI / 2 }, game: true },
    { kind: 'bespinbridge', at: [201, 0], yaw: Math.PI / 2, abs: true, y: 0, opts: { len: 66, w: 6 }, game: true },
    { kind: 'reactorshaft', at: [-195, 0], yaw: -Math.PI / 2, abs: true, y: 0, game: true },
    { kind: 'bespinbridge', at: [-174.5, 0], yaw: Math.PI / 2, abs: true, y: 0, opts: { len: 13, w: 6 }, game: true },
    { kind: 'bespinplatform', at: [141, -141], abs: true, y: 0, opts: { r: 12, gap: -Math.PI / 4 }, game: true },
    { kind: 'bespinbridge', at: [126.6, -126.6], yaw: 2.356, abs: true, y: 0, opts: { len: 26, w: 5 }, game: true },
    // (the vane under the X-wing's pad, over the city's plazas below)
    { kind: 'weathervane', at: [-130, 59], abs: true, y: -40, solid: false },
    // the platform where you land: a cloud car down for a refit, its
    // crew's cargo, and the lamps round the rim
    { kind: 'cloudcar', at: [-97, 138], yaw: 2.4, abs: true, y: 1.2 },
    { kind: 'barrel', at: [-65, 140], yaw: 0.3, abs: true, y: 0 },
    { kind: 'barrel', at: [-63.9, 140.8], yaw: 1.2, abs: true, y: 0 },
    { kind: 'cooler', at: [-62.5, 138.5], yaw: 0.8, abs: true, y: 0 },
    { kind: 'bevelcrate', at: [-66, 137.5], yaw: 0.4, abs: true, y: 0 },
    { kind: 'lamp', at: [-20, -248], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    { kind: 'lamp', at: [20, -248], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    // cloud cars parked by the plaza, lamps along the way in
    { kind: 'cloudcar', at: [-26, 0], yaw: 0.5, abs: true, y: 1.2 },
    { kind: 'cloudcar', at: [-34, -12], yaw: 0.8, abs: true, y: 1.2 },
    { kind: 'lamp', at: [-8, -150], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    { kind: 'lamp', at: [8, -150], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    { kind: 'lamp', at: [-8, -110], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    { kind: 'lamp', at: [8, -110], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    { kind: 'lamp', at: [150, -8], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
    { kind: 'lamp', at: [150, 8], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' }, game: true },
  ],
  scatter: [
    // the skyline: towers stood on the deck (lifted from the fall to it)
    // Cloud City's towers and domed halls round the deck (the Meshy models:
    // the towers the audit lane's, the halls scripts/meshy-galaxy-three.mjs's),
    // sunk into it as the built city's were
    { kind: 'cloudcity', n: 14, within: [52, 158], scale: [0.35, 0.8], sink: -30, clear: 24, game: true },
    { kind: 'cloudtower2', n: 10, within: [60, 158], scale: [0.4, 0.8], sink: -30, clear: 24, game: true },
    { kind: 'cloudblock', n: 40, within: [36, 150], scale: [0.6, 1.3], sink: -40, clear: 12, game: true },
    { kind: 'lamp', n: 50, within: [24, 160], scale: [1, 1], sink: -40, clear: 6, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4', radius: 0.2 }, game: true },
  ],
  // where the people go (needs.js): the Ugnaughts between the plaza, the
  // chamber's door (kneeling at its works, fixing them) and the landing
  // platform (at its controls), the Wing Guard after them
  wants: [
    { id: 'plaza', kind: 'rest', at: [0, -10], pause: 6 },
    { id: 'carbondoor', kind: 'work', at: [68, -92], slots: 2, clip: 'kneel.fix', pause: 9 },
    { id: 'platform', kind: 'work', at: [-81, 135], slots: 2, clip: 'interact', pause: 8 },
  ],
  life: [
    { kind: 'lando', id: 'lando', quest: 'han', at: [-79, 134], face: 3.1, still: true, name: 'Lando Calrissian', named: true, says: {
      when: { owner: 'empire' },
      lines: {
        when: { done: ['han'] },
        lines: ['He’s gone. Fett’s gone, and Han with him. And I handed him over.', 'The Empire runs the city now. The deal I made is the deal they keep, which is to say none at all.', 'This deal is getting worse all the time.'],
        else: { when: { side: 'empire' }, lines: ['You’re with them. Then you know what they’ve done to my city.', 'I had no choice. They arrived right before you did. I’m sorry.'], else: ['Hello, what have we here? Welcome. I’m Lando Calrissian. I’m the administrator of this facility.', 'You look absolutely beautiful. You truly belong here with us among the clouds.', 'I had no choice. They arrived right before you did. I’m sorry.'] },
      },
      else: {
        when: { side: 'rebel' },
        lines: ['General Calrissian, if you please. We took the city back, and I mean to keep it.', 'Tibanna’s flowing again, and the Guard answers to me. Welcome home.', 'You look absolutely beautiful. You truly belong here with us among the clouds.'],
        else: ['Hello, what have we here? Welcome. I’m Lando Calrissian. I’m the administrator of this facility.', 'We’re a small operation. We don’t fall into the jurisdiction of the Empire.', 'You look absolutely beautiful. You truly belong here with us among the clouds.'],
      },
    } },
    { kind: 'lobot', id: 'lobot', quest: 'lobot', at: [-76, 132], face: 3.1, still: true, name: 'Lobot', named: true, says: { when: { done: ['lobot'] }, lines: ['(He says nothing. The lights on his headband blink, slow and steady. The doors are open.)'], else: ['(He says nothing. He never does. The lights on his headband blink.)'] } },
    { kind: 'wingguard', n: 3, path: [[-83, 133], [-83, 100], [-79, 100], [-79, 133]], speed: 1.3, name: 'Wing Guard', says: ['Welcome to Cloud City.', 'Keep to the walkways, please. It’s a long way down.', 'The Baron Administrator will see you now.'] },
    { kind: 'wingguard', id: 'guardreactor', quest: 'duel', at: [64, 12], face: 2.2, still: true, name: 'Wing Guard', says: ['He went into the reactor control room. He said he was waiting for you.', 'Nobody goes out on that gantry. Nobody who comes back.'] },
    { kind: 'wingguard', n: 2, at: [0, -10], spread: 20, roam: 20, speed: 1.1, chases: ['ugnaught'], name: 'Wing Guard', says: ['Move along, citizen.', 'Imperial business. Don’t ask.'] },
    { kind: 'villager', n: 6, at: [0, -10], spread: 30, roam: 20, speed: 1.0, name: 'Cloud City citizen', says: ['Tibanna gas prices are up again. Good for us.', 'Have you seen the sunsets from the east platform?', 'Imperials? Here? The Baron says it’s just business.', 'Mind the edges. They never did put rails on the platforms.'] },
    { kind: 'ugnaught', n: 2, at: [-95, 140], spread: 4, roam: 5, speed: 0.8, name: 'Ugnaught mechanic', says: ['(It squeals at the cloud car’s open engine, and then at you.)', '(It hands you a part, takes it back, and grunts.)'] },
    { kind: 'astromech', n: 1, at: [-67, 142], roam: 5, speed: 0.6, name: 'Astromech', says: ['(A tidy beep. The platform is its responsibility.)'] },
    { kind: 'ugnaught', n: 4, at: [68, -99], spread: 10, roam: 9, speed: 0.8, name: 'Ugnaught', says: ['(It squeals at you and waves you away from the pit.)', '(Grumbling, it shovels carbonite flakes off the platform.)', '(It snorts, and points at the slab, and laughs.)'] },
    { kind: 'ugnaught', n: 3, at: [4, -30], spread: 20, roam: 14, speed: 0.8, needs: ['work', 'rest'], fears: ['stormtrooper', 'wingguard'], name: 'Ugnaught', says: ['(It is very busy, and would like you to know it.)', '(It offers to sell you a slightly used protocol droid head.)'] },
    { kind: 'wookiee', id: 'chewie', quest: 'freezing', at: [73, -86], roam: 6, speed: 1, name: 'Chewbacca', named: true, says: ['(A furious, heartbroken roar at the Ugnaughts and the stormtroopers.)', '(He has C-3PO strapped to his back, in pieces. Threepio is complaining.)'] },
    { kind: 'stormtrooper', n: 4, path: [[-75, 89], [-87, 89], [-87, 105], [-75, 105]], speed: 1.3, name: 'Stormtrooper', says: ['Move along.', 'This area is off limits.', 'Lord Vader has ordered this section sealed.'] },
    { kind: 'bobafett', at: [-11, -138], face: -1.6, still: true, name: 'Boba Fett', named: true, says: { when: { done: ['freezing'] }, lines: ['He’s alive. And in perfect hibernation. He’s mine now.', '(The helmet turns, slowly, to follow you. He says nothing.)'], else: ['He’s no good to me dead.', 'What if he doesn’t survive? He’s worth a lot to me.', '(The helmet turns, slowly, to follow you. He says nothing.)'] } },
    { kind: 'stormtrooper', n: 2, at: [-23, -146], spread: 6, roam: 5, speed: 1, name: 'Stormtrooper', says: ['Put Captain Solo in the cargo hold.', 'Stand clear of the sled.'] },
    { kind: 'vader', at: [69.5, 8], face: -1.5708, still: true, name: 'Darth Vader', named: true, says: { when: { hero: 'luke' }, lines: ['Luke, you do not yet realise your importance.', 'Obi-Wan never told you what happened to your father.', 'No. I am your father.', 'Search your feelings. You know it to be true.', 'Join me, and together we can rule the galaxy as father and son.'], else: ['The Force is strong with this one.', 'You are not a Jedi. You are nothing to me.', 'Bring me Skywalker.'] } },
    { kind: 'luke', at: [62, 10], face: 1.5708, still: true, name: 'Luke Skywalker', named: true, says: ['He told me enough! He told me you killed him.', 'No. No. That’s not true. That’s impossible!', 'I’ll never join you!'] },
    { kind: 'c3po', at: [-81, 115], roam: 5, speed: 0.6, name: 'C-3PO', named: true, says: { when: { done: ['han'] }, lines: ['Oh! They’ve taken Captain Solo! What are we going to do?', 'If only you’d attached my legs, I wouldn’t be in this ridiculous position.'], else: ['Oh! Stormtroopers? Here? We’re in danger. I must tell the others.', 'Oh, no! I’ve been shot!', 'If only you’d attached my legs, I wouldn’t be in this ridiculous position.'] } },
    { kind: 'cloudcar', n: 2, path: [[300, 0], [212, 212], [0, 300], [-212, 212], [-300, 0], [-212, -212], [0, -300], [212, -212]], pause: 0, speed: 16, y: 72, solid: false },
    { kind: 'cloudcar', n: 1, path: [[0, -360], [-255, -255], [-360, 0], [-255, 255], [0, 360], [255, 255], [360, 0], [255, -255]], pause: 0, speed: 18, y: 55, solid: false },
  ],
  flyovers: [
    { kind: 'cloudcar', n: 2, metres: 7, alt: 30, speed: 60, every: 40 },
    { kind: 'shuttle', n: 1, metres: 20, alt: 80, speed: 60, every: 120 },
  ],
  skyships: [
    { kind: 'destroyer', metres: 1600, at: [2600, 3200, 5200], yaw: -2.4 },
    // another of Bespin's floating mines, far off over the clouds
    { kind: 'cloudcity', metres: 900, at: [-5200, -300, -4200], yaw: 0.6 },
  ],

};
