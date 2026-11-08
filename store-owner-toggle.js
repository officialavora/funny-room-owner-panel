export async function showStoreLock({root,rpc,isCurrent,toast}) {
  const current = () => root.isConnected && isCurrent();
  const doc = root.ownerDocument;
  const section = doc.createElement('section');
  section.className='card section';
  const heading=doc.createElement('h3');
  heading.textContent='Store purchases';
  const status=doc.createElement('p');
  status.setAttribute('role','status');
  const toggle=doc.createElement('button');
  toggle.type='button';
  toggle.className='mini';
  toggle.disabled=true;
  toggle.textContent='Checking Store lock…';
  const refresh=doc.createElement('button');
  refresh.type='button';
  refresh.className='mini';
  refresh.textContent='Refresh status';
  section.append(heading,status,toggle,refresh);
  root.prepend(section);
  let policy=null,busy=false;
  async function read() {
    if (busy || !current()) return;
    busy=true;toggle.disabled=true;refresh.disabled=true;
    try {
      const row=await rpc('load_store_purchase_policy_v1');
      if (row?.scope!=='all_store_cosmetics'||typeof row.locked!=='boolean'||!Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1) throw Error('Invalid Store policy response');
      if (!current()) return;
      policy=row;
      status.textContent=row.locked?'Locked for all users. Existing Bag items still work.':'Open for all users. Only items marked for sale can be purchased.';
      toggle.textContent=row.locked?'Unlock Store purchases':'Lock Store purchases';
      toggle.disabled=row.can_unlock!==true;
    } catch (error) {
      policy=null;
      if(current()) status.textContent='Store status could not be verified. Refresh to retry.';
    } finally {
      busy=false;refresh.disabled=false;
    }
  }
  refresh.onclick=read;
  toggle.onclick=async()=>{
    if(busy||!current()||policy?.can_unlock!==true) return;
    const next=!policy.locked;
    const reason=globalThis.prompt((next?'Lock':'Unlock')+' Store purchases for all users. Enter an audit reason (5–500 characters).')?.trim();
    if(!reason||reason.length<5||reason.length>500)return;
    busy=true;toggle.disabled=true;refresh.disabled=true;
    try {
      const result=await rpc('owner_set_store_purchase_policy_v1',{p_locked:next,p_expected_revision:Number(policy.revision),p_reason:reason,p_request_id:crypto.randomUUID()});
      if(result?.locked!==next)throw Error('Unexpected Store receipt');
      if(current())toast(next?'Store locked':'Store unlocked');
    } catch(error) {
      if(current())toast('Store change was not confirmed. Reading the current status.',true);
    } finally {busy=false;await read();}
  };
  await read();
}
