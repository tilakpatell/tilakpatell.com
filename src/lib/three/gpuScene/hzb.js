// The depth pyramid the GPU scene's cull tests against (GPU-first lane N1):
// a chain of r32float levels, each texel the farthest depth of the 2 × 2
// under it (the nearest on reversed depth, where near is 1), built by one
// compute dispatch a level from a depth texture. Level 0 is half the
// depth's size; each next level halves again, rounded up, so the last
// texel of an odd row takes the odd pixel and nothing under the pyramid is
// left out. A texel of level L covers the depth's pixels [x·2^(L+1),
// (x+1)·2^(L+1)) along each axis, whatever the size (the sizes round up).
//
// The test: a sphere's screen rect (in the depth's pixels) and the depth of
// its nearest point; the level where the rect spans two texels at most;
// the farthest of those (at most four) texels; occluded when the sphere's
// nearest point lies past it. A pyramid not built yet occludes nothing
// (Review Focus 4: the first frame, or the frame after a resize).
//
// Pure (the tests' twin): hzbSizes(w, h) → [[w, h], …] down to 1 × 1
//   reduceDepth(depth: Float32Array, w, h, { reversed }) → [{ width, height, data }]
//   occludedAt(rect: { x0, y0, x1, y1 }, near, mips, { reversed }) → boolean
// GPU: createHzb(renderer, { width, height, reversed, three }) → {
//   levels (StorageTextures), sizes, valid, update(depthTexture), resize(w, h) (the cull's pass reads
//   the levels through uniforms and texture nodes swapped in place, so it is never built again),
//   occludedNode(rect: vec4, near: float) → bool (the test in TSL, for cull.js), dispose() }

const MAX_LEVELS = 12;

export function hzbSizes(w, h) {
  const out = [];
  let a = w;
  let b = h;
  do {
    a = Math.max(1, Math.ceil(a / 2));
    b = Math.max(1, Math.ceil(b / 2));
    out.push([a, b]);
  } while ((a > 1 || b > 1) && out.length < MAX_LEVELS);
  return out;
}

const farther = (reversed) => (reversed ? Math.min : Math.max);

export function reduceDepth(depth, w, h, { reversed = false } = {}) {
  const pick = farther(reversed);
  const mips = [];
  let src = depth;
  let sw = w;
  let sh = h;
  for (const [dw, dh] of hzbSizes(w, h)) {
    const data = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        let v = reversed ? Infinity : -Infinity;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) v = pick(v, src[Math.min(sh - 1, 2 * y + j) * sw + Math.min(sw - 1, 2 * x + i)]);
        data[y * dw + x] = v;
      }
    }
    mips.push({ width: dw, height: dh, data });
    src = data;
    sw = dw;
    sh = dh;
  }
  return mips;
}

// the level whose texels the rect spans two of at most, along each axis
// the level whose texels the rect spans two of at most, along each axis;
// −1 when none does (a screen past the levels the pyramid holds): no test
export function levelFor(rect, count) {
  for (let L = 0; L < count; L++) {
    const s = 2 ** (L + 1);
    if (Math.floor(rect.x1 / s) - Math.floor(rect.x0 / s) <= 1 && Math.floor(rect.y1 / s) - Math.floor(rect.y0 / s) <= 1) return L;
  }
  return -1;
}

export function occludedAt(rect, near, mips, { reversed = false } = {}) {
  if (!mips?.length) return false;
  const L = levelFor(rect, mips.length);
  if (L < 0) return false;
  const { width, height, data } = mips[L];
  const s = 2 ** (L + 1);
  const tx = (v) => Math.min(width - 1, Math.max(0, Math.floor(v / s)));
  const ty = (v) => Math.min(height - 1, Math.max(0, Math.floor(v / s)));
  let far = reversed ? Infinity : -Infinity;
  for (const y of [ty(rect.y0), ty(rect.y1)]) for (const x of [tx(rect.x0), tx(rect.x1)]) far = farther(reversed)(far, data[y * width + x]);
  return reversed ? near < far : near > far;
}

