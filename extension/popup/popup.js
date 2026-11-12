import { MESSAGES } from '../src/messages.js';
import { PREF_KEY } from '../src/constants.js';
import { createChromeArea, readBook, removeWord } from '../src/vocab-book.js';
import { toCsv, toJson } from '../src/export-vocab.js';

const storage = createChromeArea(chrome.storage.local);
const list = document.querySelector('#list');
const empty = document.querySelector('#empty');
const probe = document.querySelector('#probe');

function download(text, mime, filename) {
  chrome.runtime.sendMessage({
    type: 'bsv-download',
    text,
    mime,
    filename
  }, (response) => {
    if (!response || !response.ok || !response.url) return;
    const link = document.createElement('a');
    link.href = response.url;
    link.download = response.filename || filename;
    document.body.append(link);
    link.click();
    link.remove();
  });
}

async function render() {
  const book = await readBook(storage);
  const prefs = await storage.get(PREF_KEY);
  const status = prefs && prefs.translatorProbe;
  if (!status) {
    probe.textContent = '尚未在 YouTube/Udemy 播放页检测 Translator。';
  } else if (status.canEnhance) {
    probe.textContent = '设备端 Translator 可用。增强开关在播放页。';
  } else {
    probe.textContent = status.reason || MESSAGES.translatorMissing;
  }
  list.textContent = '';
  empty.hidden = book.items.length !== 0;
  for (const item of book.items) {
    const row = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = item.definition_or_empty
      ? `${item.word} — ${item.definition_or_empty}`
      : item.word;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = MESSAGES.remove;
    button.addEventListener('click', async () => {
      await removeWord(storage, item.word);
      await render();
    });
    row.append(text, button);
    list.append(row);
  }
}

document.querySelector('#export-json').addEventListener('click', async () => {
  const book = await readBook(storage);
  download(toJson(book), 'application/json', 'vocab-book.json');
});

document.querySelector('#export-csv').addEventListener('click', async () => {
  const book = await readBook(storage);
  download(toCsv(book), 'text/csv', 'vocab-book.csv');
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') void render();
});

void render();
