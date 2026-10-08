/* Development-only internal KeyStats oracle; pinned amalgamation, not backend. */
#define SQLITE_THREADSAFE 0
#define SQLITE_ENABLE_STAT4 1
#include "sqlite3.c"
#include <stdio.h>
#include <stdlib.h>
int main(int argc,char **argv){
 sqlite3 *db=0; Parse parse; Index *idx; KeyInfo *info; UnpackedRecord *rec;
 tRowcnt a[2]; int i,n,s;
 if(argc<6)return 2;
 if(sqlite3_open_v2(argv[1],&db,SQLITE_OPEN_READONLY,0))return 3;
 if(sqlite3_exec(db,"SELECT * FROM sqlite_schema",0,0,0))return 4;
 memset(&parse,0,sizeof(parse));parse.db=db;
 idx=sqlite3FindIndex(db,argv[2],"main");if(!idx)return 5;
 info=sqlite3KeyInfoOfIndex(&parse,idx);rec=sqlite3VdbeAllocUnpackedRecord(info);
 n=atoi(argv[3]);rec->nField=n;rec->default_rc=0;rec->errCode=0;rec->eqSeen=0;
 for(i=0;i<info->nKeyField+1;i++){memset(&rec->aMem[i],0,sizeof(Mem));rec->aMem[i].db=db;rec->aMem[i].flags=MEM_Null;}
 for(i=0;i<n;i++){
  if(strcmp(argv[5+i],"null")==0)sqlite3VdbeMemSetNull(&rec->aMem[i]);
  else sqlite3VdbeMemSetInt64(&rec->aMem[i],strtoll(argv[5+i],0,10));
 }
 if(argc>5+n){
  const char *mode=argv[5+n];int j;
  for(i=0;i<idx->nSample;i++){
   if(strcmp(mode,"malformed")==0){memset(idx->aSample[i].p,0,idx->aSample[i].n+8);((unsigned char*)idx->aSample[i].p)[0]=127;}
   for(j=0;j<idx->nSampleCol;j++){
    if(strcmp(mode,"overflow")==0){idx->aSample[i].anEq[j]=~(u64)0;idx->aSample[i].anLt[j]=~(u64)0-5;}
    if(strcmp(mode,"zero")==0){idx->aSample[i].anEq[j]=0;idx->aSample[i].anLt[j]=0;}
   }
  }
 }
 s=whereKeyStats(&parse,idx,rec,atoi(argv[4]),a);
 printf("{\"sample\":%d,\"less\":\"%llu\",\"equal\":\"%llu\",\"field\":%d,\"error\":%d}\n",s,(unsigned long long)a[0],(unsigned long long)a[1],rec->nField,rec->errCode);
 for(i=0;i<idx->nColumn;i++)sqlite3VdbeMemRelease(&rec->aMem[i]);
 sqlite3DbFree(db,rec);sqlite3KeyInfoUnref(info);sqlite3_close(db);return 0;
}
