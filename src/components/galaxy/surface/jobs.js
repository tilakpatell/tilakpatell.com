// Work in free roam: a board of jobs made from the world you're on, taken
// one at a time and paid each time, so there's always something to do once
// a world's quests are done. Each job is a quest in quests.js's shape (the
// scene runs it as it runs the site's own: the beam, the compass, the
// spawns), made from the world's own places, its own foes (the ones its
// quests send at you, never your own side's; the war's holder where it's
// your enemy) and its own speeders. Pure, tested; surface/scene.js makes a
// board as you land and a new one each time a job's done. The design:
// docs/superpowers/specs/2026-10-23-galaxy-free-roam-jobs-design.md.
//
// - Bounty: a gang at a place, all of them brought down.
// - Salvage: what's lying at a place picked up (sometimes with scavengers
//   on it) and brought back to the ship.
// - Courier: a parcel from by the ship run to a place before the time's up.
// - Speeder run: on one of the world's speeders, through a loop of gates in
//   time.
// - Patrol: out to a place, an ambush there, and back to the ship.
//
// jobsOn(site, mission) → whether there's work here; foesOf(site, effects)
// → [{ kind, plural, spawn }]; jobBoard(site, { from, home, ok, rand,
// effects, n, start }) → [job] (`ok(p)`: somewhere a job can be, the scene's
// standable, in reach and clear; `start`: the first job's number, so a new
// board's ids are new). A job: a quest with `job` (its kind) and `pay` (how
// many of the wallet's jobDone it pays).

import { sideOfKind, relation } from './ground/standing';
import { dressOf, kindFor } from './ground/troops';
import { RIDES } from './rides';

export const KINDS = ['bounty', 'salvage', 'courier', 'race', 'patrol'];
export const NEAR = 70; // metres from you that work starts
export const FAR = 380; // and how far it goes
const SPEEDERS = new Set(['speederbike', 'landspeeder']);
const RUN = 5.5; // m/s a courier's time allows, on foot (the run's 7.4, less the way round)
const OPEN_FIRST = new Set(['bounty', 'salvage']); // (out on open ground first; the rest go to the world's places)

// the world's foes the way a job names them
export const FOE_NAMES = {
  tusken: 'Tusken Raiders',
  stormtrooper: 'stormtroopers',
  sandtrooper: 'sandtroopers',
  snowtrooper: 'snowtroopers',
  scouttrooper: 'scout troopers',
  shoretrooper: 'shoretroopers',
  deathtrooper: 'death troopers',
  battledroid: 'battle droids',
  superdroid: 'super battle droids',
  aqualish: 'Aqualish thugs',
  mercenary: 'mercenaries',
  clone: 'clone troopers',
  rebel: 'Rebel troopers',
  hothtrooper: 'Rebel troopers',
};
// a gang of the world's own when its quests send nobody (the Outer Rim's hired guns), and the war's soldiers
const HIRED = { kind: 'mercenary', hp: 3, roam: 8, hostile: { range: 42, every: 2.4, spread: 0.06, damage: 7, chase: 1.4, delay: 1.2 } };
const SOLDIER = { hp: 2, roam: 6, hostile: { range: 42, every: 2.6, spread: 0.06, damage: 7, burst: { n: 2, gap: 0.14 }, delay: 1.2 } };

export const jobsOn = (site, mission) => !mission && !site.noGround && Boolean(site.land?.at);

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (p) => [Math.round(p[0]), Math.round(p[1])];
// (a place's name inside a sentence: 'The Lars homestead' is 'the Lars homestead' there)
const inLine = (name) => name.replace(/^(The|A|An) /, (w) => w.toLowerCase());
const upFront = (text) => text[0].toUpperCase() + text.slice(1);
const shuffled = (list, rand) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
// (a template: the spawn as its quest has it, without where, how many or whose quest it is)
const OWN = new Set(['at', 'n', 'tag', 'id', 'level']);
const template = (sp) => {
  const rest = Object.fromEntries(Object.entries(sp).filter(([k]) => !OWN.has(k)));
  return { ...rest, hostile: { ...rest.hostile, delay: Math.max(1, rest.hostile?.delay ?? 1) } };
};

