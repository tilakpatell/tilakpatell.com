// Textures set up the same way everywhere: as sharp at a slant as the device
// can afford, in the right colour space, decoded off the main thread where
// the browser can, and uploaded to the graphics chip before they're first
// drawn. Every loader and every painted canvas goes through `sharpen`, so a
// floor seen from a cockpit, a model's deck plates and a planet's map all get
// the tier's anisotropy (lib/device: 16 on a desktop, 4 on a phone, 1 on a
// weak one) instead of whatever number the file that made them happened to
// pick.
//
//   sharpen(texture, { renderer, color, repeat, wrap, mipmaps, aniso, bias })
//       (`bias`: a mip bias of this texture's own on top of the post
//       chain's, which the game material reads at its samples; three r186's
//       Texture has none, so it rides in userData.mipBias: GPU-first lane N2,
//       lib/three/mipBias, surface/compose.js's biasedTexture)
//   setMipBias(b): the chain's bias for every game material (lib/three/mipBias)
//   sharpenMaterial(material, opts), sharpenTree(root, opts)
//   loadTexture(url, { renderer, color, ...sharpen's }) → Promise<Texture>
//   variant(url, suffix, use) → the -sm / -512 file for a smaller tier
//   warm(renderer, root | [textures]) → uploads now, not on the first frame
//   detailCanvas(w, h, { level, max }) → { canvas, ctx, k }: a canvas to
//       paint a texture on at the device's detail (lib/detail), drawn in
//       its design units whatever its size
//   fitTexture(texture, cap), fitTextures(root, cap) → no map bigger than
//       `cap` texels a side (a phone's or a weak device's ceiling)
//   coverageMips({ width, height, data }, { cut }) → { mipmaps, coverage }:
//       a cut-out map's mip levels made by hand, each one's alpha scaled so
//       as much of it is over the cut as at full size (pure)
//   coverageTexture(texture, { cut }) → the texture, wearing those levels,
//       so far-off leaves stay as thick as near ones
//
// Only lazily loaded scene modules import this, so a page that never draws
// in 3D never downloads three.js.

import * as THREE from 'three';
import { budget } from '../device';
import { modelTexCap, texScale } from '../detail';
import { loadBytes } from '../assetLoad';

export { setMipBias } from './mipBias';

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', ktx2: 'image/ktx2' };
const imageType = (url) => TYPES[/\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase()] ?? '';

// The anisotropy to ask for: the tier's, no more than the graphics chip has
// (16 on most; 1 where the extension is missing, which three reports as 1).
export function anisotropyFor(max, want = budget().aniso) {
  const cap = Number.isFinite(max) && max >= 1 ? max : 16;
  const w = Number.isFinite(want) && want >= 1 ? want : 1;
  return Math.max(1, Math.min(w, cap));
}

export const MAP_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap', 'specularMap', 'specularColorMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'transmissionMap', 'thicknessMap'];

// Settings a texture gets once: anisotropy from the budget (under the
// renderer's maximum when one is given), colour space (`color: true` for
// sRGB, false for a data map, undefined leaves it), wrapping and repeat.
// Mipmaps stay on unless `mipmaps: false` (a sky always seen magnified).
export function sharpen(texture, { renderer = null, color, repeat = null, wrap = null, mipmaps = true, aniso = null, bias = null } = {}) {
  if (!texture?.isTexture) return texture;
  if (Number.isFinite(bias)) texture.userData.mipBias = bias;
  const max = renderer?.capabilities?.getMaxAnisotropy?.() ?? 16;
  texture.anisotropy = anisotropyFor(max, aniso ?? undefined);
  if (color === true) texture.colorSpace = THREE.SRGBColorSpace;
  else if (color === false) texture.colorSpace = THREE.NoColorSpace;
  if (wrap === true) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  else if (wrap === false) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  if (repeat) {
    if (wrap == null) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  if (!mipmaps) {
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
  }
  texture.needsUpdate = true;
  return texture;
}

// Every map a material holds. Colour maps and data maps keep their own
// colour spaces (a loaded model's are already right; this only sharpens).
export function sharpenMaterial(material, opts = {}) {
  if (!material) return material;
  for (const slot of MAP_SLOTS) {
    const t = material[slot];
    if (t?.isTexture) sharpen(t, { ...opts, color: undefined });
  }
  return material;
}

// Every map under a root (a loaded model), once.
export function sharpenTree(root, opts = {}) {
  if (!root?.traverse) return root;
  const seen = new Set();
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      sharpenMaterial(m, opts);
    }
  });
  return root;
}

