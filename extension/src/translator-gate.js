import { MESSAGES } from './messages.js';
import { DEFAULT_PAIR } from './constants.js';

export const DEVICE_LABEL = MESSAGES.device;

const STATUS_REASONS = {
  unavailable: 'Translator 不可用（unavailable）。没有云翻译替代。',
  downloadable: '设备端语言包未就绪（downloadable）。未下载，也没有云翻译替代。',
  downloading: '设备端语言包仍在下载（downloading）。增强暂不可用。'
};

/**
 * Only status "available" enables enhancement.
 * downloadable/downloading stay disabled so this cut does not start a model download.
 */
export async function probeTranslator(api, pair = DEFAULT_PAIR) {
  if (!api || typeof api.availability !== 'function') {
    return {
      available: false,
      canEnhance: false,
      status: 'missing',
      reason: MESSAGES.translatorMissing
    };
  }
  let status;
  try {
    status = await api.availability({
      sourceLanguage: pair.sourceLanguage,
      targetLanguage: pair.targetLanguage
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return {
      available: false,
      canEnhance: false,
      status: 'error',
      reason: `Translator.availability 失败：${message}`
    };
  }
  if (status === 'available') {
    return { available: true, canEnhance: true, status, reason: '' };
  }
  return {
    available: false,
    canEnhance: false,
    status: status == null ? 'unknown' : String(status),
    reason: STATUS_REASONS[status] || `Translator 状态不可用（${status}）。没有云翻译替代。`
  };
}

export async function translateOnDevice(api, text, pair = DEFAULT_PAIR) {
  const probe = await probeTranslator(api, pair);
  if (!probe.canEnhance) {
    return { ok: false, label: DEVICE_LABEL, text: '', reason: probe.reason, probe };
  }
  try {
    const translator = await api.create({
      sourceLanguage: pair.sourceLanguage,
      targetLanguage: pair.targetLanguage
    });
    const translated = await translator.translate(text);
    return {
      ok: true,
      label: DEVICE_LABEL,
      text: String(translated),
      reason: '',
      probe
    };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return {
      ok: false,
      label: DEVICE_LABEL,
      text: '',
      reason: `设备端翻译失败：${message}`,
      probe
    };
  }
}
