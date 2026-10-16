import { JSQLiteError } from '../index.ts';
import { sqliteAsciiFold } from './sqlite-case.ts';
import { resolvedExpressionCarrier, type ResolvedSelect, type ResolvedSource } from './resolve.ts';

export interface JsonTableConstraint {
 readonly column: number;
 readonly usable: boolean;
 readonly equality: boolean;
}
export interface JsonTableIndex {
 readonly idxNum: 0|1|3;
 /** Constraint indexes in xFilter argument order (JSON, then ROOT). */
 readonly arguments: readonly number[];
}

/** json.c:jsonEachBestIndex. Callers own dependency/readiness classification;
 * resolving a column name does not establish that its value is usable here.
 * Visible constraints remain residual predicates, as do unselected hidden EQs.
 * This does not enroll a module or manufacture a physical schema table. */
export function chooseJsonTableIndex(constraints:readonly JsonTableConstraint[],jsonColumn=8):JsonTableIndex {
 const selected=[-1,-1];
 let unusableMask=0,idxMask=0;
 for(let i=0;i<constraints.length;i++){
  const constraint=constraints[i]!;
  if(constraint.column<jsonColumn)continue;
  const column=constraint.column-jsonColumn;
  if(column>1)throw new JSQLiteError('internal','invalid JSON hidden column');
  const mask=1<<column;
  if(!constraint.usable)unusableMask|=mask;
  else if(constraint.equality){selected[column]=i;idxMask|=mask;}
 }
 if((unusableMask&~idxMask)!==0)throw new JSQLiteError('sqlite','no query solution',{code:1});
 if(selected[0]===-1)return {idxNum:0,arguments:[]};
 return selected[1]===-1?{idxNum:1,arguments:[selected[0]!]}:{idxNum:3,arguments:[selected[0]!,selected[1]!]};
}

/** where.c:whereLoopAddVirtualOne's prereqRight subset test, over linked
 * source identities instead of native Bitmask bits. Nested SELECT locals are
 * produced inside the argument; their external references remain prerequisites.
 * Availability is supplied by the loop planner, never inferred from scope or
 * selectDepth. This does not decide aggregate-phase or operator eligibility. */
export function jsonTableInputReady(
 expression:import('./resolve.ts').ResolvedExpressionCarrier,
 available:ReadonlySet<import('./resolve.ts').ResolvedSource>,
):boolean {
 const dependencies=new Set<import('./resolve.ts').ResolvedSource>();
 const local=new Set<import('./resolve.ts').ResolvedSource>();
 const collectSelect=(plan:import('./resolve.ts').ResolvedSelect):void=>{
  for(const source of plan.sources)local.add(source);
  for(const use of plan.columnUses){
   dependencies.add(use.source);
   for(const merged of use.mergedSources??[])dependencies.add(merged.source);
  }
  for(const child of plan.nested)collectSelect(child);
  for(const arm of plan.compoundArms??[])collectSelect(arm);
 };
 const collect=(node:import('./resolve.ts').ResolvedExpressionCarrier):void=>{
  if(node.column){
   dependencies.add(node.column.source);
   for(const merged of node.column.mergedSources??[])dependencies.add(merged.source);
  }
  if(node.select)collectSelect(node.select);
  for(const child of node.children)collect(child);
 };
 collect(expression);
 for(const source of dependencies)if(!local.has(source)&&!available.has(source))return false;
 return true;
}

export interface LinkedJsonTableConstraint {
 readonly column:number;
 readonly equality:boolean;
 readonly rhs:import('./resolve.ts').ResolvedExpressionCarrier;
 /** whereLoopAddVirtualOne mExclude, determined by the enclosing loop. */
 readonly excluded?:boolean;
 readonly limit?:boolean;
}

/** Join whereLoopAddVirtualOne's usable classification to jsonEachBestIndex.
 * Callers still own constraint production (including pFuncArg's unary-plus
 * affinity barrier), available loop positions, and aggregate-phase legality.
 * The initial call permits LIMIT terms (non-NULL pbRetryLimit); a retry
 * without LIMIT passes NULL and excludes them, not the reverse.
 * Returning argument indexes does not consume any residual predicate. */
export function planJsonTableConstraints(
 constraints:readonly LinkedJsonTableConstraint[],
 available:ReadonlySet<import('./resolve.ts').ResolvedSource>,
 retryWithoutLimit=false,
):JsonTableIndex {
 return chooseJsonTableIndex(constraints.map(constraint=>({
  column:constraint.column,
  equality:constraint.equality,
  usable:jsonTableInputReady(constraint.rhs,available)
   &&!constraint.excluded&&(!retryWithoutLimit||!constraint.limit),
 })));
}

export interface JsonTableArgumentConstraint extends LinkedJsonTableConstraint {
 readonly source:ResolvedSource;
 /** TK_UPLUS strips the argument's affinity; it does not coerce its value. */
 readonly rhsAffinity:'none';
 readonly joinOrigin:'inner'|'outer';
 readonly joinOwner:ResolvedSource;
}

