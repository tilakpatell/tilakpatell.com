import { describe, expect, it } from 'vitest';
import { ROOMS, hasRoom, loadRoom, registerRoom, roomName } from './index';

describe('the rooms’ registry', () => {
  it('knows no room it hasn’t been given, and says so', async () => {
    expect(hasRoom('nowhere')).toBe(false);
    expect(hasRoom(null)).toBe(false);
    expect(roomName('nowhere')).toBeNull();
    await expect(loadRoom('nowhere')).rejects.toThrow(/no room/);
  });

  it('loads a registered room’s module lazily, its default export or itself', async () => {
    let loaded = 0;
    const room = { build: () => ({}) };
    registerRoom('test-room', {
      name: 'A room for the test',
      load: async () => {
        loaded += 1;
        return { default: room };
      },
    });
    expect(loaded).toBe(0);
    expect(hasRoom('test-room')).toBe(true);
    expect(roomName('test-room')).toBe('A room for the test');
    expect(await loadRoom('test-room')).toBe(room);
    expect(loaded).toBe(1);
    registerRoom('test-plain', { name: 'Plain', load: async () => room });
    expect(await loadRoom('test-plain')).toBe(room);
    delete ROOMS['test-room'];
    delete ROOMS['test-plain'];
  });
});
