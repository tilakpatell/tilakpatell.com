import { describe, expect, it, vi } from 'vitest';
import { WHOLE, zoomAt } from './holoCamera';
import { createHoloLink } from './link';

describe('the holotable’s link between the page and the scene', () => {
  it('starts shut over the whole disc, and wakes the scene when it opens', () => {
    const link = createHoloLink();
    expect(link.open).toBe(false);
    expect(link.pose).toEqual(WHOLE());
    link.wake = vi.fn();
    link.setOpen(true);
    expect(link.open).toBe(true);
    expect(link.wake).toHaveBeenCalledTimes(1);
  });
  it('counts a change to what the map shows, and not a patch that changes nothing', () => {
    const link = createHoloLink();
    link.wake = vi.fn();
    link.set({ pick: 'hoth' });
    link.set({ pick: 'hoth' });
    expect(link.version).toBe(1);
    expect(link.state.pick).toBe('hoth');
    expect(link.wake).toHaveBeenCalledTimes(1);
  });
  it('aims the camera to ease toward, or snaps it there', () => {
    const link = createHoloLink();
    const near = zoomAt(WHOLE(), 3);
    link.aim(near);
    expect(link.target).toBe(near);
    expect(link.pose).toEqual(WHOLE());
    link.snap(near);
    expect(link.pose).toBe(near);
  });
  it('keeps each system’s label, and finds the system drawn nearest a point', () => {
    const link = createHoloLink();
    const el = {};
    link.label('hoth', el);
    expect(link.labels.get('hoth')).toBe(el);
    link.label('hoth', null);
    expect(link.labels.has('hoth')).toBe(false);
    link.place('hoth', 100, 100, true);
    link.place('bespin', 112, 100, true);
    link.place('endor', 101, 101, false); // (not drawn: off the screen, or behind)
    expect(link.at(103, 100)).toBe('hoth');
    expect(link.at(110, 100)).toBe('bespin');
    expect(link.at(300, 300)).toBeNull();
  });
});
