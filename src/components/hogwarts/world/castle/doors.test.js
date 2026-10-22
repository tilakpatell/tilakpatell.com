import { describe, expect, it } from 'vitest';
import { LOCKED, REACH, nearestDoor, promptFor } from './doors';
import { DOORS } from './plan';

const door = (id) => DOORS.find((d) => d.id === id);

describe('the doors', () => {
  it('prompt key first, a room’s door “Go in”, a gate “Open” or “Close”', () => {
    expect(promptFor(door('great-doors'), { hasRoom: () => true })).toEqual({ key: 'E', verb: 'Go in', name: 'The Great Hall', locked: false });
    expect(promptFor(door('great-doors'), { hasRoom: () => false }).locked).toBe(true);
    expect(promptFor(door('viaduct-gate'), { open: 0 }).verb).toBe('Open');
    expect(promptFor(door('viaduct-gate'), { open: 1 }).verb).toBe('Close');
  });

  it('say, in character, when no one has built the room behind them yet', () => {
    expect(LOCKED).toBe('Locked. Not today.');
  });

  it('are reached from in front, within REACH, at about their height', () => {
    const d = door('great-doors');
    const fx = Math.sin(d.faces);
    const fz = Math.cos(d.faces);
    const front = [d.at[0] + fx * 2, d.at[1] + fz * 2];
    expect(nearestDoor(DOORS, front[0], front[1], d.y)?.id).toBe('great-doors');
    // (from behind it, inside the hall, no)
    expect(nearestDoor(DOORS, d.at[0] - fx * 2, d.at[1] - fz * 2, d.y)).toBeNull();
    // (out of reach, no; on the ground far under it, no)
    expect(nearestDoor(DOORS, d.at[0] + fx * (REACH + 1), d.at[1] + fz * (REACH + 1), d.y)).toBeNull();
    expect(nearestDoor(DOORS, front[0], front[1], d.y - 20)).toBeNull();
  });
});
