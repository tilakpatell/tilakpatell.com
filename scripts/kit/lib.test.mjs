import { describe, expect, it } from 'vitest';
import { familyOf, kindOf, thinCards, windFromColor, boundsOf, tonesOf } from './lib.mjs';

describe('a pack file’s family, from its name', () => {
  it('is the name before its first underscore, lower-cased', () => {
    const names = {
      Birch_3: 'birch',
      Flower_1_Group: 'flower',
      RockPath_Round_Wide: 'rockpath',
      Astronaut_FinnTheFrog: 'astronaut',
      Building_Large_2: 'building',
      Mushroom_RedCap: 'mushroom',
      CherryBlossom_2: 'cherryblossom',
      Rock_Medium_3: 'rock',
      Pebble_Square_6: 'pebble',
      Grass_Wispy_Tall: 'grass',
    };
    for (const [name, family] of Object.entries(names)) expect(familyOf(name), name).toBe(family);
  });

  it('is the whole name, lower-cased, when it has no underscore', () => {
    expect(familyOf('Atlas')).toBe('atlas');
    expect(familyOf('GeodesicDome')).toBe('geodesicdome');
  });
});

describe('a pack file’s kind, from its family', () => {
  it('names one kind for each of the spec’s list', () => {
    const kinds = {
      Birch_3: 'tree',
      Bush_Large_Flowers: 'bush',
      Grass_Common_Tall: 'grass',
      Flower_2_Single: 'flower',
      Fern_1: 'plant',
      Mushroom_Oyster: 'mushroom',
      Rock_Big_2: 'rock',
      RockPath_Square_Thin: 'path',
      Pebble_Round_4: 'pebble',
      Planet_10: 'planet',
      Astronaut_FinnTheFrog: 'character',
      Rover_Round: 'vehicle',
      Street_Straight: 'street',
      Decal_Crack: 'decal',
      Building_L: 'building',
      Pickup_Crate: 'prop',
    };
    for (const [name, kind] of Object.entries(kinds)) expect(kindOf(name, 'nature'), name).toBe(kind);
  });

  it('gathers each kind’s other families into it', () => {
    // (the nature packs' trees, the older pack's by its own names, then the space pack's)
    for (const n of ['CherryBlossom_2', 'CommonTree_1', 'DeadTree_5', 'GiantPine_4', 'Pine_2', 'TallThick_3', 'TwistedTree_1', 'BirchTree_2', 'MapleTree_4', 'PalmTree_1', 'Tree_Blob_1']) {
      expect(kindOf(n, 'x'), n).toBe('tree');
    }
    expect(kindOf('Petal_3', 'x')).toBe('flower');
    for (const n of ['Clover_2', 'Plant_7_Big']) expect(kindOf(n, 'x'), n).toBe('plant');
    for (const n of ['Mech_RaeTheRedPanda', 'Enemy_Flying', 'Cow', 'Horse_White', 'Zebra', 'Llama', 'Pig', 'Pug', 'Sheep']) {
      expect(kindOf(n, 'x'), n).toBe('character');
    }
    expect(kindOf('Spaceship_BarbaraTheBee', 'x')).toBe('vehicle');
    expect(kindOf('Sidewalk_Corner', 'x')).toBe('street');
  });

  it('files a family it does not know as a prop, whatever the pack', () => {
    expect(kindOf('Connector', 'space')).toBe('prop');
    expect(kindOf('House_Cylinder', 'space')).toBe('prop');
    expect(kindOf('Bush_1', 'space')).toBe('bush');
    expect(kindOf('Bush_1')).toBe('bush');
  });
});

