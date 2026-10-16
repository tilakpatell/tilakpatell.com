// Dimension C-137, the world module: ./scene.js on the runtime's renderer
// (../stage.js), drawn by the runtime's loop. The walk itself (the keys,
// the stick, the doors, the games, the HUD) stays the page's
// (./RmWorld.jsx): it hands its frame in as `props.frame` (a ref, set while
// the world is on screen with nothing open over it, null when not), which
// the world's draw runs with the renderer held the stage's way; with no
// frame, the world wants none, as the page's own loop used to stop. The
// page reaches the scene's calls (act, fx, ensureArea, project, …) as
// `world.api`.
//
// One module a landing (rmWorldModule(planet)): the Smiths' street, or a
// planet of the sector started in C-137's game with its portal back out
// behind Morty (./planetMode.js), each with what its canvas shows said for
// a screen reader; a page landing on another planet makes its world anew.
// A planet's area is built and its portal opened before the world is
// prepared, as the page used to before it showed it.
//
// `calibrate: false` and `sharpness: 'own'`: as the Citadel's
// (../citadel/module.js): lib/stage3d never drew a world softer before it
// was seen, and the stage draws softer through its own buffers (its pace,
// and the governor's ladder through lowerQuality).

import { device } from '../../../lib/device';
import { WORLD_MB } from '../../worlds/worlds';
import { pageFrame, stageRatio } from '../stage';

const STREET = 'The Smiths’ street in 3D: the Smith house with Rick’s garage, Harry Herpson High across the road, Rick’s space cruiser in the driveway, and Morty on the sidewalk';
const made = new Map();

export function rmWorldModule(planet = null) {
  const key = planet?.id ?? '';
  if (made.has(key)) return made.get(key);
  const module = {
    id: planet ? `c137-${planet.id}` : 'c137',
    shading: 'glsl',
    mb: WORLD_MB['/c-137'],
    label: planet ? `${planet.name} in 3D: Morty in front of the portal he came through, his way back to space` : STREET,
    calibrate: false,
    // (a low-tier world draws straight to the canvas, through no buffers of
    // its own: its sharpness is the canvas's, the runtime's to set, as
    // lib/stage3d sized its canvas for it)
    get sharpness() {
      return device().tier === 'low' ? undefined : 'own';
    },
    get ratio() {
      return stageRatio({ soft: device().tier === 'low' });
    },
    async create(rt, { looks = null, frame = null } = {}) {
      const { createRmWorld } = await import('./scene');
      // (a build that fails frees the stage it made, and the renderer is the runtime's as it was)
      const stages = [];
      const api = await createRmWorld(rt, { looks, track: stages }).catch((err) => {
        for (const s of stages) s.dispose();
        throw err;
      });
      const { stage } = api;
      // a planet: built before Morty's put in it, and its portal swirling open behind him
      try {
        if (planet) {
          if (!api.hasArea(planet.area)) await api.ensureArea(planet.area).catch(() => {});
          if (!api.lost) api.fx('portal', { at: planet.back });
        }
      } finally {
        stage.giveBack(); // (built: the renderer is the runtime's again until the stage's next call)
      }
      const page = pageFrame(stage, frame);
      return {
        api,
        resize: (w, h) => api.resize(w, h),
        prepare: (onProgress, opts) => api.prepare(onProgress, opts),
        draw: page.draw,
        wants: page.wants,
        update: (props) => page.setRef(props?.frame),
        lowerQuality: (level) => stage.lowerQuality(level),
        dispose: () => api.dispose(),
      };
    },
  };
  made.set(key, module);
  return module;
}

export default rmWorldModule();
