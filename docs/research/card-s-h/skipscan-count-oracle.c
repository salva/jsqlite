/* Calls the actual static native loop, not a copied counter implementation.
 * Development only; include identity-verified pinned ENABLE_STAT4 amalgamation. */
#define SQLITE_THREADSAFE 0
#define SQLITE_ENABLE_STAT4 1
#include "sqlite3.c"
#include <stdio.h>
#include <string.h>
static WhereTerm *bound(WhereTerm *term,Expr *cmp,Expr *value,const char *token){
 if(strcmp(token,"-")==0)return 0;
 memset(term,0,sizeof(*term));memset(cmp,0,sizeof(*cmp));memset(value,0,sizeof(*value));
 cmp->pRight=value;term->pExpr=cmp;
 value->op=strcmp(token,"?")==0?TK_COLUMN:strcmp(token,"NULL")==0?TK_NULL:TK_INTEGER;
 value->u.zToken=(char*)token;return term;
}
int main(int argc,char **argv){
 sqlite3 *db=0;Parse parse;WhereLoop loop;WhereTerm lo,hi;Expr lc,lv,hc,hv;
 Index *idx;IndexSample samples[4];unsigned char records[4][12];int done=0,rc,i;
 if(argc!=3)return 2;
 sqlite3_open(":memory:",&db);
 sqlite3_exec(db,"CREATE TABLE t(a,b INTEGER);CREATE INDEX ab ON t(a,b)",0,0,0);
 idx=sqlite3FindIndex(db,"ab","main");if(!idx)return 3;
 memset(&parse,0,sizeof(parse));parse.db=db;memset(&loop,0,sizeof(loop));loop.u.btree.pIndex=idx;loop.u.btree.nEq=1;loop.nOut=100;
 memset(samples,0,sizeof(samples));memset(records,0,sizeof(records));
 for(i=0;i<4;i++){records[i][0]=3;records[i][1]=8;records[i][2]=1;records[i][3]=i+1;samples[i].p=records[i];samples[i].n=4;}
 idx->aSample=samples;idx->nSample=4;
 rc=whereRangeSkipScanEst(&parse,bound(&lo,&lc,&lv,argv[1]),bound(&hi,&hc,&hv,argv[2]),&loop,&done);
 printf("%s\nlower=%s upper=%s rc=%d done=%d adjust=%d\n",sqlite3_sourceid(),argv[1],argv[2],rc,done,100-loop.nOut);
 idx->aSample=0;idx->nSample=0;sqlite3_close(db);return rc;
}
