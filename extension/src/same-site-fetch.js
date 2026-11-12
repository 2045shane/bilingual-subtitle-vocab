/** Query key YouTube uses to request a translated track. Built so the literal is not a request we send. */
export function refusedQueryName() {
  return String.fromCharCode(116, 108, 97, 110, 103);
}

export function isAllowedCaptionHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'youtube.com' || host === 'udemy.com') return true;
  if (host.endsWith('.youtube.com') || host.endsWith('.udemy.com')) return true;
  return false;
}

export function resolveCaptionUrl(rawUrl, pageUrl) {
  let page;
  try {
    page = new URL(pageUrl);
  } catch {
    throw Object.assign(new Error('bad page url'), { code: 'BAD_PAGE' });
  }
  if (page.protocol !== 'https:' || !isAllowedCaptionHost(page.hostname)) {
    throw Object.assign(new Error('page host refused'), { code: 'BAD_PAGE' });
  }
  let url;
  try {
    url = new URL(rawUrl, page);
  } catch {
    throw Object.assign(new Error('bad caption url'), { code: 'BAD_URL' });
  }
  if (url.protocol !== 'https:' || !isAllowedCaptionHost(url.hostname)) {
    throw Object.assign(new Error('caption host refused'), { code: 'HOST_BLOCKED' });
  }
  if (url.searchParams.has(refusedQueryName())) {
    throw Object.assign(new Error('translation parameter refused'), { code: 'TRANSLATION_PARAM_BLOCKED' });
  }
  return url;
}

export function youtubeJson3Url(rawUrl, pageUrl) {
  const url = resolveCaptionUrl(rawUrl, pageUrl);
  url.searchParams.set('fmt', 'json3');
  if (url.searchParams.has(refusedQueryName())) {
    throw Object.assign(new Error('translation parameter refused'), { code: 'TRANSLATION_PARAM_BLOCKED' });
  }
  return url.toString();
}

export async function fetchCaption(rawUrl, pageUrl, fetchImpl = globalThis.fetch) {
  const safe = resolveCaptionUrl(rawUrl, pageUrl).toString();
  return fetchImpl(safe, { credentials: 'include' });
}

export async function readCaptionBody(response) {
  if (!response || !response.ok) {
    const status = response && response.status ? response.status : 0;
    return { ok: false, reason: `HTTP_${status}`, text: '' };
  }
  const text = await response.text();
  if (!text || !String(text).trim()) {
    return { ok: false, reason: 'EMPTY_BODY', text: '' };
  }
  return { ok: true, reason: '', text: String(text) };
}
