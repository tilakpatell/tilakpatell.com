# Lane W: the desktop. The owner’s GPU as the build, bake and gate machine, through the self-hosted runner

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§7). Branch `claude/bf2017-w-desktop` from `origin/main`. One PR. The rules: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`, `.claude/skills/desktop-jobs/SKILL.md`.

Read first: `scripts/desktop/README.md`, `.github/workflows/{desktop-doctor,gen3d,voices,motion}.yml` (the shape of a desktop job: dispatch or a labelled issue, `[self-hosted, gpu]`, PowerShell steps, the summary, the PR it opens), `scripts/desktop/{lib,jobs,doctor,ask,status}.mjs`, `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (Q5), the hand-off’s desktop rows (`HANDOFF-bf2017.md`: the exporter’s tools `tool/bf2export.csproj`, `ktx2_encode.py`, `upload_supabase.py`, `maps_work/shaderdepots.jsonl`, which live on the desktop, not in this repo), `scripts/galaxy-budget.mjs` (the 16.7 ms p95 ultra gate), `docs/superpowers/evidence/bf2017-streaming/laptop-ultra*.json` (how the laptop runs were recorded).

This lane writes what the desktop runs; it cannot run it (no GPU, no exporter in the cloud). Every job is written so a dry run in the cloud (`--dry`) proves its plumbing, and the owner’s first run proves the rest. The bucket keys on the desktop are the runner’s `.env`, never the repo’s.

## Tasks

1. **The workflow.** `.github/workflows/bf2017-desktop.yml`: `workflow_dispatch` with an input `job` (one of `panoramas`, `atlases`, `textures`, `uastc`, `depots`, `gate`, `all`) and the usual `name`; `runs-on: [self-hosted, gpu]`; sparse checkout; each job a PowerShell step calling `node scripts/desktop/bf2017-<job>.mjs`; the summary; the PR as gen3d opens one (same credentials path). If the environment refuses to write a workflow file, write it under `docs/superpowers/evidence/bf2017-picture/w/bf2017-desktop.yml` with a note for the owner to move it.
2. **`panoramas`.** The 8 sky panoramas and their fog gradients re-encoded HDR: the export’s BC6U → RGBA16F KTX2 (UASTC HDR where `ktx2_encode.py` supports it, else `.hdr` → `RGBA16F` through `toktx`), 4,096 × 1,024 for ultra and 2,048 × 512 for high, uploaded to `bf2017-assets` under their names, then published by hash; `scripts/bf2017-picture.mjs` reads the HDR copy when present (`grade.js:34-37`’s clamp noted).
3. **`atlases`.** The 200 Enlighten atlases uploaded (`upload_supabase.py`’s path, the coverage ledger’s rows for them owned by Q3); a short note of their format for lane Q3.
4. **`textures`.** The 4,149 not-uploaded textures (`web/textures.jsonl` rows the coverage ledger marks `not-uploaded`) encoded and uploaded.
5. **`uastc`.** Q5: the ultra colour row re-encoded UASTC q4 at 2,048 for the packs’ colour maps, measured (PSNR against the BC7 master) and published as `tex/<slug>.2048.uastc.ktx2`, the packs’ `tex` rows gaining the ultra path.
6. **`depots`.** The depot probe `maps_work/shaderdepots.jsonl` run through `scripts/bf2017-shader-names.mjs --depots`, the resolved share written into `shaderParams.json`.
7. **`gate`.** Every Star Wars world at ultra on the desktop (`galaxy-check.mjs` with the real GPU, ANGLE d3d11 and WebGPU legs), p50 and p95 ms, calls, triangles, MB, shots, into `docs/superpowers/evidence/bf2017-picture/gate/`; red when any world is over 16.7 ms p95.
8. **Doctor.** `scripts/desktop/doctor.mjs` checks what these jobs need (the exporter’s tools, toktx, ffmpeg, the bucket keys, Chrome with WebGPU).
9. **Docs.** `scripts/desktop/README.md` and the desktop-jobs skill gain the jobs; the hand-off’s desktop row says what each job does and how the owner runs it.
10. Merge `origin/main`, the full checks, the PR.
