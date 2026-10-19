// Two black bars, top and bottom, while a scene holds (the film's frame):
// hud.js's letterbox() says when, the kit's --hud-bar how tall. `on` false
// folds them away (they stay in the page, so they can go as they came).
export default function Letterbox({ on = true, className = '' }) {
  return <div className={`hud-letterbox ${className}`.trim()} data-off={on ? undefined : ''} aria-hidden="true" />;
}
