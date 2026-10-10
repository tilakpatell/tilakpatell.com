// The missions you can play down on a world, by system: what each one is
// and the numbers it runs on (./chase.js runs a chase). The galaxy's
// briefing for the system (systems.js, its game) sends you here once one
// is live: /galaxy/<system>/surface?mission=<id>.
//
//   kind       'chase'
//   start      where you start, on the bike, and `yaw`, which way you face
//   waypoints  the scouts' way, from their camp to where they're going
//   scouts     how many; `gaps` (metres along the way at the off), `lanes`
//              (metres to the right of it, negative left), `speeds` (m/s)
//   hp         hits to bring one down
//   stars      seconds: three stars under the first, two under the second
//   lines      what your crew say, by ship's crew: at the off, at the first
//              one down, when one's near the end, and at the end either way
//   ends       how it ended, for the card: `won` and `lost` (its titles),
//              and `why` (a line for each way to lose: `lost` for a chase)
//
// Or kind 'quest': the surface's quest engine (../quests.js) runs it, from
// `start` on `ride` (or on foot, with no ride) to the end of `quest` (won)
// or a fail or going down (lost: `why` 'time' or 'down'); `stars` are on the
// whole run, `lines` are `start`, `won` and `lost`, and `reset` is effects
// (as a quest step's) that put the world back when it starts again.
//
// Or kind 'assault': a battle for a world's command posts (./assault.js
// runs it; the maps are ./assaults.js's, merged in below).
//
// Or kind 'hvv' (Heroes vs Villains, ./hvv.js) or 'blast' (./blast.js): the
// 2017 game's two modes on the level's own grounds (./arenas.js), a row each
// on every world whose level has them (GROUNDS), merged in below.
//
// Any kind may carry `site: { sky?, light?, fog?, weather? }`: laid over the
// site's while it runs (missionSite), the world being built again for it.

import { starsFor } from './chase';
import { ASSAULTS } from './assaults';
import { GROUNDS } from './arenas';
import { hvvMission } from './hvv';
import { blastMission } from './blast';
import { siteOf } from '../sites';

