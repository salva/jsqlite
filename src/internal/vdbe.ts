// First compiled no-FROM scalar SELECT slice. The instruction/register split
// follows expr.c sqlite3ExprCode* and vdbe.c's opcode loop rather than evaluating
// the parsed ExprNode directly from Statement.step().
import type { ColumnMetadata, OperationOptions, SqliteStorageClass, SqliteValue, Statement, StepResult } from "../index.ts";
import { JSQLiteError } from "../index.ts";
import { BorrowLifetime, Mem, type MemAffinity, memFromPublic, memFromRawRecord, memToPublicInitial } from "./mem.ts";
import type { SelectNode } from "./parse.ts";
import { arithmeticBinary, bitwiseNot, booleanValue, logicalNot } from "./vdbe-primitives.ts";
import { compareMem, KeyInfo, type BuiltinCollation } from "./comparison.ts";
import { EphemeralIndexCursor, PrivateStateByteBudget, PrivateStateLimitError, SorterCursor, type PrivateStateControl, type PrivateStateLimits } from "./private-state.ts";
import { decodeRecord, RecordFormatError } from "./record.ts";
import { BtreeFormatError, BtreeLimitError, type BtreeDatabase, type TableScanCursor } from "./btree.ts";
import type { SchemaGraph, TableNode } from "./schema.ts";
import type { DatabaseEncoding } from "./record.ts";
import { expandAndResolveSelect, NameResolutionError } from "./resolve.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";
import type { LemonValue } from "./lemon-runtime.ts";
import type { SqlToken } from "./tokenize.ts";

type AggregateOrderTerm={expression:Expression;descending:boolean;nullsLarge:boolean};
type Expression =
 | {kind:"variable";spelling:string}
 | {kind:"mem";value:Mem;collation?:BuiltinCollation}
 | {kind:"literal";value:null|bigint|number|string|Uint8Array}
 | {kind:"column";index:number;name:string;cursor?:number;payloadIndex?:number;collation?:BuiltinCollation;affinity?:MemAffinity}
 | {kind:"unary";op:string;value:Expression}
 | {kind:"binary";op:string;left:Expression;right:Expression}
 | {kind:"collate";value:Expression;collation:BuiltinCollation}
 | {kind:"cast";value:Expression;affinity:MemAffinity}
 | {kind:"call";name:string;args:Expression[]}
 | {kind:"aggregate";name:string;args:Expression[];collation:BuiltinCollation;distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[]}
 | {kind:"register";index:number}
 | {kind:"case";operand:Expression|null;pairs:[Expression,Expression][];otherwise:Expression|null};

