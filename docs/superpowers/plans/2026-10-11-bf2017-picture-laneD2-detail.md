# Lane D2: every detail. The ultra cuts, the caps, the decals, the dropped meshes, the gate that counts everything

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§3.4, §4 “D2”). Branch `claude/bf2017-d2-detail` from `claude/bf2017-e0-factory-on-main` (E0, PR #888: the level factory this lane runs), merged with `origin/main` before the PR. One PR. The rules: `docs/health/RULES.md` and `.claude/skills/autopilot/SKILL.md`.

Read first: E0’s hand-off section in `docs/superpowers/HANDOFF-bf2017.md` (the factory’s options, the one-line commands), `scripts/bf2017-level.mjs` and `scripts/lib/bf2017-level.mjs`, `src/lib/level/{lod,fit}.js` (`texSizeFor`, the caps, `fitCull`), `scripts/bf2017-level-parts.mjs`, `scripts/lib/bf2017-decals.mjs`, `scripts/assets-publish.mjs` and `scripts/lib/asset-manifest.mjs`, `scripts/galaxy-check.mjs:91-96` (what `models MB` counts), `public/models/galaxy/bf2017/levels/*/README.md` (what each pack dropped and why).

The bucket needs `SUPABASE_URL` and `SUPA_KEY`; stop at once and say so if absent. Never print a key. Publishing needs the service key the hand-off names; publish by hash, nothing raw from the drop.

## Tasks

1. **Ultra for every pack.** Run the factory with `--ultra` for hoth, endor and the space packs (sb_endor, sb_fondor, sb_kamino, sb_droidbattleship; E1 to E4 re-run theirs when this lands): LOD0 above 12,000 triangles and 2,048 maps on the ultra row. Record the ultra numbers (triangles, calls, MB) in each pack’s README.
2. **The caps a step up.** `texSizeFor`: colour 2,048 on high for wearers of 8 m and over, 1,024 from 2 m; mid 1,024 / 512 / 256; normal and ORM no longer a step under colour on high and ultra. Tests pin the table. Re-run the packs; the rows (`src/lib/budgets.js`) stay, and a world over its row is cut by `fitCull`, never by a lower cap.
3. **Anisotropy.** `level/levelGltf.js` and `crewSurface.js` set `anisotropy` from the device budget (16 on high and ultra, 4 on mid) on every pack map they bind (the surfaces design’s Q5 “one-line change”), with a test.
4. **Decals.** `decalsOf` keeps normal-only volume decals (a normal map with no colour is a decal still); `decals.json` written for every pack; `--parts` re-run.
5. **The dropped meshes.** On ultra, `fitCull` holds to the ultra row alone (1,500 calls, no triangle row): Endor’s 169 dropped meshes at high come back at ultra. The skinned shrubs (Endor’s 425) as rigid bind-pose instances in the pack (`lib/bf2017-level.mjs:96`’s rule relaxed to “skinned actors with a bind pose and no clip of their own”). Each pack’s README says what still stays out and why.
6. **Probes and the LUT.** Probes at 128² with the sun kept (`bf2017-level-parts.mjs:129-132`’s clip is lifted on ultra); the LUT 33³ in the light record.
7. **The gate counts everything.** `galaxy-check.mjs`’s `models MB` counts every fetched `.glb`, `.ktx2` and `.bin`; `galaxy-budget.mjs` gains a bucket-backed note: E0’s evidence shows main’s Hoth at 111.7 MB under the bucket against the 60 MB row written for a base-less server, so the row is re-measured on main’s Hoth with the bucket and set with its reason in the commit (the rule: never raise a budget without one).
8. **Publishing.** Every pack published by hash through `assets-publish.mjs`, the space packs out of git (`.gitignore`’s block), `assets-check` green, `coverage:bf2017` green.
9. **Evidence.** `docs/superpowers/evidence/bf2017-picture/d2/README.md`: per pack and tier, before and after: maps at each size, LOD0 meshes, decals, restored meshes, MB.
10. **The hand-off** row; merge `origin/main`; the full checks; the PR.

## Not this lane

The renderer (T2), the HDR panoramas and the Enlighten atlases (the desktop), the per-instance variations (M2).
