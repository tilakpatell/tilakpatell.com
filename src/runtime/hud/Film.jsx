import { useState } from 'react';
import { useInView, useReducedMotion } from '../../lib/hooks';
import { device } from '../../lib/device';
import { mayPlay } from '../../lib/bf2017/films';
import './film.css';

// One of the game's films (src/lib/bf2017/films.js's filmFor), muted, in a
// frame: its poster always, the film over it only while the frame is on
// screen (so nothing loads for a card scrolled away), never with reduced
// motion and never on a saver connection. With no film, `still` (the card's
// own picture) or nothing. `onEnd` when a film that doesn't loop is done (a
// briefing's next scene); `captions` shows its English lines.
export default function Film({ film, still = null, onEnd = null, captions = false, className = '', label = '', fit = 'cover', ...rest }) {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView({ rootMargin: '120px' });
  const [broken, setBroken] = useState(null);
  if (!film) return still;
  const play = seen && broken !== film.url && mayPlay({ reduced, saveData: Boolean(device().saveData) });
  return (
    <div ref={ref} className={`film ${className}`.trim()} data-fit={fit} data-playing={play || undefined} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'} {...rest}>
      <img className="film-poster" src={film.poster} alt="" loading="lazy" decoding="async" />
      {play && (
        <video
          key={film.url}
          className="film-video"
          src={film.url}
          poster={film.poster}
          muted
          autoPlay
          playsInline
          loop={film.loop}
          preload="metadata"
          crossOrigin="anonymous"
          onEnded={onEnd ?? undefined}
          onError={() => setBroken(film.url)}
        >
          {captions && film.captions && <track kind="captions" src={film.captions} srcLang="en" label="English" default />}
        </video>
      )}
    </div>
  );
}
