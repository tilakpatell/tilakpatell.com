import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../../lib/hooks';
import { WorldHost, useWorld } from '../../../runtime';
import surfaceModule from './module';

// A world's 3D (scene.js, a world module on the world runtime:
// ./module.js) and the controls over it on a
// touch screen: a stick on the left to walk (pushed all the way, you run),
// the rest of the screen to look round, and buttons for jumping and for
// whatever's to hand (E on a keyboard). While the 3D loads the box says
// so; without 3D, a note that the world needs it.

export default function SurfaceView({ system, mission = null, ship, loadout, build = null, found, done, compass, net = null, handle, onEvent }) {
  const events = useRef(onEvent);
  events.current = onEvent;
  const [coarse] = useState(() => (typeof window !== 'undefined' ? (window.matchMedia?.('(pointer: coarse)').matches ?? false) : false));
  const reduced = useReducedMotion();
  const { host, on, meant, rt } = useWorld(surfaceModule, {
    props: { system, mission, ship, loadout, build, found, done, compass, net, reduced },
    onEvent: (e) => events.current?.(e),
  });
  // the scene itself, while it's the world on the runtime
  const view = { get current() { return rt?.current?.module === surfaceModule ? rt.current.world.scene : null; } };
  useEffect(() => {
    if (handle) handle.current = { live: on, host: () => host.current, takeOff: () => view.current?.takeOff?.() ?? false, input: (name, ...a) => view.current?.input?.[name]?.(...a), debug: () => view.current?.debug?.() };
  }, [handle, on]); // eslint-disable-line react-hooks/exhaustive-deps
  // (for the page's own tests, in development)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__surface = () => view.current?.debug?.();
    window.__surfaceDo = (name, ...a) => view.current?.[name]?.(...a);
    return () => {
      delete window.__surface;
      delete window.__surfaceDo;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the stick: where the thumb is from where it came down
  const stick = useRef({ id: null, x: 0, y: 0 });
  const knob = useRef(null);
  const send = (x, y) => view.current?.input?.stick(x, y);
  const stickDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    stick.current = { id: e.pointerId, x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    stickMove(e);
  };
  const stickMove = (e) => {
    const s = stick.current;
    if (s.id !== e.pointerId) return;
    let dx = (e.clientX - s.x) / s.r;
    let dy = (e.clientY - s.y) / s.r;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    send(dx, -dy);
  };
  const stickUp = (e) => {
    if (stick.current.id !== e.pointerId) return;
    stick.current.id = null;
    if (knob.current) knob.current.style.transform = '';
    send(0, 0);
  };
  // the look pad: a drag turns the camera
  const lookAt = useRef(new Map());
  const padDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    lookAt.current.set(e.pointerId, [e.clientX, e.clientY]);
  };
  const padMove = (e) => {
    const was = lookAt.current.get(e.pointerId);
    if (!was) return;
    view.current?.input?.look((e.clientX - was[0]) * 1.5, (e.clientY - was[1]) * 1.5);
    lookAt.current.set(e.pointerId, [e.clientX, e.clientY]);
  };
  const padUp = (e) => lookAt.current.delete(e.pointerId);
  const press = (name) => (e) => {
    e.preventDefault();
    view.current?.input?.press(name);
  };
  const release = (name) => (e) => {
    e.preventDefault();
    view.current?.input?.release(name);
  };

  return (
    <WorldHost world={{ host }} className="surface-map">
      {meant ? (
        !on && (
          <p className="surface-loading" role="status">
            Coming down through the atmosphere…
          </p>
        )
      ) : (
        <p className="surface-loading" role="status">
          Landing needs 3D, and this browser has it turned off.
        </p>
      )}
      {on && coarse && (
        <div className="surface-touch">
          <div className="surface-pad" onPointerDown={padDown} onPointerMove={padMove} onPointerUp={padUp} onPointerCancel={padUp} />
          <div className="surface-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} aria-hidden="true">
            <span ref={knob} />
          </div>
          <div className="surface-buttons">
            <button type="button" className="surface-btn" onPointerDown={press('jump')} onContextMenu={(e) => e.preventDefault()}>
              Jump
            </button>
            <button type="button" className="surface-btn surface-btn-act" onPointerDown={press('act')} onContextMenu={(e) => e.preventDefault()}>
              Use
            </button>
            <button type="button" className="surface-btn" onPointerDown={press('run')} onPointerUp={release('run')} onPointerCancel={release('run')} onPointerLeave={release('run')} onContextMenu={(e) => e.preventDefault()}>
              Run
            </button>
            <button type="button" className="surface-btn surface-btn-fire" onPointerDown={press('fire')} onPointerUp={release('fire')} onPointerCancel={release('fire')} onPointerLeave={release('fire')} onContextMenu={(e) => e.preventDefault()}>
              Fire
            </button>
          </div>
        </div>
      )}
    </WorldHost>
  );
}
