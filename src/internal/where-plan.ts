// Immutable WHERE candidate and path foundation.
// Directly shaped by SQLite 3.53.4 whereInt.h and where.c whereScanNext,
// whereLoopInsert/whereLoopAddBtree[Index]/wherePathSolver. It deliberately
// publishes no opcodes: lowering consumes the retained admissions unchanged.
import type {ExprNode} from "./parse.ts";
import type {ResolvedSelect,ResolvedSource} from "./resolve.ts";
import type {LemonValue} from "./lemon-runtime.ts";
import type {SqlToken} from "./tokenize.ts";
import {sqliteAsciiFold} from "./sqlite-case.ts";
import type {ColumnNode,IndexNode,PhysicalIndexField,PhysicalIndex} from "./schema.ts";
import {statisticsForIndex,sqliteLogEst} from "./schema.ts";
import type {BuiltinCollation,KeyTerm} from "./comparison.ts";

export type SourceMask=bigint;
export type LogicalEstimate=bigint;
export type WhereOperator="eq"|"is"|"is-null"|"in"|"lt"|"le"|"gt"|"ge";
export type TermOrigin={readonly kind:"where"}|{readonly kind:"join-on";readonly rightSource:number;readonly join:"inner"|"left"|"right"|"full"}|{readonly kind:"using";readonly rightSource:number;readonly name:string}|{readonly kind:"derived";readonly parentTerm:number;readonly reason:"commuted"|"transitive"|"range"};
export interface ColumnBinding {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly column:ColumnNode|null;readonly columnIndex:number;readonly rowid:boolean}
export interface WhereTerm {readonly id:number;readonly expression:ExprNode;readonly origin:TermOrigin;readonly operator:WhereOperator|null;readonly left:ColumnBinding|null;readonly rightAffinity:ColumnNode["affinity"]|null;readonly effectiveCollation:BuiltinCollation|null;readonly originalIndexedOperand:"left"|"right";readonly prereqRight:SourceMask;readonly prereqAll:SourceMask;readonly parentId:number|null;readonly childIds:readonly number[];readonly virtual:boolean;readonly outerJoinSafe:{readonly mayDrive:boolean;readonly mayOmitResidual:boolean}}
export interface WhereClause {readonly split:"and"|"or";readonly terms:readonly WhereTerm[];readonly outer:WhereClause|null}
export type SeekComparisonMode={readonly kind:"comparison";readonly affinity:ColumnNode["affinity"];readonly collation:BuiltinCollation}|{readonly kind:"is-null"};
export interface IndexConstraintAdmission {readonly term:WhereTerm;readonly physicalIndex:PhysicalIndex;readonly fieldOrdinal:number;readonly field:PhysicalIndexField;readonly keyInfoTerm:Readonly<KeyTerm>;readonly operator:WhereOperator;readonly originalIndexedOperand:"left"|"right";readonly comparison:SeekComparisonMode;readonly bound:"equality"|"lower-inclusive"|"lower-exclusive"|"upper-inclusive"|"upper-exclusive"}
export interface RowidConstraint {readonly term:WhereTerm;readonly operator:WhereOperator;readonly originalIndexedOperand:"left"|"right";readonly bound:IndexConstraintAdmission["bound"]}
export interface BtreeCapability {readonly index:IndexNode|null;readonly physicalIndex:PhysicalIndex|null;readonly equalityPrefix:readonly IndexConstraintAdmission[];readonly lower:IndexConstraintAdmission|null;readonly upper:IndexConstraintAdmission|null;readonly constrainedFields:number;readonly orderTermsSatisfied:number;readonly reverse:boolean;readonly covering:boolean;readonly needsTableLookup:boolean;readonly rowidEquality:RowidConstraint|null;readonly rowidLower:RowidConstraint|null;readonly rowidUpper:RowidConstraint|null}
export interface WhereLoop {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly prereq:SourceMask;readonly capability:BtreeCapability|null;readonly kind:"table-scan"|"rowid"|"index";readonly setupCost:LogicalEstimate;readonly runCost:LogicalEstimate;readonly outputRows:LogicalEstimate;readonly terms:readonly WhereTerm[]}
export interface WherePath {readonly loops:readonly WhereLoop[];readonly ready:SourceMask;readonly reverse:SourceMask;readonly rows:LogicalEstimate;readonly cost:LogicalEstimate;readonly unsortedCost:LogicalEstimate;readonly orderTermsSatisfied:number|null}
export interface OrderRequirement {readonly sourceOrdinal:number;readonly column:ColumnNode;readonly descending:boolean;readonly collation:BuiltinCollation}
export const ROWID_NEEDED=Object.freeze({kind:"rowid" as const});
export type NeededColumn=ColumnNode|typeof ROWID_NEEDED;
export interface CandidateOptions {readonly forcedIndex:IndexNode|null;readonly notIndexed?:boolean;readonly sourcePrereq?:SourceMask;readonly neededColumns:ReadonlySet<NeededColumn>;readonly orderBy:readonly OrderRequirement[];readonly resolved?:ResolvedSelect}
export class WherePlanningUnsupportedError extends Error {readonly classification="temporary" as const;constructor(message:string){super(message);this.name="WherePlanningUnsupportedError"}}
const freeze=<T>(value:T):Readonly<T>=>Object.freeze(value);
export function sourceBit(ordinal:number):SourceMask {if(!Number.isSafeInteger(ordinal)||ordinal<0)throw new RangeError("invalid source ordinal");return 1n<<BigInt(ordinal)}
export function whereClause(terms:readonly WhereTerm[],outer:WhereClause|null=null):WhereClause{return freeze({split:"and",terms:Object.freeze([...terms]),outer})}
function numericAffinity(affinity:ColumnNode["affinity"]):boolean{return affinity==="integer"||affinity==="real"||affinity==="numeric";}
/** expr.c sqlite3CompareAffinity: literals have no expression affinity. If
 * both operands have affinity, only same-class TEXT/TEXT or numeric/numeric
 * comparisons retain it; mixed classes compare with BLOB (none). */
function comparisonAffinity(column:ColumnNode,rhs:ColumnNode["affinity"]|null):ColumnNode["affinity"] {if(rhs===null)return column.affinity;if(numericAffinity(column.affinity)||numericAffinity(rhs))return "numeric";return "blob";}
/** sqlite3IndexAffinityOk. BLOB comparison affinity is index-compatible;
 * otherwise the index must belong to the same TEXT or numeric class. */