export const MISSIONS = {
  endor: {
    chase: {
      id: 'chase',
      system: 'endor',
      kind: 'chase',
      name: 'The speeder bike chase',
      ride: 'speederbike',
      start: [50, 262],
      yaw: -0.92, // (toward the first bend)
      // the scouts' camp, out west through the redwoods and round to the bunker's door
      waypoints: [[60, 250], [-40, 330], [-210, 250], [-300, 70], [-220, -120], [-40, -230], [120, -170], [236, -28]],
      scouts: 4,
      gaps: [70, 95, 120, 150],
      lanes: [-1.3, 1.1, -0.4, 0.8],
      speeds: [31, 32.5, 30, 33.5],
      hp: 4,
      stars: [20, 35],
      achievement: 'speederchase',
      ends: { won: 'Every scout down', lost: 'One got through', why: { lost: 'A scout reached the bunker and raised the alarm.' } },
      lines: {
        start: {
          xwing: [['luke', 'Four of them, and they’re heading for the bunker. After them!'], ['r2', '(An urgent, rising whistle.)']],
          falcon: [['han', 'If they get to that bunker, the whole plan’s blown. Go, go!'], ['chewie', '(A roar, already moving.)']],
          cruiser: [['rick', 'Space cops on hover bikes, Morty. Stop them before they snitch.'], ['morty', 'Why is it always a chase, Rick?']],
          rv: [['jesse', 'Yo, they’re gonna rat us out! Floor it!'], ['walt', 'Lean into the turns, Jesse. Lean.']],
        },
        first: {
          xwing: [['luke', 'One down. Keep on the others!']],
          falcon: [['han', 'That’s one. Don’t get cocky.']],
          cruiser: [['rick', 'One down, Morty. Trees: undefeated.']],
          rv: [['walt', 'One. Stay on them.']],
        },
        close: {
          xwing: [['luke', 'He’s nearly at the bunker!'], ['r2', '(A frantic run of beeps.)']],
          falcon: [['han', 'He’s almost there. Punch it!']],
          cruiser: [['morty', 'Rick, he’s almost at the bunker!'], ['rick', 'I can see that, Morty!']],
          rv: [['jesse', 'He’s almost there, Mr. White!']],
        },
        won: {
          xwing: [['luke', 'That’s all of them. The bunker doesn’t know we’re here.'], ['r2', '(A happy, warbling trill.)']],
          falcon: [['han', 'Nobody’s calling anybody. Nice flying, kid.'], ['chewie', '(A pleased rumble.)']],
          cruiser: [['rick', 'And that’s how you handle a neighbourhood watch, Morty.']],
          rv: [['walt', 'Clean. Not one of them made it.'], ['jesse', 'Yeah, science!']],
        },
        lost: {
          xwing: [['luke', 'He made it. They know we’re here now.']],
          falcon: [['han', 'Great. Now the whole garrison knows.']],
          cruiser: [['morty', 'He got there, Rick. They know.'], ['rick', 'Eh, plan B, Morty: there’s always a plan B.']],
          rv: [['walt', 'One got through. We go again.']],
        },
      },
    },
  },
  lothal: {
    starmap: {
      id: 'starmap',
      system: 'lothal',
      kind: 'quest',
      name: 'The Star Map',
      ride: 'speederbike',
      start: [-16, 10],
      yaw: -0.95, // (toward the first gate)
      stars: [60, 90],
      achievement: 'starmapride',
      ends: {
        won: 'The map is safe',
        lost: 'Shin Hati has the map',
        why: { time: 'Too slow between the spires: Shin Hati reached the tower first.', down: 'Knocked down at the tower, and the map went with her.' },
      },
      lines: {
        start: {
          xwing: [['luke', 'The tower’s out past the spires. Go!'], ['r2', '(A quick, eager whistle.)']],
          falcon: [['han', 'Skip the speeches. Get to that tower.'], ['chewie', '(An impatient bark.)']],
          cruiser: [['rick', 'A space map in a space tower, Morty. Drive.'], ['morty', 'Why does everything have to be a race?']],
          rv: [['walt', 'The tower. Before anyone else gets there.'], ['jesse', 'Through the rocks? Yo, okay.']],
        },
        won: {
          xwing: [['luke', 'The map’s ours, and so’s the tower.'], ['r2', '(A triumphant trill.)']],
          falcon: [['han', 'Not bad. Not bad at all.'], ['chewie', '(A pleased rumble.)']],
          cruiser: [['rick', 'Lightsaber lady, down. Map, ours. Easy.']],
          rv: [['walt', 'We have the map. Now we know where to go.']],
        },
        lost: {
          xwing: [['luke', 'She’s got it. We go again.']],
          falcon: [['han', 'Great. Now somebody else knows the way.']],
          cruiser: [['morty', 'She took it, Rick!'], ['rick', 'So we take it back, Morty.']],
          rv: [['jesse', 'She took it, Mr. White.'], ['walt', 'Then we go again.']],
        },
      },
      quest: {
        id: 'mission-starmap',
        name: 'The Star Map',
        steps: [
          {
            type: 'race',
            ride: 'speederbike',
            // six gates out west between the spires, the last at the tower
            gates: [[-30, 20], [-80, 50], [-140, 40], [-195, 75], [-250, 55], [-295, 62]],
            r: 9,
            time: 40,
            text: 'Race between the spires to the old tower',
          },
          { type: 'use', id: 'map', at: [-311, 63], r: 6, prompt: 'Fit the map together', text: 'Get off the bike, and fit the map together at the tower', end: [{ shake: 0.4 }, { say: [[null, '(Lines of light spill up the tower: a way out past the edge of the galaxy.)']] }] },
          {
            type: 'shoot',
            tag: 'mercs',
            n: 6,
            text: 'Hold the tower: bring down Shin Hati’s mercenaries',
            lines: [[null, '(Engines over the grass. Mercenaries, and they want the map.)']],
            spawn: { kind: 'mercenary', n: 6, at: [-290, 30], spread: 22, roam: 6, speed: 1.4, hp: 2, tag: 'mercs', hostile: { range: 42, every: 2.4, damage: 6, spread: 0.06, delay: 2, strafe: { speed: 2, every: 2.6, keep: 12 } } },
          },
          {
            type: 'shoot',
            tag: 'shin',
            n: 1,
            text: 'Bring down Shin Hati',
            lines: [['Shin Hati', 'Give me the map, and walk away.']],
            spawn: { kind: 'shin', at: [-300, 82], hp: 8, leash: 45, roam: 3, tag: 'shin', hostile: { range: 40, chase: 3.2, melee: true, reach: 2.4, every: 1.4, damage: 16, delay: 1 } },
          },
        ],
      },
    },
  },
  dagobah: {
    raise: {
      id: 'raise',
      system: 'dagobah',
      kind: 'quest',
      name: 'Do or Do Not',
      ride: null, // (on foot, with Yoda on your back)
      start: [-20, -52],
      yaw: 2.63, // (toward the first gate)
      stars: [80, 110],
      achievement: 'dagobahraise',
      reset: [{ signal: 'raise', on: false }, { carry: null }],
      ends: {
        won: 'The X-wing is out',
        lost: 'Not yet',
        why: { time: 'Too slow through the swamp. Again, says Yoda. Again.', down: 'The thing in the cave was too much for you. Calm, says Yoda. Calm.' },
      },
      lines: {
        start: {
          xwing: [['r2', '(A doubtful whistle, from somewhere behind you.)']],
          falcon: [['han', 'You’re carrying him? Through that? Okay.'], ['chewie', '(A rumble that might be a laugh.)']],
          cruiser: [['morty', 'Rick, he wants a piggyback.'], ['rick', 'Then run, Morty. Run.']],
          rv: [['jesse', 'Yo, the little green guy’s riding you.'], ['walt', 'Just run.']],
        },
        won: {
          xwing: [['r2', '(An astonished, rising whistle.)']],
          falcon: [['han', 'I don’t believe it.'], ['chewie', '(A long, impressed roar.)']],
          cruiser: [['rick', 'Space wizard stuff, Morty. Don’t let it go to your head.']],
          rv: [['jesse', 'Yo, you lifted a whole plane. With your brain!']],
        },
        lost: {
          xwing: [['r2', '(A sympathetic warble.)']],
          falcon: [['han', 'Take a breath, kid. Go again.']],
          cruiser: [['morty', 'Maybe try again, Rick?'], ['rick', 'That’s the spirit, Morty.']],
          rv: [['walt', 'Again. From the start.']],
        },
      },
      quest: {
        id: 'mission-raise',
        name: 'Do or Do Not',
        steps: [
          {
            type: 'race',
            // round the dry ground from the camp, to the mouth of the cave
            gates: [[-10, -70], [20, -100], [40, -130], [0, -150], [-40, -140], [-58, -114]],
            r: 6,
            time: 45,
            text: 'Run the swamp, with Yoda on your back',
            start: [{ carry: 'yoda' }],
            lines: [['Yoda', 'Run, you will. Through the swamp. Quickly, quickly!']],
          },
          { type: 'reach', at: [-70, -120], r: 9, text: 'Go into the cave: Yoda waits outside', start: [{ carry: null }], lines: [['Yoda', 'Into the cave, go. What is in there, you bring with you.']] },
          { type: 'shoot', tag: 'vision', n: 1, text: 'Face what’s inside', lines: [[null, '(A figure in black steps out of the dark.)']], spawn: { kind: 'vader', at: [-66, -114], hp: 4, leash: 14, roam: 2, tag: 'vision', hostile: { range: 14, chase: 1.8, melee: true, reach: 2.6, every: 1.6, damage: 14, delay: 1, parry: 0.75, guard: 3, blade: { color: '#ff3b3b' } } } },
          {
            type: 'use',
            id: 'raise',
            at: [40, 74],
            r: 10,
            prompt: 'Reach out with the Force',
            text: 'Go to the bog, and raise the X-wing',
            lines: [['Yoda', 'Your ship. In the bog it is. Lift it, you can.']],
            end: [{ signal: 'raise' }, { shake: 0.8 }, { say: [[null, '(The swamp boils. The X-wing rises out of it, dripping, and hangs there over the water.)']] }],
          },
        ],
      },
    },
  },
};

