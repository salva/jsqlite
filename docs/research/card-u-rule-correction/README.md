# Card-u bounded rule/category correction

Evidence for [[card:card-u]], not current contract authority. Captured parent
is d9d945cbf9454456a4a80a11e728091b6408ac9c. Manifest preserves six exact
HEAD/index/work snapshots of the two affected documents, including superseded
wording and peer index intent. Earlier reconciliation archives remain intact.

## LIMIT semantic owner

The restored consolidation sentence saying ordinary SELECT coerces OFFSET before
zero bypass was wrong. Accepted a075309a8f6e001195756027c3e9d782200e4df8 had already
adjudicated it; this correction restores that source-backed current rule.
Pinned select.c computeLimitRegisters2539–2562 emits literal-zero Goto or dynamic
MustBeInt/IfNot before generating OFFSET expression/MustBeInt/OffsetLimit.
Committed vdbe.ts computeLimitRegisters2476ff has matching LIMIT MustBeInt/IfNot
before OFFSET lowering; scalar destinations preserve their own normalization.
No implementation change is needed. API already describes this correctly.

Exact public `SELECT 1 LIMIT 0 OFFSET 'x'` and `SELECT 1 LIMIT 0 OFFSET NULL`
prepare successfully and finish DONE, on reset/reexecution too. Nonzero invalid
OFFSET and invalid LIMIT retain datatype mismatch and reset/finalize ordering.
Original accepted test/audit evidence and earlier archive remain preserved.

## Catalog and categories

Current API immutable-catalog contract and committed schema.ts findSchemaTable/
SchemaGraph retain preferred/legacy identity and physical root1 SELECT consumers.
Pinned prepare.c sqlite3InitOne/build.c sqlite3FindTable/resolve.c name rules are
mapped in [catalog evidence](../card-e-m-public-catalog.md). Root's supplied
`e5e2658c` spelling was not a local revision; inspected history identifies
**5e2658c5** (aggregate catalog identity/linked consumers), atop b8b950bd.
Supported ordinary catalog SELECT is explicitly distinct from host graph
registration/introspection extensions or writes. No new catalog guarantee added.

PLAN now uses owner's four categories: common functional gaps, required
performance/safety foundations, deferred optimization-only work, rare functional
breadth. Represented delivery/evidence is separate context. Required storage/VM
semantic fidelity and safety are not classified as optional optimization. Root
still sequences work; no corpus-wide gate or new roadmap task is imposed.

## Actual verification

Committed runtime archive d51a26a from prior correction reused (docs-only parent
changes runtime zero). Adjudication test copies verified byte-identical to HEAD.
Commands at project-owned card work docs-closure/committed-example:

```
python3 test/conformance/limit-offset-adjudication-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
node --experimental-strip-types --test test/conformance/limit-offset-adjudication.test.mjs test/schema/public-catalog.test.mjs test/schema/public-catalog-lifecycle.test.mjs
```

Fresh pinned source-ID-asserting native check:48 cases/96 executions match across
three encodings, including reset/finalize errors; exit0. Public tests286/286,
no fail/cancel/skip/todo; exit0 (proc-0347f6ccc603). Logs under purpose-named
`docs-rule-correction/{native,public}.log`; no broad/browser/publication or new
compatibility credit. Focused checks support affected assertions only.

Only guide/PLAN affected paragraphs and adjacent evidence links changed. Full
historical snapshots retained; unrelated peer bytes/index are not reset/staged.
Per-hunk HEAD correction patch below preserves exact scope. Script/API unchanged.
