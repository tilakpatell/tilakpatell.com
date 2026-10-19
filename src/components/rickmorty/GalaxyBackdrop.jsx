import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { device, pixelRatio } from '../../lib/device';
import { use3D } from '../../lib/gpu';
import { quiet, releaseContext } from '../../lib/three/renderer';
import { createSky } from '../galaxy/sky';
import { SYSTEMS } from '../galaxy/systems';

// Space behind the Rick and Morty page, for the cruiser to fly down through
// (CruiserFlight): the Star Wars galaxy's sky (galaxy/sky.js), its disc and
// dust, its core and nebulae, as Kashyyyk sees it, as the universe map has
// it (universe/scene.js), without the suns or the other systems' stars. On
// a canvas fixed behind the page, baked once, and drawn again only when the
// page scrolls (the view turning a little down the galaxy as you go; held
// still if motion's reduced) or resizes. Only where 3D is on.

const VIEW = { pitch: -0.12, yaw: 0.55 }; // where the view starts (radians)
const TURN = { pitch: -0.45, yaw: 1.3 }; // and how far it turns, top of the page to the bottom

export default function GalaxyBackdrop() {
  const ref = useRef(null);
  const { on } = use3D();

  useEffect(() => {
    if (!on || !ref.current) return undefined;
    // (made a moment later, so a mount that's undone at once, as React's
    // development double mount is, never makes one: its clean-up would let
    // the canvas's context go, and the mount after would get it back dead)
    let stop = null;
    let gone = false;
    queueMicrotask(() => {
      if (!gone && ref.current) stop = start(ref.current);
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [on]);

  if (!on) return null;
  return <canvas ref={ref} aria-hidden="true" className="rm-galaxy" />;
}

// the backdrop on `canvas`: baked, drawn, and kept to the scroll and the
// window's size; → its clean-up
function start(canvas) {
  let renderer;
  try {
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 10000);
  const sky = createSky({ small: Math.min(window.innerWidth, window.innerHeight) < 600, level: device().detail, renderer, beacons: false });
  sky.setSystem({ ...SYSTEMS.find((s) => s.id === 'kashyyyk'), suns: [] });
  scene.add(sky.group);
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let alive = true;
  let frame = 0;
  const draw = () => {
    frame = 0;
    if (!alive) return;
    const k = still ? 0 : window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    camera.rotation.set(VIEW.pitch + TURN.pitch * k, VIEW.yaw + TURN.yaw * k, 0, 'YXZ');
    renderer.render(scene, camera);
  };
  const ask = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(pixelRatio(1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sky.setRatio(renderer.getPixelRatio());
    ask();
  };
  resize();
  sky.prepare(renderer).then(() => {
    if (!alive) return;
    sky.bake(renderer);
    ask();
  });
  if (!still) window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', resize);
  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', ask);
    window.removeEventListener('resize', resize);
    sky.dispose();
    renderer.dispose();
    releaseContext(renderer);
  };
}
