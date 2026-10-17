// The renderer the map draws with is the runtime’s, shared with whatever
// world comes before and after it (the galaxy, at a jump), and at a
// handover both are alive on it: the old world draws on while the new one
// is made, and the new one is made before the old one is let go. So what
// the map sets for its own frames is set only while it draws them
// (`during`) and put back after each: it counts its draws over a whole
// frame itself (info.autoReset off) and maps no tone (the post does,
// after the bloom: ./look.js; the runtime’s classic renderer maps Neutral
// for the worlds that leave it to the renderer). Made while another world
// still drew, the map changed that world’s last frames, the cover kept of
// it among them; made before the map was let go, the next world read the
// map’s settings as the runtime’s.
//
// What the map sets on it for longer goes back when the map goes, if no
// world has the renderer next (`giveBack`, its caller’s to judge): the
// broken flagship’s clipping planes (localClippingEnabled, set where they’re
// made) and a cockpit’s shadows (cockpit/vehicles turns the shadow map on).
//
// borrow(renderer) → { during(draw) → what draw returns, giveBack() }

import { NoToneMapping } from 'three';

export function borrow(renderer) {
  const was = {
    clipping: renderer.localClippingEnabled,
    shadows: renderer.shadowMap?.enabled,
    shadowType: renderer.shadowMap?.type,
  };
  let given = false;
  return {
    during(draw) {
      const autoReset = renderer.info.autoReset;
      const toneMapping = renderer.toneMapping;
      renderer.info.autoReset = false;
      renderer.toneMapping = NoToneMapping;
      try {
        return draw();
      } finally {
        renderer.info.autoReset = autoReset;
        renderer.toneMapping = toneMapping;
      }
    },
    giveBack() {
      if (given) return;
      given = true;
      renderer.localClippingEnabled = was.clipping;
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = was.shadows;
        renderer.shadowMap.type = was.shadowType;
      }
    },
  };
}
