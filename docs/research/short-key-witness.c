/* Internal pinned-amalgamation witness; build with its directory in -I. */
#include "sqlite3.c"
#include <stdio.h>
int main(void){
 sqlite3 *db=0; Btree *bt; BtCursor *cur; KeyInfo *info; Pgno root; int rc,res;
 unsigned char a[]={2,15,'a'},b[]={2,15,'B'},z[]={2,15,'z'};
 unsigned char *records[]={a,b,z};
 sqlite3_open(":memory:",&db); sqlite3_exec(db,"BEGIN",0,0,0);
 sqlite3_mutex_enter(db->mutex); bt=db->aDb[0].pBt;
 rc=sqlite3BtreeBeginTrans(bt,1,0);if(rc)return 8;
 rc=sqlite3BtreeCreateTable(bt,&root,BTREE_BLOBKEY); if(rc)return 2;
 info=sqlite3KeyInfoAlloc(db,1,1);info->aColl[0]=sqlite3FindCollSeq(db,SQLITE_UTF8,"NOCASE",0);
 cur=sqlite3MallocZero(sqlite3BtreeCursorSize());
 rc=sqlite3BtreeCursor(bt,root,BTREE_WRCSR,info,cur);if(rc)return 3;
 for(int i=0;i<3;i++){
  BtreePayload p={0};p.pKey=records[i];p.nKey=3;
  rc=sqlite3BtreeInsert(cur,&p,0,0);printf("insert %d rc %d\n",i,rc);if(rc)return 4;
 }
 rc=sqlite3BtreeFirst(cur,&res);if(rc||res)return 5;
 do{unsigned char out[3];rc=sqlite3BtreePayload(cur,0,3,out);if(rc)return 6;
  printf("key %c bytes %u\n",out[2],sqlite3BtreePayloadSize(cur));
  rc=sqlite3BtreeNext(cur,0);
 }while(rc==SQLITE_OK);
 printf("end %d source %s\n",rc,sqlite3_sourceid());
 sqlite3BtreeCloseCursor(cur);sqlite3_free(cur);sqlite3KeyInfoUnref(info);
 sqlite3_mutex_leave(db->mutex);sqlite3_close(db);return rc==SQLITE_DONE?0:7;
}
