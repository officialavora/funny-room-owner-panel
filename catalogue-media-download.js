// Download saved catalogue media without writing catalogue or reward state.
export function savedMediaURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid saved media URL');
  return url;
}

export function addSavedMediaDownloads(form, item, fields, toast) {
  if (!item) return;
  const doc = form.ownerDocument;
  const actions = doc.createElement('div');
  actions.className = 'actions';
  for (const [field, label] of fields) {
    let url;
    try { url = savedMediaURL(item[field]); } catch { continue; }
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'mini';
    button.textContent = 'Download saved ' + label;
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        const response = await fetch(url.href, {credentials:'omit', signal:AbortSignal.timeout(30000)});
        if (!response.ok) throw Error('Media download failed');
        const blob = await response.blob();
        if (!blob.size || !/^(image|audio|video)\//i.test(blob.type) && blob.type !== 'application/octet-stream') throw Error('Saved URL did not return media');
        if (!form.isConnected) return;
        const link = doc.createElement('a');
        const objectURL = URL.createObjectURL(blob);
        const basename = url.pathname.split('/').pop() || 'media';
        const extension = /\.[a-z0-9]{2,5}$/i.exec(basename)?.[0] || '';
        const title = String(item.name || item.display_label || item.code || 'catalogue').replace(/[^a-z0-9_-]+/gi,'-').slice(0,70);
        link.href = objectURL;
        link.download = title + '-' + label.replace(/[^a-z0-9_-]+/gi,'-') + extension;
        doc.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectURL),60000);
      } catch (error) {
        if (form.isConnected) toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    };
    actions.appendChild(button);
  }
  if (actions.childElementCount) form.insertBefore(actions, form.querySelector('h3')?.nextSibling || null);
}
