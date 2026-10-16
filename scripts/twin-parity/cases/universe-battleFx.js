// What a battle’s made of besides the ships: ../../../src/components/universe/battleFx.js
// against its twin, battleFxNodes.js. Bolts of every kind, one by the eye;
// engine glows near and far; the shield with three hits running out over
// it; two objective markers, one hung under its point; and two fires, their
// smoke risen. All set by hand, no clock and no dice, so each side draws
// the same thing.
import * as BO from '../../../src/components/universe/battleFx.js';
import * as BN from '../../../src/components/universe/battleFxNodes.js';

// (the canvas’s height over the view’s height a unit off, as battleScene works it out: 256 high, 50° of view)
const SCALE = 256 / (2 * Math.tan((50 * Math.PI) / 360));

const bolts = (F) => ({ scene, camera }) => {
  const draw = F.createBoltDraw(scene, { count: 16 });
  const list = [
    { on: true, kind: 'laser', x: -2, y: 0.5, z: 0, vx: 30, vy: 0, vz: 4 },
    { on: true, kind: 'flak', x: 1, y: 1.5, z: -1, vx: -5, vy: 20, vz: 0 },
    { on: true, kind: 'turbo', x: 0, y: -0.5, z: -3, vx: 10, vy: 2, vz: 25 },
    { on: true, kind: 'torpedo', x: 1.5, y: 0, z: 1, vx: -8, vy: -3, vz: 6 },
    { on: false, kind: 'laser', x: 0, y: 0, z: 0, vx: 1, vy: 0, vz: 0 },
    { on: true, kind: 'laser', x: 2.6, y: 2.6, z: 5.2, vx: 0, vy: 0, vz: -30 },
  ];
  const colours = [[0.2, 3.5, 0.6], [4, 0.6, 0.4], [0.5, 1.6, 4.5], [3.5, 2, 0.6], [1, 1, 1], [3.6, 0.5, 0.4]];
  draw.sync(list, (b) => colours[list.indexOf(b)], camera.position, 0.02);
};
const glows = (F) => ({ scene }) => {
  const g = F.createGlows(scene, { count: 16 });
  g.begin();
  g.add({ x: 0, y: 0, z: 0 }, [2.4, 1.2, 0.4], 0.5);
  g.add({ x: -1.5, y: 1, z: -1 }, [0.4, 1.4, 3.2], 0.3);
  g.add({ x: 1.6, y: -0.5, z: 1.5 }, [1.6, 2.2, 3.4], 0.25);
  g.add({ x: -2, y: -1, z: 2 }, [3, 0.5, 0.4], 0.08);
  g.add({ x: 0.8, y: 1.6, z: -4 }, [0.6, 3, 0.8], 0.6);
  g.end(SCALE);
};
const shield = (F) => ({ scene }) => {
  const s = F.createShield(scene);
  const cap = { pos: { x: 0, y: 0, z: 0 }, fwd: { x: 0.6, y: 0, z: 0.8 }, size: 7 };
  s.show(cap, null);
  s.update(0.4, 1.2);
  s.hit({ x: 2.6, y: 0.2, z: 3.2 });
  s.update(0.2, 1.6);
  s.hit({ x: 1.2, y: 1.4, z: 0.4 });
  s.update(0.15, 1.75);
  s.hit({ x: -0.5, y: 0.8, z: 2 });
  s.update(0.05, 1.8);
};
const markers = (F) => ({ scene }) => {
  const m = F.createMarkers(scene);
  m.sync([
    { key: 'gen', pos: { x: 0, y: 0.6, z: 0 }, title: 'Destroy: Shield generator', sub: '1.2 km', hp: 0.6, colour: '#ffb347' },
    { key: 'gen2', pos: { x: -0.4, y: 0.4, z: 0 }, title: 'Hold: the comms relay', sub: '340 m', hp: 0.25, colour: '#7cc8ff', under: true },
  ]);
};
const fires = (F) => ({ scene }) => {
  const f = F.createFires(scene);
  f.add({ x: -1, y: -1, z: 0 }, 0.5);
  f.add({ x: 1.2, y: -0.6, z: 0.8 }, 0.35);
  f.update(0.1, 2.3);
};

export default {
  'universe:battleFx:bolts': { node: bolts(BN), classic: bolts(BO) },
  'universe:battleFx:glows': { node: glows(BN), classic: glows(BO) },
  'universe:battleFx:shield': { node: shield(BN), classic: shield(BO) },
  'universe:battleFx:markers': { node: markers(BN), classic: markers(BO) },
  'universe:battleFx:fires': { node: fires(BN), classic: fires(BO) },
};
