// Development-only build: no bundler, runtime dependency, or parallel evaluator.
import { rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
rmSync(new URL('../../dist/', import.meta.url), { recursive: true, force: true });
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url)), '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) {
  rmSync(new URL('../../dist/', import.meta.url), { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

// TS 5.9 rewrites JS imports, but not declaration module specifiers. Normalize
// only AST-owned relative module strings, never SQL strings or arbitrary text.
function declarations(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) { declarations(url); continue; }
    if (!entry.name.endsWith('.d.ts')) continue;
    let text = readFileSync(url, 'utf8');
    const ast = ts.createSourceFile(entry.name, text, ts.ScriptTarget.Latest, true);
    const edits = [];
    function visit(node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        ? node.moduleSpecifier
        : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      if (specifier && ts.isStringLiteral(specifier) && /^\.\.?\//.test(specifier.text) && specifier.text.endsWith('.ts')) {
        edits.push([specifier.getStart(ast) + 1, specifier.end - 1, specifier.text.slice(0, -3) + '.js']);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
      text = text.slice(0, start) + replacement + text.slice(end);
    }
    writeFileSync(url, text);
  }
}
declarations(new URL('../../dist/', import.meta.url));
