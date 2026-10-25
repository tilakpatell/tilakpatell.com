/* global window, document, KeyboardEvent */
// The browser check's helpers (../rm-story-check.mjs): where the dev server
// is, where shots go, the browser to drive, and the steps every scenario
// takes through C-137's dev hooks (window.__C137__, window.__RMSTORY__):
// Morty sent somewhere and stood till it's built, E at a hotspot, the
// objective read, a toast waited for, an episode's card checked, the story
// played to an episode's start, a catch seen through, Morty stood on a
// ledge, time waited out on the game's own clock; and where a place
// through the portal has its way in, its portal home and its spots, read
// from its data (./places.mjs); and at the Citadel (window.__CITADEL__), its
// page up, its line read (the story's step over its own) and its toast
// waited for; a place dialled from the garage and home through its own
// portal, a task not done after a while, the Story tab's ticks, a page
// opened with a place's people held back; and Rick's rooms on the
// Vindicators' ship, as their rules have them. Kept apart from
// the scenarios so no file passes 800 lines.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EPISODES } from '../../src/components/rickmorty/adventure/episodes.js';
import { home as homeAt, loadPlaces, stand, wayIn } from './places.mjs';

export { ROOMS } from '../../src/components/rickmorty/world/dimensions/vindicatorsRules.js';

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
export const homeOf = (area) => homeAt(PLACES.dest(area));

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
// the objective line is a link, to `hash`
export async function linksTo(page, hash) {
  const to = await page.evaluate(() => document.querySelector('.rm-hud .rm-objective-link')?.getAttribute('href') ?? null);
  check(to?.endsWith(hash), `the objective line doesn’t link to ${hash} (${to})`);
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
export const CITADEL = EPISODES[9];
export const SECTOR = EPISODES[10];
export const SCORE = EPISODES[11];
export const EVIL = EPISODES[12];
// the checklist's next once the built episodes are over
export const CABLE = 'Go into the Smith house and put interdimensional cable on the TV.';
// (a label in the middle of a line, as a place's words have it)
export const low = (l) => l[0].toLowerCase() + l.slice(1);
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
  page.locator('.rm-toast', { hasText: text }).waitFor({ timeout: 10000 }).catch(async () => {
    throw new Error(`no toast saying “${text}” (it says “${await page.locator('.rm-toast').first().textContent({ timeout: 500 }).catch(() => 'nothing')}”)`);
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
  // (a key held from before it showed doesn't pass it: its auto-repeat)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', repeat: true })));
  await page.waitForTimeout(300);
  check((await card.count()) === 1, `episode ${i + 1}’s card went at a held key’s repeat`);
  await page.keyboard.press('Shift');
  await card.waitFor({ state: 'detached', timeout: 5000 });
}
// an episode's card come up with the closing line it follows, not before
// that line nor over it (then cardFor's checks)
export async function cardOnLine(page, text) {
  await page.locator('.rm-episode').waitFor({ timeout: 20000 }).catch(() => {
    throw new Error(`no card after “${text}”`);
  });
  const at = await page.evaluate((t) => {
    const line = Array.from(document.querySelectorAll('.rm-toast')).find((n) => n.textContent.includes(t));
    const a = document.querySelector('.rm-episode').getBoundingClientRect();
    const b = line?.getBoundingClientRect();
    return { line: Boolean(line), over: Boolean(b) && a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right };
  }, text);
  check(at.line, `the card came up before its closing line “${text}”`);
  check(!at.over, `the card is over its closing line “${text}”`);
}
// a page of the site opened afresh at `hash` on episode i's card (a story
// not begun), the card checked and passed, and the world built behind it
export async function openOnCard(page, hash, i) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.rm-episode').waitFor({ timeout: 600000 });
  await cardFor(page, i);
  await built(page);
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
// start through the hooks (`wins` fed first, an `all`'s parts each a task),
// each card on the way checked. The Citadel's episode is played as a visitor
// who made its escape before walking in: the escape kept, the walk in fed,
// and the visit opened afresh on the next card (its closing line is the
// Citadel's own scenarios' to check).
export async function playTo(page, e, wins = []) {
  await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
  await page.locator('.rm-episode').waitFor({ timeout: 600000 });
  await page.keyboard.press('Shift');
  await page.locator('.rm-episode').waitFor({ state: 'detached', timeout: 5000 });
  await built(page);
  for (const game of wins) await page.evaluate((game) => window.__RMSTORY__.feed({ type: 'win', game }), game);
  for (let i = 0; i < e; i++) {
    const steps = EPISODES[i].steps.flatMap((s) => (s.type === 'all' ? s.steps : [s]));
    if (steps.some((s) => s.type === 'citadel')) {
      await page.evaluate(() => {
        window.localStorage.setItem('tp-citadel-done', JSON.stringify(['daycare', 'wafers', 'council', 'votemorty', 'citadelout']));
        window.__RMSTORY__.feed({ type: 'enter', area: 'page:/c-137/citadel' });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.rm-episode').waitFor({ timeout: 600000 });
      await cardFor(page, i + 1);
      await built(page);
      continue;
    }
    for (const step of steps) if (step.type === 'task') await page.evaluate((id) => window.__C137__.complete(id), step.id);
    await toast(page, EPISODES[i].outro[0][1]);
    await cardFor(page, i + 1);
  }
}
// dialled from the garage, and through its portal
export async function dial(page, id) {
  check((await page.evaluate((id) => window.__C137__.dial(id), id)) === id, `the dial wouldn’t take ${id}`);
  await throughPortal(page);
  await inArea(page, id);
}
// home through the place's own portal
export const home = async (page, id) => {
  await warpUse(page, id, `${id}-portal`, ...homeOf(id));
  await inArea(page, 'garage');
};
// a task done, and an achievement earned
export const isDone = (page, id, what) =>
  page.waitForFunction((id) => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes(id), id, { timeout: 30000, polling: 100 }).catch(() => {
    throw new Error(what);
  });
export const achieved = (page, id, what) =>
  page.waitForFunction((id) => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes(id), id, { timeout: 30000, polling: 250 }).catch(() => {
    throw new Error(what);
  });
// a task not done after a few seconds of the game's own time
export const notDone = async (page, id, what) => {
  await later(page, 3.5);
  check(!(await done(page)).includes(id), what);
};
// the Story tab: a step, or an `all`'s part, ticked
export async function ticked(page, text) {
  await page.keyboard.press('m');
  const list = page.locator('#rm-list');
  await list.waitFor({ timeout: 10000 });
  const n = await list.locator('li[data-done]', { hasText: text }).count();
  await page.keyboard.press('m');
  await list.waitFor({ state: 'detached', timeout: 5000 });
  return n > 0;
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
// the map's marker (the sim's `goal`): a link's or a spot's id
export const goalIs = (page, id, where) =>
  page.waitForFunction((id) => window.__C137__.sim.goal?.id === id, id, { timeout: 15000, polling: 100 }).catch(async () => {
    throw new Error(`${where} the marker’s on ${await page.evaluate(() => window.__C137__.sim.goal?.id ?? null)}, not ${id}`);
  });
// the objective line isn't a link
export const noLink = async (page, where) => check((await page.locator('.rm-hud .rm-objective-link').count()) === 0, `${where} the line is a link`);
// a place's meter, by its title, and its line
export const meter = (page, title) => page.locator(`.rm-cluster[aria-label="${title}"][data-on]`);
export const meterSays = (page, title, text) =>
  page.waitForFunction(([t, s]) => document.querySelector(`.rm-cluster[aria-label="${t}"][data-on]`)?.textContent.includes(s), [title, text], { timeout: 15000, polling: 100 }).catch(async () => {
    throw new Error(`the meter reads “${await meter(page, title).first().textContent().catch(() => '(none)')}”, not “${text}”`);
  });
// Morty moved within a place, its game going on
export const warp = (page, area, x, z, face = N) => page.evaluate(([a, x, z, f]) => window.__C137__.warp(a, x, z, f), [area, x, z, face]);
// a place's hunters after him now
export const hunting = (page, area) => page.evaluate((a) => window.__C137__.api.act(a, 'npcs').filter((n) => n.hunting).map((n) => n.id), area);
// a page of the site opened afresh at `hash` (a hash change alone keeps the
// last page's world tearing down under the next one's dev hook)
export async function open(page, hash) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await built(page);
}
// a page of the site opened afresh at `hash` with the cast's files for
// `names` held back (a place's people still on the way: its cast stands only
// once every kind's in), till Morty's in `area`, it's built and in view; what
// it hands back lets them through and waits till the world's ready
export async function openHeld(page, hash, area, names) {
  let free;
  const held = new Promise((r) => (free = r));
  // (a figure's model and its clips: <name>.glb, <name>-walk.glb and the rest)
  const asked = (url) => names.some((n) => new RegExp(`/${n}(-[a-z]+)?\\.glb$`).test(url.pathname));
  const hold = async (route) => {
    await held;
    await route.continue();
  };
  await page.route(asked, hold);
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((a) => window.__C137__?.sim?.area === a && window.__C137__.api?.hasArea(a), area, { timeout: 600000, polling: 250 }).catch(async () => {
    throw new Error(`Morty isn’t in a built ${area} (he’s in ${await page.evaluate(() => window.__C137__?.sim?.area)})`);
  });
  await page.evaluate(() => document.querySelector('.rm-world')?.scrollIntoView({ block: 'start' }));
  return async () => {
    free();
    await page.unroute(asked, hold);
    await built(page);
  };
}
export const rickallOn = (page) => page.waitForFunction(() => window.__C137__.sim.rickall?.phase === 'on', null, { timeout: 300000, polling: 250 });

// the Citadel's own line for the scenes made (its next scene's, or the one for when it's all done), as its data has it
export const CITADEL_LINE = PLACES.citadel;
// the Citadel's page up: its 3D world built, scrolled into view (it's only live in view) and drawing frames
export async function citadelUp(page) {
  await page.waitForFunction(() => window.__CITADEL__?.api || document.querySelector('.citadel-world')?.dataset.mode === 'cards', null, { timeout: 600000, polling: 1000 });
  check(await page.evaluate(() => Boolean(window.__CITADEL__?.api)), 'the Citadel’s 3D world didn’t start');
  await page.evaluate(() => document.querySelector('.citadel-world')?.scrollIntoView({ block: 'start' }));
  const f0 = await page.evaluate(() => window.__CITADEL__.sim.frame);
  await page.waitForFunction((f) => window.__CITADEL__?.sim.frame > f + 2, f0, { timeout: 120000, polling: 100 }).catch(() => {
    throw new Error('the Citadel isn’t drawing');
  });
}
// the Citadel's line: the story's step over it (or null), its own words, and whether it links anywhere
export const citadelLine = (page) =>
  page.evaluate(() => {
    const o = document.querySelector('.citadel-stage .shire-objective');
    if (!o) return null;
    const lead = o.querySelector('.citadel-objective-story');
    const own = o.cloneNode(true);
    own.querySelector('.citadel-objective-story')?.remove();
    return { story: lead?.textContent.trim() ?? null, text: own.textContent.replace('◆', '').trim(), link: Boolean(o.querySelector('a')) };
  });
export async function citadelReads(page, story, text) {
  await page.waitForFunction(
    ([story, text]) => {
      const o = document.querySelector('.citadel-stage .shire-objective');
      if (!o || o.querySelector('a')) return false;
      const lead = o.querySelector('.citadel-objective-story')?.textContent.trim() ?? null;
      const own = o.cloneNode(true);
      own.querySelector('.citadel-objective-story')?.remove();
      return lead === story && own.textContent.replace('◆', '').trim() === text;
    },
    [story, text],
    { timeout: 10000 },
  ).catch(async () => {
    throw new Error(`the Citadel’s line reads ${JSON.stringify(await citadelLine(page))}, not ${JSON.stringify({ story, text, link: false })}`);
  });
}
// the Citadel's toast saying `text`, and who says it when that's named
export async function citadelToast(page, text, name = null) {
  const t = page.locator('.citadel-stage .shire-toast', { hasText: text });
  await t.waitFor({ timeout: 15000 }).catch(() => {
    throw new Error(`no toast at the Citadel saying “${text}”`);
  });
  if (name) check((await t.locator('b').first().textContent().catch(() => null))?.trim() === name, `the toast “${text}” isn’t ${name}’s`);
}
