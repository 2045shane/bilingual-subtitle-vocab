# Feature map

Agent map for cut `BILINGUAL-SUBTITLE-CUT-2026-11-09-v1`. Product behavior is in `README.md`. This file is the UI and module map.

## Surfaces

| Surface | File | What the learner sees |
| --- | --- | --- |
| Video overlay | `extension/content/overlay-dom.js`, `extension/content/overlay.css` | Two caption lines, optional 设备端 line, track selects, enhancement checkbox, click-word popover |
| Popup | `extension/popup/popup.html` | Vocab list, remove, JSON/CSV export, last Translator probe |
| Service worker | `extension/background/service-worker.js` | Builds a `data:` URL for those downloads |

The overlay stays hidden until a video element is large enough. It is mounted only on `youtube.com`, `www.youtube.com`, `m.youtube.com`, `udemy.com`, and `www.udemy.com`.

## Runtime path

```
page hook (page world)
  youtube: read captionTracks only
  udemy: textTracks are read from the content script;
         hook also posts same-site caption URLs found in JSON or <track>
        │ postMessage source "bsv-page"
        ▼
content script (extension/content/content.js, bundled from entry.js)
  normalize tracks → default pair en / zh-Hans
  fetch captions through fetchCaption (https + youtube/udemy only)
  parse json3 or vtt
  attachVideoSync (200ms + seeking/seeked/pause)
  buildFrame → overlay
  click word → bundled ECDICT → 未收录 or gloss
  add/remove → chrome.storage.local
  optional Translator probe; translate only when availability is "available"
        │ chrome.runtime.sendMessage type "bsv-download"
        ▼
service worker returns a data: URL
popup clicks an <a download>
```

`extension/content/content.js` is generated. Edit `extension/content/*.js` and `extension/src/*.js`, then run `npm run build`.

## Modules

| Module | Responsibility |
| --- | --- |
| `extension/src/constants.js` | `en`, `zh-Hans`, storage keys, 200ms/500ms budget, dictionary path, fixture URLs |
| `extension/src/messages.js` | UI strings, including 未收录, 设备端, and the empty/error copy |
| `extension/src/cue-sync.js` | Active cue selection and the video event binding |
| `extension/src/parse-captions.js` | YouTube json3 and a limited WebVTT reader |
| `extension/src/same-site-fetch.js` | Host allowlist and rejection of the timedtext translation query parameter |
| `extension/src/local-resource.js` | Loads the packaged dictionary. Refuses remote paths |
| `extension/src/caption-load.js` | Turns a track into cues, or an error such as `EMPTY_BODY` |
| `extension/src/tracks.js` | Track normalization, default selection, Udemy snapshot merge |
| `extension/src/dictionary.js` | Exact EN→zh lookup |
| `extension/src/highlight.js` | English word-boundary tokens and Chinese longest-match tokens |
| `extension/src/vocab-book.js` | `chrome.storage.local` book, add/remove |
| `extension/src/export-vocab.js` | JSON, CSV, `data:` URL |
| `extension/src/translator-gate.js` | Availability branching. No cloud fallback |
| `extension/src/view-model.js` | One frame: source line, target line or empty/error, device line |
| `extension/content/youtube-page-hook.js` | Page-world read of `captionTracks` only |
| `extension/content/udemy-page-hook.js` | Page-world caption URL harvest. Best effort; T2 is unknown |
| `extension/manifest.json` | MV3, `storage`, the host list above |
| `scripts/audit-source.mjs` | Fails the build on cloud translate endpoints, raw `fetch(`, other hosts, `URL.createObjectURL` |
| `scripts/build-ecdict-subset.mjs` | Rebuilds the vendored subset. Not part of `npm test` |
| `extension/vendor/ecdict-subset.json` | 7005 entries, 521125 bytes |
| `third_party/ECDICT/LICENSE` | MIT text, Copyright (c) 2025 Linwei |

## States the overlay must not confuse

| Situation | Target line |
| --- | --- |
| Tracks not discovered yet | 正在读取平台字幕轨… |
| No platform tracks | 未发现平台字幕轨。 |
| Source exists, no zh-Hans (and the learner has not picked another existing track) | 无目标语字幕轨。未使用云翻译。 |
| Track exists but the body is empty or the request fails | 字幕轨读取失败。未使用云翻译。 |
| Track exists and currentTime is between cues | blank line, not the empty-state sentence |

A gap is not the missing-track state. A missing target track is not a cue.

## Do not add

- A request that uses YouTube’s timedtext translation query parameter, or any Google Translate host.
- A fallback that runs when `Translator` is missing.
- `URL.createObjectURL` in the service worker. Downloads stay `data:` URLs.
- Host permissions outside YouTube and Udemy.
- Payment, account sync, or a network dictionary.
- A positive fixture that is only the empty state.

## Tests

`npm test` covers cue timing, parsers, same-site URL policy, dictionary hit/miss, both tokenizers, storage plus export fields, Translator branching, the manifest host list, the vendored lexicon, and the source audit.
