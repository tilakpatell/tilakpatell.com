// What a hero can do on G and V besides shoot or swing: the abilities, each
// a card of numbers, and which two a hero carries. Pure, so it's tested in
// Node; heroes.js names a hero's pair, scene.js plays them and DeployPanel.jsx
// and the HUD name them.
//
//   ABILITIES              by id: { name, about, cool (seconds), hold? (held, not pressed), kind? (how it plays: the id's own when there's none) and the kind's own numbers }
//   ABILITY_IDS, KINDS     every card's id; every kind scene.js plays
//   kindOf(id)             how a card plays (its kind, else its id), or null
//   abilitiesOf(spec)      the pair a party spec carries: { power, second } (their own, else the Force for a saber, else a detonator and the overcharge)
//   JET                    the jetpack's numbers; jetStep(jet, { hold, grounded, dt }) burns or refills it, and says whether it's thrusting this frame
//
// The 2017 heroes' own (Star Wars Battlefront II's kits) are read from the
// game's gameplay data, src/data/bf2017Abilities.json
// (scripts/bf2017-abilities.mjs): each such card has `game` ('<hero>: <the
// game's asset>') and takes the game's recharge, wind-up, reach, cone,
// damage, knockback, duration, speed and shield as the data has them; what
// the data doesn't give, the card says is the site's.
//
//   GAME_HP                the game's hit points to one of the site's (a trooper's 150 is a stormtrooper's hp 2 here)
//   toSite(n)              the game's damage as the site's (at least 1 when it's anything)
//   gameRow(hero, asset)   the row bf2017Abilities.json keeps; gameHealth(hero) the hero's own hit points
//   fromGame(hero, asset)  a card's numbers from its row: { game, cool, wind, range?, cone? (radians from straight ahead), reach?,
//                          hit? { hero, trooper }, perSecond? and grip? (a choke's, by the second, for `grip` seconds), knock? (metres), dur?, speed?, taken?, shield? (of 100) }
//   KNOCK_FOR, knockSpeed(m)   the seconds a shove carries a body, and the speed that carries it m metres
//   forceOf(card)          { range, cone, force, lift, damage } for combatRules.js's forceAt and pushVelocity
//   hitOf(card, hero)      what one of its hits lands on a hero (a named one, a duellist) or anyone else
//   CHOKE, holdVy(y, want, dt)   a choke's lift; the vy that holds a knocked body at `want` metres (activity.js's knock step)
//   LIGHTNING, holdOf(card)      the lightning's tank (held, like the jetpack); a held card's tank rules, or null
//   accrue(acc, add)       a stream of small hits as whole ones: { acc, deal }
//   pickOne(me, targets, card)   the nearest in a card's cone and range (a choke's, the lightning's), or null
//   CHAIN, chainFrom(me, targets, card, { hops, hop })   chain lightning's way: the nearest in the cone, then the nearest to the last, hop by hop
//   RUSH, rushHits(from, to, targets, reach)   a rush's run, and who it passes within reach (not behind where it began)
//   takenOf(t, now)        how much harder a hit lands on t (an exposed weakness while it lasts), else 1
//   soak(rage, n, now)     a hit on you in a rage: { n (to your health), shield (left) }
//   SABER_THROWS, throwOf(card, base)   a hero's own throw on R (Vader's, Maul's), saberRules.js's throw with the game's numbers
//   CLIPS_OF, clipFor(kind, has)        the clip a kind plays on a hero whose pack has it

import GAME from '../../../data/bf2017Abilities.json';
import { FORCE } from './combatRules';

const deg = (d) => (d * Math.PI) / 180;

export const GAME_HP = 75;
export const toSite = (n) => (n > 0 ? Math.max(1, Math.round(n / GAME_HP)) : 0);
export const gameRow = (hero, asset) => GAME.heroes[hero]?.abilities.find((a) => a.asset === asset) ?? null;
export const gameHealth = (hero) => GAME.heroes[hero]?.health ?? null;

