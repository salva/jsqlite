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
  #entries:Entry[]=[];#bytes=0;#sequence=0;#at=-1;#closed=false;
  constructor(keyInfo:KeyInfo,limits:PrivateStateLimits){this.keyInfo=keyInfo;this.limits=limits}
  async insert(key:readonly Mem[],payload:readonly Mem[],control:PrivateStateControl):Promise<void>{
   this.#live();const keyBytes=logicalBytes(key),bytes=keyBytes+logicalBytes(payload);
   if(key.length!==this.keyInfo.keyFieldCount)throw new Error("sorter key width does not match KeyInfo");
   if(keyBytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("sorter key exceeds byte limit");
   if(this.#entries.length>=this.limits.maxEntries)throw new PrivateStateLimitError("sorter exceeds entry limit");
   if(this.#bytes+bytes>this.limits.maxBytes)throw new PrivateStateLimitError("sorter exceeds total byte limit");
   await control.checkpoint(1+bytes); // admitted record plus every logical byte copied
   await control.checkpoint(0);      // immediately before bounded growth
   const entry={key:copyCells(key),payload:copyCells(payload),sequence:this.#sequence++,bytes};
   this.#entries.push(entry);this.#bytes+=bytes;
   try { await control.checkpoint(0); } // cancellation/deadline immediately after growth
   catch(error){
    // The opcode has not completed. Undo ownership/accounting so reset or a
    // direct caller never observes a partially admitted record.
    this.#entries.pop();this.#bytes-=bytes;this.#sequence--;releaseEntry(entry);throw error;
   }
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
  close():void{if(this.#closed)return;this.#closed=true;this.#entries.forEach(releaseEntry);this.#entries=[];this.#bytes=0;this.#at=-1}
  #live():void{if(this.#closed)throw new Error("sorter cursor is closed")}
}

/** Memory-only ephemeral index. It owns complete keys and uses SQLite Mem/KeyInfo
 * equality; NULLs compare equal for DISTINCT. */
export class EphemeralIndexCursor {
  readonly kind="ephemeral-index" as const;readonly keyInfo:KeyInfo;readonly limits:PrivateStateLimits;
  #entries:Entry[]=[];#bytes=0;#closed=false;
  constructor(keyInfo:KeyInfo,limits:PrivateStateLimits){this.keyInfo=keyInfo;this.limits=limits}
  async found(key:readonly Mem[],control:PrivateStateControl):Promise<boolean>{this.#live();for(const entry of this.#entries)if(await compareEntry(entry,{key:key as Mem[],payload:[],sequence:0,bytes:0},this.keyInfo,control)===0)return true;return false}
  async insert(key:readonly Mem[],control:PrivateStateControl):Promise<void>{
   this.#live();const bytes=logicalBytes(key);
   if(bytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("ephemeral key exceeds byte limit");
   if(this.#entries.length>=this.limits.maxEntries)throw new PrivateStateLimitError("ephemeral index exceeds entry limit");
   if(this.#bytes+bytes>this.limits.maxBytes)throw new PrivateStateLimitError("ephemeral index exceeds total byte limit");
   await control.checkpoint(1+bytes);await control.checkpoint(0);
   const entry={key:copyCells(key),payload:[],sequence:this.#entries.length,bytes};
   this.#entries.push(entry);this.#bytes+=bytes;
   try { await control.checkpoint(0); }
   catch(error){this.#entries.pop();this.#bytes-=bytes;releaseEntry(entry);throw error}
  }
  close():void{if(this.#closed)return;this.#closed=true;this.#entries.forEach(releaseEntry);this.#entries=[];this.#bytes=0}
  #live():void{if(this.#closed)throw new Error("ephemeral index cursor is closed")}
}