function affinityOk(field:ColumnNode,affinity:ColumnNode["affinity"]):boolean {return affinity==="blob"||(affinity==="text"?field.affinity==="text":numericAffinity(field.affinity))}
function bound(operator:WhereOperator):IndexConstraintAdmission["bound"] {return operator==="eq"||operator==="is"||operator==="is-null"||operator==="in"?"equality":operator==="gt"?"lower-exclusive":operator==="ge"?"lower-inclusive":operator==="lt"?"upper-exclusive":"upper-inclusive"}
function indexedOperandIdentity(term:WhereTerm):string|null {const reduction=term.expression.reduction;if(!reduction||reduction.kind!=="reduction")return null;const children=exprChildren(reduction);const operand=term.originalIndexedOperand==="left"?children[0]:children[1];return operand?expressionStructuralIdentity(asExpr(operand),true):null;}
const admissionCache=new WeakMap<WhereTerm,WeakMap<PhysicalIndex,Map<number,IndexConstraintAdmission|null>>>();
/** whereScanNext's compatibility gate. Original operand orientation and the
 * already-resolved original-order collation are retained rather than rebuilt. */
export function admitIndexConstraint(term:WhereTerm,physical:PhysicalIndex,fieldOrdinal:number):IndexConstraintAdmission|null {
 let byPhysical=admissionCache.get(term);if(!byPhysical){byPhysical=new WeakMap();admissionCache.set(term,byPhysical);}let byOrdinal=byPhysical.get(physical);if(!byOrdinal){byOrdinal=new Map();byPhysical.set(physical,byOrdinal);}if(byOrdinal.has(fieldOrdinal))return byOrdinal.get(fieldOrdinal)!;
 const field=physical.fields[fieldOrdinal],keyInfoTerm=physical.keyInfo.terms[fieldOrdinal];
 if(!field||!keyInfoTerm||field.role!=="declared"||term.operator===null||!term.outerJoinSafe.mayDrive){byOrdinal.set(fieldOrdinal,null);return null;}
 const expressionMatch=field.expression!==null&&indexedOperandIdentity(term)===expressionStructuralIdentity(field.expression,true);
 if(field.column?term.left?.column!==field.column:!expressionMatch){byOrdinal.set(fieldOrdinal,null);return null;}
 let comparison:SeekComparisonMode;
 if(term.operator==="is-null")comparison=freeze({kind:"is-null"});
 else {const affinity=field.column?comparisonAffinity(field.column,term.rightAffinity):"blob";if((field.column&&!affinityOk(field.column,affinity))||term.effectiveCollation!==field.collation){byOrdinal.set(fieldOrdinal,null);return null;}comparison=freeze({kind:"comparison",affinity,collation:term.effectiveCollation});}
 const admission=freeze({term,physicalIndex:physical,fieldOrdinal,field,keyInfoTerm,operator:term.operator,originalIndexedOperand:term.originalIndexedOperand,comparison,bound:bound(term.operator)});byOrdinal.set(fieldOrdinal,admission);return admission;
}
function isIntegerPrimaryKeyAlias(table:IndexNode["table"],column:ColumnNode):boolean {return !table.withoutRowid&&table.primaryKey.length===1&&table.primaryKey[0]===column&&column.declaredType?.trim().toUpperCase()==="INTEGER";}
function fieldMatchesColumn(physical:PhysicalIndex,field:PhysicalIndexField,wanted:ColumnNode):boolean {return field.column===wanted||(field.role==="rowid-tail"&&isIntegerPrimaryKeyAlias(physical.index.table,wanted));}
function orderContribution(physical:PhysicalIndex,equality:readonly IndexConstraintAdmission[],order:readonly OrderRequirement[],ordinal:number):{count:number;reverse:boolean}{
 const relevant=order.filter(item=>item.sourceOrdinal===ordinal);if(!relevant.length)return {count:0,reverse:false};let direction:boolean|null=null,count=0,requested=0,fieldOrdinal=0;
 // where.c:wherePathSatisfiesOrderBy (eqOpMask): EQ/IS/ISNULL
 // may be skipped to reach later ORDER terms. IN is not a fixed column:
 // it must itself match the next ORDER term or the suffix is not ordered.
 while(fieldOrdinal<equality.length){const field=physical.fields[fieldOrdinal]!,admission=equality[fieldOrdinal]!;const wanted=relevant[requested];if(wanted&&fieldMatchesColumn(physical,field,wanted.column)&&field.collation===wanted.collation){if(admission.operator==="in"){const reverse=field.descending!==wanted.descending;if(direction!==null&&direction!==reverse)return {count,reverse:direction};direction=reverse;}requested++;count++;}else if(admission.operator==="in")return {count,reverse:direction??false};fieldOrdinal++;}
 for(;requested<relevant.length;requested++,fieldOrdinal++){const field=physical.fields[fieldOrdinal],wanted=relevant[requested]!;if(!field||!fieldMatchesColumn(physical,field,wanted.column)||field.collation!==wanted.collation)break;const reverse=field.descending!==wanted.descending;if(direction!==null&&direction!==reverse)break;direction=reverse;count++;}return {count,reverse:direction??false};
}
function admissionOrder(a:IndexConstraintAdmission,b:IndexConstraintAdmission):number {const ap=a.term.prereqRight,bp=b.term.prereqRight;if(ap!==bp)return ap<bp?-1:1;return a.bound.localeCompare(b.bound)||a.term.id-b.term.id;}
function makeCapability(index:IndexNode,physical:PhysicalIndex,equality:readonly IndexConstraintAdmission[],lower:IndexConstraintAdmission|null,upper:IndexConstraintAdmission|null,ordinal:number,needed:ReadonlySet<NeededColumn>,order:readonly OrderRequirement[]):BtreeCapability {const constrained=equality.length+(lower||upper?1:0),ordering=orderContribution(physical,equality,order,ordinal),hasRowidTail=physical.fields.some(field=>field.role==="rowid-tail"),rowidAlias=index.table.primaryKey.length===1&&isIntegerPrimaryKeyAlias(index.table,index.table.primaryKey[0]!),covering=[...needed].every(need=>need===ROWID_NEEDED?hasRowidTail:physical.fields.some(field=>field.column===need)||(!index.table.withoutRowid&&rowidAlias&&index.table.primaryKey.includes(need as ColumnNode)));return freeze({index,physicalIndex:physical,equalityPrefix:Object.freeze([...equality]),lower,upper,constrainedFields:constrained,orderTermsSatisfied:ordering.count,reverse:ordering.reverse,covering,needsTableLookup:!covering,rowidEquality:null,rowidLower:null,rowidUpper:null});}
/** whereLoopAddBtreeIndex proposes alternatives rather than choosing the first
 * term. Each equality chain and each applicable lower/upper pair retains its
 * own exact admissions and prerequisite mask for whereLoopInsert/path solving. */
