### Task 1: Before shots on `main`, and the check's base URL

The pictures this lane will change, taken from `main` before any code changes. The lane's copy of `navmap-check.mjs` gains a base URL and two shot-only modes, then is run against a dev server serving `main`.

**Files:**
- Modify: `scripts/navmap-check.mjs:13-16` (the base URL), `:54` and `:170` (the mode dispatch)
- Create: `docs/superpowers/evidence/endless-universe-6a-map/README.md` and `before/*.png`

**Interfaces:**
- Produces:
  - `BASE` env, default `http://localhost:5173`. The URL becomes `${BASE}/?quality=low#/universe`.
  - Modes in `process.argv[2]`: `desktop`, `phone`, `minimap`, `far`, or none for all four. Dispatch is `const run = (m) => !only || only === m`.
  - Shot names: `minimap` writes `11-minimap-flat` and `12-minimap-teaser`; `far` writes `13-far-ship`.

- [ ] **Step 1: Serve `main` from a worktree.** Run `git worktree add ../tp-6a-main origin/main`, then `npm ci` in it, then `npx vite --port 5173` from it in the background.
- [ ] **Step 2: Add `BASE` and the dispatch** to `scripts/navmap-check.mjs`. Replace `only !== 'phone'` and `only !== 'desktop'` with `run('desktop')` and `run('phone')`.
- [ ] **Step 3: Add the `minimap` mode.** It has its own context and does not use `open()`, which waits on `__universe` and would time out with 3D off.
  - The flat map: an init script sets `localStorage['tp-3d'] = 'off'` (raw, not JSON: `src/lib/gpu.js:77`) plus `tp-intro`. Open `#/universe` at 1280 × 800, wait for `.universe-flat .minimap`, and take an element shot `11-minimap-flat`.
  - The teaser: open `#/home`, scroll `.minimap-teaser` into view (the section is lazy, `pages/Home.jsx:30`), wait for it, and take an element shot `12-minimap-teaser`.
- [ ] **Step 4: Add the `far` mode.**
  - Open as the desktop run does (`falcon`).
  - In the page, set `window.__universeDebug.state.ship = { ...s.ship, x: 250000, y: 1000, z: 0, speed: 0 }`.
  - Wait for `window.__universe().ship.x > 200000`, press `m`, wait for `.navmap`, and shoot `13-far-ship`. On `main` the ship marker is missing here, because `NavMap.jsx:193` and `:364` drop it.
- [ ] **Step 5: Take the before shots.** Run `OUT=docs/superpowers/evidence/endless-universe-6a-map/before CHROME=… node scripts/navmap-check.mjs` (all four modes). Expected:
  - The shots `1-navmap`, `2-picked`, `7-home-system`, `8`–`10` (phone), `11`, `12` and `13`.
  - On `main`, the Citadel jump checks fail (HANDOFF "Left": its stale 1755, −4660). Write down which ones fail.
- [ ] **Step 6: Write the evidence README.** It records the date, `main`'s commit, the command, the failing checks on `main`, and an empty "after" column.
- [ ] **Step 7: Commit.**
```bash
git add scripts/navmap-check.mjs docs/superpowers/evidence/endless-universe-6a-map
git commit -m "Nav map check: a base URL, the mini-map and far-ship shots, and the before shots from main"
```

---

