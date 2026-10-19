/* global document */
// The universe nav map's ship marker, measured in a Playwright page: is the
// ship on the chart, inside its circle, pinned to its rim, and what does the
// bar under the circle say? For scripts/navmap-check.mjs and any check that
// flies the ship somewhere and wants to know the chart still shows it (lane
// 2's universe-endless-check.mjs asks at every step).
//
//   shipMarker(page) → { drawn, inside, edge, readout, x, y, cx, cy, r }
//     the map as it is, open or not: the marker's centre (x, y) and the
//     chart's (cx, cy) and radius r, in CSS px
//   shipOnChart(page, { timeout }) → the same
//     opens the map with M if it isn't open (and closes it again with
//     Escape), and waits for the marker first; with no ship there is none,
//     and it says so, drawn false, once `timeout` is out
//
// The marker's centre is where its group's own origin lands on the screen
// (the translate, through the SVG's screen matrix): its box would move with
// the arrow's turn and the halo's ping.

const SLACK = 2; // px: a centre this far past the circle still counts as in it

export const shipMarker = (page) =>
  page.evaluate((slack) => {
    const chart = document.querySelector('.navmap-chart');
    const ship = chart?.querySelector('.navmap-ship');
    const readout = document.querySelector('.navmap-readout')?.textContent ?? null;
    if (!chart || !ship) return { drawn: false, inside: false, edge: false, readout };
    const c = chart.getBoundingClientRect();
    const m = ship.getScreenCTM();
    const b = ship.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    const r = Math.min(c.width, c.height) / 2;
    const x = m ? m.e : b.left + b.width / 2;
    const y = m ? m.f : b.top + b.height / 2;
    return { drawn: b.width > 0 && b.height > 0, inside: Math.hypot(x - cx, y - cy) <= r + slack, edge: ship.hasAttribute('data-edge'), readout, x, y, cx, cy, r };
  }, SLACK);

export async function shipOnChart(page, { timeout = 60000 } = {}) {
  const opened = !(await page.$('.navmap'));
  if (opened) await page.keyboard.press('m');
  await page.waitForSelector('.navmap-chart', { timeout });
  await page.waitForSelector('.navmap-ship', { state: 'attached', timeout }).catch(() => null);
  const at = await shipMarker(page);
  if (opened) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('.navmap', { state: 'detached', timeout });
  }
  return at;
}
