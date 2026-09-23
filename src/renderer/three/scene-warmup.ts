/** Keeps compileAsync resources alive until its internal polling has settled. */
export function createSceneWarmup(
  compile: () => Promise<unknown>,
  onReady: () => void,
  onError: (error: unknown) => void,
) {
  let started = false;
  let settled = false;
  let cancelled = false;
  let released = false;
  let releaseResources: (() => void) | undefined;
  let task: Promise<void> | undefined;

  const release = () => {
    if (released || !releaseResources) return;
    released = true;
    releaseResources();
  };

  return {
    start(): Promise<void> {
      if (task) return task;
      if (cancelled) return Promise.resolve();
      started = true;
      let pending: Promise<unknown>;
      try { pending = compile(); }
      catch (error) { pending = Promise.reject(error); }
      task = Promise.resolve(pending).then(
        () => {
          settled = true;
          if (cancelled) release();
          else onReady();
        },
        error => {
          settled = true;
          if (cancelled) release();
          else onError(error);
        },
      );
      return task;
    },
    dispose(callback: () => void): void {
      if (cancelled) return;
      cancelled = true;
      releaseResources = callback;
      if (!started || settled) release();
    },
  };
}
