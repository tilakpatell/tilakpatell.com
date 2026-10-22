// Every beat the Road frames for itself, looked at as a visitor comes to
// it: one page, the ride put a few metres short of each written beat whose
// shot is its own (not the follow behind the walkers: a placed shot, a
// crane, the low one, the side) and the walk let go, so the beat is walked
// into and plays (put on its mark, a jump counts it long done). The world's
// time is sped up meanwhile (a software frame is seconds, and the runtime
// steps no more than 50 ms of it a frame) and stopped at the beat's moment:
// where its deed waits, the top of a crane's rise, a few seconds into the
// rest, the camera settled. Then the company's figures in (they load slowly
// here) and the frame kept, measured as light-survey.mjs measures (its
// luma's mean, 5th, 50th and 95th percentiles, the share clipped and
// crushed) over the world's picture. Contact sheets of them, sixteen a
// sheet, each named for its stage and beat.
//   node lab/road/beat-tour.mjs out [stage | stage:beat …]   (WAIT=s a beat at most, 150; RIGS=all for the follow's too;
//   TRY='{"stage:beat": { rig, params }}' tries a beat on another shot, in the page, the source untouched;
//   AT='{"stage:beat": seconds}' looks at a beat that many seconds in)
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { browser, open, STAGE_IDS } from './common.mjs';

const sharp = createRequire(import.meta.url)('sharp');
process.env.VIEW ??= '960x600';
const out = process.argv[2] ?? '/tmp/beats';
const asked = process.argv.slice(3);
const ids = asked.length ? [...new Set(asked.map((a) => a.split(':')[0]))] : STAGE_IDS;
const only = asked.filter((a) => a.includes(':'));
const TRY = JSON.parse(process.env.TRY ?? '{}');
const AT = JSON.parse(process.env.AT ?? '{}');
const WAIT = Number(process.env.WAIT ?? 150) * 1000;
// (every figure public/models/middleearth/cast has: the company's and a stage's own, the dancers, the guests)
const CAST = readdirSync(new URL('../../public/models/middleearth/cast/', import.meta.url)).filter((f) => /^[a-z]+\.glb$/.test(f)).map((f) => f.slice(0, -4));
const ALL = process.env.RIGS === 'all';
mkdirSync(out, { recursive: true });

