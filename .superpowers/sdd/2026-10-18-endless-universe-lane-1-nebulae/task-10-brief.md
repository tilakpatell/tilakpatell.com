### Task 10: The poses and the browser measure

**Files:**
- Modify: `src/components/universe/poses.js` (two poses and a `nebula` branch in `poseFor`)
- Modify: `src/components/universe/poses.test.js` (the name list at `:15` grows by two, plus two tests)
- Modify: `scripts/universe-check.mjs:29` (`'in-nebula'` appended to `POSES`)
- Create: `scripts/lib/nebula-measure.mjs`
- Create: `scripts/lib/nebula-measure.test.mjs`
- Create: `scripts/nebula-check.mjs`

**Interfaces:**
- Consumes: `NEBULAE` and `insideOf`; the dev hooks as they are (`window.__universe().pose`, `.frames`; `__universeDebug.{ scene, camera, state, post, THREE }`). The page's dev hooks in `scene.js` are not touched.
- Produces:
  - **Poses:**
    - `'in-nebula': { nebula: 'cradle', inside: 0.45, back: 1.6, rise: 0.3 }`: 0.45 of its radius in from its middle on the home side, facing its heart.
    - `'veil-side': { nebula: 'veil', out: 20000, aside: 0.105, back: 1.6, rise: 0.3 }`: on the home side, looking `aside` of it the way the Maw pose does (`poses.js:107-113`), so the Veil sits about 6° right of the middle.
  - **In `nebula-measure.mjs`:**
    - `diffMask({ on, off, width, height }, threshold = 12) → Uint8Array`: luminance differences of RGBA buffers.
    - `centroid(mask, width) → { x, y, n }`
    - `bestRotation(a, b, { width, height, about: [x, y], radius, range = 60, step = 1 }) → degrees`: the angle that best turns luminance image `a` about `about` into `b`, inside `radius`.
  - **`nebula-check.mjs --url <dev server> [--quality high] [--out lab/universe/nebula-check.json]`:**
    - It opens `/universe` as `universe-check.mjs:156-181` does: the same storage keys and the same two waits. A dev server is required (`npx vite`), so it carries no server code.
    - Exit 1 on a failed measure or a console error.

**What `nebula-check.mjs` does:**
1. **Pose A.**
   - Hold `'veil-side'` with the grain off.
   - Shoot with `scene.getObjectByName('nebulae').visible` true, then false.
   - Project `scene.getObjectByName('deep-veil')` through the camera to pixels.
2. **Parallax.**
   - Add `5000 ×` the view's right vector (`(1, 0, 0)` turned by `state.held.view.quat`) to `state.held.view.target`, wait two frames, and shoot both again.
   - **Measured:** the centroid shift of `diffMask(on, off)` between A and B.
   - **Predicted:** the projected shift.
   - **Pass:** the predicted shift is at least 100 px, and the measured one is within `max(8 px, 10 %)` of it.
3. **Roll.**
   - Hold `'veil-side'` again and turn `state.held.view.quat` 30° about its own z.
   - **The cloud:** `bestRotation` of the cloud's difference image about its centroid, A against rolled.
   - **The stars:** the same on the clouds-off shots about the screen's middle.
   - **Pass:** the stars turn 30 ± 3°, and the cloud turns within 3° of the stars. On `main` the landmark's texture didn't turn.
4. **Inside.**
   - Hold `'in-nebula'` and shoot on and off.
   - **Pass:** the difference covers at least 60 % of the frame.
5. **Report.** Write the JSON, listing the shifts, the angles and the share.

- [ ] **Step 1: Write the failing tests.**

```js
// nebula-measure.test.mjs, on synthetic images (no browser)
const W = 200, H = 120;
const img = (f) => { const d = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y); d.set([v, v, v, 255], (y * W + x) * 4); } return d; };
const blob = (cx, cy) => img((x, y) => 255 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 50));
const ell = (deg) => { const a = (deg * Math.PI) / 180; return img((x, y) => { const u = (x - 100) * Math.cos(a) + (y - 60) * Math.sin(a), v = -(x - 100) * Math.sin(a) + (y - 60) * Math.cos(a); return (u > -20 && u < 30 && Math.abs(v) < 4) || (v > -20 && v < 4 && Math.abs(u + 16) < 4) ? 255 : 0; }); };
const black = img(() => 0);
it('finds a blob and how far it moved', () => {
  const a = centroid(diffMask({ on: blob(60, 50), off: black, width: W, height: H }), W);
  const b = centroid(diffMask({ on: blob(100, 50), off: black, width: W, height: H }), W);
  expect(b.x - a.x).toBeCloseTo(40, 0);
});
it('says nothing, not NaN, of an empty frame', () => {
  expect(centroid(diffMask({ on: black, off: black, width: W, height: H }), W)).toEqual({ x: 0, y: 0, n: 0 });
});
it('finds how far a shape turned, and that a shape that didn’t turn didn’t', () => {
  expect(Math.abs(bestRotation(ell(0), ell(30), { width: W, height: H, about: [100, 60], radius: 50 }) - 30)).toBeLessThanOrEqual(1);
  expect(bestRotation(ell(0), ell(0), { width: W, height: H, about: [100, 60], radius: 50 })).toBe(0);
});
// poses.test.js
it('puts in-nebula inside the Cradle’s gas, the eye too', () => {
  const p = poseFor('in-nebula');
  const cradle = NEBULAE.find((d) => d.id === 'cradle');
  expect(insideOf([cradle], p.at).depth).toBeGreaterThan(0.5);
  expect(insideOf([cradle], p.eye)).not.toBeNull();
});
it('puts veil-side 20,000 off, the Veil right of the middle, still in view 5,000 to the right', () => {
  const p = poseFor('veil-side');
  const veil = WONDERS.find((w) => w.id === 'veil').at;
  const view = norm(sub(p.look, p.eye));
  const off = Math.acos(dot(view, norm(sub(veil, p.eye))));
  expect(off).toBeGreaterThan(0.08); expect(off).toBeLessThan(0.13);
  const right = norm([-view[2], 0, view[0]]);
  const moved = p.eye.map((v, i) => v + right[i] * 5000);
  expect(Math.acos(dot(view, norm(sub(veil, moved))))).toBeLessThan(0.45); // (inside the lens's half-width at 16:9)
});
```

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run scripts/lib/nebula-measure.test.mjs src/components/universe/poses.test.js`. Expected: FAIL (the module is missing; the poses are unknown).
- [ ] **Step 3: Implement** the poses, the measure module and `nebula-check.mjs` as above. `bestRotation` samples bilinearly and scores by mean absolute difference inside the radius.
- [ ] **Step 4: Run and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Run the check.** Run `npx vite --port 5173` in one shell and `node scripts/nebula-check.mjs --url http://127.0.0.1:5173` in another. Expected: three `ok` lines (parallax, roll, inside) and exit 0. If a measure fails, the fault is in Tasks 4–5, not the threshold: no threshold moves to pass.
- [ ] **Step 6: The whole-route check.** If `scripts/universe-endless-check.mjs` is on `main`, add its nebula step: fly into the Cradle and run the three measures through `scripts/lib/nebula-measure.mjs`. If it isn't, Task 11's hand-off says so for whichever lane merges second.
- [ ] **Step 7: Commit.** `git add src/components/universe/poses.js src/components/universe/poses.test.js scripts/universe-check.mjs scripts/lib/nebula-measure.mjs scripts/lib/nebula-measure.test.mjs scripts/nebula-check.mjs` then `git commit -m "Nebulae: an inside pose, and a browser measure of parallax, roll and fog"`.

---

