# Asset manifest

The manifest is the authoritative index a map streams from. It lets the client
load a small **boot slice** before the first frame and stream everything else
on demand, instead of modules hand-feeding URL lists to the loader. It is the
prerequisite for the boot-slice + range-streaming work (the "740 MB slice"
idea applied to assets, not the engine).

## Format

```jsonc
{
  "version": 1,
  "generatedAt": "2026-10-11T00:00:00.000Z",
  "count": 3,
  "assets": [
    { "id": "player.glb",        "path": "player.glb",        "bytes": 812344, "hash": "9f1c…", "kind": "gltf",    "tier": "boot" },
    { "id": "endor/tree.glb",    "path": "endor/tree.glb",    "bytes": 204100, "hash": "a2b8…", "kind": "gltf",    "map": "endor", "pos": [0, 0] },
    { "id": "endor/ambience.mp3","path": "endor/ambience.mp3","bytes": 991233, "hash": "71df…", "kind": "audio",   "map": "endor", "tier": "map" }
  ]
}
```

Per-row fields:

| field      | meaning |
|------------|---------|
| `id`       | logical name modules ask by — canonical, forward-slash (see below) |
| `path`     | object path in the bucket (usually hash-named); defaults to `id` |
| `bytes`    | file size, for budgeting the boot slice |
| `hash`     | short content hash, for cache-busting immutable objects |
| `kind`     | `gltf` \| `texture` \| `audio` (inferred from the extension if absent) |
| `tier`     | `boot` (loaded + awaited before first frame) \| `map` \| `lazy` (default) |
| `map`      | which map it belongs to, for `prefetchMap()` |
| `pos`      | `[x, z]` world position, for `near()` distance streaming |
| `priority` | `0` (highest) … n for the prefetch queue (defaults by tier) |

### Canonical ids

`canonicalId()` turns `maps\endor\tree.glb` into `maps/endor/tree.glb` and
strips leading `./`, leading/trailing and doubled slashes. A Windows build and
a POSIX build therefore produce the **same keys** — this is the fix for the
backslash-id bug that 404'd every asset in local dev.

## Building a manifest

```sh
node scripts/build-manifest.mjs <dir> [--out manifest.json]
```

Walks the directory, skips non-asset files, and writes the index with
canonical ids, byte sizes and content hashes. Assigning `tier`/`map`/`pos` per
row (the pure helpers `buildManifest`, `rowFor`, `hashBytes` are exported for
this) and uploading the objects + rows to the bucket is a separate step that
needs the project's keys — see below.

## Using it at runtime

```js
import { createManifestDriver } from './runtime/manifest';

const driver = createManifestDriver({
  assets,                       // runtime/assets.js instance
  manifest,                     // fetched JSON (or imported)
  base: import.meta.env.BASE_URL, // or the Supabase bucket origin
});

await driver.boot();            // gate the first frame on the boot slice
driver.prefetchMap('endor');    // queue a map in the background
driver.near([x, z], 60, { map: 'endor' }); // distance streaming as the camera moves
driver.urlFor('endor/tree.glb');
```

The driver only translates rows into calls on the existing `assets` queue
(dedupe, priority, concurrency, ownership) — it does no fetching of its own, so
it stays pure and testable.

## Supabase follow-up (needs project keys)

Moving the manifest to a queryable table (so "uploaded vs pending" is a query,
not a filename guess) and streaming objects from the bucket is the next step.
Reference table shape:

```sql
create table asset_manifest (
  id          text primary key,   -- canonical, forward-slash
  path        text not null,      -- object path in the bucket (hash-named)
  bytes       bigint not null,
  hash        text not null,
  kind        text not null,      -- gltf | texture | audio
  tier        text default 'lazy',
  map         text,
  pos         double precision[],
  priority    int,
  uploaded_at timestamptz default now()
);
```

Serve hashed objects with long-lived, immutable cache headers, and point the
driver's `base` at the bucket origin via the existing `ASSET_BASE`. Applying
this migration and running the upload belong with the lane that owns the bucket
contract, not this change.
