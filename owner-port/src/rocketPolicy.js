export const ROCKET_DEFAULTS={thresholds:[10000000,20000000,30000000,40000000,50000000],winner_counts:[3,5,7,9,10],reward_percentages:[5,5,5,5,5],reward_mode:'weighted_target_pool',policy_version:2,unique_winner_cap:10};
export function parseRocketEditor(edit){
 const list=(v,label)=>{const parts=String(v??'').split(',');if(parts.length!==5||parts.some(x=>!x.trim()))throw new Error(`${label}: enter exactly five numbers.`);const a=parts.map(Number);if(a.some(x=>!Number.isFinite(x)))throw new Error(`${label}: invalid number.`);return a;};
 const unique_winner_cap=Number(edit.uniqueWinnerCap??10);if(!Number.isInteger(unique_winner_cap)||unique_winner_cap<1||unique_winner_cap>100)throw new Error('Round winner limit must be a whole number from 1 to 100.');
 const thresholds=list(edit.thresholds,'Targets'),winner_counts=list(edit.winnerCounts,'Winners'),reward_percentages=list(edit.rewardPercentages,'Pool percentages');
 if(thresholds.some((x,i)=>!Number.isSafeInteger(x)||x<=0||x>1e12||(i&&x<=thresholds[i-1])))throw new Error('Targets must be increasing positive whole coins, at most 1 trillion.');
 if(winner_counts.some(x=>!Number.isInteger(x)||x<1||x>unique_winner_cap))throw new Error('Each winner count must be a whole number from 1 to the round winner limit.');
 if(reward_percentages.some(x=>x<0||x>100))throw new Error('Each pool percentage must be from 0 to 100.');
 return {thresholds,winner_counts,reward_percentages,unique_winner_cap,reward_mode:'weighted_target_pool',policy_version:2};
}
export function rocketLevelPreview(policy,level,contributors=[],previousWinnerIds=[]){
 const index=Math.max(0,Math.min(4,level-1)),target=Number(policy.thresholds?.[index]||ROCKET_DEFAULTS.thresholds[index]),percent=Number(policy.reward_percentages?.[index]??5),limit=Number(policy.winner_counts?.[index]??ROCKET_DEFAULTS.winner_counts[index]);
 const legacy=policy.reward_mode==='legacy_sender_percent',cap=Number(policy.unique_winner_cap||10),prior=new Set(previousWinnerIds),ranked=[...contributors].sort((a,b)=>Number(b.coins)-Number(a.coins)||String(a.first_sent||'').localeCompare(String(b.first_sent||''))||String(a.user_id).localeCompare(String(b.user_id)));let available=Math.max(0,cap-prior.size);const eligible=legacy?ranked:ranked.filter(x=>prior.has(x.user_id)||available-->0),chosen=limit?eligible.slice(0,limit):eligible;
 const sending=chosen.reduce((n,x)=>n+Number(x.coins||0),0),pool=Math.floor(target*percent/100);
 return {target,percent,limit,pool,legacy,winners:chosen.map((x,index)=>({...x,rank:index+1,share:sending?Number(x.coins)/sending:0,estimatedCoins:legacy?Math.max(1,Math.floor(Number(x.coins)*percent/100)):sending?Math.floor(pool*Number(x.coins)/sending):0}))};
}

