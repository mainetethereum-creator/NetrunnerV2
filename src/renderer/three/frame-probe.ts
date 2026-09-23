import type * as T from 'three';

type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] * 100) / 100;
};

/** Opt-in local profiler. Query results are polled without waiting for the GPU.
 * Counts cover the entire frame, including reflection and postprocessing passes. */
export function createFrameProbe(renderer: T.WebGLRenderer, scene: T.Scene) {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
  const pending: WebGLQuery[] = [];
  let current: WebGLQuery | null = null, frame = 0, windowStart = performance.now();
  let lastFrame = windowStart, cpuStart = windowStart;
  const cadence: number[] = [], submission: number[] = [], draws: number[] = [], triangles: number[] = [], gpu: number[] = [];
  const cleanQueries = () => { pending.splice(0).forEach(query => gl.deleteQuery(query)); };
  return {
    begin() {
      const now = performance.now();
      if (now - lastFrame < 500 && !document.hidden) cadence.push(now - lastFrame);
      lastFrame = cpuStart = now;
      if (!timer || gl.isContextLost()) return;
      if (gl.getParameter(timer.GPU_DISJOINT_EXT)) { cleanQueries(); gpu.length = 0; return; }
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = pending.shift()!;
        gpu.push(Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6);
        if (gpu.length > 60) gpu.shift();
        gl.deleteQuery(query);
      }
      if (frame++ % 10 === 0 && pending.length < 4 && !gl.getQuery(timer.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
        current = gl.createQuery();
        if (current) gl.beginQuery(timer.TIME_ELAPSED_EXT, current);
      }
    },
    end(extra: Record<string, unknown>) {
      if (current && timer) { gl.endQuery(timer.TIME_ELAPSED_EXT); pending.push(current); current = null; }
      submission.push(performance.now() - cpuStart);
      draws.push(renderer.info.render.calls); triangles.push(renderer.info.render.triangles);
      const now = performance.now();
      if (now - windowStart < 2000) return;
      const lights: Record<string, number> = {};
      let meshes = 0;
      scene.traverseVisible(object => {
        if ('isLight' in object) lights[object.type] = (lights[object.type] ?? 0) + 1;
        if ('isMesh' in object) meshes++;
      });
      renderer.domElement.dataset.renderProfile = JSON.stringify({
        at: Math.round(now), hidden: document.hidden,
        width: renderer.domElement.width, height: renderer.domElement.height,
        cssWidth: renderer.domElement.clientWidth, cssHeight: renderer.domElement.clientHeight,
        frameP50: percentile(cadence, .5), frameP95: percentile(cadence, .95),
        cpuSubmitP50: percentile(submission, .5), cpuSubmitP95: percentile(submission, .95),
        gpuP50: percentile(gpu, .5), gpuP95: percentile(gpu, .95), gpuTimerSupported: !!timer,
        drawsP50: percentile(draws, .5), drawsP95: percentile(draws, .95), trianglesP95: percentile(triangles, .95),
        textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
        programs: renderer.info.programs?.length ?? 0, meshes, lights, ...extra,
        assets: performance.getEntriesByType('resource')
          .filter(entry => entry.name.includes('/game/') && /shared|building-surface/.test(entry.name))
          .map(entry => {
            const resource = entry as PerformanceResourceTiming;
            return { url: new URL(resource.name).pathname + new URL(resource.name).search,
              transfer: resource.transferSize, decoded: resource.decodedBodySize,
              ms: Math.round(resource.duration), status: resource.responseStatus };
          }),
      });
      cadence.length = submission.length = draws.length = triangles.length = 0; windowStart = now;
    },
    dispose() {
      if (current && timer && !gl.isContextLost()) { gl.endQuery(timer.TIME_ELAPSED_EXT); gl.deleteQuery(current); }
      current = null; cleanQueries(); delete renderer.domElement.dataset.renderProfile;
    },
  };
}
