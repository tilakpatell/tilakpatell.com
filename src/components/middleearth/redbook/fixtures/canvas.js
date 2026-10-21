// A 2D canvas that paints nothing, for the tests that build the book in
// Node: every call is taken and forgotten, image data is zeros, and a
// gradient takes its stops. installCanvas() puts it under `document`.

const gradient = () => ({ addColorStop() {} });

function context(canvas) {
  const target = {
    canvas,
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (s) => ({ width: String(s).length * 8 }),
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => ((t[k] = v), true),
  });
}

export function fakeCanvas() {
  const c = { width: 1, height: 1, style: {} };
  const ctx = context(c);
  c.getContext = () => ctx;
  return c;
}

// (the map’s painter draws its coasts and rivers through Path2D)
class FakePath {
  constructor() {
    return new Proxy(this, { get: (t, k) => (k in t ? t[k] : () => {}) });
  }
}

export function installCanvas() {
  const had = { document: globalThis.document, Path2D: globalThis.Path2D };
  globalThis.document = { createElement: () => fakeCanvas(), fonts: { load: () => Promise.resolve() } };
  globalThis.Path2D = FakePath;
  return () => {
    for (const [k, v] of Object.entries(had)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  };
}
