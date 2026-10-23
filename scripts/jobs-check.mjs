/* global window, document */
// A browser check of free roam's jobs on the galaxy's worlds (surface/jobs.js,
// jobPlay.js) and of your feet on the ground there. With the dev server up
// (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/jobs-check.mjs [world ...]   (JOB=race: the job to take, else a bounty;
//   BASE=http://127.0.0.1:5173 for a server on that address)
// For each world it lands in free roam, waits till you're walking, and
// checks you stand on the ground at the ship; opens the board with J (it
// opens at the jobs, under the world's quests) and reads its three; takes a
// job, finishes it a step at a time through the scene's dev hook, and checks
// it's paid and a new board comes up; then puts you 200 m out and checks
// you stand on the ground there, sampled over a few seconds. Headless
// Chromium draws in software, slowly: a world takes minutes to come down.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const worlds = process.argv.slice(2).length ? process.argv.slice(2) : ['lothal'];
const want = process.env.JOB ?? 'bounty';
const base = process.env.BASE ?? 'http://localhost:5173';
const ON = 0.15; // m: as near the ground as standing on it is
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};

for (const world of worlds) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', '"falcon"');
    window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
    // (the 3D without the gate's asking, and in software: scripts/galaxy-check.mjs's)
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.localStorage.setItem('tp-software', JSON.stringify('on'));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?quality=low&calibrate=off&software=on#/galaxy/${world}/surface?mode=free`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Play anyway/ }).click({ timeout: 60000 }).catch(() => {});
  const walking = await page
    .waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase === 'walk', null, { timeout: 1500000, polling: 1000 })
    .then(() => true, () => false);
  check(walking, `${world}: down and walking`);
  if (!walking) {
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(4000);
  const ground = () =>
    page.evaluate(() => {
      const d = window.__surfaceDo('debug');
      return +(d.you.y - window.__surfaceScene.heightAt(d.you.x, d.you.z)).toFixed(2);
    });
  const atShip = await ground();
  check(Math.abs(atShip) <= ON, `${world}: on the ground at the ship (${atShip} m)`);

  // the board: J opens the list at it
  await page.locator('canvas').first().focus().catch(() => {});
  await page.keyboard.press('j');
  await page.waitForTimeout(800);
  const board = await page.evaluate(() => {
    const box = document.querySelector('.surface-list');
    const head = [...(box?.querySelectorAll('.surface-list-title') ?? [])].at(-1);
    const a = box?.getBoundingClientRect();
    const b = head?.getBoundingClientRect();
    return { jobs: [...(box?.querySelectorAll('li[data-job]') ?? [])].map((li) => ({ job: li.dataset.job, name: li.querySelector('b')?.textContent })), inView: Boolean(a && b && b.top >= a.top - 1 && b.bottom <= a.bottom + 1) };
  });
  check(board.jobs.length === 3 && new Set(board.jobs.map((j) => j.job)).size === 3, `${world}: a board of three jobs of three kinds (${board.jobs.map((j) => j.name).join(', ')})`);
  check(board.inView, `${world}: J opens the list at the jobs`);
  await page.screenshot({ path: `${out}/jobs-${world}-board.png` });

  // a job taken, finished a step at a time, paid, and a new board
  const pick = board.jobs.find((j) => j.job === want) ?? board.jobs.find((j) => j.job === 'bounty') ?? board.jobs[0];
  if (pick) {
    await page.locator(`.surface-list li[data-job="${pick.job}"] button`).click();
    await page.waitForTimeout(3000);
    const taken = await page.evaluate(() => window.__surfaceDo('debug').quest?.id ?? null);
    check(Boolean(taken?.startsWith('job:')), `${world}: ${pick.name} taken (${taken})`);
    // (each step skipped once: a shoot step's targets go down at once, but each
    // counts a kill only 0.3 s of the game's own time later, which in software
    // on a full world is many seconds of ours)
    let skipped = null;
    for (const until = Date.now() + 180000; Date.now() < until; ) {
      const q = await page.evaluate(() => window.__surfaceDo('debug').quest);
      if (!q) break;
      if (skipped !== q.step) {
        await page.evaluate(() => window.__surfaceDo('missionDo', 'skip'));
        skipped = q.step;
      }
      await page.waitForTimeout(2500);
    }
    const toast = await page.evaluate(() => document.querySelector('.surface-toast, [class*="toast"]')?.textContent ?? '');
    check(/credits/.test(toast), `${world}: paid (${toast.trim()})`);
    await page.keyboard.press('j');
    await page.waitForTimeout(800);
    const next = await page.evaluate(() => [...document.querySelectorAll('.surface-list li[data-job]')].map((li) => li.querySelector('b')?.textContent));
    check(next.length === 3, `${world}: a new board (${next.join(', ')})`);
    await page.keyboard.press('Escape');
  }

  // 200 m out, on the ground there too
  const far = await page.evaluate(() => {
    const d = window.__surfaceDo('debug');
    return [Math.round(d.you.x + 140), Math.round(d.you.z + 140)];
  });
  await page.evaluate(([x, z]) => window.__surfaceDo('teleport', x, z), far);
  const samples = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(2500);
    samples.push(await ground());
  }
  check(samples.slice(1).every((s) => Math.abs(s) <= ON), `${world}: on the ground 200 m out (${samples.join(', ')} m)`);
  await page.screenshot({ path: `${out}/jobs-${world}-far.png` });
  check(!errors.length, `${world}: no page errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nALL OK');
process.exit(problems.length ? 1 : 0);
