import { describe, expect, it } from 'vitest';
import { ghostFigure, ghostPose, stepOf } from './ghosts';

describe('the others online in the world', () => {
  it('sends where you are, which way you face, how fast and how high, and the area you are in', () => {
    const p = { x: 12.345, y: 3.2, z: -40, yaw: 1.2, mode: 'robot', vx: 3, vz: 4, speed: 0 };
    const [h, flags] = stepOf(p, 'iacon');
    expect(h).toEqual({ x: 12.345, y: 3.2, z: -40, face: 1.2, speed: 5 });
    expect(flags).toEqual({ ride: false, area: 'iacon' });
  });

  it('says when you drive, at the speed you drive', () => {
    const [h, flags] = stepOf({ x: 0, y: 0, z: 0, yaw: 0, mode: 'vehicle', vx: 0, vz: 0, speed: -22 }, 'jasper');
    expect(h.speed).toBe(22);
    expect(flags.ride).toBe(true);
  });

  it('never sends a height under the ground (the link keeps it from naught up)', () => {
    expect(stepOf({ x: 0, y: -0.4, z: 0, yaw: 0, mode: 'robot', vx: 0, vz: 0 }, 'base')[0].y).toBe(0);
  });

  it('draws a robot the size of the hero, and his vehicle beside it, hidden', () => {
    const f = ghostFigure({ robot: 'optimus-wfc', vehicle: 'cybertruck' });
    expect(f.top).toBeCloseTo(9.5, 1);
    expect(f.robot.visible).toBe(true);
    expect(f.vehicle.visible).toBe(false);
    expect(f.group.children).toContain(f.robot);
    expect(f.group.children).toContain(f.vehicle);
  });

  it('is one mesh a form, drawn once, its boxes baked together where the stand-in had them', () => {
    const f = ghostFigure({ robot: 'optimus-wfc', vehicle: 'cybertruck' });
    expect(f.robot.isMesh).toBe(true);
    expect(f.vehicle.isMesh).toBe(true);
    // (the stand-in robot's eight boxes, twelve triangles each)
    expect(f.robot.geometry.index.count / 3).toBe(8 * 12);
    f.robot.geometry.computeBoundingBox();
    expect(f.robot.geometry.boundingBox.max.y).toBeCloseTo(9.5 * 0.9, 1);
  });

  it('shows the vehicle while they ride, the robot when they stand, and bobs a robot that walks', () => {
    const f = ghostFigure({ robot: 'optimus-tfp', vehicle: 'truck-tfp' });
    ghostPose(f, 0.3, { ride: true, moving: true });
    expect(f.vehicle.visible).toBe(true);
    expect(f.robot.visible).toBe(false);
    ghostPose(f, 0.3, { ride: false, moving: true });
    expect(f.robot.visible).toBe(true);
    expect(f.vehicle.visible).toBe(false);
    const walking = f.robot.position.y;
    ghostPose(f, 0.3, { ride: false, moving: false });
    expect(f.robot.position.y).toBe(0);
    expect(walking).not.toBe(0);
  });

  it('a hero with no vehicle of his own (Megatron, whose tank is his clip) is a robot either way', () => {
    const f = ghostFigure({ robot: 'megatron-foc', vehicle: null });
    expect(f.vehicle).toBeNull();
    ghostPose(f, 0, { ride: true, moving: false });
    expect(f.robot.visible).toBe(true);
  });
});
