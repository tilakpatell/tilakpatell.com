import { describe, expect, it, vi } from 'vitest';
import { guardOf, guardPipelines, rendererAs } from './pipelineGuard';

// three's renderer, as far as the guard sees it: Pipelines asked with no
// promise list makes the pipeline in the frame and given one pushes a
// promise; Nodes keeps a builder state per render object and a cache by
// key, makes a builder holding the renderer, and getForRenderDeferred
// queues builds one at a time, each landing on a timer; _renderObjectDirect draws
const fakeRenderer = ({ webgl = false } = {}) => {
  const made = [];
  const drawn = [];
  const states = new Map();
  const pipelines = {
    getForRender(renderObject, promises = null) {
      made.push({ renderObject, async: promises !== null });
      if (promises !== null) promises.push(new Promise((r) => setTimeout(r, 0)));
      return { cacheKey: renderObject.id };
    },
  };
  const nodes = {
    nodeBuilderCache: new Map(),
    builds: 0,
    started: [],
    seen: [],
    _buildQueue: [],
    _buildInProgress: false,
    get: (ro) => states.get(ro) ?? states.set(ro, {}).get(ro),
    getForRenderCacheKey: (ro) => ro.key,
    _createNodeBuilder: (ro, material) => ({ renderer, material, ro }),
    build(ro) {
      const b = nodes._createNodeBuilder(ro, { key: ro.key });
      nodes.seen.push({ id: ro.id, mrt: b.renderer.getMRT(), target: b.renderer.getRenderTarget(), real: b.renderer === renderer });
      return new Promise((res) => setTimeout(() => res(nodes.nodeBuilderCache.get(ro.key)), 0));
    },
    // (three's chain: the next build in the microtask of the last one's landing)
    _processBuildQueue() {
      if (nodes._buildInProgress || !nodes._buildQueue.length) return;
      nodes._buildInProgress = true;
      nodes
        ._buildQueue.shift()()
        .then(() => {
          nodes._buildInProgress = false;
          nodes._processBuildQueue();
        });
    },
    getForRenderDeferred(ro) {
      const data = nodes.get(ro);
      if (data.nodeBuilderState !== undefined) return data.nodeBuilderState;
      const cached = nodes.nodeBuilderCache.get(ro.key);
      if (cached) return (data.nodeBuilderState = cached);
      if (!data.pending) {
        data.pending = true;
        nodes.builds++;
        nodes._buildQueue.push(() => {
          nodes.started.push({ id: ro.id, at: performance.now() });
          return nodes.build(ro).then(() => {
            nodes.nodeBuilderCache.set(ro.key, { key: ro.key });
            data.pending = false;
          });
        });
        nodes._processBuildQueue();
      }
      return null;
    },
  };
  // (three's Bindings: deleteForRender asks the render object for its
  // bindings, which builds the shader of one never built, destroys them
  // and forgets the object)
  const bindings = {
    destroyed: [],
    forgotten: [],
    deleteForRender(ro) {
      ro.getBindings();
      bindings.destroyed.push(ro.id);
      this.delete(ro);
    },
    delete(ro) {
      bindings.forgotten.push(ro.id);
    },
  };
  const ros = new Map();
  const objects = { get: (object, material) => ros.get(object.id) ?? ros.set(object.id, { id: object.id, key: material.key }).get(object.id) };
  const renderer = {
    _mrt: null,
    _renderTarget: null,
    _pipelines: pipelines,
    _nodes: nodes,
    _objects: objects,
    _bindings: bindings,
    _currentRenderContext: {},
    backend: { isWebGLBackend: webgl },
    getMRT() {
      return this._mrt;
    },
    getRenderTarget() {
      return this._renderTarget;
    },
    _renderObjectDirect(object) {
      drawn.push(object.id);
    },
    get _handleObjectFunction() {
      return this.__handle ?? this._renderObjectDirect;
    },
    set _handleObjectFunction(fn) {
      this.__handle = fn;
    },
    made,
    drawn,
  };
  return renderer;
};
const scene = { overrideMaterial: null };
const draw = (r, id, key = id, s = scene, material = { key }) => r._handleObjectFunction({ id }, material, s, {}, null, null, null, null);
const tick = (n = 1) => new Promise((res) => setTimeout(res, n));

