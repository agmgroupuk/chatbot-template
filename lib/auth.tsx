'use client';
import {createContext,useContext,useState,useEffect,ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {getCurrentUserAction} from '@/app/actions';
const Context=createContext({isAuthenticated:false,login:()=>{},logout:()=>{}});
export function AuthProvider({children}:{children:ReactNode}) {
 const [isAuthenticated,setAuthenticated]=useState(false);
 const pathname=usePathname();
 useEffect(()=>{
   let active=true;
   const refresh=()=>{ getCurrentUserAction().then(user=>{if(active)setAuthenticated(Boolean(user));}).catch(()=>{if(active)setAuthenticated(false);}); };
   refresh(); window.addEventListener('focus',refresh);
   return ()=>{active=false;window.removeEventListener('focus',refresh);};
 },[pathname]);
 return <Context.Provider value={{isAuthenticated,login:()=>setAuthenticated(true),logout:()=>setAuthenticated(false)}}>{children}</Context.Provider>;
}
export function useAuth(){return useContext(Context);}
