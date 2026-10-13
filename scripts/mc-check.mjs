/* global window, document, requestAnimationFrame */
// A browser check of the Minecraft tribute (src/components/minecraft/): with
// the dev server up (npx vite --port 5188 --strictPort --host 127.0.0.1),
//   OUT=/tmp/shots node scripts/mc-check.mjs
// It opens #/dot-matrix/minecraft, waits for the world module and 25 loaded
// chunks, screenshots the title, starts, walks forward for 3 seconds,
// jumps, and screenshots that; it prints the player's place, the chunks
// loaded and drawn, the draw calls and a frame's time, and fails on any page
// error. Headless Chromium draws in software unless GPU=1: the waits are long.
// On Windows set CHROME to Edge ("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe").
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const seed = process.env.SEED ?? '1';
const size = { width: Number(process.env.W ?? 1100), height: Number(process.env.H ?? 700) };
const gpu = process.env.GPU === '1';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=default'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
await ctx.addInitScript((seed) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
  // (the guide's note for a first visit would sit over the shots)
  window.localStorage.setItem('tp-guide-seen', JSON.stringify(['/dot-matrix/minecraft']));
  // a known world, so the shots compare from run to run (once: a reload must find the save)
  if (!window.sessionStorage.getItem('mc-check')) {
    window.sessionStorage.setItem('mc-check', '1');
    window.localStorage.setItem('tp-mc', JSON.stringify({ v: 1, data: { seed: Number(seed) } }));
  }
}, seed);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const world = () => 'window.__RUNTIME__?.current?.module?.id === "minecraft" ? window.__RUNTIME__.current.world : null';

const state = (label) =>
  page.evaluate(
    ([label, w]) => {
      const world = eval(w);
      const g = world?.game;
      const p = g?.player;
      return { label, status: window.__RUNTIME__?.status, seed: g?.seed, ticks: g?.ticks, player: p ? [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2), p.onGround] : null, ...world?.debug.stats() };
    },
    [label, world()],
  );
// the 3D read straight off the GL context (a software-drawn canvas's screenshot can come back cleared), and the page
const shot = async (name) => {
  const r = await page.evaluate((w) => {
    const world = eval(w);
    const gl = window.__RUNTIME__?.gfx?.renderer?.getContext();
    if (!world || !gl) return null;
    const t = performance.now();
    world.draw();
    gl.finish();
    const ms = performance.now() - t;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = '';
    for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode(...px.subarray(i, i + 0x8000));
    return { W, H, ms, data: btoa(s) };
  }, world());
  if (r) {
    await sharp(Buffer.from(r.data, 'base64'), { raw: { width: r.W, height: r.H, channels: 4 } }).flip().removeAlpha().png().toFile(`${out}/mc-${name}-3d.png`);
    console.log(`  a frame drawn in ${r.ms.toFixed(1)} ms`);
  }
  await page.screenshot({ path: `${out}/mc-${name}.png`, timeout: 180000 }).catch((e) => console.log('shot failed', name, String(e).slice(0, 120)));
};
const step = async (label) => {
  console.log(JSON.stringify(await state(label)));
  await shot(label);
};
const until = (cond, arg) => page.waitForFunction(([w, cond, arg]) => { const x = eval(w); return Boolean(x) && new Function('g', 'w', 'arg', `return ${cond}`)(x.game, x, arg); }, [world(), cond, arg], { timeout: 600000, polling: 250 });
const ticks = async (n) => {
  const t0 = await page.evaluate((w) => eval(w).game.ticks, world());
  await until('g.ticks >= arg', t0 + n);
};

