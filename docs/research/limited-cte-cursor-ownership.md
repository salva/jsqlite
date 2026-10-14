# Limited ordinary CTE cursor ownership repair

Revision-bound base: 66d852ece171a224db4466981474980abae99f97. Independent
nonrecursive failure, not recursive-admission or aggregate merge destination work.

Native build.c sqlite3SrcListAssignCursors assigns each SrcItem from Parse.nTab,
including nested subqueries. select.c tag-select-0488 retains the materialized
cursor while compiling its child; SRT_EphemTab inserts rows there. TS freshly
resolved child plans restarted cursorId at zero. Both direct ordinary materialized
fills and fallback passed that local ID as a physical shared VM cursor: OpenRead
replaced the already-open ephemeral destination. Insert then wrote into private
state no longer owned by the visible cursor. Ordered scans exposed the same
collision as an unpositioned rowid. LIMIT0 hid it by skipping the input.

Both callers now allocate physical child input cursors from the enclosing builder
and pass the existing cursorFor mapping contract to compileInnerTableSelect.
Destination, LIMIT exits, Gosub/Return and OpenDup remain unchanged; no guard,
error, alias or SQL spelling workaround. Representation is ordinary shared VDBE
cursor mapping, not an algorithm substitution. Other producer paths are not
asserted universally audited.

Reproducer before: 7 tests, 3 pass/4 fail (proc-f932a9653fa2; failed edit assertion
meant no source change). After: 7/7 (proc-3368177eed66). Expanded allencoding
owner suites plus CTE/aggregate controls: 41/41 and typecheck
(proc-2fc15007b5ed). Existing expected rows retained. Added six-run bind/reset
companion with full null metadata, INTEGER/NULL classes, empty OFFSET and LIMIT0,
then populated reuse. First expansion had test-only encoding scope mistake,
37/38 (proc-f586728810bb); fixed, no weakened expectations.

Independent pinned native source-ID-checked ctypes script and rebound six runs
allenc passed (proc-cec2a64dfcb1 native portion). Script retained under card work
limited-cte-repair/native.py. Resource invocation in that same command failed
because COMMON_CHECKPOINT_OUTPUT was omitted; corrected invocation used separate
retained derived-aggregate-alias and common-red captures. ORDER3/resources24 and
package boundary pass (proc-909f8f91a9e5). These resource tests protect the related
retained path; no new exhaustive materialization-budget claim.

No original225-wide rerun or new upstream conformance credit. Existing audit
revision-bound broad gaps remain. No recursive, GROUP, packed IN, compound merge
or peer source hunks edited. Shared index remains untouched. Exact owned proposal
and input snapshot are in card status; integration remains separately coordinated.

## Repeated immutable view caller correction (third retained collision)

On base 66d852e with earlier ordinary caller corrections retained, the separate
compileRepeatedImmutableView path resolved its physical-table producer starting
at builder.cursors but allocated owner/dup before reserving those resolved slots.
Unlike the two CTE callers' explicit remapping, this caller consumes source.cursorId
directly. Child OpenRead therefore replaced the materialized owner. Pinned build.c
sqlite3SrcListAssignCursors advances Parse.nTab while assigning each SrcItem;
select.c tags 0486/0488 retain distinct materialized and duplicate-reader cursors.
Reserve through the largest resolved source ID before allocating owner/dup. The
producer guard guarantees one physical source. Fill Gosub/Return, input rewind,
LIMIT exits, sorting and independently positioned duplicate iteration are unchanged.
This is cursor allocation bookkeeping, not an algorithm substitution or a planner
equivalence claim.

Existing public repeated-view + FROM routes reproduce four failures (empty instead
of INTEGER pairs 1/1,3/3,5/5), including all three route encodings. Including the
builder companion: red16/20, green20/20. Existing SQL, metadata, typed-row,
LIMIT/OFFSET/zero, two-cycle reset and prepare-error assertions were preserved;
the builder companion additionally checks reservation precedes owner allocation.
Independent source-ID-checked native companion confirms populated/limited/empty
rows. Current verification also passes ordinary41, recursive/admission controls,
retained ORDER3/resources24, typecheck and package boundary. Exact commands,
process outputs and isolated patch hash are in [[card:card-n-b]] status following
accepted red v130. These are bounded companion/internal/public checks, not new
exact upstream coverage or whole-suite green. Prior original225 residuals remain.


## Fourth caller: scalar derived aggregate-expression input

Accepted red [[card:card-n-b]] v139 reproduces INTEGER0 instead of3 for scalar
count(DISTINCT d.x) over ordered LIMIT4 t2. build.c:4926 advances Parse.nTab
for SrcItem inputs; expr.c:7538 assigns AggInfo iDistinct from the same frontier;
select.c resetAccumulator opens that independent DISTINCT KeyInfo cursor.
The TS caller used fresh resolved input IDs directly while allocating DISTINCT
from the enclosing builder, so producer OpenRead could replace DISTINCT state.
It now allocates producer inputs from that builder before DISTINCT/order cursors
and passes the existing cursorFor contract to compileInnerTableSelect. No change
to AggReset, aggregate semantics, LIMIT, output destinations or reset ordering.
This is cursor identity closure, not a new evaluator or algorithm substitution.

Unchanged scalar26 plus allocation/all-encoding companion4 pass; public LIMIT4/0/1
return INTEGER3/0/1 over two executions each. Independent source-ID-checked native
capture verifies names/types/rows for those three limits in all encodings.
Combined ordinary/recursive/repeated-view controls and type/package checks pass.
Exact commands, process outputs and isolated proposal are retained in card status
following v139. These are bounded public/internal/native companion checks, not
new upstream logical-case credit, whole-suite green or broader brief completion.
