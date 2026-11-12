import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDataUrl, toCsv, toJson } from '../extension/src/export-vocab.js';
import { EXPORT_FIELDS, addWord, createMemoryStorage, readBook, removeWord } from '../extension/src/vocab-book.js';

test('vocab add and remove round-trip in local storage', async () => {
  const storage = createMemoryStorage();
  const first = await addWord(storage, {
    word: 'Hello',
    definition_or_empty: 'int. 你好',
    context_sentence: 'Hello there',
    source_url: 'https://www.youtube.com/watch?v=abc'
  }, '2026-11-12T00:00:00.000Z');
  assert.equal(first.items[0].word, 'hello');
  assert.equal(first.items[0].created_at, '2026-11-12T00:00:00.000Z');
  const updated = await addWord(storage, {
    word: 'hello',
    definition_or_empty: 'int. 你好呀',
    context_sentence: 'Hello again',
    source_url: 'https://www.udemy.com/course/x/'
  }, '2026-11-13T00:00:00.000Z');
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].created_at, '2026-11-12T00:00:00.000Z');
  assert.equal(updated.items[0].definition_or_empty, 'int. 你好呀');
  const reread = await readBook(storage);
  assert.equal(reread.items[0].context_sentence, 'Hello again');
  const removed = await removeWord(storage, 'HELLO');
  assert.deepEqual(removed.items, []);
  assert.deepEqual((await readBook(storage)).items, []);
});

test('json and csv exports use the locked fields', async () => {
  const storage = createMemoryStorage();
  await addWord(storage, {
    word: 'cat, "small"',
    definition_or_empty: 'n. 猫',
    context_sentence: 'a cat',
    source_url: 'https://www.youtube.com/watch?v=abc'
  }, '2026-11-12T01:02:03.000Z');
  const book = await readBook(storage);
  const rows = JSON.parse(toJson(book));
  assert.deepEqual(Object.keys(rows[0]), EXPORT_FIELDS);
  assert.equal(rows[0].word, 'cat, "small"');
  assert.equal(rows[0].definition_or_empty, 'n. 猫');
  assert.equal(rows[0].context_sentence, 'a cat');
  assert.equal(rows[0].source_url, 'https://www.youtube.com/watch?v=abc');
  assert.equal(rows[0].created_at, '2026-11-12T01:02:03.000Z');
  const csv = toCsv(book).replace(/^\uFEFF/, '');
  const [header, line] = csv.trim().split(/\r\n/);
  assert.equal(header, EXPORT_FIELDS.join(','));
  assert.equal(line, '"cat, ""small""",n. 猫,a cat,https://www.youtube.com/watch?v=abc,2026-11-12T01:02:03.000Z');
  const url = buildDataUrl(toJson(book), 'application/json');
  assert.equal(url.startsWith('data:application/json;charset=utf-8,'), true);
  assert.equal(decodeURIComponent(url.slice(url.indexOf(',') + 1)), toJson(book));
});
