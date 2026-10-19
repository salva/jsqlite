import path from 'node:path';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {checkPrettyBlobCases} from './json-pretty-blob-case-assertions.mjs';
const receipt=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-pretty-blob-native.json',import.meta.url)));
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
// Original whole SQL statements, including all flags, JSONB byte/subtype,
// each/tree and constructor errors, recaptured without preconverting BLOB input.
for(const encoding of ['utf8','utf16le','utf16be'])test(`BLOB document native admission ${encoding}`,async()=>{
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
  await checkPrettyBlobCases(db,receipt.encodings[encoding].blob);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
