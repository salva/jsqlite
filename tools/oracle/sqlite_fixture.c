#include <sqlite3.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int exec(sqlite3 *db, const char *sql){
  char *e=0; int rc=sqlite3_exec(db,sql,0,0,&e);
  if(rc!=SQLITE_OK){ fprintf(stderr,"fixture SQL: %s\n",e?e:"error"); sqlite3_free(e); }
  return rc;
}
int main(int argc,char **argv){
  if(argc!=4){fprintf(stderr,"usage: sqlite-fixture ID ENCODING PATH\n");return 2;}
  const char *id=argv[1], *enc=argv[2], *path=argv[3]; sqlite3 *db=0;
  if(sqlite3_open_v2(path,&db,SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE,0)!=SQLITE_OK)return 1;
  int pageSize=4096;
  char pragma[96]; snprintf(pragma,sizeof pragma,"PRAGMA page_size=%d;PRAGMA encoding='%s';",pageSize,enc);
  int rc=exec(db,pragma);
  if(!rc && strcmp(id,"close")==0) rc=exec(db,"CREATE TABLE t1(x);INSERT INTO t1 VALUES('one'),('two'),('three');");
  else if(!rc && strcmp(id,"bind")==0) rc=exec(db,"CREATE TABLE t1(a,b,c);");
  else if(!rc && strcmp(id,"meta")==0) rc=exec(db,"CREATE TABLE t1(a VARINT,b BLOB,c VARCHAR(16));INSERT INTO t1 VALUES(1,2,3),('one','two',NULL),(1.2,1.3,1.4);");
  else if(!rc && strncmp(id,"encoding-",9)==0) rc=exec(db,"CREATE TABLE t1(a PRIMARY KEY,b,c);INSERT INTO t1 VALUES('one','I',1);");
  else if(!rc && strcmp(id,"readonly")==0) rc=exec(db,"CREATE TABLE t1(a,b);INSERT INTO t1 VALUES(1,2),(3,4),(5,6);");
  else if(!rc && strcmp(id,"empty")!=0) rc=SQLITE_MISUSE;
  if(!rc) rc=exec(db,"PRAGMA journal_mode=DELETE;VACUUM;");
  if(sqlite3_close(db)!=SQLITE_OK) rc=SQLITE_ERROR;
  return rc==SQLITE_OK?0:1;
}
