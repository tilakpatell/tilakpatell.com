import { describe, expect, it, vi } from 'vitest';
import { sendTo } from './send.js';

// useWorld's handle: { host, status, world: ref, rt, … }; the world is the ref's current
const handleWith = (world) => ({ host: { current: null }, status: 'on', world: { current: world } });

describe('sendTo', () => {
  it('reaches the mounted world through the handle’s ref', () => {
    const world = { do: vi.fn(() => ({ ok: true })) };
    expect(sendTo(handleWith(world), 'deploy', { classId: 'd-orig-assault' })).toEqual({ ok: true });
    expect(world.do).toHaveBeenCalledWith('deploy', { classId: 'd-orig-assault' });
  });
  it('answers null with no world up, or no handle', () => {
    expect(sendTo(handleWith(null), 'die')).toBeNull();
    expect(sendTo(null, 'die')).toBeNull();
  });
  it('never takes the ref for the world (the page’s old mistake)', () => {
    const stray = { world: { do: vi.fn(), current: null } };
    expect(sendTo(stray, 'pick', 'x')).toBeNull();
    expect(stray.world.do).not.toHaveBeenCalled();
  });
});
