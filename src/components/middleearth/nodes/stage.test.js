import { afterEach, describe, expect, it, vi } from 'vitest';

// the world a stage is made on: its renderer, its views and its chain, recorded
const world = { current: null };
vi.mock('../module', () => ({ engineNow: () => world.current }));
const { createStage } = await import('./stage');

const fakeWorld = () => {
  const built = [];
  const drawn = [];
  const renderer = { shadowMap: { enabled: false }, render: vi.fn() };
  const view = {
    resize: vi.fn(),
    setRatio: vi.fn(),
    draw: (fn) => (fn(), drawn.push('draw')),
    drawNow: (fn) => (fn(), drawn.push('drawNow')),
    dispose: vi.fn(),
  };
  const gfx = {
    post: (passes) => {
      const p = {
        passes,
        render: vi.fn(),
        ready: Promise.resolve(),
        compile: () => Promise.resolve(),
        dispose: vi.fn(),
      };
      built.push(p);
      return p;
    },
    compile: vi.fn(() => Promise.resolve()),
    upload: vi.fn(),
  };
  const stages = [];
  return {
    built,
    drawn,
    view,
    stages,
    renderer,
    rt: { gfx },
    views: { add: vi.fn(() => view), enter: vi.fn() },
    stage: (s) => (stages.push(s), () => {}),
  };
};

afterEach(() => (world.current = null));

describe('a Middle-earth stage on the node renderer', () => {
  it('draws through the node chain: the scene, bloom, the grade', () => {
    const w = (world.current = fakeWorld());
    const s = createStage({}, { soft: false });
    expect(w.built[0].passes.map((p) => p.kind)).toEqual(['render', 'bloom', 'grade', 'output']);
    expect(typeof w.built[0].passes[2].node).toBe('function');
    s.resize(400, 200);
    s.render(16);
    expect(w.built[0].render).toHaveBeenCalledOnce();
    expect(w.drawn).toEqual(['draw']);
  });

  it('glows as UnrealBloomPass did: its strength three times over, the panel’s writes reaching the chain', () => {
    const w = (world.current = fakeWorld());
    const s = createStage({}, { soft: false, bloom: { strength: 0.25, radius: 0.4, threshold: 1 } });
    expect(w.built[0].passes[1].strength).toBeCloseTo(0.75);
    const bloom = { strength: { value: 0.75 }, radius: { value: 0.4 }, threshold: { value: 1 } };
    w.built[0].parts = { bloom };
    s.bloomPass.strength = 0.5;
    s.bloomPass.radius = 0.6;
    expect(s.bloomPass.strength).toBe(0.5);
    expect(bloom.strength.value).toBeCloseTo(1.5);
    expect(bloom.radius.value).toBe(0.6);
  });

  it('draws a soft stage straight to its view, and takes the bloom out on its rung', () => {
    const w = (world.current = fakeWorld());
    const soft = createStage({}, { soft: true });
    expect(w.built).toHaveLength(0);
    soft.render(16);
    expect(w.renderer.render).toHaveBeenCalledOnce();
    const s = createStage({}, {});
    const first = w.built.at(-1);
    s.setLevel('bloom');
    expect(first.dispose).toHaveBeenCalled();
    expect(w.built.at(-1).passes.find((p) => p.kind === 'bloom').enabled).toBe(false);
    expect(s.quality).toBe('bloom');
  });

  it('compiles and uploads through the runtime’s own, then draws its first frame onto its canvas', async () => {
    const w = (world.current = fakeWorld());
    const s = createStage({}, {});
    const steps = [];
    await s.prepare((f, step) => steps.push(step));
    expect(w.rt.gfx.upload).toHaveBeenCalledWith(s.scene);
    expect(w.rt.gfx.compile).toHaveBeenCalled();
    expect(w.drawn).toEqual(['drawNow']);
    expect(steps.at(-1)).toBe('first draw');
  });
});