// four leaf cards, each a quad of two triangles sharing an edge (four
// vertices, six indices), standing 1 × 1 at different places
function cards(n = 4) {
  const positions = new Float32Array(n * 12);
  const indices = new Uint32Array(n * 6);
  for (let c = 0; c < n; c++) {
    const [x, y, z] = [c * 3 - 2, c * 0.5, 1 - c];
    positions.set([x, y, z, x + 1, y, z, x + 1, y + 1, z, x, y + 1, z], c * 12);
    indices.set([0, 1, 2, 0, 2, 3].map((i) => i + c * 4), c * 6);
  }
  return { positions, indices };
}
const centroidOf = (p, from, count) => {
  const c = [0, 0, 0];
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) c[k] += p[(from + i) * 3 + k] / count;
  return c;
};
const extentOf = (p, from, count, axis) => {
  const v = Array.from({ length: count }, (_, i) => p[(from + i) * 3 + axis]);
  return Math.max(...v) - Math.min(...v);
};

describe('a crown’s leaf cards, thinned', () => {
  it('keeps the fraction asked, each card grown about its own centre', () => {
    const { positions, indices } = cards();
    const out = thinCards(positions, indices, 0.5, 1);
    // two of the four quads: eight vertices, twelve indices, a map to gather the rest by
    expect(out.positions).toBeInstanceOf(Float32Array);
    expect(out.indices).toBeInstanceOf(Uint32Array);
    expect(out.map).toBeInstanceOf(Uint32Array);
    expect(out.positions.length).toBe(8 * 3);
    expect(out.indices.length).toBe(12);
    expect(out.map.length).toBe(8);
    // (the winding kept, the vertices numbered afresh a card at a time)
    expect([...out.indices]).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const was = new Set();
    for (let g = 0; g < 2; g++) {
      // (a card's four map entries are its own four old vertices, in order)
      const old = Math.floor(out.map[g * 4] / 4);
      expect([...out.map.slice(g * 4, g * 4 + 4)]).toEqual([0, 1, 2, 3].map((i) => old * 4 + i));
      was.add(old);
      const before = centroidOf(positions, old * 4, 4);
      const after = centroidOf(out.positions, g * 4, 4);
      for (let k = 0; k < 3; k++) expect(Math.abs(after[k] - before[k])).toBeLessThan(1e-6);
      // 0.5 would grow a card ×1.414, but a card grows at most ×1.25
      expect(extentOf(out.positions, g * 4, 4, 0) / extentOf(positions, old * 4, 4, 0)).toBeCloseTo(1.25, 5);
      expect(extentOf(out.positions, g * 4, 4, 1) / extentOf(positions, old * 4, 4, 1)).toBeCloseTo(1.25, 5);
      expect(extentOf(out.positions, g * 4, 4, 2)).toBe(0);
    }
    // (two different cards, in the order they stood in)
    expect(was.size).toBe(2);
    const [a, b] = [...was];
    expect(a).toBeLessThan(b);
  });

  it('grows a card by 1 / sqrt(the share kept) while that is under the cap', () => {
    const { positions, indices } = cards();
    // 0.8 of four is three cards, three quarters: each ×1.155, not 0.8's ×1.118
    const out = thinCards(positions, indices, 0.8, 5);
    expect(out.map.length).toBe(12);
    const old = Math.floor(out.map[0] / 4);
    expect(extentOf(out.positions, 0, 4, 0) / extentOf(positions, old * 4, 4, 0)).toBeCloseTo(1 / Math.sqrt(0.75), 5);
  });

  it('does not grow the one card of a crown that has one', () => {
    // 0.4 of one card is that card, all of it kept: it stays as it stood
    const { positions, indices } = cards(1);
    const out = thinCards(positions, indices, 0.4, 2);
    expect(Array.from(out.positions)).toEqual(Array.from(positions));
    expect(Array.from(out.indices)).toEqual(Array.from(indices));
  });

  it('keeps every card as it stood when asked to keep them all', () => {
    const { positions, indices } = cards();
    const out = thinCards(positions, indices, 1, 9);
    expect(Array.from(out.positions)).toEqual(Array.from(positions));
    expect(Array.from(out.indices)).toEqual(Array.from(indices));
    expect(Array.from(out.map)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('keeps at least one card, however little is asked for', () => {
    const { positions, indices } = cards();
    const out = thinCards(positions, indices, 0.01, 3);
    expect(out.indices.length).toBe(6);
    expect(out.map.length).toBe(4);
  });

  it('chooses the same cards for the same seed, other cards for others', () => {
    const { positions, indices } = cards(12);
    const pick = (seed) => Array.from(thinCards(positions, indices, 0.5, seed).map);
    expect(pick(7)).toEqual(pick(7));
    const picks = new Set(Array.from({ length: 8 }, (_, s) => pick(s + 1).join()));
    expect(picks.size).toBeGreaterThan(1);
    expect(pick(7).length).toBe(6 * 4);
  });

  it('lets a lone triangle be a card of its own', () => {
    // a quad (vertices 0 to 3) and a lone triangle (4 to 6)
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 5, 0, 0, 6, 0, 0, 5, 1, 0]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6]);
    const out = thinCards(positions, indices, 1, 1);
    expect([...out.indices]).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6]);
    expect(out.map.length).toBe(7);
    // (of two cards, half is one: whichever it is, it is whole)
    const half = thinCards(positions, indices, 0.5, 2);
    expect([3, 4]).toContain(half.map.length);
  });

  it('keeps triangles that share no vertex apart, each grown about its own centre', () => {
    // four lone triangles, 1 × 1 each, along x: four cards
    const positions = new Float32Array(Array.from({ length: 4 }, (_, t) => [t * 2, 0, 0, t * 2 + 1, 0, 0, t * 2, 1, 0]).flat());
    const indices = Uint32Array.from({ length: 12 }, (_, i) => i);
    const out = thinCards(positions, indices, 0.5, 4);
    expect(out.map.length).toBe(6);
    expect([...out.indices]).toEqual([0, 1, 2, 3, 4, 5]);
    for (let g = 0; g < 2; g++) {
      const old = out.map[g * 3] / 3;
      expect([...out.map.slice(g * 3, g * 3 + 3)]).toEqual([0, 1, 2].map((i) => old * 3 + i));
      const before = centroidOf(positions, old * 3, 3);
      const after = centroidOf(out.positions, g * 3, 3);
      for (let k = 0; k < 3; k++) expect(Math.abs(after[k] - before[k])).toBeLessThan(1e-6);
      expect(extentOf(out.positions, g * 3, 3, 0)).toBeCloseTo(1.25, 5);
    }
  });

  // two clumps of three triangles, each a fan round its first vertex (a
  // pine's needle clump, roughly), their triangles interleaved in the index
  // list as the nature pack's pines have them
  function clumps() {
    const fan = (x) => [x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0, x - 1, 1, 0];
    const positions = new Float32Array([...fan(0), ...fan(10)]);
    const a = [[0, 1, 2], [0, 2, 3], [0, 3, 4]];
    const b = a.map((t) => t.map((i) => i + 5));
    const indices = new Uint32Array([a[0], b[0], a[1], b[1], a[2], b[2]].flat());
    return { positions, indices };
  }

  it('keeps a clump of triangles whole, wherever its triangles stand in the list', () => {
    const { positions, indices } = clumps();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const out = thinCards(positions, indices, 0.5, seed);
      // one clump of two: its five vertices, its three triangles, nothing of the other
      expect(out.map.length).toBe(5);
      expect([...out.indices]).toEqual([0, 1, 2, 0, 2, 3, 0, 3, 4]);
      const old = out.map[0] / 5;
      expect([0, 1]).toContain(old);
      expect([...out.map]).toEqual(Array.from({ length: 5 }, (_, i) => old * 5 + i));
      const before = centroidOf(positions, old * 5, 5);
      const after = centroidOf(out.positions, 0, 5);
      for (let k = 0; k < 3; k++) expect(Math.abs(after[k] - before[k])).toBeLessThan(1e-6);
      expect(extentOf(out.positions, 0, 5, 0) / extentOf(positions, old * 5, 5, 0)).toBeCloseTo(1.25, 5);
    }
    // (both kept: the clumps in the order they first stood, each whole)
    const all = thinCards(positions, indices, 1, 1);
    expect([...all.map]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...all.indices]).toEqual([0, 1, 2, 0, 2, 3, 0, 3, 4, 5, 6, 7, 5, 7, 8, 5, 8, 9]);
  });

  it('counts its fraction in clumps, not triangles', () => {
    // a clump of three triangles (vertices 0 to 4) and three lone ones (5 to
    // 13): four cards, so half is two (of six triangles, half would be three)
    const lone = (x) => [x, 0, 0, x + 1, 0, 0, x, 1, 0];
    const positions = new Float32Array([...clumps().positions.slice(0, 15), ...lone(20), ...lone(30), ...lone(40)]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const seen = new Set();
    for (let seed = 1; seed <= 12; seed++) {
      const out = thinCards(positions, indices, 0.5, seed);
      // the clump and a lone one (eight vertices, four triangles), or two lone ones (six, two)
      const shape = `${out.map.length}/${out.indices.length / 3}`;
      expect(['8/4', '6/2']).toContain(shape);
      seen.add(shape);
    }
    expect(seen.size).toBe(2);
  });

  it('is nothing for nothing', () => {
    const out = thinCards(new Float32Array(0), new Uint32Array(0), 0.4, 1);
    expect([out.positions.length, out.indices.length, out.map.length]).toEqual([0, 0, 0]);
  });

  it('takes two quads that share a vertex as one card', () => {
    // two quads meeting at vertex 2: one clump, its seven vertices each once
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 1, 0, 2, 2, 0, 1, 2, 0]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 2, 4, 5, 2, 5, 6]);
    const out = thinCards(positions, indices, 1, 1);
    expect([...out.map]).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect([...out.indices]).toEqual([...indices]);
    // (half of one card is still that one card, whole and not grown)
    const half = thinCards(positions, indices, 0.5, 1);
    expect(half.map.length).toBe(7);
    const before = centroidOf(positions, 0, 7);
    const after = centroidOf(half.positions, 0, 7);
    for (let k = 0; k < 3; k++) expect(Math.abs(after[k] - before[k])).toBeLessThan(1e-6);
    expect(extentOf(half.positions, 0, 7, 0)).toBeCloseTo(extentOf(positions, 0, 7, 0), 6);
  });
});

