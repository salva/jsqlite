// wherecode.c:codeINTerm and where.c:sqlite3WhereEnd. The SELECT producer
// owns the UNIQUE cursor; this level owns positioning, Column/NULL and restart.
// This module emits native-shaped control flow, not an RHS evaluator.
import type {MemAffinity} from './mem.ts';
import type {KeyInfo} from './comparison.ts';
export interface InPrefix {readonly p1:number;readonly keys:readonly number[];readonly affinities:readonly MemAffinity[];readonly keyInfo:KeyInfo}
export type InLoopOp =
 | ({readonly code:'IndexIfNoHope';readonly p2:number} & InPrefix)
 | ({readonly code:'IndexSeekHit'} & InPrefix)
 | {readonly code:'IndexRewind'|'IndexLast'|'IndexNext'|'IndexPrev';readonly p1:number;readonly p2:number}
 | {readonly code:'Column';readonly p1:number;readonly p2:number;readonly p3:number;readonly inProbe?:boolean}
 | {readonly code:'Rowid';readonly p1:number;readonly p2:number;readonly inProbe?:boolean}
 | {readonly code:'Rewind'|'Last'|'Next'|'Prev';readonly p1:number;readonly p2:number}
 | {readonly code:'IsNull';readonly p1:number;readonly p2:number}
 | {readonly code:'IfNotOpen';readonly p1:number;readonly p2:number};
export interface InLoopSink {
 readonly length:number;
 [index:number]:unknown;
 push(...ops:Exclude<InLoopOp,{readonly code:'IfNotOpen'}>[]):number;
}
export interface InLoopEndSink extends InLoopSink {
 push(...ops:InLoopOp[]):number;
}
export interface WhereInLoop {
 readonly cursor:number;
 readonly reverse:boolean;
 readonly start:number;
 readonly top:number;
 readonly nullGuard:number;
 readonly nullGuards:readonly number[];
}
/** Call after linked SRT_Set production. Re-entering start resets this slot;
 * continuing top never reruns the producer. LHS physical DESC is folded by
 * the caller; RHS physical DESC toggles the requested iteration direction. */
export function beginInLoop(ops:InLoopSink,cursor:number,target:number,reverse:boolean,rhsDescending=false,field=0,earlyout?:InPrefix):WhereInLoop {
 return beginInVectorLoop(ops,cursor,[{target,field}],reverse,rhsDescending,earlyout);
}
/** codeINTerm aiMap fields share one positioned RHS row and one movement.
 * Repeated fields retain distinct output registers, not Cartesian slots. */
export function beginInVectorLoop(ops:InLoopSink,cursor:number,fields:readonly {readonly target:number;readonly field:number}[],reverse:boolean,rhsDescending=false,earlyout?:InPrefix):WhereInLoop {
 if(!fields.length)throw new Error('IN loop requires an output field');
 const backwards=reverse!==rhsDescending,start=ops.length,field=fields[0]!.field;
 ops.push({code:field<0?(backwards?'Last':'Rewind'):(backwards?'IndexLast':'IndexRewind'),p1:cursor,p2:0});
 const top=ops.length,nullGuards:number[]=[];
 for(const {target,field} of fields){
  ops.push(field<0?{code:'Rowid',p1:cursor,p2:target,inProbe:true}:{code:'Column',p1:field,p2:target,p3:cursor,inProbe:true});
  nullGuards.push(ops.length);ops.push({code:'IsNull',p1:target,p2:0});
 }
 // codeINTerm clamps seekHit after all NULL guards, before the full seek.
 if(earlyout?.keys.length)ops.push({code:'IndexSeekHit',...earlyout});
 return Object.freeze({cursor,reverse:backwards,start,top,nullGuard:nullGuards[0]!,nullGuards:Object.freeze(nullGuards)});
}
/** Emit after the LHS cursor continuation. NULL skips to this slot's Next,
 * not to its outer loop. Empty or exhausted inner slots advance outer slots
 * inside-out; outermost exhaustion reaches the caller's prefix/break label.
 * Caller patches LHS seek/end failures to the returned innermost advance. */
export function finishInLoops(ops:InLoopEndSink,loops:readonly WhereInLoop[],exit:number,leftJoin=false):number {
 const advances:number[]=Array(loops.length);
 for(let i=loops.length-1;i>=0;i--){
  const loop=loops[i]!;
  advances[i]=ops.length;
  const hit=ops[loop.nullGuards.at(-1)!+1] as InLoopOp|undefined;
  const early=hit?.code==='IndexSeekHit'?hit:undefined;
  // where.c: LEFT bypass skips both IfNoHope and movement. With EARLYOUT,
  // NULL skips IfNoHope because its comparison affinity was bypassed.
  if(leftJoin)ops.push({code:'IfNotOpen',p1:loop.cursor,p2:ops.length+(early?3:2)});
  if(early){const {code:_,...prefix}=early;ops.push({code:'IndexIfNoHope',...prefix,p2:ops.length+2});}
  ops.push({code:(ops[loop.start] as InLoopOp).code==='Last'?'Prev':(ops[loop.start] as InLoopOp).code==='Rewind'?'Next':loop.reverse?'IndexPrev':'IndexNext',p1:loop.cursor,p2:loop.top});
 }
 for(let i=0;i<loops.length;i++){
  const loop=loops[i]!,start=ops[loop.start] as InLoopOp,guard=ops[loop.nullGuard] as InLoopOp;
  if((start.code!=='IndexRewind'&&start.code!=='IndexLast'&&start.code!=='Rewind'&&start.code!=='Last')||guard.code!=='IsNull')throw new Error('IN level lost positioning ownership');
  ops[loop.start]={...start,p2:i===0?exit:advances[i-1]!};
  // Initial JumpHere precedes LEFT IfNotOpen. Only EARLYOUT retargets
  // IsNull past IfNoHope (and the LEFT guard): affinity was bypassed.
  for(const address of loop.nullGuards){
   const fieldGuard=ops[address] as InLoopOp;
   if(fieldGuard.code!=='IsNull')throw new Error('IN level lost NULL ownership');
   const early=(ops[loop.nullGuards.at(-1)!+1] as InLoopOp|undefined)?.code==='IndexSeekHit';
   ops[address]={...fieldGuard,p2:advances[i]!+(early?(leftJoin?2:1):0)};
  }
 }
 return advances.at(-1)??exit;
}
