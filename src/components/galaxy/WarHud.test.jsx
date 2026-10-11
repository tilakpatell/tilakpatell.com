import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WarHud from './WarHud';

// (the war's table as useWar has it, set by each test)
const war = vi.hoisted(() => ({ now: 1_000_000, table: { systems: [] } }));
vi.mock('./useWar', () => ({ useWar: () => war }));

const NOW = 1_000_000;
const hoth = (battle) => ({ id: 'hoth', kind: 'evacuation', battle });
const oath = { war: 'gcw', side: 'rebel' };
const hud = (row, front = null) => {
  war.table = { systems: row ? [row] : [] };
  return renderToStaticMarkup(<WarHud sys="hoth" oath={oath} front={front} />);
};
// the battle here as warfront.js's info has it
const fighting = { id: 'c0.gcw.hoth.3', fighting: true, fightEnd: NOW + 125e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel', sides: ['rebel', 'empire'] };
const info = (o = {}) => ({
  sys: 'hoth',
  team: 0,
  side: 'rebel',
  on: { ...fighting, attackerTeam: 1 },
  laid: { attacker: 1, kind: 'evacuation' },
  stage: { index: 0, count: 3, open: true, opensIn: 0, need: 1 },
  objectives: [{ id: 'ion-cannon', name: 'Echo Base’s ion cannon', type: 'destroy', hp: 70, hpMax: 280, down: false }],
  next: { type: 'wave', at: 180, in: 40, name: 'the bomber wave' },
  result: null,
  ...o,
});

describe('the war’s line over the galaxy', () => {
  it('says the battle on here and your part in it, and its clock', () => {
    expect(hud(hoth({ fighting: true, fightEnd: NOW + 125e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel' }))).toContain('Hold the evacuation · 2:05 left');
  });
  it('says so in the lull between battles: regrouping, and when the next one’s on', () => {
    expect(hud(hoth({ fighting: false, fightEnd: NOW - 5e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel' }))).toContain('Evacuation: regrouping, the next in 4:05');
  });
  it('under it, the stage you’re at and what’s next, and a bar for each of the stage’s objectives (three at most)', () => {
    const out = hud(hoth(fighting), () => info());
    expect(out).toContain('Hold the evacuation · 2:05 left');
    expect(out).toContain('Stage 1 of 3 · Defend: Echo Base’s ion cannon');
    expect(out).toContain('Bomber wave in 0:40');
    expect(out).toContain('Echo Base’s ion cannon');
    expect(out).toMatch(/--k:\s*0\.25/);
    const five = Array.from({ length: 5 }, (_, n) => ({ id: `p${n}`, name: `Platform ${n}`, type: 'group', hp: 10, hpMax: 40, down: false }));
    expect((hud(hoth(fighting), () => info({ objectives: five })).match(/galaxy-warhud-bar"/g) ?? []).length).toBe(3);
  });
  it('after a battle decided early, who won here and when the next one’s on, and no stage', () => {
    const out = hud(hoth(fighting), () => info({ result: { winner: 1, why: 'flagship', at: 400, ago: 30, yours: { kills: 0, objectives: 0, intercepts: 0, points: 0 } } }));
    expect(out).toContain('Defeat at Hoth · next battle in 4:05');
    expect(out).not.toContain('Stage 1');
  });
  it('another system’s info (or none) leaves it at the one line', () => {
    expect(hud(hoth(fighting), () => info({ sys: 'yavin' }))).not.toContain('Stage');
    expect(hud(hoth(fighting), () => null)).toContain('Hold the evacuation · 2:05 left');
  });
  it('a battle the war table doesn’t have here (a dev hook’s, forced) still gets its lines, from the battle itself', () => {
    const forced = info({ on: { ...fighting, id: 'dev.gcw.hoth.1' }, laid: { attacker: 1, kind: 'siege' } });
    const out = hud(null, () => forced);
    expect(out).toContain('Hold the siege line · 2:05 left');
    expect(out).toContain('Stage 1 of 3');
  });
  it('in the lull after its fighting’s done, the regrouping line, whatever the battle kept from its start', () => {
    const late = { ...fighting, fightEnd: NOW - 5e3, fighting: true };
    expect(hud(hoth(late), () => info({ on: { ...late, attackerTeam: 1 } }))).toContain('Evacuation: regrouping, the next in 4:05');
  });
  it('marks the stage as the game’s objective bar does: attack or defend by your side, the lock while it has not opened, and the bars from the widgets', () => {
    const defending = hud(hoth(fighting), () => info());
    expect(defending).toContain('<use href="/ui/bf2017/ingame.svg#gamemode-gamemode-defend"');
    expect(defending).toContain('galaxy-warhud-mark');
    expect(hud(hoth(fighting), () => info({ team: 1 }))).toContain('<use href="/ui/bf2017/ingame.svg#gamemode-gamemode-attack"');
    expect(hud(hoth(fighting), () => info({ stage: { index: 1, count: 3, open: false, opensIn: 30, need: 1 } }))).toContain('<use href="/ui/bf2017/ingame.svg#gamemode-gamemode-lock"');
    // (nobody's side: no mark, the words alone)
    expect(hud(hoth(fighting), () => info({ team: null }))).not.toContain('<use href=');
    // (the bars keep their values; the line's words are as they were)
    expect(defending).toMatch(/--k:\s*0\.25/);
    expect(defending).toContain('Stage 1 of 3 · Defend: Echo Base’s ion cannon');
  });
  it('is nothing where there’s no battle', () => {
    expect(hud(hoth(null))).toBe('');
    expect(hud(null)).toBe('');
  });
});