describe('a wind weight, from the vertex colour', () => {
  it('is the red channel as a byte', () => {
    const color = new Float32Array([0.137, 0.137, 0.137, 1, 1, 1, 1, 1]);
    const wind = windFromColor(color, 4);
    expect(wind).toBeInstanceOf(Uint8Array);
    expect([...wind]).toEqual([35, 255]);
  });

  it('reads three-channel colours by their stride too', () => {
    const wind = windFromColor(new Float32Array([1, 0, 0, 0.5, 0.2, 0.2, 0, 1, 1]), 3);
    expect([...wind]).toEqual([255, 128, 0]);
  });

  it('holds a colour out of range to a byte', () => {
    expect([...windFromColor(new Float32Array([1.5, 0, 0, 1, -0.5, 0, 0, 1]), 4)]).toEqual([255, 0]);
  });
});

// a ring of 16 points at a height, round the y axis
const ring = (r, y, cx = 0, cz = 0) =>
  Array.from({ length: 16 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 8), y, cz + r * Math.sin((i * Math.PI) / 8)]);
// a tree as a trunk (radius 0.2, y 0 to 2) under a crown (a sphere of radius 1 at y 3)
function tree() {
  const points = [];
  for (const y of [0, 0.5, 1, 1.5, 2]) points.push(...ring(0.2, y));
  for (let i = 0; i <= 8; i++) {
    const phi = -Math.PI / 2 + (i * Math.PI) / 8;
    points.push(...ring(Math.cos(phi), 3 + Math.sin(phi)));
  }
  return new Float32Array(points.flat());
}

