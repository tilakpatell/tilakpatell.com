// No frame waits for a shader on WebGPU. three's node renderer builds an
// object's shader the first time it is drawn (TSL to WGSL: 30 to 90 ms of
// JavaScript for a lit level material on Hoth, where every instanced mesh
// is its own program) and then makes its render pipeline with
// `device.createRenderPipeline`, where the browser compiles it for the
// chip and the frame waits again. A level streaming in brings a few new
// materials a frame, so the world hitched for seconds while it loaded
// (Hoth at ultra: 14 s of the 20 s load inside such frames, and a 4.5 s one
// as the first soldiers arrived), and again whenever something new came
// into view. The classic renderer has lib/three/frameGuard for this; this
// is the node renderer's, in three parts, the first two paths three has already:
//
// - Shaders are built off the frame. An object whose shader is neither
//   built nor cached under its key is left out of the frame, and once the
//   frame is over its build is queued with `Nodes.getForRenderDeferred`
//   (`buildAsync`: one at a time, yielding to the browser between its
//   stages); it is drawn from the frame its shader lands in. The builder
//   asks its renderer for the render target and the MRT as it builds (tone
//   mapping, the colour space, the outputs), and off the frame those are
//   not the object's pass, so each deferred build is given a stand-in
//   renderer that answers with the pass the object was drawn in and hands
//   everything else to the real one, whose own state is never touched. A
//   pass's override material (the shadow depth material, whose nodes three
//   swaps per object inside the draw) and a post pass's own quad keep the
//   frame's build: an override read later would be another object's, and
//   the chain's quads are few, built once. A scene's lights are kept on it
//   between frames, so a build off the frame lights what it draws.
// - Pipelines are made asynchronously. `compileAsync` makes them through
//   `createRenderPipelineAsync`, and `_renderObjectDirect` skips the draw
//   of an object whose pipeline is not ready (`Pipelines.isReady`). The
//   guard turns that on for every draw: `Pipelines.getForRender`, asked
//   with no promise list (the frame's own path), is given one.
//
// - Nothing is built to be thrown away. Disposing a material three has a
//   render object for asks that object for its bindings, and one the guard
//   held out has none: three would build its shader in that call. Such an
//   object is forgotten without it.
//
// Each landing asks for a frame (`invalidate`), so a still world shows
// what it held back. Only on a WebGPU backend: the WebGL 2 backend's
// pipelines link in the frame either way, and its draw never waits on a
// promise.
//
// guardPipelines(renderer, { invalidate, run }) → { pending(), held(), dispose() } | null
// guardOf(renderer) → the guard on a renderer, or null (a world's waiting
//   screen reads pending() and held() to know when its first frames will not hitch)
// rendererAs(renderer, pass) → the stand-in: getMRT() and getRenderTarget() answer the pass's, the rest is the renderer's

// builds three runs back to back before the chain breaks for a timer
// task: a run is the most the page waits for a turn (four builds of 40
// to 90 ms)
const RUN = 4;

export const guardOf = (renderer) => renderer?._pipelines?.__guard ?? null;