function capabilities(index:IndexNode,terms:readonly WhereTerm[],ordinal:number,needed:ReadonlySet<NeededColumn>,order:readonly OrderRequirement[]):readonly BtreeCapability[] {
 const physical=index.physical;if(!physical)return Object.freeze([]);const out:BtreeCapability[]=[];
 const visit=(field:number,equality:readonly IndexConstraintAdmission[]):void=>{if(field>=physical.declaredFieldCount){out.push(makeCapability(index,physical,equality,null,null,ordinal,needed,order));return;}const admissions=terms.map(term=>admitIndexConstraint(term,physical,field)).filter((item):item is IndexConstraintAdmission=>item!==null).sort(admissionOrder),equals=admissions.filter(item=>item.bound==="equality");for(const equal of equals)visit(field+1,[...equality,equal]);/* whereLoopAddBtreeIndex restores saved_nEq/nBtm/nTop for each scanned term: an equality/IN branch does not suppress competing range proposals at this slot. */const lowers=admissions.filter(item=>item.bound.startsWith("lower")),uppers=admissions.filter(item=>item.bound.startsWith("upper"));if(!lowers.length&&!uppers.length){out.push(makeCapability(index,physical,equality,null,null,ordinal,needed,order));return;}for(const lower of lowers.length?lowers:[null])for(const upper of uppers.length?uppers:[null])out.push(makeCapability(index,physical,equality,lower,upper,ordinal,needed,order));};visit(0,[]);
 const unique=new Map<string,BtreeCapability>();for(const cap of out){const key=[...cap.equalityPrefix.map(a=>a.term.id),cap.lower?.term.id??"",cap.upper?.term.id??""].join(":");if(!unique.has(key))unique.set(key,cap);}return Object.freeze([...unique.values()]);
}
/** expr.c:sqlite3ExprCompare identity for the represented expression-index
 * grammar. Compare the generated parse structure, not reconstructed SQL text.
 * Parentheses are transparent; source/join provenance remains on WhereTerm. */
export function expressionStructuralIdentity(expression:ExprNode,skipTopCollate=false):string {
 const root=expression.reduction;if(!root||root.kind!=="reduction")return "";
 const identity=(value:LemonValue<SqlToken>):string=>{
  if(value.kind==="terminal"){const token=value.value;if(!token||token.kind==="space"||token.kind==="comment")return "";if(token.kind==="integer"){const raw=token.text.replaceAll("_","");try{let n:bigint;if(/^0x/i.test(raw)){n=BigInt(raw);if(n>0x7fffffffffffffffn&&n<=0xffffffffffffffffn)n-=0x10000000000000000n;}else n=BigInt(raw);if(n>=-0x8000000000000000n&&n<=0x7fffffffffffffffn)return `integer(${n})`;}catch{/* retain token identity */}}const text=token.kind==="id"||token.kind==="keyword"?sqliteAsciiFold(token.text):token.text;return `t(${token.kind}:${JSON.stringify(text)})`;}
  if(value.signature==="expr ::= LP expr RP")return identity(exprChildren(value)[0]!);
  return `r(${value.signature}:${value.children.map(identity).filter(Boolean).join(",")})`;
 };const comparable=skipTopCollate&&root.signature.startsWith("expr ::= expr COLLATE")?exprChildren(root)[0]!:root;return identity(comparable);
}
function directExprReductions(value:LemonValue<SqlToken>):ExprReduction[] {if(value.kind!=="reduction")return[];const out:ExprReduction[]=[];for(const child of value.children){if(child.kind!=="reduction")continue;if(child.signature.startsWith("expr ::="))out.push(child);else if(!child.signature.startsWith("select ::="))out.push(...directExprReductions(child));}return out;}
function isNullLiteral(expression:ExprNode):boolean {return expression.tokens.length===1&&sqliteAsciiFold(expression.tokens[0]!.text)==="null";}
function notNullTarget(expression:ExprNode):ExprNode|null {const r=expression.reduction;if(!r||r.kind!=="reduction"||r.signature!=="expr ::= expr IS NOT expr")return null;const es=exprChildren(r);return es[1]&&isNullLiteral(asExpr(es[1]))?asExpr(es[0]!):null;}
/** expr.c:exprImpliesNotNull represented branches. When uncertain this returns
 * false, preserving whereUsablePartialIndex's correctness-first admission. */
