import { KeyInfo, compareMem } from "./comparison.ts";
import { Mem } from "./mem.ts";

export interface PrivateStateLimits {
  readonly maxEntries: number;
  readonly maxKeyBytes: number;
  readonly maxBytes: number;
}
export interface PrivateStateControl { checkpoint(units?: number): Promise<void> }
export class PrivateStateLimitError extends Error { constructor(message:string){super(message);this.name="PrivateStateLimitError"} }
type Entry={key:Mem[];payload:Mem[];sequence:number;bytes:number};
function cellBytes(value:Mem):number { const kind=value.initialStorageClass;return kind==="text"?value.textBytes().byteLength:kind==="blob"?value.blobValue().byteLength:kind==="integer"||kind==="real"?8:0; }
function copyCells(values:readonly Mem[]):Mem[]{return values.map(value=>{const copy=new Mem();copy.copyFrom(value);return copy})}
function releaseEntry(entry:Entry):void{entry.key.forEach(x=>x.release());entry.payload.forEach(x=>x.release())}
function compareEntry(a:Entry,b:Entry,keyInfo:KeyInfo):number {for(let i=0;i<keyInfo.keyFieldCount;i++){const term=keyInfo.terms[i]!,left=a.key[i]!,right=b.key[i]!;let c=compareMem(left,right,term.collation);if(c!==0){if(term.nullsLarge&&(left.initialStorageClass==="null"||right.initialStorageClass==="null"))c=-c as -1|1;if(term.desc)c=-c as -1|1;return c}}return 0}

/** Browser-memory counterpart of a VDBE sorter cursor. Equal keys retain insertion
 * order; no synthetic sequence participates in key equality. */
export class SorterCursor {
  readonly kind="sorter" as const; readonly keyInfo:KeyInfo; readonly limits:PrivateStateLimits;
  #entries:Entry[]=[];#bytes=0;#sequence=0;#at=-1;#closed=false;
  constructor(keyInfo:KeyInfo,limits:PrivateStateLimits){this.keyInfo=keyInfo;this.limits=limits}
  insert(key:readonly Mem[],payload:readonly Mem[]):void{this.#live();const keyBytes=key.reduce((n,x)=>n+cellBytes(x),0),bytes=keyBytes+payload.reduce((n,x)=>n+cellBytes(x),0);if(key.length!==this.keyInfo.keyFieldCount)throw new Error("sorter key width does not match KeyInfo");if(keyBytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("sorter key exceeds byte limit");if(this.#entries.length>=this.limits.maxEntries)throw new PrivateStateLimitError("sorter exceeds entry limit");if(this.#bytes+bytes>this.limits.maxBytes)throw new PrivateStateLimitError("sorter exceeds total byte limit");this.#entries.push({key:copyCells(key),payload:copyCells(payload),sequence:this.#sequence++,bytes});this.#bytes+=bytes}
  async sort(control:PrivateStateControl):Promise<void>{this.#live();let source=this.#entries.slice(),target=new Array<Entry>(source.length);for(let width=1;width<source.length;width*=2){for(let lo=0;lo<source.length;lo+=width*2){let a=lo,b=Math.min(lo+width,source.length),ae=b,be=Math.min(lo+width*2,source.length),out=lo;while(a<ae||b<be){await control.checkpoint();if(b>=be||(a<ae&&(compareEntry(source[a]!,source[b]!,this.keyInfo)<0||(compareEntry(source[a]!,source[b]!,this.keyInfo)===0&&source[a]!.sequence<source[b]!.sequence))))target[out++]=source[a++]!;else target[out++]=source[b++]!}}[source,target]=[target,source]}this.#entries=source;this.#at=-1}
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
  async found(key:readonly Mem[],control:PrivateStateControl):Promise<boolean>{this.#live();for(const entry of this.#entries){await control.checkpoint();if(compareEntry(entry,{key:key as Mem[],payload:[],sequence:0,bytes:0},this.keyInfo)===0)return true}return false}
  insert(key:readonly Mem[]):void{this.#live();const bytes=key.reduce((n,x)=>n+cellBytes(x),0);if(bytes>this.limits.maxKeyBytes)throw new PrivateStateLimitError("ephemeral key exceeds byte limit");if(this.#entries.length>=this.limits.maxEntries)throw new PrivateStateLimitError("ephemeral index exceeds entry limit");if(this.#bytes+bytes>this.limits.maxBytes)throw new PrivateStateLimitError("ephemeral index exceeds total byte limit");this.#entries.push({key:copyCells(key),payload:[],sequence:this.#entries.length,bytes});this.#bytes+=bytes}
  close():void{if(this.#closed)return;this.#closed=true;this.#entries.forEach(releaseEntry);this.#entries=[];this.#bytes=0}
  #live():void{if(this.#closed)throw new Error("ephemeral index cursor is closed")}
}
