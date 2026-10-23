# Scalar comparison affinity repair

## Source owner and diagnosis

Input491669df36940c3cf9b531edc64c88f7d9454d73/tree3258657344123c72f04e693c6fc8692ff1fd4a96
fails the existing cross-affinity reverse public fixture:1056 rows instead of2080,
missing INTEGER1 matches to stored TEXT '01'. Forward returns2080. Original
primary failure/drain and immutable native receipts are retained by
[[card:card-s-a-c]] status14 and [[card:card-s-c-d-e]] status208.

Pinned SQLite3.53.4 SourceID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`:
expr.c342–358 sqlite3CompareAffinity combines affiliated operands; either numeric
selects NUMERIC, otherwise both affine selects BLOB/no conversion, one affine
selects that affinity. codeCompare calls binaryCompareP5 (398–410), which reads
both expressions, not just the first. IndexAffinityOk separately admits compatible
search keys; wherecode.c updateRangeAffinityStr handles probe conversion, not
residual scalar semantics. Native reverse omits the incompatible TEXT numeric
search key and retains a numeric residual; forward numeric probe affinity is not
a reason to give the reverse scalar residual TEXT affinity.

Actual TS path: joined resolveTree binds both physical source columns with their
schema affinities; joined outer-ON base terms reach compileExpressionTree through
the existing branch/value caller. Scalar Binary emission alone used
`expressionAffinity(left) ?? expressionAffinity(right)`. With TEXT lhs and INTEGER
rhs it emitted TEXT; Binary copies the two Mem operands and applies that affinity,
turning1 into '1' and losing '01'. Metadata and shared comparisonAffinity were
already correct. Vector field comparisons already used the shared helper.
The repair makes scalar emission consume the same two-operand helper. Binary
execution, collations, NULL evaluation, arithmetic, cursor positions, hit/null-row
publication and cleanup remain unchanged. Non-comparison Binary operations ignore
the affinity field. No alternative evaluator, automatic index, cache, hash or
algorithm substitution is introduced.

## Finite verification

Author checks, not independent acceptance. Commands run in ordinary integration-delivery;
all disposable captures under `$SAIVAGE_CARD_WORK_ROOT/affinity-repair/`.

- proc-0a867a8e8b69 exit0: for affinity and affinity-reverse, run existing
  `where-autoindex-capture.py --library .../select-in-oracle-build/libsqlite3-metadata.so
  --output .../affinity-repair/CASE --case CASE` **before** public companion
  `node --experimental-strip-types docs/research/where-autoindex-baseline.mjs .../CASE/native.json`;
  then tsc/diff-check. Native ON/OFF twice/all3enc each returns2080; public12
  executions per direction all2080, ordered typed rows/five metadata/reset and
  deterministic private work. TS plans remain two scans, zero autoindex credit.
  Full primary summary: `work:///cards/card-s-c-d-e/processes/proc-0a867a8e8b69/stdout.log`.
  Receipt hashes: forward f5256d6a5af05f3811eefa8970380d16e60cc88dce99d1c013423c6c04d0f22c;
  reverse396cc3ddbcbcc115c042913576c3b649f3e569eb46b1c6221ed4b9311e30a444.
  Reused independently built metadata library SHA8c8b2447ac51cc76d370160cf86f17f1f52b207d5c397a12673c74783f9a7ce7;
  source identity checked by capture, no fresh-build claim. Receipt hashes differ
  from original captures because library identity differs; original expected rows
  were not rewritten.
- proc-ccb6d0f4ec29 exit0: node test serial1/file60 scalar-comparison-affinity,
  value/comparison, right-residual, in-range-stat-ts and branch-applicability:
 274/274, no fail/cancel/skip,4145.078958ms. New scalar cases then covered10 expressions
  all3enc/twice; later expanded to12 after native capture below, separately rerun.
  Includes nested predicate/error/outer-ON and forced scan controls, not original
  large FULL/RIGHT workload.
- proc-55bd1f63c8e3 exit0: reverse companion with AUTO_PUBLIC_CONTROLS=1
  (4 controls×2SQL×3enc), then selected-red/stat-choice/where-in-loop57/57,
  no fail/cancel/skip,2163.635401ms, tsc/diff-check. Selected/offpath corruption,
  bounded selected work, LEFT restart/NULL/duplicates retained.
- proc-9be2dd1ac39d exit0: native-FIRST overflow and overflow-offpath capture,
  then existing public companions. Overflow12 error attempts (6 summaries×2);
  offpath12 success executions. Reset/error semantics remain enforced by existing helper.
- proc-b5d5827dae88 exit0: forward AUTO_PUBLIC_CONTROLS=1 (same24 controls),
  then direct pinned ctypes scalar oracle12 expressions, INTEGER/NULL results
  captured before expanding scalar regression with REAL/BLOB controls.
  `work:///cards/card-s-c-d-e/affinity-repair/scalar-native.json` retains results;
  complete process output gives exact expressions/results. No generated native
  expectation or fixture was committed/changed.

Original G84/K-f35 accepted71ad/tree695e primitive/WR foundations and original
FULL/RIGHT400×400/all3enc/twice/six executions/file60 evidence remain explicitly
retained, not freshly executed or independently accepted on this correction.
Original G adjudicates combined input separately. Historical1301 failures,
timing variability and unknown cancellation cause remain genuine. Root509,
package/browser and wider translated-machinery debt remain unwaived. No full
SQLite compatibility or runtime automatic-index/Bloom credit.
