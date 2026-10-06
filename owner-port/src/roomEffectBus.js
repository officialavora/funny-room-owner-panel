const listeners=new Set();

export function emitRoomEffect(event){
  if(!event||!event.type)return;
  listeners.forEach(fn=>{try{fn(event)}catch{}});
}

export function subscribeRoomEffect(fn){
  listeners.add(fn);
  return()=>listeners.delete(fn);
}

