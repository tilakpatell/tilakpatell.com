/* global window, document, getComputedStyle */
// The galaxy HUD check's shared parts (scripts/galaxy-hud-check.mjs runs it; pickups.mjs, hangar.mjs and difficulty.mjs are its scenarios):
// a galaxy flown in an X-wing, a key held for a while, the text on a part of the page a player reads under 0.7 rem.
import { browser } from '../galaxy-map-check/lib.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5188';
export const settle = (page, ms = 400) => page.waitForTimeout(ms);

// a galaxy at Tatooine, flown in an X-wing, nothing else open (the first-flight keys card up);
// `controls`: the flight settings stored first (controls.js's, as the page keeps them)
export const open = async (viewport, { reduced = false, controls = null } = {}) => {
  const ctx = await browser.newContext({ viewport, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  if (controls) await ctx.addInitScript((c) => window.localStorage.setItem('tp-universe-controls', JSON.stringify(c)), controls);
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-3d', 'on');
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-sound', 'off');
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
    window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: the cloud's software GL)
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL|403/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/#/galaxy`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('text=An X-wing').first().click({ timeout: 180000 });
  await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system && window.__galaxy().ship && !window.__galaxy().jump, null, { timeout: 180000 });
  await settle(page, 1200);
  return { ctx, page, errors };
};

export const hold = async (page, key, ms) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};

// text a player reads under 0.7 rem (11.2 px) inside `root`
export const smallText = (page, root) =>
  page.evaluate((sel) => {
    const bad = [];
    for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim());
      if (!own.length || !el.checkVisibility()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11.19) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${own[0].slice(0, 16)}" ${fs}px`);
    }
    return bad;
  }, root);
