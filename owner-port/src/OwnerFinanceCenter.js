import CoinAuthorityHistory from './CoinAuthorityHistory';
import {HomeAIText as Text} from './HomeAIChrome';
import TextInput from './DraftTextInput';
import {AiPressable as Pressable,AiBackdrop} from './AiChrome';
import React, { useEffect, useMemo, useState } from 'react';
import {ActivityIndicator,Alert,Image,StyleSheet,Switch,View} from 'react-native';
import { supabase } from '../lib/supabase';
import {OwnerFinanceActivityHistory} from './OwnerAuditHistory';
import OwnerPaymentControl from './payments/OwnerPaymentControl';
import useOwnerFinanceLookup from './useOwnerFinanceLookup';
import { PREMIUM } from './designSystem';

const C={panel:PREMIUM.colors.panel,panel2:PREMIUM.colors.panelSoft,line:PREMIUM.colors.line,text:PREMIUM.colors.text,muted:PREMIUM.colors.muted,purple:PREMIUM.colors.violet,cyan:PREMIUM.colors.cyan,gold:PREMIUM.colors.gold,danger:PREMIUM.colors.rose,green:PREMIUM.colors.green};
const n=v=>Number(v||0).toLocaleString();
const signed=v=>{const x=Number(v||0);return `${x>0?'+':''}${n(x)}`};

