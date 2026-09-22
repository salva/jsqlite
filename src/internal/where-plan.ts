// Immutable WHERE candidate and path foundation.
// Directly shaped by SQLite 3.53.4 whereInt.h and where.c whereScanNext,
// whereLoopInsert/whereLoopAddBtree[Index]/wherePathSolver. It deliberately
// publishes no opcodes: lowering consumes the retained admissions unchanged.
import type {ExprNode} from "./parse.ts";
import type {ResolvedSelect,ResolvedSource} from "./resolve.ts";
import type {LemonValue} from "./lemon-runtime.ts";
import type {SqlToken} from "./tokenize.ts";
import {sqliteAsciiFold} from "./sqlite-case.ts";
import type {ColumnNode,IndexNode,PhysicalIndexField,PhysicalRowidIndex} from "./schema.ts";
import type {BuiltinCollation,KeyTerm} from "./comparison.ts";

export type SourceMask=bigint;
export type LogicalEstimate=bigint;
export type WhereOperator="eq"|"is"|"is-null"|"lt"|"le"|"gt"|"ge";
export type TermOrigin={readonly kind:"where"}|{readonly kind:"join-on";readonly rightSource:number;readonly join:"inner"|"left"|"right"|"full"}|{readonly kind:"using";readonly rightSource:number;readonly name:string}|{readonly kind:"derived";readonly parentTerm:number;readonly reason:"commuted"|"transitive"|"range"};
export interface ColumnBinding {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly column:ColumnNode|null;readonly columnIndex:number;readonly rowid:boolean}
export interface WhereTerm {readonly id:number;readonly expression:ExprNode;readonly origin:TermOrigin;readonly operator:WhereOperator|null;readonly left:ColumnBinding|null;readonly rightAffinity:ColumnNode["affinity"]|null;readonly effectiveCollation:BuiltinCollation|null;readonly originalIndexedOperand:"left"|"right";readonly prereqRight:SourceMask;readonly prereqAll:SourceMask;readonly parentId:number|null;readonly childIds:readonly number[];readonly virtual:boolean;readonly outerJoinSafe:{readonly mayDrive:boolean;readonly mayOmitResidual:boolean}}
export interface WhereClause {readonly split:"and"|"or";readonly terms:readonly WhereTerm[];readonly outer:WhereClause|null}
export type SeekComparisonMode={readonly kind:"comparison";readonly affinity:ColumnNode["affinity"];readonly collation:BuiltinCollation}|{readonly kind:"is-null"};
export interface IndexConstraintAdmission {readonly term:WhereTerm;readonly physicalIndex:PhysicalRowidIndex;readonly fieldOrdinal:number;readonly field:PhysicalIndexField;readonly keyInfoTerm:Readonly<KeyTerm>;readonly operator:WhereOperator;readonly originalIndexedOperand:"left"|"right";readonly comparison:SeekComparisonMode;readonly bound:"equality"|"lower-inclusive"|"lower-exclusive"|"upper-inclusive"|"upper-exclusive"}
export interface RowidConstraint {readonly term:WhereTerm;readonly operator:WhereOperator;readonly originalIndexedOperand:"left"|"right";readonly bound:IndexConstraintAdmission["bound"]}
export interface BtreeCapability {readonly index:IndexNode|null;readonly physicalIndex:PhysicalRowidIndex|null;readonly equalityPrefix:readonly IndexConstraintAdmission[];readonly lower:IndexConstraintAdmission|null;readonly upper:IndexConstraintAdmission|null;readonly constrainedFields:number;readonly orderTermsSatisfied:number;readonly reverse:boolean;readonly covering:boolean;readonly needsTableLookup:boolean;readonly rowidEquality:RowidConstraint|null;readonly rowidLower:RowidConstraint|null;readonly rowidUpper:RowidConstraint|null}
export interface WhereLoop {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly prereq:SourceMask;readonly capability:BtreeCapability|null;readonly kind:"table-scan"|"rowid"|"index";readonly setupCost:LogicalEstimate;readonly runCost:LogicalEstimate;readonly outputRows:LogicalEstimate;readonly terms:readonly WhereTerm[]}
export interface WherePath {readonly loops:readonly WhereLoop[];readonly ready:SourceMask;readonly reverse:SourceMask;readonly rows:LogicalEstimate;readonly cost:LogicalEstimate;readonly unsortedCost:LogicalEstimate;readonly orderTermsSatisfied:number|null}
export interface OrderRequirement {readonly sourceOrdinal:number;readonly column:ColumnNode;readonly descending:boolean;readonly collation:BuiltinCollation}
export interface CandidateOptions {readonly forcedIndex:IndexNode|null;readonly notIndexed?:boolean;readonly neededColumns:ReadonlySet<ColumnNode>;readonly orderBy:readonly OrderRequirement[]}
export class WherePlanningUnsupportedError extends Error {readonly classification="temporary" as const;constructor(message:string){super(message);this.name="WherePlanningUnsupportedError"}}
const freeze=<T>(value:T):Readonly<T>=>Object.freeze(value);
export function sourceBit(ordinal:number):SourceMask {if(!Number.isSafeInteger(ordinal)||ordinal<0)throw new RangeError("invalid source ordinal");return 1n<<BigInt(ordinal)}
export function whereClause(terms:readonly WhereTerm[],outer:WhereClause|null=null):WhereClause{return freeze({split:"and",terms:Object.freeze([...terms]),outer})}
function comparisonAffinity(column:ColumnNode,rhs:ColumnNode["affinity"]|null):ColumnNode["affinity"] {return rhs===null||rhs==="blob"?column.affinity:rhs}
function affinityOk(field:ColumnNode,affinity:ColumnNode["affinity"]):boolean {return affinity==="blob"||(affinity==="text"?field.affinity==="text":field.affinity==="integer"||field.affinity==="real"||field.affinity==="numeric")}
function bound(operator:WhereOperator):IndexConstraintAdmission["bound"] {return operator==="eq"||operator==="is"||operator==="is-null"?"equality":operator==="gt"?"lower-exclusive":operator==="ge"?"lower-inclusive":operator==="lt"?"upper-exclusive":"upper-inclusive"}
const admissionCache=new WeakMap<WhereTerm,WeakMap<PhysicalRowidIndex,Map<number,IndexConstraintAdmission|null>>>();
/** whereScanNext's compatibility gate. Original operand orientation and the
 * already-resolved original-order collation are retained rather than rebuilt. */
