// Shared by the native app and the existing Owner web panel. No backend imports.
export const money = cents => '$' + (cents / 100).toLocaleString('en-US', {maximumFractionDigits: 2});
export const integer = (n, min, max, label) => {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw Error('Invalid ' + label);
  return n;
};
const text = (s, max, label, empty = false) => {
  if (typeof s !== 'string' || s.length > max || (!empty && !s.trim()) || /[\u0000-\u001f]/.test(s)) throw Error('Invalid ' + label);
  return s;
};
const list = (a, max, label) => { if (!Array.isArray(a) || !a.length || a.length > max) throw Error('Invalid '+label); return a; };
const unique = (a, key) => { if (new Set(a.map(x=>x[key])).size !== a.length) throw Error('Duplicate '+key); };
export function packageTotal(c, p) {
  const base = BigInt(p.usdCents) * BigInt(c.coinsPerUsd) / 100n;
  const bonus = base * BigInt(p.bonusBps) / 10000n;
  return {base: String(base), bonus: String(bonus), total: String(base + bonus)};
}
export function validateCatalog(input) {
  const c = JSON.parse(JSON.stringify(input));
  if(c.schema !== 1 || c.brand !== 'Funny Room') throw Error('Unsupported catalogue');
  integer(c.version,1,2147483647,'version'); integer(c.coinsPerUsd,1,1000000000,'coin rate');
  integer(c.checkoutMinutes,5,1440,'checkout time'); integer(c.exitReviewHours,0,720,'exit time');
  integer(c.merchantDepositUsdCents,0,100000000,'deposit');
  if(typeof c.applicationOpen!=='boolean'||typeof c.checkoutOpen!=='boolean') throw Error('Invalid availability');
  text(c.supportEmail,200,'support');
  list(c.packages,40,'packages').forEach(p=>{
    if(!/^[a-z0-9-]{1,48}$/.test(p.id)||!['normal','merchant'].includes(p.kind)||typeof p.enabled!=='boolean') throw Error('Invalid package');
    integer(p.usdCents,100,100000000,'package amount'); integer(p.bonusBps,0,10000,'bonus');
    integer(Number(packageTotal(c,p).total),1,Number.MAX_SAFE_INTEGER,'coin total');
  }); unique(c.packages,'id');
  list(c.channels,12,'channels').forEach(p=>{
    if(!/^[a-z0-9-]{1,48}$/.test(p.id)||typeof p.enabled!=='boolean') throw Error('Invalid channel');
    if(!/^[a-z0-9-]{1,64}$/.test(p.railId))throw Error('Canonical payment rail required');
    if(!['crypto','manual','redirect'].includes(p.kind))throw Error('Invalid payment type');
    text(p.provider,100,'provider');text(p.label,200,'channel label');text(p.asset,200,'payment currency');
    ['network','address','recipient','memo','paymentUrl'].forEach(k=>text(p[k],k==='paymentUrl'?1500:200,k,true));
    text(p.instructions,800,'instructions');
    if(p.address&&!/^[A-Za-z0-9:._-]+$/.test(p.address))throw Error('Address must be a plain wallet address');
    if(!/^\d+(\.\d{1,8})?$/.test(p.assetUnitsPerUsd)||Number(p.assetUnitsPerUsd)<=0||Number(p.assetUnitsPerUsd)>1000000)throw Error('Invalid asset conversion');
    if(p.paymentUrl){let url;try{url=new URL(p.paymentUrl);}catch{throw Error('Invalid payment URL');}if(url.protocol!=='https:'||url.username||url.password)throw Error('HTTPS payment URL required');}
    if(p.enabled&&p.kind==='crypto'&&(!p.network||!p.address))throw Error('Enabled crypto method requires network and address');
    if(p.enabled&&p.kind==='manual'&&!p.recipient)throw Error('Enabled manual method requires recipient details');
    if(p.enabled&&p.kind==='redirect'&&!p.paymentUrl)throw Error('Enabled linked method requires a payment URL');
    if(p.address&&p.network==='Tron (TRC20)'&&!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(p.address))throw Error('Invalid Tron address');
  }); unique(c.channels,'id');
  list(c.countries,300,'countries').forEach(p=>{if(!/^[A-Z]{2}$/.test(p.code))throw Error('Invalid country');text(p.name,100,'country name');}); unique(c.countries,'code');
  if(!Array.isArray(c.allowedCountries)||c.allowedCountries.some(code=>!c.countries.some(x=>x.code===code))||new Set(c.allowedCountries).size!==c.allowedCountries.length)throw Error('Invalid payment country eligibility');
  if(!c.countryOverrides||Array.isArray(c.countryOverrides)||typeof c.countryOverrides!=='object')throw Error('Invalid country overrides');
  for(const [code,o] of Object.entries(c.countryOverrides)){
    if(!c.countries.some(p=>p.code===code)||!o||typeof o!=='object'||Array.isArray(o))throw Error('Unknown country override');
    for(const key of Object.keys(o))if(!['currency','localAmount','coins','note'].includes(key))throw Error('Unknown regional field');
    if(o.currency!==undefined&&!/^[A-Z]{3}$/.test(o.currency))throw Error('Invalid local currency');
    if(o.localAmount!==undefined&&!/^\d+(\.\d{1,8})?$/.test(o.localAmount))throw Error('Invalid local amount');
    if(o.coins!==undefined&&!/^[1-9]\d{0,15}$/.test(o.coins))throw Error('Invalid local coins');
    if(o.note!==undefined)text(o.note,500,'country note',true);
    if(Boolean(o.currency)!==Boolean(o.localAmount)||Boolean(o.currency)!==Boolean(o.coins))throw Error('Complete the local rate');
  }
  list(c.rules,30,'rules').forEach(r=>{text(r.title,100,'rule title');text(r.text,1500,'rule text');});
  return c;
}
export const countryRate=(c,code)=>{
  const o=c.countryOverrides[code];
  return o?.currency?`${o.localAmount} ${o.currency} = ${Number(o.coins).toLocaleString('en-US')} coins`:`$1 USD = ${c.coinsPerUsd.toLocaleString('en-US')} coins`;
};
export function validateQuote(q,c,{actorId,requestId,packageId,channelId,kind,configVersion=c.version},now=Date.now()){
  if(!q||q.userId!==actorId||q.requestId!==requestId||q.packageId!==packageId||q.channelId!==channelId||q.kind!==kind||q.configVersion!==configVersion||c.version!==configVersion||q.status!=='pending')throw Error('Quote identity mismatch');
  const p=c.packages.find(p=>p.id===packageId&&p.enabled&&p.kind===kind),ch=c.channels.find(ch=>ch.id===channelId&&ch.enabled);
  if(!p||!ch||!c.checkoutOpen||q.railId!==ch.railId||q.network!==ch.network||q.asset!==ch.asset||q.paymentKind!==ch.kind||q.provider!==ch.provider||!/^[-a-z0-9]{36}$/.test(q.id))throw Error('Quote destination mismatch');
  if(c.catalogKind!=='public'&&(q.address!==ch.address||q.recipient!==ch.recipient||q.memo!==ch.memo||q.paymentUrl!==ch.paymentUrl))throw Error('Quote destination mismatch');
  for(const key of ['address','recipient','memo','paymentUrl'])text(q[key],key==='paymentUrl'?1500:200,key,true);
  if(q.paymentKind==='crypto'&&(!q.address||!/^[A-Za-z0-9:._-]{1,200}$/.test(q.address)))throw Error('Invalid crypto quote');
  if(q.paymentKind==='manual'&&!q.recipient)throw Error('Missing payment recipient');
  if(q.paymentKind==='redirect'){let url;try{url=new URL(q.paymentUrl);}catch{throw Error('Invalid redirect');}if(url.protocol!=='https:'||url.username||url.password||!ch.admittedHosts?.includes(url.hostname.toLowerCase()))throw Error('Redirect host not admitted');}
  const coins=packageTotal(c,p),deposit=kind==='merchant'&&!q.depositAlreadyHeld?c.merchantDepositUsdCents:0;
  if(typeof q.depositAlreadyHeld!=='boolean'||q.packageUsdCents!==p.usdCents||q.depositUsdCents!==deposit||q.totalUsdCents!==p.usdCents+deposit||q.totalCoins!==coins.total||!/^\d+(\.\d{1,8})?$/.test(q.assetAmount))throw Error('Quote amount mismatch');
  if(Math.abs(Number(q.assetAmount)-(q.totalUsdCents/100)*Number(ch.assetUnitsPerUsd))>0.000000011)throw Error('Quote asset amount mismatch');
  const server=Date.parse(q.serverNow),expires=Date.parse(q.expiresAt);
  if(!Number.isFinite(server)||!Number.isFinite(expires)||expires<=server||expires-server>c.checkoutMinutes*60000||Math.abs(server-now)>300000)throw Error('Invalid quote clock');
  return Object.freeze({...q});
}
export const remainingSeconds=(q,serverNow)=>Math.max(0,Math.ceil((Date.parse(q.expiresAt)-serverNow)/1000));

