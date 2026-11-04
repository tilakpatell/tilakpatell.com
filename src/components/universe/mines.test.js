import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMines } from './mines';

afterEach(() => vi.restoreAllMocks());

describe('the mines', () => {
  it('build their shape without un-indexing a part that has no index (three warns, and the copy is wasted work)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mines = createMines(new THREE.Group());
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('toNonIndexed'))).toEqual([]);
    mines.dispose?.();
  });
});
