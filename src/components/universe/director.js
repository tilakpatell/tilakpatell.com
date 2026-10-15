// The director: now and then, while you fly, something happens. Pure (no
// three.js), so it's tested in Node; the scene plays each one out.
//
// What can happen depends on whose universe you fly in (the crew's side,
// sides.js: each event `needs` something of the side, or nothing):
// - hunt: a pack of hunters comes after you (the Empire for Luke and Han,
//   the Galactic Federation for Rick, the DEA or the cartel for Walt)
// - destroyer (Star Wars): a Star Destroyer drops out of hyperspace nearby
//   and launches its TIE fighters at you
// - council (Rick and Morty): portals open round you and the Council of
//   Ricks comes through, in their own cruisers, for their Rick
// - roadblock (Breaking Bad): the DEA drops in across your bows and holds
//   you there
// - distress: someone ordinary under attack (a Rebel transport and TIEs, a
//   family saucer and Gromflomites), yours to save or not
// - convoy: a line of freighters under escort goes by
// - comet: a comet crosses the sky
// - supernova: a star blows, far out, the flash seen from anywhere
// - flare: the nearest star flares, and its shockwave reaches you a few
//   seconds later (the shields take a knock, the HUD scrambles)
// - rift: a rift tears open ahead of you; fly into it and it takes you
//   somewhere else on the map (nav.js's riftExit)
// - leviathan: something enormous passes: a pod of purrgil (Star Wars) or
//   a Cromulon with something to say (Rick and Morty)
// - meteors: a stream of rocks crosses your path (meteors.js): shoot them
//   or steer round them
// - bounty: a bounty hunter comes for you alone, tough and quick (Boba Fett
//   in Slave I, Phoenixperson, or the Cousins: sides.js)
// - remover (Rick and Morty): the Galactic Federation's NX-5 Planet Remover
//   drops out of warp over the planet you're at and charges its cannon:
//   knock it out before it fires, or the planet's gone for a minute
//   (remover.js)
// - minefield: a band of mines across your way ahead (minefield.js): shoot
//   a way through or weave between them
// - escort: an ordinary ship asks to be seen to the next place, and pirates
//   come for it twice on the way (escort.js)
// - eclipse: a dark moon crosses the sun that lights you, and the light
//   dims through it (eclipse.js); only where there's a sun to cross
//   (withWhere: not at a station, not in the galaxy's gate)
// Nothing happens in the first while, or while something else is going on;
// then one comes along every minute or two, sooner the more trouble you've
// been making (heat: what you've shot down lately, and `wanted`: the law
// has you marked, standing.js: twice the hunts), and never the same thing
// twice running. While your shields are low (`calm`), nobody new comes
// after you: what happens then is one of the sights. And it paces the
// drama as Left 4 Dead's director does: an intensity that rises with the
// hits you take (`hurt`: damage this frame) and the kills you make (heat
// going up) and fades with time; past its peak nothing new comes, and once
// it has fallen back there's a breather (INTENSITY.relax seconds) before
// the next thing, so a fight is followed by a lull and not another fight.
//
// Where you are matters too (zoneOf: a place or the void; each event says
// where it can happen, its `zones`): at a place the hunts, the distress
// calls, the escorts; in the void the sights, the bounty hunter and a
// convoy going by; the capital ships either.
//
// createDirector({ rand, events }) → { update(dt, { side, heat, busy, travelling, calm, wanted, hurt, zone }) → event id or null, soon(id),
//   foretell(side) → { id, in } | null (what's next, and in how long: then that's what comes), intensity }
// `side` is sides.js's (`has(need)` says what it can bring; withWhere adds
// what the place you're at can), or null.
// `events` is the table it picks from: EVENTS, unless a map brings only some
// of them (the galaxy's roam.js opts in to what its scene can play)

export const ZONES = ['place', 'void'];
const PLACE = ['place'];
const VOID = ['void'];
const CAPITAL = ['place', 'void'];
export const EVENTS = {
  hunt: { needs: 'hunt', weight: 3, heat: 1, zones: PLACE },
  destroyer: { needs: 'destroyer', weight: 1.3, heat: 0.6, zones: CAPITAL },
  council: { needs: 'council', weight: 1.5, heat: 0.6, zones: CAPITAL },
  roadblock: { needs: 'roadblock', weight: 1.4, heat: 0.6, zones: CAPITAL },
  distress: { needs: 'pirates', weight: 1.2, heat: 0, zones: PLACE },
  convoy: { needs: null, weight: 1.3, heat: 0, zones: ['place', 'void'] },
  comet: { needs: null, weight: 0.9, heat: 0, zones: VOID },
  supernova: { needs: null, weight: 0.8, heat: 0, zones: VOID },
  flare: { needs: null, weight: 0.9, heat: 0, zones: VOID },
  rift: { needs: null, weight: 1.1, heat: 0, zones: VOID },
  leviathan: { needs: 'leviathan', weight: 1.0, heat: 0, zones: VOID },
  meteors: { needs: null, weight: 1.2, heat: 0, zones: PLACE },
  bounty: { needs: 'bounty', weight: 1.0, heat: 0.8, zones: VOID },
  remover: { needs: 'remover', weight: 1.1, heat: 0.5, zones: PLACE },
  minefield: { needs: null, weight: 1.0, heat: 0.3, zones: ['place', 'void'] },
  escort: { needs: 'pirates', weight: 1.1, heat: 0.4, zones: PLACE },
  eclipse: { needs: 'sun', weight: 0.8, heat: 0, zones: PLACE },
};
// whether an event can happen where you are (an event with no `zones`, as
// the galaxy's own, can happen anywhere; not told where you are, anything)
const canBe = (e, zone) => !e.zones || !zone || e.zones.includes(zone);
// where the ship is: in a region ('place': regions.js's regionAt, the home
// system's among them), or out between them ('void')
export const zoneOf = (s, { regionAt }) => (regionAt(s.x, s.y ?? 0, s.z) ? 'place' : 'void');
// whether a side can have an event
export const canHave = (side, e) => Boolean(side) && (e.needs === null || side.has(e.needs));
// the side, and where you are: what an event needs of the place rather than
// the side (a sun to cross, for an eclipse: none at a station, where the
// sun's behind the station, nor in the galaxy's gate)
export const withWhere = (side, { sun = false, station = false, gate = false } = {}) => side && { ...side, has: (need) => (need === 'sun' ? Boolean(sun) && !station && !gate : side.has(need)) };
export const PACE = { first: [30, 50], gap: [45, 85] }; // seconds before the first, and between the rest
export const INTENSITY = {
  hurt: 0.005, // a point of damage taken is worth this much
  kill: 0.15, // and a kill
  decay: 0.08, // a second, falling
  peak: 0.75, // over this, nothing new comes…
  low: 0.35, // …until it has fallen under this, and then
  relax: 20, // seconds of breather
};