export default function OwnerFinanceCenter({onNotice}){
  const [publicId,setPublicId]=useState('');
  const [amount,setAmount]=useState('');
  const [quickAmounts,setQuickAmounts]=useState(['1000','10000','100000','1000000']);
  const [baseUsd,setBaseUsd]=useState('1');
  const [coinsPerUsd,setCoinsPerUsd]=useState('1000000');
  const [diamondsPerUsd,setDiamondsPerUsd]=useState('1000000');
  const [usdAmount,setUsdAmount]=useState('');
  const [bonusPercent,setBonusPercent]=useState('0');
  const [merchantTransfersEnabled,setMerchantTransfersEnabled]=useState(true);
  const [merchantSellerTransfersEnabled,setMerchantSellerTransfersEnabled]=useState(true);
  const [policyBusy,setPolicyBusy]=useState(false);
  const [note,setNote]=useState('');
  const [destination,setDestination]=useState('wallet');
  const {dashboard,rows,salaryRows,loading:lookupBusy,recordsLoading,error:lookupError,recordErrors,load:lookup,clear:clearLookup}=useOwnerFinanceLookup(onNotice);
  const [recordLimit,setRecordLimit]=useState(50);
  const [filter,setFilter]=useState('all');
  const [busy,setBusy]=useState(false);
  const [financeAuditKey,setFinanceAuditKey]=useState(0);

  const validId=()=>/^\d{4,}$/.test(publicId.trim());
  const formatUsd=value=>{const n=Number(value||0);return Number.isFinite(n)?String(Math.round(n*100)/100):''};
  const bonusMultiplier=()=>Math.max(0,1+Number(bonusPercent||0)/100);
  const activeRate=()=>destination==='diamonds'?Number(diamondsPerUsd||1):Number(coinsPerUsd||1);
  const setCoinValue=value=>{const clean=String(value||'').replace(/[^0-9+-]/g,'');setAmount(clean);setUsdAmount(formatUsd(Number(clean||0)/(activeRate()*bonusMultiplier())))};
  const setUsdValue=value=>{const clean=String(value||'').replace(/[^0-9.+-]/g,'');setUsdAmount(clean);const usd=Number(clean);if(Number.isFinite(usd))setAmount(String(Math.round(usd*activeRate()*bonusMultiplier())))};
  const loadEconomy=async()=>{const {data,error}=await supabase.rpc('get_coin_economy_config');if(error)return onNotice?.(error.message);setCoinsPerUsd(String(data?.coins_per_usd||1000000));setDiamondsPerUsd(String(data?.diamonds_per_usd||1000000));setQuickAmounts((data?.quick_amounts||[1000,10000,100000,1000000]).map(String))};
  const saveEconomy=async()=>{const dollars=Number(baseUsd),coins=Number(coinsPerUsd),rate=Math.round(coins/dollars),presets=quickAmounts.map(Number).filter(Number.isSafeInteger);if(!Number.isFinite(dollars)||dollars<=0||!Number.isSafeInteger(coins)||coins<1||!Number.isSafeInteger(rate)||rate<1)return onNotice?.('Enter valid Dollar and Coins values');setBusy(true);const [{data,error},diamond]=await Promise.all([supabase.rpc('owner_update_coin_economy_config',{p_coins_per_usd:rate,p_quick_amounts:presets}),supabase.rpc('owner_update_diamond_economy_rate',{p_diamonds_per_usd:Number(diamondsPerUsd)})]);setBusy(false);if(error||diamond.error)return onNotice?.((error||diamond.error).message);setBaseUsd('1');setCoinsPerUsd(String(data.coins_per_usd));setQuickAmounts((data.quick_amounts||[]).map(String));onNotice?.('Coin rate saved for Owner, Merchant and Seller')};
  useEffect(()=>{loadEconomy()},[]);
  useEffect(()=>{supabase.rpc('get_merchant_transfer_policy').then(({data,error})=>{if(!error){setMerchantTransfersEnabled(data?.merchant_enabled!==false);setMerchantSellerTransfersEnabled(data?.seller_enabled!==false)}})},[]);
  const setMerchantTransferPolicy=async enabled=>{setPolicyBusy(true);const {data,error}=await supabase.rpc('owner_set_merchant_transfer_policy',{p_enabled:enabled});setPolicyBusy(false);if(error)return onNotice?.(error.message);setMerchantTransfersEnabled(data?.enabled!==false);onNotice?.(`Merchant → Merchant Inventory ${enabled?'ON':'OFF'}`)};
  const setMerchantSellerTransferPolicy=async enabled=>{setPolicyBusy(true);const {data,error}=await supabase.rpc('owner_set_seller_transfer_policy',{p_enabled:enabled});setPolicyBusy(false);if(error)return onNotice?.(error.message);setMerchantSellerTransfersEnabled(data?.enabled!==false);onNotice?.(`Merchant → Seller Inventory ${enabled?'ON':'OFF'}`)};
  const load=()=>lookup(publicId);
  useEffect(()=>setRecordLimit(50),[publicId,filter]);

  const performApply=async()=>{
    const value=Number(String(amount).replaceAll(',',''));
    const percent=Number(bonusPercent||0);
    const destinationLabel=destination==='seller'?'Owner seller inventory':destination==='diamonds'?'Owner diamond adjustment':'Owner wallet recharge';
    const autoNote=note.trim()||`${destinationLabel} • ID ${publicId}${percent?` • ${percent>0?'+':''}${percent}% adjustment`:''}`;
    setBusy(true);
    const result=destination==='diamonds'
      ?await supabase.rpc('owner_adjust_wallet_asset',{p_public_id:Number(publicId),p_asset:'diamonds',p_amount:value,p_note:autoNote})
      :destination==='seller'&&value>0
        ?await supabase.rpc('transfer_seller_balance',{p_seller_public_id:Number(publicId),p_amount:value,p_note:autoNote})
        :await supabase.rpc(destination==='seller'?'owner_adjust_seller_balance':'owner_adjust_coins_by_public_id',{p_public_id:Number(publicId),p_amount:value,p_note:autoNote});
    setBusy(false);
    if(result.error)return onNotice?.(result.error.message);
    setAmount('');setUsdAmount('');setBonusPercent('0');setNote('');
    onNotice?.(`${destination==='seller'?'Seller balance':destination==='diamonds'?'Diamonds':'User wallet'} updated for ID ${publicId}`);
    setFinanceAuditKey(x=>x+1);
    await load();
  };

  const apply=async()=>{
    if(busy||lookupBusy)return;
    if(!validId())return onNotice?.('Valid permanent ID required');
    const value=Number(String(amount).replaceAll(',',''));
    if(!Number.isSafeInteger(value)||value===0)return onNotice?.('Amount must be a non-zero whole number');
    let person=dashboard;
    if(!person||Number(person.public_id)!==Number(publicId)){
      person=await load();
      if(!person)return;
    }
    const assetLabel=destination==='seller'?'Seller inventory coins':destination==='diamonds'?'Diamonds':'User wallet coins';
    Alert.alert('Confirm recipient',`${person?.display_name||'Member'}\nID ${person?.public_id}\n\n${assetLabel} ${value>0?'+':''}${n(value)}`,[{text:'Cancel',style:'cancel'},{text:'CONFIRM',onPress:performApply}]);
  };

  const visible=useMemo(()=>filter==='all'?rows:rows.filter(x=>x.category===filter),[rows,filter]);

  return <View>
    <Text style={s.heading}>Finance control • one place</Text><OwnerPaymentControl onNotice={onNotice}/>
    <Text style={s.help}>Verify the permanent ID profile first, then confirm recharge or funding. The reason is optional; a safe reference is created automatically when left blank.</Text>
    <View style={s.modeRow}>
      <Pressable onPress={()=>setDestination('wallet')} style={[s.mode,destination==='wallet'&&s.modeOn]}><Text style={[s.modeText,destination==='wallet'&&s.modeTextOn]}>USER WALLET</Text></Pressable>
      <Pressable onPress={()=>setDestination('seller')} style={[s.mode,destination==='seller'&&s.modeOn]}><Text style={[s.modeText,destination==='seller'&&s.modeTextOn]}>SELLER INVENTORY</Text></Pressable>
      <Pressable onPress={()=>setDestination('diamonds')} style={[s.mode,destination==='diamonds'&&s.modeOn]}><Text style={[s.modeText,destination==='diamonds'&&s.modeTextOn]}>DIAMONDS</Text></Pressable>
    </View>
    <View style={s.card}><AiBackdrop opacity={.22}/>
      <View style={s.idRow}><TextInput value={publicId} editable={!busy} onChangeText={x=>{setPublicId(x);clearLookup();}} keyboardType="number-pad" placeholder="Permanent ID" placeholderTextColor="#737B8E" style={[s.input,s.idInput]}/><Pressable disabled={busy||lookupBusy} onPress={load} style={s.lookup}><Text style={s.lookupText}>{lookupBusy?'CHECKING…':'CHECK ID'}</Text></Pressable></View>
      {lookupBusy?<ActivityIndicator color={C.cyan} style={{marginTop:8}}/>:null}
      {lookupError?<Text accessibilityLiveRegion="polite" style={[s.meta,{color:C.danger}]}>{lookupError}</Text>:null}
      {dashboard?<View style={s.confirmPerson}>{dashboard.avatar_url?<Image source={{uri:dashboard.avatar_url}} style={s.dp}/>:<View style={s.dp}><Text style={{fontSize:22}}>☺</Text></View>}<View style={s.flex}><Text style={s.personName}>{dashboard.display_name||'Member'}</Text><Text style={s.meta}>ID {dashboard.public_id} • 🪙 {n(dashboard.coin_balance)} • ◆ {n(dashboard.diamond_balance)}</Text></View><Text style={s.verified}>✓ VERIFIED</Text></View>:null}
      <Text style={s.quickLabel}>EDIT COIN PRICE • OWNER CONTROL</Text>
      <View style={s.convertRow}><View style={s.convertField}><Text style={s.convertLabel}>DOLLAR</Text><TextInput value={baseUsd} onChangeText={x=>setBaseUsd(x.replace(/[^0-9.]/g,''))} keyboardType="decimal-pad" placeholder="1" placeholderTextColor="#737B8E" style={s.convertInput}/></View><View style={s.convertField}><Text style={s.convertLabel}>COINS</Text><TextInput value={coinsPerUsd} onChangeText={x=>setCoinsPerUsd(x.replace(/[^0-9]/g,''))} keyboardType="number-pad" placeholder="1000000" placeholderTextColor="#737B8E" style={s.convertInput}/></View></View>
      <View style={s.convertField}><Text style={s.convertLabel}>DIAMONDS PER $1</Text><TextInput value={diamondsPerUsd} onChangeText={x=>setDiamondsPerUsd(x.replace(/[^0-9]/g,''))} keyboardType="number-pad" placeholder="1000000" placeholderTextColor="#737B8E" style={s.convertInput}/></View><Text style={s.rateReference}>$1 = ◆ {Number(diamondsPerUsd||0).toLocaleString()} DIAMONDS • $1 = 🪙 {Number(Number(coinsPerUsd||0)/Number(baseUsd||1)).toLocaleString()} COINS</Text>
      <Pressable disabled={busy||lookupBusy} onPress={saveEconomy} style={s.saveConfig}><Text style={s.saveConfigText}>SAVE COIN + DIAMOND RATES</Text></Pressable><View style={s.transferPolicy}><View style={s.flex}><Text style={s.bonusTitle}>MERCHANT → MERCHANT INVENTORY</Text><Text style={s.bonusSub}>{merchantTransfersEnabled?'ON • Merchant target allowed':'OFF • Merchant target blocked'}</Text></View><Switch disabled={policyBusy} value={merchantTransfersEnabled} onValueChange={setMerchantTransferPolicy}/></View><View style={s.transferPolicy}><View style={s.flex}><Text style={s.bonusTitle}>MERCHANT → SELLER INVENTORY</Text><Text style={s.bonusSub}>{merchantSellerTransfersEnabled?'ON • Seller target allowed':'OFF • Seller target blocked'}</Text></View><Switch disabled={policyBusy} value={merchantSellerTransfersEnabled} onValueChange={setMerchantSellerTransferPolicy}/></View>
      <View style={s.bonusCard}><View style={s.flex}><Text style={s.bonusTitle}>OWNER PLUS / MINUS %</Text><Text style={s.bonusSub}>Use +5 for extra or -5 to deduct on this transaction</Text></View><TextInput value={bonusPercent} onChangeText={x=>{const clean=x.replace(/(?!^)[+-]|[^0-9.+-]/g,'');setBonusPercent(clean);const usd=Number(usdAmount);if(Number.isFinite(usd))setAmount(String(Math.round(usd*Number(coinsPerUsd||1)*Math.max(0,1+Number(clean||0)/100))))}} keyboardType="numbers-and-punctuation" placeholder="+0 / -0" placeholderTextColor="#737B8E" style={s.bonusInput}/><Text style={s.bonusMark}>%</Text></View>
      {Number(bonusPercent||0)!==0&&Number(usdAmount||0)>0?<Text style={s.bonusPreview}>${usdAmount} {Number(bonusPercent)>0?'+':''}{bonusPercent}% = 🪙 {n(amount)}</Text>:null}
      <View style={s.convertRow}><View style={s.convertField}><Text style={s.convertLabel}>COINS</Text><TextInput value={amount} onChangeText={setCoinValue} keyboardType="numbers-and-punctuation" placeholder={destination==='seller'?'+100000 fund / -100000 deduct':destination==='diamonds'?'+1000 diamonds / -1000 deduct':'+1000 recharge / -1000 deduct'} placeholderTextColor="#737B8E" style={s.convertInput}/></View><View style={s.convertField}><Text style={s.convertLabel}>USD</Text><TextInput value={usdAmount} onChangeText={setUsdValue} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#737B8E" style={s.convertInput}/></View></View>
      <TextInput value={note} onChangeText={setNote} maxLength={500} placeholder="Reason / reference (optional)" placeholderTextColor="#737B8E" style={s.input}/>
      <View style={s.actions}><Pressable disabled={busy||lookupBusy} onPress={apply} style={[s.primary,busy&&s.disabled]}><Text style={s.primaryText}>{busy?'WAIT…':'CONFIRM & APPLY'}</Text></Pressable><Pressable disabled={busy||lookupBusy} onPress={load} style={s.secondary}><Text style={s.secondaryText}>VIEW RECORD</Text></Pressable></View>
    </View>

    <OwnerFinanceActivityHistory onNotice={onNotice} refreshKey={financeAuditKey}/><CoinAuthorityHistory key={financeAuditKey} publicId={0}/>

    {dashboard?<>
      <View style={s.person}><View style={s.personCopy}><Text style={s.personName}>{dashboard.display_name||'Member'}</Text><Text style={s.meta}>ID {dashboard.public_id} • Sending LV.{dashboard.sending_level||1} • Receiving LV.{dashboard.receiving_level||1}</Text></View></View>
      <View style={s.balanceGrid}>
        <View style={s.balance}><Text style={s.label}>USER COINS</Text><Text style={s.coin}>🪙 {n(dashboard.coin_balance)}</Text></View>
        <View style={s.balance}><Text style={s.label}>DIAMONDS</Text><Text style={s.diamond}>◆ {n(dashboard.diamond_balance)}</Text></View>
        <View style={s.balance}><Text style={s.label}>SELLER BALANCE</Text><Text style={s.seller}>◈ {n(dashboard.seller_balance)}</Text></View>
      </View>
      <View style={s.totalGrid}>
        {[['Sent gifts',dashboard.gift_sent_total],['Received gifts',dashboard.gift_received_total],['Recharged',dashboard.recharge_total],['Diamonds exchanged',dashboard.diamond_exchanged_total],['Seller→users',dashboard.seller_recharge_out_total],['Merchant→seller in',dashboard.seller_inventory_received_total]].map(([label,value])=><View key={label} style={s.total}><Text style={s.totalN}>{n(value)}</Text><Text style={s.meta}>{label}</Text></View>)}
      </View>
      {salaryRows.length?<><Text style={s.heading}>Salary / advance records</Text>{salaryRows.map(r=><View key={r.id} style={s.salary}><View style={s.flex}><Text style={s.rowTitle}>{String(r.role_key).replaceAll('_',' ').toUpperCase()} • {r.period_key}</Text><Text style={s.meta}>Target units {n(r.eligible_units)} • Status {String(r.status).toUpperCase()}</Text></View><View style={s.delta}><Text style={s.coin}>Earned {n(r.earned_amount)}</Text><Text style={s.diamond}>Advance {n(r.advance_used)}</Text></View></View>)}</>:null}
      <Text style={s.heading}>Records</Text>
      <View style={s.filters}>{['all','sending','receiving','recharge','seller','exchange','wallet'].map(x=><Pressable key={x} onPress={()=>setFilter(x)} style={[s.filter,filter===x&&s.filterOn]}><Text style={[s.filterText,filter===x&&s.filterTextOn]}>{x.toUpperCase()}</Text></Pressable>)}</View>
      {recordsLoading?<Text style={s.meta}>Loading transaction and salary records…</Text>:null}
      {Object.values(recordErrors).length?<View><Text style={[s.meta,{color:C.danger}]}>{Object.values(recordErrors).join('\n')}</Text><Pressable disabled={lookupBusy} onPress={load} style={s.secondary}><Text style={s.secondaryText}>RETRY RECORDS</Text></Pressable></View>:null}
      {visible.slice(0,recordLimit).map(row=>{const deltaValue=Number(row.coin_delta)||Number(row.diamond_delta)||Number(row.seller_delta)||0;const incoming=deltaValue>0;return <View key={`${row.event_id}-${row.created_at}`} style={s.row}><View style={[s.transactionIcon,incoming?s.transactionIn:s.transactionOut]}><Text style={s.transactionIconText}>{incoming?'＋':'−'}</Text></View><View style={s.rowMain}><Text style={s.rowTitle}>{String(row.category||'wallet').toUpperCase()} • {String(row.direction||'').toUpperCase()}</Text><Text style={s.meta}>{row.note||'Finance event'}</Text><Text style={s.meta}>{row.counterparty_public_id?`Other ID ${row.counterparty_public_id} • `:''}{row.room_public_id?`Room ${row.room_public_id} • `:''}{new Date(row.created_at).toLocaleString()}</Text></View><View style={s.delta}>{Number(row.coin_delta)!==0?<><Text style={[s.deltaText,{color:Number(row.coin_delta)>0?C.green:C.danger}]}>{signed(row.coin_delta)} 🪙</Text><Text style={s.usdRecord}>${(Math.abs(Number(row.coin_delta))/Math.max(1,Number(coinsPerUsd||1))).toLocaleString(undefined,{maximumFractionDigits:2})}</Text></>:null}{Number(row.diamond_delta)!==0?<Text style={[s.deltaText,{color:Number(row.diamond_delta)>0?C.cyan:C.danger}]}>{signed(row.diamond_delta)} ◆</Text>:null}{Number(row.seller_delta)!==0?<><Text style={[s.deltaText,{color:Number(row.seller_delta)>0?C.gold:C.danger}]}>{signed(row.seller_delta)} ◈</Text><Text style={s.usdRecord}>${(Math.abs(Number(row.seller_delta))/Math.max(1,Number(coinsPerUsd||1))).toLocaleString(undefined,{maximumFractionDigits:2})}</Text></>:null}</View></View>})}
      {visible.length>recordLimit?<Pressable onPress={()=>setRecordLimit(value=>value+50)} style={s.secondary}><Text style={s.secondaryText}>SHOW MORE RECORDS ({Math.min(recordLimit,visible.length)}/{visible.length})</Text></Pressable>:null}
      {!recordsLoading&&!Object.values(recordErrors).length&&!visible.length?<View style={s.empty}><Text style={s.meta}>No record in this category yet.</Text></View>:null}
    </>:null}
  </View>;
}

