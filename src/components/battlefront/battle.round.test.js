// A round begun in place: the page's battle made again for the round, on
// the level of the world that holds the round's mode and on the same
// navgrid, with the side the round chose.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { hothFlatNav } from '../../lib/battlefront/fixtures/hothFlat.js';
import { roundFor } from '../../lib/battlefront/instantAction.js';
import { levelForMode, loadLevel, loadRulebook } from '../../lib/battlefront/rulebook.js';
import { PLAYER_ID, addPlayer, createBattle, deploy, roundBattle, step, view } from './battle.js';

const rb = loadRulebook();
await loadLevel('hoth_02');
const first = () => createBattle({ rulebook: rb, level: 'hoth', mode: 'galacticAssault', nav: hothFlatNav(rb), seed: 6 });
const round = (choice = {}) => roundFor(gs, { level: 'hoth', mode: 'galacticAssault', team: 2, bots: { friendly: 3, enemy: 5 }, ...choice });

describe('the level of a world that holds a mode', () => {
  it('is the level itself where it does, else its world’s that does: Hoth’s Supremacy is its second level’s', () => {
    expect(levelForMode(rb, 'hoth', 'galacticAssault')).toBe('hoth_01');
    expect(levelForMode(rb, 'hoth', 'supremacy')).toBe('hoth_02');
    expect(levelForMode(rb, 'hoth_02', 'galacticAssault')).toBe('hoth_01');
    expect(levelForMode(rb, 'hoth', 'no such mode')).toBe('hoth_01');
  });
});

describe('a round’s battle made beside the page’s', () => {
  it('has the round’s sides and numbers, on the first battle’s navgrid', () => {
    const b = first();
    const r = round({ difficulty: 'expert' });
    const next = roundBattle(b, r);
    expect(next).not.toBe(b);
    expect(next.nav).toBe(b.nav);
    const bots = [...next.sim.entities.values()].filter((e) => e.bot && e.kind === 'soldier');
    expect(bots.filter((e) => e.team === 2)).toHaveLength(3);
    expect(bots.filter((e) => e.team === 1)).toHaveLength(5);
    expect(next.sim.instantAction).toBe(r);
    expect(next.sim.difficulty.key).toBe('multiplayer:expert');
    expect(next.mode).toBe('galacticAssault');
  });

  it('leaves the first battle as it was', () => {
    const b = first();
    const before = b.sim.entities.size;
    roundBattle(b, round());
    expect(b.sim.entities.size).toBe(before);
    expect(b.sim.instantAction).toBeNull();
  });

  it('plays Supremacy on the world’s Supremacy level, with the world’s own sides', () => {
    const b = first();
    const next = roundBattle(b, round({ mode: 'supremacy', length: 'short' }));
    expect(next.mode).toBe('supremacy');
    expect(next.level).toBe('hoth_02');
    expect(next.sides).toEqual(b.sides);
    expect(next.sim.ga.objectives).toHaveLength(5);
    expect(next.sim.ga.tickets).toEqual({ attack: 50, defend: 50 });
    expect(next.sim.botLogic[1]).toBeTruthy();
    // (the same world: the same grid serves)
    expect(next.nav).toBe(b.nav);
  });

  it('gives the HUD’s bar one number in Supremacy too: the player’s side’s reinforcements, both sides’ beside it', () => {
    const b = first();
    const next = roundBattle(b, round({ mode: 'supremacy', length: 'short' }));
    addPlayer(next, { team: 2 });
    const side = next.sim.M.sideOf(next.sim.ga, 2);
    next.sim.ga.tickets[side] = 37;
    const m = view(next).mode;
    expect(m.tickets).toBe(37);
    expect(m.ticketsBySide).toEqual(next.sim.ga.tickets);
    // (Galactic Assault's is the one number it always was)
    expect(typeof view(b).mode.tickets).toBe('number');
    expect(view(b).mode.ticketsBySide).toBeNull();
  });

  it('takes a player on the side the round chose, who deploys and plays', () => {
    const b = first();
    const next = roundBattle(b, round({ team: 1 }));
    addPlayer(next, { team: 1 });
    for (let i = 0; i < 20 && !view(next).deploy.open; i++) step(next, []);
    expect(view(next).deploy.team).toBe(1);
    expect(view(next).deploy.offers.some((o) => o.kind === 'class' && o.id.startsWith('l-'))).toBe(true);
    expect(deploy(next, PLAYER_ID, {}).ok).toBe(true);
    for (let i = 0; i < 40; i++) step(next, [{ id: 'player', move: [0, 1], yaw: 0, pitch: 0 }]);
    expect(view(next).player).toMatchObject({ state: 'alive', team: 1 });
  });
});
