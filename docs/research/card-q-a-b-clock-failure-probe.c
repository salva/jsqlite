/* Development-only pinned VFS failure/retry ownership probe. */
#include "sqlite3.h"
#include <stdio.h>
static int calls;
static int clockMs(sqlite3_vfs *v,sqlite3_int64 *out){(void)v;calls++;*out=210866760000000LL+946684800000LL;return calls==1?SQLITE_ERROR:SQLITE_OK;}
int main(void){
 printf("source:%s\n",sqlite3_sourceid());sqlite3_vfs v=*sqlite3_vfs_find(0);v.zName="failed-clock";v.xCurrentTimeInt64=clockMs;sqlite3_vfs_register(&v,0);
 sqlite3 *db=0;sqlite3_open_v2(":memory:",&db,SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE,v.zName);sqlite3_stmt*s=0;
 const char *sql="SELECT datetime('now'),datetime('now'),datetime('now')";
 int rc=sqlite3_prepare_v2(db,sql,-1,&s,0);printf("prepare:%d calls:%d\n",rc,calls);
 rc=sqlite3_step(s);printf("step:%d calls:%d",rc,calls);for(int i=0;i<3;i++)printf(" | type:%d value:%s",sqlite3_column_type(s,i),sqlite3_column_type(s,i)==SQLITE_NULL?"NULL":(const char*)sqlite3_column_text(s,i));puts("");
 sqlite3_finalize(s);sqlite3_close(db);sqlite3_vfs_unregister(&v);return 0;
}
