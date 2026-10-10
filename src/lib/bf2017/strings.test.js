import { describe, expect, it } from 'vitest';
import { STRINGS, gameName, loadFamily, loadingTips, nameOf, text } from './strings';

const S = { ID_A: 'A280', ID_N: '{0:d} BATTLE POINTS', ID_F: '{0:f.2} m', ID_S: 'STARTING AS {0:s} IN {1:d}', ID_P: '%s has %d left', ID_HINT_ONE: 'Stay in cover when your health is low.', ID_HINT_KEY: 'Press %%JUMP%% to jump over the wall.', ID_HINT_SEQ: 'The First Order is never far behind you here.' };

describe('the 2017 game’s strings', () => {
  it('gives a key its text, its placeholders filled', () => {
    expect(text('ID_A', [], { strings: S })).toBe('A280');
    expect(text('ID_N', [12.4], { strings: S })).toBe('12 BATTLE POINTS');
    expect(text('ID_F', [3.14159], { strings: S })).toBe('3.14 m');
    expect(text('ID_S', ['LUKE', 3], { strings: S })).toBe('STARTING AS LUKE IN 3');
    expect(text('ID_P', ['Han', 2], { strings: S })).toBe('Han has 2 left');
  });

  it('gives a missing key the key itself, never undefined', () => {
    expect(text('ID_NOT_THERE', [], { strings: S })).toBe('ID_NOT_THERE');
    expect(text('ID_N', [], { strings: S })).toBe('{0:d} BATTLE POINTS');
  });

  it('names a rulebook row and the site’s things by the game’s text', () => {
    expect(nameOf({ id: 'a280', name: 'ID_A' }, { strings: S })).toBe('A280');
    expect(nameOf({ id: 'x', name: 'ID_GONE' }, { strings: S })).toBe('x');
    expect(gameName('hero:luke', 'Luke')).toBe(STRINGS.ID_CHAR_LUKE);
    expect(gameName('hero:rick', 'Rick Sanchez')).toBe('Rick Sanchez');
  });

  it('keeps lane 0’s rows and the galaxy’s families', () => {
    expect(STRINGS.ID_W_A280).toBe('A280');
    expect(STRINGS.ID_FANTASYBATTLES_HOTH_FUEL_SILO).toBe('FUEL PIPES');
    expect(Object.keys(STRINGS).length).toBeGreaterThan(900);
  });

  it('gives loading tips that read alone, none of the sequel era', () => {
    expect(loadingTips({ strings: S })).toEqual(['Stay in cover when your health is low.']);
    const tips = loadingTips();
    expect(tips.length).toBeGreaterThan(20);
    for (const t of tips) expect(t).not.toMatch(/%%|first order|resistance|kylo/i);
  });

  it('fetches a family’s whole table', async () => {
    const asked = [];
    const got = await loadFamily('HINT', async (url) => (asked.push(url), { ok: true, json: async () => ({ ID_HINT_ONE: 'x' }) }));
    expect(asked).toEqual(['/ui/bf2017/strings/hint.json']);
    expect(got.ID_HINT_ONE).toBe('x');
  });
});