// The world's foes for its jobs: the gunmen its quests send at you (no
// bosses: no blade, no shield, nothing past 4 hp), not your own side's; the
// war's holder too, where it's your enemy; hired guns where there's nobody.
export function foesOf(site, effects = null) {
  const war = effects?.war ?? null;
  const yours = (kind) => Boolean(effects?.side && war && relation(sideOfKind(kind, war), effects.side, war) === 'ally');
  const seen = new Map();
  for (const q of site.quests ?? [])
    for (const st of q.steps)
      for (const sp of [].concat(st.spawn ?? [])) {
        const h = sp.hostile;
        if (!h || sp.side === 'yours' || h.melee || h.blade || h.shield || (sp.hp ?? 1) > 4 || !FOE_NAMES[sp.kind] || sp.level != null) continue;
        if (seen.has(sp.kind) || yours(sp.kind)) continue;
        seen.set(sp.kind, { kind: sp.kind, plural: FOE_NAMES[sp.kind], spawn: template(sp) });
      }
  const holder = effects?.owner && effects.owner !== 'hutt' && effects.side && relation(effects.owner, effects.side, war) === 'enemy' ? kindFor(effects.owner, () => 0) : null;
  if (holder) {
    const kind = dressOf(holder, site.uniforms ?? null);
    if (!seen.has(kind)) seen.set(kind, { kind, plural: FOE_NAMES[kind] ?? FOE_NAMES[holder] ?? 'soldiers', spawn: { kind, ...SOLDIER } });
  }
  if (!seen.size) seen.set('mercenary', { kind: 'mercenary', plural: FOE_NAMES.mercenary, spawn: { ...HIRED } });
  return [...seen.values()];
}

// where work can be: the world's places in range first, then open ground round you
function spotsFor(site, from, ok, rand) {
  const named = (site.places ?? []).filter((p) => p.at && dist(p.at, from) >= NEAR && dist(p.at, from) <= FAR && ok(p.at)).map((p) => ({ at: round(p.at), name: p.name ? inLine(p.name) : null }));
  const open = [];
  for (let i = 0; i < 40 && open.length < 8; i++) {
    const a = rand() * Math.PI * 2;
    const d = NEAR + rand() * (FAR - NEAR);
    const at = round([from[0] + Math.cos(a) * d, from[1] + Math.sin(a) * d]);
    if (ok(at)) open.push({ at, name: null });
  }
  return { named: shuffled(named, rand), open };
}

// a point round `at` that's ok, `r` metres off, else `at` itself
function near(at, r, ok, rand, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const a = rand() * Math.PI * 2;
    const p = round([at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r]);
    if (ok(p)) return p;
  }
  return at;
}

const bounty = ({ id, spot, foe, rand }) => {
  const n = 3 + Math.floor(rand() * 3);
  const where = spot.name ?? 'their camp';
  return {
    id,
    job: 'bounty',
    name: `Bounty: ${foe.plural}`,
    about: `${n} ${foe.plural} at ${where}. Bring them all down.`,
    pay: n >= 5 ? 2 : 1,
    intro: [[null, `A bounty’s come over the comm: ${n} ${foe.plural}, at ${where}.`]],
    steps: [{ type: 'shoot', tag: id, n, at: spot.at, text: `Bring down the ${foe.plural} at ${where}`, spawn: { ...foe.spawn, n, at: spot.at, spread: 12, roam: foe.spawn.roam ?? 8, tag: id } }],
    done: [[null, 'Bounty’s paid. The credits are in.']],
    reward: 'Bounty paid.',
  };
};

const salvage = ({ id, spot, foe, home, ok, rand }) => {
  const where = spot.name ?? 'a wreck';
  const n = 4;
  const spots = Array.from({ length: n }, () => near(spot.at, 5 + rand() * 11, ok, rand));
  const guarded = rand() < 0.5;
  const step = { type: 'collect', item: 'salvage', n, spots, at: spot.at, color: '#ffb34a', text: `Pick up the salvage at ${where}` };
  if (guarded) step.spawn = { ...foe.spawn, n: 2, at: near(spot.at, 14, ok, rand), spread: 6, roam: 6, tag: `${id}:guard` };
  return {
    id,
    job: 'salvage',
    name: `Salvage at ${where}`,
    about: guarded ? `Parts worth having at ${where}, and ${foe.plural} after them too. Bring them back to the ship.` : `Parts worth having, lying at ${where}. Bring them back to the ship.`,
    pay: guarded ? 2 : 1,
    intro: [[null, `There’s salvage at ${where}. Four crates of it.`]],
    steps: [step, { type: 'reach', at: home, r: 14, text: 'Bring it back to the ship' }],
    done: [[null, 'Salvage stowed. That’ll fetch a fair price.']],
    reward: 'Salvage sold.',
  };
};

const courier = ({ id, spot, home, ok, rand }) => {
  const where = spot.name ?? 'the drop point';
  const pick = near(home, 5, ok, rand);
  const time = Math.round(dist(pick, spot.at) / RUN + 25);
  return {
    id,
    job: 'courier',
    name: `Courier to ${where}`,
    about: `A parcel from by the ship to ${where}, in ${time} seconds. No questions.`,
    pay: dist(pick, spot.at) > 260 ? 2 : 1,
    intro: [[null, `A parcel’s waiting by the ship. ${upFront(where)}, and quick: ${time} seconds.`]],
    steps: [
      { type: 'collect', item: 'parcel', n: 1, spots: [pick], at: pick, color: '#7fd0ff', text: 'Pick up the parcel by the ship' },
      { type: 'reach', at: spot.at, r: 10, time, text: `Run it to ${where}` },
    ],
    done: [[null, 'Delivered. Nobody saw a thing.']],
    reward: 'Parcel delivered.',
  };
};