export function admitIndexConstraint(term:WhereTerm,physical:PhysicalRowidIndex,fieldOrdinal:number):IndexConstraintAdmission|null {
 let byPhysical=admissionCache.get(term);if(!byPhysical){byPhysical=new WeakMap();admissionCache.set(term,byPhysical);}let byOrdinal=byPhysical.get(physical);if(!byOrdinal){byOrdinal=new Map();byPhysical.set(physical,byOrdinal);}if(byOrdinal.has(fieldOrdinal))return byOrdinal.get(fieldOrdinal)!;
 const field=physical.fields[fieldOrdinal],keyInfoTerm=physical.keyInfo.terms[fieldOrdinal];
 if(!field||!keyInfoTerm||field.role!=="declared"||!field.column||term.left?.column!==field.column||term.operator===null||!term.outerJoinSafe.mayDrive){byOrdinal.set(fieldOrdinal,null);return null;}
 let comparison:SeekComparisonMode;
 if(term.operator==="is-null")comparison=freeze({kind:"is-null"});
 else {const affinity=comparisonAffinity(field.column,term.rightAffinity);if(!affinityOk(field.column,affinity)||term.effectiveCollation!==field.collation){byOrdinal.set(fieldOrdinal,null);return null;}comparison=freeze({kind:"comparison",affinity,collation:term.effectiveCollation});}
 const admission=freeze({term,physicalIndex:physical,fieldOrdinal,field,keyInfoTerm,operator:term.operator,originalIndexedOperand:term.originalIndexedOperand,comparison,bound:bound(term.operator)});byOrdinal.set(fieldOrdinal,admission);return admission;
}
function orderContribution(physical:PhysicalRowidIndex,prefix:number,order:readonly OrderRequirement[],ordinal:number):{count:number;reverse:boolean}{
 const relevant=order.filter(item=>item.sourceOrdinal===ordinal);if(!relevant.length)return {count:0,reverse:false};let direction:boolean|null=null,count=0;
 for(let i=0;i<relevant.length;i++){const field=physical.fields[prefix+i],wanted=relevant[i]!;if(!field||field.column!==wanted.column||field.collation!==wanted.collation)break;const reverse=field.descending!==wanted.descending;if(direction!==null&&direction!==reverse)break;direction=reverse;count++;}return {count,reverse:direction??false};
}
function capability(index:IndexNode,terms:readonly WhereTerm[],ordinal:number,needed:ReadonlySet<ColumnNode>,order:readonly OrderRequirement[]):BtreeCapability|null {
 const physical=index.physical;if(!physical)return null;const equality:IndexConstraintAdmission[]=[];let lower:IndexConstraintAdmission|null=null,upper:IndexConstraintAdmission|null=null;
 for(let field=0;field<physical.declaredFieldCount;field++){
  const admissions=terms.map(term=>admitIndexConstraint(term,physical,field)).filter((item):item is IndexConstraintAdmission=>item!==null);
  const equal=admissions.find(item=>item.bound==="equality");if(equal){equality.push(equal);continue;}
  lower=admissions.find(item=>item.bound.startsWith("lower"))??null;upper=admissions.find(item=>item.bound.startsWith("upper"))??null;break;
 }
 const constrained=equality.length+(lower||upper?1:0),ordering=orderContribution(physical,equality.length,order,ordinal);
 const covering=[...needed].every(column=>physical.fields.some(field=>field.role==="declared"&&field.column===column));
 return freeze({index,physicalIndex:physical,equalityPrefix:Object.freeze(equality),lower,upper,constrainedFields:constrained,orderTermsSatisfied:ordering.count,reverse:ordering.reverse,covering,needsTableLookup:!covering,rowidEquality:null,rowidLower:null,rowidUpper:null});
}
/** whereLoopAddBtree's deterministic no-stat candidate subset. */
export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:WhereClause,options:CandidateOptions):readonly WhereLoop[] {
 if(options.forcedIndex&&options.notIndexed)throw new WherePlanningUnsupportedError("INDEXED BY and NOT INDEXED conflict");
 if(options.forcedIndex&&options.forcedIndex.table!==source.table)throw new WherePlanningUnsupportedError("forced index does not belong to source table");
 if(options.forcedIndex&&!options.forcedIndex.physical)throw new WherePlanningUnsupportedError(`unsupported physical index layout: ${options.forcedIndex.name}`);
 const own=clause.terms.filter(term=>term.left?.source===source&&term.outerJoinSafe.mayDrive),scan:WhereLoop=freeze({source,sourceOrdinal,prereq:0n,capability:null,kind:"table-scan",setupCost:0n,runCost:66n,outputRows:66n,terms:Object.freeze(own)});
 const loops:WhereLoop[]=[];if(!options.forcedIndex)loops.push(scan);
 const rowid=own.filter(term=>term.left?.rowid&&term.operator!==null&&term.operator!=="is-null");const rowEq=rowid.find(term=>term.operator==="eq"||term.operator==="is"),rowLower=rowid.find(term=>term.operator==="gt"||term.operator==="ge"),rowUpper=rowid.find(term=>term.operator==="lt"||term.operator==="le");
 if(!options.forcedIndex&&(rowEq||rowLower||rowUpper)){const make=(term:WhereTerm|undefined):RowidConstraint|null=>term&&term.operator?freeze({term,operator:term.operator,originalIndexedOperand:term.originalIndexedOperand,bound:bound(term.operator)}):null;const used=[rowEq,rowLower,rowUpper].filter((x):x is WhereTerm=>!!x);const cap:BtreeCapability=freeze({index:null,physicalIndex:null,equalityPrefix:Object.freeze([]),lower:null,upper:null,constrainedFields:1,orderTermsSatisfied:0,reverse:false,covering:true,needsTableLookup:false,rowidEquality:make(rowEq),rowidLower:make(rowLower),rowidUpper:make(rowUpper)});loops.push(freeze({source,sourceOrdinal,prereq:used.reduce((m,t)=>m|t.prereqRight,0n),capability:cap,kind:"rowid",setupCost:0n,runCost:rowEq?20n:40n,outputRows:rowEq?0n:40n,terms:Object.freeze(own)}));}
 if(!options.notIndexed)for(const index of source.table.indexes){if(options.forcedIndex&&index!==options.forcedIndex)continue;const cap=capability(index,own,sourceOrdinal,options.neededColumns,options.orderBy);if(!cap)continue;if(!options.forcedIndex&&cap.constrainedFields===0&&cap.orderTermsSatisfied===0)continue;const prereq=own.filter(term=>cap.equalityPrefix.some(a=>a.term===term)||cap.lower?.term===term||cap.upper?.term===term).reduce((mask,term)=>mask|term.prereqRight,0n);const reduction=BigInt(cap.equalityPrefix.length*12+(cap.lower||cap.upper?6:0));loops.push(freeze({source,sourceOrdinal,prereq,capability:cap,kind:"index",setupCost:0n,runCost:66n-reduction+(cap.needsTableLookup?4n:0n),outputRows:66n-reduction,terms:Object.freeze(own)}));}
 if(options.forcedIndex&&!loops.some(loop=>loop.kind==="index"))throw new WherePlanningUnsupportedError(`forced index is unusable: ${options.forcedIndex.name}`);return Object.freeze(loops);
}
function loopOrder(a:WhereLoop,b:WhereLoop):number {return a.runCost<b.runCost?-1:a.runCost>b.runCost?1:a.kind.localeCompare(b.kind)||a.sourceOrdinal-b.sourceOrdinal}
/** Exact port of util.c:sqlite3LogEstAdd for bigint LogEst units. */
export function logEstAdd(a:LogicalEstimate,b:LogicalEstimate):LogicalEstimate {const x=[10n,10n,9n,9n,8n,8n,7n,7n,7n,6n,6n,6n,5n,5n,5n,4n,4n,4n,4n,3n,3n,3n,3n,3n,3n,2n,2n,2n,2n,2n,2n,2n];if(a<b)return logEstAdd(b,a);const d=a-b;if(d>49n)return a;if(d>31n)return a+1n;return a+x[Number(d)]!;}
function pathKey(path:WherePath):string{return path.loops.map(x=>`${x.sourceOrdinal}:${x.kind}:${x.capability?.index?.name??""}`).join("|")}
/** Admitted wherePathSolver translation: retain up to mxChoice N-best paths at
 * every depth, applying ready-mask/cost/row/order dominance before truncation. */
