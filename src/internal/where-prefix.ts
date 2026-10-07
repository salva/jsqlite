import type {MemAffinity} from './mem.ts';
import type {KeyInfo} from './comparison.ts';

export type PrefixOp =
 | {readonly code:'IndexNullRow';readonly p1:number}
 | {readonly code:'Null';readonly p2:number}
 | {readonly code:'Goto';readonly p2:number}
 | {readonly code:'IndexRewind'|'IndexLast';readonly p1:number;readonly p2:number}
 | {readonly code:'Column';readonly p1:number;readonly p2:number;readonly p3:number}
 | {readonly code:'IndexSeekPrefix';readonly p1:number;readonly keys:readonly number[];readonly affinities:readonly MemAffinity[];readonly keyInfo:KeyInfo;readonly reverse:boolean;readonly strict?:boolean;readonly seekScan?:Readonly<{steps:number;hasRange:boolean}>;readonly p2:number};
export interface PrefixSink {
 readonly length:number;
 [index:number]:unknown;
 push(...ops:PrefixOp[]):number;
}
export interface PrefixEntry {
 readonly nSkip?:number;
 readonly restart:number|null;
 readonly empty:number|null;
}
export interface PrefixLoop extends PrefixEntry {readonly seek:number;readonly keys:readonly number[];readonly affinities:readonly MemAffinity[];}

/** wherecode.c:codeAllEqualityTerms, 925–946. The caller owns equality
 * evaluation/IN setup and exit labels; this owner emits physical positioning.
 * Keys retain ordinal slots, including leading skipped fields (not SQL NULL
 * predicates). Column copies overwrite the initialization NULLs on first entry.
 */
export function beginPrefixLoop(
 ops:PrefixSink, cursor:number, keys:readonly number[], affinities:readonly MemAffinity[],
 keyInfo:KeyInfo, reverse:boolean, nSkip=0,
):PrefixEntry {
 if(!Number.isInteger(nSkip)||nSkip<0||nSkip>keys.length||keys.length!==affinities.length)
  throw new Error('invalid positional prefix layout');
 let restart:number|null=null,empty:number|null=null;
 if(nSkip){
  for(let i=0;i<nSkip;i++)ops.push({code:'Null',p2:keys[i]!});
  empty=ops.length;ops.push({code:reverse?'IndexLast':'IndexRewind',p1:cursor,p2:0});
  const first=ops.length;ops.push({code:'Goto',p2:0});
  restart=ops.length;
  // The skipped fields come from OP_Column, already in index encoding/type.
  // wherecode.c applies equality affinity starting at nSkip, never to these.
  ops.push({code:'IndexSeekPrefix',p1:cursor,keys:keys.slice(0,nSkip),affinities:Array<MemAffinity>(nSkip).fill('blob'),keyInfo,reverse,strict:true,p2:0});
  ops[first]={code:'Goto',p2:ops.length};
  for(let i=0;i<nSkip;i++)ops.push({code:'Column',p1:i,p2:keys[i]!,p3:cursor});
 }
 return {restart,empty,nSkip};
}

/** Emit only after codeEqualityTerm/IN initialization and NULL guards. Keeping
 * this separate ensures strict restart flows through Column and then RHS code,
 * not directly to a seek with stale RHS iterator state (wherecode.c950ff).
 */
export function emitPrefixSeek(
 ops:PrefixSink, entry:PrefixEntry, cursor:number, keys:readonly number[],
 affinities:readonly MemAffinity[], keyInfo:KeyInfo, reverse:boolean, strict:boolean,
 scan?:Readonly<{enabled:boolean;rowLogEst:number;hasRange:boolean}>,
):PrefixLoop {
 if(keys.length!==affinities.length)throw new Error('invalid positional prefix layout');
 const seek=ops.length;
 // wherecode.c aStartOp: zero constraints position with Rewind/Last,
 // never a zero-field Seek (not a valid UnpackedRecord).
 if(entry.restart!==null&&keys.length===entry.nSkip){
  // wherecode.c2026: Column already positioned this skipped prefix.
  // A fall-through label preserves caller exit fixups without seeking again.
  ops.push({code:'Goto',p2:seek+1});
 }else if(keys.length===0)ops.push({code:reverse?'IndexLast':'IndexRewind',p1:cursor,p2:0});
 else ops.push({code:'IndexSeekPrefix',p1:cursor,keys,affinities,keyInfo,reverse,strict,...(scan?.enabled&&!reverse&&!strict?{seekScan:{steps:Math.floor((scan.rowLogEst+9)/10),hasRange:scan.hasRange}}:{}),p2:0});
 return {...entry,seek,keys,affinities};
}

/** where.c:sqlite3WhereEnd, 7664–7668: suffix/IN exhaustion reaches
 * strict restart; restart/initial empty reach the final level exit.
 * Caller patches its suffix/IN exits separately; never redirects EQ NULL here.
 */
export function finishPrefixLoop(ops:PrefixSink, loop:PrefixLoop, exit:number):void {
 if(loop.restart===null)return;
 ops.push({code:'Goto',p2:loop.restart});
 for(const at of [loop.restart,loop.empty!]){
  const op=ops[at] as PrefixOp;
  if(op.code!=='IndexSeekPrefix'&&op.code!=='IndexRewind'&&op.code!=='IndexLast')throw new Error('invalid prefix exit owner');
  ops[at]={...op,p2:exit};
 }
}
