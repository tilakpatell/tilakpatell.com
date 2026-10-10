// The scene under a level's area's light while you're inside it (levelArea.js:
// Kamino's storm, its light the level's own records, `look`), as the game
// lights it: the galaxy's key light turned to the storm's sun (its way the
// record's), its second key to the sky's fill from straight above and its
// ambient to the ground's (so what faces up takes the sky and what faces
// down stays dark, the game's outdoor light's sky and ground colours; three's
// hemisphere light would be a new light), a lightning strike's flash on the
// ambient, a reflection probe as what shiny things reflect, and the record's
// grading LUT in the post's last pass where it has one (a space level has
// none). Nothing is added to the scene (a new light
// would recompile every material in it): the galaxy's own lights are set,
// and set back as they were when you leave.
//
//   createAreaLook({ scene, renderer, post, keys, ambient, url, probes, lut })
//     → { apply(area | null), dispose() }
//   (`area`: levelArea.js's, with its `look` and `flash`; `url`: the asset base's (lib/assetBase.js's assetUrl);
//   `probes`, `lut`: injected for the tests)

import { createProbeEnv } from '../../lib/three/probeEnv';
import { loadLut } from '../../lib/three/gameLut';

// the storm's light in the galaxy's units (its key light is 2.2 in space):
// a dim sun through the cloud, a strong cool fill from the whole sky, the
// probe's shine, a strike's flash
// (env: a share of the probe at the site's level, the record's probeScale)
// (sun, sky, ground: the galaxy's intensities for the records' colours; the
// record's sky luminance outweighs its storm sun, so the sky fill is near it)
export const STORM = { sun: 1.1, sky: 0.85, ground: 1.6, env: 0.45, flash: 2.4 };
// a record's linear colour, its brightest channel 1 (its strength is STORM's)
const unit = (c) => c.clone().multiplyScalar(1 / Math.max(c.r, c.g, c.b, 1e-6));
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export function createAreaLook({ scene, renderer = null, post = null, keys, ambient, url = (p) => p, probes = null, lut = loadLut }) {
  let held = null; // what the galaxy had, while the area's light is on
  let on = null; // the area whose light is on
  let env = null;
  let grade = null;
  let ticket = 0;
  const holder = probes ?? (renderer ? createProbeEnv({ renderer }) : null);

  const enter = (area) => {
    const look = area.look;
    held = {
      key0: { color: keys[0].color.clone(), pos: keys[0].position.clone(), i: keys[0].intensity },
      key1: { color: keys[1].color.clone(), pos: keys[1].position.clone(), i: keys[1].intensity },
      ambient: { color: ambient.color.clone(), i: ambient.intensity },
      env: scene.environment,
      envI: scene.environmentIntensity ?? 1,
    };
    on = area;
    keys[0].color.copy(unit(look.sun.color));
    keys[0].position.fromArray(look.sun.dir).multiplyScalar(100);
    keys[1].color.copy(unit(look.sky));
    keys[1].position.set(0, 100, 0);
    // (the ground's fill as it is: near black, so undersides stay dark)
    ambient.color.copy(look.ground);
    const mine = ++ticket;
    if (look.probe && holder)
      holder
        .load(FACES.map((f) => url(`/${look.probe}.${f}.hdr`)))
        .then((tex) => {
          if (!tex || mine !== ticket || on !== area) return;
          env = tex;
          scene.environment = tex;
          scene.environmentIntensity = STORM.env * (look.probeScale ?? 0);
        })
        .catch(() => {});
    if (look.lut && post?.grading)
      lut(url(`/${look.lut.url}`), look.lut.size)
        .then((tex) => {
          if (!tex || mine !== ticket || on !== area) return;
          grade = tex;
          post.grading({ lut: tex, size: look.lut.size });
        })
        .catch(() => {});
  };

  const leave = () => {
    ticket += 1;
    keys[0].color.copy(held.key0.color);
    keys[0].position.copy(held.key0.pos);
    keys[0].intensity = held.key0.i;
    keys[1].color.copy(held.key1.color);
    keys[1].position.copy(held.key1.pos);
    keys[1].intensity = held.key1.i;
    ambient.color.copy(held.ambient.color);
    ambient.intensity = held.ambient.i;
    if (env) {
      scene.environment = held.env;
      scene.environmentIntensity = held.envI;
    }
    if (grade) post?.grading?.(null);
    env = null;
    grade = null;
    held = null;
    on = null;
  };

  return {
    // each frame, after the galaxy's own light is set: the area's over it while you're inside
    apply(area) {
      const want = area?.look ? area : null;
      if (on && on !== want) leave();
      if (!want) return;
      if (!on) enter(want);
      const f = want.flash ?? 0;
      keys[0].intensity = STORM.sun;
      keys[1].intensity = STORM.sky * (1 + f * 0.5);
      // (a strike lights everything from the clouds: the ground fill, whitened, up)
      ambient.intensity = STORM.ground + f * STORM.flash * 6;
    },
    get on() {
      return Boolean(on);
    },
    dispose() {
      if (on) leave();
    },
  };
}
