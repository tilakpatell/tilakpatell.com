import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from '../theme/custom';

// The Shire and Mordor, light and dark: every ink reads on every ground it
// sits on (4.5:1), a button's label on the button, and a ghost button's edge
// and the accent stand out from the page (3:1). Tests run in node, with no
// browser to ask, so this reads the sheets and orders them as the cascade
// does: the house's tokens, the colour's, then in the dark the house's dark
// block (which would turn the accent into --saber) and the colour's own.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('styles/middleearth-themes.css');
const house = read('index.css');

// every flat rule as [selector, body]; a rule inside @media comes out too, so
// a block is found by its whole selector, never by a piece of it (a statement
// before a rule, index.css’s @tailwind lines before its :root, ends at its ;)
const rules = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => [s.split(';').pop().trim(), b]);
const decls = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map(([, k, v]) => [k, v.trim()]));
const tokens = (css, selector) => Object.assign({}, ...rules(css).filter(([s]) => s === selector).map(([, b]) => decls(b)));
const resolve = (set) => {
  const value = (v, depth = 0) => (depth > 8 ? v : v.replace(/var\((--[\w-]+)\)/g, (_, k) => value(set[k] ?? '', depth + 1)));
  return Object.fromEntries(Object.entries(set).map(([k, v]) => [k, value(v)]));
};

const DARK = "html[data-mode='dark']";
const COLOURS = [
  ['the Shire in light', "[data-theme='shire']"],
  ['the Shire in dark', "[data-theme='shire']", "html[data-mode='dark'][data-theme='shire']"],
  ['Mordor in light', "[data-theme='mordor']"],
  ['Mordor in dark', "[data-theme='mordor']", "html[data-mode='dark'][data-theme='mordor']"],
];
const page = (light, dark) =>
  resolve({ ...tokens(house, ':root'), ...tokens(sheet, light), ...(dark ? { ...tokens(house, DARK), ...tokens(sheet, dark) } : {}) });

// the spec's table: each mode sets the whole of it
const TABLE = [
  '--bg', '--bg-deep', '--surface', '--surface-2', '--border', '--border-strong', '--text', '--text-body', '--muted',
  '--accent', '--accent-text', '--btn-bg', '--btn-ink', '--saber', '--route-plan',
];
// the heading ink and the eyebrow's are the sheet's own, and read like text
const INKS = ['--text', '--text-body', '--muted', '--accent-text', '--me-display', '--me-eyebrow'];
const GROUNDS = ['--bg', '--bg-deep', '--surface', '--surface-2'];

describe('the Middle-earth colours', () => {
  describe.each(COLOURS)('%s', (_, light, dark) => {
    const own = tokens(sheet, dark ?? light);
    const t = page(light, dark);

    it.each(TABLE)('sets %s itself, as a plain hex', (token) => {
      // (travel/Globe.jsx parses the raw value: no var(), no color-mix())
      expect(own[token]).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it.each(INKS.flatMap((ink) => GROUNDS.map((ground) => [ink, ground])))('%s reads on %s', (ink, ground) => {
      expect(t[ink]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(contrast(t[ink], t[ground])).toBeGreaterThanOrEqual(4.5);
    });

    it('labels its buttons legibly', () => {
      expect(contrast(t['--btn-ink'], t['--btn-bg'])).toBeGreaterThanOrEqual(4.5);
    });

    it('edges a ghost button, and lights its accent, against the page', () => {
      expect(contrast(t['--border-strong'], t['--bg'])).toBeGreaterThanOrEqual(3);
      expect(contrast(t['--accent'], t['--bg'])).toBeGreaterThanOrEqual(3);
    });

    it('keeps selected text readable', () => {
      // ::selection in index.css sets --saber-ink on --saber (a token now, so a
      // theme whose saber is dark, as Bose’s is, can turn its selection white)
      expect(contrast(t['--saber-ink'], t['--saber'])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('never outranks the language mode’s faces', () => {
    // html[data-script] sets every font with !important; a face here with one
    // would put English back on a page written in runes
    expect(sheet).not.toMatch(/font(-family)?\s*:[^;}]*!important/);
  });
});