/** whereexpr.c:sqlite3WhereTabFuncArgs for JSON's two hidden columns.
 * Retain the linked RHS rather than reconstructing it from tokens. The explicit
 * affinity barrier and ON owner must be consumed by the eventual loop emitter;
 * these terms are not ordinary WHERE equalities and do not remove residuals.
 * This produces constraints only, not module enrollment or loop admission. */
export function jsonTableArgumentConstraints(
 plan:ResolvedSelect,source:ResolvedSource,
):readonly JsonTableArgumentConstraint[] {
 const args=source.arguments??[];
 if(args.length>2)throw new JSQLiteError('sqlite',`too many arguments on ${source.tableName}() - max 2`,{code:1});
 return args.map((argument,index)=>{
  if(argument.reduction?.kind!=='reduction')throw new JSQLiteError('internal','JSON argument lost linked reduction');
  return {
   source,joinOwner:source,column:8+index,equality:true,
   rhs:resolvedExpressionCarrier(plan,argument.reduction),
   rhsAffinity:'none',
   joinOrigin:source.joinFromLeft.left||source.joinFromLeft.right?'outer':'inner',
  };
 });
}

export interface JsonTableEqualityConstraint extends LinkedJsonTableConstraint {
 readonly source:ResolvedSource;
 /** Ordinary WHERE RHS retains its expression affinity (unlike pFuncArg). */
 readonly rhsAffinity:'expression';
 readonly residual:import('./resolve.ts').ResolvedExpressionCarrier;
 readonly joinOrigin?:'inner'|'outer';
 readonly joinOwner?:ResolvedSource;
}

/** whereexpr.c:sqlite3WhereSplit/exprAnalyze's ordinary hidden EQ slice.
 * Split AND only; compare linked column ownership, never SQL spelling.
 * Reverse EQ exposes the other operand without discarding its affinity.
 * WHERE/ON (including duplicates) remains residual. This neither enrolls nor
 * schedules a module; join scheduling and non-EQ stay with the enclosing planner.
 */
export function jsonTableEqualityConstraints(
 plan:ResolvedSelect,source:ResolvedSource,
):readonly JsonTableEqualityConstraint[] {
 const terms:JsonTableEqualityConstraint[]=[];
 const visit=(node:import('./resolve.ts').ResolvedExpressionCarrier,joinOwner?:ResolvedSource):void=>{
  if(node.reduction.signature==='expr ::= expr AND expr'){
   for(const child of node.children)visit(child,joinOwner);
   return;
  }
  if(node.reduction.signature!=='expr ::= expr EQ|NE expr'
   ||!node.reduction.children.some(child=>child.kind==='terminal'&&(child.value.text==='='||child.value.text==='=='))
   ||node.children.length!==2)return;
  for(let side=0;side<2;side++){
   const column=node.children[side]!.column;
   if(!column||column.source!==source||column.mergedSources?.length
    ||column.columnIndex<8||column.columnIndex>9)continue;
   terms.push({source,column:column.columnIndex,equality:true,
    rhs:node.children[1-side]!,rhsAffinity:'expression',residual:node,
    ...(joinOwner?{joinOwner,joinOrigin:joinOwner.joinFromLeft.left||joinOwner.joinFromLeft.right?'outer' as const:'inner' as const}:{})});
  }
 };
 const where=plan.source.where;
 if(where?.reduction?.kind==='reduction')visit(resolvedExpressionCarrier(plan,where.reduction));
 // select.c:sqlite3ProcessJoin appends ON terms in source order and marks
 // their owning join cursor, even when the constrained column is elsewhere.
 for(const owner of plan.sources){
  if(owner.on?.reduction?.kind==='reduction')visit(resolvedExpressionCarrier(plan,owner.on.reduction),owner);
 }
 return terms;
}

export interface JsonTableComparisonConstraint extends LinkedJsonTableConstraint {
 readonly source:ResolvedSource;
 readonly operator:'<'|'<='|'>'|'>='|'IS';
 readonly equality:false;
 readonly rhsAffinity:'expression';
 readonly residual:import('./resolve.ts').ResolvedExpressionCarrier;
 readonly joinOrigin?:'inner'|'outer';
 readonly joinOwner?:ResolvedSource;
}

/** where.c:allocateIndexInfo passes ranges and IS through to xBestIndex.
 * jsonEachBestIndex ignores usable non-EQ terms but still records their
 * unusable hidden-column masks. Keep them residual, never filter arguments.
 * This bounded producer does not synthesize BETWEEN/IN/ISNULL virtual terms. */
