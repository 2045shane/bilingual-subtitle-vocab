import { VOCAB_KEY } from './constants.js';
import { normalizeVocabWord } from './highlight.js';

export const EXPORT_FIELDS = [
  'word',
  'definition_or_empty',
  'context_sentence',
  'source_url',
  'created_at'
];

export function emptyBook() {
  return { version: 1, items: [] };
}

function asText(value) {
  return value == null ? '' : String(value);
}

export function normalizeBook(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const seen = new Set();
  const normalized = [];
  for (const item of items) {
    const word = normalizeVocabWord(item?.word);
    const createdAt = asText(item?.created_at);
    if (!word || !createdAt || seen.has(word)) continue;
    seen.add(word);
    normalized.push({
      word,
      definition_or_empty: asText(item?.definition_or_empty),
      context_sentence: asText(item?.context_sentence),
      source_url: asText(item?.source_url),
      created_at: createdAt
    });
  }
  return { version: 1, items: normalized };
}

export function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    async get(key) {
      return data[key];
    },
    async set(key, value) {
      data[key] = value;
    }
  };
}

export function createChromeArea(area) {
  return {
    async get(key) {
      const result = await area.get(key);
      return result ? result[key] : undefined;
    },
    async set(key, value) {
      await area.set({ [key]: value });
    }
  };
}

export async function readBook(storage) {
  return normalizeBook(await storage.get(VOCAB_KEY));
}

export async function writeBook(storage, book) {
  const normalized = normalizeBook(book);
  await storage.set(VOCAB_KEY, normalized);
  return normalized;
}

export async function addWord(storage, input, nowIso) {
  const book = await readBook(storage);
  const word = normalizeVocabWord(input?.word);
  if (!word) throw new Error('empty word');
  const existing = book.items.find((item) => item.word === word);
  const entry = {
    word,
    definition_or_empty: asText(input?.definition_or_empty),
    context_sentence: asText(input?.context_sentence),
    source_url: asText(input?.source_url),
    created_at: existing ? existing.created_at : (nowIso || new Date().toISOString())
  };
  const items = book.items.filter((item) => item.word !== word);
  items.push(entry);
  return writeBook(storage, { version: 1, items });
}

export async function removeWord(storage, word) {
  const key = normalizeVocabWord(word);
  const book = await readBook(storage);
  return writeBook(storage, {
    version: 1,
    items: book.items.filter((item) => item.word !== key)
  });
}

export function vocabKeys(book) {
  return normalizeBook(book).items.map((item) => item.word);
}
