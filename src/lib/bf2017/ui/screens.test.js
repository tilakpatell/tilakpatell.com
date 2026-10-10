import { describe, expect, it } from 'vitest';
import { info, infoList } from './info';
import { loading, screen, SCREENS } from './screens';

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

describe("a screen's tree, resolved", () => {
  it('holds the front end and the in-game screens the era rule allows', () => {
    expect(SCREENS).toContain('UI/Frontend/Screens/Start/MainMenuScreen');
    expect(SCREENS).toContain('UI/InGame/InGameMenu/IngameMenuMPScreen');
    expect(SCREENS.some((n) => /^(S1|S9|A3)\//.test(n))).toBe(false);
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
