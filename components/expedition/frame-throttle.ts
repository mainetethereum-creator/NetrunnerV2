/** Bounds how often a heavy per-frame recompute may run while input events
 * arrive faster than the render loop needs it — e.g. a range slider firing
 * on every animation frame while dragged. Matches the ~10 Hz budget already
 * used elsewhere for streaming/shadow refresh (see mobile-performance.md).
 * Pure and stateful only through the returned handle, so it is testable
 * without a browser: pass timestamps in, no requestAnimationFrame needed. */
export function createRateLimiter(intervalMs = 90) {
  let last = -Infinity;
  return {
    /** True at most once per intervalMs; every call after the first ready()
     * within the window returns false until intervalMs has elapsed. */
    ready(now: number) {
      if (now - last < intervalMs) return false;
      last = now;
      return true;
    },
    reset() { last = -Infinity; },
  };
}

/** Coalesces bursts of `schedule()` calls into work that runs at most once
 * per `intervalMs`, always using whatever state `run` reads at call time —
 * so the final input after a drag/keystroke still lands, just not every one
 * in between. `run` should be the expensive step (e.g. rebuilding terrain
 * geometry or instanced meshes), not the cheap bookkeeping around it. */
export function createThrottledScheduler(run: () => void, intervalMs = 90) {
  const limiter = createRateLimiter(intervalMs);
  let handle = 0;
  const gate = (now: number) => {
    handle = 0;
    if (!limiter.ready(now)) { schedule(); return; }
    run();
  };
  function schedule() {
    if (handle) return;
    handle = requestAnimationFrame(gate);
  }
  return {
    schedule,
    get pending() { return handle !== 0; },
    cancel() { if (handle) cancelAnimationFrame(handle); handle = 0; },
  };
}
