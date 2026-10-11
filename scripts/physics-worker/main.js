// scripts/physics-worker.mjs's page: one scene stepped on the main thread
// and through the physics worker (src/lib/physics/workerClient.js), in a
// real browser's module Worker. window.__run({ bodies, frames }) → the row.

import { createPhysics } from '../../src/lib/physics/world.js';

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3) : null;
};
const frame = () => new Promise((r) => setTimeout(r, 0));

async function scene(worker, bodies, frames) {
  const p = await createPhysics({ worker });
  p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [60, 0.5, 60] }] });
  const list = [];
  for (let i = 0; i < bodies; i++) list.push(p.add({ position: [(i % 20) * 1.2 - 12, 1 + Math.floor(i / 20) * 1.2, ((i * 7) % 11) * 0.3], colliders: [{ shape: i % 2 ? 'ball' : 'cuboid', args: i % 2 ? [0.4] : [0.35, 0.35, 0.35] }] }));
  const ms = [];
  const hops = [];
  for (let f = 0; f < frames; f++) {
    const a = performance.now();
    p.step(1 / 60);
    ms.push(performance.now() - a);
    if (worker) {
      await p.flush();
      hops.push(p.status().hopMs);
    } else await frame();
  }
  const out = { worker: p.status().worker, stepMs: { p50: pct(ms, 0.5), p95: pct(ms, 0.95) }, hopMs: worker ? { p50: pct(hops, 0.5), p95: pct(hops, 0.95) } : null, last: list.map((b) => [...b.position(), ...b.quaternion()]) };
  p.dispose();
  return out;
}

window.__run = async ({ bodies = 200, frames = 600 } = {}) => {
  const main = await scene(false, bodies, frames);
  const off = await scene(true, bodies, frames);
  let worst = 0;
  for (let i = 0; i < main.last.length; i++) for (let k = 0; k < 7; k++) worst = Math.max(worst, Math.abs(main.last[i][k] - off.last[i][k]));
  return { bodies, frames, main: { worker: main.worker, stepMs: main.stepMs }, off: { worker: off.worker, stepMs: off.stepMs, hopMs: off.hopMs }, worstDiff: +worst.toExponential(2) };
};
window.__ready = true;
