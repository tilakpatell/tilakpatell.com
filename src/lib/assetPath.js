// The asset base's rule, alone, so the build's scripts can use it without the
// bundled manifest (src/lib/assetBase.js passes it in): a path the manifest
// names goes to `<base>/<hash>/<path>`, anything else (a query, another
// origin, no base) is returned as it came. A whole level's pack is one row for
// its folder (a key ending in a slash, scripts/lib/asset-manifest.mjs's
// WHOLE): a file under it goes to `<base>/<the folder's hash>/<path>`.
//
// remotePath(path, base, manifest) → string

export function remotePath(path, base, manifest) {
  if (!base || typeof path !== 'string' || /^[a-z][a-z0-9+.-]*:|[?#]/i.test(path)) return path;
  const key = path.replace(/^\/+/, '');
  let hit = manifest?.[key];
  for (let i = key.lastIndexOf('/'); !hit && manifest && i > 0; i = key.lastIndexOf('/', i - 1)) hit = manifest[key.slice(0, i + 1)];
  return hit ? `${base.replace(/\/+$/, '')}/${hit.hash}/${key}` : path;
}
