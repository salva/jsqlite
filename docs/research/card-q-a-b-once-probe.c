/* Native-first constant-argument walker probe, developer oracle only. */
#include "sqlite3.h"
#include <stdio.h>
static int calls;
static int clockMs(sqlite3_vfs*v,sqlite3_int64*out){(void)v;*out=210866760000000LL+946684800000LL+calls++*10000LL;return SQLITE_OK;}
int main(void){printf("source:%s\n",sqlite3_sourceid());sqlite3_vfs v=*sqlite3_vfs_find(0);v.zName="walker";v.xCurrentTimeInt64=clockMs;sqlite3_vfs_register(&v,0);sqlite3*db=0;sqlite3_open_v2(":memory:",&db,6,v.zName);
 const char*args[]={"CASE WHEN 1 THEN 'now' ELSE 'x' END","CASE 1 WHEN 1 THEN 'now' END","iif(1,'now','x')","CASE WHEN 1 BETWEEN 0 AND 2 THEN 'now' END","CASE WHEN 1 IN (1,2) THEN 'now' END","CASE WHEN random() IS NOT NULL THEN 'now' END","(SELECT 'now')"};
 for(int i=0;i<7;i++){char*sql=sqlite3_mprintf("WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<2) SELECT datetime(%s) FROM x",args[i]);sqlite3_stmt*s=0;calls=0;int rc=sqlite3_prepare_v2(db,sql,-1,&s,0);printf("case:%d prepare:%d",i,rc);while((rc=sqlite3_step(s))==100)printf(" | %s calls:%d",sqlite3_column_text(s,0),calls);printf(" done:%d\n",rc);sqlite3_finalize(s);sqlite3_free(sql);}
 sqlite3_close(db);sqlite3_vfs_unregister(&v);return 0;}
