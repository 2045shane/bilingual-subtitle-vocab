import { DICTIONARY_PATH, DEFAULT_PAIR, PREF_KEY } from '../src/constants.js';
import { attachVideoSync, selectActiveCue } from '../src/cue-sync.js';
import { createDictionary, unavailableDictionary } from '../src/dictionary.js';
import { fetchExtensionJson } from '../src/local-resource.js';
import { loadVttCues, loadYouTubeCues, targetStateFromLoad } from '../src/caption-load.js';
import {
  captionTracksFromPlayerResponse,
  chooseDefaultTracks,
  mergeTrackSources,
  normalizeUdemyRefs,
  normalizeYouTubeTracks,
  tracksFromCueSnapshots
} from '../src/tracks.js';
import { probeTranslator, translateOnDevice } from '../src/translator-gate.js';
import {
  addWord,
  createChromeArea,
  emptyBook,
  readBook,
  removeWord,
  vocabKeys
} from '../src/vocab-book.js';
import { MESSAGES } from '../src/messages.js';
import { buildFrame } from '../src/view-model.js';
import { mountOverlay } from './overlay-dom.js';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const UDEMY_HOSTS = new Set(['udemy.com', 'www.udemy.com']);

export function start() {
  if (globalThis.__BSV_BOOTED) return;
  globalThis.__BSV_BOOTED = true;
  const host = location.hostname;
  const task = YOUTUBE_HOSTS.has(host) ? boot('youtube') : (UDEMY_HOSTS.has(host) ? boot('udemy') : null);
  if (task) task.catch((error) => console.info('[bsv] boot failed', error && error.message ? error.message : error));
}

function findVideo(site) {
  if (site === 'youtube') {
    return document.querySelector('#movie_player video.html5-main-video, #movie_player video, video.html5-main-video');
  }
  return document.querySelector('[data-purpose="video-player"] video, video.vjs-tech, .video-player video')
    || largestVideo();
}

function largestVideo() {
  const videos = [...document.querySelectorAll('video')];
  let best = null;
  let area = 0;
  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const size = rect.width * rect.height;
    if (size > area) {
      area = size;
      best = video;
    }
  }
  return area >= 80 * 80 ? best : null;
}

function snapshotTextTracks(video) {
  const list = video && video.textTracks;
  if (!list) return [];
  const snapshots = [];
  for (let index = 0; index < list.length; index += 1) {
    const track = list[index];
    if (track.kind && track.kind !== 'subtitles' && track.kind !== 'captions') continue;
    if ((!track.cues || track.cues.length === 0) && track.mode === 'disabled') {
      try {
        track.mode = 'hidden';
      } catch {
        /* platform may reject mode changes */
      }
    }
    const cues = [];
    const cueList = track.cues;
    if (cueList) {
      for (let cueIndex = 0; cueIndex < cueList.length; cueIndex += 1) {
        const cue = cueList[cueIndex];
        cues.push({
          startMs: Number(cue.startTime) * 1000,
          endMs: Number(cue.endTime) * 1000,
          text: cue.text || ''
        });
      }
    }
    snapshots.push({
      languageCode: track.language || '',
      languageName: track.label || track.language || '',
      kind: track.kind || '',
      cues
    });
  }
  return snapshots;
}

function injectHook(path) {
  const id = 'bsv-page-hook';
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.src = chrome.runtime.getURL(path);
  script.async = false;
  (document.documentElement || document.head).append(script);
}