// (the game's damage: a number for anyone, or { hero, trooper } (either may be
// `any`), or { perSecond, for }; a by-the-second one is the choke's, not a hit)
const num = (v) => (typeof v === 'number' ? v : null);
function siteHit(d) {
  if (d == null) return null;
  if (typeof d === 'number') return { hero: toSite(d), trooper: toSite(d) };
  const hero = num(d.hero) ?? num(d.any) ?? num(d.trooper);
  const trooper = num(d.trooper) ?? num(d.any) ?? hero;
  return hero == null ? null : { hero: toSite(hero), trooper: toSite(trooper) };
}
const rateOf = (d) => [d, d?.trooper, d?.hero, d?.any].find((x) => x?.perSecond != null) ?? null;

export function fromGame(hero, asset) {
  const r = gameRow(hero, asset);
  if (!r) throw new Error(`bf2017Abilities.json has no ${asset} for ${hero}`);
  const card = { game: `${hero}: ${asset}`, cool: r.recharge ?? 0, wind: r.activation ?? 0 };
  if (r.range != null) card.range = r.range;
  if (r.cone != null) card.cone = Math.min(Math.PI, deg(r.cone));
  if (r.reach != null) card.reach = r.reach;
  const hit = siteHit(r.damage);
  if (hit) card.hit = hit;
  const rate = rateOf(r.damage);
  if (rate) {
    card.perSecond = rate.perSecond / GAME_HP;
    card.grip = rate.for;
  }
  if (r.knock != null) card.knock = r.knock;
  if (r.active) card.dur = r.active;
  if (r.speed != null) card.speed = r.speed;
  if (r.taken != null) card.taken = r.taken;
  const hp = gameHealth(hero);
  if (r.shield != null && hp) card.shield = Math.round((r.shield / hp) * 100);
  return card;
}
const game = (hero, asset, card) => ({ ...fromGame(hero, asset), ...card });

// how long a shove carries a body (activity.js's knock slows it over about
// this): the Force push's 11 m/s, before the game's numbers, carried a body
// about the game's base 10 m
export const KNOCK_FOR = 1;
export const knockSpeed = (m) => m / KNOCK_FOR;

// a choke: how high it lifts them (the site's: the game lifts by its clip)
export const CHOKE = { lift: 1.1, rise: 0.35 };
// the lightning: a held stream off a tank like the jetpack's (the game's
// own meter isn't in the data it reads), a hit every `every` seconds
export const LIGHTNING = { tank: 2.5, refill: 3, every: 0.2 };
// chain lightning: how many more it leaps to after the first, and how far a
// leap goes (the site's; the game's own are outputs the data doesn't name)
export const CHAIN = { hops: 2, hop: 8 };
// a rush: how far and how fast it runs (the game moves the hero by its clip)
export const RUSH = { dist: 7, dur: 0.45 };
// a stun: how long lightning leaves them shaking (the site's; the game's is an
// output it doesn't name)
export const STUN = 1.6;

const OWN = {
  push: { name: 'Push', about: 'The Force, out: everyone in front of you off their feet.', cool: FORCE.push.cool },
  pull: { name: 'Pull', about: 'The Force, in: they come to you, and stagger.', cool: FORCE.pull.cool },
  detonator: { name: 'Detonator', about: 'A thermal detonator, lobbed in an arc. Breaks shields.', cool: 8, fuse: 2.2, speed: 15, lift: 5.5, radius: 4.5, damage: 3 },
  fulminate: { name: 'Fulminate', about: 'A crystal of fulminated mercury, thrown hard. A bigger bang, a longer wait.', cool: 14, fuse: 1.4, speed: 17, lift: 4, radius: 6, damage: 4 },
  rocket: { name: 'Wrist rocket', about: 'Straight from the gauntlet, fast and flat.', cool: 10, fuse: 1.6, speed: 30, lift: 0.4, radius: 3.5, damage: 4 },
  overcharge: { name: 'Overcharge', about: 'No heat and a harder shot for a while.', cool: 20, dur: 5 },
  jetpack: { name: 'Jetpack', about: 'Hold to fly. The tank refills on the ground.', cool: 0, hold: true },
  roar: { name: 'Roar', about: 'A Wookiee’s roar: everyone near staggers back.', cool: 12, range: 7, cone: 1.4, force: 8, lift: 2.5, stagger: 1.5 },
  medpack: { name: 'Medpack', about: 'A third of your health back.', cool: 25, heal: 35 },
  hop: { name: 'Portal hop', about: 'A portal a few metres on, and you through it.', cool: 6, reach: 7 },
  sprint: { name: 'Sprint', about: 'Half again as fast for a few seconds.', cool: 14, dur: 4, speed: 1.5 },
};
// (a blaster hero's thrown thing: the site's arc and blast for its kind, the game's wait)
const thrown = (kind) => {
  const { fuse, speed, lift, radius, damage } = OWN[kind];
  return { fuse, speed, lift, radius, damage };
};

