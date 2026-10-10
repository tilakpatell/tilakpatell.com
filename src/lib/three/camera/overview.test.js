import { describe, expect, it } from 'vitest';
import hoth from '../../../data/bf2017/maps/hoth.json';
import { cameraForward, overviewPose } from './overview';

const cams = hoth.rows.cameras;

describe('overviewPose', () => {
  it('picks the camera facing the objective', () => {
    const a = { id: 'a', at: [0, 10, 0], yaw: 0, pitch: 0, focalLength: 35, aperture: 8, mode: 'm' };
    const b = { id: 'b', at: [0, 10, 0], yaw: Math.PI / 2, pitch: 0, focalLength: 35, aperture: 8, mode: 'm' };
    expect(overviewPose([a, b], [100, 10, 0]).id).toBe('b');
    expect(overviewPose([a, b], { at: [0, 10, 100] }).id).toBe('a');
  });

  it('35 mm on a 36 mm frame, with the lens’s depth of field', () => {
    const goal = [0, 340, -1200];
    const pose = overviewPose(cams, goal, { mode: 'galacticAssault' });
    expect(pose.fov).toBeCloseTo((2 * Math.atan(18 / 35) * 180) / Math.PI, 9);
    expect(pose.dof.aperture).toBeCloseTo(0.035 / 8, 9);
    expect(cams.find((c) => c.id === pose.id).mode).toBe('galacticAssault');
  });

  it('a mode with no cameras falls to them all; none is null', () => {
    expect(overviewPose(cams, [0, 0, 0], { mode: 'nope' })).not.toBeNull();
    expect(overviewPose([], [0, 0, 0])).toBeNull();
  });

  it('the record’s pitch looks down', () => {
    expect(cameraForward({ yaw: 0, pitch: 0.3 })[1]).toBeLessThan(0);
  });
});
