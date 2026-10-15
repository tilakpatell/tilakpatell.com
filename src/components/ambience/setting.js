// The visitor's switch for the moving backgrounds (components/ambience),
// kept between visits. On unless switched off.
import { useEffect, useState } from 'react';

const KEY = 'tp-ambience';
const EVENT = 'tp:ambience';

function ambienceOn() {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function setAmbience(on) {
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, 'off');
  } catch {
    /* storage unavailable: it lasts for this page */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export function useAmbienceSetting() {
  const [on, setOn] = useState(ambienceOn);
  useEffect(() => {
    const hear = (e) => setOn(e.detail ?? ambienceOn());
    window.addEventListener(EVENT, hear);
    return () => window.removeEventListener(EVENT, hear);
  }, []);
  return [on, setAmbience];
}
