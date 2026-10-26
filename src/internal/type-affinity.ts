import {JSQLiteError} from '../index.ts';
import {sqliteAsciiFold} from './sqlite-case.ts';
import type {MemAffinity} from './mem.ts';

/** build.c:sqlite3AffinityType, pCol == NULL. Empty CAST tokens are NUMERIC. */
export function typeAffinity(s:string):MemAffinity {
 const z=sqliteAsciiFold(s);let affinity:MemAffinity='numeric';
 for(let i=1;i<=z.length;i++){
  const h=z.slice(Math.max(0,i-4),i);
  if(h==='char'||h==='clob'||h==='text')affinity='text';
  else if(h==='blob'&&(affinity==='numeric'||affinity==='real'))affinity='blob';
  else if((h==='real'||h==='floa'||h==='doub')&&affinity==='numeric')affinity='real';
  else if(h.endsWith('int')){affinity='integer';break;}
 }
 return affinity;
}
/** parse.y CAST / expr.c sqlite3ExprAlloc(dequote=1), util.c sqlite3Dequote.
 * Dequote the production's complete token, not each typename component. The
 * first unescaped closing quote terminates it, even for multiword typenames. */
export function castTypeAffinity(semantic:unknown):MemAffinity {
 if(typeof semantic!=='string')throw new JSQLiteError('internal','CAST typetoken lost source semantic');
 let name=semantic;
 const first=name[0];
 if(first==='"'||first==="'"||first==='`'||first==='['){
  const quote=first==='['?']':first;let decoded='';
  for(let i=1;i<name.length;i++){
   if(name[i]===quote){if(name[i+1]===quote){decoded+=quote;i++;}else break;}
   else decoded+=name[i];
  }
  name=decoded;
 }
 return typeAffinity(name);
}
/** build.c:sqlite3AddColumn owns absence, not sqlite3AffinityType. */
export function columnDeclaredAffinity(type:string|null|undefined):MemAffinity {
 return type?typeAffinity(type):'blob';
}
