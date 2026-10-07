// Salary RPCs accept integer coins/units. Never truncate or round an input.
export function salaryInteger(value,{grouped=false}={}) {
 if(value===null||value===undefined)return null;
 if(typeof value==='number'&&!Number.isSafeInteger(value))return null;
 let text=String(value??'0').trim();
 if(grouped&&/^\d{1,3}(,\d{3})+$/.test(text))text=text.replaceAll(',','');
 if(!/^\d+$/.test(text))return null;
 return BigInt(text);
}
export function salaryRpcInteger(value,{positive=false}={}) {
 const integer=salaryInteger(value,{grouped:true});
 return integer!==null&&integer>=(positive?1n:0n)&&integer<=BigInt(Number.MAX_SAFE_INTEGER)?Number(integer):null;
}
export function salaryFormat(value) {
 const integer=salaryInteger(value);
 return integer===null?'Unavailable':integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
export function salaryRemaining(row) {
 const parts=[row.earned_amount,row.advance_used,row.settled_amount].map(v=>salaryInteger(v));
 if(parts.some(v=>v===null))return null;
 const remaining=parts[0]-parts[1]-parts[2];return remaining>0n?remaining:0n;
}
export function salaryAvailable(value) {const n=salaryInteger(value);return n!==null&&n>0n;}
export function salaryPercent(value,percent) {
 const integer=salaryInteger(value);
 if(integer===null||!Number.isInteger(percent)||percent<0||percent>100)return '';
 const amount=integer*BigInt(percent)/100n;return (amount>0n?amount:integer>0n?1n:0n).toString();
}
export function salaryProgress(done,target) {
 const d=salaryInteger(done),t=salaryInteger(target);
 if(d===null||t===null||t===0n)return 0;
 return d>=t?100:Number(d*10000n/t)/100;
}
