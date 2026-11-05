// `fn` in an idle moment once a world on the page has drawn its first frame
// (the runtime marks its box data-gl="on" after its first draw: runtime/
// useWorld), so what a first frame doesn't use (the crew's recordings'
// index, say) isn't on its way. Returns a cancel. The drawing, the watching
// and the idle moment can be handed in (a test's).
//
// afterFirstFrame(fn, { drawn, watch, idle }) → cancel()

const defaults = () => ({
  drawn: () => Boolean(document.querySelector('[data-gl="on"]')),
  watch: (cb) => {
    const mo = new MutationObserver(cb);
    mo.observe(document, { subtree: true, attributes: true, attributeFilter: ['data-gl'] });
    return () => mo.disconnect();
  },
  idle: (cb) => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(cb, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(cb, 200);
    return () => clearTimeout(id);
  },
});

export function afterFirstFrame(fn, deps = defaults()) {
  const { drawn, watch, idle } = deps;
  let stop = null;
  const go = () => {
    stop?.();
    stop = idle(fn);
  };
  if (drawn()) go();
  else {
    const unwatch = watch(() => drawn() && go());
    stop = unwatch;
  }
  return () => stop?.();
}