export function jsonTableComparisonConstraints(
 plan:ResolvedSelect,source:ResolvedSource,
):readonly JsonTableComparisonConstraint[] {
 const terms:JsonTableComparisonConstraint[]=[];
 const reverse={'<':'>','<=':'>=','>':'<','>=':'<=','IS':'IS'} as const;
 const visit=(node:import('./resolve.ts').ResolvedExpressionCarrier,joinOwner?:ResolvedSource):void=>{
  if(node.reduction.signature==='expr ::= expr AND expr'){
   for(const child of node.children)visit(child,joinOwner);
   return;
  }
  if(node.children.length!==2)return;
  let operator:JsonTableComparisonConstraint['operator'];
  if(node.reduction.signature==='expr ::= expr IS expr')operator='IS';
  else if(node.reduction.signature==='expr ::= expr LT|GT|GE|LE expr'){
   const token=node.reduction.children.find(child=>child.kind==='terminal');
   if(token?.kind!=='terminal')return;
   const text=token.value.text;
   if(text!=='<'&&text!=='<='&&text!=='>'&&text!=='>=')return;
   operator=text;
  }else return;
  for(let side=0;side<2;side++){
   const column=node.children[side]!.column;
   if(!column||column.source!==source||column.mergedSources?.length
    ||column.columnIndex<8||column.columnIndex>9)continue;
   terms.push({source,column:column.columnIndex,equality:false,
    operator:side===0?operator:reverse[operator],
    rhs:node.children[1-side]!,rhsAffinity:'expression',residual:node,
    ...(joinOwner?{joinOwner,joinOrigin:joinOwner.joinFromLeft.left||joinOwner.joinFromLeft.right?'outer' as const:'inner' as const}:{})});
  }
 };
 if(plan.source.where?.reduction?.kind==='reduction')visit(resolvedExpressionCarrier(plan,plan.source.where.reduction));
 for(const owner of plan.sources){
  if(owner.on?.reduction?.kind==='reduction')visit(resolvedExpressionCarrier(plan,owner.on.reduction),owner);
 }
 return terms;
}

export type JsonTableSourceConstraint = JsonTableEqualityConstraint|JsonTableComparisonConstraint|JsonTableArgumentConstraint;

/** where.c:sqlite3WhereBegin splits WHERE before adding pFuncArg terms via
 * sqlite3WhereTabFuncArgs. jsonEachBestIndex selects the last usable EQ for
 * each hidden column, so producer order is semantic, not just bookkeeping.
 * Keep ordinary terms as residuals, including those not selected by BestIndex.
 * Enrollment and actual loop availability remain caller-owned. */
export function jsonTableConstraints(
 plan:ResolvedSelect,source:ResolvedSource,
):readonly JsonTableSourceConstraint[] {
 // whereexpr.c:sqlite3WhereSplit inserts leaves left-to-right, independently
 // of operator. Do not concatenate operator buckets: indexes in aConstraint
 // and aConstraintUsage must keep the same ordinary-term identity/order.
 const order=new Map<import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>,number>();
 const visit=(node:import('./resolve.ts').ResolvedExpressionCarrier):void=>{
  if(node.reduction.signature==='expr ::= expr AND expr'){
   for(const child of node.children)visit(child);
  }else if(!order.has(node.reduction))order.set(node.reduction,order.size);
 };
 if(plan.source.where?.reduction?.kind==='reduction')visit(resolvedExpressionCarrier(plan,plan.source.where.reduction));
 for(const owner of plan.sources){
  if(owner.on?.reduction?.kind==='reduction')visit(resolvedExpressionCarrier(plan,owner.on.reduction));
 }
 const ordinary=[...jsonTableEqualityConstraints(plan,source),...jsonTableComparisonConstraints(plan,source)];
 ordinary.sort((a,b)=>order.get(a.residual.reduction)!-order.get(b.residual.reduction)!);
 return [...ordinary,...jsonTableArgumentConstraints(plan,source)];
}

export interface JsonTableDeclaration {
 readonly name:'json_each'|'json_tree'|'jsonb_each'|'jsonb_tree';
 readonly binary:boolean;
 readonly recursive:boolean;
 readonly columns:readonly {
  readonly name:string;
  readonly hidden:boolean;
  readonly declaredType:''|null;
  readonly affinity:'blob';
 }[];
}

/** json.c:jsonEachConnect's declared virtual schema and connection modes.
 * The four immutable declarations are shared across ASCII-case lookup aliases;
 * linked source occurrences must still retain distinct cursor identities.
 * This is declaration identity only, not a cached connection or cursor.
 * This descriptor has no btree identity and does not enroll or admit a source.
 * Hidden fields remain in the declaration for explicit lookup and xBestIndex;
 * eventual star expansion must omit them, not discard their column indexes.
 * sqlite3_declare_vtab leaves visible untyped fields at NULL decltype, but the
 * HIDDEN suffix leaves an empty type string after native hidden-token removal
 * (vtab.c:sqlite3_declare_vtab). Public column metadata distinguishes the two.
 */
const jsonTableDeclarations:ReadonlyMap<string,JsonTableDeclaration>=new Map(
 (['json_each','json_tree','jsonb_each','jsonb_tree'] as const).map(name=>[name,Object.freeze({
  name,
  binary:name.startsWith('jsonb_'),
  recursive:name.endsWith('_tree'),
  columns:Object.freeze(['key','value','type','atom','id','parent','fullkey','path','json','root'].map((name,index)=>Object.freeze({
   name,hidden:index>=8,declaredType:index>=8?'' as const:null,affinity:'blob' as const,
  }))),
 })]),
);

export function jsonTableDeclaration(name:string):JsonTableDeclaration|undefined {
 return jsonTableDeclarations.get(sqliteAsciiFold(name));
}
