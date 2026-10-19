import { describe, expect, it } from 'vitest';
import { DOTS, NAMES, TYPE, UNNAMED } from './mapNames';
import { STOPS } from './road';
import { SHEET, placeAt } from './sheet';

const touch = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const of = (text) => NAMES.find((n) => n.text === text);

describe('the names on the sheet', () => {
  it('names every stop of the road, in the strongest type', () => {
    for (const s of STOPS) expect(of(s.name)?.kind, s.id).toBe('stop');
    expect(TYPE.stop[0]).toBeGreaterThan(TYPE.great[0]);
    expect(TYPE.great[0]).toBeGreaterThan(TYPE.minor[0]);
  });

  it('names every great place, and the lands, forests and seas', () => {
    for (const t of ['Grey Havens', 'Isengard', 'Edoras', 'Helm’s Deep', 'Minas Tirith', 'Barad-dûr', 'Erebor', 'Dol Guldur']) expect(of(t)?.kind, t).toBe('great');
    for (const t of ['ERIADOR', 'THE SHIRE', 'RHOVANION', 'ROHAN', 'GONDOR', 'MORDOR', 'MIRKWOOD', 'FANGORN', 'The Great Sea']) expect(of(t), t).toBeTruthy();
  });

  it('names the minor places where there is room, and leaves off no more than the crowded ones', () => {
    for (const t of ['Fornost', 'Annúminas', 'Tharbad', 'Lond Daer', 'Carrock', 'Erebor', 'Dale', 'Esgaroth', 'Pelargir', 'Dol Amroth', 'Umbar']) expect(of(t), t).toBeTruthy();
    // what gives way is the knot about Minas Tirith and the Morgul Vale,
    // where Gondor’s minor names would stand on the city and the road’s stops
    expect(UNNAMED.every((id) => ['osgiliath', 'cair-andros', 'henneth-annun', 'minas-morgul', 'dunharrow'].includes(id)), UNNAMED.join()).toBe(true);
  });

  it('lets no two names touch, and no name cover a named place’s dot or a stop', () => {
    for (let i = 0; i < NAMES.length; i++)
      for (let j = i + 1; j < NAMES.length; j++) {
        // a forest’s name is lettered in its trees, which may run under a land’s faint name
        if (NAMES[i].kind === 'forest' || NAMES[j].kind === 'forest') continue;
        expect(touch(NAMES[i].box, NAMES[j].box), `${NAMES[i].text} / ${NAMES[j].text}`).toBe(false);
      }
    const dots = [...DOTS, ...STOPS.map((s) => [s.x, s.y])];
    for (const n of NAMES) for (const [x, y] of dots) if (!(n.at && n.at[0] === x && n.at[1] === y)) expect(touch(n.box, [x - 2, y - 2, x + 2, y + 2]), `${n.text} on ${x},${y}`).toBe(false);
  });

  it('sets each place’s name close by its dot', () => {
    for (const n of NAMES.filter((x) => ['stop', 'great', 'minor'].includes(x.kind))) {
      const [x0, y0, x1, y1] = n.box;
      const gap = Math.hypot(Math.max(x0 - n.at[0], 0, n.at[0] - x1), Math.max(y0 - n.at[1], 0, n.at[1] - y1));
      expect(gap, n.text).toBeLessThan(26);
    }
  });

  it('keeps every name within the sheet’s torn edge', () => {
    for (const n of NAMES) {
      expect(n.box[0], n.text).toBeGreaterThanOrEqual(14);
      expect(n.box[1], n.text).toBeGreaterThanOrEqual(14);
      expect(n.box[2], n.text).toBeLessThanOrEqual(SHEET.w - 14);
      expect(n.box[3], n.text).toBeLessThanOrEqual(SHEET.h - 14);
    }
  });

  it('writes MORDOR inside Mordor, east of the mountain', () => {
    const m = of('MORDOR');
    expect(m.x).toBeGreaterThan(placeAt('mount-doom')[0]);
    expect(m.y).toBeGreaterThan(placeAt('black-gate')[1]);
  });
});
