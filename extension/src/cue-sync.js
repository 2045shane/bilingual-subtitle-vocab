import { MAX_SYNC_LAG_MS, REFRESH_INTERVAL_MS } from './constants.js';

export { MAX_SYNC_LAG_MS, REFRESH_INTERVAL_MS };

/**
 * Pick the cue that contains currentTimeMs.
 * Start is inclusive, end is exclusive.
 * Overlaps: the cue with the greater startMs wins.
 */
export function selectActiveCue(cues, currentTimeMs) {
  if (!Array.isArray(cues) || !Number.isFinite(currentTimeMs)) return null;
  let best = null;
  for (const cue of cues) {
    if (!cue) continue;
    const startMs = Number(cue.startMs);
    const endMs = Number(cue.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (currentTimeMs < startMs || currentTimeMs >= endMs) continue;
    if (!best || startMs >= best.startMs) best = cue;
  }
  return best;
}

/**
 * Bind a video-like event target. Seek, pause, and the short interval all
 * read currentTime in the same turn the event is dispatched, so a stale line
 * is replaced or cleared without waiting for the next timeupdate.
 */
export function attachVideoSync(video, onTime, options = {}) {
  const intervalMs = options.intervalMs ?? REFRESH_INTERVAL_MS;
  if (intervalMs > MAX_SYNC_LAG_MS) {
    throw new Error('refresh interval exceeds the sync budget');
  }
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const tick = () => onTime(Number(video.currentTime));
  const events = ['timeupdate', 'seeking', 'seeked', 'pause', 'playing', 'emptied', 'ratechange'];
  for (const eventName of events) video.addEventListener(eventName, tick);
  const timer = setIntervalFn(tick, intervalMs);
  tick();
  return function stop() {
    for (const eventName of events) video.removeEventListener(eventName, tick);
    clearIntervalFn(timer);
  };
}