describe('rendererAs', () => {
  it('answers the pass’s target and MRT, and hands everything else to the renderer', () => {
    const real = {
      _mrt: null,
      getMRT() {
        return this._mrt;
      },
      getRenderTarget() {
        return null;
      },
      backend: { device: 1 },
      toneMapping: 3,
      hasFeature(name) {
        return name === 'x' && this === real;
      },
    };
    const pass = { mrt: { outputs: 2 }, target: { name: 'lit' } };
    const stand = rendererAs(real, pass);
    expect(stand.getMRT()).toBe(pass.mrt);
    expect(stand.getRenderTarget()).toBe(pass.target);
    expect(stand.backend).toBe(real.backend);
    expect(stand.toneMapping).toBe(3);
    expect(stand.hasFeature('x')).toBe(true);
    stand.toneMapping = 4;
    expect(real.toneMapping).toBe(4);
    expect(real.getMRT()).toBeNull();
  });

  it('puts the renderer’s own target and MRT back when a build restores the pass’s, as the PMREM generator does', () => {
    const real = {
      _target: { name: 'between' },
      _mrt: null,
      sets: [],
      getRenderTarget() {
        return this._target;
      },
      setRenderTarget(t, face, mip) {
        this.sets.push([t?.name ?? null, face, mip]);
        this._target = t;
      },
      getMRT() {
        return this._mrt;
      },
      setMRT(m) {
        this._mrt = m;
      },
    };
    const pass = { mrt: { outputs: 2 }, target: { name: 'lit' } };
    const stand = rendererAs(real, pass);
    const saved = stand.getRenderTarget();
    const own = { name: 'pmrem' };
    stand.setRenderTarget(own, 0, 0);
    stand.setRenderTarget(own, 1, 0);
    expect(real._target).toBe(own);
    stand.setRenderTarget(saved, 0, 0);
    expect(real._target.name).toBe('between');
    expect(real.sets).toEqual([
      ['pmrem', 0, 0],
      ['pmrem', 1, 0],
      ['between', 0, 0],
    ]);
    stand.setMRT(null);
    stand.setMRT(stand.getMRT());
    expect(real._mrt).toBeNull();
    // (a pass drawn to the screen: nothing saved, nothing to put back)
    const screen = rendererAs(real, { mrt: null, target: null });
    screen.setRenderTarget(null);
    expect(real._target).toBeNull();
  });
});

