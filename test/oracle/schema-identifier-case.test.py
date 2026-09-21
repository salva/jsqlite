#!/usr/bin/env python3
"""Pinned-oracle proof that SQLite identifier case folding is ASCII-only."""
import ctypes, json, os, pathlib, tempfile

root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root / "reference/sqlite/manifest.json").read_text())
work = pathlib.Path(os.environ.get("ORACLE_WORK_ROOT") or pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"]) / "oracle-build")
lib = ctypes.CDLL(str(work / "build/libsqlite3-oracle.so")); DB = ctypes.c_void_p
lib.sqlite3_sourceid.restype = ctypes.c_char_p
lib.sqlite3_open_v2.argtypes = [ctypes.c_char_p, ctypes.POINTER(DB), ctypes.c_int, ctypes.c_char_p]
lib.sqlite3_exec.argtypes = [DB, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_char_p)]
lib.sqlite3_close.argtypes = [DB]
lib.sqlite3_stricmp.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
lib.sqlite3_stricmp.restype = ctypes.c_int
assert lib.sqlite3_sourceid().decode() == manifest["sqliteSourceId"]
CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_char_p), ctypes.POINTER(ctypes.c_char_p))

def execute(db, sql):
    rows = []
    @CALLBACK
    def callback(_, count, values, names):
        rows.append(tuple(None if not values[i] else values[i].decode() for i in range(count))); return 0
    error = ctypes.c_char_p()
    rc = lib.sqlite3_exec(db, sql.encode(), callback, None, ctypes.byref(error))
    if rc: raise RuntimeError(error.value.decode() if error.value else f"rc={rc}")
    return rows

for encoding in ("UTF-8", "UTF-16le", "UTF-16be"):
    with tempfile.TemporaryDirectory(prefix="jsqlite-oracle-name-case-") as directory:
        db = DB(); path = pathlib.Path(directory) / "case.db"
        assert lib.sqlite3_open_v2(str(path).encode(), ctypes.byref(db), 6, None) == 0
        execute(db, f'''PRAGMA encoding="{encoding}";
          CREATE TABLE "Ä"("Ö" INTEGER PRIMARY KEY, "ö" TEXT);
          CREATE INDEX "IÄ" ON "Ä"("ö");
          CREATE TABLE "ä"(x); CREATE INDEX "iä" ON "ä"(x);
          CREATE TABLE parent(id PRIMARY KEY, other);
          CREATE TABLE child(a CHECK(length(a)>0), b,
            CONSTRAINT ck CHECK(a<>b),
            CONSTRAINT fk FOREIGN KEY(a,b) REFERENCES parent(id,other)
            ON DELETE CASCADE ON UPDATE SET NULL DEFERRABLE INITIALLY DEFERRED);''')
        assert execute(db, "SELECT type,name,tbl_name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY rowid") == [
            ("table", "Ä", "Ä"), ("index", "IÄ", "Ä"), ("table", "ä", "ä"), ("index", "iä", "ä"),
            ("table", "parent", "parent"), ("table", "child", "child")]
        assert execute(db, "SELECT \"from\",\"table\",\"to\",on_update,on_delete FROM pragma_foreign_key_list('child') ORDER BY seq") == [
            ("a", "parent", "id", "SET NULL", "CASCADE"), ("b", "parent", "other", "SET NULL", "CASCADE")]
        assert execute(db, "SELECT sql FROM sqlite_schema WHERE name='child'")[0][0].find("CHECK(length(a)>0)") >= 0
        assert lib.sqlite3_stricmp("IÄ".encode(), "iÄ".encode()) == 0
        assert lib.sqlite3_stricmp("Ä".encode(), "ä".encode()) != 0
        if encoding == "UTF-8":
            assert execute(db, "SELECT unicode(CAST(x'FF8080' AS TEXT)), unicode(CAST(x'FD8080' AS TEXT))") == [("65533", "4096")]
        assert lib.sqlite3_close(db) == 0
print("pinned oracle schema identifiers and CHECK/FK metadata: UTF-8/16le/16be agree; ASCII folds and non-ASCII case variants remain distinct")

chinook = pathlib.Path(os.environ.get("SAIVAGE_CARD_WORK_ROOT", "")) / "chinook-fixture/Chinook_Sqlite.sqlite"
# Public acquisition provenance (floating URL; acceptance is bound to size/hash):
# https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite
if chinook.is_file():
    import hashlib
    assert chinook.stat().st_size == 1007616
    assert hashlib.sha256(chinook.read_bytes()).hexdigest() == "7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15"
    db = DB(); assert lib.sqlite3_open_v2(str(chinook).encode(), ctypes.byref(db), 1, None) == 0
    assert execute(db, "SELECT count(*),min(Title) FILTER(WHERE AlbumId=1) FROM Album") == [("347", "For Those About To Rock We Salute You")]
    assert execute(db, "SELECT \"from\",\"table\",\"to\",on_update,on_delete FROM pragma_foreign_key_list('Album')") == [("ArtistId", "Artist", "ArtistId", "NO ACTION", "NO ACTION")]
    assert lib.sqlite3_close(db) == 0
