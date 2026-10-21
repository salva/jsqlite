// wherecode.c:codeINTerm and where.c:sqlite3WhereEnd. The SELECT producer
// owns the UNIQUE cursor; this level owns positioning, Column/NULL and restart.
// This module emits native-shaped control flow, not an RHS evaluator.
export type InLoopOp =
 | {readonly code:'IndexRewind'|'IndexLast'|'IndexNext'|'IndexPrev';readonly p1:number;readonly p2:number}
 | {readonly code:'Column';readonly p1:number;readonly p2:number;readonly p3:number;readonly inProbe?:boolean}
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
}
/** Call after linked SRT_Set production. Re-entering start resets this slot;
 * continuing top never reruns the producer. LHS physical DESC is folded by
 * the caller; RHS physical DESC toggles the requested iteration direction. */
export function beginInLoop(ops:InLoopSink,cursor:number,target:number,reverse:boolean,rhsDescending=false,field=0):WhereInLoop {
 const backwards=reverse!==rhsDescending,start=ops.length;
 ops.push({code:backwards?'IndexLast':'IndexRewind',p1:cursor,p2:0});
 const top=ops.length;
 ops.push({code:'Column',p1:field,p2:target,p3:cursor,inProbe:true});
 const nullGuard=ops.length;ops.push({code:'IsNull',p1:target,p2:0});
 return Object.freeze({cursor,reverse:backwards,start,top,nullGuard});
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
  // where.c sqlite3WhereEnd: an earlier NULL equality may bypass RHS
  // construction, then LEFT null-extension still enters this continuation.
  // No prefix-earlyout op is emitted here, so skip precisely one movement.
  if(leftJoin)ops.push({code:'IfNotOpen',p1:loop.cursor,p2:ops.length+2});
  ops.push({code:loop.reverse?'IndexPrev':'IndexNext',p1:loop.cursor,p2:loop.top});
 }
 for(let i=0;i<loops.length;i++){
  const loop=loops[i]!,start=ops[loop.start] as InLoopOp,guard=ops[loop.nullGuard] as InLoopOp;
  if((start.code!=='IndexRewind'&&start.code!=='IndexLast')||guard.code!=='IsNull')throw new Error('IN level lost positioning ownership');
  ops[loop.start]={...start,p2:i===0?exit:advances[i-1]!};
  ops[loop.nullGuard]={...guard,p2:advances[i]!};
 }
 return advances.at(-1)??exit;
}
