// The page's way into the world: useWorld's handle carries the mounted
// world in `world`, a ref whose `current` is the world (or null before it
// is up, or after it has gone), and `do(action, arg)` is the module's door
// (module.js: 'deploy', 'pick', 'spawn', 'die', …). With no world up the
// answer is null. (The page read `handle.world.do` for two days, the ref's
// own field, which no ref has, so no click on the spawn screen deployed
// anyone; only the Enter key, which the module's own input hears, did.)
export const sendTo = (handle, action, arg) => handle?.world?.current?.do?.(action, arg) ?? null;
