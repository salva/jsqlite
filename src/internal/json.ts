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

const te=new TextEncoder(),td=new TextDecoder("utf-8",{fatal:true});
const malformed=()=>new JSQLiteError("sqlite","malformed JSON",{code:1});
class Parser {
  #i=0; #depth=0;
  readonly s:string; readonly json5:boolean; readonly charge:(n:number)=>void;
  constructor(s:string,json5:boolean,charge:(n:number)=>void){this.s=s;this.json5=json5;this.charge=charge}
  parse():JsonNode{this.ws();const n=this.value();this.ws();if(this.#i!==this.s.length)throw malformed();return n}
  ws():void{for(;;){while(/[\t\n\r ]/.test(this.s[this.#i]??""))this.#i++;if(!this.json5||this.s[this.#i]!=="/")return;if(this.s[this.#i+1]==="/"){this.#i+=2;while(this.#i<this.s.length&&!/[\r\n]/.test(this.s[this.#i]!))this.#i++;continue}if(this.s[this.#i+1]==="*"){const e=this.s.indexOf("*/",this.#i+2);if(e<0)throw malformed();this.#i=e+2;continue}return}}
  value():JsonNode{this.charge(1);if(++this.#depth>1000)throw malformed();this.ws();const c=this.s[this.#i];let n:JsonNode;if(c==='"'||(this.json5&&c==="'"))n={kind:"string",value:this.str()};else if(c==="[")n=this.array();else if(c==="{")n=this.object();else {const start=this.#i;while(this.#i<this.s.length&&!/[\s,\]}]/.test(this.s[this.#i]!))this.#i++;const raw=this.s.slice(start,this.#i);if(raw==="null"||raw==="true"||raw==="false")n={kind:raw};else if(this.number(raw))n={kind:"number",raw,json5:!this.strictNumber(raw)};else throw malformed()}this.#depth--;return n}
  strictNumber(x:string):boolean{return /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(x)}
  number(x:string):boolean{return this.strictNumber(x)||(this.json5&&/^[+-]?(?:Infinity|NaN|0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/.test(x))}
  str():string{const q=this.s[this.#i++]!,out:string[]=[];while(this.#i<this.s.length){const c=this.s[this.#i++]!;if(c===q)return out.join("");if(c==='\n'||c==='\r'||c.charCodeAt(0)<0x20)throw malformed();if(c!=="\\"){out.push(c);continue}if(this.#i>=this.s.length)throw malformed();const e=this.s[this.#i++]!;const simple:{[k:string]:string}={"\"":"\"","'":"'","\\":"\\","/":"/",b:"\b",f:"\f",n:"\n",r:"\r",t:"\t"};if(e in simple){out.push(simple[e]!);continue}if(e==="u"){const h=this.s.slice(this.#i,this.#i+4);if(!/^[0-9a-fA-F]{4}$/.test(h))throw malformed();this.#i+=4;out.push(String.fromCharCode(parseInt(h,16)));continue}if(this.json5&&e==="x"){const h=this.s.slice(this.#i,this.#i+2);if(!/^[0-9a-fA-F]{2}$/.test(h))throw malformed();this.#i+=2;out.push(String.fromCharCode(parseInt(h,16)));continue}if(this.json5&&(e==='\n'||e==='\r')){if(e==='\r'&&this.s[this.#i]==='\n')this.#i++;continue}if(this.json5){out.push(e);continue}throw malformed()}throw malformed()}
  array():JsonNode{this.#i++;const values:JsonNode[]=[];this.ws();if(this.s[this.#i]==="]"){this.#i++;return{kind:"array",values}}for(;;){values.push(this.value());this.ws();if(this.s[this.#i]==="]"){this.#i++;return{kind:"array",values}}if(this.s[this.#i++]!==",")throw malformed();this.ws();if(this.s[this.#i]==="]"){if(!this.json5)throw malformed();this.#i++;return{kind:"array",values}}}}
  object():JsonNode{this.#i++;const entries:(readonly[string,JsonNode])[]=[];this.ws();if(this.s[this.#i]==="}"){this.#i++;return{kind:"object",entries}}for(;;){this.ws();let key:string;const c=this.s[this.#i];if(c==='"'||(this.json5&&c==="'"))key=this.str();else if(this.json5){const m=/^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.s.slice(this.#i));if(!m)throw malformed();key=m[0];this.#i+=key.length}else throw malformed();this.ws();if(this.s[this.#i++]!==":")throw malformed();entries.push([key,this.value()]);this.ws();if(this.s[this.#i]==="}"){this.#i++;return{kind:"object",entries}}if(this.s[this.#i++]!==",")throw malformed();this.ws();if(this.s[this.#i]==="}"){if(!this.json5)throw malformed();this.#i++;return{kind:"object",entries}}}}
}
function canonicalNumber(raw:string):string{if(/NaN/.test(raw))return"null";if(/Infinity/.test(raw))return raw[0]==="-"?"-9e999":"9e999";if(/^[+-]?0[xX]/.test(raw)){const negative=raw[0]==="-",body=raw.replace(/^[+-]?0[xX]/,"");const n=BigInt(`0x${body}`);return `${negative?"-":""}${n}`}return raw[0]==="+"?raw.slice(1):raw.startsWith(".")?`0${raw}`:raw.startsWith("-.")?`-0${raw.slice(1)}`:raw.endsWith(".")?`${raw}0`:raw}
function quote(s:string):string{let out='"';for(const c of s){const n=c.charCodeAt(0);out+=c==='"'?'\\"':c==='\\'?'\\\\':c==='\b'?'\\b':c==='\f'?'\\f':c==='\n'?'\\n':c==='\r'?'\\r':c==='\t'?'\\t':n<0x20?`\\u${n.toString(16).padStart(4,"0")}`:c}return out+'"'}
export function renderJson(n:JsonNode):string{switch(n.kind){case"null":case"true":case"false":return n.kind;case"number":return canonicalNumber(n.raw);case"string":return quote(n.value);case"array":return`[${n.values.map(renderJson).join(",")}]`;case"object":return`{${n.entries.map(([k,v])=>`${quote(k)}:${renderJson(v)}`).join(",")}}`}}
function header(type:number,size:number):Uint8Array{if(size<=11)return Uint8Array.of((size<<4)|type);if(size<=255)return Uint8Array.of(0xc0|type,size);if(size<=65535)return Uint8Array.of(0xd0|type,size>>>8,size&255);return Uint8Array.of(0xe0|type,(size/0x1000000)>>>0,(size>>>16)&255,(size>>>8)&255,size&255)}
function join(parts:readonly Uint8Array[]):Uint8Array{const n=parts.reduce((x,p)=>x+p.length,0),out=new Uint8Array(n);let i=0;for(const p of parts){out.set(p,i);i+=p.length}return out}
function element(type:number,payload:Uint8Array<ArrayBufferLike>=new Uint8Array()):Uint8Array{return join([header(type,payload.length),payload])}
export function encodeJsonb(n:JsonNode):Uint8Array{switch(n.kind){case"null":return element(0);case"true":return element(1);case"false":return element(2);case"number":{if(/NaN/.test(n.raw))return element(0);if(/^[+-]?0[xX]/.test(n.raw))return element(4,te.encode(n.raw));const raw=canonicalNumber(n.raw),json5=n.json5&&(/^[-.]|\.$/.test(n.raw));return element(/^-?\d+$/.test(raw)?3:json5?6:5,te.encode(json5?n.raw:raw))}case"string":return element(7,te.encode(n.value));case"array":return element(11,join(n.values.map(encodeJsonb)));case"object":return element(12,join(n.entries.flatMap(([k,v])=>[element(7,te.encode(k)),encodeJsonb(v)])))}}
function jsonbSize(b:Uint8Array,at=0):{size:number,type:number,header:number}|null{if(at>=b.length)return null;const x=b[at]!,tag=x>>>4,type=x&15;let header=1,size=tag;if(tag>=12){header=tag===12?2:tag===13?3:tag===14?5:9;if(at+header>b.length)return null;size=0;for(let i=1;i<header;i++){size=size*256+b[at+i]!;if(!Number.isSafeInteger(size))return null}}return{size,type,header}}
function decodePayload(b:Uint8Array,start:number,end:number):string{try{return td.decode(b.subarray(start,end))}catch{throw malformed()}}
function decodeJsonbAt(b:Uint8Array,at:number,depth:number,charge:(n:number)=>void):{node:JsonNode;end:number}{
 charge(1);if(depth>1000)throw malformed();const h=jsonbSize(b,at);if(!h||h.type>12||at+h.header+h.size>b.length)throw malformed();const start=at+h.header,end=start+h.size,raw=decodePayload(b,start,end);
 if(h.type<=2){if(h.size)throw malformed();return{node:{kind:h.type===0?"null":h.type===1?"true":"false"},end}}
 if(h.type>=3&&h.type<=6){const json5=h.type===4||h.type===6,node=new Parser(raw,json5,charge).parse();if(node.kind!=="number")throw malformed();return{node,end}}
 if(h.type>=7&&h.type<=10){let value:string;if(h.type===7||h.type===10)value=raw;else{const node=new Parser(`"${raw}"`,h.type===9,charge).parse();if(node.kind!=="string")throw malformed();value=node.value}return{node:{kind:"string",value},end}}
 const values:JsonNode[]=[],entries:(readonly[string,JsonNode])[]=[];let p=start,index=0;while(p<end){const child=decodeJsonbAt(b,p,depth+1,charge);p=child.end;if(h.type===11)values.push(child.node);else if((index++&1)===0){if(child.node.kind!=="string")throw malformed();entries.push([child.node.value,{kind:"null"}])}else entries[entries.length-1]=[entries.at(-1)![0],child.node]}if(p!==end||(h.type===12&&index%2))throw malformed();return{node:h.type===11?{kind:"array",values}:{kind:"object",entries},end}
}
function validJsonb(b:Uint8Array,deep:boolean,at=0,depth=0):number{const h=jsonbSize(b,at);if(!h||h.type>12||at+h.header+h.size>b.length||depth>1000)return-1;const end=at+h.header+h.size;if(!deep)return end;try{return decodeJsonbAt(b,at,depth,()=>{}).end}catch{return-1}}
export function parseJsonMem(value:Mem,json5=true,charge:(n:number)=>void=()=>{}):JsonNode{if(value.initialStorageClass==="null")throw malformed();if(value.initialStorageClass==="blob"){const b=value.blobValue(),decoded=decodeJsonbAt(b,0,0,charge);if(decoded.end!==b.length)throw malformed();return decoded.node}return new Parser(value.textValue(),json5,charge).parse()}
export function jsonValid(value:Mem,flags:number,charge:(n:number)=>void=()=>{}):boolean{if(flags<1||flags>15)throw new JSQLiteError("sqlite","FLAGS parameter to json_valid() must be between 1 and 15",{code:1});try{if(value.initialStorageClass==="blob"){const b=value.blobValue();return ((flags&4)!==0&&validJsonb(b,false)===b.length)||((flags&8)!==0&&validJsonb(b,true)===b.length)}if((flags&3)===0)return false;new Parser(value.textValue(),(flags&2)!==0,charge).parse();return true}catch{return false}}
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
    const parsed=new Parser(path.slice(start,i),false,()=>{}).parse();
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

/** src/json.c JsonEachCursor/jsonEachColumn, non-recursive xFilter/xNext slice.
 * IDs are offsets in SQLite's canonical JSONB parse image, not ordinals. */
export function jsonEachRows(value:Mem,charge:(n:number)=>void=()=>{},rootPath="$",binaryContainers=false):readonly (readonly Mem[])[]{return jsonTableRows(value,false,charge,rootPath,binaryContainers)}
export function jsonTreeRows(value:Mem,charge:(n:number)=>void=()=>{},rootPath="$",binaryContainers=false):readonly (readonly Mem[])[]{return jsonTableRows(value,true,charge,rootPath,binaryContainers)}

/** src/json.c JsonEachCursor/jsonEachFilter/jsonEachNext/jsonEachColumn traversal.
 * The recursive mode retains JSONB byte offsets as ids and parent ids. */
function jsonTableRows(value:Mem,recursive:boolean,charge:(n:number)=>void,rootPath:string,binaryContainers:boolean):readonly (readonly Mem[])[]{
 if(value.initialStorageClass==="null")return Object.freeze([]);
 const document=value.initialStorageClass==="blob"?(()=>{const b=value.blobValue(),decoded=decodeJsonbUnchecked(b);if(decoded.next!==b.length)throw malformed();return decoded.node})():parseJsonMem(value,true,charge);
 const selected=jsonLookup(document,rootPath);if(selected===undefined)return Object.freeze([]);
 const size=(node:JsonNode):number=>encodeJsonb(node).length;
 let selectedId=0;
 const locate=(node:JsonNode,id:number):boolean=>{if(node===selected){selectedId=id;return true}let offset=id+1;if(node.kind==="array")for(const child of node.values){if(locate(child,offset))return true;offset+=size(child)}else if(node.kind==="object")for(const [label,child] of node.entries){if(locate(child,offset))return true;offset+=encodeJsonb({kind:"string",value:label}).length+size(child)}return false};locate(document,0);
 const root=selected;
 const text=(s:string):Mem=>{const m=new Mem();m.setText(te.encode(s),"utf-8");return m};
 const integer=(n:bigint):Mem=>{const m=new Mem();m.setInt64(n);return m};
 const nil=():Mem=>{const m=new Mem();m.setNull();return m};
 const valueResult=(node:JsonNode):Mem=>node.kind==="array"||node.kind==="object"?(binaryContainers?jsonbResult(node):jsonTextResult(node)):scalarResult(node);
 const type=(node:JsonNode):string=>node.kind==="true"||node.kind==="false"?node.kind:node.kind==="number"?(/^-?\d+$/.test(canonicalNumber(node.raw))?"integer":"real"):node.kind;
 const row=(key:Mem,node:JsonNode,id:number,parent:number|null,fullkey:string,path:string):readonly Mem[]=>Object.freeze([key,valueResult(node),text(type(node)),node.kind==="array"||node.kind==="object"?nil():scalarResult(node),integer(BigInt(id)),parent===null?nil():integer(BigInt(parent)),text(fullkey),text(path),value,text(rootPath)]);
 const rows:(readonly Mem[])[]=[];
 const walk=(node:JsonNode,id:number,parent:number|null,key:Mem,fullkey:string,path:string):void=>{
  rows.push(row(key,node,id,parent,fullkey,path));if(!recursive)return;
  let offset=id+1;
  if(node.kind==="array")for(let i=0;i<node.values.length;i++){const child=node.values[i]!,childPath=`${fullkey}[${i}]`;walk(child,offset,id,integer(BigInt(i)),childPath,fullkey);offset+=size(child)}
  else if(node.kind==="object")for(const [label,child] of node.entries){const labelBytes=encodeJsonb({kind:"string",value:label}),childId=offset,childPath=/^[A-Za-z][A-Za-z0-9]*$/.test(label)?`${fullkey}.${label}`:`${fullkey}.${quote(label)}`;walk(child,childId,id,text(label),childPath,fullkey);offset+=labelBytes.length+size(child)}
 };
 if(recursive){walk(root,selectedId,null,nil(),rootPath,rootPath);return Object.freeze(rows)}
 if(root.kind!=="array"&&root.kind!=="object")return Object.freeze([row(nil(),root,selectedId,null,rootPath,rootPath)]);
 let offset=selectedId+1;
 if(root.kind==="array")for(let i=0;i<root.values.length;i++){const node=root.values[i]!;rows.push(row(integer(BigInt(i)),node,offset,null,`${rootPath}[${i}]`,rootPath));offset+=size(node)}
 else for(const [key,node] of root.entries){const label=encodeJsonb({kind:"string",value:key});const id=offset;const simple=/^[A-Za-z][A-Za-z0-9]*$/.test(key);rows.push(row(text(key),node,id,null,simple?`${rootPath}.${key}`:`${rootPath}.${quote(key)}`,rootPath));offset+=label.length+size(node)}
 return Object.freeze(rows);
}

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
export function jsonConstruct(kind:"array"|"object",values:readonly Mem[]):Mem{
 if(kind==="array")return jsonTextResult({kind:"array",values:values.map(jsonNodeFromSqlValue)});
 if(values.length%2)throw new JSQLiteError("sqlite","json_object() labels must be TEXT",{code:1});
 const entries:(readonly[string,JsonNode])[]=[];for(let i=0;i<values.length;i+=2){const key=values[i]!;if(key.initialStorageClass==="null")throw new JSQLiteError("sqlite","json_object() labels must be TEXT",{code:1});entries.push([key.textValue(),jsonNodeFromSqlValue(values[i+1]!)])}return jsonTextResult({kind:"object",entries});
}
const jsonTypeName=(node:JsonNode):string=>node.kind==="number"?(/^-?\d+$/.test(canonicalNumber(node.raw))?"integer":"real"):node.kind;
export function jsonType(value:Mem,path?:Mem,charge:(n:number)=>void=()=>{}):Mem{const out=new Mem();if(value.initialStorageClass==="null"||path?.initialStorageClass==="null")return out;const root=parseJsonMem(value,true,charge),node=path?jsonLookup(root,path.textValue()):root;if(node)out.setText(te.encode(jsonTypeName(node)),"utf-8");return out}
export function jsonArrayLength(value:Mem,path?:Mem,charge:(n:number)=>void=()=>{}):Mem{const out=new Mem();if(value.initialStorageClass==="null"||path?.initialStorageClass==="null")return out;const root=parseJsonMem(value,true,charge),node=path?jsonLookup(root,path.textValue()):root;if(!node)return out;out.setInt64(BigInt(node.kind==="array"?node.values.length:0));return out}
export function jsonErrorPosition(value:Mem):Mem{const out=new Mem();if(value.initialStorageClass==="null"){out.setNull();return out}try{parseJsonMem(value,true);out.setInt64(0n)}catch{out.setInt64(1n)}return out}

type PathPart={kind:"key";key:string}|{kind:"index";index:number|"append"};
function pathParts(path:string):PathPart[]{if(!path.startsWith("$"))throw badPath(path);const parts:PathPart[]=[];let i=1;while(i<path.length){if(path[i]==="."){i++;if(path[i]==='"'){const start=i++;while(i<path.length&&path[i]!=='"'){if(path[i]==="\\")i++;i++}if(path[i]!== '"')throw badPath(path);i++;const n=new Parser(path.slice(start,i),false,()=>{}).parse();if(n.kind!=="string")throw badPath(path);parts.push({kind:"key",key:n.value})}else{const start=i;while(i<path.length&&!".[".includes(path[i]!))i++;if(start===i)throw badPath(path);parts.push({kind:"key",key:path.slice(start,i)})}}else if(path[i]==="["){const end=path.indexOf("]",i+1);if(end<0)throw badPath(path);const p=path.slice(i+1,end);if(p==="#")parts.push({kind:"index",index:"append"});else if(/^\d+$/.test(p))parts.push({kind:"index",index:Number(p)});else throw badPath(path);i=end+1}else throw badPath(path)}return parts}
function editNode(root:JsonNode,parts:readonly PathPart[],value:JsonNode|undefined,mode:"set"|"insert"|"replace"|"remove"):JsonNode{
 if(!parts.length)return mode==="insert"?root:value??{kind:"null"};const part=parts[0]!,rest=parts.slice(1);
 if(part.kind==="key"){
  if(root.kind!=="object")return root;const index=root.entries.findIndex(([k])=>k===part.key),entries=[...root.entries];
  if(index<0){if(mode==="replace"||mode==="remove")return root;if(rest.length)return root;entries.push([part.key,value??{kind:"null"}])}
  else if(!rest.length){if(mode==="insert")return root;if(mode==="remove")entries.splice(index,1);else entries[index]=[part.key,value??{kind:"null"}]}
  else entries[index]=[part.key,editNode(entries[index]![1],rest,value,mode)];return{kind:"object",entries};
 }
 if(root.kind!=="array")return root;const values=[...root.values],index=part.index==="append"?values.length:part.index;
 if(index===values.length&&!rest.length&&mode!=="replace"&&mode!=="remove")values.push(value??{kind:"null"});else if(index<values.length){if(!rest.length){if(mode==="insert")return root;if(mode==="remove")values.splice(index,1);else values[index]=value??{kind:"null"}}else values[index]=editNode(values[index]!,rest,value,mode)}return{kind:"array",values};
}
export function jsonEdit(value:Mem,args:readonly Mem[],mode:"set"|"insert"|"replace"|"remove",charge:(n:number)=>void=()=>{}):Mem{if(value.initialStorageClass==="null"){const out=new Mem();return out}let root=parseJsonMem(value,true,charge);const stride=mode==="remove"?1:2;if(args.length%stride)throw new JSQLiteError("sqlite",`json_${mode}() needs an odd number of arguments`,{code:1});for(let i=0;i<args.length;i+=stride){if(args[i]!.initialStorageClass==="null"){const out=new Mem();return out}root=editNode(root,pathParts(args[i]!.textValue()),mode==="remove"?undefined:jsonNodeFromSqlValue(args[i+1]!),mode)}return jsonTextResult(root)}
function mergePatch(target:JsonNode,patch:JsonNode):JsonNode{if(patch.kind!=="object")return patch;const entries=target.kind==="object"?[...target.entries]:[];for(const [key,p] of patch.entries){let i=entries.findIndex(([k])=>k===key);if(p.kind==="null"){while(i>=0){entries.splice(i,1);i=entries.findIndex(([k])=>k===key)}continue}const merged=mergePatch(i>=0?entries[i]![1]:{kind:"null"},p);if(i>=0)entries[i]=[key,merged];else entries.push([key,merged])}return{kind:"object",entries}}
export function jsonPatch(target:Mem,patch:Mem,charge:(n:number)=>void=()=>{}):Mem{const out=new Mem();if(target.initialStorageClass==="null"||patch.initialStorageClass==="null")return out;return jsonTextResult(mergePatch(parseJsonMem(target,true,charge),parseJsonMem(patch,true,charge)))}
