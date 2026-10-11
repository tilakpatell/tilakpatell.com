// The stream spike’s receiver, at #/stream?id=<stream id>[&where=lan|internet]:
// the owner’s desktop’s ultra picture as video, the input sent back, and the
// numbers on glass. A dev route: nothing links it, and it does nothing without
// an id and the Supabase environment the build reads (VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY). Its client holds no session and is not the
// durable world’s: the stream signals and stores nothing. Decision: docs/decisions/2026-10-11-the-stream-from-the-desktop.md.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { verdict } from '../../lib/stream/stats';
import './stream.css';

// where in the frame a pointer is, 0 to 1 across the picture itself (the
// video is contained, so bars may sit beside it)
function framePoint(video, e) {
  const r = video.getBoundingClientRect();
  const vw = video.videoWidth || r.width;
  const vh = video.videoHeight || r.height;
  const scale = Math.min(r.width / vw, r.height / vh);
  const [w, h] = [vw * scale, vh * scale];
  return { x: (e.clientX - r.left - (r.width - w) / 2) / w, y: (e.clientY - r.top - (r.height - h) / 2) / h };
}

const ms = (v) => (v == null ? '…' : `${Math.round(v)} ms`);

export default function StreamView() {
  useDocumentTitle('Stream');
  const [params] = useSearchParams();
  const id = params.get('id');
  const where = params.get('where') === 'internet' ? 'internet' : 'lan';
  const video = useRef(null);
  const glass = useRef(null);
  const [status, setStatus] = useState(id ? 'starting' : 'no stream id in the address');

  useEffect(() => {
    if (!id) return undefined;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setStatus('no signalling: this build has no Supabase environment');
      return undefined;
    }
    let rx = null;
    let gone = false;
    const v = video.current;
    const send = (e) => rx?.sendInput(e);
    const onKey = (down) => (e) => {
      if (e.repeat) return;
      send({ t: 'key', down, code: e.code, key: e.key });
    };
    const pointer = (kind) => (e) => send({ t: 'pointer', kind, ...framePoint(v, e), button: e.button, buttons: e.buttons });
    const wheel = (e) => send({ t: 'pointer', kind: 'wheel', ...framePoint(v, e), dy: e.deltaY });
    const listeners = [
      [window, 'keydown', onKey(true)],
      [window, 'keyup', onKey(false)],
      [v, 'pointerdown', pointer('down')],
      [v, 'pointerup', pointer('up')],
      [v, 'pointermove', pointer('move')],
      [v, 'wheel', wheel],
    ];
    let tick = null;
    (async () => {
      const [{ createClient }, { startReceiver }] = await Promise.all([import('@supabase/supabase-js'), import('./receive')]);
      if (gone) return;
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      rx = await startReceiver({ client, id, video: v, where, onState: setStatus });
      if (gone) return rx.stop();
      for (const [el, type, fn] of listeners) el.addEventListener(type, fn, { passive: true });
      window.__streamReceiver = rx;
      // the numbers written into the glass through its ref, once a second
      tick = setInterval(() => {
        const s = rx.numbers();
        const ok = verdict(s, where);
        if (glass.current)
          glass.current.textContent = [
            `input to picture p50 ${ms(s.latency.p50)} · p95 ${ms(s.latency.p95)} (${s.latency.n}, ${s.latency.lost} lost) ${ok.latency ? 'under' : 'over'} the ${where} line`,
            `${s.last?.mbps ?? '…'} Mbit/s · ${s.last?.fps ?? '…'} fps · ${s.size ?? '…'} · ${s.codec ?? '…'} · round trip ${ms(s.last?.rttMs)}`,
          ].join('\n');
      }, 1000);
    })().catch((e) => setStatus(`could not start: ${e.message}`));
    return () => {
      gone = true;
      clearInterval(tick);
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
      rx?.stop();
      if (window.__streamReceiver === rx) delete window.__streamReceiver;
    };
  }, [id, where]);

  // on the body, over the shell (the route's own layer sits under the footer)
  return createPortal(
    <div className="stream-view">
      <video ref={video} muted playsInline autoPlay tabIndex={0} aria-label="The world streamed from the desktop" />
      <div className="stream-glass" role="status">
        <div>{status}</div>
        <div ref={glass} style={{ whiteSpace: 'pre-line' }} />
      </div>
    </div>,
    document.body,
  );
}
