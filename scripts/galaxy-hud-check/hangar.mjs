/* global window, document */
// The Shipyard in the galaxy, in a browser (pages/Galaxy.jsx, GalaxyView.jsx, universe/shipyard/useShipyardPage.js;
// scripts/galaxy-hud-check.mjs runs it as `hangar`): at 1440x900 an X-wing at Tatooine, with credits earned in the wallet, and
//   door: the Shipyard's button is in the corner beside the flight settings', and meets nothing there
//   keys: H opens the yard (the map behind it holds still), Escape closes it; H does nothing with the galaxy map open or a jump
//     under way; the flight settings and the yard are never open together; a jump that begins with the yard open shuts it and
//     goes on (and buff time and a pickup's age stand still while it's open), the doors (the button, the panel's link) are gone while it's on and back after, and Escape closes the yard there
//   fit: twin-linked cannons staged and applied change the ship in flight (__galaxyDebug.state.stats's cadence), are kept under
//     the universe map's own storage keys, and say so (the page's note); the secondary line says it fires on the universe map only;
//     a Quad picked on the Engines tab tunes the X-wing (its acceleration in flight) with the hull still stock, kept under the tune's key
// Shots are in OUT/hangar-*.png.
import { check, out } from '../galaxy-map-check/lib.mjs';
import { open, settle } from './lib.mjs';

const VIEW = { width: 1440, height: 900 };
const box = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || !el.checkVisibility()) return null;
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }, sel);
const meet = (a, b) => a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
const yardOpen = (page) => page.evaluate(() => Boolean(document.querySelector('.yard-panel')));
// (the shipyard's list: back to its front door if a category's open, then into one)
const openSlot = async (page, slot) => {
  await page.evaluate(() => document.querySelector('.yl-back')?.click());
  await page.locator(`.yl-cat[data-slot="${slot}"]`).click();
};
const press = async (page, key) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press(key);
  await settle(page, 600);
};

