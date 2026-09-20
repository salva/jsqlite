// Translation of the calendar core and SQL callbacks in SQLite 3.53.4 src/date.c.
// The host Date object is confined to the clock/local-zone adapter; parsing and
// UTC calendar arithmetic use SQLite's integer-Julian representation.
import {Mem} from "./mem.ts";
import type {DatabaseEncoding} from "./record.ts";

const DAY=86400000n, UNIX_EPOCH=210866760000000n, MAX=464269060799999n;
export interface DateTimeEnvironment { nowUnixMilliseconds():bigint; localFieldsAtUnixSecond(second:bigint):{year:number;month:number;day:number;hour:number;minute:number;second:number}|null }
/** Internal construction seam; deliberately absent from public OpenOptions. */
export const dateTimeEnvironmentOption:unique symbol=Symbol("jsqlite.dateTimeEnvironment");
export class LocalTimeUnavailableError extends Error {constructor(){super("local time unavailable");this.name="LocalTimeUnavailableError";}}
export const defaultDateTimeEnvironment:DateTimeEnvironment={
 nowUnixMilliseconds:()=>BigInt(Date.now()),
 localFieldsAtUnixSecond(second){const n=Number(second)*1000;if(!Number.isFinite(n))return null;const d=new Date(n);if(Number.isNaN(d.getTime()))return null;return{year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate(),hour:d.getHours(),minute:d.getMinutes(),second:d.getSeconds()}}
};
type DT={iJD:bigint;subsec:boolean;raw?:number;validJD?:boolean;nFloor?:number;hour24?:boolean;parsedYmd?:{year:number;month:number;day:number};isUtc?:boolean;isLocal?:boolean};
const divFloor=(a:bigint,b:bigint)=>{let q=a/b,r=a%b;if(r<0n)q--;return q};
function valid(x:bigint){return x>=0n&&x<=MAX}
const roundedMs=(n:number)=>BigInt(Math.trunc(n+(n<0?-0.5:0.5)));
const leap=(y:number)=>y%4===0&&(y%100!==0||y%400===0);
const monthDays=(y:number,m:number)=>m===2?(leap(y)?29:28):((1<<m)&0x15aa)?31:30;
function jdFromYmd(y:number,m:number,d:number,h=0,mi=0,seconds=0):bigint|null{
 if(y< -4713||y>9999||m<1||m>12||d<1||d>31||h<0||h>24||mi<0||mi>59||seconds<0||seconds>=60)return null;
 let Y=y,M=m;if(M<=2){Y--;M+=12}const A=Math.floor(Y/100),B=2-A+Math.floor(A/4);
 const jd=Math.floor(365.25*(Y+4716))+Math.floor(30.6001*(M+1))+d+B-1524.5;
 const ms=BigInt(Math.round((h*3600+mi*60+seconds)*1000));const out=BigInt(Math.round(jd*86400000))+ms;return valid(out)?out:null;
}
function fields(iJD:bigint){
 // date.c:computeYMD/computeHMS, including its proleptic Gregorian mapping.
 const z=Number((iJD+43200000n)/DAY),alpha=Math.trunc((z+32044.75)/36524.25)-52,a=z+1+alpha-Math.trunc((alpha+100)/4)+25,b=a+1524,c=Math.trunc((b-122.1)/365.25),dd=Math.trunc((36525*(c&32767))/100),e=Math.trunc((b-dd)/30.6001),x1=Math.trunc(30.6001*e);
 const day=b-dd-x1,month=e<14?e-1:e-13,year=month>2?c-4716:c-4715;
 let ms=(iJD+43200000n)%DAY;if(ms<0n)ms+=DAY;const hour=Number(ms/3600000n);ms%=3600000n;const minute=Number(ms/60000n);ms%=60000n;
 return{year,month,day,hour,minute,second:Number(ms)/1000};
}
function asciiLower(s:string){let r="";for(const c of s){const n=c.charCodeAt(0);r+=n>=65&&n<=90?String.fromCharCode(n+32):c}return r}
const asciiTrim=(s:string)=>s.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g,"");
function parseNumber(s:string):number|null{if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null}
function parseText(input:string):DT|null{
 const s=input;if(asciiLower(s)==="now")return null;const numeric=parseNumber(asciiTrim(s));if(numeric!==null){const x=BigInt(Math.round(numeric*86400000));return{iJD:valid(x)?x:0n,subsec:false,raw:numeric,validJD:valid(x)}}
 let i=0,sign=1;if(s[i]==="-"){sign=-1;i++}const take=(n:number)=>{if(i+n>s.length)return null;let v=0;for(let k=0;k<n;k++){const c=s.charCodeAt(i+k);if(c<48||c>57)return null;v=v*10+c-48}i+=n;return v};
 let y:number|undefined,m:number|undefined,d:number|undefined,h=0,mi=0,sec=0;
 const first=take(4);if(first!==null&&s[i]==="-"){y=sign*first;i++;m=take(2)??undefined;if(m===undefined||s[i++]!=="-")return null;d=take(2)??undefined;if(d===undefined)return null;if(i<s.length&&(s.charCodeAt(i)<=32||s[i]==="T")){while(i<s.length&&(s.charCodeAt(i)<=32||s[i]==="T"))i++;if(i===s.length){h=0;mi=0;sec=0}else{h=take(2)??-1;if(s[i++]!==":")return null;mi=take(2)??-1;if(i<s.length&&s[i]===":"){i++;const ss=take(2);if(ss===null)return null;sec=ss;if(i<s.length&&s[i]==="."){let p=.1;i++;if(i>=s.length||s.charCodeAt(i)<48||s.charCodeAt(i)>57)return null;while(i<s.length&&s.charCodeAt(i)>=48&&s.charCodeAt(i)<=57){sec+=(s.charCodeAt(i++)-48)*p;p*=.1}sec=Math.min(sec,ss+0.999)}}}}}
 else {i=0;h=take(2)??-1;if(s[i++]!==":")return null;mi=take(2)??-1;if(s[i]===":"){i++;sec=take(2)??-1;if(s[i]==="."){let p=.1;i++;if(i>=s.length||s.charCodeAt(i)<48||s.charCodeAt(i)>57)return null;while(i<s.length&&s.charCodeAt(i)>=48&&s.charCodeAt(i)<=57){sec+=(s.charCodeAt(i++)-48)*p;p*=.1}sec=Math.min(sec,Math.floor(sec)+0.999)}}y=2000;m=1;d=1}
 while(i<s.length&&s.charCodeAt(i)<=32)i++;let tz=0;if(i<s.length&&(s[i]==="Z"||s[i]==="z"))i++;else if(i<s.length&&(s[i]==="+"||s[i]==="-")){const sg=s[i++]==="-"?-1:1,th=take(2),colon=s[i++]===":",tm=colon?take(2):null;if(th===null||tm===null||th>14||tm>59)return null;tz=sg*(th*60+tm)}while(i<s.length&&s.charCodeAt(i)<=32)i++;if(i!==s.length)return null;
 const jd=jdFromYmd(y!,m!,d!,h,mi,sec);if(jd===null)return null;const out:DT={iJD:jd-BigInt(tz)*60000n,subsec:false,hour24:h===24&&tz===0,nFloor:Math.max(0,d!-monthDays(y!,m!)),isUtc:tz!==0||/[zZ]/.test(s)};if(tz===0)out.parsedYmd={year:y!,month:m!,day:d!};return out;
}
function textArg(v:Mem,encoding:DatabaseEncoding):string|null{if(v.initialStorageClass==="null"||v.initialStorageClass==="blob")return null;if(v.initialStorageClass==="text")return v.textValue();if(v.initialStorageClass==="integer")return v.integerValue().toString();return String(v.realValue())}
function parse(v:Mem|undefined,encoding:DatabaseEncoding,now:()=>bigint):DT|null{if(!v)return{iJD:UNIX_EPOCH+now(),subsec:false};const s=textArg(v,encoding);if(s===null)return null;if(asciiLower(s)==="now")return{iJD:UNIX_EPOCH+now(),subsec:false};return parseText(s)}
function apply(dt:DT,mod:string,env:DateTimeEnvironment,idx:number):boolean{
 if(mod!==asciiTrim(mod))return false;const z=asciiLower(mod);if(z==="subsec"||z==="subsecond"){dt.subsec=true;return true}
 if(dt.hour24&&z.startsWith("start of ")){dt.iJD-=DAY;dt.hour24=false}else if(dt.hour24)dt.hour24=false;
 if(z.startsWith("start of ")&&dt.parsedYmd){const p=dt.parsedYmd,f=fields(dt.iJD),day=z==="start of day"?p.day:1,month=z==="start of year"?1:p.month,x=jdFromYmd(p.year,month,day);if(x===null)return false;dt.iJD=x;delete dt.parsedYmd;dt.nFloor=0;return z==="start of day"||z==="start of month"||z==="start of year"}
 delete dt.parsedYmd;
 const compound=/^([+-])(\d{4,5})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?$/.exec(z);
 if(compound){const sign=compound[1]==="-"?-1:1,y=Number(compound[2]),m=Number(compound[3]),d=Number(compound[4]);if(m>=12||d>=31)return false;let f=fields(dt.iJD),month=f.month+sign*m,year=f.year+sign*y;while(month>12){month-=12;year++}while(month<1){month+=12;year--}dt.nFloor=Math.max(0,f.day-monthDays(year,month));const shifted=jdFromYmd(year,month,f.day,f.hour,f.minute,f.second);if(shifted===null)return false;dt.iJD=shifted+BigInt(sign*d)*DAY;if(compound[5]){const h=Number(compound[5]),mi=Number(compound[6]),sec=Number(compound[7]??0);if(h>24||mi>59||sec>=60)return false;dt.iJD+=BigInt(sign)*roundedMs((h*3600+mi*60+sec)*1000)}return valid(dt.iJD)}
 if(z==="julianday"){if(idx>1||dt.raw===undefined||!dt.validJD)return false;delete dt.raw;return true}
 if(z==="unixepoch"){if(idx>1||dt.raw===undefined)return false;dt.iJD=UNIX_EPOCH+BigInt(Math.round(dt.raw*1000));dt.validJD=valid(dt.iJD);delete dt.raw;return dt.validJD}
 if(z==="auto"){if(idx>1)return false;if(dt.raw===undefined)return true;if(dt.validJD){delete dt.raw;return true}if(dt.raw>=-210866760000&&dt.raw<=253402300799){dt.iJD=UNIX_EPOCH+BigInt(Math.round(dt.raw*1000));dt.validJD=valid(dt.iJD);delete dt.raw;return dt.validJD}return false}
 let f=fields(dt.iJD);if(z==="start of day"){dt.iJD=jdFromYmd(f.year,f.month,f.day)!;return true}if(z==="start of month"){dt.iJD=jdFromYmd(f.year,f.month,1)!;return true}if(z==="start of year"){dt.iJD=jdFromYmd(f.year,1,1)!;return true}
 if(z.startsWith("weekday ")){const n=parseNumber(z.slice(8));if(n===null||n<0||n>=7||!Number.isInteger(n))return false;const current=Number(divFloor(dt.iJD+129600000n,DAY)%7n);dt.iJD+=BigInt((n-current+7)%7)*DAY;return true}
 if(z==="localtime"){if(dt.isLocal)return true;const sec=divFloor(dt.iJD-UNIX_EPOCH,1000n),l=env.localFieldsAtUnixSecond(sec);if(!l)throw new LocalTimeUnavailableError();const local=jdFromYmd(l.year,l.month,l.day,l.hour,l.minute,l.second);if(local===null)return false;dt.iJD=local+(dt.iJD%1000n+1000n)%1000n;dt.isUtc=false;dt.isLocal=true;return true}
 if(z==="utc"){if(dt.isUtc)return true;const original=dt.iJD;let guess=original,error=0n,count=0;do{guess-=error;const sec=divFloor(guess-UNIX_EPOCH,1000n),l=env.localFieldsAtUnixSecond(sec);if(!l)throw new LocalTimeUnavailableError();const local=jdFromYmd(l.year,l.month,l.day,l.hour,l.minute,l.second);if(local===null)return false;error=local+(guess%1000n+1000n)%1000n-original}while(error!==0n&&count++<3);dt.iJD=guess;dt.isUtc=true;dt.isLocal=false;return true}
 const words=z.split(" ").filter(Boolean);if(words.length===2){const n=parseNumber(words[0]!);if(n===null)return false;let unit=words[1]!;if(unit.endsWith("s"))unit=unit.slice(0,-1);if(unit==="second"||unit==="minute"||unit==="hour"||unit==="day"){const mul=unit==="second"?1000:unit==="minute"?60000:unit==="hour"?3600000:86400000,limit=unit==="second"?4.6427e14:unit==="minute"?7.7379e12:unit==="hour"?1.2897e11:5373485;if(n<=-limit||n>=limit)return false;dt.iJD+=roundedMs(n*mul);dt.nFloor=0;return valid(dt.iJD)}if(unit==="month"||unit==="year"){const limit=unit==="month"?176546:14713;if(n<=-limit||n>=limit)return false;f=fields(dt.iJD);const whole=Math.trunc(n),fraction=n-whole;let y=f.year+(unit==="year"?whole:0),m=f.month+(unit==="month"?whole:0);while(m>12){m-=12;y++}while(m<1){m+=12;y--}dt.nFloor=Math.max(0,f.day-monthDays(y,m));const x=jdFromYmd(y,m,f.day,f.hour,f.minute,f.second);if(x===null)return false;dt.iJD=x+roundedMs(fraction*(unit==="year"?365:30)*86400000);return valid(dt.iJD)}}
 // [+|-]HH:MM[:SS[.FFF]] follows parseHhMmSs and retains only time-of-day.
 if(z[0]==="+"||z[0]==="-"){const clock=/^([+-])(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(z);if(clock){const sg=clock[1]==="-"?-1:1,hh=Number(clock[2]),mm=Number(clock[3]),whole=Number(clock[4]??0);if(hh>24||mm>59||whole>59)return false;let fraction=clock[5]?Number(`0.${clock[5]}`):0;fraction=Math.min(fraction,0.999);const amount=roundedMs((hh*3600+mm*60+whole+fraction)*1000)%DAY;dt.iJD+=BigInt(sg)*amount;return valid(dt.iJD)}}
 if(z==="ceiling"){dt.nFloor=0;return true}if(z==="floor"){dt.iJD-=BigInt(dt.nFloor??0)*DAY;dt.nFloor=0;return valid(dt.iJD)}return false;
}
const pad=(n:number,w=2)=>Math.abs(n).toString().padStart(w,"0");
function dateString(dt:DT,time:boolean,onlyTime=false){const f=fields(dt.iJD),y=f.year<0?`-${pad(f.year,4)}`:pad(f.year,4),s=Math.min(59.999,Math.max(0,f.second));const sec=dt.subsec?`${pad(Math.floor(s))}.${pad(Math.round((s-Math.floor(s))*1000),3)}`:pad(Math.floor(s));const d=`${y}-${pad(f.month)}-${pad(f.day)}`,t=`${pad(dt.hour24?24:f.hour)}:${pad(f.minute)}:${sec}`;return onlyTime?t:time?`${d} ${t}`:d}
function formatJulian(iJD:bigint){const n=Number(iJD)/86400000;return n.toPrecision(16).replace(/(?:\.0+|(?:(\.[0-9]*?)0+))(?=e|$)/i,'$1').replace(/e\+/i,'e+')}
function outputText(s:string,control?:DateTimeControl){const bytes=new TextEncoder().encode(s);control?.checkSize(bytes.byteLength);const out=new Mem();out.setText(bytes,"utf-8");return out}
export interface DateTimeControl {readonly maxResultBytes:number;charge(units:number):void;check():void;checkSize(bytes:number):void}
export function evaluateDateTime(name:string,args:Mem[],encoding:DatabaseEncoding,now:()=>bigint,env=defaultDateTimeEnvironment,control?:DateTimeControl):Mem{
 const out=new Mem();if(name==="timediff"){
  const d1=parse(args[0],encoding,now),d2=parse(args[1],encoding,now);if(!d1||!d2)return out;
  const a=fields(d1.iJD),b=fields(d2.iJD),positive=d1.iJD>=d2.iJD;let y:number,m:number,ay=b.year,am=b.month;
  if(positive){
   y=a.year-b.year;if(y)ay=a.year;m=a.month-b.month;if(m<0){y--;m+=12}if(m)am=a.month;
   let anchor=jdFromYmd(ay,am,b.day,b.hour,b.minute,b.second);if(anchor===null)return out;
   while(d1.iJD<anchor){if(--m<0){m=11;y--}if(--am<1){am=12;ay--}anchor=jdFromYmd(ay,am,b.day,b.hour,b.minute,b.second);if(anchor===null)return out}
   const x=d1.iJD-anchor,day=x/DAY,rem=x%DAY,h=rem/3600000n,mi=rem%3600000n/60000n,ms=rem%60000n;
   return outputText(`+${pad(y,4)}-${pad(m)}-${pad(Number(day))} ${pad(Number(h))}:${pad(Number(mi))}:${pad(Number(ms/1000n))}.${pad(Number(ms%1000n),3)}`,control)
  }
  y=b.year-a.year;if(y)ay=a.year;m=b.month-a.month;if(m<0){y--;m+=12}if(m)am=a.month;
  let anchor=jdFromYmd(ay,am,b.day,b.hour,b.minute,b.second);if(anchor===null)return out;
  while(d1.iJD>anchor){if(--m<0){m=11;y--}if(++am>12){am=1;ay++}anchor=jdFromYmd(ay,am,b.day,b.hour,b.minute,b.second);if(anchor===null)return out}
  const x=anchor-d1.iJD,day=x/DAY,rem=x%DAY,h=rem/3600000n,mi=rem%3600000n/60000n,ms=rem%60000n;
  return outputText(`-${pad(y,4)}-${pad(m)}-${pad(Number(day))} ${pad(Number(h))}:${pad(Number(mi))}:${pad(Number(ms/1000n))}.${pad(Number(ms%1000n),3)}`,control)
 }
 const dt=parse(name==="strftime"?args[1]:args[0],encoding,now);if(!dt)return out;try{for(let i=name==="strftime"?2:1;i<args.length;i++){const m=textArg(args[i]!,encoding);if(m===null||!apply(dt,m,env,i))return out}}catch(e){if(e instanceof Error&&e.message==="local time unavailable")throw e;return out}if(dt.validJD===false||!valid(dt.iJD))return out;
 if(name==="julianday"){out.setDouble(Number(dt.iJD)/86400000);return out}if(name==="unixepoch"){const ms=dt.iJD-UNIX_EPOCH;if(dt.subsec)out.setDouble(Number(ms)/1000);else out.setInt64(divFloor(ms,1000n));return out}if(name==="date"||name==="current_date")return outputText(dateString(dt,false),control);if(name==="time"||name==="current_time")return outputText(dateString(dt,true,true),control);if(name==="datetime"||name==="current_timestamp")return outputText(dateString(dt,true),control);
 if(name==="strftime"){const formatMem=args[0];if(!formatMem)return out;const format=textArg(formatMem,encoding);if(format===null)return out;const actual=dt;const f=fields(actual.iJD),displayHour=actual.hour24?24:f.hour,jan=jdFromYmd(f.year,1,1)!,dayOfYear=Number((actual.iJD-jan+43200000n)/DAY),monday=Number((actual.iJD+43200000n)/DAY%7n),sunday=Number((actual.iJD+129600000n)/DAY%7n);let r="";
 for(let i=0;i<format.length;i++){control?.charge(1);if(format[i]!=="%"){r+=format[i];continue}const c=format[++i];if(!c)return out;
  if(c==="%")r+="%";else if(c==="Y")r+=pad(f.year,4);else if(c==="m")r+=pad(f.month);else if(c==="d")r+=pad(f.day);else if(c==="e")r+=pad(f.day).replace(/^0/,' ');else if(c==="F")r+=`${pad(f.year,4)}-${pad(f.month)}-${pad(f.day)}`;
  else if(c==="H")r+=pad(displayHour);else if(c==="k")r+=pad(displayHour).replace(/^0/,' ');else if(c==="I"||c==="l"){const h=displayHour%12||12;r+=c==="I"?pad(h):pad(h).replace(/^0/,' ')}else if(c==="p"||c==="P")r+=displayHour>=12?(c==="p"?"PM":"pm"):(c==="p"?"AM":"am");else if(c==="R")r+=`${pad(displayHour)}:${pad(f.minute)}`;else if(c==="T")r+=`${pad(displayHour)}:${pad(f.minute)}:${pad(Math.floor(f.second))}`;
  else if(c==="M")r+=pad(f.minute);else if(c==="S")r+=pad(Math.floor(f.second));else if(c==="f")r+=`${pad(Math.floor(f.second))}.${pad(Math.round((f.second%1)*1000),3)}`;else if(c==="s")r+=actual.subsec?(Number(actual.iJD-UNIX_EPOCH)/1000).toFixed(3):divFloor(actual.iJD-UNIX_EPOCH,1000n).toString();else if(c==="J")r+=formatJulian(actual.iJD);else if(c==="j")r+=pad(dayOfYear+1,3);else if(c==="w"||c==="u")r+=String(c==="u"&&sunday===0?7:sunday);else if(c==="U")r+=pad(Math.trunc((dayOfYear-sunday+7)/7));else if(c==="W")r+=pad(Math.trunc((dayOfYear-monday+7)/7));
  else if(c==="V"||c==="G"||c==="g"){const thursday=actual.iJD+BigInt(3-monday)*DAY,tf=fields(thursday),tjan=jdFromYmd(tf.year,1,1)!,week=Math.trunc(Number((thursday-tjan+43200000n)/DAY)/7)+1;if(c==="V")r+=pad(week);else if(c==="g")r+=pad(tf.year%100);else r+=pad(tf.year,4)}else return out
 }return outputText(r,control)}return out;
}
