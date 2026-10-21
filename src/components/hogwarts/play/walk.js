// The player on foot: the keys, the touch stick and a drag read into
// rules/walk.js's input, and the camera put at the eye it says, with a
// first-year's step in it (none under reduced motion). First person: there
// is no figure of you yet (the cast lane's), and the castle across the
// water is what you're here to look at.
//
//   KEYS → the codes the walk binds (rt.input.bind)
//   inputOf(snapshot, touch) → rules/walk.js's input
//   createWalker({ camera, world, at, yaw, reduced }) → { state, step(dt, snapshot, touch), place(at, yaw) }

import { WALK, look, startWalk, stepWalk } from '../rules/walk';

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  act: ['KeyE', 'Enter'],
  menu: ['Escape'],
};

// the stick pushed past this is a run
const STICK_RUN = 0.92;

export function inputOf(snap, touch = { x: 0, y: 0 }) {
  const on = (name) => Boolean(snap?.action?.(name));
  const sx = touch?.x ?? 0;
  const sy = touch?.y ?? 0;
  const pushed = Math.hypot(sx, sy);
  return {
    forward: (on('forward') ? 1 : 0) - (on('back') ? 1 : 0) - sy,
    strafe: (on('right') ? 1 : 0) - (on('left') ? 1 : 0) + sx,
    run: on('run') || pushed > STICK_RUN,
  };
}

export function createWalker({ camera, world, at, yaw = 0, reduced = false }) {
  let state = startWalk(at, yaw);
  let stride = 0; // how far along the step's swing
  const placeCamera = () => {
    const floor = world.floorAt(state.x, state.z);
    // (the head's bob with each step, a little side to side; none under reduced motion)
    const bob = reduced ? 0 : Math.sin(stride * 2) * 0.035 * Math.min(1, state.speed / WALK.speed);
    const sway = reduced ? 0 : Math.cos(stride) * 0.02 * Math.min(1, state.speed / WALK.speed);
    camera.position.set(state.x + Math.cos(state.yaw) * sway, floor + WALK.eye + bob, state.z - Math.sin(state.yaw) * sway);
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  };
  placeCamera();
  return {
    get state() {
      return state;
    },
    step(dt, snap, touch) {
      const drag = snap?.pointer?.drag;
      if (drag && (drag.dx || drag.dy)) state = look(state, drag.dx, drag.dy);
      state = stepWalk(state, inputOf(snap, touch), dt, world);
      // (about two steps a second at a walk, a stride a metre)
      stride += state.speed * dt * Math.PI;
      placeCamera();
      return state;
    },
    place(to, turn = state.yaw) {
      state = startWalk(to, turn);
      placeCamera();
    },
  };
}
