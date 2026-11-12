import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PAIR } from '../extension/src/constants.js';
import { probeTranslator, translateOnDevice, DEVICE_LABEL } from '../extension/src/translator-gate.js';
import { buildFrame } from '../extension/src/view-model.js';

function api(status, translate) {
  const calls = [];
  return {
    calls,
    availability: async (pair) => {
      calls.push(['availability', pair]);
      if (status === 'throw') throw new Error('boom');
      return status;
    },
    create: async (pair) => {
      calls.push(['create', pair]);
      if (translate === 'throw') throw new Error('translate failed');
      return { translate: async (text) => translate ?? `设备:${text}` };
    }
  };
}

test('translator stays disabled unless availability is available', async () => {
  const missing = await probeTranslator(undefined, DEFAULT_PAIR);
  assert.equal(missing.canEnhance, false);
  assert.match(missing.reason, /没有 Translator API/);

  for (const status of ['unavailable', 'downloadable', 'downloading', 'nope']) {
    const client = api(status);
    const probe = await probeTranslator(client, DEFAULT_PAIR);
    assert.equal(probe.canEnhance, false);
    assert.equal(client.calls.some((call) => call[0] === 'create'), false);
    const result = await translateOnDevice(client, 'hello', DEFAULT_PAIR);
    assert.equal(result.ok, false);
    assert.equal(result.text, '');
    assert.equal(result.label, DEVICE_LABEL);
    assert.equal(client.calls.some((call) => call[0] === 'create'), false);
  }

  const broken = api('throw');
  const failedProbe = await probeTranslator(broken, DEFAULT_PAIR);
  assert.equal(failedProbe.canEnhance, false);
  assert.match(failedProbe.reason, /boom/);
});

test('available translator is labeled 设备端 and uses the locked pair', async () => {
  const client = api('available', '你好');
  const result = await translateOnDevice(client, 'hello', DEFAULT_PAIR);
  assert.equal(result.ok, true);
  assert.equal(result.text, '你好');
  assert.equal(result.label, '设备端');
  assert.deepEqual(client.calls[0][1], { sourceLanguage: 'en', targetLanguage: 'zh-Hans' });
  assert.deepEqual(client.calls[1][1], { sourceLanguage: 'en', targetLanguage: 'zh-Hans' });

  const failing = api('available', 'throw');
  const bad = await translateOnDevice(failing, 'hello', DEFAULT_PAIR);
  assert.equal(bad.ok, false);
  assert.equal(bad.text, '');
  assert.match(bad.reason, /设备端翻译失败/);
});

test('the frame shows an empty target instead of a translated line', () => {
  const missing = buildFrame({
    currentTimeSec: 0.2,
    sourceCues: [{ id: 'a', startMs: 0, endMs: 1000, text: 'hello' }],
    targetState: { status: 'missing' },
    translatorProbe: { canEnhance: false, reason: '当前环境没有 Translator API（content script 全局对象不可用）' },
    translatorEnabled: true,
    deviceText: 'should not show'
  });
  assert.equal(missing.source.text, 'hello');
  assert.equal(missing.target.mode, 'empty');
  assert.equal(missing.target.text, '');
  assert.equal(missing.target.message, '无目标语字幕轨。未使用云翻译。');
  assert.equal(missing.device.visible, false);
  assert.equal(missing.device.controlDisabled, true);
  assert.match(missing.device.controlReason, /Translator API/);

  const gap = buildFrame({
    currentTimeSec: 5,
    sourceCues: [{ id: 'a', startMs: 0, endMs: 1000, text: 'hello' }],
    targetState: { status: 'ready', cues: [{ id: 'b', startMs: 0, endMs: 1000, text: '你好' }] },
    translatorProbe: { canEnhance: true, reason: '' },
    translatorEnabled: false
  });
  assert.equal(gap.source.text, '');
  assert.equal(gap.target.mode, 'cue');
  assert.equal(gap.target.text, '');
  assert.equal(gap.target.message, '');

  const device = buildFrame({
    currentTimeSec: 0.2,
    sourceCues: [{ id: 'a', startMs: 0, endMs: 1000, text: 'hello' }],
    targetState: { status: 'ready', cues: [{ id: 'b', startMs: 0, endMs: 1000, text: '你好' }] },
    translatorProbe: { canEnhance: true, reason: '' },
    translatorEnabled: true,
    deviceText: '喂'
  });
  assert.equal(device.target.text, '你好');
  assert.equal(device.device.visible, true);
  assert.equal(device.device.label, '设备端');
  assert.equal(device.device.text, '喂');
  assert.equal(device.device.controlDisabled, false);

  const failed = buildFrame({
    currentTimeSec: 0.2,
    sourceCues: [],
    targetState: { status: 'error' },
    translatorProbe: { canEnhance: false, reason: 'Translator 不可用（unavailable）。没有云翻译替代。' },
    translatorEnabled: false
  });
  assert.equal(failed.target.mode, 'error');
  assert.equal(failed.target.message, '字幕轨读取失败。未使用云翻译。');
  assert.equal(failed.target.text, '');
});
