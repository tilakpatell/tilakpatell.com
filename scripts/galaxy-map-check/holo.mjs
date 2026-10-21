/* global document, getComputedStyle, innerWidth, innerHeight */
// The galaxy map check's holotable runs (scripts/galaxy-map-check.mjs; HoloStage.jsx, holo/holoScene.js): the map in 3D at a
// window's size.
//   page: the stage the whole window, the scene's canvas showing and nothing else of the page under it (the flight's radar)
//   sectors: the whole galaxy names no system, where you are its YOU tag alone; a press by Tatooine opens the Arkanis sector
//     (the crumb says so) and names its systems; Escape goes back to the galaxy and leaves the map open
//   names: none meets another, none is under a control over the stage (the header's, the board, the zoom and turn buttons,
//     the chips, the crumb, the side panel) or off it
//   hands: + twice spreads a sector's systems apart, the turn button turns the table, a press on a system's dot picks it,
//     the Layers panel's 3D map switch goes to the flat map and back
import { J, check, open, out, settle } from './lib.mjs';

// (till the scene's stopped moving the names: their places the same three times, 700 ms apart; software GL's frames are slow)
const still = async (page) => {
  await page.waitForFunction(() => document.querySelector('.holo-label:not([data-off])'), null, { timeout: 120000 }); // (the scene's loaded)
  let was = '';
  let same = 0;
  for (let i = 0; i < 60 && same < 2; i++) {
    await settle(page, 700);
    const now = await J(page, () => [...document.querySelectorAll('.holo-label')].map((l) => `${l.style.transform}${l.dataset.place}${l.hasAttribute('data-quiet') ? 'q' : ''}`).join());
    same = now === was ? same + 1 : 0;
    was = now;
  }
};
const named = (page) =>
  J(page, () =>
    [...document.querySelectorAll('.holo-label:not([data-off]):not([data-quiet])')].map((l) => {
      const b = l.querySelector('.holo-name').getBoundingClientRect();
      return { id: l.dataset.id, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
    }),
  );
const controls = (page) =>
  J(page, () =>
    [...document.querySelectorAll('.holomap-head > *, .holomap-eras, .holomap-strip-war, .holomap-strip-board, .holomap-zoom, .holomap-legend-toggle, .holomap-layers-toggle, .holo-crumb, .holomap-side')]
      .map((c) => [c.className.split(' ')[0], c.getBoundingClientRect()])
      .filter(([, b]) => b.width > 0)
      .map(([what, b]) => ({ what, x0: b.left, y0: b.top, x1: b.right, y1: b.bottom })),
  );
const meet = (a, b, by = 1) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > by && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > by;
// (how far apart two systems are drawn: the camera's zoom, seen from the page)
const apart = (page, a, b) =>
  J(page, ([x, y]) => {
    const at = (id) => document.querySelector(`.holo-label[data-id="${id}"]`).getBoundingClientRect();
    const p = at(x);
    const q = at(y);
    return Math.hypot(p.left - q.left, p.top - q.top);
  }, [a, b]);

export const holo = async (viewport) => {
  const size = `${viewport.width}x${viewport.height} 3D`;
  const say = (ok, what) => check(ok, `${size}: ${what}`);
  const { ctx, page, errors } = await open(viewport, { view: '3d' });
  await still(page);
  say((await page.locator('.holomap[data-3d]').count()) === 1, 'the map opens in 3D');
  const page0 = await J(page, () => {
    const st = document.querySelector('.holo-stage').getBoundingClientRect();
    const canvas = document.querySelector('.galaxy-map > canvas');
    const radar = document.querySelector('.fc-radar');
    return { whole: st.left === 0 && st.top === 0 && st.width === innerWidth && st.height === innerHeight, canvas: canvas && getComputedStyle(canvas).visibility, radar: radar ? getComputedStyle(radar).visibility : 'hidden' };
  });
  say(page0.whole, 'the stage is the whole window');
  say(page0.canvas === 'visible' && page0.radar === 'hidden', `the scene's canvas shows and the flight's radar doesn't (canvas ${page0.canvas}, radar ${page0.radar})`);

  const names = async (when) => {
    const ns = await named(page);
    const cs = await controls(page);
    const meets = ns.flatMap((a, i) => ns.slice(i + 1).filter((b) => meet(a, b)).map((b) => `${a.id}/${b.id}`));
    const under = ns.flatMap((n) => cs.filter((c) => meet(n, c)).map((c) => `${n.id} under ${c.what}`));
    const off = ns.filter((n) => n.x0 < 0 || n.y0 < 0 || n.x1 > viewport.width || n.y1 > viewport.height).map((n) => n.id);
    say(meets.length === 0, `${when}: ${ns.length} names, none meeting another${meets.length ? ` (${meets.slice(0, 5).join(', ')})` : ''}`);
    say(under.length === 0 && off.length === 0, `${when}: none under a control or off the stage${under.length ? ` (${under.slice(0, 5).join(', ')})` : ''}${off.length ? ` (off: ${off.join(', ')})` : ''}`);
    return ns;
  };
  // the whole galaxy: its sectors alone, and where you are its YOU tag
  const whole = await names('the whole galaxy');
  const tagged = await J(page, () => [...document.querySelectorAll('.holo-label[data-tag]:not([data-off]):not([data-quiet])')].map((l) => l.dataset.id));
  say(whole.length === 1 && tagged.join() === 'tatooine', `the whole galaxy names no system, where you are its YOU tag alone (${whole.map((n) => n.id).join(', ') || 'none'})`);
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${out}/holo-${viewport.width}x${viewport.height}-whole.png` });

  // a press on the sector you're in opens it: the crumb says which, its systems come in and are named
  const crumb = () => J(page, () => document.querySelector('.holo-crumb-name')?.textContent ?? null);
  const you = await J(page, () => {
    const b = document.querySelector('.holo-label[data-id="tatooine"]').getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  });
  // (a little off Tatooine's bead, which stands over the plane, into its sector)
  for (const [dx, dy] of [[30, 6], [30, 20], [12, 26], [45, 0]]) {
    await page.mouse.click(you[0] + dx, you[1] + dy);
    await still(page);
    if ((await crumb()) === 'Arkanis sector') break;
  }
  say((await crumb()) === 'Arkanis sector', `a press by Tatooine opens its sector (the crumb: ${await crumb()})`);
  const inside = await names('Arkanis sector open');
  say(['tatooine', 'scarif'].every((id) => inside.some((n) => n.id === id)), `its systems are named (${inside.map((n) => n.id).join(', ')})`);
  await page.mouse.move(2, 2);
  await page.screenshot({ path: `${out}/holo-${viewport.width}x${viewport.height}-sector.png` });

  // + spreads its systems, the turn buttons turn the table
  const far = await apart(page, 'tatooine', 'scarif');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await still(page);
  const near = await apart(page, 'tatooine', 'scarif');
  say(near > far * 1.6, `+ twice zooms in (Tatooine to Scarif ${far.toFixed(0)} → ${near.toFixed(0)} px)`);
  const bearing = () =>
    J(page, () => {
      const at = (id) => document.querySelector(`.holo-label[data-id="${id}"]`).getBoundingClientRect();
      const [a, b] = [at('tatooine'), at('scarif')];
      return (Math.atan2(b.top - a.top, b.left - a.left) * 180) / Math.PI;
    });
  const was = await bearing();
  await page.locator('[aria-label="Turn the map right"]').click();
  await page.locator('[aria-label="Turn the map right"]').click();
  await still(page);
  const turned = ((await bearing()) - was + 540) % 360 - 180;
  say(Math.abs(turned) > 25 && Math.abs(turned) < 70, `the turn button, twice, turns the table (Tatooine to Scarif turned ${turned.toFixed(0)}°)`);
  await names('zoomed in and turned');

  // a press on Scarif's dot picks it
  const dot = await J(page, () => {
    const b = document.querySelector('.holo-label[data-id="scarif"]').getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  });
  await page.mouse.click(...dot);
  await still(page);
  const picked = await J(page, () => ({ pressed: document.querySelector('.holo-label[data-id="scarif"]').getAttribute('aria-pressed'), side: document.querySelector('.holomap-side')?.textContent.includes('Scarif') }));
  say(picked.pressed === 'true' && picked.side, `a press on Scarif's dot picks it (pressed ${picked.pressed}, in the side panel ${picked.side})`);
  await names('Scarif picked');

  // Escape goes back to the whole galaxy, and leaves the map open
  await page.keyboard.press('Escape');
  await still(page);
  const back = await named(page);
  say((await crumb()) === null && back.length === 1 && (await page.locator('.holomap').count()) === 1, `Escape goes back to the whole galaxy, the map still open (${back.map((n) => n.id).join(', ')})`);

  // the Layers panel's 3D map switch, off and on again
  await page.locator('.holomap-layers-toggle').click();
  await page.locator('.holomap-layers-set .holo-flat').click();
  await settle(page, 600);
  const flat = await J(page, () => ({ three: Boolean(document.querySelector('.holomap[data-3d]')), stage: Boolean(document.querySelector('.holomap-stage')), zoom: document.querySelectorAll('.holomap-zoom button').length }));
  say(!flat.three && flat.stage && flat.zoom === 3, `the Layers panel's 3D map switch goes to the flat map, its three zoom buttons (${flat.zoom})`);
  await page.locator('.holomap-layers-set .holo-flat').click();
  await settle(page, 600);
  say((await page.locator('.holomap[data-3d]').count()) === 1, 'and back to 3D');
  say(errors.length === 0, `no errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
};
