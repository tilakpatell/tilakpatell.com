import { Link } from 'react-router-dom';
import { useView } from '../../ViewSwitch';
import { openPalette, shortcutLabel } from '../../../lib/palette';
import { restartSite } from '../../../lib/restart';
import { WORDS } from '../../../lib/words';
import ModelCredits from '../../ModelCredits';
import { byId } from '../universes';

// The flight menu's Site tab: the site's pages, which the nav bar has
// everywhere else (it's put away while a ship flies), the résumé, the
// classic site, search, the credits, and starting over. `where` names the
// map for its models' credits (ModelCredits).

// (each station's own second line where it has one: universes.js's signs)
const sign = (id) => byId(id)?.sign?.[1] ?? null;
const PAGES = [
  ['/home', 'Home', sign('home')],
  ['/experience', 'Experience', sign('experience')],
  ['/projects', 'Projects', sign('projects')],
  ['/travel', 'Travel', null],
  ['/contact', 'Contact', sign('contact')],
  ['/music', 'Music', null],
  ['/terminal', 'Terminal', sign('terminal')],
];

export default function SiteTab({ where = 'universe', onLeave }) {
  const { switchTo } = useView();
  const leave = (fn) => () => {
    onLeave?.();
    fn();
  };
  return (
    <div className="fm-site">
      <nav className="fm-pages" aria-label="The site’s pages">
        {PAGES.map(([to, label, line]) => (
          <Link key={to} to={to} className="fm-page" onClick={() => onLeave?.()}>
            <b className="fm-title">{label}</b>
            {line && <span className="fm-muted">{line}</span>}
          </Link>
        ))}
      </nav>
      <div className="fm-site-row">
        <Link to="/resume" className="fm-btn fm-primary" onClick={() => onLeave?.()}>
          Résumé{sign('resume') ? <span className="fm-muted"> · {sign('resume')}</span> : null}
        </Link>
        <button type="button" className="fm-btn" onClick={leave(() => switchTo('classic'))}>
          {WORDS.classicSite}
        </button>
        <button type="button" className="fm-btn" onClick={leave(openPalette)}>
          <kbd className="hud-cap">{shortcutLabel()}</kbd> Search
        </button>
        <button type="button" className="fm-btn" onClick={leave(restartSite)} title="The welcome, the crawl and the cockpit again">
          {WORDS.startOver}
        </button>
      </div>
      <details className="fm-credits">
        <summary>Credits</summary>
        <ModelCredits where={where} className="fm-text" />
      </details>
    </div>
  );
}