// The smaller file for a smaller tier: variant('/t/day.webp', '-sm', true)
// is '/t/day-sm.webp'; with `use` false the URL comes back as it is.
export function variant(url, suffix = '-sm', use = true) {
  if (!use || !suffix) return url;
  const q = url.search(/[?#]/);
  const path = q < 0 ? url : url.slice(0, q);
  const tail = q < 0 ? '' : url.slice(q);
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot <= slash) return `${path}${suffix}${tail}`;
  return `${path.slice(0, dot)}${suffix}${path.slice(dot)}${tail}`;
}

// Whether this browser decodes images off the main thread well enough to use
// (three's own GLTFLoader draws the same line: not Safari before 17, not
// Firefox before 98, and only where createImageBitmap exists).
export function imageBitmapOk(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', has = typeof createImageBitmap !== 'undefined') {
  if (!has) return false;
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  if (safari) {
    const v = ua.match(/Version\/(\d+)/);
    if (!v || parseInt(v[1], 10) < 17) return false;
  }
  const ff = ua.match(/Firefox\/(\d+)\./);
  if (ff && parseInt(ff[1], 10) < 98) return false;
  return true;
}

let bitmapLoader = null;
let plainLoader = null;
const loaders = () => {
  if (!plainLoader) {
    plainLoader = new THREE.TextureLoader();
    if (imageBitmapOk()) {
      bitmapLoader = new THREE.ImageBitmapLoader();
      // decoded the way a TextureLoader image is drawn: flipped for GL's
      // bottom-up rows (an ImageBitmap can't be flipped at upload), alpha
      // kept straight
      bitmapLoader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
    }
  }
  return { bitmap: bitmapLoader, plain: plainLoader };
};

// A texture from a URL, decoded off the main thread where the browser can
// (ImageBitmapLoader; a TextureLoader otherwise), then sharpened. Shared
// by URL for the page's life: two scenes asking for the same file get one
// download, one decode and one texture, set up the way the first asked
// (clone it where two need it to differ). Rejects if the file can't be had
// (and forgets it, so a later try asks again).
const cache = new Map(); // url → Promise<Texture>
export function loadTexture(url, { renderer = null, color = true, ...rest } = {}) {
  if (!cache.has(url)) {
    const { bitmap, plain } = loaders();
    // a GPU-compressed texture (KTX2) goes through the shared KTX2 loader,
    // which is only fetched for one; it comes with its own mipmaps
    // (from the bucket where it has the file: the same bytes, so the same texture)
    // (its bytes through the site's pool, from the bucket where it has the
    // file: the same bytes, so the same texture; then decoded as it always was)
    const p = loadBytes(url).then(async (buf) => {
      if (/\.ktx2(?:[?#]|$)/i.test(url)) {
        const k = await import('./gltf').then(({ ktx2Loader }) => ktx2Loader({ renderer }));
        return new Promise((resolve, reject) => k.parse(buf, resolve, reject));
      }
      const blob = new Blob([buf], { type: imageType(url) });
      if (bitmap) {
        // (ImageBitmapLoader's own decode, from bytes already here)
        const img = await createImageBitmap(blob, { ...bitmap.options, colorSpaceConversion: 'none' });
        const t = new THREE.Texture(img);
        t.flipY = false; // (the bitmap was flipped as it was decoded)
        return t;
      }
      const src = URL.createObjectURL(blob);
      try {
        return await plain.loadAsync(src);
      } finally {
        URL.revokeObjectURL(src);
      }
    });
    cache.set(
      url,
      p.then((t) => sharpen(t, { renderer, color, ...rest })).catch((e) => {
        cache.delete(url);
        throw e;
      }),
    );
  }
  return cache.get(url);
}

// Forget a cached texture (the caller disposes it).
export function forgetTexture(url) {
  cache.delete(url);
}

// Every texture under a root, in a list, or in a material set ({ map,
// normalMap, … } or a texture), each once.
export function texturesOf(what, into = new Set()) {
  const add = (t) => t?.isTexture && into.add(t);
  if (!what) return into;
  if (Array.isArray(what)) what.forEach((w) => texturesOf(w, into));
  else if (what.isTexture) add(what);
  else if (what.traverse) {
    what.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const slot of MAP_SLOTS) add(m[slot]);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) add(u?.value);
      }
    });
  } else if (what.isMaterial) {
    for (const slot of MAP_SLOTS) add(what[slot]);
  } else if (typeof what === 'object') {
    for (const v of Object.values(what)) if (v?.isTexture) add(v);
  }
  return into;
}

const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(() => fn({ timeRemaining: () => 8 }), 32));

