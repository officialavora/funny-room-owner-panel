export const EVENT_REWARD_CATEGORIES=['room','wealth','charm','lucky','recharge','games','family','agency','pk','bd'];
export const EVENT_REWARD_PERIODS=['daily','weekly','monthly'];
export const emptyEventRewardRanks=()=>[1,2,3].map(rank=>({rank,coin_reward:'0',frame_code:null,entry_code:null,duration_days:7}));
const digits=value=>{const text=String(value);if(!/^(0|[1-9][0-9]*)$/.test(text)||!Number.isSafeInteger(Number(text)))throw Error('Enter a whole coin amount without commas.');return text;};
export function eventRewardSaveArgs(snapshot,{minimum,published,rewards},requestId){
 if(!snapshot?.owner||!EVENT_REWARD_CATEGORIES.includes(snapshot.category)||!EVENT_REWARD_PERIODS.includes(snapshot.period))throw Error('Reload verified Founder controls.');
 if(!Array.isArray(rewards)||rewards.length>100)throw Error('Use up to 100 ranks.');
 const clean=rewards.map((row,i)=>{if(Number(row.rank)!==i+1)throw Error('Ranks must start at 1 and continue in order.');const coin=digits(row.coin_reward),days=Number(row.duration_days);if(!Number.isInteger(days)||days<1||days>3650)throw Error('Duration must be 1–3650 days.');if(snapshot.coin_policy_source==='existing_policy'&&coin!=='0')throw Error('Use this category’s existing coin policy controls.');return {rank:i+1,coin_reward:coin,frame_code:String(row.frame_code||'').trim()||null,entry_code:String(row.entry_code||'').trim()||null,duration_days:days};});
 return {p_category:snapshot.category,p_period:snapshot.period,p_expected_version:digits(snapshot.version),p_minimum_source_score:digits(minimum),p_published:published===true,p_rewards:clean,p_request_id:requestId};
}
// Keep an uncertain request's exact ID and payload for safe idempotent retry, including remounts.
const writes=new Map();
export function eventRewardPending(actor,category,period){return writes.get(JSON.stringify([actor,category,period]))||null;}
export function saveEventRewardCatalog(actor,args,execute){
 const key=JSON.stringify([actor,args.p_category,args.p_period]);let intent=writes.get(key);
 if(intent?.pending)return intent;
 if(!intent){intent={args,pending:false,error:null,result:null};writes.set(key,intent);}
 intent.pending=true;
 intent.promise=Promise.resolve().then(()=>execute(intent.args)).then(result=>{
  intent.pending=false;
  if(result?.error){intent.error=result.error;if(['22023','42501','40001','28000'].includes(result.error.code))writes.delete(key);}
  else{intent.result=result?.data;writes.delete(key);}return result;
 }).catch(error=>{intent.pending=false;intent.error=error;return {error};});return intent;
}

export function categoryRulesFromText(text){const rules=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(rules.length>30||rules.some(x=>x.length>1000))throw Error('Use up to 30 rules, each 1–1000 characters.');return rules;}