export const ABILITIES = {
  ...OWN,
  // ── the 2017 heroes' own, the game's numbers (a choke's lift, the
  // lightning's tank, a chain's leaps and a rush's run are the site's) ──
  lukePush: game('luke', 'Ability_Luke_ForcePush', { kind: 'push', name: 'Force push', about: 'Luke’s: a narrow cone, twelve metres out, troopers off their feet and done.' }),
  lukeRepulse: game('luke', 'Ability_Luke_ForceRepulse', { kind: 'repulse', cone: Math.PI, name: 'Repulse', about: 'Luke’s: the Force out of him all round, everyone near thrown back.' }),
  vaderChoke: game('vader', 'Ability_DarthVader_ForceChoke_02', { kind: 'choke', name: 'Force choke', about: 'Vader’s: the one in front lifted off the ground, choking, while the grip lasts.' }),
  vaderRage: game('vader', 'Ability_Vader_FocusRage', { kind: 'rage', name: 'Focused rage', about: 'Vader’s: for ten seconds he takes less, behind a shield of his own anger.' }),
  obiwanPush: game('obiwan', 'DefaultAbility_ObiWan_AllOutPush', { kind: 'push', name: 'All-out push', about: 'Obi-Wan’s: everything he has, close in, hard enough to floor a hero.' }),
  obiwanRush: game('obiwan', 'DefaultAbility_ObiWan_DefensiveRush', { kind: 'rush', name: 'Defensive rush', about: 'Obi-Wan’s: a run forward, blade up, cutting through whoever’s in the way.' }),
  anakinPull: game('anakin', 'DefaultAbility_Anakin_PullDominance', { kind: 'pull', name: 'Pull dominance', about: 'Anakin’s: whoever’s in front, eighteen metres off, dragged to his blade.' }),
  anakinImpact: game('anakin', 'DefaultAbility_Anakin_HeroicImpact', { kind: 'repulse', cone: Math.PI, name: 'Heroic impact', about: 'Anakin’s: a blow on the ground that throws everyone round him off their feet.' }),
  maulChoke: game('maul', 'Ability_Maul_ForceChoke', { kind: 'choke', name: 'Force choke', about: 'Maul’s: a grip from fifteen metres, short and savage.' }),
  maulSpin: game('maul', 'Ability_DarthMaul_SpinAttackCharacterState', { kind: 'rush', name: 'Spin attack', about: 'Maul’s: forward with the staff spinning, through whoever stands there.' }),
  dookuStun: game('dooku', 'DefaultAbility_Dooku_LightningStun', { kind: 'electrocute', stun: STUN, name: 'Lightning stun', about: 'Dooku’s: a burst of lightning that leaves them shaking where they stand.' }),
  dookuWeaken: game('dooku', 'DefaultAbility_Dooku_ExposeWeakness', { kind: 'weaken', name: 'Expose weakness', about: 'Dooku’s: those in front of him take a fifth more from every stroke for a while.' }),
  palpatineLightning: game('palpatine', 'Ability_Emperor_ForceLightning', { kind: 'lightning', hold: true, cool: 0, tick: gameRow('palpatine', 'Ability_Emperor_ForceLightning').damage / GAME_HP, name: 'Force lightning', about: 'Hold it: lightning from his hands into whoever’s in front, until it runs dry.' }),
  palpatineChain: game('palpatine', 'Ability_Emperor_ChainLightningCS', { kind: 'chainLightning', name: 'Chain lightning', about: 'One bolt that leaps from the first it finds to the next, and the next.' }),
  // (the blaster heroes' own, where the site already plays the kind: the game's cooldowns, and Chewie's leap)
  hanDetonator: game('han', 'Ability_HanSolo_DemolitionGrenade', { ...thrown('detonator'), kind: 'detonator', name: 'Detonite charge', about: 'Han’s: a charge lobbed in an arc. Breaks shields.' }),
  hanSharpshooter: game('han', 'Ability_HanSolo_Sharpshooterz', { dur: 5, kind: 'overcharge', name: 'Sharpshooter', about: 'Han’s: no heat and a harder shot for a while.' }),
  leiaDetonator: game('leia', 'Ability_Leia_ThermalDetonator_Fake', { ...thrown('detonator'), kind: 'detonator', name: 'Thermal detonator', about: 'Leia’s: lobbed in an arc. Breaks shields.' }),
  chewieLeap: game('chewie', 'Ability_Chewbacca_Leap', { kind: 'repulse', cone: Math.PI, name: 'Leap', about: 'Chewie’s: up, and down on them, everyone round the landing thrown back.' }),
  chewieBowcaster: game('chewie', 'Ability_Weapon_FuriousBowcaster', { dur: 5, kind: 'overcharge', name: 'Furious bowcaster', about: 'Chewie’s: no heat and a harder quarrel for a while.' }),
  landoSharpShot: game('lando', 'Ability_Lando_SharpShot', { dur: gameRow('lando', 'Ability_Lando_SharpShot').active, kind: 'overcharge', name: 'Sharp shot', about: 'Lando’s: for seven seconds, no heat and a harder shot.' }),
  bosskGrenade: game('bossk', 'Ability_Bossk_GrenadeDioxis', { ...thrown('detonator'), kind: 'detonator', name: 'Dioxis grenade', about: 'Bossk’s: a canister of choking gas, lobbed in an arc.' }),
  bobaRocket: game('bobafett', 'Ability_BobaFett_Concussion_Rocket', { ...thrown('rocket'), kind: 'rocket', name: 'Concussion rocket', about: 'Boba Fett’s: straight from the gauntlet, fast and flat.' }),
};
export const ABILITY_IDS = Object.keys(ABILITIES);
export const KINDS = ['push', 'pull', 'detonator', 'fulminate', 'rocket', 'overcharge', 'jetpack', 'roar', 'medpack', 'hop', 'sprint', 'repulse', 'choke', 'rage', 'rush', 'electrocute', 'weaken', 'lightning', 'chainLightning'];

