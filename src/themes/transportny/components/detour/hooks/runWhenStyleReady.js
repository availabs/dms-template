// Shared guard against the "map.once('load') already fired" race - the same class of bug
// documented for the routing plugin: node/route layers sometimes never appeared if the map's
// 'load' event had already fired before the effect subscribed, since 'load' only ever fires once.
// Also hit here: "Get detour" didn't show the route until switching shortest/fastest tabs
// re-triggered the effect after the map had already finished loading.
//
// Listens to BOTH 'load' and 'idle' (idle fires whenever rendering settles, reliably even if
// 'load' already passed) and runs `fn` on whichever fires first, guarded so it only runs once.
export const runWhenStyleReady = (map, fn) => {
  if (map.isStyleLoaded()) { fn(); return; }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  map.once("load", run);
  map.once("idle", run);
};
