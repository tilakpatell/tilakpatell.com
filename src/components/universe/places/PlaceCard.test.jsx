import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PICK_A_SHIP, PLACE } from '../words';
import { resolvePlace } from './resolve';
import { UNIVERSE, fullSector, thingRow } from '../../expanse/shared/gen';
import PlaceCard from './PlaceCard';

const s = fullSector(UNIVERSE, 1, 0, 0);
const html = (props) => renderToStaticMarkup(<PlaceCard onFly={() => {}} {...props} />);
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, '’');

describe('a generated place’s card', () => {
  it('says what a planet is, in which sector, its facts and the way there', () => {
    const dest = resolvePlace('E:1,0:0:0', { t: 0 });
    const h = html({ dest });
    expect(h).toContain(`${dest.type} · Sector 1, 0, 0`);
    expect(h).toContain(`<h2 class="universe-title">${dest.name}</h2>`);
    for (const [dt] of dest.facts) expect(h).toContain(`<dt>${dt}</dt>`);
    expect(h.match(/<dd>/g)).toHaveLength(dest.facts.length);
    expect(text(h)).toContain(PLACE.fly);
  });
  it('docks at a station, and once docked opens the hangar and shop', () => {
    const dest = resolvePlace(s.stations[0].id, { t: 0 });
    expect(text(html({ dest }))).toContain(PLACE.dock);
    const docked = html({ dest, docked: true, onHangar: () => {} });
    expect(text(docked)).toContain(PLACE.hangar);
    expect(text(docked)).not.toContain(PLACE.dock);
  });
  it('asks for a ship with none, and a thing has no facts', () => {
    const dest = resolvePlace('E:1,0:0:0', { t: 0 });
    const none = renderToStaticMarkup(<PlaceCard dest={dest} />);
    expect(none).toContain(PICK_A_SHIP);
    expect(none).not.toContain('<button');
    const thing = resolvePlace(thingRow(s, 40).id, { t: 0 });
    expect(thing.facts).toEqual([]);
    expect(html({ dest: thing })).not.toContain('<dl');
  });
  it('plots while it’s found, and says how to get there with no scene', () => {
    const pending = html({ dest: { id: 'E:1,0:0', generated: true, pending: true, cube: [1, 0, 0] } });
    expect(pending).toContain('Sector 1, 0, 0');
    expect(pending).toContain(PLACE.plotting);
    expect(pending).not.toContain('<button');
    const flat = html({ dest: { id: 'E:1,0:0:0', generated: true, flat: true, cube: [1, 0, 0] } });
    expect(flat).toContain('Sector 1, 0, 0');
    expect(flat).toContain('E:1,0:0:0');
    expect(text(flat)).toContain(PLACE.flat);
    expect(flat).not.toContain(PLACE.plotting);
    expect(flat).not.toContain('<button');
  });
});
