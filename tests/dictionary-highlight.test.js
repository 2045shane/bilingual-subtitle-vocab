import assert from 'node:assert/strict';
import test from 'node:test';
import { createDictionary } from '../extension/src/dictionary.js';
import { tokenize } from '../extension/src/highlight.js';

const dictionary = createDictionary({
  Hello: 'int. 你好',
  world: '',
  cat: 'n. 猫'
});

test('dictionary hit, empty gloss, and miss', () => {
  const hit = dictionary.lookup('HELLO');
  assert.equal(hit.status, 'hit');
  assert.equal(hit.word, 'hello');
  assert.equal(hit.translation, 'int. 你好');
  const empty = dictionary.lookup('World');
  assert.equal(empty.status, 'hit');
  assert.equal(empty.label, '（词条无译文）');
  const miss = dictionary.lookup('nosuchword');
  assert.equal(miss.status, 'miss');
  assert.equal(miss.label, '未收录');
  assert.equal(miss.translation, '');
  assert.equal(dictionary.lookup('  cat  ').word, 'cat');
});

test('english highlights use word boundaries', () => {
  const keys = ['cat', 'don'];
  const tokens = tokenize("a category, the cat, some cats, and don't.", keys);
  const highlighted = tokens.filter((token) => token.highlighted).map((token) => token.text);
  assert.deepEqual(highlighted, ['cat']);
  assert.ok(tokens.some((token) => token.text === 'category' && !token.highlighted));
  assert.ok(tokens.some((token) => token.text === 'cats' && !token.highlighted));
  assert.ok(tokens.some((token) => token.text === "don't" && !token.highlighted));
  const possessive = tokenize("category's", ['cat', 'category']);
  assert.deepEqual(possessive.map((token) => token.text), ["category's"]);
  assert.equal(possessive[0].highlighted, false);
  assert.equal(tokenize('Cat', ['cat'])[0].highlighted, true);
});

test('chinese highlights use vocab longest match', () => {
  const tokens = tokenize('中国人爱cat', ['中国', '中', '人', 'cat']);
  assert.deepEqual(tokens.filter((token) => token.lang !== 'other').map((token) => [token.text, token.highlighted]), [
    ['中国', true],
    ['人', true],
    ['爱', false],
    ['cat', true]
  ]);
  const single = tokenize('中', ['中国', '中']);
  assert.equal(single[0].text, '中');
  assert.equal(single[0].highlighted, true);
  const spaced = tokenize('中 国', ['中国']);
  assert.equal(spaced[0].highlighted, false);
  assert.equal(spaced[2].highlighted, false);
});