export function rendererAs(renderer, pass) {
  // (a build that draws for itself, as the PMREM generator does, saves
  // the target it is told and puts it back after: told the pass's, it
  // would put the pass's on the real renderer between frames, so a set of
  // the pass's target is the real one's own target back)
  let before = { target: undefined, mrt: undefined };
  const setTarget = (t, ...rest) => {
    if (t === pass.target && before.target !== undefined) {
      renderer.setRenderTarget(before.target, ...rest);
      before.target = undefined;
      return;
    }
    if (before.target === undefined) before.target = renderer.getRenderTarget();
    renderer.setRenderTarget(t, ...rest);
  };
  const setMRT = (m) => {
    if (m === pass.mrt && before.mrt !== undefined) {
      renderer.setMRT(before.mrt);
      before.mrt = undefined;
      return;
    }
    if (before.mrt === undefined) before.mrt = renderer.getMRT();
    renderer.setMRT(m);
  };
  return new Proxy(renderer, {
    get(target, key) {
      if (key === 'getMRT') return () => pass.mrt;
      if (key === 'getRenderTarget') return () => pass.target;
      if (key === 'setRenderTarget') return setTarget;
      if (key === 'setMRT') return setMRT;
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

export function guardPipelines(renderer, { invalidate = null, run = RUN } = {}) {
  const pipelines = renderer?._pipelines;
  if (!pipelines || typeof pipelines.getForRender !== 'function') return null;
  if (renderer.backend?.isWebGLBackend) return null;
  if (pipelines.__guard) return pipelines.__guard;
  const origGet = pipelines.getForRender;
  // (the draw's own entry, after three has swapped in a pass's override
  // material: the render object looked up here is the one three draws)
  const origDraw = renderer._renderObjectDirect;
  let pending = 0;
  let held = 0;
  let armed = false;
  const landed = () => {
    pending--;
    invalidate?.();
  };
  pipelines.getForRender = function (renderObject, promises = null) {
    if (promises !== null) return origGet.call(this, renderObject, promises);
    const made = [];
    const pipeline = origGet.call(this, renderObject, made);
    for (const p of made) {
      pending++;
      p.then(landed, landed);
    }
    return pipeline;
  };
  const nodes = renderer._nodes;
  const objects = renderer._objects;
  const deferred = Boolean(nodes?.getForRenderDeferred && nodes._createNodeBuilder && nodes.nodeBuilderCache && objects?.get && typeof origDraw === 'function');
  const handled = renderer._handleObjectFunction === origDraw;
  const origCreate = nodes?._createNodeBuilder;
  // (a deferred build's builder sees the pass the object was drawn in)
  const createAs = function (ro, material) {
    const builder = origCreate.call(this, ro, material);
    if (builder && ro?.__pass) builder.renderer = rendererAs(renderer, ro.__pass);
    return builder;
  };
  // The builds are queued once the frame is over, so the frame's own draw
  // never starts one. three's buildAsync yields between its stages with
  // scheduler.yield(), whose continuations go ahead of any new task of
  // their priority, and its chain goes on to the next queued build in the
  // microtask of the last one's landing: the whole queue was one run of
  // continuations until the last build landed, and for those seconds
  // nothing of normal priority ran: not React's commits (the HUD stood on
  // the spawn screen 6 to 9 s after the deploy the sim had taken at once),
  // not a timer. The chain is kept (a build handed over on its own, from a
  // timer or a frame callback, took 150 to 300 ms where the chain's take
  // 40, and Hoth's props stayed out of the picture for half a minute) and
  // broken every RUN builds for a timer task instead (processInRuns).
  const queued = [];
  let scheduled = false;
  const queue = (ro) => {
    queued.push(ro);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const list = queued.splice(0);
      for (const r of list) nodes.getForRenderDeferred(r);
    });
  };
  // three's chain goes on to the next queued build in the microtask of the
  // last one's landing; every RUN builds it goes on from a timer task
  // instead, in line with the page's own, so React commits and timers fire
  // within a run's worth
  const origProcess = nodes?._processBuildQueue;
  let done = 0;
  const processInRuns = function () {
    if (this._buildInProgress) return;
    if (this._buildQueue.length === 0) {
      done = 0;
      return;
    }
    if (done >= run) {
      // (the build the timer starts is the first of the next run)
      done = 1;
      setTimeout(() => origProcess.call(this), 0);
      return;
    }
    done++;
    origProcess.call(this);
  };
  // (a frame asked for once the held objects may have landed)
  const rearm = () => {
    if (armed || typeof requestAnimationFrame !== 'function') return;
    armed = true;
    requestAnimationFrame(() => {
      armed = false;
      if (held) {
        held = 0;
        invalidate?.();
      }
    });
  };
  if (deferred) {
    renderer._renderObjectDirect = function (object, material, scene, camera, lightsNode, group, clippingContext, passId) {
      const inFrame = material === scene?.overrideMaterial || object === scene || object?.isQuadMesh === true;
      if (!inFrame) {
        const ro = objects.get(object, material, scene, camera, lightsNode, this._currentRenderContext, clippingContext, passId);
        const built = nodes.get(ro).nodeBuilderState !== undefined || nodes.nodeBuilderCache.has(nodes.getForRenderCacheKey(ro));
        if (!built) {
          held++;
          rearm();
          if (ro.__pass === undefined) {
            ro.__pass = { mrt: this._mrt ?? null, target: this._renderTarget ?? null };
            queue(ro);
          }
          return undefined;
        }
      }
      return origDraw.call(this, object, material, scene, camera, lightsNode, group, clippingContext, passId);
    };
    // (three keeps the entry in a field of its own, set at construction)
    if (handled) renderer._handleObjectFunction = renderer._renderObjectDirect;
    nodes._createNodeBuilder = createAs;
    if (typeof origProcess === 'function') nodes._processBuildQueue = processInRuns;
  }
  // A render object held out of every frame was never built, and three's
  // Bindings.deleteForRender asks it for its bindings to destroy them,
  // which builds its shader there and then to throw it away (a soldier's
  // first cut disposed as the level's cut lands: each held material of the
  // body, in each pass, built in the one task: 2.5 s on Hoth's built site,
  // where the level's cut arrives before the first one's builds have run).
  // One with no bindings and no builder state has nothing to destroy, and
  // is forgotten as it is.
  const bindings = renderer._bindings;
  const origDelete = bindings?.deleteForRender;
  const deleteBuilt = function (ro) {
    if (!ro._bindings && !ro._nodeBuilderState && nodes?.get(ro).nodeBuilderState === undefined) return this.delete(ro);
    return origDelete.call(this, ro);
  };
  if (typeof origDelete === 'function' && typeof bindings.delete === 'function') bindings.deleteForRender = deleteBuilt;
  // A build off the frame reads the lights from its scene's LightsNode,
  // which three empties again as each render of the scene ends
  // (Lighting.finishRender puts back what it held before the render, and
  // before the first frame that is nothing). So every material built off
  // the frame was built with no lights, and kept under the key of the
  // lights it had been drawn with: the Death Star's lamps lit nothing on
  // WebGPU, the rooms only their shadow colour. Once the outermost render
  // of a scene ends, its LightsNode keeps that render's lights for the
  // builds that come after it; a render of the scene inside another (a pass
  // drawn from inside the post chain's quad) still has its outer lights
  // put back.
  const lighting = renderer.lighting;
  const origBegin = lighting?.beginRender;
  const origFinish = lighting?.finishRender;
  const depth = new WeakMap();
  const beginKept = function (s) {
    if (s && typeof s === 'object') depth.set(s, (depth.get(s) ?? 0) + 1);
    return origBegin.call(this, s);
  };
  const finishKept = function (s) {
    const node = this.getNode(s);
    const drawn = node?.getLights?.();
    const out = origFinish.call(this, s);
    const d = s && typeof s === 'object' ? (depth.get(s) ?? 1) - 1 : 0;
    if (d > 0) depth.set(s, d);
    else {
      if (s && typeof s === 'object') depth.delete(s);
      // (a scene's or a group's own node: anything else shares three's default, which no frame lights)
      if ((s?.isScene === true || s?.isGroup === true) && drawn) node.setLights(drawn);
    }
    return out;
  };
  const keepLights = deferred && typeof origBegin === 'function' && typeof origFinish === 'function' && typeof lighting.getNode === 'function';
  if (keepLights) {
    lighting.beginRender = beginKept;
    lighting.finishRender = finishKept;
  }
  const guard = {
    pending: () => pending,
    held: () => held,
    dispose() {
      if (pipelines.getForRender === guard.wrappedGet) pipelines.getForRender = origGet;
      if (deferred && renderer._renderObjectDirect === guard.wrappedDraw) {
        renderer._renderObjectDirect = origDraw;
        if (renderer._handleObjectFunction === guard.wrappedDraw) renderer._handleObjectFunction = origDraw;
        if (nodes._createNodeBuilder === createAs) nodes._createNodeBuilder = origCreate;
        if (nodes._processBuildQueue === processInRuns) nodes._processBuildQueue = origProcess;
      }
      if (bindings && bindings.deleteForRender === deleteBuilt) bindings.deleteForRender = origDelete;
      if (keepLights && lighting.beginRender === beginKept) lighting.beginRender = origBegin;
      if (keepLights && lighting.finishRender === finishKept) lighting.finishRender = origFinish;
      delete pipelines.__guard;
    },
  };
  guard.wrappedGet = pipelines.getForRender;
  guard.wrappedDraw = renderer._renderObjectDirect;
  pipelines.__guard = guard;
  return guard;
}
