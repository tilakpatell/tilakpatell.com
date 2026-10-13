// A 2D context that draws nothing and writes down what it was asked:
// every call as [name, ...args] and every property set as ['set', name,
// value], in order, in `calls` (paint.test.js reads the painter by it).
// measureText says ten units a letter.
export function fakeContext() {
  const calls = [];
  const props = {};
  return new Proxy(
    { calls },
    {
      get(target, name) {
        if (name === 'calls') return calls;
        if (name === 'measureText') return (t) => ({ width: String(t).length * 10 });
        if (name in props) return props[name];
        return (...args) => {
          calls.push([name, ...args]);
        };
      },
      set(target, name, value) {
        props[name] = value;
        calls.push(['set', name, value]);
        return true;
      },
    },
  );
}
