/* global window, document */
// A browser check of the galaxy's flight HUD (galaxy/FlightCluster.jsx, cluster.js, radar.js, radarDraw.js, KeysCard.jsx; the
// course on the HUD: pages/Galaxy.jsx and scene.js). With the dev server up (npx vite --port 5188 --host 127.0.0.1, or BASE= for
// another), and after the galaxy map check's parts (galaxy-map-check/lib.mjs: the browser, the check line):
//   BASE=http://127.0.0.1:5188 OUT=/tmp/hud node scripts/galaxy-hud-check.mjs
// At 1440x900, 1280x720, 1366x657, 1152x720, 900x700 (the panel open: little room left of it), and 390x844 and 375x667 (with a touch
// screen's rules: Chromium won't emulate the pointer, so the page's own `(pointer: coarse)` rules are turned on in place): opens
// #/galaxy, flies the X-wing two seconds, forces a battle sworn to the Rebellion, and
//   cluster: it's shown; no two of its parts, the jump button, the Galaxy map and Keys chips, the flight settings' button, the
//     multiplayer pill, the war's lines, the comms (when none's speaking: they're over the cluster's corner on a phone, and drawn
//     above it), the touch buttons (Fire, Boost, View, the climbs) and the power tiles meet (by measured box), and all are inside
//     the window; the jump button (the nose on a star) is clear of the cluster in a narrow window too; nothing in it a player reads is under 0.7 rem (11.2 px); each power tile's middle takes a click; on a
//     desktop the tiles say where they stand in words and a refused press says why (the big one, not charged yet)
//   keys: the card is up before the first flight (a desktop's) and clear of the cluster, gone once flown, back from the Keys chip
//   radar: drawn, with allies on it in the battle and the way to go; with the way to go (the course) turned right and left of the
//     nose, its dot is on the side the star is on screen (the camera's projection) and straight ahead it's at the top
//   target: T locks one, and its name is in the cluster
//   course: M, "endo" + Enter plots Endor, M again: the HUD's way-to-go says "Course: Endor" ("· J" on a keyboard only), and J
//     (with the nose on no star) starts the jump; on a touch screen that's a Jump to Endor button, which a keyboard doesn't show
// SIZES=900x700,375x667 runs only those (and 844x390, a touch phone on its side, runs only so). With a scenario's name as the argument, that alone runs, at 1440x900 (shots in OUT):
//   pickups: a pickup dropped ahead is drawn, on the radar, taken by flying through (the rapid-fire chip; the repair kit's
//     deflectors; the bubble's points; the power cell's charge), spins unless motion is reduced, is not taken in a jump's
//     alignment and gone once the jump is committed (galaxy-hud-check/pickups.mjs)
//   hangar: the Shipyard's button beside the flight settings', H and Escape, the yard shut under the galaxy map and mid-jump, twin
//     cannons fitted and flying (the guns' cadence), kept under the universe map's keys (galaxy-hud-check/hangar.mjs)
//   difficulty: flown at Outlaw, the hunters read it and the shields come back at its rate; with reduced motion (no hunters),
//     no page errors (galaxy-hud-check/difficulty.mjs)
// Prints a line per check, ok or FAIL, and exits 1 on any FAIL. Shots are in OUT (hud-<size>.png, hud-<size>-keys.png).
import { writeFileSync } from 'node:fs';
import { browser, check, problems, out } from './galaxy-map-check/lib.mjs';
import { hold, open as baseOpen, settle, smallText } from './galaxy-hud-check/lib.mjs';
import { pickups } from './galaxy-hud-check/pickups.mjs';
import { hangar } from './galaxy-hud-check/hangar.mjs';
import { difficulty } from './galaxy-hud-check/difficulty.mjs';

// (a galaxy at Tatooine, flown in an X-wing, nothing else open, the first-flight keys card up: lib.mjs's, with a touch screen's rules on after)
const open = async (viewport, touch) => {
  const opened = await baseOpen(viewport);
  if (touch) await asTouch(opened.page);
  return opened;
};