export function wherePathSolver(candidates:readonly (readonly WhereLoop[])[],sourceCount:number,maxChoices=Math.min(12,sourceCount+1)):WherePath {
 let paths:WherePath[]=[freeze({loops:Object.freeze([]),ready:0n,reverse:0n,rows:0n,cost:0n,unsortedCost:0n,orderTermsSatisfied:0})];
 for(let depth=0;depth<sourceCount;depth++){const next:WherePath[]=[];for(const path of paths)for(const group of candidates)for(const loop of [...group].sort(loopOrder)){const bit=sourceBit(loop.sourceOrdinal);if(path.ready&bit||(loop.prereq&~path.ready)!==0n)continue;const cap=loop.capability,run=logEstAdd(loop.setupCost,loop.runCost+path.rows),cost=logEstAdd(path.cost,run),ready=path.ready|bit,ordered=(path.orderTermsSatisfied??0)+(cap?.orderTermsSatisfied??0);const proposal:WherePath=freeze({loops:Object.freeze([...path.loops,loop]),ready,reverse:path.reverse|(cap?.reverse?bit:0n),rows:path.rows+loop.outputRows,cost,unsortedCost:cost,orderTermsSatisfied:ordered});const dominated=next.some(old=>old.ready===ready&&old.cost<=cost&&old.rows<=proposal.rows&&(old.orderTermsSatisfied??0)>=ordered);if(dominated)continue;for(let i=next.length-1;i>=0;i--){const old=next[i]!;if(old.ready===ready&&cost<=old.cost&&proposal.rows<=old.rows&&ordered>=(old.orderTermsSatisfied??0))next.splice(i,1);}next.push(proposal);}paths=next.sort((a,b)=>a.cost<b.cost?-1:a.cost>b.cost?1:pathKey(a).localeCompare(pathKey(b))).slice(0,maxChoices);}
 const full=(1n<<BigInt(sourceCount))-1n,best=paths.filter(path=>path.ready===full).sort((a,b)=>a.cost<b.cost?-1:a.cost>b.cost?1:pathKey(a).localeCompare(pathKey(b)))[0];if(!best)throw new WherePlanningUnsupportedError("no usable WHERE path");return best;
}

