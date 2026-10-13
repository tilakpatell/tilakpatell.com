import { describe, expect, it } from 'vitest';
import { info, infoList } from './info';
import { faceFor, loading, screen, SCREENS } from './screens';

// every box in a resolved tree, flat
const flat = (boxes, out = []) => {
  for (const b of boxes) {
    out.push(b);
    flat(b.children ?? [], out);
  }
  return out;
};
const byId = (boxes, id) => flat(boxes).find((b) => b.id.endsWith(id));
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

const boxesUnder = (box) => flat(box.children ?? []);
const findBox = (tree, name) => flat(tree.boxes).find((b) => b.id.split('/').pop() === name);

describe('the parts that grow, the lists the code fills, the boxes that bleed', () => {
  it('draws a Play tile’s outline round the whole tile', () => {
    const tree = screen('PlayScreen');
    const tile = findBox(tree, 'Multiplayer');
    const outline = boxesUnder(tile).find((b) => b.id.endsWith('/Outline'));
    expect([outline.x, outline.y, outline.w, outline.h]).toEqual([tile.x, tile.y, tile.w, tile.h]);
  });

  it('lays a dynamic list’s cells from its template, the crumbs’ words in its empty texts', () => {
    const tree = screen('MainMenuScreen', { items: { BreadcrumbList: [{ id: 'play', label: 'PLAY' }, { id: 'single', label: 'SINGLE PLAYER' }] } });
    const cells = findBox(tree, 'BreadcrumbList').children;
    expect(cells.map((c) => c.label)).toEqual(['PLAY', 'SINGLE PLAYER']);
    expect(cells[1].x).toBeGreaterThan(cells[0].x);
    expect(boxesUnder(cells[0]).some((b) => b.type === 'text' && b.text === 'PLAY')).toBe(true);
  });

  it('marks a root box the tree expands over the whole frame as bleeding to the window', () => {
    expect(findBox(screen('PairingScreen'), 'Background').bleed).toBe(true);
  });
});