export const kindOf = (id) => ABILITIES[id]?.kind ?? (ABILITIES[id] ? id : null);

// the jetpack: seconds of thrust in a full tank, the push above gravity
// (m/s²), the fastest it lifts (m/s), and seconds to refill on the ground
export const JET = { tank: 2.2, thrust: 24, lift: 7.5, refill: 1.6 };

export function abilitiesOf(spec) {
  const own = spec?.abilities;
  if (own && ABILITIES[own.power] && ABILITIES[own.second]) return { power: own.power, second: own.second };
  return spec?.saber ? { power: 'push', second: 'pull' } : { power: 'detonator', second: 'overcharge' };
}

export const newJet = () => ({ fuel: JET.tank, on: false });

// one frame of the jetpack: held off the ground with fuel left, it burns and
// thrusts; on the ground it refills (never past the tank)
export function jetStep(jet, { hold, grounded, dt }, rules = JET) {
  if (grounded && !hold) {
    jet.fuel = Math.min(rules.tank, jet.fuel + (rules.tank / rules.refill) * dt);
    jet.on = false;
    return jet;
  }
  if (hold && jet.fuel > 0) {
    jet.fuel = Math.max(0, Math.min(rules.tank, jet.fuel) - dt);
    jet.on = true;
    return jet;
  }
  jet.on = false;
  return jet;
}

export const holdOf = (card) => (!card?.hold ? null : card.kind === 'lightning' ? LIGHTNING : JET);

// a card in the Force's terms: an old one is FORCE's (or its own, a roar's);
// a game one has its own reach and cone, its knock as a speed, the push's lift
export function forceOf(card) {
  if (!card?.game) return card?.force != null ? card : FORCE[card === ABILITIES.pull ? 'pull' : 'push'];
  const way = card.kind === 'pull' ? FORCE.pull : FORCE.push;
  return { range: card.range ?? way.range, cone: card.cone ?? way.cone, force: card.knock != null ? knockSpeed(card.knock) : way.force, lift: way.lift, damage: 0 };
}

