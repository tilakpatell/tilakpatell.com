import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from '../theme/custom';
import { THEMES } from '../theme/themes';

// Every colour, light and dark: its inks read on its grounds (4.5:1), a
// button’s label on the button, and a ghost button’s edge stands out from the
// page (3:1). Tests run in node with no browser to ask, so this reads the
// shell’s eager sheets in the order main.jsx loads them and resolves the
// cascade itself: the house’s tokens (AWS’s, on :root), the colour’s, then in
// the dark the house’s dark block (which turns the accent into --saber) and
// the colour’s own. The visitor’s own colour is computed in theme/custom.js
// and leaves this out.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = ['index.css', 'styles/extras.css', 'styles/caribbean-themes.css', 'styles/middleearth-themes.css', 'styles/fan-dark-themes.css'].map(read).join('\n');

// (a statement before a rule, an @tailwind or an @import, ends at its ;)
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => [s.split(';').pop().trim(), b]);
const decls = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map(([, k, v]) => [k, v.trim()]));
const tokens = (selector) => Object.assign({}, ...rules.filter(([s]) => s === selector).map(([, b]) => decls(b)));
const resolve = (set) => {
  const value = (v, depth = 0) => (depth > 8 ? v : v.replace(/var\((--[\w-]+)\)/g, (_, k) => value(set[k] ?? '', depth + 1)));
  return Object.fromEntries(Object.entries(set).map(([k, v]) => [k, value(v)]));
};
const root = rules.find(([s]) => s === ':root')[1];
const page = (id, dark) =>
  resolve({
    ...decls(root),
    ...tokens(`[data-theme='${id}']`),
    ...(dark ? { ...tokens("html[data-mode='dark']"), ...tokens(`html[data-mode='dark'][data-theme='${id}']`) } : {}),
  });

const IDS = Object.keys(THEMES).filter((id) => id !== 'custom');
const CASES = IDS.flatMap((id) => [[id, 'light', false], [id, 'dark', true]]);
const INKS = ['--text', '--text-body', '--muted', '--accent-text'];
const GROUNDS = ['--bg', '--surface', '--surface-2'];

describe('every colour', () => {
  describe.each(CASES)('%s in %s', (id, _, dark) => {
    const t = page(id, dark);

    it.each(INKS.flatMap((ink) => GROUNDS.map((ground) => [ink, ground])))('%s reads on %s', (ink, ground) => {
      expect(contrast(t[ink], t[ground])).toBeGreaterThanOrEqual(4.5);
    });

    it('labels its buttons legibly', () => {
      expect(contrast(t['--btn-ink'], t['--btn-bg'])).toBeGreaterThanOrEqual(4.5);
    });

    it('edges a ghost button against the page', () => {
      expect(contrast(t['--border-strong'], t['--bg'])).toBeGreaterThanOrEqual(3);
    });
  });

  // a fan colour picked by an easter egg keeps its own ground at night,
  // rather than the house’s shared near-black
  it.each(IDS.filter((id) => THEMES[id].fan))('%s has a night of its own', (id) => {
    expect(tokens(`html[data-mode='dark'][data-theme='${id}']`)['--bg']).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
