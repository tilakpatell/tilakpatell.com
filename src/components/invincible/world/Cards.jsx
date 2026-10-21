import { PLACES } from './map';

// Without 3D: the places, as cards (InvWorld.jsx shows this in the
// world's place when the graphics chip is off, missing or lost).
export default function Cards({ three, gl, retry }) {
  return (
    <div className="iw-cards shell">
      <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
      <h2 id="iw-title" className="iw-title">
        Fly, Mark.
      </h2>
      <p className="iw-cards-lead">{gl === 'lost' ? 'The graphics chip let go of the city.' : three.can ? 'The city is 3D, and 3D is off.' : 'The city is 3D, and this browser has no 3D.'} Here’s what’s down there.</p>
      <ul className="iw-cards-list">
        {PLACES.map((p) => (
          <li key={p.id}>
            <b>{p.name}</b>
            <span>{p.line}</span>
          </li>
        ))}
      </ul>
      {(gl === 'lost' || (three.can && !three.on)) && (
        <button type="button" className="btn btn-primary mt-6" onClick={gl === 'lost' ? retry : () => three.set('on')}>
          {gl === 'lost' ? 'Try again' : 'Turn 3D on'}
        </button>
      )}
    </div>
  );
}