// Upload every texture under `root` (or in a list, or a set) ahead of the
// first frame that shows them, so that frame doesn't pay for it. All at
// once by default; with `idle`, a couple per idle callback, so a world's
// forty maps arrive over a few quiet moments instead of one long one.
// Resolves to how many were uploaded.
export function warm(renderer, what, { idle = false, perSlice = 2 } = {}) {
  if (!renderer?.initTexture) return Promise.resolve(0);
  const list = [...texturesOf(what)];
  let n = 0;
  const upload = (t) => {
    try {
      if (t.image || t.isCompressedTexture || t.isDataTexture) {
        renderer.initTexture(t);
        n += 1;
      }
    } catch {
      // a texture that isn't ready yet uploads on its first frame instead
    }
  };
  if (!idle) {
    list.forEach(upload);
    return Promise.resolve(n);
  }
  return new Promise((resolve) => {
    const slice = (deadline) => {
      let done = 0;
      while (list.length && (done < perSlice || (deadline?.timeRemaining?.() ?? 0) > 4)) {
        upload(list.shift());
        done += 1;
      }
      if (list.length) whenIdle(slice);
      else resolve(n);
    };
    whenIdle(slice);
  });
}

// ── Detail ──

// A canvas for a texture painted in code, sized for this device (lib/detail's
// texScale: twice the texels at ultra, half on a weak device), its context
// scaled so the painter draws in the units it was designed in: a 512 design
// is painted by the same strokes at 1024 on an RTX 5090, crisper, not
// smaller. A painter that works on pixels itself (getImageData) reads `k`.
export function detailCanvas(w, h = w, { level, max } = {}) {
  const k = texScale(Math.max(w, h), { level, max });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d');
  ctx.scale(k, k);
  return { canvas, ctx, k };
}

// The size a w × h map is halved to until its longer side is at most `cap`,
// or null if it fits already. Pure.
export function fitSize(width, height, cap) {
  if (!(width > 0 && height > 0) || Math.max(width, height) <= cap) return null;
  let w = width;
  let h = height;
  while (Math.max(w, h) > cap && Math.min(w, h) > 1) {
    w = Math.max(1, Math.round(w / 2));
    h = Math.max(1, Math.round(h / 2));
  }
  return { width: w, height: h };
}

// How many of a compressed map's top mip levels are over `cap`, never
// counting its last. Pure.
export function mipsOver(levels, cap) {
  let n = 0;
  while (n < levels.length - 1 && Math.max(levels[n].width, levels[n].height) > cap) n += 1;
  return n;
}

// Something a canvas can draw: a decoded image, a bitmap, another canvas.
const drawable = (img) =>
  (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) ||
  (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) ||
  (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) ||
  (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas);

// A texture brought under `cap` texels a side before it reaches the
// graphics chip: an image halved on a canvas (the texture's source changed
// in place, so every copy sharing it shrinks too), a compressed one started
// at its first mip level that fits (its smaller levels were made offline,
// so nothing is lost but the levels a phone couldn't use). A texture that
// isn't an image (data, video) or that was already uploaded is left alone.
// Returns whether it changed.
export function fitTexture(texture, cap) {
  if (!texture?.isTexture || !(cap > 0)) return false;
  if (texture.isCompressedTexture) {
    const drop = mipsOver(texture.mipmaps ?? [], cap);
    if (!drop) return false;
    texture.mipmaps = texture.mipmaps.slice(drop);
    texture.image = { ...texture.image, width: texture.mipmaps[0].width, height: texture.mipmaps[0].height };
    texture.needsUpdate = true;
    return true;
  }
  if (texture.isDataTexture || texture.isVideoTexture || texture.isRenderTargetTexture || typeof document === 'undefined') return false;
  const img = texture.source?.data ?? texture.image;
  const size = fitSize(img?.width, img?.height, cap);
  if (!size || !drawable(img)) return false;
  const c = document.createElement('canvas');
  c.width = size.width;
  c.height = size.height;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size.width, size.height);
  texture.source.data = c;
  texture.needsUpdate = true;
  return true;
}

// Every map under a loaded model fitted under `cap` (lib/detail's ceiling
// for this device: 512 on a weak one, 1024 on a phone, nothing a desktop
// would notice), each source once. Maps on see-through materials are left
// as they are: a canvas would darken the edges their alpha cuts out.
export function fitTextures(root, cap = modelTexCap()) {
  if (!root?.traverse || !(cap > 0)) return 0;
  const seen = new Set();
  let n = 0;
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.transparent || m.alphaTest > 0 || m.alphaMap) continue;
      for (const slot of MAP_SLOTS) {
        const t = m[slot];
        if (!t?.isTexture || seen.has(t.source ?? t)) continue;
        seen.add(t.source ?? t);
        if (fitTexture(t, cap)) n += 1;
      }
    }
  });
  return n;
}