describe('a model’s bounds', () => {
  it('reads its height, its footprint and its trunk', () => {
    const b = boundsOf(tree(), {});
    expect(b.height).toBeCloseTo(4, 6);
    // (the crown's 2 × 2 across, so half the diagonal of that)
    expect(b.radius).toBeCloseTo(Math.SQRT2, 5);
    expect(Math.abs(b.trunk - 0.2)).toBeLessThan(0.02);
  });

  it('takes the trunk from the fraction of the height asked for', () => {
    // below 0.6 × 4 the crown's south cap is in too: its widest ring there has radius cos 45°
    expect(boundsOf(tree(), { trunkFraction: 0.6 }).trunk).toBeCloseTo(Math.SQRT1_2, 5);
    expect(boundsOf(tree()).trunk).toBeCloseTo(0.2, 5);
  });

  it('measures a trunk from its own middle, not from the origin', () => {
    const off = new Float32Array([...ring(0.2, 0, 5, -3).flat(), ...ring(0.2, 2, 5, -3).flat()]);
    expect(boundsOf(off, {}).trunk).toBeCloseTo(0.2, 5);
  });

  it('measures the trunk from the positions it is given (a tree’s bark), under the whole model’s 8 % line', () => {
    // (a leaf card 3 m across at 0.2 m, under the 8 % line of a tree 4 m tall)
    const card = [-1.5, 0.2, 0, 1.5, 0.2, 0, -1.5, 0.25, 0.1, 1.5, 0.25, 0.1];
    const bark = new Float32Array([...ring(0.2, 0).flat(), ...ring(0.2, 2).flat()]);
    const all = new Float32Array([...tree(), ...card]);
    expect(boundsOf(all).trunk).toBeGreaterThan(1.4);
    const b = boundsOf(all, { trunk: bark });
    expect(b.trunk).toBeCloseTo(0.2, 5);
    // (its height and footprint still the whole model's; the line too: the bark alone is 2 m tall, its 8 % 0.16)
    expect(b.height).toBeCloseTo(4, 6);
    expect(b.radius).toBeCloseTo(Math.hypot(3, 2) / 2, 5);
    expect(boundsOf(all, { trunk: new Float32Array([...bark, 0, 0.3, 0.9]) }).trunk).toBeCloseTo(0.55, 5);
  });

  it('is nothing for nothing', () => {
    expect(boundsOf(new Float32Array(0), {})).toEqual({ radius: 0, height: 0, trunk: 0 });
  });
});

