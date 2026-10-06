import {supabase} from '../lib/supabase';

export async function dailyCoinRpc(name,params,signal) {
  const controller=new AbortController();
  const stop=()=>controller.abort();
  if(signal?.aborted)controller.abort();
  signal?.addEventListener('abort',stop);
  let timer,abortHandler;
  try {
    const cancelled=new Promise((_,reject)=>{
      abortHandler=()=>reject(new Error('Daily reward request interrupted. Retry to check its saved result.'));
      controller.signal.addEventListener('abort',abortHandler);
      if(controller.signal.aborted)abortHandler();
      timer=setTimeout(stop,20000);
    });
    const request=supabase.rpc(name,params).abortSignal(controller.signal);
    const result=await Promise.race([request,cancelled]);
    if(result.error)throw new Error(result.error.message||'Daily reward request failed.');
    return result.data;
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',stop);
    controller.signal.removeEventListener('abort',abortHandler);
  }
}

