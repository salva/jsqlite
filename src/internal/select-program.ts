import type { BuiltinCollation } from "./comparison.ts";
// select.c:sqlite3SelectDestInit and selectInnerLoop SRT_Output/SRT_Mem/
// SRT_Exists. Program construction keeps addresses and register ranges within
// one prepare; a destination is consumed while emitting, not after publication.
export type SelectDest = Readonly<{kind:"coroutine";register:number;first:number}>|Readonly<{kind:"ephemeral";cursor:number}>|Readonly<{kind:"output"}>|Readonly<{kind:"sorter";cursor:number; keyCount?:number}>|Readonly<{kind:"mem"|"exists"; register:number; found?:number}>|Readonly<{kind:"set"; cursor:number}>|Readonly<{kind:"aggregate-expression"; register:number; name:"count"|"sum"|"avg"|"total"|"min"|"max"|"group_concat"|"string_agg"; collation:BuiltinCollation; emitArgument?:(first:number,count:number)=>readonly number[]; emitWhere?:(first:number,count:number)=>number; emitFilter?:(first:number,count:number)=>number; distinctCursor?:number; order?:Readonly<{cursor:number; emitKeys:(first:number,count:number)=>readonly number[]; keyStart:number; payload:number}>}>;
// vdbeaux.c:sqlite3VdbeNoJumpsOutsideSubrtn permits an escaped target
// only when its consecutive Return chain reaches the owning return register.
// TS has no Noop/Explain opcodes. This is verification, not target rewriting.
export function reachesOwningReturn(ops:readonly {readonly code:string;readonly p1?:unknown}[],target:number,returnRegister:number):boolean {
  if(!Number.isSafeInteger(target)||target<0)return false;
  for(let at=target;at<ops.length;at++){
    const op=ops[at]!;
    if(op.code!=="Return")return false;
    if(op.p1===returnRegister)return true;
  }
  return false;
}
export class SelectProgramBuilder<Op extends {readonly code:string}> {
  readonly ops:Op[]=[];
  /** where.c shared construction frontier, including selected arm replanning. */
  readonly wherePlanBudget={remaining:20000};
  registers=0;
  cursors=0;
  private labels=new Map<number,number>();
  private pending:{at:number;label:number;resolve:(op:Op,pc:number)=>Op}[]=[];
  private nextLabel=0;
  private validations:((ops:readonly Op[])=>void)[]=[];
  // Validate only settled addresses, including late enclosing-owner labels.
  validateResolved(validate:(ops:readonly Op[])=>void):void {this.validations.push(validate);}
  register():number{return ++this.registers;}
  range(count:number):number {if(!Number.isSafeInteger(count)||count<1)throw new RangeError("invalid register range");const first=this.registers+1;this.registers+=count;return first;}
  cursor():number{return this.cursors++;}
  // Reserve fixed cursor ranges of producers not yet migrated to nTab ownership.
  reserveCursorsThrough(last:number):void {if(!Number.isSafeInteger(last)||last<0)throw new RangeError("invalid cursor");this.cursors=Math.max(this.cursors,last+1);}
  label():number{return ++this.nextLabel;}
  mark(label:number):void {if(this.labels.has(label))throw new Error("duplicate label");this.labels.set(label,this.ops.length);}
  emit(op:Op):number{return this.ops.push(op)-1;}
  jump(label:number,op:Op,resolve:(op:Op,pc:number)=>Op):void {this.pending.push({at:this.emit(op),label,resolve});}
  // Resolve one closed producer boundary without publishing/freezing the
  // enclosing Vdbe (RIGHT interior validation consumes numeric targets).
  resolveLabel(label:number):void {
    const pc=this.labels.get(label);if(pc===undefined)throw new Error("unresolved SELECT label");
    this.pending=this.pending.filter(entry=>{if(entry.label!==label)return true;this.ops[entry.at]=entry.resolve(this.ops[entry.at]!,pc);return false;});
  }
  finish():readonly Op[]{for(const {at,label,resolve} of this.pending){const pc=this.labels.get(label);if(pc===undefined)throw new Error("unresolved SELECT label");this.ops[at]=resolve(this.ops[at]!,pc);}for(const validate of this.validations)validate(this.ops);return Object.freeze(this.ops);}
}
export function emitSelectDestination<Op extends {readonly code:string}>(ops:Op[],dest:SelectDest,first:number,count:number):void {
  if(count<1)throw new RangeError("empty SELECT destination");
  if(dest.kind==="coroutine"){
    for(let i=0;i<count;i++)ops.push({code:"Copy",p1:first+i,p2:dest.first+i} as unknown as Op);
    ops.push({code:"Yield",p1:dest.register,p2:0} as unknown as Op);
  }
  else if(dest.kind==="ephemeral")ops.push({code:"IdxInsert",p1:dest.cursor,keyStart:first,keyCount:count} as unknown as Op);
  else if(dest.kind==="output")ops.push({code:"ResultRow",p1:first,p2:count} as unknown as Op);
  else if(dest.kind==="sorter")ops.push({code:"SorterInsert",p1:dest.cursor,keyStart:first,keyCount:dest.keyCount??count,payload:first,payloadCount:count} as unknown as Op);
  else if(dest.kind==="aggregate-expression"){
    // select.c:sqlite3Select applies outer WHERE before updateAccumulator;
    // the aggregate FILTER is a separate, later gate for this function.
    const where=dest.emitWhere?.(first,count);
    const reject=where===undefined?-1:ops.push({code:"IfNot",p1:where,p2:0} as unknown as Op)-1;
    const filter=dest.emitFilter?.(first,count);
    const skip=filter===undefined?-1:ops.push({code:"IfNot",p1:filter,p2:0} as unknown as Op)-1;
    const keys=dest.order?.emitKeys(first,count);
    if(keys)keys.forEach((key,index)=>ops.push({code:"Copy",p1:key,p2:dest.order!.keyStart+index} as unknown as Op));
    const arguments_=dest.emitArgument?.(first,count)??[];
    const argument=arguments_[0];
    const duplicate=argument===undefined||dest.distinctCursor===undefined?-1:ops.push({code:"Found",p1:dest.distinctCursor,keyStart:argument,keyCount:1,jump:0} as unknown as Op)-1;
    if(duplicate>=0)ops.push({code:"IdxInsert",p1:dest.distinctCursor!,keyStart:argument!,keyCount:1} as unknown as Op);
    if(dest.order){
      arguments_.forEach((value,index)=>ops.push({code:"Copy",p1:value,p2:dest.order!.payload+index} as unknown as Op));
      ops.push({code:"SorterInsert",p1:dest.order.cursor,keyStart:dest.order.keyStart,keyCount:keys!.length,payload:dest.order.payload,payloadCount:arguments_.length} as unknown as Op);
    }else ops.push({code:"AggStep",name:dest.name,args:[...arguments_],p2:dest.register,collation:dest.collation} as unknown as Op);
    if(duplicate>=0)(ops[duplicate] as unknown as {jump:number}).jump=ops.length;
    if(skip>=0)(ops[skip] as unknown as {p2:number}).p2=ops.length;
    if(reject>=0)(ops[reject] as unknown as {p2:number}).p2=ops.length;
  }
  else if(dest.kind==="set"){if(count!==1)throw new RangeError("IN SELECT destination width");ops.push({code:"IdxInsert",p1:dest.cursor,keyStart:first,keyCount:1} as unknown as Op);}
  else if(dest.kind==="exists")ops.push({code:"Integer",p1:1n,p2:dest.register} as unknown as Op);
  else {if(count!==1)throw new RangeError("scalar SELECT destination width");if(first!==dest.register)ops.push({code:"Copy",p1:first,p2:dest.register} as unknown as Op);if(dest.found!==undefined)ops.push({code:"Integer",p1:1n,p2:dest.found} as unknown as Op);}
}
