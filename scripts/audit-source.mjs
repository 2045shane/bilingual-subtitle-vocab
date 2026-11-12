import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isAllowedCaptionHost } from '../extension/src/same-site-fetch.js';

export function forbiddenNeedles() {
  return [
    ['translate', 'googleapis', 'com'].join('.'),
    ['translate', 'google'].join('.'),
    `${String.fromCharCode(116, 108, 97, 110, 103)}=`,
    ['@google-cloud', 'translate'].join('/'),
    `google${'-'}translate`
  ];
}

const URL_RE = /https?:\/\/[^\s"'`<>\\)]+/g;
const SKIP_HOST_CHECK = new Set(['extension/vendor/ecdict-subset.json']);

function normalizeRel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

function hostsIn(text) {
  const found = [];
  for (const match of text.matchAll(URL_RE)) {
    const cleaned = match[0].replace(/[*),.;]+$/g, '').replace(/\*+$/g, '');
    try {
      found.push(new URL(cleaned).hostname.toLowerCase());
    } catch {
      found.push(match[0]);
    }
  }
  return found;
}

export function auditSourceText(relPath, text) {
  const errors = [];
  for (const needle of forbiddenNeedles()) {
    if (text.includes(needle)) errors.push(`${relPath}: forbidden pattern`);
  }
  if (text.includes('URL.createObjectURL') || text.includes('webkitURL.createObjectURL')) {
    errors.push(`${relPath}: URL.createObjectURL is not allowed`);
  }
  if (/\bfetch\s*\(/.test(text)) {
    errors.push(`${relPath}: raw fetch( is not allowed; use the same-site or extension-resource helpers`);
  }
  if (/\bXMLHttpRequest\b/.test(text) || /sendBeacon\s*\(/.test(text) || /new\s+WebSocket\s*\(/.test(text) || /new\s+EventSource\s*\(/.test(text)) {
    errors.push(`${relPath}: extra network client is not allowed`);
  }
  if (!SKIP_HOST_CHECK.has(relPath)) {
    for (const host of hostsIn(text)) {
      if (!isAllowedCaptionHost(host)) errors.push(`${relPath}: non-allowed host ${host}`);
    }
  }
  return errors;
}

export function auditRepository(root) {
  const files = [];
  walk(path.join(root, 'extension'), files);
  const packageJson = path.join(root, 'package.json');
  if (fs.existsSync(packageJson)) files.push(packageJson);
  const errors = [];
  for (const file of files) {
    if (!/\.(js|mjs|html|css|json)$/.test(file)) continue;
    const relPath = normalizeRel(root, file);
    const text = fs.readFileSync(file, 'utf8');
    errors.push(...auditSourceText(relPath, text));
  }
  return errors;
}

function isCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isCli()) {
  const errors = auditRepository(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('audit ok');
}
