/* Development-only pinned primitive witness; never a runtime backend.
** Compile with -DSQLITE_AMALGAMATION_PATH='"/absolute/build/sqlite3.c"'.
** Includes actual native filterHash, Mem flags and IntValue, no copied hash.
*/
#include SQLITE_AMALGAMATION_PATH
#include <stdio.h>
static void witness(const char *label, Mem *m, int n, u64 expected){
  Op op; memset(&op,0,sizeof(op));
  op.p3=0; op.p4type=P4_INT32; op.p4.i=n;
  u64 h=filterHash(m,&op);
  assert(h==expected);
  printf("%s hash=%llu bit=%llu flags=",label,(unsigned long long)h,
         (unsigned long long)(h%80000));
  for(int i=0;i<n;i++) printf("%s%u",i?",":"",m[i].flags);
  puts("");
}
int main(void){
  Mem m[2]; memset(m,0,sizeof(m));
  printf("sourceId=%s\n",sqlite3_sourceid());
  m[0].flags=MEM_Int;m[0].u.i=-1;
  witness("negative",m,1,UINT64_MAX);
  m[1].flags=MEM_Int;m[1].u.i=2;
  witness("wrap",m,2,1);
  m[0].flags=MEM_IntReal;m[0].u.i=1;
  witness("intreal",m,1,1);
  m[0].flags=MEM_Real;m[0].u.r=1.75;
  witness("real-truncate",m,1,1);
  m[0].u.r=-1.75;witness("negative-real-truncate",m,1,UINT64_MAX);
  m[0].u.r=1e300;witness("real-high",m,1,(u64)LARGEST_INT64);
  m[0].u.r=-1e300;witness("real-low",m,1,(u64)SMALLEST_INT64);
  m[0].u.r=1.0;witness("equal-real",m,1,1);
  m[0].flags=MEM_Int;m[0].u.i=1;witness("equal-int",m,1,1);
  m[0].flags=MEM_Str;witness("string",m,1,4093+MEM_Str);
  m[0].flags=MEM_Blob;witness("blob",m,1,4093+MEM_Blob);
  m[0].flags=MEM_Null;witness("null",m,1,0);
  return 0;
}