type Op =
  | { readonly code: "Integer"; readonly p1: bigint; readonly p2: number }
  | { readonly code: "Real"; readonly p1: number; readonly p2: number }
  | { readonly code: "String"; readonly p1: string; readonly p2: number }
  | { readonly code: "Blob"; readonly p1: Uint8Array; readonly p2: number }
  | { readonly code: "Null"; readonly p2: number }
  | { readonly code: "Copy"; readonly p1: number; readonly p2: number }
  | { readonly code: "Variable"; readonly p1: number; readonly p2: number }
  | { readonly code: "Binary"; readonly op: string; readonly p1:number; readonly p2:number; readonly p3:number; readonly collation:BuiltinCollation; readonly affinity?:MemAffinity }
  | { readonly code: "Cast"; readonly p1:number; readonly p2:number; readonly affinity:MemAffinity }
  | { readonly code: "Function" | "PureFunc"; readonly name:string; readonly args:readonly number[]; readonly p2:number; readonly collation:BuiltinCollation }
  | { readonly code: "AggStep"; readonly name:string; readonly args:readonly number[]; readonly p2:number; readonly collation:BuiltinCollation; readonly changed?:number }
  | { readonly code: "AggFinal"; readonly name:string; readonly p1:number }
  | { readonly code: "AggValue"; readonly name:string; readonly p1:number; readonly p2:number }
  | { readonly code: "AggReset"; readonly registers:readonly number[] }
  | { readonly code: "CompareGroup"; readonly left:number; readonly right:number; readonly count:number; readonly keyInfo:KeyInfo; readonly jump:number }
  | { readonly code: "CollSeq"; readonly collation:BuiltinCollation }
  | { readonly code: "ShortCircuit"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Boolean"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "NotNull"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Goto"; readonly p2:number }
  | { readonly code: "Subtract"; readonly p1: number; readonly p2: number; readonly p3: number }
  | { readonly code: "BitNot" | "Not"; readonly p1: number; readonly p2: number }
  | { readonly code: "OpenRead"; readonly p1: number; readonly p2?: number }
  | { readonly code: "SorterOpen"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "SorterInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly payload:number; readonly payloadCount:number; readonly topN?:number }
  | { readonly code: "SorterSort"; readonly p1:number; readonly emptyJump:number }
  | { readonly code: "SorterData"; readonly p1:number; readonly p2:number; readonly count:number }
  | { readonly code: "SorterNext"; readonly p1:number; readonly p2:number }
  | { readonly code: "OpenEphemeral"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "Found"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly jump:number }
  | { readonly code: "IdxInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly replace?:boolean }
  | { readonly code: "SetDelete"; readonly p1:number; readonly keyStart:number; readonly keyCount:number }
  | { readonly code: "SetRetainIntersection"; readonly p1:number; readonly p2:number }
  | { readonly code: "ClearEphemeral"; readonly p1:number }
  | { readonly code: "ClearSorter"; readonly p1:number }
  | { readonly code: "EphemeralSort"; readonly p1:number }
  | { readonly code: "EphemeralRewind"; readonly p1:number; readonly p2:number }
  | { readonly code: "EphemeralData"; readonly p1:number; readonly p2:number; readonly count:number }
  | { readonly code: "EphemeralNext"; readonly p1:number; readonly p2:number }
  | { readonly code: "MustBeInt"; readonly p1:number }
  | { readonly code: "OffsetLimit"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "IfNotZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "IfPos"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "DecrJumpZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "Rewind"; readonly p1?: number; readonly p2: number }
  | { readonly code: "NullRow"; readonly p1: number }
  | { readonly code: "Column"; readonly p1: number; readonly p2: number; readonly p3?: number }
  | { readonly code: "Rowid"; readonly p1?: number; readonly p2: number }
  | { readonly code: "Eq"; readonly p1: number; readonly p2: number; readonly p3: number; readonly affinity: MemAffinity; readonly collation: BuiltinCollation }
  | { readonly code: "IfNot"; readonly p1: number; readonly p2: number }
  | { readonly code: "Next"; readonly p1?: number; readonly p2: number }
  | { readonly code: "ResultRow"; readonly p1: number; readonly p2: number }
  | { readonly code: "Halt" };
export interface ParameterDescriptor { readonly name: string | null }
export interface Program {
  readonly ops: readonly Op[];
  readonly registers: number;
  readonly columns: readonly ColumnMetadata[];
  readonly parameters: readonly ParameterDescriptor[];
  readonly database?: BtreeDatabase;
  readonly maxRows?: number;
  readonly maxWorkUnits: number;
  readonly maxResultBytes: number;
  readonly privateStateLimits: PrivateStateLimits;
  readonly encoding: DatabaseEncoding;
}
export function programOpcodeNames(program:Program):readonly string[]{return Object.freeze(program.ops.map(op=>op.code));}
export function programControlTargets(program:Program):readonly Readonly<{index:number;code:string;target:number;targetCode:string|undefined}>[]{
  return Object.freeze(program.ops.flatMap((op,index)=>{
    const target=op.code==="IfPos"||op.code==="DecrJumpZero"?op.p2:undefined;
    return target===undefined?[]:[Object.freeze({index,code:op.code,target,targetCode:program.ops[target]?.code})];
  }));
}
export const DEFAULT_PRIVATE_STATE_LIMITS:PrivateStateLimits=Object.freeze({maxEntries:100_000,maxKeyBytes:16*1024*1024,maxBytes:256*1024*1024});
interface ParameterBuilder { maximum: number; readonly names: (string | null)[]; readonly named: Map<string, number> }

/** Shared scalar-result owner, corresponding to sqlite3_context and its result Mem. */
export class FunctionContext {
  readonly #result = new Mem();
  #resultCleanup: (() => void) | null = null;
  firstError: unknown = null;

  setResult(value: Mem, cleanup: (() => void) | null = null): void {
    this.cleanupResult();
    this.#result.moveFrom(value);
    this.#resultCleanup = cleanup;
  }
  setError(error: unknown): void { if (this.firstError === null) this.firstError = error; }
  cleanupResult(): void {
    this.#result.release();
    const cleanup = this.#resultCleanup; this.#resultCleanup = null;
    if (cleanup !== null) try { cleanup(); } catch (error) { this.setError(error); }
  }
  takeResult(): Mem {
    if (this.firstError !== null) { const error=this.firstError; this.cleanupResult(); throw error; }
    const result=new Mem(); result.moveFrom(this.#result); this.cleanupResult();
    if (this.firstError !== null) { const error=this.firstError; result.release(); throw error; }
    return result;
  }
}
function runFunctionContext(evaluate: () => Mem): Mem {
  const context=new FunctionContext();
  try { context.setResult(evaluate()); } catch (error) { context.setError(error); }
  return context.takeResult();
}
function aggregateDefinition(name:string):AggregateDefinition<any>|undefined{return aggregateDefinitions[name]}
const FUNCTION_ARITIES: Readonly<Record<string, readonly number[]>> = Object.freeze({
  typeof: [1], length: [1], octet_length: [1], abs: [1], substr: [2, 3], nullif: [2], coalesce: [],
  min: [], max: [], char: [], hex: [1], replace: [3],
});
function exprLeaves(n:LemonValue<SqlToken>):SqlToken[]{return n.kind==="terminal"?(n.value?[n.value]:[]):n.children.flatMap(exprLeaves)}
function descendantExprs(n:LemonValue<SqlToken>):LemonValue<SqlToken>[] {if(n.kind!=="reduction")return[];const out:LemonValue<SqlToken>[]=[];for(const c of n.children){if(c.kind==="reduction"&&(c.signature.startsWith("expr ::=")||c.signature.startsWith("term ::=")))out.push(c);else out.push(...descendantExprs(c))}return out}
type Reduction=Extract<LemonValue<SqlToken>,{kind:'reduction'}>;
function directReduction(n:LemonValue<SqlToken>,prefix:string):Reduction|undefined{return n.kind==='reduction'?n.children.find((child):child is Reduction=>child.kind==='reduction'&&child.signature.startsWith(prefix)):undefined}
function findReduction(n:LemonValue<SqlToken>,prefix:string):Reduction|undefined{if(n.kind!=='reduction')return undefined;if(n.signature.startsWith(prefix))return n;for(const child of n.children){const found=findReduction(child,prefix);if(found)return found}return undefined}
function listExpressions(n:LemonValue<SqlToken>,prefix:string):Reduction[] {if(n.kind!=='reduction')return[];const prior=directReduction(n,prefix),own=n.children.find((child):child is Reduction=>child.kind==='reduction'&&(child.signature.startsWith('expr ::=')||child.signature.startsWith('term ::=')));return[...(prior?listExpressions(prior,prefix):[]),...(own?[own]:[])]}
function aggregateParts(n:LemonValue<SqlToken>):{args:Expression[];distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[]}{
 const exprlist=directReduction(n,'exprlist ::=');const args=exprlist?listExpressions(exprlist,'nexprlist ::=').map(expressionFromReduction):[];
 const distinct=directReduction(n,'distinct ::=')?.signature.includes('DISTINCT')??false;
 const filterNode=findReduction(n,'filter_clause ::= FILTER'),filterExpr=filterNode?.children.find((child):child is Reduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
 const sortlist=directReduction(n,'sortlist ::=');const orderBy=sortlist?listExpressions(sortlist,'sortlist ::=').map(expr=>{const leaves=exprLeaves(sortlist),descending=leaves.some(token=>token.text.toUpperCase()==='DESC'),words=leaves.map(token=>token.text.toUpperCase()).join(' '),first=words.includes('NULLS FIRST'),last=words.includes('NULLS LAST');return{expression:expressionFromReduction(expr),descending,nullsLarge:last?!descending:first?descending:false}}):[];
 return{args,distinct,filter:filterExpr?expressionFromReduction(filterExpr):null,orderBy};
}
function decodeString(s:string){return s.slice(1,-1).replaceAll("''", "'")}
function affinityOf(s:string):MemAffinity{const x=s.toUpperCase();if(x.includes("INT"))return"integer";if(x.includes("CHAR")||x.includes("CLOB")||x.includes("TEXT"))return"text";if(x.includes("REAL")||x.includes("FLOA")||x.includes("DOUB"))return"real";if(!x||x.includes("BLOB"))return"blob";return"numeric"}
function expressionFromReduction(n:LemonValue<SqlToken>):Expression{
 if(n.kind!=="reduction"||!(n.signature.startsWith("expr ::=")||n.signature.startsWith("term ::=")))throw new JSQLiteError("unsupported","expression reduction is not implemented",{unsupportedClassification:"temporary"});
 const t=exprLeaves(n), all=descendantExprs(n), sig=n.signature;
 if(sig.startsWith("term ::=")||sig==="expr ::= term"||sig==="expr ::= VARIABLE"){const x=t[0]!;if(x.kind==="integer"){const v=BigInt(x.text);return{kind:"literal",value:v<(1n<<63n)?v:Number(x.text)}}if(x.kind==="float")return{kind:"literal",value:Number(x.text)};if(x.kind==="string")return{kind:"literal",value:decodeString(x.text)};if(x.kind==="blob")return{kind:"literal",value:Uint8Array.from(x.text.slice(2,-1).match(/../g)?.map(y=>parseInt(y,16))??[])};if(x.text.toUpperCase()==="NULL")return{kind:"literal",value:null}}
 if(sig==="expr ::= VARIABLE")return{kind:"variable",spelling:t[0]!.text};
 if(sig==="expr ::= LP expr RP")return expressionFromReduction(all[0]!);
 if(sig==="expr ::= PLUS|MINUS expr"||sig==="expr ::= BITNOT expr"||sig==="expr ::= NOT expr"){
  // expr.c admits 2^63 only as the operand of unary minus.
  if(t[0]!.text==="-"&&all[0]?.kind==="reduction"){const leaf=exprLeaves(all[0]);if(leaf.length===1&&leaf[0]!.kind==="integer"&&leaf[0]!.text==="9223372036854775808")return{kind:"literal",value:-(1n<<63n)}}
  return{kind:"unary",op:t[0]!.text.toUpperCase(),value:expressionFromReduction(all[0]!)};
 }
 if(all.length===2&&sig.startsWith("expr ::= expr ")){
  // Select the operator from the reduction itself, not from flattened leaves:
  // a child comparison may otherwise be mistaken for the outer AND/OR.
  const directWords=n.children.flatMap(child=>child.kind==="terminal"&&child.value?[child.value.text.toUpperCase()]:[]);
  const op=sig.includes(" IS NOT ")?"IS NOT":directWords[0];
  if(op&&["+","-","*","/","%","=","==","!=","<>","<",">","<=",">=","IS","IS NOT","AND","OR"].includes(op))return{kind:"binary",op,left:expressionFromReduction(all[0]!),right:expressionFromReduction(all[1]!)}
 }
 if(sig.startsWith("expr ::= CAST")){const at=t.findIndex(x=>x.text.toUpperCase()==="AS");return{kind:"cast",value:expressionFromReduction(all[0]!),affinity:affinityOf(t.slice(at+1,-1).map(x=>x.text).join(" "))}}
 if(sig==="expr ::= expr COLLATE ID|STRING"){const name=sqliteAsciiFold(t.at(-1)!.text);if(name!=="binary"&&name!=="nocase"&&name!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${t.at(-1)!.text}`,{code:1});return{kind:"collate",value:expressionFromReduction(all[0]!),collation:name};}
 if((sig.startsWith("expr ::= ID")||sig.startsWith("expr ::= nm"))&&!sig.includes(" LP"))return{kind:"column",index:-1,name:t.map(x=>x.text).join("")};
 // resolve.c function lookup selects unary min/max aggregate definitions by arity;
 // two-or-more arguments must continue through the scalar function registry.
 if(sig.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){const name=sqliteAsciiFold(t[0]!.text),parts=aggregateParts(n),args=sig.includes(" LP STAR RP")?[]:parts.args;const aggregate=aggregateDefinition(name);if(aggregate&&((name!=="min"&&name!=="max")||args.length===1)){const arities=aggregate.arities;if(!arities.includes(args.length))throw new JSQLiteError("sqlite",`wrong number of arguments to function ${name}()`,{code:1});if(parts.distinct&&args.length!==1)throw new JSQLiteError("sqlite","DISTINCT aggregates must have exactly one argument",{code:1});return{kind:"aggregate",name,args,collation:args[0]?collation(args[0]):"binary",distinct:parts.distinct,filter:parts.filter,orderBy:parts.orderBy};}if(!(name in FUNCTION_ARITIES))throw new JSQLiteError("sqlite",`no such function: ${name}`,{code:1});if(parts.filter)throw new JSQLiteError("sqlite","FILTER may not be used with non-aggregate function",{code:1});if(name==="coalesce"?args.length<2:name==="min"||name==="max"?args.length<2:name==="char"?false:!FUNCTION_ARITIES[name]!.includes(args.length))throw new JSQLiteError("sqlite",`wrong number of arguments to function ${name}()`,{code:1});return{kind:"call",name,args}}
 if(sig.startsWith("expr ::= CASE")){const vals=all.map(expressionFromReduction),hasOperand=t[1]?.text.toUpperCase()!=="WHEN",hasElse=t.some(x=>x.text.toUpperCase()==="ELSE"),operand=hasOperand?vals.shift()!:null,otherwise=hasElse?vals.pop()!:null,pairs:[Expression,Expression][]=[];while(vals.length)pairs.push([vals.shift()!,vals.shift()!]);return{kind:"case",operand,pairs,otherwise}}
 throw new JSQLiteError("unsupported","SELECT expression is not implemented",{unsupportedClassification:"temporary"})
}

export function rejectUnimplementedAggregateSelect(select:SelectNode):void{
 const visit=(node:LemonValue<SqlToken>):boolean=>{
  if(node.kind!=="reduction")return false;
  if(node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){
   const token=exprLeaves(node)[0];
   if(token){const name=sqliteAsciiFold(token.text),count=descendantExprs(node).length;if(aggregateDefinition(name)!==undefined&&(!['min','max'].includes(name)||count===1))return true;}
  }
  return node.children.some(visit);
 };
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])];
 if(expressions.some(expression=>expression.reduction?visit(expression.reduction):false))throw new JSQLiteError("unsupported","aggregate functions are not implemented",{unsupportedClassification:"temporary"});
}


/** resolve.c classifies aggregate calls from generated Expr structure. Identifiers
 * and aliases merely spelled like aggregate functions are not aggregate calls. */
export function selectHasAggregate(select:SelectNode):boolean {
 const visit=(node:LemonValue<SqlToken>):boolean=>{
  if(node.kind!=="reduction")return false;
  if(node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){
   const token=exprLeaves(node)[0];
   if(token){const name=sqliteAsciiFold(token.text),count=descendantExprs(node).length;if(aggregateDefinition(name)!==undefined&&((name!=="min"&&name!=="max")||count===1))return true;}
  }
  return node.children.some(visit);
 };
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])];
 return expressions.some(expression=>expression.reduction!==undefined&&visit(expression.reduction));
}

function expressionName(expression: SelectNode["result"][number]): string {
  if (expression.alias !== undefined) return expression.alias;
  return expression.tokens.map((token, index) => {
    const spaces = index ? " ".repeat(Math.max(0, token.startByte - expression.tokens[index - 1]!.endByte)) : "";
    return spaces + token.text;
  }).join("");
}


function rejectUnsupportedSelectClauses(select: SelectNode, relational = false): void {
  if (select.hasSubquery)
    throw new JSQLiteError("unsupported", "compound SELECTs, VALUES, and subqueries are not implemented", { unsupportedClassification: "temporary" });
  if (select.hasGroupBy || select.hasHaving || (!relational && (select.hasDistinct || (select.hasOrderBy && !select.hasCompound))))
    throw new JSQLiteError("unsupported", "this SELECT clause is not implemented", { unsupportedClassification: "temporary" });
}

function compileExpressionTree(expression:Expression,ops:Op[],allocate:()=>number,parameters?:ParameterBuilder):number {
  const emit=(e:Expression):number=>compileExpressionTree(e,ops,allocate,parameters);
  if(expression.kind==="register") { const r=allocate();ops.push({code:"Copy",p1:expression.index,p2:r});return r; }
  if(expression.kind==="variable") { if(!parameters)throw new JSQLiteError("internal","missing parameter builder");const spelling=expression.spelling;let index:number;if(spelling==="?")index=parameters.maximum+1;else if(spelling[0]==="?")index=Number(spelling.slice(1));else index=parameters.named.get(spelling)??parameters.maximum+1;if(!Number.isSafeInteger(index)||index<1||index>32766)throw new JSQLiteError("sqlite","variable number must be between ?1 and ?32766",{code:1});if(spelling!=="?"&&!parameters.named.has(spelling))parameters.named.set(spelling,index);while(parameters.names.length<index)parameters.names.push(null);if(spelling!=="?"&&parameters.names[index-1]===null)parameters.names[index-1]=spelling;parameters.maximum=Math.max(parameters.maximum,index);const r=allocate();ops.push({code:"Variable",p1:index,p2:r});return r; }
  if(expression.kind==="literal") { const r=allocate(),v=expression.value;if(v===null)ops.push({code:"Null",p2:r});else if(typeof v==="bigint")ops.push({code:"Integer",p1:v,p2:r});else if(typeof v==="number")ops.push({code:"Real",p1:v,p2:r});else if(typeof v==="string")ops.push({code:"String",p1:v,p2:r});else ops.push({code:"Blob",p1:v,p2:r});return r; }
  if(expression.kind==="column") { const r=allocate();ops.push({code:"Column",p1:expression.index,p2:r,...(expression.cursor===undefined?{}:{p3:expression.cursor})});return r; }
  if(expression.kind==="collate") { ops.push({code:"CollSeq",collation:expression.collation});return emit(expression.value); }
  if(expression.kind==="cast") { const a=emit(expression.value),r=allocate();ops.push({code:"Cast",p1:a,p2:r,affinity:expression.affinity});return r; }
  if(expression.kind==="unary") { const a=emit(expression.value);if(expression.op==="+")return a;const r=allocate();if(expression.op==="-"){const z=allocate();ops.push({code:"Integer",p1:0n,p2:z},{code:"Subtract",p1:z,p2:a,p3:r})}else ops.push({code:expression.op==="~"?"BitNot":"Not",p1:a,p2:r});return r; }
  if(expression.kind==="binary") {
    const left=emit(expression.left);
    if(expression.op==="AND"||expression.op==="OR") { const r=allocate(),guard=ops.length;ops.push({code:"ShortCircuit",kind:expression.op.toLowerCase() as "and"|"or",p1:left,p2:r,jump:0});const right=emit(expression.right);ops.push({code:"Boolean",kind:expression.op.toLowerCase() as "and"|"or",p1:left,p2:right,p3:r});(ops[guard] as {jump:number}).jump=ops.length;return r; }
    const right=emit(expression.right),r=allocate(),affinity=expressionAffinity(expression.left)??expressionAffinity(expression.right);ops.push({code:"Binary",op:expression.op,p1:left,p2:right,p3:r,collation:binaryCollation(expression.left,expression.right),...(affinity?{affinity}:{})});return r;
  }
  if(expression.kind==="call") {
    if(expression.name==="coalesce") { const r=allocate(),jumps:number[]=[];for(const arg of expression.args){const a=emit(arg);const at=ops.length;ops.push({code:"NotNull",p1:a,p2:r,jump:0});jumps.push(at)}ops.push({code:"Null",p2:r});for(const at of jumps)(ops[at] as {jump:number}).jump=ops.length;return r; }
    const args=expression.args.map(emit),r=allocate(),coll=expression.args.map(collation).find((_,i)=>expression.args[i]!.kind==="collate")??"binary";if(coll!=="binary")ops.push({code:"CollSeq",collation:coll});ops.push({code:"Function",name:expression.name,args,p2:r,collation:coll});return r;
  }
  if(expression.kind==="mem"||expression.kind==="aggregate")throw new JSQLiteError("internal","execution-only expression reached scalar lowering");
  const result=allocate(),endJumps:number[]=[],base=expression.operand?emit(expression.operand):null;
  for(const [when,then] of expression.pairs){const w=emit(when),test=base===null?w:(()=>{const r=allocate();ops.push({code:"Binary",op:"=",p1:base,p2:w,p3:r,collation:collation(expression.operand!)});return r})(),skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});const value=emit(then);ops.push({code:"Copy",p1:value,p2:result});endJumps.push(ops.length);ops.push({code:"Goto",p2:0});(ops[skip] as {p2:number}).p2=ops.length;}
  if(expression.otherwise){const value=emit(expression.otherwise);ops.push({code:"Copy",p1:value,p2:result})}else ops.push({code:"Null",p2:result});for(const at of endJumps)(ops[at] as {p2:number}).p2=ops.length;return result;
}

function compileExpression(expression: SelectNode["result"][number], ops: Op[], allocate: () => number, parameters: ParameterBuilder): { register: number; name: string } {
  const tokens = expression.tokens;
  if (expression.reduction) { const register=compileExpressionTree(expressionFromReduction(expression.reduction),ops,allocate,parameters); return {register,name:expressionName(expression)}; }
  let at = 0;
  const unary: string[] = [];
  while (at < tokens.length && (["+", "-", "~"].includes(tokens[at]!.text) || tokens[at]!.text.toUpperCase() === "NOT")) unary.push(tokens[at++]!.text.toUpperCase());
  const literal = tokens[at];
  if (!literal || at + 1 !== tokens.length) throw new JSQLiteError("unsupported", "SELECT expression is not implemented", { unsupportedClassification: "temporary" });
  let register = allocate();
  if (literal.kind === "integer") {
    let value: bigint;
    try { value = BigInt(literal.text); } catch { throw new JSQLiteError("sqlite", "integer literal is out of range", { code: 1 }); }
    if (value < -(1n << 63n) || value > (1n << 63n) - 1n) throw new JSQLiteError("sqlite", "integer literal is out of range", { code: 1 });
    ops.push({ code: "Integer", p1: value, p2: register });
  } else if (literal.kind === "variable") {
    if (unary.length) throw new JSQLiteError("unsupported", "unary parameter expression is not implemented", { unsupportedClassification: "temporary" });
    const spelling = literal.text;
    let index: number;
    if (spelling === "?") index = parameters.maximum + 1;
    else if (spelling[0] === "?") {
      if (!/^\?[0-9]+$/.test(spelling)) throw new JSQLiteError("sqlite", "variable number must be between ?1 and ?32766", { code: 1 });
      index = Number(spelling.slice(1));
      if (!Number.isSafeInteger(index) || index < 1 || index > 32766) throw new JSQLiteError("sqlite", "variable number must be between ?1 and ?32766", { code: 1 });
    } else {
      const known = parameters.named.get(spelling);
      index = known ?? parameters.maximum + 1;
      if (known === undefined) parameters.named.set(spelling, index);
    }
    if (index > 32766) throw new JSQLiteError("sqlite", "too many SQL variables", { code: 1 });
    while (parameters.names.length < index) parameters.names.push(null);
    if (spelling !== "?" && parameters.names[index - 1] === null) parameters.names[index - 1] = spelling;
    parameters.maximum = Math.max(parameters.maximum, index);
    ops.push({ code: "Variable", p1: index, p2: register });
  } else throw new JSQLiteError("unsupported", "SELECT expression is not implemented", { unsupportedClassification: "temporary" });
  for (let i = unary.length - 1; i >= 0; i--) {
    const operator = unary[i]!;
    if (operator === "+") continue;
    const output = allocate();
    if (operator === "-") {
      const zero = allocate();
      ops.push({ code: "Integer", p1: 0n, p2: zero }, { code: "Subtract", p1: zero, p2: register, p3: output });
    } else ops.push({ code: operator === "~" ? "BitNot" : "Not", p1: register, p2: output });
    register = output;
  }
  return { register, name: expressionName(expression) };
}

interface LimitRegisters { count:number; offset?:number; combined:number; capacity:number; ifZero:number }
function computeLimitRegisters(select:SelectNode,ops:Op[],allocate:()=>number,parameters:ParameterBuilder,compoundZeroBeforeOffset=false):LimitRegisters|undefined {
 if(!select.limit)return undefined;
 const count=compileExpressionTree(expressionFromReduction(select.limit.reduction!),ops,allocate,parameters);
 ops.push({code:"MustBeInt",p1:count});
 const earlyZero=compoundZeroBeforeOffset?ops.length:-1;if(compoundZeroBeforeOffset)ops.push({code:"IfNot",p1:count,p2:0});
 let offset:number|undefined;
 if(select.offset){offset=compileExpressionTree(expressionFromReduction(select.offset.reduction!),ops,allocate,parameters);ops.push({code:"MustBeInt",p1:offset});}
 const combined=allocate();if(offset===undefined){ops.push({code:"Copy",p1:count,p2:combined});}else ops.push({code:"OffsetLimit",p1:count,p2:combined,p3:offset});
 const capacity=allocate();ops.push({code:"Copy",p1:combined,p2:capacity});
 const ifZero=compoundZeroBeforeOffset?earlyZero:ops.length;if(!compoundZeroBeforeOffset)ops.push({code:"IfNot",p1:count,p2:0});
 return {count,...(offset===undefined?{}:{offset}),combined,capacity,ifZero};
}

export function compileScalarSelect(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS): Program {
  rejectUnsupportedSelectClauses(select);
  if(select.hasCompound){
    // select.c:multiSelect's unordered UNION ALL route emits each arm to one
    // SRT_Output destination while sharing the compound LIMIT/OFFSET registers.
    // Other operators/orderings remain atomic prepare-time unsupported until the
    // coroutine merge route is complete.
    const operators=select.arms.slice(1).map(arm=>arm.operatorFromPrior);
    const orderedAll=select.hasOrderBy&&operators.every(op=>op==="union-all");
    const distinctSet=operators.some(op=>op!=="union-all")&&operators.every(op=>op==="union-all"||op==="union"||op==="intersect"||op==="except");
    const lastSetArm=operators.reduce((last,operator,index)=>operator==="union-all"?last:index+1,-1);
    if((select.hasOrderBy&&!distinctSet&&!orderedAll)||(!distinctSet&&!orderedAll&&operators.some(op=>op!=="union-all"))||select.arms.some(arm=>arm.from.items.length||arm.where!==null||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving))
      throw new JSQLiteError("unsupported","ordered and mixed set compound SELECTs are not implemented",{unsupportedClassification:"temporary"});
    const width=select.arms[0]?.result.length??0;
    if(!width||select.arms.some(arm=>arm.result.length!==width||(arm.origin==="values"&&arm.valuesRows!.some(row=>row.length!==width)))){const mismatch=select.arms.find(arm=>arm.result.length!==width||(arm.origin==="values"&&arm.valuesRows!.some(row=>row.length!==width))),word=mismatch?.operatorFromPrior==="union-all"?"UNION ALL":mismatch?.operatorFromPrior?.toUpperCase()??"UNION";throw new JSQLiteError("sqlite",`SELECTs to the left and right of ${word} do not have the same number of result columns`,{code:1});}
    // select.c:multiSelectCollSeq chooses the first non-BINARY (non-null
    // CollSeq in native terms) result collation scanning arms left-to-right.
    // Resolve expression metadata once; KeyInfo, not SQL spelling, owns compare.
    const resultCollations=Array.from({length:width},(_,column)=>{
      for(const arm of select.arms){const expression=arm.result[column];if(!expression?.reduction)continue;const named=explicitCollation(expressionFromReduction(expression.reduction));if(named)return named;}
      return "binary" as BuiltinCollation;
    });
    const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let maximum=0;const allocate=()=>++maximum;
    const compoundLimit=computeLimitRegisters(select,ops,allocate,parameters,true);
    if(orderedAll){
      // For these finite scalar/VALUES producers, materializing into the existing
      // typed sorter is the documented browser adaptation of multiSelectByMerge.
      // Preserve resolveCompoundOrderBy's complete key: every term resolves to
      // one result column, and the sorter payload remains the complete row.
      const resolvedOrder=select.orderBy.map((term,termIndex)=>{
        const tree=expressionFromReduction(term.expr.reduction!),matchTree=tree.kind==="collate"?tree.value:tree;let resultIndex=-1;
        if(matchTree.kind==="literal"&&typeof matchTree.value==="bigint"){
          if(matchTree.value<1n||matchTree.value>BigInt(width))throw new JSQLiteError("sqlite",`${termIndex+1}${termIndex===0?"st":termIndex===1?"nd":termIndex===2?"rd":"th"} ORDER BY term out of range - should be between 1 and ${width}`,{code:1});
          resultIndex=Number(matchTree.value-1n);
        }else if(matchTree.kind==="column"&&!matchTree.name.includes(".")){
          const name=sqlName(matchTree.name);
          for(const arm of select.arms){const at=arm.result.findIndex(result=>result.alias!==undefined&&result.alias!==null&&sqliteIdentifierEqual(result.alias,name));if(at>=0){resultIndex=at;break;}}
        }
        if(resultIndex<0){const identity=term.expr.tokens.map(token=>token.text).join(" ");for(const arm of select.arms){const at=arm.result.findIndex(result=>result.tokens.map(token=>token.text).join(" ")===identity);if(at>=0){resultIndex=at;break;}}}
        if(resultIndex<0)throw new JSQLiteError("sqlite",`${termIndex+1}${termIndex===0?"st":termIndex===1?"nd":termIndex===2?"rd":"th"} ORDER BY term does not match any column in the result set`,{code:1});
        const nullsLarge=term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false;
        return {resultIndex,collation:explicitCollation(tree)??resultCollations[resultIndex]!,desc:term.descending,nullsLarge};
      });
      const cursor=1,keyInfo=new KeyInfo({encoding,totalFieldCount:resolvedOrder.length,keyFieldCount:resolvedOrder.length,terms:resolvedOrder.map(term=>({collation:term.collation,desc:term.desc,nullsLarge:term.nullsLarge}))});ops.push({code:"SorterOpen",p1:cursor,keyInfo});
      for(const arm of select.arms)for(const expressions of arm.origin==="values"?arm.valuesRows!:[arm.result]){
        const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters)),row=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:row+index}));maximum+=width-1;
        const key=allocate();resolvedOrder.forEach((term,index)=>ops.push({code:"Copy",p1:row+term.resultIndex,p2:key+index}));maximum+=resolvedOrder.length-1;
        ops.push({code:"SorterInsert",p1:cursor,keyStart:key,keyCount:resolvedOrder.length,payload:row,payloadCount:width,...(compoundLimit?{topN:compoundLimit.capacity}:{})});
      }
      const output=allocate();maximum+=width-1;const sortAt=ops.length;ops.push({code:"SorterSort",p1:cursor,emptyJump:0},{code:"SorterData",p1:cursor,p2:output,count:width});let skip:number|undefined;if(compoundLimit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:compoundLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:output,p2:width});let exhausted:number|undefined;if(compoundLimit){exhausted=ops.length;ops.push({code:"DecrJumpZero",p1:compoundLimit.count,p2:0});}const next=ops.length;ops.push({code:"SorterNext",p1:cursor,p2:sortAt+1});const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;if(exhausted!==undefined)(ops[exhausted] as {p2:number}).p2=halt;if(compoundLimit)(ops[compoundLimit.ifZero] as {p2:number}).p2=halt;
      const names=select.arms[0]!.result.map(expression=>expressionName(expression));return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
    }
    if(distinctSet){
      let orderDescending=false,orderNullsLarge=false,orderCollation: BuiltinCollation|undefined;
      if(select.hasOrderBy){
        if(select.orderBy.length!==1||width!==1)throw new JSQLiteError("unsupported","multi-column compound ORDER BY merge is not implemented",{unsupportedClassification:"temporary"});
        const term=select.orderBy[0]!,tree=expressionFromReduction(term.expr.reduction!),matchTree=tree.kind==="collate"?tree.value:tree;let matches=false;
        if(matchTree.kind==="literal"&&typeof matchTree.value==="bigint"){if(matchTree.value!==1n)throw new JSQLiteError("sqlite","1st ORDER BY term out of range - should be between 1 and 1",{code:1});matches=true;}
        else if(matchTree.kind==="column"&&!matchTree.name.includes(".")){const name=sqlName(matchTree.name);matches=select.arms.some(arm=>arm.result.some(result=>result.alias!==undefined&&result.alias!==null&&sqliteIdentifierEqual(result.alias,name)));}
        if(!matches){const identity=term.expr.tokens.map(token=>token.text).join(" ");matches=select.arms.some(arm=>arm.result.some(result=>result.tokens.map(token=>token.text).join(" ")===identity));}
        if(!matches)throw new JSQLiteError("sqlite","1st ORDER BY term does not match any column in the result set",{code:1});
        orderDescending=term.descending;orderNullsLarge=term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false;orderCollation=explicitCollation(tree);
      }
      // multiSelect completes the set prefix in typed ephemeral state, then
      // redirects that state and every trailing UNION ALL arm to one shared
      // output/sorter destination. Duplicate and ORDER KeyInfo stay separate.
      const cursor=1,aux=2,keyInfo=new KeyInfo({encoding,totalFieldCount:width,keyFieldCount:width,terms:resultCollations.map(collation=>({collation,desc:false,nullsLarge:false}))});ops.push({code:"OpenEphemeral",p1:cursor,keyInfo},{code:"OpenEphemeral",p1:aux,keyInfo});
      for(let armIndex=0;armIndex<=lastSetArm;armIndex++){const arm=select.arms[armIndex]!,operator=arm.operatorFromPrior,rows=arm.origin==="values"?arm.valuesRows!:[arm.result];for(const expressions of rows){const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters));const start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;if(armIndex===0||operator==="union"||operator==="union-all")ops.push({code:"IdxInsert",p1:cursor,keyStart:start,keyCount:width,replace:true});else if(operator==="except")ops.push({code:"SetDelete",p1:cursor,keyStart:start,keyCount:width});else ops.push({code:"IdxInsert",p1:aux,keyStart:start,keyCount:width,replace:true});}if(operator==="intersect")ops.push({code:"SetRetainIntersection",p1:cursor,p2:aux},{code:"ClearEphemeral",p1:aux});}
      const output=allocate();maximum+=width-1;let sorter:number|undefined;
      if(select.hasOrderBy){sorter=3;const sortKey=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:orderCollation??resultCollations[0]!,desc:orderDescending,nullsLarge:orderNullsLarge}]});ops.push({code:"SorterOpen",p1:sorter,keyInfo:sortKey});}
      const haltJumps:number[]=[],emit=(start:number)=>{if(sorter!==undefined){ops.push({code:"SorterInsert",p1:sorter,keyStart:start,keyCount:1,payload:start,payloadCount:width,...(compoundLimit?{topN:compoundLimit.capacity}:{})});return undefined;}let skip:number|undefined;if(compoundLimit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:compoundLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:start,p2:width});if(compoundLimit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:compoundLimit.count,p2:0});}return skip;};
      ops.push({code:"EphemeralSort",p1:cursor});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:cursor,p2:0},{code:"EphemeralData",p1:cursor,p2:output,count:width});const drainSkip=emit(output),drainNext=ops.length;ops.push({code:"EphemeralNext",p1:cursor,p2:rewind+1});(ops[rewind] as {p2:number}).p2=ops.length;if(drainSkip!==undefined)(ops[drainSkip] as {p2:number}).p2=drainNext;
      for(let armIndex=lastSetArm+1;armIndex<select.arms.length;armIndex++)for(const expressions of select.arms[armIndex]!.origin==="values"?select.arms[armIndex]!.valuesRows!:[select.arms[armIndex]!.result]){const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters)),start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;const skip=emit(start);if(skip!==undefined)(ops[skip] as {p2:number}).p2=ops.length;}
      if(sorter!==undefined){const sortAt=ops.length;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:output,count:width});let skip:number|undefined;if(compoundLimit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:compoundLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:output,p2:width});if(compoundLimit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:compoundLimit.count,p2:0});}const next=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:sortAt+1});(ops[sortAt] as {emptyJump:number}).emptyJump=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;}
      const halt=ops.length;ops.push({code:"Halt"});for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;if(compoundLimit)(ops[compoundLimit.ifZero] as {p2:number}).p2=halt;
      const names=select.arms[0]!.result.map(expression=>expressionName(expression));return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
    }
    const limit=compoundLimit,haltJumps:number[]=[];
    for(const arm of select.arms)for(const expressions of arm.origin==="values"?arm.valuesRows!:[arm.result]){
      const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters));
      const start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;
      if(limit?.offset!==undefined){const skip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});ops.push({code:"ResultRow",p1:start,p2:width});(ops[skip] as {p2:number}).p2=ops.length+(limit?1:0);}else ops.push({code:"ResultRow",p1:start,p2:width});
      if(limit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}
    }
    const halt=ops.length;ops.push({code:"Halt"});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;}
    const names=select.arms[0]!.result.map(expression=>expressionName(expression));
    return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
  }
  if (select.hasValues) {
    const arm=select.arms[0],rows=arm?.valuesRows;
    if(!rows?.length||!rows[0]?.length)throw new JSQLiteError("sqlite","VALUES must have at least one column",{code:1});
    const width=rows[0].length;
    if(rows.some(row=>row.length!==width))throw new JSQLiteError("sqlite","all VALUES must have the same number of terms",{code:1});
    const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let maximum=0;const allocate=()=>++maximum;
    for(const row of rows){
      const evaluated=row.map(expression=>compileExpression(expression,ops,allocate,parameters));
      const start=allocate();evaluated.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;
      ops.push({code:"ResultRow",p1:start,p2:width});
    }
    ops.push({code:"Halt"});
    return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(rows[0].map((_,index)=>Object.freeze({name:`column${index+1}`,declaredType:null,database:null,table:null,origin:null})))});
  }
  if (select.from.items.length || select.where !== null) throw new JSQLiteError("unsupported", "table SELECT compilation is not implemented", { unsupportedClassification: "temporary" });
  if (!select.result.length) throw new JSQLiteError("sqlite", "SELECT has no result columns", { code: 1 });
  const ops: Op[] = [];
  const resultOps: Op[] = [];
  let maximum = 0;
  const allocate = () => ++maximum;
  const parameters: ParameterBuilder = { maximum: 0, names: [], named: new Map() };
  // Resolve/number result expressions in SQL source order, but retain their
  // opcodes until after computeLimitRegisters. SQLite computes LIMIT and
  // OFFSET before entering the result-production path, so LIMIT 0 skips even
  // failing or work-heavy result expressions while an invalid OFFSET still
  // fails before that zero-row jump.
  const expressions = select.result.map(expression => compileExpression(expression, resultOps, allocate, parameters));
  const limit=computeLimitRegisters(select,ops,allocate,parameters);
  ops.push(...resultOps);
  const resultStart = allocate();
  expressions.forEach((expression, index) => ops.push({ code: "Copy", p1: expression.register, p2: resultStart + index }));
  maximum += expressions.length - 1;
  const offsetSkip=limit?.offset===undefined?undefined:ops.length;
  if(limit?.offset!==undefined)ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});
  ops.push({ code: "ResultRow", p1: resultStart, p2: expressions.length });
  if(limit)ops.push({code:"DecrJumpZero",p1:limit.count,p2:ops.length+1});
  ops.push({ code: "Halt" });
  if(limit){const halt=ops.length-1;(ops[limit.ifZero] as {p2:number}).p2=halt;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=halt;}
  return Object.freeze({ ops: Object.freeze(ops), registers: maximum, maxWorkUnits, maxResultBytes, privateStateLimits, encoding, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))), columns: Object.freeze(expressions.map(expression => Object.freeze({ name: expression.name, declaredType: null, database: null, table: null, origin: null }))) });
}

function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof expandAndResolveSelect>,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program {
  if(expanded.sources.some((source,index)=>index>0&&source.joinFromLeft.error))throw new JSQLiteError("unsupported","invalid joins are not implemented",{unsupportedClassification:"temporary"});
  const rightLevels=expanded.sources.flatMap((source,index)=>index>0&&source.joinFromLeft.right?[index]:[]),rightLevel=rightLevels[0]??-1;
  // Pinned wherecode.c owns a WhereRightJoin per barrier. Until this compiler
  // carries that cardinality, reject repeated barriers atomically rather than
  // silently lowering only the first one.
  if(rightLevels.length>1)throw new JSQLiteError("unsupported","multiple RIGHT/FULL JOIN barriers are not implemented",{unsupportedClassification:"temporary"});
  for(const source of expanded.sources)if(source.table.withoutRowid||source.table.columns.some(column=>column.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});
  const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let registers=expanded.result.length;const allocate=()=>++registers;
  const resolveTree=(tree:Expression):Expression=>{const visit=(node:Expression):Expression=>{
    if(node.kind==="column") {const parts=node.name.split('.').map(sqlName),name=parts.at(-1)!;const candidates=expanded.sources.flatMap(source=>{if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,source.alias??source.table.name))return [];const index=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(index>=0)return[{source,index}];if(!source.table.withoutRowid&&['rowid','_rowid_','oid'].some(alias=>sqliteIdentifierEqual(alias,name))&&!source.table.columns.some(column=>sqliteIdentifierEqual(column.name,name)))return[{source,index:-1}];return[];});if(candidates.length===0&&parts.length===1){const alias=select.result.find(result=>result.alias&&sqliteIdentifierEqual(result.alias,name));if(alias?.reduction)return visit(expressionFromReduction(alias.reduction));}if(candidates.length!==1)throw new JSQLiteError("internal",`resolved join column lost identity: ${node.name}`);const {source,index}=candidates[0]!;node.cursor=source.cursorId;node.index=index;if(index<0){node.affinity='integer';node.collation='binary';return node;}const column=source.table.columns[index]!,c=sqliteAsciiFold(column.collation??'binary');if(c!=="binary"&&c!=="nocase"&&c!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${column.collation}`,{code:1});node.collation=c;node.affinity=affinityOf(column.declaredType??'');return node;}
    if(node.kind==="unary"||node.kind==="cast"||node.kind==="collate")node.value=visit(node.value);else if(node.kind==="binary"){node.left=visit(node.left);node.right=visit(node.right);}else if(node.kind==="call")node.args=node.args.map(visit);else if(node.kind==="case"){if(node.operand)node.operand=visit(node.operand);node.pairs=node.pairs.map(([a,b])=>[visit(a),visit(b)]);if(node.otherwise)node.otherwise=visit(node.otherwise);}return node;};return visit(tree);};
  const limit=computeLimitRegisters(select,ops,allocate,parameters);
  const orderTerms=select.orderBy.map((term,index)=>{let tree=expressionFromReduction(term.expr.reduction!),identity=tree;while(identity.kind==='collate')identity=identity.value;let resultIndex=-1;if(identity.kind==='literal'&&typeof identity.value==='bigint'){if(identity.value<1n||identity.value>BigInt(expanded.result.length)){const n=index+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new JSQLiteError('sqlite',`${n}${suffix} ORDER BY term out of range - should be between 1 and ${expanded.result.length}`,{code:1});}resultIndex=Number(identity.value-1n);}else if(identity.kind==='column'&&!identity.name.includes('.'))resultIndex=expanded.result.findIndex(result=>sqliteIdentifierEqual(result.name,sqlName(identity.name)));return{tree:resultIndex<0?resolveTree(tree):tree,resultIndex,descending:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false};});
  const sorterCursor=expanded.sources.length,distinctCursor=sorterCursor+1,rightMatchCursor=distinctCursor+1;
  if(orderTerms.length)ops.push({code:'SorterOpen',p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:term.resultIndex>=0?sqliteAsciiFold(expanded.result[term.resultIndex]!.descriptor.collation) as BuiltinCollation:collation(term.tree),desc:term.descending,nullsLarge:term.nullsLarge}))})});
  if(select.hasDistinct)ops.push({code:'OpenEphemeral',p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:expanded.result.length,keyFieldCount:expanded.result.length,terms:expanded.result.map(result=>({collation:sqliteAsciiFold(result.descriptor.collation) as BuiltinCollation}))})});
  let rightKey:number|undefined;if(rightLevel>=0){rightKey=allocate();ops.push({code:'OpenEphemeral',p1:rightMatchCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]})});}
  const compilePredicate=(expression:SelectNode['where'])=>{if(!expression?.reduction)return undefined;const value=compileExpressionTree(resolveTree(expressionFromReduction(expression.reduction)),ops,allocate,parameters),at=ops.length;ops.push({code:'IfNot',p1:value,p2:0});return at;};
  expanded.sources.forEach(source=>ops.push({code:'OpenRead',p1:source.table.rootPage,p2:source.cursorId}));const rewinds:number[]=[],starts:number[]=[],bodies:number[]=[],leftMatches:(number|undefined)[]=[],jumps:{at:number;level:number}[]=[];
  for(let level=0;level<expanded.sources.length;level++){const source=expanded.sources[level]!,isLeft=level>0&&source.joinFromLeft.left;if(isLeft){leftMatches[level]=allocate();ops.push({code:'Integer',p1:0n,p2:leftMatches[level]!});}rewinds.push(ops.length);ops.push({code:'Rewind',p1:source.cursorId,p2:0});starts.push(ops.length);const on=compilePredicate(source.on);if(on!==undefined)jumps.push({at:on,level});if(source.using)for(const name of source.using){const right=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)),left=expanded.sources.slice(0,level).reverse().find(candidate=>candidate.table.columns.some(column=>sqliteIdentifierEqual(column.name,name)))!,leftIndex=left.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));const value=compileExpressionTree(resolveTree({kind:'binary',op:'=',left:{kind:'column',index:leftIndex,name:`${left.alias??left.table.name}.${name}`},right:{kind:'column',index:right,name:`${source.alias??source.table.name}.${name}`}}),ops,allocate,parameters),at=ops.length;ops.push({code:'IfNot',p1:value,p2:0});jumps.push({at,level});}if(isLeft)ops.push({code:'Integer',p1:1n,p2:leftMatches[level]!});if(level===rightLevel)ops.push({code:'Rowid',p1:source.cursorId,p2:rightKey!},{code:'IdxInsert',p1:rightMatchCursor,keyStart:rightKey!,keyCount:1});bodies[level]=ops.length;}
  const joinedBodyStart=ops.length;
  const where=compilePredicate(select.where);if(where!==undefined)jumps.push({at:where,level:expanded.sources.length-1});expanded.result.forEach((result,index)=>{if(result.resolution==='coalesce'){const refs=result.mergedSources!;const ends:number[]=[];for(const ref of refs){const value=allocate();if(ref.columnIndex<0)ops.push({code:'Rowid',p1:ref.source.cursorId,p2:value});else ops.push({code:'Column',p1:ref.columnIndex,p2:value,p3:ref.source.cursorId});const at=ops.length;ops.push({code:'NotNull',p1:value,p2:index+1,jump:0});ends.push(at);}ops.push({code:'Null',p2:index+1});for(const at of ends)(ops[at] as {jump:number}).jump=ops.length;}else if(result.source&&result.columnIndex!==null){if(result.columnIndex<0)ops.push({code:'Rowid',p1:result.source.cursorId,p2:index+1});else ops.push({code:'Column',p1:result.columnIndex,p2:index+1,p3:result.source.cursorId});}else{if(!result.expression.reduction)throw new JSQLiteError('internal','resolved expression has no tree');const value=compileExpressionTree(resolveTree(expressionFromReduction(result.expression.reduction)),ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:index+1});}});
  let distinctAt:number|undefined;if(select.hasDistinct){distinctAt=ops.length;ops.push({code:'Found',p1:distinctCursor,keyStart:1,keyCount:expanded.result.length,jump:0},{code:'IdxInsert',p1:distinctCursor,keyStart:1,keyCount:expanded.result.length});}
  if(orderTerms.length){const keyStart=allocate();registers+=orderTerms.length-1;orderTerms.forEach((term,index)=>{if(term.resultIndex>=0)ops.push({code:'Copy',p1:term.resultIndex+1,p2:keyStart+index});else{const value=compileExpressionTree(term.tree,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:keyStart+index});}});ops.push({code:'SorterInsert',p1:sorterCursor,keyStart,keyCount:orderTerms.length,payload:1,payloadCount:expanded.result.length,...(limit?{topN:limit.capacity}:{})});}
  else {let offsetAt:number|undefined;if(limit?.offset!==undefined){offsetAt=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}ops.push({code:'ResultRow',p1:1,p2:expanded.result.length});if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});if(offsetAt!==undefined)jumps.push({at:offsetAt,level:expanded.sources.length-1});}
  const joinedBodyEnd=ops.length;
  const nextAt:number[]=[],rewindEmpty:number[]=[];for(let level=expanded.sources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:'Next',p1:expanded.sources[level]!.cursorId,p2:starts[level]!});const match=leftMatches[level];if(match!==undefined){rewindEmpty[level]=ops.length;const matched=ops.length;ops.push({code:'IfPos',p1:match,p2:0,p3:0},{code:'Integer',p1:1n,p2:match},{code:'NullRow',p1:expanded.sources[level]!.cursorId},{code:'Goto',p2:bodies[level]!});(ops[matched] as {p2:number}).p2=ops.length;}}const normalScanEnd=ops.length;
  if(rightLevel>=0){
    // Resolve sqlite3WhereEnd-style forward exits before cloning the shared
    // continuation. Copying their zero placeholders would restart at address
    // 0 when a downstream ON fails or its input is empty.
    for(let level=0;level<rewinds.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);
    if(distinctAt!==undefined)(ops[distinctAt] as {jump:number}).jump=nextAt.at(-1)!;
    for(const jump of jumps)(ops[jump.at] as {p2:number}).p2=nextAt[jump.level]!;
    // wherecode.c:sqlite3WhereRightJoinLoop scans the original RHS after the
    // source-order pass, NULLs every cursor left of the barrier, and invokes the
    // same interior continuation (including downstream joins and destinations).
    for(let level=0;level<rightLevel;level++)ops.push({code:'NullRow',p1:expanded.sources[level]!.cursorId});
    const rewind=ops.length;ops.push({code:'Rewind',p1:expanded.sources[rightLevel]!.cursorId,p2:0});
    const start=ops.length;ops.push({code:'Rowid',p1:expanded.sources[rightLevel]!.cursorId,p2:rightKey!});
    const found=ops.length;ops.push({code:'Found',p1:rightMatchCursor,keyStart:rightKey!,keyCount:1,jump:0});
    const continuationStart=bodies[rightLevel]!,continuationEnd=nextAt[rightLevel]!,copyStart=ops.length,delta=copyStart-continuationStart;
    const relocate=(target:number):number=>target>=continuationStart&&target<continuationEnd?target+delta:target===continuationEnd?-1:target;
    for(const original of ops.slice(continuationStart,continuationEnd)){
      const copy={...original} as Op;
      if(copy.code==='Rewind'||copy.code==='IfNot'||copy.code==='Goto'||copy.code==='Next'||copy.code==='IfPos'||(copy.code==='DecrJumpZero'&&copy.p2!==0)){
        const target=relocate(copy.p2);(copy as {p2:number}).p2=target;
      }else if(copy.code==='Found'){(copy as {jump:number}).jump=relocate(copy.jump);}
      else if(copy.code==='NotNull'){(copy as {jump:number}).jump=relocate(copy.jump);}
      ops.push(copy);
    }
    const unmatchedNext=ops.length;ops.push({code:'Next',p1:expanded.sources[rightLevel]!.cursorId,p2:start});
    const done=ops.length;(ops[rewind] as {p2:number}).p2=done;(ops[found] as {jump:number}).jump=unmatchedNext;
    for(let at=copyStart;at<unmatchedNext;at++){const op=ops[at]!;if((op.code==='Rewind'||op.code==='IfNot'||op.code==='Goto'||op.code==='Next'||op.code==='DecrJumpZero'||op.code==='IfPos')&&op.p2===-1)(op as {p2:number}).p2=unmatchedNext;else if((op.code==='Found'||op.code==='NotNull')&&op.jump===-1)(op as {jump:number}).jump=unmatchedNext;}
  }
  const scanEnd=ops.length;
  if(distinctAt!==undefined)(ops[distinctAt] as {jump:number}).jump=nextAt.at(-1)!;for(const jump of jumps)(ops[jump.at] as {p2:number}).p2=nextAt[jump.level]!;
  let halt:number;
  if(orderTerms.length){const sortAt=ops.length;ops.push({code:'SorterSort',p1:sorterCursor,emptyJump:0},{code:'SorterData',p1:sorterCursor,p2:1,count:expanded.result.length});let offsetAt:number|undefined;if(limit?.offset!==undefined){offsetAt=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}ops.push({code:'ResultRow',p1:1,p2:expanded.result.length});const limitAt=limit?ops.length:undefined;if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});const next=ops.length;ops.push({code:'SorterNext',p1:sorterCursor,p2:sortAt+1});halt=ops.length;ops.push({code:'Halt'});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(offsetAt!==undefined)(ops[offsetAt] as {p2:number}).p2=next;if(limitAt!==undefined)(ops[limitAt] as {p2:number}).p2=halt;}else {halt=ops.length;ops.push({code:'Halt'});for(const op of ops)if(op.code==='DecrJumpZero'&&op.p2===0)(op as {p2:number}).p2=halt;}
  for(let level=0;level<rewinds.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;
  const columns=expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function sqlName(text: string): string {
  if (text[0] === "[" && text.at(-1) === "]") return text.slice(1, -1);
  if ((text[0] === '"' || text[0] === "`") && text.at(-1) === text[0]) return text.slice(1, -1).replaceAll(text[0] + text[0], text[0]);
  return text;
}

interface FullScanPlan { readonly loopStart: number; readonly rewindIndex: number }
/** Bounded first-plan translation seam for sqlite3WhereBegin/wherecode.c. */
function sqlite3WhereBegin(ops: Op[], rootPage: number): FullScanPlan {
  ops.push({code:"OpenRead",p1:rootPage}); const rewindIndex=ops.length;
  ops.push({code:"Rewind",p2:0}); return {loopStart:ops.length,rewindIndex};
}
function sqlite3WhereEnd(ops: Op[], plan: FullScanPlan, continueAt: number): void {
  const halt=ops.length+1; ops.push({code:"Next",p2:continueAt},{code:"Halt"});
  (ops[plan.rewindIndex] as {code:"Rewind";p2:number}).p2=halt;
}

function compileJoinedUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
  const first=select.arms[0];if(!first||first.from.items.length<2||first.result.length!==1||select.arms.slice(1).some(arm=>arm.operatorFromPrior!=="union-all"||arm.from.items.length!==0||arm.where!==null||arm.result.length!==1)||select.orderBy.length!==1||select.limit||select.offset)return undefined;
  let identity=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(identity.kind==="collate")identity=identity.value;if(identity.kind!=="literal"||identity.value!==1n)return undefined;
  const leftSelect:SelectNode={...select,result:first.result,from:first.from,where:first.where,hasDistinct:first.hasDistinct,hasGroupBy:first.hasGroupBy,hasHaving:first.hasHaving,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([first])};
  let expanded:ReturnType<typeof expandAndResolveSelect>;try{expanded=expandAndResolveSelect(leftSelect,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  const producer=compileInnerTableSelect(leftSelect,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits),ops:Op[]=[],sorterCursor=Math.max(...expanded.sources.map(source=>source.cursorId))+3,descriptor=expanded.result[0]!.descriptor,coll=sqliteAsciiFold(descriptor.collation) as BuiltinCollation,term=select.orderBy[0]!;
  ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:coll,desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}]})});
  const producerEnd:number[]=[];
  for(const original of producer.ops){let op:Op=original;if("p2" in op&&["Goto","Rewind","IfNot","Next","DecrJumpZero","IfNotZero","IfPos"].includes(op.code))op={...op,p2:op.p2+1} as Op;if("jump" in op&&typeof op.jump==="number")op={...op,jump:op.jump+1} as Op;if(op.code==="ResultRow")ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:op.p1,keyCount:1,payload:op.p1,payloadCount:1});else if(op.code==="Halt"){producerEnd.push(ops.length);ops.push({code:"Goto",p2:0});}else ops.push(op);}
  for(const at of producerEnd)(ops[at] as {p2:number}).p2=ops.length;
  let registers=producer.registers;const allocate=()=>++registers,parameters:ParameterBuilder={maximum:producer.parameters.length,names:producer.parameters.map(parameter=>parameter.name),named:new Map(producer.parameters.flatMap((parameter,index)=>parameter.name?[[parameter.name,index+1] as const]:[]))};
  for(const arm of select.arms.slice(1)){const value=compileExpressionTree(expressionFromReduction(arm.result[0]!.reduction!),ops,allocate,parameters);ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:value,keyCount:1,payload:value,payloadCount:1});}
  const output=allocate(),sortAt=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:output,count:1},{code:"ResultRow",p1:output,p2:1},{code:"SorterNext",p1:sorterCursor,p2:sortAt+1});const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:producer.columns,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function compileSimpleTableCompound(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program {
  if(select.arms.some(arm=>arm.from.items.length!==1||arm.where!==null||arm.result.length!==1||arm.origin!=="select"))throw new JSQLiteError("unsupported","complex compound table arms are not implemented",{unsupportedClassification:"temporary"});
  const resolved=select.arms.map(arm=>{const name=sqlName(arm.from.items[0]!.tableName),table=schema.tables.get(sqliteAsciiFold(name));if(!table)throw new JSQLiteError("sqlite",`no such table: ${name}`,{code:1});if(table.withoutRowid||table.columns.some(c=>c.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});const expression=arm.result[0]!,token=expression.tokens;if(token.length!==1)throw new JSQLiteError("unsupported","compound table expression is not implemented",{unsupportedClassification:"temporary"});const columnName=sqlName(token[0]!.text),column=table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,columnName));if(column<0)throw new JSQLiteError("sqlite",`no such column: ${columnName}`,{code:1});return{arm,table,column,expression};});
  const operators=select.arms.slice(1).map(arm=>arm.operatorFromPrior!),lastSetArm=operators.reduce((last,op,index)=>op==="union-all"?last:index+1,-1);
  const left=resolved[0]!,leftColumn=left.table.columns[left.column]!,outputName=left.expression.alias??leftColumn.name,leftCollation=sqliteAsciiFold(leftColumn.collation??"binary");
  if(leftCollation!=="binary"&&leftCollation!=="nocase"&&leftCollation!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${leftColumn.collation}`,{code:1});
  const orderTerms=select.orderBy.map((term,index)=>{
    let tree=expressionFromReduction(term.expr.reduction!),identity=tree;while(identity.kind==="collate")identity=identity.value;
    let matches=false;
    if(identity.kind==="literal"&&typeof identity.value==="bigint"){
      if(identity.value!==1n)throw new JSQLiteError("sqlite",`${index+1}${index===0?"st":index===1?"nd":index===2?"rd":"th"} ORDER BY term out of range - should be between 1 and 1`,{code:1});matches=true;
    }else if(identity.kind==="column"&&!identity.name.includes(".")){
      const name=sqlName(identity.name);matches=sqliteIdentifierEqual(name,outputName)||resolved.some(item=>item.expression.alias!==undefined&&item.expression.alias!==null&&sqliteIdentifierEqual(item.expression.alias,name));
    }
    if(!matches){const tokens=term.expr.tokens.filter(token=>token.text.toUpperCase()!=="COLLATE"&&sqliteAsciiFold(token.text)!=="binary"&&sqliteAsciiFold(token.text)!=="nocase"&&sqliteAsciiFold(token.text)!=="rtrim").map(token=>token.text).join(" ");matches=resolved.some(item=>item.expression.tokens.map(token=>token.text).join(" ")===tokens);}
    if(!matches)throw new JSQLiteError("sqlite",`${index+1}${index===0?"st":index===1?"nd":index===2?"rd":"th"} ORDER BY term does not match any column in the result set`,{code:1});
    const named=explicitCollation(tree)??leftCollation;if(named!=="binary"&&named!=="nocase"&&named!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${named}`,{code:1});
    return {collation:named as BuiltinCollation,desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false};
  });
  const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let registers=Math.max(1,1+orderTerms.length);const limit=computeLimitRegisters(select,ops,()=>++registers,parameters,true),setCursor=1,auxCursor=2,sorterCursor=3;
  const setKeyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:leftCollation as BuiltinCollation}]});
  const orderKeyInfo=orderTerms.length?new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms}):null;
  if(orderKeyInfo)ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:orderKeyInfo});
  const haltJumps:number[]=[],emitResult=()=>{let skip:number|undefined;if(limit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:1,p2:1});if(limit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}return skip;};
  const emitOrdered=()=>{for(let index=0;index<orderTerms.length;index++)ops.push({code:"Copy",p1:1,p2:2+index});ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:2,keyCount:orderTerms.length,payload:1,payloadCount:1,...(limit?{topN:limit.capacity}:{})});};
  const scan=(item:typeof resolved[number],destination:"result"|"order"|"set"|"aux-set"|"delete")=>{ops.push({code:"OpenRead",p1:item.table.rootPage});const rewind=ops.length;ops.push({code:"Rewind",p2:0});const body=ops.length;ops.push({code:"Column",p1:item.column,p2:1});let skip:number|undefined;if(destination==="result")skip=emitResult();else if(destination==="order")emitOrdered();else if(destination==="set")ops.push({code:"IdxInsert",p1:setCursor,keyStart:1,keyCount:1,replace:true});else if(destination==="delete")ops.push({code:"SetDelete",p1:setCursor,keyStart:1,keyCount:1});else ops.push({code:"IdxInsert",p1:auxCursor,keyStart:1,keyCount:1,replace:true});const next=ops.length;ops.push({code:"Next",p2:body});(ops[rewind] as {p2:number}).p2=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;};
  const destination=orderKeyInfo?"order" as const:"result" as const;
  if(lastSetArm<0){for(const item of resolved)scan(item,destination);}
  else{
    ops.push({code:"OpenEphemeral",p1:setCursor,keyInfo:setKeyInfo},{code:"OpenEphemeral",p1:auxCursor,keyInfo:setKeyInfo});
    for(let index=0;index<=lastSetArm;index++){const operator=resolved[index]!.arm.operatorFromPrior;if(index===0||operator==="union"||operator==="union-all")scan(resolved[index]!,"set");else if(operator==="except")scan(resolved[index]!,"delete");else{scan(resolved[index]!,"aux-set");ops.push({code:"SetRetainIntersection",p1:setCursor,p2:auxCursor},{code:"ClearEphemeral",p1:auxCursor});}}
    ops.push({code:"EphemeralSort",p1:setCursor});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:setCursor,p2:0},{code:"EphemeralData",p1:setCursor,p2:1,count:1});let skip:number|undefined;if(orderKeyInfo)emitOrdered();else skip=emitResult();const next=ops.length;ops.push({code:"EphemeralNext",p1:setCursor,p2:rewind+1});(ops[rewind] as {p2:number}).p2=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;
    for(let index=lastSetArm+1;index<resolved.length;index++)scan(resolved[index]!,destination);
  }
  if(orderKeyInfo){const sortAt=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:1,count:1});const skip=emitResult(),next=ops.length;ops.push({code:"SorterNext",p1:sorterCursor,p2:sortAt+1});(ops[sortAt] as {emptyJump:number}).emptyJump=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;}
  const halt=ops.length;ops.push({code:"Halt"});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;}
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze([Object.freeze({name:outputName,declaredType:leftColumn.declaredType,database:"main",table:left.table.name,origin:leftColumn.name})]),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

