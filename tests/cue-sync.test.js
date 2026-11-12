import assert from 'node:assert/strict';
import test from 'node:test';
import { attachVideoSync, MAX_SYNC_LAG_MS, REFRESH_INTERVAL_MS, selectActiveCue } from '../extension/src/cue-sync.js';
import { buildFrame } from '../extension/src/view-model.js';

function fakeVideo() {
  const listeners = new Map();
  return {
    currentTime: 0,
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== fn));
    },
    dispatch(type) {
      for (const fn of listeners.get(type) || []) fn({ type });
    }
  };
}

const cues = [
  { id: 'a', startMs: 0, endMs: 1000, text: 'one' },
  { id: 'b', startMs: 1000, endMs: 2000, text: 'two' },
  { id: 'c', startMs: 1500, endMs: 2500, text: 'overlap' }
];

test('cue boundaries are start-inclusive and end-exclusive', () => {
  assert.equal(selectActiveCue(cues, 0)?.text, 'one');
  assert.equal(selectActiveCue(cues, 999)?.text, 'one');
  assert.equal(selectActiveCue(cues, 1000)?.text, 'two');
  assert.equal(selectActiveCue(cues, 5000), null);
  assert.equal(selectActiveCue(cues, Number.NaN), null);
});

test('overlapping cues use the later start', () => {
  assert.equal(selectActiveCue(cues, 1600)?.text, 'overlap');
});

test('refresh interval stays inside the 500ms budget', () => {
  assert.equal(REFRESH_INTERVAL_MS, 200);
  assert.ok(REFRESH_INTERVAL_MS <= MAX_SYNC_LAG_MS);
  assert.equal(MAX_SYNC_LAG_MS, 500);
  const video = fakeVideo();
  assert.throws(() => attachVideoSync(video, () => {}, {
    intervalMs: 501,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  }));
});

test('seek and pause replace or clear the line in the same turn', () => {
  const video = fakeVideo();
  let shown = '';
  let recordedInterval = 0;
  const stop = attachVideoSync(video, (time) => {
    shown = buildFrame({
      currentTimeSec: time,
      sourceCues: cues,
      targetState: { status: 'ready', cues },
      translatorProbe: { canEnhance: false, reason: 'off' },
      translatorEnabled: false
    }).source.text;
  }, {
    setIntervalFn: (fn, ms) => {
      recordedInterval = ms;
      return 1;
    },
    clearIntervalFn: () => {}
  });
  assert.equal(recordedInterval, 200);
  video.currentTime = 0.2;
  video.dispatch('seeked');
  assert.equal(shown, 'one');
  const started = performance.now();
  video.currentTime = 9;
  video.dispatch('seeked');
  assert.equal(shown, '');
  assert.ok(performance.now() - started <= 500);
  video.currentTime = 1.2;
  video.dispatch('pause');
  assert.equal(shown, 'two');
  video.currentTime = 0.4;
  video.dispatch('seeking');
  assert.equal(shown, 'one');
  stop();
  video.currentTime = 9;
  video.dispatch('seeked');
  assert.equal(shown, 'one');
});
