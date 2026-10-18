// How the cockpit draws at each quality level (lib/device's detail: low,
// mid, high, ultra; Auto gives a laptop or desktop with a graphics chip
// ultra, and a weak one low). One row a level:
//
//   post       the post chain (multisampled HDR, bloom, the lens), or one
//              pass straight to the screen
//   ratio      the sharpest it draws, in pixels per CSS pixel, under the
//              device's own (lib/device's pixelRatio)
//   pixels     no more than this many million pixels drawn a frame, so a
//              big screen at a high ratio doesn't run the chip out
//   samples    multisampling in the post chain's target
//   shadows    the key light's shadow map, 0 for none; `soft`: its edge
//              softened over the same width whatever the map's size (three's
//              PCF blurs `shadow.radius` texels: shadowRadius below)
//   stars      the sky's stars, as a share of what the vehicle asks for
//   streaks    how many stars the jump to lightspeed stretches
//   sky        the nebula baked to a cube this many pixels a side (scene.js:
//              drawn once, not worked out for every pixel every frame)
//   lens       what the lens adds (./lens.js): `taps` along the speed blur
//              (0: none), `aberration` (the colours parted at the edges at
//              speed), `dirt` (the glass's smudges catching bright light),
//              `flare` (a sun's glare and ghosts), `grain`, `vignette`
//
// levelOf({ detail, ok, coarse }) → the row, `id` its level's name
//   ok: a graphics chip (lib/gpu's ok: not software GL); coarse: a touch screen

export const LEVELS = {
  low: { post: false, ratio: 1, pixels: 2.1, samples: 0, shadows: 0, soft: false, stars: 0.7, streaks: 1100, sky: 256, lens: null },
  mid: { post: true, ratio: 1.25, pixels: 3.7, samples: 2, shadows: 1024, soft: false, stars: 0.85, streaks: 1500, sky: 512, lens: { taps: 0, aberration: 0, dirt: 0.6, flare: 0.5, grain: 0, vignette: 0.22 } },
  high: { post: true, ratio: 1.5, pixels: 5.3, samples: 4, shadows: 2048, soft: true, stars: 1, streaks: 2200, sky: 1024, lens: { taps: 6, aberration: 0.7, dirt: 1, flare: 0.8, grain: 0, vignette: 0.28 } },
  ultra: { post: true, ratio: 2, pixels: 8.3, samples: 4, shadows: 2048, soft: true, stars: 1.6, streaks: 3600, sky: 1024, lens: { taps: 10, aberration: 1, dirt: 1, flare: 1, grain: 0.03, vignette: 0.3 } },
};

// The level's row. The post chain is a graphics chip's on a computer: a
// phone or tablet (a coarse pointer) and software GL draw the one pass, as
// they always have (1.5 pixels to the pixel and 1,300 streaks above low).
export function levelOf({ detail = 'high', ok = true, coarse = false } = {}) {
  const id = LEVELS[detail] ? detail : 'high';
  if (ok && !coarse) return { id, ...LEVELS[id] };
  if (id === 'low') return { id, ...LEVELS.low };
  return { ...LEVELS.low, id, ratio: 1.5, pixels: 3.7, stars: 1, streaks: 1300, sky: 512 };
}

// The ratio to draw a w × h window at: the row's, under the device's, and
// no more than the row's pixels, but never under a pixel to the pixel (a
// big screen at low draws its own pixels, as it always has, not fewer)
export function ratioFor(row, w, h, device = row.ratio) {
  const cap = Math.min(row.ratio, device);
  const fit = Math.sqrt((row.pixels * 1e6) / Math.max(1, w * h));
  return Math.max(Math.min(1, cap), Math.min(cap, fit));
}

// A shadow map's softening in its own texels, so the edge is as wide at
// 4096 as at 1024 but drawn from four times the detail (1 where it isn't soft)
export const shadowRadius = (row) => (row?.soft && row.shadows > 1024 ? row.shadows / 1024 : 1);