/** Initial resolve.c/select.c-shaped single rowid-table full-scan compiler. */
export function compileTableSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS): Program {
  if(select.hasCompound){rejectUnsupportedSelectClauses(select, true);return compileJoinedUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits)??compileSimpleTableCompound(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);}
  let expanded;
  try { expanded=expandAndResolveSelect(select,schema); }
  catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  rejectUnsupportedSelectClauses(select, true);
  if (select.from.items.length > 1) return compileInnerTableSelect(select,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
  if (select.from.items.length !== 1) throw new JSQLiteError("unsupported", "joins and complex FROM clauses are not implemented", { unsupportedClassification: "temporary" });
  const tableName = sqlName(select.from.items[0]!.tableName), folded = sqliteAsciiFold(tableName);
  const table = schema.tables.get(folded);
  if (!table) {
    if (schema.views.has(folded)) throw new JSQLiteError("unsupported", "views are not implemented", { unsupportedClassification: "temporary" });
    throw new JSQLiteError("sqlite", `no such table: ${tableName}`, { code: 1 });
  }
  if (table.withoutRowid || table.columns.some(c => c.generatedExpr)) throw new JSQLiteError("unsupported", "this table storage shape is not implemented", { unsupportedClassification: "temporary" });
  const resolve = (tokens: readonly { text: string }[]): number => {
    let name: string;
    if (tokens.length === 1) name = sqlName(tokens[0]!.text);
    else if (tokens.length === 3 && tokens[1]!.text === "." && sqliteIdentifierEqual(sqlName(tokens[0]!.text), select.from.items[0]!.alias??table.name)) name = sqlName(tokens[2]!.text);
    else throw new JSQLiteError("unsupported", "table expression is not implemented", { unsupportedClassification: "temporary" });
    const at = table.columns.findIndex(c => sqliteIdentifierEqual(c.name, name));
    if(at<0&&!table.withoutRowid&&['rowid','_rowid_','oid'].some(x=>sqliteIdentifierEqual(x,name))&&!table.columns.some(c=>sqliteIdentifierEqual(c.name,name)))return -1;
    if (at < 0) throw new JSQLiteError("sqlite", `no such column: ${name}`, { code: 1 });
    return at;
  };
  const resolveExpression=(expression:SelectNode["result"][number],allowAlias=true):Expression=>{
    const assign=(e:Expression):Expression=>{
      if(e.kind==="column"){
        try{e.index=resolve([{text:e.name}]);}
        catch(error){const aliases=allowAlias&&!e.name.includes('.')?select.result.filter(item=>item.alias&&sqliteIdentifierEqual(item.alias,e.name)):[];if(aliases[0])return resolveExpression(aliases[0],false);throw error;}
        if(e.index<0){e.affinity='integer';e.collation='binary';return e;}
        const name=sqliteAsciiFold(table.columns[e.index]!.collation??"binary");if(name!=="binary"&&name!=="nocase"&&name!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${table.columns[e.index]!.collation}`,{code:1});e.collation=name;e.affinity=affinityOf(table.columns[e.index]!.declaredType??"");return e;
      }
      if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=assign(e.value);else if(e.kind==="binary"){e.left=assign(e.left);e.right=assign(e.right)}else if(e.kind==="call"||e.kind==="aggregate")e.args=e.args.map(assign);else if(e.kind==="case"){if(e.operand)e.operand=assign(e.operand);e.pairs=e.pairs.map(x=>[assign(x[0]),assign(x[1])]);if(e.otherwise)e.otherwise=assign(e.otherwise)}return e;
    };
    return assign(expressionFromReduction(expression.reduction!));
  };
  // Resolve functions (including arity failures) before rejecting later planning
  // features, as resolve.c does during SELECT preparation.
  select.result.filter(x=>x.reduction&&!expanded.result.some(item=>item.expression===x&&item.columnIndex!==null)).forEach(x=>resolveExpression(x));
  const projected: { column?: number; rowid?:boolean; expression?:Expression; name: string }[] = [];
  for (const item of expanded.result) {
    const expression=item.expression;
    if(item.resolution==='coalesce')throw new JSQLiteError("unsupported","FULL JOIN merged-column execution is not implemented",{unsupportedClassification:"temporary"});
    if(item.columnIndex!==null){if(item.columnIndex<0)projected.push({rowid:true,name:item.name});else projected.push({column:item.columnIndex,name:item.name});}
    else { try { const column = resolve(expression.tokens); projected.push({ column, name: expression.alias ?? table.columns[column]!.name }); }
    catch(error){if(!expression.reduction)throw error;projected.push({expression:resolveExpression(expression),name:expressionName(expression)});} }
  }
  let registers = projected.length;
  const tokens=select.tokens,orderAt=tokens.findIndex(t=>t.text.toUpperCase()==="ORDER"),limitAt=tokens.findIndex(t=>t.text.toUpperCase()==="LIMIT");
  // resolve.c:resolveOrderGroupBy walks every ExprList item. Preserve that
  // cardinality here so select.c:pushOntoSorter receives a complete key.
  const orderTerms:{expression:Expression;resultIndex?:number;descending:boolean;nullsLarge:boolean}[]=[];
  if(orderAt>=0){
    for(let termNumber=0;termNumber<select.orderBy.length;termNumber++){
      const term=select.orderBy[termNumber]!,leaf=term.expr.tokens;
      const parsedOrderExpression=expressionFromReduction(term.expr.reduction!);
      // resolve.c:resolveOrderGroupBy calls sqlite3ExprSkipCollateAndLikely()
      // before testing aliases and ordinals. resolveAlias() then substitutes
      // the result expression below the existing TK_COLLATE wrapper.
      let orderIdentity=parsedOrderExpression;
      while(orderIdentity.kind==="collate")orderIdentity=orderIdentity.value;
      let resultIndex=-1;
      if(orderIdentity.kind==="literal"&&typeof orderIdentity.value==="bigint"){
        const ordinal=orderIdentity.value;
        if(ordinal<1n||ordinal>BigInt(projected.length))throw new JSQLiteError("sqlite",`${termNumber+1}${termNumber===0?"st":termNumber===1?"nd":termNumber===2?"rd":"th"} ORDER BY term out of range - should be between 1 and ${projected.length}`,{code:1});
        resultIndex=Number(ordinal-1n);
      }else if(orderIdentity.kind==="column"&&!orderIdentity.name.includes("."))resultIndex=projected.findIndex(x=>sqliteIdentifierEqual(x.name,sqlName(orderIdentity.name)));
      // resolve.c also reuses an identical result expression before ordinary
      // name resolution. Token identity is sufficient for this generated slice.
      if(resultIndex<0)resultIndex=select.result.findIndex(x=>x.tokens.map(t=>t.text).join(" ")===leaf.map(t=>t.text).join(" "));
      let expression:Expression;
      if(resultIndex>=0){
        const resultExpression=projected[resultIndex]!.expression??resolveExpression(select.result[resultIndex]!);
        const substitute=(node:Expression):Expression=>node.kind==="collate"?{...node,value:substitute(node.value)}:resultExpression;
        expression=substitute(parsedOrderExpression);
      }else expression=resolveExpression(term.expr);
      const nullsLarge=term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false;
      orderTerms.push({expression,...(resultIndex>=0?{resultIndex}:{}),descending:term.descending,nullsLarge});
    }
  }
  const hasLimit=select.limit!==null;
  const ops: Op[] = [];
  const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};
  const limit=computeLimitRegisters(select,ops,()=>++registers,parameters);
  const sorterCursor=1,distinctCursor=2,keyInfo=orderTerms.length===0?null:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))});
  ops.push({code:"OpenRead",p1:table.rootPage});
  if(keyInfo)ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo});
  if(select.hasDistinct)ops.push({code:"OpenEphemeral",p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:projected.length,keyFieldCount:projected.length,terms:projected.map(x=>({collation:x.expression===undefined?sqliteAsciiFold(table.columns[x.column!]!.collation??"binary") as BuiltinCollation:collation(x.expression)}))})});
  const rewindIndex=ops.length;ops.push({code:"Rewind",p2:0});const scan:FullScanPlan={rewindIndex,loopStart:ops.length};
  let ifNotIndex: number | undefined;
  if (select.where) {
    if (!select.where.reduction) throw new JSQLiteError("unsupported", "WHERE predicate is not implemented", { unsupportedClassification: "temporary" });
    const predicate=resolveExpression(select.where), output=compileExpressionTree(predicate,ops,()=>++registers);
    ifNotIndex=ops.length; ops.push({code:"IfNot",p1:output,p2:0});
  }
  const body=ops.length;
  projected.forEach((x,i)=>{if(x.rowid)ops.push({code:"Rowid",p2:i+1});else if(x.column===undefined){const source=compileExpressionTree(x.expression!,ops,()=>++registers);ops.push({code:"Copy",p1:source,p2:i+1})}else ops.push({code:"Column",p1:x.column,p2:i+1})});
  let distinctFound: number | undefined;
  if(select.hasDistinct){distinctFound=ops.length;ops.push({code:"Found",p1:distinctCursor,keyStart:1,keyCount:projected.length,jump:0},{code:"IdxInsert",p1:distinctCursor,keyStart:1,keyCount:projected.length});}
  if(keyInfo){const keyStart=registers+1;registers+=orderTerms.length;orderTerms.forEach((term,i)=>{if(term.resultIndex!==undefined)ops.push({code:"Copy",p1:term.resultIndex+1,p2:keyStart+i});else{const source=compileExpressionTree(term.expression,ops,()=>++registers);ops.push({code:"Copy",p1:source,p2:keyStart+i})}});if(limit)ops.push({code:"IfNotZero",p1:limit.combined,p2:ops.length+1});ops.push({code:"SorterInsert",p1:sorterCursor,keyStart,keyCount:orderTerms.length,payload:1,payloadCount:projected.length,...(limit?{topN:limit.capacity}:{})});}
  else ops.push({code:"ResultRow",p1:1,p2:projected.length});
  sqlite3WhereEnd(ops,scan,select.where?scan.loopStart:body);
  if(keyInfo){const sortAt=ops.length-1,tail:Op[]=[{code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:1,count:projected.length}];if(limit?.offset!==undefined)tail.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});tail.push({code:"ResultRow",p1:1,p2:projected.length});if(limit)tail.push({code:"DecrJumpZero",p1:limit.count,p2:0});const nextIndex=sortAt+tail.length;tail.push({code:"SorterNext",p1:sorterCursor,p2:sortAt+1});(tail[0] as {emptyJump:number}).emptyJump=nextIndex+1;for(const op of tail){if(op.code==="IfPos") (op as {p2:number}).p2=nextIndex;if(op.code==="DecrJumpZero") (op as {p2:number}).p2=nextIndex+1;}ops.splice(sortAt,0,...tail);}else if(limit){const resultAt=(()=>{for(let i=ops.length-1;i>=0;i--)if(ops[i]!.code==="ResultRow")return i;return -1})();if(limit.offset!==undefined)ops.splice(resultAt,0,{code:"IfPos",p1:limit.offset,p2:0,p3:1});const adjusted=(()=>{for(let i=ops.length-1;i>=0;i--)if(ops[i]!.code==="ResultRow")return i;return -1})();ops.splice(adjusted+1,0,{code:"DecrJumpZero",p1:limit.count,p2:0});}
  // Patch scan-continuation labels only after the result tail has its final
  // layout. Duplicate and filtered rows must bypass OFFSET/result/LIMIT work.
  const scanContinue=ops.findIndex((op,index)=>index>=scan.loopStart&&op.code==="Next");
  if(scanContinue<0)throw new Error("table scan has no continuation target");
  if(distinctFound!==undefined)(ops[distinctFound] as {jump:number}).jump=scanContinue;
  if(ifNotIndex!==undefined) (ops[ifNotIndex] as {code:"IfNot";p1:number;p2:number}).p2=scanContinue;
  if(!keyInfo&&limit){
    const halt=ops.findIndex((op,index)=>index>scanContinue&&op.code==="Halt");
    if(halt<0)throw new Error("LIMIT program has no halt target");
    const offset=ops.find(op=>op.code==="IfPos") as Extract<Op,{code:"IfPos"}>|undefined;
    if(offset) (offset as {p2:number}).p2=scanContinue;
    const decrement=ops.find(op=>op.code==="DecrJumpZero") as Extract<Op,{code:"DecrJumpZero"}>|undefined;
    if(!decrement)throw new Error("LIMIT program has no decrement operation");
    (decrement as {p2:number}).p2=halt;
  }
  if(limit){let halt=ops.length-1;while(halt>=0&&ops[halt]!.code!=="Halt")halt--;if(halt<0)throw new Error("LIMIT program has no halt target");(ops[limit.ifZero] as {p2:number}).p2=halt;}
  const columns=expanded.result.map((x,i)=>Object.freeze({name:x.resolution==='expression'?projected[i]!.name:x.descriptor.name,declaredType:x.descriptor.declaredType,database:x.descriptor.database,table:x.descriptor.table,origin:x.descriptor.origin}));
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze([]),table,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function sameExpression(a:Expression,b:Expression):boolean {
 if(a.kind!==b.kind)return false;
 switch(a.kind){
  case "variable": return a.spelling===(b as typeof a).spelling;
  case "literal": return typeof a.value===typeof (b as typeof a).value&&String(a.value)===String((b as typeof a).value);
  case "column": return sqliteIdentifierEqual(a.name,(b as typeof a).name);
  case "unary": return a.op===(b as typeof a).op&&sameExpression(a.value,(b as typeof a).value);
  case "binary": return a.op===(b as typeof a).op&&sameExpression(a.left,(b as typeof a).left)&&sameExpression(a.right,(b as typeof a).right);
  case "collate": return a.collation===(b as typeof a).collation&&sameExpression(a.value,(b as typeof a).value);
  case "cast": return a.affinity===(b as typeof a).affinity&&sameExpression(a.value,(b as typeof a).value);
  case "call": case "aggregate": {const x=b as typeof a;return a.name===x.name&&a.args.length===x.args.length&&a.args.every((arg,i)=>sameExpression(arg,x.args[i]!));}
  case "case": {const x=b as typeof a;return (a.operand===null?x.operand===null:x.operand!==null&&sameExpression(a.operand,x.operand))&&a.pairs.length===x.pairs.length&&a.pairs.every((pair,i)=>sameExpression(pair[0],x.pairs[i]![0])&&sameExpression(pair[1],x.pairs[i]![1]))&&(a.otherwise===null?x.otherwise===null:x.otherwise!==null&&sameExpression(a.otherwise,x.otherwise));}
  case "mem": case "register": return false;
 }
}
function reductionHas(select:SelectNode,part:string):boolean {const visit=(node:LemonValue<SqlToken>):boolean=>node.kind==="reduction"&&(node.signature.toLowerCase().includes(part.toLowerCase())||node.children.some(visit));const roots=[...select.result,...select.groupBy,...select.orderBy.map(x=>x.expr),...(select.having?[select.having]:[])];return roots.some(x=>x.reduction!==undefined&&visit(x.reduction));}
function aggregateOrderResultIndex(select:SelectNode,term:SelectNode["orderBy"][number]):number {
 const order=expressionFromReduction(term.expr.reduction!),identity=order.kind==="collate"?order.value:order;
 if(identity.kind==="literal"&&typeof identity.value==="bigint"){const at=Number(identity.value)-1;return at>=0&&at<select.result.length?at:-1;}
 if(identity.kind==="column"&&!identity.name.includes(".")){const at=select.result.findIndex(item=>item.alias!==undefined&&sqliteIdentifierEqual(item.alias,identity.name));if(at>=0)return at;}
 return select.result.findIndex(item=>sameExpression(identity,expressionFromReduction(item.reduction!)));
}
function simpleGroupShape(select:SelectNode):boolean {
 if(!select.hasGroupBy||select.hasCompound||select.hasSubquery||select.from.items.length===0||select.from.items.some((item,index)=>index>0&&(item.joinFromLeft.left||item.joinFromLeft.right||item.joinFromLeft.error||item.using!==null))||reductionHas(select,"over_clause ::= OVER"))return false;
 try {
  const groups=select.groupBy.map(x=>expressionFromReduction(x.reduction!));
  const results=select.result.map(x=>expressionFromReduction(x.reduction!));
  return !select.hasOrderBy||select.orderBy.every(term=>{if(aggregateOrderResultIndex(select,term)>=0)return true;const order=expressionFromReduction(term.expr.reduction!);return !term.descending&&term.nulls===null&&groups.some(group=>sameExpression(order,group)||(order.kind==="collate"&&sameExpression(order.value,group)));});
 } catch { return false; }
}
export function aggregateShapeSupported(select:SelectNode):boolean{return simpleGroupShape(select)||!(select.hasCompound||select.hasGroupBy||select.hasDistinct||select.hasOrderBy||select.limit||select.offset||select.hasSubquery||select.from.items.length>1||reductionHas(select,"over_clause ::= OVER"));}

/** select.c:sqlite3Select aggregate-without-GROUP tranche. AggInfo entries own
 * accumulator registers; ordinary expression lowering consumes AggFinal values. */
export function compileAggregateSelect(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS):Program {
 if(select.hasCompound){
  const unionAll=select.arms.slice(1).every(arm=>arm.operatorFromPrior==="union-all"),order=select.orderBy[0];
  if(!unionAll||select.orderBy.length!==1||select.limit||select.offset||select.hasDistinct)throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
  let orderTree=expressionFromReduction(order!.expr.reduction!);while(orderTree.kind==="collate")orderTree=orderTree.value;
  if(orderTree.kind!=="literal"||orderTree.value!==1n)throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
  const armPrograms=select.arms.map(arm=>{const single:SelectNode={...select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};return compileAggregateSelect(single,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);});
  if(armPrograms.some(program=>program.parameters.length))throw new JSQLiteError("unsupported","parameters in aggregate compounds are not implemented",{unsupportedClassification:"temporary"});const width=armPrograms[0]!.columns.length;if(armPrograms.some(program=>program.columns.length!==width))throw new JSQLiteError("sqlite","SELECTs to the left and right of UNION ALL do not have the same number of result columns",{code:1});
  const sorter=20,ops:Op[]=[{code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:"binary",desc:order!.descending,nullsLarge:order!.nulls==="last"?!order!.descending:order!.nulls==="first"?order!.descending:false}]})}];let registers=Math.max(...armPrograms.map(program=>program.registers));
  for(const program of armPrograms){const base=ops.length,endJumps:number[]=[];for(const original of program.ops){if(original.code==="Halt"){endJumps.push(ops.length);ops.push({code:"Goto",p2:0});continue;}if(original.code==="ResultRow"){ops.push({code:"SorterInsert",p1:sorter,keyStart:original.p1,keyCount:1,payload:original.p1,payloadCount:original.p2});continue;}let op:Op=original;if("p2" in op&&["Goto","Rewind","IfNot","Next","DecrJumpZero","IfNotZero","IfPos","SorterNext"].includes(op.code))op={...op,p2:op.p2+base} as Op;if("jump" in op&&typeof op.jump==="number")op={...op,jump:op.jump+base} as Op;if(op.code==="SorterSort")op={...op,emptyJump:op.emptyJump+base};ops.push(op);}for(const at of endJumps)(ops[at] as {p2:number}).p2=ops.length;}
  const output=++registers,sortAt=ops.length;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:output,count:width},{code:"ResultRow",p1:output,p2:width},{code:"SorterNext",p1:sorter,p2:sortAt+1});const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;return Object.freeze({ops:Object.freeze(ops),registers,columns:armPrograms[0]!.columns,parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
 }
 if(!aggregateShapeSupported(select))throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
 let table:TableNode|undefined;
 const aggregateSources=select.from.items.map((item,cursor)=>{const name=sqlName(item.tableName),found=schema.tables.get(sqliteAsciiFold(name));if(!found)throw new JSQLiteError("sqlite",`no such table: ${name}`,{code:1});if(found.withoutRowid||found.columns.some(c=>c.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});return{item,table:found,cursor:select.from.items.length===1?0:cursor+3,base:0}});let sourceWidth=0;for(const source of aggregateSources){source.base=sourceWidth;sourceWidth+=source.table.columns.length;}if(aggregateSources.length===1)table=aggregateSources[0]!.table;
 const resolve=(e:Expression):Expression=>{if(e.kind==="column"){if(!aggregateSources.length)throw new JSQLiteError("sqlite",`no such column: ${e.name}`,{code:1});const parts=e.name.split('.').map(sqlName),name=parts.at(-1)!,candidates=aggregateSources.flatMap(source=>{if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,source.item.alias??source.table.name))return[];const at=source.table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,name));return at<0?[]:[{source,at}]});if(candidates.length!==1)throw new JSQLiteError("sqlite",candidates.length?`ambiguous column name: ${e.name}`:`no such column: ${e.name}`,{code:1});const {source,at}=candidates[0]!;e.index=at;e.cursor=source.cursor;e.payloadIndex=source.base+at;e.affinity=affinityOf(source.table.columns[at]!.declaredType??"");const c=sqliteAsciiFold(source.table.columns[at]!.collation??"binary");if(c!=="binary"&&c!=="nocase"&&c!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${c}`,{code:1});e.collation=c;return e}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=resolve(e.value);else if(e.kind==="binary"){e.left=resolve(e.left);e.right=resolve(e.right)}else if(e.kind==="call")e.args=e.args.map(resolve);else if(e.kind==="aggregate"){e.args=e.args.map(resolve);if(e.filter)e.filter=resolve(e.filter);e.orderBy=e.orderBy.map(term=>({...term,expression:resolve(term.expression)}));}else if(e.kind==="case"){if(e.operand)e.operand=resolve(e.operand);e.pairs=e.pairs.map(([a,b])=>[resolve(a),resolve(b)]);if(e.otherwise)e.otherwise=resolve(e.otherwise)}return e};
 const rawTrees=select.result.map(x=>expressionFromReduction(x.reduction!));
 // resolve.c resolves aggregate arguments under NC_InAggFunc and rejects a
 // second aggregate before select.c/AggInfo lowering. Keep that diagnostic at
 // prepare time instead of passing an execution-only aggregate to scalar code.
 const nestedAggregate=(e:Expression,inside=false):string|null=>{if(e.kind==="aggregate"){if(inside)return e.name;for(const arg of e.args){const nested=nestedAggregate(arg,true);if(nested)return nested;}if(e.filter){const nested=nestedAggregate(e.filter,true);if(nested)return nested;}for(const term of e.orderBy){const nested=nestedAggregate(term.expression,true);if(nested)return nested;}return null;}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")return nestedAggregate(e.value,inside);if(e.kind==="binary")return nestedAggregate(e.left,inside)??nestedAggregate(e.right,inside);if(e.kind==="call"){for(const arg of e.args){const nested=nestedAggregate(arg,inside);if(nested)return nested;}return null;}if(e.kind==="case"){if(e.operand){const nested=nestedAggregate(e.operand,inside);if(nested)return nested;}for(const [when,then] of e.pairs){const nested=nestedAggregate(when,inside)??nestedAggregate(then,inside);if(nested)return nested;}return e.otherwise?nestedAggregate(e.otherwise,inside):null;}return null};
 for(const tree of rawTrees){const nested=nestedAggregate(tree);if(nested)throw new JSQLiteError("sqlite",`misuse of aggregate function ${nested}()`,{code:1});}
 const whereTree=select.where?expressionFromReduction(select.where.reduction!):null;
 if(whereTree){const aggregate=nestedAggregate(whereTree,true);if(aggregate)throw new JSQLiteError("sqlite",`misuse of aggregate: ${aggregate}()`,{code:1});}
 const aliasExpression=(e:Expression):Expression=>{if(e.kind==="column"&&!e.name.includes(".")){const source=aggregateSources.some(item=>item.table.columns.some(column=>sqliteIdentifierEqual(column.name,e.name)));if(!source){const at=select.result.findIndex(item=>item.alias!==undefined&&sqliteIdentifierEqual(item.alias,e.name));if(at>=0)return expressionFromReduction(select.result[at]!.reduction!)}}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=aliasExpression(e.value);else if(e.kind==="binary"){e.left=aliasExpression(e.left);e.right=aliasExpression(e.right)}else if(e.kind==="call")e.args=e.args.map(aliasExpression);else if(e.kind==="aggregate"){e.args=e.args.map(aliasExpression);if(e.filter)e.filter=aliasExpression(e.filter);e.orderBy=e.orderBy.map(term=>({...term,expression:aliasExpression(term.expression)}));}else if(e.kind==="case"){if(e.operand)e.operand=aliasExpression(e.operand);e.pairs=e.pairs.map(([a,b])=>[aliasExpression(a),aliasExpression(b)]);if(e.otherwise)e.otherwise=aliasExpression(e.otherwise)}return e};
 const trees=rawTrees.map(resolve),where=whereTree?resolve(whereTree):null,groups=select.groupBy.map(x=>resolve(expressionFromReduction(x.reduction!))),havingTree=select.having?resolve(aliasExpression(expressionFromReduction(select.having.reduction!))):null;
 const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let registers=select.result.length,allocate=()=>++registers;
 type Entry={name:string;args:Expression[];collation:BuiltinCollation;register:number;distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[];distinctCursor?:number;orderCursor?:number};const entries:Entry[]=[];
 const lower=(e:Expression,inside=false):Expression=>{if(e.kind==="aggregate"){if(inside)throw new JSQLiteError("sqlite","misuse of aggregate function",{code:1});const register=allocate();entries.push({name:e.name,args:e.args,collation:e.args[0]?collation(e.args[0]):e.collation,register,distinct:e.distinct,filter:e.filter,orderBy:e.orderBy});return{kind:"register",index:register}}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=lower(e.value,inside);else if(e.kind==="binary"){e.left=lower(e.left,inside);e.right=lower(e.right,inside)}else if(e.kind==="call")e.args=e.args.map(x=>lower(x,inside));else if(e.kind==="case"){if(e.operand)e.operand=lower(e.operand,inside);e.pairs=e.pairs.map(([a,b])=>[lower(a,inside),lower(b,inside)]);if(e.otherwise)e.otherwise=lower(e.otherwise,inside)}return e};
 const outputs=trees.map(x=>lower(x)),having=havingTree?lower(havingTree):null;
 const groupLimit=select.hasGroupBy?computeLimitRegisters(select,ops,allocate,parameters):undefined;
 const resolvedOrderResultIndices=select.hasGroupBy&&select.hasOrderBy?select.orderBy.map(term=>aggregateOrderResultIndex(select,term)):[];
 const resultSorter=resolvedOrderResultIndices.length>0&&resolvedOrderResultIndices.every(index=>index>=0)&&select.orderBy.some((term,index)=>term.descending||term.nulls!==null||!groups.some(group=>sameExpression(rawTrees[resolvedOrderResultIndices[index]!]!,group)))?2:undefined;
 const orderResultIndices=resultSorter!==undefined?resolvedOrderResultIndices:[];
 if(resultSorter!==undefined)ops.push({code:"SorterOpen",p1:resultSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:select.orderBy.length,keyFieldCount:select.orderBy.length,terms:select.orderBy.map((term,index)=>({collation:collation(outputs[orderResultIndices[index]!]!),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}))})});
 const distinctResultCursor=select.hasDistinct?Math.max(3,...aggregateSources.map(source=>source.cursor))+3:undefined;if(distinctResultCursor!==undefined)ops.push({code:"OpenEphemeral",p1:distinctResultCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:outputs.length,keyFieldCount:outputs.length,terms:outputs.map(output=>({collation:collation(output)}))})});
 let modifierCursor=Math.max(distinctResultCursor??0,2,...aggregateSources.map(source=>source.cursor))+10;for(const entry of entries){if(entry.distinct){entry.distinctCursor=modifierCursor++;ops.push({code:"OpenEphemeral",p1:entry.distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.args.length,keyFieldCount:entry.args.length,terms:entry.args.map(arg=>({collation:collation(arg)}))})});}if(entry.orderBy.length){entry.orderCursor=modifierCursor++;ops.push({code:"SorterOpen",p1:entry.orderCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.orderBy.length,keyFieldCount:entry.orderBy.length,terms:entry.orderBy.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))})});}}
 const groupLimitJumps:number[]=[];
 const emitSteps=(changed?:number)=>{for(const entry of entries){let filterJump:number|undefined;if(entry.filter){const test=compileExpressionTree(entry.filter,ops,allocate,parameters);filterJump=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const args=entry.args.map(arg=>compileExpressionTree(arg,ops,allocate,parameters));let duplicate:number|undefined;if(entry.distinctCursor!==undefined){const distinctStart=allocate();registers+=args.length-1;args.forEach((arg,index)=>ops.push({code:"Copy",p1:arg,p2:distinctStart+index}));duplicate=ops.length;ops.push({code:"Found",p1:entry.distinctCursor,keyStart:distinctStart,keyCount:args.length,jump:0},{code:"IdxInsert",p1:entry.distinctCursor,keyStart:distinctStart,keyCount:args.length});}if(entry.orderCursor!==undefined){const keyStart=allocate();registers+=entry.orderBy.length-1;entry.orderBy.forEach((term,index)=>{const value=compileExpressionTree(term.expression,ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:keyStart+index});});const payload=allocate();registers+=args.length-1;args.forEach((arg,index)=>ops.push({code:"Copy",p1:arg,p2:payload+index}));ops.push({code:"SorterInsert",p1:entry.orderCursor,keyStart,keyCount:entry.orderBy.length,payload,payloadCount:args.length});}else ops.push({code:"AggStep",name:entry.name,args,p2:entry.register,collation:entry.collation,...((entry.name==="min"||entry.name==="max")&&changed!==undefined?{changed}: {})});const end=ops.length;if(filterJump!==undefined)(ops[filterJump] as {p2:number}).p2=end;if(duplicate!==undefined)(ops[duplicate] as {jump:number}).jump=end;}};
 const emitFinals=()=>{for(const entry of entries){if(entry.orderCursor!==undefined){const args=allocate();registers+=entry.args.length-1;const sort=ops.length;ops.push({code:"SorterSort",p1:entry.orderCursor,emptyJump:0},{code:"SorterData",p1:entry.orderCursor,p2:args,count:entry.args.length},{code:"AggStep",name:entry.name,args:Array.from({length:entry.args.length},(_,i)=>args+i),p2:entry.register,collation:entry.collation},{code:"SorterNext",p1:entry.orderCursor,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;}ops.push({code:"AggFinal",name:entry.name,p1:entry.register});}};
 if(select.hasGroupBy){
  const width=sourceWidth,keyCount=groups.length,sorter=1,sortedBase=allocate(),savedBase=sortedBase+keyCount+width;registers=savedBase+keyCount+width-1;
  const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:keyCount,keyFieldCount:keyCount,terms:groups.map(group=>({collation:collation(group)}))});
  ops.push({code:"SorterOpen",p1:sorter,keyInfo});aggregateSources.forEach(source=>ops.push({code:"OpenRead",p1:source.table.rootPage,p2:source.cursor}));const rewinds:number[]=[],bodies:number[]=[],predicateJumps:{at:number;level:number}[]=[];for(let level=0;level<aggregateSources.length;level++){rewinds[level]=ops.length;ops.push({code:"Rewind",p1:aggregateSources[level]!.cursor,p2:0});bodies[level]=ops.length;const on=aggregateSources[level]!.item.on;if(on){const test=compileExpressionTree(resolve(expressionFromReduction(on.reduction!)),ops,allocate,parameters);const at=ops.length;ops.push({code:"IfNot",p1:test,p2:0});predicateJumps.push({at,level});}}
  if(where){const test=compileExpressionTree(where,ops,allocate,parameters);const at=ops.length;ops.push({code:"IfNot",p1:test,p2:0});predicateJumps.push({at,level:aggregateSources.length-1});}
  const keys=groups.map(group=>compileExpressionTree(group,ops,allocate,parameters)),combined=registers+1;registers+=keyCount+width;keys.forEach((value,i)=>ops.push({code:"Copy",p1:value,p2:combined+i}));for(const source of aggregateSources)for(let i=0;i<source.table.columns.length;i++)ops.push({code:"Column",p1:i,p2:combined+keyCount+source.base+i,p3:source.cursor});ops.push({code:"SorterInsert",p1:sorter,keyStart:combined,keyCount,payload:combined,payloadCount:keyCount+width});
  const nextAt:number[]=[];for(let level=aggregateSources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:"Next",p1:aggregateSources[level]!.cursor,p2:bodies[level]!});}const sortAt=ops.length;for(let level=0;level<aggregateSources.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=level===0?sortAt:nextAt[level-1]!;for(const jump of predicateJumps)(ops[jump.at] as {p2:number}).p2=nextAt[jump.level]!;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:sortedBase,count:keyCount+width});
  for(let i=0;i<keyCount+width;i++)ops.push({code:"Copy",p1:sortedBase+i,p2:savedBase+i});
  const accumulatorRegisters=entries.map(x=>x.register);ops.push({code:"AggReset",registers:accumulatorRegisters});
  const rowColumns=(e:Expression):Expression=>{if(e.kind==="column")return{kind:"register",index:sortedBase+keyCount+(e.payloadIndex??e.index)};if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=rowColumns(e.value);else if(e.kind==="binary"){e.left=rowColumns(e.left);e.right=rowColumns(e.right)}else if(e.kind==="call"||e.kind==="aggregate")e.args=e.args.map(rowColumns);else if(e.kind==="case"){if(e.operand)e.operand=rowColumns(e.operand);e.pairs=e.pairs.map(([a,b])=>[rowColumns(a),rowColumns(b)]);if(e.otherwise)e.otherwise=rowColumns(e.otherwise)}return e};
  entries.forEach(entry=>{entry.args=entry.args.map(rowColumns);if(entry.filter)entry.filter=rowColumns(entry.filter);entry.orderBy=entry.orderBy.map(term=>({...term,expression:rowColumns(term.expression)}));});if(having)rowColumns(having);const savedColumns=(e:Expression):Expression=>{if(e.kind==="register"&&e.index>=sortedBase+keyCount&&e.index<sortedBase+keyCount+width){const column=e.index-sortedBase-keyCount,group=groups.findIndex(g=>g.kind==="column"&&g.index===column);return{kind:"register",index:group>=0?savedBase+group:savedBase+keyCount+column}};if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=savedColumns(e.value);else if(e.kind==="binary"){e.left=savedColumns(e.left);e.right=savedColumns(e.right)}else if(e.kind==="call")e.args=e.args.map(savedColumns);else if(e.kind==="case"){if(e.operand)e.operand=savedColumns(e.operand);e.pairs=e.pairs.map(([a,b])=>[savedColumns(a),savedColumns(b)]);if(e.otherwise)e.otherwise=savedColumns(e.otherwise)}return e};outputs.forEach((x,i)=>outputs[i]=savedColumns(rowColumns(x)));if(having)savedColumns(having);const change=entries.filter(e=>e.name==="min"||e.name==="max").length===1?allocate():undefined;const stepAt=ops.length;emitSteps(change);if(change!==undefined){const unchanged=ops.length;ops.push({code:"IfNot",p1:change,p2:0});for(let i=0;i<width;i++)ops.push({code:"Copy",p1:sortedBase+keyCount+i,p2:savedBase+keyCount+i});(ops[unchanged] as {p2:number}).p2=ops.length}const advance=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:advance+2},{code:"Goto",p2:0},{code:"SorterData",p1:sorter,p2:sortedBase,count:keyCount+width});ops.push({code:"CompareGroup",left:sortedBase,right:savedBase,count:keyCount,keyInfo,jump:stepAt});
  const emitGroup=()=>{emitFinals();let reject=-1;if(having){const test=compileExpressionTree(having,ops,allocate,parameters);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0})}outputs.forEach((tree,index)=>{const value=compileExpressionTree(tree,ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:index+1})});let duplicate=-1;if(distinctResultCursor!==undefined){duplicate=ops.length;ops.push({code:"Found",p1:distinctResultCursor,keyStart:1,keyCount:outputs.length,jump:0},{code:"IdxInsert",p1:distinctResultCursor,keyStart:1,keyCount:outputs.length});}if(resultSorter!==undefined){const keyStart=allocate();registers+=orderResultIndices.length-1;orderResultIndices.forEach((resultIndex,index)=>ops.push({code:"Copy",p1:resultIndex+1,p2:keyStart+index}));ops.push({code:"SorterInsert",p1:resultSorter,keyStart,keyCount:orderResultIndices.length,payload:1,payloadCount:outputs.length,...(groupLimit?{topN:groupLimit.capacity}:{})});}else{let offsetAt:number|undefined;if(groupLimit?.offset!==undefined){offsetAt=ops.length;ops.push({code:"IfPos",p1:groupLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:1,p2:outputs.length});if(groupLimit){groupLimitJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:groupLimit.count,p2:0});}if(offsetAt!==undefined)(ops[offsetAt] as {p2:number}).p2=ops.length;}if(duplicate>=0)(ops[duplicate] as {jump:number}).jump=ops.length;if(reject>=0)(ops[reject] as {p2:number}).p2=ops.length;};
  emitGroup();ops.push({code:"AggReset",registers:accumulatorRegisters});for(const entry of entries){if(entry.distinctCursor!==undefined)ops.push({code:"ClearEphemeral",p1:entry.distinctCursor});if(entry.orderCursor!==undefined)ops.push({code:"ClearSorter",p1:entry.orderCursor});}for(let i=0;i<keyCount+width;i++)ops.push({code:"Copy",p1:sortedBase+i,p2:savedBase+i});ops.push({code:"Goto",p2:stepAt});const finalAt=ops.length;(ops[advance+1] as {p2:number}).p2=finalAt;emitGroup();let resultSortAt:number|undefined,resultOffsetAt:number|undefined,resultLimitAt:number|undefined;if(resultSorter!==undefined){resultSortAt=ops.length;ops.push({code:"SorterSort",p1:resultSorter,emptyJump:0},{code:"SorterData",p1:resultSorter,p2:1,count:outputs.length});if(groupLimit?.offset!==undefined){resultOffsetAt=ops.length;ops.push({code:"IfPos",p1:groupLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:1,p2:outputs.length});if(groupLimit){resultLimitAt=ops.length;ops.push({code:"DecrJumpZero",p1:groupLimit.count,p2:0});}const resultNext=ops.length;ops.push({code:"SorterNext",p1:resultSorter,p2:resultSortAt+1});if(resultOffsetAt!==undefined)(ops[resultOffsetAt] as {p2:number}).p2=resultNext;}const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(resultSortAt!==undefined)(ops[resultSortAt] as {emptyJump:number}).emptyJump=halt;if(resultLimitAt!==undefined)(ops[resultLimitAt] as {p2:number}).p2=halt;for(const at of groupLimitJumps)(ops[at] as {p2:number}).p2=halt;if(groupLimit)(ops[groupLimit.ifZero] as {p2:number}).p2=halt;
  const columns=select.result.map((expression,i)=>{const tree=trees[i]!;if(tree.kind==="column"){const source=aggregateSources.find(item=>item.cursor===(tree.cursor??0))!,c=source.table.columns[tree.index]!;return Object.freeze({name:expression.alias??c.name,declaredType:c.declaredType,database:"main",table:source.table.name,origin:c.name})}return Object.freeze({name:expressionName(expression),declaredType:null,database:null,table:null,origin:null})});return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
 }
 let rewind=-1,body=0,skip=-1;
 if(table){ops.push({code:"OpenRead",p1:table.rootPage});rewind=ops.length;ops.push({code:"Rewind",p2:0});body=ops.length;if(where){const test=compileExpressionTree(where,ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}emitSteps();const next=ops.length;ops.push({code:"Next",p2:body});if(skip>=0)(ops[skip] as {p2:number}).p2=next;(ops[rewind] as {p2:number}).p2=ops.length;}else {if(where){const test=compileExpressionTree(where,ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}emitSteps();if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;}
 emitFinals();let reject=-1;if(having){const test=compileExpressionTree(having,ops,allocate,parameters);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0})}outputs.forEach((tree,index)=>{const value=compileExpressionTree(tree,ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:index+1})});ops.push({code:"ResultRow",p1:1,p2:outputs.length});if(reject>=0)(ops[reject] as {p2:number}).p2=ops.length;ops.push({code:"Halt"});
 const columns=select.result.map(expression=>Object.freeze({name:expressionName(expression),declaredType:null,database:null,table:null,origin:null}));return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
}


