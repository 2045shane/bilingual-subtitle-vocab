/**
 * Build the committed ECDICT high-frequency subset.
 *
 * Input: ecdict.csv from https://github.com/skywind3000/ECDICT (MIT).
 * Filter: column `frq` (contemporary corpus frequency rank) is an integer
 * from 1 through 8000 inclusive. Lower rank = more frequent. Rank 0 and
 * blank ranks are excluded. Kept fields: lowercased `word` and `translation`
 * (newlines joined with 「；」). Duplicate words keep the lower rank.
 *
 * This script is not part of `npm test`. The subset JSON is committed.
 *
 * Usage: node scripts/build-ecdict-subset.mjs /path/to/ecdict.csv
 */
import fs from 'node:fs';
import path from 'node:path';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('usage: node scripts/build-ecdict-subset.mjs /path/to/ecdict.csv');
  process.exit(1);
}

const RANK_MIN = 1;
const RANK_MAX = 8000;
const outPath = path.resolve('extension/vendor/ecdict-subset.json');

function cleanTranslation(value) {
  return String(value || '')
    .replace(/\\n/g, '；')
    .replace(/\s*\n\s*/g, '；')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function forEachRecord(text, onRecord) {
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      onRecord(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    onRecord(row);
  }
}

const text = fs.readFileSync(csvPath, 'utf8');
let header = null;
const kept = new Map();
let rows = 0;

forEachRecord(text, (row) => {
  if (!header) {
    header = row.map((cell) => cell.trim());
    return;
  }
  rows += 1;
  const record = {};
  for (let i = 0; i < header.length; i += 1) record[header[i]] = row[i] ?? '';
  const word = String(record.word || '').trim().toLowerCase();
  if (!word) return;
  const rank = Number.parseInt(String(record.frq || '').trim(), 10);
  if (!Number.isInteger(rank) || rank < RANK_MIN || rank > RANK_MAX) return;
  const translation = cleanTranslation(record.translation);
  const previous = kept.get(word);
  if (!previous || rank < previous.rank) {
    kept.set(word, { rank, translation });
  }
});

const entries = {};
const words = [...kept.keys()].sort((a, b) => a.localeCompare(b));
for (const word of words) entries[word] = kept.get(word).translation;

const meta = {
  name: 'ECDICT high-frequency subset',
  source: 'https://github.com/skywind3000/ECDICT',
  license: 'MIT',
  licenseFile: 'extension/vendor/ECDICT-LICENSE.txt',
  filter: 'ecdict.csv rows whose frq rank is an integer from 1 to 8000 inclusive; word lowercased; translation newlines joined with ；; duplicate words keep the lower rank',
  rankMin: RANK_MIN,
  rankMax: RANK_MAX,
  count: words.length,
  sourceRowsScanned: rows
};

const json = JSON.stringify({ meta, entries });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, json);
const bytes = fs.statSync(outPath).size;
console.log(JSON.stringify({
  count: words.length,
  bytes,
  scanned: rows,
  hasThe: Object.prototype.hasOwnProperty.call(entries, 'the'),
  hasHello: Object.prototype.hasOwnProperty.call(entries, 'hello'),
  hasWorld: Object.prototype.hasOwnProperty.call(entries, 'world'),
  the: entries.the ? entries.the.slice(0, 80) : null,
  hello: entries.hello ? entries.hello.slice(0, 80) : null
}, null, 2));
