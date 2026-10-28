import './engine.css';

// The question before Hoth on bf2-web's engine (engine.js): what it is, what a first visit downloads, and the
// visitor's answer, which the page keeps on this device. Black behind it: nothing has started loading.
export default function EngineChoice({ mb, onEngine, onSite }) {
  const gb = mb ? (mb / 1000).toFixed(1) : null;
  return (
    <div className="bf-engine-choice" role="dialog" aria-modal="true" aria-labelledby="bf-engine-title">
      <h2 id="bf-engine-title" className="dialog-title">Hoth on the original engine</h2>
      <p>
        The game’s own engine, compiled for the web and drawn by your graphics card, with the game’s front end, light and bots.
        {gb ? ` A first visit downloads about ${gb} GB.` : ''}
      </p>
      <div className="bf-engine-actions">
        {/* (the one action this card is for: focus starts on it) */}
        <button type="button" className="btn" onClick={onEngine} autoFocus>
          Play on the original engine
        </button>
        <button type="button" className="btn" onClick={onSite}>
          Play the site’s Hoth
        </button>
      </div>
    </div>
  );
}
