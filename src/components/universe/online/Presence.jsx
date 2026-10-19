import { useEffect, useRef } from 'react';
import { crewById } from '../crews';
import Face from '../Faces';
import { isMate } from './mates';
import { quipEl, setQuip } from './quipBubble';
import './online.css';

// The other pilots on the page you're on, off the universe map: each one's
// pointer, a little arrow in their crew's colour with their face and
// callsign on it, moving as they move theirs (or, on a phone, a marker at
// the edge where they're reading). Someone further up or down the page sits
// at the top or bottom edge, pointing the way. Yours goes out to them the
// same way. React draws who's here; a frame loop moves them, straight from
// client.js's pointers, so nothing re-renders as they move. What one has
// just said (quick chat: client.quip(id)) is a bubble over their callsign,
// quipBubble.js's, which the same loop sets and writes only on a change. An
// ally and a mate in your party (mates.js's isMate) are both in the ally
// green.

const IDLE_MS = 8000; // a pointer still this long fades
const GONE_MS = 90000; // and this long, goes
const TOP = 76; // px kept clear for the nav
const ALLY = '#8dffad';

const colorOf = (crew) => (crew ? Object.values(crew.speakers)[0].color : '#c9d2e3');

export default function Presence({ online }) {
  const { client, room, where } = online;
  const here = room.peers.filter((p) => !p.blocked && p.where === where);
  const els = useRef(new Map());
  // (each pointer's bubble, made the first time the loop meets it: React
  // doesn't draw it, so a render never takes away what the loop wrote)
  const bubbles = useRef(new WeakMap());
  const count = here.length;

  // yours, out to them: the pointer (and where it is on the page as you
  // scroll); with touch, the middle of what you're reading
  useEffect(() => {
    if (!client) return undefined;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    let last = null;
    const send = () => {
      if (coarse) client.cursor(0, window.scrollY + window.innerHeight * 0.4, true);
      else if (last) client.cursor(last.x - window.innerWidth / 2, last.y + window.scrollY, false);
    };
    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      last = { x: e.clientX, y: e.clientY };
      send();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', send, { passive: true });
    send();
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', send);
    };
  }, [client, where]);

  // theirs, moved each frame while anyone's here
  useEffect(() => {
    if (!client || !count) return undefined;
    let raf = 0;
    // (each pointer's last state as written: a frame writes only what
    // changed, so a page with pilots at rest restyles nothing)
    const written = new WeakMap();
    const bubbleOf = (el) => {
      let b = bubbles.current.get(el);
      if (!b) {
        const tag = el.querySelector('.presence-tag');
        if (!tag) return null;
        b = tag.appendChild(quipEl(document));
        bubbles.current.set(el, b);
      }
      return b;
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const w = window.innerWidth;
      const h = window.innerHeight;
      const top = window.scrollY;
      for (const [id, el] of els.current) {
        const cur = client.peers.get(id)?.cur;
        const age = cur ? now - cur.at : Infinity;
        if (age > GONE_MS) {
          if (written.get(el) !== 'gone') {
            el.removeAttribute('data-on');
            written.set(el, 'gone');
          }
          continue;
        }
        setQuip(bubbleOf(el), client.quip?.(id) ?? null);
        let x = cur.touch ? 10 : w / 2 + cur.x;
        let y = cur.y - top;
        const off = y < TOP ? 'up' : y > h - 44 ? 'down' : null;
        y = Math.min(h - 44, Math.max(TOP, y));
        x = Math.min(w - 48, Math.max(6, x));
        const transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
        const idle = age > IDLE_MS;
        const state = `${transform}|${off}|${idle}|${Boolean(cur.touch)}`;
        if (written.get(el) === state) continue;
        written.set(el, state);
        el.style.transform = transform;
        el.setAttribute('data-on', '');
        if (off) el.setAttribute('data-off', off);
        else el.removeAttribute('data-off');
        el.toggleAttribute('data-idle', idle);
        el.toggleAttribute('data-touch', Boolean(cur.touch));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [client, count]);

  return (
    <div className="presence" aria-hidden="true">
      {here.map((p) => {
        const crew = crewById(p.kind);
        const who = crew ? Object.keys(crew.speakers)[0] : null;
        const mate = isMate(p);
        return (
          <div
            key={p.id}
            ref={(el) => (el ? els.current.set(p.id, el) : els.current.delete(p.id))}
            className="presence-pilot"
            data-ally={mate || undefined}
            style={{ '--who': mate ? ALLY : colorOf(crew) }}
          >
            <svg className="presence-arrow" viewBox="0 0 16 16" width="16" height="16">
              <path d="M1.5 1.5l5 13 1.9-5.1 5.1-1.9z" />
            </svg>
            <span className="presence-tag">
              {who && <Face who={who} className="presence-face" />}
              <b>{p.name}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
