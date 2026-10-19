/* global window, document */
// The party in two browsers (online-check.mjs --party): Alpha and Bravo on
// the universe map; Alpha opens the party's dialog from the online corner,
// starts a party and invites Bravo; Bravo says yes from the dialog; each
// sends a line of chat the other reads (sealed: the relay carries only
// blobs); Alpha says a quick-chat line, seen over Alpha's tag on Bravo's
// map, which is the ally green for a party mate; then in Bree, Bravo's chip
// counts Alpha as on their side and Alpha's quip floats over the ghost
// (the shot, OUT, is the evidence of that: it's drawn in the 3D).

const press = (loc) => loc.evaluate((el) => el.click(), null, { timeout: 120000 });

// the dialog, opened from the corner's Party button (the door a visitor
// takes), on the tab asked for
async function openDialog(page, tab) {
  if (!(await page.locator('.party-dialog').count())) {
    const pill = page.locator('.universe-online-pill').first();
    if ((await pill.getAttribute('aria-expanded')) !== 'true') await press(pill);
    await press(page.locator('.universe-online-party .universe-online-act'));
    await page.locator('.party-dialog').waitFor({ timeout: 60000 });
  }
  if (tab) await press(page.locator('.party-dialog [role="tab"]', { hasText: new RegExp(`^${tab}`) }));
}
const closeDialog = async (page) => {
  if (await page.locator('.party-dialog').count()) await page.keyboard.press('Escape');
  await page.locator('.party-dialog').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
};
// what a page's dialog lists as the party: name, present, leader
const membersOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.party-dialog .party-row[data-you], .party-dialog .party-row[data-mate]')].map((r) => ({
      name: r.querySelector('.party-name')?.firstChild?.textContent?.trim() ?? '',
      here: !r.hasAttribute('data-away'),
      leader: Boolean(r.querySelector('.chip')),
    })),
  );
const linesOf = (page) => page.evaluate(() => [...document.querySelectorAll('.party-dialog .party-line')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()));

// Alpha set `dist` units off Bravo's nose, both held still, so Bravo's tag
// for Alpha is drawn near
const placeAlpha = async (a, b, dist) => {
  const at = await b.evaluate(() => ({ ...window.__universeDebug.state.ship }));
  await b.evaluate(() => Object.assign(window.__universeDebug.state.ship, { speed: 0, pitch: 0 }));
  await a.evaluate(
    ([at, dist]) => Object.assign(window.__universeDebug.state.ship, { x: at.x - Math.sin(at.heading) * dist, y: at.y, z: at.z - Math.cos(at.heading) * dist, heading: at.heading, pitch: 0, speed: 0 }),
    [at, dist],
  );
};
const tagFor = (page, who) =>
  page.evaluate((who) => {
    const tag = [...document.querySelectorAll('.universe-tag[data-on]')].find((t) => t.querySelector('b')?.textContent === who);
    if (!tag) return null;
    const q = tag.querySelector('.quip-bubble');
    return { relation: tag.dataset.relation ?? null, quip: q && !q.hidden ? q.textContent : null };
  }, who);

