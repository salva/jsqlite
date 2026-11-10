#!/usr/bin/env python3
"""Observe the original CF01 C API recipe, retaining every original assertion.

Runs in a disposable subprocess. Delegates every C call; captures at native
prepare/row/reset boundaries, not by constructing oracle rows from expectations.
"""
import ctypes as C
import json
import pathlib
import runpy
import sys


def main():
    root, library = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2]
    load = C.CDLL
    lib = load(library)
    pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
    for name, field in (('sqlite3_sourceid', 'sqliteSourceId'), ('sqlite3_libversion', 'version')):
        identity = getattr(lib, name); identity.restype = C.c_char_p
        assert identity().decode() == pin[field], field
    P = C.c_void_p
    def fn(name, args, result):
        f = getattr(lib, 'sqlite3_'+name); f.argtypes = args; f.restype = result
        return f
    count = fn('column_count', [P], C.c_int)
    typ = fn('column_type', [P,C.c_int], C.c_int)
    integer = fn('column_int64', [P,C.c_int], C.c_longlong)
    real = fn('column_double', [P,C.c_int], C.c_double)
    text = fn('column_text', [P,C.c_int], P)
    blob = fn('column_blob', [P,C.c_int], P)
    size = fn('column_bytes', [P,C.c_int], C.c_int)
    error = fn('errmsg', [P], C.c_char_p)
    metadata = [fn('column_'+n,[P,C.c_int],C.c_char_p) for n in
                ('name','decltype','database_name','table_name','origin_name')]
    statements = {}; databases = {}; records = []
    def address(pointer):
        return C.cast(pointer,P).value
    class Function:
        def __init__(self,name):
            object.__setattr__(self,'name',name)
            object.__setattr__(self,'f',getattr(lib,name))
        def __setattr__(self,name,value): setattr(self.f,name,value)
        def __getattr__(self,name): return getattr(self.f,name)
        def __call__(self,*args):
            rc = self.f(*args)
            name = self.name
            if name == 'sqlite3_open_v2' and rc == 0:
                databases[C.cast(args[1],C.POINTER(P))[0]] = pathlib.Path(args[0].decode()).stem.split('-')[-1]
            elif name == 'sqlite3_prepare_v2' and rc == 0:
                key = C.cast(args[3],C.POINTER(P))[0]
                statements[key] = dict(enc=databases[address(args[0])],sql=args[1].decode(),runs=[],rows=[],bindings={},db=address(args[0]))
                s = statements[key]
                s['metadata'] = [[v.decode() if v is not None else None for v in [f(key,i) for f in metadata]] for i in range(count(key))]
            elif name == 'sqlite3_bind_int64' and rc == 0:
                statements[address(args[0])]['bindings'][str(args[1])] = str(args[2])
            elif name == 'sqlite3_step':
                s=statements[address(args[0])]
                if rc == 100:
                    row=[]
                    for i in range(count(args[0])):
                        t=typ(args[0],i)
                        value = str(integer(args[0],i)) if t==1 else real(args[0],i) if t==2 else C.string_at(text(args[0],i),size(args[0],i)).decode() if t==3 else {'hex':C.string_at(blob(args[0],i),size(args[0],i)).hex()} if t==4 else None
                        row.append([['','integer','real','text','blob','null'][t],value])
                    s['rows'].append(row)
                else:
                    s['terminal']=dict(code=rc,error=error(s['db']).decode() if rc!=101 else None)
            elif name == 'sqlite3_reset':
                s=statements[address(args[0])]
                s['runs'].append(dict(rows=s.pop('rows'),bindings=dict(s['bindings']),reset=rc,**s.pop('terminal')));s['rows']=[]
            elif name == 'sqlite3_finalize':
                s=statements.pop(address(args[0]));records.append({k:s[k] for k in ('enc','sql','metadata','runs')})
            return rc
    class Library:
        def __getattr__(self,name):
            value=Function(name);setattr(self,name,value);return value
    # Scoped instrumentation in this subprocess only, restored even on failure.
    C.CDLL=lambda path: Library()
    old=sys.argv
    try:
        sys.argv=[str(root/'test/conformance/materialized-cte-linked-consumer-native.py'),library]
        import contextlib
        with contextlib.redirect_stdout(sys.stderr):
            runpy.run_path(sys.argv[0],run_name='__main__')
    finally:
        C.CDLL=load;sys.argv=old
    assert not statements and len(records)==63
    print(json.dumps(records))


if __name__=='__main__':main()
