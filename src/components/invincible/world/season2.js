// Season two's missions, as data (./missions.js runs them with the same
// engine as season one's and lists them after it): "Every version of
// you", Angstrom Levy's dimensions (./dimensions.js). The step kinds are
// ./missions.js's; a step's `dimension` says which dimension it is played
// in (the world goes there as the step begins), and a `through` step with
// `portal` is one of Angstrom's green portals, drawn as a ring.

import { PORTAL_R, PORTAL_SPEED } from './dimensions';

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
];