export async function hangar() {
  const say = (ok, what) => check(ok, `hangar: ${what}`);
  const { ctx, page, errors } = await open(VIEW);
  try {
    const G = (fn, arg) => page.evaluate(fn, arg);
    // credits to buy with (the wallet is hooked onto the scene's debug object once it's loaded)
    await page.waitForFunction(() => Boolean(window.__galaxyDebug?.economy), null, { timeout: 60000 });
    await G(() => window.__galaxyDebug.economy.earn('killAce', 6));
    const before = await G(() => ({ ...window.__galaxyDebug.state.stats }));

    // the door
    const btn = await box(page, '.universe-hangar-btn');
    const cog = await box(page, '.universe-settings-btn');
    say(Boolean(btn) && Boolean(cog), 'the Shipyard button is in the corner, beside the flight settings’');
    const near = await Promise.all(['.fc-radar', '.fc-ship', '.galaxy-keysbtn', '.universe-online-pill', '.galaxy-mapbtn'].map((s) => box(page, s)));
    say(!meet(btn, cog) && near.every((b) => !meet(btn, b)), 'and meets nothing there');
    say((await G(() => document.querySelector('.universe-hangar-btn')?.getAttribute('aria-keyshortcuts'))) === 'H', 'and says H');
    await page.screenshot({ path: `${out}/hangar-corner.png`, clip: { x: 0, y: 700, width: 480, height: 200 } });

    // H opens it, and the map behind holds still
    await press(page, 'h');
    say(await yardOpen(page), 'H opens the Shipyard');
    const p0 = await G(() => ({ ...window.__galaxy().ship }));
    await settle(page, 700);
    const p1 = await G(() => ({ ...window.__galaxy().ship }));
    say(Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) < 0.01, 'with the ship held still behind it');
    // and buff time and a pickup's age stand still too: the yard doesn't eat them
    const clocks = () => G(() => ({ left: window.__galaxyDebug.pickups.buffs().find((b) => b.kind === 'rapid')?.left ?? null, age: window.__galaxyDebug.pickups.list[0]?.age ?? null }));
    await G(() => {
      window.__galaxyDebug.pickups.give('rapid');
      window.__galaxyDebug.pickups.drop({ x: 5000, y: 0, z: 5000 }, { ace: true, kind: 'charge' });
    });
    const c0 = await clocks();
    await settle(page, 1500);
    const c1 = await clocks();
    say(c0.left !== null && c1.left === c0.left && c1.age === c0.age, `an effect's time and a pickup's age stand still while the yard's open (${c0.left?.toFixed(2)} → ${c1.left?.toFixed(2)}, ${c0.age?.toFixed(2)} → ${c1.age?.toFixed(2)})`);
    await G(() => window.__galaxyDebug.pickups.clear());
    await page.screenshot({ path: `${out}/hangar-open.png` });

    // the secondary line says where it fires
    await openSlot(page, 'secondary');
    await settle(page, 300);
    const hint = await G(() => document.querySelector('.yard-hint')?.textContent ?? '');
    say(/universe map/.test(hint) && /crew/.test(hint), `the secondary line says it fires on the universe map only (${hint.slice(0, 60)}…)`);
    await page.screenshot({ path: `${out}/hangar-secondary.png` });
    await openSlot(page, 'guns');
    await settle(page, 300);
    say((await G(() => document.querySelector('.yard-hint')?.textContent ?? '')) === '', 'and the primary line doesn’t');

    // twin-linked cannons on
    await page.locator('.yl-row', { hasText: 'Twin-linked cannons' }).click();
    await settle(page, 400);
    await page.screenshot({ path: `${out}/hangar-staged.png` });
    await page.locator('.yc-apply').click();
    await settle(page, 900);
    say(!(await yardOpen(page)), 'Apply fits it and closes the yard');
    const after = await G(() => ({ ...window.__galaxyDebug.state.stats }));
    say(after.cadence < before.cadence, `and the guns are quicker in flight (cadence ${before.cadence} → ${after.cadence})`);
    const kept = await G(() => ({ loadout: JSON.parse(localStorage.getItem('tp-universe-loadout') ?? 'null') }));
    say(kept.loadout?.xwing?.guns === 'twin', `and it's kept under the universe map's key (${JSON.stringify(kept.loadout?.xwing ?? null)})`);
    const note = await G(() => document.querySelector('.universe-earn, .universe-earn-note, [data-earn]')?.textContent ?? '');
    say(note === '' || /Fitted|Bought/.test(note), `and says so (${note || 'the note’s gone already'})`);
    await page.screenshot({ path: `${out}/hangar-fitted.png` });

    // a module on the crew's own ship is tuning: the hull stays stock, and the galaxy's ship flies on its numbers
    await G(() => window.__galaxyDebug.economy.earn('killAce', 6));
    await press(page, 'h');
    await openSlot(page, 'engines');
    await page.locator('.yl-row', { hasText: 'Quad' }).click();
    await settle(page, 300);
    await page.locator('.yc-apply').click();
    await settle(page, 900);
    const tuned = await G(() => ({ stats: { ...window.__galaxyDebug.state.stats }, build: window.__galaxyDebug.state.build, tune: JSON.parse(localStorage.getItem('tp-universe-tune') ?? 'null'), hull: JSON.parse(localStorage.getItem('tp-universe-hull') ?? 'null') }));
    say(tuned.stats.accel > after.accel && !tuned.build, `a Quad tuned onto the X-wing quickens it, on its own hull (acceleration ${after.accel} → ${tuned.stats.accel})`);
    const keptTune = tuned.tune?.data ?? tuned.tune;
    const keptHull = tuned.hull?.data ?? tuned.hull;
    say(keptTune?.xwing?.engines === 'quad' && !keptHull?.xwing, `and it's kept under the tune's own key, with no garage hull (${JSON.stringify(keptTune?.xwing ?? null)})`);
    await page.screenshot({ path: `${out}/hangar-tuned.png` });

    // H and Escape, and the one-at-a-time rule
    await press(page, 'h');
    say(await yardOpen(page), 'H opens it again');
    await press(page, 'Escape');
    say(!(await yardOpen(page)), 'Escape closes it');
    await page.locator('.universe-settings-btn').click();
    await settle(page, 400);
    say(await G(() => Boolean(document.querySelector('.universe-settings'))), 'the flight settings open');
    await press(page, 'h');
    say((await yardOpen(page)) && !(await G(() => Boolean(document.querySelector('.universe-settings')))), 'H opens the yard and puts the flight settings away');
    await press(page, 'Escape');

    // H does nothing under the galaxy map, nor in a jump
    await press(page, 'm');
    say(await G(() => Boolean(document.querySelector('.holomap'))), 'the galaxy map opens');
    await press(page, 'h');
    say(!(await yardOpen(page)), 'H does nothing with the galaxy map open');
    await press(page, 'm');
    await page.waitForFunction(() => !document.querySelector('.holomap'), null, { timeout: 10000 });
    // a jump that begins with the yard open (a link's or a course's: here the scene's own) shuts the yard and goes on, not stalled behind it
    await page.locator('.universe-hangar-btn').click();
    await settle(page, 500);
    say(await yardOpen(page), 'the corner button opens the yard');
    await G(() => window.__galaxyDebug.startJump('endor'));
    await settle(page, 800);
    say(!(await yardOpen(page)), 'a jump that begins shuts it');
    const went = await page.waitForFunction(() => ['spool', 'tunnel'].includes(window.__galaxy().jump?.phase), null, { timeout: 30000 }).then(() => true, () => false);
    say(went, 'and the jump goes on to its spool, not stalled behind it');
    // the doors are gone while it's on, and H does nothing
    say(!(await box(page, '.universe-hangar-btn')), 'the corner button is gone while a jump is on');
    say(!(await G(() => Boolean(document.querySelector('.galaxy-yard-link')))), 'and the panel’s link');
    await press(page, 'h');
    say(!(await yardOpen(page)), 'H does nothing mid-jump');
    // arrived: the doors are back, and the yard's own Escape works
    await page.waitForFunction(() => !window.__galaxy().jump && window.__galaxy().system === 'endor', null, { timeout: 120000 });
    await settle(page, 1500);
    await page.locator('.universe-hangar-btn').click();
    await settle(page, 500);
    say(await yardOpen(page), 'once there, the corner button opens the yard again');
    await press(page, 'Escape');
    say(!(await yardOpen(page)), 'and Escape closes it');
    say(errors.length === 0, `no page errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}
