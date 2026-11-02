-- SOURCE CANDIDATE ONLY. NOT EXECUTED. Not an admitted migration or payment finalizer.
-- Requires an isolated target, current dependency/ACL review and genuine JWT/RLS tests.
-- Never credits wallets, inventory, bonuses, USD, diamonds or roles.
begin;
-- Dedicated non-exposed function schema; no widening of the existing private schema.
create schema coin_seller_api_v1;
revoke all on schema coin_seller_api_v1 from public,anon,authenticated;
grant usage on schema coin_seller_api_v1 to authenticated;
do $$ begin if to_regprocedure('private.is_founder(uuid)') is null or to_regprocedure('public.apply_for_role(text,text,text,text)') is null then raise exception 'Existing authority/application prerequisites missing';end if;end $$;
-- Protected rail registry: display labels cannot define financial identity or admission.
create table private.coin_seller_rails_v1(id text primary key,kind text not null check(kind in('crypto','manual','redirect')),asset text not null,network_label text not null,allowed_hosts text[] not null default '{}',allowed_countries text[] not null default '{}',transaction_format text not null check(transaction_format in('hex64','case_sensitive')),admitted boolean not null default false);
alter table private.coin_seller_rails_v1 enable row level security;
revoke all on private.coin_seller_rails_v1 from public,anon,authenticated;
insert into private.coin_seller_rails_v1(id,kind,asset,network_label,transaction_format)values('tron-mainnet-usdt','crypto','USDT','Tron (TRC20)','hex64'),('epay-usd','manual','USD','','case_sensitive');
create function coin_seller_api_v1.rail_identity_immutable_v1()returns trigger language plpgsql set search_path='' as $$
begin if (old.id,old.kind,old.asset,old.network_label,old.transaction_format)is distinct from(new.id,new.kind,new.asset,new.network_label,new.transaction_format)then raise exception 'Canonical rail identity cannot be relabelled; create a separately admitted rail';end if;return new;end $$;
revoke all on function coin_seller_api_v1.rail_identity_immutable_v1()from public,anon,authenticated;
create trigger immutable_coin_seller_rail_identity before update on private.coin_seller_rails_v1 for each row execute function coin_seller_api_v1.rail_identity_immutable_v1();
-- No rail is admitted by this source draft; operator/provider acceptance is separate.
create table private.coin_seller_catalog_v1(singleton boolean primary key default true check(singleton),version integer not null check(version>0),config jsonb not null,updated_at timestamptz not null default now(),updated_by uuid);
create table private.coin_seller_catalog_edits_v1(request_id uuid primary key,actor uuid not null,expected_version integer not null,request_config jsonb not null,reason text not null,after_config jsonb not null,created_at timestamptz not null default now());
create table private.coin_seller_quotes_v1(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),request_id uuid not null,package_id text not null,channel_id text not null,config_version integer not null,snapshot jsonb not null,expires_at timestamptz not null,status text not null default 'pending' check(status in('pending','submitted','confirmed','rejected','expired')),created_at timestamptz not null default now(),unique(user_id,request_id));
create table private.coin_seller_proofs_v1(quote_id uuid primary key references private.coin_seller_quotes_v1(id),user_id uuid not null,rail_id text not null references private.coin_seller_rails_v1(id),transaction_id text not null,submitted_at timestamptz not null default now(),unique(rail_id,transaction_id));
create table private.coin_seller_deposits_v1(user_id uuid primary key references auth.users(id),held_usd_cents bigint not null check(held_usd_cents>=0),verified_reference text not null,verified_by uuid not null,updated_at timestamptz not null default now());
-- A durable tombstone resolves requests persisted before dispatch but never quoted.
-- Creation and retirement use the SAME actor lock: a delayed create cannot win later.
create table private.coin_seller_retired_requests_v1(user_id uuid not null references auth.users(id),request_id uuid not null,package_id text not null,channel_id text not null,config_version integer not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
alter table private.coin_seller_retired_requests_v1 enable row level security;
revoke all on private.coin_seller_retired_requests_v1 from public,anon,authenticated;
alter table private.coin_seller_catalog_v1 enable row level security;
alter table private.coin_seller_catalog_edits_v1 enable row level security;
alter table private.coin_seller_quotes_v1 enable row level security;
alter table private.coin_seller_proofs_v1 enable row level security;
alter table private.coin_seller_deposits_v1 enable row level security;
revoke all on private.coin_seller_catalog_v1,private.coin_seller_catalog_edits_v1,private.coin_seller_quotes_v1,private.coin_seller_proofs_v1,private.coin_seller_deposits_v1 from public,anon,authenticated;
create function coin_seller_api_v1.coin_seller_actor_v1() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id';
begin
 if actor is null or sid is null or not exists(select 1 from auth.sessions s where s.id::text=sid and s.user_id=actor and (s.not_after is null or s.not_after>now())) or not exists(select 1 from public.profiles p where p.id=actor and p.status='active') then raise exception 'Current active session required' using errcode='42501';end if;
 return actor;
end $$;
create function coin_seller_api_v1.client_catalog_text_valid_v1(t text, max_units integer, allow_empty boolean)
returns boolean language sql immutable strict set search_path='' as $$
 select t !~ ('[' || chr(1) || '-' || chr(31) || ']')
 and (allow_empty or btrim(t, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> '')
 and (select coalesce(sum(case when ascii(substr(t, i, 1)) > 65535 then 2 else 1 end),0)
      from generate_series(1, char_length(t)) as g(i)) <= max_units;
$$;

revoke all on function coin_seller_api_v1.client_catalog_text_valid_v1(text,integer,boolean) from public,anon,authenticated;
create function coin_seller_api_v1.validate_coin_seller_catalog_v1(c jsonb) returns void language plpgsql immutable set search_path='' as $$
declare p jsonb;k text;o jsonb;base numeric;total numeric;url_authority text;ipv6_address text;ipv6_port text;
begin
 -- JSON type parity with the existing shared client; preserve all amount/rate rules below.
 if exists(select 1 from unnest(array['schema','version','coinsPerUsd','checkoutMinutes','exitReviewHours','merchantDepositUsdCents']) as required(key) where jsonb_typeof(c->required.key) is distinct from 'number') then raise exception 'Numeric catalogue fields must be JSON numbers';end if;
 if jsonb_typeof(c->'brand') is distinct from 'string' or jsonb_typeof(c->'supportEmail') is distinct from 'string' then raise exception 'Catalogue text fields must be JSON strings';end if;
 if coin_seller_api_v1.client_catalog_text_valid_v1(c->>'supportEmail',200,false) is distinct from true then raise exception 'Invalid client support text';end if;
 if jsonb_typeof(c)<>'object' or c->>'schema'<>'1' or c->>'brand'<>'Funny Room' or length(c::text)>300000 then raise exception 'Invalid catalogue';end if;
 if (c->>'version')::numeric>2147483647 then raise exception 'Catalogue version exceeds client limit';end if;
 if (c->>'version')!~'^[1-9][0-9]{0,9}$' or (c->>'coinsPerUsd')!~'^[1-9][0-9]{0,9}$' or (c->>'coinsPerUsd')::numeric>1000000000 or (c->>'checkoutMinutes')!~'^[0-9]+$' or (c->>'checkoutMinutes')::numeric not between 5 and 1440 or (c->>'exitReviewHours')!~'^[0-9]+$' or (c->>'exitReviewHours')::numeric not between 0 and 720 or (c->>'merchantDepositUsdCents')!~'^[0-9]+$' or (c->>'merchantDepositUsdCents')::numeric not between 0 and 100000000 then raise exception 'Invalid numeric policy';end if;
 if jsonb_typeof(c->'checkoutOpen')<>'boolean' or jsonb_typeof(c->'applicationOpen')<>'boolean' or nullif(c->>'supportEmail','') is null or length(c->>'supportEmail')>200 then raise exception 'Invalid availability/support';end if;
 if jsonb_typeof(c->'packages')<>'array' or jsonb_array_length(c->'packages') not between 1 and 40 or jsonb_typeof(c->'channels')<>'array' or jsonb_array_length(c->'channels') not between 1 and 12 or jsonb_typeof(c->'countries')<>'array' or jsonb_array_length(c->'countries') not between 1 and 300 or jsonb_typeof(c->'rules')<>'array' or jsonb_array_length(c->'rules') not between 1 and 30 or jsonb_typeof(c->'countryOverrides')<>'object' then raise exception 'Invalid collection';end if;
 for p in select value from jsonb_array_elements(c->'packages')loop
  if jsonb_typeof(p->'usdCents') is distinct from 'number' or jsonb_typeof(p->'bonusBps') is distinct from 'number' then raise exception 'Package amounts must be JSON numbers';end if;
  if p->>'id'!~'^[a-z0-9-]{1,48}$' or p->>'kind' not in('normal','merchant') or jsonb_typeof(p->'enabled')<>'boolean' or p->>'usdCents'!~'^[0-9]+$' or (p->>'usdCents')::numeric not between 100 and 100000000 or p->>'bonusBps'!~'^[0-9]+$' or (p->>'bonusBps')::numeric not between 0 and 10000 then raise exception 'Invalid package';end if;
  base:=floor((p->>'usdCents')::numeric*(c->>'coinsPerUsd')::numeric/100);total:=base+floor(base*(p->>'bonusBps')::numeric/10000);
  if total>9007199254740991 then raise exception 'Unsupported coin total';end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(c->'packages')) then raise exception 'Duplicate package';end if;
 for p in select value from jsonb_array_elements(c->'channels')loop
  if exists(select 1 from unnest(array['provider','label','asset','network','address','recipient','memo','paymentUrl','instructions']) as required(key) where jsonb_typeof(p->required.key) is distinct from 'string') then raise exception 'Channel text fields must be JSON strings';end if;
  if exists(select 1 from (values (p->>'provider',100,false),(p->>'label',200,false),(p->>'asset',200,false),(p->>'network',200,true),(p->>'address',200,true),(p->>'recipient',200,true),(p->>'memo',200,true),(p->>'paymentUrl',1500,true),(p->>'instructions',800,false)) as fields(v,max_units,allow_empty) where coin_seller_api_v1.client_catalog_text_valid_v1(v,max_units,allow_empty) is distinct from true) then raise exception 'Invalid client channel text';end if;
  if p->>'id'!~'^[a-z0-9-]{1,48}$' or jsonb_typeof(p->'enabled')<>'boolean' or (coalesce(p->>'address','')<>'' and p->>'address'!~'^[A-Za-z0-9:._-]{1,200}$') or nullif(p->>'asset','') is null  or nullif(p->>'label','') is null or length(p->>'asset')>200 or length(p->>'network')>200 or length(p->>'label')>200 or length(coalesce(p->>'memo',''))>200 or nullif(p->>'instructions','') is null or length(p->>'instructions')>800 or coalesce(p->>'assetUnitsPerUsd','')!~'^[0-9]+(\.[0-9]{1,8})?$' or (p->>'assetUnitsPerUsd')::numeric<=0 or (p->>'assetUnitsPerUsd')::numeric>1000000 then raise exception 'Invalid channel';end if;
  if coalesce(p->>'railId','')!~'^[a-z0-9-]{1,64}$'then raise exception 'Canonical rail required';end if;
  if p->>'kind' not in('crypto','manual','redirect') or nullif(p->>'provider','') is null or length(p->>'provider')>100 or length(p->>'recipient')>200 or length(p->>'paymentUrl')>1500 then raise exception 'Invalid payment type/provider';end if;
  -- Bracketed IPv6 is a separate authority grammar; never reinterpret userinfo or rewrite the destination.
  url_authority:=substring(replace(p->>'paymentUrl',chr(92),'/') from '(?i)^https://([^/?#]*)');
  if strpos(url_authority,'[')>0 or strpos(url_authority,']')>0 then
   ipv6_address:=substring(url_authority from '^\[([0-9A-Fa-f:.]+)\](:[0-9]*)?$');
   if ipv6_address is null or strpos(ipv6_address,':')=0 then raise exception 'Malformed IPv6 payment URL host';end if;
   -- inet accepts masks and other network syntax; the authority grammar above forbids them first.
   begin
    if family(ipv6_address::inet)<>6 then raise exception 'IPv6 payment URL host required';end if;
   exception when invalid_text_representation then raise exception 'Malformed IPv6 payment URL address';
   end;
   ipv6_port:=substring(url_authority from '^\[[^]]+\]:([0-9]*)$');
   if nullif(ipv6_port,'')::numeric>65535 then raise exception 'Invalid IPv6 payment URL port';end if;
  else
  if coalesce(replace(p->>'paymentUrl',chr(92),'/'),'')<>'' and ((replace(p->>'paymentUrl',chr(92),'/')!~'^https://[^/@:]+(:[0-9]+)?(/|$)' AND NOT (replace(p->>'paymentUrl',chr(92),'/') ~* '^https://([A-Za-z0-9_-]+[.])+[A-Za-z_-][A-Za-z0-9_-]*[.]?(:[0-9]*)?([/?#]|$)' AND replace(p->>'paymentUrl',chr(92),'/') !~* '^https://([^/?#]*[.])?xn--' AND coalesce((nullif(substring(replace(p->>'paymentUrl',chr(92),'/') from '(?i)^https://[^/@:?#]+:([0-9]*)([/?#]|$)'),''))::numeric <=65535,true))) or substring(p->>'paymentUrl' from '(?i)^https://([^/?#\\]*)')~'[[:space:]]')then raise exception 'HTTPS payment URL required';end if;
  if (substring(replace(p->>'paymentUrl',chr(92),'/') from '^https://[^/@:]+:([0-9]+)(/|$)'))::numeric > 65535 then raise exception 'Invalid payment URL port';end if;
  if exists(select 1 from (values (substring(p->>'paymentUrl' from '(?i)^https://([^/?#\\]*)'))) as host(authority) where authority ~ '%(?![0-9A-Fa-f]{2})' or strpos(authority,'[')>0 or strpos(authority,']')>0) then raise exception 'Malformed payment URL host';end if;
  if exists(select 1 from (values (regexp_replace(substring(p->>'paymentUrl' from '(?i)^https://([^/?#\\]*)'),'%2e','.','gi'))) as host(authority) where case when authority ~ '^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.]?(:[0-9]*)?$' then exists(select 1 from unnest(string_to_array(rtrim(split_part(authority,':',1),'.'),'.')) as part(octet) where octet::numeric > 255) else false end) then raise exception 'Invalid dotted decimal IPv4 host';end if;
  end if;
  if p->'enabled'='true'::jsonb and ((p->>'kind'='crypto' and (coalesce(p->>'address','')=''or coalesce(p->>'network','')=''))or(p->>'kind'='manual' and coalesce(p->>'recipient','')='')or(p->>'kind'='redirect' and coalesce(p->>'paymentUrl','')=''))then raise exception 'Enabled method requires complete destination';end if;
  if coalesce(p->>'address','')<>'' and p->>'network'='Tron (TRC20)' and p->>'address'!~'^T[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'Invalid Tron address';end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(c->'channels')) then raise exception 'Duplicate channel';end if;
 for p in select value from jsonb_array_elements(c->'countries')loop
  if jsonb_typeof(p->'name') is distinct from 'string' then raise exception 'Country name must be a JSON string';end if;
  if coin_seller_api_v1.client_catalog_text_valid_v1(p->>'name',100,false) is distinct from true then raise exception 'Invalid client country text';end if;
  if coalesce(p->>'code','')!~'^[A-Z]{2}$' or nullif(p->>'name','') is null or length(p->>'name')>100 then raise exception 'Invalid country';end if;
 end loop;
 if(select count(*)<>count(distinct value->>'code') from jsonb_array_elements(c->'countries'))then raise exception 'Duplicate country';end if;
 for k,o in select key,value from jsonb_each(c->'countryOverrides')loop
  if o ? 'note' and jsonb_typeof(o->'note') is distinct from 'string' then raise exception 'Regional note must be a JSON string';end if;
  if o ? 'note' and coin_seller_api_v1.client_catalog_text_valid_v1(o->>'note',500,true) is distinct from true then raise exception 'Invalid client regional note';end if;
  if not exists(select 1 from jsonb_array_elements(c->'countries')x where x->>'code'=k) or jsonb_typeof(o)<>'object' then raise exception 'Invalid country override';end if;
  if exists(select 1 from jsonb_object_keys(o)x where x not in('currency','localAmount','coins','note'))then raise exception 'Unknown regional field';end if;
  if o ? 'currency' or o ? 'localAmount' or o ? 'coins' then
   if coalesce(o->>'currency','')!~'^[A-Z]{3}$' or coalesce(o->>'localAmount','')!~'^[0-9]+(\.[0-9]{1,8})?$' or coalesce(o->>'coins','')!~'^[1-9][0-9]{0,15}$' then raise exception 'Incomplete regional rate';end if;
  end if;
  if length(coalesce(o->>'note',''))>500 then raise exception 'Regional note too long';end if;
 end loop;
 for p in select value from jsonb_array_elements(c->'rules')loop
  if jsonb_typeof(p->'title') is distinct from 'string' or jsonb_typeof(p->'text') is distinct from 'string' then raise exception 'Rule text fields must be JSON strings';end if;
  if coin_seller_api_v1.client_catalog_text_valid_v1(p->>'title',100,false) is distinct from true or coin_seller_api_v1.client_catalog_text_valid_v1(p->>'text',1500,false) is distinct from true then raise exception 'Invalid client rule text';end if;
  if nullif(p->>'title','') is null or length(p->>'title')>100 or nullif(p->>'text','') is null or length(p->>'text')>1500 then raise exception 'Invalid rule';end if;
 end loop;
 if jsonb_typeof(c->'allowedCountries')<>'array' or exists(select 1 from jsonb_array_elements_text(c->'allowedCountries')cc where not exists(select 1 from jsonb_array_elements(c->'countries')country where country->>'code'=cc))then raise exception 'Invalid payment country eligibility';end if;
 if (select count(*)<>count(distinct value) from jsonb_array_elements_text(c->'allowedCountries')) then raise exception 'Duplicate payment country eligibility';end if;
 -- Missing required keys/null must never pass SQL three-valued predicates above.
 if not c ?& array['schema','version','brand','coinsPerUsd','checkoutMinutes','exitReviewHours','merchantDepositUsdCents','applicationOpen','checkoutOpen','supportEmail','packages','channels','countries','countryOverrides','rules','allowedCountries'] or exists(select 1 from jsonb_each(c)x where x.value='null'::jsonb) then raise exception 'Missing/null catalogue fields';end if;
 if exists(select 1 from jsonb_array_elements(c->'packages')as item(value) where not item.value ?& array['id','kind','usdCents','bonusBps','enabled'] or exists(select 1 from jsonb_each(item.value)x where x.value='null'::jsonb)) or exists(select 1 from jsonb_array_elements(c->'channels')as item(value) where not item.value ?& array['id','kind','railId','provider','label','asset','network','address','recipient','paymentUrl','enabled','assetUnitsPerUsd','memo','instructions'] or exists(select 1 from jsonb_each(item.value)x where x.value='null'::jsonb))then raise exception 'Incomplete catalogue item';end if;
end $$;
create function coin_seller_api_v1.load_coin_seller_catalog_v1(owner_only boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();c jsonb;
begin if owner_only and not private.is_founder(a)then raise exception 'Founder required' using errcode='42501';end if;select config into c from private.coin_seller_catalog_v1 where singleton;if c is null then raise exception 'Catalogue not configured';end if;if owner_only then return c;end if;
 -- Explicit public projection. No inactive/draft method, address, account, memo,
 -- payment URL, owner audit/settings or private rail registry is returned here.
 return (select jsonb_object_agg(key,value)from jsonb_each(c)where key=any(array['schema','version','brand','coinsPerUsd','checkoutMinutes','exitReviewHours','merchantDepositUsdCents','applicationOpen','checkoutOpen','supportEmail','packages','countries','countryOverrides','rules','allowedCountries']))||jsonb_build_object('catalogKind','public','channels',coalesce((select jsonb_agg((select jsonb_object_agg(key,value)from jsonb_each(ch)where key=any(array['id','kind','provider','label','asset','network','railId','enabled','assetUnitsPerUsd','instructions']))||jsonb_build_object('admittedHosts',coalesce(to_jsonb(r.allowed_hosts),'[]'::jsonb)))from jsonb_array_elements(c->'channels')ch left join private.coin_seller_rails_v1 r on r.id=ch->>'railId' where ch->'enabled'='true'::jsonb),'[]'::jsonb));
 end $$;
create function coin_seller_api_v1.owner_save_coin_seller_catalog_v1(p_config jsonb,p_expected_version integer,p_request_id uuid,p_reason text)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();prior private.coin_seller_catalog_v1%rowtype;old private.coin_seller_catalog_edits_v1%rowtype;next_config jsonb;
begin
 if not private.is_founder(a)then raise exception 'Founder required' using errcode='42501';end if;
 if p_request_id is null or p_expected_version is null or p_expected_version<1 or p_config is null or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Request ID and reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended('coin-seller-catalog-v1',0));
 select * into old from private.coin_seller_catalog_edits_v1 where request_id=p_request_id;
 if found then if old.actor<>a or old.request_config<>p_config or old.expected_version<>p_expected_version or old.reason<>p_reason then raise exception 'Request ID body mismatch';end if;return old.after_config;end if;
 perform coin_seller_api_v1.validate_coin_seller_catalog_v1(p_config);
 select * into strict prior from private.coin_seller_catalog_v1 where singleton for update;
 if prior.version<>p_expected_version or p_config->>'version'<>p_expected_version::text then raise exception 'Catalogue changed. Refresh before editing' using errcode='40001';end if;
 if p_config->'checkoutOpen'<>prior.config->'checkoutOpen'then raise exception 'Payment activation is a separate admitted operation';end if;
 next_config:=jsonb_set(p_config,'{version}',to_jsonb(prior.version+1));
 update private.coin_seller_catalog_v1 set config=next_config,version=prior.version+1,updated_by=a,updated_at=now()where singleton;
 insert into private.coin_seller_catalog_edits_v1 values(p_request_id,a,p_expected_version,p_config,p_reason,next_config,now());
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata)values(a,'coin_seller.catalog.update','coin_seller_catalog','1',jsonb_build_object('request_id',p_request_id,'version',prior.version+1,'reason',p_reason));
 return next_config;
