import { useEffect, useState } from 'react';
import { device, storageFree } from '../../lib/device';
import { gpu } from '../../lib/gpu';
import { rendererLine } from './settings.js';
import { rendererReport } from '../../runtime/backend.js';

// What Auto sees here (the graphics chip and its grade, the tier, the
// memory, whether hardware acceleration is on) and, while a world is up on
// the runtime, what it costs: the frame time, the draw calls and the
// triangles of the last frame (its renderer's info), read twice a second,
// and which renderer it draws with (WebGPU, WebGL 2 through the node
// renderer, or the classic one: runtime/backend.js), with the ?gpu= asked.

const GRADE = { ultra: 'Strong', high: 'Good', mid: 'Modest' };
const TIER = { high: 'Laptop or desktop', mid: 'Phone, tablet or small computer', low: 'Weak device' };

const millions = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

function useLive() {
  const [live, setLive] = useState(null);
  useEffect(() => {
    let alive = true;
    let frame = 0;
    let last = performance.now();
    let sum = 0;
    let count = 0;
    let peek = () => null;
    // (the runtime only if a world has made it, looked for at every read so
    // a world opened while the panel is up shows: the readout never makes one)
    import('../../runtime').then((m) => {
      if (alive) peek = m.peekRuntime;
    });
    const tick = (now) => {
      sum += now - last;
      count += 1;
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const poll = setInterval(() => {
      const rt = peek();
      const info = rt?.current ? rt.gfx?.renderer?.info : null;
      const ms = count ? sum / count : null;
      sum = 0;
      count = 0;
      const renderer = rt?.current ? rendererLine({ backend: rt.gfx?.backend, override: rt.override }) : null;
      const report = rt?.current ? rendererReport({ backend: rt.gfx?.backend, shading: rt.current.module?.shading, gpu: Boolean(navigator.gpu) }) : null;
      setLive(info ? { ms, calls: info.render.calls, triangles: info.render.triangles, renderer, report } : ms != null ? { ms } : null);
    }, 500);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      clearInterval(poll);
    };
  }, []);
  return live;
}

export default function DeviceReadout() {
  const d = device();
  const g = gpu();
  const live = useLive();
  const [free, setFree] = useState(null);
  useEffect(() => {
    let alive = true;
    storageFree().then((mb) => alive && setFree(mb));
    return () => {
      alive = false;
    };
  }, []);
  const accel = !g.webgl ? 'No WebGL' : g.software ? 'Off (drawing in software)' : 'On';
  const rows = [
    ['Graphics chip', g.renderer || 'Not reported by this browser'],
    ['Chip grade', d.phone ? 'Phone chip' : (GRADE[d.grade] ?? 'Not graded')],
    ['Device', TIER[d.tier] ?? d.tier],
    ['Memory', d.memory ? `${d.memory} GB${d.memory >= 8 ? ' or more' : ''}` : 'Not reported'],
    ['Hardware acceleration', accel],
    ['Storage left', free == null ? 'Not reported' : free > 1024 ? `${(free / 1024).toFixed(1)} GB` : `${Math.round(free)} MB`],
  ];
  return (
    <div className="settings-readout">
      <dl className="settings-facts">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="settings-live" aria-live="off">
        <span>
          <b>{live?.ms != null ? live.ms.toFixed(1) : '–'}</b> ms a frame
        </span>
        <span>
          <b>{live?.calls ?? '–'}</b> draw calls
        </span>
        <span>
          <b>{live?.triangles != null ? millions(live.triangles) : '–'}</b> triangles
        </span>
      </div>
      {live?.renderer && (
        <p className="settings-note">
          Drawn with <b>{live.renderer}</b>
          {live.report?.best ? ': the best picture.' : live.report ? `. ${live.report.note}` : ''}
        </p>
      )}
      {live && live.calls == null && <p className="settings-note">Draw calls and triangles show while a 3D world is open behind this panel.</p>}
    </div>
  );
}