function truth(m:Mem):boolean|null{if(m.initialStorageClass==="null")return null;return booleanValue(m,0)===1}
const expressionAffinity=(x:Expression):MemAffinity|undefined=>x.kind==="column"?x.affinity:x.kind==="cast"?x.affinity:x.kind==="collate"?expressionAffinity(x.value):undefined;
// expr.c:sqlite3ExprCollSeq follows CAST/unary-plus and propagates EP_Collate
// through expression children (including function argument lists), choosing the
// first collated child in source order. Keep undefined distinct from BINARY so
// select.c:multiSelectCollSeq can continue to a later compound arm.
const expressionCollation=(x:Expression):BuiltinCollation|undefined=>{
 if(x.kind==="collate")return x.collation;
 if(x.kind==="mem"||x.kind==="column")return x.collation;
 if(x.kind==="unary"||x.kind==="cast")return expressionCollation(x.value);
 if(x.kind==="binary")return expressionCollation(x.left)??expressionCollation(x.right);
 if(x.kind==="call"||x.kind==="aggregate")return x.args.map(expressionCollation).find((value):value is BuiltinCollation=>value!==undefined);
 if(x.kind==="case")return (x.operand?expressionCollation(x.operand):undefined)??x.pairs.flatMap(([when,then])=>[when,then]).map(expressionCollation).find((value):value is BuiltinCollation=>value!==undefined)??(x.otherwise?expressionCollation(x.otherwise):undefined);
 return undefined;
};
const collation=(x:Expression):BuiltinCollation=>expressionCollation(x)??"binary";
// expr.c sqlite3BinaryCompareCollSeq: explicit left, then explicit right, then derived left/right.
const explicitCollation=(x:Expression):BuiltinCollation|undefined=>{
 if(x.kind==="collate")return x.collation;
 if(x.kind==="unary"||x.kind==="cast")return explicitCollation(x.value);
 if(x.kind==="binary")return explicitCollation(x.left)??explicitCollation(x.right);
 if(x.kind==="call"||x.kind==="aggregate")return x.args.map(explicitCollation).find((value):value is BuiltinCollation=>value!==undefined);
 if(x.kind==="case")return (x.operand?explicitCollation(x.operand):undefined)??x.pairs.flatMap(([when,then])=>[when,then]).map(explicitCollation).find((value):value is BuiltinCollation=>value!==undefined)??(x.otherwise?explicitCollation(x.otherwise):undefined);
 return undefined;
};
const binaryCollation=(left:Expression,right:Expression):BuiltinCollation=>explicitCollation(left)??explicitCollation(right)??collation(left)??collation(right);
function valueBytes(value:Mem):number{return value.initialStorageClass==="text"?value.textBytes().byteLength:value.initialStorageClass==="blob"?value.blobValue().byteLength:0;}
interface ScalarControl { charge(units:number):void; check():void; readonly maxResultBytes:number }
function evaluateFunction(name:string,a:Mem[],encoding:DatabaseEncoding,coll:"binary"|BuiltinCollation="binary",control?:ScalarControl):Mem{
 const out=new Mem(),charge=(units:number)=>control?.charge(units),checkSize=(bytes:number)=>{if(control&&bytes>control.maxResultBytes)throw new JSQLiteError("limit","string or blob too big")};if(name==="min"||name==="max"){if(a.some(x=>x.initialStorageClass==="null"))return out;let best=0;for(let i=1;i<a.length;i++){const cmp=compareMem(a[i]!,a[best]!,coll);if(name==="min"?cmp<=0:cmp>0)best=i}return a[best]!}if(name==="char"){let value="";for(const x of a){charge(1);let n=Number(x.integerValue());if(n<0||n>0x10ffff)n=0xfffd;value+=String.fromCodePoint(n)}const bytes=new TextEncoder().encode(value);checkSize(bytes.byteLength);out.setText(bytes,"utf-8");return out}if(name==="hex"){const c=a[0]!;if(c.initialStorageClass==="null"){out.setText(new Uint8Array(),"utf-8");return out}const bytes=c.initialStorageClass==="blob"?c.blobValue():c.initialStorageClass==="text"?c.textBytes():new TextEncoder().encode(String(memToPublicInitial(c)));checkSize(bytes.byteLength*2);charge(Math.ceil(bytes.byteLength/256));out.setText(new TextEncoder().encode(Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()),"utf-8");return out}if(name==="replace"){if(a.some(x=>x.initialStorageClass==="null"))return out;const source=a[0]!.textValue(),search=a[1]!.textValue().split("\0")[0]!,replacement=a[2]!.textValue();let value:string;if(!search)value=source;else{const count=source.split(search).length-1;const estimate=new TextEncoder().encode(source).byteLength+count*(new TextEncoder().encode(replacement).byteLength-new TextEncoder().encode(search).byteLength);checkSize(estimate);charge(Math.ceil(source.length/256)+count);value=source.split(search).join(replacement)}const bytes=new TextEncoder().encode(value);checkSize(bytes.byteLength);out.setText(bytes,"utf-8");return out}if(name==="typeof"){out.setText(new TextEncoder().encode(a[0]!.initialStorageClass),"utf-8");return out}if(name==="nullif"){if(a[0]!.initialStorageClass!=="null"&&a[1]!.initialStorageClass!=="null"&&compareMem(a[0]!,a[1]!,coll)===0)return out;return a[0]!}if(name==="octet_length"||name==="length"){if(a[0]!.initialStorageClass==="null")return out;const c=new Mem();c.copyFrom(a[0]!);if(c.initialStorageClass!=="text"&&c.initialStorageClass!=="blob")c.stringify(encoding);if(name==="octet_length")out.setInt64(BigInt(c.initialStorageClass==="blob"?c.blobValue().length:c.textBytes().length));else out.setInt64(BigInt(c.initialStorageClass==="blob"?c.blobValue().length:[...c.textValue().split("\0")[0]!].length));return out}if(name==="abs"){const c=a[0]!;if(c.initialStorageClass==="null")return out;if(c.initialStorageClass==="integer"){const n=c.integerValue();if(n===-(1n<<63n))throw new JSQLiteError("sqlite","integer overflow",{code:1});out.setInt64(n<0?-n:n)}else if(c.initialStorageClass==="real")out.setDouble(Math.abs(c.realValue()));else{const numeric=c.numericTypeCopy();out.setDouble(Math.abs(numeric.initialStorageClass==="integer"?Number(numeric.integerValue()):numeric.realValue()))}return out}if(name==="substr"){if(a.some(x=>x.initialStorageClass==="null"))return out;const blob=a[0]!.initialStorageClass==="blob",input=blob?a[0]!.blobValue():[...a[0]!.textValue().split("\0")[0]!],total=input.length;let p1=Number(a[1]!.integerValue()),p2=a[2]?Number(a[2]!.integerValue()):Number.MAX_SAFE_INTEGER;if(p1<0){p1+=total;if(p1<0){if(p2<0)p2=0;else p2+=p1;p1=0}}else if(p1>0)p1--;else if(p2>0)p2--;if(p2<0){p2=Math.min(-p2,p1);p1-=p2}p1=Math.max(0,p1);p2=Math.max(0,p2);const value=input.slice(p1,p1+p2);charge(Math.ceil(total/256));if(blob){const bytes=value as Uint8Array;checkSize(bytes.byteLength);out.setBlob(bytes)}else{const bytes=new TextEncoder().encode((value as string[]).join(""));checkSize(bytes.byteLength);out.setText(bytes,"utf-8")}return out}return out
}