type ExprReduction=LemonValue<SqlToken>&{readonly kind:"reduction"};
function exprChildren(node:ExprReduction):ExprReduction[]{return node.children.filter((x):x is ExprReduction=>x.kind==="reduction"&&x.signature.startsWith("expr ::="));}
function asExpr(node:ExprReduction):ExprNode {const tokens:SqlToken[]=[];const collect=(x:LemonValue<SqlToken>):void=>{if(x.kind==="terminal"){if(x.value)tokens.push(x.value);}else x.children.forEach(collect)};collect(node);return Object.freeze({kind:"tokens",tokens:Object.freeze(tokens),reduction:node});}
function unwrap(node:ExprReduction):ExprReduction {let at=node;while(at.signature==="expr ::= LP expr RP"||at.signature.startsWith("expr ::= expr COLLATE")){const child=exprChildren(at)[0];if(!child)break;at=child;}return at;}
function explicitExprCollation(node:ExprReduction):BuiltinCollation|null {if(node.signature.startsWith("expr ::= expr COLLATE")){const token=node.children.filter(x=>x.kind==="terminal").at(-1);const name=token?.kind==="terminal"?sqliteAsciiFold(token.value.text):"";return name==="binary"||name==="nocase"||name==="rtrim"?name:null;}for(const child of exprChildren(node)){const found=explicitExprCollation(child);if(found)return found;}return null;}
function literalAffinity(node:ExprReduction):ColumnNode["affinity"]|null {const token=asExpr(node).tokens[0];if(!token)return null;if(token.kind==="string")return "text";if(token.kind==="blob")return "blob";if(token.kind==="integer")return "integer";if(token.kind==="float")return "real";return null;}
function reductionContains(root:ExprReduction,needle:ExprReduction):boolean {return root===needle||root.children.some(x=>x.kind==="reduction"&&reductionContains(x,needle));}
function columnUse(resolved:ResolvedSelect,node:ExprReduction){const plain=unwrap(node);return resolved.columnUses.find(use=>use.selectDepth===0&&use.expression===plain)??resolved.columnUses.find(use=>use.selectDepth===0&&reductionContains(plain,use.expression));}
function binding(resolved:ResolvedSelect,node:ExprReduction):ColumnBinding|null {const use=columnUse(resolved,node);if(!use)return null;const column=use.columnIndex<0?null:use.source.table.columns[use.columnIndex]??null;return freeze({source:use.source,sourceOrdinal:resolved.sources.indexOf(use.source),column,columnIndex:use.columnIndex,rowid:use.columnIndex<0});}
function prereq(resolved:ResolvedSelect,node:ExprReduction):SourceMask {let mask=0n;for(const use of resolved.columnUses)if(use.selectDepth===0&&reductionContains(node,use.expression)){const at=resolved.sources.indexOf(use.source);if(at>=0)mask|=sourceBit(at);}return mask;}
function splitAnd(node:ExprReduction,out:ExprReduction[]):void {if(node.signature==="expr ::= expr AND expr"){for(const child of exprChildren(node))splitAnd(child,out);}else out.push(node);}
function comparisonOperator(node:ExprReduction):WhereOperator|null {const text=node.children.filter(x=>x.kind==="terminal").map(x=>x.kind==="terminal"?sqliteAsciiFold(x.value.text):"").join(" ");if(node.signature.startsWith("expr ::= expr EQ|NE expr"))return text.includes("!=")||text.includes("<>")?null:"eq";if(node.signature.startsWith("expr ::= expr LT|GT|GE|LE expr"))return text.includes(">=")?"ge":text.includes("<=")?"le":text.includes(">")?"gt":"lt";if(node.signature==="expr ::= expr IS expr"){const rhs=exprChildren(node)[1];if(rhs&&asExpr(rhs).tokens.some(token=>sqliteAsciiFold(token.text)==="null"))return "is-null";return "is";}if(node.signature==="expr ::= expr ISNULL|NOTNULL"&&!text.includes("notnull"))return "is-null";return null;}
function reverseOperator(op:WhereOperator):WhereOperator{return op==="lt"?"gt":op==="le"?"ge":op==="gt"?"lt":op==="ge"?"le":op;}
function effectiveCollation(left:ExprReduction,right:ExprReduction,leftBinding:ColumnBinding|null,rightBinding:ColumnBinding|null):BuiltinCollation {return explicitExprCollation(left)??explicitExprCollation(right)??((leftBinding?.column?.collation&&sqliteAsciiFold(leftBinding.column.collation)) as BuiltinCollation|null)??((rightBinding?.column?.collation&&sqliteAsciiFold(rightBinding.column.collation)) as BuiltinCollation|null)??"binary";}
export interface WhereAnalysis {readonly clause:WhereClause;readonly plannerEligible:boolean;readonly fallback:"right-full"|null}
/** whereexpr.c sqlite3WhereSplit/exprAnalyze subset. It consumes resolved
 * expression identity and is the only production constructor for WhereTerm. */
