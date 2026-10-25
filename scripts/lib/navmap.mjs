/* global document */
// The nav map's browser checks' own sums and steps: scripts/navmap-check.mjs
// uses them, and any check that flies the ship somewhere and wants to know
// its marker is still on the chart (universe-endless-check.mjs, lane 2's).
// The sums are worked out here, not read from the site's code, so a check
// says what the chart should show rather than what it does. Tested beside.
//
// shipSector(ship) → [sx, sy, sz]: each axis over SECTOR, rounded, no minus zero
// sectorWords(ship) → 'Sector 2, 0, −1 · ', what the readout starts with
// levelOnOpen(ship, citadel) → 'system' in the Curve (within CURVE_EDGE of
//   the Citadel, at its middle), else 'neighbourhood': the chart's level on
//   opening, on the ship
// jumpGoal(wonders, start) → { name, gx, gz, near } or null: the first of
//   JUMP_GOALS (__universeDebug.wonders' { name, at, reach }) further than
//   its reach and NEAR from the start, across the disc (x and z); near is how
//   close counts as there
// meet(a, b), within(inner, outer, slack = 1): two boxes (getBoundingClientRect's
//   left, top, width, height) that overlap, and one inside another
// insideCircle(box, { x, y }, slack = 2): a point inside the circle drawn in
//   a square box, out to slack px past its rim
// shipOnChart(page, { timeout }) → { drawn, inside, edge, readout }: the
//   nav map opened with M if it's shut, the ship's marker waited for and
//   measured (drawn: it's on the screen; inside: its centre is within the
//   chart's circle; edge: it's pinned to the rim; readout: the bar's words,
//   or null), and the map shut again with Escape if it was opened here. On a
//   phone's list the chart is hidden, and the marker isn't drawn.

export const SECTOR = 120000; // (a sector's width: lib/space/address.js's SECTOR)
export const CURVE_EDGE = 6000; // (the Curve's edge round its middle: layout.js's SECTORS.rickmorty.edge)
export const JUMP_GOALS = ['Ember', 'Halcyon']; // (both in the main sector, far apart)
export const NEAR = 600; // (past a wonder's reach: the jump parks the ship a little way out)

const box = (b) => ({ x0: b.left, y0: b.top, x1: b.left + b.width, y1: b.top + b.height });

export const shipSector = ({ x, y, z }) => [x, y, z].map((v) => Math.round(v / SECTOR) + 0);
export const sectorWords = (ship) => `Sector ${shipSector(ship).map((n) => String(n).replace('-', '−')).join(', ')} · `;

export function levelOnOpen(ship, citadel) {
  const at = citadel?.at;
  return at && Math.hypot(ship.x - at[0], ship.z - at[2]) <= CURVE_EDGE ? 'system' : 'neighbourhood';
}

export function jumpGoal(wonders, start) {
  for (const name of JUMP_GOALS) {
    const w = (wonders ?? []).find((o) => o.name === name);
    if (!w) continue;
    const near = w.reach + NEAR;
    if (Math.hypot(w.at[0] - start.x, w.at[2] - start.z) > near) return { name, gx: w.at[0], gz: w.at[2], near };
  }
  return null;
}

export function meet(a, b) {
  const [p, q] = [box(a), box(b)];
  return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
}

export function within(inner, outer, slack = 1) {
  const [p, q] = [box(inner), box(outer)];
  return p.x0 >= q.x0 - slack && p.y0 >= q.y0 - slack && p.x1 <= q.x1 + slack && p.y1 <= q.y1 + slack;
}

export function insideCircle(b, { x, y }, slack = 2) {
  if (!(b.width > 0)) return false;
  return Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2)) <= b.width / 2 + slack;
}

// (in the page: the chart's box, the marker's, whether it's pinned, the readout)
const readShip = () => {
  const r = (el) => {
    const b = el?.getBoundingClientRect();
    return b ? { left: b.left, top: b.top, width: b.width, height: b.height } : null;
  };
  const ship = document.querySelector('.navmap-ship');
  return { chart: r(document.querySelector('.navmap-chart')), ship: r(ship), edge: ship?.hasAttribute('data-edge') ?? false, readout: document.querySelector('.navmap-readout')?.textContent ?? null };
};

export async function shipOnChart(page, { timeout = 60000 } = {}) {
  const opened = !(await page.$('.navmap'));
  if (opened) {
    await page.keyboard.press('m');
    await page.waitForSelector('.navmap', { timeout });
  }
  const drawn = await page.waitForSelector('.navmap-ship', { state: 'visible', timeout }).then(
    () => true,
    () => false,
  );
  const m = drawn ? await page.evaluate(readShip) : null;
  const at = m?.ship && { x: m.ship.left + m.ship.width / 2, y: m.ship.top + m.ship.height / 2 };
  const seen = { drawn, inside: Boolean(at && m.chart && insideCircle(m.chart, at)), edge: Boolean(drawn && m.edge), readout: drawn ? m.readout : null };
  if (opened) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('.navmap', { state: 'detached', timeout });
  }
  return seen;
}