function evaluateExpression(e:Expression,encoding:DatabaseEncoding,columns?:readonly Mem[]):Mem{
 const out=new Mem();if(e.kind==="register"||e.kind==="aggregate")throw new JSQLiteError("internal","lowered expression reached evaluator");if(e.kind==="variable")throw new JSQLiteError("internal","variables are compiled before execution");if(e.kind==="mem")return e.value;if(e.kind==="column"){out.copyFrom(columns![e.index]!);return out}if(e.kind==="literal"){if(e.value===null)out.setNull();else if(typeof e.value==="bigint")out.setInt64(e.value);else if(typeof e.value==="number")out.setDouble(e.value);else if(typeof e.value==="string")out.setText(new TextEncoder().encode(e.value),"utf-8");else out.setBlob(e.value);return out}
 if(e.kind==="unary"){const v=evaluateExpression(e.value,encoding,columns);if(e.op==="+")return v;if(e.op==="-"){const z=new Mem();z.setInt64(0n);return arithmeticBinary("subtract",z,v)}return e.op==="~"?bitwiseNot(v):logicalNot(v)}
 if(e.kind==="cast"){const v=evaluateExpression(e.value,encoding,columns);v.cast(e.affinity,encoding);return v}
 if(e.kind==="collate")return evaluateExpression(e.value,encoding,columns);
 if(e.kind==="binary"){const a=evaluateExpression(e.left,encoding,columns);if(e.op==="AND"&&truth(a)===false){out.setInt64(0n);return out}if(e.op==="OR"&&truth(a)===true){out.setInt64(1n);return out}const b=evaluateExpression(e.right,encoding,columns);if(e.op==="AND"||e.op==="OR"){const x=truth(a),y=truth(b),v=e.op==="AND"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?out.setNull():out.setInt64(v?1n:0n);return out}if(["+","-","*","/","%"].includes(e.op)){return arithmeticBinary(({"+":"add","-":"subtract","*":"multiply","/":"divide","%":"remainder"} as const)[e.op as "+"],a,b)}const is=e.op==="IS"||e.op==="IS NOT";if(!is&&(a.initialStorageClass==="null"||b.initialStorageClass==="null")){out.setNull();return out}const bothNull=a.initialStorageClass==="null"&&b.initialStorageClass==="null",oneNull=a.initialStorageClass==="null"||b.initialStorageClass==="null";let cmp=0;if(!oneNull)cmp=compareMem(a,b,binaryCollation(e.left,e.right));let result:boolean;switch(e.op){case "=":case "==":result=cmp===0;break;case "IS":result=bothNull||(!oneNull&&cmp===0);break;case "!=":case "<>":result=cmp!==0;break;case "IS NOT":result=!bothNull&&(oneNull||cmp!==0);break;case "<":result=cmp<0;break;case "<=":result=cmp<=0;break;case ">":result=cmp>0;break;default:result=cmp>=0}out.setInt64(result?1n:0n);return out}
 if(e.kind==="case"){const base=e.operand?evaluateExpression(e.operand,encoding,columns):null;for(const [w,r] of e.pairs){const test=evaluateExpression(w,encoding,columns);if(base?(base.initialStorageClass!=="null"&&test.initialStorageClass!=="null"&&compareMem(base,test,"binary")===0):truth(test)===true)return evaluateExpression(r,encoding,columns)}return e.otherwise?evaluateExpression(e.otherwise,encoding,columns):out}
 const args=()=>e.args.map(x=>evaluateExpression(x,encoding,columns));if(e.name==="coalesce"){for(const x of e.args){const v=evaluateExpression(x,encoding,columns);if(v.initialStorageClass!=="null")return v}return out}const a=args();return evaluateFunction(e.name,a,encoding,e.args.map(collation).find((_,i)=>e.args[i]!.kind==="collate")??"binary")
}