function simpleColumnName(expression:ExprNode):string|null {const r=expression.reduction;if(!r||r.kind!=="reduction")return null;const u=unwrap(r);if(!(u.signature==="expr ::= ID|INDEXED|JOIN_KW"||u.signature.startsWith("expr ::= nm DOT nm")))return null;const ids=asExpr(u).tokens.filter(t=>t.kind==="id"||t.kind==="keyword");return ids.length?sqliteAsciiFold(ids.at(-1)!.text):null;}
// The schema predicate is parsed independently of the SELECT. For a column
// proof its unqualified name denotes this index's table; the query operand
// must be a resolved use of that same source and physical column. Never use
// the spelling of another source's column as evidence (expr.c:6698-6710).
type ProofIdentity=(query:ExprNode,target:ExprNode)=>boolean;
function partialProofIdentity(resolved:ResolvedSelect,source:ResolvedSource):ProofIdentity {
 return (query,target)=>{
  const name=simpleColumnName(target),r=query.reduction;
  if(name===null||!r||r.kind!=="reduction")return false;
  const plain=unwrap(r);
  if(simpleColumnName(asExpr(plain))===null)return false;
  const use=resolved.columnUses.find(item=>item.selectDepth===0&&item.expression===plain);
  if(!use||use.source!==source)return false;
  const column=use.columnIndex<0?null:source.table.columns[use.columnIndex];
  return column!==null&&column!==undefined&&sqliteAsciiFold(column.name)===name;
 };
}
function exprImpliesNotNull(expression:ExprNode,target:ExprNode,sameResolvedExpression:ProofIdentity,seenNot=false):boolean {
 if(sameResolvedExpression(expression,target))return !isNullLiteral(target);
 const r=expression.reduction;if(!r||r.kind!=="reduction")return false;/* exprImpliesNotNull walks only immediate Expr operands. The SELECT beneath IN must not contribute its result expression as an operand of TK_IN. */const es=exprChildren(r).map(asExpr),sig=r.signature;
 const propagatesBoth=sig.includes(" EQ|NE ")||sig.includes(" LT|GT|GE|LE ")||sig.includes(" PLUS|MINUS ")||sig.includes(" BITOR|LSHIFT|RSHIFT ")||sig.includes(" CONCAT ");if(propagatesBoth)seenNot=true;
 if(sig==="expr ::= expr AND expr")return es.some(e=>exprImpliesNotNull(e,target,sameResolvedExpression,seenNot));
 if(sig==="expr ::= expr OR expr")return es.length===2&&es.every(e=>exprImpliesNotNull(e,target,sameResolvedExpression,seenNot));
 if(sig==="expr ::= expr in_op LP select RP"){const negated=r.children.some(child=>child.kind==="reduction"&&child.signature==="in_op ::= NOT IN");return !seenNot&&!negated&&!!es[0]&&exprImpliesNotNull(es[0],target,sameResolvedExpression,true);}
 if(sig==="expr ::= expr in_op LP exprlist RP")return exprImpliesNotNull(es[0]!,target,sameResolvedExpression,true);
 if(sig==="expr ::= expr between_op expr AND expr"){const negated=r.children.some(child=>child.kind==="reduction"&&child.signature==="between_op ::= NOT BETWEEN");if(seenNot||negated)return false;return es.slice(1).some(e=>exprImpliesNotNull(e,target,sameResolvedExpression,true))||exprImpliesNotNull(es[0]!,target,sameResolvedExpression,true);}
 if(propagatesBoth||sig.includes(" STAR|SLASH|REM ")||sig.includes(" BITAND|BITOR|LSHIFT|RSHIFT "))return es.some(e=>exprImpliesNotNull(e,target,sameResolvedExpression,seenNot));
 if(sig==="expr ::= LP expr RP"||sig==="expr ::= expr COLLATE ID|STRING"||sig==="expr ::= PLUS|MINUS expr")return !!es[0]&&exprImpliesNotNull(es[0],target,sameResolvedExpression,seenNot);
 if(sig==="expr ::= NOT expr"||sig==="expr ::= BITNOT expr")return !!es[0]&&exprImpliesNotNull(es[0],target,sameResolvedExpression,true);
 if((sig==="expr ::= expr IS expr"||sig==="expr ::= expr IS NOT expr")&&!seenNot){const truth=expression.tokens.at(-1);if(truth&&["true","false"].includes(sqliteAsciiFold(truth.text))&&sig==="expr ::= expr IS expr")return !!es[0]&&exprImpliesNotNull(es[0],target,sameResolvedExpression,true);}
 return false;
}
function isIntegerZero(expression:ExprNode):boolean {const r=expression.reduction;if(!r||r.kind!=="reduction")return false;if(r.signature==="expr ::= LP expr RP"||r.signature==="expr ::= PLUS|MINUS expr"){const es=exprChildren(r);return es.length===1&&isIntegerZero(asExpr(es[0]!));}if(r.signature!=="expr ::= term")return false;const term=r.children.find((child):child is ExprReduction=>child.kind==="reduction"&&child.signature.startsWith("term ::="));if(!term||term.signature!=="term ::= INTEGER")return false;const token=asExpr(term).tokens[0];if(!token)return false;try{return BigInt(token.text.replaceAll("_",""))===0n}catch{return false;}}
function iifCondition(expression:ExprNode):ExprNode|null {const r=expression.reduction;if(!r||r.kind!=="reduction")return null;const es=directExprReductions(r);if(r.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){const name=expression.tokens[0]&&sqliteAsciiFold(expression.tokens[0].text);if(name!=="iif"&&name!=="if")return null;if(es.length===2)return asExpr(es[0]!);if(es.length===3&&(isNullLiteral(asExpr(es[2]!))||isIntegerZero(asExpr(es[2]!))||sqliteAsciiFold(asExpr(es[2]!).tokens[0]?.text??"")==="false"))return asExpr(es[0]!);return null;}if(r.signature==="expr ::= CASE case_operand case_exprlist case_else END"){const operand=r.children.find((child):child is ExprReduction=>child.kind==="reduction"&&child.signature.startsWith("case_operand ::="));if(operand?.signature!=="case_operand ::=")return null;const hasElse=r.children.some(child=>child.kind==="reduction"&&child.signature==="case_else ::= ELSE expr");if(es.length!==2+(hasElse?1:0))return null;if(!hasElse||isNullLiteral(asExpr(es[2]!))||isIntegerZero(asExpr(es[2]!))||sqliteAsciiFold(asExpr(es[2]!).tokens[0]?.text??"")==="false")return asExpr(es[0]!);}return null;}
function exprImpliesExpr(query:ExprNode,predicate:ExprNode,sameResolvedExpression:ProofIdentity):boolean {if(sameResolvedExpression(query,predicate))return true;const pr=predicate.reduction;if(pr?.kind==="reduction"&&pr.signature==="expr ::= expr OR expr"&&directExprReductions(pr).some(e=>exprImpliesExpr(query,asExpr(e),sameResolvedExpression)))return true;const target=notNullTarget(predicate),queryTarget=notNullTarget(query);if(target!==null&&queryTarget!==null&&sameResolvedExpression(queryTarget,target))return true;if(target!==null&&exprImpliesNotNull(query,target,sameResolvedExpression))return true;const condition=iifCondition(query);return condition!==null&&exprImpliesExpr(condition,predicate,sameResolvedExpression);}
function splitExpressionAnd(expression:ExprNode,out:ExprNode[]):void {const reduction=expression.reduction;if(reduction?.kind==="reduction"&&reduction.signature==="expr ::= expr AND expr"){for(const child of exprChildren(reduction))splitExpressionAnd(asExpr(child),out);}else out.push(expression);}
/** where.c:whereUsablePartialIndex conservative represented branch. Exact
 * sqlite3ExprCompare identity is accepted. Wider OR/NOT-NULL implication is
 * uncertainty and omits the candidate rather than risking incomplete rows. */
