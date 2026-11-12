import { DEFAULT_SOURCE_LANG, DEFAULT_TARGET_LANG } from './constants.js';
import { resolveCaptionUrl } from './same-site-fetch.js';

/**
 * Bare `zh` / `zh-CN` / `cmn` map to the locked target zh-Hans.
 * Traditional tags stay zh-Hant and do not satisfy the default target.
 */
export function normalizeLang(code) {
  if (code == null) return '';
  const value = String(code).trim().replace(/_/g, '-');
  if (!value) return '';
  const lower = value.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (
    lower === 'zh'
    || lower === 'zh-cn'
    || lower === 'zh-sg'
    || lower === 'zh-hans'
    || lower === 'cmn'
    || lower === 'cmn-hans'
  ) {
    return 'zh-Hans';
  }
  if (
    lower === 'zh-tw'
    || lower === 'zh-hk'
    || lower === 'zh-mo'
    || lower === 'zh-hant'
    || lower === 'cmn-hant'
  ) {
    return 'zh-Hant';
  }
  return value;
}

function languageNameOf(track) {
  if (!track) return '';
  if (typeof track.languageName === 'string' && track.languageName) return track.languageName;
  const name = track.name;
  if (typeof name === 'string') return name;
  if (name && typeof name.simpleText === 'string') return name.simpleText;
  if (name && Array.isArray(name.runs)) {
    return name.runs.map((run) => (run && run.text) || '').join('');
  }
  return '';
}

function trackId(languageCode, kind, index) {
  return `${index}:${languageCode}:${kind || ''}`;
}

/**
 * Keep only real caption tracks. Entries without a same-site baseUrl are
 * dropped, which excludes translation-language menus that have no baseUrl.
 */
export function normalizeYouTubeTracks(raw, pageUrl) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((track, index) => {
    if (!track || typeof track.baseUrl !== 'string' || typeof track.languageCode !== 'string') return;
    let baseUrl;
    try {
      baseUrl = resolveCaptionUrl(track.baseUrl, pageUrl).toString();
    } catch {
      return;
    }
    const languageCode = track.languageCode;
    out.push({
      id: trackId(languageCode, track.kind, index),
      languageCode,
      normalized: normalizeLang(languageCode),
      languageName: languageNameOf(track) || languageCode,
      kind: typeof track.kind === 'string' ? track.kind : '',
      baseUrl,
      cues: null
    });
  });
  return out;
}

export function captionTracksFromPlayerResponse(playerResponse, pageUrl) {
  const list = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return normalizeYouTubeTracks(list, pageUrl);
}

function preferHuman(list) {
  if (!list || list.length === 0) return null;
  return list.find((track) => track.kind !== 'asr') || list[0];
}

export function chooseDefaultTracks(tracks, pair = {
  source: DEFAULT_SOURCE_LANG,
  target: DEFAULT_TARGET_LANG
}) {
  const usable = (tracks || []).filter((track) => track && track.id);
  const source = preferHuman(usable.filter((track) => track.normalized === pair.source)) || usable[0] || null;
  const targetPool = usable.filter((track) => track.normalized === pair.target && (!source || track.id !== source.id));
  const target = preferHuman(targetPool) || null;
  return { source, target };
}

export function normalizeUdemyRefs(raw, pageUrl) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((item, index) => {
    if (!item || typeof item.url !== 'string') return;
    const languageCode = item.languageCode || item.language || item.locale || '';
    if (!languageCode) return;
    let url;
    try {
      url = resolveCaptionUrl(item.url, pageUrl).toString();
    } catch {
      return;
    }
    out.push({
      id: `udemy-url:${index}:${languageCode}`,
      languageCode: String(languageCode),
      normalized: normalizeLang(languageCode),
      languageName: item.languageName || String(languageCode),
      kind: item.kind || '',
      baseUrl: url,
      cues: null
    });
  });
  return out;
}

/** Text-track snapshots already contain cues, so they do not need another fetch. */
export function tracksFromCueSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) return [];
  return snapshots.map((snapshot, index) => {
    const languageCode = snapshot.languageCode || '';
    const cues = Array.isArray(snapshot.cues)
      ? snapshot.cues.map((item, cueIndex) => ({
        id: `snap-${index}-${cueIndex}`,
        startMs: Number(item.startMs),
        endMs: Number(item.endMs),
        text: String(item.text || '').replace(/\s*\n\s*/g, ' ').trim()
      })).filter((item) => item.text && Number.isFinite(item.startMs) && Number.isFinite(item.endMs) && item.endMs > item.startMs)
      : [];
    return {
      id: `snap:${index}:${languageCode}`,
      languageCode,
      normalized: normalizeLang(languageCode),
      languageName: snapshot.languageName || languageCode || 'track',
      kind: snapshot.kind || '',
      baseUrl: null,
      cues
    };
  }).filter((track) => track.cues.length > 0);
}

/**
 * Prefer in-memory cues over a URL for the same normalized language.
 * URL tracks are kept when that language has no cues yet.
 */
export function mergeTrackSources(cueTracks, urlTracks) {
  const merged = [];
  const seen = new Set();
  for (const track of cueTracks || []) {
    merged.push(track);
    seen.add(track.normalized || track.languageCode);
  }
  for (const track of urlTracks || []) {
    const key = track.normalized || track.languageCode;
    if (seen.has(key)) continue;
    merged.push(track);
    seen.add(key);
  }
  return merged;
}
