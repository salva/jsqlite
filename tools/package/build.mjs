// Development-only build: no bundler, runtime dependency, or parallel evaluator.
import { rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
// Content-addressed, development-only reuse. Never trust timestamps or dist: a
// cache hit restores a verified snapshot after removing ALL previous output.
// Hash the compiler distribution as well as sources/config/build implementation.
function inventory(directory) {
  return readdirSync(directory, { recursive: true }).sort()
    .filter(p => statSync(path.join(directory, p)).isFile())
    .map(p => [p, createHash('sha256').update(readFileSync(path.join(directory, p))).digest('hex')]);
}
const inputs = ['src', 'node_modules/typescript/lib'].map(p => [p, inventory(path.join(root, p))]);
for (const p of [...readdirSync(root).filter(p => /^tsconfig.*\.json$/.test(p)), 'package.json', 'package-lock.json', 'tools/package/build.mjs', 'node_modules/typescript/package.json'].sort()) {
  inputs.push([p, createHash('sha256').update(readFileSync(path.join(root, p))).digest('hex')]);
}
const key = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
const cache = path.join(root, 'build/package-cache', key);
const dist = path.join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
try {
  const expected = JSON.parse(readFileSync(path.join(cache, 'inventory.json'), 'utf8'));
  const actual = inventory(path.join(cache, 'dist'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('invalid build snapshot');
  for (const [p] of actual) {
    mkdirSync(path.dirname(path.join(dist, p)), { recursive: true });
    writeFileSync(path.join(dist, p), readFileSync(path.join(cache, 'dist', p)));
  }
  console.error('Restored verified package build snapshot');
  process.exit(0);
} catch {
  rmSync(cache, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });
}
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
// Publish only a complete normalized successful build, atomically. Cache is
// disposable and not shipped; damage triggers compilation, never stale reuse.
const staging = `${cache}.${process.pid}`;
rmSync(staging, { recursive: true, force: true });
const outputs = inventory(dist);
for (const [p] of outputs) {
  mkdirSync(path.dirname(path.join(staging, 'dist', p)), { recursive: true });
  writeFileSync(path.join(staging, 'dist', p), readFileSync(path.join(dist, p)));
}
writeFileSync(path.join(staging, 'inventory.json'), JSON.stringify(outputs));
renameSync(staging, cache);

