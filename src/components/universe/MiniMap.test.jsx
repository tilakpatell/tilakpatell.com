import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MiniMap from './MiniMap';
import NavChart from './chart/NavChart';
import { DESTINATIONS } from './nav';
import { UNIVERSES, byId } from './universes';
import { FRAMES } from './chart/projection';
import { HAND_MARKS } from './chart/marks';
import { miniView } from './chart/place';
import { boxOf } from './chart/declutter';
import { CHART_WORDS as W } from './words';

const ids = (html) => [...html.matchAll(/<li[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
const li = (html, id) => html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))?.[0] ?? '';
const uv = (html, id, f) => {
  const tag = html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))[0];
  const [, l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(tag);
  return [((l / 100) * f.w - f.cx) / f.r, ((t / 100) * f.h - f.cy) / f.r];
};
const tags = (html, cls) => html.match(new RegExp(`<[a-z]+[^>]*class="${cls}"[^>]*>`, 'g')) ?? [];
const draw = (props) => renderToStaticMarkup(<MiniMap onSelect={() => {}} {...props} />);

describe('the mini-map', () => {
  it('shows every hand-made place, wonder and moon, and no orbit rings', () => {
    const html = draw({});
    expect(ids(html)).toEqual(expect.arrayContaining(DESTINATIONS.filter((d) => d.kind !== 'system').map((d) => d.id)));
    expect(html).not.toContain('minimap-orbit');
    expect(html).not.toContain('minimap-ship');
  });
  it('keeps the teaser to the worlds, by their own labels', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MiniMap kind="fandom" linkTo={(id) => `/universe/${id}`} />
      </MemoryRouter>,
    );
    expect(ids(html).every((id) => byId(id)?.kind === 'fandom')).toBe(true);
    expect(ids(html)).toHaveLength(UNIVERSES.filter((u) => u.kind === 'fandom').length);
    expect(html).toContain(byId('marvel').label);
    expect(html).toContain('href="/universe/marvel"');
  });
  it('places each mark where the nav map would on the same view: one projection', () => {
    const mini = draw({});
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
    const html = draw({ ship: { x: 5e6, y: 0, z: 0, heading: 0 } });
    expect(html.match(/<g[^>]*class="minimap-ship"[^>]*>/)?.[0]).toContain('data-edge');
  });

  it('names every place for a screen reader, by its own label, and the picked one on the map too', () => {
    const html = draw({ selected: 'squanch' });
    for (const id of ids(html)) {
      const label = byId(id)?.label ?? DESTINATIONS.find((d) => d.id === id).name;
      expect(html, id).toMatch(new RegExp(`<li[^>]*data-id="${id}"[^>]*><button[^>]*aria-label="${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    }
    expect(li(html, 'squanch')).not.toContain('data-quiet');
    expect(html.match(/<button[^>]*aria-label="Planet Squanch"[^>]*>/)[0]).toContain('aria-pressed="true"');
    // the Curve's places sit close together on the whole map: some of their names give way
    expect(ids(html).some((id) => li(html, id).includes('data-quiet'))).toBe(true);
  });
  it('hangs a name under its dot, or beside it where that’s crowded, and never one over another', () => {
    const html = draw({});
    const named = ids(html).filter((id) => !li(html, id).includes('data-quiet'));
    // (under alone, a wonder's dot beside nearly every world, it named three)
    expect(named.length).toBeGreaterThanOrEqual(10);
    const side = (id) => /data-side="(\w+)"/.exec(li(html, id))[1];
    expect(named.map(side)).toContain('under');
    expect(named.map(side).some((s) => s !== 'under')).toBe(true);
    // each name's box as the server lays it out: a px a unit, the names at 11 px in the mono face
    const boxes = named.map((id) => {
      const [l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id)).slice(1).map(Number);
      const name = new RegExp(`data-id="${id}"[^>]*>.*?<span class="minimap-name">([^<]*)</span>`).exec(html)[1];
      return boxOf(side(id), { x: (l / 100) * FRAMES.mini.w, y: (t / 100) * FRAMES.mini.h, w: name.length * 0.62 * 11 + 22, h: 24 });
    });
    const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(meet(boxes[i], boxes[j]), `${named[i]} and ${named[j]}`).toBe(false);
  });
  it('stands each place on a stem: up for above the disc, down for below', () => {
    const stems = tags(draw({}), 'minimap-stem');
    expect(stems.some((t) => t.includes('data-dir="up"'))).toBe(true);
    expect(stems.some((t) => t.includes('data-dir="down"'))).toBe(true);
  });
  it('has its tools and says its level when it is the whole map, and none as the teaser', () => {
    const live = draw({ interactive: true });
    expect(live).toMatch(/<div[^>]*class="minimap[^"]*"[^>]*data-level="neighbourhood"/);
    for (const w of [W.zoomIn, W.zoomOut, W.fit]) expect(live.match(new RegExp(`<button[^>]*aria-label="${w}"[^>]*>`))?.[0], w).toContain('class="chip"');
    for (const w of [W.toShip, W.flat]) expect(live).not.toContain(`aria-label="${w}"`);
    const still = draw({});
    expect(still).not.toContain(`aria-label="${W.zoomIn}"`);
  });
});
