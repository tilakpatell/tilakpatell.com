# Lane D3: the manifest out of the client; the landmarks’ maps weighed. Evidence

Design: `docs/superpowers/specs/2026-10-11-frostbite-gaps-design.md` (§1 D3). Plan: `docs/superpowers/plans/2026-10-11-frostbite-laneD3-manifest-landmarks.md`. Measured on 2026-10-11 in the cloud container (Node 22.22, Vite 8.3.2); `_source` on every row.

## The galaxy’s chunk

`npx vite build` on a clean `npm ci`, at `main` (`dc0639b4`, #915 merged) against this branch’s head. The chunk is the one that holds `catalog/index.js` (found by the string `models/galaxy/surface/game/` it carries); it is loaded by the `Galaxy`, `Fly` and `Front` chunks, so every visitor who lands on a Star Wars world downloads it.

| | raw | gzipped | what it held |
| --- | --- | --- | --- |
| before (`echoLayout-CZaiqwKk.js`) | 13.19 MB | 1.30 MB | the whole of `src/data/galaxyAssets.json` (63,460 rows, 15.5 MB), imported by `bf2017-library.js:26` |
| after (`echoLayout-B-b3HJ_8.js`) | 0.05 MB | 0.01 MB | the catalogue and `virtual:bf2017-published`: 84 paths in 5,561 bytes |

`_source`: `ls -S dist/assets/*.js` and `gzip -9` at each head; the audit (`docs/research/2026-10-11-frostbite-gap-audit.md` §5, item 2) measured the before. A row’s hash from the manifest (`5d0d49d971a1`) is found in no chunk after.

## The landmarks’ maps, weighed and left

The design asked for the thirteen `*.ultra.glb` landmarks’ normal and ARM maps as UASTC KTX2. The repository’s own report (`node scripts/ktx2.mjs report`, `report-vaporator.txt` beside this file) on the smallest of them, with 1,024² maps:

| map | WebP | UASTC | GPU as WebP | GPU as KTX2 | PSNR | the tool’s verdict |
| --- | --- | --- | --- | --- | --- | --- |
| colour | 111 KB | 894 KB | 5.3 MB | 1.3 MB | 41.5 dB | keep |
| ARM | 128 KB | 793 KB | 5.3 MB | 1.3 MB | 40.6 dB | keep |
| normal | 41 KB | 365 KB | 5.3 MB | 1.3 MB | 44.5 dB | keep |

The download would be 7.3 times the WebP’s for a quarter of the GPU memory; the research note the tool rests on (`docs/research/2026-10-05-textures-and-asset-quality.md`) draws the line at normal maps that JPEG or lossy WebP wreck, and these hold 44.5 dB. On the two biggest landmarks (`mining`, `theed`, maps to 8,192²) the report did not finish in 500 s in this container. So nothing was converted: the landmarks keep their WebP maps, and the open question is GPU memory at ultra on the laptop (thirteen landmarks whose maps decode to up to 256 MB each at 8,192²), which `scripts/galaxy-budget.mjs` measures there. `models/galaxy` to the bucket stays the desktop’s ask (this session cannot write the bucket).

## The checks

`npm run lint`; `npx vitest run scripts/lib/library-slice.test.mjs src/components/galaxy/surface/catalog` (31 tests; the catalogue’s own tests still read the whole manifest, as a test may); `npm test`; `node scripts/health.mjs --check --skip build`; `npm run coverage:bf2017`; `npm run maps:bf2017`; `npx vite build`.
