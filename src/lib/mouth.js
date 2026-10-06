import { useEffect } from 'react';
import { voiceLevel } from './audio';

// How open a speaking face's mouth is, from how loud the voice is (lib/audio's
// voice tap). Loudness is taken against the loudest it has been lately, so the
// quiet blips and a full recording both open the mouth wide on their loud
// syllables; the mouth snaps open and eases shut, the way a jaw moves.
// One step a frame: returns the new { open, peak } (open is 0 shut to 1 wide).
export function mouthStep({ open, peak }, level) {
  const p = Math.max(peak * 0.985, level, 0.02);
  const target = level < 0.003 ? 0 : Math.min(1, (level / p) * 1.3);
  const next = open + (target - open) * (target > open ? 0.65 : 0.3);
  return { open: next < 0.01 ? 0 : next, peak: p };
}

// While `talking`, sets --mouth on the element every frame (the faces' Mouth
// reads it), and back to 0 when they stop. Nothing moves for reduced motion.
export function useMouth(ref, talking, reduced) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.style.setProperty('--mouth', '0');
    if (!talking || reduced) return undefined;
    let state = { open: 0, peak: 0.02 };
    let shown = '0';
    let raf = requestAnimationFrame(function tick() {
      state = mouthStep(state, voiceLevel());
      const v = state.open.toFixed(2);
      if (v !== shown) el.style.setProperty('--mouth', (shown = v));
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      el.style.setProperty('--mouth', '0');
    };
  }, [ref, talking, reduced]);
}
