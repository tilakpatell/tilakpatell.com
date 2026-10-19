/* global window, document, getComputedStyle, innerWidth, innerHeight, MutationObserver */
// The galaxy map check's whole suite for a window of a given size (scripts/galaxy-map-check.mjs): names, zoom and drag, find,
// layers, eras and films, Tab, the key and the side panel's wheel, the hover card, sharpness, the M key, the jump. See the
// runner's header for the list.
import { cursorFor, doubleClickElsewhere, escapeOrder, findList, fitButton, pickedMarks, strokesKeepWeight } from './controls.mjs';
import { PHONE_GRAZE, check, dotsCheck, easedNames, edgeEnergy, hasMap, headerAndFilms, J, namesProblems, open, out, overlayProblems, settle, smallText, still } from './lib.mjs';

export const suite = async (viewport, { full = true } = {}) => {
  const size = `${viewport.width}x${viewport.height}`;
  const say = (ok, what) => check(ok, `${size}: ${what}`);
  const { ctx, page, errors, reopen } = await open(viewport);
  const snap = async (what) => {
    await page.mouse.move(2, 2); // (off the dots: no hover card in the shot)
    await settle(page, 250);
    await page.locator('.holomap-frame').screenshot({ path: `${out}/map-${size}-${what}.png` });
  };
  const names = async (when, all = false) => {
    const r = await namesProblems(page);
    // (every film world's name; a charted world's only where it has room, labelPlace.js's optional, so those are counted, not held)
    const v = await J(page, () => {
      const shown = (el) => el.checkVisibility({ visibilityProperty: true });
      const films = [...document.querySelectorAll('.holomap-systems > li:not([data-charted]) .holomap-name[data-id]')];
      const charted = [...document.querySelectorAll('.holomap-systems > li[data-charted] .holomap-name[data-id]')];
      return { films: films.length, filmsShown: films.filter(shown).length, charted: charted.length, chartedShown: charted.filter(shown).length };
    });
    say(all ? v.filmsShown === v.films : r.n >= 3, `${when}: ${r.n} names on view (the films’ ${v.filmsShown} of ${v.films}, the charted worlds’ ${v.chartedShown} of ${v.charted})`);
    say(r.meets.length === 0, `${when}: no two names meet${r.meets.length ? ` (${r.meets.slice(0, 6).join(', ')})` : ''}`);
    const dots = dotsCheck(r.dots, viewport.width);
    say(dots.ok, `${when}: no name over another system's dot${viewport.width <= 560 ? ` deeper than ${PHONE_GRAZE} px` : ''}${dots.text}`);
    say(r.outside.length === 0, `${when}: every name inside the map${r.outside.length ? ` (${r.outside.slice(0, 6).join(', ')})` : ''}`);
    if (all) say(r.under.length === 0, `${when}: no name under the strip, layers, key or zoom buttons${r.under.length ? ` (${r.under.slice(0, 6).join(', ')})` : ''}`);
    else {
      const tag = r.under.filter((u) => u.endsWith('/tag')); // (the course's tag: drawn with a course, so not at the whole map's check above)
      say(tag.length === 0, `${when}: no name under the course's tag${tag.length ? ` (${tag.join(', ')})` : ''}`);
    }
  };
  const phone = viewport.width <= 560;

  // ── the whole map: names apart, nothing under 0.7 rem, the overlays clear ──
  await names('whole', true);
  const meets = await overlayProblems(page);
  say(meets.length === 0, `the strip, layers, key and zoom buttons clear of one another${meets.length ? ` (${meets.join(', ')})` : ''}`);
  await snap('whole');
  // (with the films' panel open, and on a phone the layers' chip, then the key, so all their text is looked at)
  const layersChip = page.locator('.holomap-layers-toggle');
  if (await layersChip.isVisible()) await layersChip.click(); // (a press outside the films' panel shuts it: the chip first)
  await page.locator('.holomap-filmpick summary').click();
  await settle(page, 300);
  const small = await smallText(page);
  await snap('panels');
  await page.keyboard.press('Escape'); // (the films' panel first)
  say(await hasMap(page), 'Escape shuts the films panel and the map stays');
  say(!(await J(page, () => document.querySelector('details.holomap-filmpick').open)), 'the films panel is shut by Escape');
  if (await layersChip.isVisible()) await layersChip.click();
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);
  small.push(...(await smallText(page)));
  say(small.length === 0, `nothing under 0.7 rem (11.2 px)${small.length ? `: ${[...new Set(small)].slice(0, 5).join('; ')}` : ''}`);
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);
  await escapeOrder(page, say);
  await settle(page, 300);

  // ── zoom: the wheel about the pointer, twice over Hoth ──
  const hoth = await J(page, () => window.__mc.dot('hoth'));
  await page.mouse.move(hoth.x, hoth.y);
  await page.mouse.wheel(0, -120);
  await settle(page);
  await page.mouse.wheel(0, -120);
  await settle(page);
  const v2 = await J(page, () => window.__mc.view());
  const hoth2 = await J(page, () => window.__mc.dot('hoth'));
  say(Math.abs(v2.k - 2.25) < 0.05, `two wheel notches zoom to 2.25 (${v2.k.toFixed(2)})`);
  say(Math.hypot(hoth2.x - hoth.x, hoth2.y - hoth.y) < 3, `the wheel zooms about the pointer (Hoth moved ${Math.hypot(hoth2.x - hoth.x, hoth2.y - hoth.y).toFixed(1)} px)`);
  await names('zoomed over Hoth');
  await snap('hoth');

  // ── a drag pans and never picks the system it starts on or ends over ──
  await page.mouse.move(2, 2);
  await page.keyboard.press('0');
  await settle(page);
  await page.keyboard.press('+');
  await settle(page);
  for (let i = 0; i < 2 && (await J(page, () => window.__mc.free().length)) < 4; i++) {
    await page.keyboard.press('+'); // (till a few systems can be pressed: the strip covers some on a phone)
    await settle(page);
  }
  const pickBefore = await J(page, () => window.__mc.picked());
  const vBefore = await J(page, () => window.__mc.view());
  const ids = await J(page, () => window.__mc.free());
  say(ids.length >= 3, `${ids.length} systems to press when zoomed in (k=${(await J(page, () => window.__mc.view().k)).toFixed(2)})`);
  // (a press at a dot lands on that system's button: else the drag below would prove nothing)
  const lands = (p, id) => J(page, ([q, i]) => document.elementFromPoint(q.x, q.y)?.closest('.holomap-system') === window.__mc.sys(i), [p, id]);
  const a = await J(page, (id) => window.__mc.dot(id), ids[0]);
  say(await lands(a, ids[0]), `the press for the first drag lands on ${ids[0]}'s button`);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(a.x + i * 10, a.y + i * 6);
  await page.mouse.up();
  await settle(page, 300);
  const vAfter = await J(page, () => window.__mc.view());
  say(vAfter.x !== vBefore.x || vAfter.y !== vBefore.y, `a drag from a system's dot pans the map (${ids[0]})`);
  say(JSON.stringify(await J(page, () => window.__mc.picked())) === JSON.stringify(pickBefore), `a 60 px drag starting on ${ids[0]}'s dot doesn't pick it`);
  // the second, from another system that can be pressed now, a long way back (the dots go with the pan, so it's released over its own, or over whatever the map's edge leaves)
  const from = (await J(page, () => window.__mc.free())).find((id) => id !== ids[0]);
  const b = await J(page, (id) => window.__mc.dot(id), from);
  say(await lands(b, from), `the press for the second drag lands on ${from}'s button`);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x - i * 20, b.y - i * 12);
  const over = await J(page, ([x, y]) => document.elementFromPoint(x, y)?.closest('.holomap-system')?.closest('li')?.querySelector('.holomap-name')?.dataset.id ?? null, [b.x - 200, b.y - 120]);
  await page.mouse.up();
  await settle(page, 300);
  say(JSON.stringify(await J(page, () => window.__mc.picked())) === JSON.stringify(pickBefore), `a long drag from ${from}${over ? `, released over ${over}` : ''}, doesn't pick either`);
  // (a click does: the drag check isn't passing for want of a pick)
  const [again] = await J(page, () => window.__mc.free());
  const d = await J(page, (id) => window.__mc.dot(id), again);
  await page.mouse.click(d.x, d.y);
  say((await J(page, () => window.__mc.picked())).includes(again), `a click on ${again} picks it`);
  await pickedMarks(page, say, again);
  await cursorFor(page, say, true);
  // (a system that isn't picked, pressed first: its press may reframe the map, and the second press of a double click lands elsewhere)
  await doubleClickElsewhere(page, say, (await J(page, () => window.__mc.free())).find((id) => id !== again));

  // ── keys: + − 0 zoom ──
  await page.keyboard.press('0');
  await settle(page);
  say((await J(page, () => window.__mc.view())).k === 1, '0 shows the whole galaxy');
  await cursorFor(page, say, false);
  await page.keyboard.press('+');
  await settle(page);
  say(Math.abs((await J(page, () => window.__mc.view())).k - 1.5) < 0.01, '+ zooms in a step');
  await fitButton(page, say);
  await page.keyboard.press('+');
  await settle(page);
  await page.keyboard.press('-');
  await settle(page);
  say((await J(page, () => window.__mc.view())).k === 1, '- zooms out a step');

  // ── a zoom eases the stage and the names' counter-scale together: no name changes size on the way ──
  const eased = await easedNames(page, '+');
  say(eased.frames >= 3 && eased.worst < 0.5, `through a + zoom's easing no name changes size (${eased.frames} frames; the widest change ${eased.worst.toFixed(2)} px${eased.name ? `, ${eased.name}` : ''})`);
  await settle(page);
  const easedBack = await easedNames(page, '-');
  say(easedBack.worst < 0.5, `nor through a - zoom's (${easedBack.worst.toFixed(2)} px)`);
  await settle(page);
  // (with motion reduced nothing's eased at all: the page's own reset leaves a transition 1 microsecond long, which is none)
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still0 = await J(page, () => [document.querySelector('.holomap-stage'), document.querySelector('.holomap-systems > li')].map((el) => getComputedStyle(el).transitionDuration.split(', ').every((d) => parseFloat(d) < 0.001)));
  say(still0.every(Boolean), 'with reduced motion the stage and the systems have no transition');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // ── find: "endo" + Enter picks Endor and has it on view; the YOU tag; J jumps (last) ──
  const find = page.locator('input[type=search][aria-label="Find a system"]');
  await page.keyboard.press('/');
  say(await J(page, () => document.activeElement?.matches('input[type=search]')), '/ goes to the find field');
  await page.keyboard.type('endo');
  await page.keyboard.press('Enter');
  await settle(page, 900);
  say((await J(page, () => window.__mc.sys('endor')?.getAttribute('aria-pressed'))) === 'true', 'find "endo" + Enter picks Endor');
  say(await J(page, () => window.__mc.onView(window.__mc.dot('endor'))), 'and Endor is on view');
  say((await find.inputValue()) === '', 'the find field is emptied');
  await names('framed on Endor');
  await strokesKeepWeight(page, say);
  await snap('endor');
  const here = await J(page, () => window.__galaxy().system);
  const you = await J(page, () => {
    const t = document.querySelector('.holomap-youtag');
    return { shown: window.__mc.shown(t), on: t?.closest('li')?.querySelector('.holomap-system')?.getAttribute('aria-current'), inside: window.__mc.onView({ x: t?.getBoundingClientRect().left + 1, y: t?.getBoundingClientRect().top + 1 }, 0) };
  });
  say(you.shown && you.on === 'location' && you.inside, `a YOU tag is visible on ${here}, the system you're at`);
  const tags = await J(page, () => document.querySelectorAll('.holomap-youtag').length);
  say(tags === 1, 'and only the one');

  await findList(page, say);

  // ── layers ──
  const toggle = page.locator('.holomap-layers-toggle');
  const chip = await toggle.isVisible();
  if (chip) await toggle.click();
  const layer = (label) => page.locator('.holomap-layers-set button', { hasText: new RegExp(`^${label}$`) });
  await layer('Regions').click();
  say((await J(page, () => document.querySelectorAll('.holomap-region, .holomap-region-name, .holomap-unknown').length)) === 0, 'Regions off: its rings and names go');
  await layer('Regions').click();
  say((await J(page, () => document.querySelectorAll('.holomap-region').length)) > 0, 'Regions on: they come back');
  await layer('Fronts').click();
  say(!(await J(page, () => document.querySelector('.holomap-map').hasAttribute('data-fronts'))), 'Fronts off: the war marks go off the systems');
  await layer('Fronts').click();
  await layer('Grid').click();
  say((await J(page, () => document.querySelectorAll('.holomap-axis span').length)) > 0, 'Grid on: its letters and numbers show');
  await layer('Grid').click();
  if (chip) await toggle.click();

  // ── eras and films ──
  const total = await J(page, () => document.querySelectorAll('.holomap-systems > li').length);
  const dimmed = () => J(page, () => document.querySelectorAll('.holomap-systems > li[data-dim]').length);
  say((await dimmed()) === 0, 'with every era lit nothing is dimmed');
  await page.locator('.holomap-eras > button').nth(1).click();
  const eraDim = await dimmed();
  say(eraDim > 0 && eraDim < total, `an era chip dims what isn't of it (${eraDim} of ${total})`);
  await page.locator('.holomap-eras > button').nth(0).click();
  say((await dimmed()) === 0, 'Every era lights them all again');
  await page.locator('.holomap-filmpick summary').click();
  const panel = await J(page, () => {
    const r = document.querySelector('.holomap-films').getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight, open: document.querySelector('details.holomap-filmpick').open };
  });
  say(panel.open && panel.l >= 0 && panel.r <= panel.w && panel.b <= panel.h, `the films panel opens inside the window (${Math.round(panel.l)}-${Math.round(panel.r)} of ${panel.w})`);
  await page.locator('.holomap-films button').first().click();
  say(await J(page, () => document.activeElement === document.querySelector('.holomap-filmpick summary')), "a film's pick leaves the focus on the Films chip");
  const filmState = await J(page, () => ({ open: document.querySelector('details.holomap-filmpick').open, label: document.querySelector('.holomap-filmpick summary').textContent, active: document.querySelector('.holomap-filmpick').hasAttribute('data-active') }));
  const filmDim = await dimmed();
  say(!filmState.open && filmState.active && /^Films: /.test(filmState.label), `a film's pick shuts the panel and names it ("${filmState.label}")`);
  say(filmDim > 0 && filmDim < total, `and dims what isn't of the film (${filmDim} of ${total})`);
  await page.locator('.holomap-eras > button').nth(0).click();
  say((await J(page, () => document.querySelector('.holomap-filmpick').hasAttribute('data-active'))) === false, 'Every era clears the film');
  await headerAndFilms(page, say);

  // ── Tab through the systems zoomed in: the box never scrolls, each one's framed ──
  await page.keyboard.press('0');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('+');
    await settle(page, 300);
  }
  const k3 = (await J(page, () => window.__mc.view())).k;
  await page.locator('.holomap-system').first().focus();
  await settle(page, 400);
  const tabs = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    await still(page);
    await page.waitForTimeout(100);
    tabs.push(
      await J(page, () => {
        const el = document.activeElement;
        const id = el?.closest?.('li')?.querySelector('.holomap-name')?.dataset.id;
        const sc = ['.holomap-map', '.holomap-body', '.holomap-frame', '.holomap'].map((s) => document.querySelector(s)).map((e) => e.scrollLeft + e.scrollTop);
        const d = window.__mc.dot(id);
        const m = window.__mc.map();
        return { id, onView: window.__mc.onView(d), at: d ? `${((d.x - m.left) / m.width).toFixed(2)},${((d.y - m.top) / m.height).toFixed(2)}` : '?', scrolled: sc.some((n) => n !== 0) };
      }),
    );
  }
  const kAfter = (await J(page, () => window.__mc.view())).k;
  say(Math.abs(kAfter - k3) < 0.01, `Tab through the systems brings them in at the zoom the map has (k ${k3.toFixed(2)} then ${kAfter.toFixed(2)}), not a jump to a framing zoom`);
  const tabbed = tabs.filter((t) => t.id);
  say(k3 > 3 && tabbed.length === 14, `Tab through 14 systems at k=${k3.toFixed(2)} stays on the systems`);
  say(tabs.every((t) => !t.scrolled), 'Tab through the systems zoomed in never scrolls the map, its body or its frame');
  say(tabs.every((t) => t.onView), `and frames each system focused${tabs.filter((t) => t.id && !t.onView).length ? ` (off view: ${tabs.filter((t) => t.id && !t.onView).map((t) => `${t.id} at ${t.at}`).join(', ')})` : ''}`);
  await page.keyboard.press('0');
  await settle(page);

  // ── the key: a wheel over its panel scrolls it and not the page behind ──
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);
  // (the page behind is made tall, so a wheel that chains on would move it)
  const natural = await J(page, () => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight);
  await J(page, () => {
    document.documentElement.style.overflowY = 'scroll';
    document.body.style.minHeight = '5000px';
  });
  const key = await J(page, () => {
    const p = document.querySelector('.holomap-legend-panel');
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, scrolls: p.scrollHeight > p.clientHeight + 2, k: window.__mc.view().k, tall: document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight };
  });
  await page.mouse.move(key.x, key.y);
  await page.mouse.wheel(0, 120);
  await settle(page, 300);
  const first = await J(page, () => ({ top: document.querySelector('.holomap-legend-panel').scrollTop, page: document.scrollingElement.scrollTop, k: window.__mc.view().k }));
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 600); // (each its own gesture: one that's latched to the panel would never show a chain)
    await page.waitForTimeout(800);
  }
  const end = await J(page, () => ({ top: document.querySelector('.holomap-legend-panel').scrollTop, page: document.scrollingElement.scrollTop, k: window.__mc.view().k }));
  say(!key.scrolls || first.top > 0, `a wheel over the open key scrolls the key (scrollTop ${first.top})`);
  say(end.page === 0 && first.page === 0, `a wheel over the key, to its end and past it, doesn't scroll the page behind (${end.page} px; the page itself scrolls ${natural} px)`);
  say(end.k === key.k, "and doesn't zoom the map");
  // (and the side panel's: a wheel over it scrolls it, at its end too, and the page stays)
  const side = await J(page, () => {
    const p = document.querySelector('.holomap-side');
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40), scrolls: p.scrollHeight > p.clientHeight + 2 };
  });
  await page.mouse.move(side.x, side.y);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(800);
  }
  const sideEnd = await J(page, () => ({ top: document.querySelector('.holomap-side').scrollTop, page: document.scrollingElement.scrollTop }));
  say(!side.scrolls || sideEnd.top > 0, `a wheel over the side panel scrolls it (scrollTop ${sideEnd.top})`);
  say(sideEnd.page === 0, `and, to its end and past it, not the page behind (${sideEnd.page} px)`);
  await J(page, () => {
    document.documentElement.style.overflowY = '';
    document.body.style.minHeight = '';
  });
  if (phone) {
    const rects = await J(page, () => {
      const p = document.querySelector('.holomap-legend-panel').getBoundingClientRect();
      const z = document.querySelector('.holomap-zoom').getBoundingClientRect();
      const m = window.__mc.map();
      return { meets: p.left < z.right && z.left < p.right && p.top < z.bottom && z.top < p.bottom, inside: p.left >= m.left && p.right <= m.right && p.top >= m.top && p.bottom <= m.bottom };
    });
    say(!rects.meets, 'the open key keeps off the zoom buttons');
    say(rects.inside, 'and inside the map');
    await snap('key');
  } else await snap('key');
  const overKey = await overlayProblems(page);
  say(overKey.length === 0, `the open key and the other overlays clear of one another${overKey.length ? ` (${overKey.join(', ')})` : ''}`);
  await page.locator('.holomap-legend-toggle').click();

  // ── the hover card: right of the dot, left of it when it'd run past the map's edge ──
  if (full && !phone) {
    const edge = await J(page, () => {
      const ids = window.__mc.onViewIds().filter((id) => document.elementFromPoint(window.__mc.dot(id).x, window.__mc.dot(id).y)?.closest('.holomap-system'));
      return ids.map((id) => ({ id, ...window.__mc.dot(id) })).sort((s, t) => t.x - s.x)[0];
    });
    await page.mouse.move(edge.x, edge.y);
    await settle(page, 300);
    const card = await J(page, () => {
      const r = document.querySelector('.holomap-hover')?.getBoundingClientRect();
      const m = window.__mc.map();
      return r ? { l: r.left, r: r.right, mr: m.right, ml: m.left } : null;
    });
    say(Boolean(card) && card.r <= card.mr + 0.5 && card.l >= card.ml - 0.5, `the hover card over ${edge.id}, the system nearest the right edge, stays inside the map`);
    await page.locator('.holomap-frame').screenshot({ path: `${out}/map-${size}-hover-edge.png` });
    const mid = await J(page, () => {
      const m = window.__mc.map();
      const ids = window.__mc.onViewIds().filter((id) => document.elementFromPoint(window.__mc.dot(id).x, window.__mc.dot(id).y)?.closest('.holomap-system'));
      return ids.map((id) => ({ id, ...window.__mc.dot(id) })).filter((s) => s.x < m.left + m.width * 0.4).sort((s, t) => s.x - t.x)[0];
    });
    await page.mouse.move(mid.x, mid.y);
    await settle(page, 300);
    const card2 = await J(page, () => document.querySelector('.holomap-hover')?.getBoundingClientRect().left);
    say(card2 > mid.x, `and stays to the right of ${mid.id}, with room`);
    await page.mouse.move(2, 2);
  }

  // ── zoomed in, the stage is as sharp as without will-change ──
  if (full && !phone) {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('+'); // (from the whole map: 1.5, 2.25, 3.375)
      await settle(page, 300);
    }
    await page.mouse.move(2, 2);
    await settle(page, 800);
    const m = await J(page, () => {
      const r = window.__mc.map();
      return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.25, width: Math.min(360, r.width * 0.5), height: Math.min(260, r.height * 0.5) };
    });
    const png = await page.screenshot({ clip: m, path: `${out}/map-${size}-k3.png` });
    const style = await page.addStyleTag({ content: '.holomap-stage { will-change: auto !important; }' });
    await settle(page, 800);
    const plain = await page.screenshot({ clip: m });
    await style.evaluate((el) => el.remove());
    const [sharp, sharpPlain] = [await edgeEnergy(page, png), await edgeEnergy(page, plain)];
    say(sharp >= sharpPlain * 0.93, `at k=${(await J(page, () => window.__mc.view().k)).toFixed(2)} the stage is as sharp as without will-change (${sharp.toFixed(2)} vs ${sharpPlain.toFixed(2)})`);
    await page.keyboard.press('0');
    await settle(page);
  }

  // ── M and Escape close it: held or not (the map's comings and goings counted, as an even number of flickers would look the same) ──
  if (full && !phone) {
    await J(page, () => {
      window.__flips = [];
      window.__was = Boolean(document.querySelector('.holomap'));
      new MutationObserver(() => {
        const now = Boolean(document.querySelector('.holomap'));
        if (now !== window.__was) window.__flips.push(now ? 'open' : 'close');
        window.__was = now;
      }).observe(document.body, { childList: true });
    });
    const hold = async () => {
      await page.keyboard.down('m');
      await page.waitForTimeout(250);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.down('m'); // (the repeats of a held key)
        await page.waitForTimeout(80);
      }
      await page.keyboard.up('m');
      await page.waitForTimeout(250);
      return J(page, () => window.__flips.splice(0));
    };
    const closed = await hold();
    say(closed.join() === 'close' && !(await hasMap(page)), `holding M closes the map once, its repeats don't open it again (${closed.join(', ') || 'no change'})`);
    const opened = await hold();
    say(opened.join() === 'open' && (await hasMap(page)), `holding M opens the map once, its repeats don't shut it (${opened.join(', ') || 'no change'})`);
  } else if (!(await hasMap(page))) await reopen();
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  say(!(await hasMap(page)), 'M closes the map');
  await reopen();
  await page.keyboard.press('/');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  say(!(await hasMap(page)), 'Escape closes the map, even from the find field');

  // ── find, then J jumps to it (the last: it leaves the system) ──
  await reopen();
  await page.keyboard.press('/');
  await page.keyboard.type('endo');
  await page.keyboard.press('Enter');
  await settle(page, 700);
  say((await J(page, () => window.__mc.sys('endor')?.getAttribute('aria-pressed'))) === 'true', 'find "endo" again: Endor is the course');
  await page.keyboard.press('j');
  const jumped = await page.waitForFunction(() => Boolean(window.__galaxy().jump), null, { timeout: 15000 }).then(() => true, () => false);
  say(jumped, 'J jumps to the course (the scene has a jump on)');

  say(errors.length === 0, `no errors${errors.length ? ` (${[...new Set(errors)].slice(0, 3).join('; ')})` : ''}`);
  await ctx.close();
};
