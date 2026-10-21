// How far the map has got, for its loading screen (components/worlds/
// LoadingVeil, through the runtime's 'prepare' events), told the whole way:
// its planets' maps fetched (create's loadTextures), its shaders made
// (`ready`'s warm, scene.js), the models of the planets near where it opens
// fetched (its prepare's wait), then its prepare's own steps (lib/three/
// gpuWork's prepareScene) in the rest of the bar. Until 2026-10-21 only the
// last said anything: the bar sat at "Fetching the world 0%" while the
// shaders were made, every download long done (15 s of a 17 s wait, in
// software on the live site), and read as stuck.
//
// loadSteps(emit) → { maps(k), shaders(k), near(k), prepare(v, step) }: each
// k 0…1 within its share of the bar, prepare's v 0…1 across the rest; emit
// (value, step) hears each, and the bar never goes back (a model that comes
// in after the shaders are made is told under the fetch again, the bar held).

export const SHARES = { maps: [0, 0.15], shaders: [0.15, 0.45], near: [0.45, 0.5], prepare: [0.5, 0.97] };

const clamp01 = (k) => (Number.isFinite(k) ? Math.min(1, Math.max(0, k)) : 0);

export function loadSteps(emit) {
  let shown = 0;
  const at = (share, step, k) => {
    const [a, b] = SHARES[share];
    shown = Math.max(shown, a + (b - a) * clamp01(k));
    emit(shown, step);
  };
  return {
    maps: (k) => at('maps', 'load', k),
    shaders: (k) => at('shaders', 'shaders', k),
    near: (k) => at('near', 'load', k),
    prepare: (v, step) => at('prepare', step, v),
  };
}
