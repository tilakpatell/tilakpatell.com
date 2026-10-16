// Hero bots: a saber hero runs its mark down and fences; a blaster hero shoots; both use their abilities.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../rulebook.js';
import { buildNav } from '../nav.js';
import { field } from '../fixtures/field.js';
import { addPlayer, createSim, step } from '../sim.js';

const rb = loadRulebook();
const nav = buildNav(field());
const run = (sim, seconds) => {
  const ev = [];
  for (let i = 0; i < seconds / 0.05; i++) ev.push(...step(sim));
  return ev;
};

describe('a hero bot', () => {
  it('Luke runs down three troopers and cuts them, using his abilities on the way', () => {
    const sim = createSim({ rulebook: rb, nav, seed: 5 });
    const luke = addPlayer(sim, { team: 1, hero: 'luke', at: [-60, 0, -60], bot: true });
    for (let i = 0; i < 3; i++) addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [-48 + i * 2, 0, -50], yaw: Math.PI, bot: true });
    const ev = run(sim, 60);
    const kills = ev.filter((e) => e.type === 'kill' && e.by === luke);
    expect(kills.length).toBeGreaterThanOrEqual(2);
    expect(ev.some((e) => e.type === 'hit' && e.by === luke && e.part === 'saber')).toBe(true);
    expect(ev.some((e) => e.type === 'ability' && e.by === luke && e.phase === 'start' && e.slot >= 1)).toBe(true);
  });

  it('Han shoots his DL-44 at a trooper, uses his abilities, and brings him down', () => {
    const sim = createSim({ rulebook: rb, nav, seed: 2 });
    const han = addPlayer(sim, { team: 1, hero: 'hansolo', at: [-60, 0, -60], bot: true });
    addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [-60, 0, -40], yaw: Math.PI, bot: true });
    const ev = run(sim, 30);
    expect(ev.some((e) => e.type === 'shot' && e.by === han)).toBe(true);
    expect(ev.some((e) => e.type === 'ability' && e.by === han && e.phase === 'start' && e.slot >= 1)).toBe(true);
    expect(ev.some((e) => e.type === 'kill' && e.by === han)).toBe(true);
  });

  it('two saber bots fight to a finish: Vader against Luke', () => {
    const sim = createSim({ rulebook: rb, nav, seed: 11 });
    const luke = addPlayer(sim, { team: 1, hero: 'luke', at: [-60, 0, -60], bot: true });
    const vader = addPlayer(sim, { team: 2, hero: 'darthvader', at: [-60, 0, -48], yaw: Math.PI, bot: true });
    const ev = run(sim, 120);
    expect(ev.some((e) => e.type === 'kill' && (e.target === luke || e.target === vader))).toBe(true);
  });
});
