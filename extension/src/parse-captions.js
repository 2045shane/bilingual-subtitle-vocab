function cue(id, startMs, endMs, text) {
  const cleaned = String(text || '').replace(/\s*\n\s*/g, ' ').trim();
  if (!cleaned) return null;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { id, startMs, endMs, text: cleaned };
}

/** YouTube json3 events. Events without segs are ignored. */
export function parseYouTubeJson3(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const partial = [];
  for (const event of events) {
    if (!event || !Array.isArray(event.segs)) continue;
    const startMs = Number(event.tStartMs);
    if (!Number.isFinite(startMs)) continue;
    const text = event.segs.map((seg) => (seg && typeof seg.utf8 === 'string' ? seg.utf8 : '')).join('');
    const duration = Number(event.dDurationMs);
    const endMs = Number.isFinite(duration) && duration > 0 ? startMs + duration : null;
    partial.push({ startMs, endMs, text });
  }
  const cues = [];
  for (let i = 0; i < partial.length; i += 1) {
    const item = partial[i];
    let endMs = item.endMs;
    if (endMs == null) {
      const next = partial[i + 1];
      endMs = next ? next.startMs : item.startMs + 2000;
    }
    if (endMs <= item.startMs) endMs = item.startMs + 1;
    const built = cue(`yt-${i}-${item.startMs}`, item.startMs, endMs, item.text);
    if (built) cues.push(built);
  }
  return cues;
}

const VTT_TIME = /^(?:(\d+):)?(\d{2}):(\d{2})[.](\d{3})\s+-->\s+(?:(\d+):)?(\d{2}):(\d{2})[.](\d{3})/;

function vttMs(hours, minutes, seconds, millis) {
  return ((Number(hours || 0) * 3600) + (Number(minutes) * 60) + Number(seconds)) * 1000 + Number(millis);
}

/** Limited WebVTT reader: cue timings and text. Styles, notes, and regions are skipped. */
export function parseWebVtt(input) {
  const lines = String(input || '').replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const cues = [];
  let index = 0;
  while (index < lines.length) {
    const match = VTT_TIME.exec(lines[index].trim());
    if (!match) {
      index += 1;
      continue;
    }
    const startMs = vttMs(match[1], match[2], match[3], match[4]);
    const endMs = vttMs(match[5], match[6], match[7], match[8]);
    index += 1;
    const buffer = [];
    while (index < lines.length && lines[index].trim() !== '') {
      buffer.push(lines[index]);
      index += 1;
    }
    const text = buffer.join(' ').replace(/<[^>]+>/g, '');
    const built = cue(`vtt-${cues.length}-${startMs}`, startMs, endMs, text);
    if (built) cues.push(built);
  }
  return cues;
}
