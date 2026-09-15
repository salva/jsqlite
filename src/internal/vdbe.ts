// First compiled no-FROM scalar SELECT slice. The instruction/register split
// follows expr.c sqlite3ExprCode* and vdbe.c's opcode loop rather than evaluating
// the parsed ExprNode directly from Statement.step().
import type { ColumnMetadata, OperationOptions, SqliteStorageClass, SqliteValue, Statement, StepResult } from "../index.ts";
import { JSQLiteError } from "../index.ts";
import { BorrowLifetime, Mem, type MemAffinity, memFromPublic, memFromRawRecord, memToPublicInitial } from "./mem.ts";
import type { SelectNode } from "./parse.ts";
import { arithmeticBinary, bitwiseNot, booleanValue, logicalNot } from "./vdbe-primitives.ts";
import { compareMem, KeyInfo, type BuiltinCollation } from "./comparison.ts";
import { EphemeralIndexCursor, PrivateStateLimitError, SorterCursor, type PrivateStateControl } from "./private-state.ts";
import { decodeRecord, RecordFormatError } from "./record.ts";
import { BtreeFormatError, BtreeLimitError, type BtreeDatabase, type TableScanCursor } from "./btree.ts";
import type { SchemaGraph } from "./schema.ts";
import type { DatabaseEncoding } from "./record.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";
import type { LemonValue } from "./lemon-runtime.ts";
import type { SqlToken } from "./tokenize.ts";

