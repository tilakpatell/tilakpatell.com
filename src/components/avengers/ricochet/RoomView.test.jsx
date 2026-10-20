import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ROOMS, newRoom, throwShield } from './rules';
import { assistFor, previewPath } from './flatInput';
import RoomView from './RoomView';

const html = (i, f) => { const r = newRoom(i); f?.(r); return renderToStaticMarkup(<RoomView room={r} angle={0} assist={false} />); };
const ALLOWED = new Set(['svg', 'defs', 'pattern', 'g', 'line', 'rect', 'circle', 'polygon', 'polyline', 'path']);

describe('a room from above', () => {
  it('draws every room in abstract markers only', () => {
    for (let i = 0; i < ROOMS.length; i++) {
      const out = renderToStaticMarkup(<RoomView room={newRoom(i)} angle={0} assist={assistFor(i)} />);
      expect([...out.matchAll(/<([a-z]+)/g)].every(([, t]) => ALLOWED.has(t)), `room ${i + 1}`).toBe(true);
    }
  });
  it('draws steel solid, mats hatched, glass dashed and doors and switches as toggles', () => {
    expect(html(0)).toMatch(/<line[^>]*data-wall="steel"/);
    expect(html(0)).not.toMatch(/data-wall="steel"[^>]*stroke-dasharray/);
    expect(html(3)).toMatch(/data-wall="mat"[^>]*fill="url\(#rf-hatch\)"/);
    expect(html(4)).toMatch(/<line[^>]*data-wall="glass"[^>]*stroke-dasharray/);
    expect(html(6)).toContain('data-wall="door"');
    expect(html(6)).toContain('data-switch');
    expect(html(6, (r) => (r.walls.find((w) => w.kind === 'door').open = true))).toMatch(/data-wall="door"[^>]*data-open/);
    expect(html(4, (r) => (r.walls.find((w) => w.kind === 'glass').broken = true))).not.toContain('data-wall="glass"');
  });
  it('draws bots as squares, armoured ones double-outlined, and the hostage an open circle', () => {
    expect(html(0)).toMatch(/<rect[^>]*data-bot="bot"/);
    const armored = html(10).match(/<g[^>]*data-bot="armored".*?<\/g>/s)[0];
    expect(armored.match(/<rect/g)).toHaveLength(2);
    expect(html(8)).toMatch(/<circle[^>]*data-bot="hostage"[^>]*fill="none"/);
    expect(html(0, (r) => (r.bots[0].down = true))).toContain('data-down');
  });
  it('turns the thrower’s chevron to the aim, and shows the plain disc in the accent only in flight', () => {
    const r = newRoom(0);
    const a = (30 * Math.PI) / 180;
    const aim = renderToStaticMarkup(<RoomView room={r} angle={a} assist />);
    expect(aim).toMatch(/<polygon[^>]*data-thrower[^>]*transform="translate\(0 4\.6\) rotate\(30\.0\)"/);
    expect(aim).toMatch(/<circle[^>]*data-disc[^>]*visibility="hidden"/);
    expect(aim.match(/data-preview[^>]*points="([^"]*)"/)[1].trim().split(' ')).toHaveLength(previewPath(r, a, true).length);
    throwShield(r, 0);
    const fly = renderToStaticMarkup(<RoomView room={r} angle={0} assist />);
    expect(fly).toMatch(/<circle[^>]*data-disc[^>]*fill="var\(--hq-accent\)"/);
    expect(fly).not.toMatch(/data-disc[^>]*visibility="hidden"/);
  });
});

describe('the 2D view’s cards over the room', () => {
  it('sit on glass dense enough to read over the room’s bright walls, the 3D game’s own left as it is', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('./ricochet.css', import.meta.url), 'utf8');
    const rule = css.match(/\.rf > \.hq-overlay \{ background: ([^;]+); \}/);
    expect(rule, 'a .rf > .hq-overlay background').not.toBe(null);
    const alphas = [...rule[1].matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(alphas.length).toBeGreaterThan(0);
    expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0.78);
  });
});

describe('the 2D view’s angle readout', () => {
  it('follows the aim every frame, as the room’s moving parts do, so a mouse aiming as it moves reads true', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./Flat.jsx', import.meta.url), 'utf8');
    const loop = src.slice(src.indexOf('const loop = shownLoop('), src.indexOf('return () => loop.stop();'));
    expect(loop).toMatch(/deg\.current\.textContent = `\$\{\(\(ctl\.angle \* 180\) \/ Math\.PI\)\.toFixed\(1\)\}°`/);
    expect(src).toMatch(/<span ref=\{deg\}>/);
  });
});
