import {visibleControls,canManageProfile} from './access.js';
import React,{useState,useEffect} from 'react';
import {closeOwnerDialogs} from './native.js';
import {releaseOwnerMedia} from './media.js';
import {stopOwnerAudio} from './audio.js';
import {createRoot} from 'react-dom/client';
import {attachPanelClient} from '../lib/supabase.js';
import ApplicationCenter from '../src/OwnerApplicationCenter.js';
import {OwnerSupportDesk as SupportDesk} from '../src/SupportCenter.js';
import OwnerProfileManage from '../src/OwnerProfileManage.js';
import AuthorityCenter from '../src/OwnerAuthorityCenter.js';
import UserAnalyticsCenter from '../src/OwnerUserAnalyticsCenter.js';
import IdentityCenter from '../src/OwnerIdentityCenter.js';
import FinanceCenter from '../src/OwnerFinanceCenter.js';
import PaymentControl from '../src/payments/OwnerPaymentControl.js';
import RoomInspector from '../src/OwnerRoomInspector.js';
import PolicyCenter from '../src/OwnerPolicyCenter.js';
import CampaignRewardsCenter from '../src/OwnerCampaignRewardsCenter.js';
import DailySignInRewards from '../src/OwnerDailySignInRewards.js';
import AffinityPolicyCenter from '../src/OwnerAffinityPolicyCenter.js';
import RewardOperationsCenter from '../src/OwnerRewardOperationsCenter.js';
import ProgressionOperationsCenter from '../src/OwnerProgressionOperationsCenter.js';
import GiftCatalog from '../src/OwnerGiftCatalog.js';
import CosmeticCatalog from '../src/OwnerCosmeticCatalog.js';
import EmojiCatalog from '../src/OwnerEmojiCatalog.js';
import ModerationCenter from '../src/OwnerModerationCenter.js';
import BanCenter from '../src/OwnerBanCenter.js';
import SafetyCenter from '../src/OwnerSafetyCenter.js';
import CaptureCenter from '../src/OwnerCaptureCenter.js';
import EvidenceVault from '../src/OwnerEvidenceVault.js';
import SafeResetV3Center from '../src/OwnerSafeResetV3Center.js';
import UserResetCenter from '../src/OwnerUserResetCenter.js';
import SalaryDesk from '../src/OwnerSalaryDesk.js';
import SettlementDesk from '../src/OwnerSettlementDesk.js';
import RechargeLimits from '../src/OwnerRechargeLimits.js';
import DailyCoinGrantCenter from '../src/OwnerDailyCoinGrantCenter.js';
import LuckyGiftReversalCenter from '../src/OwnerLuckyGiftReversalCenter.js';
import VanityIdScreen from '../src/OwnerVanityIdScreen.js';
import OpsReferenceCenter from '../src/OwnerOpsReferenceCenter.js';
const screens=[['ApplicationCenter','Complete Application Owner Center',ApplicationCenter],['SupportDesk','Support Desk',SupportDesk],
['AuthorityCenter','Authority',AuthorityCenter],
['UserAnalyticsCenter','UserAnalytics',UserAnalyticsCenter],
['IdentityCenter','Identity',IdentityCenter],
['FinanceCenter','Finance',FinanceCenter],
['PaymentControl','PaymentControl',PaymentControl],
['RoomInspector','RoomInspector',RoomInspector],
['PolicyCenter','Policy',PolicyCenter],
['CampaignRewardsCenter','CampaignRewards',CampaignRewardsCenter],
['DailySignInRewards','DailySignInRewards',DailySignInRewards],
['AffinityPolicyCenter','AffinityPolicy',AffinityPolicyCenter],
['RewardOperationsCenter','RewardOperations',RewardOperationsCenter],
['ProgressionOperationsCenter','ProgressionOperations',ProgressionOperationsCenter],
['GiftCatalog','GiftCatalog',GiftCatalog],
['CosmeticCatalog','CosmeticCatalog',CosmeticCatalog],
['EmojiCatalog','EmojiCatalog',EmojiCatalog],
['ModerationCenter','Moderation',ModerationCenter],
['BanCenter','Ban',BanCenter],
['SafetyCenter','Safety',SafetyCenter],
['CaptureCenter','Capture',CaptureCenter],
['EvidenceVault','EvidenceVault',EvidenceVault],
['SafeResetV3Center','SafeResetV3',SafeResetV3Center],
['UserResetCenter','UserReset',UserResetCenter],
['SalaryDesk','SalaryDesk',SalaryDesk],
['SettlementDesk','SettlementDesk',SettlementDesk],
['RechargeLimits','RechargeLimits',RechargeLimits],
['DailyCoinGrantCenter','DailyCoinGrant',DailyCoinGrantCenter],
['LuckyGiftReversalCenter','LuckyGiftReversal',LuckyGiftReversalCenter],
['VanityIdScreen','VanityId',VanityIdScreen],
['OpsReferenceCenter','OpsReference',OpsReferenceCenter]
];
class Boundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return {error}}render(){return this.state.error?<div role="alert">Control could not load: {this.state.error.message}. Return to another control and retry.</div>:this.props.children;}}
function Controls({userId,access}){const allowed=visibleControls(screens,access);const [selected,setSelected]=useState(screens[0][0]),[notice,setNotice]=useState(''),[target,setTarget]=useState(''),[profile,setProfile]=useState(null);useEffect(()=>()=>{closeOwnerDialogs();stopOwnerAudio();releaseOwnerMedia()},[selected]);const Component=allowed.find(x=>x[0]===selected)[2];return <section className="full-owner-controls"><h3>Funny Room · Application Owner controls</h3><p>Your assigned permissions govern every action. Unreleased controls remain unavailable until verification is complete.</p><label>Control <select value={selected} onChange={e=>{setNotice('');setSelected(e.target.value)}}>{allowed.map(([id,label])=><option value={id} key={id}>{label.replace(/([a-z])([A-Z])/g,'$1 $2')}</option>)}</select></label>{canManageProfile(access)&&<div style={{display:'flex',gap:8,margin:'16px 0'}}><input aria-label="Profile permanent ID" placeholder="Permanent ID" type="number" min="1" step="1" value={target} onChange={e=>setTarget(e.target.value)}/><button onClick={()=>{const id=Number(target);if(!Number.isSafeInteger(id)||id<1)return setNotice('Valid permanent ID required');setProfile({public_id:id})}}>Manage profile / VIP / SVIP</button></div>}{notice&&<p role="status">{notice}</p>}<Boundary key={selected}><Component userId={userId} onClose={()=>setSelected(screens[0][0])} onNotice={setNotice}/></Boundary><OwnerProfileManage visible={!!profile} profile={profile} onClose={()=>setProfile(null)} onChanged={()=>setNotice('Profile updated')}/></section>}
export async function mountOwnerControls(container,client){attachPanelClient(client);const {data,error}=await client.auth.getUser();if(error||!data?.user)throw new Error('Sign in to the existing panel first');const access=await client.rpc('current_staff_access');if(access.error||!access.data?.is_staff)throw new Error(access.error?.message||'Protected staff role required');const panelAccess=await client.rpc('panel_my_access');if(panelAccess.error||!panelAccess.data||(!panelAccess.data.is_founder&&!(panelAccess.data.rank>0)))throw new Error(panelAccess.error?.message||'Active panel authority required');const root=createRoot(container);root.render(<Controls userId={data.user.id} access={panelAccess.data}/>);return ()=>{root.unmount();closeOwnerDialogs();stopOwnerAudio();releaseOwnerMedia()};}
