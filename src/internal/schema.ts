import { btreeFromConnection, BtreeCursorStateError, BtreeFormatError } from "./btree.ts";
import { decodeRecord, RecordFormatError, type DatabaseEncoding, type RawRecordValue } from "./record.ts";
import { parseSql, SqlParseError, type ExprNode, type SchemaDdlNode, type SelectNode } from "./parse.ts";
import { storageOwner, type StorageOwnerCarrier } from "./storage.ts";
import { type SqlToken } from "./tokenize.ts";
import { decodeSqliteText } from "./utf.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";
import { Mem } from "./mem.ts";
import { KeyInfo, type BuiltinCollation } from "./comparison.ts";

/** A malformed sqlite_schema row or declaration. */
export class SchemaFormatError extends Error {
  constructor(message: string, options: ErrorOptions = {}) { super(message, options); this.name = "SchemaFormatError"; }
}
/** A recognized schema construct whose construction is staged for a later slice. */
export class SchemaUnsupportedError extends Error {
  readonly classification = "temporary" as const;
  constructor(message: string) { super(message); this.name = "SchemaUnsupportedError"; }
}
export class SchemaStateError extends Error {
  constructor(message: string) { super(message); this.name = "SchemaStateError"; }
}

export interface ColumnNode {
  readonly name: string;
  readonly szEst: number;
  readonly declaredType: string | null;
  readonly affinity: "blob" | "text" | "numeric" | "integer" | "real" | "flexnum";
  readonly defaultExpr: ExprNode | null;
  readonly generatedExpr: ExprNode | null;
  readonly defaultIndex: number | null;
  readonly notNull: boolean;
  readonly primaryKeyPosition: number | null;
  readonly unique: boolean;
  readonly collation: string | null;
  readonly generatedStorage: "stored" | "virtual" | null;
  readonly checks: readonly CheckConstraintNode[];
}
export interface CheckConstraintNode { readonly name: string | null; readonly column: ColumnNode | null; readonly expr: ExprNode; readonly sql: string; }
export interface ForeignKeyColumnNode { readonly column: ColumnNode; readonly referencedColumn: string | null; }
export interface ForeignKeyNode { readonly name: string | null; readonly columns: readonly ForeignKeyColumnNode[]; readonly referencedTableName: string; readonly referencedTable: TableNode | null; readonly onDelete: import("./parse.ts").ForeignKeyAction; readonly onUpdate: import("./parse.ts").ForeignKeyAction; readonly deferrable: boolean; readonly initiallyDeferred: boolean; readonly sql: string; }
export interface IndexTerm { readonly column: ColumnNode | null; readonly expression: ExprNode | null; readonly expressionSql: string | null; readonly descending: boolean; readonly collation: string | null; readonly nulls: "first" | "last" | null; }
export interface TableNode {
  readonly szTabRow: number;
  /** build.c sqlite3AddPrimaryKey identity; null means no rowid alias. */
  readonly integerPrimaryKey?: ColumnNode | null;
  readonly nRowLogEst: number;
  readonly hasStat1: boolean;
  readonly kind: "table";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: number;
  readonly sql: string;
  readonly columns: readonly ColumnNode[];
  readonly indexes: IndexNode[];
  readonly withoutRowid: boolean;
  /** select.c TF_NoVisibleRowid; independent of physical WITHOUT ROWID storage. */
  readonly noVisibleRowid?: boolean;
  readonly primaryKey: readonly ColumnNode[];
  readonly primaryKeyTerms: readonly IndexTerm[];
  readonly storageKey: readonly ColumnNode[];
  readonly checks: readonly CheckConstraintNode[];
  readonly foreignKeys: readonly ForeignKeyNode[];
  readonly referencedBy: readonly ForeignKeyNode[];
}
export interface IndexNode {
  readonly szIdxRow: number;
  readonly rowLogEst: readonly number[];
  readonly hasStat1: boolean;
  readonly unordered: boolean;
  readonly noSkipScan: boolean;
  readonly kind: "index";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: number;
  readonly sql: string | null;
  readonly table: TableNode;
  readonly terms: readonly IndexTerm[];
  readonly unique: boolean;
  readonly onError:string;
  readonly origin: "create" | "primary-key" | "unique";
  readonly partialWhere: ExprNode | null;
  /** Immutable packed-key identity, built exactly once with the schema. */
  readonly physical: PhysicalIndex | null;
  readonly layout: PhysicalIndexLayout;
}
/** Single immutable estimate owner: accessor retained for existing consumers. */
export interface IndexStatistics { readonly rowLogEst: readonly number[]; readonly unordered:boolean }
export function statisticsForIndex(index:IndexNode):IndexStatistics {return index;}
/** util.c:sqlite3LogEst, including its small integer rounding table. */
export function sqliteLogEst(value:bigint):number {
 if(value<2n)return 0;
 let x=value,y=40;
 if(x<8n){while(x<8n){y-=10;x<<=1n;}}
 else {while(x>255n){y+=40;x>>=4n;}while(x>15n){y+=10;x>>=1n;}}
 return [0,2,3,5,6,7,8,9][Number(x&7n)]!+y-10;
}
export interface PhysicalIndexField { readonly role:"declared"|"primary-key-suffix"|"stored-column"|"rowid-tail"; readonly column:ColumnNode|null; readonly expression:ExprNode|null; readonly collation:BuiltinCollation; readonly descending:boolean; readonly nullsLarge:false }
/** Source record ownership independent of executable CollSeq/KeyInfo. */
export interface PhysicalIndexLayout { readonly fields:readonly (Omit<PhysicalIndexField,"collation"> & {readonly collation:string})[]; readonly declaredFieldCount:number; readonly rowidField:number; readonly primaryKeyFields:readonly number[] }
export interface PhysicalIndex { readonly index:IndexNode; readonly fields:readonly PhysicalIndexField[]; readonly declaredFieldCount:number; readonly rowidField:number; /** Exact secondary-record field ordinal for each primary KeyInfo term, in PK order. */ readonly primaryKeyFields:readonly number[]; readonly keyInfo:KeyInfo }
/** Historical name retained for internal consumers that construct synthetic
 * rowid schemas. The represented physical descriptor now also covers WITHOUT
 * ROWID indexes. */
