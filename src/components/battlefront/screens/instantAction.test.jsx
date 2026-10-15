import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GS from '../../../data/bf2017/gameSettings.json';
import { optionsFor } from '../../../lib/battlefront/instantAction.js';
import { defaultsOf, rowsFor } from '../../../lib/battlefront/instantActionForm.js';
import { loadRulebook } from '../../../lib/battlefront/rulebook.js';
import InstantAction from './InstantAction.jsx';
import Play from './Play.jsx';
import { groupsOf, moveRow, wordsOf } from './useInstantAction';

const rb = loadRulebook();
const schema = optionsFor(GS, { rulebook: rb, level: 'hoth' });
const html = (el) => renderToStaticMarkup(el);

describe('Instant Action’s setup screen', () => {
  it('lists the game’s rows under its two headings, in its order, in its words', () => {
    const h = html(<InstantAction level="hoth" schema={schema} onBack={() => {}} />);
    expect(h).toContain('data-screen="UI/Frontend/Screens/Play/InstantAction/InstantActionSettingsScreen"');
    const ids = [...h.matchAll(/data-row="([^"]+)"/g)].map((m) => m[1]);
    // (the thirteen rows the running game draws, photographed 2026-10-13)
    expect(ids.slice(0, 13)).toEqual(['mode', 'level', 'difficulty', 'length', 'bpRate', 'bots.enemy', 'bots.friendly', 'heroes.enemyCount', 'heroes.friendlyCount', 'reinforcements.enemyCount', 'reinforcements.friendlyCount', 'vehicles.enemyCount', 'vehicles.friendlyCount']);
    expect(h.indexOf('GAME MODIFIERS')).toBeLessThan(h.indexOf('data-row="mode"'));
    expect(h.indexOf('ADVANCED SETTINGS')).toBeGreaterThan(h.indexOf('data-row="length"'));
    expect(h.indexOf('ADVANCED SETTINGS')).toBeLessThan(h.indexOf('data-row="bpRate"'));
    for (const w of ['MODE', 'LOCATION', 'AI DIFFICULTY', 'ROUND LENGTH', 'BATTLE POINTS', 'ENEMY AI COUNT', 'FRIENDLY VEHICLE COUNT', 'SUPREMACY', 'HOTH', 'ROOKIE', 'MEDIUM', 'DEFAULT']) expect(h, w).toContain(w);
    expect(h).toContain('INSTANT ACTION');
  });

  it('a choice is ◀ value ▶; a count is a slider with its number and the sim’s limits', () => {
    const h = html(<InstantAction level="hoth" schema={schema} />);
    expect(h).toMatch(/data-row="mode" data-kind="choice"[\s\S]*?◀[\s\S]*?SUPREMACY[\s\S]*?▶/);
    expect(h).toMatch(/data-row="bots\.enemy" data-kind="count"[\s\S]*?<input type="range" min="0" max="32" step="1"[^>]*value="20"/);
    expect(h).toMatch(/data-row="heroes\.enemyCount"[\s\S]*?max="4"[^>]*value="2"/);
  });

  it('the foot is the game’s: PLAY, RESET TO DEFAULTS, CHANGE FACTION, BACK; the side is the foot’s and not a row', () => {
    const h = html(<InstantAction level="hoth" schema={schema} onBack={() => {}} />);
    const foot = [...h.matchAll(/data-foot="([a-z]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
    expect(foot).toEqual([
      ['play', 'PLAY'],
      ['reset', 'RESET TO DEFAULTS'],
      ['faction', 'CHANGE FACTION'],
      ['back', 'BACK'],
    ]);
    expect(h).not.toContain('data-row="team"');
    expect(h).toContain('GALACTIC EMPIRE');
  });

  it('a row the world does not act on yet is dimmed; the Overhaul’s rows stand only when its bot logic is chosen', () => {
    const h = html(<InstantAction level="hoth" schema={schema} />);
    expect(h).toMatch(/data-row="vehicles\.enemyCount" data-kind="count" aria-disabled="true"/);
    expect(h).not.toMatch(/data-row="mode"[^>]*aria-disabled/);
    expect(h).not.toContain('data-row="overhaul.aim"');
    const rows = rowsFor(schema, { ...defaultsOf(schema), botLogic: 'overhaul' });
    expect(groupsOf(rows, { botLogic: 'overhaul' }).advanced.map((r) => r.id)).toContain('overhaul.aim');
    expect(groupsOf(rows, { botLogic: 'game' }).advanced.map((r) => r.id)).not.toContain('overhaul.aim');
  });

  it('the arrows move through the rows and stop at the ends; the screen’s words are the game’s', () => {
    expect(moveRow(['a', 'b', 'c'], 'a', 1)).toBe('b');
    expect(moveRow(['a', 'b', 'c'], 'c', 1)).toBe('c');
    expect(moveRow(['a', 'b', 'c'], 'a', -1)).toBe('a');
    expect(moveRow(['a', 'b', 'c'], 'zz', 1)).toBe('a');
    expect(wordsOf(rb)).toMatchObject({ modifiers: 'GAME MODIFIERS', advanced: 'ADVANCED SETTINGS', play: 'PLAY', reset: 'RESET TO DEFAULTS', faction: 'CHANGE FACTION' });
  });
});

describe('the way to it, as the game has it', () => {
  it('Play’s third tile is SINGLE PLAYER', () => {
    const h = html(<Play />);
    expect(h).toContain('SINGLE PLAYER');
    expect(h).toMatch(/data-tile="Campaign"/);
    // (it leads somewhere now: not greyed)
    expect(h).not.toMatch(/data-coming="true"[^>]*data-tile="Campaign"|data-tile="Campaign"[^>]*data-coming="true"/);
  });
  it('SINGLE PLAYER’s tiles are CAMPAIGN, INSTANT ACTION and ARCADE, and Instant Action is the one this world has', () => {
    const h = html(<Play at="single" onInstantAction={() => {}} />);
    expect(h).toContain('data-screen="UI/Frontend/Screens/Play/PlaySinglePlayerCategoryScreen"');
    for (const w of ['CAMPAIGN', 'INSTANT ACTION', 'ARCADE']) expect(h, w).toContain(w);
    expect(h).toMatch(/data-tile="Instant Action"/);
    const coming = [...h.matchAll(/<button[^>]*data-coming="true"[^>]*data-tile="([^"]+)"/g)].map((m) => m[1]);
    expect(coming.sort()).toEqual(['Arcade', 'Campaign']);
  });
});
