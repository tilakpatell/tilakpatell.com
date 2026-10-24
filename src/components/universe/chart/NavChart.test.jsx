import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NavChart, { NAME_REM, REGION_REM, WAY_OUT } from './NavChart';
import { CHART, FRAMES, createView, orbitBy, project, toFrame, unproject } from './projection';
import { HAND_MARKS, markById, presetView } from './marks';
import { boxOf } from './declutter';
import { labelSize } from './place';
import { CHART_WORDS as W } from '../words';
import { mapSectorOf } from '../layout';

const view = createView({ range: 120000 });
const li = (html, id) => html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))?.[0] ?? '';
const at = (html, id) => {
  const m = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id));
  return m && [Number(m[1]), Number(m[2])];
};
const tags = (html, cls) => html.match(new RegExp(`<[a-z]+[^>]*class="${cls}"[^>]*>`, 'g')) ?? [];
const draw = (props) => renderToStaticMarkup(<NavChart view={view} marks={HAND_MARKS} {...props} />);
const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// a name's box as the server lays it out (1 px a unit, the names at 11 px), or null for one not shown
function nameBox(html, mark) {
  const tag = li(html, mark.id);
  if (!tag || tag.includes('data-quiet')) return null;
  const [x, y] = at(html, mark.id).map((n) => n * 10);
  const [w, h] = labelSize(mark.name, 11);
  return boxOf(/data-side="(\w+)"/.exec(tag)[1], { x, y, w, h });
}
// the way out's box there: centred, its foot WAY_OUT.foot down the chart
const root = 11 / NAME_REM;
const outBox = { x0: 500 - (WAY_OUT.w * root) / 2, y0: 1000 * WAY_OUT.foot - WAY_OUT.h * root, x1: 500 + (WAY_OUT.w * root) / 2, y1: 1000 * WAY_OUT.foot };

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
  it('keeps every name clear of the way out, the pick’s too', () => {
    const low = { id: 'low', kind: 'world', name: 'Under the way out', at: unproject(view, [(430 - 500) / 470, (884 - 500) / 470]), priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true };
    const out = { label: 'Back through the portal', onClick: () => {} };
    expect(meet(nameBox(renderToStaticMarkup(<NavChart view={view} marks={[low]} />), low), outBox)).toBe(true); // (with no way out, its name runs where the button goes)
    for (const pick of [null, 'low']) expect(li(renderToStaticMarkup(<NavChart view={view} marks={[low]} out={out} pick={pick} />), 'low')).toContain('data-quiet');
    // and in the Curve, where the way out is up every time the map opens
    const html = renderToStaticMarkup(<NavChart view={presetView('rickmorty', { y: 0 })} marks={HAND_MARKS} out={out} />);
    const boxes = HAND_MARKS.map((m) => nameBox(html, m)).filter(Boolean);
    expect(boxes.length).toBeGreaterThan(3);
    for (const b of boxes) expect(meet(b, outBox)).toBe(false);
  });
  it('shows a name left off by the way out, on a hover, on a side clear of it where it has one', () => {
    const near = { id: 'near', kind: 'world', name: 'Near the way out', at: unproject(view, [(390 - 500) / 470, (890 - 500) / 470]), priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true };
    const west = { ...near, id: 'west', name: '', at: unproject(view, [(330 - 500) / 470, (890 - 500) / 470]) }; // (its dot on near's left)
    const tag = li(renderToStaticMarkup(<NavChart view={view} marks={[near, west]} out={{ label: 'Back through the portal', onClick: () => {} }} />), 'near');
    expect(tag).toContain('data-quiet');
    expect(tag).toContain('data-side="left"'); // (its right and under run under the way out)
  });
  it('folds the Curve into its own named button where its places would pile up, as on the chart a ship in the main sector opens on', () => {
    const inCurve = HAND_MARKS.filter((m) => m.pickable && mapSectorOf(...m.at) === 'rickmorty').map((m) => m.id);
    const open = createView({ focus: markById('middleearth').at, range: CHART.range.open });
    const html = renderToStaticMarkup(<NavChart view={open} marks={HAND_MARKS} />);
    for (const id of inCurve) expect(li(html, id), id).toBe('');
    expect(li(html, 'chart:curve')).toContain('data-kind="region"');
    expect(li(html, 'chart:curve')).not.toContain('data-quiet');
    // no two buttons within 8 units of each other, but the portal beside the Rick and Morty planet
    const spots = [...html.matchAll(/<li style="left:([-\d.e]+)%;top:([-\d.e]+)%[^>]*data-id="([^"]+)"/g)].map((m) => [Number(m[1]) * 10, Number(m[2]) * 10, m[3]]);
    expect(spots.length).toBeGreaterThan(10);
    const close = [];
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) if (Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]) < 8) close.push([spots[i][2], spots[j][2]].sort());
    expect(close).toEqual([['rickmorty', 'rmportal']]);
    // a Curve place picked from the list stays on it, named
    const picked = li(renderToStaticMarkup(<NavChart view={open} marks={HAND_MARKS} pick="citadel" />), 'citadel');
    expect(picked).toContain('data-pick');
    expect(picked).not.toContain('data-quiet');
    // and on the Curve's own chart every one of its places is there
    const curve = renderToStaticMarkup(<NavChart view={presetView('rickmorty', { y: 0 })} marks={HAND_MARKS} />);
    for (const id of inCurve) expect(li(curve, id), id).not.toBe('');
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
  it('gives every button on the chart a name of its own, so one whose name is quiet still has it', () => {
    const front = { name: 'The battle of the gap', at: [1200, 0, 900], sectors: [], colours: [] };
    for (const range of [120000, 400000]) {
      const html = renderToStaticMarkup(<NavChart view={createView({ range })} marks={HAND_MARKS} front={front} frontTitle="Race to the front" />);
      const list = html.slice(html.indexOf('class="navmap-places"'), html.indexOf('</ul>'));
      const buttons = list.match(/<button[^>]*>/g);
      expect(buttons.length).toBeGreaterThan(3);
      for (const b of buttons) expect(b).toMatch(/aria-label="[^"]+"/);
    }
    expect(draw({}).match(/<button[^>]*navmap-homebtn[^>]*>/)[0]).toContain('aria-label="Home system"');
    expect(renderToStaticMarkup(<NavChart view={createView({ range: 400000 })} marks={HAND_MARKS} />).match(/<li[^>]*data-id="chart:curve"[^>]*><button[^>]*>/)[0]).toContain('aria-label="The Curve"');
    expect(draw({ front }).match(/<button[^>]*navmap-frontbtn[^>]*>/)[0]).toContain('aria-label="The front · The battle of the gap"');
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

describe('navmap.css, against the chart’s numbers', () => {
  const css = readFileSync(new URL('../navmap.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body: body.trim() }));
  const rule = (sel) => rules.find((r) => r.sel === sel)?.body ?? '';
  // a selector's specificity, [ids, classes, types], an :is() counting as its most specific argument
  const order = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  function specificity(sel) {
    let is = [0, 0, 0];
    const rest = sel.replace(/:is\(([^()]*)\)/g, (_, args) => {
      const top = args.split(',').map((a) => specificity(a.trim())).sort(order).at(-1);
      is = is.map((n, i) => n + top[i]);
      return '';
    });
    const count = (re) => rest.match(re)?.length ?? 0;
    return [is[0] + count(/#[\w-]+/g), is[1] + count(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g), is[2] + count(/(?:^|[\s>+~])[a-z][\w-]*/g)];
  }

  it('measures the names at the sizes it draws them', () => {
    expect(rule('.navmap-place')).toContain(`font-size: ${NAME_REM}rem`);
    expect(rule('.navmap-homebtn .navmap-name')).toContain(`font-size: ${REGION_REM}rem`);
  });
  it('puts a name where declutter’s box has it, past the dot and the gap labelSize allows', () => {
    const start = labelSize('', 11)[0] + boxOf('right', { x: 0, y: 0, w: 0, h: 0 }).x0; // (from the dot's middle)
    expect(rule('.navmap-name')).toContain(`left: calc(50% + ${start}px)`);
    expect(rule(".navmap-places > li[data-side='left'] .navmap-name")).toContain(`right: calc(50% + ${start}px)`);
  });
  it('tints Home system’s and the Curve’s names on a hover, over the hover’s own glass', () => {
    const tint = rules.find((r) => r.body.includes('rgb(255 200 120 / 0.12)'));
    const glass = rules.find((r) => r.body.includes('rgb(3 6 16 / 0.85)') && r.sel.endsWith('.navmap-name'));
    expect(tint.sel).toMatch(/:hover.*\.navmap-homebtn|\.navmap-homebtn.*:hover/);
    expect(tint.sel.endsWith('.navmap-name')).toBe(true);
    const won = order(specificity(tint.sel), specificity(glass.sel));
    expect(won > 0 || (won === 0 && rules.indexOf(tint) > rules.indexOf(glass))).toBe(true);
  });
  it('takes the bar off the stage’s height at every size, with container units or without', () => {
    const widths = rules.filter((r) => r.sel === '.navmap-stage').map((r) => /(?:^|;\s*)width:\s*([^;]+)/.exec(r.body)?.[1]).filter(Boolean);
    expect(widths).toHaveLength(3);
    for (const w of widths) expect(w).toMatch(/calc\([^)]*- 3\.25rem\)/);
  });
});