type Expression =
 | {kind:"variable";spelling:string}
 | {kind:"mem";value:Mem;collation?:BuiltinCollation}
 | {kind:"literal";value:null|bigint|number|string|Uint8Array}
 | {kind:"column";index:number;name:string;collation?:BuiltinCollation;affinity?:MemAffinity}
 | {kind:"unary";op:string;value:Expression}
 | {kind:"binary";op:string;left:Expression;right:Expression}
 | {kind:"collate";value:Expression;collation:BuiltinCollation}
 | {kind:"cast";value:Expression;affinity:MemAffinity}
 | {kind:"call";name:string;args:Expression[]}
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
  | { readonly code: "CollSeq"; readonly collation:BuiltinCollation }
  | { readonly code: "ShortCircuit"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Boolean"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "NotNull"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Goto"; readonly p2:number }
  | { readonly code: "Subtract"; readonly p1: number; readonly p2: number; readonly p3: number }
  | { readonly code: "BitNot" | "Not"; readonly p1: number; readonly p2: number }
  | { readonly code: "OpenRead"; readonly p1: number }
  | { readonly code: "SorterOpen"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "SorterInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly payload:number; readonly payloadCount:number; readonly topN?:number }
  | { readonly code: "SorterSort"; readonly p1:number; readonly emptyJump:number }
  | { readonly code: "SorterData"; readonly p1:number; readonly p2:number; readonly count:number }
  | { readonly code: "SorterNext"; readonly p1:number; readonly p2:number }
  | { readonly code: "OpenEphemeral"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "Found"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly jump:number }
  | { readonly code: "IdxInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number }
  | { readonly code: "MustBeInt"; readonly p1:number }
  | { readonly code: "OffsetLimit"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "IfNotZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "IfPos"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "DecrJumpZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "Rewind"; readonly p2: number }
  | { readonly code: "Column"; readonly p1: number; readonly p2: number }
  | { readonly code: "Eq"; readonly p1: number; readonly p2: number; readonly p3: number; readonly affinity: MemAffinity; readonly collation: BuiltinCollation }
  | { readonly code: "IfNot"; readonly p1: number; readonly p2: number }
  | { readonly code: "Next"; readonly p2: number }
  | { readonly code: "ResultRow"; readonly p1: number; readonly p2: number }
  | { readonly code: "Halt" };
export interface ParameterDescriptor { readonly name: string | null }
interface Program {
  readonly ops: readonly Op[];
  readonly registers: number;
  readonly columns: readonly ColumnMetadata[];
  readonly parameters: readonly ParameterDescriptor[];
  readonly database?: BtreeDatabase;
  readonly maxRows?: number;
  readonly maxWorkUnits: number;
  readonly maxResultBytes: number;
  readonly encoding: DatabaseEncoding;
}
export function programOpcodeNames(program:Program):readonly string[]{return Object.freeze(program.ops.map(op=>op.code));}
export function programControlTargets(program:Program):readonly Readonly<{index:number;code:string;target:number;targetCode:string|undefined}>[]{
  return Object.freeze(program.ops.flatMap((op,index)=>{
    const target=op.code==="IfPos"||op.code==="DecrJumpZero"?op.p2:undefined;
    return target===undefined?[]:[Object.freeze({index,code:op.code,target,targetCode:program.ops[target]?.code})];
  }));
}
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
const FUNCTION_ARITIES: Readonly<Record<string, readonly number[]>> = Object.freeze({
  typeof: [1], length: [1], octet_length: [1], abs: [1], substr: [2, 3], nullif: [2], coalesce: [],
  min: [], max: [], char: [], hex: [1], replace: [3],
});
function exprLeaves(n:LemonValue<SqlToken>):SqlToken[]{return n.kind==="terminal"?(n.value?[n.value]:[]):n.children.flatMap(exprLeaves)}
function descendantExprs(n:LemonValue<SqlToken>):LemonValue<SqlToken>[] {if(n.kind!=="reduction")return[];const out:LemonValue<SqlToken>[]=[];for(const c of n.children){if(c.kind==="reduction"&&(c.signature.startsWith("expr ::=")||c.signature.startsWith("term ::=")))out.push(c);else out.push(...descendantExprs(c))}return out}
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
 if(sig.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){const name=sqliteAsciiFold(t[0]!.text),args=all.map(expressionFromReduction);if(name==="count")throw new JSQLiteError("unsupported","aggregate functions are not implemented",{unsupportedClassification:"temporary"});if(!(name in FUNCTION_ARITIES))throw new JSQLiteError("sqlite",`no such function: ${name}`,{code:1});if(name==="coalesce"?args.length<2:name==="min"||name==="max"?args.length<2:name==="char"?false:!FUNCTION_ARITIES[name]!.includes(args.length))throw new JSQLiteError("sqlite",`wrong number of arguments to function ${name}()`,{code:1});return{kind:"call",name,args}}
 if(sig.startsWith("expr ::= CASE")){const vals=all.map(expressionFromReduction),hasOperand=t[1]?.text.toUpperCase()!=="WHEN",hasElse=t.some(x=>x.text.toUpperCase()==="ELSE"),operand=hasOperand?vals.shift()!:null,otherwise=hasElse?vals.pop()!:null,pairs:[Expression,Expression][]=[];while(vals.length)pairs.push([vals.shift()!,vals.shift()!]);return{kind:"case",operand,pairs,otherwise}}
 throw new JSQLiteError("unsupported","SELECT expression is not implemented",{unsupportedClassification:"temporary"})
}

function expressionName(expression: SelectNode["result"][number]): string {
  if (expression.alias !== undefined) return expression.alias;
  return expression.tokens.map((token, index) => {
    const spaces = index ? " ".repeat(Math.max(0, token.startByte - expression.tokens[index - 1]!.endByte)) : "";
    return spaces + token.text;
  }).join("");
}


function rejectUnsupportedSelectClauses(select: SelectNode, relational = false): void {
  if (select.hasCompound || select.hasValues || select.hasSubquery)
    throw new JSQLiteError("unsupported", "compound SELECTs, VALUES, and subqueries are not implemented", { unsupportedClassification: "temporary" });
  if (select.hasGroupBy || select.hasHaving || (!relational && (select.hasDistinct || select.hasOrderBy)))
    throw new JSQLiteError("unsupported", "this SELECT clause is not implemented", { unsupportedClassification: "temporary" });
}

function compileExpressionTree(expression:Expression,ops:Op[],allocate:()=>number,parameters?:ParameterBuilder):number {
  const emit=(e:Expression):number=>compileExpressionTree(e,ops,allocate,parameters);
  if(expression.kind==="variable") { if(!parameters)throw new JSQLiteError("internal","missing parameter builder");const spelling=expression.spelling;let index:number;if(spelling==="?")index=parameters.maximum+1;else if(spelling[0]==="?")index=Number(spelling.slice(1));else index=parameters.named.get(spelling)??parameters.maximum+1;if(!Number.isSafeInteger(index)||index<1||index>32766)throw new JSQLiteError("sqlite","variable number must be between ?1 and ?32766",{code:1});if(spelling!=="?"&&!parameters.named.has(spelling))parameters.named.set(spelling,index);while(parameters.names.length<index)parameters.names.push(null);if(spelling!=="?"&&parameters.names[index-1]===null)parameters.names[index-1]=spelling;parameters.maximum=Math.max(parameters.maximum,index);const r=allocate();ops.push({code:"Variable",p1:index,p2:r});return r; }
  if(expression.kind==="literal") { const r=allocate(),v=expression.value;if(v===null)ops.push({code:"Null",p2:r});else if(typeof v==="bigint")ops.push({code:"Integer",p1:v,p2:r});else if(typeof v==="number")ops.push({code:"Real",p1:v,p2:r});else if(typeof v==="string")ops.push({code:"String",p1:v,p2:r});else ops.push({code:"Blob",p1:v,p2:r});return r; }
  if(expression.kind==="column") { const r=allocate();ops.push({code:"Column",p1:expression.index,p2:r});return r; }
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
  if(expression.kind==="mem")throw new JSQLiteError("internal","Mem expressions are execution-only");
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
function computeLimitRegisters(select:SelectNode,ops:Op[],allocate:()=>number,parameters:ParameterBuilder):LimitRegisters|undefined {
 if(!select.limit)return undefined;
 const count=compileExpressionTree(expressionFromReduction(select.limit.reduction!),ops,allocate,parameters);
 ops.push({code:"MustBeInt",p1:count});
 let offset:number|undefined;
 if(select.offset){offset=compileExpressionTree(expressionFromReduction(select.offset.reduction!),ops,allocate,parameters);ops.push({code:"MustBeInt",p1:offset});}
 const combined=allocate();if(offset===undefined){ops.push({code:"Copy",p1:count,p2:combined});}else ops.push({code:"OffsetLimit",p1:count,p2:combined,p3:offset});
 const capacity=allocate();ops.push({code:"Copy",p1:combined,p2:capacity});
 const ifZero=ops.length;ops.push({code:"IfNot",p1:count,p2:0});
 return {count,...(offset===undefined?{}:{offset}),combined,capacity,ifZero};
}

export function compileScalarSelect(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000): Program {
  rejectUnsupportedSelectClauses(select);
  if (select.from.length || select.where !== null) throw new JSQLiteError("unsupported", "table SELECT compilation is not implemented", { unsupportedClassification: "temporary" });
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
  return Object.freeze({ ops: Object.freeze(ops), registers: maximum, maxWorkUnits, maxResultBytes, encoding, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))), columns: Object.freeze(expressions.map(expression => Object.freeze({ name: expression.name, declaredType: null, database: null, table: null, origin: null }))) });
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

