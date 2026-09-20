import {Mem} from "./mem.ts";
import type {DatabaseEncoding} from "./record.ts";

// func.c:ceilingFunc/logFunc/math1Func/math2Func/piFunc. JS Math is the
// browser-safe libm adaptation; conversion, domains, result class, NaN-to-NULL
// and infinity remain controlled by the translated wrappers here.
const unaryNames=new Set(["exp","acos","asin","atan","cos","sin","tan","cosh","sinh","tanh","acosh","asinh","atanh","sqrt","radians","degrees"]);
const binaryNames=new Set(["pow","power","mod","atan2"]);
export function isMathFunction(name:string):boolean{return unaryNames.has(name)||binaryNames.has(name)||["ceil","ceiling","floor","trunc","ln","log","log10","log2","pi"].includes(name)}
function numeric(value:Mem,encoding:DatabaseEncoding):Mem|null{const copy=new Mem();copy.copyFrom(value);if(copy.initialStorageClass==="text")copy.applyAffinity("numeric",encoding);return copy.initialStorageClass==="integer"||copy.initialStorageClass==="real"?copy:null}
function real(value:Mem):number{return value.initialStorageClass==="integer"?Number(value.integerValue()):value.realValue()}
function result(value:number):Mem{const out=new Mem();out.setDouble(value);return out}
function unary(name:string,x:number):number{switch(name){case"exp":return Math.exp(x);case"acos":return Math.acos(x);case"asin":return Math.asin(x);case"atan":return Math.atan(x);case"cos":return Math.cos(x);case"sin":return Math.sin(x);case"tan":return Math.tan(x);case"cosh":return Math.cosh(x);case"sinh":return Math.sinh(x);case"tanh":return Math.tanh(x);case"acosh":return Math.acosh(x);case"asinh":return Math.asinh(x);case"atanh":return Math.atanh(x);case"sqrt":return Math.sqrt(x);case"radians":return x*(Math.PI/180);case"degrees":return x*(180/Math.PI);default:return Number.NaN}}
export function evaluateMathFunction(name:string,args:readonly Mem[],encoding:DatabaseEncoding):Mem{
 const out=new Mem();if(name==="pi"){out.setDouble(Math.PI);return out}
 const first=numeric(args[0]!,encoding);if(!first)return out;
 if(name==="ceil"||name==="ceiling"||name==="floor"||name==="trunc"){if(first.initialStorageClass==="integer"){out.setInt64(first.integerValue());return out}return result((name==="ceil"||name==="ceiling")?Math.ceil(first.realValue()):name==="floor"?Math.floor(first.realValue()):Math.trunc(first.realValue()))}
 const x=real(first);
 if(name==="ln"||name==="log"||name==="log10"||name==="log2"){
  if(x<=0)return out;
  if(name==="log"&&args.length===2){const denominator=Math.log(x);if(denominator<=0)return out;const second=numeric(args[1]!,encoding);if(!second)return out;const y=real(second);if(y<=0)return out;return result(Math.log(y)/denominator)}
  return result(name==="ln"?Math.log(x):name==="log2"?Math.log2(x):Math.log10(x));
 }
 if(unaryNames.has(name))return result(unary(name,x));
 const second=numeric(args[1]!,encoding);if(!second)return out;const y=real(second);
 if(name==="pow"||name==="power")return result(Math.pow(x,y));if(name==="atan2")return result(Math.atan2(x,y));return result(x%y);
}
