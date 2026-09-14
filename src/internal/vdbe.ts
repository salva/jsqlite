// First compiled no-FROM scalar SELECT slice. The instruction/register split
// follows expr.c sqlite3ExprCode* and vdbe.c's opcode loop rather than evaluating
// the parsed ExprNode directly from Statement.step().
import type { ColumnMetadata, OperationOptions, SqliteStorageClass, SqliteValue, Statement, StepResult } from "../index.ts";
import { JSQLiteError } from "../index.ts";
import { BorrowLifetime, Mem, type MemAffinity, memFromPublic, memFromRawRecord, memToPublicInitial } from "./mem.ts";
import type { SelectNode } from "./parse.ts";
import { arithmeticBinary, bitwiseNot, logicalNot } from "./vdbe-primitives.ts";
import { compareMem, type BuiltinCollation } from "./comparison.ts";
import { decodeRecord } from "./record.ts";
import type { BtreeDatabase, TableScanCursor } from "./btree.ts";
import type { SchemaGraph } from "./schema.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";

type Op =
  | { readonly code: "Integer"; readonly p1: bigint; readonly p2: number }
  | { readonly code: "Copy"; readonly p1: number; readonly p2: number }
  | { readonly code: "Variable"; readonly p1: number; readonly p2: number }
  | { readonly code: "Subtract"; readonly p1: number; readonly p2: number; readonly p3: number }
  | { readonly code: "BitNot" | "Not"; readonly p1: number; readonly p2: number }
  | { readonly code: "OpenRead"; readonly p1: number }
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
}
interface ParameterBuilder { maximum: number; readonly names: (string | null)[]; readonly named: Map<string, number> }

function rejectUnsupportedSelectClauses(select: SelectNode): void {
  if (select.hasDistinct || select.hasGroupBy || select.hasHaving || select.hasOrderBy || select.hasLimit)
    throw new JSQLiteError("unsupported", "this SELECT clause is not implemented", { unsupportedClassification: "temporary" });
}

function compileExpression(expression: SelectNode["result"][number], ops: Op[], allocate: () => number, parameters: ParameterBuilder): { register: number; name: string } {
  const tokens = expression.tokens;
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
  return { register, name: expression.alias ?? tokens.map(token => token.text).join(" ") };
}

export function compileScalarSelect(select: SelectNode, maxWorkUnits = 10_000_000): Program {
  rejectUnsupportedSelectClauses(select);
  if (select.from.length || select.where !== null) throw new JSQLiteError("unsupported", "table SELECT compilation is not implemented", { unsupportedClassification: "temporary" });
  if (!select.result.length) throw new JSQLiteError("sqlite", "SELECT has no result columns", { code: 1 });
  const ops: Op[] = [];
  let maximum = 0;
  const allocate = () => ++maximum;
  const parameters: ParameterBuilder = { maximum: 0, names: [], named: new Map() };
  const expressions = select.result.map(expression => compileExpression(expression, ops, allocate, parameters));
  const resultStart = allocate();
  expressions.forEach((expression, index) => ops.push({ code: "Copy", p1: expression.register, p2: resultStart + index }));
  maximum += expressions.length - 1;
  ops.push({ code: "ResultRow", p1: resultStart, p2: expressions.length }, { code: "Halt" });
  return Object.freeze({ ops: Object.freeze(ops), registers: maximum, maxWorkUnits, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))), columns: Object.freeze(expressions.map(expression => Object.freeze({ name: expression.name, declaredType: null, database: null, table: null, origin: null }))) });
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
export function compileTableSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits = 10_000_000): Program {
  rejectUnsupportedSelectClauses(select);
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
  const projected: { column: number; name: string }[] = [];
  for (const expression of select.result) {
    if (expression.tokens.length === 1 && expression.tokens[0]!.text === "*") table.columns.forEach((c, i) => projected.push({ column: i, name: c.name }));
    else { const column = resolve(expression.tokens); projected.push({ column, name: expression.alias ?? table.columns[column]!.name }); }
  }
  let registers = projected.length;
  const ops: Op[] = [], scan=sqlite3WhereBegin(ops,table.rootPage);
  let ifNotIndex: number | undefined;
  if (select.where) {
    const t = select.where.tokens, eq = t.findIndex(x => x.text === "=" || x.text === "==");
    const sign = t[eq + 1]?.text === "+" || t[eq + 1]?.text === "-" ? t[eq + 1]!.text : "";
    const literal = t[eq + (sign ? 2 : 1)];
    if (eq < 1 || eq + (sign ? 3 : 2) !== t.length || literal?.kind !== "integer") throw new JSQLiteError("unsupported", "WHERE predicate is not implemented", { unsupportedClassification: "temporary" });
    const value = BigInt(sign + literal.text); if (value < -(1n<<63n) || value > (1n<<63n)-1n) throw new JSQLiteError("sqlite", "integer literal is out of range", {code:1});
    const columnIndex=resolve(t.slice(0,eq)), column=table.columns[columnIndex]!;
    const collationName=sqliteAsciiFold(column.collation ?? "binary");
    if (collationName!=="binary"&&collationName!=="nocase"&&collationName!=="rtrim") throw new JSQLiteError("unsupported", `collation is not implemented: ${column.collation}`, {unsupportedClassification:"temporary"});
    const a=++registers,b=++registers,o=++registers;
    ops.push({code:"Column",p1:columnIndex,p2:a},{code:"Integer",p1:value,p2:b},{code:"Eq",p1:a,p2:b,p3:o,affinity:column.affinity,collation:collationName});
    ifNotIndex=ops.length; ops.push({code:"IfNot",p1:o,p2:0});
  }
  const body=ops.length;
  projected.forEach((x,i)=>ops.push({code:"Column",p1:x.column,p2:i+1}));
  ops.push({code:"ResultRow",p1:1,p2:projected.length});
  const next=ops.length; sqlite3WhereEnd(ops,scan,select.where?scan.loopStart:body);
  if(ifNotIndex!==undefined) (ops[ifNotIndex] as {code:"IfNot";p1:number;p2:number}).p2=next;
  const columns=projected.map(x=>{const c=table.columns[x.column]!;return Object.freeze({name:x.name,declaredType:c.declaredType,database:"main",table:table.name,origin:c.name});});
  return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(columns),parameters:Object.freeze([]),table,database,maxRows,maxWorkUnits});
}

