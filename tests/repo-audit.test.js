import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FIXTURES } from '../extension/src/constants.js';
import { createDictionary } from '../extension/src/dictionary.js';
import { auditRepository, auditSourceText, forbiddenNeedles } from '../scripts/audit-source.mjs';

test('repository source passes the cloud-translation audit', () => {
  const errors = auditRepository(process.cwd());
  assert.deepEqual(errors, []);
});

test('the audit flags cloud endpoints, third-party fetches, and object URLs', () => {
  const [googleapis, google, query] = forbiddenNeedles();
  const badFetch = auditSourceText('extension/src/example.js', `fetch("https://${googleapis}/v2")`);
  assert.equal(badFetch.length > 0, true);
  const badHost = auditSourceText('extension/src/example.js', 'const u = "https://evil.example/x";');
  assert.equal(badHost.some((line) => line.includes('evil.example')), true);
  const badQuery = auditSourceText('extension/src/example.js', `const u = "https://www.youtube.com/api/timedtext?${query}";`);
  assert.equal(badQuery.length > 0, true);
  const badBlob = auditSourceText('extension/background/service-worker.js', 'URL.createObjectURL(new Blob())');
  assert.equal(badBlob.some((line) => line.includes('createObjectURL')), true);
  assert.equal(auditSourceText('extension/src/example.js', `const note = "${google}";`).length > 0, true);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsv-audit-'));
  fs.writeFileSync(path.join(temp, 'note.txt'), 'not scanned');
  assert.equal(fs.existsSync(temp), true);
});

test('bundled dictionary, license, manifest, and readme stay honest', () => {
  const file = 'extension/vendor/ecdict-subset.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bytes = fs.statSync(file).size;
  assert.equal(data.meta.count, Object.keys(data.entries).length);
  assert.equal(data.meta.count, 7005);
  assert.equal(bytes, 521125);
  assert.equal(data.meta.license, 'MIT');
  assert.match(data.entries.hello, /喂/);
  assert.match(data.entries.world, /世界/);
  const lookup = createDictionary(data.entries);
  assert.equal(lookup.lookup('hello').status, 'hit');
  assert.equal(lookup.lookup('zzqxvnotaword').label, '未收录');
  for (const value of Object.values(data.entries)) {
    assert.equal(String(value).includes('http://') || String(value).includes('https://'), false);
  }

  const license = fs.readFileSync('third_party/ECDICT/LICENSE', 'utf8');
  assert.equal(fs.readFileSync('extension/vendor/ECDICT-LICENSE.txt', 'utf8'), license);
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2025 Linwei/);

  const readme = fs.readFileSync('README.md', 'utf8');
  assert.match(readme, /BILINGUAL-SUBTITLE-CUT-2026-11-09-v1/);
  assert.match(readme, /Feature Map/);
  assert.match(readme, /本地/);
  assert.match(readme, /local/i);
  assert.match(readme, /7005/);
  assert.match(readme, /521125/);
  assert.match(readme, /https:\/\/github.com\/skywind3000\/ECDICT/);
  assert.match(readme, /Copyright \(c\) 2025 Linwei/);
  assert.match(readme, /Permission is hereby granted/);
  assert.match(readme, /非官方/);
  assert.match(readme, /unofficial/i);
  for (const fixture of FIXTURES) {
    assert.match(readme, new RegExp(fixture.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(FIXTURES.map((item) => item.id).join(','), 'YT+,YT-,Udemy+,Udemy-');

  const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  const hosts = [
    ...(manifest.host_permissions || []),
    ...manifest.content_scripts.flatMap((script) => script.matches),
    ...manifest.web_accessible_resources.flatMap((item) => item.matches)
  ];
  for (const pattern of hosts) {
    assert.match(pattern, /^https:\/\/(\*\.)?(www\.|m\.)?(youtube|udemy)\.com\/\*$/);
  }
  assert.equal(fs.existsSync('extension/content/content.js'), true);
  const worker = fs.readFileSync('extension/background/service-worker.js', 'utf8');
  assert.equal(worker.includes('URL.' + 'createObjectURL'), false);
  assert.match(worker, /buildDataUrl/);
});
