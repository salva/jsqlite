// [[card:card-t-b]] RED architecture gate: a single consumed SELECT compilation
// entry must own dispatch across recursive, aggregate, table and scalar shapes.
// This is intentionally structural: row-only tests cannot establish ownership.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../src/index.ts", import.meta.url), "utf8");
const prepare = source.slice(source.indexOf("  prepare(sql: string"), source.indexOf("  prepare(sql: string") + 7000);

test("public prepare delegates SELECT compilation through one consumed compiler entry", () => {
  assert.match(prepare, /const program\s*=\s*compileSelect\s*\(/,
    "prepare should pass its admitted SELECT to the unified source-owned compiler");
  for (const legacy of ["compileRecursiveWindowSelect", "compileRecursiveAggregateSelect", "compileMultipleRecursiveCtes", "compileRecursiveCteSelect", "compileAggregateSelect", "compileTableSelect", "compileScalarSelect"]) {
    assert.doesNotMatch(prepare, new RegExp(`\\b${legacy}\\s*\\(`),
      `${legacy} must be a compiler-owned branch, not public shape dispatch`);
  }
});
