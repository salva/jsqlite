# Native capture for the finite recursive JSONB unescape control branches.
# Run with: python3 <script> <source-verified sqlite3> <output.json>
import json, subprocess, sys

def node(t, p):
    n = len(p)
    return (bytes([n*16+t]) if n<12 and t not in [11,12] else bytes([192+t,n]))+p

payloads = [b'\\u'+s for s in [b'd800\\utc00', b'd800\\udc00', b'd800\\uZZZZ', b'd800', b'dc00', b't800\\utc00', b'ZZZZ', b'123', b'', b'd800\\udc0']]
payloads += [b'\\'+s for s in [b'', b'b', b'f', b'n', b'r', b't', b'v', b'0', b'01', b"'", b'"', b'/', b'\\', b'x41', b'xgg', b'x1', b'q', b'\xe2', b'\xe2\x80\xa8', b'\r', b'\n']]
payloads += [b'A', b'\x00', b'\x01', b'\xff', b'\xc0\x80\x80\x80\x80\\q', b'\\\n\\\r\n\\u' + b'd800\\utc00', b'\\\n\\', b'\\\n\\01']
rows = []
seen = set()
def add(b):
    h=b.hex()
    if h in seen: return
    seen.add(h)
    sql='select '+','.join(f"json_valid(x'{h}',{f})" for f in [4,8,15])+f",json_error_position(x'{h}');"
    out=subprocess.check_output([sys.argv[1], ':memory:', sql], text=True).strip().split('|')
    rows.append(dict(hex=h,expected=out))
for prefix in [b'', b'\\\n', b'\\\r', b'\\\r\n', b'\\\xe2\x80\xa8', b'\\\xe2\x80\xa9']:
    for p in payloads:
        b=node(9,prefix+p)
        add(b)
        # Nested offsets and object label/value consumption share the grammar.
        add(node(11,b))
        add(node(12,node(7,b'k')+b))
for t in [7,8,10]:
    for p in payloads: add(node(t,b'\\\n'+p))
for h in ['233165','253165','3b233165','3331652b','36317878','1331']: add(bytes.fromhex(h))
with open(sys.argv[2],'w') as f: json.dump(rows,f,indent=2); f.write('\n')
print(len(rows), 'independent native cases')
