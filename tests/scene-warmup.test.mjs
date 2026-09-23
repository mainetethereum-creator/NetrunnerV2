import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneWarmup } from '../src/renderer/three/scene-warmup.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('warmup starts once and reports readiness after shader compilation', async () => {
  const work = deferred(), events = [];
  const warmup = createSceneWarmup(() => { events.push('compile'); return work.promise; }, () => events.push('ready'), () => events.push('error'));
  const task = warmup.start();
  assert.equal(warmup.start(), task);
  assert.deepEqual(events, ['compile']);
  work.resolve(); await task;
  assert.deepEqual(events, ['compile', 'ready']);
  warmup.dispose(() => events.push('release'));
  warmup.dispose(() => events.push('duplicate release'));
  assert.deepEqual(events, ['compile', 'ready', 'release']);
});

test('unmount during compile defers graphics release and suppresses ready', async () => {
  const work = deferred(), events = [];
  const warmup = createSceneWarmup(() => work.promise, () => events.push('ready'), () => events.push('error'));
  const task = warmup.start();
  warmup.dispose(() => events.push('release'));
  assert.deepEqual(events, []);
  work.resolve(); await task;
  assert.deepEqual(events, ['release']);
});

test('unmount during rejected compile releases once without reporting error', async () => {
  const work = deferred(), events = [];
  const warmup = createSceneWarmup(() => work.promise, () => events.push('ready'), () => events.push('error'));
  const task = warmup.start();
  warmup.dispose(() => events.push('release'));
  work.reject(new Error('shader compile failed')); await task;
  assert.deepEqual(events, ['release']);
});

test('active rejection reports error; disposing before start never compiles', async () => {
  const failure = new Error('compile');
  const errors = [];
  const failed = createSceneWarmup(() => Promise.reject(failure), () => assert.fail('ready'), error => errors.push(error));
  await failed.start();
  assert.deepEqual(errors, [failure]);
  let calls = 0, releases = 0;
  const cancelled = createSceneWarmup(() => { calls++; return Promise.resolve(); }, () => assert.fail('ready'), () => assert.fail('error'));
  cancelled.dispose(() => { releases++; });
  await cancelled.start();
  assert.equal(calls, 0);
  assert.equal(releases, 1);
});
