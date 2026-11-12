import { selectActiveCue } from './cue-sync.js';
import { MESSAGES } from './messages.js';
import { DEVICE_LABEL } from './translator-gate.js';

/**
 * Target text is only a platform cue, a gap (empty string), or an explicit
 * empty/error/loading message. There is no translated fallback field.
 */
export function buildFrame(input) {
  const currentTimeMs = Number(input.currentTimeSec) * 1000;
  const sourceCue = selectActiveCue(input.sourceCues || [], currentTimeMs);
  const targetState = input.targetState || { status: 'missing' };
  let target;
  if (targetState.status === 'missing') {
    target = { mode: 'empty', text: '', message: MESSAGES.noTarget };
  } else if (targetState.status === 'error') {
    target = { mode: 'error', text: '', message: MESSAGES.fetchFailed };
  } else if (targetState.status === 'loading') {
    target = { mode: 'loading', text: '', message: MESSAGES.loading };
  } else if (targetState.status === 'absent') {
    target = { mode: 'absent', text: '', message: MESSAGES.noCaptions };
  } else {
    const cue = selectActiveCue(targetState.cues || [], currentTimeMs);
    target = { mode: 'cue', text: cue ? cue.text : '', message: '' };
  }
  const probe = input.translatorProbe || {
    canEnhance: false,
    reason: MESSAGES.translatorMissing
  };
  const showDevice = Boolean(probe.canEnhance && input.translatorEnabled && input.deviceText);
  return {
    source: {
      mode: sourceCue ? 'cue' : 'gap',
      text: sourceCue ? sourceCue.text : '',
      message: input.sourceMessage || ''
    },
    target,
    device: {
      label: DEVICE_LABEL,
      visible: showDevice,
      text: showDevice ? String(input.deviceText) : '',
      pending: Boolean(probe.canEnhance && input.translatorEnabled && input.devicePending && !input.deviceText),
      controlDisabled: !probe.canEnhance,
      controlReason: !probe.canEnhance
        ? (probe.reason || MESSAGES.translatorMissing)
        : (input.deviceNotice || '')
    }
  };
}
