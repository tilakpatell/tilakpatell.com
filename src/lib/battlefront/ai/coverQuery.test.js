import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { field } from '../fixtures/field.js';
import { newSoldier } from '../soldier.js';
import { createBrain, think } from './soldierBrain.js';
import { queryFor, runQuery, unreadScores } from './coverQuery.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const nav = buildNav({ ...field(), cover: ai.cover.constants });
const open = buildNav({ heightAt: () => 0, bounds: { min: [-100, -100], max: [100, 100] }, cell: 2, solids: [], cover: ai.cover.constants });
const ctx = (over = {}) => ({ common: ai.coverScores, nav, me: [5, 0], meY: 0, threat: [10, -30], threatY: 1.2, enemies: [[10, -30]], friends: [], preferred: ai.weapons.AI_Rifle.preferredRange, ...over });

describe('cover queries in the game’s selection form', () => {
  it('maps the brain’s states to the tactics’ queries, the selection form first', () => {
    const t = ai.tactics.Rifleman_Tactics;
    expect(queryFor(ai, t, 'attack')).toBe(ai.coverQueries.AttackProtected_CoverQuery);
    expect(queryFor(ai, t, 'hide')).toBe(ai.coverQueries.Hide_Empire_Stormtrooper);
    // (a hide query in the older term form: the attack state's hide query stands in)
    expect(queryFor(ai, { queries: { 'hide.coverQuery': 'Attack_Rebel_Soldier', 'attack.hideCoverQuery': 'Hide_CoverQuery' } }, 'hide')).toBe(ai.coverQueries.Hide_CoverQuery);
    expect(queryFor(ai, t, 'flee')).toBe(ai.coverQueries.Flee_CoverQuery);
    expect(queryFor(ai, ai.skirmish.tactics.Heavy_PvE_Tactics, 'attack')).toBe(ai.coverQueries.Attack_PvE_CoverQuery);
    expect(queryFor(ai, ai.tactics.AIRebelSoldierTactics, 'attack')).toBe(null);
  });

  it('the hide query takes the spot out of the target’s line, the attack query the one with it', () => {
    const hide = runQuery(ai.coverQueries.Hide_PvE_CoverQuery, ctx());
    const attack = runQuery(ai.coverQueries.Attack_PvE_CoverQuery, ctx());
    expect(hide).not.toBe(null);
    expect(attack).not.toBe(null);
    // behind the 2 m wall no line over it; behind the 1.2 m crate a standing bot has one
    expect(hide.at[2]).toBeGreaterThan(19);
    expect(attack.at[2]).toBeLessThan(0);
    expect(shields(hide, ctx().threat) && shields(attack, ctx().threat)).toBe(true);
  });

  it('rejects a spot inside a reject curve: next to an enemy', () => {
    const spot = runQuery(ai.coverQueries.Attack_PvE_CoverQuery, ctx({ enemies: [[10, -30], [10, -8.5]] }));
    expect(spot === null || Math.hypot(spot.at[0] - 10, spot.at[2] + 8.5) > 1.5).toBe(true);
  });

  it('has nothing to offer with no spot in range, and the brain falls back to its own scorer and never stands still', () => {
    expect(runQuery(ai.coverQueries.Hide_CoverQuery, ctx({ nav: open }))).toBe(null);
    const cls = classOf(rb, 'l-orig-assault');
    const s = newSoldier(cls, { id: 'me', team: 1, at: [0, 0, -50], weapon: weaponOf(rb, cls.weapon), rand: seeded(1) });
    const b = createBrain(s, { ai, rand: seeded(1) });
    s.suppressed = 1;
    b.me.beliefs.them = { id: 'them', at: { x: 0, y: 1.2, z: -20 }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible: true, seenAt: 0, hostile: true };
    const i = think(b, { nav: open, lineClear: (a, c) => lineClear(open, a, c), shields, squad: null, objective: null, enemies: [[0, -20]], taken: new Map() }, 1);
    expect(i.mode).toBe('hide');
    expect(i.goal).not.toBe(null);
    expect(Math.hypot(i.goal[0] - 0, i.goal[1] + 50)).toBeGreaterThan(1);
  });

  it('counts the scores it does not read', () => {
    runQuery(ai.coverQueries.Flee_CoverQuery, ctx());
    expect(unreadScores.has('PathAvoidance')).toBe(true);
    expect(unreadScores.has('AngleToActor')).toBe(false);
  });

  it('a bot that has fled into the cover its query chose hides there, crouched, never standing in the open', () => {
    const cls = classOf(rb, 'l-orig-assault');
    const flee = ai.coverQueries[ai.tactics.Rifleman_Tactics.queries['flee.coverQuery']];
    // (walk the query to its own fixed point: the spot it keeps choosing from where it stands)
    let at = [0, 8];
    let spot = null;
    for (let i = 0; i < 20; i++) {
      spot = runQuery(flee, ctx({ me: at }));
      if (!spot || (spot.at[0] === at[0] && spot.at[2] === at[1])) break;
      at = [spot.at[0], spot.at[2]];
    }
    expect(spot).not.toBe(null);
    expect([spot.at[0], spot.at[2]]).toEqual(at);
    const s = newSoldier(cls, { id: 'me', team: 1, at: [spot.at[0], 0, spot.at[2]], weapon: weaponOf(rb, cls.weapon), rand: seeded(1) });
    const b = createBrain(s, { ai, rand: seeded(1) });
    b.me.beliefs.them = { id: 'them', at: { x: 10, y: 1.2, z: -30 }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible: true, seenAt: 0, hostile: true };
    const i = think(b, { nav, lineClear: (a, c) => lineClear(nav, a, c), shields, squad: { centre: [0, 10], posture: 'retreat' }, objective: null, enemies: [[10, -30]], taken: new Map() }, 1);
    expect(i.mode).toBe('hide');
    expect(i.stance).toBe('crouch');
  });
});
