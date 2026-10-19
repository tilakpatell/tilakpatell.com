import { RiFullscreenExitLine, RiFullscreenLine, RiPauseLine } from 'react-icons/ri';
import { PlayersChip } from '../../../runtime/hud';
import { CHAPTERS } from './rules';

const SAILS = ['Furled', 'Half sail', 'Full sail'];
// how the others show on this sea, as the players chip's tooltips
const LORE = {
  off: 'Go online, and see everyone else sailing this sea as a ghost ship from another world',
  on: 'Everyone else online sailing this sea shows as a ghost ship from another world: nothing passes between you but where each of you is',
};

// Dead man's tide's HUD over the sea: the purse, the chapter or the boss, the
// callout, the chart, the deck (guns and hull), the thumbs on touch and the
// tools. Its moving numbers are written by the game's frame loop straight
// into the elements it hands over in `hud` (and `chart`), not through React.
export default function TideHud({ hud, chart, ui, callout, phase, touch, picking, trav, full, onPause, onFull, hold, trim }) {
  const running = phase === 'running';
  const chapter = CHAPTERS[ui.chapter];
  return (
    <>
      <div className="g3-hud dt-hud" hidden={!running && phase !== 'paused'}>
        <div className="dt-top">
          <div className="dt-purse">
            <span className="dt-coin" aria-hidden="true" />
            <span className="dt-gold" ref={(n) => (hud.current.gold = n)}>
              0
            </span>
            <span className="dt-combo" ref={(n) => (hud.current.combo = n)} />
          </div>
          <div className="dt-goal">
            {ui.boss ? (
              <div className="dt-boss">
                <span>{ui.boss}</span>
                <div className="g3-meter" style={{ '--meter': '#c8362b' }}>
                  <i ref={(n) => (hud.current.bossBar = n)} />
                </div>
              </div>
            ) : (
              <div className="dt-chapter">
                <small>
                  Chapter {ui.chapter + 1} of {CHAPTERS.length} · {chapter.name}
                </small>
                <span>
                  {chapter.goal}
                  {ui.done ? ` · ${ui.done[0]} of ${ui.done[1]}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {callout && (
          <div key={callout.id} className="g3-callout dt-callout" data-tone={callout.tone} role="status">
            {callout.text}
          </div>
        )}

        <canvas ref={chart} className="dt-chart" width="264" height="264" aria-hidden="true" />

        <div className="dt-deck">
          <div className="dt-guns" ref={(n) => (hud.current.portBox = n)}>
            <span>
              <kbd>Q</kbd> Port
            </span>
            <div className="dt-load">
              <i ref={(n) => (hud.current.port = n)} />
            </div>
          </div>
          <div className="dt-hull">
            <div className="dt-hull-bar">
              <i ref={(n) => (hud.current.hull = n)} />
            </div>
            <div className="dt-hull-row">
              <span>Hull</span>
              <b ref={(n) => (hud.current.hullN = n)} />
              <span className="dt-sail" aria-label={SAILS[ui.sail]}>
                {[0, 1].map((i) => (
                  <i key={i} data-on={ui.sail > i || undefined} />
                ))}
                {SAILS[ui.sail]}
              </span>
              <span ref={(n) => (hud.current.knots = n)} />
            </div>
          </div>
          <div className="dt-guns dt-guns-star" ref={(n) => (hud.current.starBox = n)}>
            <span>
              Starboard <kbd>E</kbd>
            </span>
            <div className="dt-load">
              <i ref={(n) => (hud.current.star = n)} />
            </div>
          </div>
        </div>
      </div>

      {touch && running && !picking && (
        <>
          <div ref={(n) => (hud.current.stick = n)} className="dt-stick" hidden>
            <i ref={(n) => (hud.current.knob = n)} />
          </div>
          <div className="g3-touch dt-touch-sail">
            <button type="button" className="g3-touch-btn" onClick={trim(1)} aria-label="More sail">
              ▲
            </button>
            <button type="button" className="g3-touch-btn" onClick={trim(-1)} aria-label="Less sail">
              ▼
            </button>
          </div>
          <div className="g3-touch dt-touch-fire">
            <button type="button" className="g3-touch-btn dt-fire" onPointerDown={hold('port', true)} onPointerUp={hold('port', false)} onPointerCancel={hold('port', false)} onPointerLeave={hold('port', false)} aria-label="Fire the port guns">
              ◀ Port
            </button>
            <button type="button" className="g3-touch-btn dt-fire" onPointerDown={hold('star', true)} onPointerUp={hold('star', false)} onPointerCancel={hold('star', false)} onPointerLeave={hold('star', false)} aria-label="Fire the starboard guns">
              Star ▶
            </button>
          </div>
        </>
      )}

      <div className="g3-tools">
        <PlayersChip className="dt-players" count={trav.count} allies={trav.allies} on={trav.on} onJoin={trav.join} available={trav.available} lore={LORE} />
        {running && (
          <button type="button" className="g3-tool" onClick={onPause} aria-label="Pause">
            <RiPauseLine aria-hidden="true" />
          </button>
        )}
        <button type="button" className="g3-tool" onClick={onFull} aria-label={full ? 'Leave full screen' : 'Full screen'}>
          {full ? <RiFullscreenExitLine aria-hidden="true" /> : <RiFullscreenLine aria-hidden="true" />}
        </button>
      </div>
    </>
  );
}
