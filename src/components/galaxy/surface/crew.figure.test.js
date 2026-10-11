import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// the party's loaders faked: a figure that keeps a note of what it's asked
// (and which loader made it: the wardrobe's people their own, anyone else
// a copy of their file's one)
const made = [];
const fake = (how) => async () => {
  const calls = [];
  const fig = {
    model: new THREE.Group(),
    anim: { name: 'animator' },
    calls,
    how,
    update: (...a) => calls.push(['update', ...a]),
    after: (...a) => calls.push(['after', ...a]),
    play: (...a) => (calls.push(['play', ...a]), Promise.resolve(true)),
    stop: (...a) => calls.push(['stop', ...a]),
    base: (...a) => (calls.push(['base', ...a]), Promise.resolve('done')),
    look: (...a) => calls.push(['look', ...a]),
    react: (...a) => (calls.push(['react', ...a]), { clip: a[0] }),
    dispose: () => calls.push(['dispose']),
  };
  made.push(fig);
  return fig;
};
vi.mock('./nodes/figures', () => ({ loadPartyFigure: fake('own'), loadSharedFigure: fake('shared') }));
// Jabba's file: a box
vi.mock('./placer', () => ({
  loadGlb: async () => ({ scene: new THREE.Group() }),
  cloneModel: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    return g;
  },
}));

const { crewFigure } = await import('./crew');
const { METRE } = await import('../../universe/foot');

describe('a crew figure out on a world', () => {
  it("is a copy of its file's one figure, so a battle's troopers share theirs", async () => {
    await crewFigure('battledroid', 0);
    expect(made.at(-1).how).toBe('shared');
    await crewFigure('tusken', 0);
    expect(made.at(-1).how).toBe('shared');
  });

  it('takes a 2017 soldier through the game-skeleton loader, its cuts told, and passes its cutAt on', async () => {
    made.length = 0;
    const fig = await crewFigure('stormtrooper', 0);
    expect(made.at(-1).how).toBe('own');
    expect(fig.cutAt).toBe(null);
  });

  it('reads its motion in metres, as the figure under it wants it, and lays its bones on facing where it’s turned', async () => {
    const fig = await crewFigure('tusken', 0);
    const inner = made.at(-1);
    expect(fig.anim).toBe(inner.anim);
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2;
    holder.add(fig.model);
    fig.model.scale.multiplyScalar(2); // (a site's `scale`)
    fig.update(1 / 30, 0.5, { speed: 1.2, side: -0.3, turn: 0.4, air: 0 });
    const [, dt, move, m] = inner.calls.find((c) => c[0] === 'update');
    expect(dt).toBeCloseTo(1 / 30, 9);
    expect(move).toBe(0.5);
    expect(m.speed).toBeCloseTo((1.2 * METRE) / 2, 9);
    expect(m.side).toBeCloseTo((-0.3 * METRE) / 2, 9);
    expect(m.turn).toBe(0.4);
    const [, , am, frame] = inner.calls.find((c) => c[0] === 'after');
    expect(am).toBe(m);
    expect(frame.forward.x).toBeCloseTo(1, 6);
    expect(frame.forward.z).toBeCloseTo(0, 6);
    expect(frame.up.y).toBe(1);
  });

  it('without motion, goes at move’s pace, and still lays its clips and look on', async () => {
    const fig = await crewFigure('rebel', 1);
    const inner = made.at(-1);
    fig.update(0.05, 0.3);
    expect(inner.calls.find((c) => c[0] === 'update')).toEqual(['update', 0.05, 0.3]);
    expect(inner.calls.some((c) => c[0] === 'after')).toBe(true);
  });

  it('passes its calls through to the figure under it', async () => {
    const fig = await crewFigure('ugnaught', 0);
    const inner = made.at(-1);
    expect(await fig.play('wave', { layer: 'upper' })).toBe(true);
    fig.look({ x: 1, z: 2 });
    fig.base('sit');
    expect(fig.react('greet', { t: 1 })).toEqual({ clip: 'greet' });
    fig.stop(0.2, 'upper');
    fig.dispose();
    expect(inner.calls.map((c) => c[0])).toEqual(['play', 'look', 'base', 'react', 'stop', 'dispose']);
  });

  it('Jabba lies still, breathing, out of step with another Hutt, and his calls do nothing', async () => {
    const a = await crewFigure('hutt', 0);
    const b = await crewFigure('hutt', 1);
    const ys = [];
    for (let i = 0; i < 150; i++) {
      a.update(1 / 30);
      b.update(1 / 30);
      ys.push(a.model.children[0].scale.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.01);
    expect(Math.abs(a.model.children[0].scale.y - b.model.children[0].scale.y)).toBeGreaterThan(1e-4);
    expect(a.react('hit', { t: 1 })).toBe(null);
    expect(await a.play('wave')).toBe(false);
    expect(() => a.look({ x: 0, z: 0 })).not.toThrow();
  });
});
