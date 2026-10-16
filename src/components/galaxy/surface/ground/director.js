// The director runs the ground war on a clock, round you: on a world the war
// is fighting over the other side raids from its far turf every so often (a
// squad of four sent at the nearest of the holder's posts); a post whose
// holders are all down is lost to whoever took it and, after a while, filled
// again by a squad that walks in from another post (never sent in within
// 60 m of you); on a world whose holder is your enemy, the first to have
// you calls in the nearest patrol, which hunts you till nobody has had you
// for a while. Each happening is an event, a toast's line at most every
// 12 s. Pure, tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 7.
//
// createDirector({ turfs, effects, tier, rand }) → { update(dt, { you,
//   population, seen, bolts }) → events, fights, posts }
//   population: { soldiers: Map<id, Soldier>, isDead(id), cellOf(x, z),
//   reinforce(key, specs) }; seen: someone has you ('!') this frame
//   events: { type: 'contact' | 'raid' | 'post-lost' | 'post-held' | 'hunt'
//   | 'calm', side, at, text | null }
//   posts: Map<key, { turf, at, holder, holders: [ids], lost, due, sent }>

import { relation, standingOf } from './standing';
import { kindFor } from './troops';
import { strengthOf } from './turf';

export const RAID = 150; // seconds between raids at full strength (÷ the far turf's)
export const REINFORCE = 120; // seconds till a lost post is filled again (÷ its turf's strength)
export const CALM = 20; // seconds nobody's had you before a hunt gives up
export const TOAST = 12; // seconds between the HUD's lines
export const AWAY = 60; // metres from you a reinforcement is sent in, at the least
const FIGHTS = 2; // squads engaged near you before a raid waits
const NEAR = 200; // metres round you a fight counts
const ARRIVED = 3; // metres from its post a reinforcement holds it
const CONTACT = 40; // metres: two enemy patrols this near have met
const MET = 60; // seconds two squads that met aren't said to meet again

