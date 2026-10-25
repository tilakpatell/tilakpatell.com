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

describe('the cluster’s parts (moved from galaxy/cluster.test.js)', () => {
  // (a stand-in for each element, with the calls the writers make)
  const clusterEl = () => {
    const attrs = new Set();
    const vars = new Map();
    return {
      textContent: '',
      hidden: false,
      dataset: {},
      style: { setProperty: (k, v) => vars.set(k, v), getPropertyValue: (k) => vars.get(k) ?? '' },
      toggleAttribute: (n, on) => (on ? attrs.add(n) : attrs.delete(n)),
      hasAttribute: (n) => attrs.has(n),
    };
  };
  // (the cluster's blocks, the kit's vitals and arms, and the parts round it: the altitude, the wanted strip, the radar)
  const PARTS = ['.hud-vitals', '.hud-vitals-n', '.hud-arms', '.hud-arms-name', '.fc-speed', '.fc-speed-n', '.fc-kills-n', '.fc-target', '.fc-target-name', '.fc-target-dist', '.fc-target-hp', '.universe-alt', '.universe-wanted', '.universe-wanted-word', '.universe-wanted-bounty', '.fc-radar'];
  const MANY = { '.hud-arms-line': 3, '.hud-arms-pip': 8, '.universe-wanted-stars i': 5 };
  // (the map: the overlay's parent, holding the cluster, which is itself here)
  const clusterDom = () => {
    const parts = Object.fromEntries(PARTS.map((s) => [s, clusterEl()]));
    const many = Object.fromEntries(Object.entries(MANY).map(([s, n]) => [s, Array.from({ length: n }, clusterEl)]));
    const root = { ...clusterEl(), many, querySelectorAll: (s) => many[s] ?? [] };
    root.querySelector = (s) => (s === '.hud-cluster' ? root : (parts[s] ?? null));
    return root;
  };
  const laser = { name: 'Laser cannons', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 };
  const mapOverlay = (map) => ({ ...clusterEl(), parentElement: map, querySelector: () => null, querySelectorAll: () => [] });
  const fv = (frame, o = {}) => {
    const x = { on: true, shield: 82, low: false, speed: 6, top: 12, boosting: false, kills: 3, lock: null, arms: laser, ...o };
    frame.cluster = { on: x.on, vitals: { value: x.shield, max: 100, low: x.low }, arms: x.arms, abilities: null };
    frame.speed = { v: x.speed, top: x.top, boosting: x.boosting };
    frame.kills = x.kills;
    frame.target = x.lock;
    return frame;
  };
  // (one writer and one frame a case, as a map has them; place(o) a frame)
  const setUpCluster = (draw) => {
    const root = clusterDom();
    const hud = createFlightHud({ distText, ...(draw ? { draw } : {}) });
    const overlay = mapOverlay(root);
    const frame = createFrame();
    const place = (o) => (hud.place(overlay, fv(frame, o)), hud.writes);
    return { root, hud, frame, place, overlay };
  };

  it('says how far the target is as the lock’s bracket does (frame.js’s distText)', () => {
    const { root, place } = setUpCluster();
    const said = (dist) => (place({ lock: { name: 'TIE Fighter', dist, hp: null } }), root.querySelector('.fc-target-dist').textContent);
    expect([0.04, 9.26, 9.96, 14.2, 160.5, 1234.4].map(said)).toEqual(['0.0', '9.3', '10.0', '14', '161', '1234']);
    expect(said(9.96)).toBe(distText(9.96));
  });
  it('writes the ship', () => {
    const { root, place } = setUpCluster();
    place();
    expect(root.hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.hud-vitals-n').textContent).toBe('82%');
    expect(root.querySelector('.hud-vitals').style.getPropertyValue('--v')).toBe('0.82');
    expect(root.querySelector('.fc-speed').style.getPropertyValue('--v')).toBe('0.5');
    expect(root.querySelector('.fc-speed-n').textContent).toBe('SPD 60');
    expect(root.querySelector('.fc-kills-n').textContent).toBe('3');
  });
  it('flags low shields and the boost', () => {
    const { root, place } = setUpCluster();
    place({ shield: 20, low: true, boosting: true });
    expect(root.querySelector('.hud-vitals').hasAttribute('data-low')).toBe(true);
    expect(root.querySelector('.fc-speed').hasAttribute('data-boost')).toBe(true);
    place();
    expect(root.querySelector('.hud-vitals').hasAttribute('data-low')).toBe(false);
    expect(root.querySelector('.fc-speed').hasAttribute('data-boost')).toBe(false);
  });
  it('writes the target, and clears it', () => {
    const { root, place } = setUpCluster();
    place({ lock: { name: 'TIE Interceptor', dist: 14.2, hp: 0.5 } });
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-name').textContent).toBe('TIE Interceptor');
    expect(root.querySelector('.fc-target-dist').textContent).toBe('14');
    expect(root.querySelector('.fc-target-hp').style.getPropertyValue('--v')).toBe('0.5');
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(true);
    place();
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(false);
  });
  it('writes the primary line, with no rack under it', () => {
    const { root, place } = setUpCluster();
    place();
    expect(root.querySelector('.hud-arms').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.hud-arms-name').textContent).toBe('Laser cannons');
    expect(root.many['.hud-arms-line'].map((l) => l.hasAttribute('data-on'))).toEqual([true, false, false]);
    expect(root.many['.hud-arms-pip'].every((p) => p.hidden)).toBe(true);
  });
  it('shows no hull bar for a one-hit fighter', () => {
    const { root, place } = setUpCluster();
    place({ lock: { name: 'TIE Fighter', dist: 9.26, hp: null } });
    expect(root.querySelector('.fc-target-dist').textContent).toBe('9.3');
    expect(root.querySelector('.fc-target').hasAttribute('data-on')).toBe(true);
    expect(root.querySelector('.fc-target-hp').hasAttribute('data-on')).toBe(false);
  });
  it('hides when not flying, and writes nothing it already wrote', () => {
    const { root, place } = setUpCluster();
    place();
    const n = root.querySelector('.hud-vitals-n');
    n.textContent = 'tampered';
    place();
    expect(n.textContent).toBe('tampered'); // (unchanged value: no write)
    place({ on: false });
    expect(root.hasAttribute('data-on')).toBe(false);
  });
  it('writes the altitude and wanted parts, and leaves a null one', () => {
    const { root, frame, place } = setUpCluster();
    frame.alt = { on: true, alt: 0.25, moving: true };
    frame.wanted = { on: true, stars: 2, word: 'Wanted', search: false, bounty: 450 };
    place();
    const alt = root.querySelector('.universe-alt');
    const wanted = root.querySelector('.universe-wanted');
    expect([alt.hasAttribute('data-on'), alt.hasAttribute('data-moving'), alt.style.getPropertyValue('--alt')]).toEqual([true, true, '0.250']);
    expect([wanted.hasAttribute('data-on'), root.many['.universe-wanted-stars i'].map((i) => i.hasAttribute('data-lit')), root.querySelector('.universe-wanted-word').textContent, root.querySelector('.universe-wanted-bounty').textContent]).toEqual([true, [true, true, false, false, false], 'Wanted', '450 ¢']);
    frame.alt = null;
    frame.wanted = null;
    expect([place(), alt.style.getPropertyValue('--alt')]).toEqual([0, '0.250']);
  });
  it('finds the parts again when they come back as new ones (on foot and back in a ship)', () => {
    const root = clusterDom();
    const hud = createFlightHud({ distText });
    const overlay = mapOverlay(root);
    const frame = createFrame();
    hud.place(overlay, fv(frame));
    const old = root.querySelector('.fc-speed-n');
    // (on foot the speed's parts go; back in a ship they're new elements)
    old.isConnected = false;
    const fresh = clusterEl();
    const q = root.querySelector;
    root.querySelector = (c) => (c === '.fc-speed-n' ? fresh : q(c));
    hud.place(overlay, fv(frame, { speed: 7 }));
    expect([fresh.textContent, old.textContent]).toEqual(['SPD 70', 'SPD 60']);
  });
  it('draws the radar only when its part is there', () => {
    const calls = [];
    const { root, frame, place } = setUpCluster((...a) => calls.push(a));
    const P = [{ x: 0.1, y: 0.5, kind: 'hostile' }];
    frame.radar = { points: P, range: 40, dpr: 1 };
    place();
    expect(calls).toEqual([[root.querySelector('.fc-radar'), P, { range: 40, dpr: 1 }]]);
    frame.radar = null;
    place();
    expect(calls.length).toBe(1);
  });
});