export function hitOf(card, hero = false) {
  if (card?.hit) return hero ? card.hit.hero : card.hit.trooper;
  return forceOf(card)?.damage ?? 0;
}

// the vy to give a knocked body this frame so it eases to `want` metres up
// (activity.js steps a knock: vy -= g·dt, then y += vy·dt)
export function holdVy(y, want, dt, g = 14) {
  const next = y + (want - y) * Math.min(1, dt / (CHOKE.rise / 3));
  return (next - y) / dt + g * dt;
}

export function accrue(acc, add) {
  const sum = acc + add;
  const deal = Math.floor(sum + 1e-9);
  return { acc: sum - deal, deal };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const inCone = (me, t, range, cone) => {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  return d <= range && (d < 1e-6 || Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) <= cone) ? d : null;
};

export function pickOne(me, targets, card) {
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = inCone(me, t, card.range, card.cone ?? Math.PI);
    if (d != null && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

export function chainFrom(me, targets, card, { hops = CHAIN.hops, hop = CHAIN.hop } = {}) {
  const first = pickOne(me, targets, card);
  if (!first) return [];
  const out = [first];
  const left = new Set(targets.filter((t) => t !== first));
  while (out.length <= hops) {
    const last = out[out.length - 1];
    let next = null;
    let nd = hop;
    for (const t of left) {
      const d = Math.hypot(t.x - last.x, t.z - last.z);
      if (d <= nd) {
        next = t;
        nd = d;
      }
    }
    if (!next) break;
    out.push(next);
    left.delete(next);
  }
  return out;
}

export function rushHits(from, to, targets, reach) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1e-6;
  const ux = dx / len;
  const uz = dz / len;
  return targets.filter((t) => {
    const s = (t.x - from.x) * ux + (t.z - from.z) * uz;
    if (s < 0 || s > len + reach) return false;
    const at = Math.min(s, len);
    return Math.hypot(t.x - (from.x + ux * at), t.z - (from.z + uz * at)) <= reach;
  });
}

export const takenOf = (t, now) => (t?.weakUntil != null && now < t.weakUntil ? (t.weak ?? 1) : 1);

// a hit on you in a rage: the shield takes it first, the rest lands by the
// game's multiplier → { n (what reaches your health), shield (what's left of it) }
export function soak(rage, n, now) {
  if (!rage || now >= rage.until) return { n, shield: 0 };
  const cut = n * (rage.taken ?? 1);
  const kept = Math.min(rage.shield ?? 0, cut);
  return { n: cut - kept, shield: (rage.shield ?? 0) - kept };
}

// a hero's own saber throw (R), as the game has it: its recharge, its hit,
// and its flight timed so the blade's fastest is the projectile's MaxSpeed
// over the site's out-and-back (saberRules.js's raised cosine: its peak
// speed is π·range/dur)
export const SABER_THROWS = {
  vader: fromGame('vader', 'Ability_DarthVader_SaberThrowCharacterState'),
  maul: fromGame('maul', 'Ability_DarthMaul_SaberThrowCharacterState'),
};
export function throwOf(card, base) {
  if (!card) return base;
  return { ...base, dur: card.speed ? (Math.PI * base.range) / card.speed : base.dur, damage: card.hit?.trooper ?? base.damage, cool: card.cool ?? 0 };
}

// the clips a kind plays on a hero that has them (walrusClips.js's site
// names, the game's own under them), best first
export const CLIPS_OF = {
  push: ['force.push'],
  pull: ['force.pull', 'force.push'],
  repulse: ['force.slam', 'sword.pound'],
  choke: ['force.choke'],
  rage: ['force.rage'],
  rush: ['force.rush', 'sword.dash'],
  electrocute: ['force.electrocute', 'force.lightning'],
  lightning: ['force.lightning', 'force.electrocute'],
  chainLightning: ['force.chain', 'force.electrocute'],
  weaken: ['force.weaken'],
  saberThrow: ['saber.throw'],
};
export const clipFor = (kind, has) => (CLIPS_OF[kind] ?? []).find((n) => has(n)) ?? null;
