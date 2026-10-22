import type {ExprNode,SelectNode,SourceList} from './parse.ts';
import type {ResolvedSelect,ResolvedSource} from './resolve.ts';
import type {LemonValue} from './lemon-runtime.ts';
import type {SqlToken} from './tokenize.ts';
import {tokenIds} from '../generated/parser-tables.ts';
import {sqliteAsciiFold} from './sqlite-case.ts';

type Reduction=Extract<LemonValue<SqlToken>,{kind:'reduction'}>;
/** select.c:substExpr/substSelect. The caller supplies expressions already
 * qualified to their producer owners. Never infer ownership from token names.
 * This pass substitutes columns only; eligibility, SrcList splicing, expanded
 * stars and LEFT null-row guards belong to the flattening caller. */
export function substituteResolvedColumns(plan:ResolvedSelect,source:ResolvedSource,replacements:readonly ExprNode[]):SelectNode {
 return mapResolvedColumns(plan,use=>{
  if(use.source!==source)return undefined;
  if(use.columnIndex<0)throw new Error('cannot substitute a transient rowid');
  const replacement=replacements[use.columnIndex];
  if(!replacement?.reduction)throw new Error('missing resolved substitution column');
  return replacement;
 });
}
function mapResolvedColumns(plan:ResolvedSelect,replace:(use:ResolvedSelect['columnUses'][number])=>ExprNode|undefined):SelectNode {
 const columns=new Map<Reduction,ExprNode>();
 const collect=(select:ResolvedSelect):void=>{
  for(const use of select.columnUses){
   // lookupName publishes wrapper and leaf; preserve COLLATE/parentheses.
   if(use.expression.signature==='expr ::= LP expr RP'||use.expression.signature.startsWith('expr ::= expr COLLATE'))continue;
   const replacement=replace(use);
   if(replacement)columns.set(use.expression,replacement);
  }
  for(const child of select.nested)collect(child);
  for(const arm of select.compoundArms??[])collect(arm);
 };
 collect(plan);
 const leaves=(value:LemonValue<SqlToken>):SqlToken[]=>value.kind==='terminal'?[value.value]:value.children.flatMap(leaves);
 const reduction=(value:LemonValue<SqlToken>):LemonValue<SqlToken>=>{
  if(value.kind==='terminal')return value;
  const replacement=columns.get(value);
  if(replacement)return replacement.reduction!;
  const semantic=value.semantic;
  if(value.signature.startsWith('select ::=')&&semantic&&typeof semantic==='object'&&'kind' in semantic&&semantic.kind==='select'){
   return Object.freeze({...value,children:Object.freeze(value.children.map(reduction)),semantic:select(semantic as SelectNode)});
  }
  return Object.freeze({...value,children:Object.freeze(value.children.map(reduction))});
 };
 const expression=(value:ExprNode):ExprNode=>{
  if(!value.reduction)return value;
  const mapped=reduction(value.reduction) as Reduction;
  return Object.freeze({...value,reduction:mapped,tokens:Object.freeze(leaves(mapped))});
 };
 const sourceList=(from:SourceList):SourceList=>Object.freeze(Object.assign([...from],{
   ...from,tokens:from.tokens,
   items:Object.freeze(from.items.map(item=>Object.freeze({...item,on:item.on?expression(item.on):null,arguments:item.arguments?Object.freeze(item.arguments.map(expression)):null}))),
   ...(from.derived?{derived:Object.freeze({...from.derived,select:select(from.derived.select)})}:{}),
   ...(from.derivedSources?{derivedSources:Object.freeze(from.derivedSources.map(item=>Object.freeze({...item,select:select(item.select)})))}:{}),
   ...(from.cteDerived?{cteDerived:Object.freeze(from.cteDerived.map(item=>Object.freeze({...item,select:select(item.select)})))}:{})
  }));
 // substSelect(...,1) visits every pPrior with its own SrcList. The parser
 // also carries the selected EList separately; map both carriers, not arm0.
 const select=(value:SelectNode):SelectNode=>{
  const mappedFrom=sourceList(value.from);
  const result=Object.freeze(value.result.map(expression)),where=value.where?expression(value.where):null;
  const groupBy=Object.freeze(value.groupBy.map(expression)),having=value.having?expression(value.having):null;
  return Object.freeze({...value,result,from:mappedFrom,where,groupBy,having,
   orderBy:Object.freeze(value.orderBy.map(term=>Object.freeze({...term,expr:expression(term.expr)}))),
   arms:Object.freeze(value.arms.map(arm=>Object.freeze({...arm,
    result:Object.freeze(arm.result.map(expression)),from:sourceList(arm.from),
    where:arm.where?expression(arm.where):null,
    groupBy:Object.freeze((arm.groupBy??[]).map(expression)),having:arm.having?expression(arm.having):null,
    valuesRows:arm.valuesRows?Object.freeze(arm.valuesRows.map(row=>Object.freeze(row.map(expression)))):null
   })))});
 };
 return select(plan.source);
}

/** select.c flattenSubquery SrcItem transfer/substSelect for a resolved,
 * eligible first-source producer with one physical SrcItem. Eligibility is
 * deliberately a caller decision; this primitive rejects retained producer
 * destinations and outer-join null-row ownership it cannot transfer. */
