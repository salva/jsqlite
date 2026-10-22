import {JSQLiteError} from '../index.ts';
import type {KeyInfo} from './comparison.ts';
import type {MemAffinity} from './mem.ts';
import type {SelectInLoopRhs} from './where-plan.ts';
import {integerPrimaryKeyColumn,type PhysicalIndex,type TableNode} from './schema.ts';
import {SelectProgramBuilder,type SelectDest} from './select-program.ts';

export type SelectedInProducerOp =
 | {readonly code:'Once';readonly p1:number;readonly p2:number}
 | {readonly code:'OpenEphemeral';readonly p1:number;readonly keyInfo:KeyInfo;readonly p4KeyInfo:KeyInfo};
export type SelectedInStorage =
 | {readonly kind:'ephemeral';readonly descending:false}
 | {readonly kind:'rowid';readonly table:TableNode;readonly descending:false}
 | {readonly kind:'index';readonly physical:PhysicalIndex;readonly descending:boolean;readonly fieldMap?:readonly number[]};
/** expr.c isCandidateForInOpt/sqlite3FindInIndex, scalar IN_INDEX_LOOP.
 * Retain physical identity, not a second SELECT plan. LOOP requires uniqueness;
 * nullable UNIQUE entries are safe because codeINTerm skips every NULL. */
export function selectedInStorage(rhs:SelectInLoopRhs,info:KeyInfo,affinity:MemAffinity):SelectedInStorage {
 const fallback={kind:'ephemeral' as const,descending:false as const};
 const p=rhs.select,plan=rhs.resolved,result=plan.result[0],source=plan.sources[0];
 if(rhs.correlated||!rhs.scalar||p.hasCompound||p.hasDistinct||p.hasGroupBy||p.hasHaving||p.hasLimit||p.where||plan.windows.length||plan.sources.length!==1||!source||source.table.kind!=='table'||p.from.derived||p.from.derivedSources?.length||p.from.cteDerived?.length||p.from.flattenedDerived||result?.expression.tokens.some(token=>token.text.toUpperCase()==='COLLATE')||result?.resolution!=='direct'||result.source!==source||result.columnIndex===null)return fallback;
 const table=source.table,column=table.columns[result.columnIndex];
 if(!table.withoutRowid&&(result.columnIndex<0||column===integerPrimaryKeyColumn(table)))return Object.freeze({kind:'rowid',table,descending:false});
 if(!column)return fallback;
 const numeric=(a:MemAffinity)=>a==='integer'||a==='real'||a==='numeric'||a==='flexnum';
 if(affinity==='text'&&column.affinity!=='text')return fallback;
 if(affinity!=='blob'&&affinity!=='text'&&!numeric(column.affinity))return fallback;
 const collation=info.terms[0]?.collation??'binary',name=typeof collation==='string'?collation:collation.kind;
 for(const index of table.indexes){
  const physical=index.physical;
  if(!physical||!index.unique||index.partialWhere||index.terms.length!==1||index.terms[0]?.column!==column||physical.fields[0]?.collation!==name)continue;
  return Object.freeze({kind:'index',physical,descending:!!physical.fields[0]?.descending});
 }
 return fallback;
}
/** sqlite3FindInIndex LOOP: each RHS output maps to a distinct leading
 * index column with its own comparison collation. Repeated RHS columns cannot
 * reuse one physical slot twice; they use the ordinary UNIQUE SRT_Set path. */
