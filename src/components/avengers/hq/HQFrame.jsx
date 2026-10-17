import './hq.css';
import '../../../styles/lazy/avengers.css';

// The frame each HQ game sits in: the 3D screen (the runtime's canvas goes
// in its first box, inside the screen's border: hq/useStage), or (with no graphics chip, 3D
// switched off, or a 3D view that failed) the building's old activity, plus
// the switch and a line saying why.

export default function HQFrame({ stage, three, fallback, children, label, screenProps = {}, className = '', accent }) {
  const failed = stage.status === 'failed' || stage.status === 'slow' || stage.status === 'lost';
  const showToy = !three.on || failed;
  return (
    <div ref={stage.wrap} className={`hq-game ${className}`} style={accent ? { '--hq-accent': accent } : undefined}>
      {showToy ? (
        fallback
      ) : (
        <div className="hq-screen" role="group" aria-label={label} tabIndex={0} {...screenProps}>
          <div ref={stage.host} className="hq-canvas" data-on={stage.status === 'on' || undefined} aria-hidden="true" />
          {stage.status !== 'on' && (
            <div className="hq-loading" aria-hidden="true">
              <span className="hq-loading-ring" />
            </div>
          )}
          {children}
        </div>
      )}
      <p className="hq-switch">
        {three.can ? (
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={three.on} onClick={() => three.set(three.on ? 'off' : 'on')}>
            3D game: {three.on ? 'on' : 'off'}
          </button>
        ) : (
          <span>This browser has no WebGL, so here is the simple version.</span>
        )}
        {three.can && !three.on && !three.auto && three.mode === 'auto' && <span>No graphics chip found, so this is the simple version. Turn 3D on to try the game anyway.</span>}
        {three.on && stage.status === 'loading' && <span>Loading the 3D game…</span>}
        {stage.status === 'slow' && <span>This device was struggling with 3D, so here is the simple version.</span>}
        {stage.status === 'lost' && <span>The graphics chip reset, so here is the simple version.</span>}
        {stage.status === 'failed' && <span>3D couldn’t start here, so here is the simple version.</span>}
        {failed && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={stage.retry}>
            Try 3D again
          </button>
        )}
      </p>
    </div>
  );
}
