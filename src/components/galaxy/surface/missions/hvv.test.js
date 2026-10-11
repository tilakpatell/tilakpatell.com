import { describe, expect, it } from 'vitest';
import { GUNS, HVV_HEROES, RULES, canDeploy, chooseSide, deploy, hitFighter, hvvMission, hvvView, newHvv, stepHvv, youDown } from './hvv';
import { GROUNDS, groundFor, inside } from './arenas';
import WEAPONS from '../../../../data/bf2017/weapons.json';
import ABILITIES from '../../../../data/bf2017Abilities.json';
import { saberOf } from '../../../../lib/combat/saber2017';

const hoth = () => groundFor('hoth', 'hvv');
const target = (b, side) => b.fighters[b.targets[side]];

describe('Heroes vs Villains', () => {
  it('fields the thirteen 2017 heroes by their lean, at the game’s hit points', () => {
    expect(HVV_HEROES.map((h) => h.id).sort()).toEqual(['anakin', 'bobafett', 'bossk', 'chewie', 'dooku', 'han', 'lando', 'leia', 'luke', 'maul', 'obiwan', 'palpatine', 'vader']);
    const b = newHvv(hoth(), { seed: 3 });
    chooseSide(b, 'light', 'luke');
    expect(b.fighters).toHaveLength(8);
    expect(b.fighters.filter((f) => f.side === 'light')).toHaveLength(4);
    for (const f of b.fighters) {
      expect(HVV_HEROES.find((h) => h.id === f.hero).lean).toBe(f.side);
      expect(f.max).toBe(ABILITIES.heroes[f.hero].health);
    }
    expect(b.fighters[b.you.id]).toMatchObject({ hero: 'luke', you: true, up: false });
  });

  it('reads each blaster hero’s gun from the rulebook', () => {
    for (const g of Object.values(GUNS)) {
      const w = WEAPONS.rows[g.row];
      expect(g.perMinute).toBe(w.firing.burstsPerMinute ?? w.firing.rof);
      expect(g.burst).toBe(w.firing.burst ?? 1);
      expect([g.start, g.end, g.near, g.far]).toEqual([w.damage.start, w.damage.end, w.damage.startDistance, w.damage.endDistance]);
    }
    for (const h of HVV_HEROES) if (h.weapon !== 'saber') expect(GUNS[h.id], h.id).toBeTruthy();
  });

  it('scores a target’s death and not anyone else’s, and draws the next target', () => {
    const b = newHvv(hoth(), { seed: 5 });
    chooseSide(b, 'light', 'luke');
    const theirs = target(b, 'dark');
    const other = b.fighters.find((f) => f.side === 'dark' && f.id !== theirs.id);
    expect(hitFighter(b, other.id, 9999)).toMatchObject({ type: 'down', target: false });
    expect(b.score).toEqual({ light: 0, dark: 0 });
    expect(hitFighter(b, theirs.id, 9999)).toMatchObject({ type: 'down', target: true });
    expect(b.score).toEqual({ light: 1, dark: 0 });
    expect(b.targets.dark).not.toBe(theirs.id);
    expect(b.fighters[b.targets.dark].up).toBe(true);
    // (and a target that's only hurt scores nothing)
    hitFighter(b, b.targets.dark, 10);
    expect(b.score.light).toBe(1);
  });

  it('scores for them when you are your side’s target and you go down', () => {
    const b = newHvv(hoth(), { seed: 2 });
    chooseSide(b, 'dark', 'vader');
    deploy(b);
    b.targets.dark = b.you.id;
    youDown(b);
    expect(b.score.light).toBe(1);
    expect(b.targets.dark).not.toBe(b.you.id);
  });

  it('ends when a side reaches ten', () => {
    const b = newHvv(hoth(), { seed: 7 });
    chooseSide(b, 'light', 'han');
    // (a side down to nobody comes back after the wait, its target among them)
    for (let i = 0; i < 40 && !b.result; i++) {
      if (!hitFighter(b, b.targets.dark, 9999)) stepHvv(b, RULES.respawn + 0.1);
    }
    expect(b.score.light).toBe(RULES.points);
    expect(b.result).toMatchObject({ won: true, why: 'points', side: 'light' });
    expect(hvvView(b).phase).toBe('end');
  });

  it('brings you back only after the respawn wait, and puts you down after ten seconds out of bounds', () => {
    const g = hoth();
    const b = newHvv(g, { seed: 4 });
    chooseSide(b, 'light', 'obiwan');
    expect(canDeploy(b)).toBe(true);
    const at = deploy(b);
    expect(inside(g.points, at.x, at.z)).toBe(true);
    youDown(b);
    expect(canDeploy(b)).toBe(false);
    stepHvv(b, RULES.respawn + 0.1, null);
    expect(canDeploy(b)).toBe(true);
    deploy(b);
    const outside = { x: g.bounds.max[0] + 30, z: g.bounds.max[1] + 30 };
    stepHvv(b, RULES.oob - 1, outside);
    expect(b.fighters[b.you.id].up).toBe(true);
    expect(hvvView(b).you.out).toBeGreaterThan(0);
    const ev = stepHvv(b, 1.2, outside);
    expect(ev.some((e) => e.type === 'oob')).toBe(true);
    expect(b.fighters[b.you.id].up).toBe(false);
  });

  it('plays out with nobody playing inside ten minutes, nobody leaving the arena', () => {
    for (const seed of [1, 2, 3]) {
      const g = hoth();
      const b = newHvv(g, { seed });
      chooseSide(b, null, null);
      let left = 0;
      while (!b.result && b.t < 600) {
        stepHvv(b, 0.5);
        for (const f of b.fighters) if (f.up && !inside(g.points, f.x, f.z)) left += 1;
      }
      expect(b.result, `seed ${seed}`).toBeTruthy();
      expect(Math.max(b.score.light, b.score.dark)).toBe(RULES.points);
      expect(left).toBe(0);
      console.log(`hvv seed ${seed}: ${b.score.light}–${b.score.dark} in ${Math.round(b.t)} s`);
    }
  });

  it('fences its saber bots on the saber engine: what a strike lands is the hero’s own rule, and blocks are met', () => {
    const b = newHvv(hoth(), { seed: 4 });
    chooseSide(b, null, null);
    const hits = [];
    let blocks = 0;
    let turned = 0;
    while (!b.result && b.t < 300)
      for (const e of stepHvv(b, 0.1)) {
        if (e.type === 'block') blocks += 1;
        if (e.turned) turned += 1;
        const f = b.fighters[e.id];
        if (e.type === 'hit' && e.melee && f?.saber) hits.push({ hero: f.hero, damage: e.damage });
      }
    expect(hits.length).toBeGreaterThan(2);
    expect(blocks + turned).toBeGreaterThan(0);
    for (const h of hits) {
      const d = saberOf(h.hero).damage;
      const can = [d.hit.damage, d.hit.damage + (d.behind?.damage ?? 0)].flatMap((n) => [n, n * saberOf('luke').evading.taken]);
      expect(can.some((n) => Math.abs(n - h.damage) < 1e-6), `${h.hero} ${h.damage}`).toBe(true);
    }
  });

  it('has a mission on each world with both grounds', () => {
    for (const w of GROUNDS) expect(hvvMission(w)).toMatchObject({ id: 'hvv', kind: 'hvv', system: w, achievement: 'heroesvsvillains' });
  });

  it('takes a difficulty: its aim and its damage to you, and nothing else of the bots changes', () => {
    // (the difficulty row as lib/battlefront/ai/difficulty.js gives it: rookie's numbers)
    const rookie = { key: 'multiplayer:rookie', aim: { scale: 1.5 }, damage: 0.75 };
    const run = (difficulty) => {
      const b = newHvv(hoth(), { seed: 4, difficulty });
      chooseSide(b, 'dark', 'vader');
      deploy(b);
      const shots = [];
      // (you stand beside the light side's first hero, in their fight)
      for (let i = 0; i < 1200 && shots.length < 12; i++) for (const e of stepHvv(b, 0.05, { x: b.fighters[0].x + 3, z: b.fighters[0].z })) if (e.type === 'shot' || (e.type === 'hit' && e.you)) shots.push(e);
      return { b, shots };
    };
    const plain = run(null);
    const easy = run(rookie);
    expect(easy.b.difficulty).toBe(rookie);
    const mine = (r) => r.shots.filter((e) => e.atYou || e.you);
    expect(mine(plain).length).toBeGreaterThan(0);
    expect(mine(easy).length).toBeGreaterThan(0);
    for (const e of mine(easy)) expect(e.damage).toBe(Math.round(e.full * 0.75));
    for (const e of mine(plain)) expect(e.damage).toBe(e.full);
  });
});