export type PhysicalRowidIndex = PhysicalIndex;
export interface ViewNode {
  readonly kind: "view";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: 0;
  readonly sql: string;
  readonly selectSql: string;
  readonly select: SelectNode;
  readonly columns: readonly string[];
}
export type SchemaObject = TableNode | IndexNode | ViewNode;

interface SchemaRow { type: string; name: string; tableName: string; rootPage: number; sql: string | null; }

function malformed(message: string, cause?: unknown): never {
  throw new SchemaFormatError(`malformed database schema: ${message}`, cause === undefined ? {} : { cause });
}
function text(value: RawRecordValue, encoding: DatabaseEncoding, field: string): string {
  if (value.storageClass !== "text") malformed(`${field} is not text`);
  return decodeSqliteText(value.bytes, encoding);
}
function rootPage(value: RawRecordValue): number {
  if (value.storageClass !== "integer" || value.value < 0n || value.value > BigInt(Number.MAX_SAFE_INTEGER)) {
    malformed("rootpage is not a nonnegative integer");
  }
  return Number(value.value);
}
function row(payload: Uint8Array, encoding: DatabaseEncoding): SchemaRow {
  try {
    const values = decodeRecord(payload, encoding);
    if (values.values.length !== 5) malformed("sqlite_schema row does not have five columns");
    const [typeValue, nameValue, tableValue, rootValue, sqlValue] = values.values;
    const type = text(typeValue!, encoding, "type").toLowerCase();
    const name = text(nameValue!, encoding, "name");
    const tableName = text(tableValue!, encoding, "tbl_name");
    const root = rootPage(rootValue!);
    const sql = sqlValue!.storageClass === "null" ? null : text(sqlValue!, encoding, "sql");
    return { type, name, tableName, rootPage: root, sql };
  } catch (error) {
    if (error instanceof SchemaFormatError) throw error;
    if (error instanceof RecordFormatError) malformed(error.message, error);
    throw error;
  }
}

function identifier(token: SqlToken | undefined): string {
  if (!token || (token.kind !== "id" && token.kind !== "keyword")) malformed("expected identifier");
  const value = token.text;
  if (value[0] === "[" && value.at(-1) === "]") return value.slice(1, -1);
  if ((value[0] === '"' || value[0] === "`") && value.at(-1) === value[0]) return value.slice(1, -1).replaceAll(value[0] + value[0], value[0]);
  return value;
}
/** util.c sqlite3GetInt32/sqlite3Atoi: failure leaves the initialized zero. */
export function sqliteAtoi(z:string):number {
 let neg=false;
 if(z[0]==="-"||z[0]==="+"){neg=z[0]==="-";z=z.slice(1);}
 else if(/^0[xX][0-9a-fA-F]/.test(z)){
  z=z.slice(2).replace(/^0+/,"");const digits=z.match(/^[0-9a-fA-F]*/)?.[0]??"";
  if(digits.length>8)return 0;const v=digits?BigInt("0x"+digits):0n;return v>2147483647n?0:Number(v);
 }
 if(!/^[0-9]/.test(z))return 0;
 const digits=z.replace(/^0+/,"").match(/^[0-9]*/)?.[0]??"";
 if(digits.length>10)return 0;const v=BigInt(digits||"0");
 return v-(neg?1n:0n)>2147483647n?0:Number(neg?-v:v);
}
/** build.c sqlite3AddColumn/ sqlite3AffinityType, including retained CHAR pointer. */
export function columnTypeEstimate(declaredType:string|null):{affinity:ColumnNode["affinity"];szEst:number} {
 if(!declaredType)return {affinity:"blob",szEst:1};
 const z=sqliteAsciiFold(declaredType);let aff:ColumnNode["affinity"]="numeric",charAt:number|null=null;
 for(let i=1;i<=z.length;i++){
  const h=z.slice(Math.max(0,i-4),i);
  if(h==="char"){aff="text";charAt=i;}
  else if(h==="clob"||h==="text")aff="text";
  else if(h==="blob"&&(aff==="numeric"||aff==="real")){aff="blob";if(z[i]==="(")charAt=i;}
  else if(["real","floa","doub"].includes(h)&&aff==="numeric")aff="real";
  else if(h.endsWith("int")){aff="integer";break;}
 }
 let v=0;
 if(aff==="text"||aff==="blob"){
  if(charAt===null)v=16;
  else {const tail=z.slice(charAt),at=tail.search(/[0-9]/);if(at>=0)v=sqliteAtoi(tail.slice(at));}
 }
 return {affinity:aff,szEst:Math.min(255,Math.trunc(v/4)+1)};
}
type Mutable<T>={-readonly [K in keyof T]:T[K]};
function defaultRowEst(index:IndexNode):void {
 const table=index.table as Mutable<TableNode>;table.nRowLogEst=Math.max(99,table.nRowLogEst);
 const defaults=[33,32,30,28,26];const rows=[table.nRowLogEst-(index.partialWhere?10:0),...index.terms.map((_,i)=>defaults[i]??23)];
 if(index.unique)rows[index.terms.length]=0;
 (index as Mutable<IndexNode>).rowLogEst=rows;
}
/** Count-bearing sample prefix shared by schema loading and its consumers. */
export interface Stat4SampleCounts {
 readonly anEq: readonly bigint[];
 readonly anLt: readonly bigint[];
 readonly anDLt: readonly bigint[];
}
export interface Stat4AverageState {
 readonly samples: readonly Stat4SampleCounts[];
 readonly nSample: number;
 readonly nSampleCol: number;
 nRowEst0: bigint;
 readonly aAvgEq: bigint[];
}
/** analyze.c:initAvgEq. tRowcnt is u64, not signed i64: usual C arithmetic
 * conversions make products/division unsigned where a row count participates.
 * Only assignment to nDist100 reinterprets the resulting bits as signed. */