const s=StyleSheet.create({heading:{color:C.text,fontSize:17,fontWeight:'900',marginTop:16,marginBottom:8},help:{color:C.muted,fontSize:9,lineHeight:14,marginBottom:8},modeRow:{flexDirection:'row',gap:7},mode:{flex:1,minHeight:38,borderRadius:12,borderWidth:1,borderColor:'#684974',backgroundColor:'#281B35',alignItems:'center',justifyContent:'center'},modeOn:{backgroundColor:'#4B35B3',borderColor:C.gold},modeText:{color:C.muted,fontSize:8,fontWeight:'900'},modeTextOn:{color:'#fff'},rateRow:{flexDirection:'row',alignItems:'center',gap:7,marginTop:5},rateDollar:{color:C.green,fontSize:15,fontWeight:'900'},rateInput:{flex:1,minHeight:40,borderRadius:11,backgroundColor:'#0D1019',borderWidth:1,borderColor:C.gold,color:C.text,paddingHorizontal:10},rateCoin:{color:C.gold,fontSize:8,fontWeight:'900'},saveConfig:{minHeight:40,borderRadius:11,backgroundColor:'#2B6650',alignItems:'center',justifyContent:'center',marginTop:7},saveConfigText:{color:'#fff',fontSize:8,fontWeight:'900'},convertRow:{flexDirection:'row',gap:7,marginTop:8},convertField:{flex:1},convertLabel:{color:C.cyan,fontSize:7,fontWeight:'900',marginBottom:3},bonusCard:{minHeight:54,borderRadius:13,backgroundColor:'#18142C',borderWidth:1,borderColor:'#5947A7',paddingHorizontal:10,marginTop:9,flexDirection:'row',alignItems:'center',gap:7},bonusTitle:{color:C.gold,fontSize:8,fontWeight:'900'},bonusSub:{color:C.muted,fontSize:7,marginTop:2},bonusInput:{width:62,minHeight:38,borderRadius:10,backgroundColor:'#0D1019',borderWidth:1,borderColor:C.gold,color:C.text,textAlign:'center',fontWeight:'900'},bonusMark:{color:C.gold,fontSize:12,fontWeight:'900'},bonusPreview:{color:C.green,fontSize:9,fontWeight:'900',marginTop:6,textAlign:'right'},rateReference:{color:C.gold,fontSize:11,fontWeight:'900',marginTop:9,marginBottom:2,letterSpacing:.2},convertInput:{minHeight:44,borderRadius:12,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#30364A',color:C.text,paddingHorizontal:10,fontSize:10},quickCoin:{color:C.text,fontSize:8,fontWeight:'900'},quickUsd:{color:C.green,fontSize:7,fontWeight:'800',marginTop:2},quickLabel:{color:C.gold,fontSize:7,fontWeight:'900',marginTop:10},quickGrid:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:5},quickItem:{width:'48%',borderRadius:10,borderWidth:1,borderColor:'#684974',overflow:'hidden'},quickInput:{minHeight:34,color:C.text,paddingHorizontal:8,fontSize:9,backgroundColor:'#0D1019'},quickUse:{minHeight:42,alignItems:'center',justifyContent:'center',backgroundColor:'#33266E'},quickUseText:{color:'#fff',fontSize:7,fontWeight:'900'},card:{backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',borderRadius:18,padding:11,marginTop:8},idRow:{flexDirection:'row',gap:7},idInput:{flex:1},input:{minHeight:44,borderRadius:12,backgroundColor:'#0D1019',borderWidth:1,borderColor:'#30364A',color:C.text,paddingHorizontal:12,marginTop:7,fontSize:11},lookup:{minWidth:78,borderRadius:12,backgroundColor:'#263044',alignItems:'center',justifyContent:'center',marginTop:7},lookupText:{color:C.cyan,fontSize:7,fontWeight:'900'},confirmPerson:{minHeight:62,borderRadius:15,backgroundColor:'#101B22',borderWidth:1,borderColor:'#295060',padding:8,marginTop:8,flexDirection:'row',alignItems:'center',gap:8},dp:{width:44,height:44,borderRadius:15,backgroundColor:'#29234C',alignItems:'center',justifyContent:'center'},flex:{flex:1},verified:{color:C.green,fontSize:6,fontWeight:'900'},actions:{flexDirection:'row',gap:7,marginTop:9},primary:{flex:1,minHeight:44,borderRadius:12,backgroundColor:'#67407C',alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontSize:9,fontWeight:'900'},secondary:{flex:1,minHeight:44,borderRadius:12,backgroundColor:'#23293A',borderWidth:1,borderColor:'#684974',alignItems:'center',justifyContent:'center'},secondaryText:{color:C.cyan,fontSize:9,fontWeight:'900'},disabled:{opacity:.55},person:{backgroundColor:'#17132D',borderRadius:16,borderWidth:1,borderColor:'#4B3CA0',padding:12,marginTop:10,flexDirection:'row',alignItems:'center'},personCopy:{flex:1},personName:{color:C.text,fontSize:14,fontWeight:'900'},meta:{color:C.muted,fontSize:8,lineHeight:13,marginTop:3},balanceGrid:{flexDirection:'row',gap:6,marginTop:8},balance:{flex:1,minHeight:76,borderRadius:15,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',padding:9},label:{color:C.muted,fontSize:7,fontWeight:'900'},coin:{color:C.gold,fontSize:10,fontWeight:'900',marginTop:5},diamond:{color:C.cyan,fontSize:10,fontWeight:'900',marginTop:5},seller:{color:'#D8C4FF',fontSize:12,fontWeight:'900',marginTop:8},totalGrid:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:7},total:{width:'32%',minHeight:62,borderRadius:14,backgroundColor:'#10141E',borderWidth:1,borderColor:'#684974',padding:8},totalN:{color:C.text,fontSize:11,fontWeight:'900'},salary:{minHeight:67,borderRadius:15,backgroundColor:'#17132D',borderWidth:1,borderColor:'#4B3CA0',padding:9,marginBottom:6,flexDirection:'row',alignItems:'center'},filters:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:8},filter:{borderRadius:999,backgroundColor:'#281B35',borderWidth:1,borderColor:'#684974',paddingHorizontal:9,paddingVertical:7},filterOn:{backgroundColor:'#5039BB',borderColor:C.gold},filterText:{color:C.muted,fontSize:7,fontWeight:'900'},filterTextOn:{color:'#fff'},transferPolicy:{minHeight:54,borderRadius:13,backgroundColor:'#18142C',borderWidth:1,borderColor:'#5947A7',paddingHorizontal:10,marginTop:9,flexDirection:'row',alignItems:'center',gap:7},row:{minHeight:72,borderRadius:16,backgroundColor:'#180F25',borderWidth:1,borderColor:'#684974',padding:10,marginBottom:7,flexDirection:'row',alignItems:'center'},transactionIcon:{width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',marginRight:9},transactionIn:{backgroundColor:'#143329',borderWidth:1,borderColor:'#2C7658'},transactionOut:{backgroundColor:'#39212A',borderWidth:1,borderColor:'#7B3448'},transactionIconText:{color:'#fff',fontSize:19,fontWeight:'900'},rowMain:{flex:1},rowTitle:{color:C.text,fontSize:10,fontWeight:'900'},delta:{alignItems:'flex-end',gap:2},usdRecord:{color:C.green,fontSize:7,fontWeight:'900'},deltaText:{fontSize:9,fontWeight:'900'},empty:{padding:18,alignItems:'center'}});

