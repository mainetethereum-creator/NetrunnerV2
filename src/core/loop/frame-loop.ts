// Frame scheduling shared by the scene engines (base, expedition, metro).
//
// Owns requestAnimationFrame, hidden-tab handling, the optional frame cadence cap
// used by the mobile render budget, and the clamped frame delta. Frame timing is
// identical to the per-scene loops it replaced; `tests/frame-loop.test.mjs`
// compares both on the same timestamps.
//
// Phases per accepted frame: fixedUpdate × N → update → render. Scenes register
// fixedUpdate only once gameplay state can be interpolated (see ARCHITECTURE.md §5).

export interface FrameTick {
  /** requestAnimationFrame timestamp in milliseconds. */
  now: number;
  /** Milliseconds since the previous accepted frame (not clamped). */
  frameMs: number;
  /** Seconds since the previous accepted frame, clamped to `maxDeltaSeconds`. */
  dt: number;
  /** Progress towards the next fixed step in [0, 1); 0 when no fixedUpdate is registered. */
  alpha: number;
}

/** Browser services the loop uses. Injected in tests. */
export interface FramePlatform {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
  isHidden(): boolean;
  onVisibilityChange(listener: () => void): () => void;
}

export interface FrameLoopOptions {
  fixedUpdate?(stepSeconds: number): void;
  /** The tick object is reused every frame; do not keep references to it. */
  update?(tick: FrameTick): void;
  /** The tick object is reused every frame; do not keep references to it. */
  render?(tick: FrameTick): void;
  /** Default 0.05 s. */
  maxDeltaSeconds?: number;
  /** Default 1/60 s. */
  fixedStepSeconds?: number;
  /** Fixed steps per frame before extra time is dropped. Default 5. */
  maxFixedSteps?: number;
  /** Frame cadence cap in fps, read every frame; `null` renders at display rate. */
  targetFps?: () => number | null;
  /**
   * `stop` (default): no frames while the document is hidden; on every visibility
   * change the timing is resynchronised and the loop restarts if visible.
   * `skip`: keep scheduling while hidden, skip those frames and restart timing from them.
   */
  hidden?: "stop" | "skip";
  /** Called on every visibility change in `stop` mode, before the loop restarts. */
  onVisibilityChange?(now: number): void;
  /** Timestamp the first frame delta is measured from. Default: platform.now() at creation. */
  startTime?: number;
  platform?: FramePlatform;
}

export interface FrameLoop {
  start(): void;
  /** Stops scheduling; visibility changes no longer restart the loop until start(). */
  stop(): void;
  /** Stops and removes listeners. */
  dispose(): void;
  readonly running: boolean;
}

const CADENCE_TOLERANCE_MS = 0.8;

export function browserFramePlatform(): FramePlatform {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    isHidden: () => document.hidden,
    onVisibilityChange(listener) {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}

export function createFrameLoop(options: FrameLoopOptions): FrameLoop {
  const platform = options.platform ?? browserFramePlatform();
  const maxDelta = options.maxDeltaSeconds ?? 0.05;
  const fixedStep = options.fixedStepSeconds ?? 1 / 60;
  const maxFixedSteps = options.maxFixedSteps ?? 5;
  const hiddenMode = options.hidden ?? "stop";

  const tickState: FrameTick = { now: 0, frameMs: 0, dt: 0, alpha: 0 };
  let handle: number | null = null;
  let active = false;
  let last = options.startTime ?? platform.now();
  let lastPaint = last;
  let accumulator = 0;
  let removeVisibility: (() => void) | null = null;

  const schedule = () => {
    handle = platform.requestFrame(tick);
  };
  const cancel = () => {
    if (handle !== null) platform.cancelFrame(handle);
    handle = null;
  };

  function tick(now: number) {
    handle = null;
    if (!active) return;
    if (hiddenMode === "stop" && platform.isHidden()) return;
    // Schedule first so an exception in a phase does not stop the loop.
    schedule();
    if (hiddenMode === "skip" && platform.isHidden()) {
      last = now;
      return;
    }

    const target = options.targetFps?.() ?? null;
    if (target) {
      const interval = 1000 / target;
      if (now - lastPaint < interval - CADENCE_TOLERANCE_MS) return;
      lastPaint = Math.max(lastPaint + interval, now - interval);
    } else {
      lastPaint = now;
    }

    const frameMs = now - last;
    const dt = Math.min(frameMs / 1000, maxDelta);
    last = now;
    tickState.now = now;
    tickState.frameMs = frameMs;
    tickState.dt = dt;
    tickState.alpha = 0;

    if (options.fixedUpdate) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= fixedStep && steps < maxFixedSteps) {
        options.fixedUpdate(fixedStep);
        accumulator -= fixedStep;
        steps++;
      }
      if (accumulator >= fixedStep) accumulator %= fixedStep;
      tickState.alpha = accumulator / fixedStep;
    }
    options.update?.(tickState);
    options.render?.(tickState);
  }

  const onVisibility = () => {
    const now = platform.now();
    options.onVisibilityChange?.(now);
    cancel();
    last = lastPaint = now;
    accumulator = 0;
    if (active && !platform.isHidden()) schedule();
  };

  return {
    start() {
      if (active) return;
      active = true;
      if (hiddenMode === "stop" && !removeVisibility) removeVisibility = platform.onVisibilityChange(onVisibility);
      schedule();
    },
    stop() {
      active = false;
      cancel();
    },
    dispose() {
      active = false;
      cancel();
      removeVisibility?.();
      removeVisibility = null;
    },
    get running() {
      return active;
    },
  };
}
