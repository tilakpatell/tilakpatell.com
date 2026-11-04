import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetShip, shipMounted, shipPending, whenShipReady } from './shipReady';

afterEach(() => {
  forgetShip();
  vi.useRealTimers();
});

describe('waiting for the ship you fly to be whole (shipReady)', () => {
  it('waits for nothing when no map has a ship coming (no 3D, or the map not up)', async () => {
    expect(await whenShipReady('cruiser', 2000)).toBe(true);
  });

  it('is ready at once for a ship already whole on the map', async () => {
    shipPending('cruiser');
    shipMounted('cruiser');
    expect(await whenShipReady('cruiser', 2000)).toBe(true);
  });

  it('waits for the ship asked for to be mounted', async () => {
    vi.useFakeTimers();
    shipPending('cruiser');
    let got = null;
    whenShipReady('cruiser', 2000).then((v) => (got = v));
    await vi.advanceTimersByTimeAsync(500);
    expect(got).toBe(null);
    shipMounted('cruiser');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toBe(true);
  });

  it('waits for the one launched in, not the one the map was flying (a replay in another ship)', async () => {
    vi.useFakeTimers();
    shipPending('falcon');
    shipMounted('falcon');
    let got = null;
    whenShipReady('cruiser', 2000).then((v) => (got = v));
    await vi.advanceTimersByTimeAsync(100);
    expect(got).toBe(null);
    shipPending('cruiser'); // (the map takes the arrival)
    await vi.advanceTimersByTimeAsync(100);
    expect(got).toBe(null);
    shipMounted('cruiser');
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toBe(true);
  });

  it('gives up after the wait, so a slow network never holds the visitor', async () => {
    vi.useFakeTimers();
    shipPending('cruiser');
    let got = null;
    whenShipReady('cruiser', 2000).then((v) => (got = v));
    await vi.advanceTimersByTimeAsync(1999);
    expect(got).toBe(null);
    await vi.advanceTimersByTimeAsync(1);
    expect(got).toBe(false);
  });

  it('forgets the ship when the map goes, so a later launch waits for nothing', async () => {
    shipPending('cruiser');
    forgetShip();
    expect(await whenShipReady('cruiser', 2000)).toBe(true);
  });

  it('a mark for another ship does not answer the wait', async () => {
    vi.useFakeTimers();
    shipPending('cruiser');
    let got = null;
    whenShipReady('cruiser', 2000).then((v) => (got = v));
    shipMounted('xwing');
    await vi.advanceTimersByTimeAsync(10);
    expect(got).toBe(null);
  });
});
