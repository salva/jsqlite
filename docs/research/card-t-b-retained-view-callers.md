# Retained-view caller matrix — beta-local author evidence

This is a new beta-local report, not enrollment of the project-only historical
`docs/research/card-t-b-caller-reconciliation.md`. The linked CTE repair has its
own [source/evidence report](card-t-b-cte-linked-identity.md). Current additional
work changes only the repeated-view paired tests. No complete-candidate hashing,
W/V run, staging or incorporation is represented here.

## Finite matrix and result

- Existing repeated `v_limited` ordinary/LIMIT/OFFSET/LIMIT0 controls are preserved;
  public now runs all three fixture encodings and compares all five origin fields.
- Explicit-list `v_bad` arity failure under LIMIT0 and repeated readers has pinned
  error1 `expected 1 columns for 'v_bad' but got 2`, followed by SELECT1 connection
  reuse, across all encodings. Initial public3/3 passed these additions.
- Explicit-list `v1(vb,vc)` through a retained ordered/limited derived consumer is
  a new native-first discriminator: INTEGER2/TEXT Alpha, INTEGER4/TEXT alpha,
  INTEGER6/NULL, exact base origins b/c, names vb/vc; reset twice, three encodings.
  Pinned passes. The earlier public rejection and two incomplete trials below
  are superseded by the producer-expansion repair described next.

## Current producer repair

`compileDerivedProducer` now resolves the retained child's stored definition,
then reuses `flattenImmutableView` before selecting a physical producer. This
moves the actual underlying FROM and expanded result expressions together; it
also aligns every represented derived-source/arm reference with the rewritten
child. Shared destination/builder and child ORDER/LIMIT remain unchanged. No
parallel evaluator or new view-flattenability rule was added. Resolution before
recursive substitution preserves circularity and arity rejection. This is the
same bounded view substitution already used at ordinary table entry, not a
platform-motivated algorithm replacement.

Fresh proc-3d0ed4982058 passed focused32/32 and tsc before the explicit definition
resolution guard. Final guarded proc-db2673474d93 passed pinned native first,
then public217/217 (four suites: repeated-view parent, parent-builder,
CTE fallback destination owner, subquery-view foundation), tsc exit0 and scoped
diffcheck. Node command uses `timeout 100s node --experimental-strip-types --test
--test-concurrency=1 --test-timeout=100000`; tsc uses `timeout 180s npx tsc --noEmit`.
All three-encoding metadata/storage/reset and v_bad error/reuse assertions now
execute successfully, rather than being hidden behind the new earlier failure.
Primary evidence work:///cards/card-t-b/view-owner2/{native.log,final.log,type-final.log,inputs.sha}.
These are affected-path author checks, not full candidate/W/V acceptance.

## Historical failed hypotheses (superseded, retained for provenance)

Pinned `build.c:viewGetColumnNames` duplicates the view SELECT, calls
`sqlite3ResultSetOfSelect(SQLITE_AFF_NONE)` and restores Parse cursor/select state.
View names and output arity belong to resolved ELists, not the number of syntactic
star expressions. Before repair, the TS retained derived compiler derived names by mapping
syntactic producer.result and matches parent projection by spelling. The new
`SELECT * FROM v1` producer has one syntactic result but two semantic outputs.
Changing only parent projection indices to resolved identities passed admission,
but metadata then lost vc. Adding resolved result names exposed a deeper invalid
physical scan (`page number outside database`); neither partial repair was kept.
Production vdbe SHA returned exactly to the pre-node receipt. Correct next work
is producer expansion/physical-vs-transient source ownership together, not merely
changing the observed rejection or relaxing metadata.

## Exact evidence

Cwd `/work/jsqlite2/integration-beta5`. Pinned SQLite3.53.4 manifest SourceID is
asserted by the native script using existing oracle library, not system Python.
Fixture inspection using system Python was discovery only.

- proc-1991c48be43d: initial extended native exit0, before public matching cases.
- proc-e59b06534704: public3/3 including three encodings, five-field repeated-view
  metadata and v_bad atomic error/reuse; before adding mixed-output discriminator.
- proc-5e3014b0598f: extended native mixed-output/metadata/reset plus definition
  errors/reuse across all three encodings exit0, before matching public case.
- proc-967f01e8e703: combined32,29pass/3fail at new retained consumer prepare.
- proc-b5c6a61d5ac5: trial linked projection3fail at missing vc metadata.
- proc-191c0de7639c: trial names3fail at runtime corrupt/page-outside-database;
  chained typecheck did not run. Trials reverted by exact text, not Git reset.
- proc-37c81c27bd4e: vdbe SHA equality with RED receipt, paired-test diffcheck,
  `timeout 180s npx tsc --noEmit` exit0 on restored production.

Primary logs work:///cards/card-t-b/view-green/{native.log,public.log,native2.log,public2.log,trial3.log,trial4.log,type-final.log}.
The prior-node final paired run remained RED at the demonstrated native/public
boundary; the current repair and successful execution above supersede it.
Earlier49/11 remain historical/nonadditive; accepted28529/29 applies to
its own inputs, not complete combined caller acceptance.

## Provenance disposition and enrollment boundary

Historical project report and root363eaa inputs are not copied into or silently
authenticated as beta0fc53b3c0d6ee2202ecb2ccd773b25f1f7b28a96. Sequential inventories
remain the historical `work:///cards/card-t-b/caller-reconciliation/project-inventory.json`
and `work:///cards/card-t-b/caller-reconciliation/integration-beta5-inventory.json`,
not frozen complete-candidate enrollment. Existing exact accepted evidence links
are [status278](record:///status.md?card=card-t-b&v=278),
[status279](record:///status.md?card=card-t-b&v=279), and
[RED287](record:///status.md?card=card-t-b&v=287). No new W/V enrollment link exists.
The stale pending-a statement is not a prerequisite for executing these controls;
a31's preliminary map still requires Planner/a authentication before promotion,
not blind copying. Historical COMMON_CHECKPOINT_OUTPUT prerequisite failure was
resolved by d192/d195; no present resource blocker or new availability claim.
Parent G1/G2/W/V and complete tracked+untracked/originals/S59 enrollment stay open.
