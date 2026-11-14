/* global document */
// The nav map's chart, read in a browser check: is the ship's marker on it,
// inside its circle, and what does the readout under it say. Any check that
// flies somewhere calls it at each step (navmap-check.mjs does; the endless
// universe's flight check is to):
//   const { drawn, inside, edge, readout } = await shipOnChart(page)
// It presses M if the map isn't open, waits for the marker, and closes the
// map again with Escape if it opened it.

export async function shipOnChart(page, { timeout = 60000 } = {}) {
  const opened = !(await page.$('.navmap'));
  if (opened) {
    await page.keyboard.press('m');
    await page.waitForSelector('.navmap', { timeout });
  }
  await page.waitForSelector('.navmap-ship', { timeout }).catch(() => null);
  const out = await page.evaluate(() => {
    const ship = document.querySelector('.navmap-ship');
    const chart = document.querySelector('.navmap-chart')?.getBoundingClientRect();
    const readout = document.querySelector('.navmap-readout')?.textContent ?? null;
    if (!ship || !chart) return { drawn: false, inside: false, edge: false, readout };
    const b = ship.querySelector('.navmap-ship-halo').getBoundingClientRect();
    const x = b.left + b.width / 2 - (chart.left + chart.width / 2);
    const y = b.top + b.height / 2 - (chart.top + chart.height / 2);
    return { drawn: true, inside: Math.hypot(x, y) <= chart.width / 2 + 2, edge: ship.hasAttribute('data-edge'), readout };
  });
  if (opened) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.navmap'), null, { timeout }).catch(() => null);
  }
  return out;
}

// where the ship's marker is from the chart's middle, in px (null with none)
export const shipFromMiddle = (page) =>
  page.evaluate(() => {
    const ship = document.querySelector('.navmap-ship .navmap-ship-halo');
    const chart = document.querySelector('.navmap-chart')?.getBoundingClientRect();
    if (!ship || !chart) return null;
    const b = ship.getBoundingClientRect();
    return [b.left + b.width / 2 - (chart.left + chart.width / 2), b.top + b.height / 2 - (chart.top + chart.height / 2)];
  });

// the readout's sector for a point, as the chart writes it (lib/space/address.js's 120,000 cubes)
export const sectorWords = ({ x, y, z }) => `Sector ${[x, y ?? 0, z].map((v) => String(Math.round(v / 120000) + 0).replace('-', '−')).join(', ')} · `;