function usablePartialIndex(index:IndexNode,terms:readonly WhereTerm[],source:ResolvedSource,ordinal:number,resolved?:ResolvedSelect):boolean {
 if(!index.partialWhere)return true;if(source.leftOfRightJoin||!resolved)return false;
 const sameResolvedExpression=partialProofIdentity(resolved,source);
 const required:ExprNode[]=[];splitExpressionAnd(index.partialWhere,required);
 const bit=sourceBit(ordinal);return required.every(predicate=>terms.some(term=>!term.virtual&&(term.prereqAll&bit)!==0n&&exprImpliesExpr(term.expression,predicate,sameResolvedExpression)&&(!source.joinFromLeft.left||(term.origin.kind==="join-on"&&term.origin.rightSource===ordinal))));
}
/** whereLoopAddBtree's deterministic no-stat candidate subset. */
export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:WhereClause,options:CandidateOptions):readonly WhereLoop[] {
 if(options.forcedIndex&&options.notIndexed)throw new WherePlanningUnsupportedError("INDEXED BY and NOT INDEXED conflict");
 if(options.forcedIndex&&options.forcedIndex.table!==source.table)throw new WherePlanningUnsupportedError("forced index does not belong to source table");
 if(options.forcedIndex&&!options.forcedIndex.physical)throw new WherePlanningUnsupportedError(`unsupported physical index layout: ${options.forcedIndex.name}`);
 const sourcePrereq=options.sourcePrereq??0n;
 const scanOrder=options.orderBy.length===1&&options.orderBy[0]!.sourceOrdinal===sourceOrdinal&&options.orderBy[0]!.column.primaryKeyPosition!==null?options.orderBy[0]:null;
 const scanCapability:BtreeCapability=freeze({index:null,physicalIndex:null,equalityPrefix:Object.freeze([]),lower:null,upper:null,constrainedFields:0,orderTermsSatisfied:scanOrder?1:0,reverse:scanOrder?.descending??false,covering:true,needsTableLookup:false,rowidEquality:null,rowidLower:null,rowidUpper:null});
 const owned=clause.terms.filter(term=>(term.prereqAll&sourceBit(sourceOrdinal))!==0n),own=owned.filter(term=>term.left?.source===source&&term.outerJoinSafe.mayDrive),scan:WhereLoop=freeze({source,sourceOrdinal,prereq:sourcePrereq,capability:scanCapability,kind:"table-scan",setupCost:0n,runCost:115n,outputRows:99n,terms:Object.freeze(owned)});
 const loops:WhereLoop[]=[];if(!options.forcedIndex)loops.push(scan);
 const rowid=own.filter(term=>term.left?.rowid&&term.operator!==null&&term.operator!=="is-null").sort((a,b)=>a.prereqRight<b.prereqRight?-1:a.prereqRight>b.prereqRight?1:a.id-b.id),rowEquals=rowid.filter(term=>term.operator==="eq"||term.operator==="is"),rowLowers=rowid.filter(term=>term.operator==="gt"||term.operator==="ge"),rowUppers=rowid.filter(term=>term.operator==="lt"||term.operator==="le");
 const rowOrder=options.orderBy.length===1&&options.orderBy[0]!.sourceOrdinal===sourceOrdinal&&options.orderBy[0]!.column.primaryKeyPosition!==null?options.orderBy[0]:null;
 if(!options.forcedIndex&&(rowEquals.length||rowLowers.length||rowUppers.length)){const make=(term:WhereTerm|null):RowidConstraint|null=>term&&term.operator?freeze({term,operator:term.operator,originalIndexedOperand:term.originalIndexedOperand,bound:bound(term.operator)}):null,rowidCovering=[...options.neededColumns].every(need=>need===ROWID_NEEDED),propose=(rowEq:WhereTerm|null,rowLower:WhereTerm|null,rowUpper:WhereTerm|null):void=>{const used=[rowEq,rowLower,rowUpper].filter((x):x is WhereTerm=>!!x),cap:BtreeCapability=freeze({index:null,physicalIndex:null,equalityPrefix:Object.freeze([]),lower:null,upper:null,constrainedFields:1,orderTermsSatisfied:rowOrder?1:0,reverse:rowOrder?.descending??false,covering:rowidCovering,needsTableLookup:!rowidCovering,rowidEquality:make(rowEq),rowidLower:make(rowLower),rowidUpper:make(rowUpper)});loops.push(freeze({source,sourceOrdinal,prereq:used.reduce((m,t)=>m|t.prereqRight,sourcePrereq),capability:cap,kind:"rowid",setupCost:0n,runCost:rowEq?20n:40n,outputRows:rowEq?0n:40n,terms:Object.freeze(owned)}));};if(rowEquals.length)rowEquals.forEach(term=>propose(term,null,null));else for(const lower of rowLowers.length?rowLowers:[null])for(const upper of rowUppers.length?rowUppers:[null])propose(null,lower,upper);}
 if(!options.notIndexed)for(const index of source.table.indexes){if(options.forcedIndex&&index!==options.forcedIndex)continue;if(!usablePartialIndex(index,clause.terms,source,sourceOrdinal,options.resolved))continue;for(const cap of capabilities(index,own,sourceOrdinal,options.neededColumns,options.orderBy)){if(!options.forcedIndex&&cap.constrainedFields===0&&cap.orderTermsSatisfied===0&&(!cap.covering||options.orderBy.length>0))continue;const selected=[...cap.equalityPrefix,cap.lower,cap.upper].filter((a):a is IndexConstraintAdmission=>a!==null);const prereq=selected.reduce((mask,admission)=>mask|admission.term.prereqRight,sourcePrereq),estimate=indexLoopEstimate(index,cap);loops.push(freeze({source,sourceOrdinal,prereq,capability:cap,kind:"index",setupCost:0n,runCost:estimate.run,outputRows:estimate.rows,terms:Object.freeze(owned)}));}}
 if(options.forcedIndex&&!loops.some(loop=>loop.kind==="index"))throw new WherePlanningUnsupportedError(`forced index is unusable: ${options.forcedIndex.name}`);return Object.freeze(adjustIndexSubsets(loops));
}
/** build.c:sqlite3DefaultRowEst, analyze.c:analysisLoader: the slots
 * after slot zero are absolute prefix cardinalities, not decrements. */
