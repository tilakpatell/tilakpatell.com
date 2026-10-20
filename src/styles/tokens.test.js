import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The house's one source of a number (spec 5.1, rule 1): depth, time, type and
// a few lengths are tokens on :root, and the shell's stylesheets read them.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('index.css');
// the first :root block is the default theme's; the tokens below don't change by theme
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

const TOKENS = [
  '--z-page', '--z-nav', '--z-float', '--z-sheet', '--z-dialog', '--z-cover', '--z-top',
  '--t-fast', '--t-base', '--t-slow',
  '--fs-xs', '--fs-sm', '--fs-md', '--fs-base', '--fs-lg', '--fs-lead', '--fs-lead-lg', '--fs-title',
  '--fs-display-3', '--fs-display-2', '--fs-display-1',
  '--shadow-float', '--shadow-dialog', '--edge-x', '--edge-y', '--page-top', '--measure',
];

// The shell's and the universe map's stylesheets. A world's own sheets stack
// inside the world's page and are not counted here.
const SHEETS = [
  'index.css',
  'styles/extras.css',
  'styles/middleearth-themes.css',
  'styles/dialogs.css',
  'styles/feel.css',
  'styles/lazy/settings.css',
  'styles/lazy/commandpalette.css',
  'styles/lazy/experience.css',
  'styles/lazy/home.css',
  'styles/lazy/projects.css',
  'styles/lazy/resume.css',
  'styles/lazy/resumesheet.css',
  'styles/lazy/travel.css',
  'styles/lazy/themetransition.css',
  'components/feed/feed.css',
  'components/tour/tour.css',
  'components/tour/offer.css',
  'components/worlds/worldgate.css',
  'components/universe/universe.css',
  'components/universe/navmap.css',
  'components/universe/online/online.css',
];

// A bare number of 10 or more is a page-level layer and must name its depth;
// 0 to 9 orders the pieces of one component among themselves. A comment
// straight after the declaration may say why a value stands alone.
function bareDepths(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/z-index:\s*(-?\d+)\s*(!important)?\s*(;|}|$)\s*}?\s*(\/\*)?/g)) {
      if (Math.abs(Number(m[1])) >= 10 && !m[4]) out.push(`${i + 1}: ${line.trim().slice(0, 80)}`);
    }
  });
  return out;
}

describe('the tokens', () => {
  it.each(TOKENS)('%s is set once on :root', (token) => {
    expect(root.match(new RegExp(`\\s${token}:`, 'g'))?.length ?? 0).toBe(1);
  });

  it('keep the layers in the order they had before they were named', () => {
    // read the values back, so a token can't be retuned past its neighbour
    const value = (t) => Number(root.match(new RegExp(`${t}:\\s*(\\d+)`))[1]);
    const order = ['--z-page', '--z-nav', '--z-float', '--z-sheet', '--z-dialog', '--z-cover', '--z-top'].map(value);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });
});

describe('the shell’s stylesheets', () => {
  it('finds a bare depth', () => {
    expect(bareDepths('.a { z-index: 80; }')).toHaveLength(1);
    expect(bareDepths('.a { z-index: 2; }')).toHaveLength(0);
    expect(bareDepths('.a { z-index: var(--z-dialog); }')).toHaveLength(0);
    expect(bareDepths('.a { z-index: 97; } /* above the cover: the transition plays over it */')).toHaveLength(0);
    expect(bareDepths('.a { z-index: 80 !important; }')).toHaveLength(1);
    expect(bareDepths('  z-index: 80')).toHaveLength(1);
    expect(bareDepths('.a { z-index: 80; color: red; } /* a note about the colour */')).toHaveLength(1);
  });

  it.each(SHEETS)('%s names every page-level depth', (path) => {
    expect(bareDepths(read(path))).toEqual([]);
  });
});

// The states and the inks a theme can't do without: set on the page, again for
// the dark, and again in a dark island on a light page (a var() in a token
// takes its value where it is set, and a light page's error red is 2.6:1 on
// the island's ground), so a reader never meets one unset or the wrong mode's.
describe('the states and the inks', () => {
  const block = (selector) => {
    const at = css.indexOf(`${selector} {`);
    return css.slice(at, css.indexOf('}', at));
  };
  const STATES = ['--ok', '--warn', '--danger', '--ally', '--shadow-ink', '--saber-ink', '--btn-shade'];

  it.each(['\n:root', "html[data-mode='dark']", '\n.dark-scope'])('%s sets every one', (selector) => {
    const text = block(selector);
    for (const token of STATES) expect(text, token).toMatch(new RegExp(`\\s${token}:`));
  });

  it('a dark island takes the dark mode’s values', () => {
    const value = (selector, token) => block(selector).match(new RegExp(`\\s${token}:\\s*([^;]+);`))[1];
    for (const token of STATES) expect(value('\n.dark-scope', token), token).toBe(value("html[data-mode='dark']", token));
  });
});
