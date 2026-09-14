#include <sqlite3.h>
#include <stdio.h>
#include <string.h>

static int has_option(const char *z){ return sqlite3_compileoption_used(z); }

int main(int argc, char **argv){
  if(argc != 3 || strcmp(argv[1], "--self-check") != 0){
    fprintf(stderr, "usage: sqlite-oracle --self-check SOURCE_ID\n"); return 2;
  }
  if(strcmp(sqlite3_sourceid(), argv[2]) != 0){
    fprintf(stderr, "source id mismatch\n"); return 1;
  }
  if(strcmp(sqlite3_libversion(), "3.53.4") != 0 ||
     !has_option("ENABLE_COLUMN_METADATA") ||
     !has_option("ENABLE_MATH_FUNCTIONS") ||
     has_option("OMIT_JSON") || has_option("OMIT_UTF16") ||
     has_option("OMIT_FLOATING_POINT") || has_option("OMIT_AUTORESET")){
    fprintf(stderr, "required SQLite profile is absent: version=%d metadata=%d math=%d omit-json=%d omit-utf16=%d omit-fp=%d omit-autoreset=%d\n",
      sqlite3_libversion_number(), has_option("ENABLE_COLUMN_METADATA"), has_option("ENABLE_MATH_FUNCTIONS"),
      has_option("OMIT_JSON"), has_option("OMIT_UTF16"), has_option("OMIT_FLOATING_POINT"), has_option("OMIT_AUTORESET")); return 1;
  }
  sqlite3 *db = 0; sqlite3_stmt *st = 0;
  if(sqlite3_open(":memory:", &db) != SQLITE_OK ||
     sqlite3_prepare_v2(db, "select json('[1]'),sqrt(9)", -1, &st, 0) != SQLITE_OK ||
     sqlite3_step(st) != SQLITE_ROW || sqlite3_column_int(st, 1) != 3){
    fprintf(stderr, "capability probe failed\n"); return 1;
  }
  sqlite3_finalize(st); sqlite3_close(db);
  printf("{\"version\":\"%s\",\"versionNumber\":%d,\"sourceId\":\"%s\","
         "\"compileOptions\":[\"ENABLE_COLUMN_METADATA\",\"ENABLE_MATH_FUNCTIONS\"],"
         "\"probes\":{\"json\":true,\"math\":true,\"prepare16\":true,"
         "\"utf8\":true,\"utf16le\":true,\"utf16be\":true,"
         "\"floatingPoint\":true,\"columnMetadata\":true,\"autoreset\":true}}\n",
         sqlite3_libversion(), 3530400, sqlite3_sourceid());
  return 0;
}
