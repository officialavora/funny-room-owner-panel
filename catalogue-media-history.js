// Stage only saved media fields. Existing Save handlers still check current revisions.
export function historicalMedia(rows, fields, current) {
  const seen = new Set([JSON.stringify(fields.map(field => current[field] ?? ''))]);
  const versions = [];
  for (const row of rows) {
    const before = row.before_data ?? row.metadata?.previous;
    if (!before || !fields.every(field => Object.hasOwn(before, field))) continue;
    const values = fields.map(field => before[field] ?? '');
    if (!values.every(value => typeof value === 'string')) continue;
    const key = JSON.stringify(values);
    if (seen.has(key)) continue;
    seen.add(key);
    versions.push({date:row.created_at, values});
  }
  return versions;
}

export function addMediaHistory(form, item, {client, action, target, id, fields, fileFields, toast}) {
  if (!item || !client || !id) return;
  const doc = form.ownerDocument;
  const section = doc.createElement('section');
  section.className = 'section';
  const load = doc.createElement('button');
  load.type = 'button';
  load.className = 'mini';
  load.textContent = 'Load previous media';
  const choices = doc.createElement('div');
  section.append(load, choices);
  form.append(section);
  load.onclick = async () => {
    load.disabled = true;
    choices.replaceChildren();
    try {
      const {data,error} = await client.from('audit_log').select('created_at,before_data,metadata')
        .eq('action',action).eq('target_type',target).eq('target_id',id)
        .order('created_at',{ascending:false}).limit(30);
      if (error) throw error;
      if (!form.isConnected) return;
      const versions = historicalMedia(data || [],fields,item);
      if (!versions.length) choices.textContent = 'No different previous media found in the latest 30 audit entries.';
      for (const {date,values} of versions) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'mini';
        button.textContent = 'Stage media from ' + new Date(date).toLocaleString();
        button.onclick = () => {
          const inputs = fields.map(field => form.elements.namedItem(field));
          if (inputs.some(input => !input || input.disabled)) return;
          for (const name of fileFields) {
            const input = form.elements.namedItem(name);
            if (input) input.value = '';
          }
          inputs.forEach((input,index) => {
            input.value = values[index];
            input.dispatchEvent(new Event('input',{bubbles:true}));
          });
          const embedded = form.elements.namedItem('video_embedded_sound');
          if (embedded) embedded.checked = !embedded.disabled &&
            values.some(value => /\.mp4(?:[?#]|$)/i.test(value)) &&
            !form.elements.namedItem('sound_url')?.value;
          toast('Previous media staged. Review the fields, then Save to apply.');
        };
        choices.appendChild(button);
      }
    } catch (error) {
      if (form.isConnected) toast(error.message || 'Could not load media history', true);
    } finally {
      load.disabled = false;
    }
  };
}
