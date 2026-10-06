export const PROFILE_AUDIO_TYPES=['audio/mpeg','audio/mp3','audio/mp4','audio/aac','audio/x-m4a'];
export function ownerMediaDestination({kind='user',targetId,type,asset,stamp=Date.now()}){
  if(!targetId)throw new Error('Load a profile before selecting media.');
  const audio=type==='audio';
  const ext=String(asset?.name||asset?.fileName||asset?.uri||'').split('?')[0].split('.').pop().toLowerCase();
  const fallback=audio?({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac'}[ext]):({png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg'}[ext]);
  const mime=asset?.mimeType||fallback||'';
  if(audio&&kind==='user'&&!PROFILE_AUDIO_TYPES.includes(mime))throw new Error('Choose MP3, M4A or AAC audio.');
  if(!audio&&!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Choose a JPG, PNG or WebP image.');
  const limit=kind==='room'?100*1024*1024:(audio?20:5)*1024*1024;
  if(Number(asset?.size||asset?.fileSize||0)>limit)throw new Error(`Choose a file smaller than ${limit/1024/1024} MB.`);
  const suffix={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3','audio/mp3':'mp3','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/aac':'aac'}[mime]||ext||'mp3';
  return {bucket:kind==='room'?'room-media':audio?'profile-audio':'avatars',path:`${targetId}/owner-${type}-${stamp}.${suffix}`,mime,limit};
}

