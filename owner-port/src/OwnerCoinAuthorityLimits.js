import CoinAuthorityHistory from './CoinAuthorityHistory';
import React,{useEffect,useRef,useState} from 'react';
import {Text,View,Switch} from 'react-native';
import {AiPressable as Pressable} from './AiChrome';
import TextInput from './DraftTextInput';
import {supabase} from '../lib/supabase';
import {boundedRpc} from './boundedRpc';

export default function OwnerCoinAuthorityLimits({publicId}){
 const [policy,setPolicy]=useState(null),[perAction,setPerAction]=useState(''),[budget,setBudget]=useState(''),[enabled,setEnabled]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[denied,setDenied]=useState(false),[term,setTerm]=useState('permanent'),[termChanged,setTermChanged]=useState(false),[manualMonths,setManualMonths]=useState('');
 const alive=useRef(true),epoch=useRef(0),saving=useRef(false);
 const apply=data=>{setPolicy(data);setPerAction(String(data.per_action));setBudget(String(data.total_budget));setEnabled(Boolean(data.enabled));setTerm(data.term||'permanent');setTermChanged(false);setManualMonths(data.duration_months==null?'':String(data.duration_months));};
 const refresh=async()=>{const token=++epoch.current;setBusy(true);setError('');try{
  const result=await boundedRpc(supabase,'owner_load_coin_authority_limit_v149',{p_public_id:Number(publicId)},{label:'Coin authority limit'});
  if(!alive.current||token!==epoch.current)return;if(result.error)throw result.error;apply(result.data);setDenied(false);
 }catch(e){if(alive.current&&token===epoch.current){setDenied(String(e.message).includes('Only App Owner'));setError(e.message||'Could not load coin limits.');}}
 finally{if(alive.current&&token===epoch.current)setBusy(false);}};
 useEffect(()=>{alive.current=true;setPolicy(null);setDenied(false);setReason('');refresh();return()=>{alive.current=false;++epoch.current;};},[publicId]);
 const save=async(action='save')=>{if(saving.current||busy||!policy||policy.founder)return;
  if(!/^\d+$/.test(perAction)||!/^\d+$/.test(budget)||!Number.isSafeInteger(Number(perAction))||!Number.isSafeInteger(Number(budget))||Number(perAction)>1e12||Number(budget)>9e15||Number(budget)<Number(policy.used_budget)||reason.trim().length<3)return setError('Enter whole coin limits, a total at least equal to used coins, and an audit reason.');
  if((action==='grant'||(action==='save'&&termChanged))&&term==='manual'&&(!/^\d+$/.test(manualMonths)||!Number.isSafeInteger(Number(manualMonths))||Number(manualMonths)<1||Number(manualMonths)>1200000))return setError('Enter a valid positive whole number of months.');
  saving.current=true;const token=++epoch.current;setBusy(true);setError('');try{
   const result=await boundedRpc(supabase,'owner_set_coin_authority_limit_v149',{p_public_id:Number(publicId),p_per_action:Number(perAction),p_total_budget:Number(budget),p_enabled:enabled,p_reason:reason.trim(),p_expected_revision:policy.revision,p_action:action,p_term:action==='grant'||(action==='save'&&termChanged)?term:null,p_manual_months:term==='manual'?Number(manualMonths):null},{label:'Save coin limit'});
   if(!alive.current||token!==epoch.current)return;if(result.error)throw result.error;apply(result.data);setReason('');
  }catch(e){if(alive.current&&token===epoch.current)setError(e.message||'Could not save. Reload to check saved limits.');}
  finally{saving.current=false;if(alive.current&&token===epoch.current)setBusy(false);}};
 if(denied)return null;
 const text={color:'#F8F9FF',fontSize:12,lineHeight:19};const field={...text,borderWidth:1,borderColor:'#684974',borderRadius:12,padding:10,minHeight:46};
 return <View style={{gap:9,marginTop:16,borderWidth:1,borderColor:'#684974',borderRadius:16,padding:12}}>
  <Text style={{...text,fontWeight:'900'}}>Delegated coin authority • ID {publicId}</Text>
  {error?<Text accessibilityRole="alert" style={{...text,color:'#FFB4C6'}}>{error}</Text>:null}
  {!policy?<Text style={text}>{busy?'Loading saved limits…':'Limits unavailable. Reload to retry.'}</Text>:policy.founder?<Text style={text}>This is the protected App Owner account.</Text>:<>
   <Text style={text}>State: {policy.state}{policy.expired?' • EXPIRED':''} • Until: {policy.expires_at?new Date(policy.expires_at).toLocaleString():'Permanent'}</Text><Text style={text}>Used: {Number(policy.used_budget).toLocaleString()} • Remaining: {Number(policy.remaining).toLocaleString()}</Text>
   <Text style={text}>Per adjustment maximum</Text><TextInput accessibilityLabel="Coin authority per action limit" editable={!busy} keyboardType="number-pad" value={perAction} onChangeText={setPerAction} style={field}/>
   <Text style={text}>Total coin budget</Text><TextInput accessibilityLabel="Coin authority total budget" editable={!busy} keyboardType="number-pad" value={budget} onChangeText={setBudget} style={field}/>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{[['1month','1 MONTH'],['3months','3 MONTHS'],['6months','6 MONTHS'],['permanent','PERMANENT'],['manual','MANUAL']].map(([value,label])=><Pressable key={value} disabled={busy} onPress={()=>{setTerm(value);setTermChanged(true);}}><Text style={text}>{term===value?'✓ ':''}{label}</Text></Pressable>)}</View>
   {term==='manual'?<><Text style={text}>Manual duration • months</Text><TextInput accessibilityLabel="Manual coin authority duration in months" editable={!busy} keyboardType="number-pad" value={manualMonths} onChangeText={value=>{setManualMonths(value);setTermChanged(true);}} placeholder="e.g. 2, 4, 10" placeholderTextColor="#A9B2C4" style={field}/></>:null}
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={[text,{flex:1}]}>Enable delegated coin power</Text><Switch disabled={busy} value={enabled} onValueChange={setEnabled}/></View>
   <TextInput accessibilityLabel="Coin limit audit reason" editable={!busy} value={reason} onChangeText={setReason} placeholder="Reason for these limits" placeholderTextColor="#A9B2C4" style={field}/>
   <Text style={text}>Wallet permission and its ID/country scope are required separately. Debits do not restore this budget. Merchant/seller recharge limits stay separate.</Text>
   <Pressable disabled={busy} onPress={()=>save('save')}><Text style={text}>SAVE COIN AUTHORITY LIMITS</Text></Pressable>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{[['grant','GRANT / RENEW'],['freeze','FREEZE'],['resume','RESUME'],['revoke','REVOKE'],['remove','REMOVE']].map(([action,label])=><Pressable key={action} disabled={busy||(action==='resume'&&(policy.state!=='frozen'||policy.expired))} onPress={()=>save(action)}><Text style={text}>{label}</Text></Pressable>)}</View>
   <Text style={text}>Choose a term when granting or renewing. Freeze does not extend it. Remove keeps the used budget and audit history.</Text>
  </>}
  {policy?<CoinAuthorityHistory key={publicId} publicId={Number(publicId)}/>:null}
  <Pressable disabled={busy} onPress={refresh}><Text style={text}>{busy?'CHECKING / SAVING…':'RELOAD SAVED LIMITS'}</Text></Pressable>
 </View>;
}

