import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useInView } from '../../lib/hooks';
import { engine } from './module';
import { useTick } from './tick';
import '../../styles/lazy/middleearth.css';

// A Middle-earth scene in WebGL, laid over the drawing it stands in for.
// It loads Three.js and the scene only once it is near the screen, hands the
// scene the game's state every frame (`read`), and reports 'on' once it has
// drawn, or 'lost' / 'failed', so the drawing can come back. The scene draws
// on the world's renderer (./module.js, ./stage.js), in the world's frames
// (./tick.js). `api` is a ref
// the game keeps, to tell the scene about moments (`api.current.fx(...)`).
export default function Scene3D({ name, load, read, api, soft = false, onState }) {
  const canvas = useRef(null);
  const scene = useRef(null);
  const [status, setStatus] = useState('waiting'); // waiting, loading, ready, on, lost, failed
  const [box, inView] = useInView({ rootMargin: '240px' });
  const [near, setNear] = useState(false);
  const running = useMostlyInView(box);
  const latest = useRef(read);
  latest.current = read;
  const report = useRef(onState);
  report.current = onState;
  const first = useRef(true);

  useEffect(() => {
    if (inView) setNear(true);
  }, [inView]);
  useEffect(() => {
    report.current?.(status);
  }, [status]);

  useEffect(() => {
    if (!near) return undefined;
    let dead = false;
    const fail = (why) => {
      scene.current?.dispose();
      scene.current = null;
      if (api) api.current = null;
      if (!dead) setStatus(why);
    };
    const size = () => {
      const r = canvas.current?.getBoundingClientRect();
      if (r && r.width > 0) scene.current?.resize(r.width, r.height);
    };
    setStatus('loading');
    Promise.all([load(), engine()])
      .then(([create]) => {
        if (dead || !canvas.current) return;
        try {
          scene.current = create(canvas.current, { soft, reduced: prefersReducedMotion(), onLost: () => fail('lost') });
          if (api) api.current = scene.current;
          if (import.meta.env.DEV) window.__ME__ = { ...window.__ME__, [name]: scene.current }; // for the browser tests
          size();
          first.current = true;
          setStatus('ready');
        } catch {
          fail('failed');
        }
      })
      .catch(() => fail('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      scene.current?.dispose();
      scene.current = null;
      if (api) api.current = null;
    };
    // the scene is made once; `load`, `soft` and `api` don't change under it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  useTick((ms) => {
    const s = scene.current;
    if (!s || s.lost) return;
    try {
      s.update(latest.current());
      s.render(ms);
      if (first.current) {
        first.current = false;
        setStatus('on'); // drawn once: now the drawing can step aside
      }
    } catch {
      s.dispose();
      scene.current = null;
      if (api) api.current = null;
      setStatus('failed');
    }
  }, inView && running && (status === 'ready' || status === 'on'), { canvas });

  return (
    <div ref={box} className="me-gl" aria-hidden="true">
      <canvas ref={canvas} data-on={status === 'on' || undefined} />
    </div>
  );
}

// Of the stages on screen, only the one showing the most of itself draws, so
// two that both peek into the screen don't both render; the one being played
// holds it. The scene still loads as it comes near (useInView above).
const shown = new Map(); // stage -> pixels of it on screen
const heard = new Set();
const tell = () => heard.forEach((f) => f());
function useMostlyInView(ref) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return undefined;
    }
    const key = {};
    const check = () => {
      const mine = shown.get(key) || 0;
      let most = true;
      shown.forEach((px, k) => {
        if (k !== key && px > mine) most = false;
      });
      setOn(mine > 0 && most);
    };
    heard.add(check);
    const io = new IntersectionObserver(
      ([e]) => {
        shown.set(key, e.isIntersecting ? e.intersectionRect.height : 0);
        tell();
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      heard.delete(check);
      shown.delete(key);
      tell();
    };
  }, [ref]);
  return on;
}