describe('guardPipelines', () => {
  it('makes the frame’s pipelines asynchronously and asks for a frame when each lands', async () => {
    const r = fakeRenderer();
    const invalidate = vi.fn();
    const guard = guardPipelines(r, { invalidate });
    const p = r._pipelines.getForRender({ id: 'a' });
    expect(p).toEqual({ cacheKey: 'a' });
    expect(r.made[0].async).toBe(true);
    expect(guard.pending()).toBe(1);
    await tick();
    expect(guard.pending()).toBe(0);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('leaves compileAsync’s own list alone, and guards a renderer once', () => {
    const r = fakeRenderer();
    const guard = guardPipelines(r);
    const list = [];
    r._pipelines.getForRender({ id: 'b' }, list);
    expect(list).toHaveLength(1);
    expect(guard.pending()).toBe(0);
    expect(guardPipelines(r)).toBe(guard);
    expect(guardOf(r)).toBe(guard);
    expect(guardOf(null)).toBe(null);
    expect(guardOf({})).toBe(null);
  });

  it('leaves an object out of the frame while its shader builds off it, and draws it once built', async () => {
    const r = fakeRenderer();
    const guard = guardPipelines(r);
    draw(r, 'a');
    draw(r, 'b');
    draw(r, 'a');
    expect(r.drawn).toEqual([]);
    expect(guard.held()).toBe(3);
    // (nothing is queued until the frame is over)
    expect(r._nodes.builds).toBe(0);
    await tick(150);
    expect(r._nodes.builds).toBe(2);
    draw(r, 'a');
    draw(r, 'b');
    // (a third object on a shader already cached under its key is drawn at once)
    draw(r, 'c', 'a');
    expect(r.drawn).toEqual(['a', 'b', 'c']);
    expect(r._nodes.builds).toBe(2);
  });

  it('breaks three’s chain of builds every `run` for a timer task, and puts the chain back when undone', async () => {
    const r = fakeRenderer();
    const timers = vi.spyOn(globalThis, 'setTimeout');
    const guard = guardPipelines(r, { run: 2 });
    const wrapped = r._nodes._processBuildQueue;
    for (const id of ['a', 'b', 'c', 'd', 'e']) draw(r, id);
    await tick(150);
    expect(r._nodes.started.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    // (a and b back to back from the queue, c from a timer after b, d from c's landing, e from a timer)
    const breaks = timers.mock.calls.filter(([fn, ms]) => ms === 0 && String(fn).includes('origProcess')).length;
    expect(breaks).toBe(2);
    timers.mockRestore();
    guard.dispose();
    expect(r._nodes._processBuildQueue).not.toBe(wrapped);
    expect(r._nodes._buildQueue).toEqual([]);
  });

  it('builds each object under the pass it was drawn in, through a stand-in, and never moves the renderer', async () => {
    const r = fakeRenderer();
    guardPipelines(r);
    const lit = { mrt: { outputs: 2 }, target: { name: 'lit' } };
    const plain = { mrt: null, target: { name: 'rtt' } };
    r._mrt = lit.mrt;
    r._renderTarget = lit.target;
    draw(r, 'a');
    r._mrt = plain.mrt;
    r._renderTarget = plain.target;
    draw(r, 'b');
    // (the frame over: the renderer back at nothing)
    r._mrt = null;
    r._renderTarget = null;
    await tick(150);
    expect(r._nodes.seen).toEqual([
      { id: 'a', ...lit, real: false },
      { id: 'b', ...plain, real: false },
    ]);
    expect(r._mrt).toBeNull();
    expect(r._renderTarget).toBeNull();
    // (a build of three's own, compileAsync's, keeps the real renderer)
    const b = r._nodes._createNodeBuilder({ id: 'z' }, {});
    expect(b.renderer).toBe(r);
  });

  it('builds a pass’s override material and a post pass’s quad in the frame, as before', async () => {
    const r = fakeRenderer();
    guardPipelines(r);
    const override = { key: 'depth' };
    draw(r, 'a', 'a', { overrideMaterial: override }, override);
    const quad = { id: 'q', isQuadMesh: true };
    r._handleObjectFunction(quad, { key: 'q' }, quad, {}, null, null, null, null);
    expect(r.drawn).toEqual(['a', 'q']);
    await tick();
    expect(r._nodes.builds).toBe(0);
  });

  it('forgets a render object that was never built without building its shader to throw away', () => {
    const renderer = fakeRenderer();
    const three = renderer._bindings.deleteForRender;
    const guard = guardPipelines(renderer);
    const built = vi.fn(() => []);
    // (held out of every frame: no bindings, no builder state of its own or in the manager)
    const held = { id: 'first-cut', key: 'k1', _bindings: null, _nodeBuilderState: null, getBindings: built };
    renderer._bindings.deleteForRender(held);
    expect(built).not.toHaveBeenCalled();
    expect(renderer._bindings.destroyed).toEqual([]);
    expect(renderer._bindings.forgotten).toEqual(['first-cut']);
    // one that was drawn has bindings to destroy: three's own way
    const drawn = { id: 'drawn', key: 'k2', _bindings: [{}], _nodeBuilderState: {}, getBindings: built };
    renderer._bindings.deleteForRender(drawn);
    expect(built).toHaveBeenCalledTimes(1);
    expect(renderer._bindings.destroyed).toEqual(['drawn']);
    // one whose shader is built but whose bindings were never made: three's own way too (nothing is built for it)
    const state = { id: 'state', key: 'k3', _bindings: null, _nodeBuilderState: {}, getBindings: built };
    renderer._bindings.deleteForRender(state);
    expect(built).toHaveBeenCalledTimes(2);
    guard.dispose();
    expect(renderer._bindings.deleteForRender).toBe(three);
  });

  it('does nothing on the WebGL 2 backend or the classic renderer, and can be undone', () => {
    expect(guardPipelines(fakeRenderer({ webgl: true }))).toBeNull();
    expect(guardPipelines({})).toBeNull();
    expect(guardPipelines(null)).toBeNull();
    const r = fakeRenderer();
    const origGet = r._pipelines.getForRender;
    const origDraw = r._renderObjectDirect;
    const origCreate = r._nodes._createNodeBuilder;
    const guard = guardPipelines(r);
    expect(r._pipelines.getForRender).not.toBe(origGet);
    expect(r._renderObjectDirect).not.toBe(origDraw);
    expect(r._handleObjectFunction).toBe(r._renderObjectDirect);
    expect(r._nodes._createNodeBuilder).not.toBe(origCreate);
    guard.dispose();
    expect(r._pipelines.getForRender).toBe(origGet);
    expect(r._renderObjectDirect).toBe(origDraw);
    expect(r._handleObjectFunction).toBe(origDraw);
    expect(r._nodes._createNodeBuilder).toBe(origCreate);
    r._pipelines.getForRender({ id: 'c' });
    expect(r.made[0].async).toBe(false);
  });
});