export function initStat4AvgEq(state: Stat4AverageState, nKeyCol: number, aiRowEst: readonly bigint[] | null): void {
 const final = state.samples[state.nSample - 1];
 if (!final) throw new SchemaStateError("statistics average requires an accepted sample");
 const u64 = (v: bigint) => BigInt.asUintN(64, v);
 const i64 = (v: bigint) => BigInt.asIntN(64, v);
 let nCol = 1;
 if (state.nSampleCol > 1) { nCol = state.nSampleCol - 1; state.aAvgEq[nCol] = 1n; }
 for (let col = 0; col < nCol; col++) {
  let nSample = state.nSample, nRow: bigint, nDist100: bigint;
  if (!aiRowEst || col >= nKeyCol || aiRowEst[col + 1] === 0n) {
   nRow = final.anLt[col]!;
   nDist100 = i64(u64(100n * final.anDLt[col]!));
   nSample--;
  } else {
   nRow = aiRowEst[0]!;
   nDist100 = i64(u64(100n * nRow) / aiRowEst[col + 1]!);
  }
  state.nRowEst0 = nRow;
  let sumEq = 0n, nSum100 = 0n;
  for (let i = 0; i < nSample; i++) {
   if (i === state.nSample - 1 || state.samples[i]!.anDLt[col] !== state.samples[i + 1]!.anDLt[col]) {
    sumEq = u64(sumEq + state.samples[i]!.anEq[col]!);
    nSum100 = i64(nSum100 + 100n);
   }
  }
  let avgEq = 0n;
  if (nDist100 > nSum100 && sumEq < nRow) {
   avgEq = u64(100n * u64(nRow - sumEq)) / u64(i64(nDist100 - nSum100));
  }
  state.aAvgEq[col] = avgEq === 0n ? 1n : avgEq;
 }
}

/** analyze.c decodeIntArray: zero allocated counts, uint64 accumulation.
 * Reused aiRowEst destinations preserve untouched trailing slots. */
export function decodeStat4Counts(z: string | null, nOut: number, out: bigint[] = Array<bigint>(nOut).fill(0n)): bigint[] {
 if (!Number.isSafeInteger(nOut) || nOut < 0 || out.length !== nOut) throw new SchemaStateError("invalid statistics count array capacity");
 decodeCountPrefix(z ?? "", nOut, (i, value) => { out[i] = value; });
 return out;
}
/** Shared numeric producer, not a second STAT4 text parser. */
function decodeCountPrefix(z: string, nOut: number, put: (i: number, value: bigint) => void): number {
 let at = 0;
 for (let i = 0; i < nOut && at < z.length && z[at] !== "\0"; i++) {
  let value = 0n;
  while (at < z.length && z[at]! >= "0" && z[at]! <= "9") {
   value = BigInt.asUintN(64, value * 10n + BigInt(z.charCodeAt(at++) - 48));
  }
  put(i, value);
  if (z[at] === " ") at++;
 }
 return at;
}
function decodeEstimates(z:string,rows:number[],width:number):{rows:number[];width:number;unordered:boolean;noSkipScan:boolean} {
 let at=decodeCountPrefix(z,rows.length,(i,v)=>{rows[i]=sqliteLogEst(v);});
 let unordered=false,noSkipScan=false;
 while(at<z.length){const tail=z.slice(at);
  if(tail.startsWith("unordered"))unordered=true;
  else if(/^sz=[0-9]/.test(tail))width=sqliteLogEst(BigInt(Math.max(2,sqliteAtoi(tail.slice(3)))));
  else if(tail.startsWith("noskipscan"))noSkipScan=true;
  while(at<z.length&&z[at]!==" ")at++;while(z[at]===" ")at++;
 }
 return {rows,width,unordered,noSkipScan};
}
/** sqlite3_exec callback column_text: database BLOB encoding then UTF8, C NUL. */
function callbackText(raw:RawRecordValue,encoding:DatabaseEncoding):string|null {
 if(raw.storageClass==="null")return null;
 const mem=new Mem();
 if(raw.storageClass==="text"||raw.storageClass==="blob")mem.setText(raw.bytes,encoding);
 else if(raw.storageClass==="integer")mem.setInt64(raw.value);
 else mem.setDouble(raw.value);
 try {
  mem.cast("text","utf-8");
  // legacy.c sqlite3_exec passes column_text bytes to analysisLoader. Hash
  // lookup and decodeIntArray inspect those bytes; READ_UTF8 would collapse
  // overlong non-ASCII names into a different, valid schema name.
  let text="";for(const byte of mem.textBytes()){if(byte===0)break;text+=String.fromCharCode(byte);}return text;
 }finally{mem.release();}
}
// build.c exit_create_index: only the first REPLACE may be out of order.
function linkIndex(table:TableNode,index:IndexNode):void {
 table.indexes.unshift(index);
 let at=table.indexes.findIndex(candidate=>candidate.onError==="replace");
 if(at<0)return;
 while(at+1<table.indexes.length&&table.indexes[at+1]!.onError!=="replace"){
  const next=table.indexes.splice(at+1,1)[0]!;table.indexes.splice(at,0,next);at++;
 }
}
/** build.c sqlite3AddPrimaryKey: identity before WR conversion, not storage
 * alias after conversion. Both rowid publication and delayed PK use it. */
