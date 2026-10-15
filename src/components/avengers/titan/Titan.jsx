import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { use3D } from '../../../lib/gpu';
import { prefersReducedMotion } from '../../../lib/hooks';
import { drawOnce, register, useStage, useStageFrame } from '../hq/useStage';
import gameModule from './module';
import { STONES } from '../../interests/stones';
import '../../../styles/lazy/avengers.css';

// Titan in 3D (./scene.js) in the gauntlet's panel: the gauntlet raised against
// the dusk, a button over each socket (they follow the hand), and the snap.
// The drawing of the gauntlet (`fallback`) stays where there's no 3D, and
// while another of the page's 3D views is the live one (hq/useStage's useLive).

const Titan = forwardRef(function Titan({ have, onSet, fallback }, ref) {
  const three = use3D();
  const buttons = useRef({});
  const calm = useRef(typeof window !== 'undefined' && prefersReducedMotion());
  const haveRef = useRef(have);
  haveRef.current = have;
  // (never too slow for its page: the gauntlet keeps its 3D, as it did)
  const options = useMemo(() => ({ calm: calm.current }), []);
  const stage = useStage(gameModule, { enabled: three.on, id: 'titan', forced: true, options, props: { stones: haveRef } });
  const { view, visible } = stage;
  const status = stage.status === 'slow' || stage.status === 'lost' ? 'failed' : stage.status;

  useEffect(() => {
    view.current?.setStones(have);
  }, [have, status, view]);

  useEffect(() => (status === 'on' ? register('titan', { view: view.current }) : undefined), [status, view]);

  // the buttons follow the sockets, every frame
  const place = () => {
    const v = view.current;
    if (!v) return;
    for (const s of STONES) {
      const b = buttons.current[s.id];
      if (!b) continue;
      const p = v.socket(s.id);
      // whole pixels, so a slow sway doesn't shimmer the targets
      b.style.left = `${Math.round(p.x)}px`;
      b.style.top = `${Math.round(p.y)}px`;
      b.style.visibility = p.front && !v.dusting ? 'visible' : 'hidden';
    }
  };
  // a frame each frame while it's on screen (the runtime's loop; its first,
  // its stones set, as it comes up: ./module.js), but with reduced motion
  const tick = (dt) => {
    view.current?.render(dt / 1000);
    place();
  };
  useStageFrame(stage, tick, status === 'on' && visible && !calm.current);
  // with reduced motion there's no loop: draw when something changes
  useEffect(() => {
    if (status !== 'on' || !calm.current) return;
    drawOnce(stage, () => {
      view.current?.render(1 / 60);
      place();
    });
    // (stage is this page's own, the same each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, have]);

  // the snap: true if the 3D is doing it (and calls `done(tony)` at the moment
  // the fingers meet), false if the page should do it itself
  useImperativeHandle(ref, () => ({
    snap(tony, done) {
      const v = view.current;
      if (status !== 'on' || !v) return false;
      return v.snap(tony, done);
    },
  }));

  const on = status === 'on';
  return (
    <div ref={stage.wrap} className="titan-stage" data-on={on || undefined}>
      {!on && fallback}
      {three.on && status !== 'failed' && <div ref={stage.host} className="titan-canvas" data-on={on || undefined} aria-hidden="true" />}
      {on && (
        <div className="titan-sockets" role="group" aria-label="Infinity Stones">
          {STONES.map((s) => {
            const set = have.includes(s.id);
            return (
              <button
                key={s.id}
                ref={(el) => (buttons.current[s.id] = el)}
                type="button"
                className="socket titan-socket"
                style={{ '--glow': s.color }}
                aria-pressed={set}
                aria-label={set ? `${s.name}, set` : `Set the ${s.name}`}
                data-label={s.name}
                onClick={() => onSet(s.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

export default Titan;
