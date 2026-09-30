import { btreeFromConnection, BtreeCursorStateError, BtreeFormatError } from "./btree.ts";
import { decodeRecord, RecordFormatError, type DatabaseEncoding, type RawRecordValue } from "./record.ts";
import { parseSql, SqlParseError, type ExprNode, type SchemaDdlNode, type SelectNode } from "./parse.ts";
import { storageOwner, type StorageOwnerCarrier } from "./storage.ts";
import { type SqlToken } from "./tokenize.ts";
import { decodeSqliteText } from "./utf.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";
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
  readonly declaredType: string | null;
  readonly affinity: "blob" | "text" | "numeric" | "integer" | "real";
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
  readonly kind: "table";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: number;
  readonly sql: string;
  readonly columns: readonly ColumnNode[];
  readonly indexes: IndexNode[];
  readonly withoutRowid: boolean;
  readonly primaryKey: readonly ColumnNode[];
  readonly primaryKeyTerms: readonly IndexTerm[];
  readonly storageKey: readonly ColumnNode[];
  readonly checks: readonly CheckConstraintNode[];
  readonly foreignKeys: readonly ForeignKeyNode[];
  readonly referencedBy: readonly ForeignKeyNode[];
}
export interface IndexNode {
  readonly kind: "index";
  readonly name: string;
  readonly tableName: string;
  readonly rootPage: number;
  readonly sql: string | null;
  readonly table: TableNode;
  readonly terms: readonly IndexTerm[];
  readonly unique: boolean;
  readonly origin: "create" | "primary-key";
  readonly partialWhere: ExprNode | null;
  /** Immutable packed-key identity, built exactly once with the schema. */
  readonly physical: PhysicalIndex | null;
}
/** analyze.c:analysisLoader estimates, detached from frozen schema/key cycles. */
export interface IndexStatistics { readonly rowLogEst: readonly number[]; readonly unordered:boolean }
const indexStatistics=new WeakMap<IndexNode,IndexStatistics>();
export function statisticsForIndex(index:IndexNode):IndexStatistics|null {return indexStatistics.get(index)??null;}
/** util.c:sqlite3LogEst, including its small integer rounding table. */
export function sqliteLogEst(value:bigint):number {
 if(value<2n)return 0;
 let x=value,y=40;
 if(x<8n){while(x<8n){y-=10;x<<=1n;}}
 else {while(x>255n){y+=40;x>>=4n;}while(x>15n){y+=10;x>>=1n;}}
 return [0,2,3,5,6,7,8,9][Number(x&7n)]!+y-10;
}
export interface PhysicalIndexField { readonly role:"declared"|"primary-key-suffix"|"stored-column"|"rowid-tail"; readonly column:ColumnNode|null; readonly expression:ExprNode|null; readonly collation:BuiltinCollation; readonly descending:boolean; readonly nullsLarge:false }
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
function affinity(declaredType: string | null): ColumnNode["affinity"] {
  if (declaredType === null) return "blob";
  const type = declaredType.toUpperCase();
  if (type.includes("INT")) return "integer";
  if (type.includes("CHAR") || type.includes("CLOB") || type.includes("TEXT")) return "text";
  if (type.includes("BLOB") || type.length === 0) return "blob";
  if (type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB")) return "real";
  return "numeric";
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

function builtinCollation(name:string|null):BuiltinCollation|null {
  const folded=sqliteAsciiFold(name??"binary");
  return folded==="binary"||folded==="nocase"||folded==="rtrim"?folded:null;
}
/** build.c:sqlite3KeyInfoOfIndex and convertToWithoutRowidTable for admitted
 * rowid and WITHOUT ROWID layouts. Unsupported layouts return null atomically. */
export function physicalIndex(index:IndexNode,encoding:DatabaseEncoding):PhysicalIndex|null {
  const fields:PhysicalIndexField[]=[];
  for(const term of index.terms){
    const collation=builtinCollation(term.collation??term.column?.collation??null);
    if((!term.column&&!term.expression)||term.nulls!==null||!collation)return null;
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
        const collation=builtinCollation(term.collation??term.column?.collation??null);
        if(!term.column||term.expression||term.nulls!==null||!collation)return null;
        if(fields.some(field=>field.column===term.column&&field.collation===collation))continue;
        fields.push(Object.freeze({role:"primary-key-suffix",column:term.column,expression:null,collation,descending:term.descending,nullsLarge:false}));
      }
      // wherecode.c:2171-2185 maps every primary-key component from the
      // selected secondary record. Declared and auxiliary fields need not be
      // contiguous or ordered. Match collation too, so a different-collation
      // declared copy cannot hide the appended physical PK copy.
      const mapped:number[]=[];
      for(const term of primaryKeyTerms){
        const collation=builtinCollation(term.collation??term.column?.collation??null);
        if(!term.column||!collation)return null;
        const ordinal=fields.findIndex(field=>field.column===term.column&&field.collation===collation);
        if(ordinal<0)return null;
        mapped.push(ordinal);
      }
      primaryKeyFields=Object.freeze(mapped);
    }
    const keyInfo=new KeyInfo({encoding,totalFieldCount:fields.length,keyFieldCount:isPrimary?index.terms.length:fields.length,terms:fields.map(field=>Object.freeze({collation:field.collation,desc:field.descending,nullsLarge:false}))});
    return Object.freeze({index,fields:Object.freeze(fields),declaredFieldCount:index.terms.length,rowidField:-1,primaryKeyFields,keyInfo});
  }
  fields.push(Object.freeze({role:"rowid-tail",column:null,expression:null,collation:"binary",descending:false,nullsLarge:false}));
  const allNotNull=index.unique&&index.terms.every(term=>term.column?.notNull===true);
  const keyInfo=new KeyInfo({encoding,totalFieldCount:fields.length,keyFieldCount:allNotNull?index.terms.length:fields.length,terms:fields.map(field=>Object.freeze({collation:field.collation,desc:field.descending,nullsLarge:false}))});
  return Object.freeze({index,fields:Object.freeze(fields),declaredFieldCount:index.terms.length,rowidField:index.terms.length,primaryKeyFields:Object.freeze([]),keyInfo});
}

