import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { open } from "../../src/index.ts";
import { loadSchemaGraph, SchemaStateError, SchemaUnsupportedError } from "../../src/internal/schema.ts";

const fixtureRoot = new URL("../fixtures/", import.meta.url);
const current = JSON.parse(await readFile(new URL("CURRENT.json", fixtureRoot), "utf8"));
const generated = new URL(`generations/${current.generationId}/generated/`, fixtureRoot);

async function withImage(image, name, body) {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(image);
  try {
    const connection = await open(`https://example.test/${name}`);
    await body(connection);
  } finally { globalThis.fetch = oldFetch; }
}

async function withFixture(name, body) {
  const image = new Uint8Array(await readFile(new URL(name, generated)));
  await withImage(image, name, body);
}

// Root pages and declaration order are oracle-confirmed from sqlite_schema for
// these immutable fixtures. The consumer must reuse the connection-owned storage.
test("sqlite_schema initialization reconstructs ordered table/index metadata in every encoding", async () => {
  for (const name of [
    "storage-p4096.db",
    "storage-p4096-utf16le.db",
    "storage-p4096-utf16be.db",
  ]) {
    await withFixture(name, async (connection) => {
      const schema = loadSchemaGraph(connection);
      assert.equal(loadSchemaGraph(connection), schema, "the connection publishes one schema identity");
      assert.equal("set" in schema.tables, false, "catalog lookup maps do not expose mutation");
      assert.equal(schema.encoding, name.endsWith("utf16le.db") ? "utf-16le" : name.endsWith("utf16be.db") ? "utf-16be" : "utf-8");
      assert.deepEqual(schema.objects.map((object) => object.kind), ["table", "index"]);

      const table = schema.tables.get("storage_values");
      assert.ok(table);
      assert.equal(table.rootPage, 2);
      assert.equal(table.sql, "CREATE TABLE storage_values(id INTEGER PRIMARY KEY, k TEXT, i, r, t, b)");
      assert.deepEqual(table.columns.map((column) => [column.name, column.declaredType]), [
        ["id", "INTEGER"], ["k", "TEXT"], ["i", null], ["r", null], ["t", null], ["b", null],
      ]);

      const index = schema.indexes.get("storage_k");
      assert.ok(index);
      assert.equal(index.table, table);
      assert.equal(index.rootPage, 3);
      assert.equal(index.sql, "CREATE INDEX storage_k ON storage_values(k,i)");
      assert.deepEqual(index.terms.map((term) => term.column?.name), ["k", "i"]);

      connection.close();
      assert.throws(() => schema.assertOpen(), SchemaStateError);
    });
  }
});