end $$;
create function coin_seller_api_v1.create_coin_seller_quote_v1(p_request_id uuid,p_package text,p_channel text,p_version integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();c jsonb;p jsonb;ch jsonb;existing private.coin_seller_quotes_v1%rowtype;q jsonb;deadline timestamptz;rail private.coin_seller_rails_v1%rowtype;country text;host text;base numeric;total numeric;deposit bigint;held boolean;new_id uuid:=gen_random_uuid();
begin
 if p_request_id is null or p_version is null or p_version<1 or p_package is null or p_channel is null then raise exception 'Request ID, version, package and channel required';end if;
 perform pg_advisory_xact_lock(hashtextextended('coin-seller-quote:'||a::text,0));
 select * into existing from private.coin_seller_quotes_v1 where user_id=a and request_id=p_request_id;
 if found then if existing.package_id<>p_package or existing.channel_id<>p_channel or existing.config_version<>p_version then raise exception 'Quote retry body mismatch';end if;return existing.snapshot||jsonb_build_object('serverNow',now(),'status',existing.status);end if;
 if exists(select 1 from private.coin_seller_retired_requests_v1 where user_id=a and request_id=p_request_id)then raise exception 'Request retired before payment instructions existed';end if;
 select config into strict c from private.coin_seller_catalog_v1 where singleton;
 if c->'checkoutOpen'<>'true'::jsonb or (c->>'version')::integer<>p_version then raise exception 'Checkout unavailable or catalogue changed';end if;
 select value into p from jsonb_array_elements(c->'packages')where value->>'id'=p_package and value->'enabled'='true'::jsonb;
 select value into ch from jsonb_array_elements(c->'channels')where value->>'id'=p_channel and value->'enabled'='true'::jsonb;
 if p is null or ch is null then raise exception 'Unavailable package/channel';end if;
 select * into rail from private.coin_seller_rails_v1 where id=ch->>'railId' and admitted;
 if not found or rail.kind<>ch->>'kind' or rail.asset<>ch->>'asset' or rail.network_label<>ch->>'network' then raise exception 'Payment route not admitted' using errcode='42501';end if;
 select upper(country_code)into country from public.profiles where id=a;
 if country is null or not(country=any(rail.allowed_countries))or not(c->'allowedCountries'?country)then raise exception 'Payment route unavailable for this account country' using errcode='42501';end if;
 if rail.kind='redirect'then
  host:=lower(substring(ch->>'paymentUrl' from '^https://([^/:?#]+)'));
  if host is null or host like '%@%'or not(host=any(rail.allowed_hosts))then raise exception 'Payment redirect host not admitted'using errcode='42501';end if;
 end if;
 if exists(select 1 from private.coin_seller_quotes_v1 where user_id=a and status='pending' and expires_at>now())then raise exception 'An open checkout already exists. Review history';end if;
 held:=exists(select 1 from private.coin_seller_deposits_v1 where user_id=a and held_usd_cents>=(c->>'merchantDepositUsdCents')::bigint);
 deposit:=case when p->>'kind'='merchant'and not held then(c->>'merchantDepositUsdCents')::bigint else 0 end;
 base:=floor((p->>'usdCents')::numeric*(c->>'coinsPerUsd')::numeric/100);total:=base+floor(base*(p->>'bonusBps')::numeric/10000);deadline:=now()+make_interval(mins=>(c->>'checkoutMinutes')::integer);
 q:=jsonb_build_object('id',new_id,'userId',a,'requestId',p_request_id,'packageId',p_package,'channelId',p_channel,'kind',p->>'kind','configVersion',p_version,'status','pending','railId',rail.id,'paymentKind',ch->>'kind','provider',ch->>'provider','recipient',ch->>'recipient','paymentUrl',ch->>'paymentUrl','address',ch->>'address','network',ch->>'network','asset',ch->>'asset','memo',ch->>'memo','packageUsdCents',(p->>'usdCents')::bigint,'depositUsdCents',deposit,'depositAlreadyHeld',held,'totalUsdCents',(p->>'usdCents')::bigint+deposit,'totalCoins',total::text,'assetAmount',((p->>'usdCents')::numeric/100+deposit::numeric/100)*(ch->>'assetUnitsPerUsd')::numeric,'serverNow',now(),'expiresAt',deadline);
 q:=jsonb_set(q,'{assetAmount}',to_jsonb(round((q->>'assetAmount')::numeric,8)::text));
 insert into private.coin_seller_quotes_v1(id,user_id,request_id,package_id,channel_id,config_version,snapshot,expires_at)values(new_id,a,p_request_id,p_package,p_channel,p_version,q,deadline);
 return q;
end $$;
create function coin_seller_api_v1.submit_coin_seller_proof_v1(p_quote uuid,p_transaction text)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();q private.coin_seller_quotes_v1%rowtype;tx text:=btrim(p_transaction);old private.coin_seller_proofs_v1%rowtype;rail private.coin_seller_rails_v1%rowtype;
begin
 if tx is null or tx!~'^[A-Za-z0-9:_.@-]{4,200}$'then raise exception 'Valid blockchain transaction ID required';end if;
 select * into strict q from private.coin_seller_quotes_v1 where id=p_quote and user_id=a for update;
 select * into strict rail from private.coin_seller_rails_v1 where id=q.snapshot->>'railId';
 if rail.transaction_format='hex64'theN if tx!~'^[A-Fa-f0-9]{64}$'then raise exception 'Tron transaction hash must contain 64 hexadecimal characters';end if;tx:=lower(tx);end if;
 select * into old from private.coin_seller_proofs_v1 where quote_id=p_quote;
 if found then if old.transaction_id<>tx then raise exception 'A different proof is already attached';end if;return jsonb_build_object('quoteId',p_quote,'status','submitted');end if;
 if q.status not in('pending','expired')then raise exception 'Checkout cannot accept new proof';end if;
 -- Late proofs are reviewable. Expiry never destroys a paid customer's evidence.
 insert into private.coin_seller_proofs_v1 values(p_quote,a,q.snapshot->>'railId',tx,now());
 update private.coin_seller_quotes_v1 set status='submitted'where id=p_quote;
 insert into public.audit_log(actor_id,action,target_type,target_id,metadata)values(a,'coin_seller.proof.submitted','coin_seller_quote',p_quote::text,jsonb_build_object('requires_verification',true));
 return jsonb_build_object('quoteId',p_quote,'status','submitted');
end $$;
create function coin_seller_api_v1.load_my_coin_seller_quotes_v1()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();result jsonb;
begin select coalesce(jsonb_agg(snapshot||jsonb_build_object('status',status)order by created_at desc),'[]'::jsonb)into result from(select * from private.coin_seller_quotes_v1 where user_id=a order by created_at desc limit 100)x;return result;end $$;
-- Close the application switch at the common application table, including legacy callers.
create function coin_seller_api_v1.guard_application_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role_key in('coin_seller','merchant')and exists(select 1 from private.coin_seller_catalog_v1 where singleton and config->'applicationOpen'='false'::jsonb)then raise exception 'Seller applications are closed' using errcode='42501';end if;
 return new;
end $$;
revoke all on function coin_seller_api_v1.guard_application_v1()from public,anon,authenticated;
create trigger coin_seller_application_gate_v1 before insert on public.role_applications for each row execute function coin_seller_api_v1.guard_application_v1();
create function coin_seller_api_v1.close_coin_seller_quote_v1(p_quote uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();q private.coin_seller_quotes_v1%rowtype;
begin
 select * into strict q from private.coin_seller_quotes_v1 where id=p_quote and user_id=a for update;
 if q.status not in('pending','expired')or q.expires_at>now()then raise exception 'Only an expired, unsubmitted quote can be closed';end if;
 update private.coin_seller_quotes_v1 set status='expired'where id=p_quote;
 return jsonb_build_object('quoteId',p_quote,'status','expired','requestId',q.request_id);
end $$;
create function public.close_coin_seller_quote_v1(p_quote uuid)returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.close_coin_seller_quote_v1(p_quote)$$;
-- Never retires an issued quote. Does not cancel payment, refund, settle or credit.
create function coin_seller_api_v1.retire_uncreated_coin_seller_request_v1(p_request_id uuid,p_package text,p_channel text,p_version integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=coin_seller_api_v1.coin_seller_actor_v1();q private.coin_seller_quotes_v1%rowtype;r private.coin_seller_retired_requests_v1%rowtype;
begin
 if p_request_id is null or p_version is null or p_version<1 or coalesce(p_package,'')!~'^[a-z0-9-]{1,48}$' or coalesce(p_channel,'')!~'^[a-z0-9-]{1,48}$'then raise exception 'Original request identity required';end if;
 perform pg_advisory_xact_lock(hashtextextended('coin-seller-quote:'||a::text,0));
 select * into q from private.coin_seller_quotes_v1 where user_id=a and request_id=p_request_id;
 if found then
  if q.package_id<>p_package or q.channel_id<>p_channel or q.config_version<>p_version then raise exception 'Request identity mismatch';end if;
  return jsonb_build_object('requestId',p_request_id,'status','quote_exists');
 end if;
 select * into r from private.coin_seller_retired_requests_v1 where user_id=a and request_id=p_request_id;
 if found then
  if r.package_id<>p_package or r.channel_id<>p_channel or r.config_version<>p_version then raise exception 'Request identity mismatch';end if;
 else
  insert into private.coin_seller_retired_requests_v1(user_id,request_id,package_id,channel_id,config_version)values(a,p_request_id,p_package,p_channel,p_version);
  insert into public.audit_log(actor_id,action,target_type,target_id,metadata)values(a,'coin_seller.uncreated_request.retired','coin_seller_request',p_request_id::text,jsonb_build_object('config_version',p_version));
 end if;
 return jsonb_build_object('requestId',p_request_id,'status','retired');
end $$;
create function public.retire_uncreated_coin_seller_request_v1(p_request_id uuid,p_package text,p_channel text,p_version integer)returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.retire_uncreated_coin_seller_request_v1(p_request_id,p_package,p_channel,p_version)$$;
-- Public invoker wrappers; authority is implemented in narrowly scoped private functions.
create function public.load_coin_seller_catalog_v1()returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.load_coin_seller_catalog_v1(false)$$;
create function public.owner_load_coin_seller_catalog_v1()returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.load_coin_seller_catalog_v1(true)$$;
create function public.owner_save_coin_seller_catalog_v1(p_config jsonb,p_expected_version integer,p_request_id uuid,p_reason text)returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.owner_save_coin_seller_catalog_v1(p_config,p_expected_version,p_request_id,p_reason)$$;
create function public.create_coin_seller_quote_v1(p_request_id uuid,p_package text,p_channel text,p_version integer)returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.create_coin_seller_quote_v1(p_request_id,p_package,p_channel,p_version)$$;
create function public.submit_coin_seller_proof_v1(p_quote uuid,p_transaction text)returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.submit_coin_seller_proof_v1(p_quote,p_transaction)$$;
create function public.load_my_coin_seller_quotes_v1()returns jsonb language sql security invoker set search_path='' as $$select coin_seller_api_v1.load_my_coin_seller_quotes_v1()$$;
-- Explicit allowlist: no broad grant over the existing private schema.
do $$declare sig text;begin
 foreach sig in array array['public.retire_uncreated_coin_seller_request_v1(uuid,text,text,integer)','coin_seller_api_v1.retire_uncreated_coin_seller_request_v1(uuid,text,text,integer)','public.close_coin_seller_quote_v1(uuid)','coin_seller_api_v1.close_coin_seller_quote_v1(uuid)','coin_seller_api_v1.coin_seller_actor_v1()','coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb)','coin_seller_api_v1.load_coin_seller_catalog_v1(boolean)','coin_seller_api_v1.owner_save_coin_seller_catalog_v1(jsonb,integer,uuid,text)','coin_seller_api_v1.create_coin_seller_quote_v1(uuid,text,text,integer)','coin_seller_api_v1.submit_coin_seller_proof_v1(uuid,text)','coin_seller_api_v1.load_my_coin_seller_quotes_v1()','public.load_coin_seller_catalog_v1()','public.owner_load_coin_seller_catalog_v1()','public.owner_save_coin_seller_catalog_v1(jsonb,integer,uuid,text)','public.create_coin_seller_quote_v1(uuid,text,text,integer)','public.submit_coin_seller_proof_v1(uuid,text)','public.load_my_coin_seller_quotes_v1()']loop
  execute 'revoke all on function '||sig||' from public,anon,authenticated';
  if sig not in('coin_seller_api_v1.coin_seller_actor_v1()','coin_seller_api_v1.validate_coin_seller_catalog_v1(jsonb)')then execute 'grant execute on function '||sig||' to authenticated';end if;
 end loop;
end $$;
do $seed$ declare c jsonb:=$catalog${"schema":1,"version":1,"brand":"Funny Room","coinsPerUsd":1000000,"checkoutMinutes":60,"exitReviewHours":48,"merchantDepositUsdCents":50000,"applicationOpen":true,"checkoutOpen":false,"supportEmail":"fixture@example.invalid","packages":[{"id":"normal-300","kind":"normal","usdCents":30000,"bonusBps":500,"enabled":true},{"id":"normal-500","kind":"normal","usdCents":50000,"bonusBps":1000,"enabled":true},{"id":"merchant-1000","kind":"merchant","usdCents":100000,"bonusBps":1500,"enabled":true},{"id":"merchant-3000","kind":"merchant","usdCents":300000,"bonusBps":2000,"enabled":true},{"id":"merchant-5000","kind":"merchant","usdCents":500000,"bonusBps":2300,"enabled":true}],"channels":[{"id":"usdt-tron","label":"Binance · USDT · Tron (TRC20)","asset":"USDT","network":"Tron (TRC20)","address":"T111111111111111111111111111111111","enabled":true,"assetUnitsPerUsd":"1","memo":"","instructions":"Send USDT only on Tron (TRC20). Network fees are separate. Keep the transaction ID.","kind":"crypto","provider":"Binance","recipient":"","paymentUrl":"","railId":"tron-mainnet-usdt"},{"id":"epay","kind":"manual","provider":"Epay","label":"Epay Wallet","asset":"USD","network":"","address":"","recipient":"","paymentUrl":"","enabled":false,"assetUnitsPerUsd":"1","memo":"","instructions":"Epay account details will be configured by the Owner. Do not send payment until this method is enabled.","railId":"epay-usd"}],"countries":[{"code":"IN","name":"India"},{"code":"PK","name":"Pakistan"},{"code":"PH","name":"Philippines"},{"code":"NG","name":"Nigeria"},{"code":"BD","name":"Bangladesh"},{"code":"GH","name":"Ghana"},{"code":"EG","name":"Egypt"},{"code":"SA","name":"Saudi Arabia"},{"code":"VN","name":"Vietnam"},{"code":"JO","name":"Jordan"},{"code":"AE","name":"United Arab Emirates"},{"code":"BR","name":"Brazil"},{"code":"NP","name":"Nepal"},{"code":"ET","name":"Ethiopia"},{"code":"AF","name":"Afghanistan"},{"code":"AL","name":"Albania"},{"code":"DZ","name":"Algeria"},{"code":"AD","name":"Andorra"},{"code":"AO","name":"Angola"},{"code":"AI","name":"Anguilla"},{"code":"AQ","name":"Antarctica"},{"code":"AG","name":"Antigua & Barbuda"},{"code":"AR","name":"Argentina"},{"code":"AM","name":"Armenia"},{"code":"AW","name":"Aruba"},{"code":"AU","name":"Australia"},{"code":"AT","name":"Austria"},{"code":"AZ","name":"Azerbaijan"},{"code":"BS","name":"Bahamas"},{"code":"BH","name":"Bahrain"},{"code":"BB","name":"Barbados"},{"code":"BY","name":"Belarus"},{"code":"BE","name":"Belgium"},{"code":"BZ","name":"Belize"},{"code":"BJ","name":"Benin"},{"code":"BM","name":"Bermuda"},{"code":"BT","name":"Bhutan"},{"code":"BO","name":"Bolivia"},{"code":"BA","name":"Bosnia & Herzegovina"},{"code":"BW","name":"Botswana"},{"code":"BV","name":"Bouvet Island"},{"code":"GB","name":"Britain (UK)"},{"code":"IO","name":"British Indian Ocean Territory"},{"code":"BN","name":"Brunei"},{"code":"BG","name":"Bulgaria"},{"code":"BF","name":"Burkina Faso"},{"code":"BI","name":"Burundi"},{"code":"KH","name":"Cambodia"},{"code":"CM","name":"Cameroon"},{"code":"CA","name":"Canada"},{"code":"CV","name":"Cape Verde"},{"code":"BQ","name":"Caribbean NL"},{"code":"KY","name":"Cayman Islands"},{"code":"CF","name":"Central African Rep."},{"code":"TD","name":"Chad"},{"code":"CL","name":"Chile"},{"code":"CN","name":"China"},{"code":"CX","name":"Christmas Island"},{"code":"CC","name":"Cocos (Keeling) Islands"},{"code":"CO","name":"Colombia"},{"code":"KM","name":"Comoros"},{"code":"CD","name":"Congo (Dem. Rep.)"},{"code":"CG","name":"Congo (Rep.)"},{"code":"CK","name":"Cook Islands"},{"code":"CR","name":"Costa Rica"},{"code":"HR","name":"Croatia"},{"code":"CU","name":"Cuba"},{"code":"CW","name":"Curaçao"},{"code":"CY","name":"Cyprus"},{"code":"CZ","name":"Czech Republic"},{"code":"CI","name":"Côte d'Ivoire"},{"code":"DK","name":"Denmark"},{"code":"DJ","name":"Djibouti"},{"code":"DM","name":"Dominica"},{"code":"DO","name":"Dominican Republic"},{"code":"TL","name":"East Timor"},{"code":"EC","name":"Ecuador"},{"code":"SV","name":"El Salvador"},{"code":"GQ","name":"Equatorial Guinea"},{"code":"ER","name":"Eritrea"},{"code":"EE","name":"Estonia"},{"code":"SZ","name":"Eswatini (Swaziland)"},{"code":"FK","name":"Falkland Islands"},{"code":"FO","name":"Faroe Islands"},{"code":"FJ","name":"Fiji"},{"code":"FI","name":"Finland"},{"code":"FR","name":"France"},{"code":"GF","name":"French Guiana"},{"code":"PF","name":"French Polynesia"},{"code":"TF","name":"French S. Terr."},{"code":"GA","name":"Gabon"},{"code":"GM","name":"Gambia"},{"code":"GE","name":"Georgia"},{"code":"DE","name":"Germany"},{"code":"GI","name":"Gibraltar"},{"code":"GR","name":"Greece"},{"code":"GL","name":"Greenland"},{"code":"GD","name":"Grenada"},{"code":"GP","name":"Guadeloupe"},{"code":"GU","name":"Guam"},{"code":"GT","name":"Guatemala"},{"code":"GG","name":"Guernsey"},{"code":"GN","name":"Guinea"},{"code":"GW","name":"Guinea-Bissau"},{"code":"GY","name":"Guyana"},{"code":"HT","name":"Haiti"},{"code":"HM","name":"Heard Island & McDonald Islands"},{"code":"HN","name":"Honduras"},{"code":"HK","name":"Hong Kong"},{"code":"HU","name":"Hungary"},{"code":"IS","name":"Iceland"},{"code":"ID","name":"Indonesia"},{"code":"IR","name":"Iran"},{"code":"IQ","name":"Iraq"},{"code":"IE","name":"Ireland"},{"code":"IM","name":"Isle of Man"},{"code":"IL","name":"Israel"},{"code":"IT","name":"Italy"},{"code":"JM","name":"Jamaica"},{"code":"JP","name":"Japan"},{"code":"JE","name":"Jersey"},{"code":"KZ","name":"Kazakhstan"},{"code":"KE","name":"Kenya"},{"code":"KI","name":"Kiribati"},{"code":"KP","name":"Korea (North)"},{"code":"KR","name":"Korea (South)"},{"code":"KW","name":"Kuwait"},{"code":"KG","name":"Kyrgyzstan"},{"code":"LA","name":"Laos"},{"code":"LV","name":"Latvia"},{"code":"LB","name":"Lebanon"},{"code":"LS","name":"Lesotho"},{"code":"LR","name":"Liberia"},{"code":"LY","name":"Libya"},{"code":"LI","name":"Liechtenstein"},{"code":"LT","name":"Lithuania"},{"code":"LU","name":"Luxembourg"},{"code":"MO","name":"Macau"},{"code":"MG","name":"Madagascar"},{"code":"MW","name":"Malawi"},{"code":"MY","name":"Malaysia"},{"code":"MV","name":"Maldives"},{"code":"ML","name":"Mali"},{"code":"MT","name":"Malta"},{"code":"MH","name":"Marshall Islands"},{"code":"MQ","name":"Martinique"},{"code":"MR","name":"Mauritania"},{"code":"MU","name":"Mauritius"},{"code":"YT","name":"Mayotte"},{"code":"MX","name":"Mexico"},{"code":"FM","name":"Micronesia"},{"code":"MD","name":"Moldova"},{"code":"MC","name":"Monaco"},{"code":"MN","name":"Mongolia"},{"code":"ME","name":"Montenegro"},{"code":"MS","name":"Montserrat"},{"code":"MA","name":"Morocco"},{"code":"MZ","name":"Mozambique"},{"code":"MM","name":"Myanmar (Burma)"},{"code":"NA","name":"Namibia"},{"code":"NR","name":"Nauru"},{"code":"NL","name":"Netherlands"},{"code":"NC","name":"New Caledonia"},{"code":"NZ","name":"New Zealand"},{"code":"NI","name":"Nicaragua"},{"code":"NE","name":"Niger"},{"code":"NU","name":"Niue"},{"code":"NF","name":"Norfolk Island"},{"code":"MK","name":"North Macedonia"},{"code":"MP","name":"Northern Mariana Islands"},{"code":"NO","name":"Norway"},{"code":"OM","name":"Oman"},{"code":"PW","name":"Palau"},{"code":"PS","name":"Palestine"},{"code":"PA","name":"Panama"},{"code":"PG","name":"Papua New Guinea"},{"code":"PY","name":"Paraguay"},{"code":"PE","name":"Peru"},{"code":"PN","name":"Pitcairn"},{"code":"PL","name":"Poland"},{"code":"PT","name":"Portugal"},{"code":"PR","name":"Puerto Rico"},{"code":"QA","name":"Qatar"},{"code":"RO","name":"Romania"},{"code":"RU","name":"Russia"},{"code":"RW","name":"Rwanda"},{"code":"RE","name":"Réunion"},{"code":"AS","name":"Samoa (American)"},{"code":"WS","name":"Samoa (western)"},{"code":"SM","name":"San Marino"},{"code":"ST","name":"Sao Tome & Principe"},{"code":"SN","name":"Senegal"},{"code":"RS","name":"Serbia"},{"code":"SC","name":"Seychelles"},{"code":"SL","name":"Sierra Leone"},{"code":"SG","name":"Singapore"},{"code":"SK","name":"Slovakia"},{"code":"SI","name":"Slovenia"},{"code":"SB","name":"Solomon Islands"},{"code":"SO","name":"Somalia"},{"code":"ZA","name":"South Africa"},{"code":"GS","name":"South Georgia & the South Sandwich Islands"},{"code":"SS","name":"South Sudan"},{"code":"ES","name":"Spain"},{"code":"LK","name":"Sri Lanka"},{"code":"BL","name":"St Barthelemy"},{"code":"SH","name":"St Helena"},{"code":"KN","name":"St Kitts & Nevis"},{"code":"LC","name":"St Lucia"},{"code":"SX","name":"St Maarten (Dutch)"},{"code":"MF","name":"St Martin (French)"},{"code":"PM","name":"St Pierre & Miquelon"},{"code":"VC","name":"St Vincent"},{"code":"SD","name":"Sudan"},{"code":"SR","name":"Suriname"},{"code":"SJ","name":"Svalbard & Jan Mayen"},{"code":"SE","name":"Sweden"},{"code":"CH","name":"Switzerland"},{"code":"SY","name":"Syria"},{"code":"TW","name":"Taiwan"},{"code":"TJ","name":"Tajikistan"},{"code":"TZ","name":"Tanzania"},{"code":"TH","name":"Thailand"},{"code":"TG","name":"Togo"},{"code":"TK","name":"Tokelau"},{"code":"TO","name":"Tonga"},{"code":"TT","name":"Trinidad & Tobago"},{"code":"TN","name":"Tunisia"},{"code":"TR","name":"Turkey"},{"code":"TM","name":"Turkmenistan"},{"code":"TC","name":"Turks & Caicos Is"},{"code":"TV","name":"Tuvalu"},{"code":"UM","name":"US minor outlying islands"},{"code":"UG","name":"Uganda"},{"code":"UA","name":"Ukraine"},{"code":"US","name":"United States"},{"code":"UY","name":"Uruguay"},{"code":"UZ","name":"Uzbekistan"},{"code":"VU","name":"Vanuatu"},{"code":"VA","name":"Vatican City"},{"code":"VE","name":"Venezuela"},{"code":"VG","name":"Virgin Islands (UK)"},{"code":"VI","name":"Virgin Islands (US)"},{"code":"WF","name":"Wallis & Futuna"},{"code":"EH","name":"Western Sahara"},{"code":"YE","name":"Yemen"},{"code":"ZM","name":"Zambia"},{"code":"ZW","name":"Zimbabwe"},{"code":"AX","name":"Åland Islands"}],"countryOverrides":{},"rules":[{"title":"Eligibility","text":"Applicants must be 18+ and approved by Funny Room."},{"title":"Payment","text":"Use verified official payment channels only. Coins are credited only after payment confirmation."},{"title":"Bonus","text":"The listed package bonus applies once per purchase. Other offers do not combine automatically."},{"title":"Sales","text":"State the price and coin quantity clearly. Verify the recipient UID and profile before transfer. Keep receipts."},{"title":"Fraud prevention","text":"Fake receipts, stolen payments, impersonation and unauthorised account access are prohibited."},{"title":"Complaints and refunds","text":"Report missing or incorrect credits with payment proof. Resolution follows the applicable refund policy and statutory consumer rights."},{"title":"Violations","text":"Evidence and severity may lead to a warning, suspension or revocation. Contact support to request review."},{"title":"Exit","text":"Request seller closure through support. Remaining coins, pending transactions and any deposit are reconciled under the agreed written terms."},{"title":"Privacy and changes","text":"Protect customer information. Changes to packages or rules are disclosed before new purchases."}],"allowedCountries":[]}$catalog$::jsonb;begin perform coin_seller_api_v1.validate_coin_seller_catalog_v1(c);insert into private.coin_seller_catalog_v1(singleton,version,config)values(true,1,c);end $seed$;
commit;
