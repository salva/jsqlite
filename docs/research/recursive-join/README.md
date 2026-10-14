# Recursive physical consumer composition — card-n-c

This evidence applies to the local integrated tree based on `66d852ec`, including
pre-existing peer edits. It is not original225, old348, MAIN release acceptance,
or independent review. The prior common-checkpoint unsupported predictions were
reproduced before repair, not assumed current.

## Source comparison and actual boundary

Pinned `select.c:generateWithRecursiveQuery` emits setup through its destination,
then repeatedly shifts Queue to Current, applies producer OFFSET/LIMIT, emits the
current row to the consumer destination, and computes recursive successors.
`sqlite3Select` tag-select-0482 retains a non-flattened SrcItem by coroutine or
materialization; the enclosing WHERE and AggInfo own join predicates, grouping
and finalization. `resolveFromTermToCte` keeps CTE output identity distinct from
physical table provenance.

The repair uses the existing iterative queue producer with SRT-style ephemeral
destination, then shared WHERE/AggInfo, not copied finished programs or a second
join evaluator. Cursor IDs are reserved before queue allocation; OpenRead skips
retained handles. Rewind/Next/Column/Rowid dispatch private handles to the existing
Mem/KeyInfo cursor. Setup WHERE now runs before seed result/queue insertion,
matching the C setup SELECT (previously dropped for source-free setup).

Materialization consumes producer work/private space before the first output;
this is a retained destination choice, not a browser necessity or a claim of the
same planner selection as native. Inner/CROSS physical-table inputs are bounded;
SQL outer joins, repeated references to one recursive declaration, and
unrepresented joined compound/window consumers remain temporary unsupported
rather than receiving incomplete NullRow/seek paths. This specialization declines
before resolution/allocation/emission outside its admission: represented derived
inputs and distinct multiple-recursive declarations reach existing semantic owners.
Selected errors remain terminal, without catch-and-fallback. Pinned `select.c`
tag-select-0400/0482/0484/0486/0488 chooses retained production per SrcItem;
physical-only admission must not turn other represented producers into errors.
Repair commands, failing/passing counts and scoped integration artifacts are in
[[card:card-n-c]] [status](record:///status.md?card=card-n-c). The
[admission-only patch](admission-repair.patch) is against the pre-repair peer
workspace snapshot, not HEAD; integrate by exact context without replacing peers.
The earlier `scoped-source.patch` remains historical physical-join delivery evidence.
Existing window and single recursive aggregate owners retain dispatch priority.
Broader nested ordinary WITH composition is not established by these tests.

## Reproducible evidence

`test/fixtures/recursive-join/native.json` preserves the red-node pin-checked
common capture filtered to the two exact recursive join queries. Three database
images are retained beside it. `native.json` here contains five independently
captured companion shapes × three encodings, each prepared and reset twice;
`public.json` matches typed cells and all metadata on those 15 observations.
The exact common two shapes × three encodings also match typed cells and metadata
on two reset executions. No additional upstream Tcl assertion credit is claimed.

Native companion capture (fresh output directory required):

```sh
COMMON_CHECKPOINT_SOURCE="$PWD" \
COMMON_CHECKPOINT_OUTPUT="$SAIVAGE_CARD_WORK_ROOT/recursive-join-native-companions" \
python3 docs/research/recursive-join/capture.py \
 "$PWD/.saivage/work/cards/card-e-l/oracle-build/build/libsqlite3-oracle.so"
```

The script checks `sqlite3_sourceid()` against the manifest. Then use the common
`public-probe.mjs` with the same environment. Library paths are local evidence,
not runtime dependencies.

Focused combined command: `node --experimental-strip-types --test` with
`recursive-cte-join.test.mjs`, `select-recursive-builder.test.mjs`,
`recursive-group-window-projection.test.mjs`, `recursive-cte-aggregate.test.mjs`,
and `cte-execution.test.mjs` under `test/conformance/`. Completed output and exact
counts are retained in card status and process evidence. Join tests include
bindings/reset, duplicate UNION/ALL, empty setup, NULL, group/HAVING, outer versus
producer ORDER/LIMIT, abort/deadline/work admission, timer cancellation and atomic
outer-join rejection. Existing projection/window lifecycle tests are separate
regression evidence, not proof of joined window support. No full-suite/browser
or original225 comparison was run in this node.