export function spliceResolvedFirstSource(plan:ResolvedSelect,producer:ResolvedSelect):SelectNode {
 const source=plan.sources[0],inner=producer.sources[0];
 if(!source||!inner||producer.sources.length!==1||plan.source.hasCompound||producer.source.hasCompound)
  throw new Error('resolved splice requires isolated first-source producer');
 if([...plan.source.result,...producer.source.result].some(expr=>expr.tokens.length===1&&expr.tokens[0]!.text==='*'||expr.tokens.length===3&&expr.tokens[1]!.text==='.'&&expr.tokens[2]!.text==='*'))
  throw new Error('resolved splice requires explicit result expressions');
 if(plan.result.length!==plan.source.result.length||producer.result.length!==producer.source.result.length)
  throw new Error('resolved splice requires explicit expanded result expressions');
 if(producer.source.hasDistinct||producer.source.hasGroupBy||producer.source.hasHaving||producer.source.hasOrderBy||producer.source.hasLimit||producer.windows.length||plan.windows.length)
  throw new Error('resolved splice requires caller flattening eligibility');
 const original=plan.source.from.items[0]!;
 if(original.joinFromLeft.left||original.joinFromLeft.right||original.leftOfRightJoin||original.on||original.using)
  throw new Error('resolved splice requires a non-null-extended producer');
 if(producer.source.from.derived||producer.source.from.derivedSources?.length||producer.source.from.cteDerived?.length)
  throw new Error('resolved splice requires a physical producer');
 // C keeps cursor identity after transfer. Our immutable AST is re-resolved;
 // allocate a private spelling absent from every linked NameContext instead.
 const names=new Set<string>();
 const collect=(node:ResolvedSelect):void=>{
  for(const item of node.sources)names.add(sqliteAsciiFold(item.alias??item.tableName));
  for(const child of node.nested)collect(child);
 };
 collect(plan);collect(producer);
 let alias='__flatten_0',serial=0;
 while(names.has(sqliteAsciiFold(alias)))alias=`__flatten_${++serial}`;
 const qualified=qualifyResolvedSource(producer,inner,alias);
 const mapped=substituteResolvedColumns(plan,source,qualified.result);
 // Names were established on the transient Table before substitution in C.
 // Never publish the generated alias as a public result-column name.
 const result=Object.freeze(mapped.result.map((expr,index)=>Object.freeze({...expr,alias:plan.result[index]!.name})));
 const items=Object.freeze([Object.freeze({...qualified.from.items[0]!,alias,
  joinFromLeft:original.joinFromLeft,leftOfRightJoin:original.leftOfRightJoin}),...mapped.from.items.slice(1)]);
 const {derived,derivedSources,cteDerived,...rest}=mapped.from;
 const remainingDerived=derivedSources?.filter(item=>item.index!==0);
 const remainingCte=cteDerived?.filter(item=>item.index!==0);
 const from=Object.freeze(Object.assign([...mapped.from],{...rest,items,
  ...(derived&&derived.index!==0?{derived}:{}),
  ...(remainingDerived?.length?{derivedSources:Object.freeze(remainingDerived)}:{}),
  ...(remainingCte?.length?{cteDerived:Object.freeze(remainingCte)}:{})}));
 let where=mapped.where;
 if(qualified.where){
  if(!where)where=qualified.where;
  else{
   if(!where.reduction||!qualified.where.reduction)throw new Error('resolved splice lost predicate reduction');
   const and:SqlToken=Object.freeze({kind:'keyword',startByte:0,endByte:0,text:'AND'});
   where=Object.freeze({kind:'tokens',tokens:Object.freeze([...qualified.where.tokens,and,...where.tokens]),
    reduction:Object.freeze({kind:'reduction',rule:-1,signature:'expr ::= expr AND expr',children:Object.freeze([qualified.where.reduction,Object.freeze({kind:'terminal',tokenId:tokenIds.AND!,value:and}),where.reduction])})});
  }
 }
 return Object.freeze({...mapped,result,from,where,hasSubquery:mapped.hasSubquery||qualified.hasSubquery,
  arms:Object.freeze(mapped.arms.map((arm,index)=>index===0?Object.freeze({...arm,result,from,where}):arm))});
}

/** Render an already-resolved column under the splice owner's fresh alias.
 * This is not another lookup by spelling. The caller renames the SrcItem and
 * chooses an alias absent from every child NameContext before re-resolution. */
export function qualifyResolvedSource(plan:ResolvedSelect,source:ResolvedSource,alias:string):SelectNode {
 return mapResolvedColumns(plan,use=>{
  if(use.source!==source)return undefined;
  const table=source.table;
  // resolve.c canonicalizes an INTEGER PRIMARY KEY to -1. Prefer its real
  // name: a declared `rowid` column may hide the pseudo-column spelling.
  const rowidName=table.kind==='table'&&table.integerPrimaryKey?table.integerPrimaryKey.name:
   ['rowid','_rowid_','oid'].find(name=>!table.columns.some(column=>column.name.toLowerCase()===name));
  const name=use.columnIndex<0?rowidName:table.columns[use.columnIndex]?.name;
  if(name===undefined)throw new Error('resolved producer lost its column');
  const quote=(text:string)=>`"${text.replaceAll('"','""')}"`;
  const token=(text:string):SqlToken=>Object.freeze({kind:'id',startByte:0,endByte:0,text});
  const terminal=(text:string,id:number):LemonValue<SqlToken>=>Object.freeze({kind:'terminal',tokenId:id,value:token(text)});
  const nm=(text:string):Reduction=>Object.freeze({kind:'reduction',rule:-1,signature:'nm ::= ID|INDEXED|JOIN_KW',children:Object.freeze([terminal(quote(text),tokenIds.ID!)])});
  const reduction:Reduction=Object.freeze({kind:'reduction',rule:-1,signature:'expr ::= nm DOT nm',children:Object.freeze([nm(alias),terminal('.',tokenIds.DOT!),nm(name)])});
  return Object.freeze({kind:'tokens',tokens:Object.freeze([token(quote(alias)),token('.'),token(quote(name))]),reduction});
 });
}
