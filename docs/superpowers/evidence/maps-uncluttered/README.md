# The maps, uncluttered

The evidence for the nav map and flat map redesign (`docs/decisions/2026-10-20-maps-show-only-the-names-with-room.md`). Shot in the container under SwiftShader on 2026-10-20, `main` at `eae5a939` on the left of each picture and the branch on the right, with a scratch Playwright script over the dev server (the nav map opened from the HUD's button once the world was up, the Falcon parked where the scene put it, which is somewhere new each run).

| picture | what it shows |
| --- | --- |
| `navmap-desktop.webp` | 1440 × 900, the universe chart: names placed by priority, none over another or a dot; one row of header |
| `navmap-picked.webp` | Avengers HQ picked: the drives with it, beside the button that uses them |
| `navmap-phone.webp` | 390 × 844: the chart's names inside its disc; the search and filters with the list |
| `navmap-phone-picked.webp` | 390 × 844, a place picked: its card and its button on the screen without a scroll |
| `flatmap.webp` | 1280 × 800, 3D off: the stations on their own ring round the sun, every name readable |

## What was checked

- `npm run lint`, `npm test` (1,689 files, 19,075 tests), `npm run build`, `node scripts/health.mjs --check --skip build` (within every budget; `lint-disables` 54 of 54).
- `scripts/navmap-check.mjs`, with a wait for the map's button added in a scratch copy (here the world takes minutes to come up, and the script clicks two seconds after the ship exists). Branch and `main` fail the same four steps, all on the jump to the Citadel at its old place, which `HANDOFF-universe.md` lists as broken on `main`; every label, go-button, trip-time, phone-layout and Escape check passes on both.
- `scripts/autopilot-check.mjs --skip lint,test --routes /universe`: the classic pages pass; `/` and `/universe` say “no canvas: the 3D never started” on `main` and the branch alike (SwiftShader brings the world up after the check stops waiting).
- The nav map's chunk is 19.1 → 23.3 kB (6.6 → 7.9 kB gzipped) and its stylesheet 11.9 → 18.3 kB (3.3 → 4.5 kB gzipped), both loaded only when the map opens; the flat map's chunk 2.6 → 5.3 kB; the declutter is a 1 kB chunk both share.
