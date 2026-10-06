import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiFileTextLine, RiGithubFill, RiLinkedinBoxFill, RiMailLine, RiRocket2Line } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import Portrait from '../components/Portrait';
import CareerStrip from '../components/CareerStrip';
import ProjectCard from '../components/ProjectCard';
import { Chips, Reveal, SectionHeading, Waypoint } from '../components/ui';
import { education, focusAreas, profile, skills } from '../data/profile';
import { roles, fmtMonth } from '../data/roles';
import { featuredProjects, projectById } from '../data/projects';
import { ClaudeFeature, GameBoyFeature } from '../stages';
import { ClaudeSpark } from '../stages/ClaudeSpark';
import ProjectThumb from '../components/ProjectThumb';
import { useDocumentTitle } from '../lib/hooks';
import { useSectionThemes, useTheme } from '../theme/ThemeProvider';
import { ThemeBackdrop } from '../components/worlds/Backdrops';
import { useFun } from '../fun/FunProvider';
import PhotoBand from '../components/travel/PhotoBand';
import FindMeOnline from '../components/online/FindMeOnline';
import Egg from '../components/Egg';
import ProgramManagement from '../components/ProgramManagement';
import '../styles/lazy/home.css';

// The globe and the interests row sit at the bottom of the page and bring the
// most with them (the globe's WebGL check, the universe map's mini map and its
// styles), so they load as they're scrolled near, not with the page.
const PlacesExplorer = lazy(() => import('../components/travel/PlacesExplorer'));
const Interests = lazy(() => import('../components/interests/Interests'));
const narrow = () => typeof window !== 'undefined' && window.innerWidth < 768;

const LABELS = { gameboy: 'Game Boy emulator' };
const label = (id) => LABELS[id] ?? roles.find((r) => r.id === id)?.short ?? id;

// Breaking Bad's title card, with my name: Ti (titanium) and Pa (protactinium) are real.
function Element({ symbol, number, weight }) {
  return (
    <span className="element element-in">
      <sup aria-hidden="true">{number}</sup>
      <span className="element-sym">{symbol}</span>
      <sub aria-hidden="true">{weight}</sub>
    </span>
  );
}

// Mounts children only when the placeholder gets near the viewport.
function LazyMount({ children, minHeight }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={on ? undefined : { minHeight }}>
      {on && children}
    </div>
  );
}

// The two bits of the hero that follow the theme and the Heisenberg egg, in
// components of their own: the theme changes every few hundred pixels as you
// scroll this page, and only these should redraw when it does, not the page.
function HeroBackdrop() {
  const { active } = useTheme();
  return <ThemeBackdrop theme={active} className="hero-backdrop" />;
}
function HeroName() {
  const { heisenberg } = useFun();
  return heisenberg ? (
    <>
      <Element symbol="Ti" number={22} weight="47.867" />
      lak
      <br />
      <Element symbol="Pa" number={91} weight="231.04" />
      tel
    </>
  ) : (
    <>
      Tilak
      <br />
      Patel
    </>
  );
}