function indexLoopEstimate(index:IndexNode,cap:BtreeCapability):{run:bigint;rows:bigint}{
 const stats=statisticsForIndex(index),defaults=[33,32,30,28,26];
 const estimates=stats?.rowLogEst??[99,...Array.from({length:index.terms.length},(_,i)=>i===index.terms.length-1&&index.unique?0:defaults[i]??23)];
 const size=BigInt(estimates[0]??99),logSize=size<=10n?0n:BigInt(sqliteLogEst(size)-33);
 let rows=size,inMul=0n;
 for(let i=0;i<cap.equalityPrefix.length;i++){
   const admission=cap.equalityPrefix[i]!;
   rows+=BigInt((estimates[i+1]??23)-(estimates[i]??99));
   if(admission.operator==="in"){
     // whereLoopAddBtreeIndex: literal list contributes seek iterations.
     const n=admission.term.expression.tokens.filter(t=>t.text===",").length+1;
     inMul+=BigInt(sqliteLogEst(BigInt(n)));
   }
 }
 // where.c:whereRangeScanEst/whereRangeAdjust: each bound reduces by 20,
 // paired default bounds subtract another 20, clamp to 10 and at most
 // saved_nOut minus the number of bounds. Not a 10/20 total reduction.
 if(cap.lower||cap.upper){
   const bounds=BigInt(Number(!!cap.lower)+Number(!!cap.upper));
   const adjusted=rows-20n*bounds-(bounds===2n?20n:0n);
   rows=rows-bounds<adjusted?rows-bounds:adjusted<10n?10n:adjusted;
 }
 const idx=logEstAdd(logSize,rows+(cap.needsTableLookup?16n:1n));
 return {run:(cap.needsTableLookup?logEstAdd(idx,rows+16n):idx)+inMul,rows:rows+inMul};
}
/** where.c:whereSortingCost, ordinary ORDER BY (no LIMIT/DISTINCT). */
function sortCost(rows:bigint,columns:number,orderTerms:number,ordered:number):bigint {
 let cost=rows+BigInt(sqliteLogEst(BigInt(Math.floor((columns+59)/30))));
 if(ordered>0)cost+=BigInt(sqliteLogEst(BigInt(Math.floor((orderTerms-ordered)*100/orderTerms)))-66);
 return cost+(rows<=10n?0n:BigInt(sqliteLogEst(rows)-33));
}
/** where.c:whereLoopCheaperProperSubset / whereLoopAdjustCost: compare
 * admitted terms and index coverage, including case 2 across indexes. The
 * template is adjusted against loops inserted before it, never future loops. */
function properSubset(weak:WhereLoop,strong:WhereLoop):boolean {
 const a=weak.capability,b=strong.capability;
 if(weak.kind!=="index"||strong.kind!=="index"||!a||!b)return false;
 if(weak.runCost>strong.runCost&&weak.outputRows>strong.outputRows)return false;
 if(a.index===b.index&&a.equalityPrefix.length<b.equalityPrefix.length)return true;
 const terms=(cap:BtreeCapability)=>[...cap.equalityPrefix,cap.lower,cap.upper].filter((x):x is IndexConstraintAdmission=>x!==null).map(x=>x.term);
 const left=terms(a),right=terms(b);
 if(left.length>=right.length || (a.covering&&!b.covering))return false;
 return left.every(term=>right.includes(term));
}
function adjustIndexSubsets(loops:WhereLoop[]):WhereLoop[]{
 const inserted:WhereLoop[]=[];
 for(const candidate of loops){let template=candidate;
  if(candidate.kind==="index")for(const previous of inserted){
   if(previous.sourceOrdinal!==template.sourceOrdinal||previous.kind!=="index")continue;
   if(properSubset(previous,template))template=freeze({...template,runCost:template.runCost<previous.runCost?template.runCost:previous.runCost,outputRows:template.outputRows<previous.outputRows-1n?template.outputRows:previous.outputRows-1n});
   else if(properSubset(template,previous))template=freeze({...template,runCost:template.runCost>previous.runCost?template.runCost:previous.runCost,outputRows:template.outputRows>previous.outputRows+1n?template.outputRows:previous.outputRows+1n});
  }
  inserted.push(template);
 }
 return inserted;
}
function loopOrder(a:WhereLoop,b:WhereLoop):number {return a.runCost<b.runCost?-1:a.runCost>b.runCost?1:a.kind.localeCompare(b.kind)||a.sourceOrdinal-b.sourceOrdinal}
/** Exact port of util.c:sqlite3LogEstAdd for bigint LogEst units. */
export function logEstAdd(a:LogicalEstimate,b:LogicalEstimate):LogicalEstimate {const x=[10n,10n,9n,9n,8n,8n,7n,7n,7n,6n,6n,6n,5n,5n,5n,4n,4n,4n,4n,3n,3n,3n,3n,3n,3n,2n,2n,2n,2n,2n,2n,2n];if(a<b)return logEstAdd(b,a);const d=a-b;if(d>49n)return a;if(d>31n)return a+1n;return a+x[Number(d)]!;}
function pathKey(path:WherePath):string{return path.loops.map(x=>`${x.sourceOrdinal}:${x.kind}:${x.capability?.index?.name??""}`).join("|")}
/** Admitted wherePathSolver translation: retain up to mxChoice N-best paths at
 * every depth, applying ready-mask/cost/row/order dominance before truncation. */
export function wherePathChoiceWidth(sourceCount:number):1|5|12{return sourceCount<=1?1:sourceCount===2?5:12;}
export function wherePathSolver(candidates:readonly (readonly WhereLoop[])[],sourceCount:number,maxChoices=wherePathChoiceWidth(sourceCount),orderTerms=0,resultColumns=1,sortRows:bigint|null=null):WherePath {
 let paths:WherePath[]=[freeze({loops:Object.freeze([]),ready:0n,reverse:0n,rows:0n,cost:0n,unsortedCost:0n,orderTermsSatisfied:0})];
 for(let depth=0;depth<sourceCount;depth++){const next:WherePath[]=[];for(const path of paths)for(const group of candidates)for(const loop of [...group].sort(loopOrder)){const bit=sourceBit(loop.sourceOrdinal);if(path.ready&bit||(loop.prereq&~path.ready)!==0n)continue;const cap=loop.capability,run=logEstAdd(loop.setupCost,loop.runCost+path.rows),cost=logEstAdd(path.cost,run),ready=path.ready|bit,ordered=sourceCount===1?(cap?.orderTermsSatisfied??0):0,scored=sourceCount===1&&orderTerms>0&&ordered<orderTerms?logEstAdd(cost,sortCost(sortRows??path.rows+loop.outputRows,resultColumns,orderTerms,ordered))+3n:cost;const proposal:WherePath=freeze({loops:Object.freeze([...path.loops,loop]),ready,reverse:path.reverse|(cap?.reverse?bit:0n),rows:path.rows+loop.outputRows,cost:scored,unsortedCost:cost,orderTermsSatisfied:ordered});const dominated=next.some(old=>old.ready===ready&&old.cost<=scored&&old.rows<=proposal.rows&&(old.orderTermsSatisfied??0)>=ordered);if(dominated)continue;for(let i=next.length-1;i>=0;i--){const old=next[i]!;if(old.ready===ready&&scored<=old.cost&&proposal.rows<=old.rows&&ordered>=(old.orderTermsSatisfied??0))next.splice(i,1);}next.push(proposal);}paths=next.sort((a,b)=>a.cost<b.cost?-1:a.cost>b.cost?1:pathKey(a).localeCompare(pathKey(b))).slice(0,maxChoices);}
 const full=(1n<<BigInt(sourceCount))-1n,best=paths.filter(path=>path.ready===full).sort((a,b)=>a.cost<b.cost?-1:a.cost>b.cost?1:pathKey(a).localeCompare(pathKey(b)))[0];if(!best)throw new WherePlanningUnsupportedError("no usable WHERE path");return best;
}

