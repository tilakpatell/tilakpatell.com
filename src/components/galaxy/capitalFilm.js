// The game's own films of a capital ship's death and the second Death Star's
// end (Battlefront II's VP6 movie textures, made WebM on the owner's desktop
// by scripts/desktop/bf2017-vp6.ps1 and published), as a video texture the
// space layer's blasts can wear on high and ultra. Until a film is published
// its row says so and videoLook answers null: the blast is the site's own
// flash (fx.js), as it always was.
//
// FILMS: kind → { url, published }
// videoLook(kind, { detail, make }) → { texture, play(), dispose() } | null
//   make(url) → the <video> (a test's stand-in; the page's own element else)

import * as THREE from 'three';
import { assetUrl } from '../../lib/assetBase';

export const FILMS = {
  'capital.death': { url: '/models/galaxy/space/film/capital-death.webm', published: false },
  'deathstar.end': { url: '/models/galaxy/space/film/deathstar-end.webm', published: false },
};
const SHOWN = new Set(['high', 'ultra']);

const video = (url) => {
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = 'anonymous';
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  return v;
};

export function videoLook(kind, { detail = 'high', make = video } = {}) {
  const film = FILMS[kind];
  if (!film?.published || !SHOWN.has(detail)) return null;
  const el = make(assetUrl(film.url));
  const texture = new THREE.VideoTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {
    texture,
    play: () => el.play?.().catch(() => {}),
    dispose() {
      el.pause?.();
      el.removeAttribute?.('src');
      texture.dispose();
    },
  };
}
