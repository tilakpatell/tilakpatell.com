import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetMap, mapDrawing, mapLoading, mapMade, mapProgress, mapReady, mapState, onMapState, whenMapReady } from './mapReady';

afterEach(() => {
  forgetMap();
  vi.useRealTimers();
});

describe('the map’s readiness', () => {
  it('starts with no map', () => {
    expect(mapState()).toEqual({ state: 'none', value: 0, step: 'load' });
  });

  it('follows a map from loading to made to drawing, its bar never going back', () => {
    mapLoading();
    mapProgress(0.4, 'shaders');
    mapProgress(0.2, 'load');
    expect(mapState()).toEqual({ state: 'loading', value: 0.4, step: 'load' });
    mapProgress(Number.NaN);
    expect(mapState().value).toBe(0.4);
    mapReady();
    expect(mapState()).toMatchObject({ state: 'ready', value: 1 });
    mapDrawing();
    expect(mapState().state).toBe('drawing');
    // (drawn, a late word that it's made changes nothing)
    mapReady();
    expect(mapState().state).toBe('drawing');
  });

  it('counts a map as made once it may be uncovered', () => {
    expect(['none', 'loading', 'ready', 'drawing'].filter(mapMade)).toEqual(['ready', 'drawing']);
  });

  it('keeps a loading map’s bar when it is told it is loading again', () => {
    mapLoading();
    mapProgress(0.5, 'shaders');
    mapLoading();
    expect(mapState().value).toBe(0.5);
  });

  it('hears nothing about progress from a map that is not loading', () => {
    mapProgress(0.7, 'shaders');
    expect(mapState().state).toBe('none');
    mapReady();
    mapProgress(0.1, 'load');
    expect(mapState()).toMatchObject({ state: 'ready', value: 1 });
  });

  it('tells a listener each change, and only changes', () => {
    const heard = [];
    const off = onMapState((s) => heard.push(s.state));
    mapLoading();
    mapLoading();
    mapReady();
    mapDrawing();
    off();
    forgetMap();
    expect(heard).toEqual(['loading', 'ready', 'drawing']);
  });

  it('waits for a loading map, and not at all with none', async () => {
    await expect(whenMapReady(10)).resolves.toBe(true);
    mapLoading();
    const waiting = whenMapReady(1000);
    mapReady();
    await expect(waiting).resolves.toBe(true);
  });

  it('gives up after its time with the map still loading', async () => {
    vi.useFakeTimers();
    mapLoading();
    const waiting = whenMapReady(500);
    vi.advanceTimersByTime(500);
    await expect(waiting).resolves.toBe(false);
  });
});
