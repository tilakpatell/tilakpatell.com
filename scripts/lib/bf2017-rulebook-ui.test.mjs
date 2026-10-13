import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readIndex, stringHash } from './bf2017-ebx.mjs';
import { cornersToPath, infoOf, isEra, linkTable, loadingOf, screensOf, shapesOf } from './bf2017-rulebook-ui.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const S = (o) => ({
  strings: Object.fromEntries(Object.entries(o).map(([k, v]) => [k.startsWith('#') ? k.slice(1) : stringHash(k), v])),
});
const STRINGS = S({
  ID_MAINMENU_SCR_START: 'START',
  ID_MAINMENU_SCR_PLAY: 'PLAY',
  ID_MAINMENU_SCR_CAREER: 'CAREER',
});

// The bounds of an SVG path's points (M, L and A end points).
function pathBounds(d) {
  const nums = [...d.matchAll(/[MLA]([^MLAZ]+)/g)].map((m) => m[1].trim().split(/[ ,]+/).map(Number));
  const pts = nums.map((n) => n.slice(-2));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

describe('the screens', () => {
  const book = screensOf(ROOT, {
    names: ['UI/Frontend/Screens/Start/MainMenuScreen'],
    strings: STRINGS,
  });
  const main = book.screens['UI/Frontend/Screens/Start/MainMenuScreen'];

  it('reads the main menu as its frame, with the breadcrumb and the menu widget as children at their anchors', () => {
    expect(main.type).toBe('navigationFrameWidget');
    expect(main.size).toEqual([1921, 1080]);
    expect(main.elements.map((e) => e.id)).toEqual(['BreadcrumbWidget', 'MainMenuWidget']);
    const menu = main.elements[1];
    expect(menu).toMatchObject({
      type: 'widget',
      anchor: [0.5, 0],
      offset: [0, 110],
      size: [256, 256],
      widget: 'UI/Frontend/Widgets/MainMenu/MainMenuWidget',
    });
    expect(main.elements[0]).toMatchObject({
      anchor: [0.5, 0],
      offset: [0, 118],
    });
  });

  it('reads the menu widget once, with its six cells, their string keys and the links they go to', () => {
    const w = book.widgets['UI/Frontend/Widgets/MainMenu/MainMenuWidget'];
    expect(w.size).toEqual([1920, 48]);
    const find = (els) => els.flatMap((e) => (e.list ? [e] : find(e.children ?? [])));
    const [list] = find(w.elements);
    expect(list.list.horizontal).toBe(true);
    expect(list.list.spacing).toBe(-2);
    const cells = Object.fromEntries(list.list.cells.map((c) => [c.id, c]));
    expect(Object.keys(cells).sort()).toEqual(['Career', 'Characters', 'Options', 'Play', 'Start', 'Store']);
    expect(Object.values(cells.Play.binds)).toEqual(['ID_MAINMENU_SCR_PLAY']);
    expect(cells.Play.link).toBe('UI/Data/LinkAssets/Play/PlayScreen');
    expect(cells.Options.link).toBe('UI/Data/LinkAssets/Options/OptionsScreen');
    expect(cells.Store.binds).toEqual({});
    expect(cells.Play.widget).toBe('UI/Frontend/Widgets/MainMenu/MainMenuButtonCell');
    // the cell widget's text takes the field the cell binds
    const cell = book.widgets['UI/Frontend/Widgets/MainMenu/MainMenuButtonCell'];
    const field = Object.keys(cells.Play.binds)[0];
    expect(cell.slots[field]).toContain('MenuText');
    expect(book.strings.ID_MAINMENU_SCR_PLAY).toBe('PLAY');
    expect(book._missing).not.toContain('widget: UI/Frontend/Widgets/Breadcrumbs/BreadcrumbWidget');
  });

  it('keeps a dynamic list’s cell template, its cell size and direction, and reads the template as a widget', () => {
    const byId = (els, id) => els.reduce((hit, e) => hit ?? (e.id === id ? e : byId(e.children ?? [], id)), null);
    const crumbs = book.widgets['UI/Frontend/Widgets/Breadcrumbs/BreadcrumbWidget'];
    const list = byId(crumbs.elements, 'BreadcrumbList');
    expect(list.dynamic).toEqual({ template: 'UI/Frontend/Widgets/Breadcrumbs/BreadcrumbListCell', cellSize: [200, 32], spacing: 0, horizontal: true, sized: true });
    expect(book.widgets['UI/Frontend/Widgets/Breadcrumbs/BreadcrumbListCell']).toBeTruthy();
  });

  it('pairs a link with the screen of its name', () => {
    expect(linkTable(['UI/Data/LinkAssets/Play/PlayScreen', 'UI/Data/LinkAssets/Store/StoreScreen'], ['UI/Frontend/Screens/Play/PlayScreen'])).toEqual({
      'UI/Data/LinkAssets/Play/PlayScreen': 'UI/Frontend/Screens/Play/PlayScreen',
      'UI/Data/LinkAssets/Store/StoreScreen': null,
    });
  });

  it('skips a widget the era rule excludes, and the screen still resolves', () => {
    const root = mkdtempSync(join(tmpdir(), 'bf-ui-'));
    const name = 'UI/Frontend/Screens/Test/EraScreen';
    const ref = (n, inst) => ({
      $type: 'UIElementWidgetReferenceEntityData',
      InstanceName: inst,
      Anchor: { X: 0, Y: 0 },
      Offset: { X: 0, Y: 0 },
      Size: { x: 10, y: 10 },
      Blueprint: { $asset: n },
    });
    const asset = {
      name,
      root: 0,
      objects: [
        {
          $type: 'UIWidgetBlueprint',
          Object: { $ref: 1 },
          PropertyConnections: [],
          EventConnections: [],
          Name: name,
        },
        {
          $type: 'NavigationFrameWidgetData',
          Size: { X: 1920, Y: 1080 },
          Layers: [{ $ref: 2 }],
        },
        {
          $type: 'UIElementLayerEntityData',
          Elements: [{ $ref: 3 }, { $ref: 4 }],
        },
        ref('S1/UI/Frontend/Widgets/KyloRen/KyloRenCard', 'Kylo'),
        {
          $type: 'TextElementData',
          InstanceName: 'Title',
          StaticStringIdHash: 0x1234abcd,
          Anchor: { X: 0.5, Y: 0 },
          Offset: { X: 0, Y: 0 },
          Size: { x: 100, y: 20 },
        },
      ],
    };
    mkdirSync(join(root, 'data', 'UI/Frontend/Screens/Test'), {
      recursive: true,
    });
    writeFileSync(join(root, 'data', `${name}.json`), JSON.stringify(asset));
    writeFileSync(join(root, 'data.tsv'), `${name}\tUIWidgetBlueprint\tdata/${name}.json\t1\n`);
    const b = screensOf(root, { names: [name] });
    expect(b.screens[name].elements.map((e) => e.id)).toEqual(['Title']);
    expect(b.screens[name].elements[0].text).toBe('#1234ABCD');
    expect(b._skipped).toEqual(['S1/UI/Frontend/Widgets/KyloRen/KyloRenCard']);
  });
});

describe('the shapes', () => {
  const { shapes, _missing } = shapesOf(ROOT, ['UI/Shapes/InGame/HUD/Crosshairs/Crosshairs_Ability_Dooku', 'UI/Shapes/Icons/Shared/Checkmark']);

  it("draws Dooku's crosshair inside its layout rect, the path's bounds the triangulated points'", () => {
    expect(_missing).toEqual([]);
    const s = shapes.Crosshairs_Ability_Dooku;
    expect(s.rect).toEqual([0, 0, 4, 8]);
    expect(s.points).toEqual([0, 0, 4, 8]);
    expect(s.paths).toHaveLength(2);
    expect(s.paths[0]).toMatchObject({ style: 'fill', alpha: 0.85 });
    expect(pathBounds(s.paths[0].d)).toEqual([0, 0, 4, 8]);
    expect(s.paths[0].d).toBe('M0 2L2 8L4 2L2 0Z');
  });

  it('keeps a shape with inner paths as its outline and its holes, bounded by its points', () => {
    const s = shapes.Checkmark;
    const withInner = s.paths.find((p) => p.inner?.length);
    expect(withInner).toBeTruthy();
    const [x0, y0, x1, y1] = s.points;
    const all = s.paths.flatMap((p) => [p.d, ...(p.inner ?? [])]).map(pathBounds);
    expect(Math.min(...all.map((b) => b[0]))).toBeCloseTo(x0, 0);
    expect(Math.min(...all.map((b) => b[1]))).toBeCloseTo(y0, 0);
    expect(Math.max(...all.map((b) => b[2]))).toBeCloseTo(x1, 0);
    expect(Math.max(...all.map((b) => b[3]))).toBeCloseTo(y1, 0);
  });

  it('rounds a rounded corner with an arc of its radius, cut back along both edges', () => {
    const c = (x, y, kind = 'Miter', r = 0) => ({
      Position: { x, y },
      CornerType: `DiceUIVectorPathCornerType_${kind}`,
      Radius: r,
    });
    const d = cornersToPath([c(0, 0, 'Rounded', 2), c(10, 0), c(10, 10), c(0, 10)]);
    expect(d).toBe('M0 2A2 2 0 0 1 2 0L10 0L10 10L0 10Z');
    expect(cornersToPath([c(0, 0, 'Bevel', 2), c(10, 0), c(10, 10), c(0, 10)])).toBe('M0 2L2 0L10 0L10 10L0 10Z');
  });
});

describe('the modes, levels and planets', () => {
  const info = infoOf(ROOT, {
    index: readIndex(ROOT),
    strings: S({ '#4B28F8C1': 'STARFIGHTER ASSAULT' }),
  });

  it("lists the modes in the game's order, Space Battles with its tile and Endor, the sequel's level refused", () => {
    expect(info.order.slice(0, 2)).toEqual(['PlanetaryBattles', 'SpaceBattle']);
    const sb = info.modes.SpaceBattle;
    expect(sb.levels).toContain('SB_Endor_01');
    expect(sb.levels).not.toContain('SB_Resurgent_01');
    expect(sb.refused).toEqual(['SB_Resurgent_01', 'SB_SpaceBear_01']);
    expect(sb).toMatchObject({
      players: 24,
      vehicles: true,
      heroes: false,
      large: true,
      tile: null,
      aurebesh: 'STARFIGHTER ASSAULT',
    });
    expect(sb.name).toBe('#4B28F8C1');
    expect(info.strings['#4B28F8C1']).toBe('STARFIGHTER ASSAULT');
  });

  it('reads a level with its planet and its descriptions by mode', () => {
    const l = info.levels.EchoBase;
    expect(l).toMatchObject({
      key: 'Hoth_01',
      planet: 'Hoth',
      levelId: 'Levels/MP/Hoth_01/Hoth_01',
      aurebesh: 'HOTH',
    });
    expect(l.overrides.Blast).toMatch(/^#[0-9A-F]{8}$/);
    expect(info.planets.Hoth).toMatchObject({ id: 'Hoth', index: 5 });
  });
});

describe('the loading screens and hints', () => {
  const l = loadingOf(ROOT, { index: readIndex(ROOT) });

  it("reads Hoth's loading screen with its film, its time and its bar", () => {
    expect(l.screens.MPLoadLevelHothAsset).toMatchObject({
      level: 'Hoth',
      film: 'Planet_Hoth_01',
      loadTime: 66,
      bar: true,
      widget: 'UI/LoadingScreens/MPLoadLevel/MPLoadLevelHothLuaWidget',
    });
  });

  it('reads a bundle of hints with the modes it is for', () => {
    const h = l.hints.HintsBundleMpInfantryModes_OT;
    expect(h.tips.length).toBeGreaterThan(3);
    expect(h.tips.every((k) => k.startsWith('ID_'))).toBe(true);
    expect(h.filter).toBeTruthy();
  });

  it("leaves out a hint about the sequel's people, by its words", () => {
    const first = l.hints.HintsBundleMpInfantryModes_OT.tips[0];
    const k = loadingOf(ROOT, { index: readIndex(ROOT), strings: S({ [first]: 'The First Order Jet Trooper can hover.' }) });
    expect(k.hints.HintsBundleMpInfantryModes_OT.tips).not.toContain(first);
    expect(k.hints.HintsBundleMpInfantryModes_OT.tips).toHaveLength(l.hints.HintsBundleMpInfantryModes_OT.tips.length - 1);
  });
});

describe('the era rule', () => {
  it('refuses the sequel seasons’ and act 3’s folders wherever they sit, and act 3’s assets by name', () => {
    expect(isEra('UI/Frontend/Screens/S1/S1_SelectSide')).toBe(true);
    expect(isEra('S9_2/UI/Data/GameModes/Levels/Jakku_02')).toBe(true);
    expect(isEra('UI/LoadingScreens/SPLoadLevel/SPLoadLevelScreenAsset_A3M1PIL')).toBe(true);
    expect(isEra('UI/Frontend/Screens/Start/MainMenuScreen')).toBe(false);
    expect(isEra('UI/LoadingScreens/SPLoadLevel/SPLoadLevelScreenAsset_A1M2FON')).toBe(false);
  });
});

