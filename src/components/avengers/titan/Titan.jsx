import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { use3D } from '../../../lib/gpu';
import { prefersReducedMotion, useFrameLoop } from '../../../lib/hooks';
import { register, useLive, warmed } from '../hq/useStage';
import { STONES } from '../../interests/stones';
import '../../../styles/lazy/avengers.css';

// Titan in 3D (./scene.js) in the gauntlet's panel: the gauntlet raised against
// the dusk, a button over each socket (they follow the hand), and the snap.
// The drawing of the gauntlet (`fallback`) stays where there's no 3D, and
// while another of the page's 3D views is the live one (hq/useStage's useLive).
const load = () => import('./scene');

const Titan = forwardRef(function Titan({ have, onSet, fallback }, ref) {
  const three = use3D();
  const wrap = useRef(null);
  const canvas = useRef(null);
  const view = useRef(null);
  const buttons = useRef({});
  const redraw = useRef(() => {});
  const [status, setStatus] = useState('idle'); // idle | loading | on | failed
  const calm = useRef(typeof window !== 'undefined' && prefersReducedMotion());
  const haveRef = useRef(have);
  haveRef.current = have;

  const { active: near, visible } = useLive(wrap, { id: 'titan', enabled: three.on, warm: load });

  useEffect(() => {
    if (!three.on || !near || status === 'failed') return undefined;
    let dead = false;
    const fail = () => {
      view.current?.dispose();
      view.current = null;
      if (!dead) setStatus('failed');
    };
    setStatus('loading');
    load()
      .then(async (mod) => {
        if (dead || !canvas.current) return;
        try {
          // (`invalidate`: under reduced motion nothing loops, so the frame
          // guard asks for the frame that shows what it held back)
          const v = await mod.create(canvas.current, { calm: calm.current, onLost: fail, invalidate: () => redraw.current() });
          if (dead) {
            v.dispose();
            return;
          }
          await warmed(v, () => !dead); // everything on the graphics chip before the first frame
          if (dead || v.engine?.lost) {
            v.dispose();
            return;
          }
          view.current = v;
          const r = wrap.current.getBoundingClientRect();
          v.resize(r.width, r.height);
          v.setStones(haveRef.current);
          v.render(1 / 60);
          setStatus('on');
        } catch (err) {
          if (import.meta.env.DEV) console.error('[titan] 3D failed', err);
          fail();
        }
      })
      .catch(fail);
    return () => {
      dead = true;
      view.current?.dispose();
      view.current = null;
      setStatus((s) => (s === 'failed' ? s : 'idle'));
    };
    // status is read only to stay down after a failure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [three.on, near]);

  useEffect(() => {
    view.current?.setStones(have);
  }, [have, status]);

  useEffect(() => {
    const el = wrap.current;
    if (status !== 'on' || !el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => view.current?.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  useEffect(() => (status === 'on' ? register('titan', { view: view.current }) : undefined), [status]);

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
  redraw.current = () => {
    view.current?.render(0);
    place();
  };
  useFrameLoop(
    (dt) => {
      view.current?.render(dt / 1000);
      place();
    },
    status === 'on' && visible,
  );
  // with reduced motion there's no loop: draw when something changes
  useEffect(() => {
    if (status !== 'on' || !calm.current) return;
    view.current?.render(1 / 60);
    place();
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
    <div ref={wrap} className="titan-stage" data-on={on || undefined}>
      {!on && fallback}
      {three.on && status !== 'failed' && <canvas ref={canvas} className="titan-canvas" data-on={on || undefined} aria-hidden="true" />}
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
