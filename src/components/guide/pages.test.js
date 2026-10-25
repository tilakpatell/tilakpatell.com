import { describe, expect, it } from 'vitest';
import { PAGES, SHORTCUTS, SITE, guideFor } from './pages';
import { GUIDES, guideMeta } from './routes';
import { keyTokens } from './keys';
import { WORLDS } from '../worlds/worlds';
import { ABOUT } from './abouts';
import { C137 } from './c137';
import { BRIEFED } from '../tour/brief';
import { BRIEFS } from '../tour/briefs';
import { WALKED } from '../tour/chapters/player';
import { DIAL } from '../rickmorty/world/dimensions/destinations';
import { EPISODES } from '../rickmorty/adventure/episodes';

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
    expect(guideFor('/avengers/gate').key).toBe('/avengers');
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

  it('keeps C-137’s keys and tips in a file of their own', () => {
    const g = guideFor('/c-137');
    expect(g.keys).toBe(C137.keys);
    expect(g.touch).toBe(C137.touch);
    expect(g.tips).toBe(C137.tips);
    expect(g.about).toBe(ABOUT['/c-137']);
  });

  it('tips Fantasy World’s climb on C-137’s page, with the jump to climb it', () => {
    const tip = C137.tips.find(([where]) => where === 'Fantasy World');
    expect(tip?.[1]).toMatch(/Stair Goblins/);
    expect(tip?.[1]).toMatch(/beanstalk/);
    expect(tip?.[1]).toMatch(/shivers/);
    expect(C137.tips.slice(-7).map(([where]) => where)).toEqual(['Fantasy World', 'Bird World', 'Gear World', 'Pluto', 'Heist-Con', 'The Blood Dome', 'Evil Rick’s lair']);
    expect(C137.keys.flatMap((g) => g.rows).some(([k, what]) => /Space/.test(k) && /jump/i.test(what))).toBe(true);
  });

  it('tips the sector’s three games on C-137’s page, and the planets on the portal gun after episode 10', () => {
    const tip = (where) => C137.tips.find(([w]) => w === where)?.[1] ?? '';
    expect(tip('The planets')).toMatch(/After episode 10, Bird World, Gear World, Pluto and Planet Squanch are on the portal gun too/);
    expect(tip('Bird World')).toMatch(/crystals/);
    expect(tip('Bird World')).toMatch(/clay tower/);
    expect(tip('Bird World')).toMatch(/crumble/);
    expect(tip('Gear World')).toMatch(/cogs?/);
    expect(tip('Gear World')).toMatch(/gear police/);
    expect(tip('Gear World')).toMatch(/order/);
    expect(tip('Pluto')).toMatch(/true/);
    expect(tip('Pluto')).toMatch(/two checks/);
    expect(tip('Pluto')).toMatch(/Scroopy/);
    for (const where of ['Bird World', 'Gear World', 'Pluto']) expect(tip(where), where).not.toMatch(/!/);
  });

  it('tips Heist-Con’s job on C-137’s page: the crew first, the booths in order, and the crew turned on him', () => {
    const tip = C137.tips.find(([where]) => where === 'Heist-Con')?.[1] ?? '';
    for (const words of [/badge/, /muscle and a cat burglar/, /Heistotron’s plan/, /order/, /wrong booth/, /watch your crew/, /back at the door/]) expect(tip).toMatch(words);
    expect(tip).not.toMatch(/!/);
  });

  it('tips episode 13’s fights on C-137’s page: the ring and the pods, facing him, and the Morty with the eyepatch after', () => {
    const tip = (where) => C137.tips.find(([w]) => w === where)?.[1] ?? '';
    for (const words of [/ring/, /the way Morty faces/, /Tab/, /Lock/, /back at the portal/]) expect(tip('The Blood Dome')).toMatch(words);
    for (const words of [/three Mortys/, /pods/, /back at the door/, /plugged in again/, /eyepatch/]) expect(tip('Evil Rick’s lair')).toMatch(words);
    for (const where of ['The Blood Dome', 'Evil Rick’s lair']) expect(tip(where), where).not.toMatch(/!|['"]|hearts|\d/);
  });

  it('tips a planet page’s games: each a meter, and a loss only back to the portal', () => {
    const tip = PAGES['/c-137/planet'].tips.find(([where]) => where === 'The games')?.[1] ?? '';
    expect(tip).toMatch(/Bird World, Gear World and Pluto/);
    expect(tip).toMatch(/meter/);
    expect(tip).toMatch(/back at the portal/);
  });

  it('tips the story on the Citadel’s page: its step heads the line, and the cruiser ends it', () => {
    const tip = PAGES['/c-137/citadel'].tips.find(([where]) => where === 'The story');
    expect(tip?.[1]).toMatch(/episode 10/);
    expect(tip?.[1]).toMatch(/line at the top/);
    expect(tip?.[1]).toMatch(/cruiser/);
    expect(PAGES['/c-137/citadel'].tips.at(-1)[0]).toBe('The story');
  });

  it('has none for a page it doesn’t know', () => {
    expect(guideFor('/avengers/gate/deeper')).toBe(null);
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

  it('says H opens the Hangar and C its crew, on both maps', () => {
    for (const page of ['/universe', '/galaxy']) {
      const flying = PAGES[page].keys.find((g) => g.label === 'Flying').rows;
      const does = (k) => flying.find(([keys]) => keys === k)?.[1] ?? '';
      expect(does('H')).toMatch(/^The Hangar/);
      expect(does('C')).toMatch(/Hangar.*crew/);
    }
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

// a count as the copy writes it, one to ninety-nine in words
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const spell = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));

describe('what C-137’s copy says of the portal gun and the story', () => {
  it('counts the dial’s places as the dial has them, everywhere it’s told', () => {
    const told = {
      about: ABOUT['/c-137'],
      tip: C137.tips.find(([where]) => where === 'The portal gun')?.[1] ?? '',
      tour: WALKED.find((w) => w.id === 'walk-c137').stops[0].text,
      brief: BRIEFS['/c-137'].find((s) => s.id === 'goal').text,
    };
    for (const [where, text] of Object.entries(told)) {
      expect(text, where).toContain(`${spell(DIAL.length)} places`);
      expect(text, where).not.toMatch(/thirty-six|twenty-six places/);
    }
  });

  it('tells the story on C-137’s page, before the places’ own tips: the episodes, the Story tab, Free roam', () => {
    const at = C137.tips.findIndex(([where]) => where === 'The story');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(C137.tips.findIndex(([where]) => where === 'Fantasy World'));
    expect(C137.tips[at][1]).toContain(`${spell(EPISODES.length)} episodes`);
    expect(C137.tips[at][1]).toMatch(/Story tab/);
    expect(C137.tips[at][1]).toMatch(/Free roam/);
  });
});