// ── Coverage ──

// For each of `n` cells across a side `size` texels long, the texels it
// covers and how much of each, as pairs (texel, weight), the weights of a
// cell summing to one: its area average, even where a side doesn't halve
// evenly (14 rows into 3).
function spans(size, n) {
  const s = size / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * s;
    const b = a + s;
    const cell = [];
    for (let t = Math.floor(a); t < Math.min(size, Math.ceil(b)); t++) {
      const w = Math.min(b, t + 1) - Math.max(a, t);
      if (w > 0) cell.push(t, w / s);
    }
    out.push(cell);
  }
  return out;
}

// A `w` × `h` level of an image, each texel the average of the image's
// texels under it, its colour weighted by their alpha (as a canvas
// resamples): a texel half over a leaf and half over nothing is the leaf's
// colour half opaque, not a darker one.
function shrink({ width, height, data }, w, h) {
  const xs = spans(width, w);
  const ys = spans(height, h);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const rows = ys[y];
    for (let x = 0; x < w; x++) {
      const cols = xs[x];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let j = 0; j < rows.length; j += 2) {
        const line = rows[j] * width;
        for (let k = 0; k < cols.length; k += 2) {
          const i = (line + cols[k]) * 4;
          const wa = data[i + 3] * rows[j + 1] * cols[k + 1];
          r += data[i] * wa;
          g += data[i + 1] * wa;
          b += data[i + 2] * wa;
          a += wa;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a;
    }
  }
  return { width: w, height: h, data: out };
}

// A cut-out map's mip levels made by hand. Left to the graphics chip, each
// level is a plain average, and a leaf's edges average under the cut: a
// crown thins level by level till a far-off tree is bare twigs. Here each
// level is the full-size image averaged down (each side halved, to one
// texel), then its alpha scaled up (a few tries, at most four times) till
// as much of it is over the cut as at full size. Pure, on anything shaped
// like an ImageData, square or not; the first level is the image itself.
// `coverage` is the share of the full-size image over the cut.
export function coverageMips(image, { cut = 0.3 } = {}) {
  const { width, height, data } = image;
  const edge = cut * 255;
  const over = (d, m = 1) => {
    let on = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] * m > edge) on++;
    return on;
  };
  if (!(width > 0 && height > 0)) return { mipmaps: [image], coverage: 0 };
  const coverage = over(data) / (width * height);
  const mipmaps = [image];
  for (let w = width, h = height; w > 1 || h > 1; ) {
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
    const level = shrink(image, w, h);
    const a = level.data;
    let lo = 1;
    let hi = 4;
    for (let k = 0; k < 8; k++) {
      const m = (lo + hi) / 2;
      if (over(a, m) / (w * h) < coverage) lo = m;
      else hi = m;
    }
    for (let i = 3; i < a.length; i += 4) a[i] = Math.min(255, a[i] * hi);
    mipmaps.push(level);
  }
  return { mipmaps, coverage };
}

// A cut-out texture (leaves, needles, fronds: alpha-tested) wearing those
// levels in place of the ones the graphics chip would make: its image (a
// canvas, a decoded image, a bitmap) read off a canvas, each smaller level
// painted on a canvas of its own, the image itself kept as the first. One
// that isn't a picture a canvas can draw (data, compressed, video), or whose
// pixels a canvas won't give up (a tainted one), is left to make its own.
// Returns the texture.
export function coverageTexture(texture, { cut = 0.3 } = {}) {
  if (!texture?.isTexture || texture.isDataTexture || texture.isCompressedTexture || texture.isVideoTexture || typeof document === 'undefined') return texture;
  const img = texture.image;
  if (!(img?.width > 0 && img?.height > 0) || !(drawable(img) || typeof img.getContext === 'function')) return texture;
  const { width, height } = img;
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  let data;
  try {
    const ctx = canvas(width, height).getContext('2d');
    ctx.drawImage(img, 0, 0);
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return texture;
  }
  if (!(data?.length >= width * height * 4)) return texture;
  const { mipmaps } = coverageMips({ width, height, data }, { cut });
  const painted = mipmaps.slice(1).map((m) => {
    const c = canvas(m.width, m.height);
    const ctx = c.getContext('2d');
    const out = ctx.createImageData?.(m.width, m.height);
    if (out?.data?.length === m.data.length) {
      out.data.set(m.data);
      ctx.putImageData(out, 0, 0);
    } else ctx.putImageData(m, 0, 0);
    return c;
  });
  texture.mipmaps = [img, ...painted];
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}
