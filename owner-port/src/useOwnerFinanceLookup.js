import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';

// Identity/balances render as soon as their own RPC completes. Optional records
// never delay CHECK ID or replace the verified recipient after the ID changes.
export default function useOwnerFinanceLookup(onNotice){
  const [dashboard,setDashboard]=useState(null),[rows,setRows]=useState([]),[salaryRows,setSalaryRows]=useState([]);
  const [loading,setLoading]=useState(false),[recordsLoading,setRecordsLoading]=useState(false),[error,setError]=useState(''),[recordErrors,setRecordErrors]=useState({});
  const epoch=useRef(0),pending=useRef([]);
  const cancel=()=>{epoch.current+=1;pending.current.forEach(({controller,timer})=>{clearTimeout(timer);controller.abort();});pending.current=[];};
  useEffect(()=>cancel,[]);
  const clear=()=>{cancel();setDashboard(null);setRows([]);setSalaryRows([]);setLoading(false);setRecordsLoading(false);setError('');setRecordErrors({});};
  const load=async(publicId)=>{
    const id=Number(publicId);
    if(!/^\d{4,}$/.test(String(publicId).trim())||!Number.isSafeInteger(id)){onNotice?.('Valid permanent ID required');return null;}
    cancel();const request=epoch.current;
    setDashboard(null);setRows([]);setSalaryRows([]);setLoading(true);setRecordsLoading(true);setError('');setRecordErrors({});
    const current=()=>request===epoch.current;
    const rpc=async(name,args)=>{
      const controller=new AbortController(),entry={controller,timer:null};
      entry.timer=setTimeout(()=>controller.abort(),20000);pending.current.push(entry);
      try{const result=await supabase.rpc(name,args).abortSignal(controller.signal);if(result.error)throw result.error;return result.data;}
      finally{clearTimeout(entry.timer);pending.current=pending.current.filter(item=>item!==entry);}
    };
    const record=async(name,args,apply,label)=>{
      try{const data=await rpc(name,args);if(current())apply(Array.isArray(data)?data:[]);}
      catch(err){if(current())setRecordErrors(value=>({...value,[label]:`${label}: ${err.message||'Could not load. Retry.'}`}));}
    };
    void Promise.all([
      record('owner_finance_report',{p_public_id:id,p_limit:300},setRows,'Transactions'),
      record('owner_salary_user_report',{p_public_id:id},setSalaryRows,'Salary'),
    ]).then(()=>{if(current())setRecordsLoading(false);});
    try{
      const data=await rpc('owner_finance_dashboard',{p_public_id:id});
      if(!current())return null;
      if(!data||Number(data.public_id)!==id)throw new Error('Could not verify this ID. Please retry.');
      setDashboard(data);onNotice?.(`ID ${id} verified`);return data;
    }catch(err){if(current()){const message=err.message||'Could not check this ID. Please retry.';setError(message);onNotice?.(message);}return null;}
    finally{if(current())setLoading(false);}
  };
  return {dashboard,rows,salaryRows,loading,recordsLoading,error,recordErrors,load,clear};
}

