import path from 'node:path';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {checkPathCases} from './json-path-case-assertions.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-path-encodings-native.json',import.meta.url)));
for(const enc of ['utf8','utf16le','utf16be'])test(`source-owned arrow path production ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  await checkPathCases(db,oracle.encodings[enc].arrow);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
