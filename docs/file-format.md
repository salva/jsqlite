# SQLite file-format reading design

Status: Stage 3 storage-slice design with acquisition/header/page-source, record primitives, and internal known-root table/index b-tree reading implemented. A later Stage 3 tranche now implements bounded internal schema discovery and generated SQL parsing; resolver/compiler/VDBE execution remains unimplemented. Source identity is SQLite 3.53.4 from `reference/sqlite/manifest.json`. Assertions in `test/conformance/cases/stage3-storage.json` remain fixture/backlog evidence and grant no SQL-conformance TS credit.

## Immutable ownership and numeric bounds

`open()` owns one copied, complete file for the connection lifetime, as specified by `api.md`. Acquisition rejects a body over `maxFileBytes`, premature EOF, and lengths not consistent with page geometry before exposing a connection. The storage reader uses immutable `Uint8Array` bytes plus `DataView`; page numbers, byte offsets, payload lengths and cell indexes are JS `number` only after checked integer arithmetic proves `0 <= value <= Number.MAX_SAFE_INTEGER`. SQL integers and rowids are signed `bigint`. A page-number-to-offset calculation is checked as `(pgno-1)*pageSize`, never performed with 32-bit bitwise operators.

The 100-byte database header must have format-3 magic, page size 512..65536 (header value 1 means 65536), power-of-two geometry, read/write format 1, reserved byte count 0, supported encoding 1/2/3, a nonzero page count consistent with complete file bytes, and valid payload fractions. Unsupported clean-snapshot state is `unsupported/temporary` only when genuinely untranslated; malformed/impossible geometry is SQLite `SQLITE_CORRUPT` (extended subtype where source establishes one). Fetch/body failures remain `transport`; `maxFileBytes` and traversal budgets are `limit`; impossible translator invariants are `internal`.

## Pages, residency, and borrows

The connection owns one `ImmutableStorage` (`src/internal/storage.ts`) that
centralizes format/version/fraction/reserved-byte/page-count/encoding validation,
immutable copied residency, exact page reads and close invalidation. Public Fetch
open maps its typed storage failures to `JSQLiteError`; `BtreeDatabase` consumes
the exact owner held by the returned connection through an internal symbol bridge
(and may be constructed directly only by internal/tests), rather than reloading or
revalidating bytes. Closing the public connection invalidates page reads, new tree reads,
all cursor operations and cursor borrows; already returned owned payload copies
remain valid. There is no public storage accessor and no schema/SQL claim.

Because the complete file is resident, Pager/PCache translation is currently a
checked read-only view over one copied byte array, not asynchronous page I/O, a
reference-counted cache, or a journaling cache. `ImmutableStorage.read()`/`page()`
return subarray borrows and reject access after owner close. `BtreeDatabase`
retains only the root when opening a cursor. Seek descends selected pages and
retains one positioned cell descriptor; first/last/next/previous defer complete
ordered traversal until movement requires it. Payload assembly is
an owned copy, while its explicit cursor borrow accessor checks both cursor
movement generation and owner liveness. No `PageRef`, reader reference count,
parsed-page eviction, or statement-dependent close mechanism is implemented, so
none is claimed here. Future public strings/blobs must be owned copies, and no
internal borrow may cross its documented cursor/connection lifetime.

This adapts `pager.c/h` page acquisition and `pcache.c/h` fetch/release while omitting main-file locks, dirty lists, journal playback and writeback. `btree.c:lockBtree` remains the geometry/header model: page 1 begins its b-tree header at byte 100; other pages at byte 0; usable size is page size minus reserved bytes.

## B-tree pages, cursors, and payload

The internal known-root reader is now implemented in `src/internal/btree.ts` for
format-3 table/index interior and leaf pages. It validates page type/range, cell
count and pointer/content bounds, right-child pointers and touched cell extent.
Tree reads enforce `maxBtreeDepth` and active-path cycle detection. Cursor
construction retains only the root. Seek visits selected pages and retains one
positioned descriptor; complete ordered descriptor traversal is deferred until
first/last/next/previous movement requires it. Movement changes
an explicit generation, invalidating cursor borrows, while `payload()` returns an
owned copy. Index interior records occur between their left and following subtree,
unlike table interior separator keys. Table and caller-supplied index comparators
drive binary boundary seeks without introducing schema/collation approximation.
The implementation is a bounded read primitive rather than a whole-file integrity
checker: freeblock accounting and untouched-page validation remain deferred.

