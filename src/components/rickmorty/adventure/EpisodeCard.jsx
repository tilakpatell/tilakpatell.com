import { useEffect } from 'react';
import './adventure.css';

// An episode's card, as it starts: its number, its title and its first line,
// on the page's glass in the middle of the stage (C-137's, or the Citadel's:
// ../citadel/citadel.css). It goes at the visitor's next key or tap (which
// still does its job), or after seven seconds; its page may close it sooner
// (the Citadel at a pad's first move).
const SHOWN_MS = 7000;

export default function EpisodeCard({ episode, n, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, SHOWN_MS);
    window.addEventListener('keydown', onDone);
    window.addEventListener('pointerdown', onDone);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onDone);
      window.removeEventListener('pointerdown', onDone);
    };
  }, [onDone]);
  const [who, text] = episode.intro[0];
  return (
    <div className="rm-episode" role="status">
      <p className="rm-episode-n">Episode {n}</p>
      <p className="rm-episode-title">{episode.title}</p>
      <p className="rm-episode-line">
        <b>{who}</b> {text}
      </p>
    </div>
  );
}
