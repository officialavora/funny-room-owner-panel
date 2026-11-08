// The existing grant RPC verifies Founder/operator authority and target eligibility.
export function addEntryTrial(form, item, {client,rpc,isCurrent,toast}) {
  if (!item?.active || item.kind !== 'entry' || item.purchasable !== false || !/^video_entry_\d+$/.test(item.code)) return;
  const button = form.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'mini';
  button.textContent = 'Add to my Bag for 1 day';
  form.insertBefore(button,form.querySelector('h3').nextSibling);
  const current = () => form.isConnected && isCurrent();
  button.onclick = async () => {
    if (button.disabled || !current()) return;
    button.disabled = true;
    let dispatched = false;
    try {
      const {data,error} = await client.auth.getUser();
      const actor = data?.user?.id;
      if (error || !actor || !current()) throw Error('Sign in and reopen the Entry.');
      const {data:profile,error:profileError} = await client.from('profiles').select('public_id').eq('id',actor).single();
      const publicId = Number(profile?.public_id);
      if (profileError || !Number.isSafeInteger(publicId) || publicId<1) throw Error('Could not verify your account ID.');
      const {data:owned,error:ownedError} = await client.rpc('get_active_cosmetics',{target_user:actor});
      if (ownedError || !Array.isArray(owned)) throw Error('Could not verify your Bag.');
      if (owned.some(row => row.code === item.code)) {toast('Already in your Bag. Open Entry and tap Use.');return;}
      const auth = await client.auth.getUser();
      if (auth.error || auth.data?.user?.id !== actor || !current()) return;
      dispatched = true;
      const receipt = await rpc('owner_grant_cosmetic',{target_public_id:publicId,asset_code:item.code,duration_days:1,reason_text:'Owner one-day Entry playback test'});
      if (typeof receipt !== 'string' || !/^[0-9a-f-]{36}$/i.test(receipt)) throw Error('Grant receipt was not confirmed.');
      if (current()) toast('Added to your Bag for 1 day. Refresh Bag in the app, then tap Use.');
    } catch (error) {
      if (current()) toast(dispatched ? 'Grant result unconfirmed. Check your Bag before retrying. ' + error.message : error.message,true);
    } finally {
      button.disabled = dispatched;
    }
  };
}
