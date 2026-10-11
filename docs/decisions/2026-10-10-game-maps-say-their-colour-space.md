# A game map’s file says its colour space; the loaders stop guessing

Date: 2026-10-10. The long version: `docs/superpowers/specs/2026-10-10-bf2017-colours-everywhere-design.md`.

## Context

The site serves the game’s textures as the bucket’s KTX2, never re-encoded (the native rule). A KTX2 carries its transfer function in its data format descriptor, and three’s KTX2Loader believes it: a colour map tagged linear is sampled as linear light and comes out washed pale. The desktop’s UASTC encode tagged its colour maps linear: of the 312 colour maps in the three level packs on `main`, 180 said linear, every one of them a `_cs` or `_c` map the game stores as BC7_SRGB. The level loader had been forcing sRGB on its two GLB slots “whatever the file says”; the recipes’ emissive maps and the crew’s went by the file.

## Decision

The file says what it is. Every writer in the pipeline stamps the right transfer function into each KTX2 it writes (a colour map sRGB, a data map linear, by DICE’s suffix or the glTF slot it fills: `scripts/lib/ktx2-colour.mjs`), the files on `main` are stamped in place, and `scripts/bf2017-colour-check.mjs --check` holds every pack to it. The loaders keep forcing sRGB on their colour keys as a belt to the braces, so a map the bucket still holds unstamped reads right too. The game’s own format in `web/textures.jsonl` (BC7_SRGB against BC7_UNORM) is the word and comes first; DICE’s suffixes decide only a map the game does not list (103 of its 3,780 `_cs` maps are linear, 169 of its 262 `_w` masks sRGB). The word rides in each pack’s `tex` rows (`srgb` per slug) and the loaders obey it over their slot rules.

## Consequences

- A stamp is one byte: nothing is re-encoded, the level index and every image byte are unchanged (the test pins `ktx2Info` equal before and after), so the native rule stands.
- 180 committed files change by a byte; the heavy-asset mirror does not list them, so nothing is served stale. The crew’s published `tex/` files carry the stamp on their next publish (the hash changes, so they go up as new).
- The breakup overlay’s colour map stays as the file says: its neutral grey is 0.5 read linear, and the game’s word on it is not on disk here.
- A new writer that forgets to stamp fails the audit, not a visitor’s eye.

## Revisit when

- The desktop’s encoder tags colour maps sRGB itself (`tool/ktx2_encode.py`): the stamp becomes a no-op and the audit still holds.
- The export’s `srgb` field starts carrying a value (it is false on every row today): `gameWord` can read it ahead of the format.
- three’s GLTFLoader stops forcing sRGB on a base-colour slot, or a published native model is found carrying a game-linear colour map: the import then writes the word into the material’s extras and `gltf.js` obeys it.
