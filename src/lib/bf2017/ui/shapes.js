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
