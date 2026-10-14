// The heavy worlds, the ones a port or a performance lane is judged on
// (docs/superpowers/HANDOFF-performance-lanes.md, lane P0): each a journey
// of scripts/perf-probe.mjs and the route it visits, in the lanes’ order.
// `node scripts/perf-probe.mjs --heavy` runs them; the test beside holds
// each route to src/App.jsx and each journey to the probe.
//
// (the galaxy’s is a system, Tatooine’s: /galaxy alone sends the visitor
// to the last system flown, and the flown galaxy is what its port is
// about; /fly’s is Hoth, the planet its journey defaults to. The lanes’
// /galaxy/hoth/surface is not here: it sends the visitor to Battlefront’s
// Hoth now, src/pages/GalaxyLanding.jsx, the world measured first)

export const HEAVY = [
  { journey: 'battlefront', route: '/battlefront/hoth' },
  { journey: 'galaxy', route: '/galaxy/tatooine' },
  { journey: 'fly', route: '/fly/hoth' },
  { journey: 'universe', route: '/universe' },
  { journey: 'middleEarth', route: '/middle-earth' },
  { journey: 'c137', route: '/c-137' },
  { journey: 'avengers', route: '/avengers' },
  { journey: 'deathstar', route: '/deathstar' },
  { journey: 'deathstarInside', route: '/deathstar/inside' },
];
