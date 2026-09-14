#!/usr/bin/env python3
"""Run the additive first-SELECT upstream assertions against the pinned oracle."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
m=json.loads((root/'test/conformance/cases/stage3-first-select.json').read_text())
lib=C.CDLL(sys.argv[1]); P=C.c_void_p
lib.sqlite3_sourceid.restype=C.c_char_p
if lib.sqlite3_sourceid().decode()!=m['sourceId']: raise SystemExit('oracle source ID mismatch')
lib.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(P)]; lib.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)]
lib.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
lib.sqlite3_step.argtypes=[P]; lib.sqlite3_column_count.argtypes=[P]; lib.sqlite3_column_type.argtypes=[P,C.c_int]
lib.sqlite3_column_int64.argtypes=[P,C.c_int]; lib.sqlite3_column_int64.restype=C.c_longlong
lib.sqlite3_column_name.argtypes=[P,C.c_int]; lib.sqlite3_column_name.restype=C.c_char_p
OK,ROW,DONE=0,100,101
def open_db(setup):
 d=P(); assert lib.sqlite3_open(b':memory:',C.byref(d))==OK
 for sql in setup:
  err=C.c_char_p(); rc=lib.sqlite3_exec(d,sql.encode(),None,None,C.byref(err)); assert rc==OK,(sql,rc,err.value)
 return d
def typed(stmt,i):
 t=lib.sqlite3_column_type(stmt,i)
 if t==1:return {'type':'integer','value':str(lib.sqlite3_column_int64(stmt,i))}
 raise AssertionError(f'unexpected native type {t}')
for case in m['cases']:
 d=open_db(m['setup'][case['fixture']]['sql']); s=P(); tail=C.c_char_p()
 rc=lib.sqlite3_prepare_v2(d,case['sql'].encode(),-1,C.byref(s),C.byref(tail)); assert rc==OK and s
 cols=[lib.sqlite3_column_name(s,i).decode() for i in range(lib.sqlite3_column_count(s))]
 rows=[]
 while True:
  rc=lib.sqlite3_step(s)
  if rc==DONE: break
  assert rc==ROW; rows.append([typed(s,i) for i in range(lib.sqlite3_column_count(s))])
 assert rows==case['native']['rows'],(case['ref'],rows)
 if 'columns' in case['native']: assert cols==case['native']['columns'],(case['ref'],cols)
 assert lib.sqlite3_finalize(s)==OK; assert lib.sqlite3_close(d)==OK
 print(json.dumps({'ref':case['ref'],'lane':'native-oracle','outcome':'pass'},separators=(',',':')))
print(json.dumps({'upstreamSummary':{'nativePassed':len(m['cases']),'tsPassed':0,'tsUnimplemented':len(m['cases'])}},separators=(',',':')))

# Executable no-credit boundary observations. These run after the upstream lane so
# native expectations stay separate from TS compatibility credit.
lib.sqlite3_bind_parameter_count.argtypes=[P]; lib.sqlite3_bind_parameter_name.argtypes=[P,C.c_int]; lib.sqlite3_bind_parameter_name.restype=C.c_char_p
lib.sqlite3_bind_parameter_index.argtypes=[P,C.c_char_p]; lib.sqlite3_bind_int64.argtypes=[P,C.c_int,C.c_longlong]; lib.sqlite3_bind_double.argtypes=[P,C.c_int,C.c_double]
lib.sqlite3_bind_blob.argtypes=[P,C.c_int,P,C.c_int,P]; lib.sqlite3_bind_text.argtypes=[P,C.c_int,C.c_char_p,C.c_int,P]; lib.sqlite3_bind_null.argtypes=[P,C.c_int]
lib.sqlite3_reset.argtypes=[P]; lib.sqlite3_clear_bindings.argtypes=[P]; lib.sqlite3_data_count.argtypes=[P]
lib.sqlite3_column_double.argtypes=[P,C.c_int]; lib.sqlite3_column_double.restype=C.c_double
lib.sqlite3_column_text.argtypes=[P,C.c_int]; lib.sqlite3_column_text.restype=P; lib.sqlite3_column_blob.argtypes=[P,C.c_int]; lib.sqlite3_column_blob.restype=P; lib.sqlite3_column_bytes.argtypes=[P,C.c_int]
lib.sqlite3_column_decltype.argtypes=[P,C.c_int]; lib.sqlite3_column_decltype.restype=C.c_char_p
lib.sqlite3_column_database_name.argtypes=[P,C.c_int]; lib.sqlite3_column_database_name.restype=C.c_char_p
lib.sqlite3_column_table_name.argtypes=[P,C.c_int]; lib.sqlite3_column_table_name.restype=C.c_char_p
lib.sqlite3_column_origin_name.argtypes=[P,C.c_int]; lib.sqlite3_column_origin_name.restype=C.c_char_p
import struct, tempfile, os
TRANSIENT=P(-1)
def prepare_buf(d,sql):
 b=C.create_string_buffer(sql.encode()); s=P(); tail=P(); lib.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)]; rc=lib.sqlite3_prepare_v2(d,b,-1,C.byref(s),C.byref(tail)); off=tail.value-C.addressof(b) if tail.value else 0; return rc,s,off,b
def value(s,i):
 t=lib.sqlite3_column_type(s,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(lib.sqlite3_column_int64(s,i))}
 if t==2:return {'type':'real','ieee754':struct.pack('>d',lib.sqlite3_column_double(s,i)).hex()}
 n=lib.sqlite3_column_bytes(s,i); p=(lib.sqlite3_column_text(s,i) if t==3 else lib.sqlite3_column_blob(s,i)); raw=C.string_at(p,n) if n else b''
 return {'type':'text','utf8Hex':raw.hex()} if t==3 else {'type':'blob','hex':raw.hex()}
def bind(s,b):
 i=b['index']; v=b['value']; t=v['type']
 if t=='integer': rc=lib.sqlite3_bind_int64(s,i,int(v['value']))
 elif t=='real': rc=lib.sqlite3_bind_double(s,i,struct.unpack('>d',bytes.fromhex(v['ieee754']))[0])
 elif t=='null': rc=lib.sqlite3_bind_null(s,i)
 elif t=='text':
  raw=bytes.fromhex(v['utf8Hex']); buf=C.create_string_buffer(raw or b'\0'); rc=lib.sqlite3_bind_text(s,i,C.cast(buf,C.c_char_p),len(raw),TRANSIENT)
 else:
  raw=bytes.fromhex(v['hex']); buf=C.create_string_buffer(raw or b'\0'); rc=lib.sqlite3_bind_blob(s,i,C.cast(buf,P),len(raw),TRANSIENT)
 assert rc==OK
byid={x['id']:x for x in m['companions']}
# sparse, repeated-name, reset/clear, row invalidation
c=byid['first-select-parameter-lifecycle']; d=open_db([]); rc,s,_,_=prepare_buf(d,c['sql']); assert rc==OK
names=[lib.sqlite3_bind_parameter_name(s,i) for i in range(1,8)]; names=[x.decode() if x else None for x in names]
assert lib.sqlite3_bind_parameter_count(s)==c['expected']['parameterCount'] and names==c['expected']['parameterNames']
for name,want in c['expected']['parameterIndexes'].items(): assert lib.sqlite3_bind_parameter_index(s,name.encode())==want
assert lib.sqlite3_step(s)==ROW; assert [value(s,i) for i in range(5)]==c['expected']['initialRow']; assert lib.sqlite3_reset(s)==OK
for b in c['bindings']: bind(s,b)
assert lib.sqlite3_step(s)==ROW; assert [value(s,i) for i in range(5)]==c['expected']['boundRow']; assert lib.sqlite3_step(s)==DONE and lib.sqlite3_data_count(s)==0
assert lib.sqlite3_reset(s)==OK and lib.sqlite3_step(s)==ROW and [value(s,i) for i in range(5)]==c['expected']['boundRow']; assert lib.sqlite3_reset(s)==OK
assert lib.sqlite3_clear_bindings(s)==OK and lib.sqlite3_step(s)==ROW and [value(s,i) for i in range(5)]==c['expected']['clearRow']; assert lib.sqlite3_finalize(s)==OK and lib.sqlite3_close(d)==OK
print(json.dumps({'id':c['id'],'lane':'native-boundary-no-credit','outcome':'pass'},separators=(',',':')))
# encoding matrix and metadata
c=byid['first-select-all-encodings']
for setup in c['setups']:
 d=open_db(["PRAGMA encoding='"+setup['encoding']+"'"]+setup['sql']); rc,s,_,_=prepare_buf(d,c['sql']); assert rc==OK
 def txt(fn,i):
  x=fn(s,i); return x.decode() if x else None
 meta=[{'name':txt(lib.sqlite3_column_name,i),'declType':txt(lib.sqlite3_column_decltype,i),'database':txt(lib.sqlite3_column_database_name,i),'table':txt(lib.sqlite3_column_table_name,i),'origin':txt(lib.sqlite3_column_origin_name,i)} for i in range(4)]
 assert meta==c['expected']['columns']; assert lib.sqlite3_step(s)==ROW and [value(s,i) for i in range(4)]==c['expected']['row']; assert lib.sqlite3_step(s)==DONE; lib.sqlite3_finalize(s); lib.sqlite3_close(d)
print(json.dumps({'id':c['id'],'lane':'native-boundary-no-credit','outcome':'pass','encodings':3},separators=(',',':')))
# value boundaries (native observes bind-copy by mutating caller buffer in a dedicated binding)
c=byid['first-select-values']; d=open_db([]); rc,s,_,_=prepare_buf(d,c['sql']); assert rc==OK
for b in c['bindings'][:-1]: bind(s,b)
copybuf=C.create_string_buffer(bytes.fromhex(c['bindings'][-1]['value']['hex'])); assert lib.sqlite3_bind_blob(s,9,C.cast(copybuf,P),3,TRANSIENT)==OK; copybuf[0]=b'\x7f'
assert lib.sqlite3_step(s)==ROW and [value(s,i) for i in range(9)]==c['expected']['row']; lib.sqlite3_finalize(s); lib.sqlite3_close(d)
print(json.dumps({'id':c['id'],'lane':'native-boundary-no-credit','outcome':'pass'},separators=(',',':')))
# exact empty/tail and close models
c=byid['first-select-tail-empty-close']; d=open_db([]); rc,s,off,b=prepare_buf(d,c['inputs']['empty']); assert rc==OK and not s and off==c['expected']['emptyTailOffset']
rc,s,off,b=prepare_buf(d,c['inputs']['tail']); assert rc==OK and off==c['inputs']['tailUtf8Offset'] and bytes(b)[off:-1].decode()==c['inputs']['tailSuffix']; assert lib.sqlite3_step(s)==ROW and [value(s,0)]==c['expected']['firstRow']; assert lib.sqlite3_step(s)==DONE and lib.sqlite3_data_count(s)==0; lib.sqlite3_reset(s)
assert lib.sqlite3_close(d)==c['expected']['legacyCloseRc']; assert lib.sqlite3_step(s)==ROW; lib.sqlite3_reset(s); assert lib.sqlite3_close_v2(d)==OK
x=P(); tail=P(); assert lib.sqlite3_prepare_v2(d,b'SELECT 1',-1,C.byref(x),C.byref(tail))==c['expected']['prepareAfterDeferredRc'] and not x; assert lib.sqlite3_finalize(s)==OK
print(json.dumps({'id':c['id'],'lane':'native-boundary-no-credit','outcome':'pass'},separators=(',',':')))
print(json.dumps({'boundarySummary':{'executedNoCredit':len(m['companions']),'tsCredit':0}},separators=(',',':')))
