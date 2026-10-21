/* Development-only direct sqlite3Stat4Column oracle, pinned amalgamation. */
#define SQLITE_THREADSAFE 0
#define SQLITE_ENABLE_STAT4 1
#include "sqlite3.c"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(int argc,char **argv){
 sqlite3 *db=0;sqlite3_value *v=0;unsigned char *p;int n,i,rc;
 if(argc!=4)return 2;
 n=(int)strlen(argv[1])/2;p=calloc(n+8,1);
 for(i=0;i<n;i++){unsigned x;if(sscanf(argv[1]+i*2,"%2x",&x)!=1)return 3;p[i]=(unsigned char)x;}
 sqlite3_open(":memory:",&db);db->enc=(u8)atoi(argv[3]);
 printf("%s\n",sqlite3_sourceid());
 rc=sqlite3Stat4Column(db,p,n,atoi(argv[2]),&v);
 printf("rc=%d",rc);
 if(!rc){printf(" type=%d",sqlite3_value_type(v));
  if(sqlite3_value_type(v)==SQLITE_INTEGER)printf(" int=%lld",sqlite3_value_int64(v));
  if(sqlite3_value_type(v)==SQLITE_TEXT||sqlite3_value_type(v)==SQLITE_BLOB){
   printf(" raw=");for(i=0;i<v->n;i++)printf("%02x",(unsigned char)v->z[i]);
  }
 }
 printf("\n");sqlite3ValueFree(v);sqlite3_close(db);free(p);return 0;
}
