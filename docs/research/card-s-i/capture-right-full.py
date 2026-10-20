"""Pinned C API witness for the two original WR nullable OR caller shapes."""
import hashlib
import pathlib

root = pathlib.Path(__file__).resolve().parents[3]
recorder = (root/'docs/research/recursive-join/right-full-native.py').read_text()
start = recorder.index("prefix='WITH RECURSIVE")
end = recorder.index('results=[]', start)
cases = [f'SELECT u.x,w.n FROM u {join} JOIN w ON (w.a=1 OR w.b=2) AND w.n=u.x'
         for join in ['RIGHT', 'FULL']]
recorder = recorder[:start] + 'cases='+repr(cases)+'\n' + recorder[end:]
recorder = recorder.replace('test/fixtures/recursive-join/{encoding}-corrected.sqlite',
                            'docs/research/card-s-i/{encoding}.db')
recorder = recorder.replace('metadata=metadata,rows=passes[0]',
    "metadata=metadata,rows=passes[0],fixtureSha256=hashlib.sha256((root/f'docs/research/card-s-i/{encoding}.db').read_bytes()).hexdigest()")
exec(compile(recorder, str(root/'docs/research/recursive-join/right-full-native.py'), 'exec'),
     {'__file__': str(root/'docs/research/recursive-join/right-full-native.py'),
      '__name__': '__main__', 'hashlib': hashlib})
