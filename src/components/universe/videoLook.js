// The visitor's video settings (lib/video.js) as the universe map draws
// them: only what they turned away from the quality level's own row, so a
// level picked whole keeps the map's look as it was (the Low row's grain
// off and bloom off are the node worlds', not the map's, as lib/device's
// budget takes only the overrides too). Pure, so it's tested without a
// canvas; scene.js applies it at the start and whenever a control is turned
// (its onVideo), with no reload.
//
//   fromVideo(values, level) → { grain, aberration, bloom, samples }
//   grain: how much of the map's own film grain (1, 0.5 or 0); aberration:
//   1 or 0; bloom: on or off; samples: the most a pixel the map multisamples
//   with (Infinity: as post.js's samplesAt has it)

import { presetValues } from '../../lib/video.js';

const GRAIN = { off: 0, low: 0.5, full: 1 };

export function fromVideo(values, level = 'high') {
  const row = presetValues(level);
  const turned = (id) => values?.[id] != null && values[id] !== row[id];
  const samples = turned('msaa') ? Number.parseInt(values.msaa, 10) : Number.NaN;
  return {
    grain: turned('filmGrain') ? (GRAIN[values.filmGrain] ?? 1) : 1,
    aberration: turned('aberration') && values.aberration === 'off' ? 0 : 1,
    bloom: !(turned('bloom') && values.bloom === 'off'),
    samples: Number.isFinite(samples) ? samples : Infinity,
  };
}