type ExprReduction=LemonValue<SqlToken>&{readonly kind:"reduction"};
function exprChildren(node:ExprReduction):ExprReduction[]{return node.children.filter((x):x is ExprReduction=>x.kind==="reduction"&&x.signature.startsWith("expr ::="));}
function asExpr(node:ExprReduction):ExprNode {const tokens:SqlToken[]=[];const collect=(x:LemonValue<SqlToken>):void=>{if(x.kind==="terminal"){if(x.value)tokens.push(x.value);}else x.children.forEach(collect)};collect(node);return Object.freeze({kind:"tokens",tokens:Object.freeze(tokens),reduction:node});}
function unwrap(node:ExprReduction):ExprReduction {let at=node;while(at.signature==="expr ::= LP expr RP"||at.signature.startsWith("expr ::= expr COLLATE")){const child=exprChildren(at)[0];if(!child)break;at=child;}return at;}
function explicitExprCollation(node:ExprReduction):BuiltinCollation|null {if(node.signature.startsWith("expr ::= expr COLLATE")){const token=node.children.filter(x=>x.kind==="terminal").at(-1);const name=token?.kind==="terminal"?sqliteAsciiFold(token.value.text):"";return name==="binary"||name==="nocase"||name==="rtrim"?name:null;}for(const child of exprChildren(node)){const found=explicitExprCollation(child);if(found)return found;}return null;}
function literalAffinity(_node:ExprReduction):ColumnNode["affinity"]|null {return null;}
function reductionContains(root:ExprReduction,needle:ExprReduction):boolean {return root===needle||root.children.some(x=>x.kind==="reduction"&&reductionContains(x,needle));}
function columnUse(resolved:ResolvedSelect,node:ExprReduction){const plain=unwrap(node);return resolved.columnUses.find(use=>use.selectDepth===0&&use.expression===plain)??resolved.columnUses.find(use=>use.selectDepth===0&&reductionContains(plain,use.expression));}
function binding(resolved:ResolvedSelect,node:ExprReduction):ColumnBinding|null {const use=columnUse(resolved,node);if(!use)return null;const column=use.columnIndex<0?null:use.source.table.columns[use.columnIndex]??null;return freeze({source:use.source,sourceOrdinal:resolved.sources.indexOf(use.source),column,columnIndex:use.columnIndex,rowid:use.columnIndex<0});}
function prereq(resolved:ResolvedSelect,node:ExprReduction):SourceMask {let mask=0n;for(const use of resolved.columnUses)if(use.selectDepth===0&&reductionContains(node,use.expression)){const at=resolved.sources.indexOf(use.source);if(at>=0)mask|=sourceBit(at);}return mask;}
function splitAnd(node:ExprReduction,out:ExprReduction[]):void {if(node.signature==="expr ::= expr AND expr"){for(const child of exprChildren(node))splitAnd(child,out);}else out.push(node);}
function comparisonOperator(node:ExprReduction):WhereOperator|null {const text=node.children.filter(x=>x.kind==="terminal").map(x=>x.kind==="terminal"?sqliteAsciiFold(x.value.text):"").join(" ");if(node.signature.startsWith("expr ::= expr EQ|NE expr"))return text.includes("!=")||text.includes("<>")?null:"eq";if(node.signature.startsWith("expr ::= expr LT|GT|GE|LE expr"))return text.includes(">=")?"ge":text.includes("<=")?"le":text.includes(">")?"gt":"lt";if(node.signature==="expr ::= expr in_op LP exprlist RP")return node.children.some(x=>x.kind==="reduction"&&x.signature==="in_op ::= NOT IN")?null:"in";if(node.signature==="expr ::= expr IS expr"){const rhs=exprChildren(node)[1];if(rhs&&asExpr(rhs).tokens.some(token=>sqliteAsciiFold(token.text)==="null"))return "is-null";return "is";}if(node.signature==="expr ::= expr ISNULL|NOTNULL"&&!text.includes("notnull"))return "is-null";return null;}
function reverseOperator(op:WhereOperator):WhereOperator{return op==="lt"?"gt":op==="le"?"ge":op==="gt"?"lt":op==="ge"?"le":op;}
function effectiveCollation(left:ExprReduction,right:ExprReduction,leftBinding:ColumnBinding|null,rightBinding:ColumnBinding|null):BuiltinCollation {return explicitExprCollation(left)??explicitExprCollation(right)??((leftBinding?.column?.collation&&sqliteAsciiFold(leftBinding.column.collation)) as BuiltinCollation|null)??((rightBinding?.column?.collation&&sqliteAsciiFold(rightBinding.column.collation)) as BuiltinCollation|null)??"binary";}
export interface WhereAnalysis {readonly clause:WhereClause;readonly plannerEligible:boolean;readonly fallback:"right-full"|null}
/** whereexpr.c sqlite3WhereSplit/exprAnalyze subset. It consumes resolved
 * expression identity and is the only production constructor for WhereTerm. */
