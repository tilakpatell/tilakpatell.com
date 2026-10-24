import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MiniMap from './MiniMap';
import FlatMap from './FlatMap';
import NavChart from './chart/NavChart';
import { DESTINATIONS } from './nav';
import { UNIVERSES, byId } from './universes';
import { FRAMES } from './chart/projection';
import { HAND_MARKS, markById } from './chart/marks';
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
  it('lets a world’s name lie over a lesser place’s dot where there’s no other room, never over another world’s', () => {
    // (its name is under every place's button, universe.css: the lesser place's dot stays its own)
    const html = draw({});
    const F = FRAMES.mini;
    const at = (id) => {
      const [l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id)).slice(1).map(Number);
      return { x: (l / 100) * F.w, y: (t / 100) * F.h };
    };
    const worlds = ids(html).filter((id) => markById(id).kind === 'world');
    const named = worlds.filter((id) => !li(html, id).includes('data-quiet'));
    // (with every dot kept clear, 7 of the 13 at the server's 600 px)
    expect(named.length).toBeGreaterThanOrEqual(9);
    // each name's box as the server lays it out, and each other place's dot as declutter keeps names off it: 16 px
    const nameOf = (id) => new RegExp(`data-id="${id}"[^>]*>.*?<span class="minimap-name">([^<]*)</span>`).exec(html)[1];
    const box = (id) => boxOf(/data-side="(\w+)"/.exec(li(html, id))[1], { ...at(id), w: nameOf(id).length * 0.62 * 11 + 22, h: 24 });
    const dotBox = ({ x, y }) => ({ x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 });
    const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const over = (id, others) => others.filter((o) => o !== id && Math.hypot(at(o).x - at(id).x, at(o).y - at(id).y) > 8 && meet(box(id), dotBox(at(o))));
    const lesser = ids(html).filter((id) => markById(id).priority < markById('marvel').priority);
    expect(named.some((id) => over(id, lesser).length), 'a world’s name over a lesser dot').toBe(true);
    for (const id of named) expect(over(id, worlds), id).toEqual([]);
  });
  it('stands each place on a stem: up for above the disc, down for below', () => {
    const stems = tags(draw({}), 'minimap-stem');
    expect(stems.some((t) => t.includes('data-dir="up"'))).toBe(true);
    expect(stems.some((t) => t.includes('data-dir="down"'))).toBe(true);
  });
  it('has its tools and says its level when it is the whole map, and none as the teaser', () => {
    const live = renderToStaticMarkup(<FlatMap onSelect={() => {}} />);
    expect(live).toMatch(/<div[^>]*class="minimap[^"]*"[^>]*data-level="neighbourhood"/);
    for (const w of [W.zoomIn, W.zoomOut, W.fit]) expect(live.match(new RegExp(`<button[^>]*aria-label="${w}"[^>]*>`))?.[0], w).toContain('class="chip"');
    for (const w of [W.toShip, W.flat]) expect(live).not.toContain(`aria-label="${w}"`);
    // 0 shows it all, as the tool does: its title says so
    expect(live.match(new RegExp(`<button[^>]*aria-label="${W.fit}"[^>]*>`))[0]).toContain(`title="${W.fit} (0)"`);
    const still = draw({});
    expect(still).not.toContain(`aria-label="${W.zoomIn}"`);
  });
  it('stacks a place over the lesser ones beside it, so a click on a world’s dot picks the world', () => {
    const html = draw({});
    const order = ids(html);
    const z = (id) => Number(/--z:(\d+)/.exec(li(html, id))?.[1] ?? 0);
    // (of two at the same z, the later in the list is drawn over the other)
    const over = (a, b) => z(a) > z(b) || (z(a) === z(b) && order.indexOf(a) > order.indexOf(b));
    const rank = (id) => markById(id).priority;
    let near = 0;
    // a place's button is a 44 px square round its dot at the least: in the desktop's 876 px box and a phone's 342 px
    for (const w of [876, 342]) {
      const px = (id) => {
        const [l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id)).slice(1).map(Number);
        return [(l / 100) * w, (t / 100) * (w / 2)];
      };
      for (const a of order)
        for (const b of order) {
          if (rank(b) >= rank(a)) continue;
          const [[ax, ay], [bx, by]] = [px(a), px(b)];
          if (Math.abs(ax - bx) >= 22 || Math.abs(ay - by) >= 22) continue;
          near++;
          expect(over(a, b), `${a}’s dot under ${b}’s button at ${w} px`).toBe(true);
        }
    }
    expect(near).toBeGreaterThan(0);
    expect(over('rickmorty', 'rmportal')).toBe(true);
  });
  it('gives each map its own clip, so two on a page never share an id', () => {
    const html = renderToStaticMarkup(
      <>
        <MiniMap onSelect={() => {}} />
        <FlatMap onSelect={() => {}} />
      </>,
    );
    const clips = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(clips).toHaveLength(2);
    expect(new Set(clips).size).toBe(2);
    expect([...html.matchAll(/clip-path="url\(#([^)]+)\)"/g)].map((m) => m[1])).toEqual(clips);
  });
  it('opens the 3D-off map on the whole map, as the mini-map draws it', () => {
    const flat = renderToStaticMarkup(<FlatMap onSelect={() => {}} />);
    const mini = draw({});
    expect(ids(flat)).toEqual(ids(mini));
    for (const id of ids(mini)) expect(li(flat, id), id).toBe(li(mini, id));
  });
  it('draws only: Home’s teaser loads none of the chart’s hands, keys or tools', () => {
    const src = readFileSync(new URL('./MiniMap.jsx', import.meta.url), 'utf8');
    const from = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(from).toContain('./chart/place');
    for (const hands of ['./chart/useChartView', './chart/input', './chart/ChartTools', 'react-icons/ri']) expect(from, hands).not.toContain(hands);
  });
  it('presses a wonder from its link on the 3D-off map, and starts the arrows from it', () => {
    const button = (html, id) => html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*><button[^>]*>`))[0];
    const html = renderToStaticMarkup(<FlatMap selected={null} startAt="aurelia" onSelect={() => {}} />);
    expect(html).toContain('data-live="true"');
    expect(button(html, 'aurelia')).toContain('aria-pressed="true"');
    expect(button(html, 'aurelia')).toContain('tabindex="0"');
    // a universe picked on the page is pressed over the link's wonder
    const picked = renderToStaticMarkup(<FlatMap selected="marvel" startAt="aurelia" onSelect={() => {}} />);
    expect(button(picked, 'marvel')).toContain('aria-pressed="true"');
    expect(button(picked, 'aurelia')).toContain('aria-pressed="false"');
  });
});

describe('universe.css: the flat map’s buttons', () => {
  const css = readFileSync(new URL('./universe.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body: body.trim() })).filter((r) => r.sel.includes('minimap'));
  const rule = (sel) => rules.find((r) => r.sel === sel)?.body ?? '';
  // what a selector picks: its last compound, with what's in its brackets left out
  const subject = (sel) => {
    let bare = sel;
    while (/\([^()]*\)/.test(bare)) bare = bare.replace(/\([^()]*\)/g, '');
    return bare.split(/[\s>+~]+/).at(-1);
  };

  it('never lifts a place’s button on a hover or a focus, only its name, and a click goes through that', () => {
    // (lifted, a lesser place's button lay over the world's dot beside it: a
    // pointer that crossed it on its way there, or its focus, kept it up, and
    // a click on the world's dot picked the lesser place)
    const lifts = rules.filter((r) => /z-index/.test(r.body) && /:hover|:focus/.test(r.sel));
    expect(lifts.length).toBeGreaterThan(0);
    for (const r of lifts) {
      expect(subject(r.sel), r.sel).toBe('.minimap-name');
      expect(r.body, r.sel).toContain('pointer-events: none');
    }
  });
  it('stacks each button by its tier alone, the names under them all', () => {
    expect(rule('.minimap-hit::before')).toContain('z-index: var(--z)');
    expect(rule('.minimap-name')).toContain('z-index: 0');
    // (nothing round a button makes a stack of its own, which its name could never leave)
    for (const sel of ['.minimap-item', '.minimap-hit']) expect(rule(sel), sel).not.toMatch(/z-index|translate|transform|opacity|filter|isolation/);
    const stacked = rules.filter((r) => /z-index/.test(r.body) && !/:hover|:focus/.test(r.sel)).map((r) => r.sel);
    expect(stacked.sort()).toEqual(['.minimap-hit::before', '.minimap-name']);
  });
  it('makes a button the 44 px round its dot, its name beside it or under it, not in it', () => {
    expect(rule('.minimap-hit')).toMatch(/(?:^|;\s*)width: 44px/);
    expect(rule('.minimap-hit')).toMatch(/(?:^|;\s*)height: 44px/);
    expect(rule('.minimap-hit')).toContain('left: -22px');
    expect(rule('.minimap-hit')).toContain('top: -22px');
    expect(rule('.minimap-name')).toContain('position: absolute');
  });
});
