# Battlefront 2017, lane D: the desktop. The textures that were never queued, and the sound export. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. This lane runs on the owner's desktop in `C:\Users\tilak\Downloads\BF2_Extract` (not the repo); nothing here is committed to the site except the hand-off's status row. Build directly; no judge pass.

**Goal:** Every texture the site's cast and effects reach through a variation, a shader parameter, an LOD cap or an effect graph is encoded and in the bucket, and the game's sounds are exported, encoded and in the bucket under `web/audio/`, so the site lanes that say "re-import when the upload has it" can.

**Architecture:** D1 computes the texture list the web build never made (`web_optimize.py` lists only the maps a packed LOD0 GLB binds) from the data records, and runs the existing encoder and uploader on it the way the planet skins went. D2 adds a sound pass to `bf2export` through Frosty's own `SoundEditorPlugin.dll`, decodes each `SoundWaveAsset` the sound patches name to WAV, encodes with ffmpeg and uploads.

**Tech Stack:** Python 3 (`tool/*.py`), C# (`tool/bf2export.csproj`, .NET Framework, FrostySdk), ffmpeg, the Supabase REST and tus uploaders already in `tool/`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.1, §1.2, §3 lane D, §5).

## Global Constraints

- The pipeline's rules in the memory and `web_opt/README.md`: `upload_state.tsv` skips **by name**, so a changed file goes through its own `--root` folder; Supabase refuses `~` in a key; files over about 100 MB go through `tool/upload_tus.py`; `queue()` appends to both `upload_extra.txt` and `upload_order.txt`; check the uploader's "to upload now" line yourself after queueing.
- Build the exporter with `dotnet build -c Release -o bin\<name>` so a running exe is not touched.
- Encode hybrid as the models' maps were: `tool/ktx2_encode.py` with `web_opt/ktx2_color.txt` present (ETC1S colour, UASTC the rest); `--max 2048`.
- Nothing sequel-era is uploaded to the lists this lane makes where the name says so (`S1/`, `S2/`, … , `A3/` paths are left out unless a non-sequel record names them).
- The keys stay in `.secrets\supabase_service_key.txt`; never in a chat.

## Review Focus

1. A variation record whose mesh is **not** in `web_opt/models.jsonl` (an unpacked kind): its maps are left out, or the list doubles; task 1's test counts the list against the packed set.
2. A map named both as `.png` in the manifest and already up as `.ktx2`: `wanted_textures.py` treats either as present (the state has `web/<path>.ktx2` rows), else 6,000 duplicates re-encode.
3. A `SoundWaveAsset` with several `RuntimeVariations` sharing one chunk by offset: each variation is its own WAV, cut by the segment's sample offset and count; task 3's check on a blaster asset with 4 variations writes 4 files of different lengths.
4. A looping sound (`IsLooping` on the patch, `FirstLoopSegmentIndex` on the wave): the jsonl says `loop: true`, and the opus is encoded without a leading silence (ffmpeg `-af atrim=start_sample=…` by the segment).
5. The one encoder failure of 2026-10-10 (`failed=1`): named in the hand-off with its error, not retried blindly.

---

### Task 1: The wanted-texture list

**Files:**
- Create: `tool/wanted_textures.py`, `tool/test_wanted_textures.py` (pytest, on three small fixture records copied under `tool/fixtures/`)
- Read: `web/data/**/*.json`, `web/textures.jsonl`, `web_opt/models.jsonl`, `web_opt/upload_state.tsv`, `web_opt/ktx2_color.txt`

**Interfaces:**
- Produces: `wanted(data_root, textures_jsonl, models_jsonl, upload_state) → [(png_path, cls)]` with `cls ∈ {color, normal, attrib}` by `web_optimize.py`'s rule (`__normal` → normal, `__orm_` → attrib, `srgb` or in `ktx2_color.txt` → color, else attrib); `main()` writes `web_opt/_wanted_list.tsv` and prints the count by top folder.

- [ ] **Step 1: Failing tests**: a fixture `ObjectVariation` naming two `TextureAsset`s whose mesh is packed → both listed; the same with the mesh absent from `models.jsonl` → none; a texture present in the state as `web/<path>.ktx2` → not listed; an `FX/Textures/**` map → listed whatever binds it.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (walk `data/`, regex `"\$asset":\s*"([^"]+)",\s*"\$assetType":\s*"TextureAsset"` on records that contain `ObjectVariation`, `MeshMaterialVariation` or `ShaderParameterVariation`, plus every `FX/Textures/**`, `Addons/*/FX/**`, `Characters/Heads/Texture_Shared/**`, `Characters/Heads/_Shared/**` name in the manifest; map names to files through `textures.jsonl`; subtract the state). **Step 4: Run** → PASS.
- [ ] **Step 5: Run it for real**: `python tool\wanted_textures.py`; expected about 1,400 rows (578 variation, 159 fx, the caps and eyes, and whatever else the rules reach); paste the per-folder count into the hand-off.

### Task 2: Encode, link, queue, upload

