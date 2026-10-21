/* global window, document */
// A browser check of the Invincible world (components/invincible/world).
// With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/inv-world-check.mjs [--metrics] [shot …]
// It opens /invincible, waits for the city, and frames it from the places
// the QA cares about (dev hook window.__INVWORLD__: `sim.h` is where he is,
// `sim.yaw`/`sim.pitch` the camera, `sim.snap` puts the camera and his pose
// straight where they're going). Headless Chrome draws in software, slowly.
// --metrics prints, after each shot, `name band=… mark=…` (see measure);
// BOX=1 with it also writes inv-<name>.box.png, the box and ring drawn on.
// --play ep1,ep2,… (or --play all) plays those episodes through by moving
// Mark (./inv-world-play.mjs) and fails unless each is done; with --play
// only the shots named are taken.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { installPlayer, play } from './inv-world-play.mjs';

const out = process.env.OUT ?? '.';
const W = Number(process.env.W ?? 960);
const H = Number(process.env.H ?? 540);
const Q = process.env.Q ?? 'low';
// (BASE: another dev server than the default one, e.g. a worktree's own port)
const BASE = process.env.BASE ?? 'http://localhost:5173';
const URL = `${BASE}/?quality=${Q}#/invincible`;
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 600, isMobile: W < 600 });
await ctx.addInitScript(([q, intro]) => {
  window.localStorage.setItem('tp-intro', '1');
  // (the bare word, as lib/gpu.js keeps it: quoted, it reads as auto, and a
  // game that is not forced on goes down to its no-3D card when the software
  // renderer's frames fall past the watchdog's floor)
  window.localStorage.setItem('tp-3d', 'on');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
  window.localStorage.setItem('tp-quality', JSON.stringify(q));
  // (a first visit drops him in from the sky: INTRO=1 to see it, otherwise he's already on the lawn)
  if (intro) window.localStorage.removeItem('tp-inv-world-at');
  else window.localStorage.setItem('tp-inv-world-at', JSON.stringify({ x: -2044, y: 0, z: 253.5, face: 1.694 }));
}, [Q, Boolean(process.env.INTRO)]);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
// (--play's driver says how far it's got)
page.on('console', (m) => m.text().startsWith('[play]') && console.log(m.text()));
const t0 = Date.now();
// (a cold dev server transforms the whole module graph before the page's first script runs: minutes under load)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 240000 });
await page.waitForFunction(() => window.__INVWORLD__?.api && document.querySelector('.iw-canvas[data-on]'), null, { timeout: 240000 });
console.log('city up in', ((Date.now() - t0) / 1000).toFixed(1), 's');

