import { JSQLiteError } from "../index.ts";
import { Mem } from "./mem.ts";

/** SQLite 3.53.4 src/json.c foundation. Nodes retain ordered object entries and
 * raw numeric spelling; they are deliberately not host JSON values. */
export type JsonNode =
  | { readonly kind:"null"|"true"|"false" }
  | { readonly kind:"number"; readonly raw:string; readonly json5:boolean }
  | { readonly kind:"string"; readonly value:string }
  | { readonly kind:"array"; readonly values:readonly JsonNode[] }
  | { readonly kind:"object"; readonly entries:readonly (readonly [string,JsonNode])[] };

type JsonStringEncoding={readonly type:7|8|9|10;readonly raw:string};
const jsonStringEncoding=new WeakMap<object,JsonStringEncoding>();
const jsonStringSpelling=new WeakMap<object,string>();
const jsonObjectLabelSpelling=new WeakMap<object,readonly string[]>();
const jsonbBounds=new WeakMap<object,{start:number;end:number}>();
const jsonbLabels=new WeakMap<object,readonly number[]>();
type JsonbLabelEncoding={readonly type:7|8|9|10;readonly payload:Uint8Array};
const jsonbLabelEncodings=new WeakMap<object,readonly JsonbLabelEncoding[]>();

const te=new TextEncoder(),td=new TextDecoder("utf-8",{fatal:true});
const malformed=()=>new JSQLiteError("sqlite","malformed JSON",{code:1});
class JsonPositionError extends Error{readonly offset:number;constructor(offset:number){super("malformed JSON");this.offset=offset}}
function driveJson<T>(steps:Generator<number,T>,charge:(n:number)=>void):T{for(;;){const next=steps.next();if(next.done)return next.value;charge(next.value)}}
class Parser {
  #i=0; #depth=0;
  readonly s:string; readonly json5:boolean; readonly charge:(n:number)=>void;
  constructor(s:string,json5:boolean,charge:(n:number)=>void){this.s=s;this.json5=json5;this.charge=charge}
  fail(at=this.#i):never{throw new JsonPositionError(at)}
  *parse():Generator<number,JsonNode>{(yield* this.ws());const n=(yield* this.value());(yield* this.ws());if(this.#i!==this.s.length)this.fail();return n}
  *ws():Generator<number,void>{let nextCheck=this.#i+256;for(;;){while(this.#i>=nextCheck){nextCheck+=256;yield 1;}while(/[\t\n\r ]/.test(this.s[this.#i]??"")){while(this.#i>=nextCheck){nextCheck+=256;yield 1;}this.#i++;}if(!this.json5||this.s[this.#i]!=="/")return;if(this.s[this.#i+1]==="/"){this.#i+=2;while(this.#i<this.s.length&&!/[\r\n]/.test(this.s[this.#i]!)){while(this.#i>=nextCheck){nextCheck+=256;yield 1;}this.#i++;}continue}if(this.s[this.#i+1]==="*"){this.#i+=2;while(this.#i<this.s.length&&!(this.s[this.#i]==="*"&&this.s[this.#i+1]==="/")){while(this.#i>=nextCheck){nextCheck+=256;yield 1;}this.#i++;}if(this.#i>=this.s.length)this.fail();this.#i+=2;continue}return}}
  *value():Generator<number,JsonNode>{yield 1;if(++this.#depth>1000)this.fail();(yield* this.ws());const c=this.s[this.#i];let n:JsonNode;if(c==='"'||(this.json5&&c==="'")){const start=this.#i;n={kind:"string",value:(yield* this.str())};const encoding=(yield* this.stringEncoding(start));jsonStringEncoding.set(n,encoding);jsonStringSpelling.set(n,(yield* translateStringSteps(encoding)));}else if(c==="[")n=(yield* this.array());else if(c==="{")n=(yield* this.object());else {const start=this.#i;while(this.#i<this.s.length&&!/[\s,\]}]/.test(this.s[this.#i]!)){if((this.#i&255)===0)yield 1;this.#i++;}const raw=this.s.slice(start,this.#i);if(raw==="null"||raw==="true"||raw==="false")n={kind:raw};else if(this.number(raw))n={kind:"number",raw,json5:!this.strictNumber(raw)};else this.fail()}this.#depth--;return n}
  strictNumber(x:string):boolean{return /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(x)}
  number(x:string):boolean{return this.strictNumber(x)||(this.json5&&/^[+-]?(?:Infinity|NaN|0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/.test(x))}
  *stringEncoding(start:number):Generator<number,JsonStringEncoding>{const spelling=this.s.slice(start,this.#i),raw=spelling.slice(1,-1);if(spelling[0]==='"'){try{yield* new Parser(spelling,false,this.charge).str();return{type:raw.includes("\\")?8:7,raw}}catch(error){if(!(error instanceof JsonPositionError))throw error}}return{type:9,raw}}
  // Cursor advances by 1, 2, 4 or 6: charge threshold crossings, not alignment.
  *str():Generator<number,string>{const q=this.s[this.#i++]!,out:string[]=[];let nextCheck=this.#i;while(this.#i<this.s.length){while(this.#i>=nextCheck){nextCheck+=256;yield 1;}const c=this.s[this.#i++]!;if(c===q)return out.join("");if(c==='\n'||c==='\r'||c.charCodeAt(0)<0x20)this.fail();if(c!=="\\"){out.push(c);continue}if(this.#i>=this.s.length)this.fail();const e=this.s[this.#i++]!;const simple:{[k:string]:string}={"\"":"\"","'":"'","\\":"\\","/":"/",b:"\b",f:"\f",n:"\n",r:"\r",t:"\t"};if(e in simple&&(e!=="'"||this.json5)){out.push(simple[e]!);continue}if(e==="u"){const h=this.s.slice(this.#i,this.#i+4);if(!/^[0-9a-fA-F]{4}$/.test(h))this.fail(this.#i-1);this.#i+=4;out.push(String.fromCharCode(parseInt(h,16)));continue}if(this.json5&&e==="x"){const h=this.s.slice(this.#i,this.#i+2);if(!/^[0-9a-fA-F]{2}$/.test(h))this.fail();this.#i+=2;out.push(String.fromCharCode(parseInt(h,16)));continue}if(this.json5&&e==="v"){out.push("\v");continue}if(this.json5&&e==="0"){if(/[0-9]/.test(this.s[this.#i]??""))this.fail();out.push("\0");continue}if(this.json5&&(e==='\n'||e==='\r')){if(e==='\r'&&this.s[this.#i]==='\n')this.#i++;continue}if(this.json5&&(e==='\u2028'||e==='\u2029'))continue;this.fail()}this.fail()}
  *array():Generator<number,JsonNode>{this.#i++;const values:JsonNode[]=[];(yield* this.ws());if(this.s[this.#i]==="]"){this.#i++;return{kind:"array",values}}for(;;){values.push((yield* this.value()));(yield* this.ws());if(this.s[this.#i]==="]"){this.#i++;return{kind:"array",values}}if(this.s[this.#i++]!==",")this.fail();(yield* this.ws());if(this.s[this.#i]==="]"){if(!this.json5)this.fail();this.#i++;return{kind:"array",values}}}}
  objectResult(entries:readonly (readonly [string,JsonNode])[],spellings:readonly string[],encodings?:readonly JsonbLabelEncoding[]):JsonNode{const n:JsonNode={kind:"object",entries};jsonObjectLabelSpelling.set(n,spellings);jsonbLabelEncodings.set(n,encodings??spellings.map(raw=>({type:raw.includes("\\")?8:7,payload:te.encode(raw.slice(1,-1))})));return n}
  *object():Generator<number,JsonNode>{this.#i++;const entries:(readonly[string,JsonNode])[]=[],spellings:string[]=[],encodings:JsonbLabelEncoding[]=[];(yield* this.ws());if(this.s[this.#i]==="}"){this.#i++;return this.objectResult(entries,spellings,encodings)}for(;;){(yield* this.ws());let key:string;const labelStart=this.#i,c=this.s[this.#i];if(c==='"'||(this.json5&&c==="'"))key=(yield* this.str());else if(this.json5){const m=/^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.s.slice(this.#i));if(!m)this.fail();key=m[0];this.#i+=key.length}else this.fail();const encoding=(c==='"'||c==="'")?(yield* this.stringEncoding(labelStart)):{type:7 as const,raw:key};encodings.push({type:encoding.type,payload:te.encode(encoding.raw)});const label=(c==='"'||c==="'")?(yield* translateStringSteps(encoding)):(yield* quoteSteps(key));spellings.push(label);(yield* this.ws());if(this.s[this.#i++]!==":")this.fail();entries.push([key,(yield* this.value())]);(yield* this.ws());if(this.s[this.#i]==="}"){this.#i++;return this.objectResult(entries,spellings,encodings)}if(this.s[this.#i++]!==",")this.fail();(yield* this.ws());if(this.s[this.#i]==="}"){if(!this.json5)this.fail();this.#i++;return this.objectResult(entries,spellings,encodings)}}}
}
function canonicalNumber(raw:string):string{if(/NaN/.test(raw))return"null";if(/Infinity/.test(raw))return raw[0]==="-"?"-9e999":"9e999";if(/^[+-]?0[xX]/.test(raw)){const negative=raw[0]==="-",body=raw.replace(/^[+-]?0[xX]/,"");const n=BigInt(`0x${body}`);return `${negative?"-":""}${n}`}return raw[0]==="+"?raw.slice(1):raw.startsWith(".")?`0${raw}`:raw.startsWith("-.")?`-0${raw.slice(1)}`:raw.endsWith(".")?`${raw}0`:raw}
function quote(s:string,charge:(n:number)=>void=()=>{}):string{return driveJson(quoteSteps(s),charge)}
function* quoteSteps(s:string):Generator<number,string>{let out='"',index=0;for(const c of s){if((index++&255)===0)yield 1;const n=c.charCodeAt(0);out+=c==='"'?'\\"':c==='\\'?'\\\\':c==='\b'?'\\b':c==='\f'?'\\f':c==='\n'?'\\n':c==='\r'?'\\r':c==='\t'?'\\t':n<0x20?`\\u${n.toString(16).padStart(4,"0")}`:c}return out+'"'}
export function renderJson(n:JsonNode):string{switch(n.kind){case"null":case"true":case"false":return n.kind;case"number":return canonicalNumber(n.raw);case"string":return quote(n.value);case"array":return`[${n.values.map(renderJson).join(",")}]`;case"object":return`{${n.entries.map(([k,v])=>`${quote(k)}:${renderJson(v)}`).join(",")}}`}}
/** json.c:jsonTranslateBlobToText TEXT/TEXTJ/TEXT5/TEXTRAW branches. */
function translateStringEncoding(e:JsonStringEncoding,charge:(n:number)=>void=()=>{}):string{return driveJson(translateStringSteps(e),charge)}
function* translateStringSteps(e:JsonStringEncoding):Generator<number,string>{
 if(e.type===7||e.type===10)return yield* quoteSteps(e.raw);
 if(e.type===8)return '"'+e.raw+'"';
 let out='"',nextCheck=0;for(let i=0;i<e.raw.length;i++){
  while(i>=nextCheck){nextCheck+=256;yield 1;}const c=e.raw[i]!;
  if(c!=="\\"){out+=c==='"'?'\\"':c;continue}
  const next=e.raw[++i];
  if(next===undefined)throw malformed();
  if(next==="'")out+="'";
  else if(next==='v')out+='\\u000b';
  else if(next==='0')out+='\\u0000';
  else if(next==='x'){const h=e.raw.slice(i+1,i+3);if(!/^[0-9a-fA-F]{2}$/.test(h))throw malformed();out+='\\u00'+h;i+=2}
  else if(next==='\n'||next==='\u2028'||next==='\u2029'){}else if(next==='\r'){if(e.raw[i+1]==='\n')i++}
  else if(next==='u'||'"\\/bfnrt'.includes(next))out+='\\'+next;
  else throw malformed();
 }return out+'"';
}
export interface JsonPrettyControl{
 reserve(bytes:number):void;release(bytes:number):void;
 checkpoint(units:number):Promise<void>;check():void;charge(units:number):void;checkSize(bytes:number):void;
}
/** Ordered nodes replace JSONB offsets. Temporary retention is reserved before
 * conversion, and released in finally; chunks bound encoding and yielded work. */
export async function jsonPretty(value:Mem,indent:Mem|undefined,control:JsonPrettyControl):Promise<Mem>{
 const out=new Mem();if(value.initialStorageClass==="null")return out;
 let reserved=0;
 const reserve=(bytes:number)=>{control.reserve(bytes);reserved+=bytes};
 const chunks=(s:string):Iterable<string>=>({*[Symbol.iterator](){for(let i=0;i<s.length;){let end=Math.min(i+256,s.length);if(end<s.length&&s.charCodeAt(end-1)>=0xd800&&s.charCodeAt(end-1)<=0xdbff)end--;yield s.slice(i,end);i=end}}});
 try{
  // Conservative logical arena: source/decoded/lexical strings and per-character
  // worst-case node/entry overhead. Not a measurement of native or JS heap bytes.
  const sourceBytes=value.initialStorageClass==="blob"?value.blobValue().length:value.initialStorageClass==="text"?value.textBytes().length:32;
  reserve(sourceBytes*128+256);
  for(let i=0;i<sourceBytes;i+=256)await control.checkpoint(1);
  let node:JsonNode;
  if(value.initialStorageClass==="blob"&&jsonArgIsJsonb(value.blobValue())){
   const steps=decodeJsonbSteps(value.blobValue(),0,0,n=>{control.charge(n);control.check()});
   for(;;){const next=steps.next();if(next.done){node=next.value.node;break}await control.checkpoint(next.value)}
  }
  else{
   const source=new Mem();source.copyFrom(value);source.cast("text","utf-8");
   const steps=new Parser(source.textValue(),true,n=>{control.charge(n);control.check()}).parse();
   try{for(;;){const next=steps.next();if(next.done){node=next.value;break}await control.checkpoint(next.value)}}catch(error){if(error instanceof JsonPositionError)throw malformed();throw error}
  }
  const indentBytes=indent===undefined?4:indent.initialStorageClass==="blob"?indent.blobValue().length:indent.initialStorageClass==="text"?indent.textBytes().length:32;
  reserve(indentBytes*8+128);
  for(let i=0;i<indentBytes;i+=256)await control.checkpoint(1);
  const copy=new Mem();if(indent!==undefined)copy.copyFrom(indent);
  if(indent!==undefined&&indent.initialStorageClass!=="null")copy.cast("text","utf-8");
  const text=indent===undefined||indent.initialStorageClass==="null"?"    ":copy.textValue();
  const nul=text.indexOf("\0"),zIndent=nul<0?text:text.slice(0,nul);
  const parts:Uint8Array[]=[];let bytes=0;
  const append=async(s:string)=>{for(const chunk of chunks(s)){
   await control.checkpoint(1);
   // Bound before allocating UTF8. Actual length checked without whole-string encoding.
   let length=0;for(const c of chunk){const n=c.codePointAt(0)!;length+=n<128?1:n<2048?2:n<65536?3:4}
   control.checkSize(bytes+length);reserve(length+64);
   parts.push(te.encode(chunk));bytes+=length;
  }};
  const indentation=async(depth:number)=>{for(let i=0;i<depth;i++)await append(zIndent)};
  const visit=async(n:JsonNode,depth:number):Promise<void>=>{
   await control.checkpoint(1);
   if(n.kind!=="array"&&n.kind!=="object"){
    if(n.kind==="string")await append(jsonStringSpelling.get(n)??quote(n.value));else await append(renderJson(n));return;
   }
   const object=n.kind==="object",length=object?n.entries.length:n.values.length;
   await append(object?"{":"[");
   if(length){
    if(depth+1>=1000)throw new JSQLiteError("sqlite","JSON nested too deep",{code:1});
    await append("\n");
    for(let i=0;i<length;i++){
     await indentation(depth+1);
     if(n.kind==="object"){await append(jsonObjectLabelSpelling.get(n)?.[i]??quote(n.entries[i]![0]));await append(": ");await visit(n.entries[i]![1],depth+1)}
     else await visit(n.values[i]!,depth+1);
     if(i+1<length)await append(",\n");
    }
    await append("\n");await indentation(depth);
   }
   await append(object?"}":"]");
  };
  await visit(node,0);reserve(bytes*2);const result=new Uint8Array(bytes);let offset=0;
  for(const part of parts){await control.checkpoint(1);result.set(part,offset);offset+=part.length}
  out.setText(result,"utf-8");return out;
 }catch(error){if(error instanceof JsonPositionError)throw malformed();throw error}finally{control.release(reserved)}
}
function header(type:number,size:number):Uint8Array{if(size<=11)return Uint8Array.of((size<<4)|type);if(size<=255)return Uint8Array.of(0xc0|type,size);if(size<=65535)return Uint8Array.of(0xd0|type,size>>>8,size&255);return Uint8Array.of(0xe0|type,(size/0x1000000)>>>0,(size>>>16)&255,(size>>>8)&255,size&255)}
function join(parts:readonly Uint8Array[]):Uint8Array{const n=parts.reduce((x,p)=>x+p.length,0),out=new Uint8Array(n);let i=0;for(const p of parts){out.set(p,i);i+=p.length}return out}
function element(type:number,payload:Uint8Array<ArrayBufferLike>=new Uint8Array()):Uint8Array{return join([header(type,payload.length),payload])}
export function encodeJsonb(n:JsonNode):Uint8Array{switch(n.kind){case"null":return element(0);case"true":return element(1);case"false":return element(2);case"number":{if(/NaN/.test(n.raw))return element(0);if(/^[+-]?0[xX]/.test(n.raw))return element(4,te.encode(n.raw));const raw=canonicalNumber(n.raw),json5=n.json5&&(/^[-.]|\.$/.test(n.raw));return element(/^-?\d+$/.test(raw)?3:json5?6:5,te.encode(json5?n.raw:raw))}case"string":{const e=jsonStringEncoding.get(n);return element(e?.type??7,te.encode(e?.raw??n.value))}case"array":return element(11,join(n.values.map(encodeJsonb)));case"object":{const labels=jsonbLabelEncodings.get(n);return element(12,join(n.entries.flatMap(([k,v],i)=>{const label=labels?.[i];return[element(label?.type??7,label?.payload??te.encode(k)),encodeJsonb(v)]})))}}}
function jsonbSize(b:Uint8Array,at=0):{size:number,type:number,header:number}|null{if(at>=b.length)return null;const x=b[at]!,tag=x>>>4,type=x&15;let header=1,size=tag;if(tag>=12){header=tag===12?2:tag===13?3:tag===14?5:9;if(at+header>b.length)return null;size=0;for(let i=1;i<header;i++){size=size*256+b[at+i]!;if(!Number.isSafeInteger(size))return null}}return{size,type,header}}
function decodePayload(b:Uint8Array,start:number,end:number):string{try{return td.decode(b.subarray(start,end))}catch{throw malformed()}}
function decodeJsonbAt(b:Uint8Array,at:number,depth:number,charge:(n:number)=>void):{node:JsonNode;end:number}{return driveJson(decodeJsonbSteps(b,at,depth,charge),charge)}
function* decodeJsonbSteps(b:Uint8Array,at:number,depth:number,charge:(n:number)=>void):Generator<number,{node:JsonNode;end:number}>{
 yield 1;if(depth>1000)throw malformed();const h=jsonbSize(b,at);if(!h||h.type>12||at+h.header+h.size>b.length)throw malformed();const start=at+h.header,end=start+h.size,raw=h.type<=10?decodePayload(b,start,end):"";
 if(h.type<=2){if(h.size)throw malformed();const node:JsonNode={kind:h.type===0?"null":h.type===1?"true":"false"};jsonbBounds.set(node,{start:at,end});return{node,end}}
 if(h.type>=3&&h.type<=6){const json5=h.type===4||h.type===6,node=(yield* new Parser(raw,json5,charge).parse());if(node.kind!=="number")throw malformed();jsonbBounds.set(node,{start:at,end});return{node,end}}
 if(h.type>=7&&h.type<=10){let value:string;if(h.type===7||h.type===10)value=raw;else{const node=(yield* new Parser(`"${raw}"`,h.type===9,charge).parse());if(node.kind!=="string")throw malformed();value=node.value}const node:JsonNode={kind:"string",value};const encoding:JsonStringEncoding={type:h.type as 7|8|9|10,raw};jsonStringEncoding.set(node,encoding);jsonStringSpelling.set(node,(yield* translateStringSteps(encoding)));jsonbBounds.set(node,{start:at,end});return{node,end}}
 const values:JsonNode[]=[],entries:(readonly[string,JsonNode])[]=[],labels:number[]=[],labelEncodings:JsonbLabelEncoding[]=[];let p=start,index=0;while(p<end){const childStart=p,child=(yield* decodeJsonbSteps(b,p,depth+1,charge));p=child.end;if(h.type===11)values.push(child.node);else if((index++&1)===0){if(child.node.kind!=="string")throw malformed();const lh=jsonbSize(b,childStart)!;labels.push(jsonbBounds.get(child.node)!.start);labelEncodings.push({type:lh.type as 7|8|9|10,payload:b.slice(childStart+lh.header,child.end)});entries.push([child.node.value,{kind:"null"}])}else entries[entries.length-1]=[entries.at(-1)![0],child.node]}if(p!==end||(h.type===12&&index%2))throw malformed();const node:JsonNode=h.type===11?{kind:"array",values}:{kind:"object",entries};jsonbBounds.set(node,{start:at,end});if(h.type===12){jsonbLabels.set(node,labels);jsonbLabelEncodings.set(node,labelEncodings);const spellings:string[]=[];for(const label of labelEncodings)spellings.push(yield* translateStringSteps({type:label.type,raw:td.decode(label.payload)}));jsonObjectLabelSpelling.set(node,spellings)}return{node,end}
}
function validJsonb(b:Uint8Array,deep:boolean,at=0,depth=0):number{const h=jsonbSize(b,at);if(!h||h.type>12||at+h.header+h.size>b.length||depth>1000)return-1;const end=at+h.header+h.size;if(!deep)return end;try{return decodeJsonbAt(b,at,depth,()=>{}).end}catch{return-1}}
/** src/json.c:jsonArgIsJsonb, including tag-20240123-a. Small BLOBs whose
 * leading byte can also begin text JSON require deep validation before they
 * are classified as JSONB; otherwise document arguments fall through to text. */
function jsonArgIsJsonb(b:Uint8Array):boolean{if(b.length===0)return false;const h=jsonbSize(b,0);if(!h||h.type>12||h.header+h.size!==b.length||(h.type<=2&&h.size!==0))return false;const c=b[0]!,ambiguous=c===0x7b||c===0x5b||(c>=0x30&&c<=0x39);return h.size>7||!ambiguous||validJsonb(b,true)===b.length}
function blobText(b:Uint8Array):string{try{return td.decode(b)}catch{throw malformed()}}
export function parseJsonMem(value:Mem,json5=true,charge:(n:number)=>void=()=>{}):JsonNode{try{if(value.initialStorageClass==="null")throw malformed();if(value.initialStorageClass==="blob"){const b=value.blobValue();if(jsonArgIsJsonb(b)){const decoded=decodeJsonbAt(b,0,0,charge);if(decoded.end!==b.length)throw malformed();return decoded.node}return driveJson(new Parser(blobText(b),json5,charge).parse(),charge)}const text=new Mem();text.copyFrom(value);text.cast("text","utf-8");return driveJson(new Parser(text.textValue(),json5,charge).parse(),charge)}catch(error){if(error instanceof JsonPositionError)throw malformed();throw error}}
export function jsonValid(value:Mem,flags:number,charge:(n:number)=>void=()=>{}):boolean{if(flags<1||flags>15)throw new JSQLiteError("sqlite","FLAGS parameter to json_valid() must be between 1 and 15",{code:1});try{if(value.initialStorageClass==="blob"){const b=value.blobValue();if(jsonArgIsJsonb(b))return ((flags&4)!==0&&validJsonb(b,false)===b.length)||((flags&8)!==0&&validJsonb(b,true)===b.length);if((flags&3)===0)return false;driveJson(new Parser(blobText(b),(flags&2)!==0,charge).parse(),charge);return true}if((flags&3)===0)return false;driveJson(new Parser(value.textValue(),(flags&2)!==0,charge).parse(),charge);return true}catch{return false}}
export function jsonTextResult(node:JsonNode):Mem{const out=new Mem();out.setText(te.encode(renderJson(node)),"utf-8");out.setSubtype(74);return out}
/** JSONB is identified by its validated binary representation, not by the
 * JSON text subtype. In the pinned json.c registration, JSON_BLOB selects a
 * BLOB result while the SQLITE_RESULT_SUBTYPE flag is deliberately absent. */
export function jsonbResult(node:JsonNode):Mem{const out=new Mem();out.setBlob(encodeJsonb(node));return out}

function decodeJsonbUnchecked(b:Uint8Array,at=0,depth=0):{node:JsonNode;next:number}{
 const decoded=decodeJsonbAt(b,at,depth,()=>{});return{node:decoded.node,next:decoded.end}
}

/** json.c:jsonAppendSqlValue classification used by JSON aggregate steps. */
export function jsonNodeFromSqlValue(value:Mem):JsonNode{
 switch(value.initialStorageClass){
  case"null":return{kind:"null"};
  case"integer":return{kind:"number",raw:value.integerValue().toString(),json5:false};
  case"real":{const n=value.realValue();return{kind:"number",raw:Number.isFinite(n)?(Number.isInteger(n)?`${n}.0`:String(n)):(n<0?"-9e999":"9e999"),json5:false}}
  case"blob":{const b=value.blobValue();if(validJsonb(b,true)!==b.length)throw new JSQLiteError("sqlite","JSON cannot hold BLOB values",{code:1});const decoded=decodeJsonbUnchecked(b);return decoded.node}
  case"text":return value.subtypeValue()===74?parseJsonMem(value,true):{kind:"string",value:value.textValue()};
 }
}

const badPath=(path:string)=>new JSQLiteError("sqlite",`bad JSON path: '${path}'`,{code:1});

/** src/json.c:jsonLookupStep read-only branches. Object scans deliberately
 * return the first matching label, preserving SQLite's duplicate-key rule. */
export function jsonLookup(root:JsonNode,path:string):JsonNode|undefined{
 if(!path.startsWith("$"))throw badPath(path);
 let node:JsonNode|undefined=root,i=1;
 while(i<path.length){
  if(path[i]==="."){
   i++;let key="";
   if(path[i]==='"'){
    const start=i++;
    while(i<path.length&&path[i]!=='"'){if(path[i]==="\\")i++;i++}
    if(path[i]!== '"')throw badPath(path);i++;
    const parsed=driveJson(new Parser(path.slice(start,i),false,()=>{}).parse(),()=>{});
    if(parsed.kind!=="string")throw badPath(path);key=parsed.value;
   }else{const start=i;while(i<path.length&&path[i]!=="."&&path[i]!=="[")i++;key=path.slice(start,i)}
   if(node?.kind!=="object"){node=undefined;continue}
   node=node.entries.find(([label])=>label===key)?.[1];continue;
  }
  if(path[i]==="["){
   const end=path.indexOf("]",i+1);if(end<0)throw badPath(path);
   const part=path.slice(i+1,end);let index:number;
   if(/^\d+$/.test(part))index=Number(part);
   else if(/^#-\d+$/.test(part)){if(node?.kind!=="array"){node=undefined;i=end+1;continue}index=node.values.length-Number(part.slice(2))}
   else if(part==="#"){node=undefined;i=end+1;continue}else throw badPath(path);
   if(!Number.isSafeInteger(index))throw badPath(path);
   node=node?.kind==="array"?node.values[index]:undefined;i=end+1;continue;
  }
  throw badPath(path);
 }
 return node;
}

function scalarResult(node:JsonNode):Mem{
 const out=new Mem();
 switch(node.kind){
  case"null":out.setNull();break;case"true":out.setInt64(1n);break;case"false":out.setInt64(0n);break;
  case"string":out.setText(te.encode(node.value),"utf-8");break;
  case"array":case"object":return jsonTextResult(node);
  case"number":{const raw=canonicalNumber(node.raw);if(/^-?\d+$/.test(raw)){try{out.setInt64(BigInt(raw));break}catch{}}out.setDouble(Number(raw));break}
 }
 return out;
}


export const JSON_EACH_COLUMNS=Object.freeze(["key","value","type","atom","id","parent","fullkey","path"] as const);
export const JSON_TABLE_COLUMNS=Object.freeze([...JSON_EACH_COLUMNS,"json","root"] as const);

/** Incremental src/json.c JsonEachCursor analogue. Parsing validates and retains
 * one ordered parse image; next() alone advances traversal and constructs the
 * current row. The reserve hook owns retained input plus current stack/path. */
export interface JsonTableCursor { next():readonly Mem[]|null; close():void }
export function openJsonTableCursor(value:Mem,recursive:boolean,charge:(n:number)=>void=()=>{},rootPath="$",binaryContainers=false,reserve:(oldBytes:number,newBytes:number)=>void=()=>{}):JsonTableCursor {
 let retained=0,closed=false;
 const inputBytes=value.initialStorageClass==="blob"?value.blobValue().byteLength:value.initialStorageClass==="text"?value.textBytes().byteLength:0;
 const replace=(n:number)=>{reserve(retained,n);retained=n};
 try{replace(inputBytes+rootPath.length*2+64);
  if(value.initialStorageClass==="null")return{next:()=>null,close(){if(!closed){closed=true;replace(0)}}};
  let parseUnits=0;
  const document=parseJsonMem(value,true,n=>{parseUnits+=n;charge(n);replace(inputBytes+rootPath.length*2+64+parseUnits*64)}),selected=jsonLookup(document,rootPath);
  const parseBytes=parseUnits*64;
  const text=(x:string)=>{const m=new Mem();m.setText(te.encode(x),"utf-8");return m},integer=(x:bigint)=>{const m=new Mem();m.setInt64(x);return m},nil=()=>{const m=new Mem();m.setNull();return m};
  const size=(node:JsonNode)=>{const bounds=jsonbBounds.get(node);return bounds?bounds.end-bounds.start:encodeJsonb(node).length};
  let selectedId=0,selectedValueAt=0;
  const valueStart=(node:JsonNode,fallback:number)=>jsonbBounds.get(node)?.start??fallback;
  const contentStart=(node:JsonNode,at:number)=>at+(jsonbBounds.get(node)?jsonbSize(value.blobValue(),at)!.header:1);
  const locate=(node:JsonNode,id:number,valueAt:number):boolean=>{if(node===selected){selectedId=id;selectedValueAt=valueAt;return true}let at=contentStart(node,valueAt);if(node.kind==="array")for(const child of node.values){const childAt=valueStart(child,at);if(locate(child,childAt,childAt))return true;at=childAt+size(child)}else if(node.kind==="object")for(let i=0;i<node.entries.length;i++){const [label,child]=node.entries[i]!,labelAt=jsonbLabels.get(node)?.[i]??at,childAt=valueStart(child,labelAt+encodeJsonb({kind:"string",value:label}).length);if(locate(child,labelAt,childAt))return true;at=childAt+size(child)}return false};
  if(selected)locate(document,0,0);
  const valueResult=(node:JsonNode):Mem=>{if(node.kind!=="array"&&node.kind!=="object")return scalarResult(node);if(!binaryContainers)return jsonTextResult(node);const bounds=jsonbBounds.get(node);if(!bounds)return jsonbResult(node);const out=new Mem();out.setBlob(value.blobValue().slice(bounds.start,bounds.end));return out};
  // json.c jsonEachColumn and json_type share the aJsonType label owner.
  const type=jsonTypeName;
  const row=(key:Mem,node:JsonNode,id:number,parent:number|null,fullkey:string,path:string,depth:number):readonly Mem[]=>{replace(inputBytes+parseBytes+(fullkey.length+path.length+rootPath.length)*2+(depth+1)*64);charge(1);return Object.freeze([key,valueResult(node),text(type(node)),node.kind==="array"||node.kind==="object"?nil():scalarResult(node),integer(BigInt(id)),parent===null?nil():integer(BigInt(parent)),text(fullkey),text(path),value,text(rootPath)])};
  function *walk(node:JsonNode,id:number,valueAt:number,parent:number|null,key:Mem,fullkey:string,path:string,depth:number):Generator<readonly Mem[]>{yield row(key,node,id,parent,fullkey,path,depth);if(!recursive)return;let at=contentStart(node,valueAt);if(node.kind==="array")for(let i=0;i<node.values.length;i++){const child=node.values[i]!,childAt=valueStart(child,at),childPath=`${fullkey}[${i}]`;yield*walk(child,childAt,childAt,id,integer(BigInt(i)),childPath,fullkey,depth+1);at=childAt+size(child)}else if(node.kind==="object")for(let i=0;i<node.entries.length;i++){const [label,child]=node.entries[i]!,childId=jsonbLabels.get(node)?.[i]??at,childAt=valueStart(child,childId+encodeJsonb({kind:"string",value:label}).length),childPath=/^[A-Za-z][A-Za-z0-9]*$/.test(label)?`${fullkey}.${label}`:`${fullkey}.${quote(label)}`;yield*walk(child,childId,childAt,id,text(label),childPath,fullkey,depth+1);at=childAt+size(child)}}
  function *rows():Generator<readonly Mem[]>{if(!selected)return;if(recursive){yield*walk(selected,selectedId,selectedValueAt,null,nil(),rootPath,rootPath,0);return}if(selected.kind!=="array"&&selected.kind!=="object"){yield row(nil(),selected,selectedId,null,rootPath,rootPath,0);return}let at=contentStart(selected,selectedValueAt);if(selected.kind==="array")for(let i=0;i<selected.values.length;i++){const node=selected.values[i]!,id=valueStart(node,at);yield row(integer(BigInt(i)),node,id,null,`${rootPath}[${i}]`,rootPath,1);at=id+size(node)}else for(let i=0;i<selected.entries.length;i++){const [key,node]=selected.entries[i]!,id=jsonbLabels.get(selected)?.[i]??at,childAt=valueStart(node,id+encodeJsonb({kind:"string",value:key}).length);yield row(text(key),node,id,null,/^[A-Za-z][A-Za-z0-9]*$/.test(key)?`${rootPath}.${key}`:`${rootPath}.${quote(key)}`,rootPath,1);at=childAt+size(node)}}
  const iterator=rows();return{next(){if(closed)return null;const item=iterator.next();if(item.done){this.close();return null}return item.value},close(){if(!closed){closed=true;iterator.return?.(undefined);replace(0)}}};
 }catch(error){if(retained)replace(0);throw error}
}
export function jsonEachRows(value:Mem,charge:(n:number)=>void=()=>{},rootPath="$",binaryContainers=false):readonly (readonly Mem[])[]{const cursor=openJsonTableCursor(value,false,charge,rootPath,binaryContainers),rows:(readonly Mem[])[]=[];try{for(let row;(row=cursor.next()!)!==null;)rows.push(row);return Object.freeze(rows)}finally{cursor.close()}}
export function jsonTreeRows(value:Mem,charge:(n:number)=>void=()=>{},rootPath="$",binaryContainers=false):readonly (readonly Mem[])[]{const cursor=openJsonTableCursor(value,true,charge,rootPath,binaryContainers),rows:(readonly Mem[])[]=[];try{for(let row;(row=cursor.next()!)!==null;)rows.push(row);return Object.freeze(rows)}finally{cursor.close()}}

/** src/json.c:jsonExtractFunc result shaping. */
export function jsonExtract(value:Mem,paths:readonly Mem[],charge:(n:number)=>void=()=>{}):Mem{
 const out=new Mem();
 if(value.initialStorageClass==="null"||paths.some(path=>path.initialStorageClass==="null")){out.setNull();return out}
 const root=parseJsonMem(value,true,charge),found=paths.map(path=>jsonLookup(root,path.textValue()));
 if(paths.length===1)return found[0]===undefined?out:scalarResult(found[0]);
 return jsonTextResult({kind:"array",values:found.map(node=>node??{kind:"null"})});
}
export function jsonbExtract(value:Mem,paths:readonly Mem[],charge:(n:number)=>void=()=>{}):Mem{const result=jsonExtract(value,paths,charge);return result.initialStorageClass==="text"&&result.subtypeValue()===74?jsonbResult(parseJsonMem(result,true,charge)):result}

export function jsonbMemResult(value:Mem,node:JsonNode):Mem{if(value.initialStorageClass!=="blob")return jsonbResult(node);const bytes=value.blobValue();if(validJsonb(bytes,true)!==bytes.length)throw malformed();const out=new Mem();out.setBlob(bytes);return out}

export function jsonArrow(value:Mem,path:Mem,sql:boolean,charge:(n:number)=>void=()=>{}):Mem{const out=new Mem();if(value.initialStorageClass==="null"||path.initialStorageClass==="null")return out;let p=path.textValue();if(!p.startsWith("$"))p=/^\d+$/.test(p)?`$[${p}]`:`$.${p}`;const node=jsonLookup(parseJsonMem(value,true,charge),p);if(!node)return out;return sql?scalarResult(node):jsonTextResult(node)}

export function jsonQuote(value:Mem):Mem{return jsonTextResult(jsonNodeFromSqlValue(value))}
export function jsonConstruct(kind:"array"|"object",values:readonly Mem[],blob=false):Mem{
 if(kind==="array"){const node:JsonNode={kind:"array",values:values.map(jsonNodeFromSqlValue)};return blob?jsonbResult(node):jsonTextResult(node)}
 if(values.length%2)throw new JSQLiteError("sqlite","json_object() labels must be TEXT",{code:1});
 const entries:(readonly[string,JsonNode])[]=[];for(let i=0;i<values.length;i+=2){const key=values[i]!;if(key.initialStorageClass!=="text")throw new JSQLiteError("sqlite","json_object() labels must be TEXT",{code:1});entries.push([key.textValue(),jsonNodeFromSqlValue(values[i+1]!)])}const node:JsonNode={kind:"object",entries};return blob?jsonbResult(node):jsonTextResult(node);
}
const jsonTypeName=(node:JsonNode):string=>node.kind==="number"?(/^-?\d+$/.test(canonicalNumber(node.raw))?"integer":"real"):node.kind==="string"?"text":node.kind;
export function jsonType(value:Mem,path?:Mem,charge:(n:number)=>void=()=>{}):Mem{const out=new Mem();if(value.initialStorageClass==="null"||path?.initialStorageClass==="null")return out;const root=parseJsonMem(value,true,charge),node=path?jsonLookup(root,path.textValue()):root;if(node)out.setText(te.encode(jsonTypeName(node)),"utf-8");return out}
export function jsonArrayLength(value:Mem,path?:Mem,charge:(n:number)=>void=()=>{}):Mem{const out=new Mem();if(value.initialStorageClass==="null"||path?.initialStorageClass==="null")return out;const root=parseJsonMem(value,true,charge),node=path?jsonLookup(root,path.textValue()):root;if(!node)return out;out.setInt64(BigInt(node.kind==="array"?node.values.length:0));return out}
export function jsonErrorPosition(value:Mem):Mem{const out=new Mem();if(value.initialStorageClass==="null"){out.setNull();return out}if(value.initialStorageClass==="blob"){const b=value.blobValue();out.setInt64(BigInt(validJsonb(b,true)===b.length?0:jsonbErrorOffset(b)));return out}try{driveJson(new Parser(value.textValue(),true,()=>{}).parse(),()=>{});out.setInt64(0n)}catch(error){if(!(error instanceof JsonPositionError))throw error;out.setInt64(BigInt(Array.from(value.textValue().slice(0,error.offset)).length+1))}return out}
function jsonbErrorOffset(b:Uint8Array):number{const check=(at:number,depth:number):{end:number;error:number}=>{const h=jsonbSize(b,at);if(!h||h.type>12||depth>1000)return{end:at,error:at+1};const start=at+h.header,end=start+h.size;if(end>b.length)return{end,error:at+1};if(h.type<=2)return{end,error:h.size?at+1:0};if(h.type>=3&&h.type<=10){try{decodeJsonbAt(b,at,depth,()=>{});return{end,error:0}}catch{return{end,error:at+1}}}let p=start,count=0;while(p<end){const child=check(p,depth+1);if(child.error)return child;if(child.end<=p||child.end>end)return{end,error:p+1};if(h.type===12&&(count&1)===0){try{const decoded=decodeJsonbAt(b,p,depth+1,()=>{});if(decoded.node.kind!=="string")return{end,error:p+1}}catch{return{end,error:p+1}}}count++;p=child.end}return{end,error:h.type===12&&(count&1)?at+1:0}};const result=check(0,0);return result.error||result.end!==b.length?result.error||result.end+1:0}

type PathPart={kind:"key";key:string;label:JsonbLabelEncoding}|{kind:"index";index:number|"append"}|{kind:"fromEnd";distance:number};
function pathParts(path:string):PathPart[]{if(!path.startsWith("$"))throw badPath(path);const parts:PathPart[]=[];let i=1;while(i<path.length){if(path[i]==="."){i++;if(path[i]==='"'){const start=i++;while(i<path.length&&path[i]!=='"'){if(path[i]==="\\")i++;i++}if(path[i]!== '"')throw badPath(path);i++;const n=driveJson(new Parser(path.slice(start,i),false,()=>{}).parse(),()=>{});if(n.kind!=="string")throw badPath(path);parts.push({kind:"key",key:n.value,label:{type:path.slice(start+1,i-1).includes("\\")?9:10,payload:te.encode(path.slice(start+1,i-1))}})}else{const start=i;while(i<path.length&&!".[".includes(path[i]!))i++;if(start===i)throw badPath(path);parts.push({kind:"key",key:path.slice(start,i),label:{type:10,payload:te.encode(path.slice(start,i))}})}}else if(path[i]==="["){const end=path.indexOf("]",i+1);if(end<0)throw badPath(path);const p=path.slice(i+1,end);if(p==="#")parts.push({kind:"index",index:"append"});else if(/^#-\d+$/.test(p))parts.push({kind:"fromEnd",distance:Number(p.slice(2))});else if(/^\d+$/.test(p))parts.push({kind:"index",index:Number(p)});else throw badPath(path);i=end+1}else throw badPath(path)}return parts}
function editNode(root:JsonNode,parts:readonly PathPart[],value:JsonNode|undefined,mode:"set"|"insert"|"replace"|"remove"|"array_insert"):JsonNode{
 if(!parts.length)return mode==="insert"?root:value??{kind:"null"};const part=parts[0]!,rest=parts.slice(1);
 if(part.kind==="key"){
  if(root.kind!=="object")return root;const index=root.entries.findIndex(([k])=>k===part.key),entries=[...root.entries],labels=[...(jsonbLabelEncodings.get(root)??root.entries.map(([k])=>({type:7 as const,payload:te.encode(k)})))];
  if(index<0){if(mode==="replace"||mode==="remove")return root;if(rest.length)return root;entries.push([part.key,value??{kind:"null"}]);/* json.c:jsonLookupStep uses JSONB_TEXTRAW for an unquoted path label. */labels.push(part.label)}
  else if(!rest.length){if(mode==="insert")return root;if(mode==="remove"){entries.splice(index,1);labels.splice(index,1)}else entries[index]=[part.key,value??{kind:"null"}]}
  else entries[index]=[part.key,editNode(entries[index]![1],rest,value,mode)];const result:JsonNode={kind:"object",entries};jsonbLabelEncodings.set(result,labels);return result;
 }
 if(root.kind!=="array")return root;const values=[...root.values],index=part.kind==="fromEnd"?values.length-part.distance:part.index==="append"?values.length:part.index;if(index<0)return root;
 if(index===values.length&&!rest.length&&mode!=="replace"&&mode!=="remove")values.push(value??{kind:"null"});else if(index<values.length){if(!rest.length){if(mode==="insert")return root;if(mode==="array_insert")values.splice(index,0,value??{kind:"null"});else if(mode==="remove")values.splice(index,1);else values[index]=value??{kind:"null"}}else values[index]=editNode(values[index]!,rest,value,mode)}return{kind:"array",values};
}
export function jsonEdit(value:Mem,args:readonly Mem[],mode:"set"|"insert"|"replace"|"remove"|"array_insert",charge:(n:number)=>void=()=>{},blob=false):Mem{if(value.initialStorageClass==="null"){const out=new Mem();return out}let root=parseJsonMem(value,true,charge);const stride=mode==="remove"?1:2;if(args.length%stride)throw new JSQLiteError("sqlite",`json_${mode}() needs an odd number of arguments`,{code:1});for(let i=0;i<args.length;i+=stride){if(args[i]!.initialStorageClass==="null"){if(mode==="remove"){const out=new Mem();return out}continue}const parts=pathParts(args[i]!.textValue());if(mode==="remove"&&!parts.length){const out=new Mem();return out}root=editNode(root,parts,mode==="remove"?undefined:jsonNodeFromSqlValue(args[i+1]!),mode)}return blob?jsonbResult(root):jsonTextResult(root)}
function mergePatch(target:JsonNode,patch:JsonNode):JsonNode{if(patch.kind!=="object")return patch;const entries=target.kind==="object"?[...target.entries]:[];for(const [key,p] of patch.entries){let i=entries.findIndex(([k])=>k===key);if(p.kind==="null"){while(i>=0){entries.splice(i,1);i=entries.findIndex(([k])=>k===key)}continue}const merged=mergePatch(i>=0?entries[i]![1]:{kind:"null"},p);if(i>=0)entries[i]=[key,merged];else entries.push([key,merged])}return{kind:"object",entries}}
export function jsonPatch(target:Mem,patch:Mem,charge:(n:number)=>void=()=>{},blob=false):Mem{const out=new Mem();if(target.initialStorageClass==="null"||patch.initialStorageClass==="null")return out;const node=mergePatch(parseJsonMem(target,true,charge),parseJsonMem(patch,true,charge));return blob?jsonbResult(node):jsonTextResult(node)}
