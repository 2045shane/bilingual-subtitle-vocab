(function () {
  var SOURCE = 'bsv-page';

  function nameOf(track) {
    var name = track && track.name;
    if (!name) return '';
    if (typeof name === 'string') return name;
    if (typeof name.simpleText === 'string') return name.simpleText;
    if (name.runs && name.runs.length) {
      var text = '';
      for (var i = 0; i < name.runs.length; i += 1) {
        text += (name.runs[i] && name.runs[i].text) || '';
      }
      return text;
    }
    return '';
  }

  function readTracks() {
    var response = window.ytInitialPlayerResponse;
    var renderer = response && response.captions && response.captions.playerCaptionsTracklistRenderer;
    var list = renderer && renderer.captionTracks;
    if (!list || !list.length) return [];
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var track = list[i];
      if (!track || typeof track.baseUrl !== 'string' || typeof track.languageCode !== 'string') continue;
      out.push({
        languageCode: track.languageCode,
        languageName: nameOf(track),
        kind: track.kind || '',
        baseUrl: track.baseUrl
      });
    }
    return out;
  }

  function publish() {
    window.postMessage({
      source: SOURCE,
      type: 'youtube-caption-tracks',
      href: location.href,
      tracks: readTracks()
    }, location.origin);
  }

  publish();
  document.addEventListener('yt-navigate-finish', publish);
  var tries = 0;
  var timer = window.setInterval(function () {
    tries += 1;
    publish();
    if (tries >= 10) window.clearInterval(timer);
  }, 700);
}());