await page.goto(`${base}/#/dot-matrix/minecraft`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction((w) => Boolean(eval(w)) && window.__RUNTIME__?.status === 'on', world(), { timeout: 300000 });
await until('g.world.chunks.size >= 25');
await step('title');

await page.click('.mc-title .mc-btn');
await until("document.querySelector('.mc-hotbar') && g.world.loaded(g.player.x, g.player.z)");
await ticks(10);
await step('play');

await page.keyboard.down('KeyW');
await ticks(60);
await page.keyboard.press('Space');
await page.keyboard.up('KeyW');
await ticks(20);
await step('walk');
// frames a second with the whole view loaded, counted off the runtime's own frames
const fps = await page.evaluate((w) => new Promise((done) => {
  const g = eval(w).game;
  let frames = 0;
  const t0 = performance.now();
  const count = () => {
    frames++;
    if (performance.now() - t0 < 3000) requestAnimationFrame(count);
    else done({ fps: (frames / (performance.now() - t0)) * 1000, ticks: g.ticks });
  };
  requestAnimationFrame(count);
}), world());
console.log(`  ${fps.fps.toFixed(1)} frames a second`);

// turn round and look down the hill
await page.evaluate((w) => {
  const g = eval(w).game;
  g.player.yaw += Math.PI * 0.75;
  g.player.pitch = -0.35;
}, world());
await ticks(4);
await step('look');

// ── dig and build: a tree into planks, a table and a pickaxe, a wall, and back after a reload ──
const run = (body, ...args) => page.evaluate(([w, body, args]) => new Function('x', 'g', 'args', body)(eval(w), eval(w).game, args), [world(), body, args]);
const log = await run('return x.debug.standBy();');
console.log('tree:', JSON.stringify(log));
if (log) {
  const cut = async (y) => {
    await run('x.debug.aim(args[0], args[1], args[2]); x.press("attack", true);', log.x, y, log.z);
    await until('g.world.get(arg[0], arg[1], arg[2]) !== arg[3]', [log.x, y, log.z, log.id]);
    await run('x.press("attack", false);');
  };
  for (let i = 0; i < 3; i++) await cut(log.y + i);
  await ticks(20);
  await step('cut');
  const have = await run('return g.inventory.slots.filter(Boolean).map((s) => s.item + " " + s.count);');
  console.log('  holding:', have.join(', '));

  // the inventory: three logs to twelve planks, four to a table, two to sticks
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.mc-panel');
  const click = (where) => run('x.click(args[0]);', where);
  const slotOf = (item) => run('return x.debug.slotOf(args[0]);', item);
  const logSlot = await run('return g.inventory.slots.findIndex((s) => /_log$/.test(s?.item ?? ""));');
  await click({ area: 'inv', index: logSlot });
  await click({ area: 'grid', index: 0 });
  await click({ area: 'result', shift: true });
  const planksName = await run('return g.inventory.slots.find((s) => /_planks$/.test(s?.item ?? "")).item;');
  let planks = await slotOf(planksName);
  await click({ area: 'inv', index: planks });
  for (const i of [0, 1, 2, 3]) await click({ area: 'grid', index: i, button: 'right' });
  await click({ area: 'inv', index: planks });
  await click({ area: 'result' });
  await click({ area: 'inv', index: 8 });
  await click({ area: 'inv', index: planks });
  for (const i of [0, 2]) await click({ area: 'grid', index: i, button: 'right' });
  await click({ area: 'inv', index: planks });
  await click({ area: 'result', shift: true });
  await page.waitForTimeout(300);
  await step('inventory');
  await page.keyboard.press('KeyE');
  await until("!document.querySelector('.mc-panel')");

  // the table, put down where the tree stood, and used: a pickaxe
  // (a fern or grass in the way is picked first, as the game picks plants: clear it)
  for (let i = 0; i < 3; i++) {
    const inWay = await run('x.debug.aim(args[0], args[1] - 1, args[2]); return g.cursor && (g.cursor.x !== args[0] || g.cursor.y !== args[1] - 1 || g.cursor.z !== args[2]) ? g.cursor : null;', log.x, log.y, log.z);
    if (!inWay) break;
    await run('x.press("attack", true);');
    await ticks(8);
    await run('x.press("attack", false);');
  }
  await run('x.select(8); x.debug.aim(args[0], args[1] - 1, args[2]); x.press("use", true);', log.x, log.y, log.z);
  await ticks(2);
  console.log('  placing:', JSON.stringify(await run('return { mode: x.game && document.querySelector(".mc-panel") ? "screen" : "play", cursor: g.cursor, held: g.inventory.slots[g.inventory.selected], player: [g.player.x, g.player.y, g.player.z] };')));
  await run('x.press("use", false);');
  const table = await run('return x.debug.nearest("^crafting_table$", 6);');
  console.log('  table placed:', JSON.stringify(table));
  await run('x.debug.aim(args[0], args[1], args[2]); x.press("use", true);', table.x, table.y, table.z);
  await ticks(2);
  await run('x.press("use", false);');
  await page.waitForSelector('.mc-panel');
  planks = await slotOf(planksName);
  await click({ area: 'inv', index: planks });
  for (const i of [0, 1, 2]) await click({ area: 'grid', index: i, button: 'right' });
  await click({ area: 'inv', index: planks });
  const sticks = await slotOf('stick');
  await click({ area: 'inv', index: sticks });
  for (const i of [4, 7]) await click({ area: 'grid', index: i, button: 'right' });
  await click({ area: 'inv', index: sticks });
  await click({ area: 'result' });
  await click({ area: 'inv', index: 7 });
  await page.waitForTimeout(300);
  await step('table');
  await page.keyboard.press('KeyE');
  await until("!document.querySelector('.mc-panel')");
  console.log('  pickaxe:', (await slotOf('wooden_pickaxe')) >= 0);

  // what's left of the planks as a post beside the player, one on another (east, clear of the table)
  const placeOn = async (x, y, z) => {
    // aim at the top of (x, y, z); a fern or grass picked on the way is cleared first
    for (let i = 0; i < 3; i++) {
      const inWay = await run('x.debug.aim(args[0], args[1], args[2], 0.5, 0.98, 0.5); const c = g.cursor; return c && (c.x !== args[0] || c.y !== args[1] || c.z !== args[2]) ? c : null;', x, y, z);
      if (!inWay) break;
      await run('x.press("attack", true);');
      await ticks(8);
      await run('x.press("attack", false);');
    }
    await run('x.debug.aim(args[0], args[1], args[2], 0.5, 0.98, 0.5); x.press("use", true);', x, y, z);
    await ticks(1);
    await run('x.press("use", false);');
    await ticks(6);
  };
  const here = await run('return { x: Math.floor(g.player.x), y: Math.floor(g.player.y), z: Math.floor(g.player.z) };');
  planks = await slotOf(planksName);
  if (planks >= 0 && planks < 9) {
    await run('x.select(args[0]);', planks);
    for (let i = 0; i < 2; i++) await placeOn(here.x + 1, here.y - 1 + i, here.z);
  }
  const post = await run('return [0, 1].map((i) => g.world.get(args[0] + 1, args[1] + i, args[2]));', here.x, here.y, here.z);
  if (post.some((id) => id === 0)) errors.push('the post was not built');
  console.log('  post:', JSON.stringify(post));
  await run('x.debug.aim(args[0], args[1], args[2]); g.player.yaw -= 0.5; g.player.pitch = -0.3;', here.x + 1, here.y, here.z);
  await ticks(4);
  await step('built');

  // a reload finds it all again
  await run('x.debug.save();');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((w) => Boolean(eval(w)) && window.__RUNTIME__?.status === 'on', world(), { timeout: 300000 });
  await page.click('.mc-title .mc-btn');
  await until('g.world.loaded(arg[0], arg[2]) && g.world.chunks.size >= 25', [log.x, log.y, log.z]);
  await ticks(10);
  const after = await run('return { table: x.debug.nearest("^crafting_table$", 6), pickaxe: x.debug.slotOf("wooden_pickaxe"), cut: g.world.get(args[0], args[1], args[2]) };', log.x, log.y, log.z);
  const kept = after.table && after.table.x === table.x && after.table.y === table.y && after.table.z === table.z && after.pickaxe >= 0;
  console.log('  after a reload:', JSON.stringify(after), kept ? 'kept' : 'LOST');
  if (!kept) errors.push('the world was not kept over a reload');
  await step('reloaded');
}

// ── the day: a sunset to the west, the night, a torch against it, and a bed's morning ──
if (log) {
  await run('g.time = 12600; g.player.yaw = Math.PI / 2; g.player.pitch = 0.05;');
  await ticks(4);
  await step('sunset');
  await run('g.time = 18000; g.player.pitch = -0.3;');
  await ticks(4);
  await step('night');
  // a torch on the ground before the player, and a bed beside
  await run('g.inventory.slots[2] = { item: "torch", count: 4, damage: 0 }; g.inventory.slots[3] = { item: "red_bed", count: 1, damage: 0 }; x.select(2);');
  // (the ground two blocks off: the column's top solid block within reach below the eye)
  const spot = await run('const p = g.player; for (const [dx, dz] of [[-2, 0], [0, 2], [2, 0], [0, -2], [-2, 2], [2, 2]]) { const sx = Math.floor(p.x) + dx, sz = Math.floor(p.z) + dz; for (let y = Math.floor(p.y) + 1; y > Math.floor(p.y) - 3; y--) if (g.world.solid(sx, y, sz) && !g.world.solid(sx, y + 1, sz) && !g.world.solid(sx, y + 2, sz)) return { x: sx, y, z: sz }; } return null;');
  console.log('  ground for the torch:', JSON.stringify(spot));
  const placeAt = async (c) => {
    await run('x.debug.aim(args[0], args[1], args[2], 0.5, 0.98, 0.5); x.press("use", true);', c.x, c.y, c.z);
    await ticks(1);
    await run('x.press("use", false);');
    await ticks(6);
  };
  await placeAt(spot);
  const torch = await run('return x.debug.nearest("^torch$", 6);');
  console.log('  torch:', JSON.stringify(torch));
  if (!torch) errors.push('the torch was not placed');
  await ticks(30);
  console.log('  light by the torch:', JSON.stringify(await run('const L = (x0, y, z0) => { const cx = Math.floor(x0 / 16), cz = Math.floor(z0 / 16); const c = g.world.chunkAt(cx, cz); const i = (y * 16 + (z0 - cz * 16)) * 16 + (x0 - cx * 16); return [c.light[i] >> 4, c.light[i] & 15, c.lit]; }; const t = args; return { at: L(t[0], t[1], t[2]), beside: L(t[0] + 1, t[1], t[2]), remeshing: x.debug.stats().remeshing };', torch.x, torch.y, torch.z)));
  await ticks(30);
  await run('g.player.yaw = Math.PI / 2; g.player.pitch = -0.45;');
  await ticks(4);
  await step('torch');
  await run('x.select(3); g.player.yaw = Math.PI / 2;');
  const bedAt = { x: spot.x, y: spot.y, z: spot.z + 2 };
  await placeAt(bedAt);
  const bed = await run('return x.debug.nearest("^red_bed$", 6);');
  console.log('  bed:', JSON.stringify(bed));
  if (!bed) errors.push('the bed was not placed');
  else await run('x.debug.aim(args[0], args[1], args[2], 0.5, 0.5, 0.5); x.press("use", true);', bed.x, bed.y, bed.z);
  await ticks(2);
  await run('x.press("use", false);');
  const hour = await run('return g.time % 24000;');
  console.log('  after sleeping, the hour:', hour);
  if (hour > 200) errors.push('the night did not pass');
  await page.waitForTimeout(2600);
  await run('g.player.pitch = -0.2;');
  await ticks(4);
  await step('morning');

  // ── a stage: stairs, a door opened by hand, water and lava flowing ──
  const at = await run(`const p = g.player, X = Math.floor(p.x), Y = Math.floor(p.y), Z = Math.floor(p.z), put = x.debug.put;
    for (let dx = -7; dx <= 7; dx++) for (let dz = -12; dz <= 1; dz++) { put(X + dx, Y - 1, Z + dz, 'stone'); for (let dy = 0; dy < 6; dy++) put(X + dx, Y + dy, Z + dz, 'air'); }
    put(X - 3, Y, Z - 4, 'oak_stairs', 3); put(X - 2, Y, Z - 4, 'oak_stairs', 3); put(X - 1, Y, Z - 4, 'cobblestone');
    put(X + 1, Y, Z - 3, 'oak_door', 1); put(X + 1, Y + 1, Z - 3, 'oak_door', 9);
    put(X + 3, Y, Z - 8, 'water'); put(X - 4, Y, Z - 10, 'lava');
    for (let dy = 0; dy < 3; dy++) { put(X - 6, Y + dy, Z - 5, 'cobblestone'); put(X - 6, Y + dy, Z - 4, 'ladder', 3); }
    return { X, Y, Z };`);
  // a tap (held past 4 ticks a use repeats, and the door would swing back)
  await run('x.debug.aim(args[0] + 1, args[1] + 1, args[2] - 3); x.press("use", true); x.press("use", false);', at.X, at.Y, at.Z);
  await ticks(2);
  const door = await run('return [g.world.getState(args[0] + 1, args[1], args[2] - 3), g.world.getState(args[0] + 1, args[1] + 1, args[2] - 3)];', at.X, at.Y, at.Z);
  console.log('  the door, both halves after a use:', JSON.stringify(door));
  if (!(door[0] & 4 && door[1] & 4)) errors.push('the door did not open');
  await ticks(140);
  const flow = await run('const n = (name) => { let c = 0; for (let dx = -7; dx <= 7; dx++) for (let dz = -12; dz <= 1; dz++) if (g.world.get(args[0] + dx, args[1], args[2] + dz) === x.debug.id(name)) c++; return c; }; return { water: n("water"), lava: n("lava"), frames: x.scene.materials.water.uniforms.anim.value.map((v) => v.toArray()) };', at.X, at.Y, at.Z);
  console.log('  flowed:', JSON.stringify(flow));
  if (flow.water < 20 || flow.lava < 5) errors.push('water or lava did not flow');
  await run('g.player.yaw = 0; g.player.pitch = -0.35;');
  await ticks(4);
  await step('stage');

  // ── a furnace at work, a chest, the hearts and hunger, and a death ──
  const tap = async (cx, cy, cz) => {
    await run('x.debug.aim(args[0], args[1], args[2]); x.press("use", true); x.press("use", false);', cx, cy, cz);
    await ticks(2);
  };
  await run('const p = args[0]; x.debug.put(p.X + 1, p.Y, p.Z - 1, "furnace", 1); x.debug.put(p.X - 1, p.Y, p.Z - 1, "chest", 1);', at);
  await tap(at.X + 1, at.Y, at.Z - 1);
  const furnace = await run('const f = g.furnaces[args.join(",")]; if (!f) return null; f.slots = [{ item: "iron_ore", count: 5, damage: 0 }, { item: "coal", count: 1, damage: 0 }, null]; return true;', [at.X + 1, at.Y, at.Z - 1]);
  if (!furnace) errors.push('the furnace did not open');
  await ticks(330);
  console.log('  furnace:', JSON.stringify(await run('const f = g.furnaces[args.join(",")]; return { out: f.slots[2], burn: f.burn, cook: f.cook, lit: x.debug.nearest("^lit_furnace$", 4) };', [at.X + 1, at.Y, at.Z - 1])));
  await step('furnace');
  await run('x.closeScreen();');
  await tap(at.X - 1, at.Y, at.Z - 1);
  await run('const c = g.chests[args.join(",")]; c[0] = { item: "diamond", count: 3, damage: 0 }; c[4] = { item: "bread", count: 12, damage: 0 }; c[13] = { item: "iron_pickaxe", count: 1, damage: 40 }; c[26] = { item: "cobblestone", count: 64, damage: 0 };', [at.X - 1, at.Y, at.Z - 1]);
  await ticks(4);
  await step('chest');
  await run('x.closeScreen(); Object.assign(g.player, { health: 7, hunger: 13, saturation: 0.5, pitch: 0 });');
  await ticks(4);
  await step('hud');
  await run('g.player.health = 0;');
  await ticks(3);
  const died = await page.evaluate(() => Boolean(document.querySelector('[aria-label="You died!"]')));
  if (!died) errors.push('no death screen');
  await page.waitForTimeout(1300);
  await step('dead');
  await run('x.respawn();');
  await ticks(4);
  const back = await run('return { dead: g.dead, health: g.player.health, carried: g.inventory.slots.filter(Boolean).length, dropped: g.drops.length };');
  console.log('  after respawning:', JSON.stringify(back));
  if (back.dead || back.health !== 20) errors.push('the respawn did not happen');
}

// from above: the lie of the land
await page.evaluate((w) => {
  const x = eval(w);
  const p = x.game.player;
  x.debug.teleport(p.x, p.y + 30, p.z);
  p.pitch = -0.6;
}, world());
await page.evaluate((w) => eval(w).pause(true), world());
await page.waitForTimeout(500);
await page.evaluate((w) => eval(w).pause(false), world());
await step('overview');

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
