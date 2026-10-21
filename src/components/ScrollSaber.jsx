import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';

// Scroll progress along the bottom of the screen, in the active theme's own
// form: a lightsaber for the house and company themes, Sting for Middle-earth,
// a paper airplane for Dunder Mifflin, an energon gauge for the Transformers,
// the Infinity Stones for Stark, a test tube for Heisenberg, a sitar string for
// the raga, pixels for the arcade, a spyglass for the Caribbean and the portal
// gun for Rick and Morty (styles/feel.css).
//
// Where the browser can tie an animation to the scroll position (Chrome, Edge,
// Safari 26), the bar is drawn by the browser itself, in step with the page:
// no script runs as you scroll. Elsewhere a scroll listener sets one transform
// (and a few attributes) a frame.
const SCROLL_DRIVEN = typeof CSS !== 'undefined' && Boolean(CSS.supports?.('animation-timeline', 'scroll()'));
const KIND = {
  shire: 'sting',
  mordor: 'sting',
  dunder: 'plane',
  optimus: 'energon',
  megatron: 'energon',
  bumblebee: 'energon',
  shockwave: 'energon',
  soundwave: 'energon',
  stark: 'stones',
  heisenberg: 'tube',
  raga: 'string',
  arcade: 'pixels',
  gameboy: 'pixels',
  tortuga: 'spyglass',
  pearl: 'spyglass',
  dutchman: 'spyglass',
  portal: 'portalgun',
  morty: 'portalgun',
  summer: 'portalgun',
  beth: 'portalgun',
};

export default function ScrollSaber() {
  const { pathname } = useLocation();
  const { active } = useTheme();
  const kind = KIND[active] ?? 'saber';
  const blade = useRef(null);
  const tip = useRef(null);
  const wrap = useRef(null);
  const stones = useRef([]);

  useEffect(() => {
    let frame = 0;
    let max = 1;
    const measure = () => {
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (wrap.current) wrap.current.style.opacity = max > 40 ? '1' : '0';
    };
    const draw = () => {
      frame = 0;
      let p = Math.min(1, window.scrollY / max);
      if (kind === 'pixels') p = Math.round(p * 40) / 40;
      if (blade.current) blade.current.style.transform = `scaleX(${p})`;
      if (tip.current) {
        const run = Math.max(0, (wrap.current?.clientWidth ?? window.innerWidth) - 54);
        tip.current.style.transform = `translateX(${44 + p * run}px)`;
      }
      stones.current.forEach((el, i) => el && (el.dataset.lit = p >= (i + 1) / 7 ? 'true' : 'false'));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    if (SCROLL_DRIVEN) {
      // the browser draws the bar; only whether there's anything to scroll is ours
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
      ro?.observe(document.body);
      window.addEventListener('resize', measure);
      return () => {
        ro?.disconnect();
        window.removeEventListener('resize', measure);
      };
    }
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname, kind]);

  return (
    <div ref={wrap} className="saber-progress" data-kind={kind} aria-hidden="true">
      <span className="hilt" />
      <span ref={blade} className="blade" />
      {kind === 'plane' && (
        <span ref={tip} className="progress-tip">
          <svg viewBox="-14 -8 28 16" width="24" height="14">
            <path d="M13 0 L-12 -7 L-7 0 Z" fill="#ffffff" stroke="#8a96a8" strokeWidth="0.8" />
            <path d="M13 0 L-12 6 L-7 0 Z" fill="#e3e9f2" stroke="#8a96a8" strokeWidth="0.8" />
            <path d="M-4 -4.5 L4 -2.5" stroke="#1f4e8c" strokeWidth="1.4" />
          </svg>
        </span>
      )}
      {kind === 'spyglass' && <span ref={tip} className="progress-tip progress-lens" />}
      {kind === 'portalgun' && (
        <span ref={tip} className="progress-tip progress-portal">
          <i />
        </span>
      )}
      {kind === 'stones' &&
        ['#1f6fff', '#ffc400', '#e3001b', '#8e2de2', '#00c853', '#ff8a00'].map((c, i) => (
          <span
            key={c}
            ref={(el) => (stones.current[i] = el)}
            className="progress-stone"
            style={{ '--stone': c, left: `calc(44px + (100% - 54px) * ${(i + 1) / 7})`, animationRange: `${((i + 1) / 7) * 100}% ${((i + 1) / 7) * 100 + 0.6}%` }}
          />
        ))}
    </div>
  );
}
