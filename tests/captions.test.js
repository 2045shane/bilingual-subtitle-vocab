import assert from 'node:assert/strict';
import test from 'node:test';
import { loadVttCues, loadYouTubeCues, targetStateFromLoad } from '../extension/src/caption-load.js';
import { parseWebVtt, parseYouTubeJson3 } from '../extension/src/parse-captions.js';
import { refusedQueryName, resolveCaptionUrl, youtubeJson3Url } from '../extension/src/same-site-fetch.js';
import {
  captionTracksFromPlayerResponse,
  chooseDefaultTracks,
  mergeTrackSources,
  normalizeLang,
  tracksFromCueSnapshots
} from '../extension/src/tracks.js';

const page = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';
const blocked = `${String.fromCharCode(116, 108, 97, 110, 103)}=zh-Hans`;

test('json3 and vtt fixtures become cues', () => {
  const cues = parseYouTubeJson3({
    events: [
      { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'hello\n' }, { utf8: 'world' }] },
      { tStartMs: 1000, segs: [{ utf8: 'next' }] },
      { tStartMs: 3000, aAppend: 1 }
    ]
  });
  assert.equal(cues[0].text, 'hello world');
  assert.equal(cues[0].endMs, 1000);
  assert.equal(cues[1].text, 'next');
  assert.equal(cues[1].endMs, 3000);
  assert.equal(cues.length, 2);

  const vtt = parseWebVtt('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\n<c>Hi</c> there\n\n');
  assert.deepEqual(vtt, [{ id: 'vtt-0-1000', startMs: 1000, endMs: 2500, text: 'Hi there' }]);
  assert.deepEqual(parseYouTubeJson3({}), []);
  assert.deepEqual(parseWebVtt('not cues'), []);
});

test('caption urls stay on the page site and reject a translation parameter', () => {
  const raw = 'https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en';
  const url = youtubeJson3Url(raw, page);
  assert.match(url, /fmt=json3/);
  assert.equal(url.includes(blocked), false);
  assert.equal(url.includes(refusedQueryName() + '='), false);
  assert.throws(() => resolveCaptionUrl(`${raw}&${blocked}`, page), /translation parameter/);
  assert.throws(() => youtubeJson3Url('https://evil.example/captions', page), /caption host/);
  assert.throws(() => resolveCaptionUrl('https://notudemy.com/a.vtt', 'https://www.udemy.com/course/x/'), /caption host/);
  assert.equal(
    resolveCaptionUrl('/api/timedtext?v=aaaaaaaaaaa&lang=ja', page).hostname,
    'www.youtube.com'
  );
});

test('player response uses caption tracks only', () => {
  const tracks = captionTracksFromPlayerResponse({
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          { languageCode: 'en', kind: 'asr', baseUrl: 'https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en&kind=asr', name: { simpleText: 'English' } },
          { languageCode: 'en', baseUrl: 'https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en', name: { simpleText: 'English' } },
          { languageCode: 'zh-CN', baseUrl: 'https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=zh-CN', name: { simpleText: 'Chinese' } },
          { languageCode: 'zh-Hant', baseUrl: 'https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=zh-Hant' },
          { languageCode: 'fr', baseUrl: `https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&${blocked}` }
        ],
        translationLanguages: [{ languageCode: 'zh-Hans', languageName: { simpleText: 'Chinese' } }]
      }
    }
  }, page);
  assert.deepEqual(tracks.map((track) => track.normalized), ['en', 'en', 'zh-Hans', 'zh-Hant']);
  const choice = chooseDefaultTracks(tracks);
  assert.equal(choice.source.kind, '');
  assert.equal(choice.source.normalized, 'en');
  assert.equal(choice.target.normalized, 'zh-Hans');
  const noChinese = chooseDefaultTracks(tracks.filter((track) => track.normalized !== 'zh-Hans'));
  assert.equal(noChinese.target, null);
});

test('language normalization and udemy cue snapshots', () => {
  assert.equal(normalizeLang('en_US'), 'en');
  assert.equal(normalizeLang('zh_CN'), 'zh-Hans');
  assert.equal(normalizeLang('zh'), 'zh-Hans');
  assert.equal(normalizeLang('zh-TW'), 'zh-Hant');
  const cues = tracksFromCueSnapshots([{
    languageCode: 'zh_CN',
    languageName: 'Chinese',
    cues: [{ startMs: 0, endMs: 500, text: '你好' }]
  }]);
  const urls = [{
    id: 'u',
    languageCode: 'en',
    normalized: 'en',
    languageName: 'English',
    kind: '',
    baseUrl: 'https://www.udemy.com/captions/en.vtt',
    cues: null
  }];
  const merged = mergeTrackSources(cues, urls);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].normalized, 'zh-Hans');
  assert.equal(mergeTrackSources(cues, [{ ...urls[0], normalized: 'zh-Hans', languageCode: 'zh-CN' }]).length, 1);
});

test('empty timedtext is an error and is not fetched from another host', async () => {
  const calls = [];
  const track = {
    baseUrl: 'https://www.youtube.com/api/timedtext?v=aaaaaaaaaaa&lang=en',
    cues: null
  };
  const empty = await loadYouTubeCues(track, page, async (url) => {
    calls.push(url);
    return { ok: true, status: 200, async text() { return '  '; } };
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'EMPTY_BODY');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /fmt=json3/);
  assert.equal(calls[0].includes(blocked), false);

  let called = false;
  const blockedHost = await loadYouTubeCues({
    baseUrl: 'https://evil.example/timedtext',
    cues: null
  }, page, async () => {
    called = true;
    return { ok: true, status: 200, async text() { return '{}'; } };
  });
  assert.equal(blockedHost.ok, false);
  assert.equal(blockedHost.reason, 'HOST_BLOCKED');
  assert.equal(called, false);
  assert.deepEqual(targetStateFromLoad({ id: 't' }, empty), { status: 'error', reason: 'EMPTY_BODY' });
  assert.equal(targetStateFromLoad(null, null).status, 'missing');
  assert.equal(targetStateFromLoad({ id: 't' }, null).status, 'loading');
});

test('vtt loader accepts an in-memory cue list and a same-site file', async () => {
  const local = await loadVttCues({
    cues: [{ id: 's', startMs: 0, endMs: 10, text: 'ready' }]
  }, 'https://www.udemy.com/course/x/', async () => {
    throw new Error('should not fetch');
  });
  assert.equal(local.cues[0].text, 'ready');
  const remote = await loadVttCues({
    baseUrl: 'https://www.udemy.com/static/en.vtt',
    cues: null
  }, 'https://www.udemy.com/course/x/', async () => ({
    ok: true,
    status: 200,
    async text() { return 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n'; }
  }));
  assert.equal(remote.ok, true);
  assert.equal(remote.cues[0].text, 'Hello');
});