async function boot(site) {
  const storage = createChromeArea(chrome.storage.local);
  let dictionary = unavailableDictionary();
  try {
    const payload = await fetchExtensionJson(DICTIONARY_PATH);
    dictionary = createDictionary(payload.entries || {});
  } catch {
    dictionary = unavailableDictionary();
  }

  let book = emptyBook();
  try {
    book = await readBook(storage);
  } catch {
    book = emptyBook();
  }

  let translatorEnabled = false;
  try {
    const prefs = await storage.get(PREF_KEY);
    translatorEnabled = Boolean(prefs && prefs.translatorEnabled);
  } catch {
    translatorEnabled = false;
  }

  let probe = {
    canEnhance: false,
    reason: '当前环境没有 Translator API（content script 全局对象不可用）'
  };
  let tracks = [];
  let sourceId = '';
  let targetId = '';
  let manualTarget = false;
  let pageHref = location.href;
  let sourceLoad = null;
  let targetLoad = null;
  let discovered = false;
  let deviceText = '';
  let devicePending = false;
  let deviceNotice = '';
  let deviceCueKey = '';
  let translateGen = 0;
  let loadGen = 0;
  let video = null;
  let stopSync = null;
  let udemyRefs = [];
  let loggedKey = '';
  let loadKey = '';

  const overlay = mountOverlay(document, {
    onSource(id) {
      sourceId = id;
      if (sourceId && sourceId === targetId) targetId = '';
      void ensureLoads();
    },
    onTarget(id) {
      targetId = id;
      manualTarget = true;
      void ensureLoads();
    },
    onToggle(checked) {
      translatorEnabled = checked;
      deviceCueKey = '';
      deviceText = '';
      deviceNotice = '';
      storage.set(PREF_KEY, {
        translatorEnabled,
        translatorProbe: {
          canEnhance: probe.canEnhance,
          reason: probe.reason || '',
          status: probe.status || ''
        }
      }).catch(() => {});
      render();
    },
    onWord(token, context, anchor) {
      const lookup = dictionary.lookup(token.key || token.text);
      const saved = vocabKeys(book).includes(lookup.word);
      overlay.openPopover(token, lookup, saved, anchor);
      overlay._pending = { token, lookup, context };
    },
    onVocabAction(token, lookup) {
      const pending = overlay._pending || { context: '' };
      const saved = vocabKeys(book).includes(lookup.word);
      const action = saved
        ? removeWord(storage, lookup.word)
        : addWord(storage, {
          word: lookup.word,
          definition_or_empty: lookup.status === 'hit' ? lookup.translation : '',
          context_sentence: pending.context || '',
          source_url: location.href
        }, new Date().toISOString());
      action.then((next) => {
        book = next;
        overlay.hidePopover();
        render();
      }).catch(() => {});
    }
  });

  function resetPage() {
    if (location.href === pageHref) return false;
    pageHref = location.href;
    tracks = [];
    sourceId = '';
    targetId = '';
    manualTarget = false;
    sourceLoad = null;
    targetLoad = null;
    discovered = false;
    deviceText = '';
    devicePending = false;
    deviceNotice = '';
    deviceCueKey = '';
    udemyRefs = [];
    translateGen += 1;
    loadGen += 1;
    loadKey = '';
    return true;
  }

  function applyTracks(next) {
    tracks = next;
    const choice = chooseDefaultTracks(tracks);
    if (!tracks.some((track) => track.id === sourceId)) sourceId = choice.source ? choice.source.id : '';
    if (!manualTarget) targetId = choice.target ? choice.target.id : '';
    else if (targetId && !tracks.some((track) => track.id === targetId)) targetId = '';
    discovered = true;
    void ensureLoads();
  }

  async function ensureLoads() {
    const source = tracks.find((track) => track.id === sourceId) || null;
    const target = tracks.find((track) => track.id === targetId) || null;
    const key = [location.href, sourceId, targetId].join('|');
    if (key === loadKey) return;
    loadKey = key;
    const gen = ++loadGen;
    sourceLoad = source && Array.isArray(source.cues) ? { ok: true, cues: source.cues } : null;
    targetLoad = target && Array.isArray(target.cues) ? { ok: true, cues: target.cues } : null;
    deviceText = '';
    deviceCueKey = '';
    devicePending = false;
    render();
    const loader = site === 'youtube' ? loadYouTubeCues : loadVttCues;
    const href = location.href;
    const [src, tgt] = await Promise.all([
      source ? loader(source, href) : Promise.resolve({ ok: true, cues: [] }),
      target ? loader(target, href) : Promise.resolve(null)
    ]);
    if (gen !== loadGen || href !== location.href) return;
    sourceLoad = src;
    targetLoad = target ? tgt : null;
    deviceCueKey = '';
    render();
  }

  function scheduleTranslation(sourceCue) {
    const cueKey = sourceCue ? sourceCue.id : '';
    const text = sourceCue ? sourceCue.text : '';
    if (!probe.canEnhance || !translatorEnabled || !text) {
      translateGen += 1;
      const dirty = deviceText || devicePending || deviceNotice || deviceCueKey !== cueKey;
      deviceCueKey = cueKey;
      deviceText = '';
      devicePending = false;
      if (!probe.canEnhance) deviceNotice = '';
      if (dirty) queueMicrotask(render);
      return;
    }
    if (deviceCueKey === cueKey) return;
    deviceCueKey = cueKey;
    deviceText = '';
    devicePending = true;
    deviceNotice = '';
    const gen = ++translateGen;
    queueMicrotask(render);
    translateOnDevice(globalThis.Translator, text, DEFAULT_PAIR).then((result) => {
      if (gen !== translateGen) return;
      devicePending = false;
      if (result.ok) {
        deviceText = result.text;
        deviceNotice = '';
      } else {
        deviceText = '';
        deviceNotice = result.reason;
      }
      render();
    });
  }

  function render() {
    if (resetPage()) {
      overlay.update(buildFrame({
        currentTimeSec: 0,
        sourceCues: [],
        targetState: { status: 'loading' },
        translatorProbe: probe,
        translatorEnabled: false
      }), { tracks: [], sourceId: '', targetId: '', translatorEnabled, vocabKeys: [] });
      return;
    }
    const currentTimeSec = video ? Number(video.currentTime) || 0 : 0;
    let targetState;
    if (!discovered) targetState = { status: 'loading' };
    else if (tracks.length === 0) targetState = { status: 'absent' };
    else targetState = targetStateFromLoad(tracks.find((track) => track.id === targetId) || null, targetLoad);
    const sourceMessage = sourceLoad && sourceLoad.ok === false ? MESSAGES.fetchFailed : '';
    const frame = buildFrame({
      currentTimeSec,
      sourceCues: sourceLoad && sourceLoad.ok ? sourceLoad.cues : [],
      sourceMessage,
      targetState,
      translatorProbe: probe,
      translatorEnabled,
      deviceText,
      devicePending,
      deviceNotice
    });
    overlay.update(frame, {
      tracks,
      sourceId,
      targetId,
      translatorEnabled,
      vocabKeys: vocabKeys(book)
    });
    if (video) overlay.position(video);
    const sourceCue = selectActiveCue(sourceLoad && sourceLoad.ok ? sourceLoad.cues : [], currentTimeSec * 1000);
    const logKey = `${pageHref}|${sourceCue ? sourceCue.id : ''}|${frame.target.mode}|${frame.target.text}`;
    if (logKey !== loggedKey) {
      loggedKey = logKey;
      console.info('[bsv] cue', JSON.stringify({
        href: pageHref,
        currentTime: currentTimeSec,
        source: frame.source.text,
        targetMode: frame.target.mode,
        target: frame.target.text,
        at: Date.now()
      }));
    }
    scheduleTranslation(sourceCue);
  }

  function refreshUdemy() {
    const current = findVideo('udemy');
    const cueTracks = tracksFromCueSnapshots(snapshotTextTracks(current));
    const urlTracks = normalizeUdemyRefs(udemyRefs, location.href);
    applyTracks(mergeTrackSources(cueTracks, urlTracks));
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== 'bsv-page') return;
    if (data.href && data.href !== location.href) return;
    if (site === 'youtube' && data.type === 'youtube-caption-tracks') {
      const normalized = Array.isArray(data.tracks)
        ? normalizeYouTubeTracks(data.tracks, location.href)
        : captionTracksFromPlayerResponse(data.playerResponse, location.href);
      applyTracks(normalized);
    }
    if (site === 'udemy' && data.type === 'udemy-caption-refs') {
      udemyRefs = Array.isArray(data.refs) ? data.refs : [];
      refreshUdemy();
    }
  });

  if (site === 'youtube') injectHook('content/youtube-page-hook.js');
  else injectHook('content/udemy-page-hook.js');

  probeTranslator(globalThis.Translator, DEFAULT_PAIR).then((result) => {
    probe = result;
    if (translatorEnabled && !probe.canEnhance) translatorEnabled = false;
    storage.set(PREF_KEY, {
      translatorEnabled,
      translatorProbe: {
        canEnhance: probe.canEnhance,
        reason: probe.reason || '',
        status: probe.status || ''
      }
    }).catch(() => {});
    render();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.vocabBook) return;
    readBook(storage).then((next) => {
      book = next;
      render();
    }).catch(() => {});
  });

  window.setInterval(() => {
    if (resetPage()) {
      if (stopSync) stopSync();
      stopSync = null;
      video = null;
      render();
    }
    const nextVideo = findVideo(site);
    if (nextVideo !== video) {
      if (stopSync) stopSync();
      video = nextVideo;
      stopSync = video ? attachVideoSync(video, () => render()) : null;
      if (site === 'udemy') refreshUdemy();
    } else if (site === 'udemy' && video) {
      const cueTracks = tracksFromCueSnapshots(snapshotTextTracks(video));
      if (cueTracks.length > 0 && tracks.every((track) => track.cues == null)) {
        refreshUdemy();
      }
    }
    if (video) overlay.position(video);
  }, 500);

  window.setTimeout(() => {
    if (!discovered) {
      discovered = true;
      render();
    }
  }, 4000);

  render();
}
