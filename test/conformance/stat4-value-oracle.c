/* Development-only pinned valueFromExpr oracle; not a runtime backend. */
#define SQLITE_THREADSAFE 0
#define SQLITE_ENABLE_STAT4 1
#include "sqlite3.c"
#include <stdio.h>
int main(void){
 sqlite3 *db=0;sqlite3_open(":memory:",&db);
 const char *tokens[]={"1.0","1.5","9223372036854775808","0xffffffffffffffff","12tail"};
 int ops[]={TK_FLOAT,TK_FLOAT,TK_INTEGER,TK_INTEGER,TK_STRING};
 int affinities[]={SQLITE_AFF_BLOB,SQLITE_AFF_NUMERIC,SQLITE_AFF_REAL,SQLITE_AFF_TEXT};
 for(int enc=SQLITE_UTF8;enc<=SQLITE_UTF16BE;enc++)for(int a=0;a<4;a++)for(int i=0;i<5;i++){
  Expr e;memset(&e,0,sizeof(e));e.op=ops[i];e.u.zToken=(char*)tokens[i];
  sqlite3_value *v=0;int rc=valueFromExpr(db,&e,enc,affinities[a],&v,0);
  printf("%d %d %s rc=%d type=%d ",enc,affinities[a],tokens[i],rc,sqlite3_value_type(v));
  if(sqlite3_value_type(v)==SQLITE_INTEGER)printf("%lld",sqlite3_value_int64(v));
  else if(sqlite3_value_type(v)==SQLITE_FLOAT)printf("%.17g",sqlite3_value_double(v));
  else printf("%s",sqlite3_value_text(v));
  puts("");sqlite3ValueFree(v);
 }
 sqlite3_close(db);return 0;
}
