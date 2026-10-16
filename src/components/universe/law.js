// The law on the map: wanted.js's chase, played out with the scene's own
// hunters and traffic. What you do is a crime if it's one (wanted.js's
// CRIMES), seen by the law if one of theirs is near (a patrol going past,
// or the cops already on you), else by the ordinary ships near enough to
// witness it, whose report runs while any of them is still near. Stars send
// the side's police (sides.js `police`) as wanted.js's RESPONSE says, at
// the difficulty's skill and better; they see you while one of them is
// near and nothing's between you, and once the stars go they leave. A
// bounty brings bounty hunters (by wanted.js's bountyTier) while there are
// no stars on you; landing somewhere pays it off out of the wallet. No
// three.js, so it's tested in Node against stand-ins for the scene's
// hunters and traffic.
//
// createLaw({ wanted, hunters, traffic, side, difficulty, bounty, say })
//   → { crime(what, ship, { seen }), killed(faction) → whether it was the
//   law's, spotted(), step(dt, ship, { heat }), down(), arrive(wallet),
//   busy, police }
// hunters: { pack(faction, ship, opts), sees(factions, range), strength(faction),
//   leave(faction), active }; traffic: { near(p, r) → [{ ref, civil, law }] }
// side(): sides.js's side now; difficulty(): difficulty.js's numbers now;
// bounty(tier, ship): send a bounty hunter (the scene's director event);
// say(e): wanted.js's events, and { type: 'cops', n }, { type: 'hunter',
// tier }, { type: 'owed', bounty } (landed, and couldn't pay)

import { TIERS } from './difficulty';
import { bountyTier } from './wanted';

export const WITNESS = { law: 45, civil: 35, gone: 56 }; // how near the law sees what you do; the ordinary ships; and how far a witness must be left behind
export const COP_SIGHT = 60; // how near one of theirs must be to see you
const SPOTTED_FOR = 1.5; // seconds a patrol going past counts as seeing you
export const BOUNTY_EVERY = [0, 210, 140, 100]; // seconds between bounty hunters, by bountyTier
// the deeds (standing.js's, as the scene notes them) that are crimes, and
// which of them the law always sees (it's their own ship, or their scan)
const CRIMES = new Set(['killPatrol', 'killCivil', 'busted', 'ran', 'shotLaw', 'capitalKill', 'capitalHurt', 'killCop']);
const SEEN = new Set(['busted', 'ran', 'shotLaw', 'capitalKill', 'capitalHurt', 'killCop']);

// the tier a response flies at: the difficulty's, `up` better, never past the best
export const copSkill = (base, up = 0) => TIERS[Math.min(TIERS.length - 1, Math.max(0, TIERS.indexOf(base)) + up)];

export function createLaw({ wanted, hunters = null, traffic = null, side = () => null, difficulty = () => ({ skill: 'regular', search: 1, pace: 1 }), bounty = () => {}, say = () => {} }) {
  let clock = 0;
  let copsAt = -Infinity; // when the police were last sent
  let bountyAt = null; // when the next bounty hunter may come (null: not yet set)
  let spottedAt = -Infinity;
  const police = () => side()?.police ?? null;
  const lawFactions = () => {
    const s = side();
    return s ? [s.law, s.police?.faction].filter(Boolean) : [];
  };
  // (whose law it is, now: the crew can change mid-flight)
  const sync = () => wanted.side(side()?.id ?? null);
  const tell = (events) => {
    for (const e of events) {
      // (more stars: the next lot come now)
      if (e.type === 'wanted' && e.stars > e.was) copsAt = -Infinity;
      if (e.type === 'lost' && police()) hunters?.leave(police().faction);
      say(e);
    }
  };

  return {
    // something you did (a deed), where you are: a crime, if it's one
    crime(what, ship, { seen = false } = {}) {
      if (!CRIMES.has(what) || !ship) return;
      sync();
      const near = traffic?.near(ship, WITNESS.law) ?? [];
      const lawSees = seen || SEEN.has(what) || near.some((n) => n.law) || Boolean(hunters?.sees(lawFactions(), WITNESS.law));
      const witnesses = lawSees ? [] : (traffic?.near(ship, WITNESS.civil) ?? []).filter((n) => n.civil).map((n) => n.ref);
      tell(wanted.crime(what, { seen: lawSees, witnesses, at: ship }));
    },
    // one of the hunters shot down: if it was the law's, that's a crime
    // (and it pays nothing); says whether it was
    killed(faction, ship) {
      if (!lawFactions().includes(faction)) return false;
      this.crime('killCop', ship, { seen: true });
      return true;
    },
    // a patrol of the law going past saw you (traffic.js's 'spotted')
    spotted() {
      spottedAt = clock;
    },
    step(dt, ship, { heat = 0 } = {}) {
      clock += dt;
      sync();
      const d = difficulty();
      const seen = Boolean(ship) && (clock - spottedAt < SPOTTED_FOR || Boolean(hunters?.sees(lawFactions(), COP_SIGHT)));
      const witnesses = wanted.report && ship ? (traffic?.near(ship, WITNESS.gone) ?? []).filter((n) => n.civil).map((n) => n.ref) : null;
      tell(wanted.tick(dt, { seen, at: ship, witnesses, search: d.search }));
      if (!ship || !hunters) return;
      // the police, by stars, while it's a pursuit
      const r = wanted.response();
      const p = police();
      if (r && p && wanted.phase === 'pursuit' && clock - copsAt >= r.every && hunters.strength(p.faction) < r.max) {
        copsAt = clock;
        const kinds = r.units.map((u) => p.units[u]).filter(Boolean);
        hunters.pack(p.faction, ship, { kinds, skill: copSkill(d.skill, r.skill), interdict: Boolean(r.interdict), heat, more: 0 });
        say({ type: 'cops', n: kinds.length, stars: wanted.stars });
      }
      // the bounty hunters, by the bounty, while the law isn't on you
      const tier = bountyTier(wanted.bounty);
      if (!tier) {
        bountyAt = null;
        return;
      }
      if (bountyAt === null) bountyAt = clock + BOUNTY_EVERY[tier] / Math.max(0.25, d.pace ?? 1);
      if (!wanted.stars && !hunters.active && clock >= bountyAt) {
        bountyAt = clock + BOUNTY_EVERY[tier] / Math.max(0.25, d.pace ?? 1);
        bounty(tier, ship);
        say({ type: 'hunter', tier });
      }
    },
    // shot down: the chase is over
    down() {
      tell(wanted.clear());
    },
    // landed somewhere: the bounty paid off out of the wallet
    // ({ credits, spend(n) }), if it covers it
    arrive(wallet) {
      const owed = wanted.bounty;
      if (!owed || wanted.stars) return;
      if (wallet && wallet.credits >= owed && wallet.spend(owed)) {
        tell(wanted.payOff(owed));
      } else {
        say({ type: 'owed', bounty: owed, need: owed - Math.max(0, wallet?.credits ?? 0) });
      }
    },
    // the law's on you (nothing else comes meanwhile)
    get busy() {
      return wanted.stars > 0;
    },
    get police() {
      return police();
    },
  };
}
