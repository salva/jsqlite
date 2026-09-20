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
function ordinal(n:bigint):string {const magnitude=n<0n?-n:n,x=Number(magnitude%10n),teen=Number((magnitude/10n)%10n)===1;return teen||x<1||x>3?"th":x===1?"st":x===2?"nd":"rd"}
function unsigned64(n:bigint):bigint{return BigInt.asUintN(64,n)}
export function sqliteFormat(formatValue:Mem,args:readonly Mem[],control:SqliteFormatControl):string|null {
 if(formatValue.initialStorageClass==="null")return null;
 const format=new TextDecoder().decode(asUtf8(formatValue)).split("\0",1)[0]!;let used=0,result="",resultBytes=0;
 const fail=():never=>{throw new JSQLiteError("limit","string or blob too big")};
 const admit=(bytes:number)=>{if(!Number.isSafeInteger(bytes)||bytes<0||bytes>control.maxBytes-resultBytes)fail()};
 const repeat=(unit:string,count:number)=>{const unitBytes=utf8.encode(unit).length;if(!Number.isSafeInteger(count)||count<0||count>Math.floor((control.maxBytes-resultBytes)/unitBytes))fail();control.charge?.(Math.max(1,Math.ceil(count*unitBytes/256)));control.check?.();return unit.repeat(count)};
 const append=(part:string)=>{const bytes=utf8.encode(part).length;admit(bytes);result+=part;resultBytes+=bytes;control.charge?.(Math.max(1,Math.ceil(bytes/256)));control.check?.()};
 const pad=(value:string,width:number,left:boolean,zero:boolean,prefixLength=0,displayBytes=true):string=>{const length=displayBytes?utf8.encode(value).length:[...value].length,n=Math.max(0,width-length);if(!n)return value;admit(utf8.encode(value).length+n);const padding=repeat(zero?"0":" ",n);if(left)return value+padding;if(zero)return value.slice(0,prefixLength)+padding+value.slice(prefixLength);return padding+value};
 const boundedDimension=(value:number)=>{if(!Number.isSafeInteger(value)||value<0||value>control.maxBytes-resultBytes)fail();return value};
 for(let i=0;i<format.length;){if(format[i]!=="%"){const start=i;while(i<format.length&&format[i]!=="%")i++;append(format.slice(start,i));continue}i++;if(i===format.length){append("%");break}if(format[i]==="%"){append("%");i++;continue}
  let left=false,plus=false,blank=false,alternate=false,alt2=false,zero=false,comma=false;for(;;i++){const c=format[i];if(c==="-")left=true;else if(c==="+")plus=true;else if(c===" ")blank=true;else if(c==="#")alternate=true;else if(c==="!")alt2=true;else if(c==="0")zero=true;else if(c===",")comma=true;else break}
  let width=0;if(format[i]==="*"){let dynamic=Number(integer(args[used++]));i++;if(dynamic<0){left=true;dynamic=dynamic>=-2147483647?-dynamic:0}width=boundedDimension(dynamic)}else {while(/\d/.test(format[i]??"")){const digit=Number(format[i++]);if(width>Math.floor((control.maxBytes-resultBytes-digit)/10))fail();width=width*10+digit}boundedDimension(width)}
  let precision=-1;if(format[i]==="."){i++;precision=0;if(format[i]==="*"){precision=Number(integer(args[used++]));i++;if(precision<0)precision=precision>=-2147483647?-precision:-1}else while(/\d/.test(format[i]??"")){const digit=Number(format[i++]);if(precision>Math.floor((control.maxBytes-resultBytes-digit)/10))fail();precision=precision*10+digit}if(precision>=0)boundedDimension(precision)}
  while(format[i]==="l")i++;const conversion=format[i++];if(!conversion)break;const arg=()=>args[used++];let rendered="",numeric=false;
  if("diuoxXr".includes(conversion)){numeric=true;const signed=conversion==="d"||conversion==="i"||conversion==="r",raw=integer(arg()),negative=signed&&raw<0n,n=signed?(negative?-raw:raw):unsigned64(raw),base=conversion==="o"?8:conversion.toLowerCase()==="x"?16:10;rendered=n.toString(base)+(conversion==="r"?ordinal(n):"");if(conversion==="X")rendered=rendered.toUpperCase();if(precision===0&&n===0n)rendered="";if(precision>rendered.length){admit(precision+3);rendered=repeat("0",precision-rendered.length)+rendered}if(comma&&conversion!=="r"&&(conversion==="d"||conversion==="i"||conversion==="u")){const groups=Math.floor((rendered.length-1)/3);admit(rendered.length+groups);let grouped="";for(let at=0;at<rendered.length;at++){if(at&&((rendered.length-at)%3===0))grouped+=",";grouped+=rendered[at]}rendered=grouped}let prefix=negative?"-":plus?"+":blank?" ":"";if(alternate&&n!==0n)prefix+=conversion==="o"?"0":conversion==="x"?"0x":conversion==="X"?"0X":"";rendered=prefix+rendered;rendered=pad(rendered,width,left,zero&&precision<0,prefix.length)
  }else if("fFeEgG".includes(conversion)){numeric=true;const v=real(arg());let p=precision<0?6:Math.min(precision,100000);if(conversion.toLowerCase()==="g")p=Math.min(p,alt2?20:16);boundedDimension(Math.max(width,p));const upper=conversion===conversion.toUpperCase(),kind=conversion.toLowerCase();if(Number.isFinite(v)){const exponent=decimalDigits(v).exponent,temporary=kind==="f"?Math.max(exponent+1,1)+p+12:p+16;admit(Math.max(width,temporary))}if(Number.isNaN(v))rendered=zero?"null":"NaN";else if(!Number.isFinite(v)&&!zero)rendered=(v<0?"-":plus?"+":blank?" ":"")+(upper?"INF":"Inf");else if(!Number.isFinite(v)){const sign=v<0?"-":plus?"+":blank?" ":"",magnitude=kind==="e"?`9${p||alternate||alt2?"."+repeat("0",p):""}${upper?"E":"e"}+999`:kind==="g"?`9${p>1?"."+repeat("0",p-1):""}${upper?"E":"e"}+999`:`9${repeat("0",999)}${p||alternate||alt2?"."+repeat("0",p):""}`;rendered=sign+magnitude}else{rendered=kind==="f"?fixed(v,p,alternate||alt2):kind==="e"?exponential(v,p,alternate||alt2,upper):generic(v,p,alternate,alt2,upper);if(v>=0&&(plus||blank))rendered=(plus?"+":" ")+rendered}if(comma&&kind==="f"){const sign=/^[+ -]/.test(rendered)?rendered[0]:"",rest=sign?rendered.slice(1):rendered,[whole="",...tail]=rest.split("."),groups=Math.floor((whole.length-1)/3);admit(rendered.length+groups);rendered=sign+whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")+(tail.length?"."+tail:"")}rendered=pad(rendered,width,left,zero,rendered[0]==="-"||rendered[0]==="+"||rendered[0]===" "?1:0)
  }else if(conversion==="s"||conversion==="z"){let s=text(arg())??"";if(precision>=0)s=alt2?[...s].slice(0,precision).join(""):new TextDecoder().decode(utf8.encode(s).slice(0,precision));rendered=pad(s,width,left,false,0,!alt2)
  }else if(conversion==="c"){const s=text(arg())??"\0",one=[...s][0]??"\0",count=precision>0?precision:1;admit(utf8.encode(one).length*count);rendered=repeat(one,count);rendered=pad(rendered,width,left,false,0,false)
  }else if(conversion==="q"||conversion==="Q"||conversion==="w"){const v=arg(),nullArg=!v||v.initialStorageClass==="null";let value=nullArg?(conversion==="Q"?"NULL":"(NULL)"):text(v)!;if(precision>=0)value=alt2?[...value].slice(0,precision).join(""):new TextDecoder().decode(utf8.encode(value).slice(0,precision));const quote=conversion==="w"?'"':"'",extra=value.split(quote).length-1;admit(utf8.encode(value).length+extra+(conversion==="Q"&&!nullArg?2:0));value=value.replaceAll(quote,quote+quote);if(conversion==="Q"&&!nullArg)value=`'${value}'`;rendered=pad(value,width,left,false,0,!alt2)
  }else if(conversion==="p"){rendered="0x"+unsigned64(integer(arg())).toString(16);rendered=pad(rendered,width,left,zero,2)
  }else if(conversion==="n"){continue}else break;
  if(numeric||rendered)append(rendered);
 }
 return result;
}
export function sqliteRound(value:Mem,digits?:Mem):number|null {
 if(value.initialStorageClass==="null"||digits?.initialStorageClass==="null")return null;let n=digits?Number(digits.integerValue()):0;n=Math.max(0,Math.min(30,n));let r=value.realValue();if(r < -4503599627370496 || r > 4503599627370496)return r;if(n===0)return Math.trunc(r+(r<0?-0.5:0.5));return Number(fixed(r,n,true));
}
