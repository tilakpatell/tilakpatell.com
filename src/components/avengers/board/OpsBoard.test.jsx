import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import OpsBoard, { BoardCard } from './OpsBoard';
import { boardCards } from './records';
import { hqState } from '../world/links';
import { PLACES, progress } from '../world/rules';

const from = (o) => (k, f) => (k in o ? o[k] : f);
const render = (p) => renderToStaticMarkup(<MemoryRouter><OpsBoard get={from({})} {...p} /></MemoryRouter>);
const count = (h, s) => h.split(s).length - 1;
const ids = (h) => [...h.matchAll(/id="hq-card-([a-z]+)"/g)].map((m) => m[1]);
const ALL = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space'];
// the elements of a tree, depth first (src/pages/Worlds.test.jsx:14-21)
const walk = (el, out = []) => {
  if (Array.isArray(el)) el.forEach((e) => walk(e, out));
  else if (el && typeof el === 'object' && el.props) {
    out.push(el);
    walk(el.props.children, out);
  }
  return out;
};
const words = (e) => [e.props.children].flat().filter((x) => typeof x === 'string').join('');

describe('the ops board', () => {
  it('puts the records strip above the eight cards, in the tour’s order', () => {
    const html = render({ prog: progress([]), can3D: true });
    expect(html).toContain('id="hq-board"');
    expect(html).toContain('aria-labelledby="hq-board-title"');
    expect(ids(html)).toEqual(PLACES.map((p) => p.id));
    expect(html.indexOf('class="hq-records')).toBeLessThan(html.indexOf('id="hq-card-stark"'));
  });
  it('links Play to every building, and offers Go there only when the compound is in 3D', () => {
    const go = render({ prog: progress([]), can3D: true, onGo: () => {} });
    for (const to of ['/avengers/workshop', '/avengers/lawn', '/avengers/training', '/avengers/range', '/avengers/operations', '/avengers/lab', '/avengers/gate', '/avengers/hangar']) expect(go).toContain(`href="${to}"`);
    expect(count(go, '>Go there<')).toBe(8);
    expect(count(render({ prog: progress([]), can3D: false, onGo: () => {} }), '>Go there<')).toBe(0);
    expect(count(render({ prog: progress([]), can3D: true }), '>Go there<')).toBe(0);
  });
  it('offers Try 3D only on a card whose stone is won in the 3D game, and only where 3D can be tried', () => {
    const prog = progress(['power']);
    const off = render({ prog, can3D: false, onTry3D: () => {} });
    expect(count(off, '>Try 3D<')).toBe(4);
    expect(count(off, 'The stone here is won in the 3D game.')).toBe(4);
    expect(count(off, '>Play in 2D<')).toBe(2);
    expect(count(render({ prog, can3D: false }), '>Try 3D<')).toBe(0);
    expect(count(render({ prog, can3D: true, onTry3D: () => {} }), '>Try 3D<')).toBe(0);
  });
  it('counts Things to do as the HUD does, 8/8 with every stone and Thwip!, and shows the kept records', () => {
    expect(render({ prog: progress(ALL, ['spidey']), can3D: true })).toContain('<dt>Things to do</dt><dd>8/8</dd>');
    expect(render({ prog: progress(ALL), can3D: true })).toContain('<dt>Things to do</dt><dd>7/8</dd>');
    const kept = render({ prog: progress(['power']), can3D: true, unlocked: ['worthy', 'snap'], get: from({ 'tp-hq-swing-tour': 41.3, 'tp-hq-ricochet': { stars: [3, 2, 1] } }) });
    expect(kept).toContain('<dt>Swing tour</dt><dd>0:41.3</dd>');
    expect(kept).toContain('<dt>Best style</dt><dd>Not yet</dd>');
    expect(kept).toContain('<dt>Backpacks</dt><dd>0 of 12</dd>');
    expect(kept).toContain('<dt>Achievements</dt><dd>1 of 14</dd>');
    expect(kept).toContain('3 of 12 rooms · 6 of 36 stars');
    expect(kept).toContain('No score yet');
  });
  it('opens a building with the page’s own state, so Back comes back to the board, and hands each button its place', () => {
    const go = vi.fn();
    const try3D = vi.fn();
    const card = boardCards(progress([]), { get: from({}), can3D: false }).find((c) => c.id === 'thor');
    const els = walk(BoardCard({ card, onGo: go, onTry3D: try3D }));
    const link = els.find((e) => e.type === Link);
    expect(link.props.to).toBe('/avengers/lawn');
    expect(link.props.state).toBe(hqState);
    expect(link.props.replace).toBeUndefined();
    els.find((e) => e.type === 'button' && words(e) === 'Try 3D').props.onClick();
    els.find((e) => e.type === 'button' && words(e) === 'Go there').props.onClick();
    expect([try3D.mock.calls, go.mock.calls]).toEqual([[['thor']], [['thor']]]);
  });
});
