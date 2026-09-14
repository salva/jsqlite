#!/usr/bin/env python3
"""Capture no-credit encoding, limit, cancellation, and function-cleanup evidence."""
import ctypes as C,json,struct,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
sig={'sqlite3_sourceid':([],C.c_char_p),'sqlite3_open':([C.c_char_p,C.POINTER(P)],C.c_int),'sqlite3_close':([P],C.c_int),'sqlite3_exec':([P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),'sqlite3_prepare_v2':([P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),'sqlite3_step':([P],C.c_int),'sqlite3_finalize':([P],C.c_int),'sqlite3_reset':([P],C.c_int),'sqlite3_errmsg':([P],C.c_char_p),'sqlite3_column_count':([P],C.c_int),'sqlite3_column_type':([P,C.c_int],C.c_int),'sqlite3_column_int64':([P,C.c_int],C.c_longlong),'sqlite3_column_text':([P,C.c_int],P),'sqlite3_column_blob':([P,C.c_int],P),'sqlite3_column_bytes':([P,C.c_int],C.c_int),'sqlite3_bind_text':([P,C.c_int,C.c_char_p,C.c_int,P],C.c_int),'sqlite3_bind_text16':([P,C.c_int,P,C.c_int,P],C.c_int),'sqlite3_bind_text64':([P,C.c_int,C.c_char_p,C.c_ulonglong,P,C.c_ubyte],C.c_int),'sqlite3_limit':([P,C.c_int,C.c_int],C.c_int),'sqlite3_result_error':([P,C.c_char_p,C.c_int],None)}
for n,(a,r) in sig.items():f=getattr(L,n);f.argtypes=a;f.restype=r
SOURCE='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc';assert L.sqlite3_sourceid().decode()==SOURCE
TRANSIENT=P(-1);OK,ROW,DONE=0,100,101
def opendb(enc='UTF-8'):
 d=P();assert L.sqlite3_open(b':memory:',C.byref(d))==OK;e=C.c_char_p();assert L.sqlite3_exec(d,f"PRAGMA encoding='{enc}'".encode(),None,None,C.byref(e))==OK;return d
def prep(d,sql):s=P();t=C.c_char_p();rc=L.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),C.byref(t));return rc,s
def val(s,i):
 t=L.sqlite3_column_type(s,i)
 if t==5:return{'type':'null'}
 if t==1:return{'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
 n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);raw=C.string_at(p,n) if n else b'';return {'type':'blob','hex':raw.hex()} if t==4 else {'type':'text','utf8Hex':raw.hex()}
def run(d,sql,bind=None):
 rc,s=prep(d,sql)
 if rc:return{'phase':'prepare','resultCode':rc,'primaryCode':rc&255,'message':L.sqlite3_errmsg(d).decode()}
 if bind:bind(s)
 rows=[]
 while (rc:=L.sqlite3_step(s))==ROW:rows.append([val(s,i) for i in range(L.sqlite3_column_count(s))])
 out={'rows':rows} if rc==DONE else {'phase':'step','resultCode':rc,'primaryCode':rc&255,'message':L.sqlite3_errmsg(d).decode()}
 L.sqlite3_finalize(s);return out
enc=[]
for encoding in ('UTF-8','UTF-16le','UTF-16be'):
 d=opendb(encoding);e=C.c_char_p();q="CREATE TABLE t(x TEXT);INSERT INTO t VALUES(char(65,0,66)||'é𝄞')";assert L.sqlite3_exec(d,q.encode(),None,None,C.byref(e))==OK
 column=run(d,"SELECT hex(x),length(x),octet_length(x),hex(substr(x,1,5)),hex(replace(x,char(0),'X')) FROM t")
 raw8='A\x00Bé𝄞'.encode();raw16='A\x00Bé𝄞'.encode('utf-16le');raw16be='A\x00Bé𝄞'.encode('utf-16be')
 def b8(s):assert L.sqlite3_bind_text(s,1,raw8,len(raw8),TRANSIENT)==OK
 def b16(s):buf=C.create_string_buffer(raw16);assert L.sqlite3_bind_text16(s,1,C.cast(buf,P),len(raw16),TRANSIENT)==OK
 def b16be(s):buf=C.create_string_buffer(raw16be);assert L.sqlite3_bind_text64(s,1,raw16be,len(raw16be),TRANSIENT,3)==OK
 params={'utf8':run(d,"SELECT hex(?1),length(?1),octet_length(?1),hex(substr(?1,1,5))",b8),'utf16le':run(d,"SELECT hex(?1),length(?1),octet_length(?1),hex(substr(?1,1,5))",b16),'utf16be':run(d,"SELECT hex(?1),length(?1),octet_length(?1),hex(substr(?1,1,5))",b16be)}
 enc.append({'encoding':encoding,'column':column,'parameters':params});L.sqlite3_close(d)
# Enforce length before oversized replace materialization.
d=opendb();old=L.sqlite3_limit(d,0,40);limit=run(d,"SELECT replace('aaaaaaaaaa','a','1234567890')");L.sqlite3_limit(d,0,old);L.sqlite3_close(d)
# Progress callback supplies deterministic cancellation/work-boundary evidence.
d=opendb();calls=C.c_int(0);PROG=C.CFUNCTYPE(C.c_int,P)
def stop(_):calls.value+=1;return 1
cb=PROG(stop);L.sqlite3_progress_handler.argtypes=[P,C.c_int,PROG,P];L.sqlite3_progress_handler(d,1,cb,None);cancel=run(d,"WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<100000) SELECT sum(x) FROM c");cancel['progressCallbacks']=calls.value;L.sqlite3_close(d)
# Destructor and first-error evidence from development-only registration.
d=opendb();events=[];FUNC=C.CFUNCTYPE(None,P,C.c_int,C.POINTER(P));DEST=C.CFUNCTYPE(None,P)
def boom(ctx,n,args):events.append('call');L.sqlite3_result_error(ctx,b'primary boom',-1)
def destroy(p):events.append('destroy')
fcb=FUNC(boom);dcb=DEST(destroy);L.sqlite3_create_function_v2.argtypes=[P,C.c_char_p,C.c_int,C.c_int,P,FUNC,P,P,DEST];assert L.sqlite3_create_function_v2(d,b'evidence_boom',0,1,None,fcb,None,None,dcb)==OK
ferr=run(d,'SELECT evidence_boom()');ferr['eventsBeforeClose']=events.copy();assert L.sqlite3_close(d)==OK;ferr['eventsAfterClose']=events.copy()
out={'schema':'jsqlite-expression-function-boundaries/1','sourceId':SOURCE,'credit':'no-credit-native-harness','encodingMatrix':enc,'lengthLimit':{'limit':40,'outcome':limit},'cancellation':cancel,'functionCleanup':ferr,'notes':{'timeout':'Deadline behavior is represented only by the progress/cancellation boundary; wall-clock timing is intentionally not asserted.','hostRegistration':'Development oracle only; no product registration API.'}}
print(json.dumps(out,indent=2,ensure_ascii=False))
