import {Mem} from './mem.ts';
import {JSQLiteError} from '../index.ts';

type Control={reserve(n:number):void;release(n:number):void;checkpoint(n:number):Promise<void>};
/** json.c jsonTranslateTextToBlob / jsonBlobAppendNode / ChangePayloadSize.
 * Input and payload positions are bytes, never decoded strings or JSON nodes.
 * Arena growth is accounted while both old and replacement storage are live. */
export async function aggregateTextToBlob(z:Uint8Array,c:Control,publication:"validated"|"aggregate"="validated"):Promise<Mem>{
 let a=new Uint8Array(0),used=0,capacity=0,depth=0,iErr=0;
 const syntax={}; // Native parse failure, distinct from cancellation/resource errors.
 const bad=():never=>{throw syntax};
 const b=(i:number)=>z[i]??0,digit=(x:number)=>x>=48&&x<=57,hex=(x:number)=>digit(x)||(x>=65&&x<=70)||(x>=97&&x<=102);
 const hs=(n:number)=>n<=11?1:n<=255?2:n<=65535?3:5;
 const ensure=async(n:number)=>{
  if(used+n<=capacity)return;
  const size=Math.max(32,used+n,capacity*2);c.reserve(size);
  try{const next=new Uint8Array(size);for(let i=0;i<used;i+=256){await c.checkpoint(1);next.set(a.subarray(i,Math.min(used,i+256)),i)}a=next}catch(e){c.release(size);throw e}
  c.release(capacity);capacity=size;
 };
 const header=(at:number,type:number,n:number)=>{const h=hs(n);a[at]=type|((h===1?n:h===2?12:h===3?13:14)<<4);for(let j=1;j<h;j++)a[at+j]=Math.floor(n/256**(h-j-1))&255};
 const append=async(type:number,start:number,end:number)=>{
  const n=end-start;await ensure(hs(n)+n);header(used,type,n);used+=hs(n);
  for(let i=start;i<end;i+=256){await c.checkpoint(1);const count=Math.min(256,end-i);a.set(z.subarray(i,i+count),used);used+=count}
 };
 const literal=async(type:number,text:string)=>{await ensure(hs(text.length)+text.length);header(used,type,text.length);used+=hs(text.length);for(let i=0;i<text.length;i++)a[used++]=text.charCodeAt(i)};
 const ws=async(i:number):Promise<number>=>{
  let probe=i;
  for(;;){if(i>=probe){await c.checkpoint(1);probe=i+256}
   const x=b(i);
   if(x===32||(x>=9&&x<=13)){i++;continue}
   // json5Whitespace UTF-8 whitespace sequences.
   if(x===194&&b(i+1)===160){i+=2;continue}
   if((x===225&&b(i+1)===154&&b(i+2)===128)||(x===226&&b(i+1)===128&&((b(i+2)>=128&&b(i+2)<=138)||b(i+2)===168||b(i+2)===169||b(i+2)===175))||(x===226&&b(i+1)===129&&b(i+2)===159)||(x===227&&b(i+1)===128&&b(i+2)===128)||(x===239&&b(i+1)===187&&b(i+2)===191)){i+=3;continue}
   if(x===47&&b(i+1)===47){i+=2;while(b(i)&&b(i)!==10&&b(i)!==13&&!(b(i)===226&&b(i+1)===128&&(b(i+2)===168||b(i+2)===169))){if(i>=probe){await c.checkpoint(1);probe=i+256}i++}continue}
   if(x===47&&b(i+1)===42){const start=i;i+=2;while(b(i)&&!(b(i)===42&&b(i+1)===47)){if(i>=probe){await c.checkpoint(1);probe=i+256}i++}if(!b(i))return start;i+=2;continue}
   return i;
  }
 };
 const string=async(i:number):Promise<number>=>{
  const quote=b(i);let type=7,j=i+1,probe=j;
  for(;;){if(j>=probe){await c.checkpoint(1);probe=j+256}const x=b(j);if(!x)bad();if(x===quote)break;
   if(x===92){const e=b(++j);
    if([34,92,47,98,102,110,114,116].includes(e)||(e===117&&[1,2,3,4].every(k=>hex(b(j+k))))){if(type===7)type=8}
    else if(e===39||e===118||e===10||(e===48&&!digit(b(j+1)))||(e===120&&hex(b(j+1))&&hex(b(j+2)))||(e===226&&b(j+1)===128&&(b(j+2)===168||b(j+2)===169)))type=9;
    else if(e===13){if(b(j+1)===10)j++;type=9}else bad();
   }else if(x<=31||x===34)type=9;
   j++;
  }
  await append(type,i+1,j);return j+1;
 };
 const value=async(i:number):Promise<number>=>{
  try{return await translate(i)}catch(error){if(error!==syntax)throw error;return -1}
 };
 const translate=async(i:number):Promise<number>=>{
  await c.checkpoint(1);i=await ws(i);const x=b(i);iErr=i;
  if(!x)return 0;
  if(x===125)return -2;
  if(x===93)return -3;
  if(x===44)return -4;
  if(x===58)return -5;
  if(x===34||x===39)return string(i);
  if(x===123||x===91){
   const type=x===123?12:11,close=x===123?125:93,start=used,initial=hs(z.length-i);
   // Native reserves the header width estimated from remaining source bytes,
   // not payload storage. ChangePayloadSize subsequently shrinks or grows it.
   await ensure(initial);header(used,type,z.length-i);used+=initial;const payload=used;
   if(++depth>1000)bad();let j=i+1;
   for(;;){
    const label=used;let result=await value(j);
    if(result<=0){
     if(result===(type===12?-2:-3)){j=iErr;break}
     if(type!==12)bad();
     j=await ws(j);let labelType=7;
     const id1=(v:number)=>v>=128||v===36||v===95||(v>=65&&v<=90)||(v>=97&&v<=122);
     const escape=(at:number)=>b(at)===92&&b(at+1)===117&&[2,3,4,5].every(k=>hex(b(at+k)));
     if(!id1(b(j))&&!escape(j))bad();
     if(escape(j))labelType=8;
     let k=j+1;
     for(;;){
      await c.checkpoint(1);
      if((id1(b(k))||digit(b(k)))&&await ws(k)===k){k++;continue}
      if(escape(k)){labelType=8;k++;continue}
      break;
     }
     if(used!==label)bad(); // native failed label production emits no bytes
     await append(labelType,j,k);result=k;
    }
    j=result;
    if(type===12){
     if((a[label]!&15)<7||(a[label]!&15)>10)bad();
     if(b(j)===58)j++;
     else{const colon=await value(j);if(colon!==-5)bad();j=iErr+1}
     result=await value(j);if(result<=0)bad();j=result;
    }
    if(b(j)===44){j++;continue}
    if(b(j)===close)break;
    const separator=await value(j);
    if(separator===-4){j=iErr+1;continue}
    if(separator===(type===12?-2:-3)){j=iErr;break}
    bad();
   }
   const size=used-payload,delta=hs(size)-initial;
   if(delta>0){await ensure(delta);for(let end=used;end>payload;){await c.checkpoint(1);const begin=Math.max(payload,end-256);a.copyWithin(begin+delta,begin,end);end=begin}}
   else if(delta<0){for(let at=payload;at<used;at+=256){await c.checkpoint(1);a.copyWithin(at+delta,at,Math.min(used,at+256))}}
   used+=delta;header(start,type,size);depth--;return j+1;
  }
  // Literal recognition follows native prefix consumption; enclosing grammar
  // rejects a trailing non-separator after a successfully emitted token.
  const match=(word:string)=>{for(let k=0;k<word.length;k++)if((b(i+k)|32)!==word.charCodeAt(k))return false;return true};
  const alnum=(v:number)=>digit(v)||(v>=65&&v<=90)||(v>=97&&v<=122);
  for(const [word,type] of [['null',0],['true',1],['false',2]] as const){if(match(word)&&!alnum(b(i+word.length))&&z.subarray(i,i+word.length).every((v,k)=>v===word.charCodeAt(k))){await literal(type,'');return i+word.length}}
  let j=i;if(x===43||x===45)j++;
  const signed=j!==i,negative=x===45;
  const infAt=j;
  const wordAt=(word:string)=>{for(let k=0;k<word.length;k++)if((b(infAt+k)|32)!==word.charCodeAt(k))return false;return true};
  for(const word of ['infinity','inf','qnan','snan','nan'])if(wordAt(word)&&(signed||!alnum(b(j+word.length)))){
   if(signed&&!word.startsWith('inf'))bad();await literal(word.startsWith('inf')?5:0,word.startsWith('inf')?(negative?'-9e999':'9e999'):'');return j+word.length;
  }
  // jsonTranslateTextToBlob parse_number / parse_number_2 / finish.
  // t bit0 is JSON5 spelling, bit1 FLOAT. Decimal admission consults
  // the same bit as exponent admission, rather than a second grammar.
  if(!(digit(x)||x===43||x===45||x===46))bad();
  let t=x===46?3:0,seenE=false,finish=false;
  const failAt=(at:number):never=>{iErr=at;return bad()};
  if(x===46){if(!digit(b(i+1)))failAt(i)}
  else if(x<=48){
   if(x===48){
    if((b(i+1)===120||b(i+1)===88)&&hex(b(i+2))){
     t=1;j=i+3;while(hex(b(j))){if((j-i)%256===0)await c.checkpoint(1);j++}finish=true;
    }else if(digit(b(i+1)))failAt(i+1);
   }else{
    if(!digit(b(i+1))){if(b(i+1)===46)t|=1;else failAt(i)}
    if(b(i+1)===48){
     if(digit(b(i+2)))failAt(i+1);
     else if((b(i+2)===120||b(i+2)===88)&&hex(b(i+3))){
      t|=1;j=i+4;while(hex(b(j))){if((j-i)%256===0)await c.checkpoint(1);j++}finish=true;
     }
    }
   }
  }
  if(!finish){
   for(j=i+1;;j++){
    if((j-i)%256===0)await c.checkpoint(1);
    const ch=b(j);
    if(digit(ch))continue;
    if(ch===46){if(t&2)failAt(j);t|=2;continue}
    if(ch===101||ch===69){
     if(b(j-1)<48){if(b(j-1)===46&&j-2>=i&&digit(b(j-2)))t|=1;else failAt(j)}
     if(seenE)failAt(j);t|=2;seenE=true;
     if(b(j+1)===43||b(j+1)===45)j++;
     if(!digit(b(j+1)))failAt(j);
     continue;
    }
    break;
   }
   if(b(j-1)<48){if(b(j-1)===46&&j-2>=i&&digit(b(j-2)))t|=1;else failAt(j)}
  }
  await append(3+t,x===43?i+1:i,j);return j;
 };
 try{let end=0;
  try{end=await value(0)}catch(error){
   if(publication!=="aggregate"||error!==syntax)throw error;
  }
  // jsonConvertTextToBlob checks zJson[i], not i==nJson. nJson still
  // estimates container headers, but an embedded NUL terminates the parse.
  // jsonReturnStringAsBlob intentionally ignores the translator return and
  // publishes its arena; jsonConvertTextToBlob validates completion instead.
  // Only native syntax returns are ignored, never resource/control exceptions.
  if(publication==="validated"&&(end<=0||b(await ws(end))!==0))bad();
  const out=new Mem();out.adoptBlob(a.subarray(0,used));
  // jsonReturnStringAsBlob SQLITE_DYNAMIC: no result copy. Drop the producer's
  // mutable alias before refunding conversion scratch; publication admission
  // subsequently accounts result bytes through the shared VM contract.
  a=new Uint8Array(0);used=0;return out}
 catch(error){if(error===syntax)throw new JSQLiteError('sqlite','malformed JSON',{code:1});throw error}
 finally{c.release(capacity)}
}
