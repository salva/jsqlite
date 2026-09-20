// SQL-facing subset of SQLite 3.53.4 src/printf.c:sqlite3_str_vappendf.
// Parsing, argument consumption, padding and conversions are kept here rather
// than delegated to host printf/Intl. C allocation is represented by bounded
// string accumulation at the caller.
import {JSQLiteError} from "../index.ts";
import {Mem,sqliteRealDigits} from "./mem.ts";
import {asUtf8} from "./ordinary-scalars.ts";

export interface SqliteFormatControl { readonly maxBytes:number; charge?(units:number):void; check?():void }
const utf8=new TextEncoder();
function text(v:Mem|undefined):string|null {if(!v||v.initialStorageClass==="null")return null;return v.textValue().split("\0",1)[0]!}
function integer(v:Mem|undefined):bigint {return !v||v.initialStorageClass==="null"?0n:v.integerValue()}
function real(v:Mem|undefined):number {return !v||v.initialStorageClass==="null"?0:v.realValue()}
function decimalDigits(value:number):{negative:boolean,digits:string,exponent:number}{
 const negative=value<0||Object.is(value,-0);if(value===0)return{negative,digits:"0",exponent:0};
 const decoded=sqliteRealDigits(Math.abs(value));return{negative,digits:decoded.digits,exponent:decoded.exponent};
}
function roundedDigits(digits:string,keep:number):{digits:string,carry:boolean}{
 if(keep<0)keep=0;let out=digits.slice(0,keep).padEnd(keep,"0");
 if((digits[keep]??"0")>="5"){
  let n=BigInt(out||"0")+1n;out=n.toString().padStart(keep,"0");
  if(out.length>keep)return{digits:out.slice(0,keep),carry:true};
 }
 return{digits:out,carry:false};
}
function fixed(value:number,precision:number,alternate:boolean):string{
 if(!Number.isFinite(value))return value<0?"-Inf":"Inf";
 let {negative,digits,exponent}=decimalDigits(value),keep=exponent+1+precision;
 const rounded=roundedDigits(digits,keep);if(rounded.carry){exponent++;digits=rounded.digits}else digits=rounded.digits;
 let body:string;if(exponent>=0){const before=digits.slice(0,exponent+1).padEnd(exponent+1,"0"),after=digits.slice(exponent+1).padEnd(precision,"0");body=before+(precision||alternate?"."+after:"")}else body="0"+(precision||alternate?"."+"0".repeat(-exponent-1)+digits.padEnd(Math.max(0,precision+exponent+1),"0"):"");
 return negative?"-"+body:body;
}
function exponential(value:number,precision:number,alternate:boolean,upper:boolean):string{
 if(!Number.isFinite(value))return value<0?(upper?"-INF":"-Inf"):(upper?"INF":"Inf");
 let {negative,digits,exponent}=decimalDigits(value),rounded=roundedDigits(digits,precision+1);if(rounded.carry)exponent++;digits=rounded.digits;
 const fraction=digits.slice(1).padEnd(precision,"0");const e=`${upper?"E":"e"}${exponent<0?"-":"+"}${Math.abs(exponent).toString().padStart(2,"0")}`;
 return(negative?"-":"")+digits[0]+(precision||alternate?"."+fraction:"")+e;
}
function generic(value:number,precision:number,alternate:boolean,alt2:boolean,upper:boolean):string{
 if(precision===0)precision=1;if(!Number.isFinite(value))return exponential(value,precision-1,alternate,upper).replace(/[eE].*/,"");
 const d=decimalDigits(value);let result=d.exponent<-4||d.exponent>=precision?exponential(value,precision-1,alternate||alt2,upper):fixed(value,Math.max(0,precision-d.exponent-1),alternate||alt2);
 if(!alternate){const split=result.search(/[eE]/),suffix=split<0?"":result.slice(split),head=split<0?result:result.slice(0,split);result=head.replace(/(\.\d*?)0+$/,"$1").replace(/\.$/,alt2?".0":"")+suffix}
 return result;
}
function pad(value:string,width:number,left:boolean,zero:boolean,prefixLength=0):string {const n=Math.max(0,width-[...value].length);if(!n)return value;if(left)return value+" ".repeat(n);if(zero)return value.slice(0,prefixLength)+"0".repeat(n)+value.slice(prefixLength);return" ".repeat(n)+value}
function unsigned64(n:bigint):bigint{return BigInt.asUintN(64,n)}
export function sqliteFormat(formatValue:Mem,args:readonly Mem[],control:SqliteFormatControl):string|null {
 if(formatValue.initialStorageClass==="null")return null;
 const format=new TextDecoder().decode(asUtf8(formatValue)).split("\0",1)[0]!;let used=0,result="";
 const append=(part:string)=>{const bytes=utf8.encode(part).length;if(utf8.encode(result).length+bytes>control.maxBytes)throw new JSQLiteError("limit","string or blob too big");result+=part;control.charge?.(Math.max(1,Math.ceil(bytes/256)));control.check?.()};
 for(let i=0;i<format.length;){if(format[i]!=="%"){const start=i;while(i<format.length&&format[i]!=="%")i++;append(format.slice(start,i));continue}i++;if(format[i]==="%"){append("%");i++;continue}
  let left=false,plus=false,blank=false,alternate=false,alt2=false,zero=false;for(;;i++){const c=format[i];if(c==="-")left=true;else if(c==="+")plus=true;else if(c===" ")blank=true;else if(c==="#")alternate=true;else if(c==="!")alt2=true;else if(c==="0")zero=true;else break}
  let width=0;if(format[i]==="*"){width=Number(integer(args[used++]));i++;if(width<0){left=true;width=-width}}else while(/\d/.test(format[i]??"")){width=width*10+Number(format[i++])}
  let precision=-1;if(format[i]==="."){i++;precision=0;if(format[i]==="*"){precision=Number(integer(args[used++]));i++;if(precision<0)precision=-1}else while(/\d/.test(format[i]??"")){precision=precision*10+Number(format[i++])}}
  while(format[i]==="l")i++;const conversion=format[i++];if(!conversion)break;const arg=()=>args[used++];let rendered="",numeric=false;
  if("diuoxX".includes(conversion)){numeric=true;const signed=conversion==="d"||conversion==="i",raw=integer(arg()),negative=signed&&raw<0n,n=signed?(negative?-raw:raw):unsigned64(raw),base=conversion==="o"?8:conversion.toLowerCase()==="x"?16:10;rendered=n.toString(base);if(conversion==="X")rendered=rendered.toUpperCase();if(precision===0&&n===0n)rendered="";if(precision>rendered.length)rendered="0".repeat(precision-rendered.length)+rendered;let prefix=negative?"-":plus?"+":blank?" ":"";if(alternate&&n!==0n)prefix+=conversion==="o"?"0":conversion==="x"?"0x":conversion==="X"?"0X":"";rendered=prefix+rendered;rendered=pad(rendered,width,left,zero&&precision<0,prefix.length)
  }else if("fFeEgG".includes(conversion)){numeric=true;const v=real(arg());let p=precision<0?6:Math.min(precision,100000);if(conversion.toLowerCase()==="g")p=Math.min(p,alt2?20:16);rendered=conversion.toLowerCase()==="f"?fixed(v,p,alternate||alt2):conversion.toLowerCase()==="e"?exponential(v,p,alternate||alt2,conversion===conversion.toUpperCase()):generic(v,p,alternate,alt2,conversion===conversion.toUpperCase());if(v>=0&&(plus||blank))rendered=(plus?"+":" ")+rendered;rendered=pad(rendered,width,left,zero,rendered[0]==="-"||rendered[0]==="+"||rendered[0]===" "?1:0)
  }else if(conversion==="s"||conversion==="z"){let s=text(arg())??"";if(precision>=0)s=alt2?[...s].slice(0,precision).join(""):new TextDecoder().decode(utf8.encode(s).slice(0,precision));rendered=pad(s,width,left,false)
  }else if(conversion==="c"){const s=text(arg())??"\0",one=[...s][0]??"\0";rendered=one.repeat(precision>0?precision:1);rendered=pad(rendered,width,left,false)
  }else if(conversion==="q"||conversion==="Q"||conversion==="w"){const v=arg(),nullArg=!v||v.initialStorageClass==="null";let s=nullArg?(conversion==="Q"?"NULL":"(NULL)"):text(v)!;if(precision>=0)s=alt2?[...s].slice(0,precision).join(""):new TextDecoder().decode(utf8.encode(s).slice(0,precision));const quote=conversion==="w"?'"':"'";s=s.replaceAll(quote,quote+quote);if(conversion==="Q"&&!nullArg)s=`'${s}'`;rendered=pad(s,width,left,false)
  }else if(conversion==="p"){rendered="0x"+unsigned64(integer(arg())).toString(16);rendered=pad(rendered,width,left,zero,2)
  }else if(conversion==="n"){continue}else break;
  if(numeric||rendered)append(rendered);
 }
 return result;
}
export function sqliteRound(value:Mem,digits?:Mem):number|null {
 if(value.initialStorageClass==="null"||digits?.initialStorageClass==="null")return null;let n=digits?Number(digits.integerValue()):0;n=Math.max(0,Math.min(30,n));let r=value.realValue();if(r < -4503599627370496 || r > 4503599627370496)return r;if(n===0)return Math.trunc(r+(r<0?-0.5:0.5));return Number(fixed(r,n,true));
}
