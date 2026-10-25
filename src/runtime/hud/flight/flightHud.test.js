import { describe, expect, it } from 'vitest';
import { createFrame, distText } from './frame.js';
import { createFlightHud } from './flightHud.js';

// (a stand-in element: its last writes in `at`, their count in `n`; all writes in `total`)
let total = 0;
const el = () => {
  const e = { n: 0, at: {}, firstChild: null };
  const w = (k) => (v) => {
    e.n++;
    total++;
    e.at[k] = v;
  };
  e.toggleAttribute = (a, v) => w(a)(v);
  e.style = { setProperty: (k, v) => w(k)(v), set transform(v) { w('transform')(v); } };
  Object.defineProperty(e, 'textContent', { set: w('text') });
  return e;
};
const setUp = () => {
  const $ = Object.fromEntries(['reticle', 'lock', 'lock-name', 'lock-dist', 'lead', 'nav', 'nav-name', 'nav-dist'].map((c) => [c, el()]));
  const threats = [el(), el(), el()];
  const mates = [1, 2, 3, 4].map(() => Object.assign(el(), { firstChild: el() }));
  const root = Object.assign(el(), { querySelector: (c) => $[c.slice(10)], querySelectorAll: (c) => (c === '.universe-threat' ? threats : mates) });
  const hud = createFlightHud({ distText });
  const f = Object.assign(createFrame(), { on: true, rect: { x: 0, y: 0, w: 1440, h: 900 } });
  Object.assign(f.reticle, { on: true, x: 720.04, y: 449.96, hot: true, hit: false, kill: true });
  Object.assign(f.lock, { on: true, x: 700, y: 400, z: 50, r: 93.6, hot: false, name: 'TIE', dist: 12.34, text: null, tough: true, hp: 2 / 3 });
  Object.assign(f.lead, { on: true, x: 710.06, y: 440, hot: true });
  const again = () => (hud.place(root, f), hud.writes);
  again();
  return { $, root, threats, mates, f, again };
};

describe('the flight HUD’s writer', () => {
  it('writes the gun line and the lock as placeHud did', () => {
    const { $, f, again } = setUp();
    expect($.reticle.at).toEqual({ 'data-on': true, transform: 'translate3d(720.0px, 450.0px, 0)', 'data-hot': true, 'data-hit': false, 'data-kill': true });
    expect($.lock.at).toEqual({ 'data-on': true, transform: 'translate3d(700.0px, 400.0px, 0)', 'data-off': false, '--r': '94px', 'data-hot': false, 'data-tough': true, '--hp': '0.667' });
    expect([$['lock-name'].at.text, $['lock-dist'].at.text]).toEqual(['TIE', '12']);
    f.lock.dist = 9.96;
    const tenth = [again(), $['lock-dist'].at.text];
    f.lock.text = '12 m';
    expect([...tenth, again(), $['lock-dist'].at.text]).toEqual([1, '10.0', 1, '12 m']);
  });
  it('turns on as many arrows as the record has, at the edge, a mate’s named', () => {
    const { threats, mates, f, again } = setUp();
    f.threats.n = 1;
    Object.assign(f.threats.at[0], { x: 720, y: 2000, z: 10 });
    f.mates.n = 1;
    Object.assign(f.mates.at[0], { x: 2000, y: 450, z: -50, name: 'M1' });
    again();
    expect([...threats, ...mates].map((t) => t.at['data-on'])).toEqual([true, false, false, true, false, false, false]);
    expect([threats[0].at, mates[0].at.transform, mates[0].at['--a'], mates[0].firstChild.at.text]).toEqual([{ 'data-on': true, '--a': '1.571rad', transform: 'translate3d(720.0px, 872.0px, 0)', 'data-off': true }, 'translate3d(28.0px, 450.0px, 0)', '-3.142rad', 'M1']);
  });
  it('leaves a null part, and the hp flag while tough is null; sets data-static', () => {
    const { root, threats, $, f, again } = setUp();
    f.threats.n = 1;
    Object.assign(f.threats.at[0], { x: 2000, y: 450, z: 10 });
    again();
    const before = threats[0].n;
    Object.assign(f, { threats: null, static: true });
    Object.assign(f.lock, { tough: null, hp: 0.1 });
    again();
    expect([threats[0].n, threats[0].at['data-on'], $.lock.at['data-tough'], $.lock.at['--hp'], root.at['data-static']]).toEqual([before, true, true, '0.667', true]);
  });
  it('writes only what changed: none for the same record, five a frame with a lock held', () => {
    const { $, f, again } = setUp();
    const n = total;
    expect([again(), total]).toEqual([0, n]);
    f.reticle.hot = false;
    expect(again()).toBe(1);
    Object.assign(f.reticle, { x: 721.04 });
    Object.assign(f.lock, { x: 701, r: 95.2, dist: 13.2 });
    Object.assign(f.lead, { x: 711.06 });
    expect([again(), $.lock.at['--r'], $['lock-dist'].at.text, $.lead.at.transform]).toEqual([5, '95px', '13', 'translate3d(711.1px, 440.0px, 0)']);
  });
});
