import type {DatabaseEncoding} from './record.ts';
import {atof} from './mem.ts';

/** whereexpr.c:isLikeOrGlob and exprAnalyze TERM_LIKEOPT. Keep bounds as
 * UTF-8 bytes: successor construction can create a noncanonical byte sequence,
 * which must not pass through a WHATWG decoder. The caller owns literal/bound
 * TEXT admission, parameter varmask, resolved function identity, and join marks.
 * This primitive alone is NOT permission to select a TEXT-only range: the
 * default pinned build also requires whereLikeOptimizationStringFixup's BLOB
 * pass, paired range enrollment, and disableTerm/continuation ownership.
 */
export interface LikePrefixRange {
 readonly lower:Uint8Array;
 readonly upper:Uint8Array;
 readonly complete:boolean;
 readonly noCase:boolean;
}

// utf.c:sqlite3Utf8Read, including permissive legacy UTF-8 and replacement
// decisions. The byte position is needed by isLikeOrGlob, not a JS character.
function readUtf8(z:Uint8Array,start:number):{point:number;next:number} {
 let next=start+1,c=z[start]!;
 if(c>=0xc0){
  c=c<0xe0?c-0xc0:c<0xf0?c-0xe0:c<0xf8?c-0xf0:c<0xfc?c-0xf8:c<0xfe?c-0xfc:0;
  while(next<z.length&&(z[next]!&0xc0)===0x80)c=((c<<6)+(z[next++]!&0x3f))>>>0;
  if(c<0x80||(c&0xfffff800)===0xd800||(c&0xfffffffe)===0xfffe)c=0xfffd;
 }
 return {point:c,next};
}

/** func.c:sqlite3IsLikeFunction admits only a literal, one-byte ESCAPE
 * different from matchAll/matchOne. Runtime validates other ESCAPE shapes;
 * optimizer rejection must not replace their runtime behavior with an error.
 */
export function likePrefixRange(pattern:Uint8Array,mode:'like'|'glob',encoding:DatabaseEncoding,textColumn:boolean,escape?:Uint8Array):LikePrefixRange|null {
 const noCase=mode==='like',all=noCase?0x25:0x2a,one=noCase?0x5f:0x3f,set=noCase?0:0x5b;
 let esc=0;
 if(escape!==undefined){
  if(!noCase||escape.length!==1||escape[0]===0||escape[0]===all||escape[0]===one)return null;
  esc=escape[0]!;
 }
 const byte=(at:number):number=>pattern[at]??0;
 let count=0,c=0;
 while((c=byte(count))!==0&&c!==all&&c!==one&&c!==set){
  count++;
  if(c===esc&&byte(count)>0&&byte(count)<0x80)count++;
  else if(c>=0x80){
   const decoded=readUtf8(pattern,count-1);
   if(c===0xff||decoded.point===0xfffd||encoding==='utf-16le'){count--;break;}
   count=decoded.next;
  }
 }
 if(!(count>1||count>0&&byte(0)!==esc)||byte(count-1)===0xff)return null;
 let complete=c===all&&byte(count+1)===0&&encoding!=='utf-16le';
 const prefix:number[]=[];
 for(let from=0;from<count;from++){
  if(byte(from)===esc)from++;
  prefix.push(byte(from));
 }
 if(!textColumn){
  // sqlite3AtoF > 0 means a whole numeric string, not merely a numeric
  // prefix. The numeric-safety trial increments the last BYTE, before the
  // later UTF-8 successor/case conversion in exprAnalyze.
  const numeric=(bytes:readonly number[]):boolean=>{const value=atof(bytes);return value.validPrefix&&value.full;};
  if(numeric(prefix)||prefix.length===1&&prefix[0]===0x2d)return null;
  const trial=[...prefix];trial[trial.length-1]=trial[trial.length-1]!+1;
  if(numeric(trial))return null;
 }
 const lower=Uint8Array.from(prefix),upper=Uint8Array.from(prefix);
 if(noCase)for(let i=0;i<lower.length;i++){
  if(lower[i]!>=0x61&&lower[i]!<=0x7a)lower[i]=lower[i]!-0x20;
  if(upper[i]!>=0x41&&upper[i]!<=0x5a)upper[i]=upper[i]!+0x20;
 }
 let last=upper.length-1;
 if(noCase){
  if(upper[last]===0x40)complete=false;
  if(upper[last]!>=0x41&&upper[last]!<=0x5a)upper[last]=upper[last]!+0x20;
 }
 while(upper[last]===0xbf&&last>0){upper[last]=0x80;last--;}
 upper[last]=upper[last]!+1;
 return {lower,upper,complete,noCase};
}
