import { describe, expect, it } from 'vitest';
import { AREAS, DATES, FRAME, LABELS, LINES, PLACES, ROAD_MILES, place } from './geography';

// the research note's §6: the numbers Tolkien states, kept as checks
const dist = (a, b) => Math.hypot(place(a).east - place(b).east, place(a).south - place(b).south);
const length = (points) => points.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
const inside = ([e, s]) => e >= FRAME.east[0] && e <= FRAME.east[1] && s >= FRAME.south[0] && s <= FRAME.south[1];
const line = (id) => LINES.find((l) => l.id === id);

describe('the geography, in miles from Hobbiton', () => {
  it('is framed as the note frames it', () => {
    expect(FRAME).toEqual({ origin: 'hobbiton', milesPerUnit: 2, sheetOrigin: [210, 165], east: [-420, 1180], south: [-330, 790] });
    expect(place('hobbiton')).toMatchObject({ east: 0, south: 0 });
  });

  it('gives every place its own id, a kind, a confidence and a source', () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(82);
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    for (const p of PLACES) {
      expect(p.id, p.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(p.name, p.id).toBeTruthy();
      expect(['S', 'D', 'E'], p.id).toContain(p.confidence);
      expect(p.source.length, p.id).toBeGreaterThan(3);
      expect(['town', 'city', 'fortress', 'hill', 'pass', 'gate', 'ford', 'haven', 'mountain', 'ruin', 'wood', 'lake', 'sea', 'region'], p.id).toContain(p.kind);
    }
  });

  it('keeps every place on the frame, but those marked beyond it', () => {
    for (const p of PLACES) expect(inside([p.east, p.south]), p.id).toBe(!p.beyond);
    expect(PLACES.filter((p) => p.beyond).map((p) => p.id)).toEqual(['umbar']);
  });

  it('throws on a place it does not know', () => {
    expect(() => place('narnia')).toThrow(/narnia/);
  });

  it('puts Minas Tirith 600 miles south and about 900 off (Letter 294, the Baynes notes)', () => {
    expect(place('minas-tirith').south).toBe(600);
    expect(Math.abs(dist('hobbiton', 'minas-tirith') - 895) / 895).toBeLessThan(0.01);
  });

  it('holds the distances the narrative states', () => {
    expect(Math.abs(dist('rivendell', 'hollin-ridge') - 135) / 135).toBeLessThan(0.05);
    expect(Math.abs(dist('moria', 'east-gate') - 40) / 40).toBeLessThan(0.05);
    // Osgiliath fifteen miles north-east of the city
    const [os, mt] = [place('osgiliath'), place('minas-tirith')];
    expect(dist('osgiliath', 'minas-tirith')).toBeLessThan(20);
    expect(os.east).toBeGreaterThan(mt.east);
    expect(os.south).toBeLessThan(mt.south);
    // Fornost a hundred north of Bree, Annúminas a hundred west of Fornost
    expect(Math.abs(place('bree').south - place('fornost').south - 100)).toBeLessThanOrEqual(10);
    expect(Math.abs(place('bree').east - place('fornost').east)).toBeLessThanOrEqual(10);
    expect(Math.abs(place('fornost').east - place('annuminas').east - 100)).toBeLessThanOrEqual(10);
    // Pelargir “more than a hundred miles” south of the city (the note puts it a hundred due south and 25 east)
    expect(place('pelargir').south - place('minas-tirith').south).toBeGreaterThanOrEqual(100);
    expect(dist('pelargir', 'minas-tirith')).toBeGreaterThan(100);
  });

  it('runs the Ered Lithui four hundred miles', () => {
    expect(Math.abs(length(line('ered-lithui').points) - 400) / 400).toBeLessThan(0.05);
  });

  it('keeps every line on the frame, and only Mordor’s ranges dark', () => {
    for (const l of LINES) {
      expect(['coast', 'range', 'river', 'road'], l.id).toContain(l.kind);
      expect(l.points.length, l.id).toBeGreaterThanOrEqual(2);
      for (const p of l.points) expect(inside(p), `${l.id} ${p}`).toBe(true);
    }
    expect(LINES.filter((l) => l.dark).map((l) => l.id).sort()).toEqual(['ephel-duath', 'ered-lithui']);
    expect(LINES.filter((l) => l.dark).every((l) => l.kind === 'range')).toBe(true);
  });

  it('keeps every area and label on the frame', () => {
    for (const a of AREAS) {
      expect(['forest', 'lake', 'sea', 'marsh'], a.id).toContain(a.kind);
      const pts = a.points || [a.ellipse.at];
      for (const p of pts) expect(inside(p), `${a.id} ${p}`).toBe(true);
    }
    expect(AREAS.find((a) => a.id === 'lorien').tint).toBe('gold');
    expect(AREAS.find((a) => a.id === 'mirkwood').tint).toBe('dark');
    for (const l of LABELS) expect(inside([l.east, l.south]), l.name).toBe(true);
    expect(LABELS.map((l) => l.name)).toEqual(expect.arrayContaining(['ERIADOR', 'THE SHIRE', 'RHOVANION', 'ROHAN', 'GONDOR', 'MORDOR', 'HARAD', 'RHÛN', 'LINDON', 'ENEDWAITH']));
  });

  it('walks the Ring’s road in increasing miles, every stop a place with a date, and home by Minas Tirith', () => {
    const order = ['hobbiton', 'bree', 'weathertop', 'rivendell', 'moria', 'lorien', 'amon-hen', 'dead-marshes', 'black-gate', 'cirith-ungol', 'mount-doom', 'minas-tirith'];
    expect(Object.keys(ROAD_MILES)).toEqual(order);
    const miles = order.map((id) => ROAD_MILES[id]);
    for (let i = 1; i < miles.length; i++) expect(miles[i]).toBeGreaterThan(miles[i - 1]);
    expect(ROAD_MILES['mount-doom']).toBe(1779);
    for (const id of order) {
      expect(() => place(id)).not.toThrow();
      expect(DATES[id], id).toMatch(/30(18|19)$/);
    }
  });
});
