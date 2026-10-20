import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LEVELS, LEVEL_COUNT, newLevel } from './rules';
import { IDLE } from './flatInput';
import GridView from './GridView';

const draw = (s, input = IDLE, preview = null) => renderToStaticMarkup(<GridView s={s} input={input} preview={preview} />);
const ALLOWED = new Set(['svg', 'g', 'line', 'rect', 'circle', 'polygon', 'polyline', 'path']);

describe('a level from above', () => {
  it('draws every level in abstract markers only', () => {
    for (let i = 0; i < LEVEL_COUNT; i++) expect([...draw(newLevel(i)).matchAll(/<([a-z]+)/g)].every(([, t]) => ALLOWED.has(t)), `level ${i + 1}`).toBe(true);
  });
  it('draws guards as triangles with their cones shaded, and Natasha a filled chevron', () => {
    const s = newLevel(0);
    const out = draw(s);
    expect(out.match(/<polygon[^>]*data-guard/g)).toHaveLength(1);
    expect(out.match(/data-cone="guard"/g)).toHaveLength(1);
    expect(out).toMatch(/<polygon[^>]*data-player[^>]*transform="translate\(3 6\) rotate\(90\)"/);
    s.guards[0].down = true;
    expect(draw(s)).not.toContain('data-cone="guard"');
    expect(draw(s)).toMatch(/data-guard[^>]*data-down/);
  });
  it('draws cameras as wedges, lasers as lines by state, and terminals, the file and the exit as simple icons', () => {
    const cam = newLevel(5);
    for (const a of ['data-camera', 'data-cone="camera"', 'data-terminal', 'data-file', 'data-exit']) expect(draw(cam)).toContain(a);
    cam.cams[0].off = true;
    expect(draw(cam)).not.toContain('data-cone="camera"');
    const las = newLevel(3);
    expect(draw(las).match(/data-laser="on"/g)).toHaveLength(4);
    las.t = 3;
    expect(draw(las)).toContain('data-laser="warn"');
  });
  it('marks the previewed tile, red where the step gets her caught, and rings the Bite’s targets', () => {
    const s = newLevel(0);
    expect(draw(s, IDLE, { x: 3, y: 5, danger: true })).toMatch(/<rect[^>]*data-preview="danger"/);
    expect(draw(s, IDLE, { x: 3, y: 5, danger: false })).toMatch(/data-preview="safe"/);
    LEVELS[200] = { name: 't', tip: '', charges: 1, map: ['#######', '#S.G.F#', '#....E#', '#######'], guards: [{ dir: 'W', route: 'w' }] };
    expect(draw(newLevel(200), { armed: null, biting: true })).toMatch(/<circle[^>]*data-target/);
  });
});