// the page's own `(pointer: coarse)` rules on, its `(pointer: fine)` ones off, in place (a media rule's list is writable)
const asTouch = (page) =>
  page.evaluate(() => {
    let n = 0;
    const walk = (rules) => {
      for (const r of rules) {
        if (r.media) {
          const was = r.media.mediaText;
          const next = was.replaceAll('(pointer: coarse)', '(min-width: 0px)').replaceAll('(pointer: fine)', '(max-width: 0px)').replaceAll('(hover: hover)', '(max-width: 0px)').replaceAll('(hover: none)', '(min-width: 0px)');
          if (next !== was) {
            r.media.mediaText = next;
            n++;
          }
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* a sheet from another origin */
      }
    }
    // (and what the scripts ask: the course's label has the key only where there's a keyboard)
    const ask = window.matchMedia.bind(window);
    window.matchMedia = (q) => ask(String(q).replaceAll('(pointer: coarse)', '(min-width: 0px)').replaceAll('(pointer: fine)', '(max-width: 0px)'));
    return n;
  });

// what's shown over the flight, by measured box: [{ name, r }]
const PARTS = [
  ['radar', '.fc-radar'],
  ['ship', '.fc-ship'],
  ['target', '.fc-target'],
  ['power G', '.hud-power[data-slot="primary"]'],
  ['power X', '.hud-power[data-slot="ultimate"]'],
  ['jump', '.galaxy-jumpbtn:not([data-course])'],
  ['galaxy map', '.galaxy-mapbtn'],
  ['keys chip', '.galaxy-keysbtn'],
  ['keys card', '.galaxy-keys'],
  ['settings', '.universe-settings-btn'],
  ['shipyard', '.universe-hangar-btn'],
  ['multiplayer', '.universe-online-pill'],
  ['war line', '.galaxy-warhud-line'],
  ['war stage', '.galaxy-warhud-stage'],
  ['comms', '.universe-comms .universe-line'],
  ['chip', '.fc-buff'],
  ['jump course', '.galaxy-jumpbtn[data-course]'],
  ['fire', '.universe-fire'],
  ['boost', '.universe-boost'],
  ['view', '.universe-view'],
  ['climb up', '.universe-climbs > .universe-climb:nth-child(1)'],
  ['climb down', '.universe-climbs > .universe-climb:nth-child(2)'],
];
const boxes = (page) =>
  page.evaluate((parts) => {
    const out = [];
    for (const [name, sel] of parts) {
      // (the effects' chips are a row of them: all counted)
      for (const el of name === 'chip' ? document.querySelectorAll(sel) : [document.querySelector(sel)]) {
        if (!el || !el.checkVisibility({ visibilityProperty: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ name, l: r.left, t: r.top, r: r.right, b: r.bottom });
      }
    }
    return out;
  }, PARTS);
// (the war's lines and the comms are the page's, over the touch buttons on a phone already: they're held against what this HUD put
// there, the radar, the ship's block, the target, the keys and the jump button; the comms too only where the screen is tall enough
// for the left column to clear them, `tall`: a short phone's has them over the radar when they speak, drawn above it)
const THEIRS = ['war line', 'war stage', 'comms'];
const MINE = ['radar', 'ship', 'target', 'keys chip', 'keys card', 'jump', 'jump course', 'chip', 'shipyard'];
const meets = (bs, tall = true) => {
  const out = [];
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];
      if (THEIRS.includes(a.name) !== THEIRS.includes(b.name) && !MINE.includes(THEIRS.includes(a.name) ? b.name : a.name)) continue;
      if ((a.name === 'comms' || b.name === 'comms') && !tall) continue;
      if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) out.push(`${a.name}/${b.name}`);
    }
  return out;
};

