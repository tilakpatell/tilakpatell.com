/* global window */
// GPU-first lane N3's steps on the lit fixture, for scripts/light-fixture.mjs
// (docs/superpowers/plans/2026-10-11-gpu-first-laneN3-light.md):
//
//   --baked [on|off]   with --hoth: the ground under the fixture's Enlighten
//                      stand-in (src/runtime/fixtures/enlighten/), or the same
//                      node ground without it (the before); the frame's mean
//                      luminance against lane S's band (BAND)
//   --grid             after lane R's A3 numbers: the budgeted grid (two
//                      cascades round the camera, at lightN3.js's stress
//                      setting so its pairs swap in the run) on a page of its own, 60
//                      frames at a fixed camera, the pixel spread after frame 20
//                      (Review Focus 3: under 1/255), its probes a frame
//   --cadence          with --shadows: the far cascades on their cadence, the
//                      figures running out of the near cascades (WALK), every
//                      frame checked: each figure's shadow darker than the open
//                      snow beside it (Review Focus 4), and the cascades' draws
//
// n3Flags(argv) → { baked, cadence }
// n3Fixture(flags) → the fixture's options
// gridSpread / cadenceRun: the steps, each given the page and the script's helpers

// Lane S's calibration band: lane G's calibrated classic Hoth field (0.3531,
// docs/superpowers/evidence/bf2017-light/) and lane S's own --hoth fixture
// within it (+4.4 %, docs/superpowers/evidence/galaxy-engine/S/README.md);
// the picture-everywhere design holds a world within 10 % of it, and the
// GPU-first design asks a lane that moves the mean more than 3 % to say why
export const BAND = { centre: 0.3531, within: 0.1, explain: 0.03 };
const SPREAD_FROM = 20; // the frame the grid's spread is measured from (the plan's)
const SPREAD_FRAMES = 60;
const SMALL = [400, 225]; // the spread is measured on the shot shrunk to this (a pop is large)
const CADENCE_FRAMES = 90;
const DARKER = 0.9; // a shadow pixel is darker than 0.9 of the open snow's (a lit pixel matches it within a few %)

export function n3Flags(argv) {
  const at = argv.indexOf('--baked');
  const baked = at < 0 ? null : argv[at + 1] !== 'off';
  return { baked, cadence: argv.includes('--cadence') };
}

export const n3Fixture = ({ baked, cadence }) => ({ ...(baked != null ? { baked } : {}), ...(cadence ? { cadence: true, lightSun: true } : {}) });

export const inBand = (lum) => Math.abs(lum / BAND.centre - 1) <= BAND.within;

// 60 frames of the budgeted grid at a fixed camera: the mean, over the
// pixels, of each pixel's standard deviation from frame 20 on (0…255)
export async function gridSpread({ browser, base, fixture, leg, W, H, sharp, OUT, label, writeFileSync, join }) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const out = { leg };
  try {
    await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&fixture=${encodeURIComponent(JSON.stringify({ ...fixture, gridBudget: 'stress' }))}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 240000 });
    const err = await page.evaluate(() => window.__lit.error);
    if (err) throw new Error(err);
    const n = SMALL[0] * SMALL[1] * 3;
    const mean = new Float64Array(n);
    const m2 = new Float64Array(n);
    let k = 0;
    const perFrame = [];
    for (let f = 0; f < SPREAD_FRAMES; f++) {
      await page.evaluate(() => window.__lit.draw(1));
      perFrame.push(await page.evaluate(() => window.__lit.probe.n3.grid()));
      if (f < SPREAD_FROM) continue;
      const png = await page.locator('canvas').screenshot();
      if (f === SPREAD_FRAMES - 1) writeFileSync(join(OUT, `${label}-${leg}-grid.png`), png);
      const px = await sharp(png).removeAlpha().resize(SMALL[0], SMALL[1]).raw().toBuffer();
      k++;
      for (let i = 0; i < n; i++) {
        const d = px[i] - mean[i];
        mean[i] += d / k;
        m2[i] += d * (px[i] - mean[i]);
      }
    }
    let s = 0;
    let worst = 0;
    for (let i = 0; i < n; i++) {
      const sd = Math.sqrt(m2[i] / Math.max(1, k - 1));
      s += sd;
      worst = Math.max(worst, sd);
    }
    out.spread = Number((s / n).toFixed(3));
    out.worst = Number(worst.toFixed(2));
    out.frames = k;
    const last = perFrame[perFrame.length - 1];
    out.probesPerFrame = last?.probesPerFrame ?? null;
    out.ms = last?.ms != null ? Number(last.ms.toFixed(2)) : null;
    out.sweeps = last?.sweeps ?? null;
    out.pass = out.spread < 1;
  } catch (e) {
    out.error = String(e.message ?? e).split('\n')[0];
  }
  await page.close();
  return out;
}

// The figures run out of the near cascades; every frame, each figure on
// screen has its shadow darker than the open snow beside it
export async function cadenceRun({ page, sharp, OUT, label, leg, writeFileSync, join }) {
  const lum = (px, w, [x, y]) => {
    let s = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = ((y + dy) * w + (x + dx)) * 3;
        if (i < 0 || i + 2 >= px.length) continue;
        s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        n++;
      }
    }
    return n ? s / n : null;
  };
  await page.evaluate(() => (window.__lit.probe.n3.look(), window.__lit.draw(4)));
  const before = await page.evaluate(() => window.__lit.probe.n3.draws());
  await page.evaluate(() => window.__lit.probe.n3.walk(true));
  let missed = 0;
  let checked = 0;
  const misses = [];
  for (let f = 0; f < CADENCE_FRAMES; f++) {
    await page.evaluate(() => window.__lit.draw(1));
    const png = await page.locator('canvas').screenshot();
    if (f === 0 || f === CADENCE_FRAMES - 1) writeFileSync(join(OUT, `${label}-${leg}-run${f}.png`), png);
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const feet = await page.evaluate(([w, h]) => window.__lit.probe.n3.feet(w, h), [info.width, info.height]);
    for (const ft of feet) {
      const ok = (p) => p[2] && p[0] > 1 && p[1] > 1 && p[0] < info.width - 2 && p[1] < info.height - 2;
      if (!ok(ft.shadow) || !ok(ft.open)) continue;
      checked++;
      const a = lum(data, info.width, ft.shadow);
      const b = lum(data, info.width, ft.open);
      if (!(a < b * DARKER)) {
        missed++;
        if (misses.length < 5) misses.push({ frame: f, z: Number(ft.z.toFixed(1)), shadow: Math.round(a), open: Math.round(b) });
      }
    }
  }
  const after = await page.evaluate(() => window.__lit.probe.n3.draws());
  await page.evaluate(() => window.__lit.probe.n3.walk(false));
  const draws = after.map((v, i) => v - (before?.[i] ?? 0));
  return { frames: CADENCE_FRAMES, checked, missed, misses, draws, pass: checked > 0 && missed === 0 };
}
