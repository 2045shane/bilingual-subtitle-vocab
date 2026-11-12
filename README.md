# 双语字幕生词 / Bilingual Subtitle Vocab

Cut id: `BILINGUAL-SUBTITLE-CUT-2026-11-09-v1`

Locked 2026-11-09 by Shane. This repository implements only that cut. QA has not started (round 0/3). This README does not claim a QA pass.

## 免责声明 / Unofficial disclaimer

本扩展是非官方学习工具，与 YouTube、Udemy、Google 没有附属、赞助或合作关系。它只读取这些网站已经提供的字幕轨，不代表平台本身。

This extension is an unofficial study tool. It is not affiliated with, endorsed by, or sponsored by YouTube, Udemy, or Google. It only reads caption tracks those sites already expose.

## Feature Map

| Feature | v1 | Later cut |
| --- | --- | --- |
| YouTube / Udemy existing original + target tracks | yes | — |
| Cue error and pause/seek cleanup ≤ 500ms | yes | — |
| On-device Chrome `Translator`, labeled 设备端 | optional | — |
| Cloud machine translation, or a local-then-cloud fallback | no | another cut |
| YouTube timedtext translation query parameter as a bilingual track | no | another cut |
| Offline ECDICT click-lookup, highlight, vocab book, JSON/CSV export | yes | larger lexicon |
| Creem / Dodo / IAP / any payment | no | another cut |
| Other sites (Netflix, Coursera, and the rest) | no | another cut |
| Account or cloud sync | no | another cut |

模块级地图见 [FEATURE_MAP.md](FEATURE_MAP.md)。The module and UI map for agents is in [FEATURE_MAP.md](FEATURE_MAP.md).

## 「本地」是什么 / What “local” means

这里的「本地」只指下面四件事：

1. 字幕句子来自 YouTube 或 Udemy **已经存在**的字幕轨，在页面里叠加显示。字幕文本不会被送到翻译服务器。
2. 可选增强只调用这个浏览器里的 Chrome `Translator`。只有 `availability` 返回 `available` 时才能打开，输出标为「设备端」。`downloadable` 和 `downloading` 也保持禁用，本切不会发起语言包下载。接口不存在或未就绪时，控件禁用并写明原因，双轨主路径继续工作。
3. 释义来自扩展内打包的 ECDICT 高频子集。查询不再发网络请求。词不在子集里时显示「未收录」。词库文件没载入时显示「词库未载入」，不用「未收录」冒充。
4. 生词本存在 `chrome.storage.local`。导出是 JSON 或 CSV，通过 `data:` URL 下载。没有账号，没有同步服务，没有支付。

不在「本地」里、本切也不做：云端机器翻译、把 YouTube 的翻译查询参数当成目标语轨、Google Translate、支付、其他网站。

“Local” in this cut means only the following:

1. Subtitle lines come from caption tracks YouTube or Udemy already expose, then rendered on the page. Caption text is not sent to a translation server.
2. The optional enhancement calls Chrome’s `Translator` in this browser. The control can be turned on only when `availability` is `available`. Output is labeled 设备端. `downloadable` and `downloading` stay disabled; this cut does not start a language-pack download. If the API is missing or not ready, the control is disabled and the reason is shown. The dual-track path still runs.
3. Definitions come from the ECDICT high-frequency subset packaged in the extension. Lookup does not send a network request. A missing word shows 未收录. If the dictionary file itself failed to load, the UI shows 词库未载入 instead of pretending it was a normal miss.
4. The vocab book is stored in `chrome.storage.local`. Export is a JSON or CSV download via a `data:` URL. There is no account, no sync service, and no payment.

Not local, and not in this cut: cloud machine translation, treating YouTube’s timedtext translation query parameter as a target track, Google Translate, payment, or any other site.

## 权限 / Permissions

| Permission | Why |
| --- | --- |
| `storage` | Vocab book and the on-device enhancement toggle in `chrome.storage.local` |
| `https://www.youtube.com/*`, `https://youtube.com/*`, `https://m.youtube.com/*` | Read existing YouTube caption tracks and show the overlay |
| `https://www.udemy.com/*`, `https://udemy.com/*` | Read existing Udemy caption tracks and show the overlay |

没有 `downloads`、`tabs`、`identity`、`<all_urls>`，也没有支付或账号权限。字幕请求只允许 `youtube.com` / `udemy.com` 及其子域，并且必须是 `https`。带翻译查询参数的地址会被拒绝，不会改成另一条请求。

