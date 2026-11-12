import { MESSAGES } from '../src/messages.js';
import { tokenize } from '../src/highlight.js';

function lineBox(role) {
  const node = document.createElement('div');
  node.className = `bsv-line bsv-line-${role}`;
  node.dataset.role = role;
  return node;
}

function fillWords(container, text, keys, onWord) {
  container.textContent = '';
  const tokens = tokenize(text, keys);
  for (const token of tokens) {
    if (token.lang === 'other') {
      container.append(document.createTextNode(token.text));
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = token.highlighted ? 'bsv-word bsv-hit' : 'bsv-word';
    button.textContent = token.text;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onWord(token, text, button);
    });
    container.append(button);
  }
}

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

export function mountOverlay(doc, handlers) {
  const root = doc.createElement('div');
  root.id = 'bsv-root';
  root.className = 'bsv-root';
  root.lang = 'zh-Hans';
  root.hidden = true;

  const sourceLine = lineBox('source');
  const targetLine = lineBox('target');
  const deviceLine = lineBox('device');
  const notice = doc.createElement('div');
  notice.className = 'bsv-notice';
  notice.hidden = true;

  const sourceSelect = doc.createElement('select');
  sourceSelect.setAttribute('aria-label', MESSAGES.source);
  const targetSelect = doc.createElement('select');
  targetSelect.setAttribute('aria-label', MESSAGES.target);
  const toggle = doc.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = 'bsv-device-toggle';
  const toggleLabel = doc.createElement('label');
  toggleLabel.htmlFor = 'bsv-device-toggle';
  toggleLabel.textContent = MESSAGES.deviceToggle;
  const reason = doc.createElement('p');
  reason.className = 'bsv-reason';

  sourceSelect.addEventListener('change', () => handlers.onSource(sourceSelect.value));
  targetSelect.addEventListener('change', () => handlers.onTarget(targetSelect.value));
  toggle.addEventListener('change', () => handlers.onToggle(toggle.checked));

  const tools = doc.createElement('div');
  tools.className = 'bsv-tools';
  const sourceWrap = doc.createElement('label');
  sourceWrap.className = 'bsv-field';
  sourceWrap.append(MESSAGES.source, sourceSelect);
  const targetWrap = doc.createElement('label');
  targetWrap.className = 'bsv-field';
  targetWrap.append(MESSAGES.target, targetSelect);
  const deviceWrap = doc.createElement('div');
  deviceWrap.className = 'bsv-device-control';
  deviceWrap.append(toggle, toggleLabel);
  tools.append(sourceWrap, targetWrap, deviceWrap);

  const popover = doc.createElement('div');
  popover.className = 'bsv-popover';
  popover.hidden = true;
  const popWord = doc.createElement('div');
  popWord.className = 'bsv-pop-word';
  const popDef = doc.createElement('div');
  popDef.className = 'bsv-pop-def';
  const popAction = doc.createElement('button');
  popAction.type = 'button';
  popover.append(popWord, popDef, popAction);

  root.append(sourceLine, targetLine, deviceLine, notice, tools, reason, popover);
  doc.documentElement.append(root);

  let trackKey = '';
  let lastSource = null;
  let lastTarget = null;
  let lastDevice = null;
  let vocabKey = '';

  function hidePopover() {
    popover.hidden = true;
  }

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hidePopover();
  });

  function showMessage(container, message) {
    container.textContent = '';
    const span = doc.createElement('span');
    span.className = 'bsv-message';
    span.textContent = message;
    container.append(span);
  }

  return {
    root,
    hidePopover,
    destroy() {
      root.remove();
    },
    position(video) {
      const rect = video.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      root.style.left = `${Math.round(rect.left)}px`;
      root.style.width = `${Math.round(rect.width)}px`;
      const height = root.offsetHeight || 120;
      const top = rect.bottom - 72 - height;
      root.style.top = `${Math.round(Math.max(rect.top + 8, top))}px`;
    },
    openPopover(token, lookup, saved, anchor) {
      popWord.textContent = token.text;
      popDef.textContent = lookup.label;
      popAction.textContent = saved ? MESSAGES.remove : MESSAGES.add;
      popAction.onclick = () => handlers.onVocabAction(token, lookup, saved);
      popover.hidden = false;
      if (anchor && anchor.getBoundingClientRect) {
        const rect = anchor.getBoundingClientRect();
        const host = root.getBoundingClientRect();
        popover.style.left = `${Math.max(8, rect.left - host.left)}px`;
      }
    },
    update(frame, model) {
      const ids = (model.tracks || []).map((track) => track.id).join('|');
      if (ids !== trackKey) {
        trackKey = ids;
        sourceSelect.textContent = '';
        targetSelect.textContent = '';
        targetSelect.append(option('', MESSAGES.noTargetOption));
        for (const track of model.tracks || []) {
          const label = `${track.languageName || track.languageCode}${track.kind === 'asr' ? ' · asr' : ''}`;
          sourceSelect.append(option(track.id, label));
          targetSelect.append(option(track.id, label));
        }
      }
      if (doc.activeElement !== sourceSelect) sourceSelect.value = model.sourceId || '';
      if (doc.activeElement !== targetSelect) targetSelect.value = model.targetId || '';
      toggle.disabled = frame.device.controlDisabled;
      toggle.checked = Boolean(model.translatorEnabled) && !frame.device.controlDisabled;
      reason.textContent = frame.device.controlReason || '';

      const keys = model.vocabKeys || [];
      const keyFingerprint = keys.join('\n');
      const sourceRender = frame.source.message || frame.source.text;
      if (sourceRender !== lastSource || keyFingerprint !== vocabKey) {
        if (frame.source.message) showMessage(sourceLine, frame.source.message);
        else if (frame.source.text) fillWords(sourceLine, frame.source.text, keys, handlers.onWord);
        else sourceLine.textContent = '';
        lastSource = sourceRender;
      }
      const targetRender = frame.target.mode === 'cue' ? frame.target.text : frame.target.message;
      if (targetRender !== lastTarget || (frame.target.mode === 'cue' && keyFingerprint !== vocabKey)) {
        if (frame.target.mode === 'cue') {
          if (frame.target.text) fillWords(targetLine, frame.target.text, keys, handlers.onWord);
          else targetLine.textContent = '';
        } else {
          showMessage(targetLine, frame.target.message);
        }
        lastTarget = targetRender;
      }
      const deviceRender = frame.device.visible ? `${frame.device.label}:${frame.device.text}` : (frame.device.pending ? 'pending' : '');
      if (deviceRender !== lastDevice || (frame.device.visible && keyFingerprint !== vocabKey)) {
        deviceLine.textContent = '';
        if (frame.device.visible) {
          const badge = doc.createElement('span');
          badge.className = 'bsv-badge';
          badge.textContent = frame.device.label;
          const words = doc.createElement('span');
          deviceLine.append(badge, doc.createTextNode(' '), words);
          fillWords(words, frame.device.text, keys, handlers.onWord);
          deviceLine.hidden = false;
        } else if (frame.device.pending) {
          showMessage(deviceLine, `${frame.device.label}…`);
          deviceLine.hidden = false;
        } else {
          deviceLine.hidden = true;
        }
        lastDevice = deviceRender;
      }
      if (frame.target.mode === 'absent') {
        notice.hidden = false;
        notice.textContent = frame.target.message;
        targetLine.hidden = true;
      } else {
        notice.hidden = true;
        targetLine.hidden = false;
      }
      vocabKey = keyFingerprint;
    }
  };
}
