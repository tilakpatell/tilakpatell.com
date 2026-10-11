import { memo } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowGoBackLine, RiRocket2Fill } from 'react-icons/ri';
import WarCard, { SystemWar } from './WarCard';
import { jumpTime, viaLanes } from './routes';
import { FILMS, eraById, eraOf, gridAt, jumpSeconds, lightYears } from './systems';

// The galaxy map's side panel (HoloMap.jsx): with a system picked, its name, the jump first, how far and how long and the route, then
// the rest folded (era, films, mission, its place in the war, who's online there); with none, where you are and the war's own card.
// A memo: a pan or a zoom of the map, which changes none of what it shows, doesn't draw it again.
const HoloSide = memo(function HoloSide({ picked, here, route, war, pickedWar, view, now, oath, viewOath, pilots, wide, seen, suggested, record, current, jumpBtn, onJump, onClose, onLeave, onSwear, onTheatre, onPick, onBack }) {
  const away = picked && picked.id !== current;
  return (
    <aside className="holomap-side">
      {picked ? (
        <>
          <div aria-live="polite">
            <p className="holomap-kicker">{away ? 'Course plotted' : 'You are here'}</p>
            <h3 className="holomap-sys" style={{ color: picked.accent }}>
              {picked.name}
            </h3>
          </div>
          <p className="holomap-meta">
            {picked.region} · Grid {picked.grid ?? gridAt(picked.pos)}
          </p>
          {/* the jump leads (a course away from here), then how far and how long; the rest folds (open on a wide screen) */}
          {away ? (
            <button ref={jumpBtn} type="button" className="btn btn-primary holomap-jump" onClick={() => onJump(picked.id)}>
              <RiRocket2Fill className="h-4 w-4" aria-hidden="true" /> Jump to lightspeed <kbd className="hud-cap ml-2 [@media(hover:none)]:hidden">J</kbd>
            </button>
          ) : (
            <button ref={jumpBtn} type="button" className="btn btn-primary holomap-jump" onClick={onBack}>
              Back to the war
            </button>
          )}
          {away && (
            <dl className="holomap-stats">
              <div>
                <dt>Distance</dt>
                <dd>{lightYears(here, picked).toLocaleString('en-US')} light-years</dd>
              </div>
              <div>
                <dt>In hyperspace</dt>
                <dd>{(route ? jumpTime(route) : jumpSeconds(here, picked)).toFixed(1)} s (the navicomputer’s fast)</dd>
              </div>
              {route && (
                <div>
                  <dt>Route</dt>
                  <dd>{viaLanes(route)}</dd>
                </div>
              )}
            </dl>
          )}
          <details className="holomap-more" open={wide}>
            <summary>More about {picked.name}</summary>
            <p className="holomap-meta">
              {eraById(eraOf(picked)).name} · {picked.films.map((f) => FILMS[f].episode ?? FILMS[f].title).join(', ')}
            </p>
            <dl className="holomap-stats">
              <div>
                <dt>There now</dt>
                <dd>{picked.moment.title}</dd>
              </div>
              <div>
                <dt>Mission</dt>
                <dd>
                  {picked.game.title} {picked.game.status === 'live' ? '(play now)' : '(coming soon)'}
                </dd>
              </div>
              <SystemWar row={pickedWar} war={view} now={now} side={viewOath.side} yours={view === oath.war} />
              {pilots[picked.id] > 0 && (
                <div>
                  <dt>Online</dt>
                  <dd>
                    {pilots[picked.id]} {pilots[picked.id] === 1 ? 'pilot' : 'pilots'} there now
                  </dd>
                </div>
              )}
            </dl>
            <Link to={`/galaxy/${picked.id}/mission`} className="btn btn-ghost mt-2 w-full justify-center">
              Read its mission briefing
            </Link>
          </details>
        </>
      ) : (
        <>
          <p className="holomap-kicker">You are here</p>
          <h3 className="holomap-sys" style={{ color: here.accent }}>
            {here.name}
          </h3>
          <p className="holomap-meta">
            {here.region} · Grid {here.grid ?? gridAt(here.pos)}
          </p>
          {/* the war's own card: the oath, the major order, the battles on now, the areas */}
          <WarCard table={war} now={now} oath={oath} viewOath={viewOath} suggested={suggested} record={record} seen={seen[view] ?? null} onSwear={onSwear} onTheatre={onTheatre} onPick={onPick} onGo={(id) => (id === current ? onClose() : onJump(id))} current={current} />
        </>
      )}
      <button type="button" className="universe-back mt-5" onClick={onLeave}>
        <RiArrowGoBackLine className="mr-1 inline h-4 w-4" aria-hidden="true" /> Leave the galaxy, back to the universe
      </button>
    </aside>
  );
});

export default HoloSide;
