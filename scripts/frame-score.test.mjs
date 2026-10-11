import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { findFlip, parseFlip, score } from './frame-score.mjs';

const dir = mkdtempSync(join(tmpdir(), 'frame-score-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
// an 8 × 8 grey picture at one value, as a PNG on disk
const png = async (name, v) => {
  const file = join(dir, name);
  await sharp(Buffer.alloc(8 * 8 * 3, v), { raw: { width: 8, height: 8, channels: 3 } }).png().toFile(file);
  return file;
};

describe('the frame score', () => {
  it('reads FLIP’s mean from what it prints', () => {
    expect(parseFlip('FLIP between reference image <a.png> and test image <b.png>:\n     Mean: 0.051234\n     Weighted median: 0.04\n')).toBe(0.051234);
    expect(parseFlip('Mean: 1.2e-4')).toBe(0.00012);
    expect(parseFlip('nothing')).toBeNull();
  });

  it('finds no flip where which finds none', () => {
    expect(findFlip({ run: () => { throw new Error('not found'); } })).toBeNull();
    expect(findFlip({ run: () => Buffer.from('/usr/local/bin/flip\n') })).toBe('/usr/local/bin/flip');
  });

  it('scores two pictures in Node, FLIP null without the tool', async () => {
    const a = await png('a.png', 100);
    const b = await png('b.png', 110);
    const got = await score(a, b, { flip: null });
    expect(got.flip).toBeNull();
    expect(got.flipWhy).toMatch(/flip-evaluator/);
    expect(got.psnr).toBeCloseTo(28.1308, 3);
    expect(got.ssim).toBeGreaterThan(0.99);
    expect(got.size).toBe('8x8');
    expect((await score(a, a, { flip: null })).psnr).toBe(Infinity);
  });

  it('asks flip with the reference, the candidate and the pixels per degree', async () => {
    const a = await png('c.png', 50);
    const run = vi.fn(() => Buffer.from('Mean: 0.25\n'));
    const got = await score(a, a, { flip: '/bin/flip', ppd: 40, run });
    expect(got.flip).toBe(0.25);
    const [cmd, args] = run.mock.calls[0];
    expect(cmd).toBe('/bin/flip');
    expect(args.slice(0, 6)).toEqual(['-r', a, '-t', a, '-ppd', '40']);
  });
});
