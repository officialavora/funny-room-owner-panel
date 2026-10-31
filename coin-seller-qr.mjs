// QR Model 2, version 10, level L, byte mode, fixed mask 0. Local generation only.
// Four Reed–Solomon blocks (68,68,69,69 data bytes), 18 parity bytes each.
export function walletQR(value) {
  if(typeof value!=='string'||!value.length||value.length>200||!/^[\x20-\x7e]+$/.test(value))throw Error('Unsupported QR address');
  const bits=[]; const put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
  put(4,4);put(value.length,16);for(const ch of value)put(ch.charCodeAt(0),8);
  put(0,Math.min(4,274*8-bits.length));while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
  for(let i=0;data.length<274;i++)data.push(i%2?0x11:0xec);
  const mul=(a,b)=>{let n=0;for(let i=7;i>=0;i--){n=(n<<1)^((n>>>7)*0x11d);n^=((b>>>i)&1)*a;}return n;};
  let generator=[1];let root=1;
  for(let i=0;i<18;i++){const next=new Array(generator.length+1).fill(0);generator.forEach((g,j)=>{next[j]^=g;next[j+1]^=mul(g,root);});generator=next;root=mul(root,2);}
  let off=0;const blocks=[68,68,69,69].map(length=>{const d=data.slice(off,off+=length),work=[...d,...new Array(18).fill(0)];for(let i=0;i<d.length;i++){const f=work[i];for(let j=0;j<generator.length;j++)work[i+j]^=mul(generator[j],f);}return {d,e:work.slice(-18)};});
  const words=[];for(let i=0;i<69;i++)for(const b of blocks)if(i<b.d.length)words.push(b.d[i]);for(let i=0;i<18;i++)for(const b of blocks)words.push(b.e[i]);
  const n=57,m=Array.from({length:n},()=>new Array(n).fill(false)),reserved=Array.from({length:n},()=>new Array(n).fill(false));
  const set=(x,y,v)=>{if(x>=0&&y>=0&&x<n&&y<n){m[y][x]=Boolean(v);reserved[y][x]=true;}};
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4);}};
  for(let i=0;i<n;i++){set(6,i,i%2===0);set(i,6,i%2===0);}finder(3,3);finder(n-4,3);finder(3,n-4);
  for(const y of [6,28,50])for(const x of [6,28,50]){
    if((x===6&&y===6)||(x===6&&y===50)||(x===50&&y===6))continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(x+dx,y+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }
  const format=()=>{let rem=8<<10;for(let i=14;i>=10;i--)if((rem>>>i)&1)rem^=0x537<<(i-10);const f=((8<<10)|rem)^0x5412;const bit=i=>(f>>>i)&1;
    for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));
    for(let i=0;i<8;i++)set(n-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,n-15+i,bit(i));set(8,n-8,true);
  };format();let rem=10<<12;for(let i=17;i>=12;i--)if((rem>>>i)&1)rem^=0x1f25<<(i-12);const ver=(10<<12)|rem;
  for(let i=0;i<18;i++){const a=n-11+i%3,b=Math.floor(i/3),v=(ver>>>i)&1;set(a,b,v);set(b,a,v);}
  let cursor=0,up=true;for(let right=n-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<n;v++){const y=up?n-1-v:v;for(const x of [right,right-1])if(!reserved[y][x]){const b=cursor<words.length*8?(words[cursor>>>3]>>>(7-cursor%8))&1:0;m[y][x]=Boolean(b^((x+y)%2===0?1:0));cursor++;}}up=!up;}
  return m;
}
export function qrSVG(value){const m=walletQR(value),n=m.length+8;let path='';m.forEach((r,y)=>r.forEach((v,x)=>{if(v)path+=`M${x+4},${y+4}h1v1h-1z`;}));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="white"/><path d="${path}" fill="black"/></svg>`;}