export async function partyCheck({ a, b, base, check, waitFor, chipText, start, out, relays }) {
  const shot = async (page, name) => out && page.screenshot({ path: `${out}/party-${name}.png`, timeout: 120000 }).catch(() => {});
  await Promise.all([a.goto(base + '/universe'), b.goto(base + '/universe')]);
  for (const p of [a, b]) await p.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 240000 });
  await waitFor(() => a.evaluate(() => [...(window.__universeDebug.net()?.peers.values() ?? [])].some((p) => p.name === 'Bravo' && p.snaps.length)), 120000, 'Alpha hears Bravo on the map');
  console.log('ok   Alpha hears Bravo on the map');

  // Alpha starts a party and invites Bravo, from the dialog
  await openDialog(a, 'Party');
  await press(a.locator('.party-dialog button', { hasText: /^Start a party$/ }));
  const invite = a.locator('.party-dialog button[aria-label="Invite Bravo to your party"]');
  await invite.waitFor({ timeout: 60000 });
  await shot(a, 'invite');
  await press(invite);
  // Bravo hears the invite (the corner's dot) and says yes in the dialog
  await openDialog(b, 'Party');
  const yes = b.locator('.party-dialog button[aria-label="Join Alpha’s party"]');
  await yes.waitFor({ timeout: 60000 });
  await shot(b, 'invited');
  await press(yes);
  const both = (m) => m.length === 2 && m.every((x) => x.here) && m.find((x) => x.name === 'Alpha')?.leader;
  const seen = await waitFor(async () => {
    const [x, y] = [await membersOf(a), await membersOf(b)];
    return both(x) && both(y) ? [x, y] : null;
  }, 60000, 'both in one party, Alpha leading');
  check(true, `one party, both online, Alpha leads: ${JSON.stringify(seen[0])}`);
  await shot(a, 'members');

  // a line each way, read on the other side
  for (const [from, to, text] of [
    [a, b, 'Meet at the Prancing Pony'],
    [b, a, 'On my way, save me a seat'],
  ]) {
    await openDialog(from, 'Chat');
    const field = from.locator('.party-dialog .party-say .party-input');
    await field.fill(text);
    await press(from.locator('.party-dialog .party-say button[type="submit"]'));
    await openDialog(to, 'Chat');
    const got = await waitFor(async () => (await linesOf(to)).find((l) => l.includes(text)) ?? null, 60000, `the line “${text}” read on the other side`);
    check(Boolean(got), `chat: ${JSON.stringify(got)}`);
  }
  await shot(b, 'chat');
  // (and what crossed the relay: the chat sealed, no line of it in the clear)
  if (relays) {
    const carried = relays.contents();
    check(carried.some((c) => c.includes('psay')) && !carried.some((c) => /Prancing|save me a seat/.test(c)), `the relay carried sealed lines only (${carried.length} events)`);
  }

  // a quip from Alpha, over Alpha's tag on Bravo's map, in the ally green
  await closeDialog(b);
  await openDialog(a, 'Quick chat');
  await placeAlpha(a, b, 60);
  await press(a.locator('.party-dialog .party-quips button', { hasText: /^On my way$/ }));
  const tag = await waitFor(async () => {
    await placeAlpha(a, b, 60);
    const t = await tagFor(b, 'Alpha');
    return t?.quip ? t : null;
  }, 90000, 'Alpha’s quip over the tag on Bravo’s map');
  check(tag.quip === 'On my way' && tag.relation === 'ally', `the tag on Bravo’s map: ${JSON.stringify(tag)}`);
  await shot(b, 'quip-map');
  await closeDialog(a);

  // in Bree: the chip counts the party mate on your side, and a quip over the ghost
  const w = '/middle-earth/bree';
  await Promise.all([a.goto(base + w), b.goto(base + w)]);
  const chip = await waitFor(async () => {
    await Promise.all([start(a), start(b)]);
    const t = await chipText(b);
    return t && /ally|allies/i.test(t) ? t : null;
  }, 150000, `${w}: Bravo’s chip counts Alpha on their side`);
  check(/your ally$|1 ally$/.test(chip), `${w}: Bravo’s chip ${JSON.stringify(chip)}`);
  const said = await a.evaluate(() => window.dispatchEvent(new CustomEvent('tp:party', { detail: { tab: 'quick' } })));
  await a.locator('.party-dialog').waitFor({ timeout: 60000 });
  check(said, 'the dialog opens over a world (tp:party)');
  await press(a.locator('.party-dialog .party-quips button', { hasText: /^Hello$/ }));
  await closeDialog(a);
  // (the bubble is a sprite in Bree's 3D, which the shot shows; a mate's
  // quip is also a line in the online corner's feed, which is read here)
  const heard = await waitFor(() => b.evaluate(() => document.body.textContent.includes('Alpha: Hello')), 30000, 'Bravo hears Alpha’s Hello').catch(() => false);
  check(heard, `${w}: Bravo hears Alpha’s quip in Bree`);
  await b.waitForTimeout(1500);
  await shot(b, 'quip-bree');
  return { members: seen[0].length, chip };
}
