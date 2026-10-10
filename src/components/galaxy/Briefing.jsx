import { useState } from 'react';
import { RiCloseLine, RiSkipForwardLine } from 'react-icons/ri';
import { Film } from '../../runtime/hud';
import { briefingFor } from '../../lib/bf2017/films';

// A world's briefing from the 2017 game's campaign: its cinematics set on
// this world (src/lib/bf2017/films.js's briefingFor), one after the other,
// muted with the game's English lines as captions. Skip goes to the next
// scene; Close puts it away and the mission's own text is what's left. A
// world the campaign never went to has none, and this draws nothing.
export default function Briefing({ system, name }) {
  const films = briefingFor(system);
  const [at, setAt] = useState(0);
  const [shut, setShut] = useState(false);
  if (!films.length || shut) return null;
  const film = films[at];
  const next = () => (at + 1 < films.length ? setAt(at + 1) : setShut(true));
  return (
    <section className="mission-card mission-briefing" aria-label={`The briefing: ${name}, from Star Wars Battlefront II’s campaign`}>
      <div className="mission-briefing-head">
        <h2 className="mission-h">The briefing</h2>
        <p className="mission-briefing-count">
          Scene {at + 1} of {films.length}
        </p>
      </div>
      <Film key={film.slug} film={film} captions fit="contain" className="mission-briefing-film" onEnd={next} label={`${name}: a cinematic from the game’s campaign, scene ${at + 1}`} />
      <div className="mission-briefing-actions">
        <button type="button" className="btn btn-ghost" onClick={next}>
          <RiSkipForwardLine className="h-4 w-4" aria-hidden="true" /> {at + 1 < films.length ? 'Skip to the next scene' : 'Skip'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setShut(true)}>
          <RiCloseLine className="h-4 w-4" aria-hidden="true" /> Close the briefing
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">From Star Wars Battlefront II (2017), EA DICE’s, used with permission. Muted, with the game’s own lines as captions.</p>
    </section>
  );
}
