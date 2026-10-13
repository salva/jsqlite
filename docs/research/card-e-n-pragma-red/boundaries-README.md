# Bounded PRAGMA metadata and cleanup coverage

[[card:card-e-l]] add-coverage after verify v139. No product fixes, staging or
MAIN assembly. New files capture-boundaries.py, boundaries-native.json,
boundaries.test.mjs and this note.

Source comparison: pinned build.c4337ff merges implicit unique/PK indexes when
column and case-insensitive collation sequences match, ignoring direction;
explicit indexes remain distinct. pragma.c INDEX_LIST walks linked indexes and
INDEX_INFO emits logical and auxiliary fields. New independently acquired
native receipt asserts manifest sourceID before DDL and embeds SHA256-bound
images in all three encodings. Nine metadata queries per encoding compare exact
typed rows/order, including redundant differently directed/cased UNIQUE versus
PK, distinct BINARY uniqueness, explicit equivalent index, WITHOUT ROWID
merged PK and secondary suffixes. Reset replays exact rows, tails and zero
parameter count also checked. This is finite duplicate metadata coverage, not
arbitrary constraint-conflict certification.

Three lifecycle controls per encoding exercise actual PRAGMA table_info VM:
maxRows1 emits one row then errors; maxResultBytes1 errors on metadata text
before a row; per-step maxWorkUnits1 errors before a row. The connection retains
ordinary budget so SELECT7 recovery can succeed. Source reset/finalize behavior
is vdbeaux.c sqlite3VdbeReset and TS vdbe.ts reset/finalize: cleanup and READY/
finalized state precede reporting saved error. Tests assert saved limit error on
reset, deterministic repeated failure after reset, saved error on finalize,
then public SELECT7 and successful close. Separate parameter and unknown-schema
mutation-name ordering checks ensure parse/prepare failures publish no statement
and leave metadata usable. Host limits are project contracts, not native SQLite
maxRows/work equivalence. maxResultBytes is scalar length, not cumulative bytes.
No timing/scheduler or generic corruption/cancellation claim.

Commands:
- `python3 docs/research/card-e-n-pragma-red/capture-boundaries.py`: pinned27
  metadata receipts captured (proc-3f3f247ad710).
- `node --test docs/research/card-e-n-pragma-red/boundaries.test.mjs`:15/15 zero
  skips (proc-eeaee3fb8a62).
- Fresh acquisition then repeated focused suite15/15 twice, typecheck and
  cached index equality PASS (proc-334a5fce56d2; partial tail inspected).

These tests pass correct current behavior; no artificial failing expectation.
Relevant current guide/audit and pinned primitive paths reviewed. Accepted
STRICT/root guide and live peer index unchanged. Coherent scoped MAIN assembly
for [[card:card-e-n]] remains outstanding and belongs to owner/root; this node
neither stages it nor waits for it. Final suite acceptance remains verify.
