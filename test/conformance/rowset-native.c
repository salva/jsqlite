/* Test-only standalone driver for pinned rowset.c; never linked into runtime.
 * Define the small allocator/assertion surface used by this isolated source. */
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef int64_t i64;
typedef int64_t sqlite3_int64;
typedef uint16_t u16;
typedef struct sqlite3 { int mallocFailed; } sqlite3;
typedef struct RowSet RowSet;
#define ROUND8(x) (((x)+7)&~7)
static void *sqlite3DbMallocRawNN(sqlite3 *db, size_t n){
  size_t *p=malloc(n+sizeof(size_t));
  if(!p){db->mallocFailed=1;return 0;} *p=n;return p+1;
}
static int sqlite3DbMallocSize(sqlite3 *db,void *p){(void)db;return (int)(((size_t*)p)[-1]);}
static void sqlite3DbFree(sqlite3 *db,void *p){(void)db;if(p)free((size_t*)p-1);}
#include "pinned-rowset.c"
int main(void){
  sqlite3 db={0}; RowSet *p=sqlite3RowSetInit(&db);
  char op; long long value; int batch;
  while(scanf(" %c",&op)==1){
    if(op=='i'){scanf("%lld",&value);sqlite3RowSetInsert(p,(i64)value);}
    else if(op=='t'){scanf("%d %lld",&batch,&value);printf("%d\n",sqlite3RowSetTest(p,batch,(i64)value));}
    else if(op=='n'){i64 v=0;int found=sqlite3RowSetNext(p,&v);if(found)printf("%lld\n",(long long)v);else puts("null");}
    else if(op=='x'){sqlite3RowSetClear(p);}
    else if(op=='c'){sqlite3RowSetDelete(p);p=sqlite3RowSetInit(&db);}
    else return 2;
  }
  sqlite3RowSetDelete(p);return db.mallocFailed?3:0;
}
