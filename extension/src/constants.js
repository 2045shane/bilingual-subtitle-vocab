/** Locked default pair (T5). Do not remap these for a cloud or alternate API. */
export const DEFAULT_SOURCE_LANG = 'en';
export const DEFAULT_TARGET_LANG = 'zh-Hans';

export const DEFAULT_PAIR = {
  sourceLanguage: DEFAULT_SOURCE_LANG,
  targetLanguage: DEFAULT_TARGET_LANG
};

export const VOCAB_KEY = 'vocabBook';
export const PREF_KEY = 'bsvPrefs';

/** Playback refresh. Must stay at or under MAX_SYNC_LAG_MS. */
export const REFRESH_INTERVAL_MS = 200;
export const MAX_SYNC_LAG_MS = 500;

export const DICTIONARY_PATH = 'vendor/ecdict-subset.json';

/**
 * Fixed QA fixtures. verifiedLive is false unless this environment read the
 * player/caption list or the public course page. See README for the evidence.
 */
export const FIXTURES = [
  {
    id: 'YT+',
    url: 'https://www.youtube.com/watch?v=iG9CE55wbtY',
    verifiedLive: false
  },
  {
    id: 'YT-',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    verifiedLive: true
  },
  {
    id: 'Udemy+',
    url: 'https://www.udemy.com/course/business-bootcamp/',
    verifiedLive: false
  },
  {
    id: 'Udemy-',
    url: 'https://www.udemy.com/course/pencil-drawing-for-beginners/',
    verifiedLive: false
  }
];
