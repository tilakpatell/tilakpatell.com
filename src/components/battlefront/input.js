// The player's hands: keys, the mouse through the runtime's look controller
// (src/runtime/look.js, in lock mode) and the kit's touch parts, read once a
// frame into the sim's input ({ move: [x, z], look, fire, aim, crouch,
// roll, ability, vent, … }: lane 1's plan). A press (jump, roll, an
// ability, the vent, interact, deploy) is read once; a held key (move,
// sprint, crouch, fire, aim, the scoreboard) is read as long as it is down.
//
//   createInput({ win, now }) → { attach(), detach(), read(), swallow(on),
//     turn(dx, dy), button(which, down), touchMove([x, z]), press(name) }
//   (an ability key, Q E F as the HUD shows them or 1 2 3, is read once as
//   `ability` and, while it stays down, as `abilityHeld`: a grenade leaves
//   on its release, grenades.js's hold rule; `holdAbility(slot)` is a
//   check's finger on one, 0 to lift it)
//
// While the deploy screen is up, `swallow(true)`: nothing reaches the sim
// but the deploy itself (Enter). Esc is the browser's: it releases the
// pointer, and the kit's Menu is the one way out.

export const ROLL_TAP = 0.3; // s: Space twice inside this is a roll (the game's double-tap dodge)
export const SENSITIVITY = 1; // the look's radians as the runtime gives them
export const MAX_PITCH = (70 * Math.PI) / 180; // the camera clamps to the record's; this only stops a runaway

const MOVE = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const HELD = { ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', KeyZ: 'crouch', KeyC: 'crouch', Tab: 'scoreboard' };
const PRESS = { Digit1: ['ability', 1], Digit2: ['ability', 2], Digit3: ['ability', 3], KeyQ: ['ability', 1], KeyF: ['ability', 3], KeyR: ['vent', true], KeyE: ['interact', true], Enter: ['deploy', true], NumpadEnter: ['deploy', true] };
// (E is the middle ability and the interact both: the game's own two uses of the key)
const ALSO = { KeyE: ['ability', 2] };
const ABILITY_KEYS = [['Digit1', 'KeyQ'], ['Digit2', 'KeyE'], ['Digit3', 'KeyF']];
// (keys the page must not act on while the world has them: Tab moves
// focus, Space scrolls; on a button of the HUD, or while the deploy screen
// is up, they are the page's, so the Menu and the offers are reachable)
const SWALLOW = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown']);
const PAGE_KEYS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);

export function createInput({ win = typeof window !== 'undefined' ? window : null, now = () => performance.now() / 1000, maxPitch = MAX_PITCH } = {}) {
  const down = new Set();
  const once = {};
  let lastSpace = -Infinity;
  let yaw = 0;
  let pitch = 0;
  let fire = false;
  let aim = false;
  let touch = [0, 0];
  let swallowed = false;
  let finger = 0; // an ability slot a check holds down

  function onKey(e, isDown) {
    if (SWALLOW.has(e.code) && !swallowed && !PAGE_KEYS.has(e.target?.tagName)) e.preventDefault?.();
    if (isDown && e.repeat) return;
    if (!isDown) {
      down.delete(e.code);
      return;
    }
    down.add(e.code);
    if (e.code === 'Space') {
      const t = now();
      if (t - lastSpace <= ROLL_TAP) {
        once.roll = true;
        lastSpace = -Infinity;
      } else {
        once.jump = true;
        lastSpace = t;
      }
      return;
    }
    for (const p of [PRESS[e.code], ALSO[e.code]]) if (p) once[p[0]] = p[1];
  }
  const kd = (e) => onKey(e, true);
  const ku = (e) => onKey(e, false);
  const blur = () => {
    down.clear();
    fire = aim = false;
  };

  return {
    attach() {
      win?.addEventListener('keydown', kd);
      win?.addEventListener('keyup', ku);
      win?.addEventListener('blur', blur);
    },
    detach() {
      win?.removeEventListener('keydown', kd);
      win?.removeEventListener('keyup', ku);
      win?.removeEventListener('blur', blur);
    },
    swallow(on) {
      swallowed = Boolean(on);
      if (swallowed) blur();
    },
    // the look controller's turn (radians: right and down positive)
    turn(dx, dy) {
      if (swallowed) return;
      yaw -= dx * SENSITIVITY;
      pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch - dy * SENSITIVITY));
    },
    button(which, isDown) {
      if (swallowed) return;
      if (which === 'left' || which === 0) fire = isDown;
      else aim = isDown;
    },
    touchMove(v) {
      touch = v;
    },
    press(name, value = true) {
      once[name] = value;
    },
    holdAbility(slot) {
      finger = slot || 0;
      if (finger) once.ability = finger;
    },
    look: () => ({ yaw, pitch }),
    setLook(y, p = 0) {
      yaw = y;
      pitch = p;
    },
    read() {
      let x = touch[0];
      let z = touch[1];
      for (const code of down) {
        const m = MOVE[code];
        if (m) {
          x += m[0];
          z += m[1];
        }
      }
      const n = Math.hypot(x, z);
      if (n > 1) {
        x /= n;
        z /= n;
      }
      const held = {};
      for (const code of down) if (HELD[code]) held[HELD[code]] = true;
      const out = {
        move: swallowed ? [0, 0] : [x, z],
        yaw,
        pitch,
        fire: !swallowed && fire,
        aim: !swallowed && aim,
        sprint: !swallowed && Boolean(held.sprint),
        crouch: !swallowed && Boolean(held.crouch),
        scoreboard: Boolean(held.scoreboard),
        jump: !swallowed && Boolean(once.jump),
        roll: !swallowed && Boolean(once.roll),
        ability: swallowed ? 0 : (once.ability ?? 0),
        abilityHeld: swallowed ? 0 : ABILITY_KEYS.findIndex((keys) => keys.some((k) => down.has(k))) + 1 || finger,
        vent: !swallowed && Boolean(once.vent),
        interact: !swallowed && Boolean(once.interact),
        deploy: Boolean(once.deploy),
      };
      for (const k of Object.keys(once)) delete once[k];
      return out;
    },
  };
}
