const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/OwnerPolicyCenter.js','utf8');
const object=source.match(/supabase\.rpc\("owner_update_gift", (\{[\s\S]*?\n    \})\)/)?.[1];assert(object,'Original gift editor RPC object found');
const e={id:'fixture',name:'AI gift',coin_price:110,diamond_value:70,category:'custom',asset_key:'original-art',effect_kind:'original-effect',effect_asset_url:'https://example.invalid/effect.webp',sound_url:'https://example.invalid/sound.mp3',allow_custom_combo:true,custom_combo_max:99,active:true,featured:true,sort_order:37,min_vip_level:8};
const payload=vm.runInNewContext('('+object+')',{e,combos:[1,10]});
for(const [field,expected] of Object.entries({asset_key:e.asset_key,effect_kind:e.effect_kind,effect_asset_url:e.effect_asset_url,sound_url:e.sound_url,sort_order:e.sort_order,min_vip_level:e.min_vip_level}))assert.equal(payload['p_'+field],expected,field+' preserved during price edit');assert.equal(Object.keys(payload).length,16);console.log('PASS: Gift save includes every required RPC argument and preserves original AI/media metadata');
