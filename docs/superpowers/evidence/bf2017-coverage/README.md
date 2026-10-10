# The coverage ledger of the Battlefront II (2017) drop

`ledger.md` (the table by part, by lane and by rule) and `ledger.json.gz` (every row: `{ id, part, name, state, by, bytes, count?, finding? }`) were written on 2026-10-10 by lane Z of the fifth design (`docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` §3) with

```
NODE_USE_ENV_PROXY=1 node scripts/bf2017-coverage.mjs --listing <a saved walk of the bucket>
```

in a cloud session holding the bucket’s keys: the manifests (`web/models.jsonl`, `anims.jsonl`, `textures.jsonl`, `physics.jsonl`, `terrain.jsonl`, `misc.jsonl`, `maps/index.json`, and `data.tsv`) fetched from `bf2017-assets`, and a walk of the bucket’s `web/` and `test/` folders (16,767 folders, 113,463 objects, and `data.tsv`) as the listing. The script’s own walk (no `--listing`) does the same and saves it to `lab/assets/bf2017/web/listing.tsv`; `--root <export>/web_opt` reads the desktop’s mirror and its `upload_state.tsv` instead, with no key.

**The counts:** 80,837 rows · used 2,428 · owned 59,904 · excluded 13,837 · not-uploaded 4,668 · unowned 0.

- A row is one object: a model with all its LOD files; a collision mesh; a clip; a texture with the derived maps cut from it; a Havok shape set; a terrain; a map, and each of its five extras kinds (lights, decals, actors, vehicles, effects); a scatter table; a track; a film with its subtitles; a font; an icon; a string table; `data/` by top folder and record type (1,307 rows for 83,983 records, never one row a record); an object only the listing names (the probe faces, the post-process tables, the models outside the manifest), one row a model with its LODs.
- `used` names the site file that consumes it (the galaxy manifest’s `from`, a credit’s title, a level pack’s `meshes` and `tex`, a clip pack’s `extras.source`, `planetSkins.json`, the light records, `bf2017Fx.js`, the rulebooks’ `_source`), and a used model’s textures are used by the same file. `excluded` names its rule (`era`, or `scaffolding` with the uploader’s own notes and viewers; the owner holds the licence for everything else, the fonts included); `not-uploaded` the lane that uploads it (`D` for textures); `owned` the lane in `scripts/lib/bf2017-owners.mjs`.
- `npm run coverage:bf2017` reads `ledger.json.gz` with no key and fails while a row is unowned, or owned by a lane whose `LANES` row has `merged` set. Each lane that consumes rows refreshes this file in its PR (the fetch form above), and sets its `merged` when it lands.