export function analyzeWhere(resolved:ResolvedSelect):WhereAnalysis {
 if(resolved.sources.some(source=>source.joinFromLeft.right||source.joinFromLeft.outer||source.leftOfRightJoin))return freeze({clause:whereClause([]),plannerEligible:false,fallback:"right-full"});
 const specs:{node:ExprReduction;origin:TermOrigin}[]=[];if(resolved.source.where?.reduction?.kind==="reduction"){const parts:ExprReduction[]=[];splitAnd(resolved.source.where.reduction as ExprReduction,parts);for(const node of parts)specs.push({node,origin:{kind:"where"}});}
 resolved.sources.forEach((source,index)=>{if(source.on?.reduction?.kind!=="reduction")return;const parts:ExprReduction[]=[];splitAnd(source.on.reduction as ExprReduction,parts);for(const node of parts)specs.push({node,origin:{kind:"join-on",rightSource:index,join:source.joinFromLeft.left?"left":"inner"}});});
 const terms:WhereTerm[]=specs.map(({node,origin},id)=>{let op=comparisonOperator(node),children=exprChildren(node),leftNode=children[0]??node,rightNode=children[1]??node,left=binding(resolved,leftNode),right=binding(resolved,rightNode),orientation:"left"|"right"="left";const originalLeft=left,originalRight=right;if(!left&&right&&op){orientation="right";op=reverseOperator(op);[leftNode,rightNode]=[rightNode,leftNode];left=right;}const all=prereq(resolved,node),own=left?sourceBit(left.sourceOrdinal):0n;const rightMask=all&~own;const coll=op==="is-null"?null:effectiveCollation(children[0]??node,children[1]??node,originalLeft,originalRight);const isLeft=origin.kind==="join-on"&&origin.join==="left";return freeze({id,expression:asExpr(node),origin,operator:op,left,rightAffinity:literalAffinity(rightNode)??binding(resolved,rightNode)?.column?.affinity??null,effectiveCollation:coll,originalIndexedOperand:orientation,prereqRight:rightMask,prereqAll:all,parentId:null,childIds:Object.freeze([]),virtual:false,outerJoinSafe:freeze({mayDrive:op!==null,mayOmitResidual:!isLeft})});});
 return freeze({clause:whereClause(terms),plannerEligible:true,fallback:null});
}