export default function Home() {
  useDocumentTitle(null);
  const page = useRef(null);
  useSectionThemes(page);

  // Load the two live demos while the browser is idle, so they don't stall a scroll later.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const id = idle(() => {
      import('../stages/GameBoyStage');
      import('../stages/ClaudeStage');
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);
  const gameboy = projectById('gameboy-emulator');
  const translator = projectById('swaminarayan-translator');
  const others = featuredProjects.filter((p) => p.id !== gameboy.id && p.id !== translator.id);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />

      {/* Hero */}
      <section data-theme-section="aws" className="shell relative z-10 pb-16 pt-[calc(var(--nav-h)+40px)] md:pb-24 md:pt-[calc(var(--nav-h)+72px)]">
        <div className="hero-wash pointer-events-none" aria-hidden="true" />
        {/* Middle-earth or Cybertron on the horizon, when their themes are on */}
        <HeroBackdrop />
        <div className="relative grid items-end gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-center lg:gap-16">
          <div className="relative">
            <Waypoint top="0.6rem" />
            <Reveal>
              <p className="eyebrow">Technical Infrastructure PM Intern at AWS</p>
            </Reveal>
            <Reveal delay={60}>
              <PageTitle className="display mt-6 text-[clamp(3.6rem,1.2rem+9vw,8.4rem)]">
                <HeroName />
              </PageTitle>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead mt-8 max-w-[36rem] !text-[clamp(1.125rem,1rem+0.45vw,1.3rem)] text-ink">
                I plan technical programs and build the software behind them: capacity planning at AWS, a modernization roadmap at RTX, and engineering at Bose, Pendar, Empowerreg and SRC.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <p className="open-to mt-6">
                <span className="open-dot" aria-hidden="true" />
                <span>
                  Open to <strong>technical program manager</strong> and <strong>software engineer</strong> roles. Graduating May 2027.
                </span>
              </p>
            </Reveal>
            <Reveal delay={180} className="mt-9 flex flex-wrap gap-3">
              <Link to="/experience" className="btn btn-primary btn-lg group">
                View experience <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link to="/resume" className="btn btn-ghost btn-lg">
                <RiFileTextLine className="h-4 w-4" aria-hidden="true" /> Résumé
              </Link>
            </Reveal>
            {/* the other way round the site, for anyone who came straight here */}
            <Reveal delay={220} className="mt-5">
              <Link to="/universe/home" className="hero-universe group">
                <RiRocket2Line className="h-4 w-4 flex-none" aria-hidden="true" />
                <span>
                  Or fly through it: the whole site as a <span className="hero-universe-em">universe</span>
                </span>
                <RiArrowRightLine className="h-4 w-4 flex-none transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={90} className="w-full max-w-[340px] lg:ml-auto lg:max-w-[380px]">
            <Portrait />
          </Reveal>
        </div>
      </section>

      {/* Career route */}
      <section data-theme-section="aws" className="shell relative z-10 pb-6 md:pb-0" aria-label="Experience, newest first">
        <CareerStrip />
        {/* The route line turns back across the page here, in clear space below the strip */}
        <div className="relative hidden h-20 lg:block" aria-hidden="true">
          <Waypoint top="5rem" data-node="false" />
        </div>
      </section>

      <ProgramManagement />

      {/* Featured: the Game Boy */}
      <section data-theme-section="gameboy" className="shell relative z-10 py-14 md:py-20" aria-labelledby="gb-title">
        <Egg id="oneup" className="egg-corner" />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
          <div className="relative">
            <Waypoint top="0.9rem" />
            <h2 id="gb-title" className="display text-[clamp(2.4rem,1.4rem+3.6vw,4.4rem)]">
              {gameboy.title}
            </h2>
            <p className="lead mt-6 max-w-xl">{gameboy.summary}</p>
            <p className="mt-4 max-w-xl leading-relaxed text-body">
              The handheld on the right runs Super Tilak Land, a four-world platformer I wrote for this site, plus Block Drop and Snake. Press Start.
            </p>
            <Chips items={gameboy.stack} className="mt-7" />
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/projects/gameboy-emulator" className="btn btn-primary group">
                How it works <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <a href="https://github.com/tilakpatell/gameboy-emulator" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <RiGithubFill className="h-4 w-4" aria-hidden="true" /> Source
              </a>
            </div>
          </div>
          <LazyMount minHeight={520}>
            <Suspense fallback={<div style={{ minHeight: 520 }} />}>
              <GameBoyFeature compact />
            </Suspense>
          </LazyMount>
        </div>
      </section>

      {/* Featured: the translator, with Claude */}
      <section data-theme-section="claude" className="relative z-10 py-14 md:py-20" aria-labelledby="tr-title">
        <div className="feature-band" aria-hidden="true" />
        <div className="shell relative">
          <div className="relative">
            <Waypoint top="0.45rem" />
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div className="relative order-1 [container-type:inline-size] lg:order-2">
              <p className="eyebrow flex items-center gap-2">
                <ClaudeSpark className="h-4 w-4" /> Built with Claude
              </p>
              <h2 id="tr-title" className="display mt-5 text-[clamp(2rem,10cqi,3.8rem)]">
                {translator.title}
              </h2>
              <p className="lead mt-6 max-w-xl">
                Turns scanned Gujarati, Hindi and Sanskrit books into English editions typeset like a published volume.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-body">
                OCR, layout analysis and page-by-page translation with Claude, checked in a facing-page review workbench.
              </p>
              <Chips items={translator.stack.slice(0, 6)} className="mt-7" />
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/projects/swaminarayan-translator" className="btn btn-primary group">
                  See it translate <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="order-2 lg:order-1">
              <LazyMount minHeight={420}>
                <Suspense fallback={<div style={{ minHeight: 420 }} />}>
                  <ClaudeFeature />
                </Suspense>
              </LazyMount>
            </div>
          </div>
        </div>
      </section>

      {/* More work: a bento of the rest of the featured work */}
      <section data-theme-section="devspace" className="shell relative z-10 py-14 md:py-20" aria-labelledby="work-title">
        <SectionHeading title="A winning hackathon build, open source and systems code." id="work-title">
          Every project page has a live demo of how it works.
        </SectionHeading>
        <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:grid-rows-[auto_auto]">
          {others[0] && (
            <Reveal className="md:row-span-2">
              <ProjectCard project={others[0]} large />
            </Reveal>
          )}
          {others.slice(1).map((p, i) => (
            <Reveal key={p.id} delay={(i + 1) * 60}>
              <ProjectCard project={p} thumb="aspect-[16/6]" />
            </Reveal>
          ))}
          <Reveal delay={others.length * 60}>
            <Link to="/projects" className="card card-tint group flex h-full flex-col p-5 sm:p-6">
              <div className="grid grid-cols-4 gap-2">
                {['tree', 'shell', 'api', 'summarizer'].map((st) => (
                  <ProjectThumb key={st} stage={st} className="aspect-square" />
                ))}
              </div>
              <h3 className="stretch-semi mt-5 text-xl font-semibold text-ink">File systems, shells, APIs and ML</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">Coursework and earlier builds, each with its own demo.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-ink">
                All projects <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Focus: a pinned heading beside the three areas */}
      <section data-theme-section="aws" className="shell relative z-10 py-14 md:py-20" aria-labelledby="focus-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-[calc(var(--nav-h)+40px)] lg:self-start">
            <SectionHeading title="Close to the infrastructure, the data and the hardware." id="focus-title" />
          </div>
          <ol className="grid">
            {focusAreas.map((f, i) => (
              <Reveal as="li" key={f.id} delay={i * 60} className="border-t border-line py-8 first:border-t-0 first:pt-0 lg:first:pt-1">
                <h3 className="stretch-semi text-2xl font-semibold text-ink">{f.title}</h3>
                <p className="mt-3 max-w-[60ch] leading-relaxed text-body">{f.body}</p>
                <p className="mono mt-4 text-xs text-muted">{f.where.map(label).join(', ')}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Toolkit, then education */}
      <section data-theme-section="aws" className="shell relative z-10 py-14 md:py-20" aria-labelledby="toolkit-title">
        <SectionHeading title="What I build with." id="toolkit-title" />
        <dl className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {skills.map((g, i) => (
            <Reveal key={g.id} delay={i * 60} className="border-t-2 pt-5" style={{ borderColor: 'var(--accent)' }}>
              <dt className="stretch-semi text-lg font-semibold text-ink">{g.label}</dt>
              <dd className="mt-4">
                <Chips items={g.items} />
              </dd>
            </Reveal>
          ))}
        </dl>
        <Reveal className="panel mt-12 grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
          <div>
            <img src="/logos/northeastern.svg" width="247" height="79" alt="" className="nu-logo nu-logo-light mb-5 h-12 w-auto" loading="lazy" decoding="async" />
            <img src="/logos/northeastern-white.svg" width="247" height="79" alt="" className="nu-logo nu-logo-dark mb-5 h-12 w-auto" loading="lazy" decoding="async" />
            <h3 className="stretch-semi text-2xl font-semibold text-ink">{education.school}</h3>
            <p className="mt-2 text-body">
              {education.degree}, graduating {fmtMonth(education.graduation)}
            </p>
            <p className="mono mt-1 text-sm text-muted">GPA {education.gpa}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Coursework</p>
            <Chips items={education.coursework} className="mt-3" />
          </div>
        </Reveal>
      </section>

      <FindMeOnline />

      {/* Closing */}
      <section data-theme-section="aws" className="shell relative z-10 pb-24 pt-14 md:pb-32 md:pt-24" aria-labelledby="closing-title">
        <div className="relative">
          <Waypoint top="0.9rem" />
          <h2 id="closing-title" className="display max-w-4xl text-[clamp(2.3rem,1.3rem+3.8vw,4.8rem)]">
            Hiring a TPM or a software engineer?
          </h2>
          <p className="lead mt-6 max-w-2xl">I graduate in May 2027 and I’m looking for technical program management and software engineering roles. Email is fastest.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a className="btn btn-primary btn-lg" href={`mailto:${profile.email}`}>
              <RiMailLine className="h-4 w-4" aria-hidden="true" /> Email me
            </a>
            <a className="btn btn-ghost btn-lg" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer">
              <RiLinkedinBoxFill className="h-4 w-4" aria-hidden="true" /> LinkedIn
            </a>
          </div>
          <figure className="mt-16 max-w-md">
            <blockquote className="mono text-sm text-muted">“Do. Or do not. There is no try.”</blockquote>
            <figcaption className="mono mt-1 text-xs text-muted">Yoda</figcaption>
          </figure>
        </div>
      </section>

      {/* Travel: the globe, then a misty way into the travel page */}
      <section data-theme-section="travel" className="relative z-10 pt-14 md:pt-20" aria-labelledby="travel-title">
        <div className="shell relative">
          <div className="relative">
            <Waypoint top="0.9rem" />
          </div>
        </div>
        <LazyMount minHeight={narrow() ? 1170 : 700}>
          <Suspense fallback={<div style={{ minHeight: narrow() ? 1170 : 700 }} />}>
            <PlacesExplorer />
          </Suspense>
        </LazyMount>
        <PhotoBand id="band" className="travel-teaser mt-16 md:mt-24">
          <div className="shell relative py-24">
            <h3 className="display max-w-2xl text-[clamp(2.1rem,1.2rem+3vw,3.8rem)] !text-white">Mountains, lakes and a little heritage.</h3>
            <p className="mt-5 max-w-md leading-relaxed text-white/90">Postcards from every place, home base in Syracuse, and the carved stone of Akshardham.</p>
            <Link to="/travel" className="btn btn-primary btn-lg group mt-8">
              See the travel page <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </PhotoBand>
      </section>

      <LazyMount minHeight={narrow() ? 780 : 1160}>
        <Suspense fallback={<div style={{ minHeight: narrow() ? 780 : 1160 }} />}>
          <Interests />
        </Suspense>
      </LazyMount>
    </div>
  );
}
