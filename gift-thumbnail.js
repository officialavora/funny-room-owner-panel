const videoPath=/[.]mp4(?:[?#]|$)/i;
export function giftThumbnailSource({file,videoUrl,assetKey,originalAssetKey,originalVideoUrl,regenerate}){
 if(file)return videoPath.test(file.name)&&(!assetKey||assetKey===originalAssetKey)?file:null;
 return videoPath.test(videoUrl||'')&&(regenerate||videoUrl!==originalVideoUrl&&!/^https:\/\//i.test(assetKey||''))?videoUrl:null;
}

export async function createGiftThumbnail(source){
 const video=document.createElement('video');
 const local=typeof source!=='string';
 const url=local?URL.createObjectURL(source):source;
 video.preload='auto';
 video.muted=true;
 video.playsInline=true;
 if(!local)video.crossOrigin='anonymous';
 function wait(event,action){
  return new Promise((resolve,reject)=>{
   const finish=error=>{
    clearTimeout(timer);
    video.removeEventListener(event,ready);
    video.removeEventListener('error',failed);
    if(error)reject(error);else resolve();
   };
   const ready=()=>finish(),failed=()=>finish(Error('Could not read the gift video. Choose a thumbnail image.'));
   const timer=setTimeout(failed,10000);
   video.addEventListener(event,ready,{once:true});
   video.addEventListener('error',failed,{once:true});
   try{action();}catch(error){finish(error);}
  });
 }
 try{
  await wait('loadedmetadata',()=>{video.src=url;});
  if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight)throw Error('Video dimensions unavailable');
  await wait('seeked',()=>{video.currentTime=video.duration*.35;});
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=384;
  const side=Math.min(video.videoWidth,video.videoHeight);
  const context=canvas.getContext('2d');
  if(!context)throw Error('Thumbnail drawing unavailable');
  context.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,384,384);
  const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
  if(!image)throw Error('Could not create a gift thumbnail');
  return new File([image],'gift-thumbnail.jpg',{type:'image/jpeg'});
 }finally{
  video.removeAttribute('src');
  video.load();
  if(local)URL.revokeObjectURL(url);
 }
}
