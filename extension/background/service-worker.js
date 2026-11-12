import { buildDataUrl } from '../src/export-vocab.js';

const MAX_EXPORT_CHARS = 5000000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'bsv-download') return;
  if (!sender || sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'rejected' });
    return;
  }
  const text = typeof message.text === 'string' ? message.text : '';
  if (text.length > MAX_EXPORT_CHARS) {
    sendResponse({ ok: false, error: 'too large' });
    return;
  }
  const mime = message.mime === 'text/csv' ? 'text/csv' : 'application/json';
  const filename = typeof message.filename === 'string' && message.filename
    ? message.filename
    : 'vocab-book.json';
  sendResponse({
    ok: true,
    url: buildDataUrl(text, mime),
    filename
  });
});
