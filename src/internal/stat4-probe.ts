import {stat4RecordBytes} from './stat4-record.ts';
import type {ReprepareContext} from './reprepare.ts';
// vdbemem.c:valueFromExpr/sqlite3Stat4ProbeSetValue/ProbeFree.
// Extract only represented literal productions. NOTFOUND is distinct from NULL;
// Constant functions and initial parameter bindings are unavailable. Reprepare
// supplies copied bound Mem through the existing sample extraction owner.
import type {LemonValue} from './lemon-runtime.ts';
import type {SqlToken} from './tokenize.ts';
import {Mem,memFromPublic,type MemAffinity} from './mem.ts';
import {KeyInfo,UnpackedRecordKey,compareStat4RecordKey} from './comparison.ts';
import {columnTypeEstimate} from './schema.ts';
import type {DatabaseEncoding} from './record.ts';
function leaves(n:LemonValue<SqlToken>):SqlToken[]{return n.kind==='terminal'?[n.value]:n.children.flatMap(leaves)}
function operand(n:Extract<LemonValue<SqlToken>,{kind:'reduction'}>):LemonValue<SqlToken>|undefined{return n.children.find(c=>c.kind==='reduction'&&(c.signature.startsWith('expr ::=')||c.signature.startsWith('term ::=')))}
export function stat4ValueFromExpr(n:LemonValue<SqlToken>|undefined,affinity:MemAffinity,encoding:DatabaseEncoding,parameterSensitive:()=>void=()=>{},check:(units:number)=>void=()=>{},reprepare?:ReprepareContext):Mem|null{
 check(1);if(!n||n.kind!=='reduction')return null;
 const sig=n.signature,t=leaves(n),child=operand(n);
 // Charge token processing/encoding before synchronous host allocations. This
 // is checked work accounting, not event-loop preemption of built-in codecs.
 if(t.length===1)for(let at=0;at<t[0]!.text.length;at+=4096)check(Math.min(4096,t[0]!.text.length-at));
 if(sig==='expr ::= VARIABLE'){parameterSensitive();return reprepare?.value(t[0]!,affinity,encoding)??null;}
 if(sig==='expr ::= LP expr RP'||sig==='expr ::= expr COLLATE ID|STRING')return stat4ValueFromExpr(child,affinity,encoding,parameterSensitive,check,reprepare);
 if(sig.startsWith('expr ::= CAST')){
  const at=t.findIndex(x=>x.text.toUpperCase()==='AS'),cast=columnTypeEstimate(t.slice(at+1,-1).map(x=>x.text).join(' ')).affinity;
  const m=stat4ValueFromExpr(child,cast,encoding,parameterSensitive,check,reprepare);if(!m)return null;
  try{m.cast(cast,encoding);m.applyAffinity(affinity,encoding);return m}catch(e){m.release();throw e}
 }
 if(sig==='expr ::= PLUS|MINUS expr'){
  if(t[0]!.text==='+')return stat4ValueFromExpr(child,affinity,encoding,parameterSensitive,check,reprepare);
  // Negative decimal numeric tokens are combined before parsing to preserve
  // -2^63. Hex and compound negatives use the source recursive branch.
  const inner=child&&leaves(child);
  if(inner?.length===1&&(inner[0]!.kind==='integer'||inner[0]!.kind==='float')&&!/^0x/i.test(inner[0]!.text)){
   const z='-'+inner[0]!.text;let m:Mem;
   if(inner[0]!.kind==='integer'&&BigInt(z)>=-(1n<<63n))m=memFromPublic(BigInt(z),encoding);
   else m=memFromPublic(affinity==='text'?z:Number(z),encoding);
   try{m.applyAffinity(affinity,encoding);return m}catch(e){m.release();throw e}
  }
  const m=stat4ValueFromExpr(child,affinity,encoding,parameterSensitive,check,reprepare);if(!m)return null;
  try{m.cast('numeric',encoding);
   if(m.initialStorageClass==='real')m.setDouble(-m.realValue());
   else if(m.initialStorageClass==='integer'){const i=m.integerValue();if(i===-(1n<<63n))m.setDouble(-Number(i));else m.setInt64(-i)}
   m.applyAffinity(affinity,encoding);return m;
  }catch(e){m.release();throw e}
 }
 if(!(sig.startsWith('term ::=')||sig==='expr ::= term'))return null;
 if(t.length!==1)return null;const token=t[0]!;let value:null|bigint|number|string|Uint8Array;
 if(token.kind==='integer'){const i=BigInt(token.text);value=/^0x/i.test(token.text)?BigInt.asIntN(64,i):i<(1n<<63n)?i:affinity==='text'?token.text:Number(token.text)}
 else if(token.kind==='float')value=affinity==='text'?token.text:Number(token.text);
 else if(token.kind==='string')value=token.text.slice(1,-1).replaceAll("''","'");
 else if(token.kind==='blob')value=Uint8Array.from(token.text.slice(2,-1).match(/../g)?.map(x=>parseInt(x,16))??[]);
 else if(token.text.toUpperCase()==='NULL')value=null;else return null;
 const m=memFromPublic(value,encoding);try{if(!(value instanceof Uint8Array))m.applyAffinity(affinity,encoding);return m}catch(e){m.release();throw e}
}
export class Stat4Probe extends UnpackedRecordKey {
 nRecValid=0;
 parameterSensitive=false;
 readonly check:(units:number)=>void;
 readonly reprepare:ReprepareContext|undefined;
 readonly reserve:((bytes:number)=>()=>void)|undefined;
 private reservations:(()=>void)[]=[];
 private slotCapacity:number[]=[];
 private releasedReservation=false;
 // Logical allowance covers metadata, every Mem slot, value and extraction
 // scratch. High-water capacity lasts until ProbeFree, not measured JS heap.
 private reserveSlot(slot:number,bytes:number):void {
  const prior=this.slotCapacity[slot]??0;
  if(bytes>prior){const release=this.reserve?.(bytes-prior+32);if(release)this.reservations.push(release);this.slotCapacity[slot]=bytes;}
 }
 override release():void {
  if(this.releasedReservation)return;
  try{super.release();}finally{for(const release of this.reservations)release();this.reservations=[];this.releasedReservation=true;}
 }
 constructor(info:KeyInfo,check:(units:number)=>void=()=>{},reserve?:((bytes:number)=>()=>void),reprepare?:ReprepareContext){
  // Reserve before allocating the all-field Mem array, source valueNew.
  const release=reserve?.(64+64*info.totalFieldCount);
  try{super(Array.from({length:info.totalFieldCount},()=>new Mem()),0,'stat4',info);}catch(error){release?.();throw error;}this.nField=0;this.reprepare=reprepare;this.check=check;this.reserve=reserve;if(release)this.reservations.push(release);
 }
 setLiteral(slot:number,value:null|bigint|number|string|Uint8Array):void{
  this.assertLive();if(!Number.isInteger(slot)||slot<0||slot>=this.values.length)throw new RangeError('probe slot out of range');
  this.check(1);this.reserveSlot(slot,32+(typeof value==='string'?value.length*8:value instanceof Uint8Array?value.byteLength*2:0));const m=memFromPublic(value,this.keyInfo.encoding);try{this.values[slot]!.moveFrom(m)}finally{m.release()}
 }
 setExpression(slot:number,n:LemonValue<SqlToken>|undefined,affinity:MemAffinity):boolean{
  this.assertLive();if(!Number.isInteger(slot)||slot<0||slot>=this.values.length)throw new RangeError('probe slot out of range');
  // Conservative lexical bound includes codecs, token traversal and CAST
  // scratch. Bound values additionally reserve copied Mem/affinity capacity.
  let bytes=32;
  const size=(node:LemonValue<SqlToken>):void=>{this.check(1);if(node.kind==='terminal')bytes+=node.value.text.length*8+32+(node.value.kind==='variable'?(this.reprepare?.bindingBytes(node.value)??0)*8:0);else for(const child of node.children)size(child);};
  if(n)size(n);this.reserveSlot(slot,bytes);
  const m=stat4ValueFromExpr(n,affinity,this.keyInfo.encoding,()=>{this.parameterSensitive=true},this.check,this.reprepare);
  if(!m)return false;try{this.values[slot]!.moveFrom(m);return true}finally{m.release()}
 }
 withPrefix<T>(n:number,body:()=>T):T{
  this.assertLive();if(!Number.isInteger(n)||n<1||n>this.values.length)throw new RangeError('probe prefix out of range');
  const previous=this.nField,valid=this.nRecValid;this.nField=n;
  try{return body()}finally{this.nField=previous;this.nRecValid=valid}
 }
 compare(sample:{readonly p:Uint8Array;readonly n:number}):-1|0|1{return compareStat4RecordKey(stat4RecordBytes(sample),sample.n,this,this.keyInfo,()=>this.check(1))}
}
export function createStat4Probe(info:KeyInfo,check:(units:number)=>void=()=>{}):Stat4Probe{return new Stat4Probe(info,check)}
