// A check's screenshot, kept: into a folder not there yet, as a PNG or a
// JPEG by its size, and never beside a stale one of the other kind.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { keepShot, SHOT_MAX } from './shot-file.mjs';

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'shot-file-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const small = Buffer.from('a small png');
const big = Buffer.alloc(SHOT_MAX, 1);
const jpegOf = (bytes) => {
  const asked = [];
  const jpeg = async () => {
    asked.push(true);
    return bytes;
  };
  return { jpeg, asked };
};

describe('a check’s screenshot, kept', () => {
  it('makes its folder when the folder isn’t there yet', async () => {
    const out = join(dir, 'evidence', 'after');
    const file = await keepShot({ out, name: '1-navmap', png: small, jpeg: jpegOf(null).jpeg });
    expect(file).toBe(join(out, '1-navmap.png'));
    expect(readFileSync(file)).toEqual(small);
  });

  it('keeps a PNG under 1 MB as it is, and doesn’t ask for a JPEG', async () => {
    const { jpeg, asked } = jpegOf(Buffer.from('jpeg'));
    const file = await keepShot({ out: dir, name: '2-picked', png: small, jpeg });
    expect(file).toBe(join(dir, '2-picked.png'));
    expect(asked).toEqual([]);
    expect(existsSync(join(dir, '2-picked.jpg'))).toBe(false);
  });

  it('keeps one of 1 MB or more as a JPEG, and takes away the PNG an earlier run left under its name', async () => {
    writeFileSync(join(dir, '7-home-system.png'), 'an earlier run’s');
    const jpg = Buffer.from('the jpeg');
    const file = await keepShot({ out: dir, name: '7-home-system', png: big, jpeg: jpegOf(jpg).jpeg });
    expect(file).toBe(join(dir, '7-home-system.jpg'));
    expect(readFileSync(file)).toEqual(jpg);
    expect(existsSync(join(dir, '7-home-system.png'))).toBe(false);
  });

  it('takes away the JPEG an earlier run left when this one’s a PNG', async () => {
    mkdirSync(join(dir, 'after'));
    writeFileSync(join(dir, 'after', '13-far-ship.jpg'), 'an earlier run’s');
    await keepShot({ out: join(dir, 'after'), name: '13-far-ship', png: small, jpeg: jpegOf(null).jpeg });
    expect(existsSync(join(dir, 'after', '13-far-ship.png'))).toBe(true);
    expect(existsSync(join(dir, 'after', '13-far-ship.jpg'))).toBe(false);
  });

  it('leaves the other shots in the folder alone', async () => {
    writeFileSync(join(dir, '2-picked.png'), 'another shot');
    writeFileSync(join(dir, '1-navmap-x.png'), 'another shot');
    await keepShot({ out: dir, name: '1-navmap', png: big, jpeg: jpegOf(Buffer.from('j')).jpeg });
    expect(existsSync(join(dir, '2-picked.png'))).toBe(true);
    expect(existsSync(join(dir, '1-navmap-x.png'))).toBe(true);
  });
});
