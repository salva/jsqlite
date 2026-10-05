// Immutable WHERE candidate and path foundation.
// Directly shaped by SQLite 3.53.4 whereInt.h and where.c whereScanNext,
// whereLoopInsert/whereLoopAddBtree[Index]/wherePathSolver. It deliberately
// publishes no opcodes: lowering consumes the retained admissions unchanged.
import {whereOrCollect,whereOrInsert,whereOrAccumulate,type WhereOrSet} from "./where-or-cost.ts";
import {SqlParseError,type ExprNode,type SelectNode} from "./parse.ts";
import type {ResolvedSelect,ResolvedSource} from "./resolve.ts";
import type {LemonValue} from "./lemon-runtime.ts";
import type {SqlToken} from "./tokenize.ts";
import {sqliteAsciiFold} from "./sqlite-case.ts";
import type {ColumnNode,IndexNode,PhysicalIndexField,PhysicalIndex} from "./schema.ts";
import {statisticsForIndex,sqliteLogEst,integerPrimaryKeyColumn} from "./schema.ts";
import type {BuiltinCollation,KeyTerm} from "./comparison.ts";

export type SourceMask=bigint;
export type LogicalEstimate=bigint;
export type WhereOperator="eq"|"is"|"is-null"|"in"|"lt"|"le"|"gt"|"ge";
export type TermOrigin={readonly kind:"where"}|{readonly kind:"join-on";readonly rightSource:number;readonly join:"inner"|"left"|"right"|"full"}|{readonly kind:"using";readonly rightSource:number;readonly name:string}|{readonly kind:"derived";readonly parentTerm:number;readonly reason:"commuted"|"transitive"|"range"};
export interface ColumnBinding {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly column:ColumnNode|null;readonly columnIndex:number;readonly rowid:boolean}
export interface WhereTerm {readonly id:number;readonly expression:ExprNode;readonly origin:TermOrigin;readonly operator:WhereOperator|null;readonly info?:WhereTermInfo;readonly left:ColumnBinding|null;readonly rightAffinity:ColumnNode["affinity"]|null;readonly effectiveCollation:BuiltinCollation|null;readonly originalIndexedOperand:"left"|"right";readonly prereqRight:SourceMask;readonly prereqAll:SourceMask;readonly parentId:number|null;readonly childIds:readonly number[];readonly virtual:boolean;readonly outerJoinSafe:{readonly mayDrive:boolean;readonly mayOmitResidual:boolean}}
export type WhereTermInfo={readonly kind:"or";readonly parentTerm:WhereTerm;readonly clause:WhereClause;readonly indexable:SourceMask}|{readonly kind:"and";readonly clause:WhereClause};
export interface WhereClause {readonly split:"and"|"or";readonly terms:readonly WhereTerm[];readonly outer:WhereClause|null}
export type SeekComparisonMode={readonly kind:"comparison";readonly affinity:ColumnNode["affinity"];readonly collation:BuiltinCollation}|{readonly kind:"is-null"};
export interface IndexConstraintAdmission {readonly term:WhereTerm;readonly physicalIndex:PhysicalIndex;readonly fieldOrdinal:number;readonly field:PhysicalIndexField;readonly keyInfoTerm:Readonly<KeyTerm>;readonly operator:WhereOperator;readonly originalIndexedOperand:"left"|"right";readonly comparison:SeekComparisonMode;readonly bound:"equality"|"lower-inclusive"|"lower-exclusive"|"upper-inclusive"|"upper-exclusive"}
export interface RowidConstraint {readonly term:WhereTerm;readonly operator:WhereOperator;readonly originalIndexedOperand:"left"|"right";readonly bound:IndexConstraintAdmission["bound"]}
export interface BtreeCapability {readonly index:IndexNode|null;readonly physicalIndex:PhysicalIndex|null;readonly equalityPrefix:readonly IndexConstraintAdmission[];readonly lower:IndexConstraintAdmission|null;readonly upper:IndexConstraintAdmission|null;readonly constrainedFields:number;readonly orderTermsSatisfied:number;readonly reverse:boolean;readonly covering:boolean;readonly needsTableLookup:boolean;readonly rowidEquality:RowidConstraint|null;readonly rowidLower:RowidConstraint|null;readonly rowidUpper:RowidConstraint|null}
export interface WhereLoop {readonly source:ResolvedSource;readonly sourceOrdinal:number;readonly prereq:SourceMask;readonly capability:BtreeCapability|null;readonly kind:"table-scan"|"rowid"|"index"|"multi-or";readonly orInfo?:Extract<WhereTermInfo,{kind:"or"}>;readonly sortIdentity?:number;readonly indexRowSize?:LogicalEstimate;readonly setupCost:LogicalEstimate;readonly runCost:LogicalEstimate;readonly outputRows:LogicalEstimate;readonly terms:readonly WhereTerm[]}
export interface WherePath {readonly loops:readonly WhereLoop[];readonly ready:SourceMask;readonly reverse:SourceMask;readonly rows:LogicalEstimate;readonly cost:LogicalEstimate;readonly unsortedCost:LogicalEstimate;readonly orderTermsSatisfied:number|null}
export interface OrderRequirement {readonly sourceOrdinal:number;readonly column:ColumnNode;readonly descending:boolean;readonly collation:BuiltinCollation;readonly nulls?:"first"|"last"|null}
export const ROWID_NEEDED=Object.freeze({kind:"rowid" as const});
export type NeededColumn=ColumnNode|typeof ROWID_NEEDED;
export interface CandidateOptions {readonly forcedIndex:IndexNode|null;readonly notIndexed?:boolean;readonly sourcePrereq?:SourceMask;readonly neededColumns:ReadonlySet<NeededColumn>;readonly orderBy:readonly OrderRequirement[];readonly resolved?:ResolvedSelect;readonly planBudget?:WherePlanBudget;readonly orSet?:WhereOrSet;readonly ordinaryLoops?:readonly WhereLoop[]}
export class WherePlanningUnsupportedError extends Error {readonly classification="temporary" as const;constructor(message:string){super(message);this.name="WherePlanningUnsupportedError"}}
export interface WherePlanBudget {remaining:number}
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
 const expressionMatch=term.left?.source.table===physical.index.table&&term.left?.columnIndex===-2&&field.expression!==null&&indexedOperandIdentity(term)===expressionStructuralIdentity(field.expression,true);
 if(field.column?term.left?.column!==field.column:!expressionMatch){byOrdinal.set(fieldOrdinal,null);return null;}
 let comparison:SeekComparisonMode;
 if(term.operator==="is-null")comparison=freeze({kind:"is-null"});
 else {const affinity=field.column?comparisonAffinity(field.column,term.rightAffinity):"blob";if((field.column&&!affinityOk(field.column,affinity))||term.effectiveCollation!==field.collation){byOrdinal.set(fieldOrdinal,null);return null;}comparison=freeze({kind:"comparison",affinity,collation:term.effectiveCollation});}
 const admission=freeze({term,physicalIndex:physical,fieldOrdinal,field,keyInfoTerm,operator:term.operator,originalIndexedOperand:term.originalIndexedOperand,comparison,bound:bound(term.operator)});byOrdinal.set(fieldOrdinal,admission);return admission;
}
function isIntegerPrimaryKeyAlias(table:IndexNode["table"],column:ColumnNode):boolean {return integerPrimaryKeyColumn(table)===column;}
function fieldMatchesColumn(physical:PhysicalIndex,field:PhysicalIndexField,wanted:ColumnNode):boolean {return field.column===wanted||(field.role==="rowid-tail"&&isIntegerPrimaryKeyAlias(physical.index.table,wanted));}
function orderContribution(physical:PhysicalIndex,equality:readonly IndexConstraintAdmission[],order:readonly OrderRequirement[],ordinal:number):{count:number;reverse:boolean}{
 const relevant=order.filter(item=>item.sourceOrdinal===ordinal);if(!relevant.length||relevant.some(item=>item.nulls!=null&&item.nulls!==(item.descending?"last":"first")))return {count:0,reverse:false};let direction:boolean|null=null,count=0,requested=0,fieldOrdinal=0;
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
function* capabilities(index:IndexNode,terms:readonly WhereTerm[],ordinal:number,needed:ReadonlySet<NeededColumn>,order:readonly OrderRequirement[]):Generator<BtreeCapability> {
 const physical=index.physical;if(!physical)return;
 // A suspended generator is the represented recursive rc==SQLITE_OK seam:
 // the builder resumes exploration only after insertion permits continuation.
 function* visit(field:number,equality:readonly IndexConstraintAdmission[]):Generator<BtreeCapability>{
  if(field>=physical!.declaredFieldCount){yield makeCapability(index,physical!,equality,null,null,ordinal,needed,order);return;}
  const admissions=terms.map(term=>admitIndexConstraint(term,physical!,field)).filter((item):item is IndexConstraintAdmission=>item!==null).sort(admissionOrder);
  for(const equal of admissions.filter(item=>item.bound==="equality"))yield* visit(field+1,[...equality,equal]);
  const lowers=admissions.filter(item=>item.bound.startsWith("lower")),uppers=admissions.filter(item=>item.bound.startsWith("upper"));
  if(!lowers.length&&!uppers.length){yield makeCapability(index,physical!,equality,null,null,ordinal,needed,order);return;}
  for(const lower of lowers.length?lowers:[null])for(const upper of uppers.length?uppers:[null])yield makeCapability(index,physical!,equality,lower,upper,ordinal,needed,order);
 }
 yield* visit(0,[]);
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
 // expr.c:exprImpliesNotNull has no TK_AND/TK_OR cases. Top-level AND
 // splitting belongs to analyzeWhere. Never infer non-NULL through Boolean
 // operands: NULL AND false is false, NULL OR true is true.
 if(sig==="expr ::= expr AND expr")return false;
 // Bounded true-only OR proof compensates for absent upstream OR-derived
 // terms: every arm must independently prove the same target. It is NOT
 // valid beneath NOT/non-NULL contexts. See TRANSLATION R1 correction.
 if(sig==="expr ::= expr OR expr")return !seenNot&&es.length===2&&es.every(e=>exprImpliesNotNull(e,target,sameResolvedExpression,false));
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
/** where.c:indexMightHelpWithOrderBy tests usefulness before full proof. */
function indexMightHelpWithOrderBy(index:IndexNode|null,ordinal:number,table:ResolvedSource["table"],order:readonly OrderRequirement[]):boolean {
 return !index?.unordered&&order.some(term=>term.sourceOrdinal===ordinal&&(isIntegerPrimaryKeyAlias(table,term.column)||!!index?.physical?.fields.some(field=>field.role==="declared"&&fieldMatchesColumn(index.physical!,field,term.column))));
}
/** expr.c:2899 sqlite3ExprIsInteger with pParse=0: EP_IntValue only,
 * unary signs recurse; parentheses are transparent parse nodes. Do not use
 * runtime INTEGER conversion or constant folding to manufacture EP_IntValue. */
function exprInteger32(value:ExprReduction):bigint|null {
 if(value.signature==="expr ::= LP expr RP")return exprInteger32(exprChildren(value)[0]!);
 if(value.signature==="expr ::= PLUS|MINUS expr"){
  const child=exprInteger32(exprChildren(value)[0]!);if(child===null)return null;
  return value.children.some(c=>c.kind==="terminal"&&c.value.text==="-")?-child:child;
 }
 if(value.signature!=="expr ::= term")return null;
 const term=value.children.find(c=>c.kind==="reduction");
 if(term?.kind!=="reduction"||term.signature!=="term ::= INTEGER")return null;
 const token=term.children.find(c=>c.kind==="terminal");if(token?.kind!=="terminal")return null;
 try{const n=BigInt(token.value.text.replaceAll("_",""));return n>=0n&&n<=2147483647n?n:null;}catch{return null;}
}
/** where.c:3037 whereLoopOutputAdjust. Cardinality is adjusted after run
 * costing, before insertion; residual predicates do not reduce physical work.
 * Likelihood/truthProb producers are not yet represented. TERM_HEURTRUTH
 * only feeds the STAT4 HIGHTRUTH/second-pass branch (where.c3519/7086),
 * unreachable while schema.ts rejects nonempty STAT4. Do not invent shared
 * mutable clause state for that unsupported path. SELFCULL only feeds the
 * unsupported Bloom-filter generation path (where.c6606), not this costing. */
function outputAdjust(loop:WhereLoop,clause:WhereClause):bigint {
 const cap=loop.capability,used=cap?[...cap.equalityPrefix.map(a=>a.term),cap.lower?.term,cap.upper?.term,cap.rowidEquality?.term,cap.rowidLower?.term,cap.rowidUpper?.term].filter((t):t is WhereTerm=>!!t):[];
 const self=sourceBit(loop.sourceOrdinal),allowed=loop.prereq|self;
 let rows=loop.outputRows,reduce=0n;
 for(const term of clause.terms){
  if(term.virtual||(term.prereqAll&~allowed)!==0n||(term.prereqAll&self)===0n)continue;
  if(used.some(t=>t===term||t.parentId===term.id))continue;
  rows--;
  if(term.operator==="eq"||term.operator==="is"){
   // sqlite3ExprIsInteger tests the syntactic right operand, not the indexed
   // orientation. Only literal +/- integer leaves qualify, not folded math.
   const root=term.expression.reduction,rhs=root?.kind==="reduction"?exprChildren(root)[1]:undefined;
   const smallValue=rhs?exprInteger32(rhs):null,small=smallValue!==null&&smallValue>=-1n&&smallValue<=1n;
   const k=small?10n:20n;if(reduce<k)reduce=k;
  }
 }
 const limit=BigInt(loop.source.table.nRowLogEst)-reduce;
 return rows>limit?limit:rows;
}
/** whereLoopAddBtree's deterministic no-stat candidate subset. */
export function btreeLoops(source:ResolvedSource,sourceOrdinal:number,clause:WhereClause,options:CandidateOptions):readonly WhereLoop[] {
 if(options.forcedIndex&&options.notIndexed)throw new WherePlanningUnsupportedError("INDEXED BY and NOT INDEXED conflict");
 if(options.forcedIndex&&options.forcedIndex.table!==source.table)throw new WherePlanningUnsupportedError("forced index does not belong to source table");
 // build.c:sqlite3KeyInfoOfIndex deactivates unknown-CollSeq indexes;
 // where.c:wherePathSolver reports no query solution for forced use.
 const missingCollation=(index:IndexNode):string|undefined=>index.layout?.fields.find(field=>!["binary","nocase","rtrim"].includes(field.collation))?.collation;
 if(options.forcedIndex&&!options.forcedIndex.physical){
   if(missingCollation(options.forcedIndex))throw new SqlParseError("no query solution");
   throw new WherePlanningUnsupportedError(`unsupported physical index layout: ${options.forcedIndex.name}`);
 }
 // WITHOUT ROWID's primary index is storage, not an optional access path.
 const primary=source.table.withoutRowid?source.table.indexes.find(index=>index.origin==="primary-key"):undefined;
 if(primary&&!primary.physical){const collation=missingCollation(primary);if(collation)throw new SqlParseError(`no such collation sequence: ${collation}`);}
 const sourcePrereq=options.sourcePrereq??0n;
 const scanOrder=options.orderBy.length===1&&options.orderBy[0]!.sourceOrdinal===sourceOrdinal&&isIntegerPrimaryKeyAlias(source.table,options.orderBy[0]!.column)?options.orderBy[0]:null;
 const scanCapability:BtreeCapability=freeze({index:null,physicalIndex:null,equalityPrefix:Object.freeze([]),lower:null,upper:null,constrainedFields:0,orderTermsSatisfied:scanOrder?1:0,reverse:scanOrder?.descending??false,covering:true,needsTableLookup:false,rowidEquality:null,rowidLower:null,rowidUpper:null});
 const owned=clause.terms.filter(term=>(term.prereqAll&sourceBit(sourceOrdinal))!==0n),own=owned.filter(term=>term.left?.source===source&&term.outerJoinSafe.mayDrive),scan:WhereLoop=freeze({source,sourceOrdinal,prereq:sourcePrereq,capability:scanCapability,kind:"table-scan",setupCost:0n,runCost:BigInt(source.table.nRowLogEst)+16n,outputRows:BigInt(source.table.nRowLogEst),terms:Object.freeze(owned)});
 // where.c:4035 uses the real primary index for WITHOUT ROWID, never sPk.
 // NOT INDEXED suppresses optional secondary indexes, not physical storage.
 const loops:WhereLoop[]=[],budget=options.planBudget??{remaining:21000};
 const insert=(loop:WhereLoop):boolean=>{
  const candidate=freeze({...loop,outputRows:loop.kind==="multi-or"?loop.outputRows:outputAdjust(loop,clause),sortIdentity:loop.kind==="multi-or"?0:indexMightHelpWithOrderBy(loop.capability?.index??null,sourceOrdinal,source.table,options.orderBy)?(loop.capability?.index?source.table.indexes.indexOf(loop.capability.index)+2:1):0});
  if(options.orSet){const cap=loop.capability,nLTerm=loop.kind==="multi-or"?1:cap?cap.equalityPrefix.length+Number(!!cap.lower)+Number(!!cap.upper)+Number(!!cap.rowidEquality)+Number(!!cap.rowidLower)+Number(!!cap.rowidUpper):0;if(budget.remaining===0)return whereOrCollect(options.orSet,budget,nLTerm,{prereq:0n,rRun:0n,nOut:0n});budget.remaining--;const adjusted=whereLoopAdjustCost(options.ordinaryLoops?[...options.ordinaryLoops,...loops]:loops,candidate);if(nLTerm)whereOrInsert(options.orSet,adjusted.prereq,adjusted.runCost,adjusted.outputRows);return true;}
  return whereLoopInsert(loops,candidate,budget,options.ordinaryLoops);
 };
 if(!options.forcedIndex&&!source.table.withoutRowid)insert(scan);
 if(budget.remaining===0)return Object.freeze(loops);
 const rowid=own.filter(term=>term.left?.rowid&&term.operator!==null&&term.operator!=="is-null").sort((a,b)=>a.prereqRight<b.prereqRight?-1:a.prereqRight>b.prereqRight?1:a.id-b.id),rowEquals=rowid.filter(term=>term.operator==="eq"||term.operator==="is"),rowLowers=rowid.filter(term=>term.operator==="gt"||term.operator==="ge"),rowUppers=rowid.filter(term=>term.operator==="lt"||term.operator==="le");
 const rowOrder=options.orderBy.length===1&&options.orderBy[0]!.sourceOrdinal===sourceOrdinal&&isIntegerPrimaryKeyAlias(source.table,options.orderBy[0]!.column)?options.orderBy[0]:null;
 if(!options.forcedIndex&&(rowEquals.length||rowLowers.length||rowUppers.length)){const make=(term:WhereTerm|null):RowidConstraint|null=>term&&term.operator?freeze({term,operator:term.operator,originalIndexedOperand:term.originalIndexedOperand,bound:bound(term.operator)}):null,rowidCovering=[...options.neededColumns].every(need=>need===ROWID_NEEDED),propose=(rowEq:WhereTerm|null,rowLower:WhereTerm|null,rowUpper:WhereTerm|null):boolean=>{const used=[rowEq,rowLower,rowUpper].filter((x):x is WhereTerm=>!!x),cap:BtreeCapability=freeze({index:null,physicalIndex:null,equalityPrefix:Object.freeze([]),lower:null,upper:null,constrainedFields:1,orderTermsSatisfied:rowOrder?1:0,reverse:rowOrder?.descending??false,covering:rowidCovering,needsTableLookup:!rowidCovering,rowidEquality:make(rowEq),rowidLower:make(rowLower),rowidUpper:make(rowUpper)});return insert(freeze({source,sourceOrdinal,prereq:used.reduce((m,t)=>m|t.prereqRight,sourcePrereq),capability:cap,kind:"rowid",indexRowSize:3n,setupCost:0n,runCost:logEstAdd(BigInt(source.table.nRowLogEst)<=10n?0n:BigInt(sqliteLogEst(BigInt(source.table.nRowLogEst))-33),(rowEq?0n:rangeRows(BigInt(source.table.nRowLogEst),!!rowLower,!!rowUpper))+16n),outputRows:rowEq?0n:rangeRows(BigInt(source.table.nRowLogEst),!!rowLower,!!rowUpper),terms:Object.freeze(owned)}));};if(rowEquals.length){for(const term of rowEquals){if(!propose(term,null,null)||budget.remaining===0)break;}}else {rowRanges:for(const lower of rowLowers.length?rowLowers:[null])for(const upper of rowUppers.length?rowUppers:[null]){if(!propose(null,lower,upper)||budget.remaining===0)break rowRanges;}}}
 if(budget.remaining===0)return Object.freeze(loops);
 indexes:for(const index of source.table.indexes){const physicalPrimary=source.table.withoutRowid&&index.origin==="primary-key";if(options.notIndexed&&!physicalPrimary)continue;if(options.forcedIndex&&index!==options.forcedIndex)continue;if(!usablePartialIndex(index,clause.terms,source,sourceOrdinal,options.resolved))continue;for(const cap of capabilities(index,own,sourceOrdinal,options.neededColumns,options.orderBy)){if(!options.forcedIndex&&!physicalPrimary&&!index.partialWhere&&cap.constrainedFields===0&&!indexMightHelpWithOrderBy(index,sourceOrdinal,source.table,options.orderBy)&&(!cap.covering||index.unordered||index.szIdxRow>=source.table.szTabRow))continue;const selected=[...cap.equalityPrefix,cap.lower,cap.upper].filter((a):a is IndexConstraintAdmission=>a!==null);const prereq=selected.reduce((mask,admission)=>mask|admission.term.prereqRight,sourcePrereq),estimate=indexLoopEstimate(index,cap,source,clause,options.resolved);if(!insert(freeze({source,sourceOrdinal,prereq,capability:cap,kind:"index",indexRowSize:BigInt(index.szIdxRow),setupCost:0n,runCost:estimate.run,outputRows:estimate.rows,terms:Object.freeze(owned)}))||budget.remaining===0)break indexes;}}

 // whereLoopAddOr. Copied cost builders share the construction budget;
 // physical branch choice is deliberately absent from the published union.
 if(!source.table.withoutRowid&&!options.forcedIndex&&!options.notIndexed&&!source.joinFromLeft?.left&&!source.joinFromLeft?.right&&!source.joinFromLeft?.outer&&!source.leftOfRightJoin){
  for(const parent of clause.terms){
   const info=parent.info;
   if(info?.kind!=="or"||(info.indexable&sourceBit(sourceOrdinal))===0n||parent.origin.kind==="join-on"&&parent.origin.join==="left")continue;
   const sum:WhereOrSet={a:[]};let first=true;
   for(const arm of info.clause.terms){
    if(arm.virtual)continue;
    const armClause=arm.info?.kind==="and"?arm.info.clause:whereClause([arm,...info.clause.terms.filter(t=>t.parentId===arm.id)],clause);
    const current:WhereOrSet={a:[]};
    btreeLoops(source,sourceOrdinal,armClause,{...options,orderBy:[],planBudget:budget,orSet:current,ordinaryLoops:options.ordinaryLoops?[...options.ordinaryLoops,...loops]:loops});
    if(!whereOrAccumulate(sum,current,first,logEstAdd))break;
    first=false;
    if(budget.remaining===0){sum.a.length=0;break;}
   }
   for(const cost of sum.a){if(!insert(freeze({source,sourceOrdinal,kind:"multi-or",orInfo:info,capability:null,sortIdentity:0,prereq:cost.prereq,setupCost:0n,runCost:cost.rRun+1n,outputRows:cost.nOut,terms:Object.freeze([parent])})))break;}
   if(budget.remaining===0)break;
  }
 }
 if(!options.orSet&&options.forcedIndex&&!loops.some(loop=>loop.kind==="index"))throw new WherePlanningUnsupportedError(`forced index is unusable: ${options.forcedIndex.name}`);return Object.freeze(loops);
}
/** build.c:sqlite3DefaultRowEst, analyze.c:analysisLoader: the slots
 * after slot zero are absolute prefix cardinalities, not decrements. */
function rangeRows(rows:bigint,lower:boolean,upper:boolean):bigint {
 // whereRangeScanEst: clamp nNew before choosing min(nOut-boundCount,nNew).
 const bounds=BigInt(Number(lower)+Number(upper));
 if(bounds===0n)return rows;
 const adjusted=rows-20n*bounds-(bounds===2n?20n:0n);
 const nNew=adjusted<10n?10n:adjusted;
 return rows-bounds<nNew?rows-bounds:nNew;
}
function indexLoopEstimate(index:IndexNode,cap:BtreeCapability,source:ResolvedSource,clause:WhereClause,resolved?:ResolvedSelect):{run:bigint;rows:bigint}{
 const estimates=index.rowLogEst;
 const size=BigInt(estimates[0]??99),logSize=size<=10n?0n:BigInt(sqliteLogEst(size)-33);
 let rows=size,inMul=0n;
 for(let i=0;i<cap.equalityPrefix.length;i++){
   const admission=cap.equalityPrefix[i]!;
   rows+=BigInt((estimates[i+1]??23)-(estimates[i]??99));
   // where.c:3533–3539: WO_ISNULL doubles the estimated equality rows.
   if(admission.operator==="is-null")rows+=10n;
   if(admission.operator==="in"){
     // whereLoopAddBtreeIndex: literal list contributes seek iterations.
     const n=admission.term.expression.tokens.filter(t=>t.text===",").length+1;
     inMul+=BigInt(sqliteLogEst(BigInt(n)));
   }
 }
 // where.c:whereRangeScanEst/whereRangeAdjust: each bound reduces by 20,
 // paired default bounds subtract another 20, clamp to 10 and at most
 // saved_nOut minus the number of bounds. Not a 10/20 total reduction.
 rows=rangeRows(rows,!!cap.lower,!!cap.upper);
 const ratio=15n*BigInt(index.szIdxRow)/BigInt(index.table.szTabRow);
 const idx=cap.constrainedFields===0?rows+1n+ratio:logEstAdd(logSize,rows+1n+ratio);
 let lookup=rows+16n;
 if(cap.constrainedFields===0&&cap.needsTableLookup&&resolved){
  // where.c:4258–4278 and expr.c:exprIdxCover: stop at the FIRST
  // noncovered clause term. Other cursors do not require this table lookup.
  for(const term of clause.terms){
   const root=term.expression.reduction;
   if(!root||root.kind!=="reduction")break;
   const covered=resolved.columnUses.filter(use=>use.source===source&&reductionContains(root,use.expression)).every(use=>
    use.columnIndex<0?cap.physicalIndex!.fields.some(field=>field.role==="rowid-tail"):
    cap.physicalIndex!.fields.some(field=>fieldMatchesColumn(cap.physicalIndex!,field,source.table.columns[use.columnIndex]!)));
   if(!covered)break;
   lookup-=term.operator==="eq"||term.operator==="is"?20n:1n;
  }
 }
 return {run:(cap.needsTableLookup?logEstAdd(idx,lookup):idx)+inMul,rows:rows+inMul};
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
export function whereLoopInsertCandidates(loops:readonly WhereLoop[],budget:WherePlanBudget={remaining:21000}):WhereLoop[]{
 const inserted:WhereLoop[]=[];
 for(const candidate of loops)if(!whereLoopInsert(inserted,candidate,budget))break;
 return inserted;
}
/** whereLoopAdjustCost reads the enclosing ordinary pLoops, including in
 * cost-only copied builders. It never inserts a branch physical choice. */
function whereLoopAdjustCost(inserted:readonly WhereLoop[],candidate:WhereLoop):WhereLoop {
 let template=candidate;
  if(candidate.kind==="index")for(const previous of inserted){
   if(previous.sourceOrdinal!==template.sourceOrdinal||previous.kind!=="index")continue;
   if(properSubset(previous,template))template=freeze({...template,runCost:template.runCost<previous.runCost?template.runCost:previous.runCost,outputRows:template.outputRows<previous.outputRows-1n?template.outputRows:previous.outputRows-1n});
   else if(properSubset(template,previous))template=freeze({...template,runCost:template.runCost>previous.runCost?template.runCost:previous.runCost,outputRows:template.outputRows>previous.outputRows+1n?template.outputRows:previous.outputRows+1n});
  }
 return template;
}
/** false is SQLITE_DONE; dropped and replaced templates still return OK. */
function whereLoopInsert(inserted:WhereLoop[],candidate:WhereLoop,budget:WherePlanBudget,ordinaryLoops:readonly WhereLoop[]=[]):boolean {
 if(budget.remaining===0)return false;budget.remaining--;let template=candidate;
 template=whereLoopAdjustCost([...ordinaryLoops,...inserted],template);
  // whereLoopFindLesser: null means discard; list end means append.
  const lesser=(start:number):number|null=>{
   for(let i=start;i<inserted.length;i++){
    const old=inserted[i]!;
    if(old.sourceOrdinal!==template.sourceOrdinal||(old.sortIdentity??0)!==(template.sortIdentity??0))continue;
    if((old.setupCost!==0n&&template.setupCost!==0n&&old.setupCost!==template.setupCost)||old.setupCost<template.setupCost)throw new Error("WHERE setup invariant");
    if((old.prereq&template.prereq)===old.prereq&&old.setupCost<=template.setupCost&&old.runCost<=template.runCost&&old.outputRows<=template.outputRows)return null;
    if((old.prereq&template.prereq)===template.prereq&&old.runCost>=template.runCost&&old.outputRows>=template.outputRows)return i;
   }
   return inserted.length;
  };
  const at=lesser(0);if(at===null)return true;
  if(at<inserted.length){let tail=at+1;while(tail<inserted.length){const remove=lesser(tail);if(remove===null||remove===inserted.length)break;inserted.splice(remove,1);tail=remove;}inserted[at]=template;}
  else inserted.push(template);
 return true;
}
/** Exact port of util.c:sqlite3LogEstAdd for bigint LogEst units. */
export function logEstAdd(a:LogicalEstimate,b:LogicalEstimate):LogicalEstimate {const x=[10n,10n,9n,9n,8n,8n,7n,7n,7n,6n,6n,6n,5n,5n,5n,4n,4n,4n,4n,3n,3n,3n,3n,3n,3n,2n,2n,2n,2n,2n,2n,2n];if(a<b)return logEstAdd(b,a);const d=a-b;if(d>49n)return a;if(d>31n)return a+1n;return a+x[Number(d)]!;}
/** where.c:computeMxChoice default, without the unrepresented star heuristic. */
export function wherePathChoiceWidth(sourceCount:number):1|5|12{return sourceCount<=1?1:sourceCount===2?5:12;}
/** where.c:5835ff. Ordered traversal, unsorted accumulators and bounded slots. */
export function wherePathSolver(candidates:readonly (readonly WhereLoop[])[],sourceCount:number,maxChoices=wherePathChoiceWidth(sourceCount),orderTerms=0,resultColumns=1,sortRows:bigint|null=null):WherePath {
 if(!Number.isSafeInteger(maxChoices)||maxChoices<1)throw new RangeError("invalid WHERE choice width");
 let paths:WherePath[]=[freeze({loops:Object.freeze([]),ready:0n,reverse:0n,rows:0n,cost:0n,unsortedCost:0n,orderTermsSatisfied:orderTerms&&sourceCount?null:0})];
 // where.c:5812: indexed production loops always carry their immutable width.
 const indexedWidth=(loop:WhereLoop):bigint=>{if(loop.indexRowSize===undefined)throw new Error("indexed WHERE loop missing row width");return loop.indexRowSize;};
 const noBetter=(candidate:WhereLoop,baseline:WhereLoop):boolean=>candidate.kind!=="index"||baseline.kind!=="index"||indexedWidth(candidate)>=indexedWidth(baseline);
 for(let depth=0;depth<sourceCount;depth++){
  const next:WherePath[]=[];let worst=0,mxCost=0n,mxUnsort=0n;
  for(const path of paths)for(const group of candidates)for(const loop of group){
   const bit=sourceBit(loop.sourceOrdinal);if(path.ready&bit||(loop.prereq&~path.ready)!==0n)continue;
   let unsorted=loop.runCost+path.rows;if(loop.setupCost!==0n)unsorted=logEstAdd(loop.setupCost,unsorted);unsorted=logEstAdd(unsorted,path.unsortedCost);
   const ready=path.ready|bit,rows=path.rows+loop.outputRows;
   // where.c:wherePathSatisfiesOrderBy: an IPK equality is WHERE_ONEROW,
   // so it cannot disrupt the ordering delivered by a later loop. Retain
   // unknown ordering until that producer is visited; do not infer uniqueness
   // from a statistical nOut of zero. Other joined proofs remain conservative.
   const singleton=(item:WhereLoop)=>item.kind==="rowid"&&item.capability?.rowidEquality!==null&&item.capability?.rowidEquality!==undefined;
   const ordered=path.orderTermsSatisfied===null
    ? (path.loops.every(singleton)
       ? (loop.capability?.orderTermsSatisfied??0)>0&&depth===sourceCount-1?(loop.capability?.orderTermsSatisfied??0):singleton(loop)&&depth<sourceCount-1?null:0
       : 0)
    : path.orderTermsSatisfied;
   let cost=unsorted;if(ordered!==null&&ordered<orderTerms)cost=logEstAdd(unsorted,sortCost(sortRows??rows,resultColumns,orderTerms,ordered))+3n;else unsorted-=2n;
   const proposal:WherePath=freeze({loops:Object.freeze([...path.loops,loop]),ready,reverse:path.reverse|(loop.capability?.reverse?bit:0n),rows,cost,unsortedCost:unsorted,orderTermsSatisfied:ordered});
   let slot=next.findIndex(old=>old.ready===ready&&((old.orderTermsSatisfied===null)===(proposal.orderTermsSatisfied===null)||depth===sourceCount-1));
   if(slot<0){
    if(next.length>=maxChoices&&(cost>mxCost||(cost===mxCost&&unsorted>=mxUnsort)))continue;
    slot=next.length<maxChoices?next.length:worst;
   }else{
    const old=next[slot]!;
    if(old.cost<cost||(old.cost===cost&&old.rows<rows)||(old.cost===cost&&old.rows===rows&&old.unsortedCost<unsorted)||(old.cost===cost&&old.rows===rows&&old.unsortedCost===unsorted&&noBetter(loop,old.loops[depth]!)))continue;
   }
   next[slot]=proposal;
   if(next.length>=maxChoices){worst=0;mxCost=next[0]!.cost;mxUnsort=next[0]!.rows;for(let i=1;i<next.length;i++){const old=next[i]!;if(old.cost>mxCost||(old.cost===mxCost&&old.unsortedCost>mxUnsort)){worst=i;mxCost=old.cost;mxUnsort=old.unsortedCost;}}}
  }
  paths=next;
 }
 if(paths.length!==1)throw new WherePlanningUnsupportedError("no usable WHERE path");return paths[0]!;
}

type ExprReduction=LemonValue<SqlToken>&{readonly kind:"reduction"};
function exprChildren(node:ExprReduction):ExprReduction[]{return node.children.filter((x):x is ExprReduction=>x.kind==="reduction"&&x.signature.startsWith("expr ::="));}
function asExpr(node:ExprReduction):ExprNode {const tokens:SqlToken[]=[];const collect=(x:LemonValue<SqlToken>):void=>{if(x.kind==="terminal"){if(x.value)tokens.push(x.value);}else x.children.forEach(collect)};collect(node);return Object.freeze({kind:"tokens",tokens:Object.freeze(tokens),reduction:node});}
function unwrap(node:ExprReduction):ExprReduction {let at=node;while(at.signature==="expr ::= LP expr RP"||at.signature.startsWith("expr ::= expr COLLATE")){const child=exprChildren(at)[0];if(!child)break;at=child;}return at;}
function explicitExprCollation(node:ExprReduction):BuiltinCollation|null {if(node.signature.startsWith("expr ::= expr COLLATE")){const token=node.children.filter(x=>x.kind==="terminal").at(-1);const name=token?.kind==="terminal"?sqliteAsciiFold(token.value.text):"";return name==="binary"||name==="nocase"||name==="rtrim"?name:null;}for(const child of exprChildren(node)){const found=explicitExprCollation(child);if(found)return found;}return null;}
function literalAffinity(_node:ExprReduction):ColumnNode["affinity"]|null {return null;}
function reductionContains(root:ExprReduction,needle:ExprReduction):boolean {return root===needle||root.children.some(x=>x.kind==="reduction"&&reductionContains(x,needle));}
function columnUse(resolved:ResolvedSelect,node:ExprReduction){let plain=unwrap(node);while(resolved.aliasUses?.has(plain))plain=unwrap(resolved.aliasUses.get(plain)!);return resolved.columnUses.find(use=>use.selectDepth===0&&use.expression===plain);}
// resolve.c lookupName replaces FULL merged names with TK_FUNCTION coalesce.
// whereexpr.c:exprMightBeIndexed accepts TK_COLUMN, not its first constituent.
function binding(resolved:ResolvedSelect,node:ExprReduction):ColumnBinding|null {const use=columnUse(resolved,node);if(!use||use.mergedSources)return null;const column=use.columnIndex<0?null:use.source.table.columns[use.columnIndex]??null;return freeze({source:use.source,sourceOrdinal:resolved.sources.indexOf(use.source),column,columnIndex:use.columnIndex,rowid:use.columnIndex<0});}
/** whereexpr.c:exprMightBeIndexed: recursive uses are dependencies, not
 * ordinary bindings. A non-column operand may bind only an actual expression
 * field on the exact source whose uses it contains. -2 is XN_EXPR, not rowid. */
function indexedBinding(resolved:ResolvedSelect,node:ExprReduction):ColumnBinding|null {
 const direct=binding(resolved,node);if(direct)return direct;
 const mask=prereq(resolved,node);if(mask===0n)return null;
 const identity=expressionStructuralIdentity(asExpr(unwrap(node)),true);
 for(const [sourceOrdinal,source] of resolved.sources.entries()){
  if(mask!==sourceBit(sourceOrdinal))continue;
  if(source.table.indexes.some(index=>index.physical?.fields.some(field=>field.expression!==null&&expressionStructuralIdentity(field.expression,true)===identity)))return freeze({source,sourceOrdinal,column:null,columnIndex:-2,rowid:false});
 }
 return null;
}
function rhsPrereq(resolved:ResolvedSelect,node:ExprReduction,orientation:"left"|"right",operator:WhereOperator|null):SourceMask {
 const children=exprChildren(node);
 if(operator!=="in")return operator==="is-null"?0n:children[orientation==="left"?1:0]?prereq(resolved,children[orientation==="left"?1:0]!):0n;
 // IN's RHS is an exprlist (not a direct expr child). Visit every reduction
 // except the LHS so a dependency in any list member cannot disappear.
 const lhs=children[0];let mask=0n;for(const child of node.children)if(child.kind==="reduction"&&child!==lhs)mask|=prereq(resolved,child);return mask;
}
function prereq(resolved:ResolvedSelect,node:ExprReduction):SourceMask {
 // whereexpr.c:ExprUsageFull/exprSelectUsage uses the enclosing MaskSet:
 // child-local cursor identities have no bit there. Correlated carriers live
 // on the child NameContext, not in the parent's depth-zero columnUses.
 const bitFor=(source:ResolvedSource):SourceMask=>{const at=resolved.sources.indexOf(source);return at<0?0n:sourceBit(at);};
 const plans=new Map<SelectNode,ResolvedSelect>();
 const remember=(plan:ResolvedSelect):void=>{plans.set(plan.source,plan);for(const child of plan.nested)remember(child);for(const arm of plan.compoundArms??[])remember(arm);};
 remember(resolved);
 const selectUsage=(plan:ResolvedSelect):SourceMask=>{
   let mask=0n;
   // Match exprSelectUsage's owning clauses, not LIMIT/OFFSET or every
   // unrelated resolved child. Nested SELECTs are reached from these roots.
   const expressions=[...plan.source.result,...plan.source.groupBy,
     ...plan.source.orderBy.map(term=>term.expr),plan.source.where,
     plan.source.having,...plan.sources.map(source=>source.on)];
   for(const expression of expressions)if(expression?.reduction?.kind==='reduction')mask|=usage(plan,expression.reduction as ExprReduction);
   const derived=plan.source.from.derived;
   if(derived){const child=plans.get(derived.select);if(child)mask|=selectUsage(child);}
   for(const arm of plan.compoundArms??[])mask|=selectUsage(arm);
   return mask;
 };
 const usage=(owner:ResolvedSelect,root:ExprReduction):SourceMask=>{
   let mask=0n;
   for(const use of owner.columnUses)if(reductionContains(root,use.expression))for(const ref of use.mergedSources??[use])mask|=bitFor(ref.source);
   for(const [alias,value] of owner.aliasUses??[])if(reductionContains(root,alias))mask|=usage(owner,value);
   const walk=(tree:ExprReduction):void=>{
     const child=plans.get(tree.semantic as SelectNode);
     if(child){mask|=selectUsage(child);return;}
     for(const value of tree.children)if(value.kind==='reduction')walk(value);
   };
   walk(root);return mask;
 };
 return usage(resolved,node);
}
function splitAnd(node:ExprReduction,out:ExprReduction[]):void {if(node.signature==="expr ::= expr AND expr"){for(const child of exprChildren(node))splitAnd(child,out);}else out.push(node);}
function comparisonOperator(node:ExprReduction):WhereOperator|null {const text=node.children.filter(x=>x.kind==="terminal").map(x=>x.kind==="terminal"?sqliteAsciiFold(x.value.text):"").join(" ");if(node.signature.startsWith("expr ::= expr EQ|NE expr"))return text.includes("!=")||text.includes("<>")?null:"eq";if(node.signature.startsWith("expr ::= expr LT|GT|GE|LE expr"))return text.includes(">=")?"ge":text.includes("<=")?"le":text.includes(">")?"gt":"lt";if(node.signature==="expr ::= expr in_op LP exprlist RP")return node.children.some(x=>x.kind==="reduction"&&x.signature==="in_op ::= NOT IN")?null:"in";if(node.signature==="expr ::= expr IS expr"){const rhs=exprChildren(node)[1];if(rhs&&asExpr(rhs).tokens.some(token=>sqliteAsciiFold(token.text)==="null"))return "is-null";return "is";}if(node.signature==="expr ::= expr ISNULL|NOTNULL"&&!text.includes("notnull"))return "is-null";return null;}
function reverseOperator(op:WhereOperator):WhereOperator{return op==="lt"?"gt":op==="le"?"ge":op==="gt"?"lt":op==="ge"?"le":op;}
function effectiveCollation(left:ExprReduction,right:ExprReduction,leftBinding:ColumnBinding|null,rightBinding:ColumnBinding|null):BuiltinCollation {return explicitExprCollation(left)??explicitExprCollation(right)??((leftBinding?.column?.collation&&sqliteAsciiFold(leftBinding.column.collation)) as BuiltinCollation|null)??((rightBinding?.column?.collation&&sqliteAsciiFold(rightBinding.column.collation)) as BuiltinCollation|null)??"binary";}
export interface WhereAnalysis {readonly clause:WhereClause;readonly plannerEligible:boolean;readonly fallback:"right-full"|null}
/** whereexpr.c sqlite3WhereSplit/exprAnalyze subset. It consumes resolved
 * expression identity and is the only production constructor for WhereTerm. */
export function analyzeWhere(resolved:ResolvedSelect,includeRightTerms=false):WhereAnalysis {return analyzeClause(resolved,includeRightTerms);}
function analyzeClause(resolved:ResolvedSelect,includeRightTerms:boolean,input?:readonly {node:ExprReduction;origin:TermOrigin}[],outer:WhereClause|null=null,split:"and"|"or"="and",orOwner:WhereClause|null=null):WhereAnalysis {
 if(!includeRightTerms&&resolved.sources.some(source=>source.joinFromLeft.right||source.joinFromLeft.outer||source.leftOfRightJoin))return freeze({clause:whereClause([]),plannerEligible:false,fallback:"right-full"});
 const specs:{node:ExprReduction;origin:TermOrigin}[]=[];if(resolved.source.where?.reduction?.kind==="reduction"){const parts:ExprReduction[]=[];splitAnd(resolved.source.where.reduction as ExprReduction,parts);for(const node of parts)specs.push({node,origin:{kind:"where"}});}
 resolved.sources.forEach((source,index)=>{if(source.on?.reduction?.kind!=="reduction")return;const parts:ExprReduction[]=[];splitAnd(source.on.reduction as ExprReduction,parts);for(const node of parts)specs.push({node,origin:{kind:"join-on",rightSource:index,join:source.joinFromLeft.left?"left":"inner"}});});
 if(input){specs.length=0;specs.push(...input);}
 type Draft={node:ExprReduction;origin:TermOrigin;operator:WhereOperator|null;left:ColumnBinding|null;rightNode:ExprReduction;orientation:"left"|"right";prereqAll:SourceMask;prereqRight:SourceMask;collation:BuiltinCollation|null;parentId:number|null;childIds:number[];virtual:boolean;outerJoinSafe:{mayDrive:boolean;mayOmitResidual:boolean}};
 const drafts:Draft[]=[];
 for(const {node,origin} of specs){let op=comparisonOperator(node);const children=exprChildren(node),originalLeftNode=children[0]??node,originalRightNode=children[1]??node,originalLeft=indexedBinding(resolved,originalLeftNode),originalRight=indexedBinding(resolved,originalRightNode),all=prereq(resolved,node);let leftNode=originalLeftNode,rightNode=originalRightNode,left=originalLeft,orientation:"left"|"right"="left";
  if(!left&&originalRight&&op&&op!=="in"){orientation="right";op=reverseOperator(op);leftNode=originalRightNode;rightNode=originalLeftNode;left=originalRight;}
  const rightUse=rhsPrereq(resolved,node,orientation,op),leftUse=prereq(resolved,leftNode);const isLeft=origin.kind==="join-on"&&origin.join==="left",mayDrive=op!==null&&!!left&&(rightUse&leftUse)===0n&&!(rightUse&sourceBit(left.sourceOrdinal))&&!(isLeft&&left.sourceOrdinal<origin.rightSource),coll=op==="is-null"?null:effectiveCollation(originalLeftNode,originalRightNode,originalLeft,originalRight),parentId=drafts.length;
  const parent:Draft={node,origin,operator:op,left,rightNode,orientation,prereqAll:all,prereqRight:rightUse,collation:coll,parentId:null,childIds:[],virtual:false,outerJoinSafe:{mayDrive,mayOmitResidual:!isLeft}};drafts.push(parent);
  // whereexpr.c:exprAnalyze creates a virtual commuted child when both
  // operands are indexable columns. It retains original expression collation
  // but owns independent left binding and RHS prerequisites.
  if(originalLeft&&originalRight&&op&&op!=="in"){const childId=drafts.length,childOp=reverseOperator(op),childLeft=orientation==="left"?originalRight:originalLeft,childRightNode=orientation==="left"?originalLeftNode:originalRightNode,childRightUse=prereq(resolved,childRightNode),childLeftUse=prereq(resolved,orientation==="left"?originalRightNode:originalLeftNode),childMayDrive=(childRightUse&childLeftUse)===0n&&(childRightUse&sourceBit(childLeft.sourceOrdinal))===0n&&!(isLeft&&childLeft.sourceOrdinal<origin.rightSource);parent.childIds.push(childId);drafts.push({node,origin:{kind:"derived",parentTerm:parentId,reason:"commuted"},operator:childOp,left:childLeft,rightNode:childRightNode,orientation:orientation==="left"?"right":"left",prereqAll:all,prereqRight:childRightUse,collation:coll,parentId,childIds:[],virtual:true,outerJoinSafe:{mayDrive:childMayDrive,mayOmitResidual:false}});}
 }
 // whereexpr.c splits all base terms before exprAnalyze appends virtual
 // children. Preserve that boundary (RightJoinLoop stops there), remapping
 // parent/child IDs rather than exposing interleaved construction order.
 const ordered=[...drafts.filter(draft=>!draft.virtual),...drafts.filter(draft=>draft.virtual)];
 const ids=new Map(ordered.map((draft,id)=>[drafts.indexOf(draft),id]));
 const terms:WhereTerm[]=ordered.map((draft,id)=>({id,expression:asExpr(draft.node),origin:draft.origin.kind==='derived'?{...draft.origin,parentTerm:ids.get(draft.origin.parentTerm)!}:draft.origin,operator:draft.operator,left:draft.left,rightAffinity:literalAffinity(draft.rightNode)??binding(resolved,draft.rightNode)?.column?.affinity??null,effectiveCollation:draft.collation,originalIndexedOperand:draft.orientation,prereqRight:draft.prereqRight,prereqAll:draft.prereqAll,parentId:draft.parentId===null?null:ids.get(draft.parentId)!,childIds:Object.freeze(draft.childIds.map(child=>ids.get(child)!)),virtual:draft.virtual,outerJoinSafe:freeze(draft.outerJoinSafe)}));
 const clause:WhereClause={split,terms,outer};
 const combined:WhereTerm[]=[];
 for(const term of terms){
  const node=unwrap(ordered[term.id]!.node),origin=ordered[term.id]!.origin;
  if(node.signature==="expr ::= expr OR expr"){
   const parts:ExprReduction[]=[];
   const collect=(n:ExprReduction):void=>{const u=unwrap(n);if(u.signature==="expr ::= expr OR expr")for(const child of exprChildren(u))collect(child);else parts.push(u);};collect(node);
   const child=analyzeClause(resolved,includeRightTerms,parts.map(node=>({node,origin})),null,"or",clause).clause;
   let indexable=(1n<<BigInt(resolved.sources.length))-1n;
   for(const arm of child.terms.filter(t=>!t.virtual)){
    const alternatives=[arm,...child.terms.filter(t=>t.parentId===arm.id)];
    let mask=0n;
    for(const alt of alternatives){
     if(alt.info?.kind==="and")for(const sub of alt.info.clause.terms){if(sub.operator&&sub.left)mask|=sourceBit(sub.left.sourceOrdinal);}
     else if(alt.operator&&alt.left)mask|=sourceBit(alt.left.sourceOrdinal);
    }
    indexable&=mask;
   }
   Object.assign(term,{info:freeze({kind:"or" as const,parentTerm:term,clause:child,indexable})});
   // whereNthSubterm / whereCombineDisjuncts: two original arms only.
   const arms=child.terms.filter(t=>!t.virtual);
   if(arms.length===2){
    const subterms=(arm:WhereTerm)=>arm.info?.kind==="and"?arm.info.clause.terms:[arm];
    const allowed=new Set<WhereOperator>(["eq","lt","le","gt","ge"]);
    for(const one of subterms(arms[0]!))for(const two of subterms(arms[1]!)){
     if(!one.operator||!two.operator||!allowed.has(one.operator)||!allowed.has(two.operator))continue;
     const ops=[one.operator,two.operator];
     if(!ops.every(op=>["eq","lt","le"].includes(op))&&!ops.every(op=>["eq","gt","ge"].includes(op)))continue;
     if(one.originalIndexedOperand!==two.originalIndexedOperand)continue;
     const a=one.expression.reduction as ExprReduction,b=two.expression.reduction as ExprReduction,ac=exprChildren(a),bc=exprChildren(b);
     if(ac.length!==2||bc.length!==2)continue;
     const same=(x:ExprReduction,y:ExprReduction)=>{
      const xb=binding(resolved,x),yb=binding(resolved,y);
      if(xb||yb)return !!xb&&!!yb&&xb.source===yb.source&&xb.columnIndex===yb.columnIndex&&expressionStructuralIdentity(asExpr(x))===expressionStructuralIdentity(asExpr(y));
      // Anonymous variables at different token positions own distinct slots.
      const xt=asExpr(x).tokens,yt=asExpr(y).tokens;
      if(xt.some(t=>t.text==="?")||yt.some(t=>t.text==="?"))return x===y;
      return expressionStructuralIdentity(asExpr(x))===expressionStructuralIdentity(asExpr(y));
     };
     if(!same(ac[0]!,bc[0]!)||!same(ac[1]!,bc[1]!))continue;
     const op=(one.operator===two.operator?one.operator:ops.some(op=>op==="lt"||op==="le")?"le":"ge") as "eq"|"lt"|"le"|"gt"|"ge",text={eq:"=",lt:"<",le:"<=",gt:">",ge:">="}[op];
     const node:ExprReduction={...a,signature:op==="eq"?"expr ::= expr EQ|NE expr":"expr ::= expr LT|GT|GE|LE expr",children:a.children.map(x=>x.kind==="terminal"?{...x,value:{...x.value,text}}:x)};
     const analyzed=analyzeClause(resolved,includeRightTerms,[{node,origin}]).clause;
     const base=terms.length+combined.length;
     for(const derived of analyzed.terms)combined.push(freeze({...derived,id:base+derived.id,virtual:true,parentId:derived.parentId===null?null:base+derived.parentId,childIds:Object.freeze(derived.childIds.map(id=>base+id))}));
    }
   }

  }else if(split==="or"&&!term.operator){
   const parts:ExprReduction[]=[];splitAnd(node,parts);
   const child=analyzeClause(resolved,includeRightTerms,parts.map(node=>({node,origin})),orOwner).clause;
   Object.assign(term,{info:freeze({kind:"and" as const,clause:child})});
  }
  freeze(term);
 }
 terms.push(...combined);Object.freeze(terms);
 return freeze({clause:freeze(clause),plannerEligible:true,fallback:null});
}

/** wherecode.c:sqlite3WhereRightJoinLoop pSubWhere. Our analyzer represents
 * virtual commutations but no TERM_SLICE/WO_ROWVAL terms (row values are not
 * admitted). Stop at the first virtual term, not merely skip it. ON/USING
 * ownership never becomes an unmatched residual. */
export function rightJoinResidual(resolved:ResolvedSelect,ordinal:number):readonly WhereTerm[] {
 if(resolved.sources[ordinal]!.leftOfRightJoin)return Object.freeze([]);
 const ready=(1n<<BigInt(ordinal+1))-1n,out:WhereTerm[]=[];
 for(const term of analyzeWhere(resolved,true).clause.terms){
  if(term.virtual)break;
  if((term.prereqAll&~ready)!==0n)continue;
  if(term.origin.kind!=="where")continue;
  out.push(term);
 }
 return Object.freeze(out);
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
 const planBudget:WherePlanBudget={remaining:20000};
 const ordinaryLoops:WhereLoop[]=[];
 let joinBarrier=0n;const groups=resolved.sources.map((source,ordinal)=>{planBudget.remaining+=1000;const prefix=(1n<<BigInt(ordinal))-1n;if(source.joinFromLeft.left)joinBarrier|=prefix|sourceBit(ordinal);if(source.joinFromLeft.cross)joinBarrier|=prefix;const sourcePrereq=joinBarrier&~sourceBit(ordinal);const forced=source.indexedBy===null?null:source.table.indexes.find(index=>sqliteAsciiFold(index.name)===sqliteAsciiFold(source.indexedBy!))??null;if(source.indexedBy!==null&&!forced)throw new WherePlanningUnsupportedError(`no such index: ${source.indexedBy}`);const added=btreeLoops(source,ordinal,analysis.clause,{forcedIndex:forced,notIndexed:source.notIndexed||request.excludedIndexSources?.has(ordinal)===true,sourcePrereq,neededColumns:request.neededColumns[ordinal]??new Set(),orderBy:request.orderBy,resolved,planBudget,ordinaryLoops});ordinaryLoops.push(...added);return added;});
 const unsorted=wherePathSolver(groups,resolved.sources.length,wherePathChoiceWidth(resolved.sources.length));
 const path=request.orderBy.length?wherePathSolver(groups,resolved.sources.length,wherePathChoiceWidth(resolved.sources.length),request.orderBy.length,resolved.result.length,unsorted.rows+1n):unsorted;return freeze({analysis,path,plannerCandidates:groups.reduce((sum,group)=>sum+group.length,0),plannerPaths:path.loops.length});
}

/** SELECT resolver owns alias/ordinal precedence. Only a complete resolved
 * direct-column ORDER list may authorize this bounded physical-order proof.
 * Expression aliases retain the sorter; no token-spelling reconstruction. */
export function resolvedWhereOrder(resolved:ResolvedSelect):readonly OrderRequirement[] {
 const requirements:OrderRequirement[]=[];
 for(const [index,term] of resolved.source.orderBy.entries()){
  const resultIndex=resolved.orderResultColumns[index],expression=resultIndex!=null?resolved.result[resultIndex]?.expression:term.expr;
  if(!expression?.reduction||expression.reduction.kind!=="reduction")return Object.freeze([]);
  const node=expression.reduction as ExprReduction,use=columnUse(resolved,node);
  // Result columns expanded from star still carry exact resolver ownership.
  const result=resultIndex!=null?resolved.result[resultIndex]:null;
  const source=use?.source??(result?.resolution==="direct"?result.source:null),columnIndex=use?.columnIndex??result?.columnIndex;
  if(!source||columnIndex==null)return Object.freeze([]);
  const column=columnIndex<0?source.table.columns.find(candidate=>isIntegerPrimaryKeyAlias(source.table,candidate)):source.table.columns[columnIndex];if(!column)return Object.freeze([]);
  const override=term.expr.reduction?.kind==="reduction"?explicitExprCollation(term.expr.reduction as ExprReduction):null;
  const collation=override??explicitExprCollation(node)??sqliteAsciiFold(column.collation??"binary");
  if(collation!=="binary"&&collation!=="nocase"&&collation!=="rtrim")return Object.freeze([]);
  requirements.push(freeze({sourceOrdinal:resolved.sources.indexOf(source),column,descending:term.descending,collation,nulls:term.nulls}));
 }
 return Object.freeze(requirements);
}