export function selectedVectorInStorage(rhs:SelectInLoopRhs,info:KeyInfo,affinities:readonly MemAffinity[]):SelectedInStorage {
 const fallback={kind:'ephemeral' as const,descending:false as const};
 const p=rhs.select,plan=rhs.resolved,source=plan.sources[0],width=plan.result.length;
 if(rhs.correlated||rhs.scalar||width<2||p.hasCompound||p.hasDistinct||p.hasGroupBy||p.hasHaving||p.hasLimit||p.where||plan.windows.length||plan.sources.length!==1||!source||source.table.kind!=='table'||p.from.derived||p.from.derivedSources?.length||p.from.cteDerived?.length||p.from.flattenedDerived)return fallback;
 const table=source.table;
 const columns=plan.result.map(result=>result.source===source&&result.resolution==='direct'&&result.columnIndex!==null&&!result.expression.tokens.some(token=>token.text.toLowerCase()==='collate')?table.columns[result.columnIndex]:undefined);
 if(columns.some(column=>!column)||affinities.length!==width||info.keyFieldCount!==width)return fallback;
 const numeric=(a:MemAffinity)=>a==='integer'||a==='real'||a==='numeric'||a==='flexnum';
 if(columns.some((column,i)=>affinities[i]==='text'?column!.affinity!=='text':affinities[i]!=='blob'&&!numeric(column!.affinity)))return fallback;
 for(const index of table.indexes){
  const physical=index.physical;
  if(!physical||!index.unique||index.partialWhere||index.terms.length!==width)continue;
  const used=new Set<number>(),map:number[]=[];
  for(let i=0;i<width;i++){
   const collation=info.terms[i]?.collation??'binary',name=typeof collation==='string'?collation:collation.kind;
   const field=index.terms.findIndex((term,j)=>j<width&&term.column===columns[i]&&physical.fields[j]?.collation===name);
   if(field<0||used.has(field))break;
   used.add(field);map.push(field);
  }
  if(map.length===width)return Object.freeze({kind:'index',physical,descending:!!physical.fields[0]?.descending,fieldMap:Object.freeze(map)});
 }
 return fallback;
}
export interface SelectedInSet {
 readonly storage:SelectedInStorage;
 readonly fieldMap:readonly number[];
 readonly rhs:SelectInLoopRhs;
 readonly cursor:number;
 readonly keyInfo:KeyInfo;
 readonly destination:Extract<SelectDest,{kind:'set'}>|null;
 readonly onceRegister:number;
 readonly start:number;
 readonly end:number;
}
/** expr.c sqlite3FindInIndex / sqlite3CodeRhsOfIN, scalar LOOP branches.
 * Eligible base-table ROWID/UNIQUE indices retain physical identity. Otherwise
 * the linked SELECT compiler owns UNIQUE SRT_Set production and parameters.
 * The caller iterates the resulting cursor through WhereInLoop. */
export function emitSelectedInRhs<Op extends {readonly code:string}>(
 builder:SelectProgramBuilder<Op>,rhs:SelectInLoopRhs,keyInfo:KeyInfo,affinity:MemAffinity|readonly MemAffinity[],
 emitSelect:(resolved:SelectInLoopRhs['resolved'],destination:Extract<SelectDest,{kind:'set'}>)=>void,
 storage:SelectedInStorage={kind:'ephemeral',descending:false},
):SelectedInSet {
 // Reject unsupported construction before consuming cursor/register identity.
 const affinities:readonly MemAffinity[]=typeof affinity==='string'?[affinity]:affinity;
 const width=rhs.resolved.result.length;
 if(!rhs.scalar&&width<2)throw new JSQLiteError('unsupported','selected SELECT IN requires a field contract',{unsupportedClassification:'temporary'});
 // EP_VarSelect disallows statement-wide reuse. The caller owns readiness.
 if(rhs.correlated&&storage.kind!=='ephemeral')throw new JSQLiteError('internal','correlated RHS requires ephemeral storage');
 // exprINAffinity and SRT_Set describe every output before allocating state.
 if(affinities.length!==width||keyInfo.keyFieldCount!==width||keyInfo.totalFieldCount!==width)throw new JSQLiteError('internal','selected IN requires matching field affinities and KeyInfo');
 const fieldMap=storage.kind==='index'&&storage.fieldMap?storage.fieldMap:Object.freeze(Array.from({length:width},(_,i)=>storage.kind==='rowid'?-1:i));
 const cursor=builder.cursor(),onceRegister=builder.register();
 const start=builder.ops.length;
 if(!rhs.correlated)builder.emit({code:'Once',p1:onceRegister,p2:0} as unknown as Op);
 if(storage.kind!=='ephemeral'){
  builder.emit((storage.kind==='index'?{code:'OpenIndex',p1:storage.physical.index.rootPage,p2:cursor,physical:storage.physical}:{code:'OpenRead',p1:storage.table.rootPage,p2:cursor}) as unknown as Op);
  const end=builder.ops.length;
  if(!rhs.correlated)builder.ops[start]={code:'Once',p1:onceRegister,p2:end} as unknown as Op;
  return Object.freeze({rhs,fieldMap,cursor,keyInfo:storage.kind==='index'?storage.physical.keyInfo:keyInfo,destination:null,storage,onceRegister,start,end});
 }
 const packedRegister=builder.register();
 const destination=Object.freeze({kind:'set' as const,cursor,width,affinities:Object.freeze([...affinities]),packedRegister});
 builder.emit({code:'OpenEphemeral',p1:cursor,keyInfo,p4KeyInfo:keyInfo} as unknown as Op);
 // Pass the original resolved SELECT, never reconstructed SQL or fake literals.
 emitSelect(rhs.resolved,destination);
 const end=builder.ops.length;
 if(!rhs.correlated)builder.ops[start]={code:'Once',p1:onceRegister,p2:end} as unknown as Op;
 return Object.freeze({rhs,fieldMap,cursor,keyInfo,destination,storage,onceRegister,start,end});
}
