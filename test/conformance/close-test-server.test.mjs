import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {closeTestServer} from './close-test-server.mjs';

test('test teardown closes retained HTTP body socket after consumer stops', async () => {
  const server=http.createServer((_req,res)=>{res.writeHead(200);res.write('unconsumed body');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const response=await fetch(`http://127.0.0.1:${server.address().port}`);
  assert.equal(response.status,200);
  let timer;
  try {
    await Promise.race([closeTestServer(server),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HTTP teardown stalled')),1000);})]);
    assert.equal(server.listening,false);
  } finally {clearTimeout(timer);server.closeAllConnections();}
});

test('test teardown stops admission before sockets and awaits callback errors', async () => {
  const calls=[];let finish;
  const server={close(callback){calls.push('close');finish=callback;},closeAllConnections(){calls.push('sockets');}};
  const pending=closeTestServer(server);
  assert.deepEqual(calls,['close','sockets']);
  let settled=false;pending.finally(()=>{settled=true;}).catch(()=>{});
  await Promise.resolve();assert.equal(settled,false);
  const failure=new Error('close callback failure');finish(failure);
  await assert.rejects(pending,error=>error===failure);
});

test('test teardown follows awaited request abort without hiding its error', async () => {
  let complete;const closed=new Promise(resolve=>{complete=resolve;});
  const server=http.createServer((_req,res)=>{res.on('close',complete);res.writeHead(200);res.write('body');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const control=new AbortController();
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}`,{signal:control.signal});
    const reader=response.body.getReader();await reader.read();
    const pending=reader.read();control.abort();
    await assert.rejects(pending,error=>error.name==='AbortError');
    await closed;
    await closeTestServer(server);
    assert.equal(server.listening,false);
    assert.equal(await new Promise((resolve,reject)=>server.getConnections((error,count)=>error?reject(error):resolve(count))),0);
  }finally{server.closeAllConnections();if(server.listening)await closeTestServer(server);}
});
