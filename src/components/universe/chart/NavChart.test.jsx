import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NavChart from './NavChart';
import { FRAMES, createView, project, toFrame } from './projection';
import { HAND_MARKS, markById } from './marks';

const view = createView({ range: 120000 });
const li = (html, id) => html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))?.[0] ?? '';
const at = (html, id) => {
  const m = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id));
  return m && [Number(m[1]), Number(m[2])];
};
const tags = (html, cls) => html.match(new RegExp(`<[a-z]+[^>]*class="${cls}"[^>]*>`, 'g')) ?? [];
const draw = (props) => renderToStaticMarkup(<NavChart view={view} marks={HAND_MARKS} {...props} />);

describe('the nav map’s chart', () => {
  it('puts each place where the projection says', () => {
    const html = draw({});
    for (const id of ['marvel', 'aurelia', 'veil']) {
      const p = project(view, markById(id).at);
      const { x, y } = toFrame(FRAMES.nav, [p.u, p.v]);
      expect(at(html, id)[0]).toBeCloseTo((x / 1000) * 100, 6);
      expect(at(html, id)[1]).toBeCloseTo((y / 1000) * 100, 6);
    }
  });
  it('always draws the ship: in the middle, or pinned to the rim when it is far', () => {
    expect(tags(draw({ ship: { x: 0, y: 0, z: 0, heading: 0 } }), 'navmap-ship')[0]).toContain('translate(500 500)');
    expect(tags(draw({ ship: { x: 9e6, y: 2e5, z: 0, heading: 0 } }), 'navmap-ship')[0]).toContain('data-edge');
  });
  it('draws no ship and no readout with no ship', () => {
    const html = draw({ ship: null, readout: null });
    expect(html).not.toContain('navmap-ship');
    expect(html).not.toContain('navmap-readout');
  });
  it('stands places on stems up and down', () => {
    const marks = [{ id: 'up', kind: 'world', name: 'Up', at: [3000, 2500, 0], priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true }, { id: 'down', kind: 'world', name: 'Down', at: [-3000, -2500, 0], priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true }];
    const stems = tags(renderToStaticMarkup(<NavChart view={view} marks={marks} />), 'navmap-stem');
    expect(stems.some((t) => t.includes('data-dir="up"'))).toBe(true);
    expect(stems.some((t) => t.includes('data-dir="down"'))).toBe(true);
  });
  it('hides colliding names but never the picked one’s, and shows the readout', () => {
    const pile = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, kind: 'world', name: `Place ${i}`, at: [5000 + i, 0, 0], priority: 10 - i, color: '#fff', levels: ['neighbourhood'], pickable: true }));
    const html = renderToStaticMarkup(<NavChart view={view} marks={pile} pick="p5" readout="Sector 2, 0, 0 · 3,800 ship-lengths above the disc" />);
    expect(li(html, 'p5')).not.toContain('data-quiet');
    expect(pile.some((m) => li(html, m.id).includes('data-quiet'))).toBe(true);
    expect(html).toContain('Sector 2, 0, 0 · 3,800 ship-lengths above the disc');
  });
});
