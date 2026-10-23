/* global window, document */
// The browser check's helpers (../rm-story-check.mjs): where the dev server
// is, where shots go, the browser to drive, and the steps every scenario
// takes through C-137's dev hooks (window.__C137__, window.__RMSTORY__):
// Morty sent somewhere and stood till it's built, E at a hotspot, the
// objective read, a toast waited for, an episode's card checked, the story
// played to an episode's start, a catch seen through, Morty stood on a
// ledge, time waited out on the game's own clock; and where a place
// through the portal has its way in, its portal home and its spots, read
// from its data (./places.mjs). Kept apart from the scenarios so no file
// passes 800 lines.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EPISODES } from '../../src/components/rickmorty/adventure/episodes.js';
import { home, loadPlaces, stand, wayIn } from './places.mjs';

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5197';
export const OUT = process.env.OUT ?? null;
export const N = Math.PI / 2;

// the places through the portal, as their data has them: Morty stood `off`
// back from a spot facing it; where he comes in (and a catch puts him back);
// in front of the portal home, facing it
export const PLACES = await loadPlaces(fileURLToPath(new URL('../..', import.meta.url)));
export const spotAt = (area, id, face = N, off) => stand(PLACES.spot(area, id), face, off);
export const arriveOf = (area) => {
  const a = PLACES.dest(area).arrive;
  return [a.x, a.z, a.face];
};
export const wayInOf = (area) => wayIn(PLACES.dest(area));
export const homeOf = (area) => home(PLACES.dest(area));

export const exe = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));

export const check = (ok, what) => {
  if (!ok) throw new Error(what);
};
export const done = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]'));

// C-137 loaded and its world built
export async function c137(page, hash = '#/c-137') {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await built(page);
}
export async function built(page) {
  await page.waitForFunction(() => window.__C137__?.goto || document.querySelector('.rm-world')?.dataset.mode === 'cards', null, { timeout: 600000, polling: 1000 });
  check(await page.evaluate(() => Boolean(window.__C137__?.goto)), 'the 3D world didn’t start');
  await page.evaluate(() => document.querySelector('.rm-world')?.scrollIntoView({ block: 'start' }));
  await page.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
}
// Morty sent somewhere, as a door sends him, and stood till it's built
export async function goto(page, area, x, z, face = N) {
  check(await page.evaluate(([a, x, z, f]) => window.__C137__.goto(a, x, z, f), [area, x, z, face]), `Morty wouldn’t go to ${area}`);
  await page.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
}
// E at a hotspot, once he's by it
export async function use(page, id) {
  await page.waitForFunction((id) => window.__C137__.sim.near?.id === id, id, { timeout: 20000, polling: 100 }).catch(async () => {
    const at = await page.evaluate(() => ({ x: window.__C137__.sim.m.x, z: window.__C137__.sim.m.z, near: window.__C137__.sim.near?.id ?? null }));
    throw new Error(`Morty isn’t by ${id} (he’s at ${at.x.toFixed(2)}, ${at.z.toFixed(2)}, by ${at.near})`);
  });
  await page.evaluate(() => window.__C137__.act());
}
export const place = (page, id) => page.locator(`.rm-place[data-place="${id}"]`);
export const story = (page) => page.evaluate(() => window.__RMSTORY__.get());
// the objective line reads `text` (it's the story's, or the checklist's)
export async function reads(page, text) {
  await page.waitForFunction((t) => document.querySelector('.rm-hud .rm-objective')?.textContent.trim() === t, text, { timeout: 10000 }).catch(async () => {
    throw new Error(`the objective reads “${await page.locator('.rm-hud .rm-objective').first().textContent()}”, not “${text}”`);
  });
}
export const WIPED = EPISODES[0];
export const ARCADE = EPISODES[1];
export const GUESTS = EPISODES[2];
export const SMALL = EPISODES[3];
export const HEAT = EPISODES[4];
export const DEALS = EPISODES[5];
export const JERRY = EPISODES[6];
export const PRIME = EPISODES[7];
export const FAIRY = EPISODES[8];
// Morty by the garage portal, stepped through it, and stood where it took him
export async function throughPortal(page) {
  await goto(page, 'garage', -302.3, 101.4, Math.PI);
  await use(page, 'garage-portal');
}
export const gun = async (page) => {
  await page.getByRole('button', { name: /Portal gun/ }).first().click();
  await page.locator('.rm-dial-box').waitFor({ timeout: 10000 });
};
export const toast = (page, text) =>
  page.locator('.rm-toast', { hasText: text }).waitFor({ timeout: 10000 }).catch(() => {
    throw new Error(`no toast saying “${text}”`);
  });
// Morty in `area`, and it built
export const inArea = (page, area) =>
  page.waitForFunction((a) => window.__C137__?.sim?.area === a && window.__C137__.ready(), area, { timeout: 300000, polling: 250 }).catch(async () => {
    throw new Error(`Morty isn’t in ${area} (he’s in ${await page.evaluate(() => window.__C137__?.sim?.area)})`);
  });
