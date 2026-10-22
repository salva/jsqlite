import type {Mem} from './mem.ts';
import type {PrivateKeyVmCursor} from './private-key-vm.ts';
import type {PrivateStateControl} from './private-state.ts';
import type {InLoopOp} from './where-in-loop.ts';

type CursorOp=Exclude<InLoopOp,{readonly code:'IsNull'|'IndexSeekHit'|'IndexIfNoHope'}>;
export interface PrivateInDispatchResult {
 readonly handled:boolean;
 readonly jump:number|null;
}
const unhandled:PrivateInDispatchResult=Object.freeze({handled:false,jump:null});
const advanced:PrivateInDispatchResult=Object.freeze({handled:true,jump:null});
/** Private-index branch of the existing Index opcode family, not another
 * interpreter. Persistent cursors are deliberately
 * unhandled. Publication follows the wrapper's native error/state ordering;
 * no jump or register value is reported before its awaited operation succeeds.
 * Column's cursor operand is p3 in this TS opcode representation. IfNotOpen
 * is scoped to a private RHS cursor: missing OR nullRow branches, as native
 * vdbe.c does (not merely presence in the cursor map). */
export async function dispatchPrivateInCursor(
 op:CursorOp,cursors:ReadonlyMap<number,PrivateKeyVmCursor>,registers:readonly Mem[],control:PrivateStateControl,
):Promise<PrivateInDispatchResult>{
 if(op.code==='IfNotOpen'){
  const guarded=cursors.get(op.p1);
  return !guarded||guarded.nullRow?{handled:true,jump:op.p2}:advanced;
 }
 const cursor=cursors.get(op.code==='Column'?op.p3:op.p1);
 if(!cursor||op.code==='Rowid'||op.code==='Rewind'||op.code==='Last'||op.code==='Next'||op.code==='Prev')return unhandled;
 if(op.code==='Column'){
  await cursor.column(op.p1,registers[op.p2]!,control);
  return advanced;
 }
 let positioned:boolean;
 switch(op.code){
  case 'IndexRewind':positioned=await cursor.first(control);break;
  case 'IndexLast':positioned=await cursor.last(control);break;
  case 'IndexNext':positioned=await cursor.next(control);break;
  case 'IndexPrev':positioned=await cursor.previous(control);break;
 }
 const jump=op.code==='IndexNext'||op.code==='IndexPrev'?positioned:!positioned;
 return jump?{handled:true,jump:op.p2}:advanced;
}