// shots: [name, hero { p, mode, v }, yaw, pitch, time]
const SHOTS = {
  spawn: { at: null, time: 'noon' },
  street: { p: [40, 18, 200], mode: 'air', yaw: Math.PI, pitch: -0.22 },
  // the brawl (./brawl.js): a Mauler in his hands over downtown (['spawn'] calls the villains, ['held', i] puts the i-th in his hands)
  // the city that breaks (./demolish.js): the three towers nearest the plaza's east with their tops gone, at dusk (['ruin', [x, z], n, d] hits them through the hook)
  ruins: { drive: [['go', [110, 230, 175], Math.PI, 'air'], ['ruin', [110, 60], 3, 0.8], ['wait', 800]], time: 'dusk', pitch: -0.95 }, // (from high over them, looking down: the tops gone show best from above)
  // episode 8 (./missions.js): Dad on the porch at dusk as it starts; the sky at 8 km at night, Dad beside him (the world steps the beats; ['feed'] moves the rules)
  ep8porch: { mission: 'ep8', drive: [['go', [-2050.2, 0, 251], Math.PI, 'ground'], ['wait', 1200]], time: 'dusk', pitch: 0.12 },
  ep8sky: { mission: 'ep8', drive: [['feed', { type: 'use', id: 'panels' }], ['feed', { type: 'recover' }], ...Array.from({ length: 3 }, () => ['feed', { type: 'hit', kind: 'omniman', id: 7 }]), ['ticks', 61], ['wait', 300], ['go', [0, 8000, -400], 0, 'air'], ['wait', 2500]], time: 'night', pitch: -0.5 },
  // who you fly as (./heroes.js; ['hero', id] swaps through the hook, earned or not)
  heroEve: { drive: [['hero', 'eve'], ['go', [40, 18, 200], Math.PI, 'air'], ['wait', 600]], pitch: -0.22 },
  heroOmni: { drive: [['hero', 'omniman'], ['go', [40, 18, 200], Math.PI, 'air'], ['wait', 600]], pitch: -0.22 },
  heroThragg: { drive: [['hero', 'thragg'], ['go', [40, 18, 200], Math.PI, 'air'], ['wait', 600]], pitch: -0.22 },
  brawl: { drive: [['go', [50, 26, 40], Math.PI, 'air'], ['spawn', 'mauler', 1, [50, 0, 0]], ['wait', 300], ['held', 0], ['wait', 400]], pitch: -0.35 },
  // the Guardians (./guardians.js): the hall's inside from its door (['hall', on] goes in or out through the hook); the two sent to four Maulers on the plaza
  hall: { drive: [['hall', true], ['wait', 1500]], pitch: 0.1 },
  // Angstrom's dimensions (./dimensions.js): the burnt city at night, from over the plaza (['dim', id] goes through the hook)
  levy: { drive: [['dim', 'burnt'], ['go', [40, 60, 200], Math.PI, 'air'], ['wait', 1500]], time: 'night', pitch: -0.2 },
  cavalry: { drive: [['go', [22, 9, 46], Math.PI, 'air'], ['spawn', 'mauler', 4, [22, 0, 24]], ['wait', 4500]], pitch: -0.22 },
  curb: { p: [44, 3, 120], mode: 'air', yaw: Math.PI, pitch: -0.12 },
  streetnight: { p: [40, 18, 200], mode: 'air', yaw: Math.PI, pitch: -0.22, time: 'night' },
  downtown: { p: [-300, 140, 600], mode: 'air', yaw: Math.PI * 0.9, pitch: -0.12 },
  high: { p: [-900, 1400, 1500], mode: 'air', yaw: Math.PI * 0.85, pitch: -0.45 },
  suburb: { p: [-2060, 30, 330], mode: 'air', yaw: Math.PI, pitch: -0.25 },
  river: { p: [1150, 25, 600], mode: 'air', yaw: Math.PI, pitch: -0.05 },
  boost: { p: [0, 220, 900], mode: 'air', v: [0, 0, -250], yaw: Math.PI, pitch: -0.1 },
  porch: { place: 'home', back: 9, up: 1.5 },
  gda: { place: 'gda', back: 12, up: 2 },
  burger: { place: 'burgermart', back: 12, up: 2 },
  school: { place: 'school', back: 22, up: 4 },
  plaza: { place: 'guardians', back: 26, up: 8 },
  plazanight: { place: 'guardians', back: 26, up: 8, time: 'night' },
  burgernight: { place: 'burgermart', back: 12, up: 2, time: 'night' },
  schoolnight: { place: 'school', back: 22, up: 4, time: 'night' },
  eve: { follow: 'eve', back: 16 },
  jet: { follow: 'jet', back: 70 },
  clouds: { p: [600, 1150, 900], mode: 'air', yaw: Math.PI * 0.8, pitch: 0.02 },
  rings: { p: [-2060, 22, 262], mode: 'air', yaw: 2.2, pitch: 0.05 },
  card: { p: [0, 38, 30], mode: 'air', yaw: Math.PI, pitch: 0.1 },
  // his back to the tallest tower's south face, as near it as ./flight.js lets him (FLY.R):
  // the camera goes out along the wall, not into him
  wallback: { p: [65, 60, 27.4], mode: 'air', yaw: 0, pitch: -0.05 },
  rescue: { rescue: true, back: 28 },
  fight: { fight: true },
  climb: { p: [0, 7600, 600], mode: 'air', yaw: Math.PI, pitch: 0.12 },
  orbit: { space: 'earth' },
  orbitnight: { space: 'earth', time: 'night' },
  moon: { space: 'moon', back: 70 },
  reentry: { space: 'reentry' },
  allen: { space: 'allen', back: 14 },
  mars: { space: 'mars', back: 90 },
  // the Sequids (./offworld/mars.js): the base at the site, the swarm on the host, from 40 m over the pad
  sequids: { space: 'site', back: 40 },
  thragg: { space: 'thragg', back: 18 },
  dusk: { p: [-300, 160, 700], mode: 'air', yaw: Math.PI * 0.9, pitch: -0.1, time: 'dusk' },
  night: { p: [-300, 160, 700], mode: 'air', yaw: Math.PI * 0.9, pitch: -0.1, time: 'night' },
  // The missions (./missions.js), each started through the dev hook (`api.mission`) and driven
  // by `drive` to the step the shot wants, then by `finish` to its end (`api.feed` takes the
  // events the way the world would send them: a landing, a knock-out, a catch, the clock):
  // ['go', p, face, mode] puts Mark there; ['step', i] waits for the step; ['car'] for the
  // getaway; ['foes', n] for that many standing; ['near', what, back, up, side] puts Mark `back` m
  // from the car or the marker (and `side` m to the right of the line), looking at it; ['land', speed] feeds a landing on the car;
  // ['feed', event] one event; ['ticks', s] the clock on by s seconds; ['wait', ms]; ['fast', k]
  // runs the clock k times faster (software rendering is slow); ['rescue'] waits for someone to save;
  // ['gates'] flies him through the race's gates in order; ['start'] starts the mission there rather
  // than before the first op (the chase's car pulls out from wherever he is).
  bank: { mission: 'ep2', drive: [['go', [36, 0, 14], 1.0, 'ground']], pitch: 0.06, finish: [['go', [50, 0, 0], 1.57, 'ground'], ['step', 1], ['car'], ['land', 25], ['step', 2], ['feed', { type: 'ko', kind: 'mauler' }], ['feed', { type: 'ko', kind: 'mauler' }]] }, // the bank from the pavement, its marker over the door
  chase: { mission: 'chase', drive: [['go', [-200, 20, -120], 0, 'air'], ['start'], ['car'], ['wait', 2500], ['near', 'car', 26, 7, 5]], finish: [['land', 10]] }, // the stolen car running the grid, Mark over the street behind it
  seismic: { mission: 'ep3', drive: [['go', [-2610, 6, -372], Math.PI, 'air'], ['step', 1], ['foes', 1], ['fast', 8], ['rescue'], ['fast', 1], ['near', 'marker', 14, 3]], finish: [['feed', { type: 'caught' }], ['feed', { type: 'caught' }], ['feed', { type: 'caught' }], ['feed', { type: 'caught' }], ['feed', { type: 'ko', kind: 'seismic' }]] }, // Doc Seismic over the school, a student at the roof's edge
  maulers: { mission: 'ep2', drive: [['go', [50, 0, 0], 1.57, 'ground'], ['step', 1], ['car'], ['land', 25], ['step', 2], ['wait', 1500], ['near', 'car', 16, 2, 4]], finish: [['feed', { type: 'ko', kind: 'mauler' }], ['feed', { type: 'ko', kind: 'mauler' }]] }, // the Mauler twins at the stopped truck
  eveescort: { follow: 'eve', back: 10, side: 8, turn: 0 }, // she's off his left, as when she escorts him
  // the rings under way, Dad 50 m behind him and 20 m up (the camera turned round to them both)
  dadlesson: { p: [-2033, 22, 255], mode: 'air', yaw: 1.96, look: 1.96 + Math.PI, pitch: 0.3, dad: 'lesson' },
  porchdusk: { place: 'home', back: 10, up: 1, side: 3, time: 'dusk', dad: 'porch' }, // Dad home, beside Mom
  gdasiege: { mission: 'ep6', drive: [['go', [1608, 5, -372], Math.PI, 'air'], ['foes', 2], ['wait', 3000], ['near', 'marker', 30, 9]], pitch: -0.2, finish: [['ticks', 91], ['step', 1], ...Array.from({ length: 6 }, () => ['feed', { type: 'ko', kind: 'mauler' }])] }, // the hangar held, the Maulers coming up the river bank
  photo: { mission: 'photo1', drive: [['go', [24, 3, 27], -2.4, 'air']], pitch: 0.22, finish: [['feed', { type: 'use', id: 'photo' }]] }, // the hall from the plaza's corner, the photo's frame ahead
  everace: { mission: 'everace', drive: [['go', [-200, 60, -120], Math.PI, 'air'], ['near', 'marker', 30, 4]], finish: [['gates']] }, // Eve's first gate over a downtown crossing
};
const args = process.argv.slice(2);
const metrics = args.includes('--metrics');
const at = args.indexOf('--play');
const SEASON = ['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7', 'ep8', 'levy', 'sequids'];
const plays = at < 0 ? [] : !args[at + 1] || args[at + 1].startsWith('--') || args[at + 1] === 'all' ? SEASON : args[at + 1].split(',');
const want = args.filter((a, i) => !a.startsWith('--') && !(at >= 0 && i === at + 1));

