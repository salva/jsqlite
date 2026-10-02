import type {LemonValue} from "./lemon-runtime.ts";
import type {ExprNode, OrderTermNode, SelectNode} from "./parse.ts";
import {resolvedExpressionCarrier, type ResolvedExpressionCarrier, expressionStructurallyEqual, type ResolvedColumnUse, type ResolvedResult, type ResolvedSelect, type ResolvedSource, type ResolvedWindow} from "./resolve.ts";
import {sqliteAsciiFold} from "./sqlite-case.ts";
import type {SqlToken} from "./tokenize.ts";
import {productions, tokenIds} from "../generated/parser-tables.ts";

type Reduction=Extract<LemonValue<SqlToken>,{kind:"reduction"}>;
export interface WindowExpressionBinding {readonly source:ResolvedSource;readonly columnIndex:number}
export interface WindowRewriteFunction {readonly window:ResolvedWindow;readonly regAccum:number;readonly regResult:number;readonly argumentColumn:number;readonly filterColumn:number|null;readonly filterCarrier:ResolvedExpressionCarrier|null}
export interface WindowRewriteSortTerm {readonly expression:ExprNode;readonly binding:WindowExpressionBinding|null;readonly source:"partition"|"order";readonly copiedIntegerToNull:boolean;readonly descending:boolean;readonly nulls:"first"|"last"|null}
export interface WindowLiftedExpression {readonly expression:ExprNode;readonly kind:"column"|"aggregate"|"window";readonly bufferColumn:number;readonly selectDepth:number;readonly aggregateDepthBefore:number|null;readonly aggregateDepthAfter:number|null;readonly correlatedFromScalarSubquery:boolean}
export interface WindowAggregateDepthRepair {readonly expression:ExprNode;readonly selectDepth:number;readonly aggregateDepthBefore:number;readonly aggregateDepthAfter:number}
export interface WindowRewriteOriginalProducer {
 readonly kind:"original";readonly nonFlattenable:true;readonly correlated:true;
 readonly sourcePredicates:readonly ResolvedExpressionCarrier[];
 readonly from:SelectNode["from"];readonly where:ExprNode|null;readonly groupBy:readonly ExprNode[];readonly having:ExprNode|null;
}
export interface WindowRewriteNestedProducer {
 readonly kind:"rewritten-select";readonly nonFlattenable:true;readonly correlated:true;
 readonly parentCompatibleGroup:number;readonly select:WindowRewrittenSelect;
}
export type WindowRewriteProducer=WindowRewriteOriginalProducer|WindowRewriteNestedProducer;
export interface WindowRewrittenSelect {
 readonly compatibleGroup:number;readonly subquery:WindowRewriteProducer;
}
export interface WindowRewriteLayer {
 readonly compatibleGroup:number;readonly windows:readonly WindowRewriteFunction[];readonly producerOrderBy:readonly WindowRewriteSortTerm[];readonly bufferExpressions:readonly ExprNode[];readonly bufferBindings:readonly (WindowExpressionBinding|null)[];readonly lifted:readonly WindowLiftedExpression[];readonly aggregateDepthRepairs:readonly WindowAggregateDepthRepair[];
 readonly iEphCsr:number;readonly duplicateCursors:readonly [number,number,number];readonly regGosub:number;readonly addrGosub:number;
 readonly handoff:readonly [{readonly code:"Gosub";readonly register:number;readonly address:number},{readonly code:"Return";readonly register:number}];
 readonly producer:WindowRewriteProducer;
}
type WindowRewriteLayerState=Omit<WindowRewriteLayer,"producer">;
export interface WindowRewriteGraph {
 readonly source:ResolvedSelect;readonly layers:readonly WindowRewriteLayer[];readonly root:WindowRewrittenSelect|null;
 readonly outer:Readonly<{orderBy:readonly OrderTermNode[];originalOrderBy:readonly OrderTermNode[];orderPrefixElided:boolean;limit:ExprNode|null;offset:ExprNode|null;result:readonly ResolvedResult[]}>;
 readonly movedClauses:readonly ["from","where","groupBy","having"];readonly retainedClauses:readonly ["orderBy","limit","offset"];
 readonly multipleWindowPartitions:boolean;readonly frameExecution:"unsupported";
}
const aggregateNames=new Set(["avg","count","group_concat","max","min","sum","total","string_agg","json_group_array","jsonb_group_array","json_group_object","jsonb_group_object","median","percentile","percentile_cont","percentile_disc"]);
function leaves(node:LemonValue<SqlToken>):SqlToken[]{return node.kind==="terminal"?(node.value?[node.value]:[]):node.children.flatMap(leaves)}
function expression(node:Reduction,alias?:string):ExprNode{return Object.freeze({kind:"tokens",tokens:Object.freeze(leaves(node)),reduction:node,...(alias===undefined?{}:{alias})})}
function functionName(node:Reduction):string|null{if(!node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP"))return null;const token=node.children.find(child=>child.kind==="terminal")?.value;return token?sqliteAsciiFold(token.text):null}
function integerSortKey(value:ExprNode):boolean{
 const unwrap=(node:LemonValue<SqlToken>):LemonValue<SqlToken>=>{if(node.kind!=="reduction")return node;if(node.signature.startsWith("expr ::= LP expr RP")||node.signature.startsWith("expr ::= expr COLLATE")||node.signature==="expr ::= term"){const child=node.children.find(item=>item.kind==="reduction"&&(item.signature.startsWith("expr ::=")||item.signature.startsWith("term ::=")));return child?unwrap(child):node;}return node;};
 const node=value.reduction?unwrap(value.reduction):undefined;return !!node&&node.kind==="reduction"&&node.signature==="term ::= INTEGER";
}
const nullTermRule=productions.find(production=>production.signature==="term ::= NULL|FLOAT|BLOB")?.id;
/** sqlite3ExprDup plus exprListAppendList's bIntToNull mutation. The generated
 * producer owns this tree; frame expressions remain immutable and unchanged. */
function copySortExpression(value:ExprNode,integerToNull:boolean):ExprNode{
 const copy=(node:LemonValue<SqlToken>):LemonValue<SqlToken>=>{
  if(node.kind==="terminal")return Object.freeze({kind:"terminal" as const,tokenId:node.tokenId,value:Object.freeze({...node.value})});
  if(integerToNull&&node.signature==="term ::= INTEGER"){
   if(nullTermRule===undefined)throw new Error("generated parser lacks NULL term production");
   const source=leaves(node)[0];if(!source)throw new Error("integer terminal lacks source token");
   const token=Object.freeze({...source,kind:"keyword" as const,text:"NULL"});
   return Object.freeze({kind:"reduction" as const,rule:nullTermRule,signature:"term ::= NULL|FLOAT|BLOB",children:Object.freeze([Object.freeze({kind:"terminal" as const,tokenId:tokenIds.NULL,value:token})])});
  }
  return Object.freeze({kind:"reduction" as const,rule:node.rule,signature:node.signature,children:Object.freeze(node.children.map(copy)),...(node.semantic===undefined?{}:{semantic:node.semantic})});
 };
 const reduction=value.reduction?copy(value.reduction):undefined;
 return Object.freeze({kind:"tokens",tokens:Object.freeze(reduction?leaves(reduction):value.tokens.map(token=>Object.freeze({...token}))),...(reduction?{reduction}:{}),...(value.alias===undefined?{}:{alias:value.alias})});
}
function windowOrderFlags(window:ResolvedWindow):readonly Pick<WindowRewriteSortTerm,"descending"|"nulls">[]{
 const root=window.owner.reduction;
 if(!root)return Object.freeze([]);
 const find=(node:LemonValue<SqlToken>):Reduction|undefined=>node.kind!=="reduction"?undefined:node.signature.startsWith("sortlist ::=")?node:node.children.map(find).find((value):value is Reduction=>!!value);
 const list=find(root);if(!list)return Object.freeze([]);
 const terms:{node:Reduction;prior:Reduction|undefined}[]=[];
 const collect=(node:Reduction):void=>{const prior=node.children.find((child):child is Reduction=>child.kind==="reduction"&&child.signature.startsWith("sortlist ::="));if(prior)collect(prior);terms.push({node,prior});};collect(list);
 return Object.freeze(terms.map(({node,prior})=>{
  // Recursive sortlist nodes contain every preceding term. Read flags only
  // from this node's appended item, matching ExprList_item.sortFlags.
  const words=node.children.filter(child=>child!==prior).flatMap(leaves).map(token=>sqliteAsciiFold(token.text));
  return Object.freeze({descending:words.includes("desc"),nulls:words.includes("nulls")?(words.includes("first")?"first" as const:"last" as const):null});
 }));
}
function sameOrderTerm(parent:OrderTermNode,producer:WindowRewriteSortTerm,resolved:ResolvedSelect):boolean{
 // expr.c:sqlite3ExprListCompare compares sort flags before sqlite3ExprCompare.
 // The generated sort is a deep copy, so parser-node identity is unavailable.
 return parent.descending===producer.descending&&parent.nulls===producer.nulls&&
  expressionStructurallyEqual(parent.expr,producer.expression,resolved.source.from.items,false);
}
function windowArguments(owner:ExprNode):readonly ExprNode[]{
 const call=owner.reduction;
 if(!call||call.kind!=="reduction")return Object.freeze([]);
 const list=call.children.find((child):child is Reduction=>child.kind==="reduction"&&child.signature.startsWith("exprlist ::="));
 if(!list)return Object.freeze([]);
 const collect=(node:Reduction):ExprNode[]=>{
  if(node.signature==="exprlist ::=")return [];
  const nested=node.children.find((child):child is Reduction=>child.kind==="reduction"&&child.signature.startsWith("nexprlist ::="));
  if(node.signature.startsWith("exprlist ::="))return nested?collect(nested):[];
  const argument=node.children.find((child):child is Reduction=>child.kind==="reduction"&&child.signature.startsWith("expr ::="));
  return [...(nested?collect(nested):[]),...(argument?[expression(argument)]:[])];
 };
 return Object.freeze(collect(list));
}

/** selectWindowRewriteExprCb/selectWindowRewriteSelectCb over immutable nodes.
 * Scalar subqueries are traversed, but only qualified columns owned by the
 * original outer SrcList cross that boundary. Local columns/functions stay put. */
function liftExpressions(owners:readonly ExprNode[],select:ResolvedSelect,main:ResolvedWindow):{readonly lifted:WindowLiftedExpression[];readonly aggregateDepthRepairs:WindowAggregateDepthRepair[]}{
 const output:WindowLiftedExpression[]=[], repairs:WindowAggregateDepthRepair[]=[], outerCursors=new Set(select.sources.map(source=>source.cursorId));
 const uses=new Map<Reduction,{readonly cursorId:number;readonly selectDepth:number}>();
 const collectUses=(resolved:ResolvedSelect):void=>{for(const use of resolved.columnUses)uses.set(use.expression,{cursorId:use.source.cursorId,selectDepth:use.selectDepth});resolved.nested.forEach(collectUses);};
 collectUses(select);
 const append=(node:Reduction,kind:WindowLiftedExpression["kind"],depth:number,correlated:boolean,aggDepth:number|null)=>{const expr=expression(node);output.push(Object.freeze({expression:expr,kind,bufferColumn:output.length,selectDepth:depth,aggregateDepthBefore:aggDepth,aggregateDepthAfter:aggDepth===null?null:aggDepth+1,correlatedFromScalarSubquery:correlated}));};
 const walk=(node:LemonValue<SqlToken>,depth:number,owner:ExprNode):void=>{
  if(node.kind!=="reduction")return;
  const nested=node.signature==="expr ::= LP select RP"||node.signature==="expr ::= EXISTS LP select RP"||node.signature==="expr ::= expr in_op LP select RP";
  if(nested){const selected=node.children.find(child=>child.kind==="reduction"&&child.signature.startsWith("select ::="));const semantic=selected?.kind==="reduction"?selected.semantic as SelectNode|undefined:undefined;if(semantic){for(const item of [...semantic.result,...semantic.orderBy.map(term=>term.expr),...(semantic.where?[semantic.where]:[])])if(item.reduction)walk(item.reduction,depth+1,item);}return;}
  const name=functionName(node);
  const isWindow=node.children.some(child=>child.kind==="reduction"&&child.signature.startsWith("filter_over ::=")&&child.children.some(part=>part.kind==="reduction"&&part.signature.startsWith("over_clause ::=")));
  if(isWindow){if(!select.windows.some(window=>window.owner===owner&&window.compatibleGroup===main.compatibleGroup))append(node,"window",depth,false,null);return;}
  if(name&&aggregateNames.has(name)){
   if(depth===0)append(node,"aggregate",depth,false,0);
   else {
    // window.c:sqlite3WindowExtraAggFuncDepth increments only aggregates whose
    // resolver op2 reaches across the SELECT depth introduced by rewrite. A
    // correlated column owned by the original SrcList is the immutable
    // resolver evidence for that ownership; local nested aggregates are left.
    const crossing=(value:LemonValue<SqlToken>):number=>{if(value.kind!=="reduction")return 0;const use=uses.get(value);return use&&outerCursors.has(use.cursorId)?use.selectDepth:Math.max(0,...value.children.map(crossing));};
    const aggregateDepth=crossing(node);
    if(aggregateDepth>=depth)repairs.push(Object.freeze({expression:expression(node),selectDepth:depth,aggregateDepthBefore:aggregateDepth,aggregateDepthAfter:aggregateDepth+1}));
   }
   return;
  }
  if(node.signature==="expr ::= ID|INDEXED|JOIN_KW"||node.signature==="expr ::= nm DOT nm"||node.signature==="expr ::= nm DOT nm DOT nm"){
   const use=uses.get(node);
   if(depth===0)append(node,"column",depth,false,null);else if(use&&outerCursors.has(use.cursorId))append(node,"column",depth,true,null);
   return;
  }
  node.children.forEach(child=>walk(child,depth,owner));
 };
 for(const owner of owners)if(owner.reduction)walk(owner.reduction,0,owner);
 return {lifted:output,aggregateDepthRepairs:repairs};
}

function resolvedBinding(value:ExprNode,uses:ReadonlyMap<Reduction,ResolvedColumnUse>):WindowExpressionBinding|null{
 let node:Reduction|undefined=value.reduction?.kind==="reduction"?value.reduction:undefined;
 while(node){
  const use=uses.get(node);if(use)return Object.freeze({source:use.source,columnIndex:use.columnIndex});
  if(node.signature==="expr ::= LP expr RP"||node.signature.startsWith("expr ::= expr COLLATE")||node.signature==="expr ::= term"){
   const child=node.children.find((item):item is Reduction=>item.kind==="reduction"&&(item.signature.startsWith("expr ::=")||item.signature.startsWith("term ::=")));
   if(child){node=child;continue;}
  }
  return null;
 }
 return null;
}

/** Immutable port of window.c:sqlite3WindowRewrite/sqlite3WindowCodeInit. */
export function sqlite3WindowRewrite(resolved:ResolvedSelect,allocation?:{registers:number;cursors:number}):WindowRewriteGraph{
 const groups=new Map<number,ResolvedWindow[]>();for(const window of resolved.windows){const group=groups.get(window.compatibleGroup);if(group)group.push(window);else groups.set(window.compatibleGroup,[window]);}
 let nextCursor=Math.max(allocation?.cursors??0,Math.max(-1,...resolved.sources.map(source=>source.cursorId))+1),nextRegister=allocation?.registers??0;const layers:WindowRewriteLayerState[]=[];let parentOrder=resolved.source.orderBy;let prefixElided=false;
 const uses=new Map<Reduction,ResolvedColumnUse>();const collectUses=(owner:ResolvedSelect):void=>{for(const use of owner.columnUses)uses.set(use.expression,use);owner.nested.forEach(collectUses);};collectUses(resolved);
 const groupEntries=[...groups.entries()];
 for(const [groupIndex,[compatibleGroup,windows]] of groupEntries.entries()){const main=windows[0]!;
  const orderFlags=windowOrderFlags(main);const producerOrderBy=Object.freeze([...main.partitionBy.map(value=>{const copiedIntegerToNull=integerSortKey(value);return Object.freeze({expression:copySortExpression(value,copiedIntegerToNull),binding:resolvedBinding(value,uses),source:"partition" as const,copiedIntegerToNull,descending:false,nulls:null});}),...main.orderBy.map((value,index)=>{const copiedIntegerToNull=integerSortKey(value),flags=orderFlags[index]??{descending:false,nulls:null};return Object.freeze({expression:copySortExpression(value,copiedIntegerToNull),binding:resolvedBinding(value,uses),source:"order" as const,copiedIntegerToNull,...flags});})]);
  if(layers.length===0&&parentOrder.length<=producerOrderBy.length&&parentOrder.every((term,index)=>sameOrderTerm(term,producerOrderBy[index]!,resolved))){parentOrder=Object.freeze([]);prefixElided=true;}
  const terminalRewrite=liftExpressions([...resolved.result.map(result=>result.expression),...parentOrder.map(term=>{const index=resolved.orderResultColumns[resolved.source.orderBy.indexOf(term)];return index!==null&&index!==undefined?resolved.result[index]!.expression:term.expr;}),...groupEntries.slice(groupIndex+1).flatMap(([,pending])=>pending.flatMap(window=>[...window.partitionBy,...window.orderBy,...windowArguments(window.owner)]))],resolved,main),lifted=terminalRewrite.lifted,buffer:ExprNode[]=lifted.map(item=>item.expression),bufferBindings:(WindowExpressionBinding|null)[]=buffer.map(value=>resolvedBinding(value,uses));
  for(const value of [...main.partitionBy,...main.orderBy]){buffer.push(value);bufferBindings.push(resolvedBinding(value,uses));}
  const functions=windows.map(window=>{const argumentColumn=buffer.length;for(const value of windowArguments(window.owner)){buffer.push(value);bufferBindings.push(resolvedBinding(value,uses));}const filterColumn=window.filter?(buffer.push(window.filter),bufferBindings.push(resolvedBinding(window.filter,uses)),buffer.length-1):null;const filterReduction=window.filter?.reduction;const filterExpr=filterReduction?.kind==='reduction'?filterReduction.children.find((child):child is Reduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::=')):undefined;const filterCarrier=filterExpr?resolvedExpressionCarrier(resolved,filterExpr):null;return Object.freeze({window,argumentColumn,filterColumn,filterCarrier,regAccum:++nextRegister,regResult:++nextRegister});});
  if(buffer.length===0){buffer.push(Object.freeze({kind:"tokens",tokens:Object.freeze([])}));bufferBindings.push(null);}
  const iEphCsr=nextCursor;nextCursor+=4;const regGosub=++nextRegister,addrGosub=layers.length,handoff=Object.freeze([{code:"Gosub" as const,register:regGosub,address:addrGosub},{code:"Return" as const,register:regGosub}] as const);
  // The producer edge is attached after all layer-local state is complete. Only
  // the first rewrite owns the original clauses; later incompatible rewrites
  // consume the complete Select produced by the preceding recursive rewrite.
  layers.push(Object.freeze({compatibleGroup,windows:Object.freeze(functions),producerOrderBy,bufferExpressions:Object.freeze(buffer),bufferBindings:Object.freeze(bufferBindings),lifted:Object.freeze(lifted),aggregateDepthRepairs:Object.freeze(terminalRewrite.aggregateDepthRepairs),iEphCsr,duplicateCursors:Object.freeze([iEphCsr+1,iEphCsr+2,iEphCsr+3]) as readonly [number,number,number],regGosub,addrGosub,handoff}));
 }
 // Capture original predicate identities on the moved producer edge, not
 // rewritten parent expressions. ON predicates precede WHERE as before.
 const sourcePredicates:ResolvedExpressionCarrier[]=[];
 for(const item of resolved.source.from.items)if(item.on?.reduction?.kind==='reduction')sourcePredicates.push(resolvedExpressionCarrier(resolved,item.on.reduction));
 if(resolved.source.where?.reduction?.kind==='reduction')sourcePredicates.push(resolvedExpressionCarrier(resolved,resolved.source.where.reduction));
 let root:WindowRewrittenSelect|null=null;
 const linked:WindowRewriteLayer[]=[];
 for(const [index,unlinked] of layers.entries()){
  const producer:WindowRewriteProducer=index===0
   ?Object.freeze({kind:"original" as const,nonFlattenable:true as const,correlated:true as const,sourcePredicates:Object.freeze(sourcePredicates),from:resolved.source.from,where:resolved.source.where,groupBy:resolved.source.groupBy,having:resolved.source.having})
   :Object.freeze({kind:"rewritten-select" as const,nonFlattenable:true as const,correlated:true as const,parentCompatibleGroup:unlinked.compatibleGroup,select:root!});
  const layer:WindowRewriteLayer=Object.freeze({...unlinked,producer});
  linked.push(layer);
  root=Object.freeze({compatibleGroup:layer.compatibleGroup,subquery:producer});
 }
 return Object.freeze({source:resolved,layers:Object.freeze(linked),root,outer:Object.freeze({orderBy:parentOrder,originalOrderBy:resolved.source.orderBy,orderPrefixElided:prefixElided,limit:resolved.source.limit,offset:resolved.source.offset,result:resolved.result}),movedClauses:Object.freeze(["from","where","groupBy","having"] as const),retainedClauses:Object.freeze(["orderBy","limit","offset"] as const),multipleWindowPartitions:resolved.multipleWindowPartitions,frameExecution:"unsupported"});
}