export function analyzeWhere(resolved:ResolvedSelect):WhereAnalysis {
 if(resolved.sources.some(source=>source.joinFromLeft.right||source.joinFromLeft.outer||source.leftOfRightJoin))return freeze({clause:whereClause([]),plannerEligible:false,fallback:"right-full"});
 const specs:{node:ExprReduction;origin:TermOrigin}[]=[];if(resolved.source.where?.reduction?.kind==="reduction"){const parts:ExprReduction[]=[];splitAnd(resolved.source.where.reduction as ExprReduction,parts);for(const node of parts)specs.push({node,origin:{kind:"where"}});}
 resolved.sources.forEach((source,index)=>{if(source.on?.reduction?.kind!=="reduction")return;const parts:ExprReduction[]=[];splitAnd(source.on.reduction as ExprReduction,parts);for(const node of parts)specs.push({node,origin:{kind:"join-on",rightSource:index,join:source.joinFromLeft.left?"left":"inner"}});});
 type Draft={node:ExprReduction;origin:TermOrigin;operator:WhereOperator|null;left:ColumnBinding|null;rightNode:ExprReduction;orientation:"left"|"right";prereqAll:SourceMask;prereqRight:SourceMask;collation:BuiltinCollation|null;parentId:number|null;childIds:number[];virtual:boolean;outerJoinSafe:{mayDrive:boolean;mayOmitResidual:boolean}};
 const drafts:Draft[]=[];
 for(const {node,origin} of specs){let op=comparisonOperator(node);const children=exprChildren(node),originalLeftNode=children[0]??node,originalRightNode=children[1]??node,originalLeft=binding(resolved,originalLeftNode),originalRight=binding(resolved,originalRightNode),all=prereq(resolved,node);let leftNode=originalLeftNode,rightNode=originalRightNode,left=originalLeft,orientation:"left"|"right"="left";
  if(!left&&originalRight&&op&&op!=="in"){orientation="right";op=reverseOperator(op);leftNode=originalRightNode;rightNode=originalLeftNode;left=originalRight;}
  const isLeft=origin.kind==="join-on"&&origin.join==="left",mayDrive=op!==null&&!!left&&!(isLeft&&left.sourceOrdinal<origin.rightSource),coll=op==="is-null"?null:effectiveCollation(originalLeftNode,originalRightNode,originalLeft,originalRight),parentId=drafts.length;
  const parent:Draft={node,origin,operator:op,left,rightNode,orientation,prereqAll:all,prereqRight:left?all&~sourceBit(left.sourceOrdinal):all,collation:coll,parentId:null,childIds:[],virtual:false,outerJoinSafe:{mayDrive,mayOmitResidual:!isLeft}};drafts.push(parent);
  // whereexpr.c:exprAnalyze creates a virtual commuted child when both
  // operands are indexable columns. It retains original expression collation
  // but owns independent left binding and RHS prerequisites.
  if(originalLeft&&originalRight&&op&&op!=="in"){const childId=drafts.length,childOp=reverseOperator(op),childLeft=orientation==="left"?originalRight:originalLeft,childRightNode=orientation==="left"?originalLeftNode:originalRightNode,childMayDrive=!(isLeft&&childLeft.sourceOrdinal<origin.rightSource);parent.childIds.push(childId);drafts.push({node,origin:{kind:"derived",parentTerm:parentId,reason:"commuted"},operator:childOp,left:childLeft,rightNode:childRightNode,orientation:orientation==="left"?"right":"left",prereqAll:all,prereqRight:all&~sourceBit(childLeft.sourceOrdinal),collation:coll,parentId,childIds:[],virtual:true,outerJoinSafe:{mayDrive:childMayDrive,mayOmitResidual:false}});}
 }
 const terms:WhereTerm[]=drafts.map((draft,id)=>freeze({id,expression:asExpr(draft.node),origin:draft.origin,operator:draft.operator,left:draft.left,rightAffinity:literalAffinity(draft.rightNode)??binding(resolved,draft.rightNode)?.column?.affinity??null,effectiveCollation:draft.collation,originalIndexedOperand:draft.orientation,prereqRight:draft.prereqRight,prereqAll:draft.prereqAll,parentId:draft.parentId,childIds:Object.freeze([...draft.childIds]),virtual:draft.virtual,outerJoinSafe:freeze(draft.outerJoinSafe)}));
 return freeze({clause:whereClause(terms),plannerEligible:true,fallback:null});
}

export interface WherePlanRequest {readonly neededColumns:readonly ReadonlySet<NeededColumn>[];readonly orderBy:readonly OrderRequirement[];readonly excludedIndexSources?:ReadonlySet<number>}
export interface WherePlanSelection {readonly analysis:WhereAnalysis;readonly path:WherePath|null;readonly plannerCandidates:number;readonly plannerPaths:number}
/** Publish the lowering handoff without asking a caller to reconstruct either
 * term eligibility or INDEXED BY/NOT INDEXED gates. */
export function planWhere(resolved:ResolvedSelect,request:WherePlanRequest):WherePlanSelection {
 // RIGHT/FULL is statement-wide fallback and never participates in W1/W2.
 const hasRightFull=resolved.sources.some(source=>source.joinFromLeft.right||source.joinFromLeft.outer||source.leftOfRightJoin);if(hasRightFull){const analysis=analyzeWhere(resolved);return freeze({analysis,path:null,plannerCandidates:0,plannerPaths:0});}
 // Represented WITHOUT ROWID layouts participate through their synthetic
 // primary-index owner and physical secondary descriptors.
 const analysis=analyzeWhere(resolved);
 let joinBarrier=0n;const groups=resolved.sources.map((source,ordinal)=>{const prefix=(1n<<BigInt(ordinal))-1n;if(source.joinFromLeft.left)joinBarrier|=prefix|sourceBit(ordinal);if(source.joinFromLeft.cross)joinBarrier|=prefix;const sourcePrereq=joinBarrier&~sourceBit(ordinal);const forced=source.indexedBy===null?null:source.table.indexes.find(index=>sqliteAsciiFold(index.name)===sqliteAsciiFold(source.indexedBy!))??null;if(source.indexedBy!==null&&!forced)throw new WherePlanningUnsupportedError(`no such index: ${source.indexedBy}`);return btreeLoops(source,ordinal,analysis.clause,{forcedIndex:forced,notIndexed:source.notIndexed||request.excludedIndexSources?.has(ordinal)===true,sourcePrereq,neededColumns:request.neededColumns[ordinal]??new Set(),orderBy:request.orderBy,resolved});});
 const unsorted=wherePathSolver(groups,resolved.sources.length,wherePathChoiceWidth(resolved.sources.length));
 const path=request.orderBy.length?wherePathSolver(groups,resolved.sources.length,wherePathChoiceWidth(resolved.sources.length),request.orderBy.length,resolved.result.length,unsorted.rows+1n):unsorted;return freeze({analysis,path,plannerCandidates:groups.reduce((sum,group)=>sum+group.length,0),plannerPaths:path.loops.length});
}
