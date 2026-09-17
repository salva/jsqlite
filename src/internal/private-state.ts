import { KeyInfo, compareMem } from "./comparison.ts";
import { Mem } from "./mem.ts";

export interface PrivateStateLimits {
  readonly maxEntries: number;
  readonly maxKeyBytes: number;
  readonly maxBytes: number;
}
/** Units are deterministic: one per inserted record, copied logical byte,
 * compared KeyInfo term, and merge move. A zero-unit checkpoint surrounds
 * bounded growth without adding work. */
export interface PrivateStateControl { checkpoint(units?: number): Promise<void> }
export class PrivateStateLimitError extends Error { constructor(message:string){super(message);this.name="PrivateStateLimitError"} }
/** One execution-owned aggregate budget shared by every private cursor. */
export class PrivateStateByteBudget {
  readonly maxBytes:number; #used=0;
  constructor(maxBytes:number){this.maxBytes=maxBytes}
  reserve(bytes:number,message="private state exceeds total byte limit"):void{if(!Number.isSafeInteger(bytes)||bytes<0)throw new Error("invalid private-state byte reservation");if(this.#used+bytes>this.maxBytes)throw new PrivateStateLimitError(message);this.#used+=bytes}
  replace(oldBytes:number,newBytes:number,message="private state exceeds total byte limit"):void{if(!Number.isSafeInteger(oldBytes)||!Number.isSafeInteger(newBytes)||oldBytes<0||newBytes<0||oldBytes>this.#used)throw new Error("invalid private-state byte replacement");if(this.#used-oldBytes+newBytes>this.maxBytes)throw new PrivateStateLimitError(message);this.#used+=newBytes-oldBytes}
  release(bytes:number):void{if(!Number.isSafeInteger(bytes)||bytes<0||bytes>this.#used)throw new Error("invalid private-state byte release");this.#used-=bytes}
  get usedBytes():number{return this.#used}
}
type Entry={key:Mem[];payload:Mem[];sequence:number;bytes:number};
function cellBytes(value:Mem):number { const kind=value.initialStorageClass;return kind==="text"?value.textBytes().byteLength:kind==="blob"?value.blobValue().byteLength:kind==="integer"||kind==="real"?8:0; }
function logicalBytes(values:readonly Mem[]):number{return values.reduce((n,value)=>n+cellBytes(value),0)}
function copyCells(values:readonly Mem[]):Mem[]{return values.map(value=>{const copy=new Mem();copy.copyFrom(value);return copy})}
function releaseEntry(entry:Entry):void{entry.key.forEach(x=>x.release());entry.payload.forEach(x=>x.release())}
async function compareEntry(a:Entry,b:Entry,keyInfo:KeyInfo,control:PrivateStateControl):Promise<number>{
 for(let i=0;i<keyInfo.keyFieldCount;i++){
  await control.checkpoint(1);
  const term=keyInfo.terms[i]!,left=a.key[i]!,right=b.key[i]!;
  let c=compareMem(left,right,term.collation);
  if(c!==0){if(term.nullsLarge&&(left.initialStorageClass==="null"||right.initialStorageClass==="null"))c=-c as -1|1;if(term.desc)c=-c as -1|1;return c}
 }
 return 0;
}

/** Browser-memory counterpart of a VDBE sorter cursor. Equal keys retain insertion
 * order; no synthetic sequence participates in key equality. */
export class SorterCursor {
  readonly kind="sorter" as const; readonly keyInfo:KeyInfo; readonly limits:PrivateStateLimits;
  #entries:Entry[]=[];#sequence=0;#at=-1;#closed=false;readonly #budget:PrivateStateByteBudget;
  constructor(keyInfo:KeyInfo,limits:PrivateStateLimits,budget=new PrivateStateByteBudget(limits.maxBytes)){this.keyInfo=keyInfo;this.limits=limits;this.#budget=budget}
  async insert(key:readonly Mem[],payload:readonly Mem[],control:PrivateStateControl):Promise<void>{
   this.#live();const keyBytes=logicalBytes(key),bytes=keyBytes+logicalBytes(payload);
   if(key.length!==this.keyInfo.keyFieldCount)throw new Error("sorter key width does not match KeyInfo");
   if(keyBytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("sorter key exceeds byte limit");
   if(this.#entries.length>=this.limits.maxEntries)throw new PrivateStateLimitError("sorter exceeds entry limit");
   this.#budget.reserve(bytes,"sorter exceeds total byte limit");
   try { await control.checkpoint(1+bytes); // admitted record plus every logical byte copied
   await control.checkpoint(0);      // immediately before bounded growth
   } catch(error){this.#budget.release(bytes);throw error}
   let entry:Entry;try { entry={key:copyCells(key),payload:copyCells(payload),sequence:this.#sequence++,bytes}; }
   catch(error){this.#budget.release(bytes);throw error}
   this.#entries.push(entry);
   try { await control.checkpoint(0); } // cancellation/deadline immediately after growth
   catch(error){
    // The opcode has not completed. Undo ownership/accounting so reset or a
    // direct caller never observes a partially admitted record.
    this.#entries.pop();this.#sequence--;releaseEntry(entry);this.#budget.release(bytes);throw error;
   }
  }
  async insertBounded(key:readonly Mem[],payload:readonly Mem[],capacity:bigint,control:PrivateStateControl):Promise<void>{
   this.#live();if(capacity<0n)return this.insert(key,payload,control);if(capacity===0n)return;
   if(BigInt(this.#entries.length)<capacity)return this.insert(key,payload,control);
   let worst=0;for(let i=1;i<this.#entries.length;i++)if(await compareEntry(this.#entries[worst]!,this.#entries[i]!,this.keyInfo,control)<0)worst=i;
   const candidate:Entry={key:key as Mem[],payload:payload as Mem[],sequence:this.#sequence,bytes:0};
   if(await compareEntry(candidate,this.#entries[worst]!,this.keyInfo,control)>=0){await control.checkpoint(1);return}
   const keyBytes=logicalBytes(key),bytes=keyBytes+logicalBytes(payload),old=this.#entries[worst]!;
   if(keyBytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("sorter key exceeds byte limit");
   this.#budget.replace(old.bytes,bytes,"sorter exceeds total byte limit");
   try{await control.checkpoint(1+bytes);await control.checkpoint(0)}catch(error){this.#budget.replace(bytes,old.bytes);throw error}
   let replacement:Entry;try{replacement={key:copyCells(key),payload:copyCells(payload),sequence:this.#sequence++,bytes}}catch(error){this.#budget.replace(bytes,old.bytes);throw error}
   this.#entries[worst]=replacement;
   try{await control.checkpoint(0)}catch(error){this.#entries[worst]=old;this.#sequence--;releaseEntry(replacement);this.#budget.replace(bytes,old.bytes);throw error}
   releaseEntry(old);
  }
  async sort(control:PrivateStateControl):Promise<void>{
   this.#live();let source=this.#entries.slice(),target=new Array<Entry>(source.length);
   for(let width=1;width<source.length;width*=2)for(let lo=0;lo<source.length;lo+=width*2){
    let a=lo,b=Math.min(lo+width,source.length),ae=b,be=Math.min(lo+width*2,source.length),out=lo;
    while(a<ae||b<be){
     let chosen:Entry;
     if(b>=be)chosen=source[a++]!;
     else if(a>=ae)chosen=source[b++]!;
     else {const comparison=await compareEntry(source[a]!,source[b]!,this.keyInfo,control);chosen=comparison<0||(comparison===0&&source[a]!.sequence<source[b]!.sequence)?source[a++]!:source[b++]!}
     await control.checkpoint(1); // one merge move
     target[out++]=chosen;
    }
    if(lo+width*2>=source.length)[source,target]=[target,source];
   }
   this.#entries=source;this.#at=-1;
  }
  first():boolean{this.#live();this.#at=0;return this.#entries.length>0}next():boolean{this.#live();return ++this.#at<this.#entries.length}data():readonly Mem[]{this.#live();if(this.#at<0||this.#at>=this.#entries.length)throw new Error("sorter cursor is not positioned");return this.#entries[this.#at]!.payload}
  clear():void{this.#live();this.#entries.forEach(entry=>{releaseEntry(entry);this.#budget.release(entry.bytes)});this.#entries=[];this.#at=-1}
  close():void{if(this.#closed)return;this.clear();this.#closed=true}
  #live():void{if(this.#closed)throw new Error("sorter cursor is closed")}
}

/** Memory-only ephemeral index. It owns complete keys and uses SQLite Mem/KeyInfo
 * equality; NULLs compare equal for DISTINCT. */
export class EphemeralIndexCursor {
  readonly kind="ephemeral-index" as const;readonly keyInfo:KeyInfo;readonly limits:PrivateStateLimits;
  #shared:{entries:Entry[];references:number}={entries:[],references:1};#closed=false;#at=-1;readonly #budget:PrivateStateByteBudget;
  constructor(keyInfo:KeyInfo,limits:PrivateStateLimits,budget=new PrivateStateByteBudget(limits.maxBytes)){this.keyInfo=keyInfo;this.limits=limits;this.#budget=budget}
  get size():number{this.#live();return this.#shared.entries.length}
  /** sqlite3ExprCodeIN distinguishes empty RHS from RHS NULL on the Mem-owned index. */
  hasNullKey():boolean{this.#live();return this.#shared.entries.some(entry=>entry.key[0]?.initialStorageClass==="null")}
  async found(key:readonly Mem[],control:PrivateStateControl):Promise<boolean>{this.#live();for(const entry of this.#shared.entries)if(await compareEntry(entry,{key:key as Mem[],payload:[],sequence:0,bytes:0},this.keyInfo,control)===0)return true;return false}
  async remove(key:readonly Mem[],control:PrivateStateControl):Promise<void>{
   this.#live();for(let i=0;i<this.#shared.entries.length;i++)if(await compareEntry(this.#shared.entries[i]!,{key:key as Mem[],payload:[],sequence:0,bytes:0},this.keyInfo,control)===0){await control.checkpoint(1);const [entry]=this.#shared.entries.splice(i,1);this.#budget.release(entry!.bytes);releaseEntry(entry!);if(this.#at>=i)this.#at--;return}
  }
  /** Retain this cursor's records whose complete keys occur in `other`.
   * The cells deliberately remain those owned by this (left) cursor: SQLite
   * INTERSECT uses the right records only for membership, preserving the left
   * representative when INTEGER/REAL or collation equality matches. */
  async retainFoundIn(other:EphemeralIndexCursor,control:PrivateStateControl):Promise<void>{
   this.#live();for(let i=0;i<this.#shared.entries.length;){const entry=this.#shared.entries[i]!;if(await other.found(entry.key,control)){i++;continue}await control.checkpoint(1);this.#shared.entries.splice(i,1);this.#budget.release(entry.bytes);releaseEntry(entry);if(this.#at>=i)this.#at--}
  }
  clear():void{this.#live();this.#shared.entries.forEach(entry=>{releaseEntry(entry);this.#budget.release(entry.bytes)});this.#shared.entries=[];this.#at=-1}
  async insert(key:readonly Mem[],control:PrivateStateControl):Promise<void>{
   this.#live();const owned=copyCells(key),bytes=logicalBytes(owned);
   if(bytes>this.limits.maxKeyBytes){owned.forEach(value=>value.release());throw new PrivateStateLimitError("ephemeral key exceeds byte limit")}
   if(this.#shared.entries.length>=this.limits.maxEntries){owned.forEach(value=>value.release());throw new PrivateStateLimitError("ephemeral index exceeds entry limit")}
   try{this.#budget.reserve(bytes,"ephemeral index exceeds total byte limit")}catch(error){owned.forEach(value=>value.release());throw error}
   try{await control.checkpoint(1+bytes);await control.checkpoint(0)}catch(error){owned.forEach(value=>value.release());this.#budget.release(bytes);throw error}
   const entry:Entry={key:owned,payload:[],sequence:this.#shared.entries.length,bytes};
   this.#shared.entries.push(entry);
   try { await control.checkpoint(0); }
   catch(error){this.#shared.entries.pop();releaseEntry(entry);this.#budget.release(bytes);throw error}
  }
  /** Replace an equal complete record, preserving SQLite UNION's right-side representative. */
  async replace(key:readonly Mem[],control:PrivateStateControl):Promise<void>{
   this.#live();for(let i=0;i<this.#shared.entries.length;i++)if(await compareEntry(this.#shared.entries[i]!,{key:key as Mem[],payload:[],sequence:0,bytes:0},this.keyInfo,control)===0){
    const bytes=logicalBytes(key),old=this.#shared.entries[i]!;if(bytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("ephemeral index exceeds byte limit");
    this.#budget.replace(old.bytes,bytes,"ephemeral index exceeds byte limit");try{await control.checkpoint(1+bytes);await control.checkpoint(0)}catch(error){this.#budget.replace(bytes,old.bytes);throw error}
    let replacement:Entry;try{replacement={key:copyCells(key),payload:[],sequence:old.sequence,bytes}}catch(error){this.#budget.replace(bytes,old.bytes);throw error}this.#shared.entries[i]=replacement;
    try{await control.checkpoint(0)}catch(error){this.#shared.entries[i]=old;releaseEntry(replacement);this.#budget.replace(bytes,old.bytes);throw error}releaseEntry(old);return;
   }return this.insert(key,control);
  }
  async sort(control:PrivateStateControl):Promise<void>{
   this.#live();let source=this.#shared.entries.slice(),target=new Array<Entry>(source.length);for(let width=1;width<source.length;width*=2){for(let lo=0;lo<source.length;lo+=width*2){let a=lo,b=Math.min(lo+width,source.length),ae=b,be=Math.min(lo+width*2,source.length),out=lo;while(a<ae||b<be){const take=b>=be||(a<ae&&await compareEntry(source[a]!,source[b]!,this.keyInfo,control)<=0);target[out++]=take?source[a++]!:source[b++]!;await control.checkpoint(1)}}[source,target]=[target,source]}this.#shared.entries=source;this.#at=-1;
  }
  first():boolean{this.#live();this.#at=0;return this.#shared.entries.length>0}
  next():boolean{this.#live();return ++this.#at<this.#shared.entries.length}
  data():readonly Mem[]{this.#live();if(this.#at<0||this.#at>=this.#shared.entries.length)throw new Error("ephemeral cursor is not positioned");return this.#shared.entries[this.#at]!.key}
  /** vdbe.c OP_OpenDup creates an independently positioned cursor over the
   * same ephemeral b-tree. The duplicate borrows records; its position is not
   * shared with the owner. */
  duplicate():EphemeralIndexCursor{this.#live();const copy=new EphemeralIndexCursor(this.keyInfo,this.limits,this.#budget);copy.#shared=this.#shared;copy.#shared.references++;return copy}
  close():void{if(this.#closed)return;this.#closed=true;if(--this.#shared.references===0){this.#shared.entries.forEach(entry=>{releaseEntry(entry);this.#budget.release(entry.bytes)});this.#shared.entries=[]}this.#at=-1}
  #live():void{if(this.#closed)throw new Error("ephemeral index cursor is closed")}
}
