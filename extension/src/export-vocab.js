import { EXPORT_FIELDS, normalizeBook } from './vocab-book.js';

export function toExportRows(book) {
  return normalizeBook(book).items.map((item) => {
    const row = {};
    for (const field of EXPORT_FIELDS) row[field] = item[field] ?? '';
    return row;
  });
}

export function toJson(book) {
  return JSON.stringify(toExportRows(book), null, 2);
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** UTF-8 BOM so spreadsheet apps keep the Chinese header and cells. */
export function toCsv(book) {
  const rows = toExportRows(book);
  const lines = [EXPORT_FIELDS.join(',')];
  for (const row of rows) {
    lines.push(EXPORT_FIELDS.map((field) => escapeCsv(row[field])).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function buildDataUrl(text, mime) {
  const type = mime || 'application/json';
  return `data:${type};charset=utf-8,${encodeURIComponent(String(text))}`;
}