const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${ids[0]}:10`);
await page.waitForTimeout(20000);
const beats = await page.evaluate(
  async ([ids, ALL, only, TRY, AT]) => {
    const { BEATS_OF } = await import('/src/components/middleearth/road/stages/registry.js');
    // (the same module the Road reads its beats from: a shot tried here is the one it frames)
    for (const [key, shot] of Object.entries(TRY)) {
      const [id, beat] = key.split(':');
      const b = BEATS_OF[id]?.find((x) => x.id === beat);
      if (b) Object.assign(b, shot);
    }
    // (its moment: the deed's wait; a crane's top, or its hold's end; a few seconds into a held shot,
    // or out of its black; 2.5 s walking through the rest)
    // (a black that outlasts the hold: just before it falls, or at the hold's end if the beat opens in it)
    const black = (b) => (b.fx ?? []).find((f) => f.kind === 'black');
    const held = (b, k = black(b)) => (k && k.at + k.seconds >= b.hold - 0.3 ? (k.at > 1 ? k.at - 0.4 : b.hold - 0.3) : Math.min(b.hold - 0.3, Math.max(3, k ? k.at + k.seconds : 0)));
    const moment = (b) => (b.deed ? (b.deed.at ?? 0) : b.rig === 'crane' ? Math.min(b.params?.seconds ?? 8, b.hold ? b.hold - 0.3 : Infinity) : b.hold ? held(b) : 2.5);
    return ids.flatMap((id) =>
      (BEATS_OF[id] ?? [])
        .filter((b) => (only.length ? only.includes(`${id}:${b.id}`) : ALL || (b.rig && b.rig !== 'follow')))
        .map((b) => ({ id, beat: b.id, at: b.at, rig: b.rig, moment: AT[`${id}:${b.id}`] ?? moment(b), deed: Boolean(b.deed) })),
    );
  },
  [ids, ALL, only, TRY, AT],
);
console.log('beats', beats.length);

const measure = async (png) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const lum = [];
  for (let y = Math.round(h * 0.13); y < Math.round(h * 0.8); y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      lum.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    }
  const n = lum.length;
  const sorted = Float32Array.from(lum).sort();
  const pct = (p) => Math.round(sorted[Math.floor(p * (n - 1))]);
  return { mean: Math.round(lum.reduce((a, v) => a + v, 0) / n), p5: pct(0.05), p50: pct(0.5), p95: pct(0.95), clip: +((lum.filter((v) => v >= 250).length / n) * 100).toFixed(1), crush: +((lum.filter((v) => v <= 6).length / n) * 100).toFixed(1) };
};

const rows = [];
const frames = [];
for (const t of beats) {
  await page.evaluate(
    async ([id, m]) => {
      const { sOf } = await import('/src/components/middleearth/road/line.js');
      const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
      window.__ROAD__.fast(1);
      window.__ROAD__.world.setAuto(false);
      window.__ROAD__.world.set(sOf(STAGES, id, m));
    },
    [t.id, Math.max(0, t.at - 3)],
  );
  // (the stage in and its walkers' figures with it, then walked into the beat, the world five times as fast: a quarter second of it a frame)
  let until = Date.now() + WAIT;
  const bare = () =>
    page.evaluate((names) => {
      let n = 0;
      window.__ROAD__.world.scene.traverseVisible((o) => {
        if (o.children.length === 0 && o.name.startsWith('road:') && names.includes(o.name.slice(5))) n++;
      });
      return n;
    }, CAST);
  while ((await bare()) && Date.now() < until) await page.waitForTimeout(1500);
  until = Date.now() + WAIT;
  await page.evaluate(() => {
    window.__ROAD__.fast(5);
    window.__ROAD__.world.setAuto(true);
  });
  let last = null;
  let since = null;
  for (;;) {
    await page.waitForTimeout(700);
    const i = await page.evaluate((beat) => ({ since: window.__ROAD__.info().since?.[beat] ?? null, camera: window.__ROAD__.info().camera }), t.beat);
    since = i.since;
    // (a deed waits on its moment, the camera still easing in from the follow: till it stands too)
    const still = last && i.camera.every((v, k) => Math.abs(v - last[k]) < 0.02);
    last = i.camera;
    if ((since != null && since >= t.moment && (!t.deed || still)) || Date.now() > until) break;
  }
  await page.evaluate(() => window.__ROAD__.fast(0));
  while ((await bare()) && Date.now() < until) await page.waitForTimeout(1500);
  await page.waitForTimeout(3000);
  const png = await page.screenshot({ timeout: 300000 });
  const name = `${t.id}-${t.beat}`;
  await sharp(png).webp({ quality: 78 }).toFile(`${out}/${name}.webp`);
  frames.push({ name: `${name} (${t.rig})`, png });
  const { shot, boom } = await page.evaluate(() => window.__ROAD__.info());
  const row = { ...t, since: since == null ? null : +since.toFixed(1), shot, boom: +(boom ?? 1).toFixed(2), ...(await measure(png)) };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(`${out}/beats.json`, JSON.stringify(rows, null, 1));

const W = 480;
const H = 300;
for (let s = 0; s * 16 < frames.length; s++) {
  const some = frames.slice(s * 16, s * 16 + 16);
  const tiles = await Promise.all(
    some.map(async ({ name, png }, i) => {
      const label = Buffer.from(`<svg width="${W}" height="22"><rect width="${W}" height="22" fill="black" opacity="0.6"/><text x="6" y="16" font-size="15" font-family="sans-serif" fill="white">${name}</text></svg>`);
      const tile = await sharp(png).resize(W, H).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
      return { input: tile, left: (i % 4) * W, top: Math.floor(i / 4) * H };
    }),
  );
  await sharp({ create: { width: W * 4, height: H * Math.ceil(some.length / 4), channels: 3, background: '#000' } }).composite(tiles).webp({ quality: 80 }).toFile(`${out}/sheet-${s + 1}.webp`);
}
console.log('errors', errors.slice(0, 3));
await b.close();
