import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
type Theme='light'|'dark'|'system'
function readTheme():Theme {try{const t=localStorage.getItem('ml:theme');return t==='light'||t==='dark'?t:'system'}catch{return 'system'}}
export default function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>(readTheme)
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme};apply();media.addEventListener('change',apply);try{localStorage.setItem('ml:theme',theme)}catch{/* optional */}return()=>media.removeEventListener('change',apply)},[theme])
  return <div role="group" aria-label="Aparência" className="inline-flex rounded-xl border border-line bg-surface2 p-1">{([{v:'light',label:'Modo claro',Icon:Sun},{v:'dark',label:'Modo escuro',Icon:Moon},{v:'system',label:'Tema do dispositivo',Icon:Monitor}] as const).map(({v,label,Icon})=><button key={v} title={label} aria-label={label} aria-pressed={theme===v} onClick={()=>setTheme(v)} className={`rounded-lg p-2 transition ${theme===v?'bg-surface text-cur shadow-sm':'text-ink3 hover:text-ink'}`}><Icon className="h-4 w-4"/></button>)}</div>
}
