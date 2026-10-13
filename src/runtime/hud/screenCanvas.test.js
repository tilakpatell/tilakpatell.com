import { describe, expect, it, vi } from 'vitest';
import { fakeContext } from '../../lib/bf2017/ui/fixtures/fakeContext';
import { drawList, frameOf, navigables } from '../../lib/bf2017/ui/layout';
import { screen } from '../../lib/bf2017/ui/screens';
import { activate, buttonStyle, createPainter, filmPlan, fontsOf, frostOf, keyOn, splitGlow } from './screenCanvas';

const MENU = screen('MainMenuScreen');
const PLAY = screen('PlayScreen');
const navs = navigables([MENU, PLAY]);
const tab = (label) => navs.find((n) => n.layer === 0 && n.label === label);

describe('the buttons over the canvas', () => {
  it('lies over each cell in the window’s pixels, the frame centred in a wider window', () => {
    const play = tab('PLAY');
    expect(buttonStyle(play, frameOf({ width: 1920, height: 1080 }))).toEqual({ left: '284px', top: '110px', width: '190px', height: '48px' });
    expect(buttonStyle(play, frameOf({ width: 2560, height: 1080 }))).toEqual({ left: '604px', top: '110px', width: '190px', height: '48px' });
    const small = buttonStyle(play, frameOf({ width: 960, height: 540 }));
    expect(small).toEqual({ left: '142px', top: '55px', width: '95px', height: '24px' });
  });

  it('walks a group with the arrows, and moves on to the next group only with Tab (the page’s own)', () => {
    const e = (key) => ({ key, preventDefault: vi.fn() });
    expect(keyOn(e('ArrowRight'), tab('HOME'), navs, {})).toEqual({ focus: tab('PLAY').id });
    expect(keyOn(e('ArrowLeft'), tab('HOME'), navs, {}).focus).toBe(navs.filter((n) => n.group === tab('HOME').group).at(-1).id);
    expect(keyOn(e('Tab'), tab('HOME'), navs, {})).toBeNull();
    const tiles = navs.filter((n) => n.layer === 1 && n.group === navs.find((m) => m.label === 'MULTIPLAYER').group);
    expect(keyOn(e('ArrowRight'), tiles[0], navs, {})).toEqual({ focus: tiles[1].id });
  });

  it('goes where a cell links on Enter or a click, tells an unlinked one by its name, and does nothing for one still to come', () => {
    const onLink = vi.fn();
    const onAction = vi.fn();
    keyOn({ key: 'Enter', preventDefault() {} }, tab('PLAY'), navs, { onLink, onAction });
    expect(onLink).toHaveBeenCalledWith('UI/Frontend/Screens/Play/PlayScreen', tab('PLAY'));
    const tile = navs.find((n) => n.label === 'MULTIPLAYER');
    activate(tile, { onLink, onAction });
    expect(onAction).toHaveBeenCalledWith('Multiplayer', tile);
    onAction.mockClear();
    activate({ ...tile, coming: true }, { onLink, onAction });
    keyOn({ key: 'Enter', preventDefault() {} }, { ...tile, coming: true }, navs, { onLink, onAction });
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('the paints', () => {
  const read = () => 'sans-serif';
  const args = (items) => ({ items, frame: frameOf({ width: 1920, height: 1080 }), window: { width: 1920, height: 1080 }, ratio: 2, media: {} });

  it('lists the fonts a screen draws in, once each', () => {
    const fonts = fontsOf(drawList([MENU]), 1, read);
    expect(fonts).toContain('500 24px sans-serif');
    expect(new Set(fonts).size).toBe(fonts.length);
  });

  it('paints at once, and again when the game’s fonts have loaded', async () => {
    const ctx = fakeContext();
    let done;
    const fonts = { load: vi.fn(() => new Promise((r) => (done = r))) };
    const painter = createPainter({ ctx, read, fonts, raf: () => 0, caf: () => {} });
    painter.draw(args(drawList([MENU])));
    const first = ctx.calls.filter((c) => c[0] === 'clearRect').length;
    expect(first).toBe(1);
    expect(ctx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    done();
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.calls.filter((c) => c[0] === 'clearRect').length).toBe(2);
    // (a font already asked for is not asked for again)
    painter.draw(args(drawList([MENU])));
    expect(fonts.load).toHaveBeenCalledTimes(new Set(fontsOf(drawList([MENU]), 1, read)).size);
  });

  it('paints every frame while a film plays, and stops when it stops', () => {
    const ctx = fakeContext();
    const frames = [];
    const painter = createPainter({ ctx, read, fonts: { load: () => Promise.resolve() }, raf: (f) => frames.push(f), caf: () => {} });
    painter.draw(args([]));
    painter.playing(true);
    expect(frames).toHaveLength(1);
    frames.shift()();
    expect(frames).toHaveLength(1);
    painter.playing(false);
    frames.shift()();
    expect(frames).toHaveLength(0);
    expect(painter.last().ms).toBeGreaterThanOrEqual(0);
  });

  it('paints every frame again when a film plays again after it stopped', () => {
    const frames = [];
    const painter = createPainter({ ctx: fakeContext(), read, fonts: null, raf: (f) => frames.push(f), caf: () => {} });
    painter.draw(args([]));
    painter.playing(true);
    painter.playing(false);
    frames.length = 0;
    painter.playing(true);
    expect(frames).toHaveLength(1);
  });

  it('plays no film with reduced motion or a saver connection, and always shows its poster', () => {
    const items = [{ type: 'video', film: { url: 'a.mp4', poster: 'a.jpg' } }, { type: 'video', film: { url: 'a.mp4', poster: 'a.jpg' } }];
    expect(filmPlan(items, { play: true })).toEqual({ videos: ['a.mp4'], posters: ['a.jpg'] });
    expect(filmPlan(items, { play: false })).toEqual({ videos: [], posters: ['a.jpg'] });
  });

  it('loads each texture box’s picture once, with the films’ posters', () => {
    const items = [{ type: 'texture', texture: { id: 1 } }, { type: 'texture', texture: { id: 1 } }, { type: 'texture', texture: { id: 2 } }];
    const pictureOf = (i) => (i.texture.id === 1 ? { url: '/one.webp' } : null);
    expect(filmPlan(items, { play: true, pictureOf })).toEqual({ videos: [], posters: ['/one.webp'] });
  });
});

describe('the additive layer', () => {
  it('puts what the game adds onto what is under it on a canvas of its own, in order, the rest on the base', () => {
    const items = [{ id: 'a', type: 'video', blend: 'additive' }, { id: 'b', type: 'text' }, { id: 'c', type: 'fill', blend: 'additive' }, { id: 'd', type: 'fill', blend: 'multiplicative' }];
    const { base, glow } = splitGlow(items);
    expect(base.map((i) => i.id)).toEqual(['b', 'd']);
    expect(glow.map((i) => i.id)).toEqual(['a', 'c']);
  });
});

describe('the frosted panels', () => {
  it('lays a blurring panel under each box the game blurs what is behind, in the window’s pixels', () => {
    const items = [{ id: '0:a', type: 'rectangle', fill: 'blurred', x: 97, y: 224, w: 504, h: 736, alpha: 1 }, { id: '0:b', type: 'rectangle', fill: 'color', x: 0, y: 0, w: 1, h: 1, alpha: 1 }];
    const f = frostOf(items, frameOf({ width: 2560, height: 1080 }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ id: '0:a', style: { left: '417px', top: '224px', width: '504px', height: '736px', opacity: 1 } });
    expect(f[0].style.backdropFilter).toMatch(/^blur\(\d+(\.\d+)?px\)/);
  });
});
