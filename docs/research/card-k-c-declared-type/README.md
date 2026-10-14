# Original INNER metadata assertion correction

At MAIN5bcafad (parent4ab82183), original test16:1 expected `int` for
`CREATE TABLE test1(f1 int, f2 int)`. Exact committed reproduction fails;
pinned3.53.4 native readonly capture on fixture SHA in original-native.json
publishes `INT` with unchanged name/main/test1/f1 origins and INTEGER rows.
Committed54e7a228 had translated standard typename canonicalization without
updating this original assertion. Correct that expectation, not runtime schema.

build.c sqlite3AddColumn1530–1586 dequotes and case-insensitively EXACT-matches
sqlite3StdType: eCType stores standard names, custom HASTYPE preserves spelling.
util.c sqlite3ColumnType104 selects custom spelling / canonical standard / default;
select.c columnTypeImpl follows physical and view producer origins. TS
parse.ts declaredTypeSource, schema columns and resolver descriptors follow this.
This is not a blanket uppercase policy. ANY/BLOB/INT/INTEGER/REAL/TEXT are standard;
custom, quoted mixed custom, no-type and expression boundaries remain distinct.

Native-first capture.py generated the three encoding fixtures and native.json
before public tests. The public companion checks all five metadata fields before,
after scan and after reset, including aliases, joins, generated, STRICT, view and
catalog consumers. It compares typed rows except generated REAL `g`: native
returns REAL2 while current committed TS returns INTEGER2 in ordinary/view scans.
That independently discovered value-affinity gap is recorded, NOT repaired or
claimed passing by this metadata-only slice; root/shared generated owner must
route it. All non-generated cells still compare exactly. No whole225-green claim.

Existing dirty test correction/comment was preserved, not staged or used as proof.
The committed correction blob is independently authored against HEAD using the
native evidence; unrelated appended dirty tests remain untouched. Detailed command
results, ownership/provenance boundary and exact receipt: [[card:card-k-c]] status.