// episode i's card: its number, title and first line, gone at the next key
export async function cardFor(page, i) {
  const card = page.locator('.rm-episode');
  await card.waitFor({ timeout: 10000 }).catch(() => {
    throw new Error(`no card for episode ${i + 1}`);
  });
  const said = await card.textContent();
  check(said.includes(`Episode ${i + 1}`) && said.includes(EPISODES[i].title) && said.includes(EPISODES[i].intro[0][1]), `episode ${i + 1}’s card says “${said}”`);
  await page.keyboard.press('Shift');
  await card.waitFor({ state: 'detached', timeout: 5000 });
}
// the story at episode e's step s
export async function at(page, e, s, when) {
  const st = await story(page);
  check(st.episode === e && st.step === s, `${when} the story is at ${st.episode}.${st.step}, not ${e}.${s}`);
}
export const opens = async (page, ids, open, when) => {
  for (const id of ids) check((await page.evaluate((id) => window.__RMSTORY__.dialOpen(id), id)) === open, `${id} is ${open ? 'shut' : 'open'} ${when}`);
};
// Total Rickall: someone put in Morty's sights, and shot
export async function shootAt(page, id) {
  check(await page.evaluate((id) => window.__C137__.lookAt(id), id), `Morty can’t get ${id} in his sights`);
  await page.waitForFunction((id) => window.__C137__.sim.rickall?.aim === id, id, { timeout: 60000, polling: 100 }).catch(() => {
    throw new Error(`the sights never settled on ${id}`);
  });
  await page.evaluate(() => window.__C137__.shoot());
  await page.waitForFunction((id) => {
    const g = window.__C137__.sim.rickall?.game;
    return !g || g.shot.includes(id) || g.state !== 'on';
  }, id, { timeout: 120000, polling: 100 }).catch(() => {
    throw new Error(`the shot at ${id} never landed`);
  });
  const hit = await page.evaluate(() => window.__C137__.sim.rickall?.game?.shot.at(-1));
  check(hit === id, `the shot at ${id} hit ${hit}`);
}
// Morty moved to (x, z) within `area` (its game kept going), and E at `id`
export async function warpUse(page, area, id, x, z, face = N) {
  await page.evaluate(([a, x, z, f]) => window.__C137__.warp(a, x, z, f), [area, x, z, face]);
  await use(page, id);
}
// he's been caught: back at the place's way in, its game started afresh
export const caught = (page, z) =>
  page.waitForFunction((z) => !window.__C137__.sim.fading && Math.abs(window.__C137__.sim.m.z - z) < 0.05 && window.__C137__.sim.used.size === 0 && !window.__C137__.sim.escape, z, { timeout: 60000, polling: 100 }).catch(() => {
    throw new Error('Morty wasn’t put back at the way in');
  });
// the cruiser a metre before ring `r` of the chase, on its way through at 10 m/s
// (the step after a move this long isn't a pass: the next few frames are)
export const before = (page, r) =>
  page.evaluate((r) => {
    const s = window.__C137__.sim;
    s.c = { ...s.c, x: r.x - Math.sin(r.yaw), y: r.y, z: r.z - Math.cos(r.yaw), yaw: r.yaw, speed: 10, vy: 0 };
  }, r);
export const chasing = (page, phase, what) =>
  page.waitForFunction((p) => window.__C137__.sim.chase?.phase === p, phase, { timeout: 60000, polling: 100 }).catch(() => {
    throw new Error(what);
  });
// a new visitor's first card passed, and the story played to episode `e`'s
// start through the hooks (`wins` fed first), each card on the way checked
export async function playTo(page, e, wins = []) {
  await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
  await page.locator('.rm-episode').waitFor({ timeout: 600000 });
  await page.keyboard.press('Shift');
  await page.locator('.rm-episode').waitFor({ state: 'detached', timeout: 5000 });
  await built(page);
  for (const game of wins) await page.evaluate((game) => window.__RMSTORY__.feed({ type: 'win', game }), game);
  for (let i = 0; i < e; i++) {
    for (const step of EPISODES[i].steps) if (step.type === 'task') await page.evaluate((id) => window.__C137__.complete(id), step.id);
    await toast(page, EPISODES[i].outro[0][1]);
    await cardFor(page, i + 1);
  }
}
// a place's game, as its stage has it (Needful Things' deal, the vat's freeze, the Jerryboree's find)
export const game = (page, area, what) => page.evaluate(([a, w]) => window.__C137__.api.act(a, w), [area, what]);
// Morty stood on one of a place's ledges (`dx`, `dz` off its middle), on his feet
export const standOn = (page, area, id, { dx = 0, dz = 0 } = {}) => {
  const [x, z, y] = PLACES.ledge(area, id);
  return page.evaluate(([x, z, y]) => {
    const s = window.__C137__.sim;
    s.m = { ...s.m, x, z, y, vy: 0, vx: 0, vz: 0, speed: 0, air: false };
  }, [x + dx, z + dz, y]);
};
// `s` seconds of the game's own time gone by (a headless frame is slow: a key
// held for wall-clock milliseconds would be a frame or two)
export async function later(page, s) {
  const t0 = await page.evaluate(() => window.__C137__.sim.t);
  await page.waitForFunction((t) => window.__C137__.sim.t >= t, t0 + s, { timeout: 120000, polling: 16 });
}
export const rickallOn = (page) => page.waitForFunction(() => window.__C137__.sim.rickall?.phase === 'on', null, { timeout: 300000, polling: 250 });
