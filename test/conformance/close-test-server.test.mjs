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