function declaredIntegerPrimaryKey(columns:readonly ColumnNode[],ddl:SchemaDdlNode):ColumnNode|null {
  const names=ddl.primaryKey.length?ddl.primaryKey:ddl.columns.filter(c=>c.primaryKey).map(c=>c.name);
  const column=names.length===1?columns.find(c=>sqliteIdentifierEqual(c.name,names[0]!)):undefined;
  return column?.declaredType?.toUpperCase()==="INTEGER"&&
    (ddl.primaryKey.length>0||!ddl.columns.find(c=>sqliteIdentifierEqual(c.name,column.name))?.primaryKeyDescending)?column:null;
}
function implicitIndexDefinitions(table:Pick<TableNode,"columns"|"name"|"integerPrimaryKey"|"withoutRowid">,ddl:SchemaDdlNode):{terms:readonly IndexTerm[];primary:boolean;onError:string;listPosition:number}[]{
  const rowidAlias=table.integerPrimaryKey!==null&&!table.withoutRowid;
  // build.c sqlite3CreateIndex: grammar actions run in declaration
  // order; equal column/collation sequences merge ignoring direction.
  const linked:typeof implicit=[];
  const implicit:{terms:readonly IndexTerm[];primary:boolean;onError:string;listPosition:number}[]=[];
  // build.c convertToWithoutRowidTable delays INTEGER rowid-alias PK
  // creation until after all grammar indexes, even for WITHOUT ROWID.
  const delayed=table.withoutRowid&&declaredIntegerPrimaryKey(table.columns,ddl)!==null;
  const constraints=delayed?[...ddl.implicitConstraints.filter(c=>!c.primary),...ddl.implicitConstraints.filter(c=>c.primary)]:ddl.implicitConstraints;
  for(const constraint of constraints){
    if(constraint.primary&&rowidAlias)continue;
    const terms=Object.freeze(constraint.terms.map(term=>{
      const tokens=term.expr.tokens,simple=tokens.length===1?identifier(tokens[0]):null;
      const column=simple===null?undefined:table.columns.find(c=>sqliteIdentifierEqual(c.name,simple));
      if(!column)throw new SchemaUnsupportedError(`expression implicit index is not implemented: ${table.name}`);
      return Object.freeze({column,expression:null,expressionSql:null,descending:term.descending,collation:term.collation??column.collation,nulls:term.nulls}) as IndexTerm;
    }));
    const prior=implicit.find(index=>index.terms.length===terms.length&&index.terms.every((term,i)=>term.column===terms[i]!.column&&sqliteIdentifierEqual(term.collation??"BINARY",terms[i]!.collation??"BINARY")));
    if(prior){
      if(prior.onError!==constraint.onError){
        if(prior.onError!=="default"&&constraint.onError!=="default")throw new SchemaFormatError(`malformed database schema (${table.name}) - conflicting ON CONFLICT clauses specified`);
        if(prior.onError==="default")prior.onError=constraint.onError;
      }
      if(constraint.primary)prior.primary=true;reorder();continue;
    }
    const definition={terms,primary:constraint.primary,onError:constraint.onError,listPosition:0};
    implicit.push(definition);linked.unshift(definition);reorder();
  }
  function reorder():void {
    let at=linked.findIndex(index=>index.onError==="replace");
    if(at>=0)while(at+1<linked.length&&linked[at+1]!.onError!=="replace"){
      const next=linked.splice(at+1,1)[0]!;linked.splice(at,0,next);at++;
    }
    linked.forEach((index,position)=>index.listPosition=position);
  }
  return implicit;
}
function parseDdl(sql: string, expected: SchemaDdlNode["kind"], name: string): SchemaDdlNode {
  try {
    const parsed = parseSql(sql);
    if (parsed.statement?.kind !== expected) malformed(`SQL for ${name} has the wrong object type`);
    return parsed.statement;
  } catch (error) {
    if (error instanceof SchemaFormatError) throw error;
    if (error instanceof SqlParseError) malformed(`${name} - ${error.message}`, error);
    throw error;
  }
}

function readonlyMap<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
  // Do not publish a mutable Map behind a ReadonlyMap type annotation.
  let view: ReadonlyMap<K, V>;
  view = Object.freeze({
    get size() { return source.size; },
    get: (key: K) => source.get(key),
    has: (key: K) => source.has(key),
    entries: () => source.entries(),
    keys: () => source.keys(),
    values: () => source.values(),
    forEach: (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) => {
      source.forEach((value, key) => callback.call(thisArg, value, key, view));
    },
    [Symbol.iterator]: () => source[Symbol.iterator](),
  });
  return view;
}

/** Production uses build.c-owned identity, never inference from index sort flags.
 * Fallback supports older private mock tables; real and transient producers
 * explicitly publish a column or null. */
export function integerPrimaryKeyColumn(table:TableNode):ColumnNode|null {
 if(table.integerPrimaryKey!==undefined)return table.integerPrimaryKey;
 if(table.withoutRowid||table.primaryKey.length!==1)return null;
 const column=table.primaryKey[0]!;
 return column.declaredType?.trim().toUpperCase()==="INTEGER"&&!table.primaryKeyTerms?.[0]?.descending?column:null;
}
function builtinCollation(name:string|null):BuiltinCollation|null {
  const folded=sqliteAsciiFold(name??"binary");
  return folded==="binary"||folded==="nocase"||folded==="rtrim"?folded:null;
}
/** build.c:sqlite3KeyInfoOfIndex and convertToWithoutRowidTable for admitted
 * rowid and WITHOUT ROWID layouts. Unsupported layouts return null atomically. */
