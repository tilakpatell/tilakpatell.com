import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MiniMap from './MiniMap';
import NavChart from './chart/NavChart';
import { DESTINATIONS } from './nav';
import { byId } from './universes';
import { FRAMES } from './chart/projection';
import { HAND_MARKS } from './chart/marks';
import { miniView } from './chart/place';

const ids = (html) => [...html.matchAll(/<li[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
const uv = (html, id, f) => {
  const tag = html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))[0];
  const [, l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(tag);
  return [((l / 100) * f.w - f.cx) / f.r, ((t / 100) * f.h - f.cy) / f.r];
};

describe('the mini-map', () => {
  it('shows every hand-made place, wonder and moon, and no orbit rings', () => {
    const html = renderToStaticMarkup(<MiniMap onSelect={() => {}} />);
    expect(ids(html)).toEqual(expect.arrayContaining(DESTINATIONS.filter((d) => d.kind !== 'system').map((d) => d.id)));
    expect(html).not.toContain('minimap-orbit');
    expect(html).not.toContain('minimap-ship');
  });
  it('keeps the teaser to the worlds, by their own labels', () => {
    const html = renderToStaticMarkup(<MemoryRouter><MiniMap kind="fandom" linkTo={(id) => `/universe/${id}`} /></MemoryRouter>);
    expect(ids(html).every((id) => byId(id)?.kind === 'fandom')).toBe(true);
    expect(html).toContain(byId('marvel').label);
  });
  it('places each mark where the nav map would on the same view: one projection', () => {
    const mini = renderToStaticMarkup(<MiniMap onSelect={() => {}} />);
    const shown = HAND_MARKS.filter((m) => m.pickable || m.id === 'chart:sun');
    const nav = renderToStaticMarkup(<NavChart view={miniView(shown)} marks={shown} />);
    const both = ids(mini).filter((id) => ids(nav).includes(id));
    expect(both.length).toBeGreaterThan(10);
    for (const id of both) {
      const a = uv(mini, id, FRAMES.mini);
      const b = uv(nav, id, FRAMES.nav);
      expect(a[0]).toBeCloseTo(b[0], 9);
      expect(a[1]).toBeCloseTo(b[1], 9);
    }
  });
  it('keeps a far ship on the map when it is given one', () => {
    const html = renderToStaticMarkup(<MiniMap onSelect={() => {}} ship={{ x: 5e6, y: 0, z: 0, heading: 0 }} />);
    expect(html.match(/<g[^>]*class="minimap-ship"[^>]*>/)?.[0]).toContain('data-edge');
  });
});