// a loop of gates from beside a speeder, out and round and back, every gate on ground that's ok
function loopOf(start, ok, rand) {
  for (let t = 0; t < 6; t++) {
    const r = 90 + rand() * 60;
    const a0 = rand() * Math.PI * 2;
    const centre = [start[0] + Math.cos(a0) * r, start[1] + Math.sin(a0) * r];
    const back = a0 + Math.PI; // (the start's bearing from the middle)
    const gates = [];
    for (let i = 1; i <= 6; i++) {
      const a = back + (i / 7) * Math.PI * 2;
      gates.push(round([centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r]));
    }
    gates.push(round(start));
    if (gates.every(ok)) return gates;
  }
  return null;
}

const race = ({ id, ride, ok, rand }) => {
  const gates = loopOf(near(ride.at, 18, ok, rand), ok, rand);
  if (!gates) return null;
  let length = 0;
  for (let i = 1; i < gates.length; i++) length += dist(gates[i - 1], gates[i]);
  const spec = RIDES[ride.kind];
  const time = Math.round(length / (spec.top * 0.62) + 8);
  return {
    id,
    job: 'race',
    name: `Speeder run`,
    about: `On ${spec.name}: ${gates.length} gates in ${time} seconds. There’s money on it.`,
    pay: 2,
    intro: [[null, `Someone’s put money on a run: ${gates.length} gates, ${time} seconds, on ${spec.name}.`]],
    steps: [
      { type: 'ride', kind: ride.kind, at: ride.at, text: `Get on ${spec.name}` },
      { type: 'race', ride: ride.kind, gates, r: 9, time, text: 'Through the gates before the time’s up' },
    ],
    done: [[null, 'Under the time. The bet’s yours.']],
    reward: 'The run paid.',
  };
};

const patrol = ({ id, spot, foe, home, ok, rand }) => {
  const where = spot.name ?? 'the far marker';
  const ambush = near(spot.at, 34, ok, rand);
  return {
    id,
    job: 'patrol',
    name: `Patrol to ${where}`,
    about: `Out to ${where} and back to the ship. Keep your eyes open.`,
    pay: 2,
    intro: [[null, `A patrol’s wanted: out to ${where} and back.`]],
    steps: [
      { type: 'reach', at: spot.at, r: 16, text: `Patrol out to ${where}` },
      { type: 'shoot', tag: id, n: 3, at: ambush, text: `Ambush! Bring down the ${foe.plural}`, lines: [[null, 'Contact! They were waiting for you.']], spawn: { ...foe.spawn, n: 3, at: ambush, spread: 8, roam: 6, tag: id, hostile: { ...foe.spawn.hostile, chase: Math.max(2, foe.spawn.hostile?.chase ?? 0), delay: 0.6 } } },
      { type: 'reach', at: home, r: 14, text: 'Back to the ship' },
    ],
    done: [[null, 'Patrol’s in. All quiet now.']],
    reward: 'Patrol paid.',
  };
};

const MAKE = { bounty, salvage, courier, race, patrol };

// A board of `n` jobs of as many kinds, from where you are.
export function jobBoard(site, { from, home = site.land?.at ?? from, ok = () => true, rand = Math.random, effects = null, n = 3, start = 0 } = {}) {
  if (!from) return [];
  const foes = foesOf(site, effects);
  const { named, open } = spotsFor(site, from, ok, rand);
  const speeders = (site.rides ?? []).filter((r) => SPEEDERS.has(r.kind) && r.at && dist(r.at, from) <= FAR && RIDES[r.kind]);
  const kinds = shuffled(
    KINDS.filter((k) => k !== 'race' || speeders.length),
    rand,
  );
  // (a gang camps and a wreck lies out on open ground; a parcel goes to a
  // place, and a patrol walks to one: each the first free of its own sort,
  // else of the other, a spot used once)
  const used = new Set();
  const take = (first, then) => {
    const spot = [...first, ...then].find((x) => !used.has(x));
    if (spot) used.add(spot);
    return spot ?? null;
  };
  const out = [];
  for (const kind of kinds) {
    if (out.length >= n) break;
    const spot = kind === 'race' ? null : OPEN_FIRST.has(kind) ? take(open, named) : take(named, open);
    if (kind !== 'race' && !spot) continue;
    const id = `job:${site.id ?? 'site'}:${start + out.length}`;
    const foe = foes[Math.floor(rand() * foes.length)];
    const ride = speeders[Math.floor(rand() * speeders.length)];
    const job = MAKE[kind]({ id, spot, foe, home, ok, rand, ride });
    if (!job) continue;
    out.push(job);
  }
  return out;
}
