import { MESSAGES } from './messages.js';
import { normalizeVocabWord } from './highlight.js';

export function createDictionary(entries) {
  const map = new Map();
  if (entries && typeof entries === 'object') {
    for (const [word, translation] of Object.entries(entries)) {
      const key = normalizeVocabWord(word);
      if (!key || map.has(key)) continue;
      map.set(key, translation == null ? '' : String(translation));
    }
  }
  return {
    size: map.size,
    lookup(word) {
      const key = normalizeVocabWord(word);
      if (!key || !map.has(key)) {
        return { status: 'miss', word: key, translation: '', label: MESSAGES.miss };
      }
      const translation = map.get(key);
      return {
        status: 'hit',
        word: key,
        translation,
        label: translation ? translation : MESSAGES.hitEmpty
      };
    }
  };
}

export function unavailableDictionary() {
  return {
    size: 0,
    lookup(word) {
      return {
        status: 'unavailable',
        word: normalizeVocabWord(word),
        translation: '',
        label: MESSAGES.dictNotLoaded
      };
    }
  };
}