const PUBLIC_KEYS=['schema','version','brand','coinsPerUsd','checkoutMinutes','exitReviewHours','merchantDepositUsdCents','applicationOpen','checkoutOpen','supportEmail','packages','countries','countryOverrides','rules','allowedCountries'];
const CHANNEL_KEYS=['id','kind','provider','label','asset','network','railId','enabled','assetUnitsPerUsd','instructions','admittedHosts'];
export function publicCatalog(owner,rails=[]){
 const c=validateCatalog(owner),p=Object.fromEntries(PUBLIC_KEYS.map(k=>[k,c[k]]));
 p.catalogKind='public';p.channels=c.channels.filter(x=>x.enabled).map(x=>Object.fromEntries(CHANNEL_KEYS.map(k=>[k,k==='admittedHosts'?(rails.find(r=>r.id===x.railId)?.allowedHosts||[]):x[k]])));
 return validatePublicCatalog(p);
}
export function validatePublicCatalog(input){
 const p=JSON.parse(JSON.stringify(input));
 if(p.catalogKind!=='public'||Object.keys(p).some(k=>![...PUBLIC_KEYS,'catalogKind','channels'].includes(k))||!Array.isArray(p.channels))throw Error('Invalid public catalogue projection');
 for(const ch of p.channels){if(Object.keys(ch).some(k=>!CHANNEL_KEYS.includes(k))||!CHANNEL_KEYS.every(k=>Object.hasOwn(ch,k))||ch.enabled!==true||!Array.isArray(ch.admittedHosts)||ch.admittedHosts.some(x=>typeof x!=='string'||!/^[a-z0-9.-]+$/.test(x)))throw Error('Private or invalid public channel data');}
 // Validate common arithmetic/display fields without requiring private destinations.
 const temp={...p,channels:(p.channels.length?p.channels:[{id:'unavailable',kind:'manual',provider:'Unavailable',label:'Unavailable',asset:'USD',network:'',railId:'unavailable',assetUnitsPerUsd:'1',instructions:'No configured payment method.'}]).map(x=>({...x,address:'',recipient:'',memo:'',paymentUrl:'',enabled:false}))};
 validateCatalog(temp);return p;
}
