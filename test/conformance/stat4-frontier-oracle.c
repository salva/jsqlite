/* Development-only native planner stop/error oracle, not a runtime backend.
 * Compile with explicit QUERY_PLANNER_LIMIT/INCR for finite AddAll controls. */
static int frontierLimit=20000;
#define SQLITE_QUERY_PLANNER_LIMIT frontierLimit
#define SQLITE_THREADSAFE 0
#define SQLITE_ENABLE_STAT4 1
#include "sqlite3.c"
#include <stdio.h>
#include <stdlib.h>
int main(int argc,char **argv){
 sqlite3 *db=0; sqlite3_stmt *stmt=0; int rc;
 if(argc!=4)return 2;

 if(sqlite3_open_v2(argv[1],&db,SQLITE_OPEN_READONLY,0)!=SQLITE_OK)return 3;
 rc=sqlite3_exec(db,"SELECT * FROM sqlite_schema",0,0,0);
 if(rc!=SQLITE_OK)return 4;
 frontierLimit=atoi(argv[3]);
 rc=sqlite3_prepare_v2(db,argv[2],-1,&stmt,0);
 printf("%d|%s\n",rc,sqlite3_errmsg(db));
 if(stmt)sqlite3_finalize(stmt);
 sqlite3_close(db);return 0;
}