describe("a screen's tree, resolved", () => {
  it('holds the front end and the in-game screens the era rule allows', () => {
    expect(SCREENS).toContain('UI/Frontend/Screens/Start/MainMenuScreen');
    expect(SCREENS).toContain('UI/InGame/InGameMenu/IngameMenuMPScreen');
    expect(SCREENS.some((n) => /(^|\/)(S1|S9[^/]*|A3)\//.test(n))).toBe(false);
  });

  it("places the main menu's cell list within a pixel of the record at 1920 × 1080", () => {
    const s = screen('MainMenuScreen', { viewport: { width: 1920, height: 1080 } });
    // the menu widget: anchored top centre, 110 down, at the widget's own size (1920 × 48)
    const menu = byId(s.boxes, 'MainMenuWidget');
    expect(menu).toMatchObject({ x: 0, y: 110, w: 1920, h: 48 });
    // its container, centred in it (1728 × 48)
    const list = byId(s.boxes, 'MainMenuStaticListEntity');
    near(list.x, 96);
    near(list.y, 110);
    near(list.w, 1728);
    near(list.h, 48);
    const cells = list.children.filter((c) => c.type === 'cell');
    expect(cells.map((c) => c.id.split('/').pop())).toEqual(['Start', 'Play', 'Characters', 'Career', 'Options', 'Store']);
    near(cells[0].x, 96);
    near(cells[1].x, 96 + 190 - 2);
    expect(cells[1].link).toBe('UI/Data/LinkAssets/Play/PlayScreen');
    expect(cells[1].screen).toBe('UI/Frontend/Screens/Play/PlayScreen');
    expect(cells[1].label).toBe('PLAY');
  });

  it('scales by the shorter side at 1280 × 720, anchors to the viewport', () => {
    const s = screen('MainMenuScreen', { viewport: { width: 1280, height: 720 } });
    const k = 720 / 1080;
    const menu = byId(s.boxes, 'MainMenuWidget');
    near(menu.y, 110 * k);
    near(menu.w, 1920 * k);
    const list = byId(s.boxes, 'MainMenuStaticListEntity');
    near(list.x, 640 - (1728 * k) / 2);
    near(list.w, 1728 * k);
  });

  it("draws a text's key when its string is missing, never an empty box", () => {
    const s = screen('MainMenuScreen', { viewport: { width: 1920, height: 1080 } });
    const store = flat(s.boxes).find((b) => b.type === 'cell' && b.id.endsWith('Store'));
    // (the Store cell binds no string: its text is its id, not nothing)
    expect(store.label).toBe('Store');
    const texts = flat(s.boxes).filter((b) => b.type === 'text' && b.key);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.text).toBeTruthy();
    const missing = screen('MainMenuScreen', { viewport: { width: 1920, height: 1080 }, strings: {} });
    const t = flat(missing.boxes).find((b) => b.type === 'text' && b.key === 'ID_MAINMENU_SCR_PLAY');
    expect(t.text).toBe('ID_MAINMENU_SCR_PLAY');
  });

  it("fills a text's {0} from the data, and an element's text by its id", () => {
    const s = screen('MainMenuScreen', { viewport: { width: 1920, height: 1080 }, data: { MenuText: 'HELLO' } });
    expect(flat(s.boxes).some((b) => b.type === 'text' && b.text === 'HELLO')).toBe(true);
  });

  it('gives a text its font on the open faces, and a box its colour from the palette', () => {
    const s = screen('MainMenuScreen', { viewport: { width: 1920, height: 1080 } });
    const t = flat(s.boxes).find((b) => b.type === 'text' && b.font);
    expect(t.font.family).toMatch(/var\(--font-bf/);
    expect(flat(s.boxes).some((b) => /^rgb\(/.test(b.colour ?? ''))).toBe(true);
  });

  it('puts a face the open fonts lack on the text face, and Aurebesh on the site’s own', () => {
    expect(faceFor('NewsGothicRomanBT80px')).toEqual({ family: 'var(--font-bf-text)', size: 80, weight: 400 });
    expect(faceFor('Aurebesh14px').family).toBe('var(--font-aurebesh)');
    expect(faceFor('Univers620BoldCondensed30px').family).toBe('var(--font-bf-hud)');
  });

  it('gives no two siblings one id, in any screen: a second of a name is name#2', () => {
    const dups = [];
    for (const name of SCREENS) {
      const walk = (boxes, parent) => {
        const seen = new Set();
        for (const b of boxes ?? []) {
          if (seen.has(b.id)) dups.push(`${name} ${parent}/${b.id.split('/').pop()}`);
          seen.add(b.id);
          walk(b.children, b.id);
        }
      };
      walk(screen(name).boxes, '');
    }
    expect(dups).toEqual([]);
    // (the in-game menu holds siblings the export names alike, the page keyed them twice)
    const menu = flat(screen('IngameMenuMPScreen').boxes).map((b) => b.id);
    const second = menu.find((id) => /#2$/.test(id));
    expect(second).toBeDefined();
    expect(menu).toContain(second.replace(/#2$/, ''));
  });

  it('returns null for a screen it does not hold', () => {
    expect(screen('NoSuchScreen')).toBeNull();
  });
});

describe('the modes, levels and planets', () => {
  it("lists the modes in the game's order with their names", () => {
    const list = infoList();
    expect(list[0].id).toBe('PlanetaryBattles');
    expect(list[0].title).toBe('GALACTIC ASSAULT');
    expect(list.find((m) => m.id === 'SpaceBattle').title).toBe('STARFIGHTER ASSAULT');
  });

  it('reads a level with its planet', () => {
    const l = info('level', 'EchoBase');
    expect(l).toMatchObject({ key: 'Hoth_01', planet: 'Hoth' });
    expect(l.title).toBeTruthy();
    expect(info('level', 'Hoth_01').key).toBe('Hoth_01');
    expect(info('planet', 'Hoth').title).toBe('HOTH');
    expect(info('mode', 'nope')).toBeNull();
  });
});

describe('the loading screen', () => {
  it("gives Hoth's assault its planet's film and one of the game's hints for the mode", () => {
    const l = loading('galacticAssault', 'hoth', { seed: 1 });
    expect(l.film?.slug).toMatch(/hoth/);
    expect(typeof l.hint).toBe('string');
    expect(l.hint.length).toBeGreaterThan(10);
    expect(l.screen).toBe('MPLoadLevelHothAsset');
    expect(loading('galacticAssault', 'hoth', { seed: 1 }).hint).toBe(l.hint);
  });

  it('never gives a hint of the sequel', () => {
    for (let seed = 0; seed < 40; seed++) expect(loading('galacticAssault', 'hoth', { seed }).hint).not.toMatch(/first order|resistance|kylo/i);
  });
});
