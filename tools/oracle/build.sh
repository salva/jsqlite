#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
WORK_ROOT=${ORACLE_WORK_ROOT:-${SAIVAGE_CARD_WORK_ROOT:?}/oracle-build}
EXPECTED_SAIVAGE=${SAIVAGE_CARD_WORK_ROOT:-}/oracle-build
case "$WORK_ROOT" in /|""|"$ROOT") echo "unsafe ORACLE_WORK_ROOT" >&2; exit 2;; esac
case "$WORK_ROOT" in "$ROOT"/*) test "$WORK_ROOT" = "$EXPECTED_SAIVAGE" || { echo "unsafe workspace-local ORACLE_WORK_ROOT" >&2; exit 2; };; esac
rm -rf -- "$WORK_ROOT"
mkdir -p "$WORK_ROOT/build"
python3 "$ROOT/tools/oracle/verify-source.py" "$ROOT/reference/sqlite/manifest.json"
cp -R "$ROOT/reference/sqlite/sqlite-src-3530400" "$WORK_ROOT/source"
chmod -R u+rwX "$WORK_ROOT/source"
find "$WORK_ROOT/source" -type f \( -name configure -o -path '*/autosetup/*' \) -exec chmod u+x {} +
cd "$WORK_ROOT/build"
CFLAGS='-O2 -g -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_MATH_FUNCTIONS' \
  sh "$WORK_ROOT/source/configure" --disable-shared
make sqlite3.c sqlite3.h libsqlite3.a
cc -std=c11 -O2 -g -Wall -Wextra -Werror \
  -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_MATH_FUNCTIONS \
  -I. "$ROOT/tools/oracle/sqlite_oracle.c" libsqlite3.a -lm -o sqlite-oracle
cc -std=c11 -O2 -g -Wall -Wextra -Werror -I. \
  "$ROOT/tools/oracle/sqlite_fixture.c" libsqlite3.a -lm -o sqlite-fixture
cc -std=c11 -O2 -g -fPIC -shared \
  -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_MATH_FUNCTIONS \
  sqlite3.c -lm -o libsqlite3-oracle.so
SOURCE_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sqliteSourceId"])' "$ROOT/reference/sqlite/manifest.json")
./sqlite-oracle --self-check "$SOURCE_ID" > "$WORK_ROOT/profile.json"
cat "$WORK_ROOT/profile.json"
