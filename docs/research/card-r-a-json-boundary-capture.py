#!/usr/bin/env python3
"""Capture representative header/depth branches using the pinned development CLI."""
import hashlib,json,subprocess,sys
cli=sys.argv[1]
def run(sql):
 p=subprocess.run([cli,':memory:'],input='.mode quote\n'+sql,text=True,capture_output=True,check=True)
 return p.stdout.strip()
def header(t,n):
 if n<=11:return bytes([n*16+t])
 if n<=255:return bytes([0xc0+t,n])
 if n<=65535:return bytes([0xd0+t,n>>8,n&255])
 return bytes([0xe0+t])+n.to_bytes(4,'big')
out={'identity':run('select sqlite_version(),sqlite_source_id();'),'headers':[],'depth':[]}
for n in (11,12,255,256,65535,65536):
 b=header(7,n)+b'a'*n
 row=run("select hex(jsonb('\""+'a'*n+"\"')),json_valid(x'"+b.hex()+"',8),length(json(x'"+b.hex()+"'));" )
 expected="'"+b.hex().upper()+"',1,"+str(n+2)
 assert row==expected
 out['headers'].append({'payload':n,'prefix':header(7,n).hex().upper(),'blobSha256':hashlib.sha256(b).hexdigest(),'nativeExactHexMatched':True,'strict':1,'renderLength':n+2})
for depth in (1000,1001):
 for op,cl in (('[',']'),('{"a":','}')):
  for leaf in ('0','null','"x"','[]','{}'):
   count=depth-(leaf in ('[]','{}'));text=op*count+leaf+cl*count
   result=run("select json_valid('"+text+"');")
   assert result==str(int(depth==1000))
   out['depth'].append({'container':op,'leaf':leaf,'depth':depth,'valid':int(result)})
 b=b'\x00'
 for _ in range(depth):b=header(11,len(b))+b
 result=run("select json_valid(x'"+b.hex()+"',8);")
 assert result==('0'),(depth,result)
 out['depth'].append({'jsonbNullArrays':depth,'valid':int(result),'blobSha256':hashlib.sha256(b).hexdigest()})
print(json.dumps(out,indent=2))