/** Compatibility entrypoint for rowid-only callers. New lowering should use
 * physicalIndex so WITHOUT ROWID layouts are not accidentally excluded. */
export function physicalRowidIndex(index:IndexNode,encoding:DatabaseEncoding):PhysicalIndex|null {
  return index.table.withoutRowid?null:physicalIndex(index,encoding);
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
  assertOpen(): void {
    try { this.#owner[storageOwner].assertOpen(); }
    catch (error) { throw new SchemaStateError("schema owner is closed"); }
  }
  /** Resolution-only table used by select.c-style coroutine consumers. It is
   * never opened as a b-tree; the owning compiler supplies its rows. */
  withTransientTable(table: TableNode): SchemaGraph {
    const tables=new Map(this.tables);tables.set(sqliteAsciiFold(table.name),table);
    return new SchemaGraph(this.#owner,this.encoding,[...this.objects,table],tables,new Map(this.indexes),new Map(this.views));
  }
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
  for (const item of rows) {
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
      const columns = Object.freeze(ddl.columns.map(column => Object.freeze({ name: column.name, declaredType: column.declaredType, affinity: affinity(column.declaredType), defaultExpr: column.defaultExpr, generatedExpr: column.generatedExpr, defaultIndex: column.defaultExpr ? defaultIndex++ : null, notNull: column.notNull || (ddl.withoutRowid && declaredPrimary.some(name => sqliteIdentifierEqual(name, column.name))), primaryKeyPosition: (()=>{const at=declaredPrimary.findIndex(name=>sqliteIdentifierEqual(name, column.name));return at<0?null:at+1;})(), unique: column.unique, collation: column.collation, generatedStorage: column.generatedStorage, checks: [] as CheckConstraintNode[] })));
      const primaryKey = Object.freeze(declaredPrimary.map(name => { const column=columns.find(candidate=>sqliteIdentifierEqual(candidate.name, name));if(!column)malformed(`primary key refers to unknown column ${name}`);return column; }));
      const primaryKeyTerms=Object.freeze(primaryKey.map((column,index)=>{const declared=ddl.primaryKeyTerms[index];return Object.freeze({column,expression:null,expressionSql:null,descending:declared?.descending??ddl.columns.find(candidate=>sqliteIdentifierEqual(candidate.name,column.name))?.primaryKeyDescending??false,collation:declared?.collation??column.collation,nulls:declared?.nulls??null}) as IndexTerm;}));
      // For WITHOUT ROWID, the declared PK is the b-tree storage key. Rowid
      // tables retain their implicit rowid key, represented by an empty list.
      const storageKey = ddl.withoutRowid ? primaryKey : Object.freeze([] as ColumnNode[]);
      const checks=Object.freeze(ddl.checks.map(check=>{const column=check.columnName===null?null:columns.find(candidate=>sqliteIdentifierEqual(candidate.name,check.columnName!))??null;if(check.columnName!==null&&!column)malformed(`CHECK refers to unknown column ${check.columnName}`);const node=Object.freeze({name:check.name,column,expr:check.expr,sql:check.tokens.map(token=>token.text).join(" ")});if(column)(column.checks as CheckConstraintNode[]).push(node);return node;}));
      for(const column of columns)Object.freeze(column.checks);
      const foreignKeys=Object.freeze(ddl.foreignKeys.map(foreign=>{if(foreign.referencedColumns&&foreign.referencedColumns.length!==foreign.columns.length)malformed("number of columns in foreign key does not match referenced columns");const links=Object.freeze(foreign.columns.map((name,index)=>{const column=columns.find(candidate=>sqliteIdentifierEqual(candidate.name,name));if(!column)malformed(`unknown column ${name} in foreign key definition`);return Object.freeze({column,referencedColumn:foreign.referencedColumns?.[index]??null});}));return {name:foreign.name,columns:links,referencedTableName:foreign.referencedTable,referencedTable:null,onDelete:foreign.onDelete,onUpdate:foreign.onUpdate,deferrable:foreign.deferrable,initiallyDeferred:foreign.initiallyDeferred,sql:foreign.tokens.map(token=>token.text).join(" ")} as ForeignKeyNode;}));
      const table: TableNode = { kind: "table", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, columns, indexes: [], withoutRowid: ddl.withoutRowid, primaryKey, primaryKeyTerms, storageKey, checks, foreignKeys, referencedBy: [] };
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
    const name=`sqlite_autoindex_${table.name}_1`;
    const index={kind:"index",name,tableName:table.tableName,rootPage:table.rootPage,sql:null,table,terms,unique:true,origin:"primary-key",partialWhere:null,physical:null} as unknown as IndexNode;
    (index as {physical:PhysicalIndex|null}).physical=physicalIndex(index,database.encoding);
    table.indexes.push(index);indexes.set(sqliteAsciiFold(name),Object.freeze(index));
  }
  for (const item of rows) {
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
        const rowidAlias = primary.length === 1 && primary[0]!.declaredType?.toUpperCase() === "INTEGER";
        const ddl=parseDdl(table.sql,"create-table",table.name);
        const implicit:readonly (readonly IndexTerm[])[]=[
          ...(!rowidAlias&&primary.length?[Object.freeze(primary.map(column=>Object.freeze({column,expression:null,expressionSql:null,descending:false,collation:column.collation,nulls:null})) as IndexTerm[])]:[]),
          ...table.columns.filter(column=>column.unique).map(column=>Object.freeze([Object.freeze({column,expression:null,expressionSql:null,descending:false,collation:column.collation,nulls:null}) as IndexTerm])),
          ...ddl.tableUniqueTerms.map(unique=>Object.freeze(unique.map(term=>{const tokens=term.expr.tokens,simple=tokens.length===1?identifier(tokens[0]):null,column=simple===null?null:table.columns.find(candidate=>sqliteIdentifierEqual(candidate.name,simple))??null;if(!column)throw new SchemaUnsupportedError(`expression UNIQUE index is not implemented: ${item.name}`);return Object.freeze({column,expression:null,expressionSql:null,descending:term.descending,collation:term.collation??column.collation,nulls:term.nulls});}))),
        ];
        const prefix=`sqlite_autoindex_${table.name}_`,ordinal=item.name.startsWith(prefix)?Number(item.name.slice(prefix.length)):NaN,terms=implicit[ordinal-1];
        if(table.withoutRowid||!Number.isSafeInteger(ordinal)||ordinal<1||!terms)throw new SchemaUnsupportedError(`automatic index construction is not implemented: ${item.name}`);
        const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: null, table, terms, unique: true, origin: "primary-key", partialWhere:null, physical:null } as unknown as IndexNode;
        (index as {physical:PhysicalIndex|null}).physical=physicalIndex(index,database.encoding);
        table.indexes.push(index); indexes.set(folded, Object.freeze(index));
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
      const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, table, terms, unique: ddl.indexUnique, origin: "create", partialWhere:ddl.indexWhere, physical:null } as unknown as IndexNode;
      (index as {physical:PhysicalIndex|null}).physical=physicalIndex(index,database.encoding);
      table.indexes.push(index); indexes.set(folded, Object.freeze(index));
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
  // analyze.c:sqlite3AnalysisLoad/analysisLoader. sqlite_stat1 is an ordinary
  // rowid b-tree, not a schema declaration. Decode using the database encoding;
  // never expose unsupported stat tokens as plausible planner estimates.
  // STAT4 samples change equality/range selectivity in where.c. Until that
  // sample path exists, do not publish a plan based on stat1 alone.
  const stat4=tables.get("sqlite_stat4");
  if(stat4){const samples=database.tableCursor(stat4.rootPage);if(samples.first())throw new SchemaUnsupportedError("sqlite_stat4 samples are not represented");}
  const statTable=tables.get("sqlite_stat1");
  if(statTable){
    const cursor=database.tableCursor(statTable.rootPage);
    if(cursor.first())do {
      let values;
      try {values=decodeRecord(cursor.payload(),database.encoding).values;}
      catch(error){throw new SchemaFormatError("invalid sqlite_stat1 record",{cause:error});}
      if(values.length!==3)malformed("sqlite_stat1 record must have three fields");
      if(values[0]!.storageClass!=="text"||values[2]!.storageClass!=="text")continue;
      const tableName=decodeSqliteText(values[0]!.bytes,database.encoding);
      const table=tables.get(sqliteAsciiFold(tableName));if(!table)continue;
      if(values[1]!.storageClass!=="text")continue;
      const indexName=decodeSqliteText(values[1]!.bytes,database.encoding);
      const index=indexes.get(sqliteAsciiFold(indexName));
      if(!index||index.table!==table)continue;
      const stat=decodeSqliteText(values[2]!.bytes,database.encoding);
      const parts=stat.split(" ");const count=index.terms.length+1;
      if(parts.length<count||parts.slice(0,count).some(part=>!/^\d+$/.test(part)||BigInt(part)>0xffffffffffffffffn))throw new SchemaUnsupportedError(`unrepresented sqlite_stat1 for ${index.name}`);
      const tail=parts.slice(count).filter(Boolean);
      if(tail.some(part=>part!=="unordered"))throw new SchemaUnsupportedError(`unrepresented sqlite_stat1 token for ${index.name}`);
      const estimates=parts.slice(0,count).map(part=>sqliteLogEst(BigInt(part)));
      indexStatistics.set(index,Object.freeze({rowLogEst:Object.freeze(estimates),unordered:tail.includes("unordered")}));
    }while(cursor.next());
  }
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
