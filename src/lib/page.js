import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// A page in the feed (components/feed) is one of several on the screen at
// once, and only one of them is on the address. This is how a page knows
// whether that one is it: the feed provides it per page; everywhere else a
// page is active. `remember` takes the page's search string, so the feed can
// put it back on the address when the page is current again.
export const PageContext = createContext({ active: true, remember: null });

export const usePageActive = () => useContext(PageContext).active;

// useSearchParams for a page that may be in the feed. While the page is the
// active one, the address is the truth. While it is not, the page keeps the
// params it had (so the page above the boundary doesn't snap to its defaults
// as the address moves on), and a change made to it there is kept for the
// feed to put back, instead of landing on another page's address.
export function usePageParams() {
  const [live, setLive] = useSearchParams();
  const { active, remember } = useContext(PageContext);
  const [own, setOwn] = useState(live);
  if (active && own !== live) setOwn(live);
  const params = active ? live : own;

  useEffect(() => {
    if (active) remember?.(live.toString());
  }, [active, live, remember]);

  const set = useCallback(
    (next, options) => {
      if (active) {
        setLive(next, options);
        return;
      }
      const value = new URLSearchParams(typeof next === 'function' ? next(own) : next);
      setOwn(value);
      remember?.(value.toString());
    },
    [active, own, remember, setLive],
  );

  return [params, set];
}
