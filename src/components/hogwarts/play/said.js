// Who is talking, and where: one speaker at a time, their line said in
// the kit's Bubble (the page shows it) and the bubble moved over their head
// (or the commentator's box) a frame at a time, as the kit's Bubble wants:
// translated to the point on the screen, shown by its opacity, hidden when
// the point is behind you or off the view.
//
//   createSaid({ rt, camera, tell }) → { say(who, text, at), bubble(el), update(), clear() }
//   `at`: a THREE.Vector3 in the world (read each frame, so a moving
//   speaker's bubble follows them), or a function that returns one, or null
//   (the bubble then sits where it last was).

import * as THREE from 'three';

export function createSaid({ rt, camera, tell = () => {} } = {}) {
  let el = null;
  let at = null;
  const p = new THREE.Vector3();
  return {
    say(who, text, where = null) {
      if (!text) return;
      at = where;
      tell('said', { who, text });
    },
    bubble(next) {
      el = next;
    },
    clear() {
      at = null;
      if (el) el.style.opacity = '0';
    },
    update() {
      if (!el || !at) return;
      const w = typeof at === 'function' ? at() : at;
      if (!w) return;
      p.copy(w).project(camera);
      const box = rt?.host?.getBoundingClientRect?.();
      const on = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 && box;
      el.style.opacity = on ? '1' : '0';
      if (on) el.style.transform = `translate(${Math.round(((p.x + 1) / 2) * box.width)}px, ${Math.round(((1 - p.y) / 2) * box.height)}px)`;
    },
  };
}
