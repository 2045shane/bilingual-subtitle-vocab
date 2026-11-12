/**
 * English tokens: letters with an optional internal apostrophe.
 * "cat" does not match inside "category" or "cats".
 * Hyphens split words.
 *
 * Chinese rule (testable, vocab-lexicon longest match):
 * A vocab item that contains a CJK character is matched only as an exact
 * slice. At each index the longest vocab slice wins. If none matches, one
 * unhighlighted character is emitted. Matching does not cross a failed index.
 */
const CJK = /[\u3400-\u9fff]/;

export function normalizeVocabWord(word) {
  const value = String(word || '').trim();
  if (!value) return '';
  if (CJK.test(value)) return value;
  if (/[A-Za-z]/.test(value)) return value.toLowerCase();
  return value;
}

function isCjkChar(char) {
  return CJK.test(char);
}

export function tokenize(text, vocabKeys) {
  const source = String(text || '');
  const english = new Set();
  const chinese = new Set();
  const lengths = [];
  for (const raw of vocabKeys || []) {
    const key = normalizeVocabWord(raw);
    if (!key) continue;
    if (CJK.test(key)) {
      chinese.add(key);
      if (!lengths.includes(key.length)) lengths.push(key.length);
    } else if (/[A-Za-z]/.test(key)) {
      english.add(key);
    }
  }
  lengths.sort((a, b) => b - a);

  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/[A-Za-z]/.test(char)) {
      const match = /^[A-Za-z]+(?:'[A-Za-z]+)?/.exec(source.slice(index));
      const word = match[0];
      const key = word.toLowerCase();
      tokens.push({
        text: word,
        key,
        lang: 'en',
        highlighted: english.has(key)
      });
      index += word.length;
      continue;
    }
    if (isCjkChar(char)) {
      let matched = '';
      for (const length of lengths) {
        if (index + length > source.length) continue;
        const slice = source.slice(index, index + length);
        if (chinese.has(slice)) {
          matched = slice;
          break;
        }
      }
      if (matched) {
        tokens.push({
          text: matched,
          key: matched,
          lang: 'zh',
          highlighted: true
        });
        index += matched.length;
      } else {
        tokens.push({
          text: char,
          key: char,
          lang: 'zh',
          highlighted: false
        });
        index += 1;
      }
      continue;
    }
    tokens.push({
      text: char,
      key: '',
      lang: 'other',
      highlighted: false
    });
    index += 1;
  }
  return tokens;
}
