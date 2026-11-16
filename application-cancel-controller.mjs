// Review-only client control. Uses authenticated existing RPCs, never table writes/role assignment RPCs.
export function createApplicationCancelController({client,isCurrent=()=>true}) {
 let actor=null,plan=[],busy=false;
 const identity=r=>JSON.stringify([r.id,r.user_id,String(r.public_id),r.role_key,r.context_type,r.context_id]);
 async function guard(){if(!isCurrent())throw Error('Page changed; refresh applications');const {data,error}=await client.auth.getUser();if(!isCurrent())throw Error('Page changed; refresh applications');if(error||!data?.user?.id)throw Error('Sign in again');if(actor&&actor!==data.user.id)throw Error('Account changed; refresh applications');return data.user.id;}
 async function rows(status){const {data,error}=await client.rpc('owner_role_applications',{p_status:status,p_limit:250});if(error)throw error;if(!Array.isArray(data)||data.length>=250)throw Error('List incomplete or limit reached; do not bulk reject');if(new Set(data.map(r=>r.id)).size!==data.length)throw Error('Duplicate application IDs');return data;}
 return {
  async load(){if(busy)throw Error('Review in progress');actor=null;const user=await guard();const result=await rows('pending');if(result.some(r=>r.status!=='pending'||!r.id||!r.user_id||!r.role_key))throw Error('Invalid pending application list');actor=user;await guard();plan=result.map(r=>({...r}));return plan.map(r=>({...r}));},
  async rejectDisplayed(reason){if(busy)throw Error('Review already in progress');if(!actor||!plan.length)throw Error('Load pending applications first');if(String(reason).trim().length<5)throw Error('Enter a clear rejection reason');busy=true;const outcomes=[];let inFlightId=null;
   try{await guard();const fresh=await rows('all');await guard();for(const selected of plan){const current=fresh.find(r=>r.id===selected.id);if(!current||identity(current)!==identity(selected)||current.status!=='pending')throw Error('Application changed; refresh before rejecting');}
    for(const selected of plan){await guard();inFlightId=selected.id;const {error}=await client.rpc('owner_review_role_application',{p_application:selected.id,p_approve:false,p_review_note:String(reason).trim(),p_expires_at:null});if(error){outcomes.push({id:selected.id,status:'unconfirmed',error:error.message});break;}
     await guard();const after=await rows('all');await guard();const observed=after.find(r=>r.id===selected.id);if(!observed||identity(observed)!==identity(selected)||observed.status!=='rejected'){outcomes.push({id:selected.id,status:'unconfirmed'});break;}outcomes.push({id:selected.id,status:'rejected'});inFlightId=null;
    }
    return outcomes;
   } catch(error){if(inFlightId&&!outcomes.some(x=>x.id===inFlightId))outcomes.push({id:inFlightId,status:'unconfirmed'});error.outcomes=outcomes;throw error;} finally {busy=false;plan=[];}
  }
 };
}
