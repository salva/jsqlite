import ctypes,json,os,pathlib
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']);l=ctypes.CDLL(str(w/'scoped-or-delivery/oracle-build/build/libsqlite3-oracle.so'));P=ctypes.c_void_p
for n,args,ret in [('sqlite3_open_v2',[ctypes.c_char_p,ctypes.POINTER(P),ctypes.c_int,P],ctypes.c_int),('sqlite3_prepare_v2',[P,ctypes.c_char_p,ctypes.c_int,ctypes.POINTER(P),P],ctypes.c_int),('sqlite3_step',[P],ctypes.c_int),('sqlite3_column_int64',[P,ctypes.c_int],ctypes.c_longlong),('sqlite3_column_type',[P,ctypes.c_int],ctypes.c_int),('sqlite3_finalize',[P],ctypes.c_int),('sqlite3_close',[P],ctypes.c_int),('sqlite3_sourceid',[],ctypes.c_char_p)]:f=getattr(l,n);f.argtypes=args;f.restype=ret
cases=[
 ('reverse','SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE x.id<=2 AND y.rowid>=4 ORDER BY x.id,y.id DESC'),
 ('correlated','SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE (x.a=1 OR x.b=\'beta\') AND x.id<=2 AND y.rowid<=x.id ORDER BY x.id,y.id'),
 ('in','SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE x.id<=2 AND y.a IN (1,2) AND y.rowid<=2 ORDER BY x.id,y.id'),
 ('left','SELECT x.id,y.id FROM o x LEFT JOIN o y ON y.rowid<=0 WHERE x.id<=2 ORDER BY x.id,y.id'),
 ('right','SELECT x.id,y.id FROM o x RIGHT JOIN o y ON x.rowid<=0 WHERE y.id<=2 ORDER BY x.id,y.id'),
 ('empty','SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE (x.a=1 OR x.b=\'beta\') AND x.id<=2 AND y.rowid<=0 ORDER BY x.id,y.id')]
out={'sourceId':l.sqlite3_sourceid().decode(),'variants':[]}
for enc in ['utf8','utf16le','utf16be']:
 db=P();assert l.sqlite3_open_v2(f'test/fixtures/or-rowid/{enc}.db'.encode(),ctypes.byref(db),1,None)==0;v={'id':enc,'cases':[]}
 for name,sql in cases:
  st=P();assert l.sqlite3_prepare_v2(db,sql.encode(),-1,ctypes.byref(st),None)==0;rows=[]
  while True:
   rc=l.sqlite3_step(st)
   if rc==101:break
   assert rc==100;rows.append([{'type':'null' if l.sqlite3_column_type(st,i)==5 else 'integer','value':str(l.sqlite3_column_int64(st,i))} for i in range(2)])
  l.sqlite3_finalize(st);v['cases'].append({'id':name,'sql':sql,'rows':rows})
 l.sqlite3_close(db);out['variants'].append(v)
c=w/'scoped-or-delivery/candidate';(c/'docs/research/card-s-f-or/join-end-native.json').write_text(json.dumps(out,indent=2)+'\n');print([(x['id'],len(x['rows'])) for x in v['cases']])
p=c/'test/conformance/or-rowid-red.test.mjs';s=p.read_text();s+='''
const joinEndNative=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/join-end-native.json',import.meta.url)));
for(const native of joinEndNative.variants)for(const c of native.cases)test(`${native.id}: joined end native ${c.id}`,async()=>withDb(capture.variants.find(v=>v.id===native.id),async db=>{
 const st=db.prepare(c.sql).statement,rows=[];
 try{while(await st.step()==='row'){rows.push(Array.from({length:st.columnCount},(_,i)=>({type:st.columnType(i),value:st.column(i)})))}
 assert.deepEqual(rows,c.rows.map(row=>row.map(cell=>({type:cell.type,value:cell.type==='null'?null:BigInt(cell.value)}))));}finally{st.finalize()}
}));
''';p.write_text(s)