Table interior keys and table-leaf rowids are signed int64 varints represented as `bigint`; page numbers remain checked numbers. Index records use `KeyInfo`/`UnpackedRecord`: preserve field count, encoding, collation, DESC/NULL sort flags, `default_rc` and `eqSeen`. Never substitute JS array/string ordering for `sqlite3VdbeRecordCompare` and `sqlite3MemCompare`.

Local payload follows the exact `btree.c` min/max-local and surplus calculation for page kind and usable size. Overflow page pointers are big-endian u32 page numbers. Implemented traversal checks page range, excludes page 1, detects cycles/duplicates and exact termination, and enforces `maxOverflowPages`; impossible/truncated/repeated chains are corruption, configured exhaustion is a limit. Cancellation/work-unit charging remains for a later execution owner rather than being fabricated in this synchronous internal primitive.

## Records, varints, and text

`src/internal/record.ts` now ports the bounded core of
`util.c:sqlite3GetVarint` and
`vdbeaux.c:sqlite3VdbeSerialTypeLen/sqlite3VdbeSerialGet`. It returns unsigned
varints as exact `bigint`, validates the exclusive read bound, validates record
header and cumulative payload lengths before slicing, and preserves serial types
0..9 as NULL, exact signed `bigint`, REAL `{bits,value,classification}`, and the
integer constants 0/1. Serial 10/11 are explicit format errors. Types >=12 yield
borrowed zero-or-more-byte BLOB or encoding-tagged TEXT slices, preserving empty
TEXT versus empty BLOB. No public export was added; a later public value boundary
must copy BLOBs and faithfully convert TEXT. Focused TS evidence covers each
serial class 0..9, each signed width's extrema/negative values, exact bigint,
finite/signed-zero/infinite/NaN REAL raw bits and classes, all three raw text
encoding tags, empty/nonempty BLOB/TEXT, and trailing borrow behavior. These
expectations are derived from pinned `sqlite3SmallTypeSizes`,
`sqlite3VdbeSerialGet` evidence tags, and `sqlite3GetVarint`; they are distinct
from the native fixture catalog. Labelled local no-credit safety companions cover
reserved 10/11, malformed/truncated varints and header serials, invalid header
sizes, payload truncation, and non-wrapping huge serial lengths.

At the historical storage-only delivery, comparison, collation and text conversion
were explicit gaps in this primitive. The primitive itself still does not use
WHATWG `TextDecoder`, JS lexical ordering, `localeCompare`, or collapse NaN source
bits. Later Stage 3 internal slices now implement the shared Mem/UTF conversion,
`sqlite3VdbeRecordUnpack`, `sqlite3VdbeRecordCompare`, `sqlite3MemCompare`, and
built-in collations; public SQL consumers remain absent.

The controlling design remains: port `util.c:sqlite3GetVarint[32]` semantics with bounded reads and bigint intermediates. Record header size, serial varints, serial lengths and body sums are validated against available payload before access. Serial types 0..9 preserve NULL, signed integer widths (including 6-byte), IEEE-754 REAL bits, constants 0/1, and reserved-type corruption behavior; types >=12 derive BLOB/TEXT lengths without overflow. `vdbeaux.c:sqlite3VdbeSerialGet`, `sqlite3VdbeRecordUnpack`, `sqlite3VdbeRecordCompare`, and `sqlite3MemCompare` are controlling algorithms.

TEXT starts as `{bytes, encoding}` borrowed from the record. Decode only at the operation boundary that requires text. Port the applicable `utf.c` conversion/invalid-sequence behavior; WHATWG `TextDecoder`, JS lexical comparison and `localeCompare` are not compatibility substitutes. UTF-16 byte counts and endian interpretation remain explicit. Public text is a JS string and public BLOB a fresh `Uint8Array` copy.

## Reproducible coverage

The native fixture producer creates 18 immutable databases: the original eight Stage 2 files plus storage databases at page sizes 512, 1024, 2048, 4096, 8192, 16384, 32768 and 65536, with reserved=0; 4096-byte UTF-16le/UTF-16be companions complete all three encodings. Every storage database contains exact int64-min/max rowids, mixed record storage classes, 2,000 indexed rows (forcing multilevel table/index trees at small sizes), and deterministic text/BLOB overflow payloads. The focused verifier checks header bytes, catalog hashes/source ID, readonly native queries, integrity, exact values/index lookup and four ephemeral malformed companions. It never mutates checked-in fixtures.

Source-derived IDs and explicitly no-credit local safety adaptations are recorded in `test/conformance/cases/stage3-storage.json`. Runtime resource-limit assertions remain named backlog until an implementation can execute them; this document does not claim SQL/storage compatibility.
