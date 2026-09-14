import test from 'node:test';
import assert from 'node:assert/strict';
import {createRateLimiter, createThrottledScheduler} from '../components/expedition/frame-throttle.ts';

test('rate limiter allows one run per interval and reset re-arms it immediately', () => {
  const limiter = createRateLimiter(90);
  assert.equal(limiter.ready(0), true);
  assert.equal(limiter.ready(10), false);
  assert.equal(limiter.ready(89), false);
  assert.equal(limiter.ready(90), true);
  assert.equal(limiter.ready(91), false);
  limiter.reset();
  assert.equal(limiter.ready(91), true);
});

test('throttled scheduler collapses a burst of bookings into far fewer heavy runs, but the latest value always lands', () => {
  // Stand in for requestAnimationFrame/cancelAnimationFrame: a FIFO queue the
  // test drives by hand, so timing is deterministic instead of real-clock.
  const previousRaf = globalThis.requestAnimationFrame, previousCaf = globalThis.cancelAnimationFrame;
  const queue = [];
  let now = 0, nextHandle = 1;
  globalThis.requestAnimationFrame = (callback) => { const handle = nextHandle++; queue.push({handle, callback}); return handle; };
  globalThis.cancelAnimationFrame = (handle) => { const index = queue.findIndex((entry) => entry.handle === handle); if (index !== -1) queue.splice(index, 1); };
  const tick = () => { const entry = queue.shift(); if (entry) entry.callback(now); };
  try {
    let runs = 0, lastValue = -1, value = -1;
    const scheduler = createThrottledScheduler(() => { runs++; lastValue = value; }, 90);
    // Simulate a slider firing an input event ~every animation frame (15ms) for 150ms.
    for (let i = 0; i < 10; i++) { value = i; scheduler.schedule(); now += 15; tick(); }
    assert.ok(runs < 10, `expected throttling to skip most of the 10 bursts, ran ${runs} times`);
    // Drain any still-pending frame so the last dragged value settles in.
    for (let i = 0; i < 20 && queue.length; i++) { now += 100; tick(); }
    assert.equal(lastValue, 9);
    assert.ok(runs >= 1);
  } finally {
    globalThis.requestAnimationFrame = previousRaf; globalThis.cancelAnimationFrame = previousCaf;
  }
});

test('cancel drops a pending frame so a disposed scene never runs stale work', () => {
  const previousRaf = globalThis.requestAnimationFrame, previousCaf = globalThis.cancelAnimationFrame;
  const queue = [];
  let nextHandle = 1;
  globalThis.requestAnimationFrame = (callback) => { const handle = nextHandle++; queue.push({handle, callback}); return handle; };
  globalThis.cancelAnimationFrame = (handle) => { const index = queue.findIndex((entry) => entry.handle === handle); if (index !== -1) queue.splice(index, 1); };
  try {
    let runs = 0;
    const scheduler = createThrottledScheduler(() => { runs++; }, 90);
    scheduler.schedule();
    assert.equal(scheduler.pending, true);
    scheduler.cancel();
    assert.equal(scheduler.pending, false);
    assert.equal(queue.length, 0);
    for (const entry of queue) entry.callback(0);
    assert.equal(runs, 0);
  } finally {
    globalThis.requestAnimationFrame = previousRaf; globalThis.cancelAnimationFrame = previousCaf;
  }
});
