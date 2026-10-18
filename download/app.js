(() => {
  'use strict';
  const url = 'https://officialavora.github.io/funny-room-owner-panel/download/';
  const button = document.getElementById('share-button');
  const status = document.getElementById('share-status');
  const fallback = document.getElementById('copy-fallback');
  const input = document.getElementById('share-url');
  if (!button || !status || !fallback || !input) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '';
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({title:'Funny Room',text:'Voice rooms, moments, chat and virtual gifts. Get Funny Room on Google Play.',url});
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
      }
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url);
        status.textContent = 'Link copied. Share it with your people.';
      } catch (_) {
        fallback.hidden = false;
        input.focus();
        input.select();
        status.textContent = 'Select and copy the link below.';
      }
    } finally { button.disabled = false; }
  });
})();

