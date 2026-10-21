// A quick-chat line over someone drawn in 3D (a world's ghosts, the crews on
// foot, the ships in the galaxy and the planet flight): a little card with a
// tail pointing down at them, on a sprite, so it faces the camera. One canvas
// on a SpriteMaterial, which both renderers draw as it is (the classic WebGL
// one, and the node renderer, which makes its own sprite material from it),
// so a world on either takes the same bubble. Its CanvasTexture is repainted
// only when the line changes, and a sprite that's hidden is never drawn, so
// one that's never said anything never reaches the graphics chip at all. The
// DOM's bubble, over the tags on a page, is online.css's .quip-bubble.
//
// createQuipSprite({ height, sizeAttenuation, center }) → { sprite, set, fade, dispose }
//   height: the card's height (its tail hangs below), in world units, or in
//     the screen's (three's units for a sprite that doesn't shrink with
//     distance) with sizeAttenuation false
//   center: the sprite's anchor; [0.5, 0] is the tail's tip, so put the
//     sprite just over a head and the card stands above it
//   set(text | null): the line shown (painted once), or hidden (null, or
//     anything that isn't a line); the last line back isn't painted again
//   fade(k 0..1): its opacity, with whoever it's over (hidden at 0)
//   dispose(): its texture and material let go, and out of whatever held it

import * as THREE from 'three';
import { sharpen } from './textures';

// A canvas reads no CSS variables, so the look is written here: the world
// kit's speech bubble's (runtime/hud/hud.css's --hud-bubble and
// --hud-bubble-ink defaults), a pale card with dark ink, which reads over
// any world, night or day; a faint edge of the ink keeps it apart from snow
// or a white wall behind it.
const CARD_FILL = '#fbf4e2';
const CARD_INK = '#2a1d10';
const CARD_EDGE = 'rgba(42, 29, 16, 0.3)';
// the house font (index.css's --font-sans), which the page has loaded by the
// time anyone is in a world
const FONT_PX = 34;
const FONT = `600 ${FONT_PX}px 'Archivo Variable', 'Archivo', system-ui, sans-serif`;

// The canvas, in its own pixels: one size for every line, wide enough for
// the longest set one with room to spare, so a new line is a repaint and
// never a new texture (a texture can't change size once it's uploaded).
const W = 512;
const H = 88;
const EDGE = 3; // room for the edge's line at the canvas's own edge
const CARD = 64; // the card's height; the tail is the rest, down to the tip
const PAD = 20; // between the words and the card's sides
const RADIUS = 18;
const TAIL_W = 26;
const TEXT_MAX = W - (EDGE + PAD) * 2; // a longer line is squeezed to this

// the card and its tail as one outline, so the edge runs round both without
// a seam where they meet (the card at least CARD wide, so the tail fits
// between its corners)
function outline(g, x, w) {
  const top = EDGE;
  const bottom = EDGE + CARD;
  const mid = W / 2;
  g.beginPath();
  g.moveTo(x + RADIUS, top);
  g.arcTo(x + w, top, x + w, bottom, RADIUS);
  g.arcTo(x + w, bottom, x, bottom, RADIUS);
  g.lineTo(mid + TAIL_W / 2, bottom);
  g.lineTo(mid, H - EDGE);
  g.lineTo(mid - TAIL_W / 2, bottom);
  g.arcTo(x, bottom, x, top, RADIUS);
  g.arcTo(x, top, x + w, top, RADIUS);
  g.closePath();
}

function paint(g, text) {
  g.clearRect(0, 0, W, H);
  g.font = FONT;
  const w = Math.max(CARD, Math.ceil(Math.min(g.measureText(text).width, TEXT_MAX)) + PAD * 2);
  outline(g, (W - w) / 2, w);
  g.fillStyle = CARD_FILL;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = CARD_EDGE;
  g.stroke();
  g.fillStyle = CARD_INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // (a pixel low: 'middle' sits the lower-case a touch high in the card)
  g.fillText(text, W / 2, EDGE + CARD / 2 + 1, TEXT_MAX);
}

export function createQuipSprite({ height = 0.4, sizeAttenuation = true, center = [0.5, 0] } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const map = sharpen(new THREE.CanvasTexture(canvas), { color: true });
  // (its colours as written, not toned by the world's exposure or lost in
  // its fog: a line over someone is there to be read)
  const material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, sizeAttenuation, fog: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'quip';
  sprite.center.set(center[0], center[1]);
  const tall = (height * H) / CARD;
  sprite.scale.set((tall * W) / H, tall, 1);
  sprite.renderOrder = 6; // over the name card (ghostsOf.js's are 5) where the two meet
  sprite.visible = false;

  let shown = null; // the line now, or null
  let painted = null; // the line on the canvas, kept while it's hidden
  let alpha = 1;
  const show = () => {
    sprite.visible = shown !== null && alpha > 0;
  };

  return {
    sprite,
    set(text) {
      const line = typeof text === 'string' && text ? text : null;
      if (line === shown) return;
      shown = line;
      if (line !== null && line !== painted) {
        paint(g, line);
        painted = line;
        map.needsUpdate = true;
      }
      show();
    },
    fade(k) {
      alpha = Number.isFinite(k) ? Math.min(1, Math.max(0, k)) : 0;
      material.opacity = alpha;
      show();
    },
    dispose() {
      // (not its geometry: three's sprites all share one)
      sprite.removeFromParent();
      map.dispose();
      material.dispose();
    },
  };
}
