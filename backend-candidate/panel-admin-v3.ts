import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 try{
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer ")) throw new Error("Unauthorized");
  const keys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
  const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  const url=Deno.env.get("SUPABASE_URL")!;
  const userClient=createClient(url,keys.default,{global:{headers:{Authorization:auth}}});
  const token=auth.slice(7);
  const {data:who,error:whoErr}=await userClient.auth.getUser(token);
  if(whoErr||!who.user) throw new Error("Invalid session");
  const {data:access,error:accessErr}=await userClient.rpc("panel_my_access");
  if(accessErr||!access) throw new Error("Active panel authority required");
  const body=await req.json();
  if(body.action!=="create_staff_v3") throw new Error("Unsupported action");
  const login=String(body.login_id||"").trim().toLowerCase();
  const password=String(body.password||"");
  const role=String(body.role||"");
  const contextType=String(body.context_type||"global");
  const contextId=String(body.context_id||"*").trim();
  const permissions=Array.isArray(body.permissions)?body.permissions.map(String):[];
  if(!/^[a-z][a-z0-9._-]{2,31}$/.test(login)) throw new Error("Login ID must be 3-32 letters/numbers");
  if(password.length<10) throw new Error("Temporary password must be at least 10 characters");
  const allowedRoles=["co_owner","country_manager","manager","super_admin","admin","bd_leader","cs_leader","bd","moderator","cs","event_manager","coin_seller","merchant","agency_owner","host"];
  if(!allowedRoles.includes(role)) throw new Error("Role not allowed");
  if(!["global","country","agency","user","seller","merchant"].includes(contextType)||!contextId) throw new Error("Invalid authority scope");
  const email=`${login}@staff.funnyroom.invalid`;
  const admin=createClient(url,secrets.default);
  const {data:created,error:createErr}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{panel_login_id:login,created_by:who.user.id}});
  if(createErr||!created.user) throw createErr||new Error("User creation failed");
  try{
   let profile=null;
   for(let i=0;i<5;i++){const r=await admin.from("profiles").select("id,public_id,display_name").eq("id",created.user.id).maybeSingle();profile=r.data;if(profile)break;await new Promise(x=>setTimeout(x,250))}
   if(!profile) throw new Error("Profile creation did not complete");
   if(contextType==="country"){
    const {error:countryErr}=await admin.from("profiles").update({country_code:contextId.toUpperCase()}).eq("id",created.user.id);
    if(countryErr) throw countryErr;
   }
   const resolvedContextId=["user","seller","merchant"].includes(contextType)&&contextId==="NEW_ID"?String(profile.public_id):contextId;
   const {data:configured,error:roleErr}=await userClient.rpc("panel_create_explicit_staff_authority",{p_user:created.user.id,p_role:role,p_permissions:permissions,p_context_type:contextType,p_context_id:resolvedContextId,p_expires_at:body.expires_at||null});
   if(roleErr) throw roleErr;
   return new Response(JSON.stringify({ok:true,login_id:login,public_id:profile.public_id,role,permissions,permission_mode:configured.permission_mode,context_type:contextType,context_id:resolvedContextId}),{headers});
  }catch(e){await admin.auth.admin.deleteUser(created.user.id);throw e}
 }catch(e){return new Response(JSON.stringify({message:e.message||"Operation failed"}),{status:400,headers})}
});

