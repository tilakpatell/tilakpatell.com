// The renderer the map draws with is the runtime’s, shared with whatever
// world comes next (the galaxy, at a jump), so what the map sets on it is
// kept as it was and put back when the map goes. It counts its draws over a
// whole frame itself (info.autoReset off), maps no tone (the post does,
// after the bloom: ./look.js; the runtime’s classic renderer maps Neutral
// for the worlds that leave it to the renderer), cuts a broken flagship’s
// halves with clipping planes (localClippingEnabled, set where they’re
// made) and lets a cockpit’s light throw shadows (cockpit/vehicles turns
// the shadow map on).
//
// borrow(renderer) → giveBack()

import { NoToneMapping } from 'three';

export function borrow(renderer) {
  const was = {
    autoReset: renderer.info.autoReset,
    clipping: renderer.localClippingEnabled,
    toneMapping: renderer.toneMapping,
    shadows: renderer.shadowMap?.enabled,
    shadowType: renderer.shadowMap?.type,
  };
  renderer.info.autoReset = false;
  renderer.toneMapping = NoToneMapping;
  let given = false;
  return () => {
    if (given) return;
    given = true;
    renderer.info.autoReset = was.autoReset;
    renderer.localClippingEnabled = was.clipping;
    renderer.toneMapping = was.toneMapping;
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = was.shadows;
      renderer.shadowMap.type = was.shadowType;
    }
  };
}
