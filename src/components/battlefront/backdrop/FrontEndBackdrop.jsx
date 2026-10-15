import { useEffect, useRef } from 'react';
import { device } from '../../../lib/device';
import { prefersReducedMotion } from '../../../lib/hooks';
import { adopt } from './host';
import './backdrop.css';

// The front end's room behind a screen (the 2026-10-13 backdrop design):
// the one room host.js keeps, its canvas held here while this screen is up.
export default function FrontEndBackdrop() {
  const box = useRef(null);
  useEffect(() => adopt(box.current, { level: device().detail, reduced: prefersReducedMotion() }), []);
  return <div ref={box} className="bf-room" aria-hidden="true" />;
}
