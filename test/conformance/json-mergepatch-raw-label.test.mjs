import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {checkPathCases} from './json-path-case-assertions.mjs';
import {closeTestServer} from './close-test-server.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-scalar-raw-encodings-native.json',import.meta.url)));
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// Pinned jsonLabelCompare raw/raw memcmp and jsonTranslateBlobToText byte
// emission. Invalid UTF-8 here is not a blanket malformed-JSONB exemption.
// Second tuple fields retain the original UTF8-only receipt for provenance;
// current assertions consume independently recaptured per-encoding native rows.
const cases=[
 ["hex(jsonb_patch(x'4C17FF1331',x'3C17FF00'))",'0C'],
 ["hex(json_patch(x'4C17FF1331','{}'))",'7B22FF223A317D'],
 ["hex(jsonb_patch(x'4C17FF1331','{}'))",'4C17FF1331'],
 ["hex(jsonb_patch(x'4C17FF1331',x'3C17FE00'))",'4C17FF1331'],
 ["hex(jsonb_patch(x'4C17FF1331',x'4C17FF1332'))",'4C17FF1332'],
 ["hex(jsonb_patch(x'4C17611331',x'3C176100'))",'0C'],
 ["hex(jsonb_patch(x'4C17611331',x'88615C753030363100'))",'88615C753030363100'],
 ["hex(jsonb_patch(x'4C17611331',x'8C685C753030363100'))",'0C'],
 ["hex(jsonb_patch(x'4C17611331',x'8C695C783631202000'))",'4C17611331'],
 ["hex(jsonb_patch(x'4C17FF1331',x'8C685C753030666600'))",'4C17FF1331'],
 ["hex(json_patch(x'4C1AFF1331','{}'))",'7B22FF223A317D'],
 ["hex(json_patch(x'4C18FF1331','{}'))",'7B22FF223A317D'],
 ["hex(json_patch(x'4C19FF1331','{}'))",'7B22FF223A317D'],
 ["hex(jsonb_patch(x'4C17611331',x'8C695C753030363100'))",'0C'],
 ["hex(jsonb_patch(x'4C17611331',x'3C1A6100'))",'0C'],
 ["hex(jsonb_patch(x'6C376100621331',x'8C685C753030363100'))",'0C'],
 ["hex(jsonb_patch(x'6C376100621331',x'3C176100'))",'6C376100621331'],
 ["hex(json_patch(x'3C1A2200','{}'))",'7B225C22223A6E756C6C7D'],
 ["hex(json_patch(x'3C1A5C00','{}'))",'7B225C5C223A6E756C6C7D'],
 ["hex(json_patch(x'3C1A0100','{}'))",'7B225C7530303031223A6E756C6C7D'],
 ["hex(json_patch(x'3C195C00','{}'))",null],
 ["hex(json_patch(x'2C1761','{}'))",null],
 ["hex(jsonb_patch('{}',x'2C1761'))",null],
];
for(const enc of ['utf8','utf16le','utf16be'])test(`mergepatch raw label byte ownership ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  // Keep the original SQL inventory verbatim; values are native per-encoding.
  assert.deepEqual(oracle.encodings[enc].raw.map(c=>c.sql),cases.map(([sql])=>`SELECT ${sql}`));
  await checkPathCases(db,oracle.encodings[enc].raw);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
