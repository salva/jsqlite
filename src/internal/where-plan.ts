// Immutable WHERE candidate and path foundation.
// Directly shaped by SQLite 3.53.4 whereInt.h and where.c whereScanNext,
// whereLoopInsert/whereLoopAddBtree[Index]/wherePathSolver. It deliberately
// publishes no opcodes: lowering consumes the retained admissions unchanged.
import type {ExprNode} from "./parse.ts";
import type {ResolvedSource} from "./resolve.ts";
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
export interface BtreeCapability {readonly index:IndexNode|null;readonly physicalIndex:PhysicalRowidIndex|null;readonly equalityPrefix:readonly IndexConstraintAdmission[];readonly lower:IndexConstraintAdmission|null;readonly upper:IndexConstraintAdmission|null;readonly constrainedFields:number;readonly orderTermsSatisfied:number;readonly reverse:boolean;readonly covering:boolean;readonly needsTableLookup:boolean}
export interface WhereLoop {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly prereq:SourceMask;readonly capability:BtreeCapability|null;readonly kind:"table-scan"|"rowid"|"index";readonly setupCost:LogicalEstimate;readonly runCost:LogicalEstimate;readonly outputRows:LogicalEstimate;readonly terms:readonly WhereTerm[]}
export interface WherePath {readonly loops:readonly WhereLoop[];readonly ready:SourceMask;readonly reverse:SourceMask;readonly rows:LogicalEstimate;readonly cost:LogicalEstimate;readonly unsortedCost:LogicalEstimate;readonly orderTermsSatisfied:number|null}
export interface OrderRequirement {readonly sourceOrdinal:number;readonly column:ColumnNode;readonly descending:boolean;readonly collation:BuiltinCollation}
export interface CandidateOptions {readonly forcedIndex:IndexNode|null;readonly neededColumns:ReadonlySet<ColumnNode>;readonly orderBy:readonly OrderRequirement[]}
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
 return freeze({index,physicalIndex:physical,equalityPrefix:Object.freeze(equality),lower,upper,constrainedFields:constrained,orderTermsSatisfied:ordering.count,reverse:ordering.reverse,covering,needsTableLookup:!covering});
}
/** whereLoopAddBtree's deterministic no-stat candidate subset. */
export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:WhereClause,options:CandidateOptions):readonly WhereLoop[] {
 if(options.forcedIndex&&options.forcedIndex.table!==source.table)throw new WherePlanningUnsupportedError("forced index does not belong to source table");
 if(options.forcedIndex&&!options.forcedIndex.physical)throw new WherePlanningUnsupportedError(`unsupported physical index layout: ${options.forcedIndex.name}`);
 const own=clause.terms.filter(term=>term.left?.source===source&&term.outerJoinSafe.mayDrive),scan:WhereLoop=freeze({source,sourceOrdinal,prereq:0n,capability:null,kind:"table-scan",setupCost:0n,runCost:66n,outputRows:66n,terms:Object.freeze(own)});
 const loops:WhereLoop[]=[];if(!options.forcedIndex)loops.push(scan);
 for(const index of source.table.indexes){if(options.forcedIndex&&index!==options.forcedIndex)continue;const cap=capability(index,own,sourceOrdinal,options.neededColumns,options.orderBy);if(!cap)continue;const prereq=own.filter(term=>cap.equalityPrefix.some(a=>a.term===term)||cap.lower?.term===term||cap.upper?.term===term).reduce((mask,term)=>mask|term.prereqRight,0n);const reduction=BigInt(cap.equalityPrefix.length*12+(cap.lower||cap.upper?6:0));loops.push(freeze({source,sourceOrdinal,prereq,capability:cap,kind:"index",setupCost:0n,runCost:66n-reduction+(cap.needsTableLookup?4n:0n),outputRows:66n-reduction,terms:Object.freeze(own)}));}
 if(options.forcedIndex&&!loops.length)throw new WherePlanningUnsupportedError(`forced index is unusable: ${options.forcedIndex.name}`);return Object.freeze(loops);
}
function loopOrder(a:WhereLoop,b:WhereLoop):number {return a.runCost<b.runCost?-1:a.runCost>b.runCost?1:a.kind.localeCompare(b.kind)||a.sourceOrdinal-b.sourceOrdinal}
/** N-best path solver reduced to one deterministic best state per ready mask;
 * prerequisite masks and complete paths follow wherePathSolver's core branch. */
export function wherePathSolver(candidates:readonly (readonly WhereLoop[])[],sourceCount:number):WherePath {
 let paths:WherePath[]=[freeze({loops:Object.freeze([]),ready:0n,reverse:0n,rows:0n,cost:0n,unsortedCost:0n,orderTermsSatisfied:0})];
 for(let depth=0;depth<sourceCount;depth++){const next=new Map<bigint,WherePath>();for(const path of paths)for(const group of candidates)for(const loop of [...group].sort(loopOrder)){const bit=sourceBit(loop.sourceOrdinal);if(path.ready&bit||(loop.prereq&~path.ready)!==0n)continue;const cap=loop.capability,cost=path.cost+loop.setupCost+loop.runCost+path.rows,ready=path.ready|bit;const proposal:WherePath=freeze({loops:Object.freeze([...path.loops,loop]),ready,reverse:path.reverse|(cap?.reverse?bit:0n),rows:path.rows+loop.outputRows,cost,unsortedCost:cost,orderTermsSatisfied:(path.orderTermsSatisfied??0)+(cap?.orderTermsSatisfied??0)});const old=next.get(ready);if(!old||proposal.cost<old.cost||proposal.cost===old.cost&&proposal.loops.map(x=>`${x.sourceOrdinal}:${x.kind}:${x.capability?.index?.name??""}`).join("|")<old.loops.map(x=>`${x.sourceOrdinal}:${x.kind}:${x.capability?.index?.name??""}`).join("|"))next.set(ready,proposal);}paths=[...next.values()];}
 const full=(1n<<BigInt(sourceCount))-1n,best=paths.filter(path=>path.ready===full).sort((a,b)=>a.cost<b.cost?-1:a.cost>b.cost?1:0)[0];if(!best)throw new WherePlanningUnsupportedError("no usable WHERE path");return best;
}
