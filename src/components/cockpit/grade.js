// How each launch's picture is finished on its way to the screen (scene.js),
// a row a vehicle:
//
//   tone       the curve the light is brought to the screen through:
//              'neutral', the universe map's (what's under 0.8 kept as it was
//              drawn, only what's brighter rounded off towards white with its
//              hue kept, so the tunnel stays blue, Chewie's fur brown, and the
//              flash clears onto a map drawn the same way; lens.js draws the
//              map's shoulder, the one pass three's Khronos Neutral), or
//              'none' (the cruiser's cartoon: flat colours that were never
//              meant to roll off)
//   exposure   the light times this, ahead of the curve
//   bloom      the lens's mip chain (lib/three/bloomChain, after a
//              Frostbite-style renderer's Gaussian pyramid): a `veil` of all
//              the light (a lens scatters everything, so the dark round a lit
//              screen isn't quite black) and a glare of what's over
//              `threshold`, eased in over `knee`, at `strength`; `sharpness`
//              how much of it stays in the core
//
// What it replaced, and why: three's ACESFilmic multiplies the light by 1/0.6
// before its curve and saturates on the way, so a lit panel read about twice
// as bright as the same light under the map's curve, the orange of the fur
// and the suns ran to yellow, and the tunnel's blue to white; and three's
// UnrealBloomPass from 0.8 up caught every lit button and every glint on the
// chrome, a halo round each, a white bar down each lever.
//
//   gradeOf(id) → the row (the Falcon's for an id with none)
//   whiteOutAt(flash) → { lift, glow }: as a light flash rises (0…1), the
//     picture's light pushed up ahead of the curve and the glow with it, so
//     the jump burns into the white rather than a veil fading over it
//   bloomSize(w, h) → [w, h], the chain's first level for a w × h frame:
//     half of it, its long side no more than 640 (the map's), never under 64

export const GRADE = {
  falcon: { tone: 'neutral', exposure: 1.25, bloom: { threshold: 1.8, knee: 0.7, strength: 0.55, veil: 0.025, sharpness: 0.55 } },
  xwing: { tone: 'neutral', exposure: 1.2, bloom: { threshold: 1.8, knee: 0.7, strength: 0.55, veil: 0.025, sharpness: 0.55 } },
  // (the portal's green and the street's lamps, over flat paint that clips)
  cruiser: { tone: 'none', exposure: 1, bloom: { threshold: 1.0, knee: 0.3, strength: 0.45, veil: 0.015, sharpness: 0.6 } },
  // (the desert at dusk and the drive into the night: its own sky lights it)
  rv: { tone: 'neutral', exposure: 1.3, bloom: { threshold: 1.6, knee: 0.6, strength: 0.4, veil: 0.02, sharpness: 0.55 } },
};

export const gradeOf = (id) => GRADE[id] ?? GRADE.falcon;

export function whiteOutAt(flash = 0) {
  const f = Math.min(1, Math.max(0, flash));
  return { lift: 1 + 2.5 * f * f, glow: 1 + 2.5 * f };
}

export function bloomSize(w, h, cap = 640) {
  let bw = w * 0.5;
  let bh = h * 0.5;
  const long = Math.max(bw, bh);
  if (long > cap) {
    bw *= cap / long;
    bh *= cap / long;
  }
  return [Math.max(64, Math.round(bw)), Math.max(64, Math.round(bh))];
}
