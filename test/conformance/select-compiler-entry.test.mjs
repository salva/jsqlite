// [[card:card-t-b]] Consumed SELECT compiler ownership gate.
// parse.y cmd ::= select routes through sqlite3Select; the TS public prepare
// method must likewise consume the unified compiler, not dispatch legacy shapes.
// Inspect the actual method AST, not a fixed-width substring or const spelling:
// metadata PRAGMA and binding reprepare legitimately share a mutable Program.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import ts from "typescript";

function assertCompilerOwnership(source) {
  const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let prepare;
  function find(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(tree) === 'prepare' && node.body) {
      assert.equal(prepare, undefined, 'one implemented public prepare method');
      prepare = node;
    }
    ts.forEachChild(node, find);
  }
  find(tree);
  assert.ok(prepare, 'implemented public prepare method exists');
  const legacy = new Set(['compileRecursiveWindowSelect', 'compileRecursiveAggregateSelect', 'compileMultipleRecursiveCtes', 'compileRecursiveCteSelect', 'compileAggregateSelect', 'compileTableSelect', 'compileScalarSelect']);
  let consumed = 0;
  function inspect(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      assert.ok(!legacy.has(name), `${name} must be a compiler-owned branch, not public shape dispatch`);
      if (name === 'compileSelect') {
        const parent = node.parent;
        if ((ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node && parent.left.getText(tree) === 'program') ||
            (ts.isVariableDeclaration(parent) && parent.initializer === node && parent.name.getText(tree) === 'program')) consumed++;
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(prepare.body);
  assert.equal(consumed, 1, 'prepare consumes one initial SELECT program from the unified compiler');
}

const source = readFileSync(new URL("../../src/index.ts", import.meta.url), "utf8");
test("public prepare delegates SELECT compilation through one consumed compiler entry", () => {
  assertCompilerOwnership(source);
});

test('compiler ownership gate rejects absent, discarded and bypassed compiler calls', () => {
  const method = body => `class Connection { prepare(sql: string) { ${body} } }`;
  assertCompilerOwnership(method('let program; program = compileSelect(sql);'));
  assertCompilerOwnership(method('const program = compileSelect(sql);'));
  for (const body of ['const program = compileScalarSelect(sql);', 'let program; compileSelect(sql);', 'let program; /* program = compileSelect(sql); */', 'const program = compileSelect(sql); compileAggregateSelect(sql);']) {
    assert.throws(() => assertCompilerOwnership(method(body)), { name: 'AssertionError' });
  }
});
