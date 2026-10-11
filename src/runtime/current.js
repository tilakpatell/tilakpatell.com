// The site's one runtime, for the parts of the runtime that read it without
// making it (the Menu's renderer line): set by index.js when it is made.
// Apart from index.js so nothing that index.js reaches imports it back.
//
//   setCurrentRuntime(rt), currentRuntime() → rt | null

let rt = null;
export const setCurrentRuntime = (next) => {
  rt = next;
};
export const currentRuntime = () => rt;
