// The game's vector shapes (src/data/bf2017/shapes.json, scripts/lib/
// bf2017-rulebook-ui.mjs's shapesOf): the HUD's crosshairs per hero and
// weapon, the in-world markers, the game-mode and end-of-round shapes, as
// the paths the game rasterises, in its own pixels.
//
// shape(name) → { name, viewBox, paths: [{ d, fill, fillRule, stroke,
//   strokeWidth, strokeLinecap, opacity }] } | null: a path's inner paths
//   (a ring's hole) are in its `d`, drawn even-odd; an outline or lines
//   shape is a stroke
// shapeSvg(shape, { colour, size }) → the SVG as a string, in the game's
//   colours unless `colour` is given
// composeShapes(parts, viewBox), blasterCrosshair(): shapes put together
//   (a path's `transform` places it)
// SHAPES: the names there are

import BOOK from '../../../data/bf2017/shapes.json';
import { css } from './index';

const ROWS = BOOK.rows.shapes;
export const SHAPES = Object.keys(ROWS);

export function shape(name, { colour = null } = {}) {
  const s = ROWS[name];
  if (!s) return null;
  const [x, y, w, h] = s.rect;
  return {
    name,
    viewBox: `${x} ${y} ${w} ${h}`,
    paths: s.paths.map((p) => {
      const ink = colour ?? css(p.colour) ?? 'currentColor';
      const d = [p.d, ...(p.inner ?? [])].join('');
      return p.style === 'fill'
        ? { d, fill: ink, fillRule: 'evenodd', opacity: p.alpha }
        : { d, fill: 'none', stroke: ink, strokeWidth: p.line || 1, strokeLinecap: p.cap === 'rounded' ? 'round' : p.cap === 'square' ? 'square' : 'butt', opacity: p.alpha };
    }),
  };
}

const attr = (k, v) => (v === undefined || v === null ? '' : ` ${k}="${v}"`);

export function shapeSvg(s, { colour = null, size = null } = {}) {
  if (!s) return '';
  const [, , w, h] = s.viewBox.split(' ').map(Number);
  const height = size && w ? Math.round((size * h) / w) : null;
  const paths = s.paths
    .map((p) => {
      const ink = colour ?? (p.stroke ? p.stroke : p.fill);
      return `<path d="${p.d}"${p.stroke ? `${attr('fill', 'none')}${attr('stroke', ink)}${attr('stroke-width', p.strokeWidth)}${attr('stroke-linecap', p.strokeLinecap)}` : `${attr('fill', ink)}${attr('fill-rule', p.fillRule)}`}${p.opacity !== 1 ? attr('opacity', p.opacity) : ''}/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${s.viewBox}"${attr('width', size)}${attr('height', height)}>${paths}</svg>`;
}

// Shapes put together in one view box, each placed (`at`, its top-left in
// the box's units), turned (`turn`, degrees about its own middle) and
// scaled (`scale`): the paths carry an SVG transform.
export function composeShapes(parts, viewBox) {
  const paths = [];
  for (const { name, at = [0, 0], turn = 0, scale = 1 } of parts) {
    const s = shape(name);
    if (!s) continue;
    const [, , w, h] = s.viewBox.split(' ').map(Number);
    const t = `translate(${at[0]} ${at[1]}) scale(${scale})${turn ? ` rotate(${turn} ${w / 2} ${h / 2})` : ''}`;
    for (const p of s.paths) paths.push({ ...p, transform: t });
  }
  return { name: parts.map((p) => p.name).join('+'), viewBox, paths };
}

// The infantry blaster's crosshair as the HUD's crosshair widget builds it
// from the game's parts: the dot in the middle and a notch on each side.
// (The widget's own spacing is set by the weapon's spread at run time; the
// gap here is the site's: source hand.)
export const blasterCrosshair = () =>
  composeShapes(
    [
      { name: 'Crosshairs_Dot', at: [-2, -2] },
      { name: 'Crosshairs_Notch', at: [-1.5, -19] },
      { name: 'Crosshairs_Notch', at: [-1.5, 7], turn: 180 },
      { name: 'Crosshairs_Notch', at: [-13, -6], turn: -90 },
      { name: 'Crosshairs_Notch', at: [10, -6], turn: 90 },
    ],
    '-20 -20 40 40',
  );
