// The loading screen over a world while it gets ready (lib/three/gpuWork's
// prepareScene, a world's prepare): its name, how far along it is, and what
// it's doing, so a longer wait reads as work being done and the world
// fades in drawing smoothly. The bar moves by a transform with a transition,
// which the browser animates on its own, so it keeps moving while the page
// is busy sending the world to the graphics chip.
//
// <LoadingVeil shown progress={0.4} step="shaders" title="The universe" />
// (`step` one of STEP_WORDS' keys; `className` places it in its world's box;
// `backdrop`, a film or a picture, fills the veil behind its card)

import { useEffect, useState } from 'react';
import { STEP_WORDS } from './loadingSteps';
import './loadingVeil.css';


const FADE = 450; // ms

export default function LoadingVeil({ shown, progress = 0, step = 'load', title = '', line = '', className = '', backdrop = null }) {
  // (kept up for its fade once it's done)
  const [up, setUp] = useState(shown);
  useEffect(() => {
    if (shown) {
      setUp(true);
      return undefined;
    }
    const t = setTimeout(() => setUp(false), FADE);
    return () => clearTimeout(t);
  }, [shown]);
  if (!up) return null;
  const k = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <div className={`loading-veil ${shown ? '' : 'is-done'} ${backdrop ? 'has-backdrop' : ''} ${className}`.replace(/\s+/g, ' ').trim()} role="status" aria-live="polite">
      {backdrop && <div className="loading-veil-backdrop">{backdrop}</div>}
      <div className="loading-veil-card">
        {title && <p className="loading-veil-title">{title}</p>}
        <div className={`loading-veil-bar ${step === 'load' && k === 0 ? 'is-waiting' : ''}`.trim()} aria-hidden="true">
          <span style={{ transform: `scaleX(${k})` }} />
        </div>
        <p className="loading-veil-step">
          {STEP_WORDS[step] ?? STEP_WORDS.load}
          <span className="loading-veil-pct"> {Math.round(k * 100)}%</span>
        </p>
        {line && <p className="loading-veil-line">{line}</p>}
      </div>
    </div>
  );
}
