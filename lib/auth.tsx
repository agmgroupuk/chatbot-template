'use client';
import {createContext,useContext,useState,useEffect,ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {getCurrentUserAction} from '@/app/actions';
const Context=createContext({isAuthenticated:false,isLoading:true,login:()=>{},logout:()=>{}});
export function AuthProvider({children}:{children:ReactNode}) {
 const [isAuthenticated,setAuthenticated]=useState(false);
 const pathname=usePathname();
 const [checkedPath,setCheckedPath]=useState<string|null>(null);
 const isLoading=checkedPath!==pathname;
 useEffect(()=>{
   let active=true;
   const refresh=()=>{ getCurrentUserAction().then(user=>{if(active)setAuthenticated(Boolean(user));}).catch(()=>{if(active)setAuthenticated(false);}).finally(()=>{if(active)setCheckedPath(pathname);}); };
   refresh(); window.addEventListener('focus',refresh);
   return ()=>{active=false;window.removeEventListener('focus',refresh);};
 },[pathname]);
 return <Context.Provider value={{isAuthenticated,isLoading,login:()=>{setAuthenticated(true);setCheckedPath(pathname);},logout:()=>{setAuthenticated(false);setCheckedPath(pathname);}}}>{children}</Context.Provider>;
}
export function useAuth(){return useContext(Context);}
