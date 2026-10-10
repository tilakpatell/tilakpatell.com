import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../../lib/hooks';
import { detailLevel } from '../../../lib/detail';
import { stageFor } from './heroStage.js';

// The loadout's hero on the 2017 game's hero-select stage (heroStage.js),
// for the Outfit tab: a canvas while there's a stage for this hero at this
// detail level, else the flat backdrop the panel always had (nothing drawn).
export default function HeroStage({ spec, level = detailLevel() }) {
  const canvas = useRef(null);
  const stage = useRef(null);
  const reduced = useReducedMotion();
  const on = Boolean(stageFor({ level, hero: spec }));
  // (one stage a mount: a new pick is shown on it, below)
  const picked = useRef(spec);
  picked.current = spec;
  useEffect(() => {
    if (!on || !canvas.current) return undefined;
    let gone = false;
    import('./heroStage.js').then(({ createHeroStage }) => {
      if (gone || !canvas.current) return;
      stage.current = createHeroStage(canvas.current, { level, reduced });
      stage.current?.show(picked.current);
    });
    const onResize = () => stage.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      gone = true;
      window.removeEventListener('resize', onResize);
      stage.current?.dispose();
      stage.current = null;
    };
  }, [on, level, reduced]);
  useEffect(() => {
    stage.current?.show(spec);
  }, [spec]);
  if (!on) return null;
  return <canvas ref={canvas} className="surface-hero-stage" aria-label={`${spec.name} on the hero-select stage from Star Wars Battlefront II`} role="img" />;
}
