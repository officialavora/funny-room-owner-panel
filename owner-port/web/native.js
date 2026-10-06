export * from 'react-native-web';
import backdrop from '../assets/backgrounds/app-satin-ai-v1.png';
const dialogs=new Set();
export function closeOwnerDialogs(){for(const dialog of dialogs){dialog.close();dialog.remove()}dialogs.clear()}
export const Alert={alert(title,message='',buttons=[{text:'OK'}]){
 const dialog=document.createElement('dialog');dialogs.add(dialog);dialog.className='owner-alert';Object.assign(dialog.style,{maxWidth:'min(440px,calc(100vw - 32px))',color:'#f3edf9',background:`linear-gradient(#17112ed9,#0d1220ee),url(${backdrop}) center/cover`,border:'1px solid #cda662',borderRadius:'22px',padding:'24px',boxShadow:'0 24px 80px #0009'});const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=message;p.style.whiteSpace='pre-wrap';dialog.append(h,p);const row=document.createElement('div');Object.assign(row.style,{display:'flex',gap:'10px',justifyContent:'flex-end',flexWrap:'wrap'});
 const remove=()=>{dialog.close();dialog.remove();dialogs.delete(dialog)};
 for(const action of buttons){const b=document.createElement('button');b.textContent=action.text||'OK';Object.assign(b.style,{minHeight:'44px',padding:'8px 16px',borderRadius:'12px',border:'1px solid #cda662',color:'#f3edf9',background:action.style==='destructive'?'#5c1c32':'#38224d',cursor:'pointer'});b.onclick=()=>{remove();action.onPress?.()};row.append(b)}dialog.append(row);dialog.oncancel=()=>{remove();buttons.find(x=>x.style==='cancel')?.onPress?.()};document.body.append(dialog);dialog.showModal();
}};
