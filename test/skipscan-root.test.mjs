import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {skipscanRoot} from './skipscan-root.mjs';
test('explicit ROOT owns fixtures; absence is a failure, not legacy fallback',()=>{
 const prior=process.env.SKIPSCAN_NATIVE_ROOT,legacy=new URL('../docs/research/card-s-g/',import.meta.url);
 try{
 delete process.env.SKIPSCAN_NATIVE_ROOT;assert.equal(skipscanRoot(legacy),legacy);
 const root=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'root-helper-unit');fs.mkdirSync(root,{recursive:true});
 process.env.SKIPSCAN_NATIVE_ROOT=root;assert.equal(skipscanRoot(legacy).href,pathToFileURL(root+path.sep).href);
 assert.throws(()=>fs.readFileSync(new URL('absent-native.json',skipscanRoot(legacy))),e=>e.code==='ENOENT');
 }finally{if(prior===undefined)delete process.env.SKIPSCAN_NATIVE_ROOT;else process.env.SKIPSCAN_NATIVE_ROOT=prior;}
});
