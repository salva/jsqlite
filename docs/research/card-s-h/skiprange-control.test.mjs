import assert from 'node:assert/strict';import test from 'node:test';
import {Stat4Probe} from '../../../src/internal/stat4-probe.ts';import {KeyInfo} from '../../../src/internal/comparison.ts';import {parseSql} from '../../../src/internal/parse.ts';
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:3,keyFieldCount:2,terms:[{},{},{}]});
for(const fault of ['cancel','deadline','reserve'])for(const after of [1,3])test(`existing probe ${fault} fault after${after} releases reservation and restores prefix`,()=>{
 let live=0,calls=0,enabled=false;const primary=new Error(fault),reserve=n=>{if(enabled&&fault==='reserve'&&++calls===after)throw primary;live+=n;let active=true;return()=>{if(active){active=false;live-=n}}},check=()=>{if(enabled&&fault!=='reserve'&&++calls===after)throw primary};
 const p=new Stat4Probe(info,check,reserve);try{p.setLiteral(0,7n);p.nRecValid=1;p.nField=1;enabled=true;
 assert.throws(()=>p.withPrefix(2,()=>{for(let i=0;i<4;i++)p.setExpression(i%3,parseSql(`SELECT '${'x'.repeat(100*(i+1))}'`).statement.result[0].reduction,'text')}),e=>e===primary);
 assert.equal(p.nRecValid,1);assert.equal(p.nField,1);
 }finally{p.release();p.release()}
 assert.equal(live,0);assert.ok(p.values.every(m=>m.initialStorageClass==='null'));
 enabled=false;const next=new Stat4Probe(info,check,reserve);try{next.setLiteral(0,8n)}finally{next.release()}assert.equal(live,0);
});
