// Season two's missions, as data (./missions.js runs them with the same
// engine as season one's and lists them after it): "Every version of
// you", Angstrom Levy's dimensions (./dimensions.js). The step kinds are
// ./missions.js's; a step's `dimension` says which dimension it is played
// in (the world goes there as the step begins), and a `through` step with
// `portal` is one of Angstrom's green portals, drawn as a ring.

import { PORTAL_R, PORTAL_SPEED } from './dimensions';
import { GATES as MARS_GATES, GATE_R as MARS_GATE_R } from './offworld/mars';

const step = (type, text, extra = {}) => ({ type, text, ...extra });
const portal = (text, at, dimension) => step('through', text, { at, r: PORTAL_R, speed: PORTAL_SPEED, portal: true, marker: at, dimension });

// Angstrom's three portals round downtown, and the way home: each over a
// street crossing (the streets are 20 m wide every 80 m, at 40 + 80 k), so
// none is in a tower
export const LEVY_PORTALS = {
  burnt: [200, 120, -200],
  drowned: [-200, 120, 200],
  mirror: [40, 160, -360],
  home: [-40, 120, 120],
};
// the race over the drowned city's water: five gates, 40 m up (the water is at 12)
export const DROWNED_GATES = [
  [40, 40, -40],
  [280, 40, 40],
  [280, 40, 280],
  [-40, 40, 280],
  [-280, 40, 120],
];
// the burnt city's ledge: the top of the 167 m tower east of the plaza (map.js's 3016), where its edge is
export const BURNT_LEDGE = [106.9, 167, -80];
// where the mirror Mark comes from, and where Angstrom waits (the hall's plaza)
export const MIRROR_AT = [40, 60, -360];
export const ANGSTROM_AT = [0, 0, 40];
// where Battle Beast waits: the GDA's pad, its south side (the helicopter sits at its middle)
export const BEAST_AT = [1618, 0, -366];

export const SEASON2 = [
  {
    id: 'levy',
    ep: 9,
    season: 2,
    title: 'Every version of you',
    colour: '#7cff4a',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda', after: ['ep8'] },
    intro: [['cecil', 'Angstrom Levy. Three portals over downtown, and he says every one of them has a you in it. Go and see.']],
    steps: [
      portal('Through the first portal, over downtown', LEVY_PORTALS.burnt, 'home'),
      // the burnt city: someone on a ledge where this world's Mark did not come
      step('catch', 'The burnt city: catch who’s left on the ledge', { n: 1, source: 'mission', shake: BURNT_LEDGE, every: 6, marker: { faller: true }, dimension: 'burnt' }),
      portal('Back through the portal, to the next', LEVY_PORTALS.burnt, 'burnt'),
      // the drowned city: a race over the water
      step('race', 'The drowned city: five gates over the water', { gates: DROWNED_GATES, r: 14, time: 75, marker: { gate: true }, dimension: 'drowned' }),
      portal('Back through the portal, to the last', LEVY_PORTALS.drowned, 'drowned'),
      // the mirror city: the other Mark
      step('defeat', 'The mirror city: put the other you down', { kind: 'mirror', n: 1, spawn: [['mirror', 1, MIRROR_AT]], marker: { foe: true }, dimension: 'mirror' }),
      portal('Home, through the last portal', LEVY_PORTALS.mirror, 'mirror'),
      // home: Angstrom at the hall
      step('defeat', 'Angstrom Levy, at the hall: six blows, wherever he goes', { kind: 'angstrom', n: 1, spawn: [['angstrom', 1, ANGSTROM_AT]], marker: { foe: true }, dimension: 'home' }),
    ],
    done: [['cecil', 'Every version of you came home. Levy didn’t. That’s a win, kid.']],
    achievement: 'levy',
  },
  // the Sequids on Mars (./offworld/mars.js runs it while he is there): land at the base, the
  // four astronauts carried to the ship one at a time (each aboard is a `caught` from Mars),
  // the host under the swarm put down (a `ko` of kind host), and the gates home at speed
  {
    id: 'sequids',
    ep: 10,
    season: 2,
    title: 'The Martian mission',
    colour: '#c8553d',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda', after: ['ep8'] },
    intro: [['cecil', 'The Mars crew stopped answering. Something up there is wearing them. Go and get them back.']],
    steps: [
      step('land', 'Fly to Mars and land at the base', { body: 'mars', marker: { body: 'mars' } }),
      step('catch', 'Carry the four astronauts to the ship, one at a time', { n: 4, source: 'mars', marker: { npc: 'astro' } }),
      step('defeat', 'Put the host down: the Martian under the swarm', { kind: 'host', n: 1, marker: { npc: 'host' } }),
      step('race', 'The ship home: three gates over Mars, flat out', { gates: MARS_GATES, r: MARS_GATE_R, time: 120, marker: { gate: true } }),
    ],
    done: [['cecil', 'Four back, and whatever was in them left on Mars. Good.']],
    achievement: 'sequids',
  },
  // Battle Beast (foes.js's beast): Cecil's call after the Machine Head business; the lesson in
  // panels at the GDA's pad (the world feeds `use panels` as they end), then the fight on it
  {
    id: 'beast',
    ep: 11,
    season: 2,
    title: 'Battle Beast',
    colour: '#e8e6e0',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda', after: ['ep8'] },
    intro: [['cecil', 'Machine Head hired something. It is not from here. It’s on my pad, and it wants you.']],
    steps: [
      step('use', 'Cecil, on the block and the counter', { id: 'panels', marker: BEAST_AT }),
      step('defeat', 'Battle Beast: take its swing, then hit it', { kind: 'beast', n: 1, spawn: [['beast', 1, BEAST_AT]], marker: { foe: true } }),
    ],
    done: [['cecil', 'It walked off. Walked. I’m going to pretend that’s a win.']],
    achievement: 'beast',
  },
];
