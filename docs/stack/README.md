# The stack

One page per library, engine or framework the site is built on, and this index of every package in `package.json`: its version, the page it belongs to, and how many files under `src/` and `scripts/` import it (tests left out). To add a dependency, give it a row in `PAGES` in `scripts/stack-census.mjs` and a page made from `_template.md`, then run `node scripts/stack-census.mjs --write`; the measure’s `stack-pages` fails until the package has a row here.

`three/webgpu` and `three/tsl` ship inside `three` and so have no row; their page is [webgpu-tsl.md](webgpu-tsl.md).

<!-- census:start -->
| package | version | page | files |
| --- | --- | --- | --- |
| `three` | ^0.186.1 | [three.md](three.md) | 552 |
| `react` | ^19.3.0 | [react.md](react.md) | 282 |
| `react-router-dom` | ^7.18.4 | [react.md](react.md) | 80 |
| `sharp` | ^0.35.5 | [assets-pipeline.md](assets-pipeline.md) | 74 |
| `react-icons` | ^5.7.0 | [react.md](react.md) | 71 |
| `playwright-core` | ^1.56.0 | [testing.md](testing.md) | 58 |
| `@gltf-transform/core` | ^4.5.1 | [assets-pipeline.md](assets-pipeline.md) | 52 |
| `meshoptimizer` | ^1.3.0 | [assets-pipeline.md](assets-pipeline.md) | 50 |
| `@gltf-transform/extensions` | ^4.5.1 | [assets-pipeline.md](assets-pipeline.md) | 49 |
| `@gltf-transform/functions` | ^4.5.1 | [assets-pipeline.md](assets-pipeline.md) | 44 |
| `react-dom` | ^19.3.0 | [react.md](react.md) | 24 |
| `vite` | ^8.3.2 | [build.md](build.md) | 12 |
| `@fontsource/luckiest-guy` | ^5.3.0 | [fonts.md](fonts.md) | 6 |
| `@fontsource/cinzel` | ^5.3.0 | [fonts.md](fonts.md) | 5 |
| `@fontsource/press-start-2p` | ^5.3.0 | [fonts.md](fonts.md) | 4 |
| `@fontsource/bebas-neue` | ^5.3.0 | [fonts.md](fonts.md) | 2 |
| `@fontsource/courier-prime` | ^5.3.0 | [fonts.md](fonts.md) | 2 |
| `@fontsource/orbitron` | ^5.3.0 | [fonts.md](fonts.md) | 2 |
| `@noble/secp256k1` | ^3.2.0 | [multiplayer-nostr.md](multiplayer-nostr.md) | 2 |
| `fflate` | ^0.8.3 | [assets-pipeline.md](assets-pipeline.md) | 2 |
| `@dimforge/rapier3d-compat` | 0.21.0 | [physics-rapier.md](physics-rapier.md) | 1 |
| `@fontsource-variable/archivo` | ^5.3.0 | [fonts.md](fonts.md) | 1 |
| `@fontsource/cinzel-decorative` | ^5.3.0 | [fonts.md](fonts.md) | 1 |
| `@fontsource/jetbrains-mono` | ^5.3.0 | [fonts.md](fonts.md) | 1 |
| `@fontsource/news-cycle` | ^5.3.0 | [fonts.md](fonts.md) | 1 |
| `@fontsource/yatra-one` | ^5.3.0 | [fonts.md](fonts.md) | 1 |
| `d3-geo` | ^3.1.1 | [assets-pipeline.md](assets-pipeline.md) | 1 |
| `topojson-client` | ^3.1.0 | [assets-pipeline.md](assets-pipeline.md) | 1 |
| `watlas` | ^1.0.1 | [assets-pipeline.md](assets-pipeline.md) | 1 |
| `@eslint/js` | ^9.39.5 | [build.md](build.md) | 0 |
| `@fontsource/noto-sans-runic` | ^5.3.0 | [fonts.md](fonts.md) | 0 |
| `@supabase/supabase-js` | ^2.117.3 | [supabase.md](supabase.md) | 0 |
| `@types/react` | ^19.3.0 | [react.md](react.md) | 0 |
| `@types/react-dom` | ^19.3.0 | [react.md](react.md) | 0 |
| `@vitejs/plugin-react` | ^6.1.2 | [build.md](build.md) | 0 |
| `autoprefixer` | ^10.4.20 | [build.md](build.md) | 0 |
| `basisu` | ^1.16.3 | [assets-pipeline.md](assets-pipeline.md) | 0 |
| `eslint` | ^9.39.5 | [build.md](build.md) | 0 |
| `eslint-plugin-react` | ^7.37.5 | [build.md](build.md) | 0 |
| `eslint-plugin-react-hooks` | ^5.2.0 | [build.md](build.md) | 0 |
| `eslint-plugin-react-refresh` | ^0.4.26 | [build.md](build.md) | 0 |
| `fake-indexeddb` | ^6.2.5 | [testing.md](testing.md) | 0 |
| `gh-pages` | ^6.3.0 | [build.md](build.md) | 0 |
| `globals` | ^16.5.0 | [build.md](build.md) | 0 |
| `postcss` | ^8.5.2 | [build.md](build.md) | 0 |
| `tailwindcss` | ^3.4.17 | [build.md](build.md) | 0 |
| `vitest` | ^5.0.3 | [testing.md](testing.md) | 0 |
| `world-atlas` | ^2.0.2 | [assets-pipeline.md](assets-pipeline.md) | 0 |
| `yaml` | ^2.8.3 | [testing.md](testing.md) | 0 |
<!-- census:end -->

The table between the markers is written by `scripts/stack-census.mjs`; don’t edit it by hand. A package with no importing file here is still used: the test runner (tests are left out of the count), a command-line tool, a font read from CSS, a set of types, or a plugin a root config file loads.
