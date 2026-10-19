import { useEffect, useRef } from 'react';
import { NAME, bodyOf } from './looks';

// The wardrobe's turntable: the look on the figure, turning (preview.js,
// loaded when it's first shown, made while this is mounted), with the
// body's name under it. The Wardrobe's dialog holds it, and so does the
// Hangar's Crew (through rickmorty/shared/wardrobe.js).
export default function WardrobeStage({ who, look, reduced = false }) {
  const canvas = useRef(null);
  const preview = useRef(null);
  const latest = useRef(look); // (for the turntable, made after a wait)
  latest.current = look;
  const body = bodyOf(who, look?.body);

  // the turntable, while it's here
  useEffect(() => {
    if (!canvas.current) return undefined;
    let gone = false;
    import('./preview').then(({ createWardrobePreview }) => {
      if (gone || !canvas.current) return;
      preview.current = createWardrobePreview(canvas.current, { reduced });
      preview.current?.show(latest.current);
    });
    return () => {
      gone = true;
      preview.current?.dispose();
      preview.current = null;
    };
    // (made once while it's here, showing the look as it is by then; changes after are the effect below's)
  }, [reduced]);
  useEffect(() => {
    preview.current?.show(look);
  }, [look]);

  return (
    <div className="rm-wardrobe-stage">
      <canvas ref={canvas} className="rm-wardrobe-canvas" aria-label={`${NAME[who]}, as ${body?.name ?? ''}: drag to turn him round`} />
      <p className="rm-wardrobe-who">{body?.name}</p>
    </div>
  );
}
