import { useEffect } from 'react';
import { STORY_DONE, passesCard } from './hud';
import './adventure.css';

// An episode's card, as it starts: its number, its title and its first line,
// on the page's glass in the middle of the stage (C-137's, or the Citadel's:
// ../citadel/citadel.css). It goes at the visitor's next key or tap (which
// still does its job; a key held from before it showed is no press:
// ./hud.js's passesCard), or after seven seconds; its page may close it sooner
// (the Citadel at a pad's first move). With no episode, the story's end: the
// card after the last episode's (./hud.js's newsOf), with Rick's last line
// said over it.
const SHOWN_MS = 7000;

export default function EpisodeCard({ episode, n, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, SHOWN_MS);
    const pass = (e) => passesCard(e) && onDone();
    window.addEventListener('keydown', pass);
    window.addEventListener('pointerdown', pass);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', pass);
      window.removeEventListener('pointerdown', pass);
    };
  }, [onDone]);
  if (!episode)
    return (
      <div className="rm-episode" data-end="" role="status">
        <p className="rm-episode-n">Thirteen episodes</p>
        <p className="rm-episode-title">The end</p>
        <p className="rm-episode-line">{STORY_DONE}</p>
      </div>
    );
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
