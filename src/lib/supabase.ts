import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const cloudConfigured=!!(url&&key)
export const cloudConfigError=(!!url!==!!key) ? 'A configuração da nuvem está incompleta. Configure a URL e a chave publicável.' : cloudConfigured&&(!/^https:\/\//.test(url)||!key.startsWith('sb_publishable_')) ? 'Use a URL HTTPS e a chave publicável do Supabase na configuração.' : null
export const supabase=cloudConfigured&&!cloudConfigError?createClient(url,key):null