// Beggar's Canyon's gates, the way the Tatooine site lays its pits (sites/desert.js's CANYON)
const CANYON = [[470, 112], [488, 62], [482, 18], [500, -26], [492, -70], [472, -112], [482, -152], [462, -198]];
const hostile = (range, every, damage, extra = {}) => ({ range, every, damage, spread: 0.06, ...extra });

MISSIONS.tatooine = {
  canyonrun: {
    id: 'canyonrun',
    system: 'tatooine',
    kind: 'quest',
    name: 'The Canyon Run',
    ride: 'landspeeder',
    start: [452, 158],
    yaw: 2.77, // (toward the canyon's mouth)
    stars: [62, 84],
    achievement: 'canyonmission',
    ends: {
      won: 'Both runs, clean',
      lost: 'The canyon wins',
      why: { time: 'Too slow through the gates: Biggs would have been home by now.', down: 'The speeder’s in pieces at the foot of the Stone Needle.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'Down the canyon, round the Needle, and straight back up. Biggs did it in thirty.'], ['r2', '(An alarmed whistle.)']],
        falcon: [['han', 'A canyon, a speeder and a clock. Fine. Don’t scratch it.'], ['chewie', '(A dubious growl.)']],
        cruiser: [['rick', 'Teenagers racing through a canyon, Morty. That’s how your grandma and I met.'], ['morty', 'Th-that’s not true, Rick.']],
        rv: [['jesse', 'Yo, this is like street racing but with cliffs.'], ['walt', 'Then don’t hit the cliffs, Jesse.']],
      },
      won: {
        xwing: [['luke', 'Under thirty, both ways! Wait till Biggs hears.'], ['r2', '(A triumphant trill.)']],
        falcon: [['han', 'Not bad, kid. Not bad at all.'], ['chewie', '(A pleased roar.)']],
        cruiser: [['rick', 'Clean run, Morty. Nobody died. Low bar, but we cleared it.']],
        rv: [['jesse', 'Yeah! Science!'], ['walt', 'That was… acceptable.']],
      },
      lost: {
        xwing: [['luke', 'Too slow. Camie’s never going to let me hear the end of this.']],
        falcon: [['han', 'Again. And this time, lean into it.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'We got data, Morty. Go again.']],
        rv: [['walt', 'Again. From the top.']],
      },
    },
    quest: {
      id: 'mission-canyonrun',
      name: 'The Canyon Run',
      steps: [
        { type: 'race', ride: 'landspeeder', gates: CANYON, r: 11, time: 34, text: 'Run Beggar’s Canyon, north to south', lines: [[null, 'Through every gate, round the Stone Needle, out the far end. Go!']] },
        { type: 'race', ride: 'landspeeder', gates: [...CANYON].reverse(), r: 11, time: 34, text: 'Turn round, and run it back up', lines: [[null, 'Now back the way you came. Faster.']] },
      ],
    },
  },
};

MISSIONS.hoth = {
  transport: {
    id: 'transport',
    system: 'hoth',
    kind: 'quest',
    name: 'The First Transport',
    ride: null, // (on foot, from the transport to the ion cannon)
    start: [-238, 36],
    yaw: -0.85, // (toward the cargo by the transport's ramp)
    stars: [140, 190],
    achievement: 'firsttransport',
    ends: {
      won: 'The first transport is away',
      lost: 'The transport didn’t make it',
      why: { time: 'The Star Destroyer was waiting when the transport came up: the ion cannon fired too late.', down: 'The snowtroopers got to you first, and the cannon never fired.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'The Empire’s here. Get that transport loaded and get to the ion cannon, fast!'], ['r2', '(An urgent, rising whistle.)']],
        falcon: [['han', 'They’re coming in. Load it, run for the cannon, don’t stop.'], ['chewie', '(A roar, already lifting a crate.)']],
        cruiser: [['rick', 'Big ship, big gun, one guy on foot. Classic logistics, Morty.'], ['morty', 'Why am I always the one running, Rick?']],
        rv: [['walt', 'Crates first. Then the cannon. Move.'], ['jesse', 'Yo, it is way too cold for this.']],
      },
      won: {
        xwing: [['luke', 'The first transport is away!'], ['r2', '(A jubilant warble.)']],
        falcon: [['han', 'One down. Plenty more to go.'], ['chewie', '(A triumphant roar.)']],
        cruiser: [['rick', 'Transport’s out, Morty. Round of applause for the guy with the frozen legs.']],
        rv: [['walt', 'Clean. Now let’s get warm.'], ['jesse', 'Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'We were too slow. Again.']],
        falcon: [['han', 'Great. Now the whole fleet knows. Go again.']],
        cruiser: [['morty', 'They got the transport, Rick.'], ['rick', 'Then we go again, Morty, and this time run.']],
        rv: [['walt', 'Again. Faster.']],
      },
    },
    quest: {
      id: 'mission-transport',
      name: 'The First Transport',
      steps: [
        { type: 'use', id: 'cargo', at: [-252, 52], r: 3.2, prompt: 'Load the last crates', text: 'Get the last of the cargo aboard' },
        {
          type: 'shoot',
          tag: 'snowtroops',
          n: 4,
          text: 'Hold off the snowtroopers coming over the ridge',
          lines: [['Loadmaster', 'Snowtroopers! Keep them off the ramp till she’s up!']],
          spawn: { kind: 'snowtrooper', n: 4, at: [-190, 110], spread: 12, roam: 5, hp: 2, tag: 'snowtroops', hostile: hostile(44, 2.6, 6, { chase: 2.2, delay: 1.5, burst: { n: 2, gap: 0.14 } }) },
        },
        { type: 'reach', at: [-30, 316], r: 7, time: 110, text: 'Run for the ion cannon', lines: [['Loadmaster', 'She’s lifting! Get to the ion cannon, quick!']] },
        { type: 'use', id: 'fire', at: [-30, 317], r: 4, prompt: 'Fire the ion cannon', text: 'Fire on the Star Destroyer', end: [{ signal: 'fire' }, { shake: 0.6 }] },
      ],
    },
  },
};

MISSIONS.sorgan = {
  sanctuary: {
    id: 'sanctuary',
    system: 'sorgan',
    kind: 'quest',
    name: 'Sanctuary',
    ride: null, // (on foot, at the village)
    start: [168, 96],
    yaw: -2.1, // (toward the trees the raiders come out of)
    stars: [95, 140],
    achievement: 'sanctuary',
    ends: {
      won: 'The village is safe',
      lost: 'The raiders took the harvest',
      why: { time: 'Too slow: the AT-ST reached the huts.', down: 'The walker’s cannon found you in the open.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'Raiders in the trees, and a walker behind them. Hold the village.'], ['r2', '(A determined toot.)']],
        falcon: [['han', 'Here they come. Keep them off the huts, then we deal with the big one.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Space farmers, space raiders, space walker. Hold the line, Morty.'], ['morty', 'Why do I have to hold the line?']],
        rv: [['walt', 'They come out of the trees. We meet them there.'], ['jesse', 'Yo, there’s a walker. A WALKER, Mr. White.']],
      },
      won: {
        xwing: [['luke', 'It’s down. The village is safe.'], ['r2', '(A relieved whistle.)']],
        falcon: [['han', 'That’s the last of them. Nice shooting.'], ['chewie', '(A pleased rumble.)']],
        cruiser: [['rick', 'Walker down, Morty. The krill are safe. Whatever krill are.']],
        rv: [['walt', 'Clean. The village stands.'], ['jesse', 'We saved the shrimp, yo!']],
      },
      lost: {
        xwing: [['luke', 'They got through. We go again.']],
        falcon: [['han', 'Walker got to the huts. Again, and this time shoot the cockpit.']],
        cruiser: [['morty', 'It stepped on a hut, Rick!'], ['rick', 'Huts can be rebuilt, Morty. Go again.']],
        rv: [['walt', 'Again. Aim for the cockpit.']],
      },
    },
    quest: {
      id: 'mission-sanctuary',
      name: 'Sanctuary',
      steps: [
        {
          type: 'shoot',
          tag: 'raidparty',
          n: 6,
          text: 'Drive off the Klatooinian raiders',
          lines: [['Omera', 'They’re here! Everyone, into the huts!']],
          spawn: { kind: 'aqualish', n: 6, at: [112, 66], spread: 14, roam: 6, hp: 2, tag: 'raidparty', hostile: hostile(42, 2.4, 8, { chase: 2.4, delay: 1 }) },
        },
        {
          type: 'shoot',
          tag: 'raidwalker',
          n: 1,
          time: 120,
          text: 'Bring down the AT-ST before it reaches the huts',
          lines: [[null, '(The trees split. An AT-ST steps out of them.)']],
          spawn: { kind: 'atst', at: [96, 48], hp: 16, roam: 10, speed: 1.2, tag: 'raidwalker', hostile: hostile(60, 2, 12) },
        },
        { type: 'talk', actor: 'omera', text: 'Tell Omera the village is safe' },
      ],
    },
  },
};

// (the galactic assaults, a map a world, in with the rest)
for (const [system, m] of Object.entries(ASSAULTS)) (MISSIONS[system] ??= {})[m.id] = m;
// (Heroes vs Villains and Blast, on each world whose level has their grounds)
for (const system of GROUNDS) {
  const list = (MISSIONS[system] ??= {});
  list.hvv = hvvMission(system);
  list.blast = blastMission(system);
}

export const missionOf = (system, id) => MISSIONS[system]?.[id] ?? null;

// What of a site a mission may lay its own over while it runs (the Purge
// Planet's night, the snakes' shelling): the look of it, never its land.
const OVER = ['sky', 'light', 'fog', 'weather'];
// The site as a mission plays it: its `site` laid over the site's. A new
// object, so the site itself (and the next landing, with no mission) keeps
// its own; the site itself where the mission brings nothing.
export function missionSite(site, mission) {
  const over = mission?.site;
  if (!over) return site;
  return { ...site, ...Object.fromEntries(OVER.filter((k) => over[k] !== undefined).map((k) => [k, over[k]])) };
}

// The world a scene builds, from what it was handed: a site already made
// whole (a page's own book: the Rick and Morty planets) or the galaxy's
// site for `system`, and a mission handed in or the system's by id.
export function worldOf({ site = null, system = null, missionSpec = null, mission = null } = {}) {
  const base = site ?? siteOf(system);
  if (!base) return { site: null, mission: null };
  const m = missionSpec ?? (mission ? missionOf(system, mission) : null);
  return { site: missionSite(base, m), mission: m };
}

// How a quest mission went, from what the quest engine said: done is won,
// a fail is lost, anything else is still going.
export const outcomeOf = (events) => (events.some((e) => e.type === 'done') ? 'won' : events.some((e) => e.type === 'fail') ? 'lost' : null);

// A quest mission's run: its clock, until it's won or lost (then it holds).
export const newRun = () => ({ phase: 'run', t: 0, result: null });
export const tickRun = (run, dt) => (run.result ? run : { ...run, t: run.t + dt });
export const endRun = (run, mission, how, why) => (run.result ? run : { ...run, result: how === 'won' ? { won: true, t: run.t, stars: starsFor(mission, run.t) } : { won: false, t: run.t, why } });
