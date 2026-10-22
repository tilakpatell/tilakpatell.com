// hogwarts-creatures-meshy.mjs: the account, the stand, the hood painted out, the credit.
import { describe, expect, it } from 'vitest';
import { ACCOUNTS } from './hogwarts-cast-meshy.mjs';
import { COST, CREATURES, accountFor, creditFor, fit, marks, paint } from './hogwarts-creatures-meshy.mjs';

describe('a creature made with Meshy', () => {
  const need = COST.preview + COST.refine;

  it('starts on the first account that can pay for both its tasks, and keeps to it', () => {
    expect(accountFor(undefined, { [ACCOUNTS[0]]: 1, [ACCOUNTS[1]]: 3, [ACCOUNTS[2]]: need })).toBe(ACCOUNTS[2]);
    expect(accountFor(undefined, { [ACCOUNTS[0]]: need - 1 })).toBe(null);
    expect(accountFor({ acc: ACCOUNTS[1] }, { [ACCOUNTS[0]]: 900 })).toBe(ACCOUNTS[1]);
  });

  it('is stood on its base at y 0, centred, at its height', () => {
    const { scale, offset } = fit({ min: [-0.3, -0.95, -0.2], max: [0.5, 0.95, 0.4] }, CREATURES.dementor.height);
    expect(scale).toBeCloseTo(2.9 / 1.9);
    expect(-0.95 * scale + offset[1]).toBeCloseTo(0);
    expect(0.1 * scale + offset[0]).toBeCloseTo(0);
    expect(0.1 * scale + offset[2]).toBeCloseTo(0);
  });

  it('paints out a bright face high in the hood and darkens bright rags, nothing else', () => {
    // four triangles: a bright one at the top, a dark one at the top, a bright one in the middle, a bright one at the hem
    const positions = new Float32Array([0, 10, 0, 1, 10, 0, 0, 9.5, 0, 0, 10, 1, 1, 10, 1, 0, 9.5, 1, 0, 5, 0, 1, 5, 0, 0, 5.5, 0, 0, 0, 0, 1, 0, 0, 0, 0.5, 0]);
    const uvs = new Float32Array([0.1, 0.1, 0.2, 0.1, 0.1, 0.2, 0.6, 0.1, 0.7, 0.1, 0.6, 0.2, 0.1, 0.6, 0.2, 0.6, 0.1, 0.7, 0.6, 0.6, 0.7, 0.6, 0.6, 0.7]);
    const indices = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // (bright on the left half of the texture, dark on the right but for the hem’s corner)
    const lumAt = (u, v) => (u < 0.5 ? 0.8 : v > 0.5 ? 0.8 : 0.1);
    const { black, dim } = marks({ positions, uvs, indices, lumAt, hollow: CREATURES.dementor.hollow });
    expect(black).toEqual([0]);
    expect(dim).toEqual([3]);
  });

  it('fills a triangle’s pixels in the texture once, with a pixel round it', () => {
    const W = 16;
    const image = new Uint8ClampedArray(W * W * 4).fill(200);
    const uvs = new Float32Array([0.25, 0.25, 0.75, 0.25, 0.25, 0.75]);
    let calls = 0;
    const n = paint(image, W, W, uvs, new Uint32Array([0, 1, 2]), [0, 0], (d, i) => {
      calls++;
      d[i] = 0;
    });
    expect(n).toBe(calls);
    // (inside, and a pixel past the edge, painted; the far corner of the texture not)
    expect(image[(6 * W + 6) * 4]).toBe(0);
    expect(image[(3 * W + 3) * 4]).toBe(0);
    expect(image[(14 * W + 14) * 4]).toBe(200);
  });

  it('is credited to Meshy and the site owner, made from a written description', () => {
    const c = creditFor('dementor');
    expect(c.source).toBe('https://www.meshy.ai');
    expect(c.name).toMatch(/^A dementor for the Hogwarts world/);
    expect(creditFor('norris').name).toMatch(/^Mrs Norris/);
    expect(c.authors).toEqual(['Tilak Patel, with Meshy AI']);
  });
});