const texels = (...px) => new Uint8Array(px.flat());

describe('a leaf texture’s two tones', () => {
  it('is the mean colour, a touch darker and a touch lighter', () => {
    const green = texels([0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255]);
    const [dark, light] = tonesOf(green, 2, 2);
    expect(dark[0]).toBe(0);
    expect(dark[2]).toBe(0);
    expect(dark[0]).toBe(dark[2]);
    expect(dark[1]).toBeCloseTo(0.88, 6);
    expect(light[0]).toBe(light[2]);
    // (1.12 would be over, so it stops at 1)
    expect(light[1]).toBe(1);
  });

  it('reads texels as sRGB and means them in linear light', () => {
    // black and white: linear 0 and 1, so 0.5 whatever the sRGB mean of the two bytes
    const [dark, light] = tonesOf(texels([0, 0, 0, 255], [255, 255, 255, 255]), 2, 1);
    for (const c of dark) expect(c).toBeCloseTo(0.44, 6);
    for (const c of light) expect(c).toBeCloseTo(0.56, 6);
  });

  it('leaves out the texels the leaf cuts away', () => {
    // red at alpha 128 is not over 128; so only the green one counts
    const [dark] = tonesOf(texels([255, 0, 0, 128], [0, 255, 0, 129], [255, 0, 0, 0]), 3, 1);
    expect(dark[0]).toBe(0);
    expect(dark[1]).toBeCloseTo(0.88, 6);
  });

  it('is black when nothing is left', () => {
    expect(tonesOf(texels([10, 20, 30, 0], [10, 20, 30, 100]), 2, 1)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});
