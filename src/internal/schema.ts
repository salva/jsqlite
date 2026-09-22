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
  /** Immutable packed-key identity, built exactly once with the schema. */
  readonly physical: PhysicalRowidIndex | null;
}
export interface PhysicalIndexField { readonly role:"declared"|"rowid-tail"; readonly column:ColumnNode|null; readonly collation:BuiltinCollation; readonly descending:boolean; readonly nullsLarge:false }
export interface PhysicalRowidIndex { readonly index:IndexNode; readonly fields:readonly PhysicalIndexField[]; readonly declaredFieldCount:number; readonly rowidField:number; readonly keyInfo:KeyInfo }
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
/** build.c:sqlite3KeyInfoOfIndex for the admitted ordinary rowid layout.
 * Unsupported layouts return null atomically, before candidate publication. */
export function physicalRowidIndex(index:IndexNode,encoding:DatabaseEncoding):PhysicalRowidIndex|null {
  if(index.table.withoutRowid)return null;
  const fields:PhysicalIndexField[]=[];
  for(const term of index.terms){
    const collation=builtinCollation(term.collation??term.column?.collation??null);
    if(!term.column||term.expression||term.nulls!==null||!collation)return null;
    fields.push(Object.freeze({role:"declared",column:term.column,collation,descending:term.descending,nullsLarge:false}));
  }
  fields.push(Object.freeze({role:"rowid-tail",column:null,collation:"binary",descending:false,nullsLarge:false}));
  const allNotNull=index.unique&&index.terms.every(term=>term.column?.notNull===true);
  const keyInfo=new KeyInfo({encoding,totalFieldCount:fields.length,keyFieldCount:allNotNull?index.terms.length:fields.length,terms:fields.map(field=>Object.freeze({collation:field.collation,desc:field.descending,nullsLarge:false}))});
  return Object.freeze({index,fields:Object.freeze(fields),declaredFieldCount:index.terms.length,rowidField:index.terms.length,keyInfo});
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
      // For WITHOUT ROWID, the declared PK is the b-tree storage key. Rowid
      // tables retain their implicit rowid key, represented by an empty list.
      const storageKey = ddl.withoutRowid ? primaryKey : Object.freeze([] as ColumnNode[]);
      const checks=Object.freeze(ddl.checks.map(check=>{const column=check.columnName===null?null:columns.find(candidate=>sqliteIdentifierEqual(candidate.name,check.columnName!))??null;if(check.columnName!==null&&!column)malformed(`CHECK refers to unknown column ${check.columnName}`);const node=Object.freeze({name:check.name,column,expr:check.expr,sql:check.tokens.map(token=>token.text).join(" ")});if(column)(column.checks as CheckConstraintNode[]).push(node);return node;}));
      for(const column of columns)Object.freeze(column.checks);
      const foreignKeys=Object.freeze(ddl.foreignKeys.map(foreign=>{if(foreign.referencedColumns&&foreign.referencedColumns.length!==foreign.columns.length)malformed("number of columns in foreign key does not match referenced columns");const links=Object.freeze(foreign.columns.map((name,index)=>{const column=columns.find(candidate=>sqliteIdentifierEqual(candidate.name,name));if(!column)malformed(`unknown column ${name} in foreign key definition`);return Object.freeze({column,referencedColumn:foreign.referencedColumns?.[index]??null});}));return {name:foreign.name,columns:links,referencedTableName:foreign.referencedTable,referencedTable:null,onDelete:foreign.onDelete,onUpdate:foreign.onUpdate,deferrable:foreign.deferrable,initiallyDeferred:foreign.initiallyDeferred,sql:foreign.tokens.map(token=>token.text).join(" ")} as ForeignKeyNode;}));
      const table: TableNode = { kind: "table", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, columns, indexes: [], withoutRowid: ddl.withoutRowid, primaryKey, storageKey, checks, foreignKeys, referencedBy: [] };
      tables.set(folded, table);
    }
  }
  for(const table of tables.values())for(const foreign of table.foreignKeys){const target=tables.get(sqliteAsciiFold(foreign.referencedTableName))??null;(foreign as {referencedTable:TableNode|null}).referencedTable=target;if(target)(target.referencedBy as ForeignKeyNode[]).push(foreign);Object.freeze(foreign);}
  for (const item of rows) {
    const folded = sqliteAsciiFold(item.name);
    if (item.type === "table") continue;
    if (item.type === "index") {
      const table = tables.get(sqliteAsciiFold(item.tableName));
      if (!table) malformed(`index ${item.name} refers to unknown table ${item.tableName}`);
      if (item.rootPage < 1 || item.rootPage > database.pageCount) malformed(`invalid root page for ${item.name}`);
      if (item.sql === null) {
        // build.c:sqlite3CreateIndex constructs a persistent automatic index for
        // a non-rowid PRIMARY KEY. Keep the bounded, unambiguous single-column
        // form needed by the pinned encoding fixtures; other implicit layouts
        // remain an atomic schema gate rather than being guessed.
        const expected = `sqlite_autoindex_${table.name}_1`;
        const primary = table.primaryKey;
        const rowidAlias = primary.length === 1 && primary[0]!.declaredType?.toUpperCase() === "INTEGER";
        if (table.withoutRowid || item.name !== expected || primary.length === 0 || rowidAlias || table.columns.some(column => column.unique)) {
          throw new SchemaUnsupportedError(`automatic index construction is not implemented: ${item.name}`);
        }
        const terms: readonly IndexTerm[] = Object.freeze(primary.map(column => Object.freeze({ column, expression: null, expressionSql: null, descending: false, collation: column.collation, nulls: null })));
        const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: null, table, terms, unique: true, origin: "primary-key", physical:null } as unknown as IndexNode;
        (index as {physical:PhysicalRowidIndex|null}).physical=physicalRowidIndex(index,database.encoding);
        table.indexes.push(index); indexes.set(folded, Object.freeze(index));
        continue;
      }
      const ddl = parseDdl(item.sql, "create-index", item.name);
      if (ddl.indexWhere) throw new SchemaUnsupportedError(`partial index construction is not implemented: ${item.name}`);
      if (ddl.tableName === null || !sqliteIdentifierEqual(ddl.tableName, item.tableName)) malformed(`index ${item.name} has mismatched table name`);
      const terms = Object.freeze(ddl.indexTerms.map(term => {
        const tokens = term.expr.tokens;
        const simple = tokens.length === 1 ? identifier(tokens[0]) : null;
        const column = simple === null ? null : table.columns.find(candidate => sqliteIdentifierEqual(candidate.name, simple)) ?? null;
        if (simple !== null && !column) malformed(`index refers to unknown column ${simple}`);
        return Object.freeze({ column, expression: column ? null : term.expr, expressionSql: column ? null : tokens.map(token => token.text).join(" "), descending: term.descending, collation: term.collation, nulls: term.nulls });
      }));
      const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, table, terms, unique: ddl.indexUnique, origin: "create", physical:null } as unknown as IndexNode;
      (index as {physical:PhysicalRowidIndex|null}).physical=physicalRowidIndex(index,database.encoding);
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