export function createHzb(renderer, { width, height, reversed = false, three }) {
  const { THREE, tsl } = three;
  const { Fn, If, instanceIndex, ivec2, uint, int, float, vec4, min, max, textureLoad, textureStore, texture, uniform, uniformArray, floor, select, bool } = tsl;
  const pick = reversed ? min : max;
  // (a 1 × 1 stand-in for the levels a smaller screen does not use)
  const blank = new THREE.StorageTexture(1, 1);
  blank.type = THREE.FloatType;
  blank.format = THREE.RedFormat;
  const hzb = {
    levels: [],
    sizes: [],
    valid: false,
    source: null,
    passes: [],
    reversed,
    // the test's inputs, swapped in place on a resize so cull.js's pass is never built again
    count: uniform(0, 'int'),
    sizeOf: uniformArray(Array.from({ length: MAX_LEVELS }, () => new THREE.Vector4(1, 1, 0, 0)), 'vec4'),
    textures: Array.from({ length: MAX_LEVELS }, () => texture(blank)),
  };

  function make(w, h) {
    for (const t of hzb.levels) t.dispose();
    for (const p of hzb.passes) p.dispose?.();
    hzb.sizes = hzbSizes(w, h);
    hzb.levels = hzb.sizes.map(([lw, lh]) => {
      const t = new THREE.StorageTexture(lw, lh);
      t.type = THREE.FloatType;
      t.format = THREE.RedFormat;
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      return t;
    });
    hzb.textures.forEach((node, k) => {
      node.value = hzb.levels[k] ?? blank;
      hzb.sizeOf.array[k].set(...(hzb.sizes[k] ?? [1, 1]), 0, 0);
    });
    hzb.count.value = hzb.levels.length;
    hzb.width = w;
    hzb.height = h;
    hzb.passes = [];
    hzb.source = null;
    hzb.valid = false;
  }

  function build(depthTexture) {
    hzb.passes = hzb.sizes.map(([lw, lh], k) => {
      const src = k === 0 ? depthTexture : hzb.levels[k - 1];
      const [sw, sh] = k === 0 ? [hzb.width, hzb.height] : hzb.sizes[k - 1];
      return Fn(() => {
        const x = int(instanceIndex.mod(uint(lw)));
        const y = int(instanceIndex.div(uint(lw)));
        const v = float(reversed ? 1e30 : -1e30).toVar();
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const at = ivec2(min(x.mul(2).add(i), int(sw - 1)), min(y.mul(2).add(j), int(sh - 1)));
            v.assign(pick(v, textureLoad(src, at).x));
          }
        }
        textureStore(hzb.levels[k], ivec2(x, y), vec4(v, 0, 0, 1)).toWriteOnly();
      })().compute(lw * lh);
    });
    hzb.source = depthTexture;
  }

  make(width, height);

  hzb.update = (depthTexture) => {
    if (!depthTexture) return;
    const w = depthTexture.image?.width ?? hzb.width;
    const h = depthTexture.image?.height ?? hzb.height;
    if (w !== hzb.width || h !== hzb.height) make(w, h);
    if (hzb.source !== depthTexture) build(depthTexture);
    for (const p of hzb.passes) renderer.compute(p);
    hzb.valid = true;
  };
  hzb.resize = (w, h) => make(w, h);

  // The test in TSL: rect in the depth's pixels (x0, y0, x1, y1), as occludedAt
  hzb.occludedNode = (rect, nearDepth) => {
    const L = int(-1).toVar();
    for (let k = MAX_LEVELS - 1; k >= 0; k--) {
      const s = float(2 ** (k + 1));
      const spans = floor(rect.z.div(s)).sub(floor(rect.x.div(s))).lessThanEqual(1).and(floor(rect.w.div(s)).sub(floor(rect.y.div(s))).lessThanEqual(1));
      L.assign(select(spans.and(int(k).lessThan(hzb.count)), int(k), L));
    }
    const far = float(reversed ? 1e30 : -1e30).toVar();
    for (let k = 0; k < MAX_LEVELS; k++) {
      If(L.equal(int(k)), () => {
        const s = float(2 ** (k + 1));
        const size = hzb.sizeOf.element(k);
        const tx = (v) => int(min(max(floor(v.div(s)), 0), size.x.sub(1)));
        const ty = (v) => int(min(max(floor(v.div(s)), 0), size.y.sub(1)));
        for (const y of [ty(rect.y), ty(rect.w)]) for (const x of [tx(rect.x), tx(rect.z)]) far.assign(pick(far, textureLoad(hzb.textures[k], ivec2(x, y)).x));
      });
    }
    const hidden = reversed ? nearDepth.lessThan(far) : nearDepth.greaterThan(far);
    return bool(L.greaterThanEqual(0).and(hidden));
  };
  hzb.dispose = () => {
    for (const t of hzb.levels) t.dispose();
    for (const p of hzb.passes) p.dispose?.();
    blank.dispose();
  };
  return hzb;
}
