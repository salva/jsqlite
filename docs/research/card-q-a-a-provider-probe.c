/* Pinned 3.53.4 provider admission probe. Development oracle only, never runtime. */
#include "sqlite3.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
static int calls;
static int clockMs(sqlite3_vfs *v, sqlite3_int64 *out){
  (void)v;
  *out=210866760000000LL+946684800000LL+(calls++)*10000LL;
  return SQLITE_OK;
}
static int zoneCalls;
static int zone(const void *input, void *output){
  const time_t t=*(const time_t *)input;
  struct tm *o=(struct tm *)output;
  memset(o,0,sizeof(*o));
  o->tm_year=100;o->tm_mon=0;o->tm_mday=1;
  o->tm_hour=(int)((t-946684800)/3600)+2;
  printf("local-input:%lld\n",(long long)t);zoneCalls++;
  return 0;
}
static void run(sqlite3 *db,const char *sql){
  sqlite3_stmt *s=0;
  int rc=sqlite3_prepare_v2(db,sql,-1,&s,0);
  printf("prepare:%d clock:%d\n",rc,calls);
  while((rc=sqlite3_step(s))==SQLITE_ROW){
    for(int i=0;i<sqlite3_column_count(s);i++)printf("%s%s",i?"|":"",sqlite3_column_text(s,i));
    printf(" clock:%d local:%d\n",calls,zoneCalls);
  }
  printf("done:%d %s\n",rc,sqlite3_errmsg(db));
  sqlite3_finalize(s);
}
int main(void){
  printf("source:%s\n",sqlite3_sourceid());
  sqlite3_vfs v=*sqlite3_vfs_find(0);v.zName="controlled-clock";v.xCurrentTimeInt64=clockMs;
  sqlite3_vfs_register(&v,0);
  sqlite3 *db=0;sqlite3_open_v2(":memory:",&db,SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE,"controlled-clock");
  run(db,"WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<2) SELECT datetime('now',printf('+%d seconds',n)),datetime('now') FROM x");
  sqlite3_test_control(SQLITE_TESTCTRL_LOCALTIME_FAULT,2,zone);
  run(db,"SELECT datetime('now','utc')");
  run(db,"SELECT datetime('2000-01-01','localtime'),datetime('2000-01-01 02:00:00','utc')");
  sqlite3_test_control(SQLITE_TESTCTRL_LOCALTIME_FAULT,0,0);
  sqlite3_close(db);sqlite3_vfs_unregister(&v);
  return 0;
}
