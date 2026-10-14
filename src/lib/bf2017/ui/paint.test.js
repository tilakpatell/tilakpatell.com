import { describe, expect, it } from 'vitest';
import { fakeContext } from './fixtures/fakeContext';
import { frameOf } from './layout';
import { fontOf, paint, resolveFamily } from './paint';

const at = (width, height) => ({ frame: frameOf({ width, height }), window: { width, height }, read: () => '', makePath: (d) => ({ d }) });
const item = (more) => ({ id: '0:x', alpha: 1, x: 0, y: 0, w: 10, h: 10, ...more });

describe('the painter', () => {
  it('resolves the game’s font variables down to the faces', () => {
    const vars = { '--font-bf-hud': " 'BF Univers Condensed', var(--font-bf-cjk), sans-serif", '--font-bf-cjk': "'BF HS Gothic'" };
    expect(resolveFamily('var(--font-bf-hud)', (n) => vars[n])).toBe("'BF Univers Condensed', 'BF HS Gothic', sans-serif");
    expect(resolveFamily("'Roboto BF', var(--none)", () => '')).toBe("'Roboto BF', ");
  });

  it('keeps type at 0.7 rem in a small window', () => {
    expect(fontOf({ font: { family: 'x', size: 10, weight: 500 } }, 0.5, () => '')).toBe('500 22.4px x');
    expect(fontOf({ font: { family: 'x', size: 24, weight: 700 } }, 1, () => '')).toBe('700 24px x');
  });

  it('draws a tab: its line as a filled rect, its words centred in its face', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'fill', x: 284, y: 110, w: 2, h: 48, colour: 'rgb(242 174 10)' }), item({ type: 'text', x: 284, y: 110, w: 190, h: 48, text: 'PLAY', font: { family: 'BF', size: 24, weight: 700 }, align: ['center', 'center'] })], at(1920, 1080));
    expect(ctx.calls).toContainEqual(['fillRect', 284, 110, 2, 48]);
    expect(ctx.calls).toContainEqual(['set', 'fillStyle', 'rgb(242 174 10)']);
    expect(ctx.calls).toContainEqual(['fillText', 'PLAY', 379, 134]);
    expect(ctx.calls).toContainEqual(['set', 'textAlign', 'center']);
    expect(ctx.calls).toContainEqual(['set', 'textBaseline', 'middle']);
    expect(ctx.calls).toContainEqual(['set', 'font', '700 24px BF']);
  });

  it('scales to the frame and the pixel ratio, and counts what it cannot draw yet', () => {
    const ctx = fakeContext();
    const r = paint(ctx, [item({ type: 'arc' })], { ...at(2560, 1080), ratio: 2 });
    expect(ctx.calls).toContainEqual(['clearRect', 0, 0, 5120, 2160]);
    expect(ctx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 640, 0]);
    expect(r.skipped).toEqual({ arc: 1 });
    expect(r.drawn).toBe(0);
    expect(typeof r.ms).toBe('number');
  });

  it('rounds a box’s corners by its corners, the tile row’s outer ones', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'rectangle', fill: 'none', line: 1, colour: 'white', x: 0, y: 0, w: 100, h: 50, corners: [4, 0, 0, 4] })], at(1920, 1080));
    expect(ctx.calls.filter((c) => c[0] === 'arcTo')).toHaveLength(2);
    expect(ctx.calls).toContainEqual(['stroke']);
    expect(ctx.calls.some((c) => c[0] === 'strokeRect')).toBe(false);
  });

  it('draws a line through its points, a tile’s top line as long as its title', () => {
    const ctx = fakeContext();
    const title = item({ id: '0:/T/Title', cell: 't', type: 'text', text: 'MULTIPLAYER', x: 30, y: 400, w: 450, h: 48, font: { family: 'BF', size: 48, weight: 700 } });
    const top = item({ id: '0:/T/TileWidget/SelectedTopLine', cell: 't', type: 'line', x: 32, y: 1, w: 470, h: 5, points: [[0, 0], [10, 0]], line: 6, cap: 'round', follow: 'Title', colour: 'rgb(242 174 10)' });
    paint(ctx, [top, title], at(1920, 1080));
    expect(ctx.calls).toContainEqual(['moveTo', 32, 1]);
    expect(ctx.calls).toContainEqual(['lineTo', 142, 1]);
    expect(ctx.calls).toContainEqual(['set', 'lineCap', 'round']);
    expect(ctx.calls).toContainEqual(['set', 'lineWidth', 6]);
  });

  const scratch = () => {
    const made = [];
    return { made, makeCanvas: (w, h) => (made.push(fakeContext()), { width: w, height: h, ctx: made.at(-1), getContext() { return this.ctx; } }) };
  };
  const poster = { naturalWidth: 100, naturalHeight: 80, complete: true };

  it('turns a film its widget colours that colour, multiplied on a canvas of its own', () => {
    const ctx = fakeContext();
    const s = scratch();
    paint(ctx, [item({ id: '0:/tile/Video', type: 'video', x: 0, y: 0, w: 100, h: 80, film: { url: 'v.webm', poster: 'p.webp' }, tint: 'rgb(242 174 10)' })], { ...at(1920, 1080), media: { 'p.webp': poster }, makeCanvas: s.makeCanvas });
    expect(s.made[0].calls).toContainEqual(['set', 'globalCompositeOperation', 'multiply']);
    expect(s.made[0].calls).toContainEqual(['set', 'fillStyle', 'rgb(242 174 10)']);
    expect(ctx.calls.some((c) => c[0] === 'drawImage' && c[1]?.ctx === s.made[0])).toBe(true);
  });

  it('adds the CRT trail’s glow over the key colour’s parts, blurred, in the trail’s colour, with its scanlines', () => {
    const ctx = fakeContext();
    const s = scratch();
    const word = item({ id: '0:/tab/MenuText', type: 'text', text: 'PLAY', x: 0, y: 0, w: 190, h: 48, colour: 'rgb(242 174 10)', font: { family: 'BF', size: 24 } });
    const trail = { items: [word], colour: [1, 0.5, 0.5], scale: 0.5, alpha: 1, scanlines: { width: 1, spacing: 2, off: 0.75 } };
    paint(ctx, [], { ...at(1920, 1080), trail, makeCanvas: s.makeCanvas });
    const [keyed, blur] = s.made;
    expect(keyed.calls).toContainEqual(['set', 'fillStyle', 'rgb(242 87 5)']);
    expect(blur.calls).toContainEqual(['set', 'filter', 'blur(5px)']);
    expect(blur.calls).toContainEqual(['set', 'globalCompositeOperation', 'destination-out']);
    expect(ctx.calls).toContainEqual(['set', 'globalCompositeOperation', 'lighter']);
    // (with no canvas to draw it on, no glow)
    const bare = fakeContext();
    paint(bare, [], { ...at(1920, 1080), trail, makeCanvas: () => null });
    expect(bare.calls).not.toContainEqual(['set', 'globalCompositeOperation', 'lighter']);
  });

  it('draws a bleeding box over the whole window', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'fill', colour: 'black', bleed: true, x: 0, y: 0, w: 1920, h: 1080 })], at(2560, 1080));
    expect(ctx.calls).toContainEqual(['fillRect', -320, 0, 2560, 1080]);
  });

  it('strokes an outline inside its box, at least a pixel of the window wide', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'rectangle', fill: 'none', line: 1, colour: 'grey', x: 97, y: 224, w: 504, h: 736 })], at(960, 540));
    expect(ctx.calls).toContainEqual(['set', 'lineWidth', 2]);
    expect(ctx.calls).toContainEqual(['strokeRect', 98, 225, 502, 734]);
  });

  it('fills a coloured rectangle whatever its line, as the DOM screens did', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'rectangle', fill: 'color', line: 5, colour: 'rgb(24 24 24)', x: 450, y: 724, w: 1021, h: 96 })], at(1920, 1080));
    expect(ctx.calls).toContainEqual(['fillRect', 450, 724, 1021, 96]);
    expect(ctx.calls.some((c) => c[0] === 'strokeRect')).toBe(false);
  });

  it('draws a single-pixel line along its box, a pixel of the window thick, through its middle', () => {
    const ctx = fakeContext();
    const r = paint(ctx, [item({ type: 'singlePixelLine', colour: 'rgb(50 60 65)', x: 127, y: 711, w: 28, h: 20 }), item({ type: 'singlePixelLine', colour: 'grey', x: 10, y: 0, w: 1, h: 40 })], at(1920, 1080));
    expect(ctx.calls).toContainEqual(['fillRect', 127, 720.5, 28, 1]);
    expect(ctx.calls).toContainEqual(['fillRect', 10, 0, 1, 40]);
    expect(r.drawn).toBe(2);
  });

  it('draws nothing for a blurred backing, and counts it unless the frosted panels under the canvas draw it', () => {
    const ctx = fakeContext();
    expect(paint(ctx, [item({ type: 'rectangle', fill: 'blurred' })], at(1920, 1080)).skipped).toEqual({ blurred: 1 });
    expect(paint(ctx, [item({ type: 'rectangle', fill: 'blurred' })], { ...at(1920, 1080), frost: true }).skipped).toEqual({});
  });

  it('wraps words at the box’s width, a line and a quarter apart', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'text', x: 0, y: 0, w: 80, h: 100, text: 'ONE TWO THREE', wrap: true, font: { family: 'x', size: 20, weight: 400 }, align: ['left', 'top'] })], at(1920, 1080));
    const lines = ctx.calls.filter((c) => c[0] === 'fillText');
    expect(lines).toEqual([
      ['fillText', 'ONE TWO', 0, 0],
      ['fillText', 'THREE', 0, 25],
    ]);
  });

  it('fills a vector shape even-odd in the item’s colour, scaled into its box and centred', () => {
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'vectorShape', shape: 'NewThingAvailable', colour: 'rgb(242 174 10)', x: 267, y: 114, w: 24, h: 12 })], at(1920, 1080));
    expect(ctx.calls).toContainEqual(['translate', 273, 114]);
    expect(ctx.calls).toContainEqual(['scale', 1, 1]);
    expect(ctx.calls).toContainEqual(['set', 'fillStyle', 'rgb(242 174 10)']);
    expect(ctx.calls).toContainEqual(['fill', { d: 'M10.5 0L0 0L0 1.5L10.5 12L12 12L12 1.5Z' }, 'evenodd']);
  });

  it('keeps a white shape’s own colour, and counts a shape it does not know', () => {
    const ctx = fakeContext();
    const r = paint(ctx, [item({ type: 'vectorShape', shape: 'NewThingAvailable', colour: 'rgb(255 255 255)' }), item({ type: 'vectorShape', shape: 'NoSuchShape' })], at(1920, 1080));
    expect(ctx.calls).toContainEqual(['set', 'fillStyle', 'rgb(255 255 255)']);
    expect(r.missing).toEqual({ shapes: 1, textures: 0 });
  });

  it('draws a texture box’s picture stretched over its box, by its UV', () => {
    const img = { complete: true, naturalWidth: 2048, naturalHeight: 2048 };
    const ctx = fakeContext();
    const texture = { id: 2069381427, ref: '3D80EC7618F789C7', uv: [0, 0, 1, 1], align: 'stretch' };
    const pictureOf = () => ({ url: '/k.webp' });
    const r = paint(ctx, [item({ type: 'texture', texture, x: 0, y: 0, w: 1920, h: 1080 })], { ...at(1920, 1080), media: { '/k.webp': img }, pictureOf });
    expect(ctx.calls).toContainEqual(['drawImage', img, 0, 0, 2048, 2048, 0, 0, 1920, 1080]);
    expect(r.drawn).toBe(1);
  });

  it('draws a picture made ready ahead (an ImageBitmap, its own width and height)', () => {
    const bitmap = { width: 960, height: 540 };
    const ctx = fakeContext();
    const texture = { id: 1, ref: null, uv: [0, 0, 1, 1], align: 'stretch' };
    paint(ctx, [item({ type: 'texture', texture, x: 0, y: 0, w: 1920, h: 1080 })], { ...at(1920, 1080), media: { '/k.webp': bitmap }, pictureOf: () => ({ url: '/k.webp' }) });
    expect(ctx.calls).toContainEqual(['drawImage', bitmap, 0, 0, 960, 540, 0, 0, 1920, 1080]);
  });

  it('counts a texture with no picture, and draws nothing for one still loading', () => {
    const ctx = fakeContext();
    const texture = { id: 1, ref: null, uv: [0, 0, 1, 1], align: 'stretch' };
    const none = paint(ctx, [item({ type: 'texture', texture })], { ...at(1920, 1080), pictureOf: () => null });
    expect(none.missing.textures).toBe(1);
    const loading = paint(fakeContext(), [item({ type: 'texture', texture })], { ...at(1920, 1080), pictureOf: () => ({ url: '/x.webp' }) });
    expect(loading.missing.textures).toBe(0);
  });

  it('lays an additive film on what is under it, and puts the blend back after', () => {
    const film = { url: 'f.mp4', poster: 'f.jpg' };
    const poster = { complete: true, naturalWidth: 100, naturalHeight: 100 };
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'video', film, blend: 'additive' }), item({ type: 'fill', colour: 'red' })], { ...at(1920, 1080), media: { 'f.jpg': poster } });
    const ops = ctx.calls.filter((c) => c[0] === 'set' && c[1] === 'globalCompositeOperation').map((c) => c[2]);
    expect(ops).toEqual(['lighter', 'source-over', 'source-over', 'source-over']);
  });

  it('draws a film’s poster to cover its box when no video is ready, the video once one is', () => {
    const film = { url: 'f.mp4', poster: 'f.jpg' };
    const poster = { complete: true, naturalWidth: 200, naturalHeight: 100 };
    const ctx = fakeContext();
    paint(ctx, [item({ type: 'video', film, x: 0, y: 0, w: 100, h: 100 })], { ...at(1920, 1080), media: { 'f.jpg': poster, 'f.mp4': { readyState: 1 } } });
    expect(ctx.calls).toContainEqual(['drawImage', poster, 50, 0, 100, 100, 0, 0, 100, 100]);
    const video = { readyState: 4, videoWidth: 100, videoHeight: 100 };
    const ctx2 = fakeContext();
    paint(ctx2, [item({ type: 'video', film, x: 0, y: 0, w: 100, h: 100 })], { ...at(1920, 1080), media: { 'f.jpg': poster, 'f.mp4': video } });
    expect(ctx2.calls).toContainEqual(['drawImage', video, 0, 0, 100, 100, 0, 0, 100, 100]);
  });
});
