#define SQLITE_THREADSAFE 0
#define SQLITE_ENABLE_STAT4 1
#include "sqlite3.c"
#include <stdio.h>
int main(int argc,char **argv){if(argc!=3)return 2;sqlite3*d=0;sqlite3_open(argv[1],&d);char sql[256];snprintf(sql,sizeof(sql),"PRAGMA encoding='%s';CREATE TABLE t(a,b);CREATE INDEX ab ON t(a,b);INSERT INTO t VALUES(1,'x'),(2,'y');ANALYZE;DELETE FROM sqlite_stat4;",argv[2]);char*e=0;if(sqlite3_exec(d,sql,0,0,&e))return 3;
const char *v[]={"123","1.25","'é'","x'0208'","NULL"};for(int i=0;i<5;i++){snprintf(sql,sizeof(sql),"INSERT INTO sqlite_stat4 VALUES('t','ab','1 1 1','0 0 0','0 0 0',%s)",v[i]);if(sqlite3_exec(d,sql,0,0,&e))return 4;}
sqlite3_close(d);sqlite3_open(argv[1],&d);printf("%s\n",sqlite3_sourceid());sqlite3_stmt*s=0;int rc=sqlite3_prepare_v2(d,"SELECT sample FROM sqlite_stat4 ORDER BY rowid",-1,&s,0);printf("prepare=%d\n",rc);while(sqlite3_step(s)==SQLITE_ROW){int type=sqlite3_column_type(s,0);int n=sqlite3_column_bytes(s,0);const unsigned char*p=sqlite3_column_blob(s,0);printf("%d %d ",type,n);for(int j=0;j<n;j++)printf("%02x",p[j]);puts("");}sqlite3_finalize(s);rc=sqlite3_prepare_v2(d,"SELECT a,b FROM t ORDER BY a",-1,&s,0);printf("query=%d\n",rc);while(sqlite3_step(s)==SQLITE_ROW)printf("row=%d:%lld,%d:%s\n",sqlite3_column_type(s,0),sqlite3_column_int64(s,0),sqlite3_column_type(s,1),sqlite3_column_text(s,1));sqlite3_finalize(s);sqlite3_close(d);}