// the radar's canvas: how many pixels are drawn, and the centre of those within `hue`'s colours (a predicate on r, g, b)
const radarPixels = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector('.fc-radar');
    const g = cv.getContext('2d');
    const { data, width, height } = g.getImageData(0, 0, cv.width, cv.height);
    const hues = {
      ally: (r, gr, b) => gr > 200 && r < 160 && b < 190,
      hostile: (r, gr, b) => r > 220 && gr < 120 && b < 110,
      goal: (r, gr, b) => r > 220 && gr > 170 && gr < 235 && b < 150,
    };
    const res = { drawn: 0, width, height };
    for (const k of Object.keys(hues)) res[k] = { n: 0, x: 0, y: 0 };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 8) continue;
        res.drawn++;
        if (data[i + 3] < 90) continue;
        for (const [k, f] of Object.entries(hues))
          if (f(data[i], data[i + 1], data[i + 2])) {
            res[k].n++;
            res[k].x += x;
            res[k].y += y;
          }
      }
    for (const k of Object.keys(hues)) if (res[k].n) (res[k].x /= res[k].n * width), (res[k].y /= res[k].n * height); // (as a share of the canvas)
    return res;
  });

// (till nobody's speaking on the comms: a line is up for a few seconds)
const quiet = (page) => page.waitForFunction(() => !document.querySelector('.universe-comms .universe-line'), null, { timeout: 20000 }).catch(() => {});

// the radar as drawn, to look at when its checks fail
const saveRadar = async (page, name) => {
  const url = await page.evaluate(() => document.querySelector('.fc-radar').toDataURL('image/png'));
  writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
};

