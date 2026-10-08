// Development-only emitted-source prerequisite shared by direct demo units and
// integration. Never rebuild an independently installed demo/package root.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function ensureDemoEngine(root = process.cwd()) {
  root = path.resolve(root);
  const query = fs.readFileSync(path.join(root, 'examples/browser/query.js'), 'utf8');
  const specifier = query.match(/from\s+['"]([^'"]+index\.js)['"]/)?.[1];
  if (!specifier) throw Error('demo prerequisite: engine import not found');
  const engine = path.resolve(root, 'examples/browser', specifier);
  if (fs.existsSync(engine)) return;
  if (process.env.JSQLITE_DEMO_ROOT) throw Error(`demo prerequisite: installed engine missing: ${engine}`);
  if (!process.env.SAIVAGE_CARD_WORK_ROOT) throw Error('demo prerequisite: missing emitted engine; build first (npm run build) or supply SAIVAGE_CARD_WORK_ROOT for isolated test emission');
  const work = path.join(process.env.SAIVAGE_CARD_WORK_ROOT, 'demo-emission');
  fs.mkdirSync(work, { recursive: true });
  const lock = path.join(work, 'lock');
  const deadline = Date.now() + 20000;
  while (true) {
    try { fs.mkdirSync(lock); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() >= deadline) throw Error('demo prerequisite: emitted-source lock wait failed');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  try {
    if (fs.existsSync(engine)) return; // Another direct unit emitted before us.
    const compiler = process.env.JSQLITE_TSC ?? createRequire(pathToFileURL(path.join(root, 'package.json'))).resolve('typescript/bin/tsc');
    console.log('demo prerequisite: emit before browser:', process.execPath, compiler, '-p tsconfig.build.json');
    const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit', timeout: 20000 });
    if (result.error || result.status !== 0) throw Error(`demo prerequisite: emission failed (${result.error?.message ?? result.status})`);
    if (!fs.existsSync(engine)) throw Error(`demo prerequisite: emission did not produce ${engine}`);
  } finally { fs.rmdirSync(lock); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  await ensureDemoEngine(process.env.JSQLITE_DEMO_ROOT ?? process.cwd());
}
