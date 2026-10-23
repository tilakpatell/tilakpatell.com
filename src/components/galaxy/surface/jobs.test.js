import { describe, expect, it } from 'vitest';
import { FAR, KINDS, NEAR, foesOf, jobBoard, jobsOn } from './jobs';
import { STEP_TYPES, feed, start } from './quests';
import { LANDABLE, siteOf } from './sites/index';
import { standable } from './sites/validity';
import { seeded } from '../../../lib/seeded';

const okOn = (site) => (p) => standable(site, p) && Math.hypot(p[0] - site.land.at[0], p[1] - site.land.at[1]) < (site.reach ?? 590) - 40;
const boardOf = (id, o = {}) => {
  const site = siteOf(id);
  return { site, board: jobBoard(site, { from: site.land.at, ok: okOn(site), rand: seeded(7), ...o }) };
};

describe('free roam’s jobs', () => {
  it('has work on every world you walk on, three jobs of three kinds, each a quest the scene can run', () => {
    for (const id of LANDABLE) {
      const site = siteOf(id);
      if (!jobsOn(site, null)) continue;
      const { board } = boardOf(id);
      expect(board.length, id).toBe(3);
      expect(new Set(board.map((j) => j.job)).size, id).toBe(3);
      for (const j of board) {
        expect(KINDS, id).toContain(j.job);
        expect(j.pay, id).toBeGreaterThanOrEqual(1);
        expect(j.name && j.about, id).toBeTruthy();
        for (const st of j.steps) {
          expect(STEP_TYPES, `${id} ${j.id}`).toContain(st.type);
          for (const sp of [].concat(st.spawn ?? [])) expect(standable(site, sp.at), `${id} ${j.id} spawn`).toBe(true);
        }
      }
    }
  });

  it('has none on a mission, or where there’s no ground', () => {
    expect(jobsOn(siteOf('tatooine'), { id: 'x' })).toBe(false);
    expect(jobsOn(siteOf('bespin'), null)).toBe(false);
  });

  it('gives every board new ids', () => {
    const a = boardOf('tatooine').board.map((j) => j.id);
    const b = boardOf('tatooine', { start: 3 }).board.map((j) => j.id);
    expect(new Set([...a, ...b]).size).toBe(6);
  });

  it('works between NEAR and FAR of you', () => {
    const { site, board } = boardOf('endor');
    for (const j of board)
      for (const st of j.steps) {
        if (st.type !== 'shoot' || !st.at) continue;
        const d = Math.hypot(st.at[0] - site.land.at[0], st.at[1] - site.land.at[1]);
        expect(d).toBeGreaterThanOrEqual(NEAR - 40);
        expect(d).toBeLessThanOrEqual(FAR + 40);
      }
  });

  it('camps a gang and leaves a wreck out on open ground, and sends a parcel or a patrol to a place', () => {
    const { site, board } = boardOf('tatooine', { n: 5 });
    const named = new Set(site.places.map((p) => p.at.map(Math.round).join()));
    const where = (j) => j.steps.find((st) => st.at)?.at.join();
    expect(named.has(where(board.find((j) => j.job === 'bounty')))).toBe(false);
    expect(named.has(where(board.find((j) => j.job === 'salvage')))).toBe(false);
    expect(board.find((j) => j.job === 'bounty').about).toContain('their camp');
    expect(named.has(board.find((j) => j.job === 'courier').steps[1].at.join())).toBe(true);
    expect(named.has(where(board.find((j) => j.job === 'patrol')))).toBe(true);
  });

  it('sends the world’s own gunmen, never its bosses, never your own side', () => {
    const tatooine = siteOf('tatooine');
    const kinds = foesOf(tatooine).map((f) => f.kind);
    expect(kinds).toContain('tusken');
    expect(kinds).toContain('stormtrooper');
    expect(kinds).not.toContain('rancor');
    expect(kinds).not.toContain('greedo');
    // (sworn to the Empire: no bounties on stormtroopers)
    expect(foesOf(tatooine, { side: 'empire', war: 'gcw', owner: 'empire' }).map((f) => f.kind)).not.toContain('stormtrooper');
    // (nobody of the world's own: hired guns)
    expect(foesOf(siteOf('hoth')).map((f) => f.kind)).toEqual(['mercenary']);
    // (the war's holder, where it's your enemy, in the world's own uniform)
    const hoth = foesOf(siteOf('hoth'), { side: 'rebel', war: 'gcw', owner: 'empire' });
    expect(hoth.map((f) => f.kind)).toContain(siteOf('hoth').uniforms?.stormtrooper ?? 'stormtrooper');
  });

  it('races on a world’s speeders only, through a loop back to the start', () => {
    expect(boardOf('hoth', { n: 5 }).board.some((j) => j.job === 'race')).toBe(false);
    const { board } = boardOf('endor', { n: 5 });
    const run = board.find((j) => j.job === 'race');
    expect(run).toBeTruthy();
    const [ride, gates] = run.steps;
    expect(ride.kind).toBe('speederbike');
    expect(gates.ride).toBe('speederbike');
    expect(gates.gates.length).toBe(7);
    expect(gates.time).toBeGreaterThan(10);
  });

  it('plays through: a salvage’s pickups, then home', () => {
    const { site, board } = boardOf('tatooine', { n: 5 });
    const job = board.find((j) => j.job === 'salvage');
    let p = start(job);
    const outs = [];
    for (let i = 0; i < job.steps[0].n; i++) {
      const r = feed(p, job, { type: 'pickup', item: 'salvage' });
      p = r.progress;
      outs.push(...r.out);
    }
    expect(outs.at(-1)).toEqual({ type: 'step', step: 1 });
    const end = feed(p, job, { type: 'at', x: site.land.at[0], z: site.land.at[1] });
    expect(end.out).toEqual([{ type: 'done' }]);
  });

  it('gives a courier longer the further it has to go', () => {
    const { board } = boardOf('naboo', { n: 5 });
    const job = board.find((j) => j.job === 'courier');
    const [pick, run] = job.steps;
    const d = Math.hypot(run.at[0] - pick.at[0], run.at[1] - pick.at[1]);
    expect(run.time).toBeGreaterThan(d / 7.4);
  });
});
