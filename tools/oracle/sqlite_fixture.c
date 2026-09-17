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
  if(strncmp(id,"storage-p",9)==0){
    char *end=0; long n=strtol(id+9,&end,10);
    if(end==id+9 || n<512 || n>65536) return 2;
    pageSize=(int)n;
  }
  char pragma[96]; snprintf(pragma,sizeof pragma,"PRAGMA page_size=%d;PRAGMA encoding='%s';",pageSize,enc);
  int rc=exec(db,pragma);
  if(!rc && strcmp(id,"close")==0) rc=exec(db,"CREATE TABLE t1(x);INSERT INTO t1 VALUES('one'),('two'),('three');");
  else if(!rc && strcmp(id,"select1-one")==0) rc=exec(db,"CREATE TABLE test1(f1 int, f2 int);INSERT INTO test1 VALUES(11,22);");
  else if(!rc && strcmp(id,"select1-where")==0) rc=exec(db,"CREATE TABLE test1(f1 int, f2 int);INSERT INTO test1 VALUES(11,22),(33,44);");
  else if(!rc && strcmp(id,"expr-func")==0) rc=exec(db,"CREATE TABLE tbl1(t1);INSERT INTO tbl1 VALUES('this'),('program'),('is'),('free'),('software');CREATE TABLE t2(a);INSERT INTO t2 VALUES(1),(NULL),(345),(NULL),(67890);");
  else if(!rc && strcmp(id,"expr-relational")==0) rc=exec(db,"CREATE TABLE t2(a);INSERT INTO t2 VALUES(1),(NULL),(345),(NULL),(67890);CREATE TABLE t1(x INT,y INT);WITH RECURSIVE c(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM c WHERE i<31) INSERT INTO t1 SELECT 31-i,9-(i%10) FROM c;CREATE TABLE distinct_edge(v, bin TEXT COLLATE BINARY, nc TEXT COLLATE NOCASE, rt TEXT COLLATE RTRIM);INSERT INTO distinct_edge VALUES(NULL,'a','a','a'),(NULL,'A','A','a '),(1,'a ','a ','a  '),(1.0,CAST(x'610078' AS TEXT),CAST(x'610078' AS TEXT),'b'),('1',CAST(x'610079' AS TEXT),CAST(x'610079' AS TEXT),'b '),(x'31','z','z','c');");
  else if(!rc && strcmp(id,"expr-where")==0) rc=exec(db,"CREATE TABLE t(a TEXT COLLATE NOCASE,b INTEGER,c BLOB);INSERT INTO t VALUES('abc',1,x'610062'),('XYZ',2,x'78797a'),(NULL,3,NULL);");
  else if(!rc && strcmp(id,"distinct-t3")==0) rc=exec(db,"CREATE TABLE t3(a INTEGER, b INTEGER, c);INSERT INTO t3 VALUES(NULL,NULL,1),(NULL,NULL,2),(NULL,3,4),(NULL,3,5),(6,NULL,7),(6,NULL,8);");
  else if(!rc && strcmp(id,"select4-t1")==0) rc=exec(db,"CREATE TABLE t1(n INT,log INT);WITH RECURSIVE c(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM c WHERE i<31) INSERT INTO t1 SELECT i,CASE WHEN i=1 THEN 0 WHEN i=2 THEN 1 WHEN i<5 THEN 2 WHEN i<9 THEN 3 WHEN i<17 THEN 4 ELSE 5 END FROM c;");
  else if(!rc && strcmp(id,"compound-metadata")==0) rc=exec(db,"CREATE TABLE left_meta(a INTEGER);CREATE TABLE right_meta(b TEXT);INSERT INTO left_meta VALUES(7);INSERT INTO right_meta VALUES('8');");
  else if(!rc && strcmp(id,"compound-collation")==0) rc=exec(db,"CREATE TABLE nocase_values(name TEXT COLLATE NOCASE);CREATE TABLE binary_values(name TEXT COLLATE BINARY);INSERT INTO nocase_values VALUES('a');INSERT INTO binary_values VALUES('A');");
  else if(!rc && strncmp(id,"subquery-",9)==0) rc=exec(db,
    "CREATE TABLE t1(a INTEGER PRIMARY KEY,b INTEGER,c TEXT COLLATE NOCASE);"
    "INSERT INTO t1 VALUES(1,2,'Alpha'),(3,4,'alpha'),(5,6,NULL),(7,8,'z');"
    "CREATE TABLE t2(x INTEGER,y,z TEXT COLLATE RTRIM);"
    "INSERT INTO t2 VALUES(1,11,'q'),(1,12,'q '),(3,33,NULL),(9,NULL,'n');"
    "CREATE VIEW v1(vb,vc) AS SELECT b,c FROM t1 WHERE a<7;"
    "CREATE VIEW v_nested AS SELECT vb,vc FROM v1 WHERE vb>2;");
  else if(!rc && strcmp(id,"bind")==0) rc=exec(db,"CREATE TABLE t1(a,b,c);");
  else if(!rc && strcmp(id,"meta")==0) rc=exec(db,"CREATE TABLE t1(a VARINT,b BLOB,c VARCHAR(16));INSERT INTO t1 VALUES(1,2,3),('one','two',NULL),(1.2,1.3,1.4);");
  else if(!rc && strncmp(id,"encoding-",9)==0) rc=exec(db,"CREATE TABLE t1(a PRIMARY KEY,b,c);INSERT INTO t1 VALUES('one','I',1);");
  else if(!rc && strcmp(id,"readonly")==0) rc=exec(db,"CREATE TABLE t1(a,b);INSERT INTO t1 VALUES(1,2),(3,4),(5,6);");
  else if(!rc && strncmp(id,"storage-p",9)==0){
    char sql[768];
    snprintf(sql,sizeof sql,
      "CREATE TABLE storage_values(id INTEGER PRIMARY KEY, k TEXT, i, r, t, b);"
      "CREATE INDEX storage_k ON storage_values(k,i);"
      "INSERT INTO storage_values VALUES(-9223372036854775808,'min',-9223372036854775808,1.0,'',x'');"
      "INSERT INTO storage_values VALUES(9223372036854775807,'max',9223372036854775807,-0.0,'text',x'00FF80');"
      "WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<2000) "
      "INSERT INTO storage_values SELECT x,printf('key-%%06d',x),x,x+0.5,printf('value-%%06d',x),NULL FROM c;"
      "INSERT INTO storage_values VALUES(0,'overflow',0,0.0,hex(zeroblob(%d)),zeroblob(%d));",
      pageSize*2+37,pageSize*3+19);
    rc=exec(db,sql);
  }
  else if(!rc && strcmp(id,"empty")!=0) rc=SQLITE_MISUSE;
  if(!rc) rc=exec(db,"PRAGMA journal_mode=DELETE;VACUUM;");
  if(sqlite3_close(db)!=SQLITE_OK) rc=SQLITE_ERROR;
  return rc==SQLITE_OK?0:1;
}
