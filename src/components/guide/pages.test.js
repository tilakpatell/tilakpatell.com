import { describe, expect, it } from 'vitest';
import { PAGES, SHORTCUTS, SITE, guideFor } from './pages';
import { GUIDES, guideMeta } from './routes';
import { keyTokens } from './keys';
import { WORLDS } from '../worlds/worlds';
import { ABOUT } from './abouts';
import { BRIEFED } from '../tour/brief';
import { BRIEFS } from '../tour/briefs';

describe('which guide a page gets', () => {
  it('finds a page by its own path', () => {
    expect(guideFor('/home').key).toBe('/home');
    expect(guideFor('/c-137/citadel').key).toBe('/c-137/citadel');
    expect(guideFor('/deathstar').title).toBe('The Death Star');
  });

  it('gives the universe’s to the front door and every place on the map', () => {
    for (const p of ['/', '/universe', '/universe/marvel']) expect(guideFor(p).key, p).toBe('/universe');
  });

  it('gives a section’s deeper pages their own kind of guide', () => {
    expect(guideFor('/experience/aws').key).toBe('/experience');
    expect(guideFor('/projects/gameboy').key).toBe('/project');
    expect(guideFor('/galaxy/hoth').key).toBe('/galaxy');
    expect(guideFor('/galaxy/hoth/surface').key).toBe('/galaxy/surface');
    expect(guideFor('/galaxy/hoth/mission').key).toBe('/galaxy/mission');
    expect(guideFor('/middle-earth').key).toBe('/middle-earth');
    expect(guideFor('/middle-earth/moria').key).toBe('/middle-earth/place');
  });

  it('gives a Rick and Morty planet its own, not C-137’s, and leaves the Citadel its', () => {
    for (const p of ['/c-137/squanch', '/c-137/purge', '/c-137/gazorpazorp']) expect(guideFor(p).key, p).toBe('/c-137/planet');
    expect(guideFor('/c-137').key).toBe('/c-137');
    expect(guideFor('/c-137/citadel').key).toBe('/c-137/citadel');
    expect(guideFor('/c-137/squanch/deeper')).toBe(null);
  });

  it('gives the Battlefront world its own on every level and mode, with its keys: Space a hero’s jump', () => {
    for (const p of ['/battlefront', '/battlefront/hoth', '/battlefront/hoth/galacticAssault']) expect(guideFor(p)?.key, p).toBe('/battlefront');
    const rows = PAGES['/battlefront'].keys.flatMap((g) => g.rows);
    expect(rows.find(([k]) => k === 'Space')?.[1]).toMatch(/jump/i);
    expect(rows.find(([k]) => k === 'double Space')?.[1]).toMatch(/dodge/i);
    expect(guideFor('/battlefront/hoth/galacticAssault/deeper')).toBe(null);
  });

  it('has none for a page it doesn’t know', () => {
    expect(guideFor('/nowhere')).toBe(null);
    expect(guideFor('/galaxy/hoth/surface/deeper')).toBe(null);
  });

  it('has a guide for every world', () => {
    for (const w of WORLDS) expect(guideFor(w.to), w.to).not.toBe(null);
  });
});

describe('the corner button’s side of it (routes.js)', () => {
  it('knows every page the guide has, and no other', () => {
    expect(Object.keys(GUIDES).sort()).toEqual(Object.keys(PAGES).sort());
  });

  it('agrees with the panel on the page and its title', () => {
    for (const p of ['/', '/universe/marvel', '/galaxy/hoth/surface', '/middle-earth/moria', '/experience/aws', '/home']) {
      expect(guideMeta(p).key, p).toBe(guideFor(p).key);
      expect(guideMeta(p).title, p).toBe(guideFor(p).title);
    }
    expect(guideMeta('/nowhere')).toBe(null);
  });

  it('leaves a note only on pages that have controls to tell', () => {
    for (const [path, g] of Object.entries(GUIDES)) if (g.nudge) expect(Boolean(PAGES[path].keys || PAGES[path].touch), path).toBe(true);
    for (const path of ['/galaxy/surface', '/albuquerque', '/middle-earth/place']) expect(guideMeta(path).nudge, path).toBe(true);
    // (the universe and the galaxy: their first hint says where the controls are)
    for (const path of ['/home', '/terminal', '/projects', '/universe', '/universe/marvel', '/galaxy/hoth']) expect(guideMeta(path).nudge, path).toBe(false);
  });
});

describe('what the guide says', () => {
  const entries = Object.entries(PAGES);

  it('gives every page a title and something to say', () => {
    for (const [path, page] of entries) {
      expect(GUIDES[path].title, path).toBeTruthy();
      expect(Boolean(page.tips?.length || page.keys || page.touch), path).toBe(true);
    }
  });

  it('writes every control as keys and what they do', () => {
    for (const [path, page] of entries)
      for (const groups of [page.keys, page.touch].filter(Boolean))
        for (const g of groups) {
          expect(g.rows.length, path).toBeGreaterThan(0);
          for (const [keys, does] of g.rows) {
            expect(keyTokens(keys).some((t) => t.key), `${path}: ${keys}`).toBe(true);
            expect(does, `${path}: ${keys}`).toBeTruthy();
          }
        }
  });

  it('never names the same keys twice in one group', () => {
    for (const [path, page] of entries)
      for (const g of [...(page.keys ?? []), ...(page.touch ?? [])]) {
        const keys = g.rows.map(([k]) => k);
        expect(new Set(keys).size, `${path} ${g.label ?? ''}`).toBe(keys.length);
      }
  });

  it('tells the universe’s real flying keys (the arrows pitch; R is the weapons)', () => {
    const flying = PAGES['/universe'].keys.find((g) => g.label === 'Flying').rows;
    const does = (k) => flying.find(([keys]) => keys === k)?.[1] ?? '';
    expect(does('↑ ↓')).toMatch(/nose/i);
    expect(does('R / 1 2 3')).toMatch(/weapon/i);
    expect(JSON.stringify(PAGES['/universe'])).not.toMatch(/R to climb|C to dive/);
  });

  it('tells the same flying keys on both maps: the three lines on R and 1 2 3, the crew’s powers on G and X', () => {
    for (const page of ['/universe', '/galaxy']) {
      const flying = PAGES[page].keys.find((g) => g.label === 'Flying').rows;
      const does = (k) => flying.find(([keys]) => keys === k)?.[1] ?? '';
      expect(does('R / 1 2 3')).toMatch(/heavy ordnance/);
      expect(does('G')).toMatch(/power/i);
      expect(does('X')).toMatch(/charged/i);
      const touch = PAGES[page].touch.flatMap((g) => g.rows.map(([k]) => k));
      expect(touch).toEqual(expect.arrayContaining(['Weapon', 'Power', 'Big one']));
    }
    expect(JSON.stringify(PAGES['/galaxy'])).not.toMatch(/universe map only/);
  });

  it('has the site’s own shortcuts and tips', () => {
    expect(SHORTCUTS.map(([k]) => k)).toContain('?');
    expect(SITE.length).toBeGreaterThan(3);
  });
});

describe('the line on what a world is (abouts.js)', () => {
  it('has one for every world with basics, read from abouts.js', () => {
    for (const key of BRIEFED) {
      expect(PAGES[key]?.about, key).toBeTruthy();
      expect(PAGES[key].about, key).toBe(ABOUT[key]);
    }
  });

  it('opens each world’s basics', () => {
    for (const key of BRIEFED) expect(BRIEFS[key].find((s) => s.id === 'hello').text.startsWith(ABOUT[key]), key).toBe(true);
  });
});