export function physicalIndexLayout(index:IndexNode):PhysicalIndexLayout {
  const fields:Array<PhysicalIndexLayout["fields"][number]>=[];
  for(const term of index.terms){
    const collation=sqliteAsciiFold(term.collation??term.column?.collation??"binary");
    if((!term.column&&!term.expression)||term.nulls!==null)throw new SchemaUnsupportedError("index record fields are not represented");
    fields.push(Object.freeze({role:"declared",column:term.column,expression:term.expression,collation,descending:term.descending,nullsLarge:false}));
  }
  if(index.table.withoutRowid){
    const isPrimary=index.origin==="primary-key";
    let primaryKeyFields:readonly number[]=Object.freeze([]);
    if(isPrimary){
      // build.c:convertToWithoutRowidTable makes the PK b-tree the table and
      // appends every non-key column to its record in declared-column order.
      for(const column of index.table.columns)if(!fields.some(field=>field.column===column))fields.push(Object.freeze({role:"stored-column",column,expression:null,collation:"binary",descending:false,nullsLarge:false}));
    }else{
      // build.c:isDupColumn/convertToWithoutRowidTable replace the rowid tail
      // with each PK term not already represented by the same column and
      // collation. sqlite3CreateIndex copies that PK term's collation and sort
      // direction into the physical suffix (not the bare column defaults).
      // Production schema graphs always publish primaryKeyTerms. Keep the
      // column-derived fallback for older compiler tests and transient schema
      // producers, which predate preservation of PK collation/direction. It is
      // deliberately unable to invent metadata absent from those producers;
      // persisted schemas take the exact terms above.
      const primaryKeyTerms=index.table.primaryKeyTerms??Object.freeze(index.table.primaryKey.map(column=>Object.freeze({column,expression:null,expressionSql:null,descending:false,collation:column.collation,nulls:null}) as IndexTerm));
      for(const term of primaryKeyTerms){
        const collation=sqliteAsciiFold(term.collation??term.column?.collation??"binary");
        if(!term.column||term.expression||term.nulls!==null)throw new SchemaUnsupportedError("primary-key record fields are not represented");
        if(fields.some(field=>field.column===term.column&&field.collation===collation))continue;
        fields.push(Object.freeze({role:"primary-key-suffix",column:term.column,expression:null,collation,descending:term.descending,nullsLarge:false}));
      }
      // wherecode.c:2171-2185 maps every primary-key component from the
      // selected secondary record. Declared and auxiliary fields need not be
      // contiguous or ordered. Match collation too, so a different-collation
      // declared copy cannot hide the appended physical PK copy.
      const mapped:number[]=[];
      for(const term of primaryKeyTerms){
        const collation=sqliteAsciiFold(term.collation??term.column?.collation??"binary");
        if(!term.column)throw new SchemaUnsupportedError("primary-key record field missing");
        const ordinal=fields.findIndex(field=>field.column===term.column&&field.collation===collation);
        if(ordinal<0)throw new SchemaUnsupportedError("primary-key record mapping missing");
        mapped.push(ordinal);
      }
      primaryKeyFields=Object.freeze(mapped);
    }
    return Object.freeze({index,fields:Object.freeze(fields),declaredFieldCount:index.terms.length,rowidField:-1,primaryKeyFields});
  }
  fields.push(Object.freeze({role:"rowid-tail",column:null,expression:null,collation:"binary",descending:false,nullsLarge:false}));
  return Object.freeze({index,fields:Object.freeze(fields),declaredFieldCount:index.terms.length,rowidField:index.terms.length,primaryKeyFields:Object.freeze([])});
}

export function physicalIndex(index:IndexNode,encoding:DatabaseEncoding):PhysicalIndex|null {
 const layout=index.layout??physicalIndexLayout(index);
 if(layout.fields.some(field=>!builtinCollation(field.collation)))return null;
 const fields=layout.fields as readonly PhysicalIndexField[];
 const allNotNull=index.unique&&index.terms.every(term=>term.column?.notNull===true);
 const keyFieldCount=index.table.withoutRowid?(index.origin==="primary-key"?index.terms.length:fields.length):(allNotNull?index.terms.length:fields.length);
 const keyInfo=new KeyInfo({encoding,totalFieldCount:fields.length,keyFieldCount,terms:fields.map(field=>Object.freeze({collation:field.collation,desc:field.descending,nullsLarge:false}))});
 return Object.freeze({index,...layout,fields,keyInfo});
}

/** Compatibility entrypoint for rowid-only callers. New lowering should use
 * physicalIndex so WITHOUT ROWID layouts are not accidentally excluded. */
export function physicalRowidIndex(index:IndexNode,encoding:DatabaseEncoding):PhysicalIndex|null {
  return index.table.withoutRowid?null:physicalIndex(index,encoding);
}

/** build.c:sqlite3FindTable; usable by linked transient resolution schemas. */
export function findSchemaTable(schema: {readonly tables: ReadonlyMap<string, TableNode>}, name: string): TableNode | undefined {
  const folded = sqliteAsciiFold(name);
  return schema.tables.get(folded) ?? (folded === "sqlite_schema" ? schema.tables.get("sqlite_master") : undefined);
}

