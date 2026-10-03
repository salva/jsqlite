// Preserved acceptance reproducer from the red stage; now expected to pass.
import fs from 'node:fs';
import path from 'node:path';
const walk = p => fs.readdirSync(p,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(p,e.name)) : [path.join(p,e.name)]);
const files = walk('examples');
const html = files.filter(p=>p.endsWith('.html'));
const readme=fs.readFileSync('README.md','utf8');
const checks = [
 ['browser ESM prerequisite exists', fs.existsSync('dist/index.js')],
 ['static demo HTML entry under examples', html.length>0],
 ['README provides local HTTP serve command', /(?:python3?\s+-m\s+http\.server|npx\s+(?:serve|http-server)|node\s+\S*serve)/.test(readme)],
 ['README links browser demo entry', /examples\/[^\s)]*(?:html|browser|demo)/.test(readme)],
];
for (const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'}: ${label}`);
process.exitCode=checks.some(([,ok])=>!ok)?1:0;