async function run(viewport, touch) {
  const size = `${viewport.width}x${viewport.height}${touch ? ' touch' : ''}`;
  const file = `${viewport.width}x${viewport.height}`;
  const say = (ok, what) => check(ok, `${size}: ${what}`);
  const { ctx, page, errors } = await open(viewport, touch);
  try {
    const G = (fn, arg) => page.evaluate(fn, arg);
    const tall = !touch || viewport.height >= 780;

    // keys: before the first flight a desktop has the card
    if (!touch && viewport.width <= 1100) {
      // (too narrow for the card beside the open panel: the first-flight line instead)
      const k = await boxes(page);
      say(!k.some((b) => b.name === 'keys card') && k.some((b) => b.name === 'keys chip'), 'a window too narrow for the keys card has the Keys chip, and no card');
      // (it's up unless the nose is on a star at the start, when the jump button has its place: .galaxy-jumpbtn ~ .universe-hint)
      say(await G(() => Boolean(document.querySelector('.galaxy-hint')?.checkVisibility() || document.querySelector('.galaxy-jumpbtn'))), 'and the first-flight line says how to fly');
    } else if (!touch) {
      const k = await boxes(page);
      const card = k.find((b) => b.name === 'keys card');
      say(Boolean(card) && k.some((b) => b.name === 'keys chip'), 'the keys card is up before the first flight, and the Keys chip is there');
      say(meets(k, tall).length === 0, `and meets nothing${meets(k, tall).length ? ` (${meets(k, tall).join(', ')})` : ''}`);
      say((await smallText(page, '.galaxy-keys')).length === 0, 'and nothing in it is under 0.7 rem');
      await page.screenshot({ path: `${out}/hud-${file}-keys.png` });
    }

    // fly, and a battle
    await hold(page, 'w', 2000);
    say(!(await page.locator('.galaxy-keys').count()), touch ? 'no keys card on a touch screen' : 'the keys card is gone once flown');
    const home = await G(() => {
      const s = window.__galaxy().ship;
      return { x: s.x, y: s.y, z: s.z, heading: s.heading };
    });
    await G(() => window.__galaxyOath?.swear('rebel'));
    // (a battle forced, again if it's not begun: the first can come before the system's ready for one)
    for (let i = 0; i < 4 && !(await G(() => Boolean(window.__galaxyDebug.war.battle))); i++) {
      await G(() => window.__galaxyDebug.war.force('empire', 'skirmish'));
      await page.waitForFunction(() => Boolean(window.__galaxyDebug.war.battle), null, { timeout: 10000 }).catch(() => {});
    }
    await G(() => window.__galaxyDebug.war.skip(6));
    // (the comms are measured too on a phone, where they're over the cluster's corner: begun when none's speaking, and not waited for
    // with the ship among the fighters, where it crashes)
    if (touch) await quiet(page);
    // (the ship among the other side's fighters, facing their middle, safe from them)
    await G(() => {
      const d = window.__galaxyDebug;
      const b = d.war.battle;
      const them = b.fighters.filter((f) => f.alive && f.team !== b.you.team);
      const c = them.reduce((a, f) => ({ x: a.x + f.pos.x / them.length, y: a.y + f.pos.y / them.length, z: a.z + f.pos.z / them.length }), { x: 0, y: 0, z: 0 });
      d.pin({ x: c.x + 12, y: c.y + 2, z: c.z, heading: Math.PI / 2, pitch: -0.1, bank: 0 });
      d.state.safeUntil = 1e12;
      d.state.shield = 100;
    });
    await settle(page, 3000);

    // the cluster, shown, nothing meeting (the comms are transient, and over the cluster's corner on a phone: measured when none's speaking)
    await page.keyboard.down('w');
    await settle(page, 900);
    const on = await G(() => document.querySelector('.fc')?.hasAttribute('data-on') ?? false);
    say(on, 'the flight cluster is shown');
    const bs = await boxes(page);
    const names = bs.map((b) => b.name);
    for (const want of ['radar', 'ship', 'power G', 'power X', 'galaxy map', 'keys chip', 'settings', 'shipyard']) if (!(touch && (want === 'keys chip' || want === 'shipyard'))) say(names.includes(want), `${want} is shown`);
    if (touch) for (const want of ['fire', 'boost', 'view', 'climb up', 'climb down']) say(names.includes(want), `${want} (a touch button) is shown`);
    if (touch) say(await G(() => Boolean(document.querySelector('.galaxy-yard-link')) && !document.querySelector('.universe-hangar-btn')?.checkVisibility()), 'the Shipyard is the panel’s “Open the shipyard” on a touch screen, not a button in the crowded corner');
    else if (viewport.width > 1100) say(names.includes('target'), 'the target block is shown');
    const m = meets(bs, tall);
    say(m.length === 0, `no two of the ${bs.length} parts shown meet${m.length ? ` (${m.join(', ')})` : ''}`);
    const out_ = bs.filter((b) => b.l < -0.5 || b.t < -0.5 || b.r > viewport.width + 0.5 || b.b > viewport.height + 0.5).map((b) => b.name);
    say(out_.length === 0, `and all are inside the window${out_.length ? ` (${out_.join(', ')})` : ''}`);
    const small = await smallText(page, '.fc');
    say(small.length === 0, `nothing in the cluster is under 0.7 rem${small.length ? ` (${small.slice(0, 4).join('; ')})` : ''}`);
    const clicks = await G(() =>
      [...document.querySelectorAll('.hud-power')].map((t) => {
        const a = t.getBoundingClientRect();
        const hit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
        return Boolean(hit && t.contains(hit));
      }),
    );
    say(clicks.length === 2 && clicks.every(Boolean), 'a click at each power tile\'s middle lands on it');
    if (!touch) {
      const words = await G(() => [...document.querySelectorAll('.hud-power-state')].map((e) => e.textContent));
      say(words.length === 2 && words.every(Boolean), `each power says where it stands (${words.join(' / ')})`);
      // (a press on a power that isn't ready: the big one while it charges, else the crew's own, pressed twice, the second while it's on)
      const centre = (slot) =>
        G((sl) => {
          const a = document.querySelector(`.hud-power[data-slot="${sl}"]`).getBoundingClientRect();
          return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
        }, slot);
      let slot = (await G(() => [...document.querySelectorAll('.hud-power')].find((t) => t.dataset.phase !== 'ready')?.dataset.slot)) ?? null;
      if (!slot) {
        const c = await centre('primary');
        await page.mouse.click(c.x, c.y);
        await settle(page, 300);
        slot = 'primary';
      }
      const c = await centre(slot);
      await page.mouse.click(c.x, c.y);
      await settle(page, 300);
      const no = await G((sl) => {
        const t = document.querySelector(`.hud-power[data-slot="${sl}"]`);
        return { denied: t.hasAttribute('data-denied'), word: t.querySelector('.hud-power-state').textContent };
      }, slot);
      say(no.denied && no.word.length > 0, `a press on a power that isn't ready (${slot}) is refused and says why (${no.word})`);
    }
    const n = await G(() => ({ shield: document.querySelector('.hud-vitals-n')?.textContent, kills: document.querySelector('.fc-kills-n')?.textContent, speed: document.querySelector('.fc-speed-n')?.textContent }));
    say(/^\d+%$/.test(n.shield ?? ''), `the deflectors read a percentage (${n.shield})`);
    say(/^\d+$/.test(n.kills ?? ''), `and the kills a number (${n.kills})`);
    await page.screenshot({ path: `${out}/hud-${file}${touch ? '-touch' : ''}.png` });
    await page.keyboard.up('w');

    // the pickups' chips, three at once (the most there are: a bubble, rapid fire and overcharge): shown, inside the window and clear
    // of everything else the cluster, the buttons and the war's lines have there
    await G(() => ['rapid', 'bubble', 'overcharge'].forEach((k) => window.__galaxyDebug.pickups.give(k)));
    await settle(page, 700);
    const chipped = await boxes(page);
    const chips = chipped.filter((b) => b.name === 'chip');
    say(chips.length === 3, `three effects are three chips (${chips.length})`);
    const mchips = meets(chipped, tall);
    say(mchips.length === 0, `and they meet nothing${mchips.length ? ` (${mchips.join(', ')})` : ''}`);
    const outChip = chips.filter((b) => b.l < -0.5 || b.t < -0.5 || b.r > viewport.width + 0.5 || b.b > viewport.height + 0.5);
    say(outChip.length === 0, 'and are inside the window');
    await page.screenshot({ path: `${out}/hud-${file}${touch ? '-touch' : ''}-chips.png` });
    await G(() => window.__galaxyDebug.pickups.clear());
    await settle(page, 300);

    // (a touch screen) Fire, pressed and the thumb drifting off it, still fires till it lifts
    if (touch) {
      const b = await page.locator('.universe-fire').boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 - 90, b.y + b.height / 2 - 60, { steps: 6 });
      await settle(page, 300);
      const held = await G(() => window.__galaxyDebug.state.fireBtn);
      await page.mouse.up();
      await settle(page, 100);
      const after = await G(() => window.__galaxyDebug.state.fireBtn);
      say(held && after === false, `Fire holds as the thumb drifts (${held}, ${after})`);
    }

    // the radar: drawn, with the battle's allies on it
    const px = await radarPixels(page);
    say(px.drawn > 300, `the radar is drawn (${px.drawn} px)`);
    say(px.ally.n > 5 || px.hostile.n > 5, `with the battle's ships on it (${px.ally.n} green px, ${px.hostile.n} red)`);

    // the target
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('t');
    await settle(page, 500);
    if (!touch && viewport.width > 1100) {
      const name = await G(() => document.querySelector('.fc-target-name')?.textContent ?? '');
      say(name.length > 0, `T locks a target and the cluster names it (${name})`);
    }

    // (the battle over, no lock to pull the nose round, and back where the flight began, clear of the hulls: a crash into one would end
    // the HUD there, and the jump)
    await G(() => {
      const d = window.__galaxyDebug;
      d.war.win(0);
      d.hunters?.clear?.();
      d.state.lock = null;
    });
    await page.waitForFunction(() => !window.__galaxyDebug.state.crash, null, { timeout: 20000 });
    await G((h) => window.__galaxyDebug.pin({ ...h, pitch: 0, bank: 0 }), home);
    await settle(page, 600);

    // the course: plotted on the map, kept on the HUD
    await page.keyboard.press('m');
    await page.waitForSelector('.holomap', { timeout: 10000 });
    await settle(page, 700);
    await page.keyboard.press('/');
    await page.keyboard.type('endo');
    await page.keyboard.press('Enter');
    await settle(page, 600);
    await page.keyboard.press('m'); // (the pick has the focus on its jump button now, not on the find)
    await page.waitForFunction(() => !document.querySelector('.holomap'), null, { timeout: 10000 });
    await settle(page, 800);
    const nav = await G(() => {
      const e = document.querySelector('.universe-nav');
      return { on: e?.hasAttribute('data-on') ?? false, name: e?.querySelector('.universe-nav-name')?.textContent ?? '' };
    });
    say(nav.on && /^Course: Endor/.test(nav.name), `the plotted course is on the HUD (${nav.name || 'nothing'})`);
    say(/ · J$/.test(nav.name) === !touch, touch ? 'and says no key (a touch screen has none)' : 'and the key');

    // the radar's way to go: right is right, ahead is the top
    const pose = await G(() => {
      const d = window.__galaxyDebug;
      const s = d.state.ship;
      const g = d.state.navGoal;
      const dx = g[0] - s.x;
      const dz = g[2] - s.z;
      const dy = g[1] - s.y;
      return { x: s.x, y: s.y, z: s.z, toward: Math.atan2(-dx, -dz), rise: Math.asin(dy / Math.hypot(dx, dy, dz)) };
    });
    const sides = [];
    for (const turn of [0.7, -0.7, 0]) {
      // (dead ahead takes the star's height too, so the nose is on it: the jump button's up)
      await G(({ p, turn }) => window.__galaxyDebug.pin({ x: p.x, y: p.y, z: p.z, heading: p.toward + turn, pitch: turn === 0 ? p.rise : 0, bank: 0 }), { p: pose, turn });
      await settle(page, 700);
      const r = await G(() => {
        const d = window.__galaxyDebug;
        const g = d.state.navGoal;
        const v = new d.THREE.Vector3(g[0], g[1], g[2]);
        d.camera.updateMatrixWorld();
        v.project(d.camera);
        return { ndcX: v.x, ndcZ: v.z };
      });
      const px = await radarPixels(page);
      sides.push({ turn, ndcX: r.ndcX, goal: px.goal });
      if (process.env.RADAR) await saveRadar(page, `radar-${file}-turn${turn}`);
    }
    const [right, left, ahead] = sides;
    // (the nose on Endor's star, dead ahead: the jump button is up, and clear of the cluster)
    // (the aim is the sight from the chase camera, behind and above the ship, through the reticle: a few hundredths of a radian off the
    // nose, so the nose is raised a little till the star's under it)
    for (const lift of [0, 0.03, 0.06, 0.09, -0.03, 0.12]) {
      if ((await G(() => window.__galaxy().aim)) === 'endor') break;
      await G(({ p, lift }) => window.__galaxyDebug.pin({ x: p.x, y: p.y, z: p.z, heading: p.toward, pitch: p.rise + lift, bank: 0 }), { p: pose, lift });
      await settle(page, 700);
    }
    await quiet(page);
    const aimedBoxes = await boxes(page);
    say(aimedBoxes.some((b) => b.name === 'jump'), 'the jump button is shown with the nose on a star');
    const aimedMeets = meets(aimedBoxes, tall);
    say(aimedMeets.length === 0, `and nothing meets it, or anything else shown${aimedMeets.length ? ` (${aimedMeets.join(', ')})` : ''}`);
    // (turned left of the star by 0.7, the star is to the right: on the screen and on the radar, both)
    const side = (s) => (s.goal.n ? (s.goal.x > 0.5 ? 'right' : 'left') : 'none');
    say(right.ndcX > 0.05 && side(right) === 'right', `a star to the right on the screen (${right.ndcX.toFixed(2)}) is on the radar's right (x ${right.goal.x.toFixed(2)})`);
    say(left.ndcX < -0.05 && side(left) === 'left', `and one to the left (${left.ndcX.toFixed(2)}) on its left (x ${left.goal.x.toFixed(2)})`);
    say(ahead.goal.n > 0 && Math.abs(ahead.goal.x - 0.5) < 0.06 && ahead.goal.y < 0.2, `and one dead ahead at the top (x ${ahead.goal.x.toFixed(2)}, y ${ahead.goal.y.toFixed(2)})`);

    // J with the nose on no star: to the course
    let free = false;
    for (let turn = 1.4; turn < 3.2 && !free; turn += 0.35) {
      await G(({ p, turn }) => window.__galaxyDebug.pin({ x: p.x, y: p.y, z: p.z, heading: p.toward + turn, pitch: 0, bank: 0 }), { p: pose, turn });
      await settle(page, 400);
      free = (await G(() => window.__galaxy().aim)) === null;
    }
    say(free, 'the nose is on no star');
    await page.evaluate(() => document.activeElement?.blur?.());
    await quiet(page);
    const courseBtn = await boxes(page);
    const btn = courseBtn.find((b) => b.name === 'jump course');
    say(touch ? Boolean(btn) : !btn, touch ? 'a touch screen has a Jump to Endor button, with no star under the nose' : 'a keyboard has no button for the course (it has J)');
    if (touch) {
      const mc = meets(courseBtn, tall);
      say(mc.length === 0, `and it meets nothing${mc.length ? ` (${mc.join(', ')})` : ''}`);
      await page.locator('.galaxy-jumpbtn[data-course]').click();
    } else await page.keyboard.press('j');
    await settle(page, 800);
    const jumping = await G(() => window.__galaxy().jump);
    say(jumping?.to === 'endor', `${touch ? 'the button' : 'J'} jumps to the course (${JSON.stringify(jumping)})`);

    say(errors.length === 0, `no page errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
  } finally {
    await ctx.close().catch(() => {}); // (a failed run leaves no browser behind)
  }
}

const stopped = (size, e) => check(false, `${size}: the check stopped: ${String(e.message).split('\n')[0]}`);
const SIZES = [[1440, 900], [1280, 720], [1366, 657], [1152, 720], [900, 700], [390, 844, true], [375, 667, true]];
const ASKED = [[844, 390, true]]; // (run only when SIZES names it: the touch HUD's parts still meet there, a phone on its side)
const only = process.env.SIZES?.split(',');
// (`pickups` as the argument runs that scenario alone, galaxy-hud-check/pickups.mjs; none runs the flight HUD's sizes)
const scenario = process.argv[2];
if (scenario === 'pickups') await pickups().catch((e) => stopped('pickups', e));
else if (scenario === 'hangar') await hangar().catch((e) => stopped('hangar', e));
else if (scenario === 'difficulty') await difficulty().catch((e) => stopped('difficulty', e));
else if (scenario) check(false, `no scenario called ${scenario} (pickups, hangar, difficulty)`);
else
  for (const [width, height, touch = false] of only ? [...SIZES, ...ASKED] : SIZES) {
    if (only && !only.includes(`${width}x${height}`)) continue;
    await run({ width, height }, touch).catch((e) => stopped(`${width}x${height}`, e));
  }
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall ok');
process.exit(problems.length ? 1 : 0);
