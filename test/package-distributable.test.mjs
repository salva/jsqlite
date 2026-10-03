// Local-only acceptance probe. All disposable artifacts belong to the card work root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
assert(process.env.SAIVAGE_CARD_WORK_ROOT, 'set SAIVAGE_CARD_WORK_ROOT to a disposable work directory');
const work = path.join(process.env.SAIVAGE_CARD_WORK_ROOT, 'package-validation');
fs.mkdirSync(work, { recursive: true });
const env = { ...process.env, npm_config_cache: path.join(work, 'npm-cache'), npm_config_update_notifier: 'false' };
const commands = [];
function run(command, args, cwd = root) {
  const r = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  commands.push({ command: [command, ...args], cwd, exit: r.status, stdout: r.stdout, stderr: r.stderr });
  fs.writeFileSync(path.join(work, 'commands.json'), JSON.stringify(commands, null, 2)+'\n');
  assert.equal(r.status, 0, `${command} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function inventory(dir) {
  return fs.readdirSync(dir, { recursive: true }).filter(p => fs.statSync(path.join(dir, p)).isFile()).sort()
    .map(p => ({ path: p, bytes: fs.statSync(path.join(dir, p)).size, sha256: hash(fs.readFileSync(path.join(dir, p))) }));
}
run('npm', ['run', 'build']);
const first = inventory(path.join(root, 'dist'));
fs.writeFileSync(path.join(root, 'dist', 'stale.js'), 'throw new Error("stale")');
run('npm', ['run', 'build']);
assert.deepEqual(inventory(path.join(root, 'dist')), first, 'clean rebuild must be byte-identical and remove stale files');
run('npm', ['run', 'typecheck']);
run('npm', ['run', 'test:package-boundary']);
const dry = JSON.parse(run('npm', ['pack', '--dry-run', '--json']))[0];
const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work]))[0];
assert.deepEqual(packed.files, dry.files);
const tarball = path.join(work, packed.filename);
const tarHash = hash(fs.readFileSync(tarball));
const repacked = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work]))[0];
assert.equal(repacked.integrity, packed.integrity);
assert.equal(hash(fs.readFileSync(tarball)), tarHash, 'tarball must be reproducible');
const extracted = path.join(work, 'extracted');
fs.rmSync(extracted, { recursive: true, force: true });
fs.mkdirSync(extracted);
run('tar', ['-xzf', tarball, '-C', extracted]);
const pkgRoot = path.join(extracted, 'package');
const files = inventory(pkgRoot);
assert.deepEqual(files.map(f => f.path), packed.files.map(f => f.path).sort());
for (const f of files) assert(/^(package\.json|README\.md|dist\/.+\.(js|d\.ts))$/.test(f.path), `unexpected tar entry ${f.path}`);
const meta = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json')));
assert.equal(meta.private, true);
assert(!meta.dependencies);

// Inspect actual artifacts with an AST, not grep over comments/SQL strings.
const modules = new Map();
let fetchSites = 0;
for (const f of files.filter(f => f.path.endsWith('.js') || f.path.endsWith('.d.ts'))) {
  const code = fs.readFileSync(path.join(pkgRoot, f.path), 'utf8');
  const ast = ts.createSourceFile(f.path, code, ts.ScriptTarget.Latest, true);
  const imports = [];
  function walk(n) {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) imports.push(n.moduleSpecifier.text);
    if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) imports.push(n.argument.literal.text);
    if (!f.path.endsWith('.d.ts')) {
      if (ts.isIdentifier(n)) assert(!['process', 'Buffer', 'require', 'WebAssembly', 'eval', 'Function', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon'].includes(n.text), `${f.path}: forbidden identifier ${n.text}`);
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fetch') {
        fetchSites++; assert.equal(f.path, 'dist/index.js', 'only public acquisition may fetch');
      }
      if (ts.isCallExpression(n)) assert(n.expression.kind !== ts.SyntaxKind.ImportKeyword, `${f.path}: dynamic import`);
      if (ts.isPropertyAccessExpression(n)) assert(!['eval', 'Function', 'WebAssembly', 'sendBeacon', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].includes(n.name.text), `${f.path}: forbidden global property`);
    }
    ts.forEachChild(n, walk);
  }
  walk(ast);
  for (const spec of imports) {
    assert(/^\.\.?\/.+\.js$/.test(spec), `${f.path}: nonlocal/non-JS import ${spec}`);
    const target = path.normalize(path.join(path.dirname(f.path), spec));
    assert(target.startsWith('dist/'), 'import escapes runtime');
    assert(fs.existsSync(path.join(pkgRoot, target.replace(/\.js$/, f.path.endsWith('.d.ts') ? '.d.ts' : '.js'))), `missing import ${target}`);
  }
  if (f.path.endsWith('.js')) modules.set(f.path, { code, imports });
}
assert.equal(fetchSites, 1);
const reachable = new Set();
function visit(p) { if (reachable.has(p)) return; reachable.add(p); for (const spec of modules.get(p).imports) visit(path.normalize(path.join(path.dirname(p), spec))); }
visit('dist/index.js');
assert.equal(reachable.size, modules.size, 'ship only the complete runtime closure');

// Isolated browser-global realm: no Node globals, code generation, user imports,
// real network or telemetry. This is a browser-safety smoke, not a GUI browser.
const fixtureRoot = path.join(root, 'test/fixtures/generations');
const generation = fs.readdirSync(fixtureRoot).sort().find(g => fs.existsSync(path.join(fixtureRoot, g, 'generated/encoding-utf16be.db')));
assert(generation, 'existing encoding fixtures required');
let body;
const requests = [];
const context = vm.createContext({ URL, Request, Response, AbortController, TextEncoder, TextDecoder, setTimeout, clearTimeout, crypto: globalThis.crypto,
  fetch: async request => { requests.push({ url: request.url, credentials: request.credentials }); return new Response(body); },
}, { codeGeneration: { strings: false, wasm: false } });
const browserModules = new Map([...modules].map(([p, m]) => [p, new vm.SourceTextModule(m.code, { context, identifier: p })]));
const entry = browserModules.get('dist/index.js');
await entry.link((specifier, parent) => browserModules.get(path.normalize(path.join(path.dirname(parent.identifier), specifier))));
await entry.evaluate();
assert.deepEqual(Object.keys(entry.namespace).sort(), ['JSQLiteError', 'open']);
for (const encoding of ['utf8', 'utf16le', 'utf16be']) {
  body = new Uint8Array(fs.readFileSync(path.join(fixtureRoot, generation, `generated/encoding-${encoding}.db`)));
  const connection = await entry.namespace.open('https://fixture.invalid/main.db');
  const statement = connection.prepare("SELECT ?1, 1.5, NULL, 'é', x'0102'").statement;
  statement.bind(1, 9223372036854775807n);
  assert.equal(await statement.step(), 'row');
  assert.equal(statement.column(0), 9223372036854775807n);
  assert.equal(statement.columnType(0), 'integer');
  assert.equal(statement.column(1), 1.5); assert.equal(statement.columnType(1), 'real');
  assert.equal(statement.column(2), null); assert.equal(statement.columnType(2), 'null');
  assert.equal(statement.column(3), 'é');
  assert.deepEqual(Array.from(statement.column(4)), [1, 2]);
  assert.equal(await statement.step(), 'done');
  statement.reset(); statement.bind(1, -7n); assert.equal(await statement.step(), 'row'); assert.equal(statement.column(0), -7n);
  statement.finalize(); connection.close();
}
assert.equal(requests.length, 3, 'only explicit acquisitions may fetch');
assert(requests.every(r => r.credentials === 'omit'));

// Consume installed tarball via named package ESM and strict declarations.
const consumer = path.join(work, 'consumer');
fs.rmSync(consumer, { recursive: true, force: true }); fs.mkdirSync(consumer);
fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumer);
const nodeConsumer = await import(pathToFileURL(path.join(consumer, 'node_modules/jsqlite2/dist/index.js')).href);
assert.deepEqual(Object.keys(nodeConsumer).sort(), ['JSQLiteError', 'open']);
fs.writeFileSync(path.join(consumer, 'import.mjs'), "import {open,JSQLiteError} from 'jsqlite2'; if(typeof open!=='function'||new JSQLiteError('misuse','x').kind!=='misuse')throw Error('bad exports');\n");
run(process.execPath, ['import.mjs'], consumer);
const typeProbe = fs.readFileSync(path.join(root, 'test-d/api.test.ts'), 'utf8').replaceAll('../src/index.js', 'jsqlite2');
fs.writeFileSync(path.join(consumer, 'api.test.ts'), typeProbe);
fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022','DOM','DOM.Iterable'],exactOptionalPropertyTypes:true},include:['api.test.ts']}));
run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], consumer);
// Validate all shipped declarations as well as the public entry, without skipLibCheck.
run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', ...files.filter(f => f.path.endsWith('.d.ts')).map(f => path.join(pkgRoot, f.path))]);
run('npm', ['publish', tarball, '--dry-run', '--json', '--ignore-scripts', '--tag', 'local'], consumer);
const evidence = { node:process.version, fixtureGeneration:generation, tarball:{filename:packed.filename,sha256:hash(fs.readFileSync(tarball)),shasum:packed.shasum,integrity:packed.integrity,size:packed.size,unpackedSize:packed.unpackedSize}, runtimeModules:reachable.size, files, browserRequests:requests, commands };
fs.writeFileSync(path.join(work, 'evidence.json'), JSON.stringify(evidence, null, 2)+'\n');
console.log(JSON.stringify({result:'PASS',runtimeModules:reachable.size,files:files.length,tarball:evidence.tarball,evidence:path.join(work,'evidence.json'),browser:'isolated browser-global VM, no GUI browser'},null,2));
