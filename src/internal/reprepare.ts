import type {SelectNode} from './parse.ts';
import type {SqlToken} from './tokenize.ts';
import {Mem,type MemAffinity} from './mem.ts';
import type {DatabaseEncoding} from './record.ts';

/** Parse.pReprepare and Vdbe.expmask. Slots are numbered at parse order,
 * independent of expression code emission order. Bit31 represents all slots32+. */
export class ReprepareContext {
 mask=0;
 readonly slots=new Map<number,number>();
 readonly bindings:readonly Mem[]|undefined;
 constructor(select:SelectNode,bindings?:readonly Mem[]){
  this.bindings=bindings;
  let maximum=0;const named=new Map<string,number>();
  for(const token of [...select.tokens].sort((a,b)=>a.startByte-b.startByte)){
   if(token.kind!=='variable')continue;
   const z=token.text,index=z==='?'?maximum+1:z[0]==='?'?Number(z.slice(1)):named.get(z)??maximum+1;
   if(z!=='?')named.set(z,index);maximum=Math.max(maximum,index);this.slots.set(token.startByte,index);
  }
 }
 bindingBytes(token:SqlToken):number{const index=this.slots.get(token.startByte);return index===undefined?0:this.bindings?.[index-1]?.diagnostic().byteLength??0;}
 value(token:SqlToken,affinity:MemAffinity,encoding:DatabaseEncoding):Mem|null{
  const index=this.slots.get(token.startByte);if(index===undefined)throw new Error('missing parsed parameter slot');
  this.mask=(this.mask|(index>=32?0x80000000:1<<(index-1)))>>>0;
  if(!this.bindings)return null;
  const value=new Mem();try{value.copyFrom(this.bindings[index-1]!);value.applyAffinity(affinity,encoding);return value;}catch(error){value.release();throw error;}
 }
}
