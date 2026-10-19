import { ROOMS } from './rules';

// Ricochet's room picker and its stars, for the 3D game's menu and the 2D
// view's: a room once the one before it is cleared.
export default function Rooms({ save, onPick }) {
  const totalStars = save.stars.reduce((a, b) => a + (b || 0), 0);
  return (
    <>
      <div className="cap-rooms" role="group" aria-label="Rooms">
        {ROOMS.map((r, i) => (
          <button key={r.name} type="button" className="cap-room-btn" disabled={i >= save.reached} onClick={() => onPick(i)} aria-label={`Room ${i + 1}, ${r.name}${save.stars[i] ? `, ${save.stars[i]} stars` : ''}`}>
            <span>{i + 1}</span>
            <small>{save.stars[i] ? '★'.repeat(save.stars[i]) : i < save.reached ? r.name : '—'}</small>
          </button>
        ))}
      </div>
      <p className="hq-overlay-best">
        {totalStars} of {ROOMS.length * 3} stars
      </p>
    </>
  );
}
