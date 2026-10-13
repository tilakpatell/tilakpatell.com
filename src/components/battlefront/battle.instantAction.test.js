// The page's battle with an Instant Action round: the round is the sim's
// from its making, with its sizes, its rate, its caps and its waves.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { hothFlatNav } from '../../lib/battlefront/fixtures/hothFlat.js';
import { roundFor } from '../../lib/battlefront/instantAction.js';
import { loadRulebook } from '../../lib/battlefront/rulebook.js';
import { PLAYER_ID, addPlayer, createBattle, deploy, step, view } from './battle.js';

const rb = loadRulebook();
const TEAM = 2;
const battle = (choice = {}) => {
  const round = roundFor(gs, { level: 'hoth', mode: 'galacticAssault', team: TEAM, bots: { friendly: 3, enemy: 4 }, ...choice });
  const b = createBattle({ rulebook: rb, level: 'hoth', mode: 'galacticAssault', nav: hothFlatNav(rb), seed: 6, bots: round.bots, era: round.era, difficulty: round.difficulty, instantAction: round });
  return { b, round };
};

describe('the page’s battle on an Instant Action round', () => {
  it('has the round’s bots a side, as AutoPlayers on its numbers', () => {
    const { b, round } = battle({ difficulty: 'expert' });
    const bots = [...b.sim.entities.values()].filter((e) => e.bot);
    expect(bots.filter((e) => e.team === TEAM)).toHaveLength(3);
    expect(bots.filter((e) => e.team !== TEAM)).toHaveLength(4);
    expect(bots.every((e) => e.brain.ap === round.ap[e.team])).toBe(true);
    expect(b.sim.difficulty.key).toBe('multiplayer:expert');
  });

  it('runs the mode with the round’s rate, caps and waves', () => {
    const { b, round } = battle({ bpRate: 'fast', heroes: { enemy: false } });
    expect(b.sim.ga).toBeTruthy();
    expect(b.sim.bp.rate).toBe(2);
    expect(b.sim.commanders[3 - TEAM].caps.heroes).toBe(0);
    expect(b.sim.waves[TEAM].table).toBe(round.wavesBy[b.sim.M.sideOf(b.sim.ga, TEAM)][0]);
  });

  it('the deploy screen is offered what can be deployed: no vehicle while none can', () => {
    const { b } = battle();
    addPlayer(b, { team: TEAM });
    const kinds = new Set(view(b).deploy.offers.map((o) => o.kind));
    expect(kinds.has('class') && kinds.has('hero') && kinds.has('reinforcement')).toBe(true);
    expect(kinds.has('vehicle')).toBe(false);
  });

  it('the player deploys into it and the round goes on', () => {
    const { b } = battle();
    addPlayer(b, { team: TEAM });
    for (let i = 0; i < 20 && !view(b).deploy.open; i++) step(b, []);
    expect(deploy(b, PLAYER_ID, {}).ok).toBe(true);
    for (let i = 0; i < 40; i++) step(b, [{ id: 'player', move: [0, 1], yaw: 0, pitch: 0 }]);
    expect(view(b).player.state).toBe('alive');
    expect(view(b).mode.tickets).toBeTruthy();
  });
});
