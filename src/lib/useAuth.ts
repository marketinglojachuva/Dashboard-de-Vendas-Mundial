import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
export function useAuth(){
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(!!supabase),[error,setError]=useState<string|null>(null)
  useEffect(()=>{
    if(!supabase)return
    let active=true
    supabase.auth.getSession().then(({data,error})=>{if(active){setUser(data.session?.user??null);setError(error?'Não foi possível recuperar seu acesso. Entre novamente.':null);setLoading(false)}}).catch(()=>{if(active){setError('Falha de conexão ao verificar o acesso.');setLoading(false)}})
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user??null);setLoading(false)}})
    return ()=>{active=false;data.subscription.unsubscribe()}
  },[])
  return {user,loading,error}
}
