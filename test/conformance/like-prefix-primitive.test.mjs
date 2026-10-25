import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {likePrefixRange} from '../../src/internal/like-prefix.ts';

const bytes=s=>new TextEncoder().encode(s);
const receipt=JSON.parse(fs.readFileSync(new URL('./cases/like-prefix-native.json',import.meta.url)));
const text=c=>c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():null;
for(const variant of receipt.variants)test(`prefix primitive vs pinned String8 bounds/${variant.encoding}`,()=>{
 const modeCases=[['like','abc%',0],['glob','abc*',3],['like','ab!_%',6,'!'],['like','ab_c%',7],['glob','-a*',11],['like','é%',12]];
 for(const [mode,pattern,index,escape] of modeCases){
  const c=variant.cases[index];
  const range=likePrefixRange(bytes(pattern),mode,variant.encoding.toLowerCase(),index!==11,escape===undefined?undefined:bytes(escape));
  const bounded=c.native.eqp.some(line=>line.includes('>? AND'));
  assert.equal(range!==null,bounded,`${variant.encoding}: ${c.sql}`);
  if(!range)continue;
  const strings=c.native.program.filter(row=>text(row[1])==='String8');
  assert.ok(strings.length>=2);
  assert.equal(Buffer.from(range.lower).toString('hex'),strings[0][5].utf8Hex,c.sql);
  assert.equal(Buffer.from(range.upper).toString('hex'),strings[1][5].utf8Hex,c.sql);
 }
});

test('source branches: completeness, escapes, numeric safety, UTF-8 successor',()=>{
 const get=(s,mode='like',encoding='utf-8',textColumn=true,escape)=>likePrefixRange(bytes(s),mode,encoding,textColumn,escape===undefined?undefined:bytes(escape));
 assert.equal(get('abc%').complete,true);
 assert.equal(get('abc%','like','utf-16le').complete,false);
 assert.equal(get('abc_').complete,false);
 assert.equal(get('abc').complete,false);
 assert.equal(get('@%').complete,false);
 for(const s of ['', '%abc','_abc'])assert.equal(get(s),null,s);
 for(const s of ['*abc','?abc','[ab]'])assert.equal(get(s,'glob'),null,s);
 assert.equal(get('!','like','utf-8',true,'!'),null);
 assert.equal(get('abc%','like','utf-8',true,'é'),null);
 assert.equal(get('abc%','like','utf-8',true,'%'),null);
 assert.equal(get('abc%','like','utf-8',true,'_'),null);
 assert.equal(Buffer.from(get('ab!_%','like','utf-8',true,'!').lower).toString(),'AB_');
 assert.equal(get('é%','like','utf-16le'),null);
 assert.equal(get('\ufffd%'),null);
 // Both trial boundaries must be nonnumeric. Slash increments to zero.
 for(const s of ['12%','-1%','1.2%','1e2%',' /%','-%'])assert.equal(get(s,'like','utf-8',false),null,s);
 assert.ok(get('12abc%','like','utf-8',false));
 const edge=get('ÿ*','glob');
 assert.equal(Buffer.from(edge.lower).toString('hex'),'c3bf');
 assert.equal(Buffer.from(edge.upper).toString('hex'),'c480');
 const two=likePrefixRange(Uint8Array.from([0x61,0xc3,0xbf,0x2a]),'glob','utf-8',true);
 assert.equal(Buffer.from(two.upper).toString('hex'),'61c480');
 assert.equal(likePrefixRange(Uint8Array.from([0xff,0x25]),'like','utf-8',true),null);
 assert.equal(likePrefixRange(Uint8Array.from([0xed,0xa0,0x80,0x25]),'like','utf-8',true),null);
});
