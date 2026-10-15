// The Citadel of Ricks, the world module: ./scene.js on the runtime's
// renderer (../stage.js), drawn by the runtime's loop. The walk itself (the
// keys, the stick, the beats, the HUD) stays the page's (./CitadelWorld.jsx):
// it hands its frame in as `props.frame` (a ref, set while the Citadel is on
// screen and live, null when it isn't), which the world's draw runs with the
// renderer held the stage's way; with no frame, the world wants none, as the
// page's own loop used to stop. The page reaches the scene's calls (fx,
// enterTown, screenOf, setLooks, …) as `world.api`.
//
// `calibrate: false`: the runtime's walk through the pace's steps at mount
// would draw the world softer before it is seen, which lib/stage3d never
// did; the governor still lowers it as frames run late (lowerQuality, the
// stage's ladder). `sharpness: 'own'`: the stage draws softer through its
// own buffers, the canvas kept at the stage's ratio (`ratio`).

import { device } from '../../../lib/device';
import { WORLD_MB } from '../../worlds/worlds';
import { stageRatio } from '../stage';

export default {
  id: 'citadel',
  shading: 'glsl',
  mb: WORLD_MB['/c-137'],
  label: 'The Citadel of Ricks in 3D: a terrace over a city of pale green towers under a great dome, a column of green portal fluid at its middle, crowded with Ricks and Mortys, and Rick C-137 walking through it',
  calibrate: false,
  sharpness: 'own',
  get ratio() {
    return stageRatio({ soft: device().tier === 'low' });
  },
  async create(rt, { looks = null, frame = null } = {}) {
    const { createCitadelWorld } = await import('./scene');
    const api = await createCitadelWorld(rt, { looks });
    const { stage } = api;
    stage.giveBack(); // (built: the renderer is the runtime's again until the first frame)
    let tick = frame;
    return {
      api,
      resize: (w, h) => api.resize(w, h),
      prepare: (onProgress, opts) => api.prepare(onProgress, opts),
      draw({ dt, now }) {
        const fn = tick?.current;
        if (!fn) return;
        const was = stage.hold();
        try {
          fn(dt * 1000, now);
        } finally {
          if (was) stage.giveBack();
        }
      },
      wants: () => Boolean(tick?.current),
      update(props) {
        if (props?.frame) tick = props.frame;
      },
      lowerQuality: (level) => stage.lowerQuality(level),
      dispose: () => api.dispose(),
    };
  },
};
