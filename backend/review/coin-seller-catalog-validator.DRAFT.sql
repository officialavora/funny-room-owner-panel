create function coin_seller_api_v1.client_catalog_text_valid_v1(t text, max_units integer, allow_empty boolean)
returns boolean language sql immutable strict set search_path='' as $$
 select t !~ ('[' || chr(1) || '-' || chr(31) || ']')
 and (allow_empty or btrim(t, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> '')
 and (select coalesce(sum(case when ascii(substr(t, i, 1)) > 65535 then 2 else 1 end),0)
      from generate_series(1, char_length(t)) as g(i)) <= max_units;
$$;

create function coin_seller_api_v1.validate_coin_seller_catalog_v1(c jsonb) returns void language plpgsql immutable set search_path='' as $$
declare p jsonb;k text;o jsonb;base numeric;total numeric;
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
  if coalesce(p->>'paymentUrl','')<>'' and ((p->>'paymentUrl'!~'^https://[^/@:]+(:[0-9]+)?(/|$)' AND NOT (p->>'paymentUrl' ~* '^https://([A-Za-z0-9_-]+[.])+[A-Za-z_-][A-Za-z0-9_-]*[.]?(:[0-9]*)?([/?#]|$)' AND p->>'paymentUrl' !~* '^https://([^/?#]*[.])?xn--' AND coalesce((nullif(substring(p->>'paymentUrl' from '(?i)^https://[^/@:?#]+:([0-9]*)([/?#]|$)'),''))::numeric <=65535,true))) or p->>'paymentUrl'~'[[:space:]]')then raise exception 'HTTPS payment URL required';end if;
  if (substring(p->>'paymentUrl' from '^https://[^/@:]+:([0-9]+)(/|$)'))::numeric > 65535 then raise exception 'Invalid payment URL port';end if;
  if exists(select 1 from (values (substring(p->>'paymentUrl' from '(?i)^https://([^/?#\\]*)'))) as host(authority) where authority ~ '%(?![0-9A-Fa-f]{2})' or strpos(authority,'[')>0 or strpos(authority,']')>0) then raise exception 'Malformed payment URL host';end if;
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