function misuse(message: string): never { throw new JSQLiteError("misuse", message); }
function range(): never { throw new JSQLiteError("sqlite", "column or parameter index out of range", { code: 25 }); }

export class VdbeStatement implements Statement {
  readonly #program: Program;
  readonly #registers: Mem[];
  readonly #onFinalize: () => void;
  readonly #bindings: Mem[];
  #pc = 0;
  #state: "prepared" | "row" | "done" | "failed" | "finalized" = "prepared";
  #rowStart = 0;
  #rowCount = 0;
  #cursor: TableScanCursor | null = null;
  #record: ReturnType<typeof decodeRecord> | null = null;
  #borrow = new BorrowLifetime();
  #rows = 0;
  #work = 0;
  #savedError: unknown = null;
  constructor(program: Program, onFinalize: () => void) {
    this.#program = program; this.#onFinalize = onFinalize;
    this.#registers = Array.from({ length: program.registers + 1 }, () => new Mem());
    this.#bindings = program.parameters.map(() => new Mem());
  }
  get columnCount(): number { return this.#program.columns.length; }
  get parameterCount(): number { return this.#program.parameters.length; }
  parameterName(index: number): string | null { this.#assertLive(); if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); return this.#program.parameters[index - 1]!.name; }
  parameterIndex(name: string): number { this.#assertLive(); const found = this.#program.parameters.findIndex(parameter => parameter.name === name); return found < 0 ? 0 : found + 1; }
  bind(indexOrName: number | string, value: SqliteValue): void { this.#assertLive(); if (this.#state === "row") misuse("statement is busy"); const index = typeof indexOrName === "string" ? this.parameterIndex(indexOrName) : indexOrName; if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); let bound: Mem; try { bound = memFromPublic(value, "utf-8"); } catch (error) { throw new JSQLiteError("misuse", (error as Error).message, { cause: error }); } this.#bindings[index - 1]!.moveFrom(bound); }
  clearBindings(): void { this.#assertLive(); this.#bindings.forEach(value => value.setNull()); }
  async step(options: OperationOptions = {}): Promise<StepResult> {
    this.#assertLive(); this.#invalidateRow();
    if (this.#state === "failed") throw this.#savedError;
    if (this.#state === "done") return "done";
    const requestedLimit = options.maxWorkUnits ?? this.#program.maxWorkUnits;
    const limit = Math.min(requestedLimit, this.#program.maxWorkUnits);
    if (!Number.isSafeInteger(limit) || limit < 0) misuse("maxWorkUnits must be a finite nonnegative safe integer");
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0)) misuse("timeoutMs must be finite and nonnegative");
    const started = Date.now();
    try {
      while (this.#pc < this.#program.ops.length) {
        if (options.signal?.aborted) throw new JSQLiteError("cancelled", "statement execution was cancelled", { cause: options.signal.reason });
        if (options.timeoutMs !== undefined && Date.now() - started >= options.timeoutMs) throw new JSQLiteError("timeout", "statement execution timed out");
        if (this.#work >= limit) throw new JSQLiteError("limit", "statement exceeds maxWorkUnits");
        if (this.#work !== 0 && this.#work % 256 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
        const op = this.#program.ops[this.#pc++]!; this.#work++;
        switch (op.code) {
          case "OpenRead": this.#cursor = this.#program.database!.tableScanCursor(op.p1); break;
          case "Rewind": if (!this.#cursor!.first()) this.#pc = op.p2; else this.#loadRecord(); break;
          case "Column": { const raw=this.#record!.values[op.p1] ?? {storageClass:"null" as const}; this.#registers[op.p2]!.moveFrom(memFromRawRecord(raw, this.#borrow)); break; }
          case "Eq": { const a=this.#registers[op.p1]!, b=this.#registers[op.p2]!, out=this.#registers[op.p3]!; a.applyAffinity(op.affinity,this.#program.database!.encoding); b.applyAffinity(op.affinity,this.#program.database!.encoding); out.setInt64(a.initialStorageClass!=="null" && b.initialStorageClass!=="null" && compareMem(a,b,op.collation)===0 ? 1n : 0n); break; }
          case "IfNot": if (this.#registers[op.p1]!.integerValue()===0n) this.#pc=op.p2; break;
          case "Next": if (this.#cursor!.next()) { this.#loadRecord(); this.#pc=op.p2; } break;
          case "Integer": this.#registers[op.p2]!.setInt64(op.p1); break;
          case "Copy": this.#registers[op.p2]!.copyFrom(this.#registers[op.p1]!); break;
          case "Variable": this.#registers[op.p2]!.copyFrom(this.#bindings[op.p1 - 1]!); break;
          case "Subtract": this.#registers[op.p3]!.moveFrom(arithmeticBinary("subtract", this.#registers[op.p1]!, this.#registers[op.p2]!)); break;
          case "BitNot": this.#registers[op.p2]!.moveFrom(bitwiseNot(this.#registers[op.p1]!)); break;
          case "Not": this.#registers[op.p2]!.moveFrom(logicalNot(this.#registers[op.p1]!)); break;
          case "ResultRow": if (++this.#rows > (this.#program.maxRows ?? Number.MAX_SAFE_INTEGER)) throw new JSQLiteError("limit", "statement exceeds maxRows"); this.#rowStart = op.p1; this.#rowCount = op.p2; this.#state = "row"; return "row";
          case "Halt": this.#state = "done"; return "done";
        }
      }
      this.#state = "done"; return "done";
    } catch (error) {
      this.#savedError = error; this.#state = "failed"; this.#halt(); throw error;
    }
  }
  reset(): void { this.#assertLive(); const error=this.#savedError; this.#savedError=null; this.#halt(); this.#rows=0; this.#work=0; this.#registers.forEach(value => value.setNull()); this.#pc = 0; this.#state = "prepared"; if(error!==null) throw error; }
  finalize(): void { if (this.#state === "finalized") misuse("statement is finalized"); const error=this.#savedError; this.#savedError=null; this.#halt(); this.#registers.forEach(value => value.release()); this.#bindings.forEach(value => value.release()); this.#state = "finalized"; this.#onFinalize(); if(error!==null) throw error; }
  columnMetadata(index: number): ColumnMetadata { this.#assertColumn(index, false); return Object.freeze({...this.#program.columns[index]!}); }
  columnType(index: number): SqliteStorageClass { return this.#cell(index).initialStorageClass; }
  column(index: number): SqliteValue { return memToPublicInitial(this.#cell(index)); }
  columnInteger(index: number): bigint | null { const cell = this.#cell(index); return cell.initialStorageClass === "null" ? null : cell.integerValue(); }
  columnReal(index: number): number | null { const cell = this.#cell(index); return cell.initialStorageClass === "null" ? null : cell.realValue(); }
  columnText(index: number): string | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const copy = new Mem(); copy.copyFrom(cell); copy.cast("text", "utf-8"); return copy.textValue(); }
  columnBlob(index: number): Uint8Array | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const value = memToPublicInitial(cell); return value instanceof Uint8Array ? value : memFromPublic(String(value), "utf-8").textBytes().slice(); }
  #loadRecord(): void { this.#borrow.invalidate(); this.#record=decodeRecord(this.#cursor!.payload(), this.#program.database!.encoding); }
  #halt(): void { this.#invalidateRow(); this.#cursor=null; this.#record=null; this.#borrow.invalidate(); }
  #assertLive(): void { if (this.#state === "finalized") misuse("statement is finalized"); }
  #invalidateRow(): void { this.#rowStart = 0; this.#rowCount = 0; }
  #assertColumn(index: number, requireRow: boolean): void { this.#assertLive(); if (!Number.isInteger(index) || index < 0 || index >= this.columnCount) range(); if (requireRow && this.#rowCount === 0) misuse("no current row"); }
  #cell(index: number): Mem { this.#assertColumn(index, true); return this.#registers[this.#rowStart + index]!; }
}