export interface WherePlanRequest {readonly neededColumns:readonly ReadonlySet<ColumnNode>[];readonly orderBy:readonly OrderRequirement[]}
export interface WherePlanSelection {readonly analysis:WhereAnalysis;readonly path:WherePath|null}
/** Publish the lowering handoff without asking a caller to reconstruct either
 * term eligibility or INDEXED BY/NOT INDEXED gates. */
export function planWhere(resolved:ResolvedSelect,request:WherePlanRequest):WherePlanSelection {
 const analysis=analyzeWhere(resolved);if(!analysis.plannerEligible)return freeze({analysis,path:null});
 const groups=resolved.sources.map((source,ordinal)=>{const forced=source.indexedBy===null?null:source.table.indexes.find(index=>sqliteAsciiFold(index.name)===sqliteAsciiFold(source.indexedBy!))??null;if(source.indexedBy!==null&&!forced)throw new WherePlanningUnsupportedError(`no such index: ${source.indexedBy}`);return btreeLoops(source,ordinal,analysis.clause,{forcedIndex:forced,notIndexed:source.notIndexed,neededColumns:request.neededColumns[ordinal]??new Set(),orderBy:request.orderBy});});
 return freeze({analysis,path:wherePathSolver(groups,resolved.sources.length)});
}
