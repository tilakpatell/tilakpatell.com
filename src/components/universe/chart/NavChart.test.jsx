import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NavChart from './NavChart';
import { FRAMES, createView, orbitBy, project, toFrame } from './projection';
import { HAND_MARKS, markById } from './marks';
import { CHART_WORDS as W } from '../words';

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

  it('draws every one of the war’s sectors wherever they are, and the front’s button', () => {
    const sectors = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, at: [i * 400000 - 1200000, 0, 9000], owner: i < 3 ? 0 : 1 }));
    const front = { name: 'The battle of the gap', at: [1200, 0, 900], sectors, contested: 3, colours: ['#f00', '#00f'] };
    const html = draw({ front, frontTitle: 'Race to the front', frontOff: false, onFront: () => {} });
    expect(tags(html, 'navmap-war-sector')).toHaveLength(7);
    const button = html.match(/<button[^>]*class="navmap-place navmap-frontbtn"[^>]*>/)?.[0];
    expect(button).toContain('title="Race to the front"');
    expect(button).not.toContain('disabled');
    expect(html).toContain('The front · The battle of the gap');
    expect(draw({ front, frontOff: true }).match(/<button[^>]*navmap-frontbtn[^>]*>/)[0]).toContain('disabled');
  });
  it('says its level and its tilt, and keeps the tools, the readout and the way out', () => {
    const chart = (html) => html.match(/<div[^>]*class="navmap-chart"[^>]*>/)[0];
    const flat = draw({});
    expect(chart(flat)).toContain('data-level="neighbourhood"');
    expect(chart(flat)).not.toContain('data-pitched');
    const tilted = renderToStaticMarkup(<NavChart view={orbitBy(view, [0.3, 0.4])} marks={HAND_MARKS} />);
    expect(chart(tilted)).toContain('data-pitched');
    expect(chart(draw({ view: createView({ range: 2000 }) }))).toContain('data-level="system"');
    const f = () => {};
    const html = draw({ readout: 'Sector 0, 0, 0 · Level with the disc', out: { label: 'Out to the universe', onClick: f }, tools: { onZoomIn: f, onZoomOut: f, onShip: f, atShip: true, onFlat: f, flat: true } });
    const bar = html.slice(html.indexOf('class="navmap-bar"'));
    expect(bar).toContain('class="navmap-readout"');
    expect(bar).toContain(`aria-label="${W.zoomIn}"`);
    expect(bar.indexOf('navmap-readout')).toBeLessThan(bar.indexOf('navmap-tools'));
    expect(tags(html, 'navmap-out')[0]).toBeDefined();
    expect(html).toContain('Out to the universe');
    expect(draw({}).includes('navmap-out')).toBe(false);
  });
  it('names Home system and the Curve as buttons at their zoom, and keeps the sun and the pilots off the list', () => {
    const near = draw({});
    expect(li(near, 'chart:home')).toContain('data-kind="region"');
    expect(near).toContain('navmap-homebtn');
    expect(li(near, 'chart:sun')).toBe('');
    const pilots = [{ id: 'pilot:a', kind: 'pilot', shape: 'pilot', name: '', at: [200, 0, 300], priority: 70, color: '#7dff9a', levels: ['system', 'neighbourhood'], pickable: false }];
    const html = renderToStaticMarkup(<NavChart view={view} marks={[...HAND_MARKS, ...pilots]} />);
    expect(li(html, 'pilot:a')).toBe('');
    expect(tags(html, 'navmap-pilot')).toHaveLength(1);
    const far = renderToStaticMarkup(<NavChart view={createView({ range: 400000 })} marks={HAND_MARKS} />);
    expect(li(far, 'chart:curve')).toContain('data-kind="region"');
  });
  it('dims what the filter leaves out, lights what the list points at, and marks the pick and where the ship is', () => {
    const html = draw({ dim: new Set(['marvel']), hover: 'aurelia', pick: 'veil', here: 'ember' });
    expect(li(html, 'marvel')).toContain('data-dim');
    expect(li(html, 'marvel')).toContain('data-quiet');
    expect(li(html, 'aurelia')).toContain('data-hover');
    expect(li(html, 'veil')).toContain('data-pick');
    expect(html.match(/<button[^>]*aria-label="Ember[^"]*"[^>]*>/)[0]).toContain('aria-current="location"');
    expect(html).toContain('aria-label="Ember, Star, you’re here"');
  });
  it('draws the course from the ship to where it goes, pinned to the rim when that is far', () => {
    const html = draw({ ship: { x: 0, y: 0, z: 0, heading: 0 }, course: { to: [9e6, 0, 0], drive: 'hyper' } });
    const line = tags(html, 'navmap-course')[0];
    expect(line).toContain('data-drive="hyper"');
    const x2 = Number(/x2="([-\d.]+)"/.exec(line)[1]);
    expect(Math.hypot(x2 - 500, Number(/y2="([-\d.]+)"/.exec(line)[1]) - 500)).toBeLessThanOrEqual(470);
    expect(draw({ ship: null, course: { to: [100, 0, 0], drive: 'plot' } })).not.toContain('navmap-course');
  });
});