// How a shot reads, from the screenshot itself and on the canvas only (the
// site's header is above it; the HUD over it is counted, as a player sees it):
// band, the mean luma of the middle band (rows 35–75 % of the canvas); mark,
// how far the 60×90 px box round Mark differs from the ring 20 px outside it.
// Luma is Rec. 709's weights on the sRGB values as stored (0..1, not made
// linear first), which is nearer how light a thing looks than true luminance.
async function measure(png, { rect, at }) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = info.width / W; // (device pixels a CSS pixel)
  const c = [Math.max(0, rect.x), Math.max(0, rect.y), Math.min(W, rect.x + rect.w), Math.min(H, rect.y + rect.h)];
  // the sum and count over a box in the canvas's own pixels, cut to what's on the screen
  const sum = (x0, y0, x1, y1) => {
    const [X0, Y0] = [Math.max(c[0], rect.x + x0), Math.max(c[1], rect.y + y0)].map((v) => Math.round(v * k));
    const [X1, Y1] = [Math.min(c[2], rect.x + x1), Math.min(c[3], rect.y + y1)].map((v) => Math.round(v * k));
    let s = 0;
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        const i = (y * info.width + x) * info.channels;
        s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
    return [s / 255, Math.max(0, X1 - X0) * Math.max(0, Y1 - Y0)];
  };
  const [bs, bn] = sum(0, rect.h * 0.35, rect.w, rect.h * 0.75);
  const band = bs / bn;
  // (behind the camera, or off the canvas: no box to measure)
  if (!at.front || at.x < 0 || at.y < 0 || at.x > rect.w || at.y > rect.h) return { band, mark: null };
  const [ms, mn] = sum(at.x - 30, at.y - 45, at.x + 30, at.y + 45);
  const [os, on] = sum(at.x - 50, at.y - 65, at.x + 50, at.y + 65);
  return { band, mark: Math.abs(ms / mn - (os - ms) / (on - mn)) };
}
// the measured box and ring drawn on a copy of the shot, to check they're round him
async function boxed(png, file, { rect, at }) {
  const r = (x, y, w, h, col) => `<rect x="${rect.x + x}" y="${rect.y + y}" width="${w}" height="${h}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
  const band = r(0, rect.h * 0.35, rect.w, rect.h * 0.4, '#0cf');
  const { width, height } = await sharp(png).metadata();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}">${band}${at.front ? r(at.x - 30, at.y - 45, 60, 90, '#f0f') + r(at.x - 50, at.y - 65, 100, 130, '#ff0') : ''}</svg>`;
  await sharp(png).composite([{ input: Buffer.from(svg) }]).toFile(file);
}

