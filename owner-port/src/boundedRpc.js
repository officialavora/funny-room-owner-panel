// A timeout does not prove that a mutation failed. Callers retain request IDs
// and reconcile financial receipts before creating another request.
export async function boundedRpc(client,name,params,{label='Request',timeoutMs=20000}={}){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer;
  try{
    const call=client.rpc(name,params);
    const request=controller&&typeof call?.abortSignal==='function'?call.abortSignal(controller.signal):call;
    return await Promise.race([request,new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller?.abort();const error=new Error(`${label} timed out. Retry to check the saved result.`);error.code='NETWORK_ERROR';reject(error);},timeoutMs);
    })]);
  }finally{clearTimeout(timer);}
}

