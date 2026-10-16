import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { MonitorDown, X } from 'lucide-react'
import { Button } from './ui'
interface InstallPrompt extends Event { prompt():Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> }
export default function InstallApp(){
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(false),[help,setHelp]=useState(false)
  useEffect(()=>{
    const mode=matchMedia('(display-mode: standalone)')
    const update=()=>setInstalled(mode.matches)
    const ready=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt)}
    const done=()=>{setInstalled(true);setPrompt(null);setHelp(false)}
    update();mode.addEventListener('change',update);window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done)
    return()=>{mode.removeEventListener('change',update);window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done)}
  },[])
  if(installed)return null
  return <Dialog.Root open={help} onOpenChange={setHelp}><Button onClick={async()=>{if(!prompt){setHelp(true);return}try{await prompt.prompt();await prompt.userChoice}catch{setHelp(true)}finally{setPrompt(null)}}}><MonitorDown className="h-4 w-4"/>Instalar app</Button><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/40"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 shadow-xl"><Dialog.Title className="text-lg font-bold">Mundial Vendas no seu computador</Dialog.Title><Dialog.Description className="mt-3 text-sm text-ink3">Abra o painel em uma janela própria, com ícone no Windows, sem baixar um instalador .exe.</Dialog.Description><p className="mt-4 text-sm">No Chrome ou Edge, use o ícone de instalação na barra de endereço ou procure “Instalar” / “Aplicativos” no menu do navegador. Se acabou de abrir o site, aguarde e tente novamente.</p><p className="mt-3 text-xs text-ink3">No iPhone, use Compartilhar → Adicionar à Tela de Início. O acesso aos dados na nuvem precisa de internet e do seu login.</p><Dialog.Close aria-label="Fechar instruções" className="absolute right-3 top-3 rounded p-1"><X className="h-4 w-4"/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
}
