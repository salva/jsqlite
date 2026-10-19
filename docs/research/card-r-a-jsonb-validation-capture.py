import json,subprocess,os
from pathlib import Path
r=Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'jsonb-shared-validation';cases=[]
def add(b):
 h=b.hex()
 if h not in cases:cases.append(h)
def node(t,p):
 n=len(p);return bytes([n*16+t])+p if n<12 else bytes([192+t,n])+p
for t in range(3,7):
 for p in [b'',b'-',b'0',b'1',b'01',b'-01',b'1e',b'1e+',b'1e-',b'1e2',b'1e+2',b'.1',b'1.',b'1.e2',b'0x1',b'-0x1',b'0Xg',b'1xx',b'1.2.3',b'1e2e3',b'-0.1',b'0e1',b'12',b'0x']:
  add(node(t,p))
for t in range(7,11):
 for p in [b'',b'a',b'"',b"'",b'\x00',b'\xff',b'\\',b'\\n',b'\\u1234',b'\\u12g4',b'\\x41',b'\\xgg',b'\\0',b'\\01',b'\\\n',b'\\\r\nA',b'\\\n\\q',b'\\v',b'\\q',b'\\\xe2\x80\xa8A']:
  add(node(t,p))
for h in ['233165','253165','3331652b','36317878','1331','c300','c30131','d3000131','e30000000131','f3000000000000000131','c000','1b0d','1b00','2b00','1c00','2c1700','3c176100','2c170d','1bff','c','ff','00','10','01','02','0b','0c']:
 if len(h)%2==0:add(bytes.fromhex(h))
for h in ['233165','253165','3331652b','36317878','1331','2c1761','1c00','c000']:
 b=bytes.fromhex(h);add(node(11,b));add(node(12,node(7,b'a')+b))
# Text BLOB fallback and flags combination controls.
for p in [b'{}',b'[1]',b'{x:1}',b'1e',b'null',b'"a"',b'',b'01',b'333'] :add(p)
# Deep validity begins at depth1, offset propagates from depth1001.
for depth in [999,1000,1001]:
 b=bytes([0])
 for _ in range(depth):
  n=len(b);h=bytes([n*16+11]) if n<12 else bytes([203,n]) if n<256 else bytes([219,n>>8,n&255]);b=h+b
 add(b)
cli=str(Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'json-boundary-oracle/build/sqlite3')
rows=[]
for h in cases:
 sql='select '+','.join([f"json_valid(x'{h}',{f})" for f in [1,2,4,8,12]])+f",json_error_position(x'{h}');"
 out=subprocess.check_output([cli,':memory:',sql],text=True).strip();rows.append(dict(hex=h,expected=out.split('|')))
(r/'test/conformance/jsonb-validation-native.json').write_text(json.dumps(rows,indent=2)+'\n')
print(len(rows),'native cases captured')