No `downloads`, `tabs`, `identity`, `<all_urls>`, payment, or account permission. Caption requests are allowed only for `https` hosts on `youtube.com` or `udemy.com` (including subdomains). A URL that carries the timedtext translation query parameter is rejected rather than rewritten.

## ECDICT

来源 / source: <https://github.com/skywind3000/ECDICT>

许可证 / license: MIT. The full license text shipped with this subset:

```
MIT License

Copyright (c) 2025 Linwei

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

同一份文本在 `third_party/ECDICT/LICENSE` 和 `extension/vendor/ECDICT-LICENSE.txt`。

子集规则（T3，本仓库选定并写死）：读取 ECDICT `ecdict.csv`，保留 `frq`（当代语料库词频顺序，数字越小越常用）为 1 到 8000（含）的行。`word` 转成小写，`translation` 里的换行并成「；」。同一单词保留更小的 `frq`。不打包音标、英文释义、音频 URL。

结果：`extension/vendor/ecdict-subset.json` 有 **7005** 个词条，文件大小 **521125** 字节。不是 8000，因为 1–8000 里有空缺的词频序号。查询是整词精确匹配，没有词形还原，也没有一次点选多个单词。

Subset rule (T3, chosen here and recorded): from ECDICT `ecdict.csv`, keep rows whose `frq` rank (contemporary corpus frequency rank; lower is more frequent) is an integer from 1 through 8000 inclusive. `word` is lowercased. Newlines inside `translation` are joined with 「；」. Duplicate words keep the lower rank. Phonetics, English definitions, and audio URLs are not packaged.

Result: `extension/vendor/ecdict-subset.json` contains **7005** entries and is **521125** bytes. The count is not 8000 because some ranks in that range are absent. Lookup is an exact token match, with no stemming and no multi-word click.

重新生成（需要本地的 `ecdict.csv`，测试不会下载它）：

```bash
node scripts/build-ecdict-subset.mjs /path/to/ecdict.csv
```

## 高亮规则 / Highlight rule

英文：token 是 `[A-Za-z]+(?:'[A-Za-z]+)?`。大小写不敏感。`cat` 不会命中 `category`、`cats` 或 `don't`。连字符会把词切开。

中文（可测的词表最长匹配）：生词本里含汉字的条目只做精确切片。从当前位置尝试词表中最长的命中；没有命中就输出一个不高亮的字。不跨越匹配失败的位置。例：词表有「中国」和「中」时，「中国人」先标「中国」。

English tokens match `[A-Za-z]+(?:'[A-Za-z]+)?`, case-insensitive. `cat` does not highlight `category`, `cats`, or `don't`. Hyphens split words.

Chinese uses a testable vocab-lexicon longest match. A vocab item that contains a CJK character matches only as an exact slice. At each index the longest vocab slice wins; otherwise one unhighlighted character is emitted. In 「中国人」, with both 「中国」 and 「中」 in the book, 「中国」 wins.

## 设备端增强 / On-device enhancement

默认语言对是常量 `en` ↔ `zh-Hans`（T5）。传给 `Translator` 的也是这一对，不改写成别的代码，也不在失败后改走云端。

`Translator` 是否能在扩展 content script 里用，本环境没有实机结论（T4）。探测的是 content script 的 `globalThis.Translator`。没有这个对象时，控件禁用，原因是「当前环境没有 Translator API（content script 全局对象不可用）」。主路径不依赖它。

The default pair is the constant `en` ↔ `zh-Hans` (T5). That same pair is passed to `Translator`. It is not remapped, and a failure does not switch to a cloud translator.

Whether `Translator` exists inside an extension content script was not verified on a device here (T4). The probe reads `globalThis.Translator` in the content script. When that object is missing, the control is disabled with the reason 「当前环境没有 Translator API（content script 全局对象不可用）」. The main path does not wait on it.

## 未知 / Unknowns

| ID | 状态 | 本仓库怎么处理 |
| --- | --- | --- |
| T1 | YouTube timedtext / PoToken 是否稳定：**未知**。2026-11-12 在本环境对一条真实 `baseUrl` 追加 `fmt=json3`（没有翻译参数）得到 HTTP 200 且空 body。多数视频页返回 `LOGIN_REQUIRED`（“Sign in to confirm you’re not a bot”），读不到 `captionTracks`。 | 空 body、非 cue 负载、或请求失败 → 「字幕轨读取失败。未使用云翻译。」不改走翻译参数或别的主机。 |
| T2 | Udemy 如何把字幕轨暴露给页面：**未知**。课程落地页的字幕语言列表可以读到；播放器 DOM、`textTracks` 和 VTT 地址没有在实机确认。直接请求 Udemy 在本环境返回 403。 | 先读 `video.textTracks`；再从页面 JSON / `<track>` 里收集同站 `https` 字幕 URL。找不到或取失败就空态/错误态。不把第三方 CDN 加进权限。 |
| T3 | 子集大小：**已选定** 7005 词 / 521125 字节。见上。 | 写在本文件和 `ecdict-subset.json` 的 `meta`。 |
| T4 | `Translator` 在 content script：**未知**。 | 可选。不可用不挡双轨。 |
| T5 | 默认语言对：**定为常量** `en` / `zh-Hans`。裸 `zh`、`zh-CN`、`zh_CN` 归到 `zh-Hans`；`zh-TW` / `zh-Hant` 不充当默认目标语。 | 见 `extension/src/constants.js` 与 `normalizeLang`。 |

## 固定测试片 / Fixture URLs

QA 应各开一次。空态不能代替正例。

| ID | URL | 本环境结论 |
| --- | --- | --- |
| YT+ | https://www.youtube.com/watch?v=iG9CE55wbtY | **best guess，未直播验证。** 本环境打开该页得到 `LOGIN_REQUIRED`，没有读到 `captionTracks`。不要把它当成已经确认的双轨正例。 |
| YT- | https://www.youtube.com/watch?v=dQw4w9WgXcQ | **轨道列表已观察（2026-11-12），扩展叠层未在浏览器里验证。** `captionTracks` 为 `en`、`en`（asr）、`de-DE`、`ja`、`pt-BR`、`es-419`。`zh-Hans` / `zh-Hant` 只出现在 `translationLanguages`，不在 `captionTracks`。默认目标语 `zh-Hans` 缺失，应走空态。对其中 en 与 ja 的 `baseUrl` 加 `fmt=json3` 后，响应是 HTTP 200 空 body（T1）。 |
| Udemy+ | https://www.udemy.com/course/business-bootcamp/ | **落地页字幕行已观察，播放器未验证。** 公开课程页有 “English [Auto], Chinese (Simplified) [Auto]”。这是课程页，不是已确认的 lecture 播放器地址。T2 仍未知。 |
| Udemy- | https://www.udemy.com/course/pencil-drawing-for-beginners/ | **落地页字幕行已观察，播放器未验证。** 公开课程页的字幕行为 “English [Auto],”，该行没有中文。播放器是否真的没有 `zh-Hans` 轨仍未知。 |

YT+ is a best guess and was **not** verified live. YT-’s caption-track list was read from the watch page; the extension overlay was not. Both Udemy rows were read from public course pages, not from a lecture player.

## 范围外 / Out of scope

Creem、Dodo、IAP 或任何支付；云端机器翻译以及「先本地再云端」；把 YouTube 翻译查询参数当作双语；承诺所有设备都有本地模型；抄商店扩展或逆向它们；Netflix、Meet、Teams、Coursera 等其他站点；账号或云同步；用无轨空态冒充双轨正例。

Out of scope: Creem, Dodo, IAP, or any payment; cloud machine translation and “local then cloud”; using YouTube’s translation query parameter as bilingual captions; promising an on-device model on every machine; copying or reverse engineering store extensions; Netflix, Meet, Teams, Coursera, or other sites; account or cloud sync; treating a missing-track empty state as a positive dual-track pass.

## 开发 / Develop

安装未打包的扩展：Chrome `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选择 `extension/`。需要先有 `extension/content/content.js`（`npm test` 或 `npm run build` 会生成）。

Load the unpacked extension from the `extension/` directory. `extension/content/content.js` is generated by `npm test` or `npm run build`.

```bash
npm test
```

`npm test` 会构建 content script、跑 `node --test`、跑 `node scripts/audit-source.mjs`，并检查 `extension/content/content.js` 没有未提交的构建漂移。

审计失败条件：扩展源码（含打包后的 content script 和 `package.json`）出现云翻译端点、翻译查询参数、`URL.createObjectURL`、原始 `fetch(`、或其他非 YouTube/Udemy 的 `http(s)` 主机。词典 JSON 里的 ECDICT 项目地址只作为出处，不作为请求。服务工作线程用 `data:` URL 做导出，不用 `createObjectURL`。

The audit fails if extension source, the built content script, or `package.json` contains a cloud translate endpoint, the timedtext translation query parameter, `URL.createObjectURL`, a raw `fetch(`, or an `http(s)` host that is not YouTube or Udemy. The ECDICT project URL inside the dictionary JSON is attribution, not a request. The service worker builds export downloads as `data:` URLs.