export class SchemaGraph {
  readonly encoding: DatabaseEncoding;
  readonly objects: readonly SchemaObject[];
  readonly tables: ReadonlyMap<string, TableNode>;
  readonly indexes: ReadonlyMap<string, IndexNode>;
  readonly views: ReadonlyMap<string, ViewNode>;
  readonly #owner: StorageOwnerCarrier;
  constructor(owner: StorageOwnerCarrier, encoding: DatabaseEncoding, objects: SchemaObject[], tables: Map<string, TableNode>, indexes: Map<string, IndexNode>, views: Map<string, ViewNode>) {
    this.#owner = owner; this.encoding = encoding; this.objects = Object.freeze(objects);
    this.tables = readonlyMap(tables); this.indexes = readonlyMap(indexes); this.views = readonlyMap(views);
    Object.freeze(this);
  }
  /** build.c:sqlite3FindTable — aliases share a single synthetic Table. */
  findTable(name: string): TableNode | undefined {
    return findSchemaTable(this, name);
  }
  assertOpen(): void {
    try { this.#owner[storageOwner].assertOpen(); }
    catch (error) { throw new SchemaStateError("schema owner is closed"); }
  }
  /** Resolution-only table used by select.c-style coroutine consumers. It is
   * never opened as a b-tree; the owning compiler supplies its rows. */
  withTransientTable(table: TableNode): SchemaGraph {
    freezeTransientTable(table);
    const tables=new Map(this.tables);tables.set(sqliteAsciiFold(table.name),table);
    return new SchemaGraph(this.#owner,this.encoding,[...this.objects,table],tables,new Map(this.indexes),new Map(this.views));
  }
}

/** Publish completed SELECT-result metadata (select.c:2376/2432/2464).
 * Persistent defaults/ANALYZE must never run on a rootPage=0 result table. */
export function freezeTransientTable(table:TableNode):TableNode {
 if(table.rootPage!==0||table.indexes.length!==0)throw new SchemaUnsupportedError("transient publication requires nonphysical result metadata");
 for(const column of table.columns){Object.freeze(column.checks);Object.freeze(column);}
 for(const array of [table.columns,table.indexes,table.primaryKey,table.primaryKeyTerms,table.storageKey,table.checks,table.foreignKeys,table.referencedBy])Object.freeze(array);
 return Object.freeze(table);
}

const graphs = new WeakMap<object, SchemaGraph>();

/**
 * Translate prepare.c sqlite3InitOne/sqlite3InitCallback for the supported
 * table, simple-index and view construction tranche. Root page 1 is read via the
 * existing connection storage owner; every graph value is detached from cursor borrows.
 */
export function canonicalSchemaCatalog(connection: StorageOwnerCarrier): string {
  const graph = loadSchemaGraph(connection);
  return graph.objects.map(object => `${object.kind}\t${object.name}\t${object.tableName}\t${object.sql ?? ""}\n`).join("");
}

export function loadSchemaGraph(connection: StorageOwnerCarrier): SchemaGraph {
  const key = connection as object;
  const prior = graphs.get(key);
  if (prior) { prior.assertOpen(); return prior; }
  let database;
  try { database = btreeFromConnection(connection); }
  catch (error) { if (error instanceof BtreeCursorStateError) throw new SchemaStateError(error.message); throw error; }
  const rows: SchemaRow[] = [];
  try {
    const cursor = database.tableCursor(1);
    if (cursor.first()) do rows.push(row(cursor.payload(), database.encoding)); while (cursor.next());
  } catch (error) {
    if (error instanceof SchemaFormatError || error instanceof SchemaUnsupportedError) throw error;
    if (error instanceof BtreeFormatError || error instanceof RecordFormatError) malformed((error as Error).message, error);
    throw error;
  }

  const objects: SchemaObject[] = [];
  const tables = new Map<string, TableNode>();
  const indexes = new Map<string, IndexNode>();
  const views = new Map<string, ViewNode>();
  const names = new Set<string>();
  // prepare.c:sqlite3InitOne/build.c:sqlite3StartTable synthesize a Table at
  // root 1 before parsing persisted declarations. It is not a catalog row.
  // The substituted legacy name is the same identity used by sqlite3FindTable.
  const schemaTable: SchemaRow = { type: "table", name: "sqlite_master", tableName: "sqlite_master", rootPage: 1,
    sql: "CREATE TABLE sqlite_master(type text,name text,tbl_name text,rootpage int,sql text)" };
  for (const item of [schemaTable, ...rows]) {
    const folded = sqliteAsciiFold(item.name);
    if (names.has(folded)) malformed(`duplicate object name ${item.name}`);
    names.add(folded);
    if (item.type === "table") {
      if (item.sql === null) malformed(`table ${item.name} has null SQL`);
      const ddl = parseDdl(item.sql, "create-table", item.name);
      if (ddl.tableAsSelect) throw new SchemaUnsupportedError(`CREATE TABLE AS construction is not implemented: ${item.name}`);
      if (item.rootPage < 1 || item.rootPage > database.pageCount) malformed(`invalid root page for ${item.name}`);
      let defaultIndex = 0;
      const declaredPrimary = ddl.primaryKey.length ? ddl.primaryKey : ddl.columns.filter(column => column.primaryKey).map(column => column.name);
      const columns = Object.freeze(ddl.columns.map(column => Object.freeze({ name: column.name, declaredType: item===schemaTable ? column.declaredType?.toUpperCase()??null : column.declaredType, ...columnTypeEstimate(column.declaredType), defaultExpr: column.defaultExpr, generatedExpr: column.generatedExpr, defaultIndex: column.defaultExpr ? defaultIndex++ : null, notNull: column.notNull || (ddl.withoutRowid && declaredPrimary.some(name => sqliteIdentifierEqual(name, column.name))), primaryKeyPosition: (()=>{const at=declaredPrimary.findIndex(name=>sqliteIdentifierEqual(name, column.name));return at<0?null:at+1;})(), unique: column.unique, collation: column.collation, generatedStorage: column.generatedStorage, checks: [] as CheckConstraintNode[] })));
      const declaredPrimaryKey= Object.freeze(declaredPrimary.map(name => { const column=columns.find(candidate=>sqliteIdentifierEqual(candidate.name, name));if(!column)malformed(`primary key refers to unknown column ${name}`);return column; }));
      const declaredPrimaryKeyTerms=Object.freeze(declaredPrimaryKey.map((column,index)=>{const declared=ddl.primaryKeyTerms[index];return Object.freeze({column,expression:null,expressionSql:null,descending:declared?.descending??ddl.columns.find(candidate=>sqliteIdentifierEqual(candidate.name,column.name))?.primaryKeyDescending??false,collation:declared?.collation??column.collation,nulls:declared?.nulls??null}) as IndexTerm;}));
      // build.c equivalent UNIQUE/PK constraints retain the first index's
      // direction. The WR physical primary must consume that retained owner
      // before duplicate-key compaction and storage layout are constructed.
      const effectivePrimaryKeyTerms=ddl.withoutRowid
        ? implicitIndexDefinitions({columns,name:item.name,integerPrimaryKey:null,withoutRowid:true},ddl).find(index=>index.primary)?.terms??declaredPrimaryKeyTerms
        : declaredPrimaryKeyTerms;
      // build.c convertToWithoutRowidTable/isDupColumn: collapse only
      // identical column+collation pairs, keeping the first sort direction.
      // Distinct collations on the same column remain distinct key fields.
      const retainedPrimaryKeyTerms:IndexTerm[]=[];
      for(const term of effectivePrimaryKeyTerms){
        if(ddl.withoutRowid&&retainedPrimaryKeyTerms.some(prior=>prior.column===term.column&&sqliteIdentifierEqual(prior.collation??"BINARY",term.collation??"BINARY")))continue;
        retainedPrimaryKeyTerms.push(term);
      }
      const primaryKeyTerms=Object.freeze(retainedPrimaryKeyTerms);
      const primaryKey=Object.freeze(primaryKeyTerms.map(term=>term.column!));
      // For WITHOUT ROWID, the declared PK is the b-tree storage key. Rowid
      // tables retain their implicit rowid key, represented by an empty list.
      const storageKey = ddl.withoutRowid ? primaryKey : Object.freeze([] as ColumnNode[]);
      const integerPrimaryKey=ddl.withoutRowid?null:declaredIntegerPrimaryKey(columns,ddl);
      const checks=Object.freeze(ddl.checks.map(check=>{const column=check.columnName===null?null:columns.find(candidate=>sqliteIdentifierEqual(candidate.name,check.columnName!))??null;if(check.columnName!==null&&!column)malformed(`CHECK refers to unknown column ${check.columnName}`);const node=Object.freeze({name:check.name,column,expr:check.expr,sql:check.tokens.map(token=>token.text).join(" ")});if(column)(column.checks as CheckConstraintNode[]).push(node);return node;}));
      for(const column of columns)Object.freeze(column.checks);
      const foreignKeys=Object.freeze(ddl.foreignKeys.map(foreign=>{if(foreign.referencedColumns&&foreign.referencedColumns.length!==foreign.columns.length)malformed("number of columns in foreign key does not match referenced columns");const links=Object.freeze(foreign.columns.map((name,index)=>{const column=columns.find(candidate=>sqliteIdentifierEqual(candidate.name,name));if(!column)malformed(`unknown column ${name} in foreign key definition`);return Object.freeze({column,referencedColumn:foreign.referencedColumns?.[index]??null});}));return {name:foreign.name,columns:links,referencedTableName:foreign.referencedTable,referencedTable:null,onDelete:foreign.onDelete,onUpdate:foreign.onUpdate,deferrable:foreign.deferrable,initiallyDeferred:foreign.initiallyDeferred,sql:foreign.tokens.map(token=>token.text).join(" ")} as ForeignKeyNode;}));
      const table: TableNode = { integerPrimaryKey,szTabRow:sqliteLogEst(BigInt((columns.reduce((n,c)=>n+c.szEst,0)+(integerPrimaryKey===null?1:0))*4)),nRowLogEst:200,hasStat1:false, kind: "table", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, columns, indexes: [], withoutRowid: ddl.withoutRowid, primaryKey, primaryKeyTerms, storageKey, checks, foreignKeys, referencedBy: [] };
      tables.set(folded, table);
    }
  }
  for(const table of tables.values())for(const foreign of table.foreignKeys){const target=tables.get(sqliteAsciiFold(foreign.referencedTableName))??null;(foreign as {referencedTable:TableNode|null}).referencedTable=target;if(target)(target.referencedBy as ForeignKeyNode[]).push(foreign);Object.freeze(foreign);}
  // WITHOUT ROWID PRIMARY KEY indexes have no sqlite_schema row: build.c
  // aliases that index to the table root. Publish the immutable physical owner
  // before secondary indexes are linked.
  for(const table of tables.values())if(table.withoutRowid){
    if(!table.primaryKey.length)malformed(`WITHOUT ROWID table ${table.name} has no PRIMARY KEY`);
    const terms=table.primaryKeyTerms;
    const definitions=implicitIndexDefinitions(table,parseDdl(table.sql,"create-table",table.name));
    const ordinal=definitions.findIndex(definition=>definition.primary)+1;
    if(ordinal<1)malformed(`WITHOUT ROWID table ${table.name} has no primary index definition`);
    const name=`sqlite_autoindex_${table.name}_${ordinal}`;
    const index={kind:"index",name,tableName:table.tableName,rootPage:table.rootPage,sql:null,table,terms,unique:true,onError:definitions[ordinal-1]!.onError,origin:"primary-key",partialWhere:null,physical:null} as unknown as IndexNode;
    (index as {layout:PhysicalIndexLayout}).layout=physicalIndexLayout(index);
    (index as {physical:PhysicalIndex|null}).physical=physicalIndex(index,database.encoding);
    linkIndex(table,index);indexes.set(sqliteAsciiFold(name),index);
  }
  // Automatic indexes are produced by table grammar before APPDEF schema rows.
  // Materialize retained grammar linkage once, then let each APPDEF insertion
  // perform source exit_create_index cleanup on that actual list.
  let implicitPublished=false;
  const automaticRows=rows.filter(item=>item.type==="index"&&item.sql===null);
  for (const item of [...automaticRows,...rows.filter(item=>!(item.type==="index"&&item.sql===null))]) {
    if(!implicitPublished&&!(item.type==="index"&&item.sql===null)){
      for(const table of tables.values()){
        const definitions=implicitIndexDefinitions(table,parseDdl(table.sql,"create-table",table.name));
        const byOrdinal=new Map(table.indexes.map(index=>[Number(index.name.slice(index.name.lastIndexOf("_")+1))-1,index]));
        const linked:IndexNode[]=[];
        definitions.forEach((definition,ordinal)=>{
          const index=byOrdinal.get(ordinal);if(index)linked[definition.listPosition]=index;
        });
        table.indexes.splice(0,table.indexes.length,...linked.filter(index=>index!==undefined));
      }
      implicitPublished=true;
    }
    const folded = sqliteAsciiFold(item.name);
    if (item.type === "table") continue;
    if (item.type === "index") {
      const table = tables.get(sqliteAsciiFold(item.tableName));
      if (!table) malformed(`index ${item.name} refers to unknown table ${item.tableName}`);
      if (item.rootPage < 1 || item.rootPage > database.pageCount) malformed(`invalid root page for ${item.name}`);
      if (item.sql === null) {
        // build.c:sqlite3CreateIndex constructs persistent automatic indexes
        // for PRIMARY KEY and UNIQUE constraints. These are existing on-disk
        // b-trees, not OP_OpenAutoindex/runtime index construction.
        const primary = table.primaryKey;
        const rowidAlias = table.integerPrimaryKey !== null;
        const ddl=parseDdl(table.sql,"create-table",table.name);
        const implicit=implicitIndexDefinitions(table,ddl);
        const prefix=`sqlite_autoindex_${table.name}_`,ordinal=item.name.startsWith(prefix)?Number(item.name.slice(prefix.length)):NaN,definition=implicit[ordinal-1],terms=definition?.terms;
        if(!Number.isSafeInteger(ordinal)||ordinal<1||!terms)throw new SchemaUnsupportedError(`automatic index construction is not implemented: ${item.name}`);
        const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: null, table, terms, unique: true, onError:definition!.onError,origin: definition!.primary ? "primary-key" : "unique", partialWhere:null, physical:null } as unknown as IndexNode;
        (index as {layout:PhysicalIndexLayout}).layout=physicalIndexLayout(index);
        (index as {physical:PhysicalIndex|null}).physical=physicalIndex(index,database.encoding);
        linkIndex(table,index); indexes.set(folded, index);
        continue;
      }
      const ddl = parseDdl(item.sql, "create-index", item.name);
      if (ddl.tableName === null || !sqliteIdentifierEqual(ddl.tableName, item.tableName)) malformed(`index ${item.name} has mismatched table name`);
      const terms = Object.freeze(ddl.indexTerms.map(term => {
        const tokens = term.expr.tokens;
        const simple = tokens.length === 1 && (tokens[0]!.kind === "id" || tokens[0]!.kind === "keyword") ? identifier(tokens[0]) : null;
        const column = simple === null ? null : table.columns.find(candidate => sqliteIdentifierEqual(candidate.name, simple)) ?? null;
        if (simple !== null && !column) malformed(`index refers to unknown column ${simple}`);
        return Object.freeze({ column, expression: column ? null : term.expr, expressionSql: column ? null : tokens.map(token => token.text).join(" "), descending: term.descending, collation: term.collation, nulls: term.nulls });
      }));
      const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, table, terms, unique: ddl.indexUnique, onError:ddl.indexUnique?"abort":"none",origin: "create", partialWhere:ddl.indexWhere, physical:null } as unknown as IndexNode;
      (index as {layout:PhysicalIndexLayout}).layout=physicalIndexLayout(index);
      (index as {physical:PhysicalIndex|null}).physical=physicalIndex(index,database.encoding);
      linkIndex(table,index); indexes.set(folded, index);
    } else if (item.type === "view") {
      if (item.rootPage !== 0 || item.sql === null) malformed(`invalid view ${item.name}`);
      const ddl = parseDdl(item.sql, "create-view", item.name);
      if (!ddl.select) malformed(`view ${item.name} has no SELECT`);
      const selectSql = ddl.select.tokens.map(token => token.text).join(" ");
      const view: ViewNode = { kind: "view", name: item.name, tableName: item.tableName, rootPage: 0, sql: item.sql, selectSql, select: ddl.select, columns: ddl.viewColumns };
      views.set(folded, Object.freeze(view));
    } else if (item.type === "trigger") {
      throw new SchemaUnsupportedError(`trigger construction is not implemented: ${item.name}`);
    } else malformed(`unknown object type ${item.type}`);
  }
  // All physical identities exist before estimates; no competing stat owner.
  for(const index of indexes.values()){
    const m=index as Mutable<IndexNode>;
    m.szIdxRow=sqliteLogEst(BigInt(index.layout.fields.reduce((n,f)=>n+(f.column?.szEst??1),0)*4));
    m.hasStat1=false;m.unordered=false;m.noSkipScan=false;defaultRowEst(index);
  }
  // analyze.c:sqlite3AnalysisLoad/analysisLoader. sqlite_stat1 is an ordinary
  // rowid b-tree, not a schema declaration. Decode using the database encoding;
  // never expose unsupported stat tokens as plausible planner estimates.
  // Match sqlite3AnalysisLoad without SQLITE_ENABLE_STAT4: retain sqlite_stat4
  // as ordinary schema, but do not read optional optimizer samples. stat1 and
  // default estimates remain usable; this does not claim STAT4 estimate parity.
  const callbackKey=(name:string):string=>{let key="";for(const byte of new TextEncoder().encode(name))key+=String.fromCharCode(byte);return sqliteAsciiFold(key);};
  const callbackTables=new Map([...tables.values()].map(table=>[callbackKey(table.name),table]));
  const callbackIndexes=new Map([...indexes.values()].map(index=>[callbackKey(index.name),index]));
  const statTable=tables.get("sqlite_stat1");
  if(statTable){
    const cursor=database.tableCursor(statTable.rootPage);
    if(cursor.first())do {
      let values;
      try {values=decodeRecord(cursor.payload(),database.encoding).values;}
      catch(error){throw new SchemaFormatError("invalid sqlite_stat1 record",{cause:error});}
      if(values.length!==3)malformed("sqlite_stat1 record must have three fields");
      const [tableName,indexName,stat]=values.map(value=>callbackText(value,database.encoding));
      if(tableName==null||stat==null)continue;
      const table=callbackTables.get(sqliteAsciiFold(tableName));if(!table)continue;
      const index=indexName==null?undefined:sqliteIdentifierEqual(tableName,indexName)?table.indexes.find(i=>i.origin==="primary-key"):callbackIndexes.get(sqliteAsciiFold(indexName));
      const mt=table as Mutable<TableNode>;
      if(index){
        const decoded=decodeEstimates(stat,[...index.rowLogEst],index.szIdxRow),mi=index as Mutable<IndexNode>;
        mi.rowLogEst=decoded.rows;mi.szIdxRow=decoded.width;mi.unordered=decoded.unordered;mi.noSkipScan=decoded.noSkipScan;mi.hasStat1=true;
        if(!index.partialWhere){mt.nRowLogEst=decoded.rows[0]!;mt.hasStat1=true;}
      }else{
        const decoded=decodeEstimates(stat,[table.nRowLogEst],table.szTabRow);
        mt.nRowLogEst=decoded.rows[0]!;mt.szTabRow=decoded.width;mt.hasStat1=true;
      }
    }while(cursor.next());
  }
  for(const index of indexes.values()){if(!index.hasStat1)defaultRowEst(index);Object.freeze(index.rowLogEst);Object.freeze(index);}
  // Restore physical sqlite_schema declaration order after cross-linking tables.
  const byName = new Map<string, SchemaObject>([...tables, ...indexes, ...views]);
  for (const item of rows) {
    const object = byName.get(sqliteAsciiFold(item.name));
    if (object) objects.push(object);
  }
  for (const table of tables.values()) { Object.freeze(table.indexes); Object.freeze(table.referencedBy); Object.freeze(table); }
  const graph = new SchemaGraph(connection, database.encoding, objects, tables, indexes, views);
  graphs.set(key, graph);
  return graph;
}
