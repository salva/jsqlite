#!/usr/bin/env python3
import ctypes as C,json,pathlib,struct,sys
root=pathlib.Path(__file__).resolve().parents[2]; spec=json.load(open(root/'test/conformance/cases/stage3-expression-functions.spec.json')); L=C.CDLL(sys.argv[1]); P=C.c_void_p
signatures={'sqlite3_sourceid':([],C.c_char_p),'sqlite3_open':([C.c_char_p,C.POINTER(P)],C.c_int),'sqlite3_exec':([P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),'sqlite3_prepare_v2':([P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),'sqlite3_step':([P],C.c_int),'sqlite3_column_count':([P],C.c_int),'sqlite3_column_type':([P,C.c_int],C.c_int),'sqlite3_column_int64':([P,C.c_int],C.c_longlong),'sqlite3_column_double':([P,C.c_int],C.c_double),'sqlite3_column_text':([P,C.c_int],P),'sqlite3_column_blob':([P,C.c_int],P),'sqlite3_column_bytes':([P,C.c_int],C.c_int),'sqlite3_errmsg':([P],C.c_char_p),'sqlite3_column_name':([P,C.c_int],C.c_char_p),'sqlite3_column_decltype':([P,C.c_int],C.c_char_p),'sqlite3_column_database_name':([P,C.c_int],C.c_char_p),'sqlite3_column_table_name':([P,C.c_int],C.c_char_p),'sqlite3_column_origin_name':([P,C.c_int],C.c_char_p)}
for n,(a,r) in signatures.items(): f=getattr(L,n);f.argtypes=a;f.restype=r
assert L.sqlite3_sourceid().decode()==spec['sourceId']
def capture(item,credit):
 ident,sql,fixture=item;d=P();assert L.sqlite3_open(b':memory:',C.byref(d))==0
 for q in spec['setups'][fixture]: e=C.c_char_p();assert L.sqlite3_exec(d,q.encode(),None,None,C.byref(e))==0,(q,e.value)
 s=P();tail=C.c_char_p();rc=L.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),C.byref(tail));native={}
 if rc:native['error']={'phase':'prepare','resultCode':rc,'primaryCode':rc&255,'message':L.sqlite3_errmsg(d).decode()}
 else:
  def txt(fn,i): z=fn(s,i);return z.decode() if z else None
  native['columns']=[{'name':txt(L.sqlite3_column_name,i),'declType':txt(L.sqlite3_column_decltype,i),'database':txt(L.sqlite3_column_database_name,i),'table':txt(L.sqlite3_column_table_name,i),'origin':txt(L.sqlite3_column_origin_name,i)} for i in range(L.sqlite3_column_count(s))];rows=[]
  while (rc:=L.sqlite3_step(s))==100:
   row=[]
   for i in range(L.sqlite3_column_count(s)):
    t=L.sqlite3_column_type(s,i)
    if t==5:v={'type':'null'}
    elif t==1:v={'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
    elif t==2:v={'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(s,i)).hex()}
    else:
     n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);raw=C.string_at(p,n) if n else b'';v={'type':'blob','hex':raw.hex()} if t==4 else {'type':'text','utf8Hex':raw.hex()}
    row.append(v)
   rows.append(row)
  if rc!=101:native['error']={'phase':'step','resultCode':rc,'primaryCode':rc&255,'message':L.sqlite3_errmsg(d).decode()}
  else:native['rows']=rows
  L.sqlite3_finalize(s)
 L.sqlite3_close(d);ops=['openFixture','prepare']+(['error'] if 'error' in native else ['metadata','stepAll','finalize'])
 return {'ref':ident,'occurrence':1,'credit':'upstream' if credit else 'no-credit-companion','fixture':fixture,'sql':sql,'sourceAssertionAnchor':({'kind':'foreach-expansion','template':'do_execsql_test e_expr-4.$tn','bindings':{'tn':'1','literal':"'helloworld'",'different':"'12345'"}} if ident=='test/e_expr.test:e_expr-4.1' else {'kind':'literal-id','id':ident.split(':',1)[1]} if credit else None),'sourceSetupAnchors':spec['setups'][fixture],'native':native,'operations':ops,'ts':({'disposition':'implemented','attempted':{'index':len(ops)-1,'op':ops[-1]},'unattempted':[],'credit':True} if credit else {'disposition':'unimplemented-temporary','attempted':{'index':1,'op':'prepare'},'unattempted':ops[2:],'credit':False})}
out={'schema':'jsqlite-expression-functions/1','sourceId':spec['sourceId'],'accounting':{'upstreamDeclared':len(spec['creditCases']),'companionsDeclared':len(spec['companions']),'nativeExpectationsSeparateFromTsCredit':True,'countDerivedSuccessForbidden':True,'tsCredit':len(spec['creditCases'])},'setup':spec['setups'],'cases':[capture(x,True) for x in spec['creditCases']],'companions':[capture(x,False) for x in spec['companions']]}
print(json.dumps(out,indent=2,ensure_ascii=False))
