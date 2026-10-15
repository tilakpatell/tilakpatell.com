// How the picture is finished. Modern: the scene, a light bloom (the look’s,
// ./look.js), then the renderer’s tone mapping and colour space, as the
// runtime’s node post chain (rt.gfx.post: its passes as data, runtime/
// webgpu.js). The EffectComposer it replaces is
// scripts/twin-parity/originals/mario64.js’s makeLook, kept
// for the parity check. Ultra and N64 come with the looks slice; until then
// they draw as Modern.
//
// makeLook(post, scene, camera, { bloom }) → { render(), setSize(w, h),
//   setLook(name), setBloom(on), look, ready, passes, dispose() }
//   (post: rt.gfx.post, passes → a chain { ready, passes, render(),
//   setSize(), dispose() })
// passesFor(scene, camera, bloom) → the chain’s passes

import { LOOK } from './look';

export const LOOK_NAMES = ['modern', 'ultra', 'n64'];

// (the scene drawn with no multisampling, as the composer's buffer was: the
// node renderer's four samples made a High frame on SwiftShader 1.6 times
// as long, 0.8 frames a second against 1.3, for edges the composer never
// drew)
export const passesFor = (scene, camera, bloom) => [{ kind: 'render', scene, camera, samples: 0 }, ...(bloom ? [{ kind: 'bloom', ...LOOK.bloom, composer: true }] : []), { kind: 'output' }];

export function makeLook(post, scene, camera, { bloom = true } = {}) {
  let glow = Boolean(bloom);
  let chain = post(passesFor(scene, camera, glow));
  // (a chain being built, its bloom put on or taken off: the one before
  // draws until it is, as the composer's bloom was switched between frames)
  let coming = null;
  let look = 'modern';
  let gone = false;
  return {
    render() {
      chain.render();
    },
    // (the node chain takes the renderer's size and ratio as it draws)
    setSize(w, h) {
      chain.setSize?.(w, h);
    },
    setLook(name) {
      look = LOOK_NAMES.includes(name) ? name : 'modern';
      return look;
    },
    setBloom(on) {
      // (the governor may lower a world on its way out: nothing built then)
      if (gone || Boolean(on) === glow) return;
      glow = Boolean(on);
      coming?.dispose();
      const next = post(passesFor(scene, camera, glow));
      coming = next;
      Promise.resolve(next.ready).then(
        () => {
          if (coming !== next) return;
          coming = null;
          chain.dispose();
          chain = next;
        },
        // (a chain that could not be built would draw nothing: the one
        // drawing now goes on drawing)
        () => {
          if (coming !== next) return;
          coming = null;
          next.dispose();
        },
      );
    },
    get look() {
      return look;
    },
    get ready() {
      return chain.ready;
    },
    get passes() {
      return chain.passes;
    },
    dispose() {
      gone = true;
      coming?.dispose();
      coming = null;
      chain.dispose();
    },
  };
}
