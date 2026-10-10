import { useRef } from 'react';
import { FILMS, filmOf } from '../../lib/bf2017/films';
import { shape as shapeOf } from '../../lib/bf2017/ui/shapes';
import Film from './Film';
import GameIcon from './GameIcon';
import { screenKey } from './screenKey';
import './screen.css';

// One of the 2017 game's screens, drawn from its resolved widget tree
// (src/lib/bf2017/ui/screens.js's screen()): every box where the tree puts
// it, in per cent of its parent (so the screen fills whatever frame holds
// it), texts in their faces, shapes as the game's vector paths, icons, films;
// a list's cells as buttons with the game's navigation (arrows along the
// list, Home and End, Enter or Space to go). No layout of its own: every box
// is the tree's. `onLink(screen, cell)` when a cell with a link is chosen
// (the screen it goes to, else the link's own name); `onAction(id, cell)`
// for one without; `fill(box)` puts a world's own node in a box (a live
// number, a deploy list) and returns null to leave it as drawn.

const pc = (v) => `${Math.round(v * 1e6) / 1e4}%`;
const PASSIVE = new Set(['input', 'measurement', 'navigatableElementCollection', 'navigatableElementZone', 'inputConceptIcon', 'spacer']);

function place(box, parent) {
  return { left: pc((box.x - parent.x) / (parent.w || 1)), top: pc((box.y - parent.y) / (parent.h || 1)), width: pc(box.w / (parent.w || 1)), height: pc(box.h / (parent.h || 1)) };
}

function ShapeBox({ name, colour }) {
  const s = shapeOf(name);
  if (!s) return null;
  return (
    <svg className="hud-screen-shape" viewBox={s.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {s.paths.map((p, i) => (
        <path key={i} d={p.d} transform={p.transform} fill={p.stroke ? 'none' : (colour ?? p.fill)} fillRule={p.fillRule} stroke={p.stroke ? (colour ?? p.stroke) : undefined} strokeWidth={p.strokeWidth} strokeLinecap={p.strokeLinecap} opacity={p.opacity} />
      ))}
    </svg>
  );
}

const filmNamed = (name) => filmOf(FILMS.find((f) => f.name?.split('/').pop() === name));

function Box({ box, parent, k, ctx }) {
  const own = ctx.fill?.(box);
  const style = place(box, parent);
  if (box.alpha !== undefined) style.opacity = box.alpha;
  if (box.type === 'text') {
    if (box.colour) style.color = box.colour;
    if (box.font) {
      style.fontFamily = box.font.family;
      style.fontSize = `${Math.round(box.font.size * k * 10) / 10}px`;
      style.fontWeight = box.font.weight;
      if (box.font.numeric) style.fontVariantNumeric = box.font.numeric;
    }
    if (box.align?.[0]) style.textAlign = box.align[0];
    if (box.align?.[1]) style.alignItems = { top: 'flex-start', bottom: 'flex-end' }[box.align[1]] ?? 'center';
  } else if ((box.type === 'rectangle' || box.type === 'fill' || box.type === 'circle') && box.colour && box.fill !== 'none') style.background = box.colour;
  else if (box.type === 'rectangle' && box.line && box.colour) style.border = `${Math.max(1, box.line * k)}px solid ${box.colour}`;
  if (box.type === 'circle') style.borderRadius = '50%';
  const kids = box.children?.length ? <Boxes boxes={box.children} parent={box} k={k} ctx={ctx} /> : null;
  const film = box.film ? filmNamed(box.film) : null;
  const common = { 'data-id': box.id, 'data-type': box.type, 'data-wrap': box.wrap || undefined, hidden: box.hidden || undefined, style };
  if (box.type === 'staticList' || box.type === 'staticTabList') {
    const cells = box.children ?? [];
    const horizontal = cells.length > 1 ? cells[1].x !== cells[0].x : true;
    return (
      <div {...common} className="hud-screen-box hud-screen-list" role="list">
        {cells.map((c, i) => (
          <Cell key={c.id} cell={c} parent={box} k={k} ctx={ctx} index={i} cells={cells} horizontal={horizontal} />
        ))}
      </div>
    );
  }
  return (
    <div {...common} className={`hud-screen-box${PASSIVE.has(box.type) ? ' hud-screen-passive' : ''}`}>
      {own ?? (
        <>
          {box.type === 'text' && box.text ? <span className="hud-screen-text">{box.text}</span> : null}
          {box.shape ? <ShapeBox name={box.shape} colour={box.type === 'vectorShape' && box.colour !== 'rgb(255 255 255)' ? box.colour : null} /> : null}
          {box.svg ? <GameIcon name={box.svg.split('/').pop()} className="hud-screen-icon" /> : null}
          {film ? <Film film={film} className="hud-screen-film" /> : null}
          {kids}
        </>
      )}
    </div>
  );
}

// (a cell whose widget writes its own label needs no second one)
const hasText = (b) => (b.children ?? []).some((c) => (c.type === 'text' && c.text) || hasText(c));

function Cell({ cell, parent, k, ctx, index, cells, horizontal }) {
  const onKeyDown = (e) => {
    const r = screenKey(e, { index, cells, horizontal, onLink: ctx.onLink, onAction: ctx.onAction });
    if (r?.focus !== undefined) e.currentTarget.parentElement?.children[r.focus]?.focus();
  };
  const go = () => (cell.link || cell.screen ? ctx.onLink?.(cell.screen ?? cell.link, cell) : ctx.onAction?.(cell.id.split('/').pop(), cell));
  return (
    <button
      type="button"
      role="listitem"
      className="hud-screen-box hud-screen-cell"
      data-id={cell.id}
      data-link={cell.link}
      data-coming={cell.coming || undefined}
      tabIndex={index === 0 ? 0 : -1}
      style={place(cell, parent)}
      onKeyDown={onKeyDown}
      onClick={go}
      aria-label={cell.label}
      aria-disabled={cell.coming || undefined}
    >
      {cell.children?.length ? <Boxes boxes={cell.children} parent={cell} k={k} ctx={ctx} /> : null}
      {hasText(cell) ? null : <span className="hud-screen-label">{cell.label}</span>}
    </button>
  );
}

function Boxes({ boxes, parent, k, ctx }) {
  return boxes.map((b) => <Box key={b.id} box={b} parent={parent} k={k} ctx={ctx} />);
}

export default function Screen({ tree, label = '', modal = false, onLink = null, onAction = null, fill = null, className = '', children = null }) {
  const ref = useRef(null);
  if (!tree) return null;
  const [w, h] = tree.size;
  const k = Math.min(w, h) / 1080;
  const root = { x: 0, y: 0, w, h };
  const states = (tree.states ?? []).map((s) => `state-${s}`).join(' ');
  return (
    <div
      ref={ref}
      className={`hud-screen ${states} ${className}`.trim()}
      role={modal ? 'dialog' : 'region'}
      aria-modal={modal || undefined}
      aria-label={label || undefined}
      data-screen={tree.name}
    >
      <Boxes boxes={tree.boxes} parent={root} k={k} ctx={{ onLink, onAction, fill }} />
      {children}
    </div>
  );
}
