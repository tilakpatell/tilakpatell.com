import { describe, expect, it } from 'vitest';
import { drawList, frameOf, navigables } from './layout';
import { screen } from './screens';

// a resolved tree by hand: boxes as screen() gives them
const tree = (boxes, name = 'T') => ({ name, size: [1920, 1080], boxes });
const box = (id, type, more = {}) => ({ id, type, x: 0, y: 0, w: 10, h: 10, ...more });
const ids = (items) => items.map((i) => i.id.split('/').pop());

describe('the frame', () => {
  it('centres the frame in a window of another shape', () => {
    expect(frameOf({ width: 2560, height: 1080 })).toEqual({ k: 1, x: 320, y: 0, w: 1920, h: 1080 });
    expect(frameOf({ width: 1920, height: 1080 })).toEqual({ k: 1, x: 0, y: 0, w: 1920, h: 1080 });
    const phone = frameOf({ width: 390, height: 844 });
    expect(phone.k).toBeCloseTo(390 / 1920);
    expect(phone.x).toBeCloseTo(0);
    expect(phone.y).toBeCloseTo((844 - 1080 * (390 / 1920)) / 2);
  });
});

describe('the draw list', () => {
  it('draws what draws, walks through what holds, and leaves out what only listens', () => {
    const t = tree([box('/c', 'container', { children: [box('/c/i', 'input'), box('/c/zone', 'navigatableElementZone'), box('/c/r', 'rectangle', { colour: 'red' }), box('/c/s', 'spacer'), box('/c/m', 'measurement', { children: [box('/c/m/t', 'text', { text: 'A' })] })] })]);
    expect(ids(drawList([t]))).toEqual(['r', 't']);
  });

  it('leaves out a hidden box and all under it', () => {
    const t = tree([box('/h', 'container', { hidden: true, children: [box('/h/r', 'rectangle')] }), box('/t', 'text', { text: 'shown' })]);
    expect(ids(drawList([t]))).toEqual(['t']);
  });

  it('multiplies alpha down the tree', () => {
    const t = tree([box('/c', 'container', { alpha: 0.5, children: [box('/c/r', 'rectangle', { alpha: 0.5 })] })]);
    expect(drawList([t])[0].alpha).toBeCloseTo(0.25);
  });

  it('draws an enter animation at its end: a widget recorded at alpha 0, a box marked reveal', () => {
    const t = tree([box('/w', 'widget', { alpha: 0, widget: 'W', children: [box('/w/r', 'rectangle')] }), box('/a', 'container', { reveal: true, children: [box('/a/t', 'text', { text: 'x' })] }), box('/f', 'fill', { alpha: 0 })]);
    const items = drawList([t]);
    expect(items.find((i) => i.id.endsWith('/w/r')).alpha).toBe(1);
    expect(items.find((i) => i.id.endsWith('/a/t')).alpha).toBe(1);
    // (an element's own alpha 0 stays 0: a dot the game lights only on a move)
    expect(items.find((i) => i.id.endsWith('/f')).alpha).toBe(0);
  });

  it('draws a selected cell’s highlight in place of its plain twin, and a cell not selected without it', () => {
    const cell = box('/list/Play', 'cell', {
      label: 'PLAY',
      children: [box('/list/Play/MenuText', 'text', { text: 'PLAY' }), box('/list/Play/MenuTextSelected', 'text', { text: 'PLAY', hidden: true }), box('/list/Play/SelectedLine', 'fill', { alpha: 0 }), box('/list/Play/SelectHighlight', 'rectangle', { hidden: true })],
    });
    const t = tree([box('/list', 'staticList', { children: [cell] }), box('/SelectedOutside', 'fill')]);
    const plain = ids(drawList([t]));
    expect(plain).toEqual(['MenuText', 'SelectedOutside']);
    const nav = navigables([t])[0];
    const sel = drawList([t], { selected: new Set([nav.id]) });
    expect(ids(sel)).toEqual(['MenuTextSelected', 'SelectedLine', 'SelectHighlight', 'SelectedOutside']);
    expect(sel.find((i) => i.id.endsWith('SelectedLine')).alpha).toBe(1);
    expect(sel.every((i) => i.cell === nav.id || i.id.endsWith('SelectedOutside'))).toBe(true);
  });

  it('lays a screen’s values on a box before the rules', () => {
    const t = tree([box('/Tile', 'widget', { widget: 'W', children: [box('/Tile/Title', 'text', { text: 'CAMPAIGN' }), box('/Tile/Gone', 'rectangle'), box('/Tile/Back', 'text', { text: 'X', hidden: true }), box('/Tile/Video', 'video')] })]);
    const values = (b, path) => {
      if (path.at(-1) === 'Title') return { text: 'SINGLE PLAYER' };
      if (path.at(-1) === 'Gone') return { hidden: true };
      if (path.at(-1) === 'Back') return { hidden: false };
      if (path.join('/') === 'Tile/Video') return { film: { url: 'f.mp4', poster: 'f.jpg' } };
      return null;
    };
    const items = drawList([t], { values });
    expect(items.map((i) => [i.id.split('/').pop(), i.text ?? i.film?.url ?? null])).toEqual([
      ['Title', 'SINGLE PLAYER'],
      ['Back', 'X'],
      ['Video', 'f.mp4'],
    ]);
  });

  it('leaves the “new” mark off unless a value shows it', () => {
    const mark = box('/NewThingAvailable', 'widget', { widget: 'UI/Frontend/Widgets/Shared/NewThingAvailable', children: [box('/NewThingAvailable/s', 'vectorShape', { shape: 'NewThingAvailable' })] });
    expect(drawList([tree([mark])])).toEqual([]);
    expect(ids(drawList([tree([mark])], { values: (b) => (b.id === '/NewThingAvailable' ? { hidden: false } : null) }))).toEqual(['s']);
  });

  it('keeps each layer’s ids apart and draws the layers in order', () => {
    const a = tree([box('/r', 'rectangle')]);
    const items = drawList([a, a]);
    expect(items.map((i) => [i.layer, i.id])).toEqual([
      [0, '0:/r'],
      [1, '1:/r'],
    ]);
  });
});

