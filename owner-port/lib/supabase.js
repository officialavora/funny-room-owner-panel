// Web port: use the existing panel client, session and server authority.
export const SUPABASE_URL='https://zspcgyhchaqpiyujyxqp.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_eUygC1Ff8vNqZHcZIOUrPw_rZb6fjQZ';
export let supabase;
export function attachPanelClient(client){if(!client?.auth||!client?.rpc)throw new Error('Panel client required');supabase=client;}