export function createDirector({ rand = Math.random, events = EVENTS } = {}) {
  const between = ([a, b]) => a + rand() * (b - a);
  let clock = 0;
  let nextAt = between(PACE.first);
  let last = null;
  let forced = null;
  let told = null; // what's been foretold (an informant's word: foretell)
  let intensity = 0;
  let lastHeat = 0;
  let peaked = false;
  let relaxUntil = -Infinity;
  // the next event, picked by weight (more hunts the more trouble you've
  // made, and on the way somewhere), never the last one again
  const choose = (side, { heat = 0, travelling = false, calm = false, wanted = false, zone = null } = {}) => {
    const choices = Object.entries(events).filter(([id, e]) => canHave(side, e) && canBe(e, zone) && id !== last && !(calm && e.heat > 0));
    if (!choices.length) return null;
    const weight = (e) => e.weight * (1 + e.heat * Math.min(heat, 6) * 0.5) * (travelling && e.heat > 0 ? 2 : 1) * (wanted && e.heat > 0 ? 2 : 1);
    let r = rand() * choices.reduce((s, [, e]) => s + weight(e), 0);
    for (const [k, e] of choices) if ((r -= weight(e)) <= 0) return k;
    return choices[choices.length - 1][0];
  };
  return {
    // side: the crew's (no ship: null, and nothing happens);
    // heat: 0 and up; busy: something's already going on (hunters after
    // you, a crash playing out), so not now; travelling: out in the open at
    // speed, between places, where things come sooner and more of them are
    // hunters (an ambush on the way); calm: your shields are low, so
    // nothing that comes after you (the hunts wait till they're back);
    // zone: where you are (zoneOf), and only what can happen there comes;
    // pace: how much sooner things come (difficulty.js: harder, sooner)
    update(dt, { side, heat = 0, busy = false, travelling = false, calm = false, wanted = false, hurt = 0, zone = null, pace = 1 }) {
      if (!side) return null;
      clock += dt;
      // the drama's intensity: up with what you take and what you shoot down, fading with time
      intensity = Math.max(0, intensity + hurt * INTENSITY.hurt + (heat > lastHeat + 0.5 ? INTENSITY.kill : 0) - INTENSITY.decay * dt);
      lastHeat = heat;
      if (intensity > INTENSITY.peak) peaked = true;
      else if (peaked && intensity < INTENSITY.low) {
        peaked = false;
        relaxUntil = clock + INTENSITY.relax;
      }
      if (busy || intensity > INTENSITY.peak || clock < relaxUntil) {
        nextAt = Math.max(nextAt, clock + 12); // and a breather after it
        return null;
      }
      if (forced && events[forced] && canHave(side, events[forced])) {
        const id = forced;
        forced = null;
        told = null;
        last = id;
        nextAt = clock + between(PACE.gap);
        return id;
      }
      // travelling, the wait runs down faster
      if (travelling) nextAt -= dt * 1.2;
      if (clock < nextAt) return null;
      // (one foretold comes as it was told, if it still can, wherever you are now)
      const id = told && events[told] && canHave(side, events[told]) && !(calm && events[told].heat > 0) ? told : choose(side, { heat, travelling, calm, wanted, zone });
      told = null;
      if (!id) return null;
      last = id;
      nextAt = clock + (between(PACE.gap) / (1 + Math.min(heat, 6) * 0.25)) * (travelling ? 0.45 : 1) / Math.max(0.25, pace);
      return id;
    },
    // bring an event on next (for checking from a browser)
    soon(id) {
      forced = id;
    },
    // how hot the drama is, 0 and up (for the HUD, and checking)
    get intensity() {
      return intensity;
    },
    // what comes next, and in how many seconds (an informant tells you):
    // picked now, so it's what comes; null without a side
    foretell(side, opts = {}) {
      if (!side) return null;
      told ??= forced ?? choose(side, opts);
      return told ? { id: told, in: Math.max(0, nextAt - clock) } : null;
    },
  };
}
