const activeURLs=new Set(),pendingEditors=new Set(),pendingPickers=new Set();
const localURL=file=>{const uri=URL.createObjectURL(file);activeURLs.add(uri);return uri};
export function releaseOwnerMedia(){for(const cancel of [...pendingEditors,...pendingPickers])cancel();for(const uri of activeURLs)URL.revokeObjectURL(uri);activeURLs.clear()}
export async function getDocumentAsync({type='*/*',multiple=false}={}){
 return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept=Array.isArray(type)?type.join(','):type;input.multiple=multiple;input.style.display='none';document.body.append(input);let done=false;
 const finish=value=>{if(done)return;done=true;input.remove();pendingPickers.delete(cancel);resolve(value)};
 const cancel=()=>finish({canceled:true,assets:null});pendingPickers.add(cancel);
 input.addEventListener('cancel',()=>finish({canceled:true,assets:null}));
 input.onchange=()=>{const files=[...input.files];finish(files.length?{canceled:false,assets:files.map(file=>({uri:localURL(file),name:file.name,size:file.size,mimeType:file.type,file}))}:{canceled:true,assets:null});};input.click();
 });
}
export const requestMediaLibraryPermissionsAsync=async()=>({granted:true,status:'granted'});
async function cropAsset(asset,{aspect=[1,1],quality=.8}={}){
 const picture=new Image();picture.src=asset.uri;await picture.decode();const ratio=Number(aspect[0])/Number(aspect[1]);if(!Number.isFinite(ratio)||ratio<=0)throw new Error('Invalid crop aspect ratio');
 return new Promise((resolve,reject)=>{const dialog=document.createElement('dialog');dialog.className='owner-media-editor';Object.assign(dialog.style,{maxWidth:'min(440px,calc(100vw - 32px))',color:'#f5eefa',background:'#17112e',border:'1px solid #cda662',borderRadius:'22px',padding:'20px'});const title=document.createElement('h3');title.textContent='Crop photo';dialog.append(title);const canvas=document.createElement('canvas');const baseWidth=Math.min(picture.naturalWidth,picture.naturalHeight*ratio);canvas.width=Math.min(2048,Math.round(baseWidth));canvas.height=Math.round(canvas.width/ratio);Object.assign(canvas.style,{width:'100%',maxHeight:'300px',objectFit:'contain',background:'#0d1220'});dialog.append(canvas);const controls={};
 const draw=()=>{const width=baseWidth/Number(controls.Zoom.value),height=width/ratio;const x=(picture.naturalWidth-width)*(Number(controls.Horizontal.value)+1)/2,y=(picture.naturalHeight-height)*(Number(controls.Vertical.value)+1)/2;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas.getContext('2d').drawImage(picture,x,y,width,height,0,0,canvas.width,canvas.height)};
 for(const name of ['Zoom','Horizontal','Vertical']){const label=document.createElement('label');label.textContent=name;label.style.display='block';const input=document.createElement('input');input.type='range';input.setAttribute('aria-label',name);input.min=name==='Zoom'?'1':'-1';input.max=name==='Zoom'?'4':'1';input.step='.01';input.value=name==='Zoom'?'1':'0';input.style.width='100%';controls[name]=input;label.append(input);dialog.append(label);input.oninput=draw;}
 const close=()=>{dialog.close();dialog.remove();pendingEditors.delete(abort)};const abort=()=>{close();resolve(null)};pendingEditors.add(abort);const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>{close();resolve(null)};const accept=document.createElement('button');accept.textContent='Use cropped photo';Object.assign(accept.style,{minHeight:'44px',marginLeft:'10px',padding:'8px 14px',borderRadius:'12px',background:'#38224d',color:'#f5eefa',border:'1px solid #cda662'});accept.onclick=()=>{accept.disabled=true;const mime=asset.mimeType==='image/png'?'image/png':'image/jpeg';canvas.toBlob(blob=>{if(!blob){close();reject(new Error('Photo crop failed'));return}const file=new globalThis.File([blob],asset.name.replace(/\.[^.]+$/,'')+(mime==='image/png'?'.png':'.jpg'),{type:mime});close();resolve({uri:localURL(file),name:file.name,size:file.size,mimeType:mime,file,width:canvas.width,height:canvas.height})},mime,Math.min(1,Math.max(.1,Number(quality)||.8)))};dialog.oncancel=()=>{close();resolve(null)};dialog.append(cancel,accept);document.body.append(dialog);draw();dialog.showModal();
 });
}
export async function launchImageLibraryAsync(options={}){
 const picked=await getDocumentAsync({type:'image/*',multiple:!!options.allowsMultipleSelection});if(picked.canceled)return picked;
 if(options.selectionLimit>0)picked.assets=picked.assets.slice(0,options.selectionLimit);
 if(options.allowsEditing&&!options.allowsMultipleSelection){const edited=await cropAsset(picked.assets[0],options);return edited?{canceled:false,assets:[edited]}:{canceled:true,assets:null}}
 return picked;
}
export const MediaTypeOptions={Images:'images'};
export class File{constructor(uri){this.uri=uri}async arrayBuffer(){return (await fetch(this.uri)).arrayBuffer()}}