- [ ] **Step 1**: `python tool\ktx2_encode.py --list web_opt\_wanted_list.tsv --max 2048 --workers 14 --tmp web_opt\_ktxtmp` (log `logs\wanted_textures.log`); on a failure, note the file and go on (`ktx2_encode.py` returns 1 for one failure; that is not a crash).
- [ ] **Step 2**: hard-link the raw PNGs into `web_opt` beside the KTX2 (as `tool/redo_big.py`/the planet pass did) so the import's `--native` fallback to PNG works for a map the encoder refused.
- [ ] **Step 3**: `queue()` both lists; run `python tool\upload_supabase.py --root web_opt --list web_opt\_wanted_upload.txt --prefix web/` (a de-duplicated list of the KTX2 and PNG paths); read "to upload now: N files"; anything over 100 MB through `upload_tus.py`.
- [ ] **Step 4: Verify from the repo**: `node --env-file=.env.local scripts/bf2017-fx.mjs --count` → 173 effect textures (was 55); `node scripts/bf2017-fetch.mjs --list 'characters/markings/'` lists the 72; `node scripts/bf2017-fetch.mjs characters/heads/_shared/eyes/eyes_mp/texture/t_eye_mp_da` fetches.
- [ ] **Step 5**: `grep FAILED logs\pipeline.log | sort -u` for the 2026-10-10 encoder failure; re-queue it or name it in the hand-off.

### Task 3: `SoundExport.cs`

**Files:**
- Create: `tool/SoundExport.cs`, `tool/audio_encode.py`
- Modify: `tool/bf2export.csproj` (a `Reference Include="SoundEditorPlugin"` with `HintPath $(FrostyDir)\Plugins\SoundEditorPlugin.dll`), `tool/Program.cs` (a `sounds` command: `bf2export sounds [--filter <path prefix>] [--list names.txt] [--out web\audio]`)

**Interfaces:**
- Produces: `web/audio/<SoundWaveAsset path>/v<N>.wav` (16-bit PCM, the chunk's rate and channels) and `web/audio.jsonl` rows `{ name, file, variation, seconds, rate, channels, codec, loop, patches: [names] }`.

- [ ] **Step 1: List the plugin's types** from C# (`typeof(SoundEditorPlugin.<any>).Assembly.GetTypes()` printed with their public methods, once, to `logs\soundplugin_types.txt`): find the class that turns a `SoundWaveAsset`'s chunk bytes and a variation into PCM (in Frosty 1.0.6 it is the sound editor's export path: a `SoundDataTrack` with `Samples`, `SampleRate`, `ChannelCount`, decoded by codec: PCM, EA-XAS, EALayer3). Record the names in the hand-off.
- [ ] **Step 2: The pass**: enumerate `SoundPatchAsset` ebx under `Sound/`, collect `ReferencedData[].SoundData` guids → `SoundWaveAsset` set (expected 4,588); for each, load the ebx, its `Chunks[i].ChunkId` through `Driver.Am.GetChunkEntry` (a missing chunk is a line in `audio_errors.log`, not a stop), each `RuntimeVariations[v]` by `ChunkIndex`, `FirstSegmentIndex`, `SegmentCount` (and the segments' `SamplesOffset`), decode with the plugin's decoder, write WAV; write the jsonl row with `loop` from `FirstLoopSegmentIndex >= 0` and the patch names that reference it, their `Loudness` and `Radius` (the maximum across patches).
- [ ] **Step 3: Try on one**: `bf2export sounds --filter Sound/Weapons/LightSaber` → the saber's wave files; listen to one in the browser (the memory's rule: listen before wiring); then `--filter Sound/Weapons/Blasters/Shared` (the Review Focus 3 asset with four variations).
- [ ] **Step 4: Priority list**: `--list` the waves the 61 names of `src/lib/sound/gameSounds.js` resolve to (the lane writes `web/audio_map.tsv`: `site name<TAB>SoundWaveAsset path`, chosen by reading the patch folders: `Sound/Weapons/LightSaber/**` for `surface.saber:*`, `Sound/Weapons/Blasters/<weapon>/**` for `universe.gunSound:*`, `Sound/Characters/Movement/Footsteps/**` by surface for `surface.step:*`, `Sound/Vehicles/<ship>/Engine/**` for `universe.shipEngine:*`, `Sound/VO/<hero>/**` by the situation words in the names for `line.*`); export those first, then the beasts', walkers' and vehicles' folders the site places, then `--filter Sound/` for everything.

### Task 4: Encode and upload the sound

- [ ] **Step 1**: `python tool\audio_encode.py web\audio --out web_opt\audio` → beside each WAV an `.opus` (libopus, 64 kbit/s, mono where the source is mono, `-application audio`) and an `.mp3` (96 kbit/s, Safari); the jsonl rewritten with both files' bytes; a loop's leading silence trimmed by the first segment's offset.
- [ ] **Step 2**: queue and upload under `web/audio/` with `upload_supabase.py` (its own `--root web_opt\audio` and state); `web/audio.jsonl` and `web/audio_map.tsv` too.
- [ ] **Step 3: Verify from the repo**: `node --env-file=.env.local scripts/bf2017-audio.mjs` → "N of them audio" with N the opus count; one file through `node scripts/bf2017-audio.mjs web/audio/<path>/v0.opus --as saber/ignite.mp3` lands under `public/audio/galaxy/bf2017/`.

### Task 5: The hand-off

- [ ] `docs/superpowers/HANDOFF-bf2017.md`, section "The fourth design", lane D's row: the counts (textures encoded and uploaded by folder; waves exported, encoded, uploaded; the plugin's class names; the encoder failure), the two verification lines above, and the list of §5 re-imports the site lanes can now run. Commit on the repo: `Lane D: the textures the build never queued and the game's sounds are in the bucket`, PR, merge per the slot.