// what a side's soldiers are called on the HUD
const THEM = { empire: 'Imperials', remnant: 'Imperials', rebel: 'Rebels', newrepublic: 'New Republic troops', republic: 'Clones', separatists: 'Droids', hutt: 'The Hutts’ men' };
const ONE = { empire: 'Imperial', remnant: 'Imperial', rebel: 'Rebel', newrepublic: 'New Republic', republic: 'Republic', separatists: 'Droid', hutt: 'Hutt' };
const compass = (at, centre) => {
  const a = Math.atan2(at[0] - centre[0], -(at[1] - centre[1]));
  return ['north', 'east', 'south', 'west'][((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4];
};

export function createDirector({ turfs, effects, tier = 'high', rand = Math.random }) {
  const war = effects?.war;
  const pad = turfs.find((t) => t.id === 'pad') ?? turfs[0] ?? null;
  const far = turfs.find((t) => t.id === 'far') ?? null;
  const enemyOf = (t) => turfs.find((o) => o !== t && relation(o.side, t.side, war) === 'enemy')?.side ?? effects?.side ?? null;
  const posts = new Map();
  for (const t of turfs)
    t.posts.forEach((at, i) => {
      const key = `${t.id}:p${i}`;
      posts.set(key, { key, turf: t, at, holder: t.side, holders: (tier === 'low' ? [0] : [0, 1]).map((k) => `${key}:${k}`), lost: false, due: 0, sent: false, n: 0 });
    });
  let clock = 0;
  let raidAt = far && (effects.front || effects.attack) ? RAID / Math.max(0.1, strengthOf(far, effects)) : Infinity;
  let raids = 0;
  let toastAt = -Infinity;
  let lastSeen = -Infinity;
  let hunting = null; // { id, beat }
  const met = new Map(); // `${a}|${b}` → when
  const hostile = effects?.side && standingOf(effects.owner, { side: effects.side, war }) === 'enemy';

  const say = (e, text) => {
    const ok = clock - toastAt >= TOAST;
    if (ok) toastAt = clock;
    return { ...e, text: ok ? text : null };
  };
  const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;

  const api = {
    posts,
    fights: 0,
    sizes: () => ({ met: met.size }),
    update(dt, { you, population, seen = false } = {}) {
      clock += dt;
      const events = [];
      const soldiers = population?.soldiers ?? new Map();
      const here = you ? [you.x, you.z] : [Infinity, Infinity];
      // the fights near you: squads with someone at grips
      const engaged = new Set();
      for (const s of soldiers.values()) if (s.alive && s.target && near([s.b.x, s.b.z], here, NEAR)) engaged.add(s.squad);
      api.fights = engaged.size;
      for (const [k, when] of met) if (clock - when >= MET) met.delete(k); // (forgotten after a while)
      // two enemy patrols in sight of each other
      const patrols = [...soldiers.values()].filter((s) => s.alive && (s.role === 'patrol' || s.role === 'raid'));
      for (let i = 0; i < patrols.length; i++)
        for (let j = i + 1; j < patrols.length; j++) {
          const a = patrols[i];
          const b = patrols[j];
          if (a.squad === b.squad || relation(a.side, b.side, war) !== 'enemy' || !near([a.b.x, a.b.z], [b.b.x, b.b.z], CONTACT)) continue;
          const key = [a.squad, b.squad].sort().join('|');
          if (clock - (met.get(key) ?? -Infinity) < MET) continue;
          met.set(key, clock);
          const mine = effects.side && relation(a.side, effects.side, war) === 'enemy' ? a : b;
          events.push(say({ type: 'contact', side: mine.side, at: [mine.b.x, mine.b.z] }, `${ONE[mine.side] ?? 'Enemy'} patrol ahead.`));
        }
      // a raid, on the clock, while the fights round you leave room for it
      if (clock >= raidAt && pad && api.fights < FIGHTS) {
        const owned = [...posts.values()].filter((p) => p.turf === pad && p.holder === pad.side);
        if (owned.length) {
          const dx = pad.at[0] - far.at[0];
          const dz = pad.at[1] - far.at[1];
          const l = Math.hypot(dx, dz) || 1;
          const edge = [far.at[0] + (dx / l) * far.r, far.at[1] + (dz / l) * far.r];
          const target = owned.reduce((best, p) => (Math.hypot(p.at[0] - edge[0], p.at[1] - edge[1]) < Math.hypot(best.at[0] - edge[0], best.at[1] - edge[1]) ? p : best));
          const id = `raid${++raids}`;
          const yaw = Math.atan2(target.at[0] - edge[0], target.at[1] - edge[1]);
          const specs = [0, 1, 2, 3].map((k) => ({ id: `${id}:${k}`, kind: kindFor(far.side, rand), side: far.side, role: 'raid', at: [+(edge[0] + (-dz / l) * (k - 1.5) * 2.5).toFixed(2), +(edge[1] + (dx / l) * (k - 1.5) * 2.5).toFixed(2)], yaw, home: target.at, beat: [target.at], turf: far.id, squad: id }));
          population?.reinforce(population.cellOf(edge[0], edge[1]), specs);
          events.push(say({ type: 'raid', side: far.side, at: edge }, `${THEM[far.side] ?? 'They'} are raiding the ${compass(target.at, pad.at)} post.`));
        }
        raidAt = clock + RAID / Math.max(0.1, strengthOf(far, effects));
      }
      // the posts: lost when everyone holding one is down, filled again by a squad that walks in
      for (const p of posts.values()) {
        const t = p.turf;
        if (!p.lost && p.holders.every((id) => population?.isDead(id))) {
          p.lost = true;
          p.sent = false;
          p.holder = enemyOf(t);
          p.due = clock + REINFORCE / Math.max(0.1, strengthOf(t, effects));
          events.push(say({ type: 'post-lost', side: p.holder, at: p.at }, `The ${compass(p.at, t.at)} post has fallen${p.holder && THEM[p.holder] ? ` to the ${THEM[p.holder].replace(/^The /, '')}` : ''}.`));
          continue;
        }
        if (p.lost && !p.sent && clock >= p.due) {
          // from the nearest of its turf's posts still held (or its middle), never in your lap
          const held = [...posts.values()].filter((o) => o !== p && o.turf === t && !o.lost);
          const from = held.length ? held.reduce((a, b) => (Math.hypot(b.at[0] - p.at[0], b.at[1] - p.at[1]) < Math.hypot(a.at[0] - p.at[0], a.at[1] - p.at[1]) ? b : a)).at : t.at;
          if (near(from, here, AWAY)) continue;
          p.n += 1;
          const squad = `${p.key}:r${p.n}`;
          const yaw = Math.atan2(p.at[0] - from[0], p.at[1] - from[1]);
          const specs = p.holders.map((_, k) => ({ id: `${squad}:${k}`, kind: kindFor(t.side, rand), side: t.side, role: 'post', at: [+(from[0] + k * 1.6).toFixed(2), +(from[1] + 1.5).toFixed(2)], yaw, home: p.at, beat: [p.at], turf: t.id, squad }));
          population?.reinforce(population.cellOf(from[0], from[1]), specs);
          p.holders = specs.map((s) => s.id);
          p.sent = true;
        }
        if (p.lost && p.sent && p.holders.some((id) => soldiers.get(id)?.alive && near([soldiers.get(id).b.x, soldiers.get(id).b.z], p.at, ARRIVED))) {
          p.lost = false;
          p.sent = false;
          p.holder = t.side;
          events.push(say({ type: 'post-held', side: t.side, at: p.at }, `The ${compass(p.at, t.at)} post is held again.`));
        }
      }
      // the hunt: seen on an enemy's world, the nearest patrol comes for you
      if (seen && hostile && you) {
        lastSeen = clock;
        if (!hunting) {
          let best = null;
          for (const s of soldiers.values()) {
            if (!s.alive || s.role !== 'patrol' || standingOf(s.side, { side: effects.side, war }) !== 'enemy') continue;
            if (!best || Math.hypot(s.b.x - you.x, s.b.z - you.z) < Math.hypot(best.b.x - you.x, best.b.z - you.z)) best = s;
          }
          if (best) {
            hunting = { id: best.id, beat: best.beat };
            events.push(say({ type: 'hunt', side: best.side, at: [best.b.x, best.b.z] }, `${ONE[best.side] ?? 'Enemy'} patrol coming for you.`));
          }
        }
        const h = hunting && soldiers.get(hunting.id);
        if (h) h.beat = [[you.x, you.z]];
      } else if (hunting && clock - lastSeen >= CALM) {
        const h = soldiers.get(hunting.id);
        if (h) h.beat = hunting.beat;
        events.push(say({ type: 'calm', side: h?.side ?? null, at: h ? [h.b.x, h.b.z] : null }, 'They’ve lost you.'));
        hunting = null;
      }
      return events;
    },
  };
  return api;
}
