(function () {
  var SOURCE = 'bsv-page';
  var LANG_KEYS = ['languageCode', 'language', 'lang', 'locale', 'locale_id', 'srclang'];
  var URL_KEYS = ['url', 'src', 'file', 'captionUrl', 'caption_url'];

  function allowed(value) {
    try {
      var url = new URL(value, location.href);
      var host = url.hostname.toLowerCase();
      var udemy = host === 'udemy.com' || host.slice(-10) === '.udemy.com';
      return url.protocol === 'https:' && udemy;
    } catch (error) {
      return false;
    }
  }

  function pick(object, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = object[keys[i]];
      if (typeof value === 'string' && value) return value;
    }
    return '';
  }

  function walk(node, depth, state, out) {
    if (node == null || depth > 8 || state.seen > 20000 || out.length >= 40) return;
    state.seen += 1;
    if (Object.prototype.toString.call(node) === '[object Array]') {
      for (var i = 0; i < node.length; i += 1) walk(node[i], depth + 1, state, out);
      return;
    }
    if (typeof node !== 'object') return;
    var rawUrl = pick(node, URL_KEYS);
    var language = pick(node, LANG_KEYS);
    if (rawUrl && language && allowed(rawUrl)) {
      out.push({
        languageCode: language,
        languageName: typeof node.languageName === 'string' ? node.languageName : language,
        url: new URL(rawUrl, location.href).toString()
      });
    }
    var keys = Object.keys(node);
    for (var k = 0; k < keys.length; k += 1) walk(node[keys[k]], depth + 1, state, out);
  }

  function collect() {
    var out = [];
    var selector = 'script[type="application/json"], script#__NEXT_DATA__';
    var scripts = document.querySelectorAll(selector);
    for (var i = 0; i < scripts.length; i += 1) {
      var text = scripts[i].textContent || '';
      if (!text || text.length > 2000000) continue;
      try {
        walk(JSON.parse(text), 0, { seen: 0 }, out);
      } catch (error) {
        /* ignore non-json blocks */
      }
    }
    var tracks = document.querySelectorAll('track[src]');
    for (var t = 0; t < tracks.length; t += 1) {
      var src = tracks[t].getAttribute('src') || '';
      var lang = tracks[t].getAttribute('srclang') || '';
      if (src && lang && allowed(src)) {
        out.push({
          languageCode: lang,
          languageName: tracks[t].label || lang,
          url: new URL(src, location.href).toString()
        });
      }
    }
    return out;
  }

  function publish() {
    window.postMessage({
      source: SOURCE,
      type: 'udemy-caption-refs',
      href: location.href,
      refs: collect()
    }, location.origin);
  }

  publish();
  var tries = 0;
  var timer = window.setInterval(function () {
    tries += 1;
    publish();
    if (tries >= 8) window.clearInterval(timer);
  }, 1000);
}());