/** Initial resolve.c/select.c-shaped single rowid-table full-scan compiler. */
export function compileTableSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000): Program {
  rejectUnsupportedSelectClauses(select, true);
  if (select.from.length !== 1) throw new JSQLiteError("unsupported", "joins and complex FROM clauses are not implemented", { unsupportedClassification: "temporary" });
  const tableName = sqlName(select.from[0]!.text), folded = sqliteAsciiFold(tableName);
  const table = schema.tables.get(folded);
  if (!table) {
    if (schema.views.has(folded)) throw new JSQLiteError("unsupported", "views are not implemented", { unsupportedClassification: "temporary" });
    throw new JSQLiteError("sqlite", `no such table: ${tableName}`, { code: 1 });
  }
  if (table.withoutRowid || table.columns.some(c => c.generatedExpr)) throw new JSQLiteError("unsupported", "this table storage shape is not implemented", { unsupportedClassification: "temporary" });
  const resolve = (tokens: readonly { text: string }[]): number => {
    let name: string;
    if (tokens.length === 1) name = sqlName(tokens[0]!.text);
    else if (tokens.length === 3 && tokens[1]!.text === "." && sqliteIdentifierEqual(sqlName(tokens[0]!.text), table.name)) name = sqlName(tokens[2]!.text);
    else throw new JSQLiteError("unsupported", "table expression is not implemented", { unsupportedClassification: "temporary" });
    const at = table.columns.findIndex(c => sqliteIdentifierEqual(c.name, name));
    if (at < 0) throw new JSQLiteError("sqlite", `no such column: ${name}`, { code: 1 });
    return at;
  };
  const resolveExpression=(expression:SelectNode["result"][number]):Expression=>{const tree=expressionFromReduction(expression.reduction!);const assign=(e:Expression):void=>{if(e.kind==="column"){e.index=resolve([{text:e.name}]);const name=sqliteAsciiFold(table.columns[e.index]!.collation??"binary");if(name!=="binary"&&name!=="nocase"&&name!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${table.columns[e.index]!.collation}`,{code:1});e.collation=name;e.affinity=affinityOf(table.columns[e.index]!.declaredType??"");return}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")assign(e.value);else if(e.kind==="binary"){assign(e.left);assign(e.right)}else if(e.kind==="call")e.args.forEach(assign);else if(e.kind==="case"){if(e.operand)assign(e.operand);e.pairs.forEach(x=>{assign(x[0]);assign(x[1])});if(e.otherwise)assign(e.otherwise)}};assign(tree);return tree};
  // Resolve functions (including arity failures) before rejecting later planning
  // features, as resolve.c does during SELECT preparation.
  select.result.filter(x=>x.reduction).forEach(resolveExpression);
  const projected: { column?: number; expression?:Expression; name: string }[] = [];
  for (const expression of select.result) {
    if (expression.tokens.length === 1 && expression.tokens[0]!.text === "*") table.columns.forEach((c, i) => projected.push({ column: i, name: c.name }));
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
  projected.forEach((x,i)=>{if(x.column===undefined){const source=compileExpressionTree(x.expression!,ops,()=>++registers);ops.push({code:"Copy",p1:source,p2:i+1})}else ops.push({code:"Column",p1:x.column,p2:i+1})});
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
  const columns=projected.map(x=>{const c=x.column===undefined?null:table.columns[x.column]!;return Object.freeze({name:x.name,declaredType:c?.declaredType??null,database:c?"main":null,table:c?table.name:null,origin:c?.name??null});});
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze([]),table,database,maxRows,maxWorkUnits,maxResultBytes});
}


function truth(m:Mem):boolean|null{if(m.initialStorageClass==="null")return null;return booleanValue(m,0)===1}
const expressionAffinity=(x:Expression):MemAffinity|undefined=>x.kind==="column"?x.affinity:x.kind==="cast"?x.affinity:x.kind==="collate"?expressionAffinity(x.value):undefined;
const collation=(x:Expression):BuiltinCollation=>x.kind==="mem"&&x.collation?x.collation:x.kind==="collate"?x.collation:x.kind==="column"&&x.collation?x.collation:(x.kind==="unary"||x.kind==="cast")?collation(x.value):"binary";
// expr.c sqlite3BinaryCompareCollSeq: explicit left, then explicit right, then derived left/right.
const explicitCollation=(x:Expression):BuiltinCollation|undefined=>x.kind==="collate"?x.collation:(x.kind==="unary"||x.kind==="cast")?explicitCollation(x.value):undefined;
const binaryCollation=(left:Expression,right:Expression):BuiltinCollation=>explicitCollation(left)??explicitCollation(right)??collation(left)??collation(right);
function valueBytes(value:Mem):number{return value.initialStorageClass==="text"?value.textBytes().byteLength:value.initialStorageClass==="blob"?value.blobValue().byteLength:0;}
interface ScalarControl { charge(units:number):void; check():void; readonly maxResultBytes:number }
function evaluateFunction(name:string,a:Mem[],encoding:DatabaseEncoding,coll:"binary"|BuiltinCollation="binary",control?:ScalarControl):Mem{
 const out=new Mem(),charge=(units:number)=>control?.charge(units),checkSize=(bytes:number)=>{if(control&&bytes>control.maxResultBytes)throw new JSQLiteError("limit","string or blob too big")};if(name==="min"||name==="max"){if(a.some(x=>x.initialStorageClass==="null"))return out;let best=0;for(let i=1;i<a.length;i++){const cmp=compareMem(a[i]!,a[best]!,coll);if(name==="min"?cmp<=0:cmp>0)best=i}return a[best]!}if(name==="char"){let value="";for(const x of a){charge(1);let n=Number(x.integerValue());if(n<0||n>0x10ffff)n=0xfffd;value+=String.fromCodePoint(n)}const bytes=new TextEncoder().encode(value);checkSize(bytes.byteLength);out.setText(bytes,"utf-8");return out}if(name==="hex"){const c=a[0]!;if(c.initialStorageClass==="null"){out.setText(new Uint8Array(),"utf-8");return out}const bytes=c.initialStorageClass==="blob"?c.blobValue():c.initialStorageClass==="text"?c.textBytes():new TextEncoder().encode(String(memToPublicInitial(c)));checkSize(bytes.byteLength*2);charge(Math.ceil(bytes.byteLength/256));out.setText(new TextEncoder().encode(Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()),"utf-8");return out}if(name==="replace"){if(a.some(x=>x.initialStorageClass==="null"))return out;const source=a[0]!.textValue(),search=a[1]!.textValue().split("\0")[0]!,replacement=a[2]!.textValue();let value:string;if(!search)value=source;else{const count=source.split(search).length-1;const estimate=new TextEncoder().encode(source).byteLength+count*(new TextEncoder().encode(replacement).byteLength-new TextEncoder().encode(search).byteLength);checkSize(estimate);charge(Math.ceil(source.length/256)+count);value=source.split(search).join(replacement)}const bytes=new TextEncoder().encode(value);checkSize(bytes.byteLength);out.setText(bytes,"utf-8");return out}if(name==="typeof"){out.setText(new TextEncoder().encode(a[0]!.initialStorageClass),"utf-8");return out}if(name==="nullif"){if(a[0]!.initialStorageClass!=="null"&&a[1]!.initialStorageClass!=="null"&&compareMem(a[0]!,a[1]!,coll)===0)return out;return a[0]!}if(name==="octet_length"||name==="length"){if(a[0]!.initialStorageClass==="null")return out;const c=new Mem();c.copyFrom(a[0]!);if(c.initialStorageClass!=="text"&&c.initialStorageClass!=="blob")c.stringify(encoding);if(name==="octet_length")out.setInt64(BigInt(c.initialStorageClass==="blob"?c.blobValue().length:c.textBytes().length));else out.setInt64(BigInt(c.initialStorageClass==="blob"?c.blobValue().length:[...c.textValue().split("\0")[0]!].length));return out}if(name==="abs"){const c=a[0]!;if(c.initialStorageClass==="null")return out;if(c.initialStorageClass==="integer"){const n=c.integerValue();if(n===-(1n<<63n))throw new JSQLiteError("sqlite","integer overflow",{code:1});out.setInt64(n<0?-n:n)}else if(c.initialStorageClass==="real")out.setDouble(Math.abs(c.realValue()));else{const numeric=c.numericTypeCopy();out.setDouble(Math.abs(numeric.initialStorageClass==="integer"?Number(numeric.integerValue()):numeric.realValue()))}return out}if(name==="substr"){if(a.some(x=>x.initialStorageClass==="null"))return out;const blob=a[0]!.initialStorageClass==="blob",input=blob?a[0]!.blobValue():[...a[0]!.textValue().split("\0")[0]!],total=input.length;let p1=Number(a[1]!.integerValue()),p2=a[2]?Number(a[2]!.integerValue()):Number.MAX_SAFE_INTEGER;if(p1<0){p1+=total;if(p1<0){if(p2<0)p2=0;else p2+=p1;p1=0}}else if(p1>0)p1--;else if(p2>0)p2--;if(p2<0){p2=Math.min(-p2,p1);p1-=p2}p1=Math.max(0,p1);p2=Math.max(0,p2);const value=input.slice(p1,p1+p2);charge(Math.ceil(total/256));if(blob){const bytes=value as Uint8Array;checkSize(bytes.byteLength);out.setBlob(bytes)}else{const bytes=new TextEncoder().encode((value as string[]).join(""));checkSize(bytes.byteLength);out.setText(bytes,"utf-8")}return out}return out
}

function evaluateExpression(e:Expression,encoding:DatabaseEncoding,columns?:readonly Mem[]):Mem{
 const out=new Mem();if(e.kind==="variable")throw new JSQLiteError("internal","variables are compiled before execution");if(e.kind==="mem")return e.value;if(e.kind==="column"){out.copyFrom(columns![e.index]!);return out}if(e.kind==="literal"){if(e.value===null)out.setNull();else if(typeof e.value==="bigint")out.setInt64(e.value);else if(typeof e.value==="number")out.setDouble(e.value);else if(typeof e.value==="string")out.setText(new TextEncoder().encode(e.value),"utf-8");else out.setBlob(e.value);return out}
 if(e.kind==="unary"){const v=evaluateExpression(e.value,encoding,columns);if(e.op==="+")return v;if(e.op==="-"){const z=new Mem();z.setInt64(0n);return arithmeticBinary("subtract",z,v)}return e.op==="~"?bitwiseNot(v):logicalNot(v)}
 if(e.kind==="cast"){const v=evaluateExpression(e.value,encoding,columns);v.cast(e.affinity,encoding);return v}
 if(e.kind==="collate")return evaluateExpression(e.value,encoding,columns);
 if(e.kind==="binary"){const a=evaluateExpression(e.left,encoding,columns);if(e.op==="AND"&&truth(a)===false){out.setInt64(0n);return out}if(e.op==="OR"&&truth(a)===true){out.setInt64(1n);return out}const b=evaluateExpression(e.right,encoding,columns);if(e.op==="AND"||e.op==="OR"){const x=truth(a),y=truth(b),v=e.op==="AND"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?out.setNull():out.setInt64(v?1n:0n);return out}if(["+","-","*","/","%"].includes(e.op)){return arithmeticBinary(({"+":"add","-":"subtract","*":"multiply","/":"divide","%":"remainder"} as const)[e.op as "+"],a,b)}const is=e.op==="IS"||e.op==="IS NOT";if(!is&&(a.initialStorageClass==="null"||b.initialStorageClass==="null")){out.setNull();return out}const bothNull=a.initialStorageClass==="null"&&b.initialStorageClass==="null",oneNull=a.initialStorageClass==="null"||b.initialStorageClass==="null";let cmp=0;if(!oneNull)cmp=compareMem(a,b,binaryCollation(e.left,e.right));let result:boolean;switch(e.op){case "=":case "==":result=cmp===0;break;case "IS":result=bothNull||(!oneNull&&cmp===0);break;case "!=":case "<>":result=cmp!==0;break;case "IS NOT":result=!bothNull&&(oneNull||cmp!==0);break;case "<":result=cmp<0;break;case "<=":result=cmp<=0;break;case ">":result=cmp>0;break;default:result=cmp>=0}out.setInt64(result?1n:0n);return out}
 if(e.kind==="case"){const base=e.operand?evaluateExpression(e.operand,encoding,columns):null;for(const [w,r] of e.pairs){const test=evaluateExpression(w,encoding,columns);if(base?(base.initialStorageClass!=="null"&&test.initialStorageClass!=="null"&&compareMem(base,test,"binary")===0):truth(test)===true)return evaluateExpression(r,encoding,columns)}return e.otherwise?evaluateExpression(e.otherwise,encoding,columns):out}
 const args=()=>e.args.map(x=>evaluateExpression(x,encoding,columns));if(e.name==="coalesce"){for(const x of e.args){const v=evaluateExpression(x,encoding,columns);if(v.initialStorageClass!=="null")return v}return out}const a=args();return evaluateFunction(e.name,a,encoding,e.args.map(collation).find((_,i)=>e.args[i]!.kind==="collate")??"binary")
}

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
  #cursor: TableScanCursor | null = null;
  #record: ReturnType<typeof decodeRecord> | null = null;
  #privateCursors = new Map<number, SorterCursor | EphemeralIndexCursor>();
  #borrow = new BorrowLifetime();
  #rows = 0;
  #work = 0;
  #savedError: unknown = null;
  constructor(program: Program, assertConnectionIdle: () => void, admit: () => () => void, onFinalize: () => void) {
    this.#program = program; this.#assertConnectionIdle = assertConnectionIdle; this.#admit = admit; this.#onFinalize = onFinalize;
    this.#registers = Array.from({ length: program.registers + 1 }, () => new Mem());
    this.#bindings = program.parameters.map(() => new Mem());
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
          case "OpenRead": this.#cursor = this.#program.database!.tableScanCursor(op.p1); break;
          case "MustBeInt": {const value=this.#registers[op.p1]!;let integer:bigint;if(value.initialStorageClass==="integer")integer=value.integerValue();else if(value.initialStorageClass==="real"&&Number.isInteger(value.realValue())&&value.realValue()>=-9223372036854775808&&value.realValue()<9223372036854775808)integer=BigInt(value.realValue());else if(value.initialStorageClass==="text"&&/^[+-]?[0-9]+$/.test(value.textValue())){integer=BigInt(value.textValue());if(integer<-(1n<<63n)||integer>=(1n<<63n))throw new JSQLiteError("sqlite","datatype mismatch",{code:20});}else throw new JSQLiteError("sqlite","datatype mismatch",{code:20});value.setInt64(integer);break;}
          case "OffsetLimit": {const count=this.#registers[op.p1]!.integerValue(),offset=this.#registers[op.p3]!.integerValue();const positive=offset>0n?offset:0n,sum=count+positive;this.#registers[op.p2]!.setInt64(count<=0n||sum>(1n<<63n)-1n?-1n:sum);break;}
          case "IfNotZero": {const value=this.#registers[op.p1]!.integerValue();if(value!==0n){if(value>0n)this.#registers[op.p1]!.setInt64(value-1n);this.#pc=op.p2;}break;}
          case "IfPos": {const value=this.#registers[op.p1]!.integerValue();if(value>0n){this.#registers[op.p1]!.setInt64(value-BigInt(op.p3));this.#pc=op.p2;}break;}
          case "DecrJumpZero": {const value=this.#registers[op.p1]!.integerValue(),next=value>-(1n<<63n)?value-1n:value;this.#registers[op.p1]!.setInt64(next);if(next===0n)this.#pc=op.p2;break;}
          case "SorterOpen": this.#privateCursors.set(op.p1,new SorterCursor(op.keyInfo,{maxEntries:this.#program.maxRows??100000,maxKeyBytes:this.#program.maxResultBytes,maxBytes:this.#program.maxResultBytes}));break;
          case "OpenEphemeral": this.#privateCursors.set(op.p1,new EphemeralIndexCursor(op.keyInfo,{maxEntries:this.#program.maxRows??100000,maxKeyBytes:this.#program.maxResultBytes,maxBytes:this.#program.maxResultBytes}));break;
          case "SorterInsert": {const cursor=this.#privateCursors.get(op.p1) as SorterCursor,key=this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),payload=this.#registers.slice(op.payload,op.payload+op.payloadCount),control=this.#privateControl(options,limit,started);if(op.topN!==undefined){const capacity=this.#registers[op.topN]!.integerValue();if(capacity>=0n)await cursor.insertBounded(key,payload,capacity,control);else await cursor.insert(key,payload,control);}else await cursor.insert(key,payload,control);break;}
          case "SorterSort": {const cursor=this.#privateCursors.get(op.p1) as SorterCursor;await cursor.sort(this.#privateControl(options,limit,started));if(!cursor.first())this.#pc=op.emptyJump;break;}
          case "SorterData": {const values=(this.#privateCursors.get(op.p1) as SorterCursor).data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "SorterNext": if((this.#privateCursors.get(op.p1) as SorterCursor).next())this.#pc=op.p2;break;
          case "Found": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor;if(await cursor.found(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started)))this.#pc=op.jump;break;}
          case "IdxInsert": await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).insert(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started));break;
          case "Rewind": if (!this.#cursor!.first()) this.#pc = op.p2; else await this.#loadRecord(options, limit, started); break;
          case "Column": { const raw=this.#record!.values[op.p1] ?? {storageClass:"null" as const}; this.#registers[op.p2]!.moveFrom(memFromRawRecord(raw, this.#borrow)); break; }
          case "Eq": { const a=this.#registers[op.p1]!, b=this.#registers[op.p2]!, out=this.#registers[op.p3]!; a.applyAffinity(op.affinity,this.#program.database!.encoding); b.applyAffinity(op.affinity,this.#program.database!.encoding); out.setInt64(a.initialStorageClass!=="null" && b.initialStorageClass!=="null" && compareMem(a,b,op.collation)===0 ? 1n : 0n); break; }
          case "IfNot": if (truth(this.#registers[op.p1]!)!==true) this.#pc=op.p2; break;
          case "Next": if (this.#cursor!.next()) { await this.#loadRecord(options, limit, started); this.#pc=op.p2; } break;
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
          case "Function": case "PureFunc": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const control:ScalarControl={maxResultBytes:this.#program.maxResultBytes,check:()=>this.#checkControl(options,limit,started),charge:(units)=>{for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;}}};this.#registers[op.p2]!.moveFrom(runFunctionContext(()=>evaluateFunction(op.name,args,this.#program.encoding,op.collation,control)));break;}
          case "ShortCircuit": {const value=truth(this.#registers[op.p1]!);if((op.kind==="and"&&value===false)||(op.kind==="or"&&value===true)){this.#registers[op.p2]!.setInt64(op.kind==="and"?0n:1n);this.#pc=op.jump}break;}
          case "Boolean": {const x=truth(this.#registers[op.p1]!),y=truth(this.#registers[op.p2]!),v=op.kind==="and"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?this.#registers[op.p3]!.setNull():this.#registers[op.p3]!.setInt64(v?1n:0n);break;}
          case "NotNull": if(this.#registers[op.p1]!.initialStorageClass!=="null"){this.#registers[op.p2]!.copyFrom(this.#registers[op.p1]!);this.#pc=op.jump}break;
          case "Variable": this.#registers[op.p2]!.copyFrom(this.#bindings[op.p1 - 1]!); break;
          case "Subtract": this.#registers[op.p3]!.moveFrom(arithmeticBinary("subtract", this.#registers[op.p1]!, this.#registers[op.p2]!)); break;
          case "BitNot": this.#registers[op.p2]!.moveFrom(bitwiseNot(this.#registers[op.p1]!)); break;
          case "Not": this.#registers[op.p2]!.moveFrom(logicalNot(this.#registers[op.p1]!)); break;
          case "ResultRow": if (++this.#rows > (this.#program.maxRows ?? Number.MAX_SAFE_INTEGER)) throw new JSQLiteError("limit", "statement exceeds maxRows"); this.#rowStart = op.p1; this.#rowCount = op.p2; this.#state = "row"; return "row";
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
  async #loadRecord(options: OperationOptions, limit: number, started: number): Promise<void> {
    this.#borrow.invalidate();
    const chunks: Uint8Array[] = []; let length = 0;
    for (const chunk of { [Symbol.iterator]: () => this.#cursor!.payloadChunks() }) {
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
    this.#record=decodeRecord(payload, this.#program.database!.encoding);
  }
  async #chargeScalarInputs(values:readonly Mem[],options:OperationOptions,limit:number,started:number):Promise<void>{let units=0;for(const value of values)units+=Math.ceil(valueBytes(value)/256);for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;if(this.#work%256===0){this.#state="suspended";await new Promise<void>(resolve=>setTimeout(resolve,0));this.#state="running";}}}
  #chargeValue(value:Mem,options:OperationOptions,limit:number,started:number):void { const bytes=valueBytes(value);if(bytes>this.#program.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");const units=Math.ceil(bytes/256);for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;} }
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
    this.#invalidateRow();this.#cursor=null;this.#record=null;
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
