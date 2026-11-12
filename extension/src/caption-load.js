import { parseWebVtt, parseYouTubeJson3 } from './parse-captions.js';
import { fetchCaption, readCaptionBody, youtubeJson3Url } from './same-site-fetch.js';

async function loadBody(track, pageUrl, fetchImpl, urlFor) {
  if (!track) return { ok: false, reason: 'NO_TRACK', cues: [] };
  if (Array.isArray(track.cues)) return { ok: true, reason: '', cues: track.cues };
  if (!track.baseUrl) return { ok: false, reason: 'NO_URL', cues: [] };
  let safeUrl;
  try {
    safeUrl = urlFor(track.baseUrl, pageUrl);
  } catch (error) {
    return { ok: false, reason: error.code || 'BLOCKED', cues: [] };
  }
  let response;
  try {
    response = await fetchCaption(safeUrl, pageUrl, fetchImpl);
  } catch (error) {
    return { ok: false, reason: (error && error.code) || 'NETWORK', cues: [] };
  }
  const body = await readCaptionBody(response);
  if (!body.ok) return { ok: false, reason: body.reason, cues: [], requestedUrl: safeUrl };
  return { ok: true, reason: '', text: body.text, requestedUrl: safeUrl };
}

export async function loadYouTubeCues(track, pageUrl, fetchImpl = globalThis.fetch) {
  const loaded = await loadBody(track, pageUrl, fetchImpl, youtubeJson3Url);
  if (!loaded.ok || Array.isArray(loaded.cues)) return loaded;
  let payload;
  try {
    payload = JSON.parse(loaded.text);
  } catch {
    return { ok: false, reason: 'BAD_PAYLOAD', cues: [], requestedUrl: loaded.requestedUrl };
  }
  const cues = parseYouTubeJson3(payload);
  if (cues.length === 0) return { ok: false, reason: 'NO_CUES', cues: [], requestedUrl: loaded.requestedUrl };
  return { ok: true, reason: '', cues, requestedUrl: loaded.requestedUrl };
}

export async function loadVttCues(track, pageUrl, fetchImpl = globalThis.fetch) {
  const loaded = await loadBody(track, pageUrl, fetchImpl, (raw, page) => {
    const url = new URL(raw, page);
    return url.toString();
  });
  if (!loaded.ok || Array.isArray(loaded.cues)) {
    if (Array.isArray(loaded.cues)) return loaded;
    return loaded;
  }
  const cues = parseWebVtt(loaded.text);
  if (cues.length === 0) return { ok: false, reason: 'NO_CUES', cues: [], requestedUrl: loaded.requestedUrl };
  return { ok: true, reason: '', cues, requestedUrl: loaded.requestedUrl };
}

export function targetStateFromLoad(targetTrack, load) {
  if (!targetTrack) return { status: 'missing' };
  if (!load) return { status: 'loading' };
  if (!load.ok) return { status: 'error', reason: load.reason || 'ERROR' };
  return { status: 'ready', cues: load.cues || [] };
}
