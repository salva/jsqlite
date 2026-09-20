import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const native=JSON.parse(fs.readFileSync(path.join(root,'test/conformance/cases/stage3-date-time.native.json'),'utf8'));
const names={'UTF-8':'users-utf8.db','UTF-16le':'users-utf16le.db','UTF-16be':'users-utf16be.db'};
function fromHexFloat(text){const m=/^(-?)0x([0-9a-f]+)(?:\.([0-9a-f]+))?p([+-]?\d+)$/i.exec(text);assert.ok(m,`bad hex float ${text}`);let n=parseInt(m[2],16),scale=1;for(const c of m[3]??''){scale/=16;n+=parseInt(c,16)*scale}return (m[1]? -1:1)*n*2**Number(m[4])}
function expectedValue(cell){if(cell.type==='null')return null;if(cell.type==='integer')return BigInt(cell.value);if(cell.type==='real')return fromHexFloat(cell.value);if(cell.type==='text')return cell.value;throw new Error(`unsupported expected type ${cell.type}`)}
let passed=0;
for(const [encoding,file] of Object.entries(names)){
 const fixture=path.join(root,'test/fixtures/expression-cursor',file);
 const server=http.createServer((req,res)=>{const stat=fs.statSync(fixture);res.writeHead(200,{'Content-Length':stat.size});fs.createReadStream(fixture).pipe(res)});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try{
  const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  try{
   for(const observation of native.observations.filter(x=>x.encoding===encoding)){
    const {statement}=db.prepare(observation.sql);let actualType,actualValue;try{assert.equal(await statement.step(),'row',observation.id);assert.equal(statement.columnCount,observation.row.length);for(let i=0;i<observation.row.length;i++){const expected=observation.row[i];actualType=statement.columnType(i);actualValue=statement.column(i);assert.equal(actualType,expected.type,`${observation.id} type`);assert.ok(Object.is(actualValue,expectedValue(expected)),`${observation.id}: ${String(actualValue)} != ${String(expectedValue(expected))}`)}assert.equal(await statement.step(),'done',observation.id);passed++;}finally{statement.finalize()}
   }
   // Parameter, column, composition, and reset/rebind stay on the ordinary
   // compiler/VDBE Function path rather than a date-specific evaluator.
   const {statement:parameter}=db.prepare("SELECT datetime(?,'unixepoch'), date(datetime(?,'unixepoch'))");
   try{parameter.bind(1,0n);parameter.bind(2,0n);assert.equal(await parameter.step(),'row');assert.deepEqual([parameter.column(0),parameter.column(1)],['1970-01-01 00:00:00','1970-01-01']);assert.equal(await parameter.step(),'done');parameter.reset();parameter.bind(1,86400n);parameter.bind(2,86400n);assert.equal(await parameter.step(),'row');assert.deepEqual([parameter.column(0),parameter.column(1)],['1970-01-02 00:00:00','1970-01-02']);}finally{parameter.finalize()}
   const {statement:column}=db.prepare("SELECT datetime(id,'unixepoch') FROM users ORDER BY id");
   try{const columnRows=[];while(await column.step()==='row')columnRows.push(column.column(0));assert.deepEqual(columnRows,['1970-01-01 00:00:01','1970-01-01 00:00:02','1970-01-01 00:00:03']);}finally{column.finalize()}
   const {statement:formats}=db.prepare("SELECT strftime('%d|%e|%f|%F|%G|%g|%H|%k|%I|%l|%j|%J|%m|%M|%p|%P|%R|%s|%S|%T|%u|%w|%U|%V|%W|%Y|%%','2021-01-03 13:04:05.125','subsec'),strftime('%F','2000-01-01','+1 day')");
   try{assert.equal(await formats.step(),'row');assert.equal(formats.column(0),'03| 3|05.125|2021-01-03|2020|20|13|13|01| 1|004|2459218.044503761|01|04|PM|pm|13:04|1609679045.125|05|13:04:05|7|0|01|53|00|2021|%');assert.equal(formats.column(1),'2000-01-02')}finally{formats.finalize()}
   // strftime's first argument is the format, not a time-value. These ordinary
   // format-first cases guard the date.c strftimeFunc argv+1 dispatch boundary.
   const {statement:formatFirst}=db.prepare("SELECT strftime('%Y','2000-01-02'),strftime('%Y-%m-%d','2024-02-29','+1 year','floor')");
   try{assert.equal(await formatFirst.step(),'row');assert.deepEqual([formatFirst.column(0),formatFirst.column(1)],['2000','2025-02-28'])}finally{formatFirst.finalize()}
   // timediff is calendar-aware. In addition to exact pinned results, applying
   // each result back to B checks date.c's datetime(B,timediff(A,B)) invariant.
   const {statement:timeDiffCalendar}=db.prepare("SELECT timediff('2024-03-31','2024-02-29'),datetime('2024-02-29',timediff('2024-03-31','2024-02-29')),timediff('2025-02-28','2024-02-29'),datetime('2024-02-29',timediff('2025-02-28','2024-02-29')),timediff('2023-02-28','2023-03-31'),datetime('2023-03-31',timediff('2023-02-28','2023-03-31'))");
   try{assert.equal(await timeDiffCalendar.step(),'row');assert.deepEqual(Array.from({length:6},(_,i)=>timeDiffCalendar.column(i)),['+0000-01-02 00:00:00.000','2024-03-31 00:00:00','+0000-11-30 00:00:00.000','2025-02-28 00:00:00','-0000-01-03 00:00:00.000','2023-02-28 00:00:00'])}finally{timeDiffCalendar.finalize()}
   const {statement:calendar}=db.prepare("SELECT date('2024-02-29','+1 year'),date('2024-02-29','+1 year','floor'),date('2023-12-31','+2 months'),date('2023-12-31','+2 months','floor'),datetime('2000-01-01','-0.0006 seconds','subsec'),datetime('2000-01-01','+0.0006 seconds','subsec')");
   try{assert.equal(await calendar.step(),'row');assert.deepEqual(Array.from({length:6},(_,i)=>calendar.column(i)),['2025-03-01','2025-02-28','2024-03-02','2024-02-29','1999-12-31 23:59:59.999','2000-01-01 00:00:00.001'])}finally{calendar.finalize()}
   const {statement:compound}=db.prepare("SELECT datetime('2000-01-31','+0000-01-00'),datetime('2000-01-31','+0000-01-00','floor'),datetime('2000-03-31','-0000-01-02'),datetime('2000-01-01','+0001-02-03 04:05:06.789'),datetime('2000-01-01','-0001-02-03 04:05:06.789')");
   try{assert.equal(await compound.step(),'row');assert.deepEqual(Array.from({length:5},(_,i)=>compound.column(i)),['2000-03-02 00:00:00','2000-02-29 00:00:00','2000-02-29 00:00:00','2001-03-04 04:05:06','1998-10-28 19:54:53'])}finally{compound.finalize()}
   const {statement:parser}=db.prepare("SELECT datetime('12:34'),datetime('12:34Z'),datetime('12:34 +14:59'),datetime('12:34 +15:00'),datetime('2000-01-01T12:34'),datetime('2000-01-01    12:34'),datetime('2000-01-01t12:34'),datetime('12:34:56.9999','subsec')");
   try{assert.equal(await parser.step(),'row');assert.deepEqual(Array.from({length:8},(_,i)=>parser.column(i)),['2000-01-01 12:34:00','2000-01-01 12:34:00','1999-12-31 21:35:00',null,'2000-01-01 12:34:00','2000-01-01 12:34:00',null,'2000-01-01 12:34:56.999'])}finally{parser.finalize()}
   const {statement:hour24}=db.prepare("SELECT date('24:00'),time('24:00'),datetime('24:00'),strftime('%F %H:%M','24:00'),datetime('24:00','subsec'),datetime('24:00','+0 days'),datetime('24:00','start of day')");
   try{assert.equal(await hour24.step(),'row');assert.deepEqual(Array.from({length:7},(_,i)=>hour24.column(i)),['2000-01-02','24:00:00','2000-01-02 24:00:00','2000-01-02 24:00','2000-01-02 24:00:00.000','2000-01-02 00:00:00','2000-01-01 00:00:00'])}finally{hour24.finalize()}
   const {statement:ordering}=db.prepare("SELECT datetime(0,'auto','+1 day'),datetime(0,'+1 day','auto'),datetime(0,'unixepoch','unixepoch'),datetime(2451544.5,'julianday','+1 day'),datetime(2451544.5,'+1 day','julianday')");
   try{assert.equal(await ordering.step(),'row');assert.deepEqual(Array.from({length:5},(_,i)=>ordering.column(i)),['-4713-11-25 12:00:00',null,null,'2000-01-02 00:00:00',null])}finally{ordering.finalize()}
   const {statement:invalidDay}=db.prepare("SELECT date('2023-02-31'),date('2023-02-31','floor'),date('2024-02-31','floor'),date('2023-04-31','floor'),date('2023-02-31','ceiling'),date('2023-02-31','start of month')");
   try{assert.equal(await invalidDay.step(),'row');assert.deepEqual(Array.from({length:6},(_,i)=>invalidDay.column(i)),['2023-03-03','2023-02-28','2024-02-29','2023-04-30','2023-03-03','2023-02-01'])}finally{invalidDay.finalize()}
   const {statement:numericMods}=db.prepare("SELECT datetime('2000-01-01','1e2 days'),datetime('2000-01-01','24 hours'),datetime('2000-01-01','1e10 seconds'),datetime('2000-01-01','0.5 month'),datetime('2000-01-01','-0.5 month'),datetime('2000-01-01','0.5 year'),datetime('2000-01-01','-0.5 year'),datetime('2000-01-01','5373485 days')");
   try{assert.equal(await numericMods.step(),'row');assert.deepEqual(Array.from({length:8},(_,i)=>numericMods.column(i)),['2000-04-10 00:00:00','2000-01-02 00:00:00','2316-11-20 17:46:40','2000-01-16 00:00:00','1999-12-17 00:00:00','2000-07-01 12:00:00','1999-07-02 12:00:00',null])}finally{numericMods.finalize()}
   const {statement:blobYears}=db.prepare("SELECT date(x'323030302D30312D3031'),date(x'626F677573'),strftime('%Y|%F|%G|%g','-0001-01-01'),strftime('%Y|%F','0000-01-01')");
   try{assert.equal(await blobYears.step(),'row');assert.deepEqual(Array.from({length:4},(_,i)=>blobYears.column(i)),['2000-01-01',null,'-001|-001-01-01|-002|-2','0000|0000-01-01'])}finally{blobYears.finalize()}
   const {statement:clockMods}=db.prepare("SELECT datetime('2000-01-01','+24:00'),datetime('2000-01-01','+24:00:01'),datetime('2000-01-01','+25:00'),datetime('2000-01-01','+01:60'),datetime('2000-01-01','+01:02:60'),datetime('2000-01-01','+01:02:03.9999'),datetime('2000-01-01','-00:00:00.0006'),datetime('2000-01-01','+1:02')");
   try{assert.equal(await clockMods.step(),'row');assert.deepEqual(Array.from({length:8},(_,i)=>clockMods.column(i)),['2000-01-01 00:00:00','2000-01-01 00:00:01',null,null,null,'2000-01-01 01:02:03','1999-12-31 23:59:59',null])}finally{clockMods.finalize()}
   const {statement:spaces}=db.prepare("SELECT datetime('2000-01-01 '),datetime(' 2451544.5'),datetime('now '),datetime('2000-01-01','1  day'),datetime('2000-01-01','1 day '),datetime('2000-01-01',' subsec')");
   try{assert.equal(await spaces.step(),'row');assert.deepEqual(Array.from({length:6},(_,i)=>spaces.column(i)),['2000-01-01 00:00:00','2000-01-01 00:00:00',null,'2000-01-02 00:00:00',null,null])}finally{spaces.finalize()}
  }finally{db.close()}
 }finally{server.close()}
}
assert.equal(passed,87);
console.log(JSON.stringify({outcome:'pass',nativeOracleObservations:passed,encodings:3}));
