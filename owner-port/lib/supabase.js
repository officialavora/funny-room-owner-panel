// Web port: use the existing panel client, session and server authority.
const LIVE_URL='https://zspcgyhchaqpiyujyxqp.supabase.co',STAGE_URL='https://supaxsiylqysvzutwjrw.supabase.co';
export let SUPABASE_URL=LIVE_URL;
export let SUPABASE_PUBLISHABLE_KEY='sb_publishable_eUygC1Ff8vNqZHcZIOUrPw_rZb6fjQZ';
export let supabase;
export function attachPanelClient(client){
 if(!client?.auth||!client?.rpc)throw new Error('Panel client required');
 const endpoint=client.supabaseUrl||LIVE_URL;
 if(endpoint!==LIVE_URL&&endpoint!==STAGE_URL)throw new Error('Unapproved panel backend');
 SUPABASE_URL=endpoint;
 SUPABASE_PUBLISHABLE_KEY=endpoint===STAGE_URL?'sb_publishable_Zp8KxIYoDB4UAE84dWnHEw_A_ZOpP16':'sb_publishable_eUygC1Ff8vNqZHcZIOUrPw_rZb6fjQZ';
 supabase=client;
}
