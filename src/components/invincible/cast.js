// The Invincible page's people and props, as HD models, one cast on one
// pipeline: made for this site with Meshy (scripts/meshy-invincible.mjs),
// the characters from the show's own art on the Invincible wiki, the crowd
// and the props from words in the same style. Each with how tall it stands
// (figures, rigged on Meshy's humanoid skeleton) or how big it is (props),
// and what of it came unskinned and rides on the chest. Their credits are
// in public/models/invincible/credits.json under the same names.

export const CAST = {
  mark: { file: '/models/invincible/mark.glb', h: 1.78, rig: true },
  omni: { file: '/models/invincible/omni-man.glb', h: 1.95, rig: true, attach: /cape/i },
  thragg: { file: '/models/invincible/thragg.glb', h: 2.05, rig: true },
  eve: { file: '/models/invincible/eve.glb', h: 1.7, rig: true },
  cecil: { file: '/models/invincible/cecil.glb', h: 1.8, rig: true },
  debbie: { file: '/models/invincible/debbie.glb', h: 1.68, rig: true },
  allen: { file: '/models/invincible/allen.glb', h: 2.3, rig: true },
  mauler: { file: '/models/invincible/mauler.glb', h: 2.6, rig: true },
  seismic: { file: '/models/invincible/seismic.glb', h: 1.8, rig: true },
  flaxan: { file: '/models/invincible/flaxan.glb', h: 1.35, rig: true }, // (an elite is drawn bigger: ./world/villains.js)
  civA: { file: '/models/invincible/civ-a.glb', h: 1.75, rig: true },
  civB: { file: '/models/invincible/civ-b.glb', h: 1.66, rig: true },
  civC: { file: '/models/invincible/civ-c.glb', h: 1.72, rig: true },
  // props (h: how tall it stands, in metres; drawn in later tasks)
  bank: { file: '/models/invincible/bank.glb', h: 12, rig: false },
  heli: { file: '/models/invincible/heli.glb', h: 3.2, rig: false },
  truck: { file: '/models/invincible/truck.glb', h: 3, rig: false },
};

// a file under public/, wherever the site is served from
export const asset = (file) => `${import.meta.env?.BASE_URL ?? '/'}${file.replace(/^\//, '')}`;
