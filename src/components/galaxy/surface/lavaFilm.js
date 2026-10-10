// The 2017 game's lava film (MT_Volcano2, src/lib/bf2017/films.js) as a
// texture for a site's lava (water.js), where the site asks for it
// (site.water.video) and the visitor can take it: high and ultra only, never
// with reduced motion or on a saver connection, and only once the film is
// published. A muted, looping video element the texture reads each frame.
//
// lavaFilm(site, { level, reduced, saveData, doc, films }) →
//   { texture, flipped, dispose() } | null

import * as THREE from 'three';
import { filmFor, mayPlay } from '../../../lib/bf2017/films';
import { device } from '../../../lib/device';

export function lavaFilm(site, { level, reduced = false, saveData = Boolean(device().saveData), doc = globalThis.document, films } = {}) {
  const w = site?.water;
  if (w?.kind !== 'lava' || !w.video) return null;
  if (level !== 'high' && level !== 'ultra') return null;
  if (!mayPlay({ reduced, saveData })) return null;
  const film = filmFor({ fx: w.video }, films ? { films } : undefined);
  if (!film || !doc?.createElement) return null;
  const video = doc.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.src = film.url;
  video.play?.()?.catch?.(() => {});
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {
    texture,
    flipped: film.flipped,
    dispose() {
      video.pause?.();
      video.removeAttribute?.('src');
      video.load?.();
      texture.dispose();
    },
  };
}
