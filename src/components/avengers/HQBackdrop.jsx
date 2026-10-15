import '../../styles/lazy/avengers.css';
// The Avengers HQ page at night: a dark sky with the light of the compound
// coming up from below, Stark's HUD grid faint over it, a few stars, and the
// Avengers' A. All CSS and SVG, painted once (styles/extras.css, "the look").

export default function HQBackdrop() {
  return (
    <div className="hq-sky" aria-hidden="true">
      <div className="hq-sky-glow" />
      <div className="hq-sky-grid" />
      <div className="hq-sky-stars ds-stars" />
    </div>
  );
}
