import { describe, expect, it } from 'vitest';
import { RULES, SOLDIERS, blastMission, blastView, chooseSide, deploy, hitSoldier, newBlast, stepBlast, youDown } from './blast';
import { GROUNDS, inside } from './arenas';
import { createSolids } from '../walker';

const env = () => ({ solids: createSolids(), reach: 0 });

describe('Blast', () => {
  it('has a mission on each world with both grounds, its two sides the world’s armies', () => {
    for (const w of GROUNDS) {
      const m = blastMission(w);
      expect(m).toMatchObject({ id: 'blast', kind: 'blast', system: w, achievement: 'blast' });
      expect(['rebels', 'republic']).toContain(m.sides.attack.id);
      expect(['empire', 'separatists']).toContain(m.sides.defend.id);
      const g = newBlast(m).blast.ground;
      for (const p of m.posts.filter((q) => q.fixed)) expect(inside(g.points, p.at[0], p.at[1]), `${w} ${p.id}`).toBe(true);
    }
  });

  it('counts a kill once, to the side that made it, yours and theirs', () => {
    const b = newBlast(blastMission('hoth'), { seed: 2 });
    chooseSide(b, 'attack');
    const foe = b.soldiers.find((s) => s.side === 'defend');
    hitSoldier(b, foe.id, 999);
    hitSoldier(b, foe.id, 999);
    expect(b.blast.kills).toEqual({ attack: 1, defend: 0 });
    expect(b.you.kills).toBe(1);
    deploy(b, 'lightspawn');
    expect(b.you.up).toBe(true);
    youDown(b);
    youDown(b);
    expect(b.blast.kills).toEqual({ attack: 1, defend: 1 });
    // (and the soldiers' own, through the battle's events)
    const was = b.blast.kills.attack + b.blast.kills.defend;
    const ev = stepBlast(b, 30, null, env());
    const n = ev.filter((e) => e.type === 'kill').length;
    expect(b.blast.kills.attack + b.blast.kills.defend).toBe(was + n);
  });

  it('ends at a hundred', () => {
    const b = newBlast(blastMission('endor'), { seed: 3 });
    chooseSide(b, 'defend');
    b.blast.kills.defend = RULES.kills - 1;
    const foe = b.soldiers.find((s) => s.side === 'attack' && s.up);
    hitSoldier(b, foe.id, 999);
    expect(b.result).toMatchObject({ won: true, why: 'kills' });
    expect(blastView(b)).toMatchObject({ phase: 'end', kills: { defend: RULES.kills }, goal: RULES.kills });
  });

  it('plays out with nobody playing inside fifteen minutes at the mid tier, on the ground', () => {
    for (const w of GROUNDS) {
      const b = newBlast(blastMission(w), { seed: 1, n: SOLDIERS.mid });
      chooseSide(b, null);
      let off = 0;
      while (!b.result && b.t < 900) {
        stepBlast(b, 0.5, null, env());
        for (const s of b.soldiers) if (s.up && !inside(b.blast.ground.points, s.x, s.z)) off += 1;
      }
      console.log(`blast ${w}: ${b.blast.kills.attack}–${b.blast.kills.defend} in ${Math.round(b.t)} s`);
      expect(b.result, w).toBeTruthy();
      expect(off, w).toBe(0);
    }
  });
});