describe('the navigable cells', () => {
  it('finds the main menu’s tabs and a page’s tiles as two groups to walk', () => {
    const navs = navigables([screen('MainMenuScreen'), screen('PlayScreen')]);
    const tabs = navs.filter((n) => n.layer === 0);
    expect(tabs.map((n) => n.label)).toContain('PLAY');
    expect(new Set(tabs.map((n) => n.group)).size).toBe(1);
    const first = navs.find((n) => n.layer === 1 && n.label === 'MULTIPLAYER');
    const tiles = navs.filter((n) => n.group === first.group);
    expect(tiles.map((n) => n.id.split('/').pop())).toEqual(['Multiplayer', 'COOP', 'Campaign']);
    expect(tiles.every((n) => n.horizontal)).toBe(true);
    expect(tiles.map((n) => n.index)).toEqual([0, 1, 2]);
    // (a tile is a widget the game walks by its zone; a cell is a list's)
    expect(tiles.every((n) => n.tile)).toBe(true);
    expect(tabs.some((n) => n.tile)).toBe(false);
  });

  it('draws a tab’s selected line and bold words only when it is selected', () => {
    const t = screen('MainMenuScreen');
    const play = navigables([t]).find((n) => n.label === 'PLAY');
    const of = (sel) => ids(drawList([t], { selected: new Set(sel) }).filter((i) => i.cell === play.id));
    expect(of([])).toContain('MenuText');
    expect(of([])).not.toContain('SelectedLineLeft');
    expect(of([play.id])).toEqual(expect.arrayContaining(['SelectedLineLeft', 'MenuTextSelected']));
    expect(of([play.id])).not.toContain('MenuText');
  });

  it('names a tile by its Title as the screen’s values fill it', () => {
    const values = (b, path) => (path.includes('Campaign') && path.at(-1) === 'Title' ? { text: 'OTHER WORDS' } : null);
    const tile = navigables([screen('PlayScreen')], { values }).find((n) => n.id.endsWith('/Campaign'));
    expect(tile.label).toBe('OTHER WORDS');
  });

  it('carries a cell’s link and words, leaves out a hidden one and marks one still to come', () => {
    const t = screen('MainMenuScreen');
    const values = (b, path) => (path.at(-1) === 'Store' ? { hidden: true } : path.at(-1) === 'Career' ? { coming: true } : null);
    const navs = navigables([t], { values });
    expect(navs.find((n) => n.label === 'PLAY')).toMatchObject({ link: 'UI/Data/LinkAssets/Play/PlayScreen', screen: 'UI/Frontend/Screens/Play/PlayScreen', coming: false });
    expect(navs.find((n) => n.id.endsWith('/Career')).coming).toBe(true);
    expect(navs.some((n) => n.id.endsWith('/Store'))).toBe(false);
  });
});
