import { Link } from 'react-router-dom';
import { RiArrowRightLine } from 'react-icons/ri';
import { Waypoint } from '../ui';
import InterestDock from './InterestDock';
import MiniMap from '../universe/MiniMap';

// Off the clock: what I'm into, a dock of quick toys, and the way into the
// universe map, where each fandom is a planet with its card beside it.
export default function Interests() {
  return (
    <section data-theme-section="aws" className="relative z-10 py-14 md:py-20" aria-labelledby="interests-title">
      <div className="shell relative">
        <Waypoint top="0.9rem" />
        <h2 id="interests-title" className="title">
          Off the clock
        </h2>
        <p className="lead mt-4 max-w-[52ch]">Star Wars first. Then Indian classical music, Tolkien, Transformers, Marvel, games, The Office, Breaking Bad, Rick and Morty and a lot of travel. Most have a world of their own on this site, with something to play, all on one map.</p>
        <div className="mt-6">
          <InterestDock />
        </div>
        <div className="dark-scope universe-teaser mt-10">
          <MiniMap className="minimap-teaser" kind="fandom" linkTo={(id) => `/universe/${id}`} />
          <Link to="/universe" className="btn btn-primary group mt-4">
            Open the universe <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
