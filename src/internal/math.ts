import {Mem} from "./mem.ts";
import type {DatabaseEncoding} from "./record.ts";

// func.c:ceilingFunc/logFunc/math1Func/math2Func/piFunc. JS Math is the
// browser-safe libm adaptation; conversion, domains, result class, NaN-to-NULL
// and infinity remain controlled by the translated wrappers here.
const roundingNames=new Set(["ceil","ceiling","floor","trunc"]);
const logNames=new Set(["ln","log","log10","log2"]);
const unaryCallbacks:Readonly<Record<string,(value:number)=>number>>=Object.freeze({
 exp:Math.exp,
 acos:Math.acos,
 asin:Math.asin,
 atan:Math.atan,
 cos:Math.cos,
 sin:Math.sin,
 tan:Math.tan,
 cosh:Math.cosh,
 sinh:Math.sinh,
 tanh:Math.tanh,
 acosh:Math.acosh,
 asinh:Math.asinh,
 atanh:Math.atanh,
 sqrt:Math.sqrt,
 radians:(value)=>value*(Math.PI/180),
 degrees:(value)=>value*(180/Math.PI),
});
const binaryCallbacks:Readonly<Record<string,(left:number,right:number)=>number>>=Object.freeze({
 pow:Math.pow,
 power:Math.pow,
 mod:(left,right)=>left%right,
 atan2:Math.atan2,
});

export function isMathFunction(name:string):boolean {
 return name==="pi"||roundingNames.has(name)||logNames.has(name)
  ||Object.hasOwn(unaryCallbacks,name)||Object.hasOwn(binaryCallbacks,name);
}

function numeric(value:Mem,encoding:DatabaseEncoding):Mem|null {
 const copy=new Mem();
 copy.copyFrom(value);
 // sqlite3_value_numeric_type converts only wholly numeric TEXT. BLOB and
 // nonnumeric/prefix TEXT retain their storage class and reject below.
 if(copy.initialStorageClass==="text")copy.applyAffinity("numeric",encoding);
 return copy.initialStorageClass==="integer"||copy.initialStorageClass==="real"?copy:null;
}
function real(value:Mem):number {
 return value.initialStorageClass==="integer"?Number(value.integerValue()):value.realValue();
}
function realResult(value:number):Mem {
 const result=new Mem();
 result.setDouble(value); // sqlite3VdbeMemSetDouble maps NaN to NULL.
 return result;
}

export function evaluateMathFunction(name:string,args:readonly Mem[],encoding:DatabaseEncoding):Mem {
 const result=new Mem();
 if(name==="pi"){
  result.setDouble(Math.PI);
  return result;
 }
 const first=numeric(args[0]!,encoding);
 if(!first)return result;
 if(roundingNames.has(name)){
  // ceilingFunc uniquely preserves an INTEGER input rather than returning REAL.
  if(first.initialStorageClass==="integer"){
   result.setInt64(first.integerValue());
   return result;
  }
  const value=first.realValue();
  return realResult(name==="ceil"||name==="ceiling"?Math.ceil(value):name==="floor"?Math.floor(value):Math.trunc(value));
 }
 const left=real(first);
 if(logNames.has(name)){
  if(left<=0)return result;
  if(name==="log"&&args.length===2){
   // Preserve logFunc's callback-family control: base <= 1 rejects before
   // converting the second argument.
   const denominator=Math.log(left);
   if(denominator<=0)return result;
   // Pinned logFunc deliberately does not apply numeric_type to argv[1].
   // sqlite3_value_double accepts a numeric prefix (including BLOB bytes read
   // in the database encoding) and maps nonnumeric/NULL to zero; the following
   // domain check then rejects those zero values.
   const right=args[1]!.valueDouble(encoding);
   return right<=0?result:realResult(Math.log(right)/denominator);
  }
  return realResult(name==="ln"?Math.log(left):name==="log2"?Math.log2(left):Math.log10(left));
 }
 const unary=unaryCallbacks[name];
 if(unary)return realResult(unary(left));
 const binary=binaryCallbacks[name];
 if(!binary)return result;
 const second=numeric(args[1]!,encoding);
 return second?realResult(binary(left,real(second))):result;
}
