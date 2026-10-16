// Mario 64’s look (components/worlds/looks.js): its own, a faithful port.
// The N64’s vertex colours and flat-lit textures (./looks.js has the
// modern, the ultra and the N64 picks), under the runtime’s renderer with
// Neutral set for the port’s own time (module.js, put back on leaving),
// and the light bloom its chain has always drawn (./looks.js reads it from
// here; the composer before it had the same three numbers,
// scripts/twin-parity/originals/mario64.js).

export const LOOK = {
  art: 'own',
  tone: 'house',
  bloom: { threshold: 0.92, strength: 0.32, radius: 0.55 },
  why: {
    art: 'the N64’s own look, ported: vertex colours and flat textures, picked by ./looks.js',
    bloom: 'the light bloom the port has always drawn, its threshold just under white: kept, so the castle looks as it did',
  },
};
