// The cockpit view, moved out of scene.js as it was: the intro's cockpits,
// built on demand; the eye sits a little ahead of the ship's middle and
// above it (map units); the lens is the intro's, framed for a wide
// horizontal view, kept within sane vertical limits.
//
// CABS: { [ship]: () => import(its cockpit) }; SEAT_KEY, remembered; EYE; CAB_HFOV; CAB_VFOV

export const CABS = {
  falcon: () => import('../cockpit/vehicles/falcon'),
  xwing: () => import('../cockpit/vehicles/xwing'),
  cruiser: () => import('../cockpit/vehicles/cruiser'),
  rv: () => import('../cockpit/vehicles/rv'),
};
export const SEAT_KEY = 'tp:universe-seat'; // 'chase' or 'cockpit', remembered
export const EYE = { ahead: 0.035, up: 0.045 };
export const CAB_HFOV = 88;
export const CAB_VFOV = [52, 94];
