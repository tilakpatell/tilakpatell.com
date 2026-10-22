import { describe, expect, it } from 'vitest';
import { fromRoom, frameYaw } from '../rules/paths';
import { roomPose } from './presence';

describe('the night’s watchers in the room you’re in', () => {
  it('stand where the Map has them, turned into the room’s own frame', () => {
    // (a point in the hall’s frame, out to the Map and back again)
    const local = [3, -7];
    const [x, z] = fromRoom('greatHall', local);
    const pose = roomPose('greatHall', { x, z, dx: 0, dz: 1 }, [0, -2000, 0], () => 0.5);
    expect(pose.at[0]).toBeCloseTo(3, 6);
    expect(pose.at[1]).toBeCloseTo(-1999.5, 6);
    expect(pose.at[2]).toBeCloseTo(-7, 6);
  });

  it('face the way they walk on the Map', () => {
    // (a heading in the room turned onto the Map the way fromRoom turns a point, and back)
    const yaw = frameYaw('greatHall');
    const room = [Math.sin(0.4), Math.cos(0.4)];
    const map = [Math.cos(yaw) * room[0] + Math.sin(yaw) * room[1], -Math.sin(yaw) * room[0] + Math.cos(yaw) * room[1]];
    const [x, z] = fromRoom('greatHall', [0, 0]);
    expect(roomPose('greatHall', { x, z, dx: map[0], dz: map[1] }).yaw).toBeCloseTo(0.4, 6);
  });
});
