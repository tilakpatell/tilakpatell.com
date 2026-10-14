import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { seededRand } from './battleKit';
import { TACTICS } from './battleTactics';
import { WARS } from './wars';

// The galaxy's battles fly their fighters with tactics (createBattle's
// `tactics`): a fighter commits to what it's after, a bomber to its run,
// interceptors share the bombers out, and with nothing to dogfight a
// fighter strafes the other side's batteries. The universe map's wars
// (front.js) don't ask for it, and fly as they always have.
const war = WARS.starwars;
const make = (o = {}) => createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 10, rand: seededRand('tactics'), tickets: false, tactics: true, ...o });
const step = 1 / 30;
// each step, `look(b, t)` (t: seconds since the start)
const watch = (b, seconds, look) => {
  for (let i = 0, n = Math.round(seconds / step); i < n && !b.over; i++) {
    b.update(step, null);
    look(b, (i + 1) * step);
  }
};
const isFighter = (t) => t && t.team !== undefined && t.type;

describe('a fighter’s commitment (tactics)', () => {
  it('a dogfighter sticks with what it’s after: no more than a switch every four seconds, well under the untactical AI’s rate', () => {
    // (on a war of the war's own numbers: on the game's, a fighter outlives
    // what it switches from far more often than its 5 hp did, and the count
    // below reads that as switching, the untactical AI's and the flights' alike)
    const rate = (tactics) => {
      const b = make({ war: WARS.rickmorty, tactics, perSide: 10 });
      const prev = new Map();
      let switches = 0;
      let alive = 0;
      watch(b, 60, () => {
        for (const f of b.fighters) {
          if (!f.alive || f.role === 'bomber') {
            prev.delete(f);
            continue;
          }
          alive += step;
          const was = prev.get(f);
          // (a switch: from one still there to another, not a new one for one that's gone)
          if (was && f.target && f.target !== was && (was === b.you ? false : was.alive)) switches += 1;
          prev.set(f, f.target);
        }
      });
      return switches / alive;
    };
    const old = rate(false);
    const now = rate(true);
    expect(now).toBeLessThanOrEqual(0.25);
    // (counted as here, from one still there to another, the untactical AI
    // switched about 0.19 a second; a flight's wingmen now follow their
    // leader's switches and whoever gets on its tail, so not quite half)
    expect(now).toBeLessThan(old * 0.6);
  });

  it('a bomber keeps its run’s target till its torpedo’s away or the target’s gone: two switches a life at most', () => {
    for (const attacker of [0, 1]) {
      const b = make({ attacker });
      const fired = new Set(); // bombers that loosed a torpedo since they last chose
      const fire = b.fire;
      b.fire = (team, from, dir, kind, target) => {
        if (kind === 'torpedo') for (const f of b.fighters) if (f.pos === from) fired.add(f);
        return fire(team, from, dir, kind, target);
      };
      const prev = new Map();
      const lives = new Map();
      let worst = 0;
      watch(b, 120, () => {
        for (const f of b.fighters) {
          if (f.role !== 'bomber') continue;
          if (!f.alive) {
            prev.delete(f);
            lives.delete(f);
            continue;
          }
          const was = prev.get(f);
          if (was && f.target && f.target !== was) {
            if (was.alive !== false && !fired.has(f)) lives.set(f, (lives.get(f) ?? 0) + 1);
            fired.delete(f);
          }
          worst = Math.max(worst, lives.get(f) ?? 0);
          prev.set(f, f.target);
        }
      });
      expect(worst, `attacker ${attacker}`).toBeLessThanOrEqual(2);
    }
  });

  it('gets both sides’ bombers in: each looses fifteen torpedoes or more in the first three minutes, and an Imperial bomber lives ten seconds or more', () => {
    for (const attacker of [0, 1]) {
      const b = make({ attacker, perSide: 10 });
      const torpedoes = [0, 0];
      const fire = b.fire;
      b.fire = (team, from, dir, kind, target) => {
        if (kind === 'torpedo') torpedoes[team] += 1;
        return fire(team, from, dir, kind, target);
      };
      const born = new Map();
      const lives = [];
      watch(b, 180, (bb, t) => {
        for (const f of bb.fighters) {
          if (f.team !== 1 || f.role !== 'bomber') continue;
          if (f.alive && !born.has(f)) born.set(f, t);
          else if (!f.alive && born.has(f)) {
            lives.push(t - born.get(f));
            born.delete(f);
          }
        }
      });
      expect(torpedoes[0], `Rebel torpedoes, attacker ${attacker}`).toBeGreaterThanOrEqual(15);
      expect(torpedoes[1], `Imperial torpedoes, attacker ${attacker}`).toBeGreaterThanOrEqual(15);
      lives.sort((p, q) => p - q);
      if (lives.length) expect(lives[Math.floor(lives.length / 2)], `Imperial bomber life, attacker ${attacker}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('shares the bombers out among the interceptors: never more than three after one bomber', () => {
    const b = make({ perSide: 12 });
    let worst = 0;
    watch(b, 90, () => {
      const on = new Map();
      for (const f of b.fighters) if (f.alive && f.role === 'interceptor' && isFighter(f.target) && f.target.role === 'bomber') on.set(f.target, (on.get(f.target) ?? 0) + 1);
      for (const n of on.values()) worst = Math.max(worst, n);
    });
    expect(worst).toBeLessThanOrEqual(TACTICS.intercepts);
    expect(TACTICS.intercepts).toBe(3);
    expect(TACTICS.bombers).toBe(0.35);
  });

  it('with the other side’s fighters all down, strafes its batteries and objectives instead of circling the middle', () => {
    const b = make({ perSide: 4, tickets: true });
    b.teams[1].tickets = 0;
    for (const f of b.fighters) if (f.team === 1) (f.alive = false), (f.respawn = Infinity);
    const idle = new Map();
    let worst = 0;
    watch(b, 40, () => {
      for (const f of b.fighters) {
        if (!f.alive || f.team !== 0) continue;
        // (since the flights, battleFlights.js, a fighter going home hurt, or
        // an escort keeping by its bombers, has somewhere to be: that's not
        // idling round the middle)
        const has = (f.target && f.target.alive !== false) || f.mode === 'rtb' || (f.flight?.escorting && f.station);
        idle.set(f, has ? 0 : (idle.get(f) ?? 0) + step);
        worst = Math.max(worst, idle.get(f));
      }
    });
    expect(worst).toBeLessThanOrEqual(3);
    // (a battery's hit points its turret's record's, the game's: below them, it's been strafed)
    const turrets = b.capitals.filter((c) => c.team === 1).flatMap((c) => c.turrets);
    expect(turrets.some((t) => !t.alive || t.hp < t.hpMax)).toBe(true);
  });

  it('is the galaxy’s to ask for: a battle without tactics flies as it always has', () => {
    const plain = createBattle({ war, attacker: 0, perSide: 6, rand: seededRand('plain') });
    const same = createBattle({ war, attacker: 0, perSide: 6, rand: seededRand('plain'), tactics: false });
    for (let i = 0; i < 300; i++) {
      plain.update(step, null);
      same.update(step, null);
    }
    expect(same.fighters.map((f) => [f.pos.x, f.pos.z])).toEqual(plain.fighters.map((f) => [f.pos.x, f.pos.z]));
  });

  it('flies 64 fighters a frame with tactics quickly enough', () => {
    const b = make({ perSide: 32 });
    const t0 = performance.now();
    for (let i = 0; i < 1200; i++) b.update(1 / 60, { x: 0, y: 0, z: 0, alive: true });
    expect(performance.now() - t0).toBeLessThan(4000);
  });

  it('stays under the health check’s warning line', () => {
    const lines = readFileSync(new URL('./battleTactics.js', import.meta.url), 'utf8').split('\n').length;
    expect(lines).toBeLessThan(800);
  });
});
