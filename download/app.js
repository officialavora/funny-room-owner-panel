(function () {
  'use strict';

  // Only adapts the page's emphasis. It never forwards visitors or hides options.
  function detectPlatform(device) {
    var userAgent = device.userAgent || '';
    var platform = device.platform || '';
    var touchPoints = Number(device.maxTouchPoints) || 0;
    if (/iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && touchPoints > 1)) {
      return 'ios';
    }
    if (/Android/i.test(userAgent)) {
      return 'android';
    }
    return 'desktop';
  }

  var platform = detectPlatform(navigator);
  document.body.setAttribute('data-platform', platform);
  var note = document.getElementById('device-note');
  if (note) {
    note.textContent = {
      android: 'On Android? Get Funny Room from Google Play.',
      ios: 'On iPhone or iPad? This version is not available yet.',
      desktop: 'For Android phones and tablets · Google Play'
    }[platform];
  }
}());
