// A manifest driver: it turns an asset manifest — the authoritative index a
// map streams from — into prioritised prefetch() calls on runtime/assets, so
// the client loads a small boot slice before the first frame and streams the
// rest on demand instead of being hand-fed URL lists. The manifest says what
// exists (logical id, bucket path, byte size, content hash, kind, load tier),
// which is what lets a boot/stream schedule exist at all.
//
// A manifest: { version, generatedAt, count, assets: [row...] }
// A row:
//   id        logical name, canonical (forward-slash) — the key modules ask by
//   path      object path in the bucket (usually hash-named); defaults to id
//   bytes     file size, for budgeting the boot slice
//   hash      short content hash, for cache-busting immutable objects
//   kind      'gltf' | 'texture' | 'audio' (inferred from the extension if absent)
//   tier      'boot' (loaded and awaited before first frame) | 'map' | 'lazy' (default)
//   map       which map it belongs to, for prefetchMap()
//   pos       [x, z] world position, for near()
//   priority  0 (highest) .. n for the prefetch queue (default by tier)
//
// The module is pure: assets is injected (see runtime/assets.js), and the
// manifest and base are passed in, so it runs in Node under the tests.
//
// createManifestDriver({ assets, manifest, base }) → driver

const KIND_BY_EXT = {
  glb: 'gltf',
  gltf: 'gltf',
  ktx2: 'texture',
  basis: 'texture',
  webp: 'texture',
  png: 'texture',
  jpg: 'texture',
  jpeg: 'texture',
  hdr: 'texture',
  exr: 'texture',
  mp3: 'audio',
  ogg: 'audio',
  wav: 'audio',
  m4a: 'audio',
};

export const extOf = (p) => {
  const s = String(p);
  const dot = s.lastIndexOf('.');
  return dot < 0 ? '' : s.slice(dot + 1).toLowerCase();
};

export const kindForPath = (p) => KIND_BY_EXT[extOf(p)] ?? null;

// Normalise an id so a Windows backslash path and a POSIX one map to the same
// key — the backslash-id bug that 404'd local dev. Forward slashes, no leading
// './' or '/', no doubled '/', no trailing '/'.
export const canonicalId = (p) =>
  String(p)
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

// Join a base (a bucket origin, or Vite's BASE_URL) with an object path. An
// already-absolute URL passes through; an empty base yields the bare path.
export const resolveUrl = (base, path) => {
  const raw = String(path);
  if (/^https?:\/\//i.test(raw)) return raw; // absolute: before canonicalId collapses '//'
  const p = canonicalId(raw);
  if (!base) return p;
  return `${String(base).replace(/\/+$/, '')}/${p}`;
};

const DEFAULT_PRIORITY = { boot: 0, map: 2, lazy: 4 };

export function createManifestDriver({ assets, manifest, base = '' }) {
  if (!assets) throw new Error('manifest driver needs assets');

  const rows = (manifest?.assets ?? []).map((r) => {
    const id = canonicalId(r.id ?? r.path);
    const tier = r.tier ?? 'lazy';
    return {
      ...r,
      id,
      kind: r.kind ?? kindForPath(r.path ?? id),
      tier,
      priority: r.priority ?? DEFAULT_PRIORITY[tier] ?? DEFAULT_PRIORITY.lazy,
    };
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const urlOf = (row) => resolveUrl(base, row.path ?? row.id);

  // Queue a set of rows in the background, grouped by kind and priority
  // (assets.prefetch takes one kind and one priority per call).
  const prefetchRows = (set) => {
    const groups = new Map(); // `${kind}:${priority}` → [url]
    for (const r of set) {
      if (!r.kind) continue;
      const key = `${r.kind}:${r.priority}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(urlOf(r));
    }
    for (const [key, urls] of groups) {
      const i = key.lastIndexOf(':');
      assets.prefetch(urls, { kind: key.slice(0, i), priority: Number(key.slice(i + 1)) });
    }
  };

  return {
    count: () => rows.length,
    row: (id) => byId.get(canonicalId(id)) ?? null,

    // Resolve a logical id to its URL (falls back to joining the raw id).
    urlFor: (id) => {
      const r = byId.get(canonicalId(id));
      return r ? urlOf(r) : resolveUrl(base, id);
    },

    // Load one asset now and await it — for what a world must have before it
    // draws. Rejects for an unknown id or one with no resolvable kind.
    load: (id) => {
      const r = byId.get(canonicalId(id));
      if (!r || !r.kind) return Promise.reject(new Error(`no loadable asset "${id}"`));
      return assets[r.kind](urlOf(r));
    },

    // The boot slice: every tier==='boot' row, loaded and awaited so the
    // caller can gate the first frame on it.
    boot: () => {
      const set = rows.filter((r) => r.tier === 'boot' && r.kind);
      return Promise.all(set.map((r) => assets[r.kind](urlOf(r))));
    },

    // Queue a whole map's non-boot assets by their per-row priority.
    prefetchMap: (map) => prefetchRows(rows.filter((r) => r.map === map && r.tier !== 'boot')),

    // Queue non-boot assets within `radius` of a world position (distance
    // streaming). Optionally restrict to one map.
    near: ([x, z], radius, { map = null } = {}) => {
      const r2 = radius * radius;
      prefetchRows(
        rows.filter((r) => {
          if (r.tier === 'boot') return false;
          if (map && r.map !== map) return false;
          if (!Array.isArray(r.pos)) return false;
          const dx = r.pos[0] - x;
          const dz = (r.pos[1] ?? 0) - z;
          return dx * dx + dz * dz <= r2;
        }),
      );
    },
  };
}
