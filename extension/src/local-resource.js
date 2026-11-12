/** Load a file packaged with the extension. Remote http(s) paths are refused. */
export async function fetchExtensionJson(relativePath, deps = {}) {
  const path = String(relativePath || '');
  if (!path || path.includes('://') || path.startsWith('//') || path.startsWith('data:')) {
    throw new Error('refusing remote dictionary path');
  }
  const runtime = deps.runtime || globalThis.chrome?.runtime;
  if (!runtime || typeof runtime.getURL !== 'function') {
    throw new Error('extension runtime missing');
  }
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const url = runtime.getURL(path);
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error('local resource failed');
  return response.json();
}
