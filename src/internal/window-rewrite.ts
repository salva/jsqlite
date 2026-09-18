import type {LemonValue} from "./lemon-runtime.ts";
import type {ExprNode, OrderTermNode, SelectNode} from "./parse.ts";
import type {ResolvedResult, ResolvedSelect, ResolvedWindow} from "./resolve.ts";
import type {SqlToken} from "./tokenize.ts";

/** Immutable compiler-side image of window.c:sqlite3WindowRewrite. It records
 * ownership and VM handoff, but cannot execute a frame or publish a Program. */
export interface WindowRewriteFunction {readonly window:ResolvedWindow;readonly regAccum:number;readonly regResult:number;readonly argumentColumn:number;readonly filterColumn:number|null}
export interface WindowRewriteSortTerm {readonly expression:ExprNode;readonly source:"partition"|"order";readonly copiedIntegerToNull:boolean}
export interface WindowRewriteLayer {
 readonly compatibleGroup:number;readonly windows:readonly WindowRewriteFunction[];readonly producerOrderBy:readonly WindowRewriteSortTerm[];readonly bufferExpressions:readonly ExprNode[];
 readonly iEphCsr:number;readonly duplicateCursors:readonly [number,number,number];readonly regGosub:number;readonly addrGosub:number;
 readonly handoff:readonly [{readonly code:"Gosub";readonly register:number;readonly address:number},{readonly code:"Return";readonly register:number}];
 readonly producer:Readonly<{nonFlattenable:true;correlated:true;from:SelectNode["from"];where:ExprNode|null;groupBy:readonly ExprNode[];having:ExprNode|null;orderBy:readonly WindowRewriteSortTerm[]}>;
}
export interface WindowRewriteGraph {
 readonly source:ResolvedSelect;readonly layers:readonly WindowRewriteLayer[];
 readonly outer:Readonly<{orderBy:readonly OrderTermNode[];limit:ExprNode|null;offset:ExprNode|null;result:readonly ResolvedResult[]}>;
 readonly movedClauses:readonly ["from","where","groupBy","having"];readonly retainedClauses:readonly ["orderBy","limit","offset"];
 readonly multipleWindowPartitions:boolean;readonly frameExecution:"unsupported";
}
function windowIntegerSortKey(expression:ExprNode):boolean{
 const unwrap=(node:LemonValue<SqlToken>):LemonValue<SqlToken>=>{if(node.kind!=="reduction")return node;if(node.signature.startsWith("expr ::= LP expr RP")||node.signature.startsWith("expr ::= expr COLLATE")||node.signature==="expr ::= term"){const child=node.children.find(value=>value.kind==="reduction"&&(value.signature.startsWith("expr ::=")||value.signature.startsWith("term ::=")));return child?unwrap(child):node;}return node;};
 const node=expression.reduction?unwrap(expression.reduction):undefined;return !!node&&node.kind==="reduction"&&node.signature==="term ::= INTEGER";
}
/** Port of the graph-changing sqlite3WindowRewrite/sqlite3WindowCodeInit seam.
 * Compatible links share one layer; first occurrence orders nested layers. */
export function sqlite3WindowRewrite(resolved:ResolvedSelect):WindowRewriteGraph{
 const groups=new Map<number,ResolvedWindow[]>();for(const window of resolved.windows){const group=groups.get(window.compatibleGroup);if(group)group.push(window);else groups.set(window.compatibleGroup,[window]);}
 let nextCursor=Math.max(-1,...resolved.sources.map(source=>source.cursorId))+1,nextRegister=0;const layers:WindowRewriteLayer[]=[];
 for(const [compatibleGroup,windows] of groups){const main=windows[0]!;
  const producerOrderBy=Object.freeze([...main.partitionBy.map(expression=>Object.freeze({expression,source:"partition" as const,copiedIntegerToNull:windowIntegerSortKey(expression)})),...main.orderBy.map(expression=>Object.freeze({expression,source:"order" as const,copiedIntegerToNull:windowIntegerSortKey(expression)}))]);
  // selectWindowRewriteEList lifts parent result/ORDER owners. ResolvedResult
  // remains alongside them so aliases, collation, affinity and origin survive.
  const buffer:ExprNode[]=[...resolved.result.map(result=>result.expression),...resolved.source.orderBy.map(term=>term.expr),...main.partitionBy,...main.orderBy];
  const functions=windows.map(window=>{const argumentColumn=buffer.length;buffer.push(window.owner);const filterColumn=window.filter?(buffer.push(window.filter),buffer.length-1):null;return Object.freeze({window,argumentColumn,filterColumn,regAccum:++nextRegister,regResult:++nextRegister});});
  if(buffer.length===0)buffer.push(Object.freeze({kind:"tokens",tokens:Object.freeze([])}));
  const iEphCsr=nextCursor;nextCursor+=4;const regGosub=++nextRegister,addrGosub=layers.length;
  const handoff=Object.freeze([{code:"Gosub" as const,register:regGosub,address:addrGosub},{code:"Return" as const,register:regGosub}] as const);
  const producer=Object.freeze({nonFlattenable:true as const,correlated:true as const,from:resolved.source.from,where:resolved.source.where,groupBy:resolved.source.groupBy,having:resolved.source.having,orderBy:producerOrderBy});
  layers.push(Object.freeze({compatibleGroup,windows:Object.freeze(functions),producerOrderBy,bufferExpressions:Object.freeze(buffer),iEphCsr,duplicateCursors:Object.freeze([iEphCsr+1,iEphCsr+2,iEphCsr+3]) as readonly [number,number,number],regGosub,addrGosub,handoff,producer}));
 }
 return Object.freeze({source:resolved,layers:Object.freeze(layers),outer:Object.freeze({orderBy:resolved.source.orderBy,limit:resolved.source.limit,offset:resolved.source.offset,result:resolved.result}),movedClauses:Object.freeze(["from","where","groupBy","having"] as const),retainedClauses:Object.freeze(["orderBy","limit","offset"] as const),multipleWindowPartitions:resolved.multipleWindowPartitions,frameExecution:"unsupported"});
}