interface AggregateFunctionContext<State> {
 readonly encoding:DatabaseEncoding;
 readonly collation:BuiltinCollation;
 readonly maxResultBytes:number;
 readonly budget:PrivateStateByteBudget;
 state():State;
 currentState():State|undefined;
 setResult(value:Mem):void;
 setError(error:unknown):void;
}
interface AggregateDefinition<State=unknown> {
 readonly name:string;
 readonly arities:readonly number[];
 create(context:AggregateFunctionContext<State>):State;
 step(context:AggregateFunctionContext<State>,args:readonly Mem[]):boolean|void;
 readonly inverse?: (context:AggregateFunctionContext<State>,args:readonly Mem[])=>void;
 readonly value?: (context:AggregateFunctionContext<State>)=>void;
 final(context:AggregateFunctionContext<State>):void;
 readonly cleanup?: (state:State)=>void;
}
interface SumCtx {rSum:number;rErr:number;iSum:bigint;cnt:bigint;approx:boolean;ovrfl:boolean}
const INT64_MIN=-(1n<<63n),INT64_MAX=(1n<<63n)-1n,KBN_SPLIT=4503599627370496n;
function kahanBabuskaNeumaierStep(p:SumCtx,r:number):void{const s=p.rSum,t=s+r;p.rErr+=Math.abs(s)>Math.abs(r)?(s-t)+r:(r-t)+s;p.rSum=t;}
function kahanBabuskaNeumaierStepInt64(p:SumCtx,value:bigint):void{if(value<=-KBN_SPLIT||value>=KBN_SPLIT){const small=value%16384n;kahanBabuskaNeumaierStep(p,Number(value-small));kahanBabuskaNeumaierStep(p,Number(small));}else kahanBabuskaNeumaierStep(p,Number(value));}
function kahanBabuskaNeumaierInit(p:SumCtx,value:bigint):void{if(value<=-KBN_SPLIT||value>=KBN_SPLIT){const small=value%16384n;p.rSum=Number(value-small);p.rErr=Number(small);}else{p.rSum=Number(value);p.rErr=0;}}
function sumStep(context:AggregateFunctionContext<SumCtx>,args:readonly Mem[]):void{const value=args[0]!,numeric=value.numericTypeCopy();if(numeric.initialStorageClass==="null")return;const p=context.state();p.cnt++;if(!p.approx){if(numeric.initialStorageClass!=="integer"){kahanBabuskaNeumaierInit(p,p.iSum);p.approx=true;kahanBabuskaNeumaierStep(p,numeric.realValue());}else{const n=numeric.integerValue(),sum=p.iSum+n;if(sum>=INT64_MIN&&sum<=INT64_MAX)p.iSum=sum;else{p.ovrfl=true;kahanBabuskaNeumaierInit(p,p.iSum);p.approx=true;kahanBabuskaNeumaierStepInt64(p,n);}}}else if(numeric.initialStorageClass==="integer")kahanBabuskaNeumaierStepInt64(p,numeric.integerValue());else{p.ovrfl=false;kahanBabuskaNeumaierStep(p,numeric.realValue());}}
function sumResult(context:AggregateFunctionContext<SumCtx>,kind:"sum"|"avg"|"total"):void{const p=context.currentState(),out=new Mem();if(kind==="total"&&!p){out.setDouble(0);context.setResult(out);return}if(!p||p.cnt===0n){context.setResult(out);return}if(kind==="sum"&&!p.approx){out.setInt64(p.iSum);context.setResult(out);return}if(kind==="sum"&&p.ovrfl){context.setError(new JSQLiteError("sqlite","integer overflow",{code:1}));return}let r=p.approx?p.rSum:p.iSum===0n?0:Number(p.iSum);if(p.approx&&!Number.isFinite(p.rErr)){}else if(p.approx)r+=p.rErr;if(kind==="avg")r/=Number(p.cnt);out.setDouble(r);context.setResult(out);}
interface CountCtx {count:bigint}
interface ExtremaCtx {best:Mem|null;bytes:number}
interface ConcatCtx {parts:string[];bytes:number}
const emptySum=():SumCtx=>({rSum:0,rErr:0,iSum:0n,cnt:0n,approx:false,ovrfl:false});
const aggregateDefinitions:Readonly<Record<string,AggregateDefinition<any>>>=Object.freeze({
 count:{name:"count",arities:[0,1],create:()=>({count:0n}),step:(c,a)=>{if(!a[0]||a[0].initialStorageClass!=="null")c.state().count++},value:c=>{const out=new Mem();out.setInt64(c.currentState()?.count??0n);c.setResult(out)},final:c=>{const out=new Mem();out.setInt64(c.currentState()?.count??0n);c.setResult(out)}},
 sum:{name:"sum",arities:[1],create:emptySum,step:sumStep,value:c=>sumResult(c,"sum"),final:c=>sumResult(c,"sum")},
 avg:{name:"avg",arities:[1],create:emptySum,step:sumStep,value:c=>sumResult(c,"avg"),final:c=>sumResult(c,"avg")},
 total:{name:"total",arities:[1],create:emptySum,step:sumStep,value:c=>sumResult(c,"total"),final:c=>sumResult(c,"total")},
 min:extremaDefinition("min"),max:extremaDefinition("max"),
 group_concat:concatDefinition("group_concat"),string_agg:concatDefinition("string_agg"),
});
function extremaDefinition(name:"min"|"max"):AggregateDefinition<ExtremaCtx>{return{name,arities:[1],create:()=>({best:null,bytes:0}),step:(c,a)=>{const value=a[0];if(!value||value.initialStorageClass==="null")return false;const state=c.state();if(state.best&&(name==="min"?compareMem(value,state.best,c.collation)>=0:compareMem(value,state.best,c.collation)<=0))return false;const bytes=valueBytes(value),growth=Math.max(0,bytes-state.bytes);c.budget.reserve(growth,"aggregate state exceeds total byte limit");const next=new Mem();try{next.copyFrom(value)}catch(error){c.budget.release(growth);throw error}const previous=state.best,previousBytes=state.bytes;state.best=next;state.bytes=bytes;previous?.release();if(previousBytes>bytes)c.budget.release(previousBytes-bytes);return true},value:c=>{const out=new Mem();if(c.currentState()?.best)out.copyFrom(c.currentState()!.best!);c.setResult(out)},final:c=>{const out=new Mem();if(c.currentState()?.best)out.copyFrom(c.currentState()!.best!);c.setResult(out)},cleanup:s=>s.best?.release()}}
function concatDefinition(name:"group_concat"|"string_agg"):AggregateDefinition<ConcatCtx>{return{name,arities:name==="string_agg"?[2]:[1,2],create:()=>({parts:[],bytes:0}),step:(c,a)=>{const value=a[0];if(!value||value.initialStorageClass==="null")return;const text=aggregateText(value),separator=a[1]?.initialStorageClass==="null"?"":a[1]?aggregateText(a[1]):",";const state=c.state(),addition=(state.parts.length?separator:"")+text,delta=new TextEncoder().encode(addition).byteLength;if(state.bytes+delta>c.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");c.budget.reserve(delta,"aggregate state exceeds total byte limit");try{state.parts.push(addition)}catch(error){c.budget.release(delta);throw error}state.bytes+=delta},value:c=>concatResult(c),final:c=>concatResult(c),cleanup:s=>s.parts.length=0}}
function aggregateText(input:Mem):string{const copy=new Mem();copy.copyFrom(input);if(copy.initialStorageClass!=="text")copy.stringify("utf-8");return copy.textValue()}
function concatResult(c:AggregateFunctionContext<ConcatCtx>):void{const out=new Mem(),state=c.currentState();if(state?.parts.length)out.setText(new TextEncoder().encode(state.parts.join("")),"utf-8");c.setResult(out)}
class AggregateContext<State> implements AggregateFunctionContext<State>{
 readonly #result=new FunctionContext();
 readonly cell:Mem;readonly definition:AggregateDefinition<State>;readonly encoding:DatabaseEncoding;readonly collation:BuiltinCollation;readonly maxResultBytes:number;readonly budget:PrivateStateByteBudget;
 constructor(cell:Mem,definition:AggregateDefinition<State>,encoding:DatabaseEncoding,collation:BuiltinCollation,maxResultBytes:number,budget:PrivateStateByteBudget){this.cell=cell;this.definition=definition;this.encoding=encoding;this.collation=collation;this.maxResultBytes=maxResultBytes;this.budget=budget}
 currentState():State|undefined{return this.cell.aggregateState()?.context as State|undefined}
 state():State{let state=this.currentState();if(state===undefined){state=this.definition.create(this);this.cell.setAggregate({definition:this.definition,context:state,cleanup:()=>{try{this.definition.cleanup?.(state!)}finally{const bytes=(state as any).bytes;if(typeof bytes==="number")this.budget.release(bytes)}}})}return state}
 setResult(value:Mem):void{this.#result.setResult(value)} setError(error:unknown):void{this.#result.setError(error)}
 takeResult():Mem{return this.#result.takeResult()}
}
function aggregateContext(cell:Mem,name:string,encoding:DatabaseEncoding,collation:BuiltinCollation,maxResultBytes:number,budget:PrivateStateByteBudget):AggregateContext<any>{const definition=aggregateDefinitions[name];if(!definition)throw new JSQLiteError("internal",`missing aggregate definition: ${name}`);const stored=cell.aggregateState()?.definition;if(stored&&stored!==definition)throw new JSQLiteError("internal","aggregate definition changed for context");return new AggregateContext(cell,definition,encoding,collation,maxResultBytes,budget)}
function aggregateStep(cell:Mem,name:string,args:readonly Mem[],collation:BuiltinCollation,encoding:DatabaseEncoding,maxResultBytes:number,budget:PrivateStateByteBudget):boolean{const context=aggregateContext(cell,name,encoding,collation,maxResultBytes,budget);try{return context.definition.step(context,args)===true}catch(error){context.setError(error);context.takeResult();return false}}
function aggregateResult(cell:Mem,name:string,encoding:DatabaseEncoding,maxResultBytes:number,budget:PrivateStateByteBudget,destructive:boolean):Mem{const context=aggregateContext(cell,name,encoding,"binary",maxResultBytes,budget);try{const callback=destructive?context.definition.final:context.definition.value;if(!callback)throw new JSQLiteError("internal",`aggregate ${name} has no value callback`);callback(context);const result=context.takeResult();if(destructive)cell.setNull();return result}catch(error){context.setError(error);throw error}}

function misuse(message: string): never { throw new JSQLiteError("misuse", message); }
function range(): never { throw new JSQLiteError("sqlite", "column or parameter index out of range", { code: 25 }); }

export class VdbeStatement implements Statement {
  readonly #program: Program;
  readonly #registers: Mem[];
  readonly #onFinalize: () => void;
  readonly #admit: () => () => void;
  readonly #assertConnectionIdle: () => void;
  readonly #bindings: Mem[];
  #pc = 0;
  #state: "prepared" | "running" | "suspended" | "row" | "done" | "failed" | "finalized" = "prepared";
  #rowStart = 0;
  #rowCount = 0;
  #cursors = new Map<number, TableScanCursor>();
  #cursorRoots = new Map<number, number>();
  #records = new Map<number, ReturnType<typeof decodeRecord>>();
  #privateCursors = new Map<number, SorterCursor | EphemeralIndexCursor>();
  #privateBytes: PrivateStateByteBudget;
  #borrow = new BorrowLifetime();
  #rows = 0;
  #work = 0;
  #savedError: unknown = null;
  constructor(program: Program, assertConnectionIdle: () => void, admit: () => () => void, onFinalize: () => void) {
    this.#program = program; this.#assertConnectionIdle = assertConnectionIdle; this.#admit = admit; this.#onFinalize = onFinalize;
    this.#registers = Array.from({ length: program.registers + 1 }, () => new Mem());
    this.#bindings = program.parameters.map(() => new Mem());
    this.#privateBytes = new PrivateStateByteBudget(program.privateStateLimits.maxBytes);
  }
  get columnCount(): number { return this.#program.columns.length; }
  get parameterCount(): number { return this.#program.parameters.length; }
  parameterName(index: number): string | null { this.#assertLive(); if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); return this.#program.parameters[index - 1]!.name; }
  parameterIndex(name: string): number { this.#assertLive(); const found = this.#program.parameters.findIndex(parameter => parameter.name === name); return found < 0 ? 0 : found + 1; }
  bind(indexOrName: number | string, value: SqliteValue): void { this.#assertIdle(); if (this.#state !== "prepared") misuse("statement must be reset before binding"); const index = typeof indexOrName === "string" ? this.parameterIndex(indexOrName) : indexOrName; if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); let bound: Mem; try { bound = memFromPublic(value, this.#program.encoding); } catch (error) { throw new JSQLiteError("misuse", (error as Error).message, { cause: error }); } this.#bindings[index - 1]!.moveFrom(bound); }
  clearBindings(): void { this.#assertIdle(); this.#bindings.forEach(value => value.setNull()); }
  async step(options: OperationOptions = {}): Promise<StepResult> {
    this.#assertIdle();
    if (this.#state === "failed") throw this.#savedError;
    if (this.#state === "done") return "done";
    const requestedLimit = options.maxWorkUnits ?? this.#program.maxWorkUnits;
    const limit = Math.min(requestedLimit, this.#program.maxWorkUnits);
    if (!Number.isSafeInteger(limit) || limit < 0) misuse("maxWorkUnits must be a finite nonnegative safe integer");
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0)) misuse("timeoutMs must be finite and nonnegative");
    const release = this.#admit();
    this.#state = "running";
    this.#invalidateRow();
    const started = Date.now();
    // Start execution in a promise job after synchronously acquiring connection
    // ownership, and retain that ownership until the returned chain settles.
    return await Promise.resolve().then(async () => {
    try {
      while (this.#pc < this.#program.ops.length) {
        this.#checkControl(options, limit, started);
        if (this.#work !== 0 && this.#work % 256 === 0) { this.#state = "suspended"; await new Promise<void>(resolve => setTimeout(resolve, 0)); this.#state = "running"; }
        const op = this.#program.ops[this.#pc++]!; this.#work++;
        switch (op.code) {
          case "OpenRead": {const cursor=op.p2??0;this.#cursorRoots.set(cursor,op.p1);this.#cursors.set(cursor,this.#program.database!.tableScanCursor(op.p1));break;}
          case "MustBeInt": {const value=this.#registers[op.p1]!;let integer:bigint;if(value.initialStorageClass==="integer")integer=value.integerValue();else if(value.initialStorageClass==="real"&&Number.isInteger(value.realValue())&&value.realValue()>=-9223372036854775808&&value.realValue()<9223372036854775808)integer=BigInt(value.realValue());else if(value.initialStorageClass==="text"&&/^[+-]?[0-9]+$/.test(value.textValue())){integer=BigInt(value.textValue());if(integer<-(1n<<63n)||integer>=(1n<<63n))throw new JSQLiteError("sqlite","datatype mismatch",{code:20});}else throw new JSQLiteError("sqlite","datatype mismatch",{code:20});value.setInt64(integer);break;}
          case "OffsetLimit": {const count=this.#registers[op.p1]!.integerValue(),offset=this.#registers[op.p3]!.integerValue();const positive=offset>0n?offset:0n,sum=count+positive;this.#registers[op.p2]!.setInt64(count<=0n||sum>(1n<<63n)-1n?-1n:sum);break;}
          case "IfNotZero": {const value=this.#registers[op.p1]!.integerValue();if(value!==0n){if(value>0n)this.#registers[op.p1]!.setInt64(value-1n);this.#pc=op.p2;}break;}
          case "IfPos": {const value=this.#registers[op.p1]!.integerValue();if(value>0n){this.#registers[op.p1]!.setInt64(value-BigInt(op.p3));this.#pc=op.p2;}break;}
          case "DecrJumpZero": {const value=this.#registers[op.p1]!.integerValue(),next=value>-(1n<<63n)?value-1n:value;this.#registers[op.p1]!.setInt64(next);if(next===0n)this.#pc=op.p2;break;}
          case "SorterOpen": this.#privateCursors.set(op.p1,new SorterCursor(op.keyInfo,this.#program.privateStateLimits,this.#privateBytes));break;
          case "OpenEphemeral": this.#privateCursors.set(op.p1,new EphemeralIndexCursor(op.keyInfo,this.#program.privateStateLimits,this.#privateBytes));break;
          case "SorterInsert": {const cursor=this.#privateCursors.get(op.p1) as SorterCursor,key=this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),payload=this.#registers.slice(op.payload,op.payload+op.payloadCount),control=this.#privateControl(options,limit,started);if(op.topN!==undefined){const capacity=this.#registers[op.topN]!.integerValue();if(capacity>=0n)await cursor.insertBounded(key,payload,capacity,control);else await cursor.insert(key,payload,control);}else await cursor.insert(key,payload,control);break;}
          case "SorterSort": {const cursor=this.#privateCursors.get(op.p1) as SorterCursor;await cursor.sort(this.#privateControl(options,limit,started));if(!cursor.first())this.#pc=op.emptyJump;break;}
          case "SorterData": {const values=(this.#privateCursors.get(op.p1) as SorterCursor).data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "SorterNext": if((this.#privateCursors.get(op.p1) as SorterCursor).next())this.#pc=op.p2;break;
          case "Found": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor;if(await cursor.found(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started)))this.#pc=op.jump;break;}
          case "IdxInsert": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor,key=this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),control=this.#privateControl(options,limit,started);if(op.replace)await cursor.replace(key,control);else await cursor.insert(key,control);break;}
          case "SetDelete": await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).remove(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started));break;
          case "SetRetainIntersection": {const control=this.#privateControl(options,limit,started);await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).retainFoundIn(this.#privateCursors.get(op.p2) as EphemeralIndexCursor,control);break;}
          case "ClearEphemeral": (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).clear();break;
          case "ClearSorter": (this.#privateCursors.get(op.p1) as SorterCursor).clear();break;
          case "EphemeralSort": await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).sort(this.#privateControl(options,limit,started));break;
          case "EphemeralRewind": if(!(this.#privateCursors.get(op.p1) as EphemeralIndexCursor).first())this.#pc=op.p2;break;
          case "EphemeralData": {const values=(this.#privateCursors.get(op.p1) as EphemeralIndexCursor).data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "EphemeralNext": if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).next())this.#pc=op.p2;break;
          case "Rewind": {const cursor=op.p1??0,root=this.#cursorRoots.get(cursor);if(root===undefined)throw new JSQLiteError("internal","rewind on unopened cursor");const scan=this.#program.database!.tableScanCursor(root);this.#cursors.set(cursor,scan);this.#records.delete(cursor);if (!scan.first()) this.#pc = op.p2; else await this.#loadRecord(cursor,options, limit, started); break;}
          case "NullRow": this.#records.delete(op.p1); break;
          case "Column": { const record=this.#records.get(op.p3??0),raw=record?.values[op.p1] ?? {storageClass:"null" as const}; this.#registers[op.p2]!.moveFrom(memFromRawRecord(raw, this.#borrow)); break; }
          case "Rowid": {const cursor=op.p1??0;if(this.#records.has(cursor))this.#registers[op.p2]!.setInt64(this.#cursors.get(cursor)!.rowid);else this.#registers[op.p2]!.setNull();break;}
          case "Eq": { const a=this.#registers[op.p1]!, b=this.#registers[op.p2]!, out=this.#registers[op.p3]!; a.applyAffinity(op.affinity,this.#program.database!.encoding); b.applyAffinity(op.affinity,this.#program.database!.encoding); out.setInt64(a.initialStorageClass!=="null" && b.initialStorageClass!=="null" && compareMem(a,b,op.collation)===0 ? 1n : 0n); break; }
          case "IfNot": if (truth(this.#registers[op.p1]!)!==true) this.#pc=op.p2; break;
          case "Next": {const cursor=op.p1??0;if (this.#cursors.get(cursor)!.next()) { await this.#loadRecord(cursor,options, limit, started); this.#pc=op.p2; } break;}
          case "Integer": this.#registers[op.p2]!.setInt64(op.p1); break;
          case "Real": this.#registers[op.p2]!.setDouble(op.p1); break;
          case "String": this.#registers[op.p2]!.setText(new TextEncoder().encode(op.p1),"utf-8"); break;
          case "Blob": this.#registers[op.p2]!.setBlob(op.p1); break;
          case "Null": this.#registers[op.p2]!.setNull(); break;
          case "Copy": {const source=this.#registers[op.p1]!;this.#chargeValue(source,options,limit,started);this.#registers[op.p2]!.copyFrom(source);break;}
          case "Goto": this.#pc=op.p2; break;
          case "CollSeq": break;
          case "Cast": {const value=new Mem();value.copyFrom(this.#registers[op.p1]!);value.cast(op.affinity,this.#program.encoding);this.#registers[op.p2]!.moveFrom(value);break;}
          case "Binary": {let a=this.#registers[op.p1]!,b=this.#registers[op.p2]!;if(op.affinity&&["=","==","!=","<>","<",">","<=",">=","IS","IS NOT"].includes(op.op)){const left=new Mem(),right=new Mem();left.copyFrom(a);right.copyFrom(b);left.applyAffinity(op.affinity,this.#program.encoding);right.applyAffinity(op.affinity,this.#program.encoding);a=left;b=right}this.#registers[op.p3]!.moveFrom(evaluateExpression({kind:"binary",op:op.op,left:{kind:"mem",value:a,collation:op.collation},right:{kind:"mem",value:b}},this.#program.encoding));break;}
          case "AggReset": for(const register of op.registers)this.#registers[register]!.setNull();break;
          case "CompareGroup": {let equal=true;for(let i=0;i<op.count;i++)if(compareMem(this.#registers[op.left+i]!,this.#registers[op.right+i]!,op.keyInfo.terms[i]!.collation)!==0){equal=false;break}if(equal)this.#pc=op.jump;break;}
          case "AggStep": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const changed=aggregateStep(this.#registers[op.p2]!,op.name,args,op.collation,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes);if(op.changed!==undefined)this.#registers[op.changed]!.setInt64(changed?1n:0n);break;}
          case "AggFinal": this.#registers[op.p1]!.moveFrom(aggregateResult(this.#registers[op.p1]!,op.name,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,true));break;
          case "AggValue": this.#registers[op.p2]!.moveFrom(aggregateResult(this.#registers[op.p1]!,op.name,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,false));break;
          case "Function": case "PureFunc": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const control:ScalarControl={maxResultBytes:this.#program.maxResultBytes,check:()=>this.#checkControl(options,limit,started),charge:(units)=>{for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;}}};this.#registers[op.p2]!.moveFrom(runFunctionContext(()=>evaluateFunction(op.name,args,this.#program.encoding,op.collation,control)));break;}
          case "ShortCircuit": {const value=truth(this.#registers[op.p1]!);if((op.kind==="and"&&value===false)||(op.kind==="or"&&value===true)){this.#registers[op.p2]!.setInt64(op.kind==="and"?0n:1n);this.#pc=op.jump}break;}
          case "Boolean": {const x=truth(this.#registers[op.p1]!),y=truth(this.#registers[op.p2]!),v=op.kind==="and"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?this.#registers[op.p3]!.setNull():this.#registers[op.p3]!.setInt64(v?1n:0n);break;}
          case "NotNull": if(this.#registers[op.p1]!.initialStorageClass!=="null"){this.#registers[op.p2]!.copyFrom(this.#registers[op.p1]!);this.#pc=op.jump}break;
          case "Variable": this.#registers[op.p2]!.copyFrom(this.#bindings[op.p1 - 1]!); break;
          case "Subtract": this.#registers[op.p3]!.moveFrom(arithmeticBinary("subtract", this.#registers[op.p1]!, this.#registers[op.p2]!)); break;
          case "BitNot": this.#registers[op.p2]!.moveFrom(bitwiseNot(this.#registers[op.p1]!)); break;
          case "Not": this.#registers[op.p2]!.moveFrom(logicalNot(this.#registers[op.p1]!)); break;
          case "ResultRow": {for(let i=0;i<op.p2;i++)this.#checkResultValue(this.#registers[op.p1+i]!);if(++this.#rows>(this.#program.maxRows??Number.MAX_SAFE_INTEGER))throw new JSQLiteError("limit","statement exceeds maxRows");this.#rowStart=op.p1;this.#rowCount=op.p2;this.#state="row";return "row";}
          case "Halt": this.#state = "done"; {const cleanup=this.#halt();if(cleanup!==null)throw cleanup;} return "done";
        }
      }
      this.#state = "done"; {const cleanup=this.#halt();if(cleanup!==null)throw cleanup;} return "done";
    } catch (error) {
      const publicError = this.#mapExecutionError(error);
      this.#savedError = publicError; this.#state = "failed"; this.#halt(); throw publicError;
    }
    }).finally(release);
  }
  reset(): void { this.#assertIdle(); const primary=this.#savedError; this.#savedError=null; const cleanup=this.#halt(); this.#rows=0; this.#work=0; this.#registers.forEach(value => value.setNull()); this.#pc = 0; this.#state = "prepared"; if(primary!==null) throw primary; if(cleanup!==null) throw cleanup; }
  finalize(): void { this.#assertIdle(); if (this.#state === "finalized") misuse("statement is finalized"); const primary=this.#savedError; this.#savedError=null; const cleanup=this.#halt(); this.#registers.forEach(value => value.release()); this.#bindings.forEach(value => value.release()); this.#state = "finalized"; this.#onFinalize(); if(primary!==null) throw primary; if(cleanup!==null) throw cleanup; }
  columnMetadata(index: number): ColumnMetadata { this.#assertColumn(index, false); return Object.freeze({...this.#program.columns[index]!}); }
  columnType(index: number): SqliteStorageClass { return this.#cell(index).initialStorageClass; }
  column(index: number): SqliteValue { return memToPublicInitial(this.#cell(index)); }
  columnInteger(index: number): bigint | null { const cell = this.#cell(index); return cell.initialStorageClass === "null" ? null : cell.integerValue(); }
  columnReal(index: number): number | null { const cell = this.#cell(index); return cell.initialStorageClass === "null" ? null : cell.realValue(); }
  columnText(index: number): string | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const copy = new Mem(); copy.copyFrom(cell); copy.cast("text", "utf-8"); return copy.textValue(); }
  columnBlob(index: number): Uint8Array | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const value = memToPublicInitial(cell); return value instanceof Uint8Array ? value : memFromPublic(String(value), "utf-8").textBytes().slice(); }
  async #loadRecord(cursorId:number,options: OperationOptions, limit: number, started: number): Promise<void> {
    this.#borrow.invalidate();
    const chunks: Uint8Array[] = []; let length = 0;
    for (const chunk of { [Symbol.iterator]: () => this.#cursors.get(cursorId)!.payloadChunks() }) {
      this.#checkControl(options, limit, started);
      this.#work++; chunks.push(chunk); length += chunk.byteLength;
      // An overflow-page read is a bounded storage work unit and a host
      // checkpoint. PC and cursor stay on the current row while suspended.
      if (chunks.length > 1) {
        this.#state = "suspended";
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        this.#state = "running";
      }
    }
    this.#checkControl(options, limit, started);
    this.#work++; // record header/serial-type decoding
    const payload = new Uint8Array(length); let at = 0;
    for (const chunk of chunks) { payload.set(chunk, at); at += chunk.byteLength; }
    this.#records.set(cursorId,decodeRecord(payload, this.#program.database!.encoding));
  }
  async #chargeScalarInputs(values:readonly Mem[],options:OperationOptions,limit:number,started:number):Promise<void>{let units=0;for(const value of values)units+=Math.ceil(valueBytes(value)/256);for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;if(this.#work%256===0){this.#state="suspended";await new Promise<void>(resolve=>setTimeout(resolve,0));this.#state="running";}}}
  #checkResultValue(value:Mem):void {if(valueBytes(value)>this.#program.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");}
  #chargeValue(value:Mem,options:OperationOptions,limit:number,started:number):void { const bytes=valueBytes(value);const units=Math.ceil(bytes/256);for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;} }
  #mapExecutionError(error: unknown): unknown {
    // This is the single lazy execution boundary. Existing public errors retain
    // identity; only known storage provenance is classified here.
    if (error instanceof JSQLiteError) return error;
    if (error instanceof BtreeFormatError || error instanceof RecordFormatError)
      return new JSQLiteError("sqlite", error.message, { code: 11, extendedCode: 11, cause: error });
    if (error instanceof BtreeLimitError || error instanceof PrivateStateLimitError)
      return new JSQLiteError("limit", error.message, { cause: error });
    return error;
  }
  #checkControl(options: OperationOptions, limit: number, started: number): void {
    if (options.signal?.aborted) throw new JSQLiteError("cancelled", "statement execution was cancelled", { cause: options.signal.reason });
    if (options.timeoutMs !== undefined && Date.now() - started >= options.timeoutMs) throw new JSQLiteError("timeout", "statement execution timed out");
    if (this.#work >= limit) throw new JSQLiteError("limit", "statement exceeds maxWorkUnits");
  }
  #privateControl(options:OperationOptions,limit:number,started:number):PrivateStateControl {
    return {checkpoint:async(units=0)=>{
      if(!Number.isSafeInteger(units)||units<0)throw new JSQLiteError("internal","invalid private-state work charge");
      for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;if(this.#work%256===0){this.#state="suspended";await new Promise<void>(resolve=>setTimeout(resolve,0));this.#state="running"}}
      this.#checkControl(options,limit,started);
    }};
  }
  #halt(): unknown | null {
    this.#invalidateRow();this.#cursors.clear();this.#cursorRoots.clear();this.#records.clear();
    let diagnostic:unknown=null;
    for(const cursor of this.#privateCursors.values())try{cursor.close()}catch(error){if(diagnostic===null)diagnostic=error}
    this.#privateCursors.clear();this.#borrow.invalidate();
    return diagnostic;
  }
  #assertLive(): void { if (this.#state === "finalized") misuse("statement is finalized"); }
  #assertIdle(): void { this.#assertLive(); if (this.#state === "running" || this.#state === "suspended") misuse("statement operation is pending"); this.#assertConnectionIdle(); }
  #invalidateRow(): void { this.#rowStart = 0; this.#rowCount = 0; }
  #assertColumn(index: number, requireRow: boolean): void { this.#assertIdle(); if (!Number.isInteger(index) || index < 0 || index >= this.columnCount) range(); if (requireRow && this.#rowCount === 0) misuse("no current row"); }
  #cell(index: number): Mem { this.#assertColumn(index, true); return this.#registers[this.#rowStart + index]!; }
}
