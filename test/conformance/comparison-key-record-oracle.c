/* Development-only direct oracle for SQLite's packed-LHS record comparator.
** This translation unit deliberately includes the pinned generated amalgamation
** so internal KeyInfo/UnpackedRecord routines are observable without exporting
** them from the runtime oracle library. It is compiled only by the Python test. */
#define SQLITE_THREADSAFE 0
#include "sqlite3.c"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int hexNibble(char value){
  if( value>='0' && value<='9' ) return value-'0';
  if( value>='a' && value<='f' ) return value-'a'+10;
  if( value>='A' && value<='F' ) return value-'A'+10;
  return -1;
}

static unsigned char *decodeHex(const char *text, int *length){
  size_t n = strlen(text);
  unsigned char *bytes;
  size_t i;
  if( (n&1)!=0 || n/2>0x7fffffff ) return 0;
  bytes = (unsigned char*)malloc(n/2 ? n/2 : 1);
  if( !bytes ) return 0;
  for(i=0; i<n; i+=2){
    int hi = hexNibble(text[i]);
    int lo = hexNibble(text[i+1]);
    if( hi<0 || lo<0 ){ free(bytes); return 0; }
    bytes[i/2] = (unsigned char)((hi<<4)|lo);
  }
  *length = (int)(n/2);
  return bytes;
}

int main(int argc, char **argv){
  sqlite3 *db = 0;
  KeyInfo *keyInfo = 0;
  UnpackedRecord *rhs = 0;
  unsigned char *lhsBytes = 0, *rhsBytes = 0;
  int lhsLength = 0, rhsLength = 0, rc, result = 1, nKeyField = 1, i;
  long sortFlags, defaultRc;
  char *end = 0;

  if( argc==2 && strcmp(argv[1], "--source-id")==0 ){
    puts(sqlite3_sourceid());
    return 0;
  }
  if( argc!=5 && argc!=6 ){
    fprintf(stderr, "usage: %s LHS_HEX RHS_HEX SORT_FLAGS DEFAULT_RC [N_KEY_FIELD]\n", argv[0]);
    return 2;
  }
  lhsBytes = decodeHex(argv[1], &lhsLength);
  rhsBytes = decodeHex(argv[2], &rhsLength);
  sortFlags = strtol(argv[3], &end, 10);
  if( !end || *end || sortFlags<0 || sortFlags>3 ) goto cleanup;
  defaultRc = strtol(argv[4], &end, 10);
  if( !end || *end || defaultRc < -1 || defaultRc > 1 ) goto cleanup;
  if( argc==6 ){
    long parsed = strtol(argv[5], &end, 10);
    if( !end || *end || parsed<1 || parsed>32 ) goto cleanup;
    nKeyField = (int)parsed;
  }
  if( !lhsBytes || !rhsBytes || sqlite3_open(":memory:", &db)!=SQLITE_OK ) goto cleanup;

  /* Allocate one auxiliary field, matching sqlite3VdbeAllocUnpackedRecord. */
  keyInfo = sqlite3KeyInfoAlloc(db, nKeyField, 1);
  if( !keyInfo ) goto cleanup;
  for(i=0; i<nKeyField; i++){
    keyInfo->aSortFlags[i] = (u8)sortFlags;
    keyInfo->aColl[i] = 0;
  }
  rhs = sqlite3VdbeAllocUnpackedRecord(keyInfo);
  if( !rhs ) goto cleanup;
  memset(rhs->aMem, 0, sizeof(Mem)*(keyInfo->nKeyField+1));
  sqlite3VdbeRecordUnpack(rhsLength, rhsBytes, rhs);
  rhs->default_rc = (i8)defaultRc;
  rhs->eqSeen = 0;

  rc = sqlite3VdbeRecordCompareWithSkip(lhsLength, lhsBytes, rhs, 0);
  printf("%d %u %u\n", rc<0 ? -1 : rc>0 ? 1 : 0, rhs->eqSeen, rhs->errCode);
  result = 0;
cleanup:
  if( rhs ) sqlite3DbFree(db, rhs);
  if( keyInfo ) sqlite3KeyInfoUnref(keyInfo);
  if( db ) sqlite3_close(db);
  free(lhsBytes);
  free(rhsBytes);
  return result;
}
