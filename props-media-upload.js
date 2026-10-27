// Upload only immutable media through the signed-in client's existing RLS policy.
// This helper never changes catalogue rows, grants, permissions or bucket policy.
const TYPES={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',wav:'audio/wav'};
export const PROP_MEDIA_ACCEPT={artwork:'.png,.jpg,.jpeg,.webp,.gif,.mp4',sound:'.mp3,.m4a,.aac,.ogg,.wav'};
const text=(bytes,start,end)=>String.fromCharCode(...bytes.slice(start,end));
export async function validatePropMedia(file,slot){
 if(!['artwork','sound'].includes(slot))throw Error('Unknown media field');
 if(!file||!Number.isSafeInteger(file.size)||file.size<=0)throw Error('Choose a non-empty media file');
 const ext=String(file.name||'').split('.').pop().toLowerCase(),type=TYPES[ext];
 if(!type||!(slot==='sound'?type.startsWith('audio/'):type.startsWith('image/')||ext==='mp4'))throw Error('Unsupported file type for this field');
 const limit=(slot==='sound'?20:ext==='mp4'?50:10)*1024*1024;
 if(file.size>limit)throw Error('File too large: maximum '+limit/1024/1024+' MB');
 const aliases={'audio/x-m4a':'audio/mp4','audio/x-wav':'audio/wav'};
 if(file.type&&file.type!=='application/octet-stream'&&(aliases[file.type]||file.type)!==type)throw Error('File extension and media type do not match');
 const b=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const valid=ext==='png'?b[0]===137&&text(b,1,4)==='PNG':ext==='jpg'||ext==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:ext==='gif'?['GIF87a','GIF89a'].includes(text(b,0,6)):ext==='webp'?text(b,0,4)==='RIFF'&&text(b,8,12)==='WEBP':ext==='mp4'||ext==='m4a'?text(b,4,8)==='ftyp':ext==='mp3'?text(b,0,3)==='ID3'||b[0]===255&&(b[1]&224)===224:ext==='aac'?b[0]===255&&(b[1]&240)===240:ext==='ogg'?text(b,0,4)==='OggS':ext==='wav'?text(b,0,4)==='RIFF'&&text(b,8,12)==='WAVE':false;
 if(!valid)throw Error('File contents do not match the selected media format');
 return {ext,contentType:type,bucket:slot==='sound'?'owner-catalog-audio':'owner-catalog'};
}
export async function uploadPropMedia({client,file,slot,isCurrent}){
 const format=await validatePropMedia(file,slot);
 const current=()=>isCurrent()===true;
 if(!current())throw Error('Editor changed; reopen the prop');
 const first=await client.auth.getUser();if(first.error||!first.data?.user?.id)throw Error('Sign in again before uploading');
 const actor=first.data.user.id;if(!/^[a-f0-9-]{36}$/i.test(actor))throw Error('Invalid signed-in account');
 if(!current())throw Error('Editor changed; reopen the prop');
 const path=actor+'/props/'+crypto.randomUUID()+'.'+format.ext;
 const storage=client.storage.from(format.bucket);
 const result=await storage.upload(path,file,{upsert:false,contentType:format.contentType,cacheControl:'3600'});
 if(result.error)throw Error(result.error.message||'Upload failed; existing media is unchanged');
 const last=await client.auth.getUser();
 if(last.error||last.data?.user?.id!==actor||!current())throw Error('Upload finished, but account or editor changed. Existing prop was not saved.');
 const url=storage.getPublicUrl(path).data?.publicUrl;
 let parsed;try{parsed=new URL(url);}catch{throw Error('Upload returned an invalid media URL');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Upload returned an invalid media URL');
 return {url,bucket:format.bucket,path};
}