const execFileP = promisify(execFile);
test("rich generated schema semantics publish immutable linked table/index/view metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jsqlite-rich-schema-"));
  try {
    const path = join(dir, "rich.db");
    const script = `import sqlite3\np=${JSON.stringify(path)}\nc=sqlite3.connect(p)\nc.executescript('''CREATE TABLE t(a TEXT DEFAULT ('X'), b INTEGER GENERATED ALWAYS AS (length(a)) STORED, PRIMARY KEY(a)) WITHOUT ROWID; CREATE UNIQUE INDEX ix ON t(lower(a) COLLATE nocase DESC,b); CREATE VIEW v AS SELECT a, lower(b) FROM t;''')\nc.close()`;
    await execFileP("python3", ["-c", script]);
    await withImage(new Uint8Array(await readFile(path)), "rich.db", async connection => {
      const schema = loadSchemaGraph(connection), table = schema.tables.get("t"), index = schema.indexes.get("ix"), view = schema.views.get("v");
      assert.ok(table && index && view);
      assert.equal(table.withoutRowid, true);
      assert.deepEqual(table.columns.map(c => [c.name, c.declaredType, c.affinity, !!c.defaultExpr, c.defaultIndex, !!c.generatedExpr, c.generatedStorage, c.primaryKeyPosition]), [["a","TEXT","text",true,0,false,null,1],["b","INTEGER","integer",false,null,true,"stored",null]]);
      assert.deepEqual(table.primaryKey.map(c=>c.name), ["a"]); assert.equal(table.storageKey, table.primaryKey);
      assert.equal(index.table, table); assert.equal(table.indexes[0], index); assert.equal(index.unique,true); assert.equal(index.origin,"create");
      assert.deepEqual(index.terms.map(t => [t.column?.name ?? null, t.expressionSql, t.descending, t.collation, t.nulls]), [[null,"lower ( a )",true,"nocase",null],["b",null,false,null,null]]);
      assert.equal(view.select.kind, "select"); assert.deepEqual(view.select.result.map(x => x.tokens.map(t=>t.text).join(" ")), ["a","lower ( b )"]);
      assert.deepEqual(schema.objects.map(x=>x.name), ["t","ix","v"]);
      assert.ok(Object.isFrozen(table) && Object.isFrozen(index) && Object.isFrozen(view));
      assert.ok(Object.isFrozen(table.columns) && Object.isFrozen(table.indexes) && Object.isFrozen(index.terms));
      assert.throws(() => { table.name = "changed"; }, TypeError);
      assert.throws(() => { index.rootPage = 99; }, TypeError);
      connection.close(); assert.throws(() => schema.assertOpen(), SchemaStateError);
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("recognized unconsumed catalog constructs fail explicitly instead of being skipped", async () => {
  for (const [ddl, pattern] of [
    ["CREATE TABLE t(a); CREATE INDEX ix ON t(a) WHERE a IS NOT NULL", /partial index construction/],
    ["CREATE TABLE t(a); CREATE TRIGGER tr AFTER INSERT ON t BEGIN SELECT 1; END", /trigger construction/],
  ]) {
    const dir = await mkdtemp(join(tmpdir(), "jsqlite-unsupported-schema-"));
    try {
      const path = join(dir, "unsupported.db");
      await execFileP("python3", ["-c", `import sqlite3\np=${JSON.stringify(path)}\nc=sqlite3.connect(p)\nc.executescript(${JSON.stringify(ddl)})\nc.close()`]);
      await withImage(new Uint8Array(await readFile(path)), "unsupported.db", async connection => {
        assert.throws(() => loadSchemaGraph(connection), error => error instanceof SchemaUnsupportedError && pattern.test(error.message));
        connection.close();
      });
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});

test("SQLite ASCII identifier folding keeps non-ASCII case variants distinct in every encoding", async () => {
  for (const encoding of ["UTF-8", "UTF-16le", "UTF-16be"]) {
    const dir = await mkdtemp(join(tmpdir(), "jsqlite-name-case-"));
    try {
      const path = join(dir, `case-${encoding}.db`);
      const ddl = `PRAGMA encoding=${JSON.stringify(encoding)}; CREATE TABLE "Ä"("Ö" INTEGER PRIMARY KEY, "ö" TEXT); CREATE INDEX "IÄ" ON "Ä"("ö"); CREATE TABLE "ä"(x); CREATE INDEX "iä" ON "ä"(x);`;
      await execFileP("python3", ["-c", `import sqlite3\np=${JSON.stringify(path)}\nc=sqlite3.connect(p)\nc.executescript(${JSON.stringify(ddl)})\nc.close()`]);
      await withImage(new Uint8Array(await readFile(path)), `case-${encoding}.db`, async connection => {
        const schema = loadSchemaGraph(connection);
        const upper = schema.tables.get("Ä"), lower = schema.tables.get("ä");
        assert.ok(upper && lower); assert.notEqual(upper, lower);
        assert.equal(schema.tables.get("Ä"), schema.tables.get("Ä"));
        assert.equal(schema.indexes.get("iÄ")?.table, upper, "ASCII I folds while non-ASCII Ä does not");
        assert.equal(schema.indexes.get("iä")?.table, lower);
        assert.deepEqual(upper.columns.map(column => column.primaryKeyPosition), [1, null]);
        assert.equal(schema.indexes.get("iÄ")?.terms[0]?.column, upper.columns[1], JSON.stringify(schema.indexes.get("IÄ")?.terms));
        assert.equal(schema.indexes.get("iä")?.terms[0]?.column, lower.columns[0]);
        assert.deepEqual(schema.objects.map(object => object.name), ["Ä", "IÄ", "ä", "iä"]);
        connection.close();
      });
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});

test("index DDL table links use SQLite ASCII identifier comparison", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jsqlite-index-link-case-"));
  try {
    const path = join(dir, "case.db");
    const ddl = `CREATE TABLE "MiXeD"("CoL" TEXT); CREATE INDEX "Ix" ON mixed(col);`;
    await execFileP("python3", ["-c", `import sqlite3\np=${JSON.stringify(path)}\nc=sqlite3.connect(p)\nc.executescript(${JSON.stringify(ddl)})\nc.close()`]);
    await withImage(new Uint8Array(await readFile(path)), "case.db", async connection => {
      const schema = loadSchemaGraph(connection);
      const table = schema.tables.get("mixed"), index = schema.indexes.get("ix");
      assert.ok(table && index);
      assert.equal(index.table, table);
      assert.equal(index.terms[0]?.column, table.columns[0]);
      connection.close();
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