// the missions' driver (see SHOTS): `id` to start one (null to go on with the one under way)
await page.evaluate(() => {
  window.__INV_DRIVE__ = async (id, ops, s = {}, freeze = false) => {
    const { api, sim } = window.__INVWORLD__;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (f, ms = 20000) => {
      for (let t = 0; t < ms && !f(); t += 200) await sleep(200);
      return f();
    };
    const standing = () => sim.foes.foes.filter((e) => e.state !== 'ko' && e.state !== 'down').length;
    const place = (p, face, mode = 'air') => {
      sim.h = { ...sim.h, p: [...p], v: [0, 0, 0], spd: 0, mode, crouch: 0, stun: 0, face };
      sim.yaw = face;
      sim.pitch = s.pitch ?? 0.05;
      sim.dragAt = 1e9;
    };
    sim.speedup = 1;
    const start = () => {
      api.mission(id);
      sim.swing = null; // (the title card's camera swing, off: the shot frames things itself)
    };
    if (id && !ops?.some((op) => op[0] === 'start')) start();
    for (const op of ops ?? []) {
      const [k, a, b, c, d = 0] = op;
      if (k === 'start') start();
      else if (k === 'go') place(a, b, c);
      else if (k === 'wait') await sleep(a);
      else if (k === 'step') await until(() => !sim.mission || sim.mission.step >= a);
      else if (k === 'car') await until(() => Boolean(sim.getaway));
      else if (k === 'foes') await until(() => standing() >= a);
      else if (k === 'fast') sim.speedup = a;
      else if (k === 'rescue') await until(() => Boolean(sim.quests.rescue), 60000);
      else if (k === 'gates') {
        for (const g of sim.gates?.list ?? []) {
          place(g, sim.h.face, 'air');
          const f0 = sim.frame;
          await until(() => sim.frame >= f0 + 2);
        }
      }
      else if (k === 'near') {
        // (a few frames first: the HUD's marker is a frame or two behind the rules)
        const f0 = sim.frame;
        await until(() => sim.frame >= f0 + 3);
        const at = a === 'car' ? sim.getaway?.p : sim.marker?.p;
        if (!at) continue;
        const face = sim.getaway && a === 'car' ? sim.getaway.yaw : Math.atan2(at[0] - sim.h.p[0], at[2] - sim.h.p[2]);
        place([at[0] - Math.sin(face) * b - Math.cos(face) * d, at[1] + (c ?? 0), at[2] - Math.cos(face) * b + Math.sin(face) * d], face, 'air');
      } else if (k === 'land') {
        const at = sim.getaway?.p ?? sim.h.p;
        place([at[0], at[1], at[2]], sim.h.face, 'ground');
        await until(() => Boolean(sim.mission?.seen?.car)); // (a frame first: the mission sees the car where it is)
        api.feed({ type: 'land', speed: a, p: [...(sim.getaway?.p ?? at)] });
      } else if (k === 'feed') api.feed(a);
      else if (k === 'spawn') api.spawn(a, b, c);
      else if (k === 'ruin') api.ruin(a, b, c);
      else if (k === 'hero') api.hero(a);
      else if (k === 'hall') api.hall(a);
      else if (k === 'dim') api.dimension(a);
      else if (k === 'held') {
        const e = sim.foes.foes[a];
        if (e) {
          e.state = 'held';
          sim.brawl.held = { what: 'foe', id: e.id };
          sim.keys.add('punch'); // (the punch held: let go and he throws it)
        }
      }
      else if (k === 'ticks') for (let t = 0; t < a; t += 0.05) api.feed({ type: 'tick', dt: 0.05 });
    }
    // (held still for the shot: the clock stops, so nothing drives off or knocks him about)
    if (freeze) sim.speedup = 0;
  };
});
await page.waitForTimeout(3000); // (a few frames first, so everyone's somewhere)
for (const [name, s] of Object.entries(SHOTS)) {
  if ((want.length || plays.length) && !want.includes(name)) continue;
  await page.evaluate(async (s) => {
    const { api, sim } = window.__INVWORLD__;
    sim.snap = true;
    // (a shot in the city after one out in space: down through the top of the sky first, the
    // way the game brings him home; otherwise he's placed by space's reckoning, over the Earth)
    // (a shot after the hall's: out of it first, the way the game does)
    if (api.zone === 'hall') api.hall(false);
    if (api.dimension && sim.dim !== 'home') api.dimension('home');
    if (!s.space && api.zone === 'space') {
      sim.h = { ...sim.h, p: [0, 60000 + 7000, 0], v: [0, -300, 0], spd: 300, dir: [0, -1, 0], mode: 'air', perch: null, reentered: false };
      for (let i = 0; i < 40 && api.zone !== 'city'; i++) await new Promise((r) => setTimeout(r, 250));
    }
    // (noon unless the shot says: the time otherwise carries over from the shot before. The
    // hook's setTime is the HUD's one clock, so the button agrees with the sky; it resolves
    // once the scene has the time)
    await api.setTime(s.time ?? 'noon');
    if (s.fight) {
      // the Flaxans: start them now, wait till a few are through (not on the clock: software
      // rendering is slow, so the game's clock runs faster meanwhile), and face the portal
      sim.invadeAt = 0;
      sim.h = { ...sim.h, p: [1100, 140, -410], v: [0, 0, 0], spd: 0, mode: 'air', crouch: 0, stun: 0, face: Math.PI / 2 };
      sim.speedup = 8;
      const near = () => sim.foes.foes.filter((e) => e.state === 'fight' && Math.hypot(e.p[0] - 1100, e.p[2] + 410) < 45).length;
      for (let i = 0; i < 80 && (near() < 2 || sim.foes.foes.filter((e) => e.state === 'fight').length < 4); i++) await new Promise((r) => setTimeout(r, 250));
      sim.speedup = 1;
      sim.yaw = Math.PI / 2 - 0.15;
      sim.pitch = 0.12;
      sim.dragAt = 1e9;
    } else if (s.mission || s.drive) {
      // (a shot with `drive` and no mission: the ops alone, nothing started)
      await window.__INV_DRIVE__(s.mission ?? null, s.drive, s, true);
    } else if (s.space) {
      // up through the top of the sky, if he isn't out there already
      if (api.zone !== 'space') {
        sim.h = { ...sim.h, p: [0, 8990, 0], v: [0, 300, 0], spd: 300, dir: [0, 1, 0], mode: 'air', exited: false, crouch: 0, stun: 0 };
        sim.yaw = Math.PI;
        sim.pitch = 0.3;
        for (let i = 0; i < 40 && api.zone !== 'space'; i++) await new Promise((r) => setTimeout(r, 250));
      }
      const { bodies, allen, thragg } = api.debug;
      const RE = 60000;
      let target;
      if (s.space === 'reentry') {
        // coming down fast over the city: the air burns
        sim.h = { ...sim.h, p: [200, RE + 16000, 300], v: [0, -800, 0], spd: 800, dir: [0, -1, 0], mode: 'air', reentered: false };
        sim.yaw = Math.PI;
        sim.pitch = -0.35;
      } else if (s.space === 'earth') {
        sim.h = { ...sim.h, p: [0, RE + 30000, 9000], v: [0, 0, 0], spd: 0, mode: 'air' };
        sim.yaw = Math.PI;
        sim.pitch = -0.7;
      } else {
        const b = bodies.find((q) => q.id === s.space);
        target = b ? b.c : s.space === 'allen' ? allen : s.space === 'site' ? api.debug.marsSite : thragg;
        // stand off from it on the side toward the Earth, looking at it
        const l = Math.hypot(...target);
        const n = target.map((v) => -v / l);
        const off = (b ? b.r : 0) + s.back;
        // (and a little to one side, so he isn't in the way)
        const p = target.map((v, i) => v + n[i] * off + (i === 0 ? off * 0.35 : 0));
        const d = target.map((v, i) => v - p[i]);
        const dl = Math.hypot(...d);
        sim.h = { ...sim.h, p, v: [0, 0, 0], spd: 0, mode: 'air', perch: null };
        sim.yaw = Math.atan2(d[0], d[2]) + 0.3;
        sim.pitch = Math.asin(d[1] / dl);
      }
      sim.dragAt = 1e9;
    } else if (s.rescue) {
      // call an emergency in now, and frame it
      sim.quests = { ...sim.quests, nextCall: 0 };
      await new Promise((r) => setTimeout(r, 2500));
      const q = sim.quests.rescue;
      if (q) {
        const face = 2.4;
        sim.h = { ...sim.h, p: [q.p[0] - Math.sin(face) * s.back, q.p[1] + 2, q.p[2] - Math.cos(face) * s.back], v: [0, 0, 0], spd: 0, mode: 'air', crouch: 0, stun: 0, face };
        sim.yaw = face;
        sim.pitch = 0.05;
        sim.dragAt = 1e9;
      }
    } else if (s.place || s.follow) {
      // stand back from a place's door (or from someone flying), looking at it
      const { debug } = api;
      let at;
      let face;
      if (s.place) {
        const pl = debug.world.places.find((q) => q.id === s.place);
        at = [pl.door[0], 0, pl.door[1]];
        face = Math.atan2(pl.x - pl.door[0], pl.z - pl.door[1]);
      } else {
        const q = s.follow === 'eve' ? debug.npcs.eve.p : debug.jet.position;
        const v = s.follow === 'eve' ? debug.npcs.eve.v : debug.jet.velocity;
        at = [q.x, q.y - 1, q.z];
        face = Math.atan2(v.x, v.z) + (s.turn ?? 0.5);
      }
      // (`side` puts him that far to the right of the line, so they're beside him, not behind him)
      const side = s.side ?? 0;
      const p = [at[0] - Math.sin(face) * s.back - Math.cos(face) * side, at[1] + (s.up ?? 0), at[2] - Math.cos(face) * s.back + Math.sin(face) * side];
      sim.h = { ...sim.h, p, v: [0, 0, 0], spd: 0, mode: s.place && !s.up ? 'ground' : 'air', crouch: 0, stun: 0, face };
      sim.hold = Boolean(s.follow);
      sim.yaw = face;
      sim.pitch = s.pitch ?? (s.place ? 0.05 : -0.05);
      sim.dragAt = 1e9;
    } else if (s.p) {
      sim.hold = false;
      sim.h = { ...sim.h, p: [...s.p], v: s.v ?? [0, 0, 0], spd: Math.hypot(...(s.v ?? [0, 0, 0])), dir: s.v ? s.v.map((x) => x / Math.hypot(...s.v)) : [0, 0, 1], mode: s.mode, crouch: 0, stun: 0, face: s.yaw };
      sim.yaw = s.look ?? s.yaw;
      sim.pitch = s.pitch;
      sim.dragAt = 1e9;
    }
    // the villains the shot wants (./foes.js): a kind, how many, where (`place`: at the place's door)
    if (s.foes) {
      const [kind, n, where] = s.foes;
      let at = where;
      if (where === 'place') {
        const pl = api.debug.world.places.find((q) => q.id === s.place);
        at = [pl.x, 0, pl.z];
      }
      api.spawn(kind, n, at);
      // (`at: 'foe'`: Mark `back` metres from the last one spawned, on the far side from the place, looking at it)
      if (s.at === 'foe') {
        const e = sim.foes.foes.at(-1);
        const d = [e.p[0] - at[0], 0, e.p[2] - at[2]];
        const dl = Math.hypot(d[0], d[2]) || 1;
        const u = [d[0] / dl, 0, d[2] / dl];
        const face = Math.atan2(-u[0], -u[2]);
        sim.h = { ...sim.h, p: [e.p[0] + u[0] * s.back, e.p[1] - 5, e.p[2] + u[2] * s.back], v: [0, 0, 0], spd: 0, mode: 'air', crouch: 0, stun: 0, face };
        sim.yaw = face;
        sim.pitch = 0.2;
        sim.dragAt = 1e9;
      }
    }
    // Dad, put where the shot wants him (./companions.js takes him on from there)
    if (s.dad === 'porch') api.debug.dad(api.debug.dad().porch);
    else if (s.dad === 'lesson') {
      const dir = [Math.sin(s.yaw), 0, Math.cos(s.yaw)];
      sim.quests = { ...sim.quests, lesson: { ...sim.quests.lesson, on: true, next: 1, t: 3 } };
      api.debug.dad([s.p[0] - dir[0] * 50, s.p[1] + 20, s.p[2] - dir[2] * 50], dir);
    }
    // (a jump isn't a flight: the rings and cards it crossed on the way don't count)
    sim.quests = { ...sim.quests, prev: null };
  }, s);
  // a few frames to settle (and, flat out, to let him go)
  await page.waitForTimeout(s.v ? 2500 : 4000);
  if (s.v) await page.evaluate((s) => Object.assign(window.__INVWORLD__.sim.h, { p: [...s.p] }), s);
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ path: `${out}/inv-${name}.png`, timeout: 180000 });
  const info = await page.evaluate(() => window.__INVWORLD__.api.info());
  console.log(name, 'calls', info.calls, 'tris', info.triangles, 'tier', info.tier);
  // (DUMP=1: what the fight and the brawl hold, for reading a shot that shows something odd)
  if (process.env.DUMP) console.log(name, await page.evaluate(() => JSON.stringify({ rings: window.__INVWORLD__.sim.foes.rings, foes: window.__INVWORLD__.sim.foes.foes.map((e) => [e.id, e.kind, e.state, e.p.map(Math.round)]), brawl: window.__INVWORLD__.sim.brawl, gates: window.__INVWORLD__.sim.gates, marker: window.__INVWORLD__.sim.marker, quests: { lesson: window.__INVWORLD__.sim.quests.lesson.on, rescue: Boolean(window.__INVWORLD__.sim.quests.rescue) }, ruins: [...window.__INVWORLD__.sim.ruins.damage].map(([k, d]) => [k, Math.round(d * 100) / 100, window.__INVWORLD__.sim.world.buildings.find((q) => `b:${q.id}` === k)?.x, window.__INVWORLD__.sim.world.buildings.find((q) => `b:${q.id}` === k)?.z]), towers: (() => { const m = window.__INVWORLD__.api.engine?.scene?.getObjectByName('towers'); if (!m) return 'no towers mesh'; const h = m.geometry.attributes.aHurt; if (!h) return 'no aHurt'; const out = []; for (let i = 0; i < h.count; i++) if (h.array[i] > 0) out.push([i, h.array[i], Math.round(m.instanceMatrix.array[i * 16 + 5] * 10) / 10, m.geometry.attributes.aStyle.array[i * 4 + 3]]); return out; })() })));
  if (s.mission) {
    // (where the shot found him and the step's marker, for reading the shot)
    const w = await page.evaluate(() => {
      const { sim } = window.__INVWORLD__;
      return { at: sim.h.p.map((v) => Math.round(v)), marker: sim.marker?.p?.map((v) => Math.round(v)) ?? null, step: sim.mission?.step ?? null, goal: document.querySelector('.iw-goal')?.textContent ?? '' };
    });
    console.log(name, `mission ${s.mission} step ${w.step} at [${w.at}] marker [${w.marker}] “${w.goal}”`);
    // on to its end, and say so (the story kept says which are done and in what time)
    const r = await page.evaluate(async (s) => {
      await window.__INV_DRIVE__(null, s.finish, s);
      for (let i = 0; i < 20 && window.__INVWORLD__.sim.mission; i++) await new Promise((r) => setTimeout(r, 250));
      const story = window.__INVWORLD__.api.story();
      return { done: story.done.includes(s.mission), best: story.best[s.mission] ?? null, left: window.__INVWORLD__.sim.mission?.step ?? null };
    }, s);
    console.log(name, `mission ${s.mission}`, r.done ? (r.best ? `done in ${r.best.toFixed(1)} s` : 'done') : `not done (step ${r.left})`);
  }
  if (metrics) {
    // where he is on the canvas: the middle of him (sim.h.p is his feet), through the scene's camera
    const at = await page.evaluate(() => {
      const { api, sim } = window.__INVWORLD__;
      const r = document.querySelector('.iw-canvas').getBoundingClientRect();
      const p = sim.h.p;
      return { rect: { x: r.left, y: r.top, w: r.width, h: r.height }, at: api.project([p[0], p[1] + 0.9, p[2]]) };
    });
    const m = await measure(png, at);
    console.log(name, `band=${m.band.toFixed(3)}`, `mark=${m.mark === null ? 'off' : m.mark.toFixed(3)}`);
    if (process.env.BOX) await boxed(png, `${out}/inv-${name}.box.png`, at);
  }
}
// the season, played (./inv-world-play.mjs): each episode moved through by Mark, then judged by the story kept
let failed = 0;
if (plays.length) {
  await installPlayer(page);
  for (const ep of plays) {
    const r = await play(page, ep);
    if (!r.done) failed++;
    console.log(`play ${ep}`, r.done ? `done in ${r.best?.toFixed(1)} s of game, ${r.wall.toFixed(0)} s here` : `NOT done (${r.why ?? 'stopped'}${r.left ? `, step ${r.left.step}, ${r.left.count} counted` : ''}) after ${r.wall.toFixed(0)} s`);
    if (process.env.PLAYSHOTS) await page.screenshot({ path: `${out}/play-${ep}.png` });
  }
}
console.log(errors.length ? `errors:\n${errors.slice(0, 12).join('\n')}` : 'no page errors');
await browser.close();
if (failed || (plays.length && errors.length)) process.exit(1);
