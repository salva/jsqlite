#include <stdio.h>
#include <string.h>
#include "sqlite3.h"
static int calls;
static void x(sqlite3_context *c,int n,sqlite3_value **v){(void)n;(void)v;calls++;sqlite3_result_int(c,10);}
int main(void){sqlite3 *db=0;sqlite3_stmt *s=0;const char *id="2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc";if(sqlite3_open(":memory:",&db)||strcmp(sqlite3_sourceid(),id))return 2;sqlite3_create_function(db,"x",0,SQLITE_UTF8,0,x,0,0);const char *q[] = {"SELECT x() BETWEEN 5 AND 15","SELECT x() BETWEEN 10 AND 10"};for(int i=0;i<2;i++){calls=0;if(sqlite3_prepare_v2(db,q[i],-1,&s,0)||sqlite3_step(s)!=SQLITE_ROW)return 3;printf("%d %d\n",calls,sqlite3_column_int(s,0));sqlite3_finalize(s);}sqlite3_close(db);return 0;}
